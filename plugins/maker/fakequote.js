const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas')
const fetch = require('node-fetch')

const FONT_URL = 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Font/CrimsonText-Regular.ttf'
const BG_URL = 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Image/_20260425155846190.jpeg'

const PADDING_RATIO = 0.15
const FOOTER_RATIO = 0.12
const QUOTE_COLOR = '#1a1a1a'
const FONT_SIZE_MAX = 60
const FONT_SIZE_MIN = 20

const pluginConfig = {
    name: 'fakequote',
    alias: ['reminder', 'fq'],
    category: 'maker',
    description: 'Buat fake quote di atas gambar aesthetic',
    usage: '.fakequote <teks> | --seahsnwm=<nama>',
    example: '.fakequote Hidup adalah [pilihan] --seahsnwm=Ruby Hoshino',
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

let fontLoaded = false

async function bufferFromUrl(url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed fetch: ${url}`)
    return Buffer.from(await res.arrayBuffer())
}

async function registerFonts() {
    if (fontLoaded) return
    const font = await bufferFromUrl(FONT_URL)
    GlobalFonts.register(font, 'CrimsonText')
    fontLoaded = true
}

function calcFontSize(ctx, text, maxWidth, maxHeight) {
    const words = text.split(' ')
    for (let size = FONT_SIZE_MAX; size >= FONT_SIZE_MIN; size--) {
        ctx.font = `${size}px CrimsonText`
        const lineHeight = size * 1.35
        let lines = 0
        let currentLine = []
        words.forEach(word => {
            const testLine = [...currentLine, word].join(' ').replace(/[\[\]]/g, '')
            if (ctx.measureText(testLine).width > maxWidth && currentLine.length > 0) {
                lines++
                currentLine = [word]
            } else {
                currentLine.push(word)
            }
        })
        lines++
        if (lines * lineHeight <= maxHeight) return size
    }
    return FONT_SIZE_MIN
}

function drawTextJustified(ctx, text, centerX, centerY, maxWidth, fontSize) {
    const lineHeight = fontSize * 1.35
    const words = text.split(' ')
    let lines = []
    let currentLine = []

    words.forEach(word => {
        const testLine = [...currentLine, word].join(' ').replace(/[\[\]]/g, '')
        if (ctx.measureText(testLine).width > maxWidth && currentLine.length > 0) {
            lines.push(currentLine)
            currentLine = [word]
        } else {
            currentLine.push(word)
        }
    })
    lines.push(currentLine)

    let startY = centerY - ((lines.length - 1) * lineHeight) / 2

    lines.forEach((line, index) => {
        const isLastLine = index === lines.length - 1
        const lineParts = line.map(word => {
            const match = word.match(/^\[(.+?)\]([^\w]*)$/)
            if (match) {
                const highlighted = match[1]
                const trailing = match[2]
                const hlWidth = ctx.measureText(highlighted).width
                const trailWidth = ctx.measureText(trailing).width
                return { content: highlighted, trailing, isHighlight: true, width: hlWidth + trailWidth, hlWidth }
            }
            return { content: word, trailing: '', isHighlight: false, width: ctx.measureText(word).width, hlWidth: 0 }
        })

        const totalWordsWidth = lineParts.reduce((sum, p) => sum + p.width, 0)
        let currentX, spaceWidth

        if (!isLastLine && line.length > 1) {
            spaceWidth = (maxWidth - totalWordsWidth) / (line.length - 1)
            currentX = centerX - maxWidth / 2
        } else {
            const standardSpace = ctx.measureText(' ').width
            spaceWidth = standardSpace
            currentX = centerX - (totalWordsWidth + standardSpace * (line.length - 1)) / 2
        }

        lineParts.forEach(part => {
            if (part.isHighlight) {
                ctx.fillStyle = 'rgba(212, 225, 87, 0.85)'
                ctx.fillRect(currentX, startY - fontSize * 0.45, part.hlWidth, fontSize * 0.95)
            }
            ctx.fillStyle = QUOTE_COLOR
            ctx.textBaseline = 'middle'
            ctx.textAlign = 'left'
            ctx.fillText(part.content, currentX, startY)
            if (part.trailing) ctx.fillText(part.trailing, currentX + part.hlWidth, startY)
            currentX += part.width + spaceWidth
        })

        startY += lineHeight
    })
}

async function handler(m, { sock }) {
    const raw = m.body.split(' ').slice(1).join(' ').trim()

    if (!raw) {
        return m.reply(
            `⭐ *Hoshino Ai Quote Maker*\n\n` +
            `Fufu~ Mau bikin quote cantik? Kasih teksnya ya~\n\n` +
            `*Cara pakai:*\n` +
            `*.fakequote <teks>*\n\n` +
            `Gunakan [kata] untuk highlight kata tertentu!\n` +
            `_Contoh: .fakequote Hidup adalah [pilihan] yang kamu buat_\n\n` +
            `Mau ganti nama di bawah quote?\n` +
            `_Contoh: .fakequote Kebohongan Adalah Cinta --seahsnwm=Ruby Hoshino_\n` +
            `_Maksimal 18 karakter ya~_\n\n` +
            `> "Ai loves you~!" ⭐`
        )
    }

    const wmMatch = raw.match(/--seahsnwm=(.+)$/)
    const rawWm = wmMatch ? wmMatch[1].trim() : 'Hoshino Ai'

    if (rawWm.length > 18) {
        return m.reply(
            `⭐ *Hoshino Ai Quote Maker*\n\n` +
            `Muu~ Nama watermark-nya kepanjangan senpai~\n` +
            `Maksimal 18 karakter termasuk spasi ya!\n\n` +
            `> "Ai loves you~!" ⭐`
        )
    }

    const watermark = rawWm
    const text = raw.replace(/--seahsnwm=.+$/, '').trim()

    if (!text) {
        return m.reply(
            `⭐ *Hoshino Ai Quote Maker*\n\n` +
            `Fufu~ Teksnya kosong senpai~\n` +
            `Jangan lupa kasih teks sebelum --seahsnwm ya!\n\n` +
            `> "Ai loves you~!" ⭐`
        )
    }

    m.react('⭐')

    try {
        await registerFonts()

        const bg = await loadImage(await bufferFromUrl(BG_URL))
        const canvas = createCanvas(bg.width, bg.height)
        const ctx = canvas.getContext('2d')

        ctx.drawImage(bg, 0, 0)

        const padding = canvas.width * PADDING_RATIO
        const footerHeight = canvas.height * FOOTER_RATIO
        const centerX = canvas.width / 2
        const maxWidth = canvas.width - padding * 2
        const quoteAreaTop = padding
        const quoteAreaHeight = canvas.height - footerHeight - quoteAreaTop
        const quoteAreaCenterY = quoteAreaTop + quoteAreaHeight / 2

        const fontSize = calcFontSize(ctx, text, maxWidth, quoteAreaHeight)
        ctx.font = `${fontSize}px CrimsonText`

        drawTextJustified(ctx, text, centerX, quoteAreaCenterY, maxWidth, fontSize)

        ctx.font = `${Math.round(fontSize * 0.5)}px CrimsonText`
        ctx.fillStyle = QUOTE_COLOR
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(watermark, centerX, canvas.height - footerHeight / 2)

        const buffer = await canvas.encode('jpeg')

        m.react('💛')
        await sock.sendMessage(m.chat, {
            image: buffer,
            caption:
                `⭐ *Hoshino Ai Quote*\n\n` +
                `Fufu~ Quote kamu udah jadi~\n` +
                `Semoga kata-katamu sampai ke hati semua orang ya~\n\n` +
                `> _"Ai loves you~!"_ ⭐`
        }, { quoted: m })

    } catch (e) {
        console.log('[fakequote] error:', e.message)
        m.react('❌')
        m.reply(
            `❌ *Hoshino Ai Sedih...*\n\n` +
            `Muu~ Gagal bikin quote nya, senpai...\n` +
            `> ${e.message}`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}