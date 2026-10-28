const axios = require('axios')
const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: 'gita',
    alias: ['gitagpt', 'bhagavadgita'],
    category: 'ai',
    description: 'Chat dengan Gita GPT (Bhagavad Gita AI)',
    usage: '.gita <pertanyaan>',
    example: '.gita What is dharma?',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.args.join(' ')
    if (!text) {
        return m.reply(`📿 *ɢɪᴛᴀ ɢᴘᴛ*\n\nAi siap bantu jawab~ Tulis dulu pertanyaannya ya! 🌸\n\n\`Contoh: ${m.prefix}gita What is dharma?\``)
    }
    
    m.react('🕕')
    
    try {
        const url = `https://api.nexray.web.id/ai/gitagpt?text=${encodeURIComponent(text)}`
        const data = await f(url)
        
        const content = data.result
        
        m.react('✅')
        await m.reply(`${content?.trim()}`)
        
    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
