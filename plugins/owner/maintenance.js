const { getDatabase } = require('../../src/lib/database')
const config = require('../../config')

const pluginConfig = {
    name: 'maintenance',
    alias: ['matiin', 'nyalain', 'setmaintenance', 'cekstatus'],
    category: 'owner',
    description: 'Mode maintenance — bot hanya respon owner, user lain dapat pesan custom',
    usage: '.maintenance on/off [pesan] | .cekstatus',
    example: '.maintenance on Bot lagi update ya, tunggu sebentar~',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

const AI = {
    ok:   (msg) => `✨ *${msg}*\n\n> Ai seneng bisa bantu kamu~ 💖`,
    err:  (msg) => `💔 *Aduh~ Ada yang salah nih!*\n\n> ${msg}\n\n> Jangan nyerah ya, Ai tetap di sini! ✨`,
    warn: (msg) => `🌸 *Hmm~ Perhatiin dulu ya!*\n\n> ${msg}`,
}

// ── Export fungsi cek, dipanggil dari handler.js atau plugin lain ─────────────
function isMaintenanceActive(db) {
    return db.setting('maintenanceMode') === true
}

function getMaintenanceMsg(db) {
    return db.setting('maintenanceMsg') ||
        '🔧 Bot sedang dalam mode maintenance~\n\nTunggu sebentar ya, Ai balik lagi segera! 💕⭐'
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const cmd = m.command.toLowerCase()

    // ── CEK STATUS ────────────────────────────────────────────────────────────
    if (cmd === 'cekstatus') {
        const aktif = isMaintenanceActive(db)
        const pesan = getMaintenanceMsg(db)
        const since = db.setting('maintenanceSince')
        const sinceText = since
            ? new Date(since).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
            : '-'

        return m.reply(
            `🔧 *sᴛᴀᴛᴜs ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ*\n\n` +
            `╭┈┈⬡「 📋 *ɪɴꜰᴏ* 」\n` +
            `┃ 🔧 sᴛᴀᴛᴜs: *${aktif ? '🔴 AKTIF' : '🟢 NONAKTIF'}*\n` +
            `┃ ⏱️ sᴇᴊᴀᴋ: *${sinceText}*\n` +
            `╰┈┈⬡\n\n` +
            `╭┈┈⬡「 💬 *ᴘᴇsᴀɴ ᴜsᴇʀ* 」\n` +
            `┃ ${pesan.replace(/\n/g, '\n┃ ')}\n` +
            `╰┈┈⬡`
        )
    }

    // ── ON / OFF ──────────────────────────────────────────────────────────────
    const toggle = m.args?.[0]?.toLowerCase()

    if (!toggle || !['on', 'off'].includes(toggle)) {
        const aktif = isMaintenanceActive(db)
        return m.reply(
            `🔧 *ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ ᴍᴏᴅᴇ*\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
            `┃ ◦ \`${m.prefix}maintenance on\` — Aktifkan\n` +
            `┃ ◦ \`${m.prefix}maintenance on <pesan>\` — Aktifkan + custom msg\n` +
            `┃ ◦ \`${m.prefix}maintenance off\` — Nonaktifkan\n` +
            `┃ ◦ \`${m.prefix}cekstatus\` — Cek status\n` +
            `╰┈┈⬡\n\n` +
            `> Status sekarang: *${aktif ? '🔴 AKTIF' : '🟢 NONAKTIF'}*\n` +
            `> _Saat aktif, hanya owner yang bisa pakai bot~ 🌸_`
        )
    }

    if (toggle === 'on') {
        if (isMaintenanceActive(db)) {
            return m.reply(AI.warn('Mode maintenance sudah aktif nih~\n\n> Gunakan `off` untuk mematikan dulu'))
        }

        // Custom pesan jika ada
        const customMsg = m.args.slice(1).join(' ').trim()
        const finalMsg = customMsg ||
            `🔧 *Bot Maintenance*\n\nBot lagi diperbaiki sama owner~\nTunggu sebentar ya, Ai balik lagi segera! 💕⭐`

        db.setting('maintenanceMode', true)
        db.setting('maintenanceMsg', finalMsg)
        db.setting('maintenanceSince', Date.now())

        const botName = config.bot?.name || 'Hoshino Ai'

        m.react('🔧')
        return m.reply(
            `🔧 *ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ ᴅɪᴀᴋᴛɪꜰᴋᴀɴ* 🌸\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 🔧 sᴛᴀᴛᴜs: *🔴 AKTIF*\n` +
            `┃ 🤖 ʙᴏᴛ: *${botName}*\n` +
            `┃ 👑 ʜᴀɴʏᴀ: *Owner bisa akses*\n` +
            `╰┈┈⬡\n\n` +
            `╭┈┈⬡「 💬 *ᴘᴇsᴀɴ ᴜsᴇʀ* 」\n` +
            `┃ ${finalMsg.replace(/\n/g, '\n┃ ')}\n` +
            `╰┈┈⬡\n\n` +
            `> _Gunakan \`${m.prefix}maintenance off\` untuk mematikan~ 💖_`
        )
    }

    if (toggle === 'off') {
        if (!isMaintenanceActive(db)) {
            return m.reply(AI.warn('Mode maintenance sudah tidak aktif nih~'))
        }

        const since = db.setting('maintenanceSince')
        const durasiMs = since ? Date.now() - since : 0
        const durasiMenit = Math.floor(durasiMs / 60000)
        const durasiText = durasiMenit < 60
            ? `${durasiMenit} menit`
            : `${Math.floor(durasiMenit / 60)} jam ${durasiMenit % 60} menit`

        db.setting('maintenanceMode', false)
        db.setting('maintenanceMsg', null)
        db.setting('maintenanceSince', null)

        m.react('✅')
        return m.reply(
            `✅ *ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ ᴅɪɴᴏɴᴀᴋᴛɪꜰᴋᴀɴ* 🌸\n\n` +
            `╭┈┈⬡「 📋 *ʀᴇᴋᴀᴘ* 」\n` +
            `┃ 🟢 sᴛᴀᴛᴜs: *NONAKTIF*\n` +
            `┃ ⏱️ ᴅᴜʀᴀsɪ: *${since ? durasiText : '-'}*\n` +
            `╰┈┈⬡\n\n` +
            `> _Bot sudah bisa dipakai semua user lagi~ 💕_`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler,
    isMaintenanceActive,
    getMaintenanceMsg
}