const axios = require('axios')
const playdl = require('play-dl')
const { createDecipheriv } = require('crypto')
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const pluginConfig = {
    name: 'ytmp4',
    alias: ['youtubemp4', 'ytvideo'],
    category: 'download',
    description: 'Download video/audio YouTube',
    usage: '.ytmp4 <url>',
    example: '.ytmp4 https://youtube.com/watch?v=xxx',
    cooldown: 20,
    energi: 2,
    isEnabled: true
}

const YOUTUBE_ID_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|shorts\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/

function extractVideoId(url) {
    return String(url || '').match(YOUTUBE_ID_REGEX)?.[1] || null
}

function formatDuration(seconds) {
    if (!seconds) return 'Unknown'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
}

// ── Validasi buffer video sebelum diproses ─────────────────────────────────
function isValidVideoBuffer(buffer) {
    if (!buffer || buffer.length < 50 * 1024) return false
    const head = buffer.subarray(0, 32).toString('hex')
    const isMp4 = buffer.subarray(4, 8).toString('ascii') === 'ftyp'
    const isWebm = head.startsWith('1a45dfa3')
    return isMp4 || isWebm
}

// ── Remux paksa ke H.264/AAC + faststart ────────────────────────────────────
// Ini fix utama: file dari savetube/play-dl/ytdl kadang codec-nya (VP9/AV1) atau
// struktur moov-nya nggak didukung WA meski container-nya valid mp4 — makanya lolos
// isValidVideoBuffer tapi tetap "ada masalah dengan file video" saat dibuka.
async function remuxVideoBuffer(buffer) {
    const tmpDir = os.tmpdir()
    const tag = `${Date.now()}_${Math.random().toString(36).slice(2)}`
    const inPath = path.join(tmpDir, `ytmp4_in_${tag}.tmp`)
    const outPath = path.join(tmpDir, `ytmp4_out_${tag}.mp4`)

    await fs.promises.writeFile(inPath, buffer)

    try {
        await new Promise((resolve, reject) => {
            const ff = spawn('ffmpeg', [
                '-y',
                '-i', inPath,
                '-c:v', 'libx264',
                '-preset', 'veryfast',
                '-crf', '23',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-movflags', '+faststart',
                outPath
            ])
            let stderr = ''
            ff.stderr.on('data', (d) => { stderr += d.toString() })
            ff.on('error', (err) => reject(new Error(`ffmpeg tidak bisa dijalankan (mungkin belum terinstall): ${err.message}`)))
            ff.on('close', (code) => {
                if (code !== 0) return reject(new Error(`ffmpeg exit code ${code}: ${stderr.slice(-500)}`))
                resolve()
            })
        })

        const out = await fs.promises.readFile(outPath)
        if (out.length < 10 * 1024) throw new Error('Hasil remux terlalu kecil, kemungkinan gagal')
        return out
    } finally {
        fs.promises.unlink(inPath).catch(() => {})
        fs.promises.unlink(outPath).catch(() => {})
    }
}

// ── Retry helper ─────────────────────────────────────────────────────────
async function withRetry(fn, { retries = 3, delayMs = 2000, label = '' } = {}) {
    let lastError
    for (let i = 1; i <= retries; i++) {
        try {
            return await fn()
        } catch (e) {
            lastError = e
            console.log(`[YTMP4] ${label} gagal (percobaan ${i}/${retries}):`, e.message)
            if (i < retries) await new Promise(r => setTimeout(r, delayMs * i))
        }
    }
    throw lastError
}

// ── SAVETUBE.ME: metode utama, extract + decrypt AES-128-CBC ──────────────
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

async function fetchSavetubeBuffer(dl) {
    const res = await axios.get(dl, {
        responseType: 'arraybuffer',
        timeout: 300000,
        maxRedirects: 10,
        maxContentLength: 200 * 1024 * 1024,
        headers: {
            'User-Agent': 'Mozilla/5.0',
            Referer: 'https://yt.savetube.me/',
            Origin: 'https://yt.savetube.me'
        }
    })
    const buffer = Buffer.from(res.data)
    if (!isValidVideoBuffer(buffer)) {
        throw new Error('File dari savetube tidak valid/korup')
    }
    return buffer
}

