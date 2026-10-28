const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: 'tobrooklyn',
    alias: ['brooklyn', 'filterbrooklyn'],
    category: 'canvas',
    description: 'Membuat filter Brooklyn pada gambar',
    usage: '.tobrooklyn (reply gambar)',
    example: '.tobrooklyn',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function uploadToTmpfiles(buffer) {
    const FormData = require('form-data')
    const formData = new FormData()
    formData.append('file', buffer, { filename: 'image.jpg' })
    
    const res = await axios.post('https://tmpfiles.org/api/v1/upload', formData, {
        headers: formData.getHeaders(),
        timeout: 60000
    })
    
    if (res.data?.data?.url) {
        return res.data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
    }
    throw new Error('Upload gagal')
}

async function handler(m, { sock }) {
    const isImage = m.isImage || (m.quoted && m.quoted.type === 'imageMessage')
    
    if (!isImage) {
        return m.reply(
            `🌁 *ʙʀᴏᴏᴋʟʏɴ ꜰɪʟᴛᴇʀ*\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
            `┃ ◦ Reply gambar dengan \`${m.prefix}tobrooklyn\`\n` +
            `┃ ◦ Kirim gambar dengan caption \`${m.prefix}tobrooklyn\`\n` +
            `╰┈┈⬡`
        )
    }
    
    m.react('🌁')
    
    try {
        let buffer
        if (m.quoted && m.quoted.isMedia) {
            buffer = await m.quoted.download()
        } else if (m.isMedia) {
            buffer = await m.download()
        }
        
        if (!buffer || buffer.length === 0) {
            throw new Error('Gagal download gambar')
        }
        
        const imageUrl = await uploadToTmpfiles(buffer)
        const apiKey = config.APIkey?.lolhuman
        
        if (!apiKey) {
            throw new Error('API Key tidak ditemukan di config')
        }
        
        const apiUrl = `https://api.lolhuman.xyz/api/filter/brooklyn?apikey=${apiKey}&img=${encodeURIComponent(imageUrl)}`
        
        await sock.sendMedia(m.chat, apiUrl, null, m, {
            type: 'image',
        })
        
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
