const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: 'bratcewek2',
    alias: ['cewekbrat2', 'bratperempuan2', 'bratgirl2'],
    category: 'sticker',
    description: 'Membuat sticker brat cewek versi 2',
    usage: '.bratcewek2 <text>',
    example: '.bratcewek2 Hai semua',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.args.join(' ')

    if (!text) {
        return m.reply(
            `🖼️ *ʙʀᴀᴛ cᴇᴡᴇᴋ sᴛɪᴄᴋᴇʀ v2*\n\n` +
            `> Masukkan teks\n\n` +
            `\`Contoh: ${m.prefix}bratcewek2 Hai semua\``
        )
    }

    m.react('🕕')

    try {
        const url = `https://api.theresav.biz.id/maker/bratcewe?text=${encodeURIComponent(text)}&apikey=JpLZ3`

        await sock.sendImageAsSticker(
            m.chat,
            url,
            m,
            {
                packname: config.sticker.packname,
                author: config.sticker.author
            }
        )

        m.react('✅')
    } catch (error) {
        console.error(error)

        m.react('❌')
        m.reply(
            `❌ *ᴇʀʀᴏʀ*\n\n` +
            `> ${error.message}`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}