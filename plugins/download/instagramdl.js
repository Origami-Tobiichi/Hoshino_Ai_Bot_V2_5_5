const axios = require('axios')
const config = require('../../config')
const { reelsvideo } = require('../../src/scraper/reelsvideo')
const { saveig } = require('../../src/scraper/saveig')
const { snapinsta } = require('../../src/scraper/snapinsta')

const pluginConfig = {
    name: 'instagramdl',
    alias: ['igdl', 'ig', 'instagram'],
    category: 'download',
    description: 'Download video/foto Instagram',
    usage: '.instagramdl <url>',
    example: '.instagramdl https://www.instagram.com/reel/xxx',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const IG_REGEX = /instagram\.com\/(p|reel|reels|stories|tv)\//i
const VIDEO_POST_REGEX = /instagram\.com\/(reel|reels|tv)\//i
// Banner/iklan dari situs downloader (tambah di sini kalau nemu pola baru)
const BANNER_REGEX = /snapinsta|saveig\.(app|com)\/(assets|static|banner)|experiencing[-_]?errors/i
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36'

async function sendMediaGroup(sock, chat, m, items, mediaKey, ctxInfo) {
    if (!items.length) return

    if (items.length === 1) {
        await sock.sendMessage(m.chat, {
            [mediaKey]: { url: items[0] },
            contextInfo: ctxInfo
        }, { quoted: m })
        return
    }

    await sock.sendMessage(chat, {
        albumMessage: items.map(url => ({ [mediaKey]: { url } })),
        contextInfo: ctxInfo
    }, { quoted: m })
}

// Klasifikasi link mentah jadi video/foto lewat content-type + magic bytes.
async function classifySaveigLinks(links) {
    const videos = []
    const images = []

    await Promise.all(links.map(async (url) => {
        try {
            const res = await axios.get(url, {
                timeout: 15000,
                validateStatus: () => true,
                responseType: 'arraybuffer',
                headers: {
                    'referer': 'https://snapinsta.top/',
                    'range': 'bytes=0-2048',
                    'user-agent': UA
                }
            })

            const buf = Buffer.from(res.data)
            const ct = String(res.headers['content-type'] || '')

            if (ct.startsWith('video/')) { videos.push(url); return }
            if (ct.startsWith('image/')) { images.push(url); return }

            const isMp4 = buf.length >= 8 && buf.slice(4, 8).toString('ascii') === 'ftyp'
            const isJpg = buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xD8
            const isPng = buf.length >= 2 && buf[0] === 0x89 && buf[1] === 0x50
            const isWebp = buf.length >= 12 && buf.slice(8, 12).toString('ascii') === 'WEBP'

            if (isMp4) videos.push(url)
            else if (isJpg || isPng || isWebp) images.push(url)
            else {
                console.error('[classifySaveigLinks] tipe nggak dikenali, size:', buf.length, 'url:', url)
            }
        } catch (err) {
            console.error('[classifySaveigLinks] gagal cek:', url, err.message)
        }
    }))

    let type = 'unknown'
    if (videos.length && images.length) type = 'carousel'
    else if (videos.length) type = 'video'
    else if (images.length) type = 'photo'

    return { type, videos, images }
}

// Tolak hasil yang jelas bukan media asli (banner/iklan downloader).
function isValidResult(postUrl, result) {
    const all = [...(result.videos || []), ...(result.images || [])]
    if (!all.length) return false

    // Ada link yang berasal dari banner downloader
    if (all.some(u => BANNER_REGEX.test(u))) return false

    // Link reel/tv harus punya video. Kalau cuma gambar, itu pasti banner/thumbnail.
    if (VIDEO_POST_REGEX.test(postUrl) && !result.videos.length) return false

    return true
}

// Ambil semua URL http dari bentuk output apa pun (array, object, nested)
function extractUrls(data) {
    const out = new Set()
    const walk = (v) => {
        if (!v) return
        if (typeof v === 'string') {
            if (/^https?:\/\//i.test(v)) out.add(v)
            return
        }
        if (Array.isArray(v)) return v.forEach(walk)
        if (typeof v === 'object') {
            for (const k of ['url', 'download_url', 'downloadUrl', 'video', 'image', 'result', 'data']) {
                if (v[k]) walk(v[k])
            }
        }
    }
    walk(data)
    return [...out]
}

// Urutan: reelsvideo -> saveig -> snapinsta -> btch-downloader.
// Setiap sumber divalidasi; kalau hasilnya banner/palsu, lanjut ke sumber berikutnya.
async function fetchMedia(url) {
    const cleanUrl = url.split('?')[0]
    const errors = {}

    const sources = [
        {
            name: 'reelsvideo',
            run: async () => {
                const r = await reelsvideo(cleanUrl)
                if (r.type === 'unknown' || !(r.videos.length || r.images.length)) {
                    throw new Error('hasil kosong/unknown')
                }
                return r
            }
        },
        {
            name: 'saveig',
            run: async () => {
                const r = await saveig(cleanUrl)
                if (!r.result.length) throw new Error('hasil kosong')
                const c = await classifySaveigLinks(r.result)
                if (c.type === 'unknown') throw new Error('gagal klasifikasi media')
                return c
            }
        },
        {
            name: 'snapinsta',
            run: async () => {
                const r = await snapinsta(cleanUrl)
                if (!r.result.length) throw new Error('hasil kosong')
                const c = await classifySaveigLinks(r.result)
                if (c.type === 'unknown') throw new Error('gagal klasifikasi media')
                return c
            }
        },
        {
            name: 'btch-downloader',
            run: async () => {
                const { igdl } = require('btch-downloader')
                const data = await igdl(cleanUrl)
                console.log('[instagramdl] btch igdl raw:', JSON.stringify(data)?.slice(0, 500))
                const links = extractUrls(data)
                if (!links.length) throw new Error('hasil kosong')
                const c = await classifySaveigLinks(links)
                if (c.type === 'unknown') throw new Error('gagal klasifikasi media')
                return c
            }
        }
    ]

    for (const src of sources) {
        try {
            const result = await src.run()
            if (!isValidResult(cleanUrl, result)) {
                console.log(`[instagramdl] ${src.name} ditolak (banner/bukan media asli):`,
                    [...(result.videos || []), ...(result.images || [])])
                throw new Error('hasil banner/bukan media asli')
            }
            console.log(`[instagramdl] sukses via ${src.name}`)
            return { source: src.name, ...result }
        } catch (err) {
            errors[src.name] = err
            console.error(`[instagramdl] ${src.name} gagal:`, err.message)
        }
    }

    const isRateLimit = Object.values(errors).some(e =>
        e?.isRateLimit ||
        /making requests too fast/i.test(e?.message || '') ||
        /429/.test(e?.message || '')
    )

    const combinedErr = new Error(
        'Semua sumber gagal.\n' +
        Object.entries(errors).map(([k, e]) => `• ${k}: ${e?.message}`).join('\n')
    )
    combinedErr.isRateLimit = isRateLimit
    throw combinedErr
}

async function handler(m, { sock }) {
    const url = m.text?.trim()

    if (!url) {
        return m.reply(
            `📸 *ɪɴsᴛᴀɢʀᴀᴍ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ*\n\n` +
            `> \`${m.prefix}igdl <url>\`\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> \`${m.prefix}igdl https://www.instagram.com/reel/xxx\`\n` +
            `> \`${m.prefix}igdl https://www.instagram.com/p/xxx\``
        )
    }

    if (!IG_REGEX.test(url)) {
        return m.reply(`❌ *Ehh~* URL tidak valid. Gunakan link Instagram (reel/post/story)~ 🥺`)
    }

    await m.react('🕕')

    try {
        const result = await fetchMedia(url)

        if (result.type === 'unknown' || (!result.videos.length && !result.images.length)) {
            await m.react('❌')
            return m.reply(`❌ *Gomen ne~* Gagal mengambil media. Coba link lain~ 🥺`)
        }

        const ctxInfo = {
            forwardingScore: 99,
            isForwarded: true
        }

        if (result.type === 'video') {
            await sendMediaGroup(sock, m.chat, m, result.videos, 'video', ctxInfo)
        } else if (result.type === 'photo') {
            await sendMediaGroup(sock, m.chat, m, result.images, 'image', ctxInfo)
        } else {
            if (result.videos.length) {
                await sendMediaGroup(sock, m.chat, m, result.videos, 'video', ctxInfo)
            }
            if (result.images.length) {
                await sendMediaGroup(sock, m.chat, m, result.images, 'image', ctxInfo)
            }
        }

        await m.react('✅')
    } catch (err) {
        await m.react('❌')

        if (err.isRateLimit || /making requests too fast/i.test(err.message || '') || /429/.test(err.message || '')) {
            return m.reply(
                `❌ *sᴇʀᴠᴇʀ sᴇᴅᴀɴɢ sɪʙᴜᴋ*\n\n` +
                `Terlalu banyak request ke server downloader. Coba lagi dalam ~15-20 detik.`
            )
        }

        return m.reply(`❌ *ɢᴀɢᴀʟ ᴍᴇɴɢᴜɴᴅᴜʜ*\n\n> ${err.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}