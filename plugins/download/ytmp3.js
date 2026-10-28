// gak bisa di gabungin ama fake location + dokumen cik (yang ilang fake location nya)
const axios = require('axios')
const { createDecipheriv } = require('crypto')
const config = require('../../config')
const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: 'ytmp3',
    alias: ['youtubemp3', 'ytaudio'],
    category: 'download',
    description: 'Download audio YouTube',
    usage: '.ytmp3 <url>',
    example: '.ytmp3 https://youtube.com/watch?v=xxx',
    cooldown: 20,
    energi: 2,
    isEnabled: true
}

const YOUTUBE_ID_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|shorts\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/

function extractVideoId(url) {
    return String(url || '').match(YOUTUBE_ID_REGEX)?.[1] || null
}

function formatDuration(seconds) {
    if (!seconds || typeof seconds !== 'number') return null
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
}

// ── Retry helper ─────────────────────────────────────────────────────────
async function withRetry(fn, { retries = 3, delayMs = 2000, label = '' } = {}) {
    let lastError
    for (let i = 1; i <= retries; i++) {
        try {
            return await fn()
        } catch (e) {
            lastError = e
            console.log(`[YTMP3] ${label} gagal (percobaan ${i}/${retries}):`, e.message)
            if (i < retries) await new Promise(r => setTimeout(r, delayMs * i))
        }
    }
    throw lastError
}

// ── SAVETUBE.ME: metode utama (sama seperti di ytmp4.js) ──────────────────
const SAVETUBE_KEY = Buffer.from('C5D58EF67A7584E4A29F6C35BBC4EB12', 'hex')
const SAVETUBE_HEADERS = {
    'Content-Type': 'application/json',
    Origin: 'https://yt.savetube.me',
    Referer: 'https://yt.savetube.me/',
    'User-Agent': 'Mozilla/5.0'
}

function decryptSavetube(data) {
    const encrypted = Buffer.from(data, 'base64')
    const decipher = createDecipheriv('aes-128-cbc', SAVETUBE_KEY, encrypted.subarray(0, 16))
    return JSON.parse(Buffer.concat([
        decipher.update(encrypted.subarray(16)),
        decipher.final()
    ]).toString())
}

async function getSavetubeCDN() {
    const { data } = await axios.get('https://media.savetube.vip/api/random-cdn', {
        headers: SAVETUBE_HEADERS,
        timeout: 15000
    })
    if (!data?.cdn) throw new Error('CDN savetube tidak tersedia')
    return data.cdn
}

async function getSavetubeMeta(videoId, cdn) {
    const { data: info } = await axios.post(`https://${cdn}/v2/info`,
        { url: `https://youtube.com/watch?v=${videoId}` },
        { headers: SAVETUBE_HEADERS, timeout: 20000 }
    )
    if (!info?.data) throw new Error('Gagal ambil metadata savetube')
    return decryptSavetube(info.data)
}

async function savetubeRequestDownload(cdn, videoId, meta, downloadType, quality) {
    const { data: dl } = await axios.post(`https://${cdn}/download`, {
        id: videoId,
        downloadType,
        quality,
        key: meta.key
    }, { headers: SAVETUBE_HEADERS, timeout: 30000 })
    return dl?.data?.downloadUrl || null
}

async function downloadAudioViaSavetube(url) {
    const videoId = extractVideoId(url)
    if (!videoId) throw new Error('Bukan link YouTube yang valid.')

    const cdn = await getSavetubeCDN()
    const meta = await getSavetubeMeta(videoId, cdn)
    const dlUrl = await savetubeRequestDownload(cdn, videoId, meta, 'audio', '128kbps')
    if (!dlUrl) throw new Error('Audio gagal diambil dari savetube')

    return {
        title: meta.title,
        thumbnail: meta.thumbnail,
        duration: formatDuration(meta.duration),
        url: dlUrl
    }
}

