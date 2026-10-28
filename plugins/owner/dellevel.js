const { getDatabase } = require('../../src/lib/database')
const { calculateLevel, getRole } = require('../../src/lib/levelHelper')

const pluginConfig = {
    name: 'dellevel',
    alias: ['kuranglevel', 'removelevel', 'dellvl'],
    category: 'owner',
    description: 'Kurangi level user (via exp)',
    usage: '.dellevel <jumlah> @user',
    example: '.dellevel 5 @user',
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
            `📊 *ᴅᴇʟ ʟᴇᴠᴇʟ*\n\n` +
            `╭┈┈⬡「 📋 *ᴜsᴀɢᴇ* 」\n` +
            `┃ > \`.dellevel <jumlah>\` - ke diri sendiri\n` +
            `┃ > \`.dellevel <jumlah> @user\` - ke orang lain\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> Contoh: \`${m.prefix}dellevel 5\``
        )
    }

    const user = db.getUser(targetJid) || db.setUser(targetJid)
    if (!user.rpg) user.rpg = {}

    // FIX: pakai user.exp (root), bukan user.rpg.exp
    const oldLevel = calculateLevel(user.exp || 0)
    const expToRemove = levels * 20000

    // FIX: kurangi via db.updateExp dengan nilai negatif, sama seperti addlevel pakai updateExp
    const newExp = Math.max(0, (user.exp || 0) - expToRemove)
    db.updateExp(targetJid, newExp - (user.exp || 0)) // delta negatif
    user.exp = newExp

    const newLevel = calculateLevel(newExp)

    // Sync rpg.level juga
    user.rpg.level = newLevel
    user.rpg.maxHealth = 100 + (newLevel - 1) * 10
    user.rpg.maxMana = 100 + (newLevel - 1) * 5
    user.rpg.maxStamina = 100 + (newLevel - 1) * 5

    db.setUser(targetJid, { rpg: user.rpg })
    db.save()

    m.react('✅')

    await m.reply(
        `✅ *ʟᴇᴠᴇʟ ᴅɪᴋᴜʀᴀɴɢɪ*\n\n` +
        `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
        `┃ 👤 User: @${targetJid.split('@')[0]}\n` +
        `┃ ➖ Kurang: *-${levels} Level*\n` +
        `┃ 🚄 Exp Removed: *-${expToRemove.toLocaleString('id-ID')}*\n` +
        `┃ 📊 Level: *${oldLevel} → ${newLevel}*\n` +
        `┃ ${getRole(newLevel)}\n` +
        `╰┈┈┈┈┈┈┈┈⬡`,
        { mentions: [targetJid] }
    )
}

module.exports = {
    config: pluginConfig,
    handler
}