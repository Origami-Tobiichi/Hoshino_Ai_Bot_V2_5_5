const hsAsset = require('../../src/lib/assets')
const config = require('../../config')
const { getDatabase } = require('../../src/lib/database')
const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: 'rules',
    alias: ['aturanbot', 'botrules'],
    category: 'main',
    description: 'Menampilkan rules/aturan bot',
    usage: '.rules',
    example: '.rules',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

const DEFAULT_BOT_RULES = `📜 *ᴀᴛᴜʀᴀɴ ʙᴏᴛ*

┃ 1️⃣ Jangan spam command
┃ 2️⃣ Gunakan fitur dengan bijak
┃ 3️⃣ Dilarang menyalahgunakan bot
┃ 4️⃣ Hormati sesama pengguna
┃ 5️⃣ Report bug ke owner
┃ 6️⃣ Jangan request fitur aneh
┃ 7️⃣ Bot bukan 24/7, ada maintenance

_Pelanggaran dapat mengakibatkan banned!_`

async function handler(m, { sock, config: botConfig }) {
    const db = getDatabase()
    const customRules = db.setting('botRules')
    const rulesText = customRules || DEFAULT_BOT_RULES


    let imageBuffer = hsAsset.has('images/hsnai-rules') ? (await hsAsset.buffer('images/hsnai-rules')) : null

    const saluranId = botConfig.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    const saluranName = botConfig.saluran?.name || botConfig.bot?.name || 'Ourin-AI'

    if (imageBuffer) {
        await sock.sendMessage(m.chat, {
            image: imageBuffer,
            caption: rulesText,
            contextInfo: {
                forwardingScore: 9999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: saluranId,
                    newsletterName: saluranName,
                    serverMessageId: 127
                }
            }
        }, { quoted: m })
    } else {
        await m.reply(rulesText)
    }
}

module.exports = {
    config: pluginConfig,
    handler,
    DEFAULT_BOT_RULES
}
