const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: 'bingimage',
    alias: ['imagesearch', 'carigambar', 'bingimg'],
    category: 'search',
    description: 'Cari artwork di Pixiv',
    usage: '.carigambar <query>',
    example: '.carigambar rem',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 2,
    isEnabled: true
}

async function handler(m, { sock }) {
    try {
        const query = m.text
        
        if (!query) {
            return m.reply(`❌ *Masukkan kata kunci pencarian!*\n\n> Contoh: ${m.prefix}carigambar rem`)
        }
        
        await m.react('🔍')
        
        const apikey = config.APIkey?.neoxr || 'Milik-Bot-OurinMD'
        const url = `https://api-faa.my.id/faa/google-image?query=${encodeURIComponent(query)}&apikey=${apikey}`
        
        const response = await axios.get(url, { timeout: 30000 })
        const data = response.data
        
        if (!data.status) {
            await m.react('❌')
            return m.reply(`❌ *Tidak ditemukan hasil untuk:* ${query}`)
        }
        const results = data.result
        const album = await Promise.all(
        results.map(async (url) => {
            const res = await axios.get(url, { responseType: "arraybuffer" })
            return {
            image: Buffer.from(res.data)
            }
        })
        )
        await sock.sendMessage(m.chat, {
            albumMessage: album
        }, { quoted: m })
        
    } catch (error) {
        await m.react('❌')
        return m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
