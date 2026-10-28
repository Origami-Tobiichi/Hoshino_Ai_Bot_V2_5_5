const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: 'ratelimitlog',
    alias: ['ratelimit', 'rll', 'spamlog'],
    category: 'owner',
    description: 'Monitor user yang spam command secara global, dengan auto-warning & auto-mute sementara',
    usage: '.ratelimitlog [list|reset <user>|unmute <user>|set <maxCmd> <windowSec> <muteSec>]',
    example: '.ratelimitlog list',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 0,
    energi: 0,
    isEnabled: true
}

// ── Konfigurasi default (bisa diubah via .ratelimitlog set) ────────────────────
const STATE_FILE = path.join(process.cwd(), 'database', 'ratelimitlog.json')

let settings = {
    maxCommands: 8,     // maksimal command
    windowSec: 10,      // dalam X detik
    muteSec: 60,        // auto-mute sementara selama X detik
    warnThreshold: 0.7, // kasih warning di X% dari maxCommands
}

function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
            if (data.settings) settings = { ...settings, ...data.settings }
            return data
        }
    } catch {}
    return { settings, log: [] }
}

function saveState(extra = {}) {
    try {
        const dir = path.dirname(STATE_FILE)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        const current = loadState()
        fs.writeFileSync(STATE_FILE, JSON.stringify({ ...current, settings, ...extra }, null, 2), 'utf8')
    } catch {}
}

loadState()

// ── In-memory tracker per user (global, lintas grup/chat) ──────────────────────
// Map<senderJid, { timestamps: number[], warned: boolean, mutedUntil: number, totalFlags: number, lastCommand: string }>
const userTracker = new Map()

// ── Log histori user yang pernah kena flag (buat .ratelimitlog list) ───────────
const flagLog = [] // { sender, command, chat, time, action }
const MAX_FLAG_LOG = 100

function getEntry(sender) {
    let entry = userTracker.get(sender)
    if (!entry) {
        entry = { timestamps: [], warned: false, mutedUntil: 0, totalFlags: 0, lastCommand: null }
        userTracker.set(sender, entry)
    }
    return entry
}

function pushFlagLog(data) {
    flagLog.unshift({ ...data, time: Date.now() })
    if (flagLog.length > MAX_FLAG_LOG) flagLog.pop()
}

/**
 * Middleware — dipanggil di handler.js sebelum eksekusi command.
 * Return true kalau user harus diblok (sedang muted / kena auto-mute baru).
 * Return false kalau aman lanjut.
 *
 * @param {Object} m - serialized message
 * @param {Object} sock
 * @param {Object} db
 * @returns {Promise<boolean>}
 */
