const { createCanvas, loadImage } = require('@napi-rs/canvas')
const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: 'bratsquidward',
    alias: ['bratsquid', 'bratsquidi', 'brattentakel'],
    category: 'sticker',
    description: 'Hehe~ Ai buatin sticker Squidward pegang papan dengan tulisan brat style buat kamu~ ⭐',
    usage: '.bratsquidward <teks kamu>',
    example: '.bratsquidward Aku cinta kamu~ ⭐',
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
        return m.reply(`*✨ ʙʀᴀᴛsQᴜɪᴅᴡᴀʀᴅ sᴛɪᴄᴋᴇʀ ✨*\n\nHehe~ kamu lupa nulis teksnya lho! ⭐\nAi nggak bisa bikin sticker tanpa kata-kata dari kamu~\n\n\`Contoh: ${m.prefix}bratsquidward Aku cinta kamu~ ⭐\``)
    }

    m.react('⭐')

    try {
        const bgUrls = [
            'https://litter.catbox.moe/922g7q.jpg',
            'https://tmpfiles.org/dl/wlwReQgFZNtY/file.jpg',
            'https://gofile.io/d/BmGvwB',
            'https://qu.ax/ok1qi',
            'https://put.icu/s/okrzxnv4.jpg',
            'https://c.termai.cc/i177/jyZ0I.jpg'
        ]

        let bgImage = null
        for (const url of bgUrls) {
            try {
                const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 })
                bgImage = await loadImage(Buffer.from(response.data))
                break
            } catch (e) {
                console.warn(`Bratsquidward: Gagal load dari ${url}, mencoba link berikutnya...`)
            }
        }

        if (!bgImage) throw new Error('Semua link gambar gagal dimuat')

        const canvas = createCanvas(bgImage.width, bgImage.height)
        const ctx = canvas.getContext('2d')

        ctx.drawImage(bgImage, 0, 0)

        const W = bgImage.width
        const H = bgImage.height

        const boardX = Math.floor(W * 0.303)
        const boardY = Math.floor(H * 0.400)
        const boardW = Math.floor(W * 0.409)
        const boardH = Math.floor(H * 0.278)

        const padding = 12

        let fontSize = Math.floor(boardH * 0.35)
        let lines = []

        while (fontSize >= 6) {
            ctx.font = `bold ${fontSize}px sans-serif`
            lines = getWrappedLines(ctx, text, boardW - padding * 2 - 140)
            const lineHeight = fontSize * 1.2
            const totalH = lines.length * lineHeight
            if (totalH <= boardH - padding * 2) break
            fontSize -= 1
        }

        const lineHeight = fontSize * 1.2
        const totalTextH = lines.length * lineHeight

        const startY = boardY + (boardH - totalTextH) / 2 + fontSize * 0.85
        const centerX = boardX + boardW / 2

        ctx.font = `bold ${fontSize}px sans-serif`
        ctx.fillStyle = '#000000'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'alphabetic'

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
        console.error('Bratsquidward error:', err)
        m.react('❌')
        m.reply(`Aduh~ Ai gagal bikin stickernya nih... coba lagi nanti ya! ⭐\n> ${err.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}