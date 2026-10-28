const hsAsset = require('../../src/lib/assets')
const axios = require('axios')
const config = require('../../config')
const path = require('path')
const fs = require('fs')

const NEOXR_APIKEY = config.APIkey?.neoxr || 'Milik-Bot-OurinMD'

const pluginConfig = {
    name: 'emojitoanimasi',
    alias: ['emoji2sticker', 'emojisticker', 'e2s'],
    category: 'tools',
    description: 'Konversi emoji ke sticker animasi',
    usage: '.emojitoanimasi <emoji>',
    example: '.emojitoanimasi 😳',
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

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
    const emoji = m.text?.trim()
    
    if (!emoji) {
        return m.reply(
            `🎭 *ᴇᴍᴏᴊɪ ᴛᴏ ᴀɴɪᴍᴀsɪ*\n\n` +
            `> Konversi emoji ke sticker animasi\n\n` +
            `*Contoh:*\n` +
            `> \`${m.prefix}emojitoanimasi 😳\``
        )
    }
    
    m.react('🎭')
    
    try {
        const apiUrl = `https://api.neoxr.eu/api/emojito?q=${encodeURIComponent(emoji)}&apikey=${NEOXR_APIKEY}`
        const { data } = await axios.get(apiUrl, { timeout: 15000 })
        
        if (!data?.status || !data?.data?.url) {
            m.react('❌')
            return m.reply('❌ *Gomen ne~* ✦\n\n> Emoji tidak ditemukan atau API error~ 🥺')
        }
        
        const webpUrl = data.data.url
        
        const webpRes = await axios.get(webpUrl, { 
            responseType: 'arraybuffer',
            timeout: 15000 
        })
        const webpBuffer = Buffer.from(webpRes.data)
        
        await sock.sendMessage(m.chat, {
            sticker: webpBuffer,
            contextInfo: getContextInfo('🎭 EMOJI STICKER', emoji)
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
