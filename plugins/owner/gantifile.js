const fs   = require('fs')
const path = require('path')
const vm   = require('vm')

const pendingConfirm = new Map()

const SIZE_LIMIT = 5 * 1024 * 1024  // 5MB
const BACKUP_MAX = 5

const pluginConfig = {
    name: 'gantifile',
    alias: ['replacefile', 'updatefile'],
    category: 'owner',
    description: 'Ganti file apapun di server via path',
    usage: '.gantifile <path>',
    example: '.gantifile ./data/contoh.json',
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

// ── Danger patterns (khusus file teks/code) ───────────────────────────────────
const dangerPatterns = [
    { pattern: /\beval\s*\(/,                       label: 'eval()' },
    { pattern: /\bchild_process\b/,                 label: 'child_process' },
    { pattern: /\bexec\s*\(/,                       label: 'exec()' },
    { pattern: /\bexecSync\s*\(/,                   label: 'execSync()' },
    { pattern: /\bspawn\s*\(/,                      label: 'spawn()' },
    { pattern: /\bspawnSync\s*\(/,                  label: 'spawnSync()' },
    { pattern: /\bprocess\.exit\s*\(/,              label: 'process.exit()' },
    { pattern: /\bprocess\.env\b/,                  label: 'process.env' },
    { pattern: /fs\s*\.\s*(unlink|rmdir|rm)\s*\(/,  label: 'fs.unlink/rmdir/rm()' },
    { pattern: /require\s*\(\s*['"`]child_process/, label: "require('child_process')" },
    { pattern: /rm\s+-rf/,                          label: 'rm -rf' },
    { pattern: /\bdropDatabase\b|\bdropCollection\b/,label: 'drop database/collection' },
    { pattern: /\bformatC\b/,                       label: 'format disk' },
    { pattern: /\b__dirname\s*\+.*\.\.[\\/]/,       label: 'path traversal' },
]

// ── Tipe teks/code yang perlu di-scan ─────────────────────────────────────────
const textExtensions = new Set([
    '.js', '.ts', '.json', '.txt', '.html', '.css',
    '.md', '.env', '.sh', '.py', '.php', '.rb', '.yml', '.yaml'
])

function isTextFile(filename) {
    const ext = path.extname(filename).toLowerCase()
    return textExtensions.has(ext)
}

function isBinaryContent(buffer) {
    const sample = buffer.slice(0, 512)
    for (const byte of sample) {
        if (byte === 0x00) return true
    }
    return false
}

// ── Scan danger ───────────────────────────────────────────────────────────────
function scanDangers(content) {
    const text = typeof content === 'string' ? content : content.toString('utf-8')
    return dangerPatterns.filter(d => d.pattern.test(text)).map(d => d.label)
}

// ── Backup pruning ────────────────────────────────────────────────────────────
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

function countBackups(baseName) {
    const backupDir = path.join(process.cwd(), 'backup', 'files')
    if (!fs.existsSync(backupDir)) return 0
    return fs.readdirSync(backupDir).filter(f => f.startsWith(baseName + '_')).length
}

// ── Syntax check via vm.Script ────────────────────────────────────────────────
function validateJS(code) {
    try {
        new vm.Script(code)
        return { valid: true }
    } catch (e) {
        return { valid: false, error: e.message }
    }
}

// ── JSON check ────────────────────────────────────────────────────────────────
function validateJSON(content) {
    try {
        JSON.parse(content)
        return { valid: true }
    } catch (e) {
        return { valid: false, error: e.message }
    }
}

// ── Mime detect ───────────────────────────────────────────────────────────────
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

// ── Format size ───────────────────────────────────────────────────────────────
function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

// ── Core replace ──────────────────────────────────────────────────────────────
async function executeReplace(m, { targetPath, newContent }) {
    const rootDir   = process.cwd()
    const baseName  = path.basename(targetPath)
    const relTarget = path.relative(rootDir, targetPath)
    const isNewFile = !fs.existsSync(targetPath)
    const mime      = detectMime(baseName)
    const ext       = path.extname(baseName).toLowerCase()
    const now       = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })

    let backupPath    = null
    let oldSize       = 0
    let backupCount   = 0

    try {
        const targetDir = path.dirname(targetPath)
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })

        if (!isNewFile) {
            oldSize = fs.statSync(targetPath).size

            const backupDir = path.join(rootDir, 'backup', 'files')
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
            backupPath = path.join(backupDir, `${baseName}_${timestamp}`)
            fs.copyFileSync(targetPath, backupPath)

            backupCount = pruneBackups(baseName)
        }

        fs.writeFileSync(targetPath, newContent)
        m.react('✅')

        const sizeDiff   = isNewFile ? '' : (() => {
            const diff = newContent.length - oldSize
            return diff > 0 ? `+${formatSize(diff)}` : `-${formatSize(Math.abs(diff))}`
        })()

        let replyText =
            `🌸✨ *ꜰɪʟᴇ ${isNewFile ? 'ʙᴇʀʜᴀsɪʟ ᴅɪᴛᴀᴍʙᴀʜ' : 'ʙᴇʀʜᴀsɪʟ ᴅɪɢᴀɴᴛɪ'}* ✨🌸\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ ꜰɪʟᴇ* 」\n` +
            `┃ 📝 ɴᴀᴍᴀ   : \`${baseName}\`\n` +
            `┃ 📁 ᴘᴀᴛʜ   : \`${relTarget}\`\n` +
            `┃ 🗂️  ᴛɪᴘᴇ   : \`${ext || 'unknown'}\` — \`${mime}\`\n` +
            `┃ 📊 ᴜᴋᴜʀᴀɴ : \`${formatSize(newContent.length)}\``

        if (!isNewFile) {
            replyText += ` (sebelum: \`${formatSize(oldSize)}\`, selisih: \`${sizeDiff}\`)`
        }

        replyText += `\n┃ 🕐 ᴡᴀᴋᴛᴜ   : \`${now}\`\n`

        if (!isNewFile && backupPath) {
            const relBackup = path.relative(rootDir, backupPath)
            replyText +=
                `┃ 💾 ʙᴀᴄᴋᴜᴘ  : \`${relBackup}\`\n` +
                `┃ 📦 sᴛᴏᴄᴋ   : \`${backupCount}/${BACKUP_MAX} backup tersimpan\`\n`
        }

        replyText += `╰┈┈⬡\n\n`
        replyText += isNewFile
            ? `> Yeay~ File baru berhasil ditambahkan sama Ai! 💖✨`
            : `> Yeay~ File lama sudah diganti sama Ai! Backup aman tersimpan~ 💖✨`

        return m.reply(replyText)

    } catch (error) {
        m.react('❌')
        return m.reply(AI.err(`Gagal saat menulis file!\n> ${error.message}`))
    }
}

// ── Handler utama ─────────────────────────────────────────────────────────────
async function handler(m, { sock }) {
    const quoted = m.quoted
    const args   = m.args || []

    if (!quoted || !args[0]) {
        return m.reply(
            `🌸✨ *ʜᴀɪ~ ɪɴɪ ɢᴀɴᴛɪꜰɪʟᴇ!* ✨🌸\n\n` +
            `> Reply file/gambar/dokumen/teks dengan caption:\n\n` +
            `┃ \`${m.prefix}gantifile <path>\` — Ganti file di path tersebut\n\n` +
            `*📌 Contoh:*\n` +
            `┃ \`${m.prefix}gantifile ./data/contoh.json\`\n` +
            `┃ \`${m.prefix}gantifile ./config.js\`\n` +
            `┃ \`${m.prefix}gantifile ./plugins/owner/ping.js\`\n` +
            `┃ \`${m.prefix}gantifile database/main.json\`\n\n` +
            `*🛡️ Keamanan:*\n` +
            `┃ ✅ Syntax check otomatis untuk \`.js\`\n` +
            `┃ ✅ Validasi format untuk \`.json\`\n` +
            `┃ ✅ Scan kode berbahaya untuk file teks/code\n` +
            `┃ ✅ Konfirmasi untuk file > 5MB\n` +
            `┃ ✅ Backup otomatis sebelum diganti (max ${BACKUP_MAX} per file)\n\n` +
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

    const hasMedia = quoted.isMedia
    const hasText  = !hasMedia && (quoted.text || quoted.body)

    if (!hasMedia && !hasText) {
        m.react('❌')
        return m.reply(
            `💔 *Aduh~ Gak ada konten nih!*\n\n` +
            `> Tidak ada konten yang bisa digunakan.\n` +
            `> Reply file, gambar, video, atau pesan teks ya~ 🌸`
        )
    }

    m.react('🕕')

    // ── Download konten ───────────────────────────────────────────────────────
    let newContent
    if (hasMedia) {
        try {
            newContent = await quoted.download()
        } catch (e) {
            m.react('❌')
            return m.reply(AI.err(`Gagal download file-nya nih~\n> ${e.message}`))
        }
    } else {
        newContent = Buffer.from(quoted.text || quoted.body, 'utf-8')
    }

    if (!newContent || newContent.length === 0) {
        m.react('❌')
        return m.reply(
            `💔 *Konten kosong nih~*\n\n` +
            `> File yang dikirim tidak ada isinya.\n` +
            `> Coba kirim ulang ya~ 🌸`
        )
    }

    // ── Size limit ────────────────────────────────────────────────────────────
    if (newContent.length > SIZE_LIMIT) {
        const sizeMB    = (newContent.length / 1024 / 1024).toFixed(2)
        const baseName  = path.basename(targetPath)
        const relTarget = path.relative(rootDir, targetPath)
        const mime      = detectMime(baseName)

        pendingConfirm.set(m.sender, { targetPath, newContent, type: 'size' })
        setTimeout(() => pendingConfirm.delete(m.sender), 60_000)

        m.react('⚠️')
        return m.reply(
            `⚠️ *ᴜᴋᴜʀᴀɴ ꜰɪʟᴇ ᴍᴇʟᴇʙɪʜɪ ʙᴀᴛᴀs!*\n\n` +
            `╭┈┈⬡「 📊 *ɪɴꜰᴏ ꜰɪʟᴇ* 」\n` +
            `┃ 📝 ɴᴀᴍᴀ  : \`${baseName}\`\n` +
            `┃ 📁 ᴘᴀᴛʜ  : \`${relTarget}\`\n` +
            `┃ 🗂️  ᴛɪᴘᴇ  : \`${mime}\`\n` +
            `┃ 📦 ᴜᴋᴜʀᴀɴ: \`${sizeMB} MB\` (batas: 5 MB)\n` +
            `╰┈┈⬡\n\n` +
            `> File ini melebihi batas aman 5MB nih~\n` +
            `> Tetap mau lanjut ganti file ini?\n\n` +
            `┃ Balas \`yes\` untuk tetap lanjut\n` +
            `┃ Balas \`no\` untuk batal\n` +
            `> ⏱️ Konfirmasi expired dalam *60 detik*`
        )
    }

    const baseName = path.basename(targetPath)
    const ext      = path.extname(baseName).toLowerCase()

    // ── Scan danger (hanya file teks/code, skip binary) ───────────────────────
    if (isTextFile(baseName) && !isBinaryContent(newContent)) {
        const dangers = scanDangers(newContent)

        if (dangers.length > 0) {
            pendingConfirm.set(m.sender, { targetPath, newContent, type: 'danger' })
            setTimeout(() => pendingConfirm.delete(m.sender), 60_000)

            m.react('⚠️')
            return m.reply(
                `⚠️ *ᴡᴀʜ~ Aɪ ɴᴇᴍᴜ ᴋᴏᴅᴇ ʙᴇʀʙᴀʜᴀʏᴀ ɴɪʜ!*\n\n` +
                `╭┈┈⬡「 🔍 *sᴄᴀɴ ʀᴇsᴜʟᴛ* 」\n` +
                `┃ 📝 File     : \`${baseName}\`\n` +
                `┃ ⚡ Terdeteksi: ${dangers.map(d => `\`${d}\``).join(', ')}\n` +
                `╰┈┈⬡\n\n` +
                `> Pola berbahaya ditemukan di dalam file ini!\n` +
                `> Tetap mau lanjut pasang file ini?\n\n` +
                `┃ Balas \`yes\` untuk tetap lanjut\n` +
                `┃ Balas \`no\` untuk batal\n` +
                `> ⏱️ Konfirmasi expired dalam *60 detik*`
            )
        }
    }

    // ── Validasi syntax .js ───────────────────────────────────────────────────
    if (ext === '.js') {
        const check = validateJS(newContent.toString('utf-8'))
        if (!check.valid) {
            m.react('❌')
            return m.reply(
                `💔 *sʏɴᴛᴀx ᴇʀʀᴏʀ — ꜰɪʟᴇ ᴅɪᴛᴏʟᴀᴋ Aɪ!*\n\n` +
                `╭┈┈⬡「 🔍 *ᴅᴇᴛᴀɪʟ ᴇʀʀᴏʀ* 」\n` +
                `┃ 📝 File: \`${baseName}\`\n` +
                `╰┈┈⬡\n\n` +
                `\`\`\`${check.error}\`\`\`\n\n` +
                `> Fix dulu syntax-nya terus kirim lagi ya~\n` +
                `> Ai gak mau file rusak masuk ke server! 💖`
            )
        }
    }

    // ── Validasi JSON ─────────────────────────────────────────────────────────
    if (ext === '.json') {
        const check = validateJSON(newContent.toString('utf-8'))
        if (!check.valid) {
            m.react('❌')
            return m.reply(
                `💔 *ᴊsᴏɴ ɪɴᴠᴀʟɪᴅ — ꜰɪʟᴇ ᴅɪᴛᴏʟᴀᴋ Aɪ!*\n\n` +
                `╭┈┈⬡「 🔍 *ᴅᴇᴛᴀɪʟ ᴇʀʀᴏʀ* 」\n` +
                `┃ 📝 File: \`${baseName}\`\n` +
                `╰┈┈⬡\n\n` +
                `\`\`\`${check.error}\`\`\`\n\n` +
                `> Cek format JSON-nya dulu ya~\n` +
                `> Pastiin gak ada koma berlebih atau bracket yang kurang! 💖`
            )
        }
    }

    return executeReplace(m, { targetPath, newContent })
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

        const { targetPath, newContent } = pending
        const baseName = path.basename(targetPath)
        const ext      = path.extname(baseName).toLowerCase()

        if (ext === '.js') {
            const check = validateJS(newContent.toString('utf-8'))
            if (!check.valid) {
                m.react('❌')
                return m.reply(
                    `💔 *sʏɴᴛᴀx ᴇʀʀᴏʀ — ꜰɪʟᴇ ᴅɪᴛᴏʟᴀᴋ Aɪ!*\n\n` +
                    `\`\`\`${check.error}\`\`\`\n\n` +
                    `> Fix dulu syntax-nya terus kirim lagi ya~ 💖`
                )
            }
        }

        if (ext === '.json') {
            const check = validateJSON(newContent.toString('utf-8'))
            if (!check.valid) {
                m.react('❌')
                return m.reply(
                    `💔 *ᴊsᴏɴ ɪɴᴠᴀʟɪᴅ — ꜰɪʟᴇ ᴅɪᴛᴏʟᴀᴋ Aɪ!*\n\n` +
                    `\`\`\`${check.error}\`\`\`\n\n` +
                    `> Cek format JSON-nya dulu ya~ 💖`
                )
            }
        }

        await executeReplace(m, pending)
        return true
    }

    if (text === 'no' || text === 'n') {
        pendingConfirm.delete(userId)
        m.react('❌')
        await m.reply(
            `❌ *ᴅɪʙᴀᴛᴀʟᴋᴀɴ*\n\n` +
            `> Oke~ File tidak jadi diganti!\n` +
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