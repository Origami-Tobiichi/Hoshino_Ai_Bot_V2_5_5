const { snackvideo } = require('btch-downloader')

const pluginConfig = {
    name: 'snackvideodl',
    alias: ['svdl', 'snackvideo', 'sv'],
    category: 'download',
    description: 'Download video SnackVideo',
    usage: '.svdl <url>',
    example: '.svdl https://www.snackvideo.com/@xxx/video/xxx',
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
            `> \`${m.prefix}svdl <url>\`\n\n` +
            `> Contoh:\n` +
            `> \`${m.prefix}svdl https://www.snackvideo.com/@xxx/video/xxx\``
        )
    }
    
    if (!url.match(/snackvideo\.com/i)) {
        return m.reply(`❌ *Ehh~* URL tidak valid. Gunakan link SnackVideo~ 🥺`)
    }
    
    await m.react('🕕')
    
    try {
        const data = await snackvideo(url)
        
        if (!data?.status || !data?.result?.videoUrl) {
            return m.reply(`❌ *Gomen ne~* Gagal mengambil video. Coba link lain~ 🥺`)
        }
        
        const result = data.result
        
        await sock.sendMedia(m.chat, result.videoUrl, null, m, {
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
