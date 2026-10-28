const fs = require('fs')
const path = require('path')
const config = require('../../config')
const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'resetdb',
    alias: ['cleardb', 'wipedb'],
    category: 'owner',
    description: 'Reset semua data database',
    usage: '.resetdb [confirm]',
    example: '.resetdb confirm',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 60,
    energi: 0,
    isEnabled: true
}

if (!global.resetDbPending) global.resetDbPending = {}

async function handler(m, { sock }) {
    if (!config.isOwner(m.sender)) {
        return m.reply('❌ *Nee~ khusus owner!* Fitur ini cuma buat owner aja ya~ ☆')
    }
    
    const confirm = m.args?.[0]?.toLowerCase()
    
    if (confirm !== 'confirm') {
        global.resetDbPending[m.sender] = Date.now()
        
        return m.reply(
            `⚠️ *ᴘᴇʀɪɴɢᴀᴛᴀɴ!*\n\n` +
            `> Ini akan menghapus SEMUA data:\n` +
            `> • Data user\n` +
            `> • Data group\n` +
            `> • Data clan\n` +
            `> • Semua statistik\n\n` +
            `╭┈┈⬡「 ⚠️ *ᴋᴏɴғɪʀᴍᴀsɪ* 」\n` +
            `┃ Ketik: *.resetdb confirm*\n` +
            `┃ dalam 60 detik\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> ❌ Aksi ini TIDAK BISA dibatalkan!`
        )
    }
    
    const pending = global.resetDbPending[m.sender]
    if (!pending || (Date.now() - pending) > 60000) {
        delete global.resetDbPending[m.sender]
        return m.reply(`❌ *Gomen ne~* Timeout! Ketik *.resetdb* ulang untuk memulai~ 🥺`)
    }
    
    delete global.resetDbPending[m.sender]
    
    try {
        const dbPath = path.join(process.cwd(), 'database', 'db.json')
        const backupPath = path.join(process.cwd(), 'database', `db_backup_${Date.now()}.json`)
        
        if (fs.existsSync(dbPath)) {
            fs.copyFileSync(dbPath, backupPath)
        }
        
        const db = getDatabase()
        
        let userCount = 0
        let groupCount = 0
        let clanCount = 0
        
        if (db.db?.data?.users) {
            userCount = Object.keys(db.db.data.users).length
            db.db.data.users = {}
        }
        
        if (db.db?.data?.groups) {
            groupCount = Object.keys(db.db.data.groups).length
            db.db.data.groups = {}
        }
        
        if (db.db?.data?.clans) {
            clanCount = Object.keys(db.db.data.clans).length
            db.db.data.clans = {}
        }
        
        await db.save()
        
        await m.reply(
            `✅ *ᴅᴀᴛᴀʙᴀsᴇ ᴅɪʀᴇsᴇᴛ!*\n\n` +
            `╭┈┈⬡「 📊 *ᴅᴀᴛᴀ ᴅɪʜᴀᴘᴜs* 」\n` +
            `┃ 👤 Users: ${userCount}\n` +
            `┃ 👥 Groups: ${groupCount}\n` +
            `┃ ⚔️ Clans: ${clanCount}\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> Backup disimpan di:\n` +
            `> \`${path.basename(backupPath)}\``
        )
        
    } catch (error) {
        await m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
