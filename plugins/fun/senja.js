const axios = require('axios')
const config = require('../../config')
const { f } = require('../../src/lib/undici')

const NEOXR_APIKEY = config.APIkey?.neoxr || 'Milik-Bot-OurinMD'

const pluginConfig = {
    name: 'senja',
    alias: ['katacinta', 'romanticquotes'],
    category: 'fun',
    description: 'Random kata-kata senja/romantis',
    usage: '.senja',
    example: '.senja',
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
        const res = await f(`https://api.neoxr.eu/api/senja?apikey=${NEOXR_APIKEY}`)
        
        if (!res.status || !res.data?.text) {
            m.react('❌')
            return m.reply(`❌ *Gomen ne~* Gagal mengambil kata senja~ 🥺`)
        }
        await m.reply(res.data.text)
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
