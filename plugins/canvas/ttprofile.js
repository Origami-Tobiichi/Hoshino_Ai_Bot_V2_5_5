const axios = require('axios')
const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: ['ttprofile', 'tiktokprofile', 'ttcanvas'],
    alias: [],
    category: 'canvas',
    description: 'Generate gambar profil TikTok',
    usage: '.ttprofile <username>|<displayName>|<bio>|<likes>|<followers>|<following>|<verified>',
    example: '.ttprofile luckyarchz|Lucky Archz|Developer|1000|9400|120|true',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.text?.trim()
    
    if (!text || !text.includes('|')) {
        return m.reply(
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> \`${m.prefix}ttprofile <data>\`\n\n` +
            `*Format:*\n` +
            `> username|displayName|bio|likes|followers|following|verified\n\n` +
            `*Contoh:*\n` +
            `> \`${m.prefix}ttprofile sea_editz|ZANN FZ|BIonya|1000|9400|120|true\`\n\n` +
            `💡 Reply gambar untuk custom avatar`
        )
    }
    
    const parts = text.split('|').map(s => s.trim())
    const [username, displayName, bio, likes, followers, following, verified] = parts
    
    if (!username) {
        return m.reply(`❌ *Ehh~* Username wajib diisi~ 🥺`)
    }
    
    await m.react('🕕')
    
    try {
        let profileImageUrl = 'https://i.pinimg.com/736x/0c/b5/a4/0cb5a4c54ecd6475f559a07066cb1e87.jpg'
        
        try {
            profileImageUrl = await sock.profilePictureUrl(m.sender, 'image')
        } catch {}
        
        const apiUrl = `https://kazztzyy.my.id/api/maker/faketiktok?nama=${username}&username=${displayName}&verified=${verified}&mengikuti=${following}&pengikut=${followers}&suka=${likes}&bio=${bio}&image=${encodeURIComponent(profileImageUrl)}`
        const y = await f(apiUrl, 'arrayBuffer')
        
        await sock.sendMedia(m.chat, Buffer.from(y), null, m, {
            type: 'image'
        })
        
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
