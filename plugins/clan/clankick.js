const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'clankick',
    alias: ['kickclan'],
    category: 'clan',
    description: 'Kick member dari clan (leader only)',
    usage: '.clankick @user',
    example: '.clankick @user',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

async function handler(m) {
    const db = getDatabase()
    const user = db.getUser(m.sender)

    if (!user?.clanId) return m.reply(`❌ *Ehh~* Kamu belum punya clan~ 🥺`)
    if (!db.db.data.clans) db.db.data.clans = {}

    const clan = db.db.data.clans[user.clanId]
    if (!clan) return m.reply(`❌ *Ehh~* Clan tidak ditemukan~ 🥺`)
    if (clan.leader !== m.sender) return m.reply(`❌ *Nee~* Hanya leader yang bisa kick~ 🥺`)

    const target = m.mentionedJid?.[0] || m.quoted?.sender
    if (!target) {
        return m.reply(
            `👢 *CLAN KICK*\n\n` +
            `Tag atau reply member yang mau dikeluarkan\n\n` +
            `Contoh: *.clankick @user*`
        )
    }

    if (target === m.sender) return m.reply(`❌ *Gomen ne~* Tidak bisa kick diri sendiri~ 🥺`)
    if (!clan.members.includes(target)) return m.reply(`❌ *Ehh~* User bukan member clan ini~ 🥺`)

    clan.members = clan.members.filter(jid => jid !== target)
    db.setUser(target, { clanId: null })
    db.save()

    const emblem = clan.emblem || '🏰'

    await m.reply(
        `${emblem} *KICKED*\n\n` +
        `@${target.split('@')[0]} dikeluarkan dari *${clan.name}*\n` +
        `Sisa members: ${clan.members.length}/50`,
        { mentions: [target] }
    )
}

module.exports = {
    config: pluginConfig,
    handler
}
