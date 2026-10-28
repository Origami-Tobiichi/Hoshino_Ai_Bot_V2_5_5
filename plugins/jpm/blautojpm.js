const { getDatabase } = require('../../src/lib/database')
const config = require('../../config')

const pluginConfig = {
    name: 'blautojpm',
    alias: ['blacklistautojpm', 'autojpmbl', 'listblautojpm'],
    category: 'jpm',
    description: 'Blacklist grup dari Auto JPM',
    usage: '.blautojpm <add/del/list>',
    example: '.blautojpm add',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const args = m.args || []
    const action = m.command.includes('list') ? 'list' : (args[0] || '').toLowerCase()
    
    let blacklist = db.setting('autoJpmBlacklist') || []
    
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
    
    if (!action || action === 'list') {
        if (blacklist.length === 0) {
            return m.reply(
                `📋 *ʙʟᴀᴄᴋʟɪsᴛ ᴀᴜᴛᴏ ᴊᴘᴍ*\n\n` +
                `> Belum ada grup yang di-blacklist\n\n` +
                `*ᴜsᴀɢᴇ:*\n` +
                `> \`${m.prefix}blautojpm add\` - Blacklist grup ini\n` +
                `> \`${m.prefix}blautojpm del\` - Hapus dari blacklist`
            )
        }
        
        let txt = `📋 *ʙʟᴀᴄᴋʟɪsᴛ ᴀᴜᴛᴏ ᴊᴘᴍ*\n\n`
        txt += `> Total: *${blacklist.length}* grup\n\n`
        
        const isThisBlacklisted = blacklist.includes(m.chat)
        txt += `> Grup ini: *${isThisBlacklisted ? '✅ Blacklisted' : '❌ Tidak'}*\n\n`
        txt += `*ᴜsᴀɢᴇ:*\n`
        txt += `> \`${m.prefix}blautojpm add\` - Blacklist grup ini\n`
        txt += `> \`${m.prefix}blautojpm del\` - Hapus dari blacklist`
        
        return m.reply(txt)
    }
    
    if (action === 'add') {
        const jids = args.length > 1 ? args.slice(1).join('').split(',').filter(j => j.includes('@g.us')) : [m.chat]
        if (jids.length === 0 || !jids[0].includes('@g.us')) {
            return m.reply(`❌ *Ehh~* Format JID grup tidak valid atau bot tidak di dalam grup~ 🥺`)
        }

        let added = 0
        let duplicate = 0
        
        for (const targetGroup of jids) {
            if (!blacklist.includes(targetGroup)) {
                blacklist.push(targetGroup)
                added++
            } else {
                duplicate++
            }
        }
        db.setting('autoJpmBlacklist', blacklist)
        await db.save()
        
        m.react('✅')
        return m.reply(
            `✅ *ʙʟᴀᴄᴋʟɪsᴛ ᴀᴜᴛᴏ ᴊᴘᴍ*\n\n` +
            `> Berhasil ditambah: \`${added}\` grup\n` +
            `> Sudah ada: \`${duplicate}\` grup\n` +
            `> Total blacklist: \`${blacklist.length}\` grup\n\n` +
            `_Grup-grup ini tidak akan menerima Auto JPM lagi._`
        )
    }
    
    if (action === 'del' || action === 'remove' || action === 'hapus') {
        const jids = args.length > 1 ? args.slice(1).join('').split(',').filter(j => j.includes('@g.us')) : [m.chat]
        if (jids.length === 0 || !jids[0].includes('@g.us')) {
            return m.reply(`❌ *Ehh~* Format JID grup tidak valid atau bot tidak di dalam grup~ 🥺`)
        }

        let removed = 0
        
        for (const targetGroup of jids) {
            const index = blacklist.indexOf(targetGroup)
            if (index !== -1) {
                blacklist.splice(index, 1)
                removed++
            }
        }
        
        db.setting('autoJpmBlacklist', blacklist)
        await db.save()
        
        m.react('✅')
        return m.reply(
            `✅ *ᴜɴʙʟᴀᴄᴋʟɪsᴛ ᴀᴜᴛᴏ ᴊᴘᴍ*\n\n` +
            `> Berhasil dihapus: \`${removed}\` grup\n` +
            `> Sisa blacklist: \`${blacklist.length}\` grup\n\n` +
            `_Grup-grup ini akan menerima Auto JPM lagi._`
        )
    }
    
    return m.reply(`❌ *Ehh~* Action tidak valid. Gunakan: \`add\`, \`del\`, atau \`list\``)
}

module.exports = {
    config: pluginConfig,
    handler
}
