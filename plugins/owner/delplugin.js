const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { unloadPlugin } = require('../../src/lib/plugins')
const { getConfig } = require('../../config')
const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'delplugin',
    alias: ['delpl', 'hapusplugin', 'removeplugin'],
    category: 'owner',
    description: 'Hapus plugin berdasarkan nama',
    usage: '.delplugin <nama>',
    example: '.delplugin bliblidl',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
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

function findPluginFile(pluginsDir, name) {
    const folders = fs.readdirSync(pluginsDir, { withFileTypes: true })
        .filter(d => d.isDirectory()).map(d => d.name)
    for (const folder of folders) {
        const folderPath = path.join(pluginsDir, folder)
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'))
        for (const file of files) {
            if (file.replace('.js', '').toLowerCase() === name.toLowerCase()) {
                return { folder, file, path: path.join(folderPath, file) }
            }
        }
    }
    return null
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
    if (nameStr) { info.name = nameStr[1]; info.commands = [nameStr[1]] }

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

async function handler(m, { sock }) {
    const name = m.text?.trim()
    if (!name) return m.reply(`🗑️ Gunakan: \`${m.prefix}delplugin <nama>\``)

    const pluginsDir = path.join(process.cwd(), 'plugins')
    const found = findPluginFile(pluginsDir, name)
    if (!found) return m.reply(`❌ *Ehh~* Plugin \`${name}\` tidak ditemukan~ 🥺`)

    const fileSize = fs.existsSync(found.path) ? fs.statSync(found.path).size : 0

    let extracted = { name, category: found.folder, commands: [name], description: '-', isOwner: false, isPremium: false, isGroup: false, isPrivate: false, isEnabled: true, cooldown: 0, energi: 0 }
    try {
        const code = fs.readFileSync(found.path, 'utf-8')
        extracted = extractPluginInfo(code)
    } catch {}

    // ── Unload dulu ───────────────────────────────────────────────────────────
    const unloadResult = unloadPlugin(name)

    // ── Hapus file — kalau gagal, jangan kirim notif ──────────────────────────
    try {
        fs.unlinkSync(found.path)
    } catch (e) {
        m.react('❌')
        return m.reply(
            `❌ *ᴅᴇʟ ᴘʟᴜɢɪɴ*\n\n` +
            `> Gagal menghapus file:\n` +
            `> \`${e.message}\``
        )
    }

    const pluginData = {
        name,
        folder:      found.folder,
        category:    extracted.category    || found.folder,
        description: extracted.description || '-',
        commands:    extracted.commands    || [name],
        isOwner:     extracted.isOwner,
        isPremium:   extracted.isPremium,
        isGroup:     extracted.isGroup,
        isPrivate:   extracted.isPrivate,
        isEnabled:   extracted.isEnabled,
        cooldown:    extracted.cooldown,
        energi:      extracted.energi,
        size:        fileSize,
        reload:      unloadResult.success
    }

    // ── Filter notif — sama persis kayak addplugin ────────────────────────────
    const shouldNotify =
        unloadResult.success &&
        !['owner'].includes((pluginData.category || '').toLowerCase())

    if (shouldNotify) {
        await triggerInfoPlugin('DELETE', pluginData, sock, m.sender)
    }

    const aliasOnly = extracted.commands.slice(1)

    m.react('✅')
    return m.reply(
        `✅ *ᴘʟᴜɢɪɴ ᴅɪʜᴀᴘᴜs*\n\n` +
        `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
        `┃ 📝 File      : \`${found.file}\`\n` +
        `┃ 📂 Path      : \`plugins/${found.folder}/${found.file}\`\n` +
        `┃ 🏷️ Kategori  : ${extracted.category || found.folder}\n` +
        `┃ ⌨️ Command   : \`${extracted.commands[0] || name}\`\n` +
        (aliasOnly.length > 0 ? `┃ 🔗 Alias     : \`${aliasOnly.join(', ')}\`\n` : '') +
        `┃ 📊 Size      : ${fileSize} bytes\n` +
        `┃ 🔄 Unload    : ${unloadResult.success ? '✅ Sukses' : '⚠️ Pending'}\n` +
        `╰┈┈⬡`
    )
}

module.exports = { config: pluginConfig, handler }