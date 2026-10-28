const config = require('../../config')
const { getDatabase } = require('../../src/lib/database')
const { isLid, lidToJid, resolveAnyLidToJid, isLidConverted } = require('../../src/lib/lidHelper')
const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: 'gamemode',
    alias: ['gm', 'setrole'],
    category: 'owner',
    description: 'Set role user: creative (owner), survival (user biasa), spectator (diabaikan bot)',
    usage: '.gamemode @user/nomor <creative|c|survival|s|spectator|sp>',
    example: '.gamemode @user creative',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanJid(jid) {
    if (!jid) return null
    if (isLid(jid)) jid = lidToJid(jid)
    return jid.includes('@') ? jid : jid + '@s.whatsapp.net'
}

function extractTarget(m) {
    let targetNumber = ''

    if (m.quoted) {
        let sender = m.quoted.sender || ''
        if (isLid(sender) || isLidConverted(sender)) {
            sender = resolveAnyLidToJid(sender, m.groupMembers || [])
        }
        targetNumber = sender?.replace(/[^0-9]/g, '') || ''
    } else if (m.mentionedJid?.length) {
        let jid = cleanJid(m.mentionedJid[0])
        if (isLid(jid) || isLidConverted(jid)) {
            jid = resolveAnyLidToJid(jid, m.groupMembers || [])
        }
        targetNumber = jid?.replace(/[^0-9]/g, '') || ''
    } else {
        // cari arg yang bentuknya nomor
        for (const arg of m.args) {
            const cleaned = arg.replace(/[^0-9]/g, '')
            if (cleaned.length >= 8) {
                targetNumber = cleaned
                break
            }
        }
    }

    if (targetNumber.startsWith('08')) targetNumber = '62' + targetNumber.slice(1)
    if (targetNumber.startsWith('0'))  targetNumber = '62' + targetNumber.slice(1)
    if (targetNumber.length > 15) return ''

    return targetNumber
}

function extractMode(m) {
    const modeMap = {
        creative: 'creative', c: 'creative',
        survival: 'survival', s: 'survival',
        spectator: 'spectator', sp: 'spectator'
    }
    for (const arg of m.args) {
        const lower = arg.toLowerCase().replace(/[^a-z]/g, '')
        if (modeMap[lower]) return modeMap[lower]
    }
    return null
}

function ensureData(db) {
    if (!db.data.owner)   db.data.owner   = []
    if (!db.data.ignored) db.data.ignored = []
}

function getCurrentRole(db, num) {
    ensureData(db)
    if (db.data.owner.includes(num))   return 'creative'
    if (db.data.ignored.includes(num)) return 'spectator'
    return 'survival'
}

