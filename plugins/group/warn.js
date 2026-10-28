const { getDatabase } = require('../../src/lib/database')
const { getParticipantJid } = require('../../src/lib/lidHelper')

const pluginConfig = {
    name: 'warn',
    alias: ['warning', 'peringatan'],
    category: 'group',
    description: 'Memberi peringatan kepada member',
    usage: '.warn @user <alasan>',
    example: '.warn @user spam',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    isAdmin: true,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

const HISTORY_TTL_MS = 90 * 24 * 60 * 60 * 1000 // 90 hari, ubah kalau mau beda

// ---------- Helpers: durasi ----------
function parseDuration(str) {
    if (!str) return null
    const regex = /(\d+)\s*(y|mo|w|d|h|m|s)/gi
    const unitMs = { y: 31536000000, mo: 2592000000, w: 604800000, d: 86400000, h: 3600000, m: 60000, s: 1000 }
    let total = 0
    let matched = false
    let match
    while ((match = regex.exec(str)) !== null) {
        matched = true
        total += parseInt(match[1]) * unitMs[match[2].toLowerCase()]
    }
    return matched ? total : null
}

function formatDuration(ms) {
    const units = [['tahun', 31536000000], ['bulan', 2592000000], ['minggu', 604800000], ['hari', 86400000], ['jam', 3600000], ['menit', 60000], ['detik', 1000]]
    for (const [label, unitMs] of units) {
        if (ms >= unitMs) return `${Math.round(ms / unitMs)} ${label}`
    }
    return `${ms} ms`
}

// ---------- Helpers: warning aktif (lazy expiry, restart-proof) ----------
function getActiveWarnings(list) {
    if (!list) return []
    const now = Date.now()
    return list.filter(w => !w.expireAt || w.expireAt > now)
}

function cleanExpiredUserWarnings(groupData, targetUser) {
    const warnings = groupData.warnings || {}
    const list = warnings[targetUser]
    if (!list) return false
    const active = getActiveWarnings(list)
    if (active.length === list.length) return false
    if (active.length === 0) delete warnings[targetUser]
    else warnings[targetUser] = active
    groupData.warnings = warnings
    return true
}

// ---------- Helpers: arsip histori (auto-hapus setelah TTL) ----------
function cleanExpiredHistory(groupData) {
    const history = groupData.warnHistory || {}
    let changed = false
    const now = Date.now()
    for (const jid of Object.keys(history)) {
        const filtered = history[jid].filter(entry => !entry.expireAt || entry.expireAt > now)
        if (filtered.length !== history[jid].length) changed = true
        if (filtered.length === 0) delete history[jid]
        else history[jid] = filtered
    }
    groupData.warnHistory = history
    return changed
}

function archiveWarnings(groupData, targetUser, action, warningsList) {
    const history = groupData.warnHistory || {}
    const userHistory = history[targetUser] || []
    userHistory.push({
        action,
        warnings: warningsList,
        time: Date.now(),
        expireAt: Date.now() + HISTORY_TTL_MS
    })
    history[targetUser] = userHistory
    groupData.warnHistory = history
}

function isUserIgnored(chat, targetUser) {
    const db = getDatabase()
    const group = db.getGroup(chat) || {}
    const ignored = group.ignoredUsers || {}
    return !!ignored[targetUser]
}

async function handler(m, { sock }) {
    const db = getDatabase()

    let groupData = db.getGroup(m.chat) || {}
    let warnings = groupData.warnings || {}
    const maxWarns = groupData.maxWarnings || 3
    const warnAction = groupData.warnAction || 'kick'

    if (cleanExpiredHistory(groupData)) {
        db.setGroup(m.chat, groupData)
    }

    const args = m.args

    // ---------- Help ----------
    if (!args[0] && !m.quoted && (!m.mentionedJid || m.mentionedJid.length === 0)) {
        return m.reply(
            `⚠️ *SISTEM WARNING GRUP*\n\n` +
            `Sistem manajemen pelanggaran untuk member grup.\n` +
            `Batas Warning: *${maxWarns} kali* (Aksi: *${warnAction === 'ignore' ? 'Diabaikan' : 'Kick Otomatis'}*)\n\n` +
            `*PENGGUNAAN:*\n` +
            `• *${m.prefix}warn @user <alasan>* — Memberi warning\n` +
            `• *${m.prefix}warn max <angka>* — Mengubah batas maksimal warning\n` +
            `• *${m.prefix}warn action <kick/ignore>* — Mengubah aksi saat batas tercapai\n` +
            `• *${m.prefix}warn unignore @user* — Mencabut status diabaikan dari member\n` +
            `• *${m.prefix}warn stats* — Lihat member dengan warning terbanyak\n` +
            `• *${m.prefix}warn auto* — Atur auto-reduce warning (timed decay)\n` +
            `• *${m.prefix}listwarn* — Melihat daftar member bermasalah\n` +
            `• *${m.prefix}resetwarn @user* — Menghapus semua warning member\n\n` +
            `*PENJELASAN ALUR PENGGUNAAN:*\n` +
            `1. Saat member melakukan pelanggaran pertama, beri mereka SP1: *${m.prefix}warn @user Spam pesan*\n` +
            `2. Bot akan mencatat "Spam pesan" sebagai warning ke-1 mereka.\n` +
            `3. Jika melanggar lagi, beri peringatan kedua dengan alasan baru: *${m.prefix}warn @user Berkata kasar*\n` +
            `4. Jika total peringatan member mencapai batas maksimal (saat ini *${maxWarns}*), bot akan otomatis ${warnAction === 'ignore' ? 'MENGABAIKAN' : 'MENGELUARKAN (Kick)'} member tersebut.\n` +
            `5. Riwayat pelanggaran bisa dilihat lengkap dengan mengetik *${m.prefix}listwarn @user*.`
        )
    }

    // ---------- .warn max <n> ----------
    if (args[0]?.toLowerCase() === 'max') {
        const newMax = parseInt(args[1])
        if (isNaN(newMax) || newMax < 1 || newMax > 20) {
            return m.reply(`❌ *GAGAL*\n\nBatas referensi warning harus berupa angka 1-20.\nContoh: *${m.prefix}warn max 5*`)
        }
        groupData.maxWarnings = newMax
        db.setGroup(m.chat, groupData)
        return m.reply(`✅ *BATAS WARNING DIUBAH*\n\nMaksimal warning grup ini telah diupdate menjadi *${newMax} kali*.`)
    }

    // ---------- .warn action <kick/ignore> ----------
    if (args[0]?.toLowerCase() === 'action') {
        const newAction = args[1]?.toLowerCase()
        if (newAction !== 'kick' && newAction !== 'ignore') {
            return m.reply(`❌ *GAGAL*\n\nAksi harus salah satu dari: *kick* atau *ignore*.\nContoh: *${m.prefix}warn action ignore*`)
        }
        groupData.warnAction = newAction
        db.setGroup(m.chat, groupData)
        return m.reply(`✅ *AKSI WARNING DIUBAH*\n\nSaat member mencapai batas max, bot sekarang akan: *${newAction === 'ignore' ? 'mengabaikan (ignore) member' : 'mengeluarkan (kick) member'}*.`)
    }

    // ---------- .warn stats ----------
    if (args[0]?.toLowerCase() === 'stats') {
        const entries = Object.keys(warnings)
            .map(jid => [jid, getActiveWarnings(warnings[jid])])
            .filter(([, active]) => active.length > 0)

        if (entries.length === 0) {
            return m.reply(`📊 *WARN STATS*\n\nBelum ada member dengan warning aktif di grup ini.`)
        }
        const sorted = entries.sort((a, b) => b[1].length - a[1].length).slice(0, 10)
        let text = `📊 *WARN STATS* (Top ${sorted.length})\n\n`
        sorted.forEach(([jid, list], i) => {
            text += `${i + 1}. @${jid.split('@')[0]} — *${list.length}/${maxWarns}*\n`
        })
        return m.reply(text, { mentions: sorted.map(([jid]) => jid) })
    }

    // ---------- .warn unignore @user ----------
    if (args[0]?.toLowerCase() === 'unignore') {
        let targetUser = m.quoted ? m.quoted.sender : (m.mentionedJid?.[0] || null)
        if (!targetUser) {
            return m.reply(`⚠️ *CARA PAKAI*\n\nReply pesan user atau mention: *${m.prefix}warn unignore @user*`)
        }
        const ignored = groupData.ignoredUsers || {}
        if (!ignored[targetUser]) {
            return m.reply(`ℹ️ Member ini tidak sedang dalam status diabaikan.`)
        }
        delete ignored[targetUser]
        groupData.ignoredUsers = ignored
        db.setGroup(m.chat, groupData)
        return m.reply(`✅ *Yatta~* Status diabaikan untuk @${targetUser.split('@')[0]} telah dicabut~ ✨`, { mentions: [targetUser] })
    }

    // ---------- .warn auto [on/off/set] <durasi> ----------
    if (args[0]?.toLowerCase() === 'auto') {
        const sub = args[1]?.toLowerCase()
        const autoReduce = groupData.autoReduce || { enabled: false, duration: 0 }

        if (!sub) {
            return m.reply(
                `⏱️ *AUTO-REDUCE WARNING*\n\n` +
                `Status: *${autoReduce.enabled ? 'Aktif' : 'Mati'}*\n` +
                `Durasi: *${autoReduce.duration ? formatDuration(autoReduce.duration) : '-'}*\n\n` +
                `*${m.prefix}warn auto on <durasi>* — Nyalakan\n` +
                `*${m.prefix}warn auto off* — Matikan\n` +
                `*${m.prefix}warn auto set <durasi>* — Ubah durasi\n` +
                `Contoh durasi: 1m, 1h30m, 2d, 1w, 1mo, 1y`
            )
        }

        if (sub === 'off') {
            groupData.autoReduce = { ...autoReduce, enabled: false }
            db.setGroup(m.chat, groupData)
            return m.reply(`✅ *Yatta~* Auto-reduce warning dimatikan~ ✨`)
        }

        if (sub === 'on' || sub === 'set') {
            const durStr = args.slice(2).join('')
            const ms = parseDuration(durStr)
            if (sub === 'on' && !durStr) {
                if (!autoReduce.duration) return m.reply(`❌ *Ehh~* Belum ada durasi tersimpan, wajib isi durasi: *${m.prefix}warn auto on 1h*~ 🥺`)
                groupData.autoReduce = { ...autoReduce, enabled: true }
                db.setGroup(m.chat, groupData)
                return m.reply(`✅ *Yatta~* Auto-reduce warning diaktifkan (durasi: ${formatDuration(autoReduce.duration)})~ ✨`)
            }
            if (ms === null) return m.reply(`❌ *Ehh~* Format durasi salah. Contoh: *${m.prefix}warn auto ${sub} 1h30m*~ 🥺`)
            groupData.autoReduce = { enabled: true, duration: ms }
            db.setGroup(m.chat, groupData)
            return m.reply(`✅ Auto-reduce warning ${sub === 'set' ? 'durasi diubah' : 'diaktifkan'}: setiap warning akan otomatis hilang setelah *${formatDuration(ms)}*.`)
        }

        return m.reply(`❌ *Ehh~* Sub-command tidak dikenali. Gunakan: on, off, set~ 🥺`)
    }

    // ---------- Beri warning ----------
    let targetUser = null
    if (m.quoted) {
        targetUser = m.quoted.sender
    } else if (m.mentionedJid && m.mentionedJid.length > 0) {
        targetUser = m.mentionedJid[0]
    }

    if (!targetUser) {
        await m.reply(
            `⚠️ *CARA PAKAI*\n\n` +
            `> Reply pesan user + \`${m.prefix}warn alasan\`\n` +
            `> Atau: \`${m.prefix}warn @user alasan\``
        )
        return
    }
    try {
        const groupMeta = m.groupMetadata
        const participant = groupMeta.participants.find(p => getParticipantJid(p) === targetUser)
        if (participant?.admin) {
            await m.reply(`❌ *Gomen ne~* Tidak bisa memberikan warning kepada admin grup~ 🥺`)
            return
        }
    } catch (e) {}

    const botJid = sock.user?.id?.split(':')[0] + '@s.whatsapp.net'
    if (targetUser === botJid) {
        await m.reply(`❌ *Ehh~* Gak usah warn aku, aku cuma bot~ 🥺`)
        return
    }

    const reasonArg = m.quoted ? m.text?.trim() : m.text?.replace(/@\d+/g, '').replace(/^\s*warn\s*/i, '').trim()
    const reason = reasonArg || 'Tidak ada alasan'
    const evidence = m.quoted?.text ? m.quoted.text.trim().slice(0, 300) : null

    cleanExpiredUserWarnings(groupData, targetUser)
    warnings = groupData.warnings || {}

    let userWarnings = warnings[targetUser] || []
    const autoReduce = groupData.autoReduce || { enabled: false, duration: 0 }
    const newWarning = {
        reason: reason,
        by: m.sender,
        time: Date.now()
    }
    if (evidence) newWarning.evidence = evidence
    if (autoReduce.enabled && autoReduce.duration > 0) {
        newWarning.expireAt = Date.now() + autoReduce.duration
    }
    userWarnings.push(newWarning)

    warnings[targetUser] = userWarnings
    groupData.warnings = warnings
    db.setGroup(m.chat, groupData)

    const warnCount = userWarnings.length
    const targetName = targetUser.split('@')[0]

    if (warnCount >= maxWarns) {
        // Re-fetch fresh data sebelum write final, biar gak ketimpa perubahan lain di antara call
        let fresh = db.getGroup(m.chat) || {}
        const freshWarnings = fresh.warnings || {}

        if (warnAction === 'ignore') {
            const ignored = fresh.ignoredUsers || {}
            ignored[targetUser] = { reason, by: m.sender, time: Date.now() }
            fresh.ignoredUsers = ignored
            archiveWarnings(fresh, targetUser, 'ignore', freshWarnings[targetUser] || userWarnings)
            delete freshWarnings[targetUser]
            fresh.warnings = freshWarnings
            db.setGroup(m.chat, fresh)

            await m.reply(
                `🔇 *MAX WARNING TERCAPAI*\n\n` +
                `@${targetName} akan diabaikan bot di grup ini (semua command tidak akan direspon) sampai admin mencabutnya dengan *${m.prefix}warn unignore @${targetName}*.\n\n` +
                `*Rincian:*\n` +
                `> Warning: *${warnCount}/${maxWarns}*\n` +
                `> Alasan Terakhir: *${reason}*`,
                { mentions: [targetUser] }
            )
        } else {
            try {
                await sock.groupParticipantsUpdate(m.chat, [targetUser], 'remove')
                archiveWarnings(fresh, targetUser, 'kick', freshWarnings[targetUser] || userWarnings)
                delete freshWarnings[targetUser]
                fresh.warnings = freshWarnings
                db.setGroup(m.chat, fresh)

                await m.reply(
                    `🚨 *MAX WARNING TERCAPAI*\n\n` +
                    `@${targetName} telah dikeluarkan dari grup karena mencapai batas pelanggaran!\n\n` +
                    `*Rincian:*\n` +
                    `> Warning: *${warnCount}/${maxWarns}*\n` +
                    `> Alasan Terakhir: *${reason}*`,
                    { mentions: [targetUser] }
                )
            } catch (e) {
                await m.reply(`❌ *Gomen ne~* Gagal kick user: ${e.message} 🥺`)
            }
        }
    } else {
        await m.reply(
            `⚠️ *PERINGATAN DIBERIKAN*\n\n` +
            `@${targetName} telah menerima Surat Peringatan (SP${warnCount})!\n\n` +
            `*Rincian:*\n` +
            `> Warning ke: *${warnCount}/${maxWarns}*\n` +
            `> Alasan: *${reason}*\n\n` +
            `_${maxWarns - warnCount} warning lagi = ${warnAction === 'ignore' ? 'DIABAIKAN' : 'KICK'} OTOMATIS_`,
            { mentions: [targetUser] }
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler,
    getActiveWarnings, 
    isUserIgnored
}