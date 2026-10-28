const nanoBanana = require('../../src/scraper/nanobanana')
const FormData = require('form-data')
const fetch = require('node-fetch')
const mime = require('mime-types')
const path = require('path')
const crypto = require('crypto')
const config = require('../../config')
const { GoogleGenerativeAI } = require('@google/generative-ai')

const pluginConfig = {
    name: 'toblack',
    alias: ['black', 'hitamkan', 'hitam', 'tohitam'],
    category: 'ai',
    description: 'Mengubah skin tone gambar menjadi lebih gelap',
    usage: '.toblack (coklat/ireng) (reply gambar)',
    example: '.toblack coklat',
    cooldown: 30,
    energi: 2,
    isEnabled: true
}

const PROMPTS = {
    ireng: `Ubah kulitnya menjadi hitam pekat`
}

const API_FAA_HEADERS = {
    'User-Agent': 'Ourin-Bot/2.0',
    Accept: '*/*'
}

const githubConfig = {
    token: config.github?.token,
    owner: config.github?.owner,
    repo: config.github?.repo,
    branch: config.github?.branch || 'main',
    folder: config.github?.folder || 'uploads'
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// ============================================================
// UTILITAS GAMBAR
// ============================================================

async function detectImageMime(buffer) {
    try {
        const fileType = await import('file-type')
        const result = await fileType.fileTypeFromBuffer(buffer)
        return result?.mime || 'image/jpeg'
    } catch {
        return 'image/jpeg'
    }
}

function getImageExtension(mimetype) {
    const extensions = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif'
    }

    return extensions[mimetype] || 'jpg'
}

function extractImageBuffer(data) {
    if (Buffer.isBuffer(data)) return data

    if (data instanceof ArrayBuffer) {
        return Buffer.from(data)
    }

    if (ArrayBuffer.isView(data)) {
        return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
    }

    return null
}

function extractImageFromResponse(data) {
    if (!data || typeof data !== 'object') return null

    const candidates = [
        data.buffer,
        data.imageBuffer,
        data.image,
        data.result,
        data.output,
        data.data,
        data.base64,
        data.image_base64,
        data.imageBase64
    ]

    for (const value of candidates) {
        const direct = extractImageBuffer(value)
        if (direct?.length > 100) return direct

        if (typeof value === 'string') {
            const base64 = value.replace(
                /^data:image\/[^;]+;base64,/,
                ''
            )

            if (
                base64.length > 100 &&
                /^[A-Za-z0-9+/=\s]+$/.test(base64)
            ) {
                const decoded = Buffer.from(
                    base64.replace(/\s/g, ''),
                    'base64'
                )

                if (decoded.length > 100) return decoded
            }
        }

        if (value && typeof value === 'object') {
            const nested = extractImageFromResponse(value)
            if (nested) return nested
        }
    }

    return null
}

async function getImageFromUrl(url) {
    if (!url || !/^https?:\/\//i.test(url)) {
        throw new Error('URL gambar tidak valid')
    }

    const response = await fetch(url, { timeout: 120000 })

    if (!response.ok) {
        throw new Error(`Download gambar gagal: HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''

    if (!contentType.startsWith('image/')) {
        throw new Error('URL tidak mengembalikan gambar')
    }

    const buffer = await response.buffer()

    if (buffer.length < 100) {
        throw new Error('Gambar hasil kosong')
    }

    return buffer
}

// ============================================================
// CEK HOSHINO AI
// ============================================================

async function isHoshinoAi(buffer) {
    try {
        const keys = config.geminiApiKey
        const key = Array.isArray(keys)
            ? keys[Math.floor(Math.random() * keys.length)]
            : keys

        if (!key) return false

        const genAI = new GoogleGenerativeAI(key)
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash'
        })

        const mimetype = await detectImageMime(buffer)

        const result = await model.generateContent([
            {
                inlineData: {
                    data: buffer.toString('base64'),
                    mimeType: mimetype
                }
            },
            'Apakah gambar ini menampilkan karakter Hoshino Ai dari anime Oshi no Ko? Jawab hanya YA atau TIDAK.'
        ])

        return result.response.text()
            .trim()
            .toUpperCase()
            .startsWith('YA')
    } catch (error) {
        console.log('[toblack] Cek Hoshino Ai:', error.message)
        return false
    }
}

// ============================================================
// GITHUB TEMP UPLOADER
// ============================================================

async function uploadToGithubTemp(buffer, filename) {
    const { token, owner, repo, branch, folder } = githubConfig

    if (!token || !owner || !repo) {
        throw new Error(
            'config.github.token, owner, atau repo belum dikonfigurasi'
        )
    }

    const ext = path.extname(filename) || '.jpg'
    const safeName =
        `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`

    const filePath = `${folder}/${safeName}`

    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'Content-Type': 'application/json',
                'User-Agent': 'hsnai-toblack'
            },
            body: JSON.stringify({
                message: `Temporary upload ${safeName}`,
                content: buffer.toString('base64'),
                branch
            }),
            timeout: 60000
        }
    )

    if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new Error(
            `GitHub ${response.status}: ${errorText.slice(0, 180)}`
        )
    }

    const data = await response.json()

    if (!data?.content?.sha) {
        throw new Error('GitHub tidak mengembalikan SHA file')
    }

    return {
        url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`,
        path: filePath,
        sha: data.content.sha
    }
}

async function deleteFromGithubTemp(filePath, sha) {
    const { token, owner, repo, branch } = githubConfig

    if (!token || !owner || !repo || !filePath || !sha) return

    try {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
            {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'hsnai-toblack'
                },
                body: JSON.stringify({
                    message: `Cleanup ${path.basename(filePath)}`,
                    sha,
                    branch
                }),
                timeout: 30000
            }
        )

        if (!response.ok) {
            console.log('[toblack] Cleanup GitHub:', response.status)
        }
    } catch (error) {
        console.log('[toblack] Cleanup GitHub:', error.message)
    }
}

