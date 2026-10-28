const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'mute',
    alias: ['bisukan'],
    category: 'group',
    description: 'Bisukan seluruh grup (hanya admin yang bisa kirim pesan)',
    usage: '.mute',
    example: '.mute',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    isAdmin: true,
    isBotAdmin: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const group = db.getGroup(m.chat) || {}
    const groupName = m.groupMetadata.subject

    if (group.mute) return m.reply('❌ *Ehh~* Grup sudah dalam keadaan mute~ 🥺')

    db.setGroup(m.chat, { ...group, mute: true })
    m.reply(`✅ Grup *${groupName}* berhasil di-mute oleh @${m.sender.split('@')[0]}\n\nHanya admin yang bisa mengirim pesan.\nKetik *${m.prefix}unmute* untuk membuka kembali.`, { mentions: [m.sender] })
}

function isMuted(groupJid, db) {
    const group = db.getGroup(groupJid) || {}
    return !!group.mute
}

module.exports = {
    config: pluginConfig,
    handler,
    isMuted
}