async function checkRateLimit(m, sock, db) {
    if (m.isOwner || m.isPartner) return false
    if (!m.isCommand) return false

    const sender = m.sender
    const now = Date.now()
    const entry = getEntry(sender)

    // ── Cek apakah sedang dalam masa mute ───────────────────────────────────────
    if (entry.mutedUntil > now) {
        const remaining = Math.ceil((entry.mutedUntil - now) / 1000)
        // Cuma kasih notif sesekali biar ga spam balik
        if (!entry._lastMuteNotif || now - entry._lastMuteNotif > 10000) {
            entry._lastMuteNotif = now
            await m.reply(
                `🔇 *ʀᴀᴛᴇ ʟɪᴍɪᴛ ᴀᴋᴛɪꜰ~*\n\n` +
                `Eeh~ kamu kecepetan banget kirim command nih! 😳\n` +
                `Tunggu *${remaining} detik* lagi ya sebelum coba lagi~ 🌸`
            ).catch(() => {})
        }
        return true
    }

    // ── Bersihkan timestamp di luar window ──────────────────────────────────────
    const windowMs = settings.windowSec * 1000
    entry.timestamps = entry.timestamps.filter(t => now - t < windowMs)
    entry.timestamps.push(now)
    entry.lastCommand = m.command

    const count = entry.timestamps.length
    const warnAt = Math.ceil(settings.maxCommands * settings.warnThreshold)

    // ── Kena limit → auto-mute sementara ────────────────────────────────────────
    if (count >= settings.maxCommands) {
        entry.mutedUntil = now + settings.muteSec * 1000
        entry.timestamps = []
        entry.warned = false
        entry.totalFlags = (entry.totalFlags || 0) + 1
        entry._lastMuteNotif = now

        pushFlagLog({
            sender,
            command: m.command,
            chat: m.chat,
            action: 'mute',
            count,
        })

        await m.reply(
            `🚨 *ᴛᴇʀᴅᴇᴛᴇᴋsɪ sᴘᴀᴍ!*\n\n` +
            `Kamu kirim *${count} command* dalam *${settings.windowSec} detik*~\n` +
            `Ai bisu-in kamu sementara selama *${settings.muteSec} detik* ya, biar agak santai dulu~ 😅\n\n` +
            `> 🌸 Tenang aja, ini cuma sementara kok~`
        ).catch(() => {})

        return true
    }

    // ── Mendekati limit → kasih warning sekali ──────────────────────────────────
    if (count >= warnAt && !entry.warned) {
        entry.warned = true

        pushFlagLog({
            sender,
            command: m.command,
            chat: m.chat,
            action: 'warn',
            count,
        })

        await m.reply(
            `⚠️ *ᴘᴇʀɪɴɢᴀᴛᴀɴ~*\n\n` +
            `Hee~ kamu udah kirim *${count} command* dalam *${settings.windowSec} detik* lho!\n` +
            `Kalau sampai *${settings.maxCommands}x*, Ai bakal bisu-in kamu sementara ya~ 🌸`
        ).catch(() => {})
    }

    // Reset flag warning kalau udah agak longgar lagi
    if (count < warnAt) entry.warned = false

    return false
}

