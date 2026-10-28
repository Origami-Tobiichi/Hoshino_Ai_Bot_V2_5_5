const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: 'brathd',
    alias: ['brathdsticker', 'brathds'],
    category: 'sticker',
    description: 'Membuat sticker brat HD',
    usage: '.brathd <text>',
    example: '.brathd hello world',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.args.join(' ')
    
    if (!text) {
        return m.reply(`🖼️ *ʙʀᴀᴛ ʜᴅ sᴛɪᴄᴋᴇʀ*\n\n> Masukkan teks\n\n\`Contoh: ${m.prefix}brathd hello world\``)
    }
    
    m.react('🕕')
    
    try {
        const url = `https://api.nexray.web.id/maker/brathd?text=${encodeURIComponent(text)}`
        await sock.sendImageAsSticker(m.chat, url, m, {
            packname: config.sticker.packname,
            author: config.sticker.author
        })
        m.react('✅')
    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
