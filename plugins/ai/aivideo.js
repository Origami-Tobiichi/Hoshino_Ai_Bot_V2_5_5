const axios = require('axios')
const FormData = require('form-data')

const pluginConfig = {
    name: 'aivideo',
    alias: ['freevideo', 'genvideo'],
    category: 'ai',
    description: 'Generate AI video dari prompt atau gambar',
    usage: '.aivideo <prompt>',
    example: '.aivideo anime girl walking in rain',
    isOwner: false,
    isPremium: true,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 10,
    isEnabled: true
}

// =======================
// API CONFIG
// =======================
const freevideo = {
    api: {
        base: 'https://www.freeaivideos.org',
        endpoint: {
            generate: '/api/video_generation',
            request: (id) => `?request_id=${id}&prompt=`
        }
    },

    headers: {
        'user-agent': 'NB Android/1.0.0',
        'origin': 'https://www.freeaivideos.org',
        'referer': 'https://www.freeaivideos.org/',
        'accept': '*/*'
    },

    async loadImage(input) {
        if (!input) {
            return {
                ok: true,
                buffer: null,
                mime: null
            }
        }

        if (Buffer.isBuffer(input)) {
            return {
                ok: true,
                buffer: input,
                mime: 'image/jpeg'
            }
        }

        if (typeof input === 'string' && /^https?:\/\//i.test(input)) {
            try {
                const res = await axios.get(input, {
                    responseType: 'arraybuffer'
                })

                return {
                    ok: true,
                    buffer: Buffer.from(res.data),
                    mime: res.headers['content-type'] || 'image/jpeg'
                }
            } catch {
                return {
                    ok: false,
                    error: 'URL gambar tidak valid'
                }
            }
        }

        return {
            ok: false,
            error: 'Input gambar tidak valid'
        }
    },

    async generate({ prompt, image = null }) {
        if (!prompt && !image) {
            return {
                success: false,
                error: 'Prompt atau gambar diperlukan'
            }
        }

        const img = await this.loadImage(image)

        if (!img.ok) {
            return {
                success: false,
                error: img.error
            }
        }

        const form = new FormData()

        form.append('prompt', prompt || '')

        if (img.buffer) {
            form.append('initialFrame', img.buffer, {
                filename: 'image.jpg',
                contentType: img.mime
            })
        }

        try {
            const res = await axios.post(
                `${this.api.base}${this.api.endpoint.generate}`,
                form,
                {
                    headers: {
                        ...this.headers,
                        ...form.getHeaders()
                    },
                    timeout: 60000
                }
            )

            const requestId = res.data?.request_id

            if (!requestId) {
                return {
                    success: false,
                    error: 'Gagal mendapatkan request ID'
                }
            }

            return {
                success: true,
                request_id: requestId
            }

        } catch (err) {
            return {
                success: false,
                error:
                    err.response?.data?.error ||
                    err.message ||
                    'Terjadi kesalahan'
            }
        }
    },

    async poll(requestId, timeoutMs = 10 * 60 * 1000) {
        const query = this.api.endpoint.request(requestId)
        const url = `${this.api.base}${this.api.endpoint.generate}${query}`

        const startTime = Date.now()
        const interval = 3000

        return new Promise((resolve) => {

            const loop = async () => {

                if (Date.now() - startTime >= timeoutMs) {
                    return resolve({
                        success: false,
                        error: 'Timeout: Video generation terlalu lama'
                    })
                }

                try {
                    const res = await axios.get(url, {
                        headers: this.headers
                    })

                    const data = res.data || {}

                    console.log(
                        '[AIVIDEO POLL]',
                        JSON.stringify(data, null, 2)
                    )

                    if (data.video_url) {
                        console.log('[AIVIDEO FINAL DATA]', {
                            requestId,
                            video_url: data.video_url,
                            frame_url: data.frame_url,
                            frame_url_icon: data.frame_url_icon
                        })

                        // =========================
                        // JEDA PROPAGASI
                        // API sudah menandai job selesai (video_url ada),
                        // tapi file-nya sering belum ke-propagate ke
                        // storage/CDN. Kasih jeda dulu sebelum resolve
                        // supaya downloadVideo tidak langsung kena 404/JSON.
                        // =========================
                        console.log('[AIVIDEO POLL] video_url didapat, menunggu propagasi file selama 8 detik...')
                        await new Promise(r => setTimeout(r, 8000))

                        return resolve({
                            success: true,
                            data
                        })
                    }

                } catch {}

                setTimeout(loop, interval)
            }

            loop()
        })
    },

    async downloadVideo(url, maxRetry = 15) {
        for (let attempt = 1; attempt <= maxRetry; attempt++) {

            try {
                console.log(
                    `[AIVIDEO DOWNLOAD] Percobaan ${attempt}/${maxRetry}`
                )

                const res = await axios.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 120000,
                    maxContentLength: 100 * 1024 * 1024,
                    maxBodyLength: 100 * 1024 * 1024,
                    headers: {
                        ...this.headers,
                        accept: 'video/webm,video/mp4,video/*,*/*'
                    },
                    validateStatus: () => true
                })

                const buffer = Buffer.from(res.data)

                const contentType = String(
                    res.headers['content-type'] || ''
                ).toLowerCase()

                console.log('[AIVIDEO DOWNLOAD]', {
                    attempt,
                    status: res.status,
                    contentType,
                    size: buffer.length
                })

                // =========================
                // FILE BELUM TERSEDIA
                // =========================
                if (
                    res.status === 404 ||
                    contentType.includes('application/json')
                ) {
                    let message = ''

                    try {
                        const json = JSON.parse(
                            buffer.toString('utf8')
                        )

                        message =
                            json?.detail ||
                            json?.error ||
                            json?.message ||
                            ''
                    } catch {}

                    console.log(
                        `[AIVIDEO] File belum tersedia: ${message || 'unknown'}`
                    )

                    if (attempt < maxRetry) {
                        // interval retry dinaikkan ke 8 detik supaya
                        // total window toleransi lebih panjang
                        await new Promise(resolve =>
                            setTimeout(resolve, 8000)
                        )

                        continue
                    }

                    return {
                        success: false,
                        error:
                            message ||
                            'File video tidak ditemukan di server'
                    }
                }

                // =========================
                // HTTP ERROR
                // =========================
                if (res.status < 200 || res.status >= 300) {
                    throw new Error(
                        `HTTP ${res.status}`
                    )
                }

                if (!buffer.length) {
                    throw new Error('File video kosong')
                }

                // =========================
                // DETEKSI FORMAT
                // =========================

                const isWebm =
                    buffer.length >= 4 &&
                    buffer[0] === 0x1A &&
                    buffer[1] === 0x45 &&
                    buffer[2] === 0xDF &&
                    buffer[3] === 0xA3

                const isMp4 =
                    buffer.length >= 12 &&
                    buffer.toString('ascii', 4, 8) === 'ftyp'

                if (
                    !contentType.includes('video') &&
                    !contentType.includes('octet-stream') &&
                    !isWebm &&
                    !isMp4
                ) {
                    throw new Error(
                        `File bukan video. Content-Type: ${contentType || 'unknown'}`
                    )
                }

                return {
                    success: true,
                    buffer,
                    mimetype: isWebm
                        ? 'video/webm'
                        : 'video/mp4'
                }

            } catch (err) {

                console.error(
                    `[AIVIDEO DOWNLOAD ERROR] Percobaan ${attempt}:`,
                    err.message
                )

                if (attempt < maxRetry) {
                    await new Promise(resolve =>
                        setTimeout(resolve, 8000)
                    )

                    continue
                }

                return {
                    success: false,
                    error:
                        err.message ||
                        'Gagal download video'
                }
            }
        }

        return {
            success: false,
            error: 'Gagal mengambil video'
        }
    }
}

