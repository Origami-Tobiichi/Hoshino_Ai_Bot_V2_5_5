const afkStorage = global.afkStorage || (global.afkStorage = new Map())

const pluginConfig = {
    name: 'afk',
    alias: ['away', 'brb', 'afkformat', 'afkhelp', 'afklist', 'afkremove'],
    category: 'group',
    description: 'Set status AFK dengan alasan dan durasi opsional',
    usage: '.afk [--durasi] <alasan>',
    example: '.afk --2jam lagi meeting',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

// ── Storage helpers ────────────────────────────────────────────────────────

/**
 * Key: kalau di grup → "jid|groupId", kalau PM → "jid|global"
 */
function makeKey(jid, groupId = null) {
    return groupId ? `${jid}|${groupId}` : `${jid}|global`
}

function setAfkUser(jid, reason, groupId = null, expiresAt = null) {
    const key = makeKey(jid, groupId)
    afkStorage.set(key, {
        jid,
        groupId,
        reason: reason || 'Tidak ada alasan',
        time: Date.now(),
        expiresAt,
        mentionLog: [] // [{sender, name, time}]
    })
}

function getAfkUser(jid, groupId = null) {
    // Cek per grup dulu, kalau tidak ada cek global
    if (groupId) {
        const groupKey = makeKey(jid, groupId)
        if (afkStorage.has(groupKey)) return afkStorage.get(groupKey)
    }
    const globalKey = makeKey(jid, null)
    if (afkStorage.has(globalKey)) return afkStorage.get(globalKey)
    return null
}

function removeAfkUser(jid, groupId = null) {
    if (groupId) afkStorage.delete(makeKey(jid, groupId))
    afkStorage.delete(makeKey(jid, null))
}

function isUserAfk(jid, groupId = null) {
    return !!getAfkUser(jid, groupId)
}

function addMentionLog(jid, groupId, senderJid, senderName) {
    const data = getAfkUser(jid, groupId)
    if (!data) return
    data.mentionLog.push({ sender: senderJid, name: senderName, time: Date.now() })
    // Max 10 log
    if (data.mentionLog.length > 10) data.mentionLog.shift()
}

function getAfkListInGroup(groupId) {
    const result = []
    for (const [key, data] of afkStorage.entries()) {
        if (data.groupId === groupId || data.groupId === null) {
            // Cek apakah expired
            if (data.expiresAt && Date.now() > data.expiresAt) {
                afkStorage.delete(key)
                continue
            }
            result.push(data)
        }
    }
    return result
}

// ── Time helpers ───────────────────────────────────────────────────────────

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    const weeks = Math.floor(days / 7)
    const months = Math.floor(days / 30)

    if (months > 0) return `${months} bulan ${days % 30} hari`
    if (weeks > 0) return `${weeks} minggu ${days % 7} hari`
    if (days > 0) return `${days} hari ${hours % 24} jam`
    if (hours > 0) return `${hours} jam ${minutes % 60} menit`
    if (minutes > 0) return `${minutes} menit ${seconds % 60} detik`
    return `${seconds} detik`
}

/**
 * Parse durasi dari string seperti --30menit, --2jam, --1hari, dll
 * Return: { ms: number|null, text: string (sisa teks), isYear: boolean }
 */
function parseDuration(text) {
    const durationRe = /^--(\d+)(ms|milidetik|detik|menit|jam|hari|minggu|bulan|tahun)\s*/i
    const match = text.trim().match(durationRe)
    if (!match) return { ms: null, text: text.trim(), isYear: false }

    const amount = parseInt(match[1])
    const unit = match[2].toLowerCase()
    const rest = text.trim().slice(match[0].length).trim()

    if (unit === 'tahun') return { ms: null, text: rest, isYear: true }

    const multipliers = {
        ms: 1, milidetik: 1,
        detik: 1000,
        menit: 60 * 1000,
        jam: 60 * 60 * 1000,
        hari: 24 * 60 * 60 * 1000,
        minggu: 7 * 24 * 60 * 60 * 1000,
        bulan: 30 * 24 * 60 * 60 * 1000
    }

    return { ms: amount * (multipliers[unit] || 1), text: rest, isYear: false }
}

// ── Handler ────────────────────────────────────────────────────────────────

