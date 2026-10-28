const { getDatabase } = require('../../src/lib/database')
const config = require('../../config')

const pluginConfig = {
    name: 'renameowner',
    alias: ['ownername', 'setownername'],
    category: 'owner',
    description: 'Rename nama owner — Owner Utama bisa rename siapa saja, Owner biasa hanya diri sendiri',
    usage: '.renameowner <nama baru> | .renameowner @target <nama baru>',
    example: '.renameowner Budi Keren',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

// ── Helper ────────────────────────────────────────────────────────────────────
function getConfigOwners() {
    return [].concat(config.owner?.number || [])
        .map(n => String(n).replace(/[^0-9]/g, ''))
        .filter(n => n.length >= 10)
}

function getDbOwners(db) {
    return (Array.isArray(db.data.owner) ? db.data.owner : [])
        .map(n => String(n).replace(/[^0-9]/g, ''))
        .filter(n => n.length >= 10)
}

function isOwnerUtama(number) {
    return getConfigOwners().includes(number)
}

function getOwnerPosition(number, db) {
    const configOwners = getConfigOwners()
    if (configOwners.includes(number)) return { type: 'utama', label: '👑 Owner Utama' }
    const dbOwners = getDbOwners(db).filter(n => !configOwners.includes(n))
    const idx = dbOwners.indexOf(number)
    if (idx === -1) return null
    return { type: 'biasa', pos: idx + 1, label: `⭐ Owner ${idx + 1}` }
}

function getOwnerNames(db) {
    return db.setting('ownerNames') || {}
}

function setOwnerName(db, number, name) {
    const names = getOwnerNames(db)
    names[number] = name
    db.setting('ownerNames', names)
}

function getOwnerDisplayName(number, db) {
    const names  = getOwnerNames(db)
    const pos    = getOwnerPosition(number, db)
    const stored = names[number]

    // Fallback ke pushName dari db.users (auto-saved tiap owner kirim command)
    const userDb = db.getUser ? db.getUser(number + '@s.whatsapp.net') : null
    const waName = userDb?.name || null

    if (!pos) return stored || waName || number

    if (pos.type === 'utama') {
        return stored || waName || config.owner?.name || 'Owner Utama'
    }

    // Owner biasa: nama custom → nama WA → fallback posisi
    return stored || waName || `Owner ${pos.pos}`
}

// ─────────────────────────────────────────────────────────────────────────────
async function handler(m, { sock }) {
    const db           = getDatabase()
    const senderNumber = m.sender.replace(/[^0-9]/g, '')
    const isUtama      = isOwnerUtama(senderNumber)

    // ── Resolve target ────────────────────────────────────────────────────────
    let targetNumber = senderNumber
    let nameInput    = m.text?.trim() || ''

    if (isUtama && (m.quoted || m.mentionedJid?.length)) {
        if (m.quoted) {
            targetNumber = m.quoted.sender?.replace(/[^0-9]/g, '') || senderNumber
        } else if (m.mentionedJid?.length) {
            targetNumber = m.mentionedJid[0].replace(/[^0-9]/g, '')
        }
        nameInput = nameInput.replace(/@\d+/g, '').trim()
    }

    // Validasi target adalah owner
    const targetPos = getOwnerPosition(targetNumber, db)
    if (!targetPos) {
        return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> \`${targetNumber}\` bukan owner bot~`)
    }

    // ── Guard: Owner biasa tidak bisa rename orang lain ──────────────────────
    if (!isUtama && targetNumber !== senderNumber) {
        return m.reply(
            `❌ *ɢᴀɢᴀʟ*\n\n` +
            `> Kamu hanya bisa rename dirimu sendiri~\n` +
            `> Untuk rename owner lain, butuh akses *Owner Utama* 🌸`
        )
    }

    // ── Help / info kalau tanpa nama ──────────────────────────────────────────
    if (!nameInput) {
        const currentName = getOwnerDisplayName(targetNumber, db)
        return m.reply(
            `✏️ *ʀᴇɴᴀᴍᴇ ᴏᴡɴᴇʀ*\n\n` +
            `╭┈┈⬡「 📋 *ɪɴꜰᴏ* 」\n` +
            `┃ 👤 ᴘᴏsɪsɪ: *${targetPos.label}*\n` +
            `┃ 📛 ɴᴀᴍᴀ sᴇᴋᴀʀᴀɴɢ: *${currentName}*\n` +
            `╰┈┈⬡\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
            `┃ ◦ \`${m.prefix}renameowner <nama>\` — Rename diri sendiri\n` +
            (isUtama ? `┃ ◦ \`${m.prefix}renameowner @target <nama>\` — Rename owner lain\n` : '') +
            `╰┈┈⬡\n\n` +
            `> _${isUtama
                ? 'Sebagai Owner Utama, kamu bisa rename siapa saja~ 🌸'
                : 'Rename namamu sesuka hati~ 🌸'}_`
        )
    }

    // ── Build nama final ──────────────────────────────────────────────────────
    const finalName = nameInput.trim()

    if (finalName.length > 50) {
        return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Nama terlalu panjang~ Maksimal 50 karakter`)
    }

    const oldName = getOwnerDisplayName(targetNumber, db)
    setOwnerName(db, targetNumber, finalName)

    m.react('✅')
    return m.reply(
        `✅ *ɴᴀᴍᴀ ᴏᴡɴᴇʀ ᴅɪᴜʙᴀʜ* 🌸\n\n` +
        `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
        `┃ 👤 ᴘᴏsɪsɪ: *${targetPos.label}*\n` +
        `┃ 📛 sᴇʙᴇʟᴜᴍ: *${oldName}*\n` +
        `┃ ✏️ sᴇsᴜᴅᴀʜ: *${finalName}*\n` +
        `╰┈┈⬡`,
        { mentions: [targetNumber + '@s.whatsapp.net'] }
    )
}

module.exports = {
    config: pluginConfig,
    handler,
    getOwnerDisplayName,
    getOwnerNames
}