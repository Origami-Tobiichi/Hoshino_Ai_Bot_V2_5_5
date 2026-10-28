const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: 'lahelu',
    alias: ['randommeme'],
    category: 'random',
    description: 'Random gambar lahelu',
    usage: '.lahelu',
    example: '.lahelu',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const api = 'https://api.cuki.biz.id/api/random/lahelu?apikey=cuki-x'
    const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'
    
    await m.react('🎴')
    
    try {
        const res = (await axios.get(api)).data
        const random = res.data[Math.floor(Math.random() * res.data.length)]
        console.log(random.media)
        if(random.media.includes('.mp4')) {
            await sock.sendMessage(m.chat, {
                video: { url: random.media },
                caption: random.title,
                contextInfo: {
                    forwardingScore: 9,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: saluranId,
                        newsletterName: saluranName,
                        serverMessageId: 127
                    }
                }
            }, { quoted: m })
        } else {
            await sock.sendMessage(m.chat, {
                image: { url: random.media },
                caption: random.title,
                contextInfo: {
                    forwardingScore: 9,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: saluranId,
                        newsletterName: saluranName,
                        serverMessageId: 127
                    }
                }
            }, { quoted: m })
        }
        
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
