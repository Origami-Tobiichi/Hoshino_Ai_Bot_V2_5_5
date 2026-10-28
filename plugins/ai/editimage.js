const axios = require('axios')
const FormData = require('form-data')
const fetch = require('node-fetch')

const pluginConfig = {
    name: 'editimage',
    alias: ['editimg', 'imgedit'],
    category: 'ai',
    description: 'Edit gambar dengan AI menggunakan prompt',
    usage: '.editimage <prompt>',
    example: '.editimage make it anime style',
    isOwner: false,
    isPremium: true,
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 1,
    isEnabled: true
}

// ── API CONFIG ──────────────────────────────────────────────────────────────

const KYZZ_API = 'https://api.kyzzz.xyz/api/ai-image/edit-image'
const KYZZ_API_KEY = 'kyzz03376144580045'

const FAA_API = 'https://api-faa.my.id/faa/editfoto?url=&prompt='

// ── UPLOADERS ───────────────────────────────────────────────────────────────

const termaiKey = 'ISI_API_KEY_TERMAI'
const termaiDomain = 'https://c.termai.cc'

async function uploadToTermai(buffer) {
    const form = new FormData()
    form.append('file', buffer, {
        filename: 'image.jpg',
        contentType: 'image/jpeg'
    })

    const res = await fetch(
        `${termaiDomain}/api/upload?key=${termaiKey}`,
        {
            method: 'POST',
            body: form,
            headers: form.getHeaders(),
            timeout: 30000
        }
    )

    if (!res.ok) throw new Error(`Termai HTTP ${res.status}`)

    const data = await res.json()

    if (!data?.status || !data?.path) {
        throw new Error('Termai invalid response')
    }

    return data.path
}

async function uploadToGofile(buffer) {
    const serverRes = await fetch(
        'https://api.gofile.io/servers',
        { timeout: 10000 }
    )

    if (!serverRes.ok) {
        throw new Error(`Gofile server HTTP ${serverRes.status}`)
    }

    const serverData = await serverRes.json()
    const server = serverData?.data?.servers?.[0]?.name

    if (!server) throw new Error('Gofile server tidak ditemukan')

    const form = new FormData()
    form.append('file', buffer, {
        filename: 'image.jpg',
        contentType: 'image/jpeg'
    })

    const res = await fetch(
        `https://${server}.gofile.io/uploadFile`,
        {
            method: 'POST',
            body: form,
            headers: form.getHeaders(),
            timeout: 60000
        }
    )

    if (!res.ok) throw new Error(`Gofile HTTP ${res.status}`)

    const data = await res.json()

    if (data?.data?.directLink) {
        return data.data.directLink
    }

    throw new Error('Gofile tidak menyediakan direct link')
}

async function uploadToYpnk(buffer) {
    const form = new FormData()
    form.append('files', buffer, {
        filename: 'image.jpg',
        contentType: 'image/jpeg'
    })

    const res = await fetch('https://cdn.ypnk.biz.id/upload', {
        method: 'POST',
        body: form,
        headers: {
            ...form.getHeaders(),
            'User-Agent': 'Mozilla/5.0'
        },
        timeout: 30000
    })

    if (!res.ok) throw new Error(`YPNK HTTP ${res.status}`)

    const data = await res.json()

    if (!data?.success || !data?.files?.[0]?.url) {
        throw new Error('YPNK invalid response')
    }

    const fileUrl = data.files[0].url

    return fileUrl.startsWith('http')
        ? fileUrl
        : `https://cdn.ypnk.biz.id${fileUrl}`
}

async function uploadToQuax(buffer) {
    const form = new FormData()
    form.append('files[]', buffer, {
        filename: 'image.jpg',
        contentType: 'image/jpeg'
    })

    const res = await fetch('https://qu.ax/upload.php', {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
        timeout: 30000
    })

    if (!res.ok) throw new Error(`Qu.ax HTTP ${res.status}`)

    const data = await res.json()

    if (!data?.success || !data?.files?.[0]?.url) {
        throw new Error('Qu.ax invalid response')
    }

    return data.files[0].url
}

async function uploadToTmpFiles(buffer) {
    const form = new FormData()
    form.append('file', buffer, {
        filename: 'image.jpg',
        contentType: 'image/jpeg'
    })

    const res = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
        timeout: 30000
    })

    if (!res.ok) throw new Error(`TmpFiles HTTP ${res.status}`)

    const data = await res.json()

    if (!data?.data?.url) {
        throw new Error('TmpFiles invalid response')
    }

    return data.data.url.replace(
        'tmpfiles.org/',
        'tmpfiles.org/dl/'
    )
}

