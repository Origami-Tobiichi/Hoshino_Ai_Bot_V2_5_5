const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'whitelistgc',
    alias: ['wlgc', 'unwhitelistgc', 'unwlgc', 'listwhitelistgc', 'listwlgc', 'whitelistmode'],
    category: 'owner',
    description: 'Mode whitelist — bot hanya aktif di grup yang didaftarkan',
    usage: '.whitelistgc <id> | .unwhitelistgc <id> | .listwlgc | .whitelistmode on/off',
    example: '.whitelistgc 1203xxxxxx@g.us',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

const AI = {
    warn: (msg) => `🌸 *Hmm~ Perhatiin dulu ya!*\n\n> ${msg}`,
}

// ── Export untuk dipakai handler.js ───────────────────────────────────────────
function isWhitelistModeActive(db) {
    return db.setting('whitelistGcMode') === true
}

function getWhitelistedGroups(db) {
    return db.setting('whitelistedGroups') || []
}

function isGroupWhitelisted(jid, db) {
    return getWhitelistedGroups(db).includes(jid)
}

module.exports.isWhitelistModeActive = isWhitelistModeActive
module.exports.getWhitelistedGroups  = getWhitelistedGroups
module.exports.isGroupWhitelisted    = isGroupWhitelisted

function resolveGcJid(input) {
    if (!input) return null
    if (input.endsWith('@g.us')) return input
    if (/^\d+$/.test(input)) return input + '@g.us'
    return null
}

