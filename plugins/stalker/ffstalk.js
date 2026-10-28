const axios = require('axios')

const pluginConfig = {
    name: 'ffstalk',
    alias: ['freefireid', 'stalkff'],
    category: 'stalker',
    description: 'Stalk ID Free Fire',
    usage: '.ffstalk <id>',
    example: '.ffstalk 775417067',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const id = m.args[0]
    
    if (!id) {
        return m.reply(`🔥 *ꜰʀᴇᴇ ꜰɪʀᴇ sᴛᴀʟᴋ*\n\n> Masukkan ID Free Fire\n\n\`Contoh: ${m.prefix}ffstalk 775417067\``)
    }
    
    m.react('🔍')
    
    try {
        const res = await axios.get(`https://api.baguss.xyz/api/stalker/freefire?id=${encodeURIComponent(id)}`, {
            timeout: 30000
        })
        
        if (!res.data?.status || !res.data?.result) {
            m.react('❌')
            return m.reply(`❌ *Ehh~* ID *${id}* tidak ditemukan~ 🥺`)
        }
        
        const r = res.data.result
        
        const caption = `🔥 *ꜰʀᴇᴇ ꜰɪʀᴇ sᴛᴀʟᴋ*\n\n` +
            `🎮 *Game:* ${r.game}\n` +
            `🆔 *User ID:* ${r.userId}\n` +
            `👤 *Nickname:* ${r.nickname}`
        
        m.react('✅')
        await m.reply(caption)
        
    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
