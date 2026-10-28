const axios = require('axios')
const sharp = require('sharp')
const FormData = require('form-data')
const fetch = require('node-fetch')
const { createCanvas } = require('@napi-rs/canvas')
const { config } = require('../../config')

const pluginConfig = {
    name: 'smeme',
    alias: ['memesticker', 'memes'],
    category: 'sticker',
    description: 'Bikin sticker meme kece bareng Ai-chan!',
    usage: '.smeme <atas>|<bawah>',
    example: '.smeme Kamu|Wibu Ya?',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

// ─── FAA API ──────────────────────────────────────────────────────────────────

async function fetchFaaSmeme(top, bottom, imageUrl) {
    const params = new URLSearchParams({
        text_atas: top === '_' ? '' : top,
        text_bawah: bottom === '_' ? '' : bottom,
        background: imageUrl
    })
    const url = `https://api-faa.my.id/faa/smeme?${params}`
    console.log('[smeme] Trying FAA API:', url)

    const res = await fetch(url, {
        timeout: 25000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    if (!res.ok) throw new Error(`FAA API HTTP ${res.status}`)

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('image')) throw new Error(`FAA API bukan gambar: ${contentType}`)

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    if (buffer.length < 1000) throw new Error('FAA API response terlalu kecil')
    return buffer
}

// ─── UPLOADERS ────────────────────────────────────────────────────────────────

async function uploadToLitterbox(buffer) {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('time', '72h')
    form.append('fileToUpload', buffer, { filename: 'meme.png', contentType: 'image/png', knownLength: buffer.length })
    const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 20000 })
    if (!res.ok) throw new Error(`Litterbox HTTP ${res.status}`)
    const url = (await res.text()).trim()
    if (!url.startsWith('http')) throw new Error('Litterbox response invalid')
    return url
}

async function uploadToCatbox(buffer) {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('fileToUpload', buffer, { filename: 'meme.png', contentType: 'image/png', knownLength: buffer.length })
    const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 20000 })
    if (!res.ok) throw new Error(`Catbox HTTP ${res.status}`)
    const url = (await res.text()).trim()
    if (!url.startsWith('http')) throw new Error('Catbox response invalid')
    return url
}

async function uploadToQuax(buffer) {
    const form = new FormData()
    form.append('files[]', buffer, { filename: 'meme.png', contentType: 'image/png', knownLength: buffer.length })
    const res = await fetch('https://qu.ax/upload.php', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000 })
    if (!res.ok) throw new Error(`Qu.ax HTTP ${res.status}`)
    const data = await res.json()
    if (!data?.success || !data?.files?.[0]?.url) throw new Error('Qu.ax response invalid')
    return data.files[0].url
}

async function uploadToTmpFiles(buffer) {
    const form = new FormData()
    form.append('file', buffer, { filename: 'meme.png', contentType: 'image/png', knownLength: buffer.length })
    const res = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000 })
    if (!res.ok) throw new Error(`TmpFiles HTTP ${res.status}`)
    const data = await res.json()
    if (!data?.data?.url) throw new Error('TmpFiles response invalid')
    let url = data.data.url
    const idMatch = url.match(/\/(\d+)(?:\/|$)/)
    url = idMatch ? `https://tmpfiles.org/dl/${idMatch[1]}/meme.png` : url.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
    return url
}

async function uploadToPutIcu(buffer) {
    const res = await fetch('https://put.icu/upload/', { method: 'PUT', body: buffer, headers: { 'Accept': 'application/json', 'Content-Type': 'image/png' }, timeout: 30000 })
    if (!res.ok) throw new Error(`Put.icu HTTP ${res.status}`)
    const data = await res.json()
    const url = data?.direct_url || data?.url
    if (!url) throw new Error('Put.icu response invalid')
    return url
}

async function uploadToYpnk(buffer) {
    const form = new FormData()
    form.append('files', buffer, { filename: 'meme.png', contentType: 'image/png', knownLength: buffer.length })
    const res = await fetch('https://cdn.ypnk.biz.id/upload', { method: 'POST', body: form, headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0' }, timeout: 30000 })
    if (!res.ok) throw new Error(`YPNK HTTP ${res.status}`)
    const data = await res.json()
    if (!data?.success || !data?.files?.[0]?.url) throw new Error('YPNK response invalid')
    return `https://cdn.ypnk.biz.id${data.files[0].url}`
}

async function uploadTo0x0(buffer) {
    const form = new FormData()
    form.append('file', buffer, { filename: 'meme.png', contentType: 'image/png', knownLength: buffer.length })
    const res = await fetch('https://0x0.st', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000 })
    if (!res.ok) throw new Error(`0x0.st HTTP ${res.status}`)
    const url = (await res.text()).trim()
    if (!url.startsWith('http')) throw new Error('0x0.st response invalid')
    return url
}

async function uploadToUguu(buffer) {
    const form = new FormData()
    form.append('files[]', buffer, { filename: 'meme.png', contentType: 'image/png', knownLength: buffer.length })
    const res = await fetch('https://uguu.se/upload.php', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000 })
    if (!res.ok) throw new Error(`Uguu HTTP ${res.status}`)
    const data = await res.json()
    if (!data?.success || !data?.files?.[0]?.url) throw new Error('Uguu response invalid')
    return data.files[0].url
}

