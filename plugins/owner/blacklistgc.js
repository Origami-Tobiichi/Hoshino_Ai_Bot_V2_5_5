const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'blacklistgc',
    alias: ['blgc', 'unblacklistgc', 'unblgc', 'listblacklistgc', 'listblgc'],
    category: 'owner',
    description: 'Blacklist grup tertentu dari menggunakan bot',
    usage: '.blacklistgc <id/@link> | .unblacklistgc <id> | .listblgc',
    example: '.blacklistgc 1203xxxxxx@g.us',
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

function resolveGcJid(input, db) {
    if (!input) return null

    // Kalau sudah format JID grup
    if (input.endsWith('@g.us')) return input

    // Kalau angka → coba jadi JID
    if (/^\d+$/.test(input)) return input + '@g.us'

    // Cari dari index (nomor urut di listblgc)
    if (/^\d+$/.test(input)) {
        const groups = db.data.groups || {}
        const banned = Object.entries(groups)
            .filter(([, g]) => g.isBanned)
            .map(([jid]) => jid)
        const idx = parseInt(input) - 1
        return banned[idx] || null
    }

    return null
}

async function handler(m, { sock }) {
    const db  = getDatabase()
    const cmd = m.command.toLowerCase()

    const isAdd    = ['blacklistgc', 'blgc'].includes(cmd)
    const isDel    = ['unblacklistgc', 'unblgc'].includes(cmd)
    const isList   = ['listblacklistgc', 'listblgc'].includes(cmd)

    const groups = db.data.groups || {}

    // ── LIST ──────────────────────────────────────────────────────────────────
    if (isList) {
        const banned = Object.entries(groups)
            .filter(([, g]) => g.isBanned)

        if (banned.length === 0) {
            return m.reply(
                `🚫 *ʟɪsᴛ ʙʟᴀᴄᴋʟɪsᴛ ɢʀᴜᴘ*\n\n` +
                `> Belum ada grup yang di-blacklist~\n\n` +
                `> Gunakan \`${m.prefix}blacklistgc <id>\` untuk menambahkan`
            )
        }

        let txt = `🚫 *ʟɪsᴛ ʙʟᴀᴄᴋʟɪsᴛ ɢʀᴜᴘ*\n\n`
        txt += `╭┈┈⬡「 ⛔ *ɢʀᴜᴘ* 」\n`
        banned.forEach(([jid, g], i) => {
            const name = g.name || 'Unknown Group'
            const since = g.blacklistedAt
                ? new Date(g.blacklistedAt).toLocaleDateString('id-ID')
                : '-'
            txt += `┃ ${i + 1}. *${name}*\n`
            txt += `┃    \`${jid}\`\n`
            txt += `┃    📅 Sejak: ${since}\n`
        })
        txt += `╰┈┈⬡\n\n`
        txt += `> ᴛᴏᴛᴀʟ: \`${banned.length}\` grup di-blacklist`

        return m.reply(txt)
    }

    // ── RESOLVE TARGET GC ─────────────────────────────────────────────────────
    const rawInput = m.args?.[0] || ''

    // Kalau command dijalankan dari dalam grup dan tanpa argumen → pakai grup aktif
    let targetJid = null
    if (!rawInput && m.isGroup) {
        targetJid = m.chat
    } else {
        targetJid = resolveGcJid(rawInput, db)
    }

    if (!targetJid) {
        return m.reply(
            `🚫 *ʙʟᴀᴄᴋʟɪsᴛ ɢʀᴜᴘ*\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
            `┃ ◦ \`${m.prefix}blacklistgc <id>\` — Blacklist grup\n` +
            `┃ ◦ \`${m.prefix}blacklistgc\` (di grup) — Blacklist grup ini\n` +
            `┃ ◦ \`${m.prefix}unblacklistgc <id>\` — Hapus blacklist\n` +
            `┃ ◦ \`${m.prefix}listblgc\` — Lihat daftar\n` +
            `╰┈┈⬡\n\n` +
            `> _Format ID: \`120363xxxxxx@g.us\`_\n` +
            `> _Atau jalankan di dalam grup target tanpa argumen~_ 🌸`
        )
    }

    const groupData = db.getGroup(targetJid) || {}
    const groupName = groupData.name || targetJid

    // ── BLACKLIST (BAN) ───────────────────────────────────────────────────────
    if (isAdd) {
        if (groupData.isBanned) {
            return m.reply(AI.warn(`Grup *${groupName}* sudah di-blacklist nih~\n\n> Gunakan \`${m.prefix}unblacklistgc\` untuk menghapus`))
        }

        db.setGroup(targetJid, {
            ...groupData,
            isBanned: true,
            blacklistedAt: Date.now()
        })

        m.react('🚫')
        return m.reply(
            `🚫 *ɢʀᴜᴘ ᴅɪʙʟᴀᴄᴋʟɪsᴛ* 🌸\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 📛 ɴᴀᴍᴀ: *${groupName}*\n` +
            `┃ 🆔 ɪᴅ: \`${targetJid}\`\n` +
            `┃ 🚫 sᴛᴀᴛᴜs: *Blacklisted*\n` +
            `╰┈┈⬡\n\n` +
            `> _Grup ini tidak bisa pakai bot lagi~ 💖_\n` +
            `> _Gunakan \`${m.prefix}unblacklistgc\` untuk membuka_`
        )
    }

    // ── UNBLACKLIST ───────────────────────────────────────────────────────────
    if (isDel) {
        if (!groupData.isBanned) {
            return m.reply(AI.warn(`Grup *${groupName}* tidak ada di blacklist nih~`))
        }

        db.setGroup(targetJid, {
            ...groupData,
            isBanned: false,
            blacklistedAt: null
        })

        m.react('✅')
        return m.reply(
            `✅ *ʙʟᴀᴄᴋʟɪsᴛ ᴅɪʜᴀᴘᴜs* 🌸\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 📛 ɴᴀᴍᴀ: *${groupName}*\n` +
            `┃ 🆔 ɪᴅ: \`${targetJid}\`\n` +
            `┃ 🟢 sᴛᴀᴛᴜs: *Normal*\n` +
            `╰┈┈⬡\n\n` +
            `> _Grup ini bisa pakai bot lagi~ 💕_`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}