const config = require('../../config')

const pluginConfig = {
    name: 'leave',
    alias: ['leavegrup', 'leavegroup', 'keluar', 'bye'],
    category: 'owner',
    description: 'Bot keluar dari grup',
    usage: '.leave [link]',
    example: '.leave',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

function extractInviteCode(text) {
    const patterns = [
        /chat\.whatsapp\.com\/([a-zA-Z0-9]{20,})/i,
        /wa\.me\/([a-zA-Z0-9]{20,})/i
    ]
    
    for (const pattern of patterns) {
        const match = text.match(pattern)
        if (match) return match[1]
    }
    
    return null
}

async function handler(m, { sock }) {
    const input = m.args.join(' ').trim()
    
    let targetGroupJid = null
    let groupName = ''
    
    if (!input && m.isGroup) {
        targetGroupJid = m.chat
        try {
            const meta = m.groupMetadata
            groupName = meta.subject || 'Grup ini'
        } catch {
            groupName = 'Grup ini'
        }
    } else if (input) {
        const inviteCode = extractInviteCode(input)
        
        if (!inviteCode) {
            return m.reply(`❌ *Gomen ne~* ✦\n\n> Link invite tidak valid~ 🥺`)
        }
        
        try {
            const groupInfo = await sock.groupGetInviteInfo(inviteCode)
            targetGroupJid = groupInfo.id
            groupName = groupInfo.subject || 'Unknown'
        } catch (error) {
            return m.reply(`❌ *Gomen ne~* ✦\n\n> Tidak dapat mengambil info grup dari link~ 🥺`)
        }
    } else {
        return m.reply(
            `🚪 *ʟᴇᴀᴠᴇ ɢʀᴜᴘ*\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
            `┃ ◦ Di grup: \`.leave\`\n` +
            `┃ ◦ Via link: \`.leave <link>\`\n` +
            `╰┈┈⬡\n\n` +
            `\`Contoh: ${m.prefix}leave https://chat.whatsapp.com/xxx\``
        )
    }
    
    if (!targetGroupJid) {
        return m.reply(`❌ *Gomen ne~* ✦\n\n> Grup tidak ditemukan~ 🥺`)
    }
    
    m.react('🕕')
    
    try {
        global.sewaLeaving = true
        
        const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
        const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'
        
        if (m.isGroup && targetGroupJid === m.chat) {
            await sock.sendMessage(m.chat, {
                text: `👋 *ɢᴏᴏᴅʙʏᴇ*\n\n` +
                    `> Bot akan keluar dari grup ini.\n` +
                    `> Terima kasih sudah menggunakan bot!`,
                contextInfo: {
                    forwardingScore: 9999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: saluranId,
                        newsletterName: saluranName,
                        serverMessageId: 127
                    }
                }
            })
        }
        
        await sock.groupLeave(targetGroupJid)
        
        global.sewaLeaving = false
        
        if (!m.isGroup || targetGroupJid !== m.chat) {
            m.react('✅')
            await m.reply(
                `✅ *ʙᴇʀʜᴀsɪʟ ᴋᴇʟᴜᴀʀ*\n\n` +
                `> Bot telah keluar dari: *${groupName}*`
            )
        }
        
    } catch (error) {
        global.sewaLeaving = false
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
