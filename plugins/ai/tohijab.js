const axios = require('axios')
const { uploadImage } = require('../../src/lib/uploader')
const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: 'tohijab',
    alias: ['hijab', 'hijabstyle', 'addhijab'],
    category: 'ai',
    description: 'Tambahkan hijab ke gambar',
    usage: '.tohijab (reply gambar)',
    example: '.tohijab',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 2,
    isEnabled: true
}

async function handler(m, { sock }) {
    const isImage = m.isImage || (m.quoted && m.quoted.type === 'imageMessage')
    
    if (!isImage) {
        return m.reply(`🧕 *ʜɪᴊᴀʙ sᴛʏʟᴇ*\n\nReply atau kirim gambarnya dulu ya~ Nanti Ai bantu ubah ke style hijab 🌸\n\n\`${m.prefix}tohijab\``)
    }
    
    m.react('🕕')
    
    try {
        let buffer
        if (m.quoted && m.quoted.isMedia) {
            buffer = await m.quoted.download()
        } else if (m.isMedia) {
            buffer = await m.download()
        }
        
        if (!buffer) {
            m.react('❌')
            return m.reply(`❌ *Ara ara~*\n\n> Ai gagal download gambarnya nih... coba lagi ya~ 🥺`)
        }
        
        const imageUrl = await uploadImage(buffer, 'image.jpg')
        
        const url = `https://api-faa.my.id/faa/tohijab?url=${encodeURIComponent(imageUrl)}`
        const res = await f(url, 'arrayBuffer')
        
        m.react('✅')
        
        await sock.sendMedia(m.chat, Buffer.from(res), null, m, {
            type: 'image',
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
