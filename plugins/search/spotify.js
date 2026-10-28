const { default: axios } = require("axios")

const pluginConfig = {
    name: 'spotify',
    alias: ['spotifysearch', 'spsearch'],
    category: 'search',
    description: 'Cari lagu di Spotify',
    usage: '.spotify <query>',
    example: '.spotify neffex grateful',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m) {
    const query = m.text?.trim()

    if (!query) {
        return m.reply(
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> \`${m.prefix}spotify <query>\`\n\n` +
            `> Contoh:\n` +
            `> \`${m.prefix}spotify neffex grateful\``
        )
    }

    try {
        const res = await axios.get(`https://api.emiliabot.my.id/search/spotify?query=${encodeURIComponent(query)}`)
        const results = res.data
        if (!results.status) {
            return m.reply(`❌ *Gomen ne~* ✦\n\n> Tidak ditemukan hasil untuk *${query}*~ 🥺`)
        }

        const tracks = results.result

        let txt = `🎵 *sᴘᴏᴛɪꜰʏ sᴇᴀʀᴄʜ*\n\n`
        txt += `> Query: *${query}*\n\n`

        tracks.forEach((t, i) => {
            txt += `*${i + 1}.* ${t.title}\n`
            txt += `   ├ 👤 ${t.artist}\n`
            txt += `   ├ 🔗 ${t.link}\n`
            txt += `   ├ 🖼️ ${t.popularity}\n\n`
        })

        txt += `> 💡 Download: \`${m.prefix}spdl <url / id>\` atau \`${m.prefix}spotplay ${query}\``

        return m.reply(txt.trim())
    } catch (err) {
        return m.reply(`❌ *Gomen ne~* ✦\n\n> ${err.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
