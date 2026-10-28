const sharp = require('sharp');

const pluginConfig = {
    name: 'rotate',
    alias: ['putar'],
    category: 'maker',
    description: 'Putar gambar dengan background transparan',
    usage: '.rotate <derajat> (reply gambar)',
    example: '.rotate 45',
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const isImage = m.isImage || (m.quoted && m.quoted.type === 'imageMessage')
    if (!isImage) return m.reply(`✨ *Hoshino Ai Rotate*\n\n> Reply atau kirim gambar dulu ya! 🎤`)

    const degrees = parseFloat(m.args[0])
    if (isNaN(degrees)) return m.reply(`❌ *Ehh~* Masukkan angka derajatnya! Contoh: \`.rotate 45\``)

    m.react('🕕')
    try {
        let buffer = m.quoted ? await m.quoted.download() : await m.download()

        const outBuffer = await sharp(buffer)
            .rotate(degrees, {
                background: { r: 0, g: 0, b: 0, alpha: 0 } 
            })
            .png() 
            .toBuffer()
        
        m.react('✨')
        await sock.sendMessage(m.chat, {
            image: outBuffer,
            caption: `✨ *Hoshino Ai Rotate*\n\n> Berhasil diputar ${degrees}°! 💫`
        }, { quoted: m })
    } catch (e) {
        m.react('❌')
        m.reply(`❌ *Hoshino Ai Error*\n\n> Gagal memutar gambar.`)
    }
}

module.exports = { config: pluginConfig, handler }