// ── ytdl via ymcdn.org: fallback terakhir (sama seperti di ytmp4.js) ──────
async function ytdlYmcdn(url, format = 'mp3') {
    const videoId = extractVideoId(url)
    if (!videoId) throw new Error('Bukan link YouTube yang valid.')

    const client = axios.create({
        timeout: 60000,
        maxRedirects: 10,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 16; NX729J) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7271.123 Mobile Safari/537.36',
            'Referer': 'https://id.ytmp3.mobi/'
        }
    })

    const { data: init } = await withRetry(
        () => client.get('https://d.ymcdn.org/api/v1/init', {
            params: { p: 'y', 23: '1llum1n471', _: Math.random() }
        }),
        { label: 'init server' }
    )
    if (!init?.convertURL) throw new Error('Gagal menginisialisasi server.')

    const { data: convert } = await withRetry(
        () => client.get(init.convertURL, {
            params: { v: videoId, f: format, _: Math.random() }
        }),
        { label: 'convert request' }
    )
    if (!convert?.progressURL || !convert?.downloadURL) throw new Error('Gagal mendapatkan data konversi.')

    let progress = 0, title = convert.title || '', attempts = 0
    while (progress < 3 && attempts < 20) {
        const { data } = await withRetry(
            () => client.get(convert.progressURL),
            { retries: 2, delayMs: 1000, label: 'progress poll' }
        )
        if ((data?.error || 0) > 0) throw new Error(`Error dari server: ${data.error}`)
        progress = Number(data?.progress || 0)
        title = data?.title || title
        if (progress < 3) { attempts++; await new Promise(r => setTimeout(r, 250)) }
    }
    if (attempts >= 20 && progress < 3) throw new Error('Timeout proses konversi.')

    return { title, url: convert.downloadURL }
}

