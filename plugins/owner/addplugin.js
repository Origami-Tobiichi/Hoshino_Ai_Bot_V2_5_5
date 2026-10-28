const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { hotReloadPlugin } = require('../../src/lib/plugins')
const { getConfig, getDatabase: _getDb } = require('../../config')
const { getDatabase } = require('../../src/lib/database')

const pendingConfirm = new Map()

const pluginConfig = {
    name: 'addplugin',
    alias: ['addpl', 'tambahplugin'],
    category: 'owner',
    description: 'Tambah plugin baru dari code yang di-reply',
    usage: '.addplugin [namafile] [folder]',
    example: '.addplugin bliblidl downloader',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

const dangerPatterns = [
    { pattern: /\beval\s*\(/,                       label: 'eval()' },
    { pattern: /\bchild_process\b/,                 label: 'child_process' },
    { pattern: /\bexec\s*\(/,                       label: 'exec()' },
    { pattern: /\bspawnSync\s*\(/,                  label: 'spawnSync()' },
    { pattern: /\bprocess\.exit\s*\(/,              label: 'process.exit()' },
    { pattern: /fs\s*\.\s*(unlink|rmdir|rm)\s*\(/,  label: 'fs.unlink/rmdir/rm()' },
    { pattern: /require\s*\(\s*['"`]child_process/,  label: "require('child_process')" },
    { pattern: /rm\s+-rf/,                          label: 'rm -rf' },
]

const VALID_FOLDERS = [
    'main', 'owner', 'downloader', 'download', 'sticker', 'ai', 'media',
    'game', 'rpg', 'maker', 'fun', 'group', 'premium', 'info', 'search',
    'canvas', 'anime', 'nsfw', 'utility', 'economy', 'tools', 'other',
    'stalker', 'security', 'store', 'user', 'system'
]

function isSafeFolder(folderName, pluginsDir) {
    const resolved = path.resolve(path.join(pluginsDir, folderName))
    const base     = path.resolve(pluginsDir)
    return resolved.startsWith(base + path.sep) || resolved === base
}

function isSafeFileName(fileName) {
    return /^[a-z0-9-]+$/.test(fileName) && !fileName.startsWith('.') && !fileName.startsWith('-') && !fileName.endsWith('-')
}

function checkRequireDepth(code) {
    const matches = [...code.matchAll(/require\s*\(\s*['"`](\.\.\/[^'"`]+)['"`]\s*\)/g)]
    const deep = matches.filter(m => {
        const depth = (m[1].match(/\.\.\//g) || []).length
        return depth > 3
    })
    return deep.map(m => m[1])
}

function isNotifActive() {
    try {
        return getDatabase().setting('pluginNotif') ?? true
    } catch { return true }
}

async function triggerInfoPlugin(action, pluginData, sock, actorJid) {
    if (!isNotifActive()) return false
    try {
        const config = getConfig()
        const db = getDatabase()
        const setinfoModule = require('./setinfoplugin')
        await setinfoModule.sendInfoPlugin(action, pluginData, sock, db, config, actorJid)
        return true
    } catch (e) { console.error('❌ Gagal kirim info plugin:', e); return false }
}

function extractPluginInfo(code) {
    const info = {
        name: null,
        category: null,
        commands: [],
        description: null,
        isOwner: false,
        isPremium: false,
        isGroup: false,
        isPrivate: false,
        isEnabled: true,
        cooldown: 0,
        energi: 0,
    }

    const nameStr = code.match(/name:\s*['"`]([^'"`]+)['"`]/)
    if (nameStr) {
        info.name = nameStr[1]
        info.commands = [nameStr[1]]
    }

    const nameArr = code.match(/name:\s*\[([^\]]+)\]/)
    if (nameArr) {
        const items = nameArr[1].match(/['"`]([^'"`]+)['"`]/g)
        if (items?.length) {
            info.commands = items.map(s => s.replace(/['"`]/g, ''))
            info.name = info.commands[0]
        }
    }

    const aliasArr = code.match(/alias:\s*\[([^\]]*)\]/)
    if (aliasArr) {
        const items = aliasArr[1].match(/['"`]([^'"`]+)['"`]/g)
        if (items) info.commands.push(...items.map(s => s.replace(/['"`]/g, '')))
    }

    const categoryMatch = code.match(/category:\s*['"`]([^'"`]+)['"`]/i)
    if (categoryMatch) info.category = categoryMatch[1]

    const descMatch = code.match(/description:\s*['"`]([^'"`]+)['"`]/i)
    if (descMatch) info.description = descMatch[1]

    const boolField = (key) => {
        const m = code.match(new RegExp(`${key}:\\s*(true|false)`))
        return m ? m[1] === 'true' : null
    }

    const numField = (key) => {
        const m = code.match(new RegExp(`${key}:\\s*(\\d+)`))
        return m ? parseInt(m[1]) : null
    }

    info.isOwner   = boolField('isOwner')   ?? false
    info.isPremium = boolField('isPremium') ?? false
    info.isGroup   = boolField('isGroup')   ?? false
    info.isPrivate = boolField('isPrivate') ?? false
    info.isEnabled = boolField('isEnabled') ?? true
    info.cooldown  = numField('cooldown')   ?? 0
    info.energi    = numField('energi')     ?? 0

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

function buildCommandMap(pluginsDir) {
    const map = {}
    const folders = fs.readdirSync(pluginsDir, { withFileTypes: true })
        .filter(d => d.isDirectory()).map(d => d.name)

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

function checkConflicts(newCommands, commandMap) {
    const conflicts = []
    for (const cmd of newCommands) {
        const existing = commandMap[cmd.toLowerCase()]
        if (existing) conflicts.push({ cmd, file: existing.file, folder: existing.folder })
    }
    return conflicts
}

async function executeAdd(m, { code, fileName, folderName, extracted, sock }) {
    const pluginsDir = path.join(process.cwd(), 'plugins')

    if (!isSafeFolder(folderName, pluginsDir)) {
        m.react('❌')
        return m.reply(
            `❌ *ᴀᴅᴅ ᴘʟᴜɢɪɴ*\n\n` +
            `> Folder tidak valid: \`${folderName}\`\n` +
            `> Tidak boleh keluar dari direktori plugins`
        )
    }

    if (!isSafeFileName(fileName)) {
        m.react('❌')
        return m.reply(
            `❌ *ᴀᴅᴅ ᴘʟᴜɢɪɴ*\n\n` +
            `> Nama file tidak valid: \`${fileName}\`\n` +
            `> Hanya huruf kecil dan angka yang diperbolehkan`
        )
    }

    const folderPath = path.join(pluginsDir, folderName)
    const filePath   = path.join(folderPath, `${fileName}.js`)

    if (fs.existsSync(filePath)) {
        m.react('❌')
        return m.reply(
            `❌ *ᴀᴅᴅ ᴘʟᴜɢɪɴ*\n\n` +
            `> File \`${fileName}.js\` sudah ada di folder \`${folderName}\`\n` +
            `> Gunakan \`.ganticode\` untuk update`
        )
    }

    const commandMap = buildCommandMap(pluginsDir)
    const conflicts  = checkConflicts(extracted.commands, commandMap)

    if (conflicts.length > 0) {
        const lines = conflicts.map(c =>
            `> ⚡ \`${c.cmd}\` → sudah dipakai oleh \`${c.file}\` (${c.folder})`
        ).join('\n')
        m.react('❌')
        return m.reply(
            `❌ *ᴀᴅᴅ ᴘʟᴜɢɪɴ*\n\n` +
            `*Command bentrok:*\n${lines}\n\n` +
            `> Ganti nama command/alias dulu sebelum upload ya~`
        )
    }

    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true })

    fs.writeFileSync(filePath, code)
    const reloadResult = hotReloadPlugin(filePath)

    const pluginData = {
        name:        fileName,
        folder:      folderName,
        category:    extracted.category    || folderName,
        description: extracted.description || '-',
        commands:    extracted.commands    || [],
        isOwner:     extracted.isOwner,
        isPremium:   extracted.isPremium,
        isGroup:     extracted.isGroup,
        isPrivate:   extracted.isPrivate,
        isEnabled:   extracted.isEnabled,
        cooldown:    extracted.cooldown,
        energi:      extracted.energi,
        size:        code.length,
        reload:      reloadResult.success
    }

    const shouldNotify =
    reloadResult.success &&
    !['owner'].includes((pluginData.category || '').toLowerCase())

if (shouldNotify) {
    await triggerInfoPlugin('ADD', pluginData, sock, m.sender)
}

    const isUnknownFolder = !VALID_FOLDERS.includes(folderName)
    const aliasOnly = extracted.commands.slice(1)

    m.react('✅')
    return m.reply(
        `✅ *ᴘʟᴜɢɪɴ ᴅɪᴛᴀᴍʙᴀʜᴋᴀɴ*\n\n` +
        `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
        `┃ 📝 File      : \`${fileName}.js\`\n` +
        `┃ 📂 Path      : \`plugins/${folderName}/${fileName}.js\`${isUnknownFolder ? ' ⚠️' : ''}\n` +
        `┃ 🏷️ Kategori  : ${extracted.category || folderName}\n` +
        `┃ ⌨️ Command   : \`${extracted.commands[0] || '-'}\`\n` +
        (aliasOnly.length > 0 ? `┃ 🔗 Alias     : \`${aliasOnly.join(', ')}\`\n` : '') +
        `┃ 📊 Size      : ${code.length} bytes\n` +
        `┃ 🔄 Reload    : ${reloadResult.success ? '✅ Sukses' : '⚠️ Pending'}\n` +
        `╰┈┈⬡\n\n` +
        `╭┈┈⬡「 🔐 *ᴀᴋsᴇs* 」\n` +
        `┃ 👑 Owner Only : ${extracted.isOwner ? '✅' : '❌'}\n` +
        `┃ 💎 Premium    : ${extracted.isPremium ? '✅' : '❌'}\n` +
        `┃ 👥 Group Only : ${extracted.isGroup ? '✅' : '❌'}\n` +
        `┃ 💬 Private    : ${extracted.isPrivate ? '✅' : '❌'}\n` +
        `┃ ✅ Enabled    : ${extracted.isEnabled ? '✅' : '❌'}\n` +
        `┃ ⏱️ Cooldown   : ${extracted.cooldown}s\n` +
        `┃ ⚡ Energi     : ${extracted.energi}\n` +
        `╰┈┈⬡\n\n` +
        (isUnknownFolder ? `> ⚠️ Folder \`${folderName}\` bukan kategori standar\n` : '') +
        `> Plugin sudah aktif dan siap digunakan!`
    )
}

async function handler(m, { sock }) {
    const quoted = m.quoted
    if (!quoted) return m.reply(
        `📦 *ᴀᴅᴅ ᴘʟᴜɢɪɴ*\n\n` +
        `> Reply code plugin dengan caption:\n\n` +
        `┃ \`${m.prefix}addplugin\` — Auto detect\n` +
        `┃ \`${m.prefix}addplugin namafile\` — Custom nama\n` +
        `┃ \`${m.prefix}addplugin namafile folder\` — Custom nama + folder`
    )

    let code = ''

    if (quoted.isDocument) {
        const docFileName =
            quoted.message?.documentMessage?.fileName ||
            quoted.message?.documentWithCaptionMessage?.message?.documentMessage?.fileName || ''

        if (docFileName && !docFileName.toLowerCase().endsWith('.js')) {
            return m.reply(`❌ *ᴀᴅᴅ ᴘʟᴜɢɪɴ*\n\n> File terdeteksi: \`${docFileName}\`\n> Hanya file \`.js\` yang diterima`)
        }

        try {
            const buf = await quoted.download()
            if (!buf || buf.length === 0) throw new Error('Buffer kosong')
            code = buf.toString('utf-8')
        } catch (e) {
            return m.reply(`❌ *ᴀᴅᴅ ᴘʟᴜɢɪɴ*\n\n> Gagal download file\n> \`${e.message}\``)
        }
    } else if (quoted.isImage || quoted.isVideo || quoted.isAudio || quoted.isSticker) {
        return m.reply(`❌ *ᴀᴅᴅ ᴘʟᴜɢɪɴ*\n\n> Yang di-reply harus file \`.js\` atau teks, bukan media`)
    } else {
        code = quoted.text || quoted.body || ''
    }

    if (!code || code.trim().length < 50) {
        return m.reply(`❌ *ᴀᴅᴅ ᴘʟᴜɢɪɴ*\n\n> Code terlalu pendek atau kosong`)
    }

    if (code.includes('\x00') || /[\x00-\x08\x0E-\x1F\x7F]/.test(code)) {
        return m.reply(`❌ *ᴀᴅᴅ ᴘʟᴜɢɪɴ*\n\n> File sepertinya binary atau corrupt, bukan teks JS`)
    }

    const missingParts = []
    if (!code.includes('pluginConfig'))   missingParts.push('`pluginConfig`')
    if (!code.includes('module.exports')) missingParts.push('`module.exports`')
    if (!code.includes('handler'))        missingParts.push('`handler`')

    if (missingParts.length > 0) {
        return m.reply(
            `❌ *ᴀᴅᴅ ᴘʟᴜɢɪɴ*\n\n` +
            `*Struktur tidak lengkap:*\n` +
            missingParts.map(p => `> • ${p} tidak ditemukan`).join('\n') + '\n\n' +
            `> Plugin harus punya \`pluginConfig\`, \`handler\`, dan \`module.exports\``
        )
    }

    const configMissing = []
    if (!code.match(/name\s*:/))        configMissing.push('`name`')
    if (!code.match(/category\s*:/))    configMissing.push('`category`')
    if (!code.match(/description\s*:/)) configMissing.push('`description`')

    if (configMissing.length > 0) {
        return m.reply(
            `❌ *ᴀᴅᴅ ᴘʟᴜɢɪɴ*\n\n` +
            `*pluginConfig tidak lengkap:*\n` +
            configMissing.map(f => `> • ${f} kosong atau tidak ada`).join('\n')
        )
    }

    const syntaxCheck = validateSyntax(code)
    if (!syntaxCheck.valid) {
        return m.reply(
            `❌ *ᴀᴅᴅ ᴘʟᴜɢɪɴ*\n\n` +
            `*Syntax error:*\n` +
            `> \`${syntaxCheck.error}\`\n\n` +
            `> Fix dulu sebelum upload`
        )
    }

    const extracted = extractPluginInfo(code)
    const args      = m.args
    let fileName    = (args[0] || extracted.name)?.toLowerCase().replace(/[^a-z0-9-]/g, '')
    let folderName  = (args[1] || extracted.category || 'other').toLowerCase().replace(/[^a-z0-9-]/g, '')

    if (!fileName) {
        return m.reply(
            `❌ *ᴀᴅᴅ ᴘʟᴜɢɪɴ*\n\n` +
            `> Tidak bisa mendeteksi nama plugin\n` +
            `> Gunakan \`${m.prefix}addplugin <namafile>\``
        )
    }

    const deepRequires = checkRequireDepth(code)
    if (deepRequires.length > 0) {
        const lines = deepRequires.map(r => `> • \`${r}\``).join('\n')
        return m.reply(
            `❌ *ᴀᴅᴅ ᴘʟᴜɢɪɴ*\n\n` +
            `*Require path terlalu dalam (> 3 level):*\n${lines}\n\n` +
            `> Plugin normal tidak seharusnya naik lebih dari 3 level direktori`
        )
    }

    const dangers = dangerPatterns.filter(d => d.pattern.test(code)).map(d => d.label)

    if (dangers.length > 0) {
        pendingConfirm.set(m.sender, { code, fileName, folderName, extracted })
        setTimeout(() => pendingConfirm.delete(m.sender), 60_000)

        return m.reply(
            `⚠️ *ᴀᴅᴅ ᴘʟᴜɢɪɴ*\n\n` +
            `*Terdeteksi pattern berbahaya:*\n` +
            dangers.map(d => `> • \`${d}\``).join('\n') + '\n\n' +
            `╭┈┈⬡「 ❓ *ᴋᴏɴꜰɪʀᴍᴀsɪ* 」\n` +
            `┃ Tetap mau pasang plugin ini?\n` +
            `┃ Balas \`yes\` untuk lanjut\n` +
            `┃ Balas \`no\` untuk batal\n` +
            `╰┈┈⬡\n\n` +
            `> ⏱️ Expired dalam *60 detik*`
        )
    }

    m.react('🕕')
    return executeAdd(m, { code, fileName, folderName, extracted, sock })
}

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
        await executeAdd(m, { ...pending, sock })
        return true
    }

    if (text === 'no' || text === 'n') {
        pendingConfirm.delete(userId)
        m.react('❌')
        await m.reply(`❌ *ᴅɪʙᴀᴛᴀʟᴋᴀɴ*\n\n> Plugin tidak jadi ditambahkan`)
        return true
    }

    await m.reply(
        `⏳ *Masih nunggu konfirmasi*\n\n` +
        `> Balas \`yes\` untuk lanjut atau \`no\` untuk batal\n` +
        `> ⏱️ Expired dalam 60 detik`
    )
    return true
}

module.exports = { config: pluginConfig, handler, confirmAnswerHandler }