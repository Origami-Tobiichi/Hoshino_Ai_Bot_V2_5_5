const { createCanvas, loadImage } = require('@napi-rs/canvas')
const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: 'bahlil',
    alias: ['bratbahlil', 'bahliltext'],
    category: 'sticker',
    description: 'Membuat sticker brat dengan papan Bahlil',
    usage: '.bahlil <text>',
    example: '.bahlil Kamu manis banget!',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.args.join(' ')
    if (!text) {
        return m.reply(`🌸 *ʏᴀʜʜᴏᴏ! sᴛɪᴄᴋᴇʀ ʙᴀʜʟɪʟ* 🌸\n\n> Masukkan teks yang mau Ai tulis di papan ya!\n\n\`Contoh: ${m.prefix}bahlil Halo Sayang!\``)
    }
    
    m.react('🕕')
    
    try {
        const imageUrl = "https://i.ibb.co/JwT2QFvY/elaina-md.jpg"
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' })
        const img = await loadImage(Buffer.from(response.data))

        const canvas = createCanvas(img.width, img.height)
        const ctx = canvas.getContext("2d")

        ctx.drawImage(img, 0, 0, img.width, img.height)

        // Koordinat papan tulis
        const boardX = img.width * 0.18
        const boardY = img.height * 0.55
        const boardW = img.width * 0.64
        const boardH = img.height * 0.30

        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillStyle = "#000000"

        // Logika wrap text lokal
        const words = text.split(" ")
        let lines = []
        let currentLine = ""
        let fontSize = 70
        ctx.font = `bold ${fontSize}px Arial`

        for (let w of words) {
            let testLine = currentLine + w + " "
            if (ctx.measureText(testLine).width > boardW * 0.85 && currentLine !== "") {
                lines.push(currentLine.trim())
                currentLine = w + " "
            } else {
                currentLine = testLine
            }
        }
        lines.push(currentLine.trim())

        // Sesuaikan ukuran font jika terlalu banyak baris
        if (lines.length > 3) fontSize = 50
        ctx.font = `bold ${fontSize}px Arial`
        
        const lineHeight = fontSize * 1.1
        const startY = boardY + (boardH / 2) - ((lines.length - 1) * lineHeight / 2)

        lines.slice(0, 4).forEach((line, i) => {
            ctx.fillText(line, boardX + (boardW / 2), startY + (i * lineHeight))
        })

        const buffer = canvas.toBuffer('image/png')

        // Kirim sebagai stiker tanpa API luar
        await sock.sendImageAsSticker(m.chat, buffer, m, {
            packname: config.sticker.packname,
            author: "Hoshino Ai ✨"
        })
        
        m.react('✅')
        
    } catch (error) {
        console.error(error)
        m.react('❌')
        m.reply(`❌ *ᴇʀʀᴏʀ*\n\n> Duh, panggungnya kacau! Ai gagal ngerender stikernya secara lokal...`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}