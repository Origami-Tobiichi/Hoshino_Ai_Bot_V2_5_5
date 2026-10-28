const config = require('../../config')
const { getVideoInfo } = require('../../src/scraper/downr')

const pluginConfig = {
    name: 'aio',
    alias: ['allinone', 'download', 'dl'],
    category: 'downloader',
    description: 'All in one downloader (IG, TikTok, FB, Twitter, dll)',
    usage: '.aio <url>',
    example: '.aio https://instagram.com/p/xxx',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const url = m.text?.trim()

    if (!url) {
        return m.reply(
            `📥 *ᴀʟʟ ɪɴ ᴏɴᴇ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ*\n\n` +
            `> Download dari berbagai platform!\n\n` +
            `╭┈┈⬡「 🌐 *ᴘʟᴀᴛꜰᴏʀᴍ* 」\n` +
            `┃ • Instagram\n` +
            `┃ • TikTok\n` +
            `┃ • Facebook\n` +
            `┃ • Twitter/X\n` +
            `┃ • YouTube\n` +
            `┃ • Dan lainnya...\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> *Contoh:* ${m.prefix}aio https://instagram.com/p/xxx`
        )
    }

    if (!url.startsWith('http')) {
        return m.reply(`❌ *Ehh~* URL tidak valid! Harus dimulai dengan http/https~ 🥺`)
    }

    await m.react('🕕')

    try {
        const result = await getVideoInfo(url)

        const media = result.medias.find(v => v.type === 'video') || result.medias[0]
        if (!media) {
            await m.react('❌')
            return m.reply(`❌ *Gomen ne~* ✦\n\n> Video/media tidak ditemukan dari URL tersebut~ 🥺`)
        }

        const caption =
            `🎬 *${result.title || 'Tanpa judul'}*\n` +
            `👤 ${result.author || '-'}\n` +
            (result.duration ? `📌 ${result.duration}\n` : '')

        const contextInfo = {
            forwardingScore: 99,
            isForwarded: true
        }

        const type = media.type === 'image' ? 'image' : 'video'

        await sock.sendMessage(m.chat, {
            [type]: { url: media.url },
            caption,
            contextInfo
        }, { quoted: m })

        await m.react('✅')
    } catch (err) {
        await m.react('❌')
        return m.reply(`❌ *Gomen ne~* ✦\n\n> ${err.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}