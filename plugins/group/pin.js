const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'pin',
    alias: ['pinmsg', 'pinpesan'],
    category: 'group',
    description: 'Hoshino Ai Pin Message System',
    usage: '.pin add/liat/send/del',
    example: '.pin add 24',
    isGroup: true,
    isAdmin: true,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const chat = m.chat
    const prefix = m.prefix

    // ===== PARSE ARGS =====
    let args = []
    if (m.args && Array.isArray(m.args)) {
        args = m.args
    } else if (m.text) {
        args = m.text
            .replace(new RegExp(`^\\${prefix}\\w+`), '')
            .trim()
            .split(/\s+/)
            .filter(v => v)
    }

    const sub = (args[0] || '').toLowerCase()

    const groupData = db.getGroup(chat) || {}
    let pins = Array.isArray(groupData.pins) ? groupData.pins : []

    const now = Date.now()

    // ===== AUTO CLEAN =====
    pins = pins.filter(p => p && p.expired && p.expired > now)

    // ================= ADD =================
    if (sub === 'add') {
        if (!m.quoted || !m.quoted.id) {
            return m.reply(
                `🎤✨ *Ai bilang...*\n\n` +
                `> "Kalau mau aku simpan kenangan ini... reply dulu ya~ 💖"\n\n` +
                `📌 Gunakan:\n${prefix}pin add`
            )
        }

        let duration = 86400

        if (args[1]) {
            const h = parseInt(args[1])
            if (!isNaN(h) && h >= 1 && h <= 720) {
                duration = h * 3600
            }
        }

        const expired = now + (duration * 1000)

        const fullText =
            m.quoted.text ||
            m.quoted.caption ||
            m.quoted.message?.conversation ||
            m.quoted.message?.extendedTextMessage?.text ||
            '[Media]'

        const data = {
            id: m.quoted.id,
            sender: m.quoted.sender,
            fullText,
            createdAt: now,
            expired
        }

        pins.push(data)

        db.setGroup(chat, {
            ...groupData,
            pins
        })

        return m.reply(
            `🌟 *Pin Berhasil Disimpan!*\n\n` +
            `> "Aku akan menjaga pesan ini baik-baik... selamanya~ 💫"\n\n` +
            `📊 Total Pin: ${pins.length}`
        )
    }

    // ================= LIAT =================
    if (sub === 'liat') {
        if (!pins.length) {
            return m.reply(
                `🎀 *Belum Ada Kenangan...*\n\n` +
                `> "Yahh... belum ada yang spesial untuk disimpan ya? 😢"`
            )
        }

        let teks = `🌸 *Hoshino Ai Pin List* 🌸\n\n`

        pins.forEach((p, i) => {
            let short = p.fullText || ''

            if (short.length > 60) {
                short = short.slice(0, 60) + '...'
            }

            teks += `💖 ${i + 1}. ${short}\n`
        })

        teks += `\n✨ *Gunakan:*\n`
        teks += `• ${prefix}pin send 1\n`
        teks += `• ${prefix}pin del 1\n`

        return m.reply(teks)
    }

    // ================= SEND =================
    if (sub === 'send') {
        if (!args[1]) {
            return m.reply(
                `⚠️ *Ai bingung...*\n\n` +
                `> "Kamu mau aku kirim yang mana? bilang nomor ya~ 💭"\n\n` +
                `Contoh: ${prefix}pin send 1`
            )
        }

        const index = parseInt(args[1]) - 1

        if (!pins[index]) {
            return m.reply(
                `❌ *Tidak ditemukan!*\n\n` +
                `> "Aku gak nemu pin itu... 😣"`
            )
        }

        const p = pins[index]

        return sock.sendMessage(m.chat, {
            text:
                `🌟 *PIN #${index + 1}*\n\n` +
                `${p.fullText}\n\n` +
                `💫 *Disimpan oleh Ai*`
        }, { quoted: m })
    }

    // ================= DEL =================
    if (sub === 'del') {
        if (!args[1]) {
            return m.reply(
                `⚠️ *Perintah belum lengkap~*\n\n` +
                `📌 Contoh:\n` +
                `• ${prefix}pin del 1\n` +
                `• ${prefix}pin del 1,2,3\n` +
                `• ${prefix}pin del all`
            )
        }

        // ===== ALL =====
        if (args[1].toLowerCase() === 'all') {
            pins = []

            db.setGroup(chat, {
                ...groupData,
                pins
            })

            return m.reply(
                `🗑️ *Semua Pin Dihapus*\n\n` +
                `> "Kenangan kita... hilang semua ya... 🥲"`
            )
        }

        let input = args.slice(1).join(' ')
        let indexes = input
            .split(/[,\s]+/)
            .map(v => parseInt(v))
            .filter(v => !isNaN(v) && v > 0)
            .map(v => v - 1)

        if (!indexes.length) {
            return m.reply('❌ Format salah.\nContoh: .pin del 1,2,3')
        }

        indexes = [...new Set(indexes)].sort((a, b) => b - a)

        let deleted = 0

        for (let i of indexes) {
            if (pins[i]) {
                pins.splice(i, 1)
                deleted++
            }
        }

        db.setGroup(chat, {
            ...groupData,
            pins
        })

        return m.reply(
            `💔 *Pin Dihapus*\n\n` +
            `> "Aku sudah menghapus ${deleted} kenangan... 😢"`
        )
    }

    // ================= DEFAULT =================
    return m.reply(
        `🎤✨ *Hoshino Ai Pin System* ✨\n\n` +
        `💖 ${prefix}pin add (reply pesan)\n` +
        `💖 ${prefix}pin liat\n` +
        `💖 ${prefix}pin send 1\n` +
        `💖 ${prefix}pin del 1\n\n` +
        `> "Aku akan menyimpan semua kenangan pentingmu~ 💫"`
    )
}

module.exports = {
    config: pluginConfig,
    handler
}