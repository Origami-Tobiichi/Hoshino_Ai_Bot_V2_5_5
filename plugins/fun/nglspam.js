const { f } = require("../../src/lib/undici")

const pluginConfig = {
    name: ['nglspam'],
    alias: ['spamngl'],
    category: 'tools',
    description: 'Generate gambar NGL',
    usage: '.nglspam <username>|<pesan>|<jumlah>',
    example: '.nglspam <username>|<pesan>|<jumlah>',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const [username, pesan, jumlah] = m.text.split('|')
    
    if (!text) {
        return m.reply(
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> \`${m.prefix}spamngl <username>|<pesan>|<jumlah>\`\n\n` +
            `> Contoh: \`${m.prefix}spamngl Sea|Haii|33\``
        )
    }
    
    await m.react('🕕')
    
    try {
        const apiUrl = `https://api.nexray.web.id/tools/spamngl?url=${encodeURIComponent('https://ngl.link/' + username)}&pesan=${encodeURIComponent(pesan)}&jumlah=${encodeURIComponent(jumlah)}`
        const data = await f(apiUrl)
        if(data.status){
            await m.reply('✅ *Yatta~* Success spam ngl~ ✨')
        }else{
            await m.reply('❌ *Ehh~* Failed spam ngl~ 🥺')
        }
        
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
