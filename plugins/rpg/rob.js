const { getDatabase } = require('../../src/lib/database')
const { addExpWithLevelCheck } = require('../../src/lib/levelHelper')
const { getRpgContextInfo } = require('../../src/lib/contextHelper')

const pluginConfig = {
    name: 'rob',
    alias: ['rampok', 'mug'],
    category: 'rpg',
    description: 'Rampok uang player lain (berisiko)',
    usage: '.rob @user',
    example: '.rob @user',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 600,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const db = getDatabase()
    
    const target = m.mentionedJid?.[0] || m.quoted?.sender
    
    if (!target) {
        return m.reply(
            `🦹 *ʀᴏʙ*\n\n` +
            `╭┈┈⬡「 📋 *ᴜsᴀɢᴇ* 」\n` +
            `┃ > Tag target yang mau dirampok!\n` +
            `┃ > \`.rob @user\`\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }
    
    if (target === m.sender) {
        return m.reply(`❌ *Gomen ne~* ✦\n\n> Tidak bisa rampok diri sendiri~ 🥺`)
    }
    
    const robber = db.getUser(m.sender)
    const victim = db.getUser(target)
    
    if (!victim) {
        return m.reply(`❌ *ᴛᴀʀɢᴇᴛ ɴᴏᴛ ꜰᴏᴜɴᴅ*\n\n> Target tidak ditemukan di database!`)
    }
    
    if ((victim.koin || 0) < 1000) {
        return m.reply(`❌ *ᴛᴀʀɢᴇᴛ ᴍɪsᴋɪɴ*\n\n> Target terlalu miskin untuk dirampok!`)
    }
    
    if (!robber.rpg) robber.rpg = {}
    robber.rpg.health = robber.rpg.health || 100
    
    if (robber.rpg.health < 30) {
        return m.reply(
            `❌ *ʜᴇᴀʟᴛʜ ᴛᴇʀʟᴀʟᴜ ʀᴇɴᴅᴀʜ*\n\n` +
            `> Minimal 30 HP untuk merampok!\n` +
            `> Health kamu: ${robber.rpg.health} HP`
        )
    }
    
    await sock.sendMessage(m.chat, { text: `🦹 *sᴇᴅᴀɴɢ ᴍᴇʀᴀᴍᴘᴏᴋ...*`, contextInfo: getRpgContextInfo('🦹 ROB', 'Robbing!') }, { quoted: m })
    await new Promise(r => setTimeout(r, 2500))
    
    const successRate = 0.4
    const isSuccess = Math.random() < successRate
    
    if (isSuccess) {
        const maxSteal = Math.floor((victim.koin || 0) * 0.3)
        const stolen = Math.floor(Math.random() * maxSteal) + 1000
        
        victim.koin = (victim.koin || 0) - stolen
        robber.koin = (robber.koin || 0) + stolen
        
        const expGain = 300
        await addExpWithLevelCheck(sock, m, db, robber, expGain)
        
        db.save()
        
        let txt = `✅ *ʀᴏʙ sᴜᴋsᴇs*\n\n`
        txt += `> 🦹 Kamu berhasil merampok @${target.split('@')[0]}!\n`
        txt += `> 💰 Curian: *+Rp ${stolen.toLocaleString('id-ID')}*\n`
        txt += `> 🚄 Exp: *+${expGain}*`
        
        await m.reply(txt, { mentions: [target] })
    } else {
        const fine = Math.floor(Math.random() * 10000) + 5000
        const actualFine = Math.min(fine, robber.koin || 0)
        const healthLoss = 25
        
        robber.koin = Math.max(0, (robber.koin || 0) - actualFine)
        robber.rpg.health = Math.max(0, robber.rpg.health - healthLoss)
        
        db.save()
        
        let txt = `❌ *ʀᴏʙ ɢᴀɢᴀʟ*\n\n`
        txt += `> 🚨 Kamu ketahuan dan dipukuli!\n`
        txt += `> 💸 Denda: *-Rp ${actualFine.toLocaleString('id-ID')}*\n`
        txt += `> ❤️ Health: *-${healthLoss}*`
        
        await m.reply(txt)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
