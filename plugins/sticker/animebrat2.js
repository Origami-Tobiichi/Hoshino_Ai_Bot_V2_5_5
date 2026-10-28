const axios = require('axios')
const config = require('../../config')
const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: 'bratanime2',
    alias: ['animebrat2'],
    category: 'sticker',
    description: 'Membuat sticker brat anime versi 2',
    usage: '.animebrat2 <text>',
    example: '.animebrat2 Hoshino Ai',
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
            `🖼️ *ʙʀᴀᴛ ᴀɴɪᴍᴇ sᴛɪᴄᴋᴇʀ v2*\n\n` +
            `> Masukkan teks\n\n` +
            `\`Contoh: ${m.prefix}animebrat2 Hoshino Ai\``
        )
    }

    m.react('🕕')

    try {
        const url = `https://api.theresav.biz.id/maker/bratanime?text=${encodeURIComponent(text)}&apikey=JpLZ3`

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