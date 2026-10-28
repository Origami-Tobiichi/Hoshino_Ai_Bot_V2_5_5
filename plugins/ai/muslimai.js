const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: 'muslimai',
    alias: ['islamai', 'quranai'],
    category: 'ai',
    description: 'AI untuk bertanya tentang Islam dan Al-Quran',
    usage: '.muslimai <pertanyaan>',
    example: '.muslimai Apa itu sholat?',
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
        return m.reply(`☪️ *ᴍᴜsʟɪᴍ ᴀɪ*\n\nAi siap bantu jawab pertanyaanmu tentang Islam~ Tulis dulu pertanyaannya ya! 🌸\n\n\`Contoh: ${m.prefix}muslimai Apa itu sholat?\``)
    }
    
    m.react('🕕')
    
    try {
        const url = `https://api.nexray.web.id/ai/muslim?text=${encodeURIComponent(text)}`
        const data = await f(url)
        
        const answer = data.result
        let response = `${answer}`
        
        m.react('✅')
        await m.reply(response)
        
    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
