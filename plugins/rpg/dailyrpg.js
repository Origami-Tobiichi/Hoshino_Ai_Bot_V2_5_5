const hsAsset = require('../../src/lib/assets')
const { getDatabase } = require('../../src/lib/database')
const { addExpWithLevelCheck } = require('../../src/lib/levelHelper')
const config = require('../../config')
const path = require('path')
const fs = require('fs')

const pluginConfig = {
    name: 'dailyrpg',
    alias: [],
    category: 'rpg',
    description: 'Klaim hadiah harian',
    usage: '.dailyrpg',
    example: '.dailyrpg',
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

function getContextInfo(title = '🎁 *ᴅᴀɪʟʏ*', body = 'Hadiah Harian') {
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
    const hours = Math.floor((duration / (1000 * 60 * 60)) % 24)
    const minutes = Math.floor((duration / (1000 * 60)) % 60)
    const seconds = Math.floor((duration / 1000) % 60)
    return `${hours} jam ${minutes} menit ${seconds} detik`
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const user = db.getUser(m.sender)
    const isPremium = config.isPremium?.(m.sender) || false
    
    if (!user.rpg) user.rpg = {}
    
    const COOLDOWN = 86400000
    const lastClaim = user.rpg.lastDaily || 0
    const now = Date.now()
    
    if (now - lastClaim < COOLDOWN) {
        const remaining = COOLDOWN - (now - lastClaim)
        return m.reply(
            `⏰ *sᴜᴅᴀʜ ᴋʟᴀɪᴍ*\n\n` +
            `> Kamu sudah klaim hadiah harian hari ini\n` +
            `> Kembali dalam: *${msToTime(remaining)}*`
        )
    }
    
    const expReward = isPremium ? 5000 : 1000
    const moneyReward = isPremium ? 25000 : 5000
    const energiReward = isPremium ? 10 : 3
    
    user.rpg.lastDaily = now
    user.koin = (user.koin || 0) + moneyReward
    user.energi = (user.energi || 0) + energiReward
    
    const levelResult = await addExpWithLevelCheck(sock, m, db, user, expReward)
    db.save()
    
    await m.react('🎁')
    
    let txt = `🎁 *ᴅᴀɪʟʏ ʀᴇᴡᴀʀᴅ*\n\n`
    txt += `╭┈┈⬡「 🎊 *ʜᴀᴅɪᴀʜ* 」\n`
    txt += `┃ 💵 Money: *+Rp ${moneyReward.toLocaleString('id-ID')}*\n`
    txt += `┃ 🚄 Exp: *+${expReward}*\n`
    txt += `┃ ⚡ Energi: *+${energiReward}*\n`
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`
    txt += `> ${isPremium ? '✨ Premium Bonus!' : 'Upgrade ke Premium untuk reward lebih!'}`
    
    await sock.sendMessage(m.chat, {
        text: txt,
        contextInfo: getContextInfo()
    }, { quoted: m })
}

module.exports = {
    config: pluginConfig,
    handler
}