async function handler(m, { sock }) {
    const rawText = m.text || ''
    const groupId = m.isGroup ? m.chat : null

    // ── .afkformat ────────────────────────────────────────────────────────
    if (m.command === 'afkformat' || m.command === 'afkhelp') {
        return m.reply(
            `💤 *Panduan Fitur AFK~* ✨\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴏᴍᴍᴀɴᴅ* 」\n` +
            `┃ *Set AFK:*\n` +
            `┃ \`${m.prefix}afk <alasan>\`\n` +
            `┃ \`${m.prefix}afk --<durasi> <alasan>\`\n` +
            `┃\n` +
            `┃ *Lihat daftar AFK:*\n` +
            `┃ \`${m.prefix}afklist\` (admin only)\n` +
            `┃\n` +
            `┃ *Hapus AFK user:*\n` +
            `┃ \`${m.prefix}afkremove @user\` (owner only)\n` +
            `┃\n` +
            `┃ *Panduan ini:*\n` +
            `┃ \`${m.prefix}afkformat\`\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `╭┈┈⬡「 ⏱️ *ꜰᴏʀᴍᴀᴛ ᴅᴜʀᴀsɪ* 」\n` +
            `┃ \`--Xms\` atau \`--Xmilidetik\`\n` +
            `┃ \`--Xdetik\`\n` +
            `┃ \`--Xmenit\`\n` +
            `┃ \`--Xjam\`\n` +
            `┃ \`--Xhari\`\n` +
            `┃ \`--Xminggu\`\n` +
            `┃ \`--Xbulan\`\n` +
            `┃ ~\`--Xtahun\`~ (diluar nalar 😂)\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `╭┈┈⬡「 📝 *ᴄᴏɴᴛᴏʜ* 」\n` +
            `┃ \`${m.prefix}afk lagi makan\`\n` +
            `┃ \`${m.prefix}afk --30menit istirahat\`\n` +
            `┃ \`${m.prefix}afk --2jam meeting\`\n` +
            `┃ \`${m.prefix}afk --1hari liburan\`\n` +
            `┃ \`${m.prefix}afk --1minggu\`\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `╭┈┈⬡「 ℹ️ *ɪɴꜰᴏ* 」\n` +
            `┃ AFK di grup = berlaku di grup itu aja\n` +
            `┃ AFK di PM = berlaku global\n` +
            `┃ Kirim pesan apapun = AFK otomatis off\n` +
            `┃ Bot kasih tau siapa yang nyebut kamu\n` +
            `┃ selama kamu AFK~ (max 10 log)\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `_"Nee~ jangan lupa balik ya~"_ 💕🌸`
        )
    }

    
    if (m.command === 'afklist') {
        if (!m.isGroup) return m.reply(`Nee~ command ini cuma bisa dipakai di grup aja ya~ 👥✨`)
        if (!m.isAdmin && !m.isOwner) return m.reply(`Muu~ ini khusus admin grup aja nee~ 👮‍♀️🌸`)

        const list = getAfkListInGroup(groupId)
        if (list.length === 0) return m.reply(`Yeay~ nggak ada yang AFK di sini~ Semua aktif! ⭐💕`)

        let msg = `💤 *Daftar AFK di grup ini~* ✨\n\n`
        list.forEach((data, i) => {
            const expired = data.expiresAt ? ` (berakhir dalam ${formatDuration(data.expiresAt - Date.now())})` : ''
            msg += `${i + 1}. @${data.jid.split('@')[0]}\n`
            msg += `   > Alasan: *${data.reason}*\n`
            msg += `   > Sejak: *${formatDuration(Date.now() - data.time)} yang lalu*${expired}\n`
            msg += `   > Scope: *${data.groupId ? 'Grup ini' : 'Global'}*\n\n`
        })

        return m.reply(msg, { mentions: list.map(d => d.jid) })
    }

    // ── .afkremove @user ──────────────────────────────────────────────────
    if (m.command === 'afkremove') {
        if (!m.isOwner) return m.reply(`Muu~ ini khusus buat owner aja lho~ 🌸`)

        const targets = m.mentionedJid || []
        if (targets.length === 0) return m.reply(`Nee~ tag dulu usernya~ Contoh: \`${m.prefix}afkremove @user\` ✨`)

        const removed = []
        for (const jid of targets) {
            if (isUserAfk(jid, groupId)) {
                removeAfkUser(jid, groupId)
                removed.push(jid)
            }
        }

        if (removed.length === 0) return m.reply(`Eeh~ user yang ditag nggak ada yang lagi AFK nih~ 💕`)

        return m.reply(
            `✅ Berhasil hapus status AFK~ ⭐\n\n` +
            removed.map(j => `> @${j.split('@')[0]}`).join('\n'),
            { mentions: removed }
        )
    }

    // ── Set AFK ───────────────────────────────────────────────────────────
    const { ms, text: reason, isYear } = parseDuration(rawText)

    if (isYear) {
        return m.reply(
            `Hehe~ yang bener aja afk 1 tahun~ Diluar nalar loh yah! 😂✨\n` +
            `Nggak ada yang setahun AFK kali~ Coba pakai durasi yang wajar ya~ 💕`
        )
    }

    const expiresAt = ms ? Date.now() + ms : null
    const finalReason = reason || 'Tidak ada alasan'

    setAfkUser(m.sender, finalReason, groupId, expiresAt)

    let replyMsg =
        `💤 *AFK aktif~* ✨\n\n` +
        `> @${m.sender.split('@')[0]} sekarang lagi AFK nih~\n` +
        `> Alasan: *${finalReason}*\n` +
        `> Scope: *${groupId ? 'Grup ini aja' : 'Global'}*`

    if (expiresAt) {
        replyMsg += `\n> Durasi: *${formatDuration(ms)}*\n> Berakhir otomatis dalam *${formatDuration(ms)}*`
    }

    replyMsg += `\n\n_Kirim pesan apapun untuk menonaktifkan AFK~_ 🌸`

    await m.reply(replyMsg, { mentions: [m.sender] })
}

