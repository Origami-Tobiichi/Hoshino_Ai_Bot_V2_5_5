const nanoBanana = require('../../src/scraper/nanobanana')

const pluginConfig = {
    name: 'tooilpainting',
    alias: ['oilpainting', 'tooil', 'oil'],
    category: 'ai',
    description: 'Ubah foto menjadi gaya lukisan minyak (oil painting)',
    usage: '.tooilpainting (reply/kirim gambar)',
    example: '.tooilpainting',
    isOwner: false,
    isPremium: true,
    isGroup: false,
    isPrivate: false,
    cooldown: 60,
    energi: 3,
    isEnabled: true
}

const PROMPT = `Transform this image into a classical oil painting style. 
Apply thick brushstrokes, rich colors, and the texture of traditional oil paint on canvas. 
Keep the original composition but make it look like a masterpiece painting 
with visible brushwork, artistic color blending, and that timeless gallery-quality aesthetic.`

async function handler(m, { sock }) {
    const isImage = m.isImage || (m.quoted && (m.quoted.isImage || m.quoted.type === 'imageMessage'))
    
    if (!isImage) {
        return m.reply(
            `🖼️ *ᴛᴏ ᴏɪʟ ᴘᴀɪɴᴛɪɴɢ*\n\n` +
            `Kyaa~ Ai siap melukis! Reply atau kirim gambarnya dulu ya~ 🌸\n\n` +
            `\`${m.prefix}tooilpainting\``
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