async function handler(m, { sock }) {
    const db  = getDatabase()
    const cmd = m.command.toLowerCase()

    const isAdd    = ['whitelistgc', 'wlgc'].includes(cmd)
    const isDel    = ['unwhitelistgc', 'unwlgc'].includes(cmd)
    const isList   = ['listwhitelistgc', 'listwlgc'].includes(cmd)
    const isToggle = cmd === 'whitelistmode'

    // ── TOGGLE MODE ──────────────────────────────────────────────────────────
    if (isToggle) {
        const sub = m.args?.[0]?.toLowerCase()
        const active = isWhitelistModeActive(db)

        if (!sub || !['on', 'off'].includes(sub)) {
            const list = getWhitelistedGroups(db)
            return m.reply(
                `🛡️ *ᴡʜɪᴛᴇʟɪsᴛ ᴍᴏᴅᴇ*\n\n` +
                `╭┈┈⬡「 📋 *sᴛᴀᴛᴜs* 」\n` +
                `┃ 🛡️ ᴍᴏᴅᴇ: *${active ? '🟢 AKTIF' : '🔴 NONAKTIF'}*\n` +
                `┃ 📋 ᴛᴇʀᴅᴀꜰᴛᴀʀ: *${list.length}* grup\n` +
                `╰┈┈⬡\n\n` +
                `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
                `┃ ◦ \`${m.prefix}whitelistmode on\` — Aktifkan\n` +
                `┃ ◦ \`${m.prefix}whitelistmode off\` — Nonaktifkan\n` +
                `┃ ◦ \`${m.prefix}whitelistgc <id>\` — Tambah grup\n` +
                `┃ ◦ \`${m.prefix}listwlgc\` — Lihat daftar\n` +
                `╰┈┈⬡\n\n` +
                `> _Saat aktif, hanya grup terdaftar yang bisa pakai bot~\n` +
                `> Chat pribadi (PM) tetap bebas, tidak terpengaruh 🌸_`
            )
        }

        if (sub === 'on') {
            if (active) return m.reply(AI.warn('Mode whitelist sudah aktif nih~'))

            const list = getWhitelistedGroups(db)
            if (list.length === 0) {
                return m.reply(
                    `❌ *ɢᴀɢᴀʟ*\n\n` +
                    `> Belum ada grup yang di-whitelist~\n` +
                    `> Tambah dulu pakai \`${m.prefix}whitelistgc <id>\` ya! 🌸`
                )
            }

            db.setting('whitelistGcMode', true)
            m.react('🛡️')
            return m.reply(
                `🛡️ *ᴡʜɪᴛᴇʟɪsᴛ ᴍᴏᴅᴇ ᴅɪᴀᴋᴛɪꜰᴋᴀɴ* 🌸\n\n` +
                `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
                `┃ 🛡️ sᴛᴀᴛᴜs: *🟢 AKTIF*\n` +
                `┃ 📋 ɢʀᴜᴘ ᴛᴇʀᴅᴀꜰᴛᴀʀ: *${list.length}*\n` +
                `╰┈┈⬡\n\n` +
                `> _Sekarang bot hanya bisa dipakai di grup yang terdaftar~ 💖_\n` +
                `> _PM tetap bebas seperti biasa~_`
            )
        }

        if (sub === 'off') {
            if (!active) return m.reply(AI.warn('Mode whitelist sudah tidak aktif nih~'))

            db.setting('whitelistGcMode', false)
            m.react('✅')
            return m.reply(
                `✅ *ᴡʜɪᴛᴇʟɪsᴛ ᴍᴏᴅᴇ ᴅɪɴᴏɴᴀᴋᴛɪꜰᴋᴀɴ* 🌸\n\n` +
                `> Bot bisa dipakai di semua grup lagi~ 💕`
            )
        }
    }

    // ── LIST ──────────────────────────────────────────────────────────────────
    if (isList) {
        const list = getWhitelistedGroups(db)
        const active = isWhitelistModeActive(db)

        if (list.length === 0) {
            return m.reply(
                `🛡️ *ʟɪsᴛ ᴡʜɪᴛᴇʟɪsᴛ ɢʀᴜᴘ*\n\n` +
                `> Belum ada grup yang di-whitelist~\n\n` +
                `> Gunakan \`${m.prefix}whitelistgc <id>\` untuk menambahkan`
            )
        }

        let txt = `🛡️ *ʟɪsᴛ ᴡʜɪᴛᴇʟɪsᴛ ɢʀᴜᴘ*\n\n`
        txt += `╭┈┈⬡「 ✅ *ɢʀᴜᴘ* 」\n`
        for (const [i, jid] of list.entries()) {
            const meta = await sock.groupMetadata(jid).catch(() => null)
            const name = meta?.subject || 'Unknown Group'
            txt += `┃ ${i + 1}. *${name}*\n`
            txt += `┃    \`${jid}\`\n`
        }
        txt += `╰┈┈⬡\n\n`
        txt += `> ᴍᴏᴅᴇ: *${active ? '🟢 AKTIF' : '🔴 NONAKTIF'}*\n`
        txt += `> ᴛᴏᴛᴀʟ: \`${list.length}\` grup terdaftar`

        return m.reply(txt)
    }

    // ── RESOLVE TARGET GC ─────────────────────────────────────────────────────
    const rawInput = m.args?.[0] || ''

    let targetJid = null
    if (!rawInput && m.isGroup) {
        targetJid = m.chat
    } else {
        targetJid = resolveGcJid(rawInput)
    }

    if (!targetJid) {
        return m.reply(
            `🛡️ *ᴡʜɪᴛᴇʟɪsᴛ ɢʀᴜᴘ*\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
            `┃ ◦ \`${m.prefix}whitelistgc <id>\` — Tambah grup\n` +
            `┃ ◦ \`${m.prefix}whitelistgc\` (di grup) — Whitelist grup ini\n` +
            `┃ ◦ \`${m.prefix}unwhitelistgc <id>\` — Hapus dari whitelist\n` +
            `┃ ◦ \`${m.prefix}listwlgc\` — Lihat daftar\n` +
            `┃ ◦ \`${m.prefix}whitelistmode on/off\` — Toggle mode\n` +
            `╰┈┈⬡\n\n` +
            `> _Format ID: \`120363xxxxxx@g.us\`_\n` +
            `> _Atau jalankan di dalam grup target tanpa argumen~_ 🌸`
        )
    }

    const list = getWhitelistedGroups(db)
    const meta = await sock.groupMetadata(targetJid).catch(() => null)
    const groupName = meta?.subject || targetJid

    // ── ADD ke whitelist ──────────────────────────────────────────────────────
    if (isAdd) {
        if (list.includes(targetJid)) {
            return m.reply(AI.warn(`Grup *${groupName}* sudah ada di whitelist nih~`))
        }

        list.push(targetJid)
        db.setting('whitelistedGroups', list)

        m.react('🛡️')
        return m.reply(
            `🛡️ *ɢʀᴜᴘ ᴅɪᴛᴀᴍʙᴀʜᴋᴀɴ ᴋᴇ ᴡʜɪᴛᴇʟɪsᴛ* 🌸\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 📛 ɴᴀᴍᴀ: *${groupName}*\n` +
            `┃ 🆔 ɪᴅ: \`${targetJid}\`\n` +
            `┃ 📋 ᴛᴏᴛᴀʟ: *${list.length}* grup\n` +
            `╰┈┈⬡\n\n` +
            `> _${isWhitelistModeActive(db)
                ? 'Mode whitelist sedang aktif, grup ini langsung bisa pakai bot~'
                : `Mode whitelist belum aktif. Nyalakan dengan \`${m.prefix}whitelistmode on\``} 💖_`
        )
    }

    // ── DEL dari whitelist ────────────────────────────────────────────────────
    if (isDel) {
        if (!list.includes(targetJid)) {
            return m.reply(AI.warn(`Grup *${groupName}* tidak ada di whitelist nih~`))
        }

        const updated = list.filter(j => j !== targetJid)
        db.setting('whitelistedGroups', updated)

        m.react('✅')
        return m.reply(
            `✅ *ɢʀᴜᴘ ᴅɪʜᴀᴘᴜs ᴅᴀʀɪ ᴡʜɪᴛᴇʟɪsᴛ* 🌸\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 📛 ɴᴀᴍᴀ: *${groupName}*\n` +
            `┃ 🆔 ɪᴅ: \`${targetJid}\`\n` +
            `┃ 📋 sɪsᴀ: *${updated.length}* grup\n` +
            `╰┈┈⬡\n\n` +
            `${updated.length === 0 && isWhitelistModeActive(db)
                ? `> ⚠️ _Whitelist kosong tapi mode masih aktif — semua grup akan ditolak! Matikan mode atau tambah grup lagi~_`
                : `> _Grup ini tidak bisa pakai bot lagi (jika mode aktif)~ 💕_`}`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler,
    isWhitelistModeActive,
    getWhitelistedGroups,
    isGroupWhitelisted
}