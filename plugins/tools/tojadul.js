/**
✧ Name    : tojadul
✧ Category: tools
✧ Note    : Efek burik/rekaman jadul — downscale-upscale nearest-neighbor
✧          (biar pecah/blocky) + blur ringan yang di-blend tipis di atasnya.
✧          Pure canvas, gak pakai AI, jadi cepet & gak gantung ke API luar.
**/

const { createCanvas, loadImage } = require('@napi-rs/canvas')

const pluginConfig = {
    name: 'tojadul',
    alias: ['jadul', 'burikjadul', 'oldvhs', 'vintage'],
    category: 'tools',
    description: 'Ubah foto jadi burik/pecah ala rekaman jadul (downscale-upscale + blur ringan)',
    usage: '.tojadul (reply gambar)',
    example: '.tojadul',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 6,
    energi: 1,
    isEnabled: true
}

// Sisi terpendek target buat pass downscale.
// Makin kecil angkanya, makin burik/pecah hasilnya.
const TARGET_RES = 180

// Kekuatan blur (px) yang di-blend di atas hasil burik.
const BLUR_PX = 10

// Seberapa dominan blur itu di-blend ke hasil akhir (0-1).
const BLUR_ALPHA = 0.75

// Kualitas JPEG output — makin rendah, makin nambah artifact blocky-nya juga.
const JPEG_QUALITY = 60

async function applyJadulEffect(buffer) {
    const img = await loadImage(buffer)

    const scale = TARGET_RES / Math.min(img.width, img.height)
    const smallW = Math.round(img.width * scale)
    const smallH = Math.round(img.height * scale)

    // Pass 1: downscale ke resolusi kecil pakai smoothing biasa
    const smallCanvas = createCanvas(smallW, smallH)
    const smallCtx = smallCanvas.getContext('2d')
    smallCtx.imageSmoothingEnabled = true
    smallCtx.drawImage(img, 0, 0, smallW, smallH)

    // Pass 2: scale balik ke ukuran asli TANPA smoothing -> blocky/pecah
    const outCanvas = createCanvas(img.width, img.height)
    const outCtx = outCanvas.getContext('2d')
    outCtx.imageSmoothingEnabled = false
    outCtx.drawImage(smallCanvas, 0, 0, img.width, img.height)

    // Pass 3: blur ringan, di-blend biar kekuatannya bisa dikalibrasi
    const blurCanvas = createCanvas(img.width, img.height)
    const blurCtx = blurCanvas.getContext('2d')
    try {
        blurCtx.filter = `blur(${BLUR_PX}px)`
    } catch (e) {
        // skip kalau ctx.filter gak didukung di build @napi-rs/canvas ini
    }
    blurCtx.drawImage(outCanvas, 0, 0)

    outCtx.globalAlpha = BLUR_ALPHA
    outCtx.drawImage(blurCanvas, 0, 0)
    outCtx.globalAlpha = 1

    return outCanvas.encode('jpeg', JPEG_QUALITY)
}

async function handler(m, { sock }) {
    const quoted = m.quoted
    const isImage = m.isImage || (quoted && (quoted.isImage || quoted.type === 'imageMessage'))

    if (!isImage) {
        return m.reply(
            `📦 *ᴛᴏᴊᴀᴅᴜʟ* 🎤\n\n` +
            `> Ai mau bantu, tapi kirim atau reply fotonya dulu ya~ 💖\n\n` +
            `> ${m.prefix}tojadul (reply gambar)`
        )
    }

    await m.react('🕕')

    try {
        const buffer = (quoted && quoted.isMedia) ? await quoted.download() : await m.download()

        if (!buffer) {
            await m.react('❌')
            return m.reply(`❌ *Ara ara~*\n\n> Ai gagal download gambarnya nih... coba lagi ya~ 🥺`)
        }

        const resultBuffer = await applyJadulEffect(buffer)

        await m.react('✅')
        return sock.sendMessage(m.chat, {
            image: resultBuffer,
            caption: '『』✦ Nih hasilnya, burik-burik jadul gitu~ 「推しの子」💖⭐'
        }, { quoted: m })
    } catch (error) {
        console.error('[tojadul] Error:', error)
        await m.react('❌')
        return m.reply(
            `❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ*\n\n` +
            `> ${error.message}\n\n` +
            `> Coba lagi ya, Ai janji next take bakal lebih bagus~`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}