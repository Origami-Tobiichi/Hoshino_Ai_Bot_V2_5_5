const axios = require('axios')
const FormData = require('form-data')
const fetch = require('node-fetch')
const { queueFFmpeg } = require('../../src/lib/ffmpegQueue')
const { extractTikTokUrl, resolveTikTokUrl, isCanonicalTikTokUrl } = require('../../src/scraper/tiktok')
const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: 'tiktokdl',
    alias: ['ttdown', 'tiktok', 'tt', 'ttmp4'],
    category: 'download',
    description: 'Download video TikTok tanpa watermark',
    usage: '.tiktok <url>',
    example: '.tiktok https://vt.tiktok.com/xxx',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const MAX_RETRY = 10
const RETRY_DELAY_MS = 1500

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms))
}

async function downloadBuffer(url) {
    const resp = await axios.get(url, {
        timeout: 30000,
        responseType: 'arraybuffer',
        maxRedirects: 5,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
            Referer: 'https://www.tiktok.com/'
        }
    })
    return Buffer.from(resp.data)
}

function isValidMp4Buffer(buf) {
    if (!buf || buf.length < 10000) return false
    return buf.slice(4, 8).toString('ascii') === 'ftyp'
}

// ─── Transcode paksa ke H.264 (jaga-jaga sumbernya HEVC, gak playable di banyak WA client) ─
async function ensureH264(videoBuffer) {
    const tempDir = path.join(process.cwd(), 'temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

    const inputPath = path.join(tempDir, `tt_raw_${Date.now()}.mp4`)
    const outputPath = path.join(tempDir, `tt_h264_${Date.now()}.mp4`)

    try {
        fs.writeFileSync(inputPath, videoBuffer)

        await queueFFmpeg(
            `ffmpeg -y -i "${inputPath}" -c:v libx264 -profile:v baseline -pix_fmt yuv420p -c:a aac -movflags +faststart "${outputPath}"`
        )

        if (!fs.existsSync(outputPath)) {
            throw new Error('Gagal transcode video ke H.264')
        }

        return fs.readFileSync(outputPath)
    } finally {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
    }
}

// ─── Upload ulang ke host bersih (biar WA fetch dari sini, bukan CDN asli) ─
async function uploadToCatbox(buffer) {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('fileToUpload', buffer, { filename: 'tiktok.mp4', contentType: 'video/mp4' })
    const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form, headers: form.getHeaders() })
    if (!res.ok) throw new Error('Catbox gagal')
    const url = await res.text()
    if (!url.startsWith('http')) throw new Error('Invalid response')
    return url
}

async function uploadToLitterbox(buffer) {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('time', '72h')
    form.append('fileToUpload', buffer, { filename: 'tiktok.mp4', contentType: 'video/mp4' })
    const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', { method: 'POST', body: form, headers: form.getHeaders() })
    if (!res.ok) throw new Error('Litterbox gagal')
    const url = await res.text()
    if (!url.startsWith('http')) throw new Error('Invalid response')
    return url
}

