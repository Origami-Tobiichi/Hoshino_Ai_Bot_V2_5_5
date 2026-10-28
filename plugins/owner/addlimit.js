const { getDatabase } = require('../../src/lib/database')
const config = require('../../config')

const pluginConfig = {
    name: 'addlimit',
    alias: ['dellimit', 'setlimit', 'cekolimit', 'resetlimit', 'addl', 'dell', 'setl'],
    category: 'owner',
    description: 'Kelola limit/energi per-user spesifik',
    usage: '.addlimit <jumlah> @user | .dellimit <jumlah> @user | .setlimit <jumlah> @user | .cekolimit @user | .resetlimit @user',
    example: '.addlimit 50 @user',
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
    if (num === undefined || num === null) return '0'
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function extractTarget(m) {
    if (m.quoted) return m.quoted.sender
    if (m.mentionedJid?.length) return m.mentionedJid[0]
    // coba dari args nomor
    const numArg = m.args?.find(a => /^\d{8,15}$/.test(a.replace(/[^0-9]/g, '')))
    if (numArg) {
        let num = numArg.replace(/[^0-9]/g, '')
        if (num.startsWith('0')) num = '62' + num.slice(1)
        return num + '@s.whatsapp.net'
    }
    return null
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const cmd = m.command.toLowerCase()

    const isAdd   = ['addlimit', 'addl'].includes(cmd)
    const isDel   = ['dellimit', 'dell'].includes(cmd)
    const isSet   = ['setlimit', 'setl'].includes(cmd)
    const isCek   = ['cekolimit'].includes(cmd)
    const isReset = ['resetlimit'].includes(cmd)

    // ── CEK limit user ────────────────────────────────────────────────────────
    if (isCek) {
        const targetJid = extractTarget(m) || m.sender
        const user = db.getUser(targetJid)

        if (!user) {
            return m.reply(
                `❌ *ɢᴀɢᴀʟ*\n\n> User @${targetJid.split('@')[0]} belum terdaftar di database`,
                { mentions: [targetJid] }
            )
        }

        const defaultLimit = db.setting('defaultLimit') || config.limits?.default || 25
        const premLimit    = config.limits?.premium || 100
        const currentLimit = user.energi ?? defaultLimit
        const isPrem       = user.isPremium || false

        return m.reply(
            `📊 *ᴄᴇᴋ ʟɪᴍɪᴛ ᴜsᴇʀ*\n\n` +
            `╭┈┈⬡「 👤 *ᴅᴀᴛᴀ ᴜsᴇʀ* 」\n` +
            `┃ 👤 ᴜsᴇʀ: @${targetJid.split('@')[0]}\n` +
            `┃ 💎 sᴛᴀᴛᴜs: *${isPrem ? '💎 Premium' : '👤 Regular'}*\n` +
            `┃ ⚡ ʟɪᴍɪᴛ: *${formatNumber(currentLimit)}*\n` +
            `┃ 📊 ᴅᴇꜰᴀᴜʟᴛ: *${formatNumber(defaultLimit)}*\n` +
            `┃ 💎 ᴘʀᴇᴍ ᴍᴀx: *${formatNumber(premLimit)}*\n` +
            `╰┈┈⬡`,
            { mentions: [targetJid] }
        )
    }

    // ── RESET limit ke default ────────────────────────────────────────────────
    if (isReset) {
        const targetJid = extractTarget(m) || m.sender
        const user = db.getUser(targetJid)

        if (!user) {
            return m.reply(
                `❌ *ɢᴀɢᴀʟ*\n\n> User @${targetJid.split('@')[0]} belum terdaftar`,
                { mentions: [targetJid] }
            )
        }

        const defaultLimit = db.setting('defaultLimit') || config.limits?.default || 25
        db.setUser(targetJid, { energi: defaultLimit })

        m.react('✅')
        return m.reply(
            `✅ *ʟɪᴍɪᴛ ᴅɪʀᴇsᴇᴛ*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 👤 ᴜsᴇʀ: @${targetJid.split('@')[0]}\n` +
            `┃ ⚡ ʟɪᴍɪᴛ: *${formatNumber(defaultLimit)}* (default)\n` +
            `╰┈┈⬡`,
            { mentions: [targetJid] }
        )
    }

    // ── Parsing jumlah + target ───────────────────────────────────────────────
    const isUnlimited = m.text?.toLowerCase().includes('--unlimited') ||
                        m.text?.toLowerCase().includes('--unli')

    const numArg = m.args?.find(a => /^\d+$/.test(a))
    const amount = parseInt(numArg) || 0

    const targetJid = extractTarget(m) || m.sender

    // Help kalau tidak ada argumen valid
    if (!isUnlimited && amount <= 0 && (isAdd || isDel || isSet)) {
        return m.reply(
            `⚡ *ᴋᴇʟᴏʟᴀ ʟɪᴍɪᴛ ᴜsᴇʀ*\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
            `┃ ◦ \`${m.prefix}addlimit <jml> @user\` — Tambah limit\n` +
            `┃ ◦ \`${m.prefix}dellimit <jml> @user\` — Kurangi limit\n` +
            `┃ ◦ \`${m.prefix}setlimit <jml> @user\` — Set langsung\n` +
            `┃ ◦ \`${m.prefix}setlimit --unlimited @user\` — Unlimited\n` +
            `┃ ◦ \`${m.prefix}cekolimit @user\` — Cek limit\n` +
            `┃ ◦ \`${m.prefix}resetlimit @user\` — Reset ke default\n` +
            `╰┈┈⬡\n\n` +
            `> _Target: reply / @mention / nomor / kosong = diri sendiri_\n` +
            `> _\`Contoh: ${m.prefix}addlimit 50 @user\`_`
        )
    }

    const user = db.getUser(targetJid) || db.setUser(targetJid)

    // ── ADD limit ─────────────────────────────────────────────────────────────
    if (isAdd) {
        if (isUnlimited) {
            db.setUser(targetJid, { energi: -1 })
            m.react('✅')
            return m.reply(
                `✅ *ʟɪᴍɪᴛ ᴜɴʟɪᴍɪᴛᴇᴅ*\n\n` +
                `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
                `┃ 👤 ᴜsᴇʀ: @${targetJid.split('@')[0]}\n` +
                `┃ ⚡ ʟɪᴍɪᴛ: *∞ Unlimited*\n` +
                `╰┈┈⬡`,
                { mentions: [targetJid] }
            )
        }

        const oldLimit = user.energi ?? 0
        const newLimit = db.updateEnergi(targetJid, amount)

        m.react('✅')
        return m.reply(
            `✅ *ʟɪᴍɪᴛ ᴅɪᴛᴀᴍʙᴀʜ*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 👤 ᴜsᴇʀ: @${targetJid.split('@')[0]}\n` +
            `┃ ⚡ sᴇʙᴇʟᴜᴍ: *${formatNumber(oldLimit)}*\n` +
            `┃ ➕ ᴛᴀᴍʙᴀʜ: *+${formatNumber(amount)}*\n` +
            `┃ 📊 sᴇᴋᴀʀᴀɴɢ: *${formatNumber(newLimit)}*\n` +
            `╰┈┈⬡`,
            { mentions: [targetJid] }
        )
    }

    // ── DEL limit ─────────────────────────────────────────────────────────────
    if (isDel) {
        if (user.energi === -1) {
            // cabut unlimited dulu, set ke default
            const defaultLimit = db.setting('defaultLimit') || config.limits?.default || 25
            db.setUser(targetJid, { energi: defaultLimit })
        }

        const oldLimit = db.getUser(targetJid)?.energi ?? 0
        const newLimit = db.updateEnergi(targetJid, -amount)

        m.react('✅')
        return m.reply(
            `✅ *ʟɪᴍɪᴛ ᴅɪᴋᴜʀᴀɴɢɪ*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 👤 ᴜsᴇʀ: @${targetJid.split('@')[0]}\n` +
            `┃ ⚡ sᴇʙᴇʟᴜᴍ: *${formatNumber(oldLimit)}*\n` +
            `┃ ➖ ᴋᴜʀᴀɴɢ: *-${formatNumber(amount)}*\n` +
            `┃ 📊 sɪsᴀ: *${formatNumber(Math.max(0, newLimit))}*\n` +
            `╰┈┈⬡`,
            { mentions: [targetJid] }
        )
    }

    // ── SET limit langsung ────────────────────────────────────────────────────
    if (isSet) {
        if (isUnlimited) {
            db.setUser(targetJid, { energi: -1 })
            m.react('✅')
            return m.reply(
                `✅ *ʟɪᴍɪᴛ ᴅɪsᴇᴛ ᴜɴʟɪᴍɪᴛᴇᴅ*\n\n` +
                `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
                `┃ 👤 ᴜsᴇʀ: @${targetJid.split('@')[0]}\n` +
                `┃ ⚡ ʟɪᴍɪᴛ: *∞ Unlimited*\n` +
                `╰┈┈⬡`,
                { mentions: [targetJid] }
            )
        }

        const oldLimit = user.energi ?? 0
        db.setUser(targetJid, { energi: amount })

        m.react('✅')
        return m.reply(
            `✅ *ʟɪᴍɪᴛ ᴅɪsᴇᴛ*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 👤 ᴜsᴇʀ: @${targetJid.split('@')[0]}\n` +
            `┃ ⚡ sᴇʙᴇʟᴜᴍ: *${formatNumber(oldLimit)}*\n` +
            `┃ 📊 sᴇᴋᴀʀᴀɴɢ: *${formatNumber(amount)}*\n` +
            `╰┈┈⬡`,
            { mentions: [targetJid] }
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}