const config = require('../../config')

const pluginConfig = {
    name: 'ptvch',
    alias: ['ptvchanel', 'ptvstory'],
    category: 'owner',
    description: 'Kirim video sebagai PTV ke channel',
    usage: '.ptvch (reply video)',
    example: '.ptvch',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    let video = null
    
    if (m.quoted && m.quoted.isVideo) {
        try {
            video = await m.quoted.download()
        } catch (e) {
            return m.reply(`❌ *Gomen ne~* Gagal download video dari quoted~ 🥺`)
        }
    } else if (m.isVideo) {
        try {
            video = await m.download()
        } catch (e) {
            return m.reply(`❌ *Gomen ne~* Gagal download video~ 🥺`)
        }
    }
    
    if (!video) {
        return m.reply(
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> Kirim *video* atau *balas video* lalu ketik:\n` +
            `> \`${m.prefix}ptvch\``
        )
    }
    
    const channelId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    
    await m.reply(`🕕 *ᴍᴇɴɢɪʀɪᴍ ᴘᴛᴠ ᴋᴇ ᴄʜᴀɴɴᴇʟ...*`)
    
    try {
        await sock.sendMessage(channelId, {
            video: video,
            mimetype: 'video/mp4',
            gifPlayback: true,
            ptv: true
        })
        
        m.react('✅')
        return m.reply(`✅ *sᴜᴋsᴇs*\n\n> Video berhasil dikirim ke channel sebagai PTV.`)
        
    } catch (err) {
        return m.reply(`❌ *Gomen ne~* ✦\n\n> ${err.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
