const config = require('../../config')
const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'addpremall',
    alias: ['addpremiumall', 'setpremall'],
    category: 'owner',
    description: 'Menambahkan semua member grup ke premium',
    usage: '.addprem all',
    example: '.addprem all',
    isOwner: true,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    try {
        const groupMeta = m.groupMetadata
        const participants = groupMeta.participants || []
        
        if (participants.length === 0) {
            return m.reply(`❌ *Gomen ne~* ✦\n\n> Tidak ada member di grup ini~ 🥺`)
        }
        
        m.react('🕕')
        
        const db = getDatabase()
        if (!db.data.premium) db.data.premium = []
        
        let addedCount = 0
        let alreadyPremCount = 0
        
        for (const participant of participants) {
            const number = participant.jid?.replace(/[^0-9]/g, '') || ''
            
            if (!number) continue
            
            if (db.data.premium.includes(number)) {
                alreadyPremCount++
                continue
            }  
            db.data.premium.push(number)
            
            const jid = number + '@s.whatsapp.net'
            const premLimit = config.limits?.premium || 100
            const user = db.getUser(jid) || db.setUser(jid)
            
            user.energi = premLimit
            user.isPremium = true
            
            db.setUser(jid, user)
            db.updateExp(jid, 200000)
            db.updateKoin(jid, 20000)
            addedCount++
        }
        
        db.save()
        
        m.react('💎')
        await m.reply(
            `💎 *ᴀᴅᴅ ᴘʀᴇᴍɪᴜᴍ ᴀʟʟ*\n\n` +
            `╭┈┈⬡「 📋 *ʜᴀsɪʟ* 」\n` +
            `┃ 👥 ᴛᴏᴛᴀʟ ᴍᴇᴍʙᴇʀ: \`${participants.length}\`\n` +
            `┃ ✅ ᴅɪᴛᴀᴍʙᴀʜᴋᴀɴ: \`${addedCount}\`\n` +
            `┃ ⏭️ sᴜᴅᴀʜ ᴘʀᴇᴍɪᴜᴍ: \`${alreadyPremCount}\`\n` +
            `┃ 💎 ᴛᴏᴛᴀʟ ᴘʀᴇᴍɪᴜᴍ: \`${db.data.premium.length}\`\n` +
            `╰┈┈⬡\n\n` +
            `> Grup: ${groupMeta.subject}`
        )
        
    } catch (error) {
        m.react('❌')
        await m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
