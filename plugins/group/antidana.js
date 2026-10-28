const { getDatabase } = require('../../src/lib/database')
const config = require('../../config')

// 🌸 Hoshino Ai Config
const pluginConfig = {
    name: 'antidana',
    alias: ['antiscam', 'danafilter'],
    category: 'group',
    description: 'Melindungi grup dari link scam DANA (mode pintar ✨)',
    usage: '.antidana <on/off/metode>',
    example: '.antidana on',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    isAdmin: true,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

/**
 * 🌸 Deteksi Scam DANA (Lebih Halus & Akurat)
 */
function isDanaScam(text) {
    if (!text || typeof text !== 'string') return false

    const clean = text.replace(/[*_~`]/g, '').toLowerCase()

    const keywords = [
        /dana kaget/,
        /bagi[- ]?bagi saldo/,
        /saldo gratis/,
        /claim dana/,
    ]

    const triggers = [
        /klik di sini/,
        /klaim sekarang/,
        /baru saja dapat/,
        /buruan ambil/,
    ]

    const hasKeyword = keywords.some(r => r.test(clean))
    const hasTrigger = triggers.some(r => r.test(clean))
    const hasLink = /(https?:\/\/[^\s]+)/i.test(text)

    return (hasKeyword || hasTrigger) && hasLink
}

/**
 * 🌸 Handle Scam
 */
async function handleDanaScam(m, sock, db) {
    const groupData = db.getGroup(m.chat) || {}
    const method = groupData.antidanaMethod || 'delete'

    const senderTag = m.sender.split('@')[0]

    // Hapus pesan
    try {
        await sock.sendMessage(m.chat, { delete: m.key })
    } catch {}

    // 🌸 Mode Kick
    if (method === 'kick') {
        try {
            await sock.groupParticipantsUpdate(m.chat, [m.sender], 'remove')

            await sock.sendMessage(m.chat, {
                text:
`🌸 *Ai melihat semuanya...* 👁️✨

🚫 @${senderTag} terdeteksi menyebarkan *link scam DANA*...
Dan... maaf ya~ aku harus mengeluarkanmu dari panggung ini 💔

> "Di dunia idol, kepercayaan itu segalanya..."`,
                mentions: [m.sender]
            })

        } catch {
            await m.reply(
`⚠️ *Ehh...? Gagal mengeluarkan dia...* 😣

Sepertinya Ai bukan admin... bantu aku ya~`,
{ mentions: [m.sender] })
        }

    } else {
        // 🌸 Mode Delete + Warning
        await sock.sendMessage(m.chat, {
            text:
`🌸 *Eh eh~ tunggu dulu!* 👀

@${senderTag} jangan sebarkan link seperti itu ya...
Itu terlihat seperti *scam DANA* 😢

> "Aku ingin semua orang di sini tetap aman dan tersenyum~" ✨`,
            mentions: [m.sender]
        })
    }

    return true
}

/**
 * 🌸 Command Handler
 */
async function handler(m, { sock }) {
    const db = getDatabase()
    const args = m.args || []
    const cmd = args[0]?.toLowerCase()

    const groupData = db.getGroup(m.chat) || {}

    // 🌸 Tampilan Status
    if (!cmd) {
        const status = groupData.antidana ? '🌸 AKTIF' : '💤 NONAKTIF'
        const method = groupData.antidanaMethod || 'delete'

        const txt =
`🌸 *Antidana Protection System* ✨

"Aku akan menjaga grup ini seperti idol menjaga fansnya~" 💖

╭─ Status
│ ✦ Mode : *${status}*
│ ✦ Metode : *${method}*
╰────────────

🎤 *Perintah:*
> .antidana on/off
> .antidana metode kick/delete

✨ *Catatan:*
- *delete* → hanya hapus + peringatan
- *kick* → langsung keluarkan pelaku 🚫`

        return m.reply(txt)
    }

    // 🌸 ON
    if (cmd === 'on') {
        db.setGroup(m.chat, { antidana: true })
        m.react('🌸')

        return m.reply(
`🌸 *Yay~ fitur aktif!* ✨

Sekarang Ai akan menjaga grup ini dari scam DANA ya~ 💖`
        )
    }

    // 🌸 OFF
    if (cmd === 'off') {
        db.setGroup(m.chat, { antidana: false })
        m.react('💤')

        return m.reply(
`💤 *Fitur dimatikan...*

Kalau butuh Ai lagi, panggil saja ya~`
        )
    }

    // 🌸 METHOD
    if (cmd === 'metode' || cmd === 'method') {
        const method = args[1]?.toLowerCase()

        if (!method || !['kick', 'delete'].includes(method)) {
            return m.reply(
`🌸 *Ehh...? Pilih yang benar dong~* 😣

Gunakan:
> .antidana metode kick
> .antidana metode delete`
            )
        }

        db.setGroup(m.chat, { antidanaMethod: method })
        m.react('✨')

        return m.reply(
`🌸 *Mode berhasil diubah!* ✨

Sekarang Ai akan menggunakan metode *${method}* 💖`
        )
    }

    // 🌸 Unknown
    return m.reply(
`🌸 *Hmm...? Aku tidak mengerti perintah itu~* 😢

Coba lihat menu:
> .antidana`
    )
}

module.exports = {
    config: pluginConfig,
    handler,
    isDanaScam,
    handleDanaScam
}