const { getDatabase } = require('../../src/lib/database')
const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: 'hapusdata',
    alias: ['resetdata', 'cleardata', 'wipedata'],
    category: 'owner',
    description: 'Reset semua data database ke default',
    usage: '.hapusdata',
    example: '.hapusdata',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 0,
    isEnabled: true
}

const pendingReset = new Map()

const DB_FILES = [
    { file: 'users.json', label: '👥 Users', defaults: '{}' },
    { file: 'groups.json', label: '👥 Groups', defaults: '{}' },
    { file: 'settings.json', label: '⚙️ Settings', defaults: '{"selfMode":false}' },
    { file: 'stats.json', label: '📊 Stats', defaults: '{}' },
    { file: 'sewa.json', label: '🏪 Sewa', defaults: '{"enabled":false,"groups":{}}' },
    { file: 'premium.json', label: '⭐ Premium', defaults: '[]' },
    { file: 'owner.json', label: '👑 Owner', defaults: '[]' },
    { file: 'partner.json', label: '🤝 Partner', defaults: '[]' }
]

function getFileSize(filePath) {
    try {
        const stat = fs.statSync(filePath)
        const kb = (stat.size / 1024).toFixed(1)
        return `${kb} KB`
    } catch {
        return '0 KB'
    }
}

function countEntries(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const data = JSON.parse(content)
        if (Array.isArray(data)) return data.length
        return Object.keys(data).length
    } catch {
        return 0
    }
}

async function handler(m, { sock }) {
    const dbPath = path.join(process.cwd(), 'src', 'database')
    const args = m.text

    if (args === 'ya' || args === 'yes' || args === 'confirm') {
        const pending = pendingReset.get(m.sender)
        if (!pending || Date.now() - pending > 60000) {
            pendingReset.delete(m.sender)
            return m.reply(`❌ Tidak ada permintaan reset yang aktif.\n\n> Ketik \`${m.prefix}hapusdata\` terlebih dahulu`)
        }

        pendingReset.delete(m.sender)
        m.react('🕕')

        const db = getDatabase()
        db.flushAll()

        const backupDir = path.join(dbPath, 'backups')
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
        const ts = new Date().toISOString().replace(/[:.]/g, '-')

        let resetCount = 0
        let backupName = `backup-${ts}`
        const backupFolder = path.join(backupDir, backupName)
        fs.mkdirSync(backupFolder, { recursive: true })

        for (const { file, defaults } of DB_FILES) {
            const filePath = path.join(dbPath, file)
            if (!fs.existsSync(filePath)) continue

            try {
                fs.copyFileSync(filePath, path.join(backupFolder, file))
            } catch {}

            try {
                fs.writeFileSync(filePath, defaults, 'utf-8')
                resetCount++
            } catch {}
        }

        try {
            db.readAll()
        } catch {}

        m.react('✅')

        await sock.sendMessage(m.chat, {
            text: `🗑️ *ᴅᴀᴛᴀ ᴅɪʀᴇsᴇᴛ*\n\n` +
                `> 📁 File direset: *${resetCount}/${DB_FILES.length}*\n` +
                `> 💾 Backup: \`${backupName}\`\n\n` +
                `Semua data telah dikembalikan ke default.\n\n` +
                `> ⚠️ Restart bot untuk memastikan data tersinkronisasi`
        }, { quoted: m })
        return
    }

    const existing = []
    let totalSize = 0

    for (const { file, label } of DB_FILES) {
        const filePath = path.join(dbPath, file)
        if (!fs.existsSync(filePath)) continue
        const size = getFileSize(filePath)
        const entries = countEntries(filePath)
        totalSize += fs.statSync(filePath).size
        existing.push({ label, file, size, entries })
    }

    if (existing.length === 0) {
        return m.reply(`❌ *Ehh~* Tidak ada file database yang ditemukan~ 🥺`)
    }

    pendingReset.set(m.sender, Date.now())

    let txt = `⚠️ *ᴘᴇʀɪɴɢᴀᴛᴀɴ — ʜᴀᴘᴜs ᴅᴀᴛᴀ*\n\n`
    txt += `Aksi ini akan menghapus *SEMUA* data berikut:\n\n`

    for (const { label, entries, size } of existing) {
        txt += `> ${label}: *${entries}* data (${size})\n`
    }

    txt += `\n> 📦 Total: *${(totalSize / 1024).toFixed(1)} KB*\n`
    txt += `> 💾 Backup otomatis dibuat sebelum reset\n\n`
    txt += `Ketik \`${m.prefix}hapusdata ya\` dalam 60 detik untuk melanjutkan.`

    await sock.sendMessage(m.chat, {
        text: txt,
        interactiveButtons: [
            {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: '✅ Ya, Hapus Semua',
                    id: `${m.prefix}hapusdata ya`
                })
            },
            {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: '❌ Batalkan',
                    id: `${m.prefix}menu`
                })
            }
        ]
    }, { quoted: m })

    setTimeout(() => {
        pendingReset.delete(m.sender)
    }, 60000)
}

module.exports = {
    config: pluginConfig,
    handler
}
