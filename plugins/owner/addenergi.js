const { getDatabase } = require('../../src/lib/database')
const config = require('../../config')

const pluginConfig = {
    name: 'addenergi',
    alias: ['tambahenergi', 'giveenergi', 'addenergy', 'resetenergi'],
    category: 'owner',
    description: 'Tambah/reset energi user',
    usage: '.addenergi <jumlah/@user> | .addenergi --unlimited | .addenergi reset',
    example: '.addenergi 100 @user',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

function formatNumber(num) {
    if (num === -1) return '∞ Unlimited'
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function extractTarget(m) {
    if (m.quoted) return m.quoted.sender
    if (m.mentionedJid?.length) return m.mentionedJid[0]
    return null
}

async function handler(m, { sock }) {
    const db = getDatabase()

    const isReset     = m.command === 'resetenergi' || m.args.some(a => a === 'reset')
    const isUnlimited = m.args.some(a => a === '--unlimited' || a === '--unli')
    const numArg      = m.args.find(a => /^\d+$/.test(a))
    const amount      = numArg ? parseInt(numArg) : 0

    let targetJid = extractTarget(m)
    if (!targetJid) {
        const numericArg = m.args.find(a => a.length > 5 && /^\d+$/.test(a.replace(/[^0-9]/g, '')))
        if (numericArg) targetJid = numericArg.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
    }
    if (!targetJid) targetJid = m.sender

    // ── RESET ────────────────────────────────────────────────────────────────
    if (isReset) {
        const defaultEnergi = config.energi?.default || 99999
        db.setUser(targetJid, { energi: defaultEnergi })
        m.react('✅')
        return m.reply(
            `🔄 *ᴇɴᴇʀɢɪ ᴅɪʀᴇsᴇᴛ*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 👤 ᴜsᴇʀ: @${targetJid.split('@')[0]}\n` +
            `┃ ⚡ ᴇɴᴇʀɢɪ: *${formatNumber(defaultEnergi)}* (default)\n` +
            `╰┈┈⬡`,
            { mentions: [targetJid] }
        )
    }

    // ── UNLIMITED ─────────────────────────────────────────────────────────────
    if (isUnlimited) {
        db.setUser(targetJid, { energi: -1 })
        m.react('✅')
        return m.reply(
            `✅ *ᴇɴᴇʀɢɪ ᴜɴʟɪᴍɪᴛᴇᴅ*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 👤 ᴜsᴇʀ: @${targetJid.split('@')[0]}\n` +
            `┃ ⚡ ᴇɴᴇʀɢɪ: *∞ Unlimited*\n` +
            `╰┈┈⬡`,
            { mentions: [targetJid] }
        )
    }

    // ── ADD ───────────────────────────────────────────────────────────────────
    if (amount <= 0) {
        return m.reply(
            `⚡ *ᴀᴅᴅ ᴇɴᴇʀɢɪ*\n\n` +
            `> \`.addenergi <jumlah>\` — ke diri sendiri\n` +
            `> \`.addenergi <jumlah> @user\` — ke user\n` +
            `> \`.addenergi --unlimited [@user]\` — unlimited\n` +
            `> \`.addenergi reset [@user]\` — reset ke default\n\n` +
            `\`Contoh: ${m.prefix}addenergi 100\``
        )
    }

    const newEnergi = db.updateEnergi(targetJid, amount)
    m.react('✅')
    return m.reply(
        `✅ *ᴇɴᴇʀɢɪ ᴅɪᴛᴀᴍʙᴀʜ*\n\n` +
        `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
        `┃ 👤 ᴜsᴇʀ: @${targetJid.split('@')[0]}\n` +
        `┃ ➕ ᴛᴀᴍʙᴀʜ: *+${formatNumber(amount)}*\n` +
        `┃ ⚡ ᴛᴏᴛᴀʟ: *${formatNumber(newEnergi)}*\n` +
        `╰┈┈⬡`,
        { mentions: [targetJid] }
    )
}

module.exports = { config: pluginConfig, handler }