async function downloadViaSavetube(url, type = 'video') {
    const videoId = extractVideoId(url)
    if (!videoId) throw new Error('Bukan link YouTube yang valid.')

    const cdn = await getSavetubeCDN()
    const meta = await getSavetubeMeta(videoId, cdn)

    if (type === 'audio') {
        const dlUrl = await savetubeRequestDownload(cdn, videoId, meta, 'audio', '128kbps')
        if (!dlUrl) throw new Error('Audio gagal diambil dari savetube')
        return { title: meta.title, thumb: meta.thumbnail, dl: dlUrl }
    }

    const qualities = ['720p', '480p', '360p', '240p']
    for (const q of qualities) {
        try {
            const dlUrl = await savetubeRequestDownload(cdn, videoId, meta, 'video', q)
            if (dlUrl) return { title: meta.title, thumb: meta.thumbnail, dl: dlUrl, quality: q }
        } catch {}
    }
    throw new Error('Semua kualitas video gagal diambil dari savetube')
}

// ── PLAY-DL: fallback kedua, extract langsung dari YouTube ────────────────
async function downloadViaPlayDl(url) {
    const videoId = extractVideoId(url)
    if (!videoId) throw new Error('Bukan link YouTube yang valid.')
    const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`

    const info = await playdl.video_info(cleanUrl)
    const title = info?.video_details?.title || 'YouTube Video'

    const streamData = await playdl.stream_from_info(info, { discordPlayerCompatibility: false })

    const chunks = []
    await new Promise((resolve, reject) => {
        streamData.stream.on('data', (chunk) => chunks.push(chunk))
        streamData.stream.on('end', resolve)
        streamData.stream.on('error', reject)
    })

    const buffer = Buffer.concat(chunks)
    if (!buffer || buffer.length === 0) throw new Error('play-dl mengembalikan buffer kosong')
    if (!isValidVideoBuffer(buffer)) throw new Error('play-dl mengembalikan buffer tidak valid/korup')

    return { title, buffer }
}

// ── ytdl via ymcdn.org (fallback ketiga) ────────────────────────────────────
async function ytdl(url, format = 'mp4') {
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

    return { title, dl: convert.downloadURL }
}

// ── HAMM (ymcdn.org via a.ymcdn.org): fallback paling akhir ────────────────
// Endpoint scraper terpisah dari `ytdl` di atas (subdomain a.ymcdn.org, bukan
// d.ymcdn.org) plus dukungan redirect di step convert — jadi tetap berguna
// sebagai jalur cadangan sendiri kalau ketiga metode lain kompak gagal.
const HAMM_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    Origin: 'https://id.ytmp3.mobi',
    Referer: 'https://id.ytmp3.mobi/',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site'
}

async function downloadViaHamm(url, format = 'mp4') {
    const videoId = extractVideoId(url)
    if (!videoId) throw new Error('Bukan link YouTube yang valid.')

    const lowerFormat = format.toLowerCase()
    if (lowerFormat !== 'mp3' && lowerFormat !== 'mp4') throw new Error('Format harus mp3 atau mp4.')

    // 1) Init session
    const { data: initJson } = await axios.get('https://a.ymcdn.org/api/v1/init', {
        params: { p: 'y', 23: '1llum1n471', _: Math.random() },
        headers: HAMM_HEADERS,
        timeout: 30000
    })
    if (initJson?.error > 0) throw new Error(`Init API (hamm) mengembalikan error: ${initJson.error}`)
    if (!initJson?.convertURL) throw new Error('Init API (hamm) tidak mengembalikan convertURL.')

    // 2) Request konversi, ikuti redirect kalau ada
    let convertRequestUrl = `${initJson.convertURL}&v=${videoId}&f=${lowerFormat}&_=${Math.random()}`
    let convertJson
    let redirects = 0
    while (redirects < 5) {
        const { data } = await axios.get(convertRequestUrl, { headers: HAMM_HEADERS, timeout: 30000 })
        convertJson = data
        if (convertJson?.error > 0) throw new Error(`Convert API (hamm) mengembalikan error: ${convertJson.error}`)
        if (convertJson?.redirect > 0 && convertJson?.redirectURL) {
            convertRequestUrl = `${convertJson.redirectURL}&v=${videoId}&f=${lowerFormat}&_=${Math.random()}`
            redirects++
            continue
        }
        break
    }

    const progressURL = convertJson?.progressURL
    const downloadURL = convertJson?.downloadURL
    let title = convertJson?.title || 'YouTube'
    if (!progressURL) throw new Error('Response konversi (hamm) tidak ada progressURL.')
    if (!downloadURL) throw new Error('Response konversi (hamm) tidak ada downloadURL.')

    // 3) Poll progress sampai selesai (progress === 3)
    let progress = 0, pollCount = 0
    const maxPolls = 60
    while (progress < 3 && pollCount < maxPolls) {
        await new Promise(r => setTimeout(r, 1000))
        pollCount++
        const { data: progressJson } = await axios.get(progressURL, { headers: HAMM_HEADERS, timeout: 30000 })
        if (progressJson?.error > 0) throw new Error(`Progress API (hamm) mengembalikan error: ${progressJson.error}`)
        progress = Number(progressJson?.progress || 0)
        if (progressJson?.title) title = progressJson.title
    }
    if (progress < 3) throw new Error('Proses konversi (hamm) timeout (>60 detik).')

    return { title, dl: downloadURL }
}

// ── Ambil info video (thumbnail/title/durasi) untuk tampilan awal ─────────
async function getVideoInfo(url) {
    try {
        const res = await axios.get(
            `https://api.nexray.web.id/downloader/ytmp4?url=${encodeURIComponent(url)}&resolusi=360&_=${Date.now()}`,
            { timeout: 60000, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' } }
        )
        if (res.data?.result) return res.data.result
    } catch {}

    try {
        const videoId = extractVideoId(url)
        if (!videoId) return null
        const cdn = await getSavetubeCDN()
        const meta = await getSavetubeMeta(videoId, cdn)
        return { title: meta.title, thumbnail: meta.thumbnail, duration: meta.duration }
    } catch {}

    return null
}

