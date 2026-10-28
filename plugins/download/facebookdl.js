const { fbdown } = require('btch-downloader')

const pluginConfig = {
    name: 'facebookdl',
    alias: ['fbdown', 'fb', 'facebook'],
    category: 'download',
    description: 'Download video Facebook',
    usage: '.facebookdl <url>',
    example: '.facebookdl https://www.facebook.com/watch?v=xxx',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const url = m.text?.trim()
    
    if (!url) {
        return m.reply(
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> \`${m.prefix}facebookdl <url>\`\n\n` +
            `> Contoh:\n` +
            `> \`${m.prefix}fbdown https://www.facebook.com/watch?v=xxx\``
        )
    }
    
    if (!url.match(/facebook\.com|fb\.watch/i)) {
        return m.reply(`❌ *Ehh~* URL tidak valid. Gunakan link Facebook~ 🥺`)
    }
    
    await m.react('🕕')
    
    try {
        const data = await fbdown(url)
        
        if (!data?.status) {
            return m.reply(`❌ *Gomen ne~* Gagal mengambil video. Coba link lain~ 🥺`)
        }
        
        const videoUrl = data.HD || data.Normal_video
        
        if (!videoUrl) {
            return m.reply(`❌ *Ehh~* Video tidak ditemukan~ 🥺`)
        }
        
        const quality = data.HD ? 'HD' : 'SD'
        
        await sock.sendMedia(m.chat, videoUrl, null, m, {
            type: 'video',
            contextInfo: {
                forwardingScore: 99,
                isForwarded: true
            }
        })
        
    } catch (err) {
        return m.reply(`❌ *ɢᴀɢᴀʟ ᴍᴇɴɢᴜɴᴅᴜʜ*\n\n> ${err.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}