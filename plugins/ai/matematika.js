const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: 'matematika',
    alias: ['mathgpt', 'math', 'mathsolver'],
    category: 'ai',
    description: 'AI untuk menyelesaikan soal matematika',
    usage: '.matematika <soal> atau reply gambar soal',
    example: '.matematika 2+2 berapa?',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.args.join(' ')

    if (!text) {
        return m.reply(`📐 *ᴍᴀᴛʜ ɢᴘᴛ*\n\nKyaa~ soal matematika? Ai coba bantu ya! Tulis soalnya dulu dong~ 🌸\n\n\`Contoh: ${m.prefix}matematika 2+2 berapa?\``)
    }
    
    m.react('🕕')
    
    try {
        let url = `https://api.nexray.web.id/ai/mathgpt?text=${encodeURIComponent(text || 'solve this')}`
        const data = await f(url)

        const answer = data.result
        
        m.react('✅')
        await m.reply(`${answer}`)
        
    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