function savePanelConfig() {
    try {
        const configPath = path.join(process.cwd(), 'config.js')
        let content = fs.readFileSync(configPath, 'utf8')
        const ownerPanelsStr = JSON.stringify(config.pterodactyl?.ownerPanels || [])
        content = content.replace(/ownerPanels:\s*\[.*?\]/s, `ownerPanels: ${ownerPanelsStr}`)
        const sellersStr = JSON.stringify(config.pterodactyl?.sellers || [])
        content = content.replace(/sellers:\s*\[.*?\]/s, `sellers: ${sellersStr}`)
        fs.writeFileSync(configPath, content, 'utf8')
        return true
    } catch (e) {
        console.error('[Gamemode] Failed to save config.js:', e.message)
        return false
    }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

async function handler(m, { sock }) {
    const db = getDatabase()
    ensureData(db)

    // Tampilkan help jika tidak ada args
    if (!m.args.length) {
        return m.reply(
            `🎮 *ɢᴀᴍᴇᴍᴏᴅᴇ — sᴇᴛ ʀᴏʟᴇ ᴜsᴇʀ*\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
            `┃ ◦ ${m.prefix}gamemode @user <mode>\n` +
            `┃ ◦ ${m.prefix}gamemode 6281xxx <mode>\n` +
            `┃ ◦ Reply pesan user lalu ketik mode\n` +
            `╰┈┈⬡\n\n` +
            `🟡 *Mode tersedia:*\n` +
            `┃ 👑 \`creative\` / \`c\`   → Jadi Owner\n` +
            `┃ 👤 \`survival\` / \`s\`   → User biasa\n` +
            `┃ 👻 \`spectator\` / \`sp\` → Diabaikan bot\n\n` +
            `_Contoh: ${m.prefix}gamemode @user creative_`
        )
    }

    const targetNumber = extractTarget(m)
    const mode = extractMode(m)

    if (!targetNumber) {
        return m.reply(
            `❌ *ᴛᴀʀɢᴇᴛ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ*\n\n` +
            `> Gunakan @mention, reply pesan, atau ketik nomor langsung\n` +
            `> _Contoh: ${m.prefix}gamemode @user creative_`
        )
    }

    if (targetNumber.length < 8 || targetNumber.length > 15) {
        return m.reply(`❌ *Ehh~* Format nomor tidak valid: \`${targetNumber}\``)
    }

    if (!mode) {
        return m.reply(
            `❌ *ᴍᴏᴅᴇ ᴛɪᴅᴀᴋ ᴅɪᴋᴇɴᴀʟ*\n\n` +
            `> Pilih salah satu:\n` +
            `> \`creative\` / \`c\`   — Owner\n` +
            `> \`survival\` / \`s\`   — User biasa\n` +
            `> \`spectator\` / \`sp\` — Diabaikan bot`
        )
    }

    const currentRole = getCurrentRole(db, targetNumber)
    const roleLabel = { creative: '👑 Owner', survival: '👤 User', spectator: '👻 Spectator' }
    const roleEmoji = { creative: '👑', survival: '👤', spectator: '👻' }

    if (currentRole === mode) {
        return m.reply(`ℹ️ \`${targetNumber}\` sudah dalam mode *${roleLabel[mode]}*.`)
    }

    // ── Bersihkan dari semua list terlebih dahulu ──────────────────────────────
    db.data.owner   = db.data.owner.filter(n => n !== targetNumber)
    db.data.ignored = db.data.ignored.filter(n => n !== targetNumber)

    let needSavePanelCfg = false
    if (config.pterodactyl?.sellers) {
        const before = config.pterodactyl.sellers.length
        config.pterodactyl.sellers = config.pterodactyl.sellers.filter(n => String(n).trim() !== targetNumber)
        if (config.pterodactyl.sellers.length !== before) needSavePanelCfg = true
    }
    if (config.pterodactyl?.ownerPanels) {
        const before = config.pterodactyl.ownerPanels.length
        config.pterodactyl.ownerPanels = config.pterodactyl.ownerPanels.filter(n => String(n).trim() !== targetNumber)
        if (config.pterodactyl.ownerPanels.length !== before) needSavePanelCfg = true
    }

    // ── Terapkan mode baru ─────────────────────────────────────────────────────
    let extraNote = ''

    if (mode === 'creative') {
        db.data.owner.push(targetNumber)
        db.save()
        if (needSavePanelCfg) savePanelConfig()
        m.react('👑')
        return m.reply(
            `👑 *ɢᴀᴍᴇᴍᴏᴅᴇ ᴅɪᴜʙᴀʜ*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 📱 ɴᴏᴍᴏʀ : \`${targetNumber}\`\n` +
            `┃ 🔄 sᴇʙᴇʟᴜᴍ : ${roleEmoji[currentRole]} \`${currentRole}\`\n` +
            `┃ ✅ sᴇᴋᴀʀᴀɴɢ : 👑 \`creative\`\n` +
            `┃ 🔓 ᴀᴋsᴇs  : \`Semua fitur owner\`\n` +
            `╰┈┈⬡\n\n` +
            `> User ini sekarang punya akses penuh seperti owner~`
        )
    }

    if (mode === 'survival') {
        db.save()
        if (needSavePanelCfg) savePanelConfig()
        m.react('✅')
        return m.reply(
            `👤 *ɢᴀᴍᴇᴍᴏᴅᴇ ᴅɪᴜʙᴀʜ*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 📱 ɴᴏᴍᴏʀ : \`${targetNumber}\`\n` +
            `┃ 🔄 sᴇʙᴇʟᴜᴍ : ${roleEmoji[currentRole]} \`${currentRole}\`\n` +
            `┃ ✅ sᴇᴋᴀʀᴀɴɢ : 👤 \`survival\`\n` +
            `┃ 🔒 ᴀᴋsᴇs  : \`User biasa\`\n` +
            `╰┈┈⬡\n\n` +
            `> User ini kembali jadi user biasa~`
        )
    }

    if (mode === 'spectator') {
        db.data.ignored.push(targetNumber)
        db.save()
        if (needSavePanelCfg) savePanelConfig()
        m.react('👻')
        return m.reply(
            `👻 *ɢᴀᴍᴇᴍᴏᴅᴇ ᴅɪᴜʙᴀʜ*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 📱 ɴᴏᴍᴏʀ : \`${targetNumber}\`\n` +
            `┃ 🔄 sᴇʙᴇʟᴜᴍ : ${roleEmoji[currentRole]} \`${currentRole}\`\n` +
            `┃ ✅ sᴇᴋᴀʀᴀɴɢ : 👻 \`spectator\`\n` +
            `┃ 🚫 ᴀᴋsᴇs  : \`Diabaikan bot\`\n` +
            `╰┈┈⬡\n\n` +
            `> Bot tidak akan merespon user ini~`
        )
    }
}

// ─── Export isIgnoredUser (dipanggil di handler.js) ───────────────────────────

function isIgnoredUser(senderNumber, db) {
    if (!db?.data?.ignored) return false
    return db.data.ignored.includes(senderNumber)
}

module.exports = {
    config: pluginConfig,
    handler,
    isIgnoredUser
}