async function uploadImage(buffer) {
    const uploaders = [
        { name: 'Termai', fn: () => uploadToTermai(buffer) },
        { name: 'YPNK', fn: () => uploadToYpnk(buffer) },
        { name: 'Qu.ax', fn: () => uploadToQuax(buffer) },
        { name: 'TmpFiles', fn: () => uploadToTmpFiles(buffer) },
        { name: 'Gofile', fn: () => uploadToGofile(buffer) }
    ]

    for (const uploader of uploaders) {
        try {
            const url = await uploader.fn()

            if (
                typeof url !== 'string' ||
                !/^https?:\/\/\S+$/i.test(url)
            ) {
                throw new Error('URL upload tidak valid')
            }

            console.log(
                `[editimage] Upload OK via ${uploader.name}`
            )

            return url
        } catch (error) {
            console.log(
                `[editimage] Upload ${uploader.name} gagal:`,
                error.message
            )
        }
    }

    throw new Error('Semua uploader gagal mengunggah gambar')
}

// ── RESPONSE HELPERS ────────────────────────────────────────────────────────

async function getImageFromUrl(url) {
    const res = await fetch(url, { timeout: 120000 })

    if (!res.ok) {
        throw new Error(`Gagal mengambil gambar: HTTP ${res.status}`)
    }

    const contentType = res.headers.get('content-type') || ''

    if (!contentType.toLowerCase().includes('image/')) {
        throw new Error('URL hasil tidak mengarah langsung ke gambar')
    }

    return Buffer.from(await res.arrayBuffer())
}

async function extractImageBuffer(data, contentType = '') {
    if (Buffer.isBuffer(data)) {
        if (contentType.toLowerCase().includes('image/')) {
            return data
        }

        const text = data.toString('utf8').trim()

        try {
            data = JSON.parse(text)
        } catch {
            throw new Error(
                `Respons API bukan gambar: ${text.slice(0, 180)}`
            )
        }
    }

    if (typeof data === 'string') {
        try {
            data = JSON.parse(data)
        } catch {
            if (/^https?:\/\//i.test(data)) {
                return getImageFromUrl(data)
            }

            throw new Error('Format respons API tidak dikenal')
        }
    }

    const imageValue =
        data?.image ||
        data?.data?.image ||
        data?.base64 ||
        data?.data?.base64

    if (typeof imageValue === 'string') {
        if (/^https?:\/\//i.test(imageValue)) {
            return getImageFromUrl(imageValue)
        }

        const base64 = imageValue.replace(
            /^data:image\/[^;]+;base64,/i,
            ''
        )

        if (
            base64.length > 100 &&
            /^[A-Za-z0-9+/=\s]+$/.test(base64)
        ) {
            const result = Buffer.from(base64, 'base64')

            if (result.length > 100) return result
        }
    }

    const resultUrl =
        data?.url ||
        data?.resultUrl ||
        data?.result ||
        data?.data?.url ||
        data?.data?.resultUrl ||
        data?.data?.result

    if (
        typeof resultUrl === 'string' &&
        /^https?:\/\//i.test(resultUrl)
    ) {
        return getImageFromUrl(resultUrl)
    }

    throw new Error(
        `API tidak mengembalikan gambar: ${JSON.stringify(data).slice(0, 180)}`
    )
}

// ── KYZZZ API: PRIORITAS PERTAMA ────────────────────────────────────────────

async function editWithKyzzz(buffer, prompt) {
    if (
        !KYZZ_API_KEY ||
        KYZZ_API_KEY === 'ISI_API_KEY_KYZZ'
    ) {
        throw new Error('API key Kyzzz belum diatur')
    }

    const fieldNames = ['image', 'file', 'imageFile']
    let lastError

    for (const fieldName of fieldNames) {
        try {
            const form = new FormData()

            form.append(fieldName, buffer, {
                filename: 'image.jpg',
                contentType: 'image/jpeg'
            })
            form.append('prompt', prompt)

            const response = await axios.post(
                KYZZ_API,
                form,
                {
                    params: { apikey: KYZZ_API_KEY },
                    headers: form.getHeaders(),
                    responseType: 'arraybuffer',
                    timeout: 120000,
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity,
                    validateStatus: () => true
                }
            )

            const contentType =
                response.headers['content-type'] || ''

            if (
                response.status >= 200 &&
                response.status < 300
            ) {
                const result = await extractImageBuffer(
                    Buffer.from(response.data),
                    contentType
                )

                if (!Buffer.isBuffer(result) || result.length < 100) {
                    throw new Error('Hasil Kyzzz kosong atau rusak')
                }

                return result
            }

            const errorText = Buffer
                .from(response.data)
                .toString('utf8')
                .slice(0, 200)

            lastError = new Error(
                `Kyzzz HTTP ${response.status}: ${errorText}`
            )

            console.log(
                `[editimage] Kyzzz ${fieldName}: ${lastError.message}`
            )
        } catch (error) {
            lastError = error

            console.log(
                `[editimage] Kyzzz field ${fieldName} gagal:`,
                error.message
            )
        }
    }

    throw lastError || new Error('Kyzzz gagal memproses gambar')
}

