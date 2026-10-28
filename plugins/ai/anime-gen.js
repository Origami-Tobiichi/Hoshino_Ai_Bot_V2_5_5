const { f } = require('../../src/lib/undici')
const config = require('../../config')

const pluginConfig = {
    name: 'anime-gen',
    alias: ['animegen', 'aianimegen', 'genai-anime'],
    category: 'ai',
    description: 'Generate AI anime art dari prompt',
    usage: '.anime-gen <prompt>',
    example: '.anime-gen girl, vibrant color, smilling',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const prompt = m.text
    
    if (!prompt) {
        return m.reply(
            `🎨 *ᴀɴɪᴍᴇ ᴀʀᴛ ɢᴇɴᴇʀᴀᴛᴏʀ*\n\n` +
            `Kyaa~ Ai bakal gambarin anime sesuai keinginanmu! Kasih deskripsinya dulu ya~ 🌸\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
            `┃ \`${m.prefix}anime-gen <deskripsi>\`\n` +
            `╰┈┈⬡\n\n` +
            `╭┈┈⬡「 💡 *ᴄᴏɴᴛᴏʜ* 」\n` +
            `┃ \`${m.prefix}anime-gen girl, vibrant color, smilling, yellow pink gradient hair\`\n` +
            `┃ \`${m.prefix}anime-gen boy, dark aesthetic, silver hair, red eyes\`\n` +
            `╰┈┈⬡\n\n` +
            `╭┈┈⬡「 ✨ *ᴛɪᴘs* 」\n` +
            `┃ • Pakai bahasa Inggris ya~\n` +
            `┃ • Makin detail prompt, makin bagus hasilnya\n` +
            `┃ • Tambahin style: vibrant, dark, pastel, dll\n` +
            `╰┈┈⬡`
        )
    }
    
    m.react('🎨')

    try {
        const NEOXR_APIKEY = config.APIkey?.neoxr || 'Milik-Bot-OurinMD'
        const apiUrl = `https://api.neoxr.eu/api/ai-anime?q=${encodeURIComponent(prompt)}&apikey=${NEOXR_APIKEY}`
        
        const data = await f(apiUrl)
        
        if (!data?.status || !data?.data?.url) {
            m.react('❌')
            return m.reply('❌ *Ara ara~*\n\n> Ai gagal generate gambarnya nih... coba lagi nanti ya~ 🥺')
        }
        
        const result = data.data  
        await sock.sendMedia(m.chat, result.url, null, m, {
            type: 'image'
        })
        m.react('✅')
    } catch (error) {
        m.react('❌')
        if (error.code === 'ECONNABORTED') {
            m.reply('⏱️ *Yah, kelamaan~*\n\n> Ai nunggu kelamaan nih... coba lagi ya~ 🌸')
        } else {
            m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
        }
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
