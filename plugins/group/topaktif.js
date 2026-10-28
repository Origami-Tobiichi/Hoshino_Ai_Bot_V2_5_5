const fs = require('fs')
const path = require('path')

// ===== CONFIG =====
const pluginConfig = {
    name: 'topaktif',
    alias: ['topactive'],
    category: 'group',
    description: 'Menampilkan user paling aktif di grup',
    usage: '.topaktif',
    cooldown: 5,
    energi: 1,
    isGroup: true,
    isAdmin: false
}

const DB_PATH = path.join(__dirname, '../../database/other/topaktif.json')

function readDB() {
    try {
        if (!fs.existsSync(DB_PATH)) return {}
        const raw = fs.readFileSync(DB_PATH, 'utf8').trim()
        if (!raw) return {}
        return JSON.parse(raw)
    } catch (e) {
        console.error('[TOPAKTIF] DB rusak/kosong:', e.message)
        return {}
    }
}

// ===== HANDLER =====
async function handler(m, { sock }) {
    try {
        const jid = m.chat
        const db = readDB()
        const data = db[jid] || {}

        const entries = Object.entries(data)
        if (!entries.length) return m.reply('Belum ada aktivitas di grup ini 😅')

        const sorted = entries.sort((a, b) => b[1] - a[1]).slice(0, 10)

        let reply = `╭───〔 🎤 *H O S H I N O* 〕───⬡
┃ 🌸 *TOP ACTIVE USERS*
╰───────────────────────⬡\n\n`

        sorted.forEach(([jidUser, count], i) => {
            const nomor = jidUser.split('@')[0]
            const rank = i + 1
            let icon = '🔹'
            if (rank === 1) icon = '👑'
            if (rank === 2) icon = '🥈'
            if (rank === 3) icon = '🥉'

            reply += `${icon} *#${rank}* @${nomor}\n   └─💬 ${count} Pesan\n`
        })

        reply += `\n╭───────────────────────⬡
┃ ✨ Hoshino Ai Idol
╰───────────────────────⬡`

        return m.reply(reply, { mentions: sorted.map(v => v[0]) })

    } catch (err) {
        console.error('[TOPAKTIF ERROR]', err)
        return m.reply('Terjadi error saat menampilkan top aktif.')
    }
}

// ===== EXPORT =====
module.exports = {
    config: pluginConfig,
    handler
}