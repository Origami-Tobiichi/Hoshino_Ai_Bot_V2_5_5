const pluginConfig = {
    name: 'antiswgc',
    alias: ['antistatusgc', 'antigroupstatus'],
    category: 'group',
    description: 'Hapus otomatis story/status grup dari member non-admin',
    usage: '.antiswgc <on/off>',
    example: '.antiswgc on',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true,
    isAdmin: true,
    isBotAdmin: true
}

async function handler(m, { sock, db }) {
    const action = (m.args || [])[0]?.toLowerCase()
    const arg = (m.args || [])[1]?.toLowerCase()
    const groupId = m.chat
    const group = db.getGroup(groupId) || {}
    const save = (data) => db.setGroup(groupId, { ...group, ...data })

    const on = group.antiswgc === 'on'
    const warnOn = group.antiswgcWarn === 'on'
    const limit = group.antiswgcLimit || 3

    if (!action) {
        return m.reply(
            `📢 *ᴀɴᴛɪsᴡɢᴄ sᴇᴛᴛɪɴɢs*\n\n` +
            `> Status: *${on ? '✅ Aktif' : '❌ Nonaktif'}*\n` +
            `> Warn: *${warnOn ? '✅ Aktif' : '❌ Nonaktif'}*\n` +
            `> Limit: *${limit}x* lalu kick\n\n` +
            `\`\`\`━━━ ᴘɪʟɪʜᴀɴ ━━━\`\`\`\n` +
            `> \`${m.prefix}antiswgc on/off\`\n` +
            `> \`${m.prefix}antiswgc warn on/off\`\n` +
            `> \`${m.prefix}antiswgc limit <1-10>\`\n` +
            `> \`${m.prefix}antiswgc reset\` → hapus semua warn`
        )
    }

    if (action === 'on' || action === 'off') {
        save({ antiswgc: action })
        return m.reply(
            action === 'on'
                ? `✅ *ᴀɴᴛɪsᴡɢᴄ ᴀᴋᴛɪꜰ*\n\n> Story grup dari member akan dihapus otomatis.\n> Admin & owner dikecualikan.`
                : `❌ *ᴀɴᴛɪsᴡɢᴄ ɴᴏɴᴀᴋᴛɪꜰ*\n\n> Berhasil dinonaktifkan.`
        )
    }

    if (action === 'warn') {
        if (arg !== 'on' && arg !== 'off') {
            return m.reply(`❌ Gunakan: \`${m.prefix}antiswgc warn on/off\``)
        }
        save({ antiswgcWarn: arg })
        return m.reply(
            arg === 'on'
                ? `✅ *ᴡᴀʀɴ ᴀɴᴛɪsᴡɢᴄ ᴀᴋᴛɪꜰ*\n\n> Member kena warn tiap posting story.\n> Mencapai *${limit}x* → di-kick.`
                : `❌ *ᴡᴀʀɴ ᴀɴᴛɪsᴡɢᴄ ɴᴏɴᴀᴋᴛɪꜰ*\n\n> Story tetap dihapus, tanpa warn/kick.`
        )
    }

    if (action === 'limit') {
        const n = parseInt(arg)
        if (!n || n < 1 || n > 10) {
            return m.reply(`❌ Limit harus angka 1-10.\n> Contoh: \`${m.prefix}antiswgc limit 3\``)
        }
        save({ antiswgcLimit: n })
        return m.reply(`✅ Limit warn diubah ke *${n}x*.`)
    }

    if (action === 'reset') {
        save({ antiswgcWarns: {} })
        return m.reply(`✅ Semua warn antiswgc di grup ini sudah direset.`)
    }

    return m.reply(`❌ *ᴘɪʟɪʜᴀɴ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ*\n\n> Gunakan: on, off, warn, limit, atau reset`)
}

module.exports = { config: pluginConfig, handler }