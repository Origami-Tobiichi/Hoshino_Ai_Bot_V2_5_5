const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: 'gpt4o',
    alias: ['gpt4'],
    category: 'ai',
    description: 'Chat dengan GPT-4o',
    usage: '.gpt4o <pertanyaan>',
    example: '.gpt4o Hai apa kabar?',
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
        return m.reply(`🧠 *ɢᴘᴛ-4ᴏ*\n\nEhh~ Ai belum dengar pertanyaannya nih! Tulis dulu ya~ 🌸\n\n\`Contoh: ${m.prefix}gpt4o Hai apa kabar?\``)
    }
    
    m.react('🕕')
    
    try {
        const url = await f(`https://api.nexray.web.id/ai/chatgpt?text=${encodeURIComponent(text)}&model=gpt-4o`)
        
        m.react('✅')
        await m.reply(`${url.result}`)
    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
