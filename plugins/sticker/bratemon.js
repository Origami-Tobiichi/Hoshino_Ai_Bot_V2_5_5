const { createCanvas, loadImage } = require('@napi-rs/canvas')
const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: 'bratemon',
    alias: ['bratemontext'],
    category: 'sticker',
    description: 'Membuat sticker Doraemon dengan teks di papan',
    usage: '.bratemon <text>',
    example: '.bratemon Hai semua',
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

function getWrappedLines(ctx, text, maxWidth) {
    const words = text.split(' ')
    const lines = []
    let currentLine = ''

    for (const word of words) {
        if (ctx.measureText(word).width > maxWidth) {
            if (currentLine) { lines.push(currentLine); currentLine = '' }
            let charLine = ''
            for (const char of word) {
                if (ctx.measureText(charLine + char).width > maxWidth) {
                    lines.push(charLine)
                    charLine = char
                } else {
                    charLine += char
                }
            }
            if (charLine) currentLine = charLine
        } else {
            const test = currentLine ? `${currentLine} ${word}` : word
            if (ctx.measureText(test).width > maxWidth && currentLine) {
                lines.push(currentLine)
                currentLine = word
            } else {
                currentLine = test
            }
        }
    }
    if (currentLine) lines.push(currentLine)
    return lines
}

async function handler(m, { sock }) {
    const text = m.args.join(' ')
    if (!text) {
        return m.reply(`🤖 *ʙʀᴀᴛᴇᴍᴏɴ sᴛɪᴄᴋᴇʀ*\n\n> Masukkan teks\n\n\`Contoh: ${m.prefix}bratemon Hai semua\``)
    }

    m.react('🕕')

    try {
        const bgUrl = 'https://files.catbox.moe/22usaw.jpg'
        const response = await axios.get(bgUrl, { responseType: 'arraybuffer' })
        const bgImage = await loadImage(Buffer.from(response.data))

        const canvas = createCanvas(bgImage.width, bgImage.height)
        const ctx = canvas.getContext('2d')

        ctx.drawImage(bgImage, 0, 0)

        // Koordinat papan putih (720x403)
        const boardX = 55
        const boardY = 35
        const boardW = 610
        const boardH = 148

        const padding = 15
        const textAreaW = boardW - padding * 2  // 580
        const textAreaH = boardH - padding * 2  // 118

        // Cari font size terbesar yang muat
        let fontSize = 64
        let lines = []

        while (fontSize >= 10) {
            ctx.font = `bold ${fontSize}px Arial`
            lines = getWrappedLines(ctx, text, textAreaW)
            const lineHeight = fontSize * 1.2
            const totalH = lines.length * lineHeight
            if (totalH <= textAreaH) break
            fontSize -= 2
        }

        const lineHeight = fontSize * 1.2
        const totalH = lines.length * lineHeight

        // Center vertikal
        const startY = boardY + padding + (textAreaH - totalH) / 2 + fontSize

        ctx.font = `bold ${fontSize}px Arial`
        ctx.fillStyle = '#000000'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'alphabetic'

        const centerX = boardX + padding + textAreaW / 2

        lines.forEach((line, i) => {
            ctx.fillText(line, centerX, startY + i * lineHeight)
        })

        const buffer = canvas.toBuffer('image/jpeg')

        await sock.sendImageAsSticker(m.chat, buffer, m, {
            packname: config.sticker.packname,
            author: config.sticker.author
        })

        m.react('✅')
    } catch (err) {
        console.error('Bratemon error:', err)
        m.react('❌')
        m.reply('❌ Gagal membuat sticker bratemon, coba lagi nanti.\n> ' + err.message)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}