async function uploadToKappa(buffer) {
    const form = new FormData()
    form.append('file', buffer, { filename: 'tiktok.mp4', contentType: 'video/mp4' })
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

async function rehostVideo(buffer) {
    const uploaders = [uploadToCatbox, uploadToLitterbox, uploadToKappa]
    let lastErr = null
    for (const fn of uploaders) {
        try {
            return await fn(buffer)
        } catch (e) {
            lastErr = e
            console.log(`[TikTokDL] Rehost gagal: ${e.message}`)
        }
    }
    throw lastErr || new Error('Semua host rehost gagal')
}

// ─── VALIDASI: download buffer, cek ftyp, kalau valid langsung return buffer ──
async function isValidMp4(url) {
    try {
        const buf = await downloadBuffer(url)
        return isValidMp4Buffer(buf) ? buf : false
    } catch {
        return false
    }
}

// ─── API 1: api-faa.my.id (primary, retry 10x) ────────────────────────────
async function tryFaaApi(url) {
    let lastErr = null
    for (let i = 1; i <= MAX_RETRY; i++) {
        try {
            const { data: res } = await axios.get(
                `https://api-faa.my.id/faa/tiktok?url=${encodeURIComponent(url)}`,
                { timeout: 20000 }
            )
            if (!res?.status) throw new Error('API faa: status false')
            const result = res.result
            if (result.type === 'image' || result.duration === '0 seconds') {
                return { isImage: true }
            }

            const candidates = [
                result?.alternatives?.hd,
                result?.alternatives?.selected,
                result?.data
            ].filter(Boolean)

            let videoBuffer = null
            for (const c of candidates) {
                const buf = await isValidMp4(c)
                if (buf) {
                    videoBuffer = buf
                    break
                }
                console.warn(`[TikTokDL] faa kandidat korup, coba berikutnya...`)
            }

            if (!videoBuffer) throw new Error('API faa: semua kandidat nowm korup')

            // Transcode paksa ke H.264 -> jaga-jaga sumbernya HEVC (valid tapi gak playable
            // di banyak WA client walau lolos validasi ftyp)
            const h264Buffer = await ensureH264(videoBuffer)

            const hostedUrl = await rehostVideo(h264Buffer)
            console.log(`[TikTokDL] Rehosted ke: ${hostedUrl}`)

            return {
                videoUrl: hostedUrl,
                title: result.title || 'TikTok Video',
                duration: result.duration || '-',
                author: result.author?.nickname || '-'
            }
        } catch (e) {
            lastErr = e
            console.warn(`[TikTokDL] faa attempt ${i}/${MAX_RETRY}: ${e.message}`)
            if (i < MAX_RETRY) await sleep(RETRY_DELAY_MS)
        }
    }
    throw lastErr
}

// ─── FALLBACK #1: scrape langsung dari halaman TikTok (gak gantung API luar) ─
function extractItemStruct(html) {
    // api-data
    const apiMatch = html.match(/<script id="api-data"[^>]*>([\s\S]*?)<\/script>/)
    if (apiMatch) {
        try {
            const j = JSON.parse(apiMatch[1])
            const s = j?.videoDetail?.itemInfo?.itemStruct || j?.itemInfo?.itemStruct

            if (s) return s

            if (j?.ItemModule) {
                const firstId = Object.keys(j.ItemModule)[0]
                if (firstId && j.ItemModule[firstId]) {
                    return j.ItemModule[firstId]
                }
            }
        } catch {}
    }

    // Universal Data
    const uniMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/)
    if (uniMatch) {
        try {
            const j = JSON.parse(uniMatch[1])
            const defaultScope = j?.__DEFAULT_SCOPE__ || {}

            for (const key of Object.keys(defaultScope)) {
                const s = defaultScope[key]?.itemInfo?.itemStruct
                if (s) return s
            }
        } catch {}
    }

    return null
}

async function tryScrapeTiktok(url) {
    const { data: html, status } = await axios.get(url, {
        timeout: 30000,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: {
            'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'accept-language': 'id-ID,id;q=0.9,en-AU;q=0.8,en;q=0.7,en-US;q=0.6',
            'upgrade-insecure-requests': '1'
        }
    })

    if (status >= 400) throw new Error(`Scrape TikTok: HTTP ${status}`)

    const detail = extractItemStruct(html)
    if (!detail) throw new Error('Scrape TikTok: itemStruct tidak ditemukan (link invalid / struktur berubah)')

    if (detail.imagePost) {
        return { isImage: true }
    }

    const candidates = [detail.video?.downloadAddr, detail.video?.playAddr].filter(Boolean)

    if (detail.id) {
        try {
            const { data: pJson } = await axios.get(
                `https://www.tiktok.com/player/api/v1/items?item_ids=${detail.id}`,
                { timeout: 15000 }
            )
            const directUrl = pJson?.items?.[0]?.video_info?.url_list?.[0]
            if (directUrl) candidates.unshift(directUrl)
        } catch {}
    }

    if (!candidates.length) throw new Error('Scrape TikTok: tidak ada kandidat video url')

    let videoBuffer = null
    for (const c of candidates) {
        const buf = await isValidMp4(c)
        if (buf) {
            videoBuffer = buf
            break
        }
        console.warn(`[TikTokDL] scrape kandidat korup, coba berikutnya...`)
    }

    if (!videoBuffer) throw new Error('Scrape TikTok: semua kandidat korup')

    const h264Buffer = await ensureH264(videoBuffer)
    const hostedUrl = await rehostVideo(h264Buffer)
    console.log(`[TikTokDL] Rehosted ke: ${hostedUrl}`)

    return {
        videoUrl: hostedUrl,
        title: detail.desc || detail.suggestedWords?.[0] || 'TikTok Video',
        duration: `${detail.video?.duration || detail.music?.duration || 0}s`,
        author: detail.author?.nickname || detail.author?.uniqueId || '-'
    }
}

