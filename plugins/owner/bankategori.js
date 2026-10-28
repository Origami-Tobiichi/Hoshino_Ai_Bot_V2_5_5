const { getDatabase } = require('../../src/lib/database')
const config = require('../../config')

const pluginConfig = {
    name: 'bankategori',
    alias: ['bancat', 'bancategory'],
    category: 'owner',
    description: 'Ban/unban/list kategori plugin',
    usage: '.bankategori <kategori> [global/@user] | -unban <kategori> [global/@user] | -list',
    example: '.bankategori downloader',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

// ── Helper ────────────────────────────────────────────────────────────────

function getBannedCategories(db) {
    return db.setting('bannedCategories') || {}
}

function saveBannedCategories(db, data) {
    db.setting('bannedCategories', data)
}

const VALID_CATEGORIES = [
    'main', 'tools', 'downloader', 'download', 'ai', 'game', 'rpg',
    'owner', 'group', 'sticker', 'media', 'anime', 'fun', 'search',
    'economy', 'utility', 'convert', 'info', 'premium', 'random',
    'canvas', 'stalker', 'panel', 'store', 'nsfw', 'religi', 'primbon',
    'tts', 'otp', 'vps', 'maker', 'ephoto', 'jpm', 'pushkontak',
    'cek', 'other', 'security'
]

function isCategoryBanned(category, m, db) {
    if (!category) return false
    if (m.isOwner) return false

    const banned = getBannedCategories(db)
    const cat = category.toLowerCase()

    if (banned.global?.includes(cat)) return true
    if (m.sender && banned.users?.[m.sender]?.includes(cat)) return true
    if (m.isGroup && m.chat && banned.groups?.[m.chat]?.includes(cat)) return true

    return false
}

// ── Handler ───────────────────────────────────────────────────────────────

async function handler(m, { sock }) {
    const db = getDatabase()
    const args = m.args

    // ── -list ─────────────────────────────────────────────────────────────
    if (!args[0]) {
        return m.reply(
            `🚫 *ʙᴀɴ ᴋᴀᴛᴇɢᴏʀɪ*\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
            `┃ 📦 *Ban di grup ini:*\n` +
            `┃ \`.bankategori <kategori>\`\n` +
            `┃\n` +
            `┃ 🌐 *Ban global semua grup:*\n` +
            `┃ \`.bankategori <kategori> global\`\n` +
            `┃\n` +
            `┃ 👤 *Ban 1 user:*\n` +
            `┃ \`.bankategori <kategori> @tag\`\n` +
            `┃\n` +
            `┃ ✅ *Unban:*\n` +
            `┃ \`.bankategori -unban <kategori>\`\n` +
            `┃ \`.bankategori -unban <kategori> global\`\n` +
            `┃ \`.bankategori -unban <kategori> @tag\`\n` +
            `┃\n` +
            `┃ 📋 *Lihat list ban:*\n` +
            `┃ \`.bankategori -list\`\n` +
            `╰┈┈⬡`
        )
    }

    if (args[0] === '-list') {
        const banned = getBannedCategories(db)

        const globalList = banned.global || []
        const groups = banned.groups || {}
        const users = banned.users || {}

        let text = `🚫 *ᴅᴀꜰᴛᴀʀ ʙᴀɴ ᴋᴀᴛᴇɢᴏʀɪ*\n\n`

        text += `╭┈┈⬡「 🌐 *ɢʟᴏʙᴀʟ* 」\n`
        if (globalList.length === 0) {
            text += `┃ _Tidak ada_\n`
        } else {
            globalList.forEach(c => { text += `┃ • \`${c}\`\n` })
        }
        text += `╰┈┈⬡\n\n`

        text += `╭┈┈⬡「 👥 *ᴘᴇʀ ɢʀᴜᴘ* 」\n`
        const groupKeys = Object.keys(groups)
        if (groupKeys.length === 0) {
            text += `┃ _Tidak ada_\n`
        } else {
            groupKeys.forEach(gid => {
                text += `┃ 🆔 \`${gid}\`\n`
                groups[gid].forEach(c => { text += `┃   • \`${c}\`\n` })
            })
        }
        text += `╰┈┈⬡\n\n`

        text += `╭┈┈⬡「 👤 *ᴘᴇʀ ᴜsᴇʀ* 」\n`
        const userKeys = Object.keys(users)
        if (userKeys.length === 0) {
            text += `┃ _Tidak ada_\n`
        } else {
            userKeys.forEach(uid => {
                text += `┃ 📱 @${uid.split('@')[0]}\n`
                users[uid].forEach(c => { text += `┃   • \`${c}\`\n` })
            })
        }
        text += `╰┈┈⬡\n\n`

        text +=
            `> \`${m.prefix}bankategori downloader\` — ban di grup ini\n` +
            `> \`${m.prefix}bankategori downloader global\` — ban global\n` +
            `> \`${m.prefix}bankategori downloader @tag\` — ban 1 user\n` +
            `> \`${m.prefix}bankategori -unban downloader\` — unban\n` +
            `> \`${m.prefix}bankategori -list\` — tampilan ini`

        return m.reply(text)
    }

    // ── -unban ────────────────────────────────────────────────────────────
    if (args[0] === '-unban') {
        const category = args[1]?.toLowerCase()
        if (!category) return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Tulis kategori yang mau di-unban\n> Contoh: \`${m.prefix}bankategori -unban downloader\``)
        if (!VALID_CATEGORIES.includes(category)) {
            return m.reply(
                `❌ *ᴋᴀᴛᴇɢᴏʀɪ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ*\n\n` +
                `> Kategori \`${category}\` tidak dikenali~\n\n` +
                `*Kategori valid:*\n` +
                VALID_CATEGORIES.map(c => `> \`${c}\``).join('\n')
            )
        }

        const banned = getBannedCategories(db)

        // Unban per user
        if (m.mentionedJid?.length) {
            const targetJid = m.mentionedJid[0]
            if (!banned.users?.[targetJid]?.includes(category)) {
                return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Kategori \`${category}\` tidak di-ban untuk user ini`)
            }
            banned.users[targetJid] = banned.users[targetJid].filter(c => c !== category)
            if (banned.users[targetJid].length === 0) delete banned.users[targetJid]
            saveBannedCategories(db, banned)
            m.react('✅')
            return m.reply(
                `✅ *ᴋᴀᴛᴇɢᴏʀɪ ᴅɪᴜɴʙᴀɴ*\n\n` +
                `> Kategori \`${category}\` sudah bisa dipakai lagi oleh @${targetJid.split('@')[0]}~`,
                { mentions: [targetJid] }
            )
        }

        // Unban global
        if (args[2]?.toLowerCase() === 'global') {
            if (!banned.global?.includes(category)) {
                return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Kategori \`${category}\` tidak di-ban secara global`)
            }
            banned.global = banned.global.filter(c => c !== category)
            saveBannedCategories(db, banned)
            m.react('✅')
            return m.reply(`✅ *ᴋᴀᴛᴇɢᴏʀɪ ᴅɪᴜɴʙᴀɴ*\n\n> Kategori \`${category}\` sudah aktif kembali secara global~`)
        }

        // Unban per grup
        const groupId = m.chat
        if (!groupId?.endsWith('@g.us')) {
            return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Gunakan di grup atau tambahkan \`global\`~`)
        }
        if (!banned.groups?.[groupId]?.includes(category)) {
            return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Kategori \`${category}\` tidak di-ban di grup ini`)
        }
        banned.groups[groupId] = banned.groups[groupId].filter(c => c !== category)
        if (banned.groups[groupId].length === 0) delete banned.groups[groupId]
        saveBannedCategories(db, banned)
        m.react('✅')
        return m.reply(`✅ *ᴋᴀᴛᴇɢᴏʀɪ ᴅɪᴜɴʙᴀɴ*\n\n> Kategori \`${category}\` sudah aktif kembali di grup ini~`)
    }

    // ── Ban ───────────────────────────────────────────────────────────────
    const category = args[0].toLowerCase()
    const banned = getBannedCategories(db)

    if (!VALID_CATEGORIES.includes(category)) {
        return m.reply(
            `❌ *ᴋᴀᴛᴇɢᴏʀɪ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ*\n\n` +
            `> Kategori \`${category}\` tidak dikenali~\n\n` +
            `*Kategori valid:*\n` +
            VALID_CATEGORIES.map(c => `> \`${c}\``).join('\n')
        )
    }

    // Ban per user
    if (m.mentionedJid?.length) {
        const targetJid = m.mentionedJid[0]
        if (!banned.users) banned.users = {}
        if (!banned.users[targetJid]) banned.users[targetJid] = []
        if (banned.users[targetJid].includes(category)) {
            return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Kategori \`${category}\` sudah di-ban untuk user ini`)
        }
        banned.users[targetJid].push(category)
        saveBannedCategories(db, banned)
        m.react('🚫')
        return m.reply(
            `🚫 *ᴋᴀᴛᴇɢᴏʀɪ ᴅɪʙᴀɴ*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 📦 ᴋᴀᴛᴇɢᴏʀɪ : \`${category}\`\n` +
            `┃ 👤 ᴛᴀʀɢᴇᴛ    : @${targetJid.split('@')[0]}\n` +
            `┃ 🌐 sᴄᴏᴘᴇ     : Per User\n` +
            `╰┈┈⬡`,
            { mentions: [targetJid] }
        )
    }

    // Ban global
    if (args[1]?.toLowerCase() === 'global') {
        if (!banned.global) banned.global = []
        if (banned.global.includes(category)) {
            return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Kategori \`${category}\` sudah di-ban secara global`)
        }
        banned.global.push(category)
        saveBannedCategories(db, banned)
        m.react('🚫')
        return m.reply(
            `🚫 *ᴋᴀᴛᴇɢᴏʀɪ ᴅɪʙᴀɴ*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 📦 ᴋᴀᴛᴇɢᴏʀɪ : \`${category}\`\n` +
            `┃ 🌐 sᴄᴏᴘᴇ     : Global\n` +
            `╰┈┈⬡`
        )
    }

    // Ban per grup
    const groupId = m.chat
    if (!groupId?.endsWith('@g.us')) {
        return m.reply(
            `❌ *ɢᴀɢᴀʟ*\n\n` +
            `> Gunakan di grup, atau tambahkan \`global\` untuk ban semua~\n` +
            `> Contoh: \`${m.prefix}bankategori ${category} global\``
        )
    }
    if (!banned.groups) banned.groups = {}
    if (!banned.groups[groupId]) banned.groups[groupId] = []
    if (banned.groups[groupId].includes(category)) {
        return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Kategori \`${category}\` sudah di-ban di grup ini`)
    }
    banned.groups[groupId].push(category)
    saveBannedCategories(db, banned)
    m.react('🚫')
    return m.reply(
        `🚫 *ᴋᴀᴛᴇɢᴏʀɪ ᴅɪʙᴀɴ*\n\n` +
        `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
        `┃ 📦 ᴋᴀᴛᴇɢᴏʀɪ : \`${category}\`\n` +
        `┃ 👥 sᴄᴏᴘᴇ     : Per Grup\n` +
        `┃ 🆔 ɢʀᴜᴘ      : \`${groupId}\`\n` +
        `╰┈┈⬡`
    )
}

module.exports = {
    config: pluginConfig,
    handler,
    isCategoryBanned
}