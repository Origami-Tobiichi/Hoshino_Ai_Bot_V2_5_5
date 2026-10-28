const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: 'brat',
    alias: ['brattext'],
    category: 'sticker',
    description: 'Membuat sticker brat',
    usage: '.brat <text>',
    example: '.brat Hai semua',
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.args.join(' ')
    if (!text) {
        return m.reply(`🖼️ *ʙʀᴀᴛ sᴛɪᴄᴋᴇʀ*\n\n> Masukkan teks\n\n\`Contoh: ${m.prefix}brat Hai semua\``)
    }

    m.react('🕕')

    // 🔥 list API (utama + fallback)
    const apis = [
        `https://api.zenzxz.my.id/maker/brat?text=${encodeURIComponent(text)}`,
        `https://api-faa.my.id/faa/brat?text=${encodeURIComponent(text)}`
    ]

    let success = false

    for (let url of apis) {
        try {
            await sock.sendImageAsSticker(m.chat, url, m, {
                packname: config.sticker.packname,
                author: config.sticker.author
            })

            success = true
            break
        } catch (err) {
            console.log('API gagal:', url)
        }
    }

    if (success) {
        m.react('✅')
    } else {
        m.react('❌')
        m.reply('❌ *Gomen ne~* Semua API brat gagal, coba lagi nanti~ 🥺')
    }
}

module.exports = {
    config: pluginConfig,
    handler
}