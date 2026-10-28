const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas')
const sharp = require('sharp')
const FormData = require('form-data')
const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: 'fakewa',
    alias: ['fw', 'fakeprofil'],
    category: 'maker',
    description: 'Bikin profil WhatsApp palsu~',
    usage: '.fakewa nama|bio|nomor',
    example: '.fakewa Hoshino Ai|Idol terbaik!|6281234567890',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 2,
    isEnabled: true
}

// ─── FONT & ASSET LOADER ──────────────────────────────────────────────────────

const FONT_PATH = path.join(__dirname, 'WhatsAppFont.ttf')
const BG_URL    = 'https://uploader.zenzxz.dpdns.org/uploads/1775722039920.png'
const FONT_URL  = 'https://uploader.zenzxz.dpdns.org/uploads/1775659852069.ttf'
const POTONG    = 50

async function getBuffer(url) {
    const res = await fetch(url, { timeout: 20000 })
    if (!res.ok) throw new Error(`Fetch gagal (${res.status}): ${url}`)
    return Buffer.from(await res.arrayBuffer())
}

async function loadAssets() {
    if (!fs.existsSync(FONT_PATH)) {
        const buf = await getBuffer(FONT_URL)
        fs.mkdirSync(path.dirname(FONT_PATH), { recursive: true })
        fs.writeFileSync(FONT_PATH, buf)
    }
    GlobalFonts.registerFromPath(FONT_PATH, 'WhatsApp')
}

function drawCircle(ctx, img, x, y, size) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(img, x, y, size, size)
    ctx.restore()
}

// ─── UPLOADER CHAIN (sama seperti smeme) ─────────────────────────────────────

async function uploadImage(buffer) {
    const uploaders = [
        {
            name: 'ImgBB',
            fn: async (buf) => {
                const { config } = require('../../config')
                const KEY = config?.imgbbKey || '2e2bcb7d6e18dc7c69e35fd50b6dfd84'
                const form = new FormData()
                form.append('image', buf.toString('base64'))
                const res = await fetch(`https://api.imgbb.com/1/upload?key=${KEY}`, { method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000 })
                if (!res.ok) throw new Error(`ImgBB HTTP ${res.status}`)
                const data = await res.json()
                if (!data?.success) throw new Error('ImgBB response invalid')
                return data.data.url
            }
        },
        {
            name: 'Litterbox',
            fn: async (buf) => {
                const form = new FormData()
                form.append('reqtype', 'fileupload')
                form.append('time', '72h')
                form.append('fileToUpload', buf, { filename: 'pp.png', contentType: 'image/png', knownLength: buf.length })
                const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 20000 })
                if (!res.ok) throw new Error(`Litterbox HTTP ${res.status}`)
                const url = (await res.text()).trim()
                if (!url.startsWith('http')) throw new Error('Litterbox invalid')
                return url
            }
        },
        {
            name: 'Catbox',
            fn: async (buf) => {
                const form = new FormData()
                form.append('reqtype', 'fileupload')
                form.append('fileToUpload', buf, { filename: 'pp.png', contentType: 'image/png', knownLength: buf.length })
                const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 20000 })
                if (!res.ok) throw new Error(`Catbox HTTP ${res.status}`)
                const url = (await res.text()).trim()
                if (!url.startsWith('http')) throw new Error('Catbox invalid')
                return url
            }
        },
        {
            name: 'Uguu',
            fn: async (buf) => {
                const form = new FormData()
                form.append('files[]', buf, { filename: 'pp.png', contentType: 'image/png', knownLength: buf.length })
                const res = await fetch('https://uguu.se/upload.php', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000 })
                if (!res.ok) throw new Error(`Uguu HTTP ${res.status}`)
                const data = await res.json()
                if (!data?.success) throw new Error('Uguu invalid')
                return data.files[0].url
            }
        },
    ]

    const errors = []
    for (const up of uploaders) {
        try {
            const url = await up.fn(buffer)
            if (url?.startsWith('http')) {
                console.log(`✅ [fakewa] Upload PP via ${up.name}: ${url}`)
                return url
            }
        } catch (e) {
            console.warn(`⚠️ [fakewa] ${up.name} gagal: ${e.message}`)
            errors.push(`${up.name}: ${e.message}`)
        }
    }
    throw new Error(`Semua uploader gagal!\n${errors.join('\n')}`)
}

