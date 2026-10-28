const axios = require('axios')
const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: 'balogo',
    alias: ['bluearchivelogo', 'ba'],
    category: 'canvas',
    description: 'Membuat logo Blue Archive style',
    usage: '.balogo <textL> & <textR>',
    example: '.balogo Blue & Archive',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const input = m.text?.trim() || ''
    const parts = input.split(/[&,]/).map(s => s.trim()).filter(s => s)
    
    if (parts.length < 2) {
        return m.reply(`🎮 *ʙʟᴜᴇ ᴀʀᴄʜɪᴠᴇ ʟᴏɢᴏ*\n\n> Masukkan 2 teks untuk logo\n\n> Contoh: ${m.prefix}balogo Blue & Archive`)
    }
    
    const textL = parts[0]
    const textR = parts[1]
    
    m.react('🕕')
    
    try {
        const apiUrl = `https://api.nexray.web.id/maker/balogo?text=${encodeURIComponent(textL)} ${encodeURIComponent(textR)}`
        const response = await f(apiUrl, 'arrayBuffer')
        
        await sock.sendMedia(m.chat, Buffer.from(response), null, m, {
            type: 'image',
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
