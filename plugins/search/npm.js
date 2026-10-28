const hsAsset = require('../../src/lib/assets')
const config = require('../../config')
const path = require('path')
const fs = require('fs')

const pluginConfig = {
    name: 'npm',
    alias: ['npmsearch', 'npmjs', 'npmfind'],
    category: 'search',
    description: 'Search package di NPM registry',
    usage: '.npm <query>',
    example: '.npm axios',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

let thumbTools = null
hsAsset.tryBuffer('images/hsnai-games').then(b => { if (b) thumbTools = b }).catch(() => {})

function getContextInfo(title = '📦 *ɴᴘᴍ sᴇᴀʀᴄʜ*', body = 'Package registry') {
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
    const query = m.args?.join(' ')
    
    if (!query) {
        return m.reply(
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> \`${m.prefix}npm <query>\`\n\n` +
            `> Contoh:\n` +
            `> \`${m.prefix}npm axios\``
        )
    }
    
    await m.react('🕕')
    await m.reply(`🕕 *ᴍᴇɴᴄᴀʀɪ ᴘᴀᴄᴋᴀɢᴇ...*`)
    
    try {
        const res = await fetch(`https://registry.npmjs.com/-/v1/search?text=${encodeURIComponent(query)}&size=10`)
        const data = await res.json()
        
        if (!data.objects || data.objects.length === 0) {
            await m.react('❌')
            return m.reply(`❌ *ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ*\n\n> Package "${query}" tidak ditemukan`)
        }
        
        let text = `📦 *ɴᴘᴍ sᴇᴀʀᴄʜ*\n\n`
        text += `> Query: \`${query}\`\n`
        text += `> Found: ${data.total} packages\n\n`
        
        data.objects.slice(0, 8).forEach((item, i) => {
            const pkg = item.package
            const score = Math.round((item.score?.final || 0) * 100)
            
            text += `╭┈┈⬡「 ${i + 1}. *${pkg.name}* 」\n`
            text += `┃ 📌 v${pkg.version}\n`
            if (pkg.description) {
                text += `┃ 📝 ${pkg.description.slice(0, 50)}${pkg.description.length > 50 ? '...' : ''}\n`
            }
            text += `┃ 🔗 ${pkg.links?.npm || '-'}\n`
            if (pkg.author?.name) {
                text += `┃ 👤 ${pkg.author.name}\n`
            }
            text += `┃ ⭐ Score: ${score}%\n`
            text += `╰┈┈┈┈┈┈┈┈⬡\n\n`
        })
        
        await m.react('✅')
        await sock.sendMessage(m.chat, {
            text: text,
            contextInfo: getContextInfo('📦 *ɴᴘᴍ sᴇᴀʀᴄʜ*', `${data.total} packages`)
        }, { quoted: m })
        
    } catch (e) {
        await m.react('❌')
        await m.reply(`❌ *Gomen ne~* ✦\n\n> ${e.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}