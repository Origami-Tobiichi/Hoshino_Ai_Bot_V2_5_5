const axios = require('axios')
const FormData = require('form-data')
const path = require('path')
const crypto = require('crypto')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const config = require('../../config')

const API_FAA_HEADERS = {
    'User-Agent': 'Ourin-Bot/2.0',
    'Accept': '*/*'
}

const gh = config.github || {}
const githubConfig = {
    token: process.env.GITHUB_TOKEN || gh.token || '',
    owner: process.env.GITHUB_OWNER || gh.owner || '',
    repo: process.env.GITHUB_REPO || gh.repo || '',
    branch: process.env.GITHUB_BRANCH || gh.branch || 'main',
    folder: process.env.GITHUB_FOLDER || gh.folder || 'uploads'
}

async function uploadToGithubTemp(buffer, filename) {
    const { token, owner, repo, branch, folder } = githubConfig
    if (!token || !owner || !repo) throw new Error('GitHub belum dikonfigurasi')

    const ext = path.extname(filename) || '.jpg'
    const safeName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`
    const filePath = `${folder}/${safeName}`

    const res = await axios.put(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        { message: `upload: ${safeName}`, content: buffer.toString('base64'), branch },
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'hsnai-nanobanana'
            },
            timeout: 60000
        }
    )

    const sha = res.data?.content?.sha
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
    return { url, path: filePath, sha }
}

async function deleteFromGithubTemp(filePath, sha) {
    const { token, owner, repo, branch } = githubConfig
    if (!token || !owner || !repo || !filePath || !sha) return
    try {
        await axios.delete(
            `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json',
                    'User-Agent': 'hsnai-nanobanana'
                },
                data: { message: `cleanup: hapus ${filePath}`, sha, branch },
                timeout: 30000
            }
        )
        console.log('[NanoBanana] GitHub temp file dihapus:', filePath)
    } catch (e) {
        console.log('[NanoBanana] Gagal hapus GitHub temp file:', filePath, '-', e.message)
    }
}

async function uploadToTempFiles(buffer, filename) {
    const form = new FormData()
    form.append('file', buffer, { filename, contentType: 'image/jpeg' })
    const res = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
        headers: form.getHeaders(),
        timeout: 60000
    })
    if (res.data?.status === 'success' && res.data?.data?.url) {
        return res.data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
    }
    throw new Error('Upload ke tmpfiles gagal')
}

// ── Kandidat host, urut prioritas. Muter ke host berikutnya kalau kombinasi
// upload+api-faa gagal, bukan cuma kalau upload-nya doang yang gagal. ──────
const HOST_CANDIDATES = [
    {
        name: 'GitHub',
        upload: async (buf, fn) => {
            const f = await uploadToGithubTemp(buf, fn)
            return { url: f.url, cleanup: () => deleteFromGithubTemp(f.path, f.sha) }
        }
    },
    {
        name: 'TmpFiles',
        upload: async (buf, fn) => ({ url: await uploadToTempFiles(buf, fn), cleanup: null })
    }
]

// ── Panggil api-faa dengan retry — backend mereka kadang balikin 500
// "socket hang up" secara transient (upstream mereka lambat/putus), bukan
// block dari Cloudflare. Retry dengan backoff biasanya cukup buat nutupinnya. ──
async function callNanoBananaApi(imageUrl, prompt, retries = 3) {
    const apiUrl = `https://api-faa.my.id/faa/nano-banana?url=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(prompt)}`
    let lastError

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const res = await axios.get(apiUrl, {
                responseType: 'arraybuffer',
                timeout: 100000, // respons sukses bisa makan 10-60an detik, jangan dipangkas
                headers: API_FAA_HEADERS,
                validateStatus: () => true
            })
            const contentType = res.headers?.['content-type'] || ''
            if (res.status === 200 && res.data && res.data.byteLength > 0 && contentType.includes('image')) {
                return Buffer.from(res.data)
            }
            const bodyText = Buffer.from(res.data || '').toString('utf8').slice(0, 300)
            lastError = new Error(`Status ${res.status} (${contentType || 'unknown'}): ${bodyText}`)
        } catch (e) {
            lastError = e
        }

        if (attempt < retries) {
            console.log(`[NanoBanana] api-faa percobaan ${attempt}/${retries} gagal: ${lastError.message} — retry dalam ${attempt * 3}s...`)
            await new Promise(r => setTimeout(r, attempt * 3000))
        }
    }
    throw lastError
}

// ── Fallback terakhir: panggil Gemini langsung (skip api-faa sepenuhnya)
// kalau semua host + retry di atas tetap gagal. Pakai key random dari
// config.geminiApiKey (array, buat sebar beban antar key). ─────────────────
function getRandomGeminiKey() {
    const keys = config.geminiApiKey
    if (!Array.isArray(keys) || keys.length === 0) {
        throw new Error('geminiApiKey belum dikonfigurasi di config.js')
    }
    return keys[Math.floor(Math.random() * keys.length)]
}

async function editImageWithGemini(imageBuffer, prompt) {
    const genAI = new GoogleGenerativeAI(getRandomGeminiKey())
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-image' })

    const result = await model.generateContent([
        { inlineData: { data: imageBuffer.toString('base64'), mimeType: 'image/jpeg' } },
        prompt
    ])

    const parts = result.response.candidates?.[0]?.content?.parts || []
    const imgPart = parts.find(p => p.inlineData)
    if (!imgPart) throw new Error('Gemini tidak mengembalikan gambar')
    return Buffer.from(imgPart.inlineData.data, 'base64')
}

async function nanoBanana(imageBuffer, prompt) {
    const filename = `nano_${Date.now()}.jpg`
    const errors = []

    for (const host of HOST_CANDIDATES) {
        let uploaded
        try {
            uploaded = await host.upload(imageBuffer, filename)
            console.log(`[NanoBanana] upload ${host.name} -> ${uploaded.url}`)
        } catch (e) {
            errors.push(`${host.name} (upload): ${e.message}`)
            console.log(`[NanoBanana] upload ${host.name} gagal:`, e.message)
            continue
        }

        try {
            const result = await callNanoBananaApi(uploaded.url, prompt)
            if (uploaded.cleanup) await uploaded.cleanup()
            return result
        } catch (e) {
            errors.push(`${host.name} (api-faa): ${e.message}`)
            console.log(`[NanoBanana] api-faa via ${host.name} gagal:`, e.message)
            if (uploaded.cleanup) await uploaded.cleanup()
            continue
        }
    }

    // Semua host + retry ke api-faa gagal total → fallback terakhir: Gemini langsung
    console.log('[NanoBanana] Semua host api-faa gagal, fallback ke Gemini langsung...')
    try {
        return await editImageWithGemini(imageBuffer, prompt)
    } catch (e) {
        errors.push(`Gemini (fallback): ${e.message}`)
        throw new Error(errors.join(' | ') || 'Semua host gagal, tidak ada detail error')
    }
}

module.exports = nanoBanana