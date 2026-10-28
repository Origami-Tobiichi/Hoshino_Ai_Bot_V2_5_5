const config = require('../../config')
const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'ban',
    alias: ['addban', 'block'],
    category: 'owner',
    description: 'Memblokir user dari menggunakan bot',
    usage: '.ban <nomor/@tag>',
    example: '.ban 6281234567890',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    let targetNumber = ''
    
    if (m.quoted) {
        targetNumber = m.quoted.sender?.replace(/[^0-9]/g, '') || ''
    } else if (m.mentionedJid?.length) {
        targetNumber = m.mentionedJid[0]?.replace(/[^0-9]/g, '') || ''
    } else if (m.args[0]) {
        targetNumber = m.args[0].replace(/[^0-9]/g, '')
    }
    
    if (!targetNumber) {
        return m.reply(`🚫 *ʙᴀɴ ᴜsᴇʀ*\n\n> Masukkan nomor atau tag user\n\n\`Contoh: ${m.prefix}ban 6281234567890\``)
    }
    
    if (targetNumber.startsWith('0')) {
        targetNumber = '62' + targetNumber.slice(1)
    }
    
    if (config.isOwner(targetNumber)) {
        return m.reply(`❌ *Gomen ne~* ✦\n\n> Tidak dapat ban owner~ 🥺`)
    }
    
    if (config.isBanned(targetNumber)) {
        return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Nomor \`${targetNumber}\` sudah dibanned`)
    }
    
    config.bannedUsers.push(targetNumber)
    
    const db = getDatabase()
    db.setting('bannedUsers', config.bannedUsers)
    
    m.react('🚫')
    
    await m.reply(
        `🚫 *ᴜsᴇʀ ᴅɪʙᴀɴɴᴇᴅ*\n\n` +
        `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
        `┃ 📱 ɴᴏᴍᴏʀ: \`${targetNumber}\`\n` +
        `┃ 🚫 sᴛᴀᴛᴜs: \`Banned\`\n` +
        `┃ 📊 ᴛᴏᴛᴀʟ: \`${config.bannedUsers.length}\` ᴜsᴇʀ\n` +
        `╰┈┈⬡`
    )
}

module.exports = {
    config: pluginConfig,
    handler
}
