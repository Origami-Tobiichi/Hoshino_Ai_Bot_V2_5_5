const sharp = require('sharp')

const pluginConfig = {
    name: 'hazzard',
    alias: ['hazard', 'halfmirror', 'symmetry'],
    category: 'maker',
    description: 'Setengah gambar normal, setengah di-mirror (horizontal/vertikal)',
    usage: '.hazzard <h/v> (reply gambar)',
    example: '.hazzard h\n.hazzard v',
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const isImage = m.isImage || (m.quoted?.type === 'imageMessage')
    if (!isImage) return m.reply(
        `✨ *ʜᴀᴢᴢᴀʀᴅ*\n\n` +
        `> Reply atau kirim gambar dulu ya! 🎤\n\n` +
        `╭┈┈⬡「 📋 *ᴍᴏᴅᴇ* 」\n` +
        `┃ \`${m.prefix}hazzard h\` — Kiri normal, kanan mirror ↔️\n` +
        `┃ \`${m.prefix}hazzard v\` — Atas normal, bawah mirror ↕️\n` +
        `╰┈┈┈┈┈┈┈┈⬡`
    )

    const arg = (m.args?.[0] || 'h').toLowerCase()
    const isVertical = arg === 'v' || arg === 'vertical'
    const modeLabel = isVertical ? 'Vertikal ↕️' : 'Horizontal ↔️'

    m.react('🕕')

    try {
        const buffer = m.quoted ? await m.quoted.download() : await m.download()

        const meta = await sharp(buffer).metadata()
        const { width, height } = meta

        if (isVertical) {
            const halfH = Math.floor(height / 2)

            const topHalf = await sharp(buffer)
                .extract({ left: 0, top: 0, width, height: halfH })
                .toBuffer()

            const bottomMirror = await sharp(topHalf)
                .flip()
                .toBuffer()

            const totalHeight = halfH * 2

            const outBuffer = await sharp({
                create: {
                    width,
                    height: totalHeight,
                    channels: 4,
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                }
            })
                .composite([
                    { input: topHalf,      top: 0,      left: 0 },
                    { input: bottomMirror, top: halfH,  left: 0 }
                ])
                .jpeg({ quality: 90 })
                .toBuffer()

            m.react('✨')
            return sock.sendMessage(m.chat, {
                image: outBuffer,
                caption: `✨ *ʜᴀᴢᴢᴀʀᴅ*\n\n> Mode: ${modeLabel}\n> Atas normal · Bawah mirror 🎤`
            }, { quoted: m })

        } else {
            const halfW = Math.floor(width / 2)

            const leftHalf = await sharp(buffer)
                .extract({ left: 0, top: 0, width: halfW, height })
                .toBuffer()

            const rightMirror = await sharp(leftHalf)
                .flop()
                .toBuffer()

            const totalWidth = halfW * 2

            const outBuffer = await sharp({
                create: {
                    width: totalWidth,
                    height,
                    channels: 4,
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                }
            })
                .composite([
                    { input: leftHalf,    top: 0, left: 0     },
                    { input: rightMirror, top: 0, left: halfW }
                ])
                .jpeg({ quality: 90 })
                .toBuffer()

            m.react('✨')
            return sock.sendMessage(m.chat, {
                image: outBuffer,
                caption: `✨ *ʜᴀᴢᴢᴀʀᴅ*\n\n> Mode: ${modeLabel}\n> Kiri normal · Kanan mirror 🎤`
            }, { quoted: m })
        }

    } catch (e) {
        m.react('❌')
        m.reply(`❌ *ʜᴀᴢᴢᴀʀᴅ*\n\n> Gagal memproses gambar.\n> \`${e.message}\``)
    }
}

module.exports = { config: pluginConfig, handler }