// ============================================================
// HOST UPLOADER
// ============================================================

async function uploadToCatbox(buffer, filename) {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('fileToUpload', buffer, {
        filename,
        contentType: mime.lookup(filename) || 'image/jpeg'
    })

    const response = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
        timeout: 60000
    })

    if (!response.ok) throw new Error('Catbox gagal')

    const url = (await response.text()).trim()

    if (!url.startsWith('http')) {
        throw new Error('Respons Catbox tidak valid')
    }

    return { url, cleanup: async () => {} }
}

async function uploadToLitterbox(buffer, filename) {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('time', '72h')
    form.append('fileToUpload', buffer, {
        filename,
        contentType: mime.lookup(filename) || 'image/jpeg'
    })

    const response = await fetch(
        'https://litterbox.catbox.moe/resources/internals/api.php',
        {
            method: 'POST',
            body: form,
            headers: form.getHeaders(),
            timeout: 60000
        }
    )

    if (!response.ok) throw new Error('Litterbox gagal')

    const url = (await response.text()).trim()

    if (!url.startsWith('http')) {
        throw new Error('Respons Litterbox tidak valid')
    }

    return { url, cleanup: async () => {} }
}

async function uploadToTmpFiles(buffer, filename) {
    const form = new FormData()
    form.append('file', buffer, {
        filename,
        contentType: mime.lookup(filename) || 'image/jpeg'
    })
    form.append('expire', '21600')

    const response = await fetch(
        'https://tmpfiles.org/api/v1/upload',
        {
            method: 'POST',
            body: form,
            headers: {
                ...form.getHeaders(),
                Accept: 'application/json',
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 60000
        }
    )

    if (!response.ok) throw new Error('TmpFiles gagal')

    const data = await response.json()

    if (data?.status !== 'success' || !data?.data?.url) {
        throw new Error('Respons TmpFiles tidak valid')
    }

    const match = data.data.url.match(/\/(\d+)(?:\/|$)/)

    if (!match) throw new Error('ID TmpFiles tidak ditemukan')

    return {
        url: `https://tmpfiles.org/dl/${match[1]}/${encodeURIComponent(filename)}`,
        cleanup: async () => {}
    }
}

async function uploadToQuax(buffer, filename) {
    const form = new FormData()
    form.append('files[]', buffer, {
        filename,
        contentType: mime.lookup(filename) || 'image/jpeg'
    })

    const response = await fetch('https://qu.ax/upload.php', {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
        timeout: 60000
    })

    if (!response.ok) throw new Error('Qu.ax gagal')

    const data = await response.json()

    if (!data?.success || !data?.files?.[0]?.url) {
        throw new Error('Respons Qu.ax tidak valid')
    }

    return { url: data.files[0].url, cleanup: async () => {} }
}

async function uploadToGithub(buffer, filename) {
    const uploaded = await uploadToGithubTemp(buffer, filename)

    return {
        url: uploaded.url,
        cleanup: () => deleteFromGithubTemp(
            uploaded.path,
            uploaded.sha
        )
    }
}

const HOST_CANDIDATES = [
    { name: 'GitHub', fn: uploadToGithub },
    { name: 'Catbox', fn: uploadToCatbox },
    { name: 'Litterbox', fn: uploadToLitterbox },
    { name: 'TmpFiles', fn: uploadToTmpFiles },
    { name: 'Qu.ax', fn: uploadToQuax }
]

// ============================================================
// KYZZZ API
// ============================================================

async function callKyzzz(buffer, prompt) {
    const endpoint =
        'https://api.kyzzz.xyz/api/ai-image/edit-image?apikey=kyzz03376144580045'

    const extension = getImageExtension(await detectImageMime(buffer))
    const filename = `image.${extension}`
    let lastError

    for (const fieldName of ['image', 'file', 'imageFile']) {
        const form = new FormData()

        form.append(fieldName, buffer, {
            filename,
            contentType: mime.lookup(filename) || 'image/jpeg'
        })
        form.append('prompt', prompt)

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                body: form,
                headers: {
                    ...form.getHeaders(),
                    Accept: 'image/*, application/json',
                    'User-Agent': 'HoshinoAiBot/2.5.0'
                },
                timeout: 120000
            })

            if (!response.ok) {
                const text = await response.text().catch(() => '')
                throw new Error(
                    `Kyzzz HTTP ${response.status}: ${text.slice(0, 150)}`
                )
            }

            const contentType =
                response.headers.get('content-type') || ''

            if (contentType.startsWith('image/')) {
                const image = await response.buffer()
                if (image.length > 100) return image
            }

            const data = await response.json()
            const image = extractImageFromResponse(data)

            if (image?.length > 100) return image

            const url =
                data?.url ||
                data?.imageUrl ||
                data?.result?.url ||
                data?.data?.url ||
                data?.data?.imageUrl

            if (url) return await getImageFromUrl(url)

            throw new Error('Respons Kyzzz tidak berisi gambar')
        } catch (error) {
            lastError = error
            console.log(
                `[toblack] Kyzzz (${fieldName}):`,
                error.message
            )
        }
    }

    throw lastError || new Error('Kyzzz gagal')
}

