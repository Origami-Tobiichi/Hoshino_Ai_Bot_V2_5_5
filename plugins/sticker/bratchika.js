const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: 'bratchika',
    alias: ['chikabrat'],
    category: 'sticker',
    description: 'Membuat sticker brat chika',
    usage: '.chikabrat <text>',
    example: '.chikabrat Hai semua',
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
            `🖼️ *ʙʀᴀᴛ ᴄʜɪᴋᴀ sᴛɪᴄᴋᴇʀ*\n\n` +
            `> Masukkan teks\n\n` +
            `\`Contoh: ${m.prefix}chikabrat Hai semua\``
        )
    }

    m.react('🕕')

    try {
        const mainUrl = `https://kazztzyy.my.id/api/maker/bratchika?text=${encodeURIComponent(text)}`

        await sock.sendImageAsSticker(
            m.chat,
            mainUrl,
            m,
            {
                packname: config.sticker.packname,
                author: config.sticker.author
            }
        )

        m.react('✅')

    } catch (err) {
        try {
            const fallbackUrl = `https://api.theresav.biz.id/maker/bratchika?text=${encodeURIComponent(text)}&apikey=JpLZ3`

            await sock.sendImageAsSticker(
                m.chat,
                fallbackUrl,
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
}

module.exports = {
    config: pluginConfig,
    handler
}