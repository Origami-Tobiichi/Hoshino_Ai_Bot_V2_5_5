const { getDatabase } = require('../../src/lib/database')
const config = require('../../config')
const util = require('util')

const pluginConfig = {
    name: 'vardump',
    alias: ['vd', 'dbdump', 'dbpath', 'dumpvar'],
    category: 'owner',
    description: 'Inspect nilai variabel atau path database object (Owner Only)',
    usage: '.vardump <path>',
    example: '.vardump db.users\n.vardump db.setting\n.vardump config.prefix\n.vardump db.getUser("62xxx@s.whatsapp.net")',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

function resolvePathSafe(root, pathStr) {
    const segments = pathStr
        .replace(/\[['"]?([^\]'"]+)['"]?\]/g, '.$1')
        .split('.')
        .filter(Boolean)

    let current = root
    for (const seg of segments) {
        if (current === null || current === undefined) return undefined
        if (typeof current !== 'object' && typeof current !== 'function') return undefined
        current = current[seg]
    }
    return current
}

function formatOutput(value, depth = 3) {
    if (value === undefined) return 'undefined'
    if (value === null) return 'null'
    if (typeof value === 'function') {
        return `[Function: ${value.name || '(anonymous)'}]`
    }
    if (typeof value === 'object') {
        try {
            return util.inspect(value, {
                depth,
                maxArrayLength: 30,
                breakLength: 80,
                compact: false,
                colors: false
            })
        } catch {
            return String(value)
        }
    }
    return String(value)
}

function getTypeLabel(value) {
    if (value === null) return 'null'
    if (Array.isArray(value)) return `Array(${value.length})`
    if (value instanceof Map) return `Map(${value.size})`
    if (value instanceof Set) return `Set(${value.size})`
    if (typeof value === 'object') {
        const keys = Object.keys(value)
        return `Object { ${keys.length} key${keys.length !== 1 ? 's' : ''} }`
    }
    return typeof value
}

async function handler(m, { sock }) {
    if (!config.isOwner(m.sender)) return m.reply('❌ *Nee~ khusus owner!* Fitur ini cuma buat owner aja ya~ ☆')

    const query = m.text?.trim()
    if (!query) {
        return m.reply(
            `🔬 *ᴠᴀʀᴅᴜᴍᴘ*\n\n` +
            `> Inspect nilai variabel atau path database object\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> \`${m.prefix}vardump db.users\`\n` +
            `> \`${m.prefix}vardump db.setting\`\n` +
            `> \`${m.prefix}vardump db.groups\`\n` +
            `> \`${m.prefix}vardump config.prefix\`\n` +
            `> \`${m.prefix}vardump config.owner\`\n\n` +
            `*ᴘᴀᴛʜ sᴜᴘᴘᴏʀᴛ:*\n` +
            `> dot notation: \`db.users.62xxx\`\n` +
            `> bracket notation: \`db.users["62xxx"]\``
        )
    }

    m.react('🔬')

    const db = getDatabase()

    const rootScope = { db, config }

    const isMethodCall = /\.\w+\(/.test(query)
    if (isMethodCall) {
        return m.reply(
            `❌ *ᴠᴀʀᴅᴜᴍᴘ*\n\n` +
            `> Method call tidak didukung\n` +
            `> Gunakan \`.$ \` (eval) untuk eksekusi fungsi`
        )
    }

    const rootKey = query.split('.')[0].split('[')[0]
    if (!Object.prototype.hasOwnProperty.call(rootScope, rootKey)) {
        return m.reply(
            `❌ *Root tidak dikenal:* \`${rootKey}\`\n\n` +
            `> Root yang tersedia: \`db\`, \`config\``
        )
    }

    let resolvedValue
    let resolveError = null

    try {
        resolvedValue = resolvePathSafe(rootScope, query)
    } catch (err) {
        resolveError = err
    }

    if (resolveError) {
        m.react('❌')
        return m.reply(
            `❌ *ᴇʀʀᴏʀ ʀᴇsᴏʟᴠɪɴɢ ᴘᴀᴛʜ*\n\n` +
            `\`\`\`${resolveError.message}\`\`\``
        )
    }

    const typeLabel = getTypeLabel(resolvedValue)
    let outputStr = formatOutput(resolvedValue)

    const MAX_LEN = 3500
    let truncated = false
    if (outputStr.length > MAX_LEN) {
        outputStr = outputStr.slice(0, MAX_LEN)
        truncated = true
    }

    m.react('✅')

    const teks =
        `🔬 *ᴠᴀʀᴅᴜᴍᴘ*\n\n` +
        `╭┈┈⬡「 📋 *ɪɴꜰᴏ* 」\n` +
        `┃ 📍 ᴘᴀᴛʜ: \`${query}\`\n` +
        `┃ 🏷️ ᴛʏᴘᴇ: ${typeLabel}\n` +
        `╰┈┈┈┈┈┈┈┈⬡\n\n` +
        `\`\`\`${outputStr}\`\`\`` +
        (truncated ? '\n\n> ⚠️ Output dipotong (terlalu panjang)' : '')

    return m.reply(teks)
}

module.exports = {
    config: pluginConfig,
    handler
}