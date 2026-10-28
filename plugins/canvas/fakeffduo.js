const axios = require('axios')

const pluginConfig = {
    name: 'fakeffduo',
    alias: ['fakeff2', 'ffduo'],
    category: 'canvas',
    description: 'Membuat gambar ff duo',
    usage: '.fakeffduo <user1>|<user2>',
    example: '.fakeffduo Qynox|Sea',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const prefix = m.prefix
    const command = m.command || pluginConfig.name

    if (!m.text) {
        return m.reply(
            `*ꜰᴀᴋᴇ ꜰꜰ ᴅᴜᴏ*\n\n> Contoh: ${prefix}${command} nama1|nama2`
        )
    }

    const [nama1, nama2] = m.text.split('|').map(v => v?.trim())
    if (!nama1 || !nama2) {
        return m.reply(
            `*ꜰᴀᴋᴇ ꜰꜰ ᴅᴜᴏ*\n\n> Contoh: ${prefix}${command} nama1|nama2`
        )
    }

    m.react('🕕')

    try {
        const url = `https://apiii-xrina.my.id/canvas/fakeffduo?name1=${encodeURIComponent(nama1)}&name2=${encodeURIComponent(nama2)}`
        const { data } = await axios.get(url, { responseType: 'arraybuffer' })

        await sock.sendMedia(m.chat, Buffer.from(data), null, m, {
            type: 'image',
            caption:
                `*ꜰᴀᴋᴇ ꜰꜰ ᴅᴜᴏ*\n\n` +
                `👤 *P1:* ${nama1}\n` +
                `👤 *P2:* ${nama2}`
        })

        m.react('✅')

    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}