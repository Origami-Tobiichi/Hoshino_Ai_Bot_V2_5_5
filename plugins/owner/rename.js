const fs = require("fs")
const path = require("path")

const pendingConfirm = new Map()

const pluginConfig = {
    name: 'rename',
    alias: ['renamesc', 'gantinama'],
    category: 'owner',
    description: 'Ganti nama/teks tertentu di seluruh SC termasuk nama file',
    usage: '.rename <teks lama>|<teks baru>',
    example: '.rename ourinn|hsnai',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

const skipDirs = ['node_modules', '.git', 'tmp', 'temp', 'uploads', 'backup', 'session', 'sessions', 'auth', 'database']
const textExts = ['.js', '.json', '.env']

// File-file kritis yang gak boleh ke-rename atau ke-modify walau namanya match,
// karena bisa bikin bot mati total kalau ke-corrupt
const criticalFiles = ['package.json', 'package-lock.json', '.env', 'yarn.lock', 'creds.json']

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Dry-run: cuma ngitung & ngumpulin apa aja yang BAKAL kena, tanpa nulis apa-apa
function scanPreview(dir, oldText, regex, selfPath) {
    const result = { filesToEdit: [], filesToRename: [], totalMatches: 0 }

    function walk(d) {
        let files
        try { files = fs.readdirSync(d) } catch { return }

        for (const file of files) {
            if (skipDirs.includes(file)) continue
            if (criticalFiles.includes(file)) continue

            const fullPath = path.join(d, file)
            if (path.resolve(fullPath) === selfPath) continue // jangan sentuh plugin ini sendiri

            let stat
            try { stat = fs.statSync(fullPath) } catch { continue }

            if (stat.isDirectory()) { walk(fullPath); continue }

            const ext = path.extname(file)

            if (textExts.includes(ext)) {
                try {
                    const data = fs.readFileSync(fullPath, 'utf8')
                    const count = (data.match(regex) || []).length
                    if (count > 0) {
                        result.filesToEdit.push({ path: fullPath, count })
                        result.totalMatches += count
                    }
                } catch {}
            }

            if (file.includes(oldText)) {
                result.filesToRename.push(fullPath)
            }
        }
    }

    walk(dir)
    return result
}

// Eksekusi beneran: backup dulu tiap file yang bakal disentuh, baru edit/rename
function executeRename(preview, oldText, newText, regex) {
    let totalFile = 0
    let totalGanti = 0
    let totalFileRenamed = 0

    const backupDir = path.join(process.cwd(), 'backup', 'rename', `${Date.now()}`)
    fs.mkdirSync(backupDir, { recursive: true })

    function backupOf(fullPath) {
        // Simpen backup dengan struktur folder relatif biar gampang di-restore manual
        const rel = path.relative(process.cwd(), fullPath)
        const dest = path.join(backupDir, rel)
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        try { fs.copyFileSync(fullPath, dest) } catch {}
    }

    for (const { path: fullPath, count } of preview.filesToEdit) {
        try {
            backupOf(fullPath)
            let data = fs.readFileSync(fullPath, 'utf8')
            data = data.replace(regex, newText)
            fs.writeFileSync(fullPath, data)
            totalFile++
            totalGanti += count
        } catch {}
    }

    for (const fullPath of preview.filesToRename) {
        try {
            if (!fs.existsSync(fullPath)) continue // mungkin udah ke-rename lewat proses lain
            backupOf(fullPath)
            const dir = path.dirname(fullPath)
            const file = path.basename(fullPath)
            const newFileName = file.replace(regex, newText)
            const newFullPath = path.join(dir, newFileName)
            fs.renameSync(fullPath, newFullPath)
            totalFileRenamed++
        } catch {}
    }

    return { totalFile, totalGanti, totalFileRenamed, backupDir }
}

async function handler(m) {
    const text = (m.text || "").replace(/^\.rename\s*/i, "").trim()

    if (!text.includes("|")) {
        return m.reply(
`✨ *Eehh~ formatnya kurang tepat loh!*

Begini caranya ya~
\`.rename <lama>|<baru>\`

Contohnya gini:
» \`.rename hsnai|ourinn\`
» \`.rename Ourin-AI|Hoshino-Ai\`

Aku tunggu ya~ 💕`)
    }

    const [oldText, newText] = text.split("|").map(s => s.trim())

    if (!oldText || !newText) {
        return m.reply('Muu~ teks lamanya atau yang barunya kosong loh! Isi dulu ya~ 🌸')
    }

    if (oldText === newText) {
        return m.reply('Ehh~ itu sama aja kak, nggak ada yang berubah dong~ 😅✨')
    }

    m.react('🕕')

    const regex = new RegExp(escapeRegex(oldText), 'g')
    const selfPath = path.resolve(__filename)
    const preview = scanPreview(path.join(process.cwd()), oldText, regex, selfPath)

    if (preview.filesToEdit.length === 0 && preview.filesToRename.length === 0) {
        m.react('❌')
        return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Gak nemu \`${oldText}\` di file/nama file manapun~`)
    }

    pendingConfirm.set(m.sender, { oldText, newText, regex })
    setTimeout(() => pendingConfirm.delete(m.sender), 60_000)

    const totalMatches = preview.totalMatches
    const editList = preview.filesToEdit.slice(0, 10).map(f => `┃ • ${path.relative(process.cwd(), f.path)} (${f.count}x)`).join('\n')
    const renameList = preview.filesToRename.slice(0, 10).map(f => `┃ • ${path.relative(process.cwd(), f)}`).join('\n')

    m.react('⚠️')
    return m.reply(
`⚠️ *ᴘʀᴇᴠɪᴇᴡ — ʙᴇʟᴜᴍ ᴅɪᴇᴋsᴇᴋᴜsɪ*

» 📝 Dari : *${oldText}*
» ✏️ Ke   : *${newText}*

╭┈┈⬡「 📄 ɪsɪ ꜰɪʟᴇ (${preview.filesToEdit.length} file, ${totalMatches}x) 」
${editList || '┃ (tidak ada)'}${preview.filesToEdit.length > 10 ? `\n┃ ...dan ${preview.filesToEdit.length - 10} file lainnya` : ''}
╰┈┈⬡

╭┈┈⬡「 📂 ʀᴇɴᴀᴍᴇ ꜰɪʟᴇ (${preview.filesToRename.length}) 」
${renameList || '┃ (tidak ada)'}${preview.filesToRename.length > 10 ? `\n┃ ...dan ${preview.filesToRename.length - 10} file lainnya` : ''}
╰┈┈⬡

╭┈┈⬡「 ❓ ᴋᴏɴꜰɪʀᴍᴀsɪ 」
┃ Backup otomatis dibuat sebelum eksekusi
┃ Balas \`yes\` untuk lanjut
┃ Balas \`no\` untuk batal
╰┈┈⬡

> ⏱️ Expired dalam *60 detik*`
    )
}

