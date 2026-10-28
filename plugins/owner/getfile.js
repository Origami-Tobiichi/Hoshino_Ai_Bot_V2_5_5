const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const os = require('os')

const pluginConfig = {
    name: 'getfile',
    alias: ['sendfile', 'ambilfile'],
    category: 'owner',
    description: 'Kirim file atau folder (zip) berdasarkan path',
    usage: '.getfile <path> [-now]',
    example: '.getfile ./plugins/owner/controlgrup.js -now\n.getfile ./plugins/ai',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

// ── Tier 1: HARD BLOCK, tidak ada verifikasi apapun ──
// (kalau bocor = akun/sesi bisa diambil alih, gak bisa di-rotate kayak API key)
const HARD_BLOCKED = ['auth_info', 'session', 'creds.json']

// ── Tier 2: butuh verifikasi 2 langkah dulu ──
// (isinya API key/kredensial yang masih bisa di-rotate kalau bocor)
const VERIFY_REQUIRED = ['config.js', 'config.json', '.env', 'database.json', 'db.json']

const CODE_TTL_MS = 60 * 1000
const MAX_ATTEMPTS = 3

// pending[senderId] = { targetPath, argPath, code, expiresAt, attempts }
const pending = {}

function isHardBlocked(targetPath) {
    const normalized = targetPath.replace(/\\/g, '/')
    return HARD_BLOCKED.some(b => normalized.includes(b))
}

function needsVerification(targetPath) {
    const normalized = targetPath.replace(/\\/g, '/')
    return VERIFY_REQUIRED.some(b => normalized.includes(b))
}

function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000))
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function getTotalFolderSize(dirPath) {
    let total = 0
    try {
        for (const item of fs.readdirSync(dirPath)) {
            const full = path.join(dirPath, item)
            const stat = fs.statSync(full)
            if (stat.isDirectory()) total += getTotalFolderSize(full)
            else total += stat.size
        }
    } catch {}
    return total
}

function countFiles(dir) {
    let count = 0
    try {
        for (const item of fs.readdirSync(dir)) {
            const full = path.join(dir, item)
            if (fs.statSync(full).isDirectory()) count += countFiles(full)
            else count++
        }
    } catch {}
    return count
}

/**
 * Eksekusi pengiriman file/folder yang sesungguhnya.
 * Dipanggil langsung (path aman) atau setelah verifikasi berhasil (path sensitif).
 */
