const { stopJadibot, getAllJadibotSessions } = require('../../src/lib/jadibotManager')

const pluginConfig = {
    name: 'stopdandeletejadibot',
    alias: ['deletejadibot', 'removejadibot', 'hapusjadibot'],
    category: 'owner',
    description: 'Stop dan hapus session jadibot user secara permanen',
    usage: '.stopdandeletejadibot @user',
    example: '.stopdandeletejadibot @628xxx',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    let target = null

    if (m.quoted) {
        target = m.quoted.sender
    } else if (m.mentionedJid?.[0]) {
        target = m.mentionedJid[0]
    } else if (m.text?.trim()) {
        const num = m.text.trim().replace(/[^0-9]/g, '')
        if (num) target = num + '@s.whatsapp.net'
    }

    if (!target) {
        const sessions = getAllJadibotSessions()

        if (sessions.length === 0) {
            return m.reply(`❌ *Ehh~* Tidak ada session jadibot tersimpan~ 🥺`)
        }

        let txt = `🗑️ *sᴛᴏᴘ & ᴅᴇʟᴇᴛᴇ ᴊᴀᴅɪʙᴏᴛ*\n\n`
        txt += `Pilih target dengan mention atau reply:\n\n`

        sessions.forEach((s, i) => {
            const status = s.isActive ? '🟢' : '⚫'
            txt += `${status} *${i + 1}.* @${s.id}\n`
        })

        txt += `\n> Contoh: \`${m.prefix}stopdandeletejadibot @628xxx\``

        return sock.sendMessage(m.chat, {
            text: txt,
            mentions: sessions.map(s => s.jid)
        }, { quoted: m })
    }

    const id = target.replace(/@.+/g, '')
    const sessions = getAllJadibotSessions()
    const session = sessions.find(s => s.id === id)

    if (!session) {
        return m.reply(`❌ *Ehh~* Session jadibot untuk *@${id}* tidak ditemukan~ 🥺`, { mentions: [target] })
    }

    m.react('🕕')

    try {
        await stopJadibot(target, true)

        m.react('✅')

        await sock.sendMessage(m.chat, {
            text: `🗑️ *ᴊᴀᴅɪʙᴏᴛ ᴅɪʜᴀᴘᴜs*\n\n` +
                `> 📱 Nomor: *@${id}*\n` +
                `> 🗑️ Status: *Deleted*\n\n` +
                `Session telah dihapus secara permanen.\n` +
                `User perlu \`.jadibot\` ulang untuk membuat session baru.`,
            mentions: [target]
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