async function handler(m, { sock }) {
    const url = m.text?.trim()
    if (!url) return m.reply(`Contoh: ${m.prefix}ytmp3 https://youtube.com/watch?v=xxx`)
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) return m.reply('❌ *Ehh~* URL harus YouTube~ 🥺')

    m.react('🕕')

    let audioUrl, title, thumbnail, duration

    // 1) Savetube.me — metode utama, paling stabil (sama seperti ytmp4)
    try {
        const r = await withRetry(
            () => downloadAudioViaSavetube(url),
            { retries: 2, delayMs: 2000, label: 'savetube audio' }
        )
        audioUrl = r.url
        title = r.title || 'audio.mp3'
        thumbnail = r.thumbnail || null
        duration = r.duration || null
    } catch (savetubeErr) {
        console.warn('[YTMP3] savetube gagal, fallback ke nexray...', savetubeErr.message)

        // 2) nexray — fallback kedua
        try {
            const { result } = await f(`https://api.nexray.web.id/downloader/ytmp3?url=${encodeURIComponent(url)}`)
            if (!result?.url) throw new Error('No URL from primary API')
            audioUrl = result.url
            title = result?.title || 'audio.mp3'
            thumbnail = result?.thumbnail || null
            duration = result?.duration || null
        } catch (nexrayErr) {
            console.warn('[YTMP3] nexray gagal, fallback ke api-faa...', nexrayErr.message)

            // 3) api-faa — fallback ketiga
            try {
                const { result } = await f(`https://api-faa.my.id/faa/ytmp3?url=${encodeURIComponent(url)}`)
                if (!result?.mp3) throw new Error('No URL from fallback API')
                audioUrl = result.mp3
                title = result?.title || 'audio.mp3'
                thumbnail = result?.thumbnail || null
                duration = result?.duration || null
            } catch (faaErr) {
                console.warn('[YTMP3] api-faa gagal, fallback ke ymcdn.org...', faaErr.message)

                // 4) ymcdn.org — fallback terakhir
                try {
                    const r = await withRetry(
                        () => ytdlYmcdn(url, 'mp3'),
                        { retries: 2, delayMs: 3000, label: 'ytdl mp3' }
                    )
                    audioUrl = r.url
                    title = r.title || 'audio.mp3'
                    thumbnail = null
                    duration = null
                } catch (ymcdnErr) {
                    console.error('[YTMP3] Semua metode gagal', ymcdnErr.message)
                    m.react('❌')
                    return m.reply('❌ *Gomen ne~* Semua API gagal (savetube, nexray, api-faa & ymcdn.org), coba lagi nanti~ 🥺')
                }
            }
        }
    }

    try {
        const caption = [
            `🎵 *${title}*`,
            duration ? `⏱️ Durasi: ${duration}` : '',
            `\n> Pilih format download di bawah ya~`
        ].filter(Boolean).join('\n')

        await sock.sendMessage(
            m.chat,
            {
                interactiveMessage: {
                    title: caption,
                    footer: config.bot?.name || 'Bot',
                    document: Buffer.alloc(0),
                    mimetype: 'application/pdf',
                    fileName: title,
                    fileLength: 0,
                    contextInfo: {
                        isForwarded: true,
                        forwardingScore: 7,
                        ...(config.saluran?.id && {
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: config.saluran.id,
                                newsletterName: config.saluran.name || config.bot?.name,
                            }
                        })
                    },
                    ...(thumbnail && {
                        header: {
                            hasMediaAttachment: true,
                            locationMessage: {
                                degreesLatitude: 0,
                                degreesLongitude: 0,
                                name: title,
                                address: duration || 'YouTube Audio',
                                jpegThumbnail: await (async () => {
                                    try {
                                        const res = await axios.get(thumbnail, { responseType: 'arraybuffer', timeout: 15000 })
                                        return Buffer.from(res.data)
                                    } catch { return undefined }
                                })()
                            }
                        }
                    }),
                    buttons: [
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: '🎵 Audio MP3',
                                id: `__audio__${audioUrl}__${title}`
                            })
                        },
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: '📄 File Dokumen',
                                id: `__doc__${audioUrl}__${title}`
                            })
                        }
                    ]
                }
            },
            { quoted: m }
        )

        // Simpan session untuk handle reply button
        if (!global.ytmp3Sessions) global.ytmp3Sessions = new Map()
        global.ytmp3Sessions.set(m.id, { audioUrl, title })

        m.react('✅')

    } catch (error) {
        console.error('[YTMP3]', error)
        m.react('❌')
        m.reply('❌ *Gomen ne~* Gagal mengirim pilihan download~ 🥺')
    }
}

async function handleReply(m, { sock }) {
    const body = m.body || ''

    if (body.startsWith('__audio__') || body.startsWith('__doc__')) {
        const isDoc = body.startsWith('__doc__')
        const parts = body.replace(/^__(audio|doc)__/, '').split('__')
        const audioUrl = parts[0]
        const title = parts.slice(1).join('__') || 'audio.mp3'

        if (!audioUrl?.startsWith('http')) return false

        m.react('🕕')
        try {
            if (isDoc) {
                // Kirim sebagai dokumen/file
                await sock.sendMessage(
                    m.chat,
                    {
                        document: { url: audioUrl },
                        mimetype: 'audio/mpeg',
                        fileName: title.endsWith('.mp3') ? title : `${title}.mp3`,
                    },
                    { quoted: m }
                )
            } else {
                // Kirim sebagai audio biasa
                await sock.sendMedia(m.chat, audioUrl, null, m, {
                    type: 'audio',
                    mimetype: 'audio/mpeg',
                    ptt: false,
                    fileName: title,
                })
            }
            m.react('✅')
        } catch (err) {
            console.error('[YTMP3 Reply]', err)
            m.react('❌')
            m.reply('❌ *Gomen ne~* Gagal mengirim file~ 🥺')
        }
        return true
    }

    return false
}

module.exports = {
    config: pluginConfig,
    handler,
    handleReply
}