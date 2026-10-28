const hsAsset = require('../../src/lib/assets')
const axios = require('axios')
const config = require('../../config')
const path = require('path')
const fs = require('fs')

const NEOXR_APIKEY = config.APIkey?.neoxr || 'Milik-Bot-OurinMD'

const pluginConfig = {
    name: 'emojitoimage',
    alias: ['emoji2img', 'emojiimg', 'e2i'],
    category: 'tools',
    description: 'Konversi emoji ke gambar HD (style Apple)',
    usage: '.emojitoimage <emoji> [style]',
    example: '.emojitoimage 😳 apple',
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

const STYLES = ['apple', 'google', 'microsoft', 'samsung', 'whatsapp', 'twitter', 'facebook']

let thumbTools = null
hsAsset.tryBuffer('images/hsnai-tools').then(b => { if (b) thumbTools = b }).catch(() => {})

function getContextInfo(title, body) {
    const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'

    const ctx = {
        forwardingScore: 9999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: saluranId,
            newsletterName: saluranName,
            serverMessageId: 127
        }
    }


    return ctx
}

async function handler(m, { sock }) {
    const args = m.args || []
    const emoji = args[0]?.trim()
    const style = args[1]?.toLowerCase() || 'apple'
    
    if (!emoji) {
        return m.reply(
            `🖼️ *ᴇᴍᴏᴊɪ ᴛᴏ ɪᴍᴀɢᴇ*\n\n` +
            `> Konversi emoji ke gambar HD\n\n` +
            `*Format:*\n` +
            `> \`${m.prefix}emojitoimage <emoji> [style]\`\n\n` +
            `*Contoh:*\n` +
            `> \`${m.prefix}emojitoimage 😳 apple\`\n\n` +
            `*Style tersedia:*\n` +
            `> ${STYLES.join(', ')}`
        )
    }
    
    const validStyle = STYLES.includes(style) ? style : 'apple'
    
    m.react('🖼️')
    
    try {
        const apiUrl = `https://api.neoxr.eu/api/emoimg?q=${encodeURIComponent(emoji)}&style=${validStyle}&apikey=${NEOXR_APIKEY}`
        const { data } = await axios.get(apiUrl, { timeout: 15000 })
        
        if (!data?.status || !data?.data?.url) {
            m.react('❌')
            return m.reply('❌ *Gomen ne~* ✦\n\n> Emoji tidak ditemukan atau API error~ 🥺')
        }
        
        const imgUrl = data.data.url
        
        await sock.sendMessage(m.chat, {
            image: { url: imgUrl },
            caption: `🖼️ *ᴇᴍᴏᴊɪ ᴛᴏ ɪᴍᴀɢᴇ*\n\n` +
                `> Emoji: ${emoji}\n` +
                `> Style: ${validStyle}\n` +
                `> Code: ${data.data.code || '-'}`,
            contextInfo: getContextInfo('🖼️ EMOJI IMAGE', `${emoji} - ${validStyle}`)
        }, { quoted: m })
        
        m.react('✅')
        
    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
