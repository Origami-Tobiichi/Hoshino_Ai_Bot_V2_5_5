const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'setkoin',
    alias: ['setexp', 'setxp', 'setcoin', 'resetkoin', 'resetexp'],
    category: 'owner',
    description: 'Set koin/exp user ke nilai tertentu langsung',
    usage: '.setkoin <jumlah> @user | .setexp <jumlah> @user | .resetkoin @user | .resetexp @user',
    example: '.setkoin 50000 @user',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

const MAX_KOIN = 9000000000000 // 9T
const MAX_EXP  = 9000000000    // 9B

function formatKoin(num) {
    if (num >= 1000000000000) return (num / 1000000000000).toFixed(2) + 'T'
    if (num >= 1000000000)    return (num / 1000000000).toFixed(2) + 'B'
    if (num >= 1000000)       return (num / 1000000).toFixed(2) + 'M'
    if (num >= 1000)          return (num / 1000).toFixed(2) + 'K'
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function formatExp(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B'
    if (num >= 1000000)    return (num / 1000000).toFixed(2) + 'M'
    if (num >= 1000)       return (num / 1000).toFixed(2) + 'K'
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function extractTarget(m) {
    if (m.quoted) return m.quoted.sender
    if (m.mentionedJid?.length) return m.mentionedJid[0]
    const numArg = m.args?.find(a => /^\d{8,15}$/.test(a.replace(/[^0-9]/g, '')))
    if (numArg) {
        let num = numArg.replace(/[^0-9]/g, '')
        if (num.startsWith('0')) num = '62' + num.slice(1)
        return num + '@s.whatsapp.net'
    }
    return null
}

async function handler(m, { sock }) {
    const db  = getDatabase()
    const cmd = m.command.toLowerCase()

    const isKoin     = ['setkoin', 'setcoin'].includes(cmd)
    const isExp      = ['setexp', 'setxp'].includes(cmd)
    const isResetK   = cmd === 'resetkoin'
    const isResetE   = cmd === 'resetexp'

    const targetJid = extractTarget(m) || m.sender

    // ── RESET KOIN → 0 ───────────────────────────────────────────────────────
    if (isResetK) {
        const user = db.getUser(targetJid)
        if (!user) return m.reply(`❌ *Gomen ne~* ✦\n\n> User belum terdaftar di database~ 🥺`, { mentions: [targetJid] })

        const oldKoin = user.koin || 0
        db.setUser(targetJid, { koin: 0 })

        m.react('✅')
        return m.reply(
            `✅ *ᴋᴏɪɴ ᴅɪʀᴇsᴇᴛ*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 👤 ᴜsᴇʀ: @${targetJid.split('@')[0]}\n` +
            `┃ 💰 sᴇʙᴇʟᴜᴍ: *${formatKoin(oldKoin)}*\n` +
            `┃ 💰 sᴇᴋᴀʀᴀɴɢ: *0*\n` +
            `╰┈┈⬡`,
            { mentions: [targetJid] }
        )
    }

    // ── RESET EXP → 0 ────────────────────────────────────────────────────────
    if (isResetE) {
        const user = db.getUser(targetJid)
        if (!user) return m.reply(`❌ *Gomen ne~* ✦\n\n> User belum terdaftar di database~ 🥺`, { mentions: [targetJid] })

        const oldExp = user.exp || 0
        db.setUser(targetJid, { exp: 0 })

        m.react('✅')
        return m.reply(
            `✅ *ᴇxᴘ ᴅɪʀᴇsᴇᴛ*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 👤 ᴜsᴇʀ: @${targetJid.split('@')[0]}\n` +
            `┃ 🆙 sᴇʙᴇʟᴜᴍ: *${formatExp(oldExp)}*\n` +
            `┃ 🆙 sᴇᴋᴀʀᴀɴɢ: *0*\n` +
            `╰┈┈⬡`,
            { mentions: [targetJid] }
        )
    }

    // ── PARSING JUMLAH ────────────────────────────────────────────────────────
    const numArg = m.args?.find(a => /^\d+$/.test(a))
    const amount = parseInt(numArg) || 0

    if (amount <= 0) {
        return m.reply(
            `${isKoin ? '💰' : '🆙'} *sᴇᴛ ${isKoin ? 'ᴋᴏɪɴ' : 'ᴇxᴘ'}*\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
            `┃ ◦ \`${m.prefix}setkoin <jml> @user\` — Set koin\n` +
            `┃ ◦ \`${m.prefix}setexp <jml> @user\` — Set exp\n` +
            `┃ ◦ \`${m.prefix}resetkoin @user\` — Reset koin ke 0\n` +
            `┃ ◦ \`${m.prefix}resetexp @user\` — Reset exp ke 0\n` +
            `╰┈┈⬡\n\n` +
            `> _Target: reply / @mention / nomor / kosong = diri sendiri_\n` +
            `> _\`Contoh: ${m.prefix}${cmd} 50000 @user\`_`
        )
    }

    const user = db.getUser(targetJid) || db.setUser(targetJid)

    // ── SET KOIN ──────────────────────────────────────────────────────────────
    if (isKoin) {
        const finalAmount = Math.min(amount, MAX_KOIN)
        const oldKoin = user.koin || 0
        db.setUser(targetJid, { koin: finalAmount })

        m.react('✅')
        return m.reply(
            `✅ *ᴋᴏɪɴ ᴅɪsᴇᴛ*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 👤 ᴜsᴇʀ: @${targetJid.split('@')[0]}\n` +
            `┃ 💰 sᴇʙᴇʟᴜᴍ: *${formatKoin(oldKoin)}*\n` +
            `┃ 💰 sᴇᴋᴀʀᴀɴɢ: *${formatKoin(finalAmount)}*\n` +
            `${finalAmount < amount ? '┃ ⚠️ ᴅɪᴄᴀᴘ: *9T (max)*\n' : ''}` +
            `╰┈┈⬡`,
            { mentions: [targetJid] }
        )
    }

    // ── SET EXP ───────────────────────────────────────────────────────────────
    if (isExp) {
        const finalAmount = Math.min(amount, MAX_EXP)
        const oldExp = user.exp || 0
        db.setUser(targetJid, { exp: finalAmount })

        m.react('✅')
        return m.reply(
            `✅ *ᴇxᴘ ᴅɪsᴇᴛ*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 👤 ᴜsᴇʀ: @${targetJid.split('@')[0]}\n` +
            `┃ 🆙 sᴇʙᴇʟᴜᴍ: *${formatExp(oldExp)}*\n` +
            `┃ 🆙 sᴇᴋᴀʀᴀɴɢ: *${formatExp(finalAmount)}*\n` +
            `${finalAmount < amount ? '┃ ⚠️ ᴅɪᴄᴀᴘ: *9B (max)*\n' : ''}` +
            `╰┈┈⬡`,
            { mentions: [targetJid] }
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}