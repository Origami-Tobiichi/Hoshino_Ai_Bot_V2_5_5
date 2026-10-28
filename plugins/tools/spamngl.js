const axios = require('axios')

const pluginConfig = {
    name: 'sendngl',
    alias: [],
    category: 'tools',
    description: 'Send NGL',
    usage: '.sendngl <url> | <text>',
    example: '.sendngl https://ngl.link/xxxx | hai',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.text?.split('|')
    const [ link, kata, jumlah ] = text
    if(!link) return m.reply(`*LINK NGL NYA MANA ??*\nContoh: \`${m?.prefix}sendngl https://ngl.link/xxxx | hai`)
    if(!kata) return m.reply(`*KATA KATA NYA MANA ??*\n\nContoh: \`${m?.prefix}sendngl https://ngl.link/xxxx | hai`)
    if(!jumlah) return m.reply(`*JUMLAH NYA MANA ??*\n\nContoh: \`${m?.prefix}sendngl https://ngl.link/xxxx | hai | 10`)
    if(isNaN(jumlah)) return m.reply(`*JUMLAH NYA HARUS ANGKA*\n\nContoh: \`${m?.prefix}sendngl https://ngl.link/xxxx | hai | 10`)
    m.react('🎴')
    
    try {
        for(let i = 0; i < jumlah; i++) {
            axios.get(`https://api.cuki.biz.id/api/tools/sendngl?apikey=cuki-x&link=${encodeURIComponent(link)}&text=${encodeURIComponent(kata)}`, {
                timeout: 30000
            })
            await new Promise(resolve => setTimeout(resolve, 4000))
        }
        await m.react('✅')
        await sock.sendMessage(m.chat, {
            text: `✅ *DONE*`,
            contextInfo: {
            }
        }, { quoted: m })
        
        await sock.sendMessage(m.chat, {
            text: shortUrl,
            interactiveMessage: {
                body: { text: `🔗 *ʙɪᴛʟʏ sʜᴏʀᴛʟɪɴᴋ*\n\n${shortUrl}` },
                nativeFlowMessage: {
                    buttons: [
                        {
                            name: 'cta_copy',
                            buttonParamsJson: JSON.stringify({
                                display_text: '📋 Copy Link',
                                copy_code: shortUrl
                            })
                        }
                    ]
                }
            }
        })
        
    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
