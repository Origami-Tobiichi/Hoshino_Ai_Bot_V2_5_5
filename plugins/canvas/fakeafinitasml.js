const axios = require('axios')
const config = require('../../config')
const { uploadToTmpFiles } = require('../../src/lib/sea')

const pluginConfig = {
    name: 'afinitasml',
    alias: ['fakeafinitasml'],
    category: 'canvas',
    description: 'Membuat gambar afinitas ml',
    usage: '.fakeafinitasml <text>',
    example: '.fakeafinitasml Hai cantik',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
     const isImage = m.isImage || (m.quoted && m.quoted.isImage)
        
        if (!isImage) {
            m.react('❌')
            return m.reply(
                `📷 *FAKE AFINITAS ML*\n\n` +
                `Tolong Reply gambar nya`
            )
        }
        
        let imageBuffer
        if (m.isImage && m.download) {
            imageBuffer = await m.download()
        } else if (m.quoted && m.quoted.isImage && m.quoted.download) {
            imageBuffer = await m.quoted.download()
        }
        
        if (!imageBuffer) {
            m.react('❌')
            return m.reply(`❌ *Gomen ne~* ✦\n\n> Tidak bisa download gambar~ 🥺`)
        }
    
    m.react('🕕')
    
    try {
        const gmbr = await uploadToTmpFiles(imageBuffer, {
            filename: 'image.jpg',
            contentType: 'image/jpeg'
        })
        await sock.sendMedia(m.chat, `https://kazztzyy.my.id/api/maker/afinitasml?image=${encodeURIComponent(gmbr.directUrl)}`, null, m, {
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