// ── Handler command owner ───────────────────────────────────────────────────────
const handler = async (m, { db }) => {
    const sub = (m.args?.[0] || 'list').toLowerCase()

    // ── .ratelimitlog list ────────────────────────────────────────────────────────
    if (sub === 'list' || sub === '') {
        if (flagLog.length === 0) {
            return m.reply(
                `📋 *ʀᴀᴛᴇ ʟɪᴍɪᴛ ʟᴏɢ*\n\n` +
                `> Belum ada user yang kena flag~ Aman semua! 💖\n\n` +
                `*sᴇᴛᴛɪɴɢ sᴀᴀᴛ ɪɴɪ:*\n` +
                `> Max ${settings.maxCommands} command / ${settings.windowSec}s → mute ${settings.muteSec}s`
            )
        }

        let txt = `📋 *ʀᴀᴛᴇ ʟɪᴍɪᴛ ʟᴏɢ* (terbaru ${Math.min(flagLog.length, 10)})\n\n`

        for (const entry of flagLog.slice(0, 10)) {
            const num = entry.sender.split('@')[0]
            const time = new Date(entry.time).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })
            const icon = entry.action === 'mute' ? '🔇' : '⚠️'
            txt += `${icon} *@${num}* — \`${entry.command}\` (${entry.count}x) di ${time}\n`
        }

        // Ringkasan user yang sedang muted
        const mutedNow = []
        const now = Date.now()
        for (const [sender, e] of userTracker) {
            if (e.mutedUntil > now) {
                mutedNow.push({ sender, remaining: Math.ceil((e.mutedUntil - now) / 1000) })
            }
        }

        if (mutedNow.length) {
            txt += `\n🔇 *sᴇᴅᴀɴɢ ᴅɪᴍᴜᴛᴇ:*\n`
            for (const u of mutedNow) {
                txt += `> @${u.sender.split('@')[0]} — sisa ${u.remaining}s\n`
            }
        }

        txt += `\n*sᴇᴛᴛɪɴɢ:* Max ${settings.maxCommands} cmd / ${settings.windowSec}s → mute ${settings.muteSec}s`

        return m.reply(txt, { mentions: [...flagLog.slice(0, 10).map(e => e.sender), ...mutedNow.map(u => u.sender)] })
    }

    // ── .ratelimitlog reset <user> ────────────────────────────────────────────────
    if (sub === 'reset') {
        let target = m.args[1]
        if (m.quoted) target = m.quoted.sender
        if (m.mentionedJid?.length) target = m.mentionedJid[0]

        if (!target) {
            return m.reply(`⚠️ Tag/reply user, atau masukin nomornya~\n> \`.ratelimitlog reset 628xxx\``)
        }

        target = target.replace(/[^0-9]/g, '') + '@s.whatsapp.net'

        if (userTracker.has(target)) {
            userTracker.delete(target)
            return m.reply(`✅ Rate limit untuk @${target.split('@')[0]} udah direset~ 🌸`, { mentions: [target] })
        }
        return m.reply(`> User itu nggak ada di tracker kok~`)
    }

    // ── .ratelimitlog unmute <user> ───────────────────────────────────────────────
    if (sub === 'unmute') {
        let target = m.args[1]
        if (m.quoted) target = m.quoted.sender
        if (m.mentionedJid?.length) target = m.mentionedJid[0]

        if (!target) {
            return m.reply(`⚠️ Tag/reply user, atau masukin nomornya~\n> \`.ratelimitlog unmute 628xxx\``)
        }

        target = target.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
        const entry = userTracker.get(target)

        if (!entry || entry.mutedUntil <= Date.now()) {
            return m.reply(`> User itu nggak sedang dimute kok~`)
        }

        entry.mutedUntil = 0
        entry.timestamps = []
        entry.warned = false

        return m.reply(`✅ @${target.split('@')[0]} udah dibebaskan dari mute~ 💖`, { mentions: [target] })
    }

    // ── .ratelimitlog set <maxCmd> <windowSec> <muteSec> ─────────────────────────
    if (sub === 'set') {
        const maxCmd = parseInt(m.args[1])
        const windowSec = parseInt(m.args[2])
        const muteSec = parseInt(m.args[3])

        if (!maxCmd || !windowSec || !muteSec) {
            return m.reply(
                `⚠️ *ꜰᴏʀᴍᴀᴛ sᴀʟᴀʜ~*\n\n` +
                `> \`.ratelimitlog set <maxCmd> <windowSec> <muteSec>\`\n\n` +
                `*ᴄᴏɴᴛᴏʜ:*\n` +
                `> \`.ratelimitlog set 8 10 60\`\n` +
                `> (maks 8 command dalam 10 detik, kalau lebih → mute 60 detik)\n\n` +
                `*sᴇᴛᴛɪɴɢ sᴀᴀᴛ ɪɴɪ:*\n` +
                `> ${settings.maxCommands} cmd / ${settings.windowSec}s → mute ${settings.muteSec}s`
            )
        }

        settings.maxCommands = maxCmd
        settings.windowSec = windowSec
        settings.muteSec = muteSec
        saveState()

        return m.reply(
            `✅ *sᴇᴛᴛɪɴɢ ᴅɪᴜʙᴀʜ~*\n\n` +
            `> Max command: *${maxCmd}*\n` +
            `> Window: *${windowSec}s*\n` +
            `> Durasi mute: *${muteSec}s*`
        )
    }

    return m.reply(
        `🚦 *ʀᴀᴛᴇ ʟɪᴍɪᴛ ᴍᴏɴɪᴛᴏʀ*\n\n` +
        `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
        `┃ \`.ratelimitlog list\`            — lihat log & user yang dimute\n` +
        `┃ \`.ratelimitlog reset <user>\`    — reset tracker user\n` +
        `┃ \`.ratelimitlog unmute <user>\`   — bebasin dari mute manual\n` +
        `┃ \`.ratelimitlog set <a> <b> <c>\` — ubah threshold\n` +
        `╰┈┈┈┈┈┈┈┈⬡\n\n` +
        `*sᴇᴛᴛɪɴɢ sᴀᴀᴛ ɪɴɪ:*\n` +
        `> Max ${settings.maxCommands} command / ${settings.windowSec}s → auto-mute ${settings.muteSec}s\n\n` +
        `> 💡 Beda dari \`.slowmode\` yang per-grup, ini ngecek per-user *global* lintas chat~`
    )
}

module.exports = {
    config: pluginConfig,
    handler,
    checkRateLimit,
}