async function deliverPath(sock, targetPath, argPath, targetJid) {
    const stat = fs.statSync(targetPath)
    const isDir = stat.isDirectory()

    await sock.sendMessage(targetJid, { text: `⭐ _Sebentar ya~ biar aku ambilkan dulu~_ 💕` })

    // ── FILE TUNGGAL ──
    if (!isDir) {
        const fileSize = stat.size
        const MAX_SIZE = 50 * 1024 * 1024

        if (fileSize > MAX_SIZE) {
            return sock.sendMessage(targetJid, { text:
`Waah~ filenya kegedean nih~ 😥

╭┈┈⬡「 ⚠️ *ᴛᴏᴏ ʟᴀʀɢᴇ* 」
┃ 💾 Size  : ${formatSize(fileSize)}
┃ 📏 Maks  : 50 MB
╰┈┈┈┈┈┈┈┈┈┈⬡

> Maaf ya~ WhatsApp ada batasnya~ 🌸` })
        }

        const fileName = path.basename(targetPath)
        const fileBuffer = fs.readFileSync(targetPath)

        return sock.sendMessage(targetJid, {
            document: fileBuffer,
            fileName: fileName,
            mimetype: 'application/octet-stream',
            caption:
`📄 *${fileName}*

╭┈┈⬡「 📋 *ɪɴꜰᴏ ꜰɪʟᴇ* 」
┃ 📁 Path : ${argPath}
┃ 💾 Size : ${formatSize(fileSize)}
╰┈┈┈┈┈┈┈┈┈┈⬡

★ _Ini dia filenya~ semoga bermanfaat ya~_ ✨💕`
        })
    }

    // ── FOLDER → ZIP ──
    const folderName = path.basename(targetPath)
    const folderSize = getTotalFolderSize(targetPath)
    const MAX_FOLDER = 50 * 1024 * 1024

    if (folderSize > MAX_FOLDER) {
        return sock.sendMessage(targetJid, { text:
`Waah~ foldernya kegedean nih~ 😥

╭┈┈⬡「 ⚠️ *ᴛᴏᴏ ʟᴀʀɢᴇ* 」
┃ 💾 Size  : ${formatSize(folderSize)}
┃ 📏 Maks  : 50 MB
╰┈┈┈┈┈┈┈┈┈┈⬡

> Coba kirim subfolder atau file spesifiknya aja ya~ 🌸` })
    }

    const tmpDir = path.join(os.tmpdir(), `getfile_${Date.now()}`)
    const zipPath = path.join(tmpDir, `${folderName}.zip`)

    try {
        fs.mkdirSync(tmpDir, { recursive: true })
        const total = countFiles(targetPath)

        try {
            execSync(`cd "${path.dirname(targetPath)}" && zip -r "${zipPath}" "${folderName}"`, {
                timeout: 30000,
                stdio: 'pipe'
            })
        } catch {
            try {
                const archiver = require('archiver')
                const output = fs.createWriteStream(zipPath)
                const archive = archiver('zip', { zlib: { level: 6 } })
                await new Promise((resolve, reject) => {
                    output.on('close', resolve)
                    archive.on('error', reject)
                    archive.pipe(output)
                    archive.directory(targetPath, folderName)
                    archive.finalize()
                })
            } catch {
                const AdmZip = require('adm-zip')
                const zip = new AdmZip()
                zip.addLocalFolder(targetPath, folderName)
                zip.writeZip(zipPath)
            }
        }

        if (!fs.existsSync(zipPath)) {
            return sock.sendMessage(targetJid, { text:
`Aduh~ gagal bikin zip-nya nih~ 😢

> Coba lagi ya~ atau kirim file satuan aja~
★ _Maaf ya, aku udah usaha~ 🙏💕_` })
        }

        const zipSize = fs.statSync(zipPath).size
        const zipBuffer = fs.readFileSync(zipPath)

        return sock.sendMessage(targetJid, {
            document: zipBuffer,
            fileName: `${folderName}.zip`,
            mimetype: 'application/zip',
            caption:
`📦 *${folderName}.zip*

╭┈┈⬡「 📋 *ɪɴꜰᴏ ꜰᴏʟᴅᴇʀ* 」
┃ 📁 Path  : ${argPath}
┃ 🗂️  Files : ${total} file
┃ 💾 Size  : ${formatSize(zipSize)}
╰┈┈┈┈┈┈┈┈┈┈⬡

★ _Foldernya udah aku zip rapiin~_ ✨💕`
        })

    } finally {
        try {
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath)
            if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir, { recursive: true })
        } catch {}
    }
}

