const axios = require('axios')
const fs = require('fs')
const path = require('path')
const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: 'santuy',
    alias: ['santuyvid'],
    category: 'asupan',
    description: 'Video santuy',
    usage: '.santuy',
    example: '.santuy',
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

        const item = await f(`https://kazztzyy.my.id/api/asupan/santuy`)
        
        
        await sock.sendMedia(m.chat, item.url, null, m, {
            type: 'video'
        })
        m.react('✅')
        
    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> Video tidak ditemukan~ 🥺`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