// ── HANDLER ────────────────────────────────────────────────────────────────
async function handler(m, { sock }) {
    const url = m.text?.trim()
    if (!url) return m.reply(`Contoh: ${m.prefix}ytmp4 https://youtube.com/watch?v=xxx`)
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) return m.reply('❌ *Ehh~* URL harus YouTube~ 🥺')

    const args = m.args || []
    const action = args[0]
    const targetUrl = args.slice(1).join(' ')

    if (action === 'thumbnail' && targetUrl) {
        m.react('🕕')
        try {
            const info = await getVideoInfo(targetUrl)
            const title = info?.title || 'YouTube Video'
            const duration = formatDuration(info?.duration)
            const videoId = extractVideoId(targetUrl)
            const thumb = info?.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '')

            const caption =
                `🎬 *${title}*\n\n` +
                `⏱️ *Durasi:* ${duration}\n` +
                `🔗 *URL:* ${targetUrl}\n` +
                (info?.resolusi ? `📺 *Resolusi:* ${info.resolusi}p\n` : '') +
                `\n_via Hoshino Ai Bot_`

            await sock.sendMessage(m.chat, {
                image: { url: thumb },
                caption
            }, { quoted: m })
            m.react('✅')
        } catch (err) {
            m.react('❌')
            m.reply(`❌ Gagal ambil thumbnail.\n\n_${err.message}_`)
        }
        return
    }

    if (action === 'video' && targetUrl) {
        m.react('🕕')

        // 1) Savetube.me — metode utama, paling stabil
        try {
            const { title, dl } = await withRetry(
                () => downloadViaSavetube(targetUrl, 'video'),
                { retries: 2, delayMs: 2000, label: 'savetube video' }
            )
            const rawBuffer = await withRetry(
                () => fetchSavetubeBuffer(dl),
                { retries: 2, delayMs: 2000, label: 'download savetube video buffer' }
            )
            const buffer = await remuxVideoBuffer(rawBuffer)
            await sock.sendMessage(m.chat, {
                video: buffer,
                caption: `🎬 *${title || 'YouTube Video'}*\n\n_via Hoshino Ai Bot_`,
                mimetype: 'video/mp4'
            }, { quoted: m })
            return m.react('✅')
        } catch (savetubeErr) {
            console.log('[YTMP4] savetube gagal, fallback ke play-dl:', savetubeErr.message)
        }

        // 2) play-dl — fallback kedua
        try {
            const { title, buffer: rawBuffer } = await withRetry(
                () => downloadViaPlayDl(targetUrl),
                { retries: 2, delayMs: 2000, label: 'play-dl video' }
            )
            const buffer = await remuxVideoBuffer(rawBuffer)
            await sock.sendMessage(m.chat, {
                video: buffer,
                caption: `🎬 *${title}*\n\n_via Hoshino Ai Bot_`,
                mimetype: 'video/mp4'
            }, { quoted: m })
            return m.react('✅')
        } catch (playDlErr) {
            console.log('[YTMP4] play-dl gagal, fallback ke ymcdn.org:', playDlErr.message)
        }

        // 3) ymcdn.org (d.ymcdn.org) — fallback ketiga
        try {
            const { title, dl } = await withRetry(
                () => ytdl(targetUrl, 'mp4'),
                { retries: 2, delayMs: 3000, label: 'ytdl mp4' }
            )
            const vidRes = await withRetry(
                () => axios.get(dl, {
                    responseType: 'arraybuffer',
                    timeout: 300000,
                    maxRedirects: 10,
                    maxContentLength: 200 * 1024 * 1024,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 16; NX729J) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7271.123 Mobile Safari/537.36' }
                }),
                { retries: 3, delayMs: 3000, label: 'download video buffer' }
            )
            const rawBuffer = Buffer.from(vidRes.data)
            if (!isValidVideoBuffer(rawBuffer)) throw new Error('File dari ymcdn.org tidak valid/korup')
            const buffer = await remuxVideoBuffer(rawBuffer)
            await sock.sendMessage(m.chat, {
                video: buffer,
                caption: `🎬 *${title || 'YouTube Video'}*\n\n_via Hoshino Ai Bot_`,
                mimetype: 'video/mp4'
            }, { quoted: m })
            return m.react('✅')
        } catch (ytdlErr) {
            console.log('[YTMP4] ymcdn.org gagal, fallback ke hamm:', ytdlErr.message)
        }

        // 4) Hamm (a.ymcdn.org) — fallback paling akhir
        try {
            const { title, dl } = await withRetry(
                () => downloadViaHamm(targetUrl, 'mp4'),
                { retries: 2, delayMs: 3000, label: 'hamm ytmp4' }
            )
            const vidRes = await withRetry(
                () => axios.get(dl, {
                    responseType: 'arraybuffer',
                    timeout: 300000,
                    maxRedirects: 10,
                    maxContentLength: 200 * 1024 * 1024,
                    headers: HAMM_HEADERS
                }),
                { retries: 3, delayMs: 3000, label: 'download video buffer (hamm)' }
            )
            const rawBuffer = Buffer.from(vidRes.data)
            if (!isValidVideoBuffer(rawBuffer)) throw new Error('File dari hamm tidak valid/korup')
            const buffer = await remuxVideoBuffer(rawBuffer)
            await sock.sendMessage(m.chat, {
                video: buffer,
                caption: `🎬 *${title || 'YouTube Video'}*\n\n_via Hoshino Ai Bot_`,
                mimetype: 'video/mp4'
            }, { quoted: m })
            m.react('✅')
        } catch (err) {
            m.react('❌')
            m.reply(`❌ Gagal download video.\n\n_${err.message}_\n\n_Keempat metode (savetube, play-dl, ymcdn.org & hamm) gagal, coba lagi beberapa saat ya~_`)
        }
        return
    }

    if (action === 'audio' && targetUrl) {
        m.react('🕕')

        // 1) Savetube.me — metode utama
        try {
            const { title, dl } = await withRetry(
                () => downloadViaSavetube(targetUrl, 'audio'),
                { retries: 2, delayMs: 2000, label: 'savetube audio' }
            )
            await sock.sendMessage(m.chat, {
                audio: { url: dl },
                mimetype: 'audio/mpeg',
                ptt: false,
                fileName: `${title || 'audio'}.mp3`
            }, { quoted: m })
            return m.react('✅')
        } catch (savetubeErr) {
            console.log('[YTMP4] savetube audio gagal, fallback ke nexray/ytdl:', savetubeErr.message)
        }

        // 2) nexray, lalu ytdl mp3 — fallback kedua
        try {
            let dlUrl = null, title = ''
            try {
                const res = await withRetry(
                    () => axios.get(
                        `https://api.nexray.eu.cc/downloader/v1/ytmp3?url=${encodeURIComponent(targetUrl)}`,
                        { timeout: 60000, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' } }
                    ),
                    { retries: 2, delayMs: 2000, label: 'nexray audio' }
                )
                dlUrl = res.data?.result?.url
                title = res.data?.result?.title || ''
            } catch {}

            if (!dlUrl) {
                const fb = await withRetry(
                    () => ytdl(targetUrl, 'mp3'),
                    { retries: 2, delayMs: 3000, label: 'ytdl mp3 fallback' }
                )
                dlUrl = fb.dl
                title = fb.title || ''
            }

            if (!dlUrl) throw new Error('nexray & ymcdn.org sama-sama tidak mengembalikan URL audio')

            await sock.sendMessage(m.chat, {
                audio: { url: dlUrl },
                mimetype: 'audio/mpeg',
                ptt: false,
                fileName: `${title || 'audio'}.mp3`
            }, { quoted: m })
            return m.react('✅')
        } catch (nexrayErr) {
            console.log('[YTMP4] nexray/ymcdn.org audio gagal, fallback ke hamm:', nexrayErr.message)
        }

        // 3) Hamm (a.ymcdn.org) — fallback paling akhir
        try {
            const { title, dl } = await withRetry(
                () => downloadViaHamm(targetUrl, 'mp3'),
                { retries: 2, delayMs: 3000, label: 'hamm ytmp3' }
            )
            await sock.sendMessage(m.chat, {
                audio: { url: dl },
                mimetype: 'audio/mpeg',
                ptt: false,
                fileName: `${title || 'audio'}.mp3`
            }, { quoted: m })
            m.react('✅')
        } catch (err) {
            m.react('❌')
            m.reply(`❌ Gagal download audio.\n\n_${err.message}_\n\n_Ketiga metode (savetube, nexray/ymcdn.org & hamm) gagal, coba lagi beberapa saat ya~_`)
        }
        return
    }

    // ── Main: tampil button ────────────────────────────────────────────────
    m.react('🕕')
    try {
        const info = await getVideoInfo(url)
        const title = info?.title || 'YouTube Video'
        const duration = formatDuration(info?.duration)
        const videoId = extractVideoId(url)
        const thumb = info?.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '')

        await sock.sendMessage(m.chat, {
            text: `🎬 *${title}*\n\n⏱️ *Durasi:* ${duration}\n\n_Pilih opsi di bawah:_`,
            interactiveButtons: [
                {
                    name: 'single_select',
                    buttonParamsJson: JSON.stringify({
                        title: '📥 Pilih Opsi',
                        sections: [
                            {
                                title: 'Apa yang kamu mau?',
                                rows: [
                                    {
                                        title: '🖼️ Thumbnail + Info Lengkap',
                                        description: 'Kirim thumbnail dengan caption detail',
                                        id: `${m.prefix}ytmp4 thumbnail ${url}`
                                    },
                                    {
                                        title: '🎬 Download Video',
                                        description: 'Kirim file video MP4',
                                        id: `${m.prefix}ytmp4 video ${url}`
                                    },
                                    {
                                        title: '🎵 Download Audio',
                                        description: 'Kirim file audio MP3',
                                        id: `${m.prefix}ytmp4 audio ${url}`
                                    }
                                ]
                            }
                        ]
                    })
                }
            ]
        }, { quoted: m })

        m.react('✅')
    } catch (err) {
        console.error('[YTMP4]', err?.message || err)
        m.react('❌')
        m.reply(`❌ Gagal mengambil info video.\n\n_${err.message || 'Terjadi kesalahan tidak diketahui'}_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}