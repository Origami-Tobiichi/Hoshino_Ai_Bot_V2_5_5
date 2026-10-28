const axios = require('axios')
const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: 'glm4',
    alias: ['glm', 'glm46v'],
    category: 'ai',
    description: 'Chat dengan GLM 4.6V',
    usage: '.glm4 <pertanyaan>',
    example: '.glm4 Hai apa kabar?',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.text
    if (!text) {
        return m.reply(`🌐 *ɢʟᴍ 4.6ᴠ*\n\nHaii~ Ai siap ngobrol! Tulis dulu pertanyaannya ya~ 🌸\n\n\`Contoh: ${m.prefix}glm4 Hai apa kabar?\``)
    }
    
    m.react('🕕')
    
    try {
        const url = `https://api.nexray.web.id/ai/glm?text=${encodeURIComponent(text)}&model=glm-4.6`
        const data = await f(url)
            
        const content = data.result
        
        m.react('✅')
        await m.reply(`${content}`)
        
    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
