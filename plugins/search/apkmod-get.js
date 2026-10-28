const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: 'apkmod-get',
    alias: ['apkmodget', 'getapkmod'],
    category: 'search',
    description: 'Download APK MOD dari hasil pencarian',
    usage: '.apkmod-get <no> <query>',
    example: '.apkmod-get 1 vpn',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 1,
    isEnabled: true
}

const NEOXR_APIKEY = config.APIkey?.neoxr || 'Milik-Bot-OurinMD'

async function handler(m, { sock }) {
    const args = m.args || []
    const no = parseInt(args[0])
    const query = args.slice(1).join(' ')
    
    if (!no || !query) {
        return m.reply(`❌ *Ehh~* Format: \`${m.prefix}apkmod-get <no> <query>\``)
    }
    
    m.react('📥')
    
    try {
        const { data } = await axios.get(`https://api.neoxr.eu/api/apkmod?q=${encodeURIComponent(query)}&no=${no}&apikey=${NEOXR_APIKEY}`, {
            timeout: 60000
        })
        
        if (!data?.status || !data?.data) {
            throw new Error('Gagal mengambil detail APK')
        }
        
        const app = data.data
        const file = data.file
        
        const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
        const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'
        
        let caption = `📱 *ᴀᴘᴋ ᴍᴏᴅ ᴅᴏᴡɴʟᴏᴀᴅ*\n\n`
        caption += `╭┈┈⬡「 📋 *ɪɴꜰᴏ* 」\n`
        caption += `┃ 📛 *${app.name}*\n`
        caption += `┃ 👤 ${app.author}\n`
        caption += `┃ 📂 ${app.category}\n`
        caption += `┃ 📦 ${app.size}\n`
        caption += `┃ 🏷️ ${app.version}\n`
        caption += `┃ 🔓 ${app.mod}\n`
        caption += `┃ 💰 ${app.price}\n`
        caption += `┃ 📅 ${app.publish}\n`
        caption += `╰┈┈⬡\n\n`
        
        if (file?.url) {
            caption += `> 📥 Mengirim file APK...`
            
            await sock.sendMessage(m.chat, {
                text: caption,
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
            
            await sock.sendMessage(m.chat, {
                document: { url: file.url?.trim() },
                fileName: file.filename || `${app.name}.apk`,
                mimetype: 'application/vnd.android.package-archive',
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
            
            m.react('✅')
        } else {
            caption += `> ⚠️ File APK tidak tersedia`
            
            await sock.sendMessage(m.chat, {
                text: caption,
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
            
            m.react('⚠️')
        }
        
    } catch (err) {
        m.react('❌')
        return m.reply(`❌ *Gomen ne~* ✦\n\n> ${err.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
