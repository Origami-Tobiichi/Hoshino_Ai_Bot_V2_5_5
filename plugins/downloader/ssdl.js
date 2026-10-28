/**
✧ Name    : ssdl
✧ Alias   : slideshare, ssimg
✧ Category: download
✧ Author  : Sea
✧ Deskripsi: Ambil semua gambar slide dari sebuah link SlideShare, lalu kirim semuanya sebagai album ke chat.
**/

const { generateWAMessage, generateWAMessageFromContent, jidNormalizedUser, delay } = require('hsnai')
const { getDatabase } = require('../../src/lib/database')
const axios = require('axios')
const crypto = require('crypto')

const pluginConfig = {
    name: 'ssdl',
    alias: ['slideshare', 'ssimg'],
    category: 'download',
    description: 'Ambil semua gambar slide dari link SlideShare',
    usage: '.ssdl <link slideshare>',
    example: '.ssdl https://www.slideshare.net/slideshow/nama-slide/123456',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 1,
    isEnabled: true
}

const TARGET_COUNT = 30
const RESOLUTION_CANDIDATES = [2048, 1024, 768, 638]
const RESOLUTION_FAIL_THRESHOLD = 3

function isValidImageBuffer(buf) {
    if (!buf || buf.length < 500) return false

    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true

    if (
        buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
        buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A
    ) return true

    if (
        buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
    ) return true

    return false
}

async function tryFetchImage(imageUrl) {
    try {
        const res = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
                'Referer': 'https://www.slideshare.net/',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
            },
            validateStatus: (status) => status === 200
        })

        const contentType = res.headers?.['content-type'] || ''
        if (contentType && !contentType.startsWith('image/')) {
            console.log(`[SSDL] Skip (content-type bukan gambar: ${contentType}): ${imageUrl}`)
            return null
        }

        const buf = Buffer.from(res.data)

        if (!isValidImageBuffer(buf)) {
            console.log(`[SSDL] Skip (gagal validasi magic bytes): ${imageUrl}`)
            return null
        }

        return buf
    } catch (e) {
        console.log(`[SSDL] Skip (${e.response?.status || e.message}): ${imageUrl}`)
        return null
    }
}

function createResolutionTracker() {
    const failCount = new Map()
    const blocked = new Set()

    return {
        isBlocked(size) {
            return blocked.has(size)
        },
        reportFail(size) {
            const count = (failCount.get(size) || 0) + 1
            failCount.set(size, count)
            if (count >= RESOLUTION_FAIL_THRESHOLD) {
                blocked.add(size)
            }
        },
        reportSuccess(size) {
            failCount.set(size, 0)
        }
    }
}

async function downloadValidImage(baseUrl, originalUrl, tracker) {
    for (const size of RESOLUTION_CANDIDATES) {
        if (tracker.isBlocked(size)) continue

        const candidateUrl = baseUrl.replace(/-\d+\.jpg$/, `-${size}.jpg`)
        const buf = await tryFetchImage(candidateUrl)

        if (buf) {
            tracker.reportSuccess(size)
            return buf
        }

        tracker.reportFail(size)
    }

    if (originalUrl) {
        return tryFetchImage(originalUrl)
    }

    return null
}

async function extractSlideImageUrls(pageUrl) {
    const { data: html } = await axios.get(pageUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 20000
    })

    const regex = /https:\/\/image\.slidesharecdn\.com\/[^"'\s]+?-(\d+)-320\.jpg/g
    const found = new Map()
    let match

    while ((match = regex.exec(html)) !== null) {
        const slideNum = parseInt(match[1], 10)
        const original = match[0]
        const hq = original.replace('-320.jpg', '-2048.jpg')
        found.set(slideNum, { hq, original })
    }

    return [...found.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, urls]) => urls)
}

async function handler(m, { sock }) {
    const url = m.text?.trim()

    if (!url || !/slideshare\.net\/slideshow\//i.test(url)) {
        return m.reply(
            `🖼️ *ssᴅʟ - sʟɪᴅᴇsʜᴀʀᴇ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ* 🎤\n\n` +
            `> Kirim link SlideShare-nya ya~ ✨\n\n` +
            `> ${m.prefix}ssdl <link slideshare>\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> ${m.prefix}ssdl https://www.slideshare.net/slideshow/nama-slide/123456\n\n` +
            `Plugin by Sea`
        )
    }

    await m.react('🕕')

    try {
        const slideUrls = await extractSlideImageUrls(url)

        if (slideUrls.length === 0) {
            await m.react('❌')
            return m.reply('❌ *Gomen ne~* Gagal menemukan gambar slide (link invalid atau proteksi berubah)~ 🥺')
        }

        let replyVariant = 1
        try {
            const db = getDatabase()
            replyVariant = db?.setting?.('replyVariant') || db?.db?.data?.settings?.replyVariant || 1
        } catch {
            replyVariant = 1
        }

        if (replyVariant === 14) {
            const capped = slideUrls
                .slice(0, TARGET_COUNT)
                .map((s) => s.hq.replace(/-\d+\.jpg$/, '-768.jpg'))

            await m.reply(
                `🖼️ *${capped.length} slide ditemukan* (dari ${slideUrls.length} total)`,
                { image: capped }
            )

            await m.react('✅')
            return
        }

        const tracker = createResolutionTracker()
        const mediaList = []
        let failedCount = 0

        for (const { hq, original } of slideUrls) {
            if (mediaList.length >= TARGET_COUNT) break

            const buf = await downloadValidImage(hq, original, tracker)
            if (buf) {
                mediaList.push({ image: buf })
            } else {
                failedCount++
            }
        }

        if (mediaList.length === 0) {
            await m.react('❌')
            return m.reply(
                `❌ Gagal memuat gambar (semua ${slideUrls.length} kandidat rusak/invalid).\n` +
                `Kemungkinan CDN slidesharecdn.com lagi memblokir request otomatis.`
            )
        }

        if (failedCount > 0) {
            await m.reply(`⚠️ ${failedCount} slide gagal dimuat, lanjut kirim ${mediaList.length} slide yang berhasil~`)
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

            await m.react('✅')
        } catch (err) {
            console.log('[SSDL] Album gagal, kirim satu-satu:', err.message)

            for (const content of mediaList) {
                await sock.sendMessage(m.chat, content, { quoted: m })
            }

            await m.react('✅')
        }
    } catch (error) {
        console.error('[SSDL] Error:', error)
        await m.react('❌')
        return m.reply(`❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ*\n\n> ${error.message}\n\n> Coba lagi ya, atau cek link SlideShare-nya masih valid nggak~`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}