async function confirmAnswerHandler(m, sock) {
    if (!m.body) return false
    if (m.isCommand) return false

    const userId = m.sender
    if (!pendingConfirm.has(userId)) return false

    const text = (m.body || '').trim().toLowerCase()
    const pending = pendingConfirm.get(userId)

    if (text === 'yes' || text === 'y') {
        pendingConfirm.delete(userId)
        m.react('🕕')

        const selfPath = path.resolve(__filename)
        const preview = scanPreview(path.join(process.cwd()), pending.oldText, pending.regex, selfPath)
        const result = executeRename(preview, pending.oldText, pending.newText, pending.regex)

        m.react('✅')
        return m.reply(
`🌟 *Yatta~! Semuanya sudah aku ganti!*

Aku bekerja keras loh buat kamu~ 💕

» 📝 Dari  : *${pending.oldText}*
» ✏️ Ke    : *${pending.newText}*

» 📁 File isinya diubah  : *${result.totalFile} file*
» 📂 File yang direname  : *${result.totalFileRenamed} file*
» 🔄 Total perubahan     : *${result.totalGanti} tempat*
» 💾 Backup              : \`${path.relative(process.cwd(), result.backupDir)}\`

Jangan lupa restart botnya ya~
Kalau nggak di-restart, perubahannya belum kelihatan loh! ✨`
        )
    }

    if (text === 'no' || text === 'n') {
        pendingConfirm.delete(userId)
        m.react('❌')
        await m.reply(`❌ *ᴅɪʙᴀᴛᴀʟᴋᴀɴ*\n\n> Oke~ gak jadi diganti, aman kok~ 💕`)
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