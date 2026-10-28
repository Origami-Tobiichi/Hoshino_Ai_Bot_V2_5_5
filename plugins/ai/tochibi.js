const { uploadImage } = require('../../src/lib/uploader')
const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: 'tochibi',
    alias: ['chibi', 'chibistyle'],
    category: 'ai',
    description: 'Ubah gambar ke style Chibi',
    usage: '.tochibi (reply gambar)',
    example: '.tochibi',
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
        return m.reply(`🎀 *ᴄʜɪʙɪ sᴛʏʟᴇ*\n\nKyaa~ Ai mau bikin kamu jadi chibi yang imut! Reply atau kirim gambarnya dulu ya~ 🌸\n\n\`${m.prefix}tochibi\``)
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
        
        const url = `https://api-faa.my.id/faa/tochibi?url=${encodeURIComponent(imageUrl)}`
        const res = await f(url, 'arrayBuffer')
        
        m.react('✅')
        
        await sock.sendMedia(m.chat, Buffer.from(res), null, m, {
            type: 'image'
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