// ─── API 2: api.azbry.com (fallback #2) ───────────────────────────────────
async function tryAzbryApi(url) {
    const { data: res } = await axios.get(
        `https://api.azbry.com/api/download/tiktok?url=${encodeURIComponent(url)}`,
        { timeout: 25000 }
    )
    if (!res?.status) throw new Error('API azbry: status false')
    const result = res.result
    const videoUrl = result?.links?.[0]
    if (!videoUrl) throw new Error('API azbry: links kosong')

    const buf = await isValidMp4(videoUrl)
    if (!buf) throw new Error('API azbry: video korup')

    const h264Buffer = await ensureH264(buf)
    const hostedUrl = await rehostVideo(h264Buffer)
    console.log(`[TikTokDL] Rehosted ke: ${hostedUrl}`)

    return {
        videoUrl: hostedUrl,
        title: result.title || 'TikTok Video',
        duration: result.duration ? `${result.duration}s` : '-',
        author: result.author || '-'
    }
}

// ─── API 3: ikdownloader.io (fallback #3, CJS native no cheerio) ──────────
async function tryIkdownloaderApi(url) {
    const BASE = 'https://ikdownloader.io'
    const { data: raw } = await axios.post(
        `${BASE}/api/ajaxSearch`,
        `q=${encodeURIComponent(url)}&lang=id`,
        {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': BASE,
                'Referer': `${BASE}/id`
            }
        }
    )
    if (raw?.status !== 'ok') throw new Error('ikdownloader: status bukan ok')
    const html = raw.data || ''

    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => {
        let u = m[1].replace(/&amp;/g, '&')
        try { u = decodeURIComponent(u) } catch {}
        return u
    }).filter(u => u.includes('.mp4') || u.includes('tikwm') || u.includes('tiktok'))

    if (!hrefs.length) throw new Error('ikdownloader: tidak ada link mp4')

    let videoBuffer = null
    for (const h of hrefs) {
        const buf = await isValidMp4(h)
        if (buf) {
            videoBuffer = buf
            break
        }
    }
    if (!videoBuffer) throw new Error('ikdownloader: semua kandidat korup')

    const h264Buffer = await ensureH264(videoBuffer)
    const hostedUrl = await rehostVideo(h264Buffer)
    console.log(`[TikTokDL] Rehosted ke: ${hostedUrl}`)

    const titleMatch = html.match(/<h3[^>]*>([^<]+)<\/h3>/)
    const title = titleMatch ? titleMatch[1].trim() : 'TikTok Video'

    return {
        videoUrl: hostedUrl,
        title,
        duration: '-',
        author: '-'
    }
}

