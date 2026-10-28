const { getSummary } = require('../../src/lib/groupActivity')

const pluginConfig = {
    name: 'groupsummary',
    alias: ['gsummary', 'rekapgrup', 'aktivitasgrup'],
    category: 'group',
    description: 'Rekap aktivitas grup 24 jam: user paling aktif, command terpopuler, total pesan',
    usage: '.groupsummary [jam]',
    example: '.groupsummary | .groupsummary 12',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

const handler = async (m) => {
    let hours = parseInt(m.args?.[0]) || 24
    if (hours < 1) hours = 1
    if (hours > 168) hours = 168 // max 7 hari

    const summary = getSummary(m.chat, hours)

    if (summary.totalMessages === 0 && summary.totalCommands === 0) {
        return m.reply(
            `📊 *ɢʀᴏᴜᴘ sᴜᴍᴍᴀʀʏ*\n\n` +
            `> Belum ada aktivitas tercatat dalam ${hours} jam terakhir~ 😅\n` +
            `> Coba lagi nanti setelah ada yang chat ya~ 🌸`
        )
    }

    const periodLabel = hours === 24 ? '24 jam' : `${hours} jam`

    let txt = `📊 *ɢʀᴏᴜᴘ sᴜᴍᴍᴀʀʏ* (${periodLabel} terakhir)\n\n`

    // Ringkasan umum
    txt += `╭┈┈⬡「 📈 *ʀɪɴɢᴋᴀsᴀɴ* 」\n`
    txt += `┃ 💬 Total pesan: *${summary.totalMessages}*\n`
    txt += `┃ ⚡ Total command: *${summary.totalCommands}*\n`
    txt += `┃ 👥 User aktif: *${summary.activeUsers.length}*\n`
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`

    // Top user paling aktif
    const topUsers = summary.activeUsers.slice(0, 5)
    txt += `╭┈┈⬡「 🏆 *ᴛᴏᴘ ᴜsᴇʀ ᴀᴋᴛɪꜰ* 」\n`
    topUsers.forEach((u, i) => {
        const rank = i + 1
        let icon = '🔹'
        if (rank === 1) icon = '👑'
        else if (rank === 2) icon = '🥈'
        else if (rank === 3) icon = '🥉'

        const total = u.messages + u.commands
        txt += `┃ ${icon} @${u.jid.split('@')[0]} — *${total}* aktivitas\n`
        txt += `┃    └─ 💬 ${u.messages} pesan, ⚡ ${u.commands} command\n`
    })
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`

    // Command terpopuler
    if (summary.topCommands.length) {
        const topCmds = summary.topCommands.slice(0, 5)
        txt += `╭┈┈⬡「 🔥 *ᴄᴏᴍᴍᴀɴᴅ ᴛᴇʀᴘᴏᴘᴜʟᴇʀ* 」\n`
        topCmds.forEach((c, i) => {
            txt += `┃ ${i + 1}. \`${c.cmd}\` — ${c.count}x\n`
        })
        txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`
    }

    txt += `> ✨ Terus aktif ya~ Ai senang lihat grup ramai! 💖`

    return m.reply(txt, { mentions: topUsers.map(u => u.jid) })
}

module.exports = {
    config: pluginConfig,
    handler,
}