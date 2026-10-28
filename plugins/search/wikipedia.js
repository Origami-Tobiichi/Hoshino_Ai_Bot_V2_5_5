const axios = require('axios')
const config = require('../../config')
const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: 'wikipedia',
    alias: ['wiki', 'ensiklopedia'],
    category: 'search',
    description: 'Cari informasi di Wikipedia',
    usage: '.wikipedia <query>',
    example: '.wikipedia Indonesia',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const query = m.text?.trim()
    
    if (!query) {
        return m.reply(
            `📚 *ᴡɪᴋɪᴘᴇᴅɪᴀ*\n\n` +
            `> Masukkan kata kunci pencarian\n\n` +
            `> Contoh: \`${m.prefix}wikipedia Indonesia\``
        )
    }
    
    m.react('🕕')
    
    try {
        const apiKey = config.APIkey?.lolhuman
        
        if (!apiKey) {
            throw new Error('API Key tidak ditemukan di config')
        }
        
        const res = await f(`https://api.lolhuman.xyz/api/wiki2?apikey=${apiKey}&query=${encodeURIComponent(query)}&lang=id`)
        
        if (res.status !== 200 || !res.result) {
            throw new Error('Artikel tidak ditemukan')
        }
        
        const result = res.result
        await m.reply(result)
        m.react('✅')
        
    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
