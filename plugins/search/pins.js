const { pinterest } = require('btch-downloader')
const { generateWAMessage, generateWAMessageFromContent, jidNormalizedUser, delay } = require('hsnai')
const { getDatabase } = require('../../src/lib/database')
const axios = require('axios')
const crypto = require('crypto')

const pluginConfig = {
    name: 'pins',
    alias: ['pinsearch', 'pinterestsearch'],
    category: 'search',
    description: 'Cari gambar di Pinterest (album)',
    usage: '.pins <query>',
    example: '.pins Zhao Lusi',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const TARGET_COUNT = 5

/**
 * Cek apakah buffer beneran file gambar yang valid, lewat magic bytes
 * (bukan cuma percaya Content-Type header, karena kadang server balikin
 * halaman error/redirect tapi header-nya masih ngaku "image/*").
 */
function isValidImageBuffer(buf) {
    if (!buf || buf.length < 500) return false // kekecilan, kemungkinan halaman error/kosong

    // JPEG: FF D8 FF
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
        buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
        buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A
    ) return true

    // WEBP: 'RIFF'....'WEBP'
    if (
        buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
    ) return true

    // GIF: 'GIF87a' / 'GIF89a'
    const header6 = buf.slice(0, 6).toString('ascii')
    if (header6 === 'GIF87a' || header6 === 'GIF89a') return true

    return false
}

/**
 * Download 1 URL gambar, validasi hasilnya. Return Buffer kalau valid,
 * null kalau gagal/rusak (biar caller bisa skip & coba kandidat lain).
 */
async function downloadValidImage(imageUrl) {
    if (!imageUrl) return null

    try {
        const res = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        })

        const contentType = res.headers?.['content-type'] || ''
        if (contentType && !contentType.startsWith('image/')) {
            console.log(`[Pins] Skip (content-type bukan gambar: ${contentType}): ${imageUrl}`)
            return null
        }

        const buf = Buffer.from(res.data)

        if (!isValidImageBuffer(buf)) {
            console.log(`[Pins] Skip (gagal validasi magic bytes, kemungkinan korup/error page): ${imageUrl}`)
            return null
        }

        return buf
    } catch (e) {
        console.log(`[Pins] Skip (download error: ${e.message}): ${imageUrl}`)
        return null
    }
}

function extractImageUrl(item) {
    return item?.image_url || item?.images?.orig?.url || item?.images?.['736x']?.url || null
}

async function handler(m, { sock }) {
    const query = m.text?.trim()
    if (!query) {
        return m.reply(
            `🔍 *ᴘɪɴᴛᴇʀᴇsᴛ sᴇᴀʀᴄʜ*\n\n` +
            `> Contoh:\n` +
            `\`${m.prefix}pins Zhao Lusi\``
        )
    }
    m.react('🕕')

    try {
        const data = await pinterest(query)
        console.log('[Pins][DEBUG] raw data:', JSON.stringify(data)?.slice(0, 2000))
        const candidates = data?.result?.result?.result || []
        console.log('[Pins][DEBUG] candidates.length:', candidates.length)

        if (candidates.length === 0) {
            m.react('❌')
            return m.reply(`❌ *Ehh~* Tidak ditemukan hasil untuk: ${query} 🥺`)
        }

        // Cek variant aktif — kalau v14, jalur AIRich (lewat m.reply)
        let replyVariant = 1
        try {
            const db = getDatabase()
            replyVariant = db?.setting?.('replyVariant') || db?.db?.data?.settings?.replyVariant || 1
        } catch {
            replyVariant = 1
        }

        if (replyVariant === 14) {
            const imageUrls = candidates
                .slice(0, TARGET_COUNT)
                .map(extractImageUrl)
                .filter(Boolean)

            if (imageUrls.length === 0) {
                m.react('❌')
                return m.reply('❌ *Gomen ne~* Gagal memuat gambar~ 🥺')
            }

            await m.reply(
                `🔍 *Hasil pencarian Pinterest untuk:* _${query}_`,
                { image: imageUrls }
            )

            m.react('✅')
            return
        }

        // ── JALUR ASLI (album relay native WA) ──────────────────────────
        const mediaList = []
        for (const item of candidates) {
            if (mediaList.length >= TARGET_COUNT) break

            const imageUrl = extractImageUrl(item)
            const buf = await downloadValidImage(imageUrl)
            if (buf) mediaList.push({ image: buf })
        }

        if (mediaList.length === 0) {
            m.react('❌')
            return m.reply('❌ *Gomen ne~* Gagal memuat gambar (semua kandidat rusak/invalid)~ 🥺')
        }

        try {
            const opener = generateWAMessageFromContent(
                m.chat,
                {
                    messageContextInfo: { messageSecret: crypto.randomBytes(32) },
                    albumMessage: {
                        expectedImageCount: mediaList.length,
                        expectedVideoCount: 0
                    }
                },
                {
                    userJid: jidNormalizedUser(sock.user.id),
                    quoted: m
                }
            )

            await sock.relayMessage(opener.key.remoteJid, opener.message, {
                messageId: opener.key.id
            })

            await delay(500)

            for (let i = 0; i < mediaList.length; i++) {
                const content = mediaList[i]

                const msg = await generateWAMessage(opener.key.remoteJid, content, {
                    upload: sock.waUploadToServer
                })

                msg.message.messageContextInfo = {
                    messageSecret: crypto.randomBytes(32),
                    messageAssociation: {
                        associationType: 1,
                        parentMessageKey: opener.key
                    }
                }

                await sock.relayMessage(msg.key.remoteJid, msg.message, {
                    messageId: msg.key.id
                })

                if (i < mediaList.length - 1) {
                    await delay(300)
                }
            }

            m.react('✅')
        } catch (err) {
            console.log('[Pins] Album gagal, kirim satu-satu:', err.message)

            for (const content of mediaList) {
                await sock.sendMessage(m.chat, content, { quoted: m })
            }

            m.react('✅')
        }
    } catch (err) {
        console.error('[Pins] Error:', err.message)
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${err.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = { config: pluginConfig, handler }