// ============================================================
// API FAA
// ============================================================

async function callFaaWithUrl(endpoint, imageUrl, prompt) {
    const url = new URL(`https://api-faa.my.id/faa/${endpoint}`)
    url.searchParams.set('url', imageUrl)

    // Mode coklat tidak mengirim parameter prompt
    if (prompt) {
        url.searchParams.set('prompt', prompt)
    }

    const response = await fetch(url.toString(), {
        headers: API_FAA_HEADERS,
        timeout: 120000
    })

    if (!response.ok) {
        throw new Error(`API Faa HTTP ${response.status}`)
    }

    const contentType =
        response.headers.get('content-type') || ''

    if (contentType.startsWith('image/')) {
        const image = await response.buffer()
        if (image.length > 100) return image
    }

    const data = await response.json()
    const image = extractImageFromResponse(data)

    if (image?.length > 100) return image

    const imageUrlResult =
        data?.url ||
        data?.imageUrl ||
        data?.result?.url ||
        data?.data?.url

    if (imageUrlResult) {
        return await getImageFromUrl(imageUrlResult)
    }

    throw new Error('Respons API Faa tidak berisi gambar')
}

async function processViaHostFallback(
    buffer,
    filename,
    endpoint,
    prompt
) {
    const errors = []

    for (const host of HOST_CANDIDATES) {
        let uploaded

        try {
            console.log(`[toblack] Upload menggunakan ${host.name}`)
            uploaded = await host.fn(buffer, filename)

            const result = await callFaaWithUrl(
                endpoint,
                uploaded.url,
                prompt
            )

            if (result?.length > 100) return result

            throw new Error('Hasil gambar kosong')
        } catch (error) {
            errors.push(`${host.name}: ${error.message}`)
            console.log(
                `[toblack] ${host.name} gagal:`,
                error.message
            )
        } finally {
            if (uploaded?.cleanup) {
                await uploaded.cleanup().catch(() => {})
            }
        }
    }

    throw new Error(
        `Semua host gagal:\n${errors.join('\n')}`
    )
}

// ============================================================
// NANO BANANA FALLBACK
// ============================================================

async function callNanoBanana(buffer, prompt) {
    const candidates = [
        async () => {
            if (typeof nanoBanana === 'function') {
                return nanoBanana(buffer, prompt)
            }
        },
        async () => {
            if (typeof nanoBanana?.generate === 'function') {
                return nanoBanana.generate(buffer, prompt)
            }
        },
        async () => {
            if (typeof nanoBanana?.editImage === 'function') {
                return nanoBanana.editImage(buffer, prompt)
            }
        }
    ]

    let lastError

    for (const attempt of candidates) {
        try {
            const response = await attempt()
            if (!response) continue

            const image =
                extractImageBuffer(response) ||
                extractImageFromResponse(response)

            if (image?.length > 100) return image

            if (response?.url) {
                return await getImageFromUrl(response.url)
            }
        } catch (error) {
            lastError = error
        }
    }

    throw lastError || new Error(
        'Format hasil Nano Banana tidak dikenali'
    )
}

