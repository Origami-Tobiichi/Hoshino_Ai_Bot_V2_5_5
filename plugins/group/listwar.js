const GL = require('../../src/lib/listWar')

const pluginConfig = {
    name: 'listwar',
    alias: ['triggerlist', 'autolist'],
    category: 'group',
    description: 'Aktif/nonaktifkan trigger list grup (ketik "war" / "list" tanpa prefix)',
    usage: '.listwar <on/off>',
    example: '.listwar on',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true,
    isAdmin: true,
    isBotAdmin: false
}

async function handler(m, { sock, db }) {
    const action = (m.args || [])[0]?.toLowerCase()
    const group = db.getGroup(m.chat) || {}

    if (!action) {
        const on = GL.isEnabled(m.chat)
        return m.reply(
            `📋 *ʟɪsᴛ ᴛʀɪɢɢᴇʀ*\n\n` +
            `> Status: *${on ? '✅ Aktif' : '❌ Nonaktif'}*\n` +
            `> Jumlah list: *${Object.keys(GL.getLists(m.chat)).length}*\n\n` +
            `> \`${m.prefix}listwar on\` / \`${m.prefix}listwar off\`\n` +
            `> Kalau aktif, ketik nama list (contoh: *war*) atau *list* tanpa prefix, bot langsung membalas.`
        )
    }

    if (action === 'on') {
        db.setGroup(m.chat, { ...group, listWar: 'on' })
        try { await db.save() } catch {}
        m.react('✅')
        return m.reply(`✅ *List trigger diaktifkan*\n\n> Ketik *list* untuk melihat daftar list grup ini.`)
    }

    if (action === 'off') {
        db.setGroup(m.chat, { ...group, listWar: 'off' })
        try { await db.save() } catch {}
        m.react('❌')
        return m.reply(`❌ *List trigger dinonaktifkan*\n\n> List tetap tersimpan, dan command \`${m.prefix}list\` masih bisa dipakai.`)
    }

    return m.reply(`❌ *Ehh~* Gunakan \`${m.prefix}listwar on\` atau \`${m.prefix}listwar off\``)
}

module.exports = {
    config: pluginConfig,
    handler
}
