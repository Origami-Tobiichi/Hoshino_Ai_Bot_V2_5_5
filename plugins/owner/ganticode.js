const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { hotReloadPlugin } = require('../../src/lib/plugins')

const pendingConfirm = new Map()

const pluginConfig = {
    name: 'ganticode',
    alias: ['replaceplugin', 'updateplugin', 'gantiplugin', 'gc'],
    category: 'owner',
    description: 'Ganti code plugin yang sudah ada',
    usage: '.ganticode [namafile] [folder]',
    example: '.ganticode ping main',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

const AI = {
    ok:      (msg) => `✨ *${msg}*\n\n> Ai seneng bisa bantu kamu~ 💖`,
    err:     (msg) => `💔 *Aduh~ Ada yang salah nih!*\n\n> ${msg}\n\n> Jangan nyerah ya, Ai tetap di sini buat bantu kamu! ✨`,
    warn:    (msg) => `🌸 *Hmm~ Perhatiin dulu ya!*\n\n> ${msg}`,
    loading: ()    => `⏳ *Sabar ya~*\n\n> Ai lagi proses buat kamu! 💫`,
}

function extractPluginInfo(code) {
    const info = { name: null, category: null, commands: [] }

    const nameStr = code.match(/name:\s*['"`]([^'"`]+)['"`]/)
    if (nameStr) {
        info.name = nameStr[1]
        info.commands = [nameStr[1]]
    }

    const nameArr = code.match(/name:\s*\[([^\]]+)\]/)
    if (nameArr) {
        const items = nameArr[1].match(/['"`]([^'"`]+)['"`]/g)
        if (items && items.length > 0) {
            info.commands = items.map(s => s.replace(/['"`]/g, ''))
            info.name = info.commands[0]
        }
    }

    const aliasArr = code.match(/alias:\s*\[([^\]]*)\]/)
    if (aliasArr) {
        const items = aliasArr[1].match(/['"`]([^'"`]+)['"`]/g)
        if (items) {
            info.commands.push(...items.map(s => s.replace(/['"`]/g, '')))
        }
    }

    const categoryMatch = code.match(/category:\s*['"`]([^'"`]+)['"`]/i)
    if (categoryMatch) info.category = categoryMatch[1]

    return info
}

function validateSyntax(code) {
    try {
        new vm.Script(code)
        return { valid: true }
    } catch (e) {
        return { valid: false, error: e.message }
    }
}

function findPluginFile(pluginsDir, name) {
    const folders = fs.readdirSync(pluginsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)

    for (const folder of folders) {
        const folderPath = path.join(pluginsDir, folder)
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'))

        for (const file of files) {
            const baseName = file.replace('.js', '')
            if (baseName.toLowerCase() === name.toLowerCase()) {
                return { folder, file, path: path.join(folderPath, file) }
            }
        }
    }

    return null
}

function listBackups(pluginName) {
    const backupDir = path.join(process.cwd(), 'backup', 'plugins')
    if (!fs.existsSync(backupDir)) return []

    return fs.readdirSync(backupDir)
        .filter(f => f.startsWith(pluginName + '_') && f.endsWith('.js'))
        .sort()
        .reverse()
}

function restoreBackup(pluginsDir, pluginName, backupFile) {
    const backupPath = path.join(process.cwd(), 'backup', 'plugins', backupFile)
    if (!fs.existsSync(backupPath)) throw new Error(`Backup tidak ditemukan: ${backupFile}`)

    const existing = findPluginFile(pluginsDir, pluginName)
    if (!existing) throw new Error(`Plugin \`${pluginName}\` tidak ditemukan di plugins folder`)

    fs.copyFileSync(backupPath, existing.path)
    return existing.path
}

function buildCommandMap(pluginsDir) {
    const map = {}

    const folders = fs.readdirSync(pluginsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)

    for (const folder of folders) {
        const folderPath = path.join(pluginsDir, folder)
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'))

        for (const file of files) {
            try {
                const code = fs.readFileSync(path.join(folderPath, file), 'utf-8')
                const info = extractPluginInfo(code)
                for (const cmd of info.commands) {
                    map[cmd.toLowerCase()] = { file, folder }
                }
            } catch {}
        }
    }

    return map
}

function checkConflicts(newCommands, commandMap, skipFile = null) {
    const conflicts = []

    for (const cmd of newCommands) {
        const existing = commandMap[cmd.toLowerCase()]
        if (existing && existing.file !== skipFile) {
            conflicts.push({ cmd, file: existing.file, folder: existing.folder })
        }
    }

    return conflicts
}

async function executeReplace(m, { code, fileName, folderName, extracted }) {
    const pluginsDir = path.join(process.cwd(), 'plugins')

    try {
        // ── Conflict check — selalu jalan, termasuk dari jalur yes/no ────────
        const commandMap = buildCommandMap(pluginsDir)
        const skipFile   = `${fileName}.js`
        const conflicts  = checkConflicts(extracted.commands, commandMap, skipFile)

        if (conflicts.length > 0) {
            const lines = conflicts.map(c =>
                `> ⚡ \`${c.cmd}\` → sudah dipakai oleh \`${c.file}\` (${c.folder})`
            ).join('\n')
            m.react('❌')
            return m.reply(
                `💔 *Aduh~ Ada command yang bentrok nih!*\n\n` +
                `${lines}\n\n` +
                `> Command di atas sudah dipakai plugin lain, jadi gak bisa dipasang bareng ya~ ✨\n` +
                `> Ganti dulu nama command/alias-nya, terus upload ulang. Ai gak mau sampe ada plugin yang ketubruk! 🌸`
            )
        }

        const existing = findPluginFile(pluginsDir, fileName)

        let filePath, targetFolder, isNewFile = false
        let backupPath = null, oldSize = 0, oldInfo = null

        if (existing) {
            filePath     = existing.path
            targetFolder = existing.folder
            oldSize      = fs.statSync(filePath).size

            const oldCode = fs.readFileSync(filePath, 'utf-8')
            oldInfo = extractPluginInfo(oldCode)

            const backupDir = path.join(process.cwd(), 'backup', 'plugins')
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
            backupPath = path.join(backupDir, `${fileName}_${timestamp}.js`)
            fs.copyFileSync(filePath, backupPath)

        } else {
            if (!folderName) folderName = 'other'
            folderName   = folderName.toLowerCase().replace(/[^a-z0-9-]/g, '')
            targetFolder = folderName

            const folderPath = path.join(pluginsDir, targetFolder)
            if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true })

            filePath  = path.join(folderPath, `${fileName}.js`)
            isNewFile = true
        }

        let previewText = `🌸✨ *Preview ${isNewFile ? 'Plugin Baru' : 'Perubahan Plugin'}* ✨🌸\n\n`

        previewText +=
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ ᴘʟᴜɢɪɴ* 」\n` +
            `┃ 📝 Nama file: \`${fileName}.js\`\n` +
            `┃ 📁 Folder tujuan: \`${targetFolder}\`\n`

        if (!isNewFile && oldInfo) {
            const oldCmds     = oldInfo.commands.join(', ') || '-'
            const newCmds     = extracted.commands.join(', ') || '-'
            const cmdsChanged = oldCmds !== newCmds

            previewText +=
                `┃ 📦 Ukuran file: \`${oldSize} → ${code.length} bytes\`\n` +
                `┃ ⚡ Command lama: \`${oldCmds}\`\n` +
                `┃ ✨ Command baru: \`${newCmds}\`${cmdsChanged ? ' ⚠️ (berubah!)' : ''}\n`
        } else {
            previewText +=
                `┃ 📊 Ukuran file: \`${code.length} bytes\`\n` +
                `┃ ✨ Command terdaftar: \`${extracted.commands.join(', ') || '-'}\`\n`
        }

        previewText += `┃ ✅ Syntax check: Valid & aman\n`

        fs.writeFileSync(filePath, code)
        const reloadResult = hotReloadPlugin(filePath)

        m.react('✅')

        previewText += `┃ 🔄 Hot reload: ${reloadResult.success ? '✅ Berhasil dimuat ulang' : '⚠️ Tertunda (restart manual mungkin diperlukan)'}\n`

        if (backupPath) {
            const relBackup = path.relative(process.cwd(), backupPath)
            previewText += `┃ 💾 Backup lama: \`${relBackup}\`\n`
        }

        previewText +=
            `╰┈┈⬡\n\n` +
            `> Yeay~ Plugin-nya udah berhasil ${isNewFile ? 'ditambahkan' : 'diganti'} sama Ai! 💖✨\n` +
            `> Plugin langsung aktif dan siap dipakai tanpa restart~\n` +
            `> Kalau ada masalah, kamu bisa restore backup dengan:\n` +
            `> \`${m.prefix}ganticode restore ${fileName}\``

        return m.reply(previewText)

    } catch (error) {
        m.react('❌')
        return m.reply(AI.err(
            `Gagal memproses plugin nih~ 😢\n\n` +
            `> Pesan error: \`${error.message}\`\n\n` +
            `> Coba cek lagi file-nya ya, mungkin ada yang salah~`
        ))
    }
}

async function handler(m, { sock }) {
    const args       = m.args
    const pluginsDir = path.join(process.cwd(), 'plugins')

    // ── .ganticode listbackup ─────────────────────────────────────────────────
    if (args[0] === 'listbackup') {
        const pluginName = args[1]
        if (!pluginName) {
            return m.reply(AI.err(
                `Sebutin nama plugin yang mau dilihat backup-nya ya~\n\n` +
                `> Contoh: \`${m.prefix}ganticode listbackup tiktok\`\n` +
                `> Nanti Ai tampilkan semua versi backup yang tersedia~ 💖`
            ))
        }

        const backups = listBackups(pluginName)
        if (backups.length === 0) {
            return m.reply(AI.warn(
                `Tidak ada backup untuk plugin \`${pluginName}\` nih~\n\n` +
                `> Backup otomatis dibuat setiap kali kamu mengganti plugin.\n` +
                `> Jadi kalau belum pernah ganti, ya belum ada backup-nya~ 🌸`
            ))
        }

        let txt = `🌸 *Daftar Backup untuk Plugin \`${pluginName}\`:*\n\n`
        backups.forEach((b, i) => {
            const stat = fs.statSync(path.join(process.cwd(), 'backup', 'plugins', b))
            txt += `┃ ${i + 1}. \`${b}\`\n┃    ↳ Ukuran: ${stat.size} bytes\n`
        })
        txt +=
            `\n> 💡 Cara restore:\n` +
            `> \`${m.prefix}ganticode restore ${pluginName} <nomor>\`\n` +
            `> Contoh: \`${m.prefix}ganticode restore ${pluginName} 1\` untuk versi terbaru`
        return m.reply(txt)
    }

    // ── .ganticode restore ────────────────────────────────────────────────────
    if (args[0] === 'restore') {
        const pluginName = args[1]
        if (!pluginName) {
            return m.reply(AI.err(
                `Sebutin nama plugin yang mau di-restore ya~\n\n` +
                `> Contoh: \`${m.prefix}ganticode restore tiktok\`\n` +
                `> Atau pilih backup tertentu: \`${m.prefix}ganticode restore tiktok 2\``
            ))
        }

        const backups = listBackups(pluginName)
        if (backups.length === 0) {
            return m.reply(AI.warn(
                `Tidak ada backup untuk plugin \`${pluginName}\` nih~\n\n` +
                `> Cek dulu daftar backup dengan:\n` +
                `> \`${m.prefix}ganticode listbackup ${pluginName}\``
            ))
        }

        const idx = args[2] ? parseInt(args[2]) - 1 : 0
        if (isNaN(idx) || idx < 0 || idx >= backups.length) {
            return m.reply(AI.err(
                `Nomor backup tidak valid~\n\n` +
                `> Total backup tersedia: *${backups.length}*\n` +
                `> Nomor yang bisa dipilih: *1 - ${backups.length}*\n\n` +
                `> Coba lagi dengan nomor yang benar ya~ 💖`
            ))
        }

        m.react('🕕')

        try {
            const backupFile   = backups[idx]
            const filePath     = restoreBackup(pluginsDir, pluginName, backupFile)
            const reloadResult = hotReloadPlugin(filePath)

            m.react('✅')
            return m.reply(
                `✨ *Yeay~ Restore Berhasil!* ✨\n\n` +
                `╭┈┈⬡「 💾 *ʀᴇsᴛᴏʀᴇ ɪɴꜰᴏ* 」\n` +
                `┃ 📝 Plugin: \`${pluginName}.js\`\n` +
                `┃ 📦 Diambil dari: \`${backupFile}\`\n` +
                `┃ 🔄 Hot reload: ${reloadResult.success ? '✅ Sukses dimuat ulang' : '⚠️ Tertunda, coba restart manual'}\n` +
                `╰┈┈⬡\n\n` +
                `> Ai udah berhasil mengembalikan plugin-nya ke versi lama~ 💖\n` +
                `> Semoga versi ini lebih cocok buat kamu ya! ✨`
            )
        } catch (e) {
            m.react('❌')
            return m.reply(AI.err(
                `Gagal restore plugin nih~ 😢\n\n` +
                `> Pesan error: \`${e.message}\`\n\n` +
                `> Pastiin nama plugin dan nomor backup-nya bener ya~`
            ))
        }
    }

    // ── .ganticode (replace/add plugin) ──────────────────────────────────────
    const quoted = m.quoted
    if (!quoted) {
        return m.reply(
            `🌸✨ *ʜᴀɪ~ ɪɴɪ ᴘʟᴜɢɪɴ ɢᴀɴᴛɪᴄᴏᴅᴇ!* ✨🌸\n\n` +
            `> Plugin ini buat **mengganti atau menambah** code plugin langsung dari WhatsApp.\n` +
            `> Caranya gampang banget, tinggal reply file/code-nya~ 💖\n\n` +
            `╭┈┈⬡「 📖 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
            `┃ 🔹 Reply code plugin dengan caption:\n` +
            `┃    \`${m.prefix}ganticode\` — Auto detect nama file\n` +
            `┃    \`${m.prefix}ganticode namafile\` — Custom nama\n` +
            `┃    \`${m.prefix}ganticode namafile folder\` — Custom nama + folder\n` +
            `┃\n` +
            `┃ 🔹 Lihat backup plugin:\n` +
            `┃    \`${m.prefix}ganticode listbackup <nama>\`\n` +
            `┃\n` +
            `┃ 🔹 Restore dari backup:\n` +
            `┃    \`${m.prefix}ganticode restore <nama> [nomor]\`\n` +
            `╰┈┈⬡\n\n` +
            `⚠️ *ᴘᴇʀɪɴɢᴀᴛᴀɴ ᴘᴇɴᴛɪɴɢ:*\n` +
            `> • Code lama akan di-backup otomatis sebelum diganti\n` +
            `> • Plugin dengan command bentrok akan ditolak\n` +
            `> • Kode berbahaya butuh konfirmasi tambahan\n\n` +
            `> Yuk kirim plugin-nya, Ai siap bantu! 💖`
        )
    }

    // ── Download code ─────────────────────────────────────────────────────────
    let code = ''

    if (quoted.isDocument) {
        const docFileName =
            quoted.message?.documentMessage?.fileName ||
            quoted.message?.documentWithCaptionMessage?.message?.documentMessage?.fileName ||
            ''

        if (docFileName && !docFileName.toLowerCase().endsWith('.js')) {
            return m.reply(
                `💔 *File-nya bukan .js nih~*\n\n` +
                `> File yang kamu kirim: \`${docFileName}\`\n` +
                `> Ai cuma bisa terima file dengan ekstensi \`.js\` ya~ 🌸\n\n` +
                `> Rename dulu file-nya, terus kirim ulang ya! 💖`
            )
        }

        try {
            const buf = await quoted.download()
            if (!buf || buf.length === 0) throw new Error('Buffer kosong')
            code = buf.toString('utf-8')
        } catch (e) {
            return m.reply(AI.err(
                `Gagal download file-nya nih~ 😢\n\n` +
                `> Pesan error: \`${e.message}\`\n\n` +
                `> Coba kirim ulang file-nya ya, mungkin koneksi lagi jelek~`
            ))
        }
    } else if (quoted.isImage || quoted.isVideo || quoted.isAudio || quoted.isSticker) {
        return m.reply(AI.err(
            `Yang di-reply harus file \`.js\` ya, bukan media~ 🌸\n\n` +
            `> Kalau kamu reply gambar/video/audio, Ai gak bisa baca code-nya.\n` +
            `> Kirim file code plugin-nya ya! 💖`
        ))
    } else {
        code = quoted.text || quoted.body || ''
    }

    if (!code || code.trim().length < 50) {
        return m.reply(AI.err(
            `Code terlalu pendek atau malah kosong deh~ 🤔\n\n` +
            `> Panjang code yang diterima: *${code.trim().length} karakter*\n` +
            `> Minimal code plugin yang valid: *50 karakter*\n\n` +
            `> Pastiin kamu kirim code plugin yang lengkap ya, bukan potongan~ 💖`
        ))
    }

    if (code.includes('\x00') || /[\x00-\x08\x0E-\x1F\x7F]/.test(code)) {
        return m.reply(AI.err(
            `File-nya sepertinya binary atau corrupt nih~ 🌸\n\n` +
            `> Ai mendeteksi karakter non-teks di dalam file.\n` +
            `> Pastiin file-nya benar-benar source code JavaScript (bukan hasil compress/encrypt).\n\n` +
            `> Coba kirim ulang dengan file .js yang bersih ya! 💖`
        ))
    }

    const missingParts = []
    if (!code.includes('pluginConfig'))   missingParts.push('`pluginConfig`')
    if (!code.includes('module.exports')) missingParts.push('`module.exports`')
    if (!code.includes('handler'))        missingParts.push('`handler`')

    if (missingParts.length > 0) {
        return m.reply(
            `💔 *Aduh~ Struktur plugin-nya kurang lengkap nih!*\n\n` +
            `> Bagian yang tidak ditemukan:\n` +
            `${missingParts.map(p => `> • ${p}`).join('\n')}\n\n` +
            `> Plugin yang valid minimal harus punya:\n` +
            `> • \`pluginConfig\` — konfigurasi plugin\n` +
            `> • \`handler\` — fungsi utama\n` +
            `> • \`module.exports\` — ekspor module\n\n` +
            `> Lengkapi dulu ya, terus kirim ulang~ Ai tunggu! 💖`
        )
    }

    const configMissing = []
    if (!code.match(/name\s*:/))        configMissing.push('`name`')
    if (!code.match(/category\s*:/))    configMissing.push('`category`')
    if (!code.match(/description\s*:/)) configMissing.push('`description`')

    if (configMissing.length > 0) {
        return m.reply(
            `💔 *pluginConfig-nya kurang lengkap nih~*\n\n` +
            `> Field yang belum ada:\n` +
            `${configMissing.map(c => `> • ${c}`).join('\n')}\n\n` +
            `> Minimal \`pluginConfig\` harus punya:\n` +
            `> • \`name\` — nama command\n` +
            `> • \`category\` — kategori plugin\n` +
            `> • \`description\` — deskripsi singkat\n\n` +
            `> Tambahin dulu ya~ Ai sayang kamu! 💖`
        )
    }

    // ── Syntax check ──────────────────────────────────────────────────────────
    const syntaxCheck = validateSyntax(code)
    if (!syntaxCheck.valid) {
        return m.reply(
            `💔 *Ada syntax error di code-nya nih~*\n\n` +
            `> Pesan error:\n` +
            `> \`${syntaxCheck.error}\`\n\n` +
            `> Perbaiki dulu error di atas, terus kirim ulang ya~ Ai tunggu! ✨`
        )
    }

    // ── Extract info ──────────────────────────────────────────────────────────
    const extracted = extractPluginInfo(code)
    let fileName    = args[0] || extracted.name
    let folderName  = args[1] || extracted.category

    if (!fileName) {
        return m.reply(AI.err(
            `Ai gak bisa detect nama plugin-nya nih~ 🤔\n\n` +
            `> Pastiin \`pluginConfig.name\` ada di code-nya, atau\n` +
            `> tentukan nama file secara manual:\n` +
            `> \`${m.prefix}ganticode <namafile>\`\n\n` +
            `> Contoh: \`${m.prefix}ganticode menu\``
        ))
    }

    fileName = fileName.toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (!fileName) return m.reply(AI.err(
        `Nama file tidak valid nih~\n\n` +
        `> Nama file cuma boleh berisi huruf, angka, dan tanda minus (-).\n` +
        `> Coba pakai nama yang lebih sederhana ya~ 💖`
    ))

    // ── SCAN: Pattern berbahaya → minta konfirmasi ────────────────────────────
    const dangerPatterns = [
        { pattern: /\beval\s*\(/,                      label: 'eval()' },
        { pattern: /\bchild_process\b/,                label: 'child_process' },
        { pattern: /\bexec\s*\(/,                      label: 'exec()' },
        { pattern: /\bspawnSync\s*\(/,                 label: 'spawnSync()' },
        { pattern: /\bprocess\.exit\s*\(/,             label: 'process.exit()' },
        { pattern: /fs\s*\.\s*(unlink|rmdir|rm)\s*\(/, label: 'fs.unlink/rmdir/rm()' },
        { pattern: /require\s*\(\s*['"`]child_process/, label: "require('child_process')" },
        { pattern: /rm\s+-rf/,                         label: 'rm -rf' },
    ]

    const dangers = dangerPatterns.filter(d => d.pattern.test(code)).map(d => d.label)

    if (dangers.length > 0) {
        pendingConfirm.set(m.sender, { code, fileName, folderName, extracted })
        setTimeout(() => pendingConfirm.delete(m.sender), 60_000)

        return m.reply(
            `⚠️ *Wah~ Ai nemu kode yang berbahaya nih!*\n\n` +
            `> Ai mendeteksi pola berikut di dalam plugin:\n` +
            `${dangers.map(d => `> • \`${d}\``).join('\n')}\n\n` +
            `> Pola di atas bisa dipakai untuk hal jahat (hapus file, jalankan perintah sistem, dll).\n` +
            `> Kalau kamu **yakin** ini plugin aman dan kamu percaya, lanjutkan.\n` +
            `> Kalau ragu, lebih baik batalkan ya~ 💖\n\n` +
            `╭┈┈⬡「 ❓ *ᴋᴏɴꜰɪʀᴍᴀsɪ* 」\n` +
            `┃ Balas \`yes\` — lanjut pasang plugin\n` +
            `┃ Balas \`no\`  — batalkan\n` +
            `╰┈┈⬡\n\n` +
            `> ⏱️ Konfirmasi expired dalam *60 detik* ya~\n` +
            `> Ai tunggu jawaban kamu~ ✨`
        )
    }

    m.react('🕕')
    return executeReplace(m, { code, fileName, folderName, extracted })
}

// ── Confirm answer handler (dipanggil dari src/handler.js) ───────────────────
async function confirmAnswerHandler(m, sock) {
    if (!m.body) return false
    if (m.isCommand) return false

    const userId = m.sender
    if (!pendingConfirm.has(userId)) return false

    const text = (m.body || '').trim().toLowerCase()

    if (text === 'yes' || text === 'y') {
        const pending = pendingConfirm.get(userId)
        pendingConfirm.delete(userId)
        m.react('🕕')
        await executeReplace(m, pending)
        return true
    }

    if (text === 'no' || text === 'n') {
        pendingConfirm.delete(userId)
        m.react('❌')
        await m.reply(
            `❌ *ᴘᴇᴍᴀsᴀɴɢᴀɴ ᴅɪʙᴀᴛᴀʟᴋᴀɴ*\n\n` +
            `> Oke~ Plugin tidak jadi dipasang/diganti!\n` +
            `> Kalau nanti berubah pikiran, tinggal kirim ulang ya~ 💖\n` +
            `> Ai selalu di sini buat bantu kamu! ✨`
        )
        return true
    }

    await m.reply(
        `⏳ *Ai masih nunggu konfirmasi kamu nih~*\n\n` +
        `> Balas \`yes\` untuk lanjut memasang plugin\n` +
        `> Balas \`no\` untuk membatalkan\n\n` +
        `> ⏱️ Konfirmasi akan expired dalam 60 detik ya~\n` +
        `> Jangan kelamaan mikirnya~ 💖`
    )
    return true
}

module.exports = {
    config: pluginConfig,
    handler,
    confirmAnswerHandler
}