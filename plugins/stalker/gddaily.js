const axios = require('axios')

const pluginConfig = {
    name: 'gddaily',
    alias: ['gdweekly', 'gdevent', 'dailygd', 'weeklygd'],
    category: 'stalker',
    description: 'Cek level Daily/Weekly Geometry Dash hari ini',
    usage: '.gddaily | .gdweekly',
    example: '.gddaily',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const DIFFICULTY_EMOJI = {
    'Auto': '🔵',
    'Easy': '🟢',
    'Normal': '🟡',
    'Hard': '🟠',
    'Harder': '🔴',
    'Insane': '🟣',
    'Easy Demon': '😈',
    'Medium Demon': '😈',
    'Hard Demon': '👿',
    'Insane Demon': '💀',
    'Extreme Demon': '☠️',
    'Demon': '😈',
    'NA': '⬜'
}

const LENGTH_LABEL = {
    'Tiny': 'Tiny',
    'Short': 'Short',
    'Medium': 'Medium',
    'Long': 'Long',
    'XL': 'XL',
    'Platformer': 'Platformer'
}

function buildLevelCaption(data, type) {
    const typeEmoji = type === 'daily' ? '📅' : type === 'weekly' ? '📆' : '🎉'
    const typeLabel = type === 'daily' ? 'ᴅᴀɪʟʏ' : type === 'weekly' ? 'ᴡᴇᴇᴋʟʏ' : 'ᴇᴠᴇɴᴛ'
    const diffEmoji = DIFFICULTY_EMOJI[data.difficulty] || '⬜'
    const lengthLabel = LENGTH_LABEL[data.length] || data.length || '-'

    return (
        `『 🌟 *ʜᴏsʜɪɴᴏ ᴀɪ* — ɢᴇᴏᴍᴇᴛʀʏ ᴅᴀsʜ 🌟 』\n` +
        `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
        `${typeEmoji} *ʟᴇᴠᴇʟ ${typeLabel} ʜᴀʀɪ ɪɴɪ*\n` +
        `┌─────────────────\n` +
        `│ 🎮 *Nama:*       ${data.name || '-'}\n` +
        `│ 👤 *Creator:*    ${data.author || '-'}\n` +
        `│ 🆔 *Level ID:*   ${data.id || '-'}\n` +
        `│ ${diffEmoji} *Difficulty:* ${data.difficulty || '-'}\n` +
        `│ ⭐ *Stars:*      ${data.stars || '0'}\n` +
        `│ 🪙 *Coins:*      ${data.coins || '0'} ${data.verifiedCoins ? '✅' : ''}\n` +
        `│ 📏 *Length:*     ${lengthLabel}\n` +
        `│ ⬇️ *Downloads:*  ${data.downloads?.toLocaleString('id-ID') || '-'}\n` +
        `│ ❤️ *Likes:*      ${data.likes?.toLocaleString('id-ID') || '-'}\n` +
        `│ 🎵 *Song:*       ${data.songName || '-'}\n` +
        `│ 🎤 *Artist:*     ${data.songAuthor || '-'}\n` +
        `│ 🏛️ *Objects:*    ${data.objects?.toLocaleString('id-ID') || '-'}\n` +
        (data.demonList ? `│ 👹 *Demon List:* #${data.demonList}\n` : '') +
        `└─────────────────\n\n` +
        `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
        `🌸 *Hoshino Ai Bot* ✨\n` +
        `> 「 *推しの子* 」\n` +
        `> Ai selalu ada buat kamu~ 💖⭐`
    )
}

async function fetchLevel(type) {
    let url
    if (type === 'daily') url = 'https://gdbrowser.com/api/level/daily'
    else if (type === 'weekly') url = 'https://gdbrowser.com/api/level/weekly'
    else url = 'https://gdbrowser.com/api/level/event'

    const { data } = await axios.get(url, { timeout: 20000 })
    if (!data || data === '-1') throw new Error('Level tidak ditemukan')
    return data
}

async function handler(m, { sock }) {
    const cmd = m.command?.toLowerCase()

    let type = 'daily'
    if (cmd === 'gdweekly' || cmd === 'weeklygd') type = 'weekly'
    else if (cmd === 'gdevent') type = 'event'

    m.react('⭐')

    try {
        const data = await fetchLevel(type)
        const caption = buildLevelCaption(data, type)

        // Coba ambil thumbnail dari gdbrowser
        const thumbUrl = data.id
            ? `https://gdbrowser.com/assets/levels/${data.id}.png`
            : null

        if (thumbUrl) {
            try {
                await sock.sendMessage(
                    m.chat,
                    { image: { url: thumbUrl }, caption },
                    { quoted: m }
                )
                m.react('✅')
                return
            } catch {
                // fallback ke teks
            }
        }

        await m.reply(caption)
        m.react('✅')

    } catch (err) {
        m.react('❌')
        m.reply(
            `『 💥 *E R R O R* 』\n\n` +
            `> ${err?.message || 'Unknown error'}\n\n` +
            `> 💔 Maaf ya~ Ai gagal kali ini...\n` +
            `> Coba lagi nanti ya~ 🌸`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}