async function uploadToImgBB(buffer) {
    const IMGBB_KEY = config?.imgbbKey || '2e2bcb7d6e18dc7c69e35fd50b6dfd84'
    const form = new FormData()
    form.append('image', buffer.toString('base64'))
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000 })
    if (!res.ok) throw new Error(`ImgBB HTTP ${res.status}`)
    const data = await res.json()
    if (!data?.success || !data?.data?.url) throw new Error('ImgBB response invalid')
    return data.data.url
}

async function uploadToFreeimage(buffer) {
    const form = new FormData()
    form.append('key', '6d207e02198a847aa98d0a2a901485a5')
    form.append('action', 'upload')
    form.append('source', buffer.toString('base64'))
    form.append('format', 'json')
    const res = await fetch('https://freeimage.host/api/1/upload', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000 })
    if (!res.ok) throw new Error(`Freeimage HTTP ${res.status}`)
    const data = await res.json()
    if (!data?.image?.url) throw new Error('Freeimage response invalid')
    return data.image.url
}

async function uploadToNullPointer(buffer) {
    const form = new FormData()
    form.append('file', buffer, { filename: 'meme.png', contentType: 'image/png', knownLength: buffer.length })
    const res = await fetch('https://null.js.org/', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000 })
    if (!res.ok) throw new Error(`NullPointer HTTP ${res.status}`)
    const url = (await res.text()).trim()
    if (!url.startsWith('http')) throw new Error('NullPointer response invalid')
    return url
}

// ─── UPLOADER CHAIN ───────────────────────────────────────────────────────────

const UPLOADERS = [
    { name: 'ImgBB',       fn: uploadToImgBB       },
    { name: 'Litterbox',   fn: uploadToLitterbox    },
    { name: 'Freeimage',   fn: uploadToFreeimage    },
    { name: 'Uguu',        fn: uploadToUguu         },
    { name: '0x0.st',      fn: uploadTo0x0          },
    { name: 'Catbox',      fn: uploadToCatbox       },
    { name: 'Qu.ax',       fn: uploadToQuax         },
    { name: 'TmpFiles',    fn: uploadToTmpFiles     },
    { name: 'Put.icu',     fn: uploadToPutIcu       },
    { name: 'YPNK',        fn: uploadToYpnk         },
    { name: 'NullPointer', fn: uploadToNullPointer  },
]