async function handler(m, { sock }) {
    const rawArgs = m.args || []
    const sendNow = rawArgs.some(a => a.toLowerCase() === '-now')
    const args = rawArgs.filter(a => a.toLowerCase() !== '-now')
    const isGroup = m.chat.endsWith('@g.us')
    const pmJid = m.sender                                        // selalu PM, buat file sensitif
    const targetJid = (isGroup && sendNow) ? m.chat : m.sender    // file biasa

    if (!args[0]) return m.reply(
`🌟 *ɢᴇᴛ ꜰɪʟᴇ*

Nee nee~! Mau ambil file yang mana?
Kasih tau aku pathnya dong~ 💕

╭┈┈⬡「 📌 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」
┃ 📄 File   : \`${m.prefix}getfile ./plugins/owner/addplugin.js\`
┃ 📁 Folder : \`${m.prefix}getfile ./plugins/ai\`
╰┈┈┈┈┈┈┈┈┈┈⬡

> ⭐ Tambahin akhiran -now jika ingin dikirim langsung nee~
> ✨ Folder akan dikirim dalam bentuk *.zip* ya~
> 📍 Path dihitung dari root folder bot`)

    const targetPath = path.resolve(process.cwd(), args[0])
    const rootDir = process.cwd()

    if (!targetPath.startsWith(rootDir)) {
        return m.reply(
`Muu~! Aku nggak bisa akses path di luar folder bot~ 🙅‍♀️💦

> Pastikan pathnya masih di dalam folder bot ya~
> Contoh: \`./plugins/owner/namafile.js\`

★ _Aku sayang kamu, makanya aku jaga keamanannya~ 🌸_`)
    }

    if (isHardBlocked(targetPath)) {
        return m.reply(
`Eeh~?! File itu nggak bisa aku kirim~ 🔒

╭┈┈⬡「 ⚠️ *ᴅɪᴛᴏʟᴀᴋ* 」
┃ File mengandung data sesi/kredensial~
┃ Ini gak ada jalan verifikasinya,
┃ demi keamanan akun bot~ 💦
╰┈┈┈┈┈┈┈┈┈┈⬡

★ _Maafin aku ya~ ini demi kebaikan kita bersama~ 🌸_`)
    }

    if (!fs.existsSync(targetPath)) {
        return m.reply(
`Aduh~ aku udah cari tapi nggak ketemu nih~ 🔍💧

╭┈┈⬡「 ❌ *ɴᴏᴛ ꜰᴏᴜɴᴅ* 」
┃ 📍 Path: \`${args[0]}\`
╰┈┈┈┈┈┈┈┈┈┈⬡

> Cek lagi penulisannya ya~ mungkin ada typo~
> Atau foldernya memang belum ada~ ✨`)
    }

    if (needsVerification(targetPath)) {
        const code = generateCode()
        pending[m.sender] = {
    targetPath,
    argPath: args[0],
    code,
    expiresAt: Date.now() + CODE_TTL_MS,
    attempts: 0,
    targetJid
}

        setTimeout(() => {
            if (pending[m.sender]?.code === code) delete pending[m.sender]
        }, CODE_TTL_MS)

        if (isGroup && !sendNow) {
    await m.reply(`🔐 File ini sensitif~ kode verifikasinya Ai kirim ke PM kamu ya~ 💕`)
}

return sock.sendMessage(targetJid, { text:
`🔐 *ᴠᴇʀɪꜰɪᴋᴀꜱɪ ᴅɪᴘᴇʀʟᴜᴋᴀɴ*

Waaa~ file ini isinya privasi banget lho~ 🥺
Aku butuh konfirmasi dulu sebelum kirim ya~

╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」
┃ 📁 Path : ${args[0]}
╰┈┈┈┈┈┈┈┈┈┈⬡

Balas pesan ini dengan kode berikut dalam *60 detik*:

*${code}*

> Ketik \`batal\` kalau berubah pikiran~ 💕` })
    }

    if (isGroup && !sendNow) {
        await m.reply(`📁 Oke~ filenya Ai kirim ke PM kamu ya~ ✨\n\n_Mau langsung di grup? Pake \`-now\` abis path~_`)
    }
    return deliverPath(sock, targetPath, args[0], targetJid)
}

async function confirmAnswerHandler(m, sock) {
    const entry = pending[m.sender]
    if (!entry) return false

    if (!m.isOwner) {
        return false
    }

    if (m.chat !== entry.targetJid) return false

    const text = (m.body || '').trim()

    if (Date.now() > entry.expiresAt) {
        delete pending[m.sender]
        await sock.sendMessage(entry.targetJid, { text: '⏰ Waktu verifikasi habis~ ulangi lagi command `.getfile <path>` nya ya~ 🌸' })
        return true
    }

    if (text.toLowerCase() === 'batal') {
        delete pending[m.sender]
        await sock.sendMessage(entry.targetJid, { text: '✅ Oke, dibatalin ya~ 💕' })
        return true
    }

    if (text !== entry.code) {
        entry.attempts += 1
        if (entry.attempts >= MAX_ATTEMPTS) {
            delete pending[m.sender]
            await sock.sendMessage(entry.targetJid, { text: '❌ Kode salah terus nih~ verifikasi dibatalin demi keamanan. Ulangi lagi dari awal ya~ 🔒' })
            return true
        }
        await sock.sendMessage(entry.targetJid, { text: `❌ Kode salah~ coba lagi (sisa percobaan: ${MAX_ATTEMPTS - entry.attempts}) 💦` })
        return true
    }

    delete pending[m.sender]
    await deliverPath(sock, entry.targetPath, entry.argPath, entry.targetJid)
    return true
}

module.exports = { config: pluginConfig, handler, confirmAnswerHandler }