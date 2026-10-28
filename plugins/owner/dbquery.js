const { getDatabase } = require('../../src/lib/database')
const config = require('../../config')
const util = require('util')

const pluginConfig = {
    name: 'dbquery',
    alias: ['db', 'dq', 'dbq'],
    category: 'owner',
    description: 'Query database langsung via command (Owner Only)',
    usage: '.db <subcommand> [args]',
    example: '.db get users\n.db get users.628xxx\n.db keys settings\n.db count users\n.db search users name Rina\n.db set settings.maintenance true\n.db del users.628xxx\n.db stores',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 2,
    energi: 0,
    isEnabled: true
}

const VALID_STORES = ['users', 'groups', 'settings', 'stats', 'sewa', 'premium', 'owner', 'partner']

const MAX_OUTPUT = 3500
const MAX_KEYS_DISPLAY = 50
const MAX_SEARCH_RESULTS = 10

function fmt(value, depth = 3) {
    if (value === undefined) return 'undefined'
    if (value === null) return 'null'
    if (typeof value === 'function') return `[Function: ${value.name || 'anonymous'}]`
    if (typeof value === 'object') {
        try {
            return util.inspect(value, { depth, maxArrayLength: 30, breakLength: 80, compact: false, colors: false })
        } catch {
            return String(value)
        }
    }
    return String(value)
}

function truncate(str) {
    if (str.length <= MAX_OUTPUT) return { text: str, truncated: false }
    return { text: str.slice(0, MAX_OUTPUT), truncated: true }
}

function parseStorePath(pathStr) {
    if (!pathStr) return { store: null, rest: null }
    const dotIdx = pathStr.indexOf('.')
    const store = dotIdx === -1 ? pathStr : pathStr.slice(0, dotIdx)
    const rest = dotIdx === -1 ? null : pathStr.slice(dotIdx + 1)
    return { store, rest }
}

function getNestedValue(obj, dotPath) {
    if (!dotPath) return obj
    const parts = dotPath.replace(/\[['"]?([^\]'"]+)['"]?\]/g, '.$1').split('.').filter(Boolean)
    let cur = obj
    for (const part of parts) {
        if (cur === null || cur === undefined || typeof cur !== 'object') return undefined
        cur = cur[part]
    }
    return cur
}

function setNestedValue(obj, dotPath, value) {
    const parts = dotPath.replace(/\[['"]?([^\]'"]+)['"]?\]/g, '.$1').split('.').filter(Boolean)
    if (parts.length === 0) return false
    let cur = obj
    for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] === undefined || cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') {
            cur[parts[i]] = {}
        }
        cur = cur[parts[i]]
    }
    cur[parts[parts.length - 1]] = value
    return true
}

function delNestedValue(obj, dotPath) {
    const parts = dotPath.replace(/\[['"]?([^\]'"]+)['"]?\]/g, '.$1').split('.').filter(Boolean)
    if (parts.length === 0) return false
    let cur = obj
    for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] === undefined || typeof cur[parts[i]] !== 'object') return false
        cur = cur[parts[i]]
    }
    const lastKey = parts[parts.length - 1]
    if (!(lastKey in cur)) return false
    delete cur[lastKey]
    return true
}

function parseValue(raw) {
    if (raw === 'true') return true
    if (raw === 'false') return false
    if (raw === 'null') return null
    if (raw === 'undefined') return undefined
    if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw)
    try {
        return JSON.parse(raw)
    } catch {
        return raw
    }
}

function getTypeLabel(value) {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (Array.isArray(value)) return `Array(${value.length})`
    if (value instanceof Map) return `Map(${value.size})`
    if (value instanceof Set) return `Set(${value.size})`
    if (typeof value === 'object') return `Object { ${Object.keys(value).length} keys }`
    return typeof value
}

const SUBCOMMANDS = {
    get: 'get <store[.path]> — Baca nilai dari store/path',
    keys: 'keys <store[.path]> — Tampilkan daftar keys',
    count: 'count <store> — Hitung jumlah entries',
    search: 'search <store> <field> <query> — Cari entries berdasarkan field',
    set: 'set <store.path> <value> — Tulis nilai (JSON/primitive)',
    del: 'del <store.path> — Hapus key dari store',
    flush: 'flush — Paksa simpan semua store ke disk sekarang',
    stores: 'stores — Lihat semua store dan ukurannya',
    help: 'help — Tampilkan bantuan ini',
}

