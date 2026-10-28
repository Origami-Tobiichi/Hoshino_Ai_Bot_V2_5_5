const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'unmute',
    alias: ['unbisukan'],
    category: 'group',
    description: 'Membuka mute grup',
    usage: '.unmute',
    example: '.unmute',
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

    if (!group.mute) return m.reply('❌ *Ehh~* Grup tidak sedang di-mute~ 🥺')

    db.setGroup(m.chat, { ...group, mute: false })
    m.reply(`✅ Grup *${groupName}* berhasil di-unmute oleh @${m.sender.split('@')[0]}\n\nSemua member sekarang bisa mengirim pesan.`, { mentions: [m.sender] })
}

module.exports = {
    config: pluginConfig,
    handler
}
