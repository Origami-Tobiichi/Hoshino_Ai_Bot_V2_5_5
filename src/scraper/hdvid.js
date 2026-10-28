const axios    = require('axios')
const FormData = require('form-data')
const fs       = require('fs')
const path     = require('path')
const crypto   = require('crypto')

const UA  = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
const API = 'https://api.unblurimage.ai/api/upscaler'

function productserial() {
    const raw = [UA, process.platform, process.arch, Date.now(), Math.random()].join('|')
    return crypto.createHash('md5').update(raw).digest('hex')
}

// ── Unblurimage upload ────────────────────────────────────────────────────────
async function uploadvid(filePath) {
    if (!fs.existsSync(filePath)) throw new Error('file not found')
    const form = new FormData()
    form.append('video_file_name', path.basename(filePath))
    const res = await axios.post(`${API}/v1/ai-video-enhancer/upload-video`, form, {
        headers: { ...form.getHeaders(), 'user-agent': UA, origin: 'https://unblurimage.ai', referer: 'https://unblurimage.ai/' }
    })
    return res.data.result
}

async function putOss(uploadUrl, filePath) {
    const stream = fs.createReadStream(filePath)
    await axios.put(uploadUrl, stream, {
        headers: { 'content-type': 'video/mp4' },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
    })
}

async function createJob(originalVideoUrl, resolution = '4k', product) {
    const form = new FormData()
    form.append('original_video_file', originalVideoUrl)
    form.append('resolution', resolution)
    form.append('is_preview', 'false')
    const res = await axios.post(`${API}/v2/ai-video-enhancer/create-job`, form, {
        headers: { ...form.getHeaders(), 'user-agent': UA, origin: 'https://unblurimage.ai', referer: 'https://unblurimage.ai/', 'product-serial': product }
    })
    if (res.data?.code !== 100000) throw new Error(JSON.stringify(res.data))
    return res.data.result.job_id
}

async function getJob(jobId, product) {
    const res = await axios.get(`${API}/v2/ai-video-enhancer/get-job/${jobId}`, {
        headers: { 'user-agent': UA, origin: 'https://unblurimage.ai', referer: 'https://unblurimage.ai/', 'product-serial': product }
    })
    return res.data
}

async function pollJob(jobId, product, interval = 5000, timeout = 120000) {
    const start = Date.now()
    while (true) {
        if (Date.now() - start > timeout) throw new Error('Timeout menunggu hasil video')
        const res = await getJob(jobId, product)
        if (res.code === 100000 && res.result?.output_url) return res.result
        if (res.code === 300011) throw new Error('VIDEO_GENERATED_FAILED')
        if (res.code !== 300010) throw new Error(JSON.stringify(res))
        await new Promise(r => setTimeout(r, interval))
    }
}

// ── Primary: unblurimage ──────────────────────────────────────────────────────
async function enhanceUnblur(video, resolution = '4k') {
    const product = productserial()
    const upload  = await uploadvid(video)
    await putOss(upload.url, video)
    const cdnUrl  = 'https://cdn.unblurimage.ai/' + upload.object_name
    const jobId   = await createJob(cdnUrl, resolution, product)
    const result  = await pollJob(jobId, product)
    return { output_url: result.output_url }
}

// ── Upload ke Catbox ──────────────────────────────────────────────────────────
async function uploadToCatbox(filePath) {
    const buffer   = fs.readFileSync(filePath)
    const filename = path.basename(filePath)
    const form     = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('fileToUpload', buffer, { filename })
    const res = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0' },
        timeout: 60000,
        maxBodyLength: Infinity
    })
    if (res.data && typeof res.data === 'string' && res.data.startsWith('http')) {
        return res.data.trim()
    }
    throw new Error('Catbox upload failed')
}

// ── Upload ke Litterbox (fallback Catbox) ─────────────────────────────────────
async function uploadToLitterbox(filePath) {
    const buffer   = fs.readFileSync(filePath)
    const filename = path.basename(filePath)
    const form     = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('time', '24h')
    form.append('fileToUpload', buffer, { filename })
    const res = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, {
        headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0' },
        timeout: 60000,
        maxBodyLength: Infinity
    })
    if (res.data && typeof res.data === 'string' && res.data.startsWith('http')) {
        return res.data.trim()
    }
    throw new Error('Litterbox upload failed')
}

// ── Fallback: api-faa.my.id ───────────────────────────────────────────────────
async function pollFaaJob(resultUrl, interval = 5000, timeout = 120000) {
    const start = Date.now()
    while (true) {
        if (Date.now() - start > timeout) throw new Error('Timeout menunggu hasil faa')
        try {
            const { data } = await axios.get(resultUrl, { timeout: 30000 })
            // Kalau sudah selesai, ada output URL
            const outUrl = data?.result?.output_url || data?.result?.url
                || data?.output_url || data?.url || null
            if (outUrl && outUrl.startsWith('http') && !outUrl.includes('/faa/result')) {
                return outUrl
            }
            // Masih processing
            console.log('[hdvid] faa masih processing...')
        } catch (e) {
            console.log('[hdvid] faa poll error:', e.message)
        }
        await new Promise(r => setTimeout(r, interval))
    }
}

async function enhanceFaa(videoUrl) {
    const { data } = await axios.get(
        `https://api-faa.my.id/faa/hdvid?url=${encodeURIComponent(videoUrl)}`,
        { timeout: 30000 }
    )

    if (!data?.status) throw new Error(data?.message || 'Faa hdvid gagal')

    // Faa return job ID — perlu polling result URL
    const resultUrl = data?.result
    if (resultUrl && typeof resultUrl === 'string' && resultUrl.includes('/faa/result')) {
        console.log('[hdvid] faa polling job:', resultUrl)
        const outUrl = await pollFaaJob(resultUrl)
        return { output_url: outUrl }
    }

    // Kalau langsung return URL
    const outUrl = data?.result?.output_url || data?.result?.url
        || data?.output_url || data?.url || null
    if (!outUrl) throw new Error('Faa tidak return output URL')
    return { output_url: outUrl }
}

// ── Main export ───────────────────────────────────────────────────────────────
async function videoenhancer(video, resolution = '4k') {
    if (!video) throw new Error('video is required')

    // 1. Coba unblurimage (2x attempt)
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            return await enhanceUnblur(video, resolution)
        } catch (e) {
            if (e.message === 'VIDEO_GENERATED_FAILED' && attempt < 2) {
                await new Promise(r => setTimeout(r, 3000))
                continue
            }
            console.log(`[hdvid] unblur attempt ${attempt} gagal:`, e.message)
            break
        }
    }

    // 2. Upload ke Catbox → kirim URL ke faa
    console.log('[hdvid] fallback ke faa...')
    let publicUrl = null

    // Coba Catbox dulu, fallback Litterbox
    for (const uploader of [uploadToCatbox, uploadToLitterbox]) {
        try {
            publicUrl = await uploader(video)
            console.log('[hdvid] upload sukses:', publicUrl)
            break
        } catch (e) {
            console.log('[hdvid] upload gagal:', e.message)
        }
    }

    if (!publicUrl) throw new Error('Gagal upload video ke hosting sementara')

    try {
        return await enhanceFaa(publicUrl)
    } catch (e) {
        console.log('[hdvid] faa gagal:', e.message)
        throw new Error('Semua API video enhancer sedang bermasalah, coba lagi nanti~')
    }
}

module.exports = videoenhancer