// ─── CORE GENERATOR ───────────────────────────────────────────────────────────

async function generateFakeWA({ ppurl, nama, tentang, telepon }) {
    await loadAssets()

    const [bgBuf, ppBuf] = await Promise.all([
        getBuffer(BG_URL),
        getBuffer(ppurl)
    ])

    const bg = await loadImage(bgBuf)
    const pp = await loadImage(ppBuf)

    const canvasHeight = bg.height - POTONG
    const canvas = createCanvas(bg.width, canvasHeight)
    const ctx = canvas.getContext('2d')

    // Crop bagian atas background
    ctx.drawImage(bg, 0, POTONG, bg.width, bg.height - POTONG, 0, 0, bg.width, canvasHeight)

    // Foto profil bulat
    drawCircle(ctx, pp, 360, 200 - POTONG, 360)

    // Teks
    ctx.fillStyle = '#889093'
    ctx.font = '30px WhatsApp'
    ctx.fillText(nama,    157, 870  - POTONG)
    ctx.fillText(tentang, 169, 1030 - POTONG)
    ctx.fillText(telepon, 172, 1190 - POTONG)

    return canvas.toBuffer('image/png')
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

async function handler(m, { sock }) {
    const input = m.args.join(' ')

    if (!input) {
        return m.reply(
            `🌟 *ꜰᴀᴋᴇ ᴡʜᴀᴛsᴀᴘᴘ ᴘʀᴏꜰɪʟ*\n\n` +
            `"Mau bikin profil palsu? Oke Ai bantu~"\n\n` +
            `📌 *Format:*\n` +
            `\`${m.prefix}fakewa nama|bio|nomor\`\n\n` +
            `📌 *Contoh:*\n` +
            `\`${m.prefix}fakewa Hoshino Ai|Idol terbaik!|6281234567890\`\n\n` +
            `> Reply atau kirim gambar untuk PP nya ya~ 💖`
        )
    }

    // Cek media (quoted atau message itu sendiri)
    const q = m.quoted ? m.quoted : m
    const mime = (q.msg || q).mimetype || q.mediaType || ''
    const isMedia = /image|sticker|viewOnce/.test(mime) || q.message?.imageMessage || q.message?.stickerMessage

    if (!isMedia) {
        return m.reply(`"Eh? PP-nya mana?"\n\n> Reply atau kirim gambar dulu ya~ 💖`)
    }

    const parts = input.split('|').map(s => s.trim())
    if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
        return m.reply(
            `❌ Format salah~\n\n` +
            `\`${m.prefix}fakewa nama|bio|nomor\`\n\n` +
            `> Pisah pakai tanda \`|\` ya~`
        )
    }

    const [nama, tentang, telepon] = parts

    m.react('⭐')

    try {
        // Download media PP
        const mediaBuf = await q.download().catch(() => null)
        if (!mediaBuf) throw new Error('Gagal ambil gambar PP nya...')

        // Resize PP jadi square PNG
        const ppBuffer = await sharp(mediaBuf)
            .resize(400, 400, { fit: 'cover' })
            .png()
            .toBuffer()

        // Upload PP ke CDN dulu
        const ppUrl = await uploadImage(ppBuffer)

        // Generate canvas
        const resultBuffer = await generateFakeWA({ ppurl: ppUrl, nama, tentang, telepon })

        m.react('✅')

        await sock.sendMessage(m.chat, { image: resultBuffer, caption: `💖 *ꜰᴀᴋᴇ ᴡᴀ ᴘʀᴏꜰɪʟ*\n\n> ${nama}` }, { quoted: m })

        m.react('💖')

    } catch (error) {
        console.error('[fakewa] Error:', error)
        m.react('💔')
        m.reply(`💔 *ᴇʀʀᴏʀ*\n\n> ${error.message}`)
    }
}

module.exports = { config: pluginConfig, handler }