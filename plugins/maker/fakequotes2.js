const hsAsset = require('../../src/lib/assets')
const axios = require('axios')
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas')
const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: ['fakequotes2'],
    alias: ['fq2', 'quoteschat2'],
    category: 'maker',
    description: 'Buat gambar quotes chat keren',
    usage: '.fakequotes2 <teks quotes>',
    example: '.fakequotes2 jangan terlalu sibuk mengejar dunia sampai sholat 5 waktu ditinggalin',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

// Template & font diambil dari config.assets.fakequotes2 (kalau kosong, pakai URL bawaan di bawah)
let BG_LOCAL = null
const TMP_DIR = path.join(process.cwd(), 'tmp')

const BG_URL = 'https://raw.githubusercontent.com/ryyntwx/allimagerin/refs/heads/main/qc.png'

const INTER_FONTS = [
    { url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2', key: 'fakequotes2/Inter-Regular' },
    { url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2', key: 'fakequotes2/Inter-Medium' },
    { url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2', key: 'fakequotes2/Inter-SemiBold' },
]

let assetsReady = false

async function ensureAssets() {
    if (assetsReady) return
    fs.mkdirSync(TMP_DIR, { recursive: true })

    BG_LOCAL = await hsAsset.file('fakequotes2/qc', BG_URL)

    for (const f of INTER_FONTS) {
        const dest = await hsAsset.file(f.key, f.url)
        GlobalFonts.registerFromPath(dest, 'Inter')
    }

    assetsReady = true
}

function wrapByWords(text, wordsPerLine = 3) {
    const words = text.replace(/\s+/g, ' ').trim().split(' ')
    const lines = []
    for (let i = 0; i < words.length; i += wordsPerLine) {
        const line = words.slice(i, i + wordsPerLine).join(' ')
        if (line) lines.push(line)
    }
    return lines
}

async function render(text, outputPath) {
    await ensureAssets()

    const BG_W = 1080
    const BG_H = 2280
    const fontSize = 55
    const lineGap = 5
    const centerX = 443
    const centerY = 1192

    const canvas = createCanvas(BG_W, BG_H)
    const ctx = canvas.getContext('2d')

    const bgImg = await loadImage(BG_LOCAL)
    ctx.drawImage(bgImg, 0, 0, BG_W, BG_H)

    const textLines = wrapByWords(text, 3)
    const lineHeight = fontSize + lineGap
    const totalTextHeight = textLines.length * lineHeight

    ctx.font = `600 ${fontSize}px Inter`
    ctx.fillStyle = '#111111'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.save()
    ctx.translate(centerX, centerY)

    const startY = 0 - (totalTextHeight / 2) + (fontSize / 2)
    for (let i = 0; i < textLines.length; i++) {
        ctx.fillText(textLines[i], 0, startY + (i * lineHeight))
    }

    ctx.restore()

    fs.writeFileSync(outputPath, await canvas.encode('png'))
}

async function handler(m, { sock }) {
    const text = m.args.join(' ').trim()

    if (!text) {
        m.react('❌')
        return m.reply(
            `『 🌸 *ꜰᴀᴋᴇ ǫᴜᴏᴛᴇs* 🌸 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `✨ *Cara pakai:*\n` +
            `\`${m.prefix}fakequotes2 <teks quotes>\`\n\n` +
            `💫 *Contoh:*\n` +
            `\`${m.prefix}fakequotes2 jangan terlalu sibuk mengejar dunia sampai sholat 5 waktu ditinggalin\`\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `> 💖 Ai siap buatin quotes keren buat kamu~ 🌸`
        )
    }

    m.react('⭐')

    const outPath = path.join(TMP_DIR, `fakequotes2-${Date.now()}.png`)

    try {
        await render(text, outPath)

        await sock.sendMessage(
            m.chat,
            {
                image: { url: outPath },
                caption:
                    `『 🌟 *ʜᴏsʜɪɴᴏ ᴀɪ* — ꜰᴀᴋᴇ ǫᴜᴏᴛᴇs 🌟 』\n` +
                    `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
                    `💬 *"${text}"*\n\n` +
                    `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
                    `🌸 *Hoshino Ai Bot* ✨\n` +
                    `> 「 *推しの子* 」\n` +
                    `> Semoga quotes-nya menginspirasi~ 💖⭐`
            },
            { quoted: m }
        )

        m.react('✅')

    } catch (err) {
        console.error('[FakeQuotes2] Error:', err)
        m.react('❌')
        m.reply(
            `『 💥 *E R R O R* 』\n\n` +
            `> ${err?.message || err?.toString() || 'Unknown error'}\n\n` +
            `> 💔 Maaf ya~ Ai gagal kali ini...\n` +
            `> Coba lagi nanti ya~ 🌸`
        )
    } finally {
        if (fs.existsSync(outPath)) {
            try { fs.unlinkSync(outPath) } catch {}
        }
    }
}

module.exports = {
    config: pluginConfig,
    handler
}