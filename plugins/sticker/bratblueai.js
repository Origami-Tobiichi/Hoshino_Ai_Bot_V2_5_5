const { createCanvas, loadImage } = require('@napi-rs/canvas')
const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: 'bratblueai',
    alias: ['bratblue', 'bratai', 'bratchara'],
    category: 'sticker',
    description: 'Hehe~ Ai buatin sticker karakter Blue Archive dengan speech bubble brat style~ ⭐',
    usage: '.bratblueai <teks kamu>',
    example: '.bratblueai It\'s that I know absolutely nothing!',
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
        return m.reply(`*✨ ʙʀᴀᴛʙʟᴜᴇᴀɪ sᴛɪᴄᴋᴇʀ ✨*\n\nHehe~ kamu lupa nulis teksnya lho! ⭐\nAi nggak bisa bikin sticker tanpa kata-kata dari kamu~\n\n\`Contoh: ${m.prefix}bratblueai It's that I know absolutely nothing!\``)
    }

    m.react('⭐')

    try {
        const bgUrls = [
            'https://files.catbox.moe/09v6h3.jpg',
            'https://litter.catbox.moe/5bebt1.jpg',
            'https://tmpfiles.org/dl/wCwves7DlARr/file.jpg',
            'https://gofile.io/d/HKXMFz',
            'https://qu.ax/fSOOa',
            'https://put.icu/s/y5n15w4o.png',
            'https://c.termai.cc/i194/nzr0.png'
        ]

        let bgImage = null
        for (const url of bgUrls) {
            try {
                const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 })
                bgImage = await loadImage(Buffer.from(response.data))
                break
            } catch (e) {
                console.warn(`Bratblueai: Gagal load dari ${url}, mencoba link berikutnya...`)
            }
        }

        if (!bgImage) throw new Error('Semua link gambar gagal dimuat')

        const canvas = createCanvas(bgImage.width, bgImage.height)
        const ctx = canvas.getContext('2d')

        ctx.drawImage(bgImage, 0, 0)

        const W = bgImage.width
        const H = bgImage.height

        // Speech bubble area — berdasarkan image 1 (1024x1024)
        // Bubble kira2: x=55, y=18, w=925, h=227
        const bubbleX = Math.floor(W * 0.052)   // ~55px di 1024
        const bubbleY = Math.floor(H * 0.063)   // ~18px di 1024
        const bubbleW = Math.floor(W * 0.903)   // ~925px di 1024
        const bubbleH = Math.floor(H * 0.222)   // ~227px di 1024

        const padding = 20

        // Hitung ukuran font & wrap teks agar muat di dalam bubble
        let fontSize = Math.floor(bubbleH * 0.40)
        let lines = []

        while (fontSize >= 8) {
            ctx.font = `bold ${fontSize}px sans-serif`
            lines = getWrappedLines(ctx, text, bubbleW - padding * 2)
            const lineHeight = fontSize * 1.25
            const totalH = lines.length * lineHeight
            if (totalH <= bubbleH - padding * 2) break
            fontSize -= 1
        }

        const lineHeight = fontSize * 1.25
        const totalTextH = lines.length * lineHeight

        // Posisi teks: center horizontal & vertikal dalam bubble
        const startY = bubbleY + (bubbleH - totalTextH) / 2 + fontSize * 0.85
        const centerX = bubbleX + bubbleW / 2

        ctx.font = `bold ${fontSize}px sans-serif`
        ctx.fillStyle = '#1a1a1a'
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
        console.error('Bratblueai error:', err)
        m.react('❌')
        m.reply(`Aduh~ Ai gagal bikin stickernya nih... coba lagi nanti ya! ⭐\n> ${err.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}