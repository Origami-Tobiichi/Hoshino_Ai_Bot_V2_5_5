const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: 'oh-no',
    alias: ['ohno', 'ohnomeme'],
    category: 'canvas',
    description: 'Membuat meme oh no',
    usage: '.oh-no <teks>',
    example: '.oh-no Aku lupa ngerjain PR',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    let text = m.text?.trim()
    
    if (!text && m.quoted?.text) {
        text = m.quoted.text.trim()
    }
    
    if (!text) {
        return m.reply(
            `😱 *ᴏʜ ɴᴏ ᴍᴇᴍᴇ*\n\n` +
            `> Masukkan teks untuk meme\n\n` +
            `> Contoh: \`${m.prefix}oh-no Aku lupa ngerjain PR\``
        )
    }
    
    const apikey = config.APIkey?.lolhuman
    if (!apikey) {
        return m.reply(`❌ *Ehh~* API key lolhuman tidak dikonfigurasi~ 🥺`)
    }
    
    m.react('🕕')
    
    try {
        await sock.sendMedia(m.chat, `https://api.lolhuman.xyz/api/creator/ohno?apikey=${apikey}&text=${encodeURIComponent(text)}`, null, m, {
            type: 'image',
        })
        
        m.react('✅')
        
    } catch (err) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${err.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