// ─── HANDLER ──────────────────────────────────────────────────────────────
async function handler(m, { sock }) {
    const text = m.body?.trim()
    const prefix = m.prefix
    const command = 'tiktok'

    if (!text) {
        m.react('❌')
        return m.reply(`📌 Contoh: *${prefix + command} https://vt.tiktok.com/...*`)
    }

    // Terima semua bentuk link: tiktok.com (www/vm/vt/m), /t/xxx, dan tt.site/t/xxx
    const rawUrl = extractTikTokUrl(text)
    if (!rawUrl) {
        m.react('❌')
        return m.reply(`❌ URL TikTok tidak ditemukan.\n📌 Contoh: *${prefix + command} https://vt.tiktok.com/...*`)
    }

    m.react('🕕')

    // Resolve link pendek (tt.site, vt, vm, /t/xxx) ke link asli dulu, biar API/scrape di bawah
    // dapat URL yang pasti dikenali. Kalau gagal resolve, link asli tetap dicoba
    // (kecuali tt.site, karena API di bawah belum tentu paham domain itu).
    let tiktokUrl = rawUrl
    if (!isCanonicalTikTokUrl(rawUrl)) {
        const resolved = await resolveTikTokUrl(rawUrl)
        if (resolved) {
            tiktokUrl = resolved
        } else if (/tt\.site/i.test(rawUrl)) {
            m.react('❌')
            return m.reply(`❌ Link tt.site gagal diproses.\n\n> Coba kirim link aslinya (tiktok.com/@user/video/...) ya~ 🌸`)
        }
    }
    tiktokUrl = tiktokUrl.split('?')[0]

    let result = null

    // 1) API faa dulu, sampai retry 10x-nya benar-benar habis
    try {
        result = await tryFaaApi(tiktokUrl)
    } catch (e) {
        console.warn(`[TikTokDL] Primary API (faa) gagal semua (10x): ${e.message}`)
    }

    // 2) Baru fallback ke scrape langsung halaman TikTok
    if (!result) {
        try {
            result = await tryScrapeTiktok(tiktokUrl)
        } catch (e) {
            console.warn(`[TikTokDL] Fallback scrape TikTok gagal: ${e.message}`)
        }
    }

    if (result?.isImage) {
        m.react('❌')
        return m.reply(
            `❌ TikTok ini berupa slide gambar, tidak bisa didownload dengan perintah ini.\n\n` +
            `📌 Gunakan: *${prefix}tt2 ${tiktokUrl}*`
        )
    }

    // 3) Sisa fallback API pihak ketiga kalau scrape juga gagal
    if (!result) {
        try {
            result = await tryAzbryApi(tiktokUrl)
        } catch (e) {
            console.warn(`[TikTokDL] Fallback azbry gagal: ${e.message}`)
        }
    }

    if (!result) {
        try {
            result = await tryIkdownloaderApi(tiktokUrl)
        } catch (e) {
            console.warn(`[TikTokDL] Fallback ikdownloader gagal: ${e.message}`)
        }
    }

    if (!result) {
        m.react('❌')
        return m.reply(
            `💥 *Semua metode gagal*\n\n` +
            `> Sudah dicoba: primary faa 10x, scrape langsung, azbry, ikdownloader~\n` +
            `> Coba lagi nanti ya 🌸`
        )
    }

    try {
        const botName = global.botConfig?.bot?.name || 'Hoshino Ai'
        const caption =
            `🌸✨ *Hoshino Ai Downloader* ✨🌸\n\n` +
            `> 🎬 Judul: *${result.title}*\n` +
            `> ⏱ Durasi: ${result.duration}\n` +
            `> 👤 Author: ${result.author}\n\n` +
            `💖 Mau audio, jadi dokumen, atau ulang download? pilih yaa~`

        await sock.sendMessage(
            m.chat,
            {
                video: { url: result.videoUrl },
                caption,
                footer: botName,
                interactiveButtons: [
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: '🎵 Audio (MP3)',
                            id: `${prefix}ttmp3 ${tiktokUrl}`
                        })
                    },
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: '🎼 Music Doc',
                            id: `${prefix}ttdoc music ${tiktokUrl}`
                        })
                    },
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: '📄 Video Doc',
                            id: `${prefix}ttdoc ${tiktokUrl}`
                        })
                    },
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: '📥 Download Ulang',
                            id: `${prefix}tiktok ${tiktokUrl}`
                        })
                    }
                ]
            },
            { quoted: m }
        )

        m.react('✅')
    } catch (err) {
        console.error('[TikTokDL] Send error:', err)
        m.react('❌')
        m.reply(
            `💥 *Gagal kirim video*\n\n` +
            `> ${err?.message || 'Unknown error'}\n\n` +
            `Coba: *${prefix}tt2 ${text}*`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}