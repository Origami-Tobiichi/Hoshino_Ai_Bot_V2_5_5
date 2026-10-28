const { stopJadibot, isJadibotActive, jadibotSessions, safeSend } = require('../../src/lib/jadibotManager')

const pluginConfig = {
    name: 'stopjadibot',
    alias: ['stopjbot', 'endjadibot'],
    category: 'premium',
    description: 'Hentikan jadibot kamu',
    usage: '.stopjadibot',
    example: '.stopjadibot',
    isOwner: false,
    isPremium: true,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
}

async function handler(m, { sock }) {
    const userJid = m.sender
    const id = userJid.replace(/@.+/g, '')

    if (!isJadibotActive(userJid)) {
        return sock.sendMessage(m.chat, {
            text: `❌ *ᴛɪᴅᴀᴋ ᴀᴅᴀ ᴊᴀᴅɪʙᴏᴛ ᴀᴋᴛɪꜰ*\n\n` +
                `Kamu belum punya jadibot yang berjalan.\n\n` +
                `> Ketik \`${m.prefix}jadibot\` untuk memulai`,
            interactiveButtons: [
                {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: '🤖 Mulai Jadibot',
                        id: `${m.prefix}jadibot`
                    })
                }
            ]
        }, { quoted: m })
    }

    const session = jadibotSessions.get(id)
    if (session && session.ownerJid !== m.sender && !m.isOwner) {
        return m.reply(`❌ *Gomen ne~* Kamu tidak bisa menghentikan jadibot orang lain~ 🥺`)
    }

    const uptime = session ? formatUptime(Date.now() - session.startedAt) : '-'

    m.react('🕕')

    try {
        await stopJadibot(userJid, false)

        m.react('✅')
        await safeSend(sock, m.chat, {
            text: `🛑 *ᴊᴀᴅɪʙᴏᴛ ᴅɪʜᴇɴᴛɪᴋᴀɴ*\n\n` +
                `> 📱 Nomor: *@${id}*\n` +
                `> ⏱️ Uptime: *${uptime}*\n` +
                `> 💾 Session: *Disimpan*\n\n` +
                `Session tersimpan — bisa diaktifkan ulang kapanpun.`,
            mentions: [userJid],
            interactiveButtons: [
                {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: '🔄 Aktifkan Lagi',
                        id: `${m.prefix}jadibot`
                    })
                }
            ]
        }, { quoted: m })
    } catch (error) {
        m.react('❌')
        await m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
