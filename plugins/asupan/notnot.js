const axios = require('axios')
const config = require('../../config')
const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: 'notnot',
    alias: ['notnotvid'],
    category: 'asupan',
    description: 'Video notnot',
    usage: '.notnot',
    example: '.notnot',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    
    m.react('🕕')
    
    try {
        const res = await f(`https://kazztzyy.my.id/api/asupan/notnot`)
        
        m.react('✅')
        
        await sock.sendMedia(m.chat, res.url, null, m, {
            type: 'video'
        })
        
    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> Video tidak ditemukan~ 🥺`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
