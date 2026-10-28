const { createCanvas, loadImage } = require('@napi-rs/canvas')
const sharp = require('sharp')

const pluginConfig = {
    name: 'fakedownload',
    alias: ['fakedl', 'fdl', 'belumdownload', 'undownload'],
    category: 'maker',
    description: 'Membuat gambar terlihat seperti media yang belum ter-download di WhatsApp',
    usage: '.fakedownload (reply gambar)',
    example: '.fakedownload',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const MAX_WIDTH = 700
const TINY_SIZE = 10

function formatSize(bytes) {
    const kb = bytes / 1024
    if (kb >= 1024) return (kb / 1024).toFixed(2) + ' MB'
    return Math.round(kb) + ' kB'
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
}

// Ikon download — replika persis Lucide/Feather "download" icon (viewBox 24x24):
// garis vertikal + chevron terbuka (bukan segitiga solid) + tray rounded di bawah
function drawDownloadIcon(ctx, cx, cy, size) {
    const s = size / 24
    const ox = cx - 12 * s
    const oy = cy - 12 * s
    const px = (x, y) => [ox + x * s, oy + y * s]

    ctx.save()
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = size * 0.085
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Garis vertikal (batang panah): (12,3) → (12,15)
    let [x1, y1] = px(12, 3)
    let [x2, y2] = px(12, 15)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()

    // Chevron terbuka (kepala panah): 7,10 → 12,15 → 17,10
    let [ax, ay] = px(7, 10)
    let [bx, by] = px(12, 15)
    let [cxp, cyp] = px(17, 10)
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.lineTo(cxp, cyp)
    ctx.stroke()

    // Tray rounded di bawah: M21 15 v4 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 v-4
    let [tx1, ty1] = px(21, 15)
    let [tx2, ty2] = px(21, 19)
    let [cr1x, cr1y] = px(21, 21)
    let [tx3, ty3] = px(19, 21)
    let [tx4, ty4] = px(5, 21)
    let [cr2x, cr2y] = px(3, 21)
    let [tx5, ty5] = px(3, 19)
    let [tx6, ty6] = px(3, 15)

    ctx.beginPath()
    ctx.moveTo(tx1, ty1)
    ctx.lineTo(tx2, ty2)
    ctx.quadraticCurveTo(cr1x, cr1y, tx3, ty3)
    ctx.lineTo(tx4, ty4)
    ctx.quadraticCurveTo(cr2x, cr2y, tx5, ty5)
    ctx.lineTo(tx6, ty6)
    ctx.stroke()

    ctx.restore()
}

async function handler(m, { sock }) {
    const isImage = m.isImage || (m.quoted && m.quoted.isImage)

    if (!isImage) {
        m.react('❌')
        return m.reply(
            `📥 *ꜰᴀᴋᴇ ᴅᴏᴡɴʟᴏᴀᴅ*\n\n` +
            `> Reply / kirim gambar yang mau dibuat\n` +
            `> kelihatan belum ke-download ya~ 🌸\n\n` +
            `Contoh: \`${m.prefix}fakedownload\` (reply gambar)`
        )
    }

    let imageBuffer
    if (m.isImage && m.download) {
        imageBuffer = await m.download()
    } else if (m.quoted && m.quoted.isImage && m.quoted.download) {
        imageBuffer = await m.quoted.download()
    }

    if (!imageBuffer) {
        m.react('❌')
        return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Nggak bisa download gambarnya nih~`)
    }

    m.react('🕕')

    try {
        const meta = await sharp(imageBuffer).metadata()
        const origW = meta.width || 700
        const origH = meta.height || 700

        // Jaga rasio asli, jangan dipotong/dipaksa kotak
        const scale = Math.min(1, MAX_WIDTH / origW)
        const targetW = Math.max(1, Math.round(origW * scale))
        const targetH = Math.max(1, Math.round(origH * scale))

        // Blur ala WhatsApp "blurhash": downscale ke thumbnail super kecil,
        // lalu upscale halus → hasil blob warna abstrak, bukan blur biasa
        // yang masih nyisain bentuk/garis asli gambar
        const tinyH = Math.max(1, Math.round(TINY_SIZE * (targetH / targetW)))
        const tinyBuffer = await sharp(imageBuffer)
            .resize(TINY_SIZE, tinyH, { fit: 'fill', kernel: 'cubic' })
            .toBuffer()

        const blurredBuffer = await sharp(tinyBuffer)
            .resize(targetW, targetH, { fit: 'fill', kernel: 'cubic' })
            .blur(4)
            .modulate({ brightness: 1.00, saturation: 0.9 })
            .jpeg({ quality: 75 })
            .toBuffer()

        const bgImage = await loadImage(blurredBuffer)

        const canvas = createCanvas(targetW, targetH)
        const ctx = canvas.getContext('2d')

        ctx.drawImage(bgImage, 0, 0, targetW, targetH)

        const cx = targetW / 2
        const cy = targetH / 2

        // ===== Pill capsule: ikon + teks ukuran file sejajar (mirip WhatsApp asli) =====
        const sizeText = formatSize(imageBuffer.length)
        const pillHeight = Math.max(44, Math.min(targetW, targetH) * 0.105)
        const iconBoxSize = pillHeight * 0.52
        const fontSize = Math.max(13, Math.round(pillHeight * 0.32))
        const paddingX = pillHeight * 0.3
        const gap = pillHeight * 0.18

        ctx.font = `500 ${fontSize}px sans-serif`
        const textWidth = ctx.measureText(sizeText).width

        const pillWidth = paddingX * 2 + iconBoxSize + gap + textWidth
        const pillX = cx - pillWidth / 2
        const pillY = cy - pillHeight / 2
        const radius = pillHeight / 2

        // Lapisan 1: backdrop kaca buram (sample background yang udah ada, diblur lagi lebih kuat
        // lalu di-clip ke bentuk pill) → efek frosted-glass, bukan warna solid datar
        ctx.save()
        drawRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, radius)
        ctx.clip()
        ctx.filter = 'blur(12px)'
        ctx.drawImage(bgImage, 0, 0, targetW, targetH)
        ctx.filter = 'none'
        ctx.restore()

        // Lapisan 2: overlay gelap transparan + shadow tipis biar pill "ngambang"
        ctx.save()
        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'
        ctx.shadowBlur = 6
        ctx.shadowOffsetY = 1
        drawRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, radius)
        ctx.fillStyle = 'rgba(12, 13, 16, 0.46)'
        ctx.fill()
        ctx.restore()

        // Lapisan 3: garis tepi tipis (highlight kaca)
        drawRoundedRect(ctx, pillX + 0.5, pillY + 0.5, pillWidth - 1, pillHeight - 1, radius)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
        ctx.lineWidth = 1
        ctx.stroke()

        const iconCx = pillX + paddingX + iconBoxSize / 2
        drawDownloadIcon(ctx, iconCx, cy, iconBoxSize)

        ctx.font = `500 ${fontSize}px sans-serif`
        ctx.fillStyle = '#FFFFFF'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(sizeText, iconCx + iconBoxSize / 2 + gap, cy + 1)
        // ===== End pill capsule =====

        const outputBuffer = canvas.toBuffer('image/jpeg')

        await sock.sendMessage(
            m.chat,
            {
                image: outputBuffer
            },
            { quoted: m }
        )

        m.react('✅')
    } catch (error) {
        console.error('[FakeDownload] Error:', error)
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}