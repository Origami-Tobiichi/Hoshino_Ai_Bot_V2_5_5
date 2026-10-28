const hsAsset = require('../../src/lib/assets')
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas')
const fs   = require('fs')
const path = require('path')
const https = require('https')
const http  = require('http')

const pluginConfig = {
    name: 'ttchat',
    alias: ['ttqc', 'tiktokchat'],
    category: 'maker',
    description: 'Buat gambar chat TikTok (reply teks atau .ttchat Username|Teks)',
    usage: '.ttchat Username|Teks  atau  reply pesan → .ttchat Username',
    example: '.ttchat Hoshino Ai|Ai sayang semua orang~ ★',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

// Template & font diambil dari config.assets.ttqc (kalau kosong, pakai URL bawaan di bawah)
let TEMPLATE_PATH = null
const TEMPLATE_URL  = 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/qyzwa.png'
const TMP_DIR       = path.join(process.cwd(), 'tmp')
const DEFAULT_AVATAR = 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/6b71d84a580f385bd7ee36402df5341ead4770a0/Image/artworks-gWLRE6HyPH3DgVMG-ZFFxtg-t500x500.jpg'

const FONT_ASSETS = [
    { key: 'ttqc/PlusJakartaSans-Regular', url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/PlusJakartaSans-Regular.ttf', family: 'Plus Jakarta Sans' },
    { key: 'ttqc/PlusJakartaSans-Medium',  url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/PlusJakartaSans-Medium.ttf',  family: 'Plus Jakarta Sans' },
    { key: 'ttqc/PlusJakartaSans-Bold',    url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/PlusJakartaSans-Bold.ttf',    family: 'Plus Jakarta Sans' },
    { key: 'ttqc/fa-solid-900',            url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/fa-solid-900.ttf',            family: 'Font Awesome 6 Free' },
    { key: 'ttqc/NotoColorEmoji',          url: 'https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf',                    family: 'Noto Color Emoji' }
]

const MENU_ICONS = [
    { unicode: '\uf3e5', text: 'Balas',             color: '#000000' },
    { unicode: '\uf064', text: 'Teruskan',           color: '#000000' },
    { unicode: '\uf0c5', text: 'Salin',              color: '#000000' },
    { unicode: '\uf1ab', text: 'Terjemahkan',        color: '#000000' },
    { unicode: '\uf2ed', text: 'Hapus untuk saya',   color: '#000000' },
    { unicode: '\uf024', text: 'Laporkan',           color: '#ea4335' }
]

const cfg = {
    topPPX: 183, topPPY: 83, topPPRadius: 42,
    topNameX: 250, topNameY: 82, topNameSize: 34,
    chatPPX: 75, chatPPRadius: 38,
    textX: 175, textY: 962,
    bubbleWidth: 520, textSize: 30,
    bubbleBgColor: '#ffffff', textColor: '#161823'
}

function fetchBuffer(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http
        client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return fetchBuffer(res.headers.location).then(resolve).catch(reject)
            }
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} → ${url}`))
            const chunks = []
            res.on('data', c => chunks.push(c))
            res.on('end', () => resolve(Buffer.concat(chunks)))
            res.on('error', reject)
        }).on('error', reject)
    })
}

let assetsReady = false

async function ensureAssets() {
    if (assetsReady) return
    TEMPLATE_PATH = await hsAsset.file('ttqc/template', TEMPLATE_URL)

    for (const font of FONT_ASSETS) {
        const dest = await hsAsset.file(font.key, font.url)
        GlobalFonts.registerFromPath(dest, font.family)
    }
    assetsReady = true
}

async function loadImageSmart(src) {
    if (typeof src === 'string' && (src.startsWith('http://') || src.startsWith('https://'))) {
        return loadImage(await fetchBuffer(src))
    }
    return loadImage(src)
}

function wrapText(ctx, text, maxWidth) {
    const words = text.split(/(\s+)/)
    const lines = []
    let currentLine = ''

    for (const word of words) {
        if (!word) continue
        if (word.trim() === '' && currentLine === '') continue
        const testLine = currentLine + word
        if (ctx.measureText(testLine).width > maxWidth) {
            if (currentLine !== '') {
                lines.push(currentLine.trimEnd())
                currentLine = word.trimStart()
            } else {
                lines.push(testLine)
                currentLine = ''
            }
        } else {
            currentLine = testLine
        }
    }
    if (currentLine.trim()) lines.push(currentLine.trimEnd())
    return lines
}

function drawRoundedRect(ctx, x, y, w, h, r, fill, stroke = null, shadow = false) {
    ctx.save()
    if (shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.05)'
        ctx.shadowBlur = 40
        ctx.shadowOffsetY = 12
    }
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
    ctx.fill()
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke() }
    ctx.restore()
}

function drawCircleImage(ctx, img, cx, cy, r) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2)
    ctx.restore()
}

async function render(username, chatText, avatarSrc, outputPath) {
    await ensureAssets()

    const USERNAME  = username  || 'TikTok User'
    const CHAT_TEXT = chatText  || 'Hey~ 😊'
    const AVATAR_SRC = avatarSrc || DEFAULT_AVATAR

    fs.mkdirSync(TMP_DIR, { recursive: true })
    const OUT = outputPath || path.join(TMP_DIR, `ttqc-${Date.now()}.png`)

    const templateImage = await loadImage(TEMPLATE_PATH)
    const avatarImage   = await loadImageSmart(AVATAR_SRC)

    const canvas = createCanvas(1080 * 2, 2280 * 2)
    const ctx = canvas.getContext('2d')

    ctx.scale(2, 2)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    ctx.clearRect(0, 0, 1080, 2280)
    ctx.drawImage(templateImage, 0, 0, 1080, 2280)

    drawCircleImage(ctx, avatarImage, cfg.topPPX, cfg.topPPY, cfg.topPPRadius)

    ctx.font = `bold ${cfg.topNameSize}px 'Plus Jakarta Sans', 'Noto Color Emoji'`
    ctx.fillStyle = '#000000'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(USERNAME, cfg.topNameX, cfg.topNameY)

    ctx.font = `500 ${cfg.textSize}px 'Plus Jakarta Sans', 'Noto Color Emoji'`

    const lines = wrapText(ctx, CHAT_TEXT, cfg.bubbleWidth - 52)
    const lineH = cfg.textSize * 1.45

    let maxW = 0
    for (const l of lines) {
        const w = ctx.measureText(l).width
        if (w > maxW) maxW = w
    }

    const padX = 30, padY = 24
    const bubbleW = Math.max(maxW + padX * 2, 180)
    const bubbleH = lines.length * lineH + padY * 2
    const bubbleX = cfg.textX - padX
    const bubbleY = cfg.textY - padY

    drawCircleImage(ctx, avatarImage, cfg.chatPPX, bubbleY + bubbleH / 2, cfg.chatPPRadius)

    drawRoundedRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 35, cfg.bubbleBgColor)

    ctx.fillStyle = cfg.textColor
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    lines.forEach((line, i) => {
        const lineY = cfg.textY + i * lineH + cfg.textSize / 2
        ctx.fillText(line, cfg.textX, lineY)
    })

    const menuX = 90, menuY = bubbleY + bubbleH + 28
    drawRoundedRect(ctx, menuX, menuY, 565, 580, 40, '#ffffff', 'rgba(0,0,0,0.02)', true)

    const itemH = 90, iconX = menuX + 60, labelX = menuX + 130
    MENU_ICONS.forEach((item, i) => {
        const cy = menuY + 25 + i * itemH + itemH / 2
        ctx.fillStyle = item.color
        ctx.font = `900 34px 'Font Awesome 6 Free'`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(item.unicode, iconX, cy)
        ctx.font = `500 34px 'Plus Jakarta Sans'`
        ctx.textAlign = 'left'
        ctx.fillText(item.text, labelX, cy)
    })

    const pngData = await canvas.encode('png')
    fs.writeFileSync(OUT, pngData)
    return OUT
}

async function handler(m, { sock }) {
    let username, chatText

    if (m.quoted) {

        chatText = m.quoted.body?.trim()
        if (!chatText) {
            m.react('❌')
            return m.reply(
                `❌ Pesan yang di-reply tidak ada teksnya~\n\n` +
                `> Reply pesan teks, bukan media ya 🌸`
            )
        }
        username = (m.args.join(' ').trim()) ||
                   (m.quoted.sender?.split('@')[0]) ||
                   'TikTok User'
    } else {

        const rawText = m.args.join(' ').trim()
        if (!rawText || !rawText.includes('|')) {
            m.react('❌')
            return m.reply(
                `❌ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
                `*Mode 1 (manual):*\n` +
                `\`${m.prefix}ttchat Username|Teks chat\`\n\n` +
                `*Mode 2 (reply):*\n` +
                `Reply pesan teks lalu kirim:\n` +
                `\`${m.prefix}ttchat Username\` _(nama opsional)_\n\n` +
                `> _Contoh: \`${m.prefix}ttchat Hoshino Ai|Ai sayang semua orang~ ★\`_ 🌸`
            )
        }
        const pipeIdx = rawText.indexOf('|')
        username = rawText.slice(0, pipeIdx).trim()
        chatText = rawText.slice(pipeIdx + 1).trim()
    }

    if (!username || !chatText) {
        m.react('❌')
        return m.reply(`❌ Username dan teks chat tidak boleh kosong~ 🌸`)
    }

    const targetJid = m.quoted ? m.quoted.sender : m.sender
    let avatarUrl = DEFAULT_AVATAR
    try {
        avatarUrl = await sock.profilePictureUrl(targetJid, 'image')
    } catch {}

    m.react('🕕')

    const outPath = path.join(TMP_DIR, `ttqc-${Date.now()}.png`)

    try {
        await render(username, chatText, avatarUrl, outPath)

        await sock.sendMessage(
            m.chat,
            { image: { url: outPath }, caption: `🎬 *${username}*` },
            { quoted: m }
        )

        m.react('✅')
    } catch (err) {
        console.error('[ttchat] Error:', err)
        m.react('❌')
        m.reply(
            `❌ *ᴇʀʀᴏʀ*\n\n` +
            `> ${err?.message || 'Unknown error'}`
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