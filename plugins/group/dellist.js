const { getDatabase } = require('../../src/lib/database')
const GL = require('../../src/lib/listWar')

const pluginConfig = {
    name: 'dellist',
    alias: ['hapuslist', 'removelist'],
    category: 'group',
    description: 'Hapus list/command store',
    usage: '.dellist <nama>',
    example: '.dellist freefire',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function groupDel(m) {
    if (!m.isAdmin && !m.isOwner) {
        return m.reply(`❌ Hanya *admin* yang dapat menambah / menghapus list`)
    }
    const name = GL.norm((m.args || []).join(' '))
    const lists = GL.getLists(m.chat)
    if (!name) {
        const names = Object.keys(lists)
        return m.reply(`🗑️ Format: \`${m.prefix}dellist <nama>\`\n\n` + (names.length ? `> List tersedia: ${names.map(n => `\`${n}\``).join(', ')}` : `> Belum ada list di grup ini`))
    }
    if (!lists[name]) return m.reply(`❌ List \`${name}\` tidak ditemukan`)
    delete lists[name]
    await GL.saveLists(m.chat, lists)
    m.react('✅')
    return m.reply(`${name} sudah dihapus dari daftar list`)
}

async function handler(m, { sock }) {
    if (m.isGroup) return groupDel(m)
    if (!m.isOwner) return m.reply(`❌ Fitur ini khusus owner di private chat~ 🥺`)
    const db = getDatabase()
    const listName = m.args[0]?.toLowerCase().trim()
    
    if (!listName) {
        return m.reply(
            `🗑️ *ᴅᴇʟ ʟɪsᴛ sᴛᴏʀᴇ*\n\n` +
            `> Ketik: \`${m.prefix}dellist <nama>\`\n\n` +
            `\`Contoh: ${m.prefix}dellist freefire\``
        )
    }
    
    const storeData = db.setting('storeList') || {}
    
    if (!storeData[listName]) {
        const availableLists = Object.keys(storeData)
        if (availableLists.length === 0) {
            return m.reply(`❌ *Ehh~* Tidak ada list yang tersedia~ 🥺`)
        }
        return m.reply(
            `❌ List \`${listName}\` tidak ditemukan!\n\n` +
            `> List tersedia: ${availableLists.map(l => `\`${l}\``).join(', ')}`
        )
    }
    
    delete storeData[listName]
    db.setting('storeList', storeData)
    
    m.react('✅')
    
    return m.reply(
        `✅ *ʟɪsᴛ ᴅɪʜᴀᴘᴜs*\n\n` +
        `> Nama: \`${listName}\`\n` +
        `> Command \`${m.prefix}${listName}\` tidak lagi tersedia`
    )
}

module.exports = {
    config: pluginConfig,
    handler
}
