const { getDatabase } = require('../../src/lib/database')
const { calculateLevel, getRole } = require('./../../src/lib/levelHelper')

const pluginConfig = {
    name: 'addlevel',
    alias: ['tambahlevel', 'givelevel', 'addlvl'],
    category: 'owner',
    description: 'Tambah level user (via exp)',
    usage: '.addlevel <jumlah> @user',
    example: '.addlevel 5 @user',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

function extractTarget(m) {
    if (m.quoted) return m.quoted.sender
    if (m.mentionedJid?.length) return m.mentionedJid[0]
    return null
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const args = m.args

    const numArg = args.find(a => !isNaN(a) && !a.startsWith('@'))
    let levels = parseInt(numArg) || 0

    let targetJid = extractTarget(m)

    if (!targetJid && levels > 0) {
        targetJid = m.sender
    }

    if (!targetJid || levels <= 0) {
        return m.reply(
            `📊 *ᴀᴅᴅ ʟᴇᴠᴇʟ*\n\n` +
            `╭┈┈⬡「 📋 *ᴜsᴀɢᴇ* 」\n` +
            `┃ > \`.addlevel <jumlah>\` - ke diri sendiri\n` +
            `┃ > \`.addlevel <jumlah> @user\` - ke orang lain\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> Contoh: \`${m.prefix}addlevel 5\``
        )
    }

    if (levels <= 0) {
        return m.reply(`❌ *Gomen ne~* ✦\n\n> Jumlah level harus lebih dari 0~ 🥺`)
    }

    const user = db.getUser(targetJid) || db.setUser(targetJid)

    // FIX: snapshot oldLevel dari targetJid sebelum exp ditambah
    const oldLevel = calculateLevel(user.exp || 0)
    const expToAdd = levels * 20000

    const levelHelper = require('../../src/lib/levelHelper')
    // FIX: pass targetJid sebagai argumen ke-6
    const addResult = await levelHelper.addExpWithLevelCheck(sock, m, db, user, expToAdd, targetJid)

    m.react('✅')

    await m.reply(
        `✅ *ʟᴇᴠᴇʟ ᴅɪᴛᴀᴍʙᴀʜ*\n\n` +
        `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
        `┃ 👤 User: @${targetJid.split('@')[0]}\n` +
        `┃ ➕ Tambah: *+${levels} Level*\n` +
        `┃ 🚄 Exp Added: *+${expToAdd.toLocaleString('id-ID')}*\n` +
        `┃ 📊 Level: *${oldLevel} → ${addResult.newLevel || calculateLevel(user.exp)}*\n` +
        `┃ ${getRole(addResult.newLevel || calculateLevel(user.exp))}\n` +
        `╰┈┈┈┈┈┈┈┈⬡`,
        { mentions: [targetJid] }
    )
}

module.exports = {
    config: pluginConfig,
    handler
}