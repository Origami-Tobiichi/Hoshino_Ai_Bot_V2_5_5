const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'gakpeduli',
    alias: ['ignore', 'silent', 'cuek'],
    category: 'group',
    description: 'Membuat bot diam total di grup ini (kecuali owner)',
    usage: '.gakpeduli',
    example: '.gakpeduli',
    isOwner: true,
    isAdmin: false, // Biar admin grup bisa nyalain
    isGroup: true,
    isEnabled: true
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const group = db.getGroup(m.chat) || {}
    
    // Toggle fitur: Kalau sudah aktif jadi mati, kalau mati jadi aktif
    const newState = !group.ignore 
    db.setGroup(m.chat, { ...group, ignore: newState })
    
    if (newState) {
        m.reply(`✅ *Mode Gak Peduli Aktif.*\nBot tidak akan merespon perintah siapapun di grup ini kecuali Owner/Partner.`)
    } else {
        m.reply(`✅ *Mode Gak Peduli Dimatikan.*\nBot sekarang merespon kembali.`)
    }
}

// Fungsi ini yang dipanggil di handler.js
function isIgnored(groupJid, db) {
    const group = db.getGroup(groupJid) || {}
    return !!group.ignore
}

module.exports = {
    config: pluginConfig,
    handler,
    isIgnored
}