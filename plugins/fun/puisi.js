const axios = require('axios')
const config = require('../../config')
const { f } = require('../../src/lib/undici')

const NEOXR_APIKEY = config.APIkey?.neoxr || 'Milik-Bot-OurinMD'

const pluginConfig = {
    name: 'puisi',
    alias: ['puisiku', 'sajak'],
    category: 'fun',
    description: 'Random puisi Indonesia',
    usage: '.puisi',
    example: '.puisi',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    m.react('🕕')
    
    try {
        const res = await f(`https://api.neoxr.eu/api/puisi?apikey=${NEOXR_APIKEY}`)
        
        if (!res.status || !res.data?.text) {
            m.react('❌')
            return m.reply(`❌ *Gomen ne~* Gagal mengambil puisi~ 🥺`)
        }
        
        const text = res.data.text
        await m.reply(text)
        m.react('✅')
        
    } catch (err) {
        m.react('❌')
        return m.reply(`❌ *Gomen ne~* ✦\n\n> ${err.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
