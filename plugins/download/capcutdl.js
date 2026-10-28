const { capcut } = require('btch-downloader')

const pluginConfig = {
    name: 'capcutdl',
    alias: ['ccdl', 'capcut', 'cc'],
    category: 'download',
    description: 'Download video CapCut',
    usage: '.ccdl <url>',
    example: '.ccdl https://www.capcut.com/t/xxx',
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
            `> \`${m.prefix}ccdl <url>\`\n\n` +
            `> Contoh:\n` +
            `> \`${m.prefix}ccdl https://www.capcut.com/t/xxx\``
        )
    }
    
    if (!url.match(/capcut\.com/i)) {
        return m.reply(`❌ *Ehh~* URL tidak valid. Gunakan link CapCut~ 🥺`)
    }
    
    await m.react('🕕')
    
    try {
        const data = await capcut(url)
        
        if (!data?.status || !data?.originalVideoUrl) {
            return m.reply(`❌ *Gomen ne~* Gagal mengambil video. Coba link lain~ 🥺`)
        }
        
        await sock.sendMedia(m.chat, data.originalVideoUrl, null, m, {
            type: 'video',
            contextInfo: {
                forwardingScore: 99,
                isForwarded: true
            }
        })
        
    } catch (err) {
        return m.reply(`❌ *Gomen ne~* ✦\n\n> ${err.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
