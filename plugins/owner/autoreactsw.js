const { getDatabase } = require('../../src/lib/database.js')

const pluginConfig = {
    name: 'autoreactsw',
    alias: ['autoreaksi', 'reactsw', 'autoreactstory'],
    category: 'owner',
    description: 'Auto react semua status/story WA',
    usage: '.autoreactsw on/off [emoji]',
    example: '.autoreactsw on 🔥',
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
    const args = m.args || []
    const action = (args[0] || '').toLowerCase()
    const emoji = args[1] || '🔥'

    const current = db.setting('autoReactSW') || { enabled: false, emoji: '🔥' }

    if (!action) {
        return m.reply(
            `👁️ *ʜᴏsʜɪɴᴏ ᴀɪ sᴛᴏʀʏ ʀᴇᴀᴄᴛ*\n\n` +
            `"Mau tau status react-ku sekarang?" 🌟\n\n` +
            `> Status: *${current.enabled ? '✅ ON' : '❌ OFF'}*\n` +
            `> Emoji: *${current.emoji}*\n\n` +
            `*ᴄᴀʀᴀ ᴘᴀᴋᴀɪ:*\n` +
            `> \`${m.prefix}autoreactsw on\` — Aktifkan (emoji default 🔥)\n` +
            `> \`${m.prefix}autoreactsw on 😍\` — Aktifkan dengan emoji\n` +
            `> \`${m.prefix}autoreactsw off\` — Matikan`
        )
    }

    if (action === 'on') {
        db.setting('autoReactSW', { enabled: true, emoji })
        db.save()
        await m.react('⭐')
        await m.react('✅')
        return m.reply(
            `✅ *ᴀᴜᴛᴏ ʀᴇᴀᴄᴛ sᴛᴏʀʏ ᴀᴋᴛɪꜰ*\n\n` +
            `"Siap! Aku akan react semua story pakai ${emoji} ya~" 💖\n\n` +
            `> Emoji: *${emoji}*`
        )
    }

    if (action === 'off') {
        db.setting('autoReactSW', { enabled: false, emoji: current.emoji })
        db.save()
        await m.react('✅')
        return m.reply(
            `❌ *ᴀᴜᴛᴏ ʀᴇᴀᴄᴛ sᴛᴏʀʏ ᴅɪᴍᴀᴛɪᴋᴀɴ*\n\n` +
            `"Oke, aku istirahat react dulu ya..." 😴`
        )
    }

    return m.reply(
        `💔 *ᴇʀʀᴏʀ ᴘᴀɴɢɢᴜɴɢ*\n\n` +
        `"Eh, itu apa? Aku nggak ngerti~" 🎤\n\n` +
        `> Gunakan \`on\` atau \`off\` ya, Sayang!`
    )
}

module.exports = { config: pluginConfig, handler }