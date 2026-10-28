const nanoBanana = require('../../src/scraper/nanobanana')

const pluginConfig = {
    name: 'tocartoon',
    alias: ['cartoon', 'cartoonify', 'tooncartoon'],
    category: 'ai',
    description: 'Ubah foto menjadi gaya kartun',
    usage: '.tocartoon (reply/kirim gambar)',
    example: '.tocartoon',
    isOwner: false,
    isPremium: true,
    isGroup: false,
    isPrivate: false,
    cooldown: 60,
    energi: 3,
    isEnabled: true
}

const PROMPT = `Transform this image into a vibrant cartoon style like Disney or Pixar animation. 
Apply bold colors, smooth shading, exaggerated features, and that playful cartoon aesthetic. 
Keep the original composition but make it look like a frame from an animated movie with 
clean lines, expressive faces, and bright cheerful colors.`

async function handler(m, { sock }) {
    const isImage = m.isImage || (m.quoted && (m.quoted.isImage || m.quoted.type === 'imageMessage'))
    
    if (!isImage) {
        return m.reply(
            `🎬 *ᴛᴏ ᴄᴀʀᴛᴏᴏɴ*\n\n` +
            `Kyaa~ mau jadi tokoh kartun? Reply atau kirim gambarnya dulu ya, Ai siap gambar~ 🌸\n\n` +
            `\`${m.prefix}tocartoon\``
        )
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
        
        const result = await nanoBanana(buffer, PROMPT)
        
        m.react('✅')
        
        await sock.sendMedia(m.chat, result, null, m, {
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
