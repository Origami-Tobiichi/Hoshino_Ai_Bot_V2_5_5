const { getDatabase } = require('../../src/lib/database')
const GL = require('../../src/lib/listWar')

const pluginConfig = {
    name: 'list',
    alias: ['storelist', 'daftarlist', 'pricelist'],
    category: 'group',
    description: 'Tampilkan semua list store',
    usage: '.list',
    example: '.list',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function groupList(m) {
    const lists = GL.getLists(m.chat)
    if (!Object.keys(lists).length) {
        await m.reply(GL.EMPTY_TEXT)
        return true
    }
    const q = GL.norm((m.args || []).join(' '))
    if (q) {
        const found = GL.findMatches(lists, q)
        if (found.length) {
            await m.reply(found.map(l => l.content).join('\n\n'))
            return true
        }
    }
    await m.reply(GL.renderList(lists))
    return true
}

async function handler(m, { sock }) {
    const db = getDatabase()
    // di grup selalu pakai list grup, tidak fallback ke store global owner
    if (m.isGroup) return groupList(m)
    const storeData = db.setting('storeList') || {}
    const lists = Object.entries(storeData)
    
    if (lists.length === 0) {
        return m.reply(
            `📦 *sᴛᴏʀᴇ ʟɪsᴛ*\n\n` +
            `> Belum ada list yang tersedia\n\n` +
            `> Owner dapat menambahkan list dengan:\n` +
            `> \`${m.prefix}addlist <nama>\` (reply pesan)`
        )
    }
    
    let txt = `📦 *sᴛᴏʀᴇ ʟɪsᴛ*\n\n`
    txt += `> Total: ${lists.length} list tersedia\n\n`
    txt += `╭─「 📋 *ᴅᴀꜰᴛᴀʀ ᴘʀᴏᴅᴜᴋ* 」\n`
    
    for (const [name, data] of lists) {
        const preview = data.content
        txt += `┃\n`
        txt += `┃ 🏷️ \`${m.prefix}${name}\`\n`
        txt += `┃ └ ${preview}...\n`
        txt += `┃ └ 👁️ ${data.views || 0} views\n`
    }
    
    txt += `┃\n`
    txt += `╰───────────────\n\n`
    txt += `> Ketik command untuk melihat detail`
    
    m.react('📦')
    return m.reply(txt)
}

module.exports = {
    config: pluginConfig,
    handler
}