async function handler(m, { sock }) {
    if (!config.isOwner(m.sender)) return m.reply('❌ *Nee~ khusus owner!* Fitur ini cuma buat owner aja ya~ ☆')

    const args = (m.text?.trim() || '').split(/\s+/)
    const sub = args[0]?.toLowerCase()

    if (!sub || sub === 'help') {
        const lines = Object.values(SUBCOMMANDS).map(v => `> \`${m.prefix}db ${v}\``).join('\n')
        return m.reply(
            `🗄️ *ᴅʙǫᴜᴇʀʏ*\n\n` +
            `Query database langsung tanpa eval\n\n` +
            `*sᴛᴏʀᴇs:* \`${VALID_STORES.join(' · ')}\`\n\n` +
            `*sᴜʙᴄᴏᴍᴍᴀɴᴅs:*\n${lines}`
        )
    }

    m.react('🗄️')

    const db = getDatabase()

    if (sub === 'stores') {
        const lines = VALID_STORES.map(s => {
            const data = db.db.data[s]
            if (Array.isArray(data)) return `┃ 📦 ${s}: Array(${data.length})`
            if (data && typeof data === 'object') return `┃ 📦 ${s}: Object { ${Object.keys(data).length} keys }`
            return `┃ 📦 ${s}: ${fmt(data)}`
        }).join('\n')

        m.react('✅')
        return m.reply(
            `🗄️ *ᴅʙ sᴛᴏʀᴇs*\n\n` +
            `╭┈┈⬡「 📊 *ᴏᴠᴇʀᴠɪᴇᴡ* 」\n` +
            `${lines}\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }

    if (sub === 'flush') {
        db.flushAll()
        m.react('✅')
        return m.reply(
            `🗄️ *ᴅʙ ꜰʟᴜsʜ*\n\n` +
            `> ✅ Semua store berhasil disimpan ke disk`
        )
    }

    if (sub === 'get') {
        const pathStr = args[1]
        if (!pathStr) return m.reply(`❌ Usage: \`${m.prefix}db get <store[.path]>\``)

        const { store, rest } = parseStorePath(pathStr)
        if (!VALID_STORES.includes(store)) {
            return m.reply(`❌ Store tidak valid: \`${store}\`\n> Pilihan: \`${VALID_STORES.join(', ')}\``)
        }

        const storeData = db.db.data[store]
        const value = rest ? getNestedValue(storeData, rest) : storeData

        const { text, truncated } = truncate(fmt(value))
        const typeLabel = getTypeLabel(value)

        m.react('✅')
        return m.reply(
            `🗄️ *ᴅʙ ɢᴇᴛ*\n\n` +
            `╭┈┈⬡「 📋 *ɪɴꜰᴏ* 」\n` +
            `┃ 📍 path: \`${pathStr}\`\n` +
            `┃ 🏷️ type: ${typeLabel}\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `\`\`\`${text}\`\`\`` +
            (truncated ? '\n\n> ⚠️ Output dipotong (terlalu panjang)' : '')
        )
    }

    if (sub === 'keys') {
        const pathStr = args[1]
        if (!pathStr) return m.reply(`❌ Usage: \`${m.prefix}db keys <store[.path]>\``)

        const { store, rest } = parseStorePath(pathStr)
        if (!VALID_STORES.includes(store)) {
            return m.reply(`❌ Store tidak valid: \`${store}\`\n> Pilihan: \`${VALID_STORES.join(', ')}\``)
        }

        const storeData = db.db.data[store]
        const target = rest ? getNestedValue(storeData, rest) : storeData

        if (target === null || target === undefined) {
            return m.reply(`❌ *Ehh~* Path \`${pathStr}\` tidak ditemukan~ 🥺`)
        }

        let keys
        if (Array.isArray(target)) {
            keys = target.map((_, i) => `[${i}]`)
        } else if (typeof target === 'object') {
            keys = Object.keys(target)
        } else {
            m.react('✅')
            return m.reply(
                `🗄️ *ᴅʙ ᴋᴇʏs*\n\n` +
                `> \`${pathStr}\` adalah nilai primitif, bukan object\n` +
                `> Type: ${typeof target}, Value: \`${target}\``
            )
        }

        const total = keys.length
        const displayed = keys.slice(0, MAX_KEYS_DISPLAY)
        const keyList = displayed.map((k, i) => {
            const val = Array.isArray(target) ? target[i] : target[k]
            const tl = getTypeLabel(val)
            return `  [${i + 1}] ${k} → ${tl}`
        }).join('\n')

        m.react('✅')
        return m.reply(
            `🗄️ *ᴅʙ ᴋᴇʏs*\n\n` +
            `╭┈┈⬡「 📋 *ɪɴꜰᴏ* 」\n` +
            `┃ 📍 path: \`${pathStr}\`\n` +
            `┃ 🔢 total: ${total} keys\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `\`\`\`${keyList}\`\`\`` +
            (total > MAX_KEYS_DISPLAY ? `\n\n> ⚠️ Hanya menampilkan ${MAX_KEYS_DISPLAY} dari ${total} keys` : '')
        )
    }

    if (sub === 'count') {
        const store = args[1]
        if (!store) return m.reply(`❌ Usage: \`${m.prefix}db count <store>\``)
        if (!VALID_STORES.includes(store)) {
            return m.reply(`❌ Store tidak valid: \`${store}\`\n> Pilihan: \`${VALID_STORES.join(', ')}\``)
        }

        const data = db.db.data[store]
        let count
        if (Array.isArray(data)) count = data.length
        else if (data && typeof data === 'object') count = Object.keys(data).length
        else count = data === undefined ? 0 : 1

        m.react('✅')
        return m.reply(
            `🗄️ *ᴅʙ ᴄᴏᴜɴᴛ*\n\n` +
            `╭┈┈⬡「 📊 *ʀᴇsᴜʟᴛ* 」\n` +
            `┃ 📦 store: \`${store}\`\n` +
            `┃ 🔢 count: *${count}*\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }

    if (sub === 'search') {
        const store = args[1]
        const field = args[2]
        const query = args.slice(3).join(' ')

        if (!store || !field || !query) {
            return m.reply(`❌ Usage: \`${m.prefix}db search <store> <field> <query>\`\n\n*Contoh:*\n> \`${m.prefix}db search users name Rina\`\n> \`${m.prefix}db search users isPremium true\``)
        }

        if (!VALID_STORES.includes(store)) {
            return m.reply(`❌ Store tidak valid: \`${store}\`\n> Pilihan: \`${VALID_STORES.join(', ')}\``)
        }

        const storeData = db.db.data[store]
        if (!storeData || typeof storeData !== 'object' || Array.isArray(storeData)) {
            return m.reply(`❌ *Gomen ne~* Store \`${store}\` tidak bisa di-search (bukan object map)~ 🥺`)
        }

        const parsedQuery = parseValue(query)
        const entries = Object.entries(storeData)
        const matched = []

        for (const [key, val] of entries) {
            if (matched.length >= MAX_SEARCH_RESULTS) break
            if (val === null || val === undefined || typeof val !== 'object') continue
            const fieldVal = getNestedValue(val, field)
            if (fieldVal === undefined) continue

            const strField = String(fieldVal).toLowerCase()
            const strQuery = String(parsedQuery).toLowerCase()
            const isMatch = typeof parsedQuery === 'boolean' || typeof parsedQuery === 'number'
                ? fieldVal === parsedQuery
                : strField.includes(strQuery)

            if (isMatch) matched.push({ key, value: val })
        }

        if (matched.length === 0) {
            m.react('✅')
            return m.reply(
                `🗄️ *ᴅʙ sᴇᴀʀᴄʜ*\n\n` +
                `> ❌ Tidak ada hasil untuk \`${field}\` = \`${query}\` di store \`${store}\``
            )
        }

        const lines = matched.map(({ key, value }) => {
            const fieldDisplay = fmt(getNestedValue(value, field))
            return `[${key}]\n  ${field}: ${fieldDisplay}`
        }).join('\n\n')

        const { text, truncated } = truncate(lines)

        m.react('✅')
        return m.reply(
            `🗄️ *ᴅʙ sᴇᴀʀᴄʜ*\n\n` +
            `╭┈┈⬡「 📋 *ʀᴇsᴜʟᴛ* 」\n` +
            `┃ 📦 store: \`${store}\`\n` +
            `┃ 🔍 field: \`${field}\` = \`${query}\`\n` +
            `┃ 🔢 found: ${matched.length}${matched.length >= MAX_SEARCH_RESULTS ? ` (maks ${MAX_SEARCH_RESULTS})` : ''}\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `\`\`\`${text}\`\`\`` +
            (truncated ? '\n\n> ⚠️ Output dipotong' : '')
        )
    }

    if (sub === 'set') {
        const pathStr = args[1]
        const rawValue = args.slice(2).join(' ')

        if (!pathStr || rawValue === '') {
            return m.reply(
                `❌ Usage: \`${m.prefix}db set <store.path> <value>\`\n\n*Contoh:*\n` +
                `> \`${m.prefix}db set settings.maintenance true\`\n` +
                `> \`${m.prefix}db set users.628xxx.isPremium true\`\n` +
                `> \`${m.prefix}db set settings.botName "Hoshino Ai"\``
            )
        }

        const { store, rest } = parseStorePath(pathStr)
        if (!VALID_STORES.includes(store)) {
            return m.reply(`❌ Store tidak valid: \`${store}\`\n> Pilihan: \`${VALID_STORES.join(', ')}\``)
        }
        if (!rest) {
            return m.reply(`❌ Tidak bisa overwrite root store secara langsung\n> Gunakan path lebih dalam, contoh: \`${store}.somekey\``)
        }

        const parsedVal = parseValue(rawValue)
        const storeData = db.db.data[store]
        const ok = setNestedValue(storeData, rest, parsedVal)

        if (!ok) return m.reply(`❌ *Gomen ne~* Gagal menulis ke path \`${pathStr}\``)

        db.markDirty(store)

        m.react('✅')
        return m.reply(
            `🗄️ *ᴅʙ sᴇᴛ*\n\n` +
            `╭┈┈⬡「 ✅ *sᴜᴄᴄᴇss* 」\n` +
            `┃ 📍 path: \`${pathStr}\`\n` +
            `┃ 🏷️ type: ${getTypeLabel(parsedVal)}\n` +
            `┃ 📝 value: \`${fmt(parsedVal, 1)}\`\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }

    if (sub === 'del') {
        const pathStr = args[1]
        if (!pathStr) return m.reply(`❌ Usage: \`${m.prefix}db del <store.path>\``)

        const { store, rest } = parseStorePath(pathStr)
        if (!VALID_STORES.includes(store)) {
            return m.reply(`❌ Store tidak valid: \`${store}\`\n> Pilihan: \`${VALID_STORES.join(', ')}\``)
        }
        if (!rest) {
            return m.reply(`❌ Tidak bisa menghapus root store\n> Gunakan path lebih dalam, contoh: \`${store}.somekey\``)
        }

        const storeData = db.db.data[store]
        const existed = getNestedValue(storeData, rest)
        if (existed === undefined) {
            return m.reply(`❌ *Ehh~* Path \`${pathStr}\` tidak ditemukan~ 🥺`)
        }

        const ok = delNestedValue(storeData, rest)
        if (!ok) return m.reply(`❌ *Gomen ne~* Gagal menghapus path \`${pathStr}\``)

        db.markDirty(store)

        m.react('✅')
        return m.reply(
            `🗄️ *ᴅʙ ᴅᴇʟ*\n\n` +
            `╭┈┈⬡「 ✅ *ᴅᴇʟᴇᴛᴇᴅ* 」\n` +
            `┃ 📍 path: \`${pathStr}\`\n` +
            `┃ 🏷️ was: ${getTypeLabel(existed)}\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }

    m.react('❌')
    return m.reply(
        `❌ Subcommand tidak dikenal: \`${sub}\`\n\n` +
        `> Ketik \`${m.prefix}db help\` untuk daftar lengkap`
    )
}

module.exports = {
    config: pluginConfig,
    handler
}