// ── API FAA: FALLBACK ───────────────────────────────────────────────────────

async function editWithFaa(imageUrl, prompt) {
    // Bentuk endpoint sesuai permintaan:
    // https://api-faa.my.id/faa/editfoto?url=&prompt=
    // Axios mengisi dan meng-encode nilai parameter secara otomatis.
    const response = await axios.get(FAA_API, {
        params: {
            url: imageUrl,
            prompt: prompt
        },
        responseType: 'arraybuffer',
        timeout: 120000,
        validateStatus: () => true
    })

    const contentType =
        response.headers['content-type'] || ''

    if (response.status < 200 || response.status >= 300) {
        const message = Buffer
            .from(response.data)
            .toString('utf8')
            .slice(0, 250)

        throw new Error(
            `API Faa HTTP ${response.status}: ${message}`
        )
    }

    const result = await extractImageBuffer(
        Buffer.from(response.data),
        contentType
    )

    if (!Buffer.isBuffer(result) || result.length < 100) {
        throw new Error('Hasil API Faa kosong atau rusak')
    }

    return result
}

// ── HANDLER ─────────────────────────────────────────────────────────────────

async function handler(m, { sock }) {
    const prompt = (m.args || []).join(' ').trim()

    if (!prompt) {
        return m.reply(
            `✨ *ᴇᴅɪᴛ ɪᴍᴀɢᴇ* ✨\n\n` +
            `💕 Haii~ Ai bisa bantu edit gambarmu dengan AI lho!\n\n` +
            `> Kasih tahu Ai mau diapain gambarnya~\n\n` +
            `\`Contoh: ${m.prefix}editimage make it anime style\`\n\n` +
            `> Reply gambar atau kirim gambar dengan caption ya~ 🌟`
        )
    }

    const isImage = Boolean(
        m.isImage || (m.quoted && m.quoted.isImage)
    )

    if (!isImage) {
        return m.reply(
            `✨ *ᴇᴅɪᴛ ɪᴍᴀɢᴇ* ✨\n\n` +
            `💔 Ehh~ Ai tidak lihat gambarnya nih!\n` +
            `> Reply gambar atau kirim gambar dengan caption ya~ 💕`
        )
    }

    if (typeof m.react === 'function') {
        await m.react('🕕')
    }

    try {
        let mediaBuffer

        if (m.isImage && typeof m.download === 'function') {
            mediaBuffer = await m.download()
        } else if (
            m.quoted &&
            m.quoted.isImage &&
            typeof m.quoted.download === 'function'
        ) {
            mediaBuffer = await m.quoted.download()
        }

        if (
            !Buffer.isBuffer(mediaBuffer) ||
            mediaBuffer.length < 100
        ) {
            throw new Error(
                'Gagal mengunduh gambar. Coba kirim ulang.'
            )
        }

        let resultBuffer
        let source = 'Kyzzz'

        // 1. Coba Kyzzz terlebih dahulu.
        try {
            console.log('[editimage] Mencoba Kyzzz...')
            resultBuffer = await editWithKyzzz(mediaBuffer, prompt)
        } catch (kyzzzError) {
            console.log(
                '[editimage] Kyzzz gagal:',
                kyzzzError.message
            )

            // 2. Jika Kyzzz gagal, unggah gambar lalu gunakan API Faa.
            source = 'API Faa'

            const imageUrl = await uploadImage(mediaBuffer)

            console.log('[editimage] Mencoba fallback API Faa...')
            resultBuffer = await editWithFaa(imageUrl, prompt)
        }

        await sock.sendMessage(
            m.chat,
            {
                image: resultBuffer,
                caption:
                    `✨ *DONE!* ✨\n\n` +
                    `💕 Gambarnya sudah Ai edit~\n` +
                    `> Engine: ${source} 🌟`
            },
            { quoted: m }
        )

        if (typeof m.react === 'function') {
            await m.react('✅')
        }
    } catch (error) {
        if (typeof m.react === 'function') {
            await m.react('❌')
        }

        console.error('[editimage] ERROR:', error.stack || error)

        await m.reply(
            `🍀 *Waduuhh~ Ada yang tidak beres nih!*\n\n` +
            `> ${error.message || 'Proses edit gambar gagal.'}\n\n` +
            `💕 Coba lagi nanti ya~ ✨`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}