const pluginConfig = {
    name: 'sendinfoplugin',
    alias: ['sip', 'plugininfo', 'infoplugin'],
    category: 'owner',
    description: 'Toggle notif otomatis ke channel saat add/del plugin',
    usage: '.sendinfoplugin',
    example: '.sendinfoplugin',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const { getDatabase } = require('../../src/lib/database')
    const db = getDatabase()

    const current = db.setting('pluginNotif') ?? true
    const next = !current
    db.setting('pluginNotif', next)
    db.save()

    return m.reply(
        `✅ *Yatta~* Notifikasi plugin otomatis sekarang: *${next ? '🟢 AKTIF' : '🔴 MATI'}*~ ✨`
    )
}

module.exports = { config: pluginConfig, handler }