const axios = require('axios')
const config = require('../../config')
const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: 'gheayubi',
    alias: ['gheayubivid'],
    category: 'asupan',
    description: 'Video gheayubi',
    usage: '.gheayubi',
    example: '.gheayubi',
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
        const res = await f(`https://kazztzyy.my.id/api/asupan/gheayubi`)
        
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
