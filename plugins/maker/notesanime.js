const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas')
const fetch = require('node-fetch')

const FONT_URL = 'https://raw.githubusercontent.com/googlefonts/caveat/main/fonts/ttf/Caveat-Regular.ttf'
const BG_URL = 'https://raw.githubusercontent.com/fiturmediafire-beep/Hsn-ai-Tourl/main/uploads/1784474594305-ba412faf.jpg'
const FONT_NAME = 'CaveatHW'

const FONT_SIZE_MAX = 70
const FONT_SIZE_MIN = 22
const LINE_HEIGHT = 1.25

const CENTER_X = 375
const CENTER_Y = 430
const MAX_WIDTH = 495
const MAX_HEIGHT = 335

const ROTATION = (-30 * Math.PI) / 180
const SKEW_X = Math.tan((30 * Math.PI) / 180)

const TEXT_COLOR = '#848484'

const pluginConfig = {
    name: 'notesanime',
    alias: ['na', 'animenote'],
    category: 'maker',
    description: 'Buat quote gaya catatan tulisan tangan di buku notes ala anime',
    usage: '.notesanime <teks>',
    example: '.notesanime The first step is always the hardest',
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
    GlobalFonts.register(font, FONT_NAME)
    fontLoaded = true
}

function breakLongWord(ctx, word, maxWidth) {
    // Pecah kata per karakter kalau satu kata aja udah lebih lebar dari maxWidth
    let parts = []
    let cur = ''
    for (const ch of word) {
        const test = cur + ch
        if (ctx.measureText(test).width > maxWidth && cur.length) {
            parts.push(cur)
            cur = ch
        } else {
            cur = test
        }
    }
    if (cur.length) parts.push(cur)
    return parts
}

function wrapLines(ctx, text, maxWidth) {
    const words = text.split(' ')
    let lines = []
    let cur = []

    for (const word of words) {
        if (ctx.measureText(word).width > maxWidth) {
            // kata ini sendirian aja udah kepanjangan, harus dipecah paksa
            if (cur.length) {
                lines.push(cur.join(' '))
                cur = []
            }
            const chunks = breakLongWord(ctx, word, maxWidth)
            chunks.forEach((chunk, i) => {
                if (i === chunks.length - 1) {
                    cur = [chunk]
                } else {
                    lines.push(chunk)
                }
            })
            continue
        }

        const test = [...cur, word].join(' ')
        if (ctx.measureText(test).width > maxWidth && cur.length) {
            lines.push(cur.join(' '))
            cur = [word]
        } else {
            cur.push(word)
        }
    }

    if (cur.length) lines.push(cur.join(' '))
    return lines
}

function calcFont(ctx, text, maxWidth, maxHeight) {
    for (let size = FONT_SIZE_MAX; size >= FONT_SIZE_MIN; size--) {
        ctx.font = `${size}px ${FONT_NAME}`
        const lines = wrapLines(ctx, text, maxWidth)
        const h = lines.length * size * LINE_HEIGHT
        if (h <= maxHeight) return { size, lines }
    }
    ctx.font = `${FONT_SIZE_MIN}px ${FONT_NAME}`
    return { size: FONT_SIZE_MIN, lines: wrapLines(ctx, text, maxWidth) }
}

async function handler(m, { sock }) {
    const text = m.body.split(' ').slice(1).join(' ').trim()

    if (!text) {
        return m.reply(
            `⭐ *Hoshino Ai Note Quote*\n\n` +
            `Fufu~ Mau nulis apa di buku catatannya senpai?\n\n` +
            `*Cara pakai:*\n` +
            `*.notesanime <teks>*\n\n` +
            `_Contoh: .notesanime The first step is always the hardest_\n\n` +
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

        const result = calcFont(ctx, text, MAX_WIDTH, MAX_HEIGHT)

        ctx.font = `${result.size}px ${FONT_NAME}`
        ctx.fillStyle = TEXT_COLOR
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        ctx.save()
        ctx.translate(CENTER_X, CENTER_Y)
        ctx.rotate(ROTATION)
        ctx.transform(1, 0, SKEW_X, 1, 0, 0)

        const lineHeight = result.size * LINE_HEIGHT
        let y = -((result.lines.length - 1) * lineHeight) / 2

        for (const line of result.lines) {
            ctx.fillText(line, 0, y)
            y += lineHeight
        }

        ctx.restore()

        const buffer = await canvas.encode('jpeg')

        m.react('💛')
        await sock.sendMessage(m.chat, {
            image: buffer,
            caption:
                `⭐ *Hoshino Ai Note Quote*\n\n` +
                `Fufu~ Catatan kamu udah jadi~\n` +
                `Semoga kata-katanya nempel terus di hati ya~\n\n` +
                `> _"Ai loves you~!"_ ⭐`
        }, { quoted: m })

    } catch (e) {
        console.log('[notesanime] error:', e.message)
        m.react('❌')
        m.reply(
            `❌ *Hoshino Ai Sedih...*\n\n` +
            `Muu~ Gagal bikin catatan nya, senpai...\n` +
            `> ${e.message}`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}