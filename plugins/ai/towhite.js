const axios = require('axios')
const { uploadImage } = require('../../src/lib/uploader')

const pluginConfig = {
    name: 'towhite',
    alias: ['white', 'putihkan', 'putih', 'toputih'],
    category: 'ai',
    description: 'Ubah gambar ke skin tone lebih cerah/putih',
    usage: '.towhite (reply gambar)',
    example: '.towhite',
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
        return m.reply(`🤍 *ᴡʜɪᴛᴇ sᴛʏʟᴇ*\n\nKyaa~ reply atau kirim gambarnya dulu ya~ Ai tunggu! 🌸\n\n\`${m.prefix}towhite\``)
    }
    
    m.react('⏳')
    
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
        
        // Ganti pakai Axios agar lebih pasti dapet Buffer-nya
        const url = `https://api-faa.my.id/faa/toputih?url=${encodeURIComponent(imageUrl)}`
        const response = await axios.get(url, { responseType: 'arraybuffer' })
        
        if (!response.data) throw new Error("API tidak mengirim data gambar")

        const resultBuffer = Buffer.from(response.data)
        
        m.react('✅')
        
        // Gunakan sendMessage bawaan kalau sendMedia bermasalah
        await sock.sendMessage(m.chat, { 
            image: resultBuffer, 
            caption: `🤍 *ᴡʜɪᴛᴇ sᴛʏʟᴇ*\n\n> Sugoi~! Hasilnya udah jadi, kawaii kan? ⭐` 
        }, { quoted: m })
        
    } catch (error) {
        console.error('[ToWhite Error]', error)
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}