// =======================
// HANDLER
// =======================
async function handler(m, { sock }) {

    // =======================
    // FIX TEXT FRAMEWORK
    // =======================
    const rawText = m.text || ''

    const prefix =
        m.prefix ||
        global.prefix ||
        '.'

    const allCmd = [
        pluginConfig.name,
        ...(pluginConfig.alias || [])
    ]

    let text = rawText

    for (const cmd of allCmd) {

        const regex = new RegExp(
            `^\\${prefix}${cmd}`,
            'i'
        )

        if (regex.test(rawText)) {
            text = rawText
                .replace(regex, '')
                .trim()

            break
        }
    }

    const q = m.quoted || m
    const mime = (q.msg || q).mimetype || ''

    // =======================
    // VALIDASI INPUT
    // =======================
    if (!text && !mime.startsWith('image/')) {
        return m.reply(
`🎬 *AI VIDEO GENERATOR*

Kyaa~ Ai bakal bikinin video AI dari prompt atau gambarmu! Kasih tahu Ai maunya apa ya~ 🌸

📌 *Contoh Penggunaan:*
• ${prefix}${pluginConfig.name} anime girl dancing
• ${prefix}${pluginConfig.name} cinematic city at night
• ${prefix}${pluginConfig.name} cyberpunk japan
• Reply gambar + ${prefix}${pluginConfig.name} make it animated

🖼️ *Mode Tersedia:*
• Text → Generate video dari prompt
• Image → Animate gambar
• Image + Text → Animate dengan style custom`
        )
    }

    // =======================
    // DOWNLOAD IMAGE
    // =======================
    let imageBuffer = null

    if (mime.startsWith('image/')) {
        try {
            imageBuffer = await q.download()
        } catch {
            return m.reply('❌ *Ara ara~*\n\n> Ai gagal download gambarnya nih... coba lagi ya~ 🥺')
        }
    }

    const prompt = text || 'animate this image'

    m.react('🎬')

    // =======================
    // LOADING
    // =======================
    const msg = await m.reply(
`🎬 *AI VIDEO GENERATOR*

📝 *Prompt:*
> ${prompt}

${imageBuffer ? '🖼️ *Mode:* Image Animation\n' : ''}⏳ Ai lagi kirim request video-nya~ tunggu ya! ✨`
    )

    // =======================
    // GENERATE
    // =======================
    const generateResult = await freevideo.generate({
        prompt,
        image: imageBuffer
    })

    if (!generateResult.success) {
        m.react('❌')
        return m.reply(`❌ *Gomen ne~* ✦\n\n> ${generateResult.error}\n\n_Coba lagi nanti ya~ 🌸_`)
    }

    // =======================
    // UPDATE STATUS
    // =======================
    await sock.sendMessage(m.chat, {
        text:
`🎬 *AI VIDEO GENERATOR*

📝 *Prompt:*
> ${prompt}

${imageBuffer ? '🖼️ Initial Frame: Yes\n' : ''}🆔 *Request ID:*
> ${generateResult.request_id}

⏳ Ai lagi bikin videonya~
⏱️ Estimasi: 5 - 10 menit

_Sabar ya, hasilnya pasti bersinar! 🌸_`,
        edit: msg.key
    }).catch(() => {})

    // =======================
    // POLLING
    // =======================
    const result = await freevideo.poll(
        generateResult.request_id
    )

    if (!result.success) {
        m.react('❌')
        return m.reply(`❌ *Gomen ne~* ✦\n\n> ${result.error}\n\n_Coba lagi nanti ya~ 🌸_`)
    }

    // =======================
    // SUCCESS
    // =======================

    m.react('⬇️')

    const videoFile = await freevideo.downloadVideo(
        result.data.video_url
    )

    if (!videoFile.success) {
        m.react('❌')

        return m.reply(
`❌ *Ara ara~*

> Ai gagal ngambil file videonya nih...
> ${videoFile.error}

_Coba lagi nanti ya~ 🥺_`
        )
    }

    console.log(
        '[AIVIDEO] Video size:',
        videoFile.buffer.length,
        'bytes'
    )

    m.react('✅')

    const caption =
`🎬 *ᴠɪᴅᴇᴏ ᴀɪ sᴇʟᴇsᴀɪ* 🌸

✨ Sugoi~! Video AI-nya udah jadi, Ai bangga banget! ⭐

📝 *Prompt:*
> ${prompt}

${imageBuffer ? '🖼️ *Initial Frame:* Yes\n' : ''}💖 Powered By FreeAIVideos`

    await sock.sendMessage(
        m.chat,
        {
            video: videoFile.buffer,
            mimetype: videoFile.mimetype,
            fileName: `aivideo-${generateResult.request_id}.${videoFile.mimetype === 'video/webm' ? 'webm' : 'mp4'}`,
            caption
        },
        {
            quoted: m
        }
    )
}

module.exports = {
    config: pluginConfig,
    handler
}