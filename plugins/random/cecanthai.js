const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: 'cecanthai',
    alias: ['cewekthai', 'cewekthailand'],
    category: 'cecan',
    description: 'Random gambar cewek cantik Thailand',
    usage: '.cecanthai',
    example: '.cecanthai',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const api = 'https://api.nexray.web.id/random/cecan/thailand'
    const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'
    
    await m.react('🇹🇭')
    
    try {
        const res = await axios.get(api, { responseType: 'arraybuffer' })
        const buf = Buffer.from(res.data)
        
        await sock.sendMessage(m.chat, {
            image: buf,
            caption: `🇹🇭 *ᴄᴇᴄᴀɴ ᴛʜᴀɪʟᴀɴᴅ*`,
            contextInfo: {
                forwardingScore: 9999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: saluranId,
                    newsletterName: saluranName,
                    serverMessageId: 127
                }
            }
        }, { quoted: m })
        
        await m.react('✅')
    } catch (e) {
        await m.react('❌')
        await m.reply(`❌ *Gomen ne~* ✦\n\n> ${e.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
