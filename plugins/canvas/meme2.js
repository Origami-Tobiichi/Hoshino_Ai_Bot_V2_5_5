const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: 'meme2',
    alias: ['changemymind'],
    category: 'canvas',
    description: 'Membuat meme change my mind',
    usage: '.meme2 <teks>',
    example: '.meme2 Tahu bacem enak banget',
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
            `🎭 *ᴄʜᴀɴɢᴇ ᴍʏ ᴍɪɴᴅ*\n\n` +
            `> Masukkan teks untuk meme\n\n` +
            `> Contoh: \`${m.prefix}meme2 Tahu bacem enak\``
        )
    }
    
    const apikey = config.APIkey?.lolhuman
    if (!apikey) {
        return m.reply(`❌ *Ehh~* API key lolhuman tidak dikonfigurasi~ 🥺`)
    }
    
    m.react('🕕')
    
    try {
        await sock.sendMedia(m.chat, `https://api.lolhuman.xyz/api/meme4?apikey=${apikey}&text=${encodeURIComponent(text)}`, null, m, {
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
