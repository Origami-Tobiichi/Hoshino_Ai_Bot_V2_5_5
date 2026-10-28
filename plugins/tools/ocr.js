const hsAsset = require('../../src/lib/assets')
const config = require('../../config')
const path = require('path')
const fs = require('fs')
const Tesseract = require('tesseract.js')

const pluginConfig = {
    name: 'ocr',
    alias: ['totext', 'imagetotext', 'readtext'],
    category: 'tools',
    description: 'Extract teks dari gambar (Offline/Local)',
    usage: '.ocr (reply gambar)',
    example: '.ocr',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

let thumbTools = null
hsAsset.tryBuffer('images/hsnai-games').then(b => { if (b) thumbTools = b }).catch(() => {})

function getContextInfo(title = '📖 *ᴏᴄʀ*', body = 'Text extraction') {
    const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'
    
    const contextInfo = {
        forwardingScore: 9999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: saluranId,
            newsletterName: saluranName,
            serverMessageId: 127
        }
    }
    
    
    return contextInfo
}

async function handler(m, { sock }) {
    const isImage = m.isImage || (m.quoted && m.quoted.type === 'imageMessage')

    if (!isImage) {
        return m.reply(
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> Reply gambar dengan \`${m.prefix}ocr\`\n\n` +
            `> Media yang didukung:\n` +
            `> JPG, PNG, GIF, WEBP`
        )
    }
    
    await m.react('🕕')
    await m.reply(`🕕 *ᴍᴇᴍᴘʀᴏsᴇs...*\n\n> Mengekstrak teks dari gambar...`)
    
    try {
        let buffer
        if (m.quoted && m.quoted.isMedia) {
            buffer = await m.quoted.download()
        } else if (m.isMedia) {
            buffer = await m.download()
        }

        if (!buffer || buffer.length === 0) {
            await m.react('❌')
            return m.reply(`❌ *Gomen ne~* ✦\n\n> Tidak dapat download gambar~ 🥺`)
        }
        
        const { data: { text } } = await Tesseract.recognize(buffer, 'eng', {
        })
        
        const extractedText = text ? text.trim() : ''
        
        if (!extractedText || extractedText.length === 0) {
            await m.react('❌')
            return m.reply(`❌ *ᴛɪᴅᴀᴋ ᴀᴅᴀ ᴛᴇᴋs*\n\n> Tidak ada teks yang terdeteksi di gambar`)
        }
        
        await m.react('✅')
        
        const responseText = `📖 *ᴏᴄʀ ʀᴇsᴜʟᴛ*\n\n` +
            `╭┈┈⬡「 📝 *ᴛᴇᴋs* 」\n` +
            `${extractedText.split('\n').map(l => `┃ ${l}`).join('\n')}\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> Total: ${extractedText.length} karakter`
        
        await sock.sendMessage(m.chat, {
            text: responseText,
            contextInfo: getContextInfo('📖 *ᴏᴄʀ*', `${extractedText.length} chars`)
        }, { quoted: m })
        
    } catch (e) {
        await m.react('❌')
        await m.reply(`❌ *Gomen ne~* ✦\n\n> ${e.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
