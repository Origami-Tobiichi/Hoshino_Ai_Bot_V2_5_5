const hsAsset = require('../../src/lib/assets')
const { getDatabase } = require('../../src/lib/database')
const { addExpWithLevelCheck } = require('../../src/lib/levelHelper')
const config = require('../../config')
const path = require('path')
const fs = require('fs')

const pluginConfig = {
    name: 'hourly',
    alias: ['jam', 'perjam'],
    category: 'rpg',
    description: 'Klaim hadiah per jam',
    usage: '.hourly',
    example: '.hourly',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 0,
    energi: 0,
    isEnabled: true
}

let thumbRpg = null
hsAsset.tryBuffer('images/hsnai-rpg').then(b => { if (b) thumbRpg = b }).catch(() => {})

function getContextInfo(title = '⏰ *ʜᴏᴜʀʟʏ*', body = 'Hadiah Per Jam') {
    const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'
    
    const contextInfo = {
        forwardingScore: 9999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: saluranId,
            newsletterName: saluranName,
            serverMessageId: 127
        }
    }
    
    
    return contextInfo
}

function msToTime(duration) {
    const minutes = Math.floor((duration / (1000 * 60)) % 60)
    const seconds = Math.floor((duration / 1000) % 60)
    return `${minutes} menit ${seconds} detik`
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const user = db.getUser(m.sender)
    const isPremium = config.isPremium?.(m.sender) || false
    
    if (!user.rpg) user.rpg = {}
    
    const COOLDOWN = 3600000
    const lastClaim = user.rpg.lastHourly || 0
    const now = Date.now()
    
    if (now - lastClaim < COOLDOWN) {
        const remaining = COOLDOWN - (now - lastClaim)
        return m.reply(
            `⏰ *sᴜᴅᴀʜ ᴋʟᴀɪᴍ*\n\n` +
            `> Kamu sudah klaim hadiah jam ini\n` +
            `> Kembali dalam: *${msToTime(remaining)}*`
        )
    }
    
    const expReward = isPremium ? 1000 : 200
    const moneyReward = isPremium ? 5000 : 1000
    
    user.rpg.lastHourly = now
    user.koin = (user.koin || 0) + moneyReward
    
    const levelResult = await addExpWithLevelCheck(sock, m, db, user, expReward)
    db.save()
    
    await m.react('⏰')
    
    let txt = `⏰ *ʜᴏᴜʀʟʏ ʀᴇᴡᴀʀᴅ*\n\n`
    txt += `╭┈┈⬡「 🎊 *ʜᴀᴅɪᴀʜ* 」\n`
    txt += `┃ 💵 Money: *+Rp ${moneyReward.toLocaleString('id-ID')}*\n`
    txt += `┃ 🚄 Exp: *+${expReward}*\n`
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`
    txt += `> Klaim lagi dalam 1 jam!`
    
    await sock.sendMessage(m.chat, {
        text: txt,
        contextInfo: getContextInfo()
    }, { quoted: m })
}

module.exports = {
    config: pluginConfig,
    handler
}