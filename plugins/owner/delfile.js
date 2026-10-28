const fs   = require('fs')
const path = require('path')

// pakai global biar tetap satu Map walau modul ini di-require ulang (hot reload / pluginhealth)
if (!global.__delfilePending) global.__delfilePending = new Map()
const pendingConfirm = global.__delfilePending

const BACKUP_MAX = 5

// ── File/folder yang gak boleh dihapus lewat command ini ──────────────────────
const protectedPaths = new Set([
    'index.js',
    'package.json',
    'package-lock.json',
    'node_modules',
    '.git',
    'backup',
])

const pluginConfig = {
    name: 'delfile',
    alias: ['deletefile', 'hapusfile', 'removefile'],
    category: 'owner',
    description: 'Hapus file dari server via path (backup otomatis sebelum dihapus)',
    usage: '.delfile <path>',
    example: '.delfile ./plugins/owner/tesbaru.js',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

const AI = {
    ok:   (msg) => `✨ *${msg}*\n\n> Ai seneng bisa bantu kamu~ 💖`,
    err:  (msg) => `💔 *Aduh~ Ada yang salah nih!*\n\n> ${msg}\n\n> Jangan nyerah ya, Ai tetap di sini! ✨`,
    warn: (msg) => `🌸 *Hmm~ Perhatiin dulu ya!*\n\n> ${msg}`,
}

function detectMime(filename) {
    const ext = path.extname(filename).toLowerCase()
    const mimeMap = {
        '.js':   'text/javascript',
        '.ts':   'text/typescript',
        '.json': 'application/json',
        '.jpg':  'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png':  'image/png',
        '.gif':  'image/gif',
        '.webp': 'image/webp',
        '.mp4':  'video/mp4',
        '.mp3':  'audio/mpeg',
        '.ogg':  'audio/ogg',
        '.pdf':  'application/pdf',
        '.zip':  'application/zip',
        '.txt':  'text/plain',
        '.html': 'text/html',
        '.css':  'text/css',
        '.env':  'text/plain',
        '.md':   'text/markdown',
        '.sh':   'text/x-shellscript',
        '.py':   'text/x-python',
        '.yml':  'text/yaml',
        '.yaml': 'text/yaml',
    }
    return mimeMap[ext] || 'application/octet-stream'
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function pruneBackups(baseName) {
    const backupDir = path.join(process.cwd(), 'backup', 'files')
    if (!fs.existsSync(backupDir)) return 0

    const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith(baseName + '_'))
        .map(f => ({ name: f, mtime: fs.statSync(path.join(backupDir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)

    if (files.length > BACKUP_MAX) {
        files.slice(BACKUP_MAX).forEach(f => {
            try { fs.unlinkSync(path.join(backupDir, f.name)) } catch {}
        })
    }

    return Math.min(files.length, BACKUP_MAX)
}

function isProtected(rootDir, targetPath) {
    const rel = path.relative(rootDir, targetPath)
    const firstSegment = rel.split(path.sep)[0]
    return protectedPaths.has(firstSegment) || protectedPaths.has(rel)
}

// ── Core delete ───────────────────────────────────────────────────────────────
async function executeDelete(m, { targetPath, isDir }) {
    const rootDir   = process.cwd()
    const baseName  = path.basename(targetPath)
    const relTarget = path.relative(rootDir, targetPath)
    const mime      = detectMime(baseName)
    const ext       = path.extname(baseName).toLowerCase()
    const now       = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })

    let backupPath  = null
    let fileSize    = 0
    let backupCount = 0

    try {
        if (isDir) {
            fs.rmSync(targetPath, { recursive: true, force: true })
            m.react('✅')

            return m.reply(
                `🌸✨ *ꜰᴏʟᴅᴇʀ ʙᴇʀʜᴀsɪʟ ᴅɪʜᴀᴘᴜs* ✨🌸\n\n` +
                `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
                `┃ 📁 ᴘᴀᴛʜ  : \`${relTarget}\`\n` +
                `┃ 🕐 ᴡᴀᴋᴛᴜ : \`${now}\`\n` +
                `╰┈┈⬡\n\n` +
                `> Folder ini gak di-backup ya (khusus file) — pastiin udah yakin~ 💖`
            )
        }

        fileSize = fs.statSync(targetPath).size

        const backupDir = path.join(rootDir, 'backup', 'files')
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        backupPath = path.join(backupDir, `${baseName}_${timestamp}`)
        fs.copyFileSync(targetPath, backupPath)
        backupCount = pruneBackups(baseName)

        fs.unlinkSync(targetPath)
        m.react('✅')

        const relBackup = path.relative(rootDir, backupPath)

        const replyText =
            `🌸✨ *ꜰɪʟᴇ ʙᴇʀʜᴀsɪʟ ᴅɪʜᴀᴘᴜs* ✨🌸\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ ꜰɪʟᴇ* 」\n` +
            `┃ 📝 ɴᴀᴍᴀ   : \`${baseName}\`\n` +
            `┃ 📁 ᴘᴀᴛʜ   : \`${relTarget}\`\n` +
            `┃ 🗂️  ᴛɪᴘᴇ   : \`${ext || 'unknown'}\` — \`${mime}\`\n` +
            `┃ 📊 ᴜᴋᴜʀᴀɴ : \`${formatSize(fileSize)}\`\n` +
            `┃ 🕐 ᴡᴀᴋᴛᴜ   : \`${now}\`\n` +
            `┃ 💾 ʙᴀᴄᴋᴜᴘ  : \`${relBackup}\`\n` +
            `┃ 📦 sᴛᴏᴄᴋ   : \`${backupCount}/${BACKUP_MAX} backup tersimpan\`\n` +
            `╰┈┈⬡\n\n` +
            `> File sudah dihapus, tapi backup-nya aman tersimpan~ 💖✨`

        return m.reply(replyText)

    } catch (error) {
        m.react('❌')
        return m.reply(AI.err(`Gagal saat menghapus file!\n> ${error.message}`))
    }
}

// ── Handler utama ─────────────────────────────────────────────────────────────
async function handler(m, { sock }) {
    const args = m.args || []

    if (!args[0]) {
        return m.reply(
            `🌸✨ *ʜᴀɪ~ ɪɴɪ ᴅᴇʟꜰɪʟᴇ!* ✨🌸\n\n` +
            `┃ \`${m.prefix}delfile <path>\` — Hapus file di path tersebut\n\n` +
            `*📌 Contoh:*\n` +
            `┃ \`${m.prefix}delfile ./plugins/owner/tesbaru.js\`\n` +
            `┃ \`${m.prefix}delfile ./data/lama.json\`\n` +
            `┃ \`${m.prefix}delfile database/catatan.json\`\n\n` +
            `*🛡️ Keamanan:*\n` +
            `┃ ✅ Backup otomatis sebelum file dihapus (max ${BACKUP_MAX} per file)\n` +
            `┃ ✅ Konfirmasi wajib sebelum hapus\n` +
            `┃ ✅ File/folder inti (index.js, package.json, node_modules, dll) diproteksi\n\n` +
            `⚠️ *ᴘᴇʀɪɴɢᴀᴛᴀɴ:*\n` +
            `> Path harus di dalam direktori bot ya~`
        )
    }

    const rawPath    = args[0].replace(/^\.\//, '').replace(/\\/g, '/')
    const targetPath = path.resolve(process.cwd(), rawPath)
    const rootDir    = process.cwd()

    if (!targetPath.startsWith(rootDir)) {
        m.react('❌')
        return m.reply(
            `💔 *Aduh~ Path-nya gak boleh nih!*\n\n` +
            `> Path tidak boleh di luar direktori bot!\n` +
            `> \`${rawPath}\` → ditolak Ai~ 🚫`
        )
    }

    if (targetPath === rootDir) {
        m.react('❌')
        return m.reply(
            `💔 *Waduh, gak bisa itu!*\n\n> Gak bisa hapus root direktori bot ya~ 🚫`
        )
    }

    if (isProtected(rootDir, targetPath)) {
        m.react('❌')
        const relTarget = path.relative(rootDir, targetPath)
        return m.reply(
            `💔 *Aduh~ File/folder ini diproteksi!*\n\n` +
            `> \`${relTarget}\` termasuk file/folder inti bot.\n` +
            `> Ai gak boleh hapus ini demi keamanan~ 🌸`
        )
    }

    if (!fs.existsSync(targetPath)) {
        m.react('❌')
        const relTarget = path.relative(rootDir, targetPath)
        return m.reply(
            `💔 *Aduh~ File-nya gak ketemu nih!*\n\n` +
            `> \`${relTarget}\` tidak ada di server.\n` +
            `> Cek lagi path-nya ya~ 🌸`
        )
    }

    const stat  = fs.statSync(targetPath)
    const isDir = stat.isDirectory()
    const baseName  = path.basename(targetPath)
    const relTarget = path.relative(rootDir, targetPath)
    const mime      = isDir ? '-' : detectMime(baseName)

    pendingConfirm.set(m.sender, { targetPath, isDir })
    setTimeout(() => pendingConfirm.delete(m.sender), 60_000)

    m.react('⚠️')
    return m.reply(
        `⚠️ *ᴋᴏɴꜰɪʀᴍᴀsɪ ʜᴀᴘᴜs ꜰɪʟᴇ!*\n\n` +
        `╭┈┈⬡「 📋 *ɪɴꜰᴏ* 」\n` +
        `┃ 📝 ɴᴀᴍᴀ  : \`${baseName}\`\n` +
        `┃ 📁 ᴘᴀᴛʜ  : \`${relTarget}\`\n` +
        `┃ 🗂️  ᴛɪᴘᴇ  : ${isDir ? '`folder`' : `\`${mime}\``}\n` +
        (isDir ? '' : `┃ 📦 ᴜᴋᴜʀᴀɴ: \`${formatSize(stat.size)}\`\n`) +
        `╰┈┈⬡\n\n` +
        (isDir
            ? `> Ini folder, isinya bakal ikut kehapus semua dan *gak ada backup*!\n`
            : `> File bakal di-backup dulu sebelum dihapus~\n`) +
        `> Yakin mau lanjut?\n\n` +
        `┃ Balas \`yes\` untuk lanjut hapus\n` +
        `┃ Balas \`no\` untuk batal\n` +
        `> ⏱️ Konfirmasi expired dalam *60 detik*`
    )
}

// ── Confirm answer handler ────────────────────────────────────────────────────
async function confirmAnswerHandler(m, sock) {
    if (!m.body) return false
    if (m.isCommand) return false

    const userId = m.sender
    if (!pendingConfirm.has(userId)) return false

    const text    = (m.body || '').trim().toLowerCase()
    const pending = pendingConfirm.get(userId)

    if (text === 'yes' || text === 'y') {
        pendingConfirm.delete(userId)
        m.react('🕕')

        if (!fs.existsSync(pending.targetPath)) {
            m.react('❌')
            return m.reply(
                `💔 *Aduh~ File-nya udah gak ada nih!*\n\n` +
                `> Mungkin sudah dihapus lebih dulu.\n` +
                `> Coba cek ulang ya~ 🌸`
            )
        }

        await executeDelete(m, pending)
        return true
    }

    if (text === 'no' || text === 'n') {
        pendingConfirm.delete(userId)
        m.react('❌')
        await m.reply(
            `❌ *ᴅɪʙᴀᴛᴀʟᴋᴀɴ*\n\n` +
            `> Oke~ File tidak jadi dihapus!\n` +
            `> Ai sayang kamu~ 💖`
        )
        return true
    }

    await m.reply(
        `⏳ *Masih nunggu konfirmasi nih~*\n\n` +
        `> Balas \`yes\` untuk lanjut atau \`no\` untuk batal\n` +
        `> ⏱️ Expired dalam 60 detik~`
    )
    return true
}

module.exports = {
    config: pluginConfig,
    handler,
    confirmAnswerHandler
}