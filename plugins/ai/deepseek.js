const { f } = require("../../src/lib/undici")

const pluginConfig = {
    name: 'deepseek',
    alias: ['deepseekr1', 'dsr1'],
    category: 'ai',
    description: 'Chat dengan DeepSeek R1',
    usage: '.deepseek <pertanyaan>',
    example: '.deepseek Jelaskan tentang AI',
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
        return m.reply(`🧠 *ᴅᴇᴇᴘsᴇᴇᴋ ʀ1*\n\nHmm~ Ai udah siap mikir keras nih, tapi pertanyaannya belum ada! Tulis dulu ya~ 🌸\n\n\`Contoh: ${m.prefix}deepseek Jelaskan tentang AI\``)
    }
    
    m.react('🧠')
    
    try {
        const result = await f(`https://api.nexray.web.id/ai/deepseek?text=${encodeURIComponent(text)}`)
        
        m.react('✅')
        await m.reply(`${result.result}`)
        
    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
