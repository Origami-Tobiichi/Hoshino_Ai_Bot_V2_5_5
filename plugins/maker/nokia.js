const hsAsset = require('../../src/lib/assets')
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas')
const fs   = require('fs')
const path = require('path')
const axios = require('axios')

const pluginConfig = {
    name: 'nokia',
    alias: ['nokiachat', 'nokiatext', 'hpjadul', 'oldphone'],
    category: 'maker',
    description: 'Buat teks ala layar HP Nokia jadul',
    usage: '.nokia <teks>',
    example: '.nokia siapapun bisa jadi apapun',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const TEMPLATE_URL  = 'https://files.catbox.moe/kty46c.jpg'
const FONT_FAMILY   = 'NokiaFC22'

const SCREEN = {
    TL:    [186, 395],
    angle: 15.76,
    areaW: 630,
    areaH: 560,
    padX:  25,
    padY:  15,
}

const MAX_CHARS = 500

let _fontRegistered = false
async function ensureFont() {
    if (_fontRegistered) return
    const fontPath = await hsAsset.tryFile('fonts/nokiafc22')
    if (!fontPath) throw new Error('Font Nokia belum diisi di config.assets.fonts.nokiafc22')
    GlobalFonts.registerFromPath(fontPath, FONT_FAMILY)
    _fontRegistered = true
}

async function getTemplate() {
    const fromConfig = await hsAsset.tryBuffer('images/nokia_template')
    if (fromConfig) return fromConfig
    try {
        const { data } = await axios.get(TEMPLATE_URL, { responseType: 'arraybuffer', timeout: 15000 })
        return Buffer.from(data)
    } catch {
        throw new Error('Gagal download template Nokia. Isi URL-nya di config.assets.images.nokia_template')
    }
}

function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ')
    const lines = []
    let current = ''

    for (const word of words) {
        if (ctx.measureText(word).width > maxWidth) {
            if (current) { lines.push(current); current = '' }
            let charLine = ''
            for (const char of word) {
                if (ctx.measureText(charLine + char).width > maxWidth) {
                    lines.push(charLine)
                    charLine = char
                } else {
                    charLine += char
                }
            }
            if (charLine) current = charLine
        } else {
            const test = current ? `${current} ${word}` : word
            if (ctx.measureText(test).width > maxWidth && current) {
                lines.push(current)
                current = word
            } else {
                current = test
            }
        }
    }
    if (current) lines.push(current)
    return lines
}

function calcOptimalFont(ctx, text, areaW, areaH, padX, padY) {
    const maxWidth  = areaW - padX * 2
    const maxHeight = areaH - padY * 2
    const FONT_MAX  = 52
    const FONT_MIN  = 14

    for (let fs = FONT_MAX; fs >= FONT_MIN; fs -= 2) {
        const lh    = Math.floor(fs * 1.5)
        ctx.font    = `bold ${fs}px '${FONT_FAMILY}'`
        const lines = wrapText(ctx, text, maxWidth)
        const totalH = lines.length * lh
        if (totalH <= maxHeight) {
            return { fontSize: fs, lineHeight: lh, lines }
        }
    }

    const lh    = Math.floor(FONT_MIN * 1.5)
    ctx.font    = `bold ${FONT_MIN}px '${FONT_FAMILY}'`
    const lines = wrapText(ctx, text, maxWidth)
    return { fontSize: FONT_MIN, lineHeight: lh, lines }
}

async function renderNokia(text) {
    await ensureFont()

    const templateBuf = await getTemplate()
    const templateImg = await loadImage(templateBuf)

    const W = templateImg.width
    const H = templateImg.height

    const canvas = createCanvas(W, H)
    const ctx    = canvas.getContext('2d')

    ctx.drawImage(templateImg, 0, 0, W, H)

    const { TL, angle, areaW, areaH, padX, padY } = SCREEN

    const { fontSize, lineHeight, lines } = calcOptimalFont(ctx, text, areaW, areaH, padX, padY)

    ctx.font         = `bold ${fontSize}px '${FONT_FAMILY}'`
    ctx.fillStyle    = '#1a1a1a'
    ctx.textBaseline = 'top'
    ctx.textAlign    = 'left'

    ctx.save()
    ctx.translate(TL[0], TL[1])
    ctx.rotate((angle * Math.PI) / 180)

    lines.forEach((line, i) => {
        ctx.fillText(line, padX, padY + i * lineHeight)
    })

    ctx.restore()

    return canvas.toBuffer('image/jpeg', { quality: 90 })
}

async function handler(m, { sock }) {
    const text = m.args.join(' ').trim()

    if (!text) {
        m.react('❌')
        return m.reply(
            `📱 *ɴᴏᴋɪᴀ ᴄʜᴀᴛ* 🌸\n\n` +
            `Nee~ tulis teksnya dulu dong~ ✨\n\n` +
            `> Contoh: \`${m.prefix}nokia siapapun bisa jadi apapun\``
        )
    }

    if (text.length > MAX_CHARS) {
        m.react('❌')
        return m.reply(
            `Muu~ teksnya kepanjangan nih~ 🌸\n\n` +
            `> Maksimal *${MAX_CHARS} karakter* ya~\n` +
            `> Teks kamu: *${text.length} karakter*\n\n` +
            `_Layar Nokia kecil lho, nggak muat kalau kepanjangan~ 📱_`
        )
    }

    m.react('🕕')

    try {
        const resultBuf = await renderNokia(text)
        await sock.sendMessage(
            m.chat,
            { image: resultBuf, caption: `📱 *ɴᴏᴋɪᴀ ᴄʜᴀᴛ* 🌸` },
            { quoted: m }
        )
        m.react('✅')
    } catch (err) {
        console.error('[Nokia] Error:', err)
        m.react('❌')
        m.reply(
            `Muu~ gagal bikin Nokia chat nih~ 🌸\n\n` +
            `> ${err.message}`
        )
    }
}

module.exports = { config: pluginConfig, handler }