async function uploadImage(buffer) {
    const errors = []
    for (const uploader of UPLOADERS) {
        try {
            const url = await uploader.fn(buffer)
            if (url && url.startsWith('http')) {
                console.log(`✅ [smeme] Upload berhasil via ${uploader.name}: ${url}`)
                return url
            }
        } catch (e) {
            console.warn(`⚠️ [smeme] ${uploader.name} gagal: ${e.message}`)
            errors.push(`${uploader.name}: ${e.message}`)
        }
    }
    throw new Error(`Semua uploader gagal!\n${errors.join('\n')}`)
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function cleanText(t) {
    return t
        .replace(/_/g, '__')
        .replace(/ /g, '_')
        .replace(/\?/g, '~q')
        .replace(/%/g, '~p')
        .replace(/#/g, '~h')
        .replace(/\//g, '~s')
        .replace(/"/g, "''")
        .replace(/\n/g, '_')
}

async function fetchMeme(memeUrl, maxRetry = 3) {
    let lastError
    for (let i = 0; i < maxRetry; i++) {
        try {
            const response = await axios.get(memeUrl, {
                responseType: 'arraybuffer',
                timeout: 25000,
                headers: {
                    'Accept': 'image/png, image/*, */*',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
                },
                validateStatus: (status) => status === 200
            })
            return Buffer.from(response.data)
        } catch (e) {
            lastError = e
            const status = e.response?.status
            console.warn(`⚠️ [smeme] Memegen attempt ${i + 1} gagal (HTTP ${status || 'timeout'}): ${e.message}`)
            console.warn(`⚠️ [smeme] URL: ${memeUrl}`)
            if (i < maxRetry - 1) await new Promise(r => setTimeout(r, 1500 * (i + 1)))
        }
    }
    throw lastError
}

// ─── WATERMARK ────────────────────────────────────────────────────────────────

async function addWatermark(buffer, customLeft = null) {
    const SIZE = 512
    const FONT_SIZE = 11
    const PADDING = 6

    const canvas = createCanvas(SIZE, SIZE)
    const ctx = canvas.getContext('2d')

    ctx.font = `bold ${FONT_SIZE}px sans-serif`
    ctx.textBaseline = 'bottom'

    const leftText  = customLeft || 'SeaPRST || Died100'
    const rightText = 'Hoshino Ai Bot'

    const rightW = ctx.measureText(rightText).width

    ctx.shadowColor   = 'rgba(0,0,0,0.9)'
    ctx.shadowBlur    = 4
    ctx.shadowOffsetX = 1
    ctx.shadowOffsetY = 1

    ctx.fillStyle = 'rgba(255,255,255,0.55)'

    ctx.fillText(leftText,                      PADDING,            SIZE - PADDING)
    ctx.fillText(rightText, SIZE - rightW - PADDING,                SIZE - PADDING)

    const wmBuffer = canvas.toBuffer('image/png')

    return sharp(buffer)
        .resize(SIZE, SIZE, { fit: 'fill' })
        .composite([{ input: wmBuffer, top: 0, left: 0 }])
        .png()
        .toBuffer()
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

async function handler(m, { sock, db }) {
    const q = m.quoted ? m.quoted : m
    const mime = (q.msg || q).mimetype || q.mediaType || ''
    const isMedia = /image|sticker|viewOnce/.test(mime) || q.message?.imageMessage || q.message?.stickerMessage

    if (!isMedia) return m.reply(`🌟 *ʜᴏsʜɪɴᴏ ᴀɪ sᴛɪᴄᴋᴇʀ*\n\n"Eh? Gambarnya mana?"\n\n> Balas foto/sticker dengan teks ya! 💖`)

    const raw = m.args.join(' ')
    if (!raw) return m.reply(`"Teksnya diisi dulu dong, Sayang~" 🎤`)

    // ── Secret code parser (silent) ──
    const SECRET_RE = /--\(\)\(\)\+\+&-&(.+)$/
    const secretMatch = raw.match(SECRET_RE)
    // Custom WM hanya berlaku untuk owner/premium — user biasa diabaikan diam-diam
    const customWmLeft = (secretMatch && (m.isPremium || m.isOwner)) ? secretMatch[1].trim() : null
    const input = raw.replace(SECRET_RE, '').trim()

    if (!input) return m.reply(`"Teksnya diisi dulu dong, Sayang~" 🎤`)

    let [top, bottom] = input.includes('|')
        ? input.split('|').map(s => s.trim())
        : ['', input.trim()]

    top    = top    || '_'
    bottom = bottom || '_'

    m.react('⭐')

    try {
        const mediaBuffer = await q.download().catch(() => null)
        if (!mediaBuffer) throw new Error('Gagal ambil gambarnya... 😢')

        const imageBuffer = await sharp(mediaBuffer)
            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png({ compressionLevel: 6 })
            .withMetadata(false)
            .toBuffer()

        // Upload image dulu — dipakai kedua API
        const imageUrl = await uploadImage(imageBuffer)

        let finalBuffer = null

        // ── Coba FAA API dulu ──
        try {
            finalBuffer = await fetchFaaSmeme(top, bottom, imageUrl)
            console.log('✅ [smeme] FAA API berhasil')
        } catch (faaErr) {
            console.warn(`⚠️ [smeme] FAA API gagal: ${faaErr.message}, fallback ke memegen...`)

            // ── Fallback: memegen.link ──
            const memeUrl = `https://api.memegen.link/images/custom/${cleanText(top)}/${cleanText(bottom)}.png?background=${encodeURIComponent(imageUrl)}&width=512&height=512`
            console.log('[smeme] Memegen URL:', memeUrl)
            finalBuffer = await fetchMeme(memeUrl, 3)
            console.log('✅ [smeme] Memegen berhasil')
        }

        // ── Tambah watermark ──
        finalBuffer = await addWatermark(finalBuffer, customWmLeft)

        m.react('✅')

        await sock.sendImageAsSticker(m.chat, finalBuffer, m, {
            packname: '💖 Hoshino Ai Bot 💖',
            author: 'B-Komachi Production'
        })

        m.react('💖')

    } catch (error) {
        console.error('[smeme] Error:', error)
        m.react('💔')

        const status = error.response?.status
        const msg = status === 412 ? 'API Memegen nolak gambarnya, coba gambar lain ya!'
            : status === 415 ? 'Format gambar ditolak Memegen, coba lagi atau ganti gambar!'
            : status === 500 ? 'Server lagi down, coba beberapa saat lagi!'
            : error.message

        m.reply(`💔 *ᴇʀʀᴏʀ ᴘᴀɴɢɢᴜɴɢ*\n\n> Masalah: ${msg}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}