const axios = require('axios')
const FormData = require('form-data')
const fetch = require('node-fetch')
const mime = require('mime-types')
const crypto = require('crypto')
const { AIRich, generateWAMessage, generateWAMessageFromContent, jidNormalizedUser } = require('hsnai')

const pluginConfig = {
    name: ['tiktokdl2'],
    alias: ['tiktok2', 'tt2', 'ttdown2'],
    category: 'download',
    description: 'Download video/slide TikTok tanpa watermark',
    usage: '.tiktok2 <url>',
    example: '.tiktok2 https://vt.tiktok.com/xxx',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

function getSendVariant(db) {
    return db?.setting('tt2Variant') || 'v2'
}

async function fetchTikTok(url) {
    const { data } = await axios.get(
        `https://api-faa.my.id/faa/tiktok?url=${encodeURIComponent(url)}`,
        { timeout: 30000 }
    )
    if (!data?.status) throw new Error('API tidak mengembalikan data yang valid.')
    return data.result
}

async function downloadBuffer(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.tiktok.com/'
        }
    })
    return Buffer.from(res.data)
}

// FIX: cek buffer hasil download beneran mp4 utuh, bukan cuma "berhasil didownload"
function isValidMp4Buffer(buf) {
    if (!buf || buf.length < 10000) return false
    return buf.slice(4, 8).toString('ascii') === 'ftyp'
}

// FIX: download video dengan fallback ke kandidat link lain kalau ternyata corrupt
async function downloadValidVideoBuffer(result) {
    const alt = result?.alternatives

    // urutan kandidat sesuai struktur asli API (data -> hd -> selected -> sd -> wm)
    // wm ditaruh paling akhir karena ada watermark, cuma dipakai kalau semua nowm gagal
    const candidates = [
        typeof result?.data === 'string' ? result.data : null,
        Array.isArray(result?.data) ? result.data[0] : null,
        typeof alt === 'string' ? alt : null,
        alt?.hd,
        alt?.selected,
        alt?.sd,
        Array.isArray(alt) ? alt[0] : null,
        alt?.wm
    ].filter(u => typeof u === 'string' && u.startsWith('http'))

    if (!candidates.length) throw new Error('URL video tidak ditemukan di response API.')

    let lastErr = null
    for (const url of candidates) {
        try {
            const buf = await downloadBuffer(url)
            if (isValidMp4Buffer(buf)) return buf
            console.log(`[TikTokDL2] kandidat corrupt (bukan mp4 valid), coba berikutnya...`)
        } catch (e) {
            lastErr = e
            console.log(`[TikTokDL2] kandidat gagal didownload: ${e.message}`)
        }
    }
    throw new Error(lastErr?.message || 'Semua kandidat video corrupt/gagal didownload.')
}

async function uploadToCatbox(buffer, filename) {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('fileToUpload', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form, headers: form.getHeaders() })
    if (!res.ok) throw new Error('Catbox gagal')
    const url = await res.text()
    if (!url.startsWith('http')) throw new Error('Invalid response')
    return url
}

async function uploadToLitterbox(buffer, filename) {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('time', '72h')
    form.append('fileToUpload', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', { method: 'POST', body: form, headers: form.getHeaders() })
    if (!res.ok) throw new Error('Litterbox gagal')
    const url = await res.text()
    if (!url.startsWith('http')) throw new Error('Invalid response')
    return url
}

async function uploadToKappa(buffer, filename) {
    const form = new FormData()
    form.append('file', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://kappa.lol/api/upload', {
        method: 'POST', body: form,
        headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0' },
        timeout: 60000
    })
    if (!res.ok) throw new Error('Kappa gagal')
    const data = JSON.parse(await res.text())
    if (!data?.link) throw new Error('Invalid response')
    return data.link
}

// Upload dengan fallback chain
async function uploadVideo(buffer, filename) {
    const uploaders = [
        { name: 'Catbox',    fn: () => uploadToCatbox(buffer, filename) },
        { name: 'Litterbox', fn: () => uploadToLitterbox(buffer, filename) },
        { name: 'Kappa',     fn: () => uploadToKappa(buffer, filename) },
    ]
    for (const u of uploaders) {
        try {
            const url = await u.fn()
            console.log(`[TikTokDL2] Upload berhasil via ${u.name}: ${url}`)
            return url
        } catch (e) {
            console.log(`[TikTokDL2] Upload gagal ${u.name}: ${e.message}`)
        }
    }
    throw new Error('Semua host upload gagal.')
}

