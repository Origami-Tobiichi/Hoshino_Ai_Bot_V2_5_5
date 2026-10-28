const hsAsset = require('../../src/lib/assets')
const { getDatabase } = require('../../src/lib/database')
const { getRpgContextInfo } = require('../../src/lib/contextHelper')
const config = require('../../config')
const path = require('path')
const fs = require('fs')

const pluginConfig = {
    name: 'buykoin',
    alias: ['belikoin', 'belicoin', 'exptokoin', 'exptocoin'],
    category: 'rpg',
    description: 'Tukar EXP menjadi Koin',
    usage: '.buykoin <jumlah>',
    example: '.buykoin 10000',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

const EXP_PER_KOIN = 2

let thumbRpg = null
hsAsset.tryBuffer('images/hsnai-rpg').then(b => { if (b) thumbRpg = b }).catch(() => {})

function getContextInfo(title = '💱 *ʙᴜʏ ᴋᴏɪɴ*', body = 'Tukar EXP') {
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
    
    const args = m.args || []
    const amountStr = args[0]
    
    if (!amountStr) {
        let txt = `💱 *ʙᴜʏ ᴋᴏɪɴ*\n\n`
        txt += `> Tukar EXP menjadi Koin!\n\n`
        txt += `╭┈┈⬡「 📊 *ᴋᴜʀs* 」\n`
        txt += `┃ 💎 ${EXP_PER_KOIN} EXP = 1 Koin\n`
        txt += `╰┈┈⬡\n\n`
        txt += `╭┈┈⬡「 📋 *sᴀʟᴅᴏᴍᴜ* 」\n`
        txt += `┃ 🚄 EXP: *${(user.exp || 0).toLocaleString('id-ID')}*\n`
        txt += `┃ 💰 Koin: * ${(user.koin || 0).toLocaleString('id-ID')}*\n`
        txt += `╰┈┈⬡\n\n`
        txt += `> Contoh: \`.buykoin 10000\`\n`
        txt += `> Akan menggunakan ${10000 * EXP_PER_KOIN} EXP untuk 10.000 Koin`
        
        return m.reply(txt)
    }
    
    let koinAmount = 0
    if (amountStr === 'all' || amountStr === 'max') {
        koinAmount = Math.floor((user.exp || 0) / EXP_PER_KOIN)
    } else {
        koinAmount = parseInt(amountStr)
    }
    
    if (!koinAmount || koinAmount <= 0) {
        return m.reply(`❌ *Ehh~* Masukkan jumlah koin yang valid~ 🥺`)
    }
    
    const expNeeded = koinAmount * EXP_PER_KOIN
    
    if ((user.exp || 0) < expNeeded) {
        const maxPossible = Math.floor((user.exp || 0) / EXP_PER_KOIN)
        return m.reply(
            `❌ *EXP tidak cukup!*\n\n` +
            `> Dibutuhkan: *${expNeeded.toLocaleString('id-ID')} EXP*\n` +
            `> EXP kamu: *${(user.exp || 0).toLocaleString('id-ID')} EXP*\n\n` +
            `> Maksimal: *${maxPossible.toLocaleString('id-ID')} Koin*`
        )
    }
    
    // Use manual user update instead of updateKoin/updateExp to do batch update
    // But since logic was db.setUser, let's stick to update logic here
    const newExp = (user.exp || 0) - expNeeded
    const newKoin = (user.koin || 0) + koinAmount
    
    db.setUser(m.sender, {
        exp: newExp,
        koin: newKoin
    })
    
    await m.react('💱')
    
    let txt = `💱 *ᴛᴜᴋᴀʀ ʙᴇʀʜᴀsɪʟ!*\n\n`
    txt += `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n`
    txt += `┃ 🚄 EXP: *-${expNeeded.toLocaleString('id-ID')}*\n`
    txt += `┃ 💰 Koin: *+${koinAmount.toLocaleString('id-ID')}*\n`
    txt += `╰┈┈⬡\n\n`
    txt += `╭┈┈⬡「 📊 *sᴀʟᴅᴏ sᴇᴋᴀʀᴀɴɢ* 」\n`
    txt += `┃ 🚄 EXP: *${newExp.toLocaleString('id-ID')}*\n`
    txt += `┃ 💰 Koin: *${newKoin.toLocaleString('id-ID')}*\n`
    txt += `╰┈┈⬡`
    
    await sock.sendMessage(m.chat, {
        text: txt,
        contextInfo: getContextInfo()
    }, { quoted: m })
}

module.exports = {
    config: pluginConfig,
    handler
}