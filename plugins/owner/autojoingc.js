const config = require('../../config')
const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'autojoingc',
    alias: ['autojoin', 'autojoingroup'],
    category: 'owner',
    description: 'Auto join grup dari link yang terdeteksi di chat',
    usage: '.autojoingc on/off',
    example: '.autojoingc on',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

const GROUP_LINK_REGEX = /chat\.whatsapp\.com\/([a-zA-Z0-9]{18,24})/gi

async function handler(m, { sock }) {
    try {
        const db = getDatabase()
        const arg = (m.args?.[0] || '').toLowerCase()

        if (!arg || !['on', 'off'].includes(arg)) {
            const current = db.setting('autoJoinGc') || false
            return m.reply(
                `🔗 *ᴀᴜᴛᴏ ᴊᴏɪɴ ɢʀᴏᴜᴘ* ★\n\n` +
                `ne ne~ ini fitur buat aku otomatis masuk grup dari link yang kedetect ya~\n\n` +
                `╭┈┈⬡「 📋 *sᴛᴀᴛᴜs* 」\n` +
                `┃ ${current ? '✅ lagi aktif nih~ ehehe~' : '❌ lagi off nih, mau dinyalain? 😏'}\n` +
                `╰┈┈┈┈┈┈┈┈⬡\n\n` +
                `> \`${m.prefix}autojoingc on\` — aktifkan ★\n` +
                `> \`${m.prefix}autojoingc off\` — nonaktifkan\n\n` +
                `_yappari kalau mau aku join otomatis, tinggal bilang on aja ne~ 💜_`
            )
        }

        const enabled = arg === 'on'
        db.setting('autoJoinGc', enabled)
        await db.save()

        await m.reply(
            enabled
                ? `✅ *ᴀᴜᴛᴏ ᴊᴏɪɴ* ᴅɪᴀᴋᴛɪғᴋᴀɴ ★\n\n> ii ne~ aku bakal otomatis masuk grup kalau ada link kedetect ya~ 💜\n> _daijoubu, serahin aja sama aku ehehe~_`
                : `❌ *ᴀᴜᴛᴏ ᴊᴏɪɴ* ᴅɪɴᴏɴᴀᴋᴛɪғᴋᴀɴ\n\n> mou~ yaudah aku istirahat dulu dari auto join ya~\n> _kalau butuh lagi tinggal bilang aja ne~ 🌸_`
        )
    } catch (error) {
        console.error('AutoJoinGc Plugin Error:', error)
        await m.reply(`❌ *ɢᴀɢᴀʟ* ★\n\n> iya da~ ada yang error nih~\n> ${error.message}\n\n_mou~ maaf ya ne~ 😳_`)
    }
}

async function autoJoinDetector(m, sock) {
    try {
        const db = getDatabase()
        if (!db?.ready) return false
        if (!db.setting('autoJoinGc')) return false
        if (!m.body) return false

        const matches = [...m.body.matchAll(GROUP_LINK_REGEX)]
        if (!matches.length) return false

        let joined = 0
        for (const match of matches) {
            const code = match[1]
            try {
                const result = await sock.groupAcceptInvite(code)
                if (result) joined++
            } catch (e) {
                const msg = e.message || String(e)
                if (msg.includes('already') || msg.includes('participant')) {
                    await m.reply(`⚠️ hee~ aku udah ada di grup itu kok ne~ 😏`)
                } else if (msg.includes('expired') || msg.includes('revoked')) {
                    await m.reply(`❌ mou~ linknya udah expired atau revoked nih~\n\n> _sabishii~ gak bisa masuk deh 🌸_`)
                } else {
                    await m.reply(`❌ *ɢᴀɢᴀʟ ᴍᴀsᴜᴋ ɢʀᴜᴘ* ★\n\n> iya da~ ada error waktu coba join~\n> ${msg}\n\n_mou~ maaf ya ne~ 😳_`)
                }
            }
        }

        return joined > 0
    } catch (error) {
        console.error('AutoJoinDetector Error:', error)
        return false
    }
}

module.exports = {
    config: pluginConfig,
    handler,
    autoJoinDetector
}