// V1: kirim sebagai album message (gaya pins.js), fallback kirim satu-satu kalau album gagal
async function sendViaAlbum(sock, m, mediaList) {
    try {
        const opener = generateWAMessageFromContent(
            m.chat,
            {
                messageContextInfo: { messageSecret: crypto.randomBytes(32) },
                albumMessage: {
                    expectedImageCount: mediaList.filter(x => x.image).length,
                    expectedVideoCount: mediaList.filter(x => x.video).length
                }
            },
            {
                userJid: jidNormalizedUser(sock.user.id),
                quoted: m,
                upload: sock.waUploadToServer
            }
        )

        await sock.relayMessage(opener.key.remoteJid, opener.message, {
            messageId: opener.key.id
        })

        const generatedMessages = await Promise.all(mediaList.map(async (content) => {
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
            return msg
        }))

        for (const msg of generatedMessages) {
            await sock.relayMessage(msg.key.remoteJid, msg.message, {
                messageId: msg.key.id
            })
        }
    } catch (err) {
        console.log('[TikTokDL2] Album gagal, kirim satu-satu:', err.message)
        for (const content of mediaList) {
            await sock.sendMessage(m.chat, content, { quoted: m })
        }
    }
}

async function handler(m, { sock, db }) {
    const input = m.body?.trim()

    if (!input) {
        return m.reply(
            `『 🌸 *ᴛɪᴋᴛᴏᴋ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ* 🌸 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `✨ *Cara pakai:*\n` +
            `\`${m.prefix}tiktok2 <url>\`\n\n` +
            `💫 *Contoh:*\n` +
            `\`${m.prefix}tiktok2 https://vt.tiktok.com/xxx\`\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `> 💖 Ai siap bantu download buat kamu~ 🌸`
        )
    }

    const urlMatch = input.match(
        /https?:\/\/(vt\.tiktok\.com|vm\.tiktok\.com|www\.tiktok\.com|tiktok\.com)[^\s]*/
    )

    if (!urlMatch) {
        return m.reply(
            `『 💔 *URL Tidak Valid~* 』\n\n` +
            `> Gunakan link TikTok yang valid ya~ ✨\n` +
            `> Contoh: \`https://vt.tiktok.com/xxx\`\n\n` +
            `> Ai sayang kamu~ tapi linknya harus bener dulu~ 🌸`
        )
    }

    const tiktokUrl = urlMatch[0].split('?')[0]
    m.react('⭐')

    const variant = getSendVariant(db)

    try {
        const result = await fetchTikTok(tiktokUrl)

        const a    = result.author || {}
        const s    = result.stats || {}
        const mu   = result.music_info || {}
        const meta = result.metadata || {}
        const durasi = (!result.duration || result.duration === '0 seconds')
            ? (result.type === 'image' ? 'Slide/Foto' : '-')
            : result.duration

        const footer =
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `🌸 Downloaded with love by\n` +
            `✨ Hoshino Ai Bot ✨\n` +
            `「 推しの子 」\n` +
            `Ai selalu ada buat kamu~ 💖⭐`

        // ===== SLIDE FOTO =====
        if (result.type === 'image') {
            const slides = result.data || []
            if (slides.length === 0) throw new Error('Slide tidak ditemukan di response API.')

            const slideUrls = slides
                .map(s => (typeof s === 'string' ? s : s?.url))
                .filter(Boolean)

            if (slideUrls.length === 0) throw new Error('Gagal mendapatkan URL gambar slide :(')

            if (variant === 'v1') {
                // V1: kirim slide sebagai album, gaya pins.js
                const mediaPromises = slideUrls.map(async (url) => {
                    try {
                        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 })
                        return { image: Buffer.from(res.data) }
                    } catch (e) {
                        console.log('[TikTokDL2] Slide image error:', e.message)
                        return null
                    }
                })

                const mediaList = (await Promise.all(mediaPromises)).filter(x => x !== null)
                if (mediaList.length === 0) throw new Error('Gagal memuat gambar slide')

                // caption info ditaruh di gambar pertama biar tetap kebaca
                mediaList[0].caption =
                    `『 🎀 *${result.title || 'TikTok Slide'}* 』\n\n` +
                    `👤 Author: ${a.nickname || a.username || 'unknown'}\n` +
                    `👁️ Views: ${s.views || '-'} | ❤️ Likes: ${s.likes || '-'}\n\n` +
                    footer

                await sendViaAlbum(sock, m, mediaList)

                const audioUrl = mu.url || null
                if (audioUrl) {
                    await sock.sendMessage(
                        m.chat,
                        { audio: { url: audioUrl }, mimetype: 'audio/mpeg' },
                        { quoted: m }
                    )
                }
            } else {
                // V2: AIRich table (default)
                await new AIRich(sock)
                    .addImage(slideUrls)
                    .addTable([
                        ['🎀 ɪɴꜰᴏ ᴠɪᴅᴇᴏ', ''],
                        ['🎬 Judul', result.title || 'Unknown'],
                        ['👤 Author', a.nickname || a.username || 'unknown'],
                        ['🆔 Username', '@' + (a.username || '-')],
                        ['⏱️ Durasi', durasi],
                        ['🌏 Region', result.region || '-'],
                        ['📅 Dipost', result.taken_at || '-'],
                        ['🎥 Kualitas', meta.video_quality || '-'],
                    ])
                    .addTable([
                        ['📊 sᴛᴀᴛɪsᴛɪᴋ', ''],
                        ['👁️ Views', String(s.views || '-')],
                        ['❤️ Likes', String(s.likes || '-')],
                        ['💬 Komentar', String(s.comment || '-')],
                        ['🔁 Share', String(s.share || '-')],
                        ['🔖 Simpan', String(s.save || '-')],
                        ['⬇️ Download', String(s.download || '-')],
                    ])
                    .addTable([
                        ['🎵 ɪɴꜰᴏ ᴍᴜsɪᴋ', ''],
                        ['🎼 Judul', mu.title || '-'],
                        ['🎤 Artist', mu.author || '-'],
                        ['💿 Album', mu.album || '-'],
                        ['⏳ Durasi', mu.duration || '-'],
                        ['🎹 Original', mu.original ? 'Ya' : 'Tidak'],
                    ])
                    .setFooter(footer)
                    .send(m.chat, { quoted: m.raw })

                const audioUrl = mu.url || null
                if (audioUrl) {
                    await sock.sendMessage(
                        m.chat,
                        { audio: { url: audioUrl }, mimetype: 'audio/mpeg' },
                        { quoted: m }
                    )
                }
            }

            m.react('✅')
            return
        }

        // ===== VIDEO =====
        // FIX: dulu langsung ambil 1 kandidat url tanpa validasi (dan field nowm/nowm_hd
        // yang dipakai nggak pernah ada di response API), jadi kalau kandidat itu corrupt
        // buffer-nya ikut corrupt lalu diupload apa adanya. Sekarang coba tiap kandidat,
        // validasi buffernya (cek ftyp box), pakai yang pertama valid.
        const videoBuf = await downloadValidVideoBuffer(result)
        const hostedUrl = await uploadVideo(videoBuf, 'tiktok.mp4')

        if (variant === 'v1') {
            // V1: kirim video sebagai album (1 item), gaya pins.js
            const caption =
                `『 🎀 *${result.title || 'TikTok Video'}* 』\n\n` +
                `👤 Author: ${a.nickname || a.username || 'unknown'}\n` +
                `⏱️ Durasi: ${durasi}\n` +
                `👁️ Views: ${s.views || '-'} | ❤️ Likes: ${s.likes || '-'}\n\n` +
                footer

            await sendViaAlbum(sock, m, [{ video: { url: hostedUrl }, caption }])
        } else {
            // V2: AIRich table (default)
            await new AIRich(sock)
                .addVideo(hostedUrl)
                .addTable([
                    ['🎀 ɪɴꜰᴏ ᴠɪᴅᴇᴏ', ''],
                    ['🎬 Judul', result.title || 'Unknown'],
                    ['👤 Author', a.nickname || a.username || 'unknown'],
                    ['🆔 Username', '@' + (a.username || '-')],
                    ['⏱️ Durasi', durasi],
                    ['🌏 Region', result.region || '-'],
                    ['📅 Dipost', result.taken_at || '-'],
                    ['🎥 Kualitas', meta.video_quality || '-'],
                ])
                .addTable([
                    ['📊 sᴛᴀᴛɪsᴛɪᴋ', ''],
                    ['👁️ Views', String(s.views || '-')],
                    ['❤️ Likes', String(s.likes || '-')],
                    ['💬 Komentar', String(s.comment || '-')],
                    ['🔁 Share', String(s.share || '-')],
                    ['🔖 Simpan', String(s.save || '-')],
                    ['⬇️ Download', String(s.download || '-')],
                ])
                .addTable([
                    ['🎵 ɪɴꜰᴏ ᴍᴜsɪᴋ', ''],
                    ['🎼 Judul', mu.title || '-'],
                    ['🎤 Artist', mu.author || '-'],
                    ['💿 Album', mu.album || '-'],
                    ['⏳ Durasi', mu.duration || '-'],
                    ['🎹 Original', mu.original ? 'Ya' : 'Tidak'],
                ])
                .setFooter(footer)
                .send(m.chat, { quoted: m.raw })
        }

        m.react('✅')

    } catch (err) {
        console.error('[TikTokDL2] Error:', err)
        m.react('❌')
        m.reply(
            `『 💥 *E R R O R* 』\n\n` +
            `> ${err?.message || err?.toString() || 'Unknown error'}\n\n` +
            `> 💔 Maaf ya~ Ai gagal kali ini...\n` +
            `> Coba lagi nanti ya~ 🌸`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}