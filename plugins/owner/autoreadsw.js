const { getDatabase } = require('../../src/lib/database.js')

const pluginConfig = {
    name: 'autoreadsw',
    alias: ['autoreadstory', 'readstory', 'bacasw'],
    category: 'owner',
    description: 'Auto read semua status/story WA',
    usage: '.autoreadsw on/off',
    example: '.autoreadsw on',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m) {
    const db = getDatabase()
    const action = (m.args?.[0] || '').toLowerCase()
    const current = db.setting('autoReadSW') || { enabled: false }

    if (!action) {
        return m.reply(
            `👁️ *ʜᴏsʜɪɴᴏ ᴀɪ sᴛᴏʀʏ ʀᴇᴀᴅ*\n\n` +
            `"Mau tau aku lagi baca story orang atau nggak?" 🌟\n\n` +
            `> Status: *${current.enabled ? '✅ ON' : '❌ OFF'}*\n\n` +
            `*ᴄᴀʀᴀ ᴘᴀᴋᴀɪ:*\n` +
            `> \`${m.prefix}autoreadsw on\` — Aktifkan\n` +
            `> \`${m.prefix}autoreadsw off\` — Matikan`
        )
    }

    if (action === 'on') {
        db.setting('autoReadSW', { enabled: true })
        db.save()
        await m.react('⭐')
        await m.react('✅')
        return m.reply(
            `✅ *ᴀᴜᴛᴏ ʀᴇᴀᴅ sᴛᴏʀʏ ᴀᴋᴛɪꜰ*\n\n` +
            `"Siap! Semua story bakal aku baca ya~" 💖`
        )
    }

    if (action === 'off') {
        db.setting('autoReadSW', { enabled: false })
        db.save()
        await m.react('✅')
        return m.reply(
            `❌ *ᴀᴜᴛᴏ ʀᴇᴀᴅ sᴛᴏʀʏ ᴅɪᴍᴀᴛɪᴋᴀɴ*\n\n` +
            `"Oke, aku nggak ngintip story orang dulu ya..." 😴`
        )
    }

    return m.reply(
        `💔 *ᴇʀʀᴏʀ ᴘᴀɴɢɢᴜɴɢ*\n\n` +
        `"Eh, itu apa? Aku nggak ngerti~" 🎤\n\n` +
        `> Gunakan \`on\` atau \`off\` ya, Sayang!`
    )
}

module.exports = { config: pluginConfig, handler }