// ============================================================
// PROSES GAMBAR
// ============================================================

async function processImage(buffer, mode) {
    // COKLAT: langsung API FAA, tanpa prompt
    if (mode === 'coklat') {
        const result = await processViaHostFallback(
            buffer,
            `toblack-${Date.now()}.jpg`,
            'tohitam',
            null
        )

        return {
            buffer: result,
            source: 'API Faa'
        }
    }

    // IRENG: Kyzzz -> Nano Banana -> API Faa
    if (mode === 'ireng') {
        const prompt = PROMPTS.ireng

        try {
            console.log('[toblack] Mencoba Kyzzz...')
            const result = await callKyzzz(buffer, prompt)

            return {
                buffer: result,
                source: 'Kyzzz'
            }
        } catch (error) {
            console.log('[toblack] Kyzzz gagal:', error.message)
        }

        try {
            console.log('[toblack] Mencoba Nano Banana...')
            const result = await callNanoBanana(buffer, prompt)

            return {
                buffer: result,
                source: 'Nano Banana'
            }
        } catch (error) {
            console.log(
                '[toblack] Nano Banana gagal:',
                error.message
            )
            await sleep(1500)
        }

        const result = await processViaHostFallback(
            buffer,
            `toblack-${Date.now()}.jpg`,
            'editfoto',
            prompt
        )

        return {
            buffer: result,
            source: 'API Faa'
        }
    }

    throw new Error('Mode tidak valid')
}

// ============================================================
// HANDLER
// ============================================================

async function handler(m, { sock }) {
    const args = (m.args || []).join(' ').trim().toLowerCase()
    const mode = args.split(/\s+/)[0]

    if (!['coklat', 'ireng'].includes(mode)) {
        return m.reply(
            `🖤 *ᴛᴏ ʜɪᴛᴀᴍ*\n\n` +
            `Kyaa~ pilih dulu mau hitam yang mana~ ⭐\n\n` +
            `✦ \`${m.prefix}toblack coklat\` — Gelap eksotis ala Ai~\n` +
            `✦ \`${m.prefix}toblack ireng\` — Hitam arang, gelap banget!\n\n` +
            `_Reply atau kirim gambarnya juga ya~ 🌸_`
        )
    }

    try {
        let buffer

        if (m.quoted) {
            const quotedIsImage =
                m.quoted.isImage ||
                m.quoted.type === 'imageMessage' ||
                m.quoted.mimetype?.startsWith('image/')

            if (!quotedIsImage) {
                return m.reply(`❌ *Ara ara~*

> Reply gambar aja ya, Ai cuma bisa baca gambar~ 🥺`)
            }

            if (typeof m.quoted.download === 'function') {
                buffer = await m.quoted.download()
            }
        } else {
            const isImage =
                m.isImage ||
                m.mimetype?.startsWith('image/')

            if (!isImage) {
                return m.reply(
                    `🖤 *ᴛᴏ ʜɪᴛᴀᴍ*

Kyaa~ gambarnya mana dulu dong~ 🌸

\`${m.prefix}toblack ${mode} (reply/kirim gambar)\``
                )
            }

            if (typeof m.download === 'function') {
                buffer = await m.download()
            }
        }

        if (!Buffer.isBuffer(buffer) || !buffer.length) {
            return m.reply(`❌ *Ara ara~*\n\n> Ai gagal download gambarnya nih... coba lagi ya~ 🥺`)
        }

        await m.react('⏳')

        if (await isHoshinoAi(buffer)) {
            await m.react('❌')
            return m.reply(
                `🚫 *Eh, tunggu dulu!* ✦

> Itu Hoshino Ai... masa Ai disuruh nge-hitamin diri sendiri? 🥺
> Owner juga pasti gak rela liat Hoshino Ai dihitamin!

_Coba gambar lain ya~ 🌸_`
            )
        }

        const result = await processImage(buffer, mode)

        await sock.sendMessage(
            m.chat,
            {
                image: result.buffer,
                caption:
                    `🖤 *ᴛᴏ ʜɪᴛᴀᴍ — ${mode.toUpperCase()}*\n\n` +
                    `> Sugoi~! Kulitnya udah jadi, Ai bangga banget! ⭐\n` +
                    `> Engine: *${result.source}*`
            },
            { quoted: m }
        )

        await m.react('✅')
    } catch (error) {
        console.error('[toblack] Error:', error)
        await m.react('❌')

        return m.reply(
            `❌ *Gomen ne~* ✦\n\n` +
            `> ${String(error.message || error).slice(0, 350)}\n\n` +
            `_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}