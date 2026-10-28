const hsAsset = require('../../src/lib/assets')
const { getDatabase } = require('../../src/lib/database')
const { addExpWithLevelCheck } = require('../../src/lib/levelHelper')
const config = require('../../config')
const path = require('path')
const fs = require('fs')

const pluginConfig = {
    name: 'ngojek',
    alias: ['ojek', 'gojek', 'ojol'],
    category: 'rpg',
    description: 'Ngojek untuk mendapat uang',
    usage: '.ngojek',
    example: '.ngojek',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 120,
    energi: 1,
    isEnabled: true
}

let thumbRpg = null
hsAsset.tryBuffer('images/hsnai-rpg').then(b => { if (b) thumbRpg = b }).catch(() => {})

function getContextInfo(title = '🏍️ *ɴɢᴏᴊᴇᴋ*', body = 'Ojek Online') {
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

async function handler(m, { sock }) {
    const db = getDatabase()
    const user = db.getUser(m.sender)
    
    if (!user.rpg) user.rpg = {}
    
    const staminaCost = 15
    user.rpg.stamina = user.rpg.stamina ?? 100
    
    if (user.rpg.stamina < staminaCost) {
        return m.reply(
            `⚡ *sᴛᴀᴍɪɴᴀ ʜᴀʙɪs*\n\n` +
            `> Butuh ${staminaCost} stamina untuk ngojek\n` +
            `> Stamina kamu: ${user.rpg.stamina}`
        )
    }
    
    user.rpg.stamina -= staminaCost
    
    await m.react('🏍️')
    
    const orders = [
        { type: '🍔 GoFood', distance: '2km', min: 5000, max: 15000 },
        { type: '👤 GoRide', distance: '5km', min: 10000, max: 25000 },
        { type: '📦 GoSend', distance: '3km', min: 8000, max: 20000 },
        { type: '🛒 GoMart', distance: '4km', min: 12000, max: 30000 },
        { type: '👥 GoRide Plus', distance: '10km', min: 20000, max: 50000 }
    ]
    
    const order = orders[Math.floor(Math.random() * orders.length)]
    const earning = Math.floor(Math.random() * (order.max - order.min + 1)) + order.min
    const tips = Math.random() > 0.7 ? Math.floor(Math.random() * 5000) + 1000 : 0
    const totalEarning = earning + tips
    
    await m.reply(`🏍️ *sᴇᴅᴀɴɢ ɴɢᴏᴊᴇᴋ...*\n\n> ${order.type} - ${order.distance}`)
    await new Promise(r => setTimeout(r, 2500))
    
    user.koin = (user.koin || 0) + totalEarning
    
    const expGain = Math.floor(totalEarning / 20)
    const levelResult = await addExpWithLevelCheck(sock, m, db, user, expGain)
    
    db.save()
    
    await m.react('✅')
    
    let txt = `🏍️ *ɴɢᴏᴊᴇᴋ sᴇʟᴇsᴀɪ*\n\n`
    txt += `╭┈┈⬡「 📋 *ᴏʀᴅᴇʀ* 」\n`
    txt += `┃ 📱 Tipe: ${order.type}\n`
    txt += `┃ 📍 Jarak: ${order.distance}\n`
    txt += `┃ ─────────\n`
    txt += `┃ 💵 Tarif: *+Rp ${earning.toLocaleString('id-ID')}*\n`
    if (tips > 0) {
        txt += `┃ 🎁 Tips: *+Rp ${tips.toLocaleString('id-ID')}*\n`
    }
    txt += `┃ 🚄 Exp: *+${expGain}*\n`
    txt += `┃ ⚡ Stamina: *-${staminaCost}*\n`
    txt += `╰┈┈┈┈┈┈┈┈⬡`
    
    await sock.sendMessage(m.chat, {
        text: txt,
        contextInfo: getContextInfo('🏍️ *ɴɢᴏᴊᴇᴋ*', `+Rp ${totalEarning.toLocaleString('id-ID')}`)
    }, { quoted: m })
}

module.exports = {
    config: pluginConfig,
    handler
}