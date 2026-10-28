const axios = require('axios')
const config = require('../../config')
const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: 'kayes',
    alias: ['kayesvid'],
    category: 'asupan',
    description: 'Video kayes',
    usage: '.kayes',
    example: '.kayes',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const apikey = config.APIkey?.betabotz
    
    m.react('🕕')
    
    try {
        const data = await f(`https://kazztzyy.my.id/api/asupan/kayes`)
        
        m.react('✅')
        
        await sock.sendMedia(m.chat, data.url, null, m, {
            type: 'video'
        })
        
    } catch (error) {
        console.log(error)
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> Video tidak ditemukan~ 🥺`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
