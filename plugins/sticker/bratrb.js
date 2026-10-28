const { createCanvas } = require('@napi-rs/canvas')
const config = require('../../config')

const pluginConfig = {
    name: 'bratrb',
    alias: ['bratremovebg', 'bratrbtext'],
    category: 'sticker',
    description: 'Buat sticker teks transparan gaya brat',
    usage: '.bratrb <teks>',
    example: '.bratrb Hai',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.args?.join(' ')?.trim()

    if (!text) {
        return m.reply(
            `🎨 *ʙʀᴀᴛʀʙ*\n\n` +
            `> Ketik teks yang mau dijadiin sticker~\n\n` +
            `\`Contoh: ${m.prefix}bratrb Hai\``
        )
    }

    m.react('⭐')

    try {
        const FONT_SIZE = 72
        const OUTLINE = 6
        const PADDING = 40
        const MAX_WIDTH = 700

        // Canvas sementara untuk ukur teks
        const tmp = createCanvas(100, 100)
        const tc = tmp.getContext('2d')
        tc.font = `bold ${FONT_SIZE}px "Arial Rounded MT Bold", "Arial Black", Arial`

        // Word wrap
        const words = text.split(' ')
        const lines = []
        let current = ''

        for (const word of words) {
            const test = current ? current + ' ' + word : word
            if (tc.measureText(test).width > MAX_WIDTH && current) {
                lines.push(current)
                current = word
            } else {
                current = test
            }
        }
        if (current) lines.push(current)

        // Ukur dimensi
        let maxW = 0
        for (const line of lines) {
            const w = tc.measureText(line).width
            if (w > maxW) maxW = w
        }

        const lineH = FONT_SIZE * 1.25
        const W = Math.ceil(maxW + PADDING * 2 + OUTLINE * 2)
        const H = Math.ceil(lines.length * lineH + PADDING * 2 + OUTLINE * 2)

        // Canvas utama — transparan
        const canvas = createCanvas(W, H)
        const ctx = canvas.getContext('2d')

        ctx.clearRect(0, 0, W, H)
        ctx.font = `bold ${FONT_SIZE}px "Arial Rounded MT Bold", "Arial Black", Arial`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineJoin = 'round'

        const cx = W / 2
        const startY = PADDING + OUTLINE + FONT_SIZE / 2

        for (let i = 0; i < lines.length; i++) {
            const y = startY + i * lineH

            // Outline hitam
            ctx.strokeStyle = '#000000'
            ctx.lineWidth = OUTLINE * 2
            ctx.strokeText(lines[i], cx, y)

            // Fill putih
            ctx.fillStyle = '#ffffff'
            ctx.fillText(lines[i], cx, y)
        }

        const pngBuffer = canvas.toBuffer('image/png')

        await sock.sendImageAsSticker(m.chat, pngBuffer, m, {
            packname: config.sticker?.packname || 'Hoshino Ai',
            author: config.sticker?.author || 'Bot'
        })

        m.react('💖')

    } catch (err) {
        console.error('[bratrb]', err)
        m.react('❌')
        m.reply(`❌ *Gagal*\n\n> ${err.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}