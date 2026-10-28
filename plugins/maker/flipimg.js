const sharp = require('sharp');

const pluginConfig = {
    name: 'flipimg',
    alias: ['mirror', 'balik', 'flip'],
    category: 'maker',
    description: 'Balik gambar vertikal atau horizontal',
    usage: '.flipimg <v/h> (reply gambar)',
    example: '.flipimg v',
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const isImage = m.isImage || (m.quoted && m.quoted.type === 'imageMessage')
    if (!isImage) return m.reply(`✨ *Hoshino Ai Flip*\n\n> Kirim atau reply gambarnya dulu ya! 🎤`)

    const type = (m.args[0] || 'h').toLowerCase()
    m.react('🕕')

    try {
        let buffer = m.quoted ? await m.quoted.download() : await m.download()

        let img = sharp(buffer)
        let mode = (type === 'v' || type === 'vertical') ? 'Vertikal ↕️' : 'Horizontal ↔️'

        if (type === 'v' || type === 'vertical') {
            img.flip() // Balik atas-bawah
        } else {
            img.flop() // Balik kiri-kanan
        }

        const outBuffer = await img.toBuffer()

        m.react('✨')
        await sock.sendMessage(m.chat, {
            image: outBuffer,
            caption: `✨ *Hoshino Ai Flip*\n\n> Berhasil dibalik secara ${mode}! 🎤`
        }, { quoted: m })
    } catch (e) {
        m.react('❌')
        m.reply(`❌ *Hoshino Ai Error*\n\n> Gagal membalik gambar.`)
    }
}

module.exports = { config: pluginConfig, handler }