// ── checkAfk (dipanggil dari handler.js) ──────────────────────────────────

async function checkAfk(m, sock) {
    const groupId = m.isGroup ? m.chat : null

    // Cek apakah sender sendiri lagi AFK
    const afkData = getAfkUser(m.sender, groupId)
    if (afkData) {
        // Skip kalau command afk/afklist/afkremove
        const skipCmds = ['afk', 'afklist', 'afkremove']
        if (m.isCommand && skipCmds.includes(m.command?.toLowerCase())) return

        // Cek expired
        if (afkData.expiresAt && Date.now() > afkData.expiresAt) {
            removeAfkUser(m.sender, groupId)
            return
        }

        removeAfkUser(m.sender, groupId)
        const duration = formatDuration(Date.now() - afkData.time)

        let backMsg =
            `👋 *Selamat datang kembali~* ⭐\n\n` +
            `> @${m.sender.split('@')[0]} udah balik nih!\n` +
            `> Durasi AFK: *${duration}*`

        // Mention log
        if (afkData.mentionLog && afkData.mentionLog.length > 0) {
            backMsg += `\n\n💬 *Yang nyebut-nyebut kamu selama AFK:*\n`
            afkData.mentionLog.forEach(log => {
                backMsg += `> • ${log.name} — ${formatDuration(Date.now() - log.time)} yang lalu\n`
            })
        }

        await m.reply(backMsg, { mentions: [m.sender] })
    }

    // Cek apakah ada yang di-mention dan sedang AFK
    if (m.mentionedJid && m.mentionedJid.length > 0) {
        const afkMentioned = []

        for (const mentioned of m.mentionedJid) {
            const mentionedAfk = getAfkUser(mentioned, groupId)
            if (!mentionedAfk) continue

            // Cek expired
            if (mentionedAfk.expiresAt && Date.now() > mentionedAfk.expiresAt) {
                removeAfkUser(mentioned, groupId)
                continue
            }

            // Catat ke mention log
            const senderName = m.pushName || m.sender.split('@')[0]
            addMentionLog(mentioned, groupId, m.sender, senderName)

            afkMentioned.push({ jid: mentioned, data: mentionedAfk })
        }

        if (afkMentioned.length === 0) return

        // Gabung semua jadi 1 pesan
        let msg = `💤 *Psst~ yang kamu tag lagi AFK nih~* 🌸\n\n`

        afkMentioned.forEach((entry, i) => {
            const duration = formatDuration(Date.now() - entry.data.time)
            const expiredInfo = entry.data.expiresAt
                ? ` (balik dalam ~${formatDuration(entry.data.expiresAt - Date.now())})`
                : ''

            msg += `${i + 1}. @${entry.jid.split('@')[0]}\n`
            msg += `   > Alasan: *${entry.data.reason}*\n`
            msg += `   > Sejak: *${duration} yang lalu*${expiredInfo}\n\n`
        })

        msg += `_Jangan diganggu dulu ya~_ 💕`

        await m.reply(msg, { mentions: afkMentioned.map(e => e.jid) })
    }
}

module.exports = {
    config: pluginConfig,
    handler,
    checkAfk,
    getAfkUser,
    setAfkUser,
    removeAfkUser,
    isUserAfk
}