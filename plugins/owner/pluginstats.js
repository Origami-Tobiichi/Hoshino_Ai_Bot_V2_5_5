const { getAllPlugins } = require('../../src/lib/plugins')
const { getDatabase }  = require('../../src/lib/database')

const pluginConfig = {
    name: 'pluginstats',
    alias: ['cmdstats', 'usagestats', 'cmdusage', 'statsplugin', 'ps'],
    category: 'owner',
    description: 'Lihat statistik penggunaan command secara real-time, filter per kategori, dan reset counter',
    usage: '.pluginstats [top|bottom|cat <kategori>|find <cmd>|reset|resetall]',
    example: '.pluginstats top 10 | .pluginstats cat downloader | .pluginstats find tiktok | .pluginstats reset ping',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ms) {
    if (!ms) return '-'
    const diff = Date.now() - ms
    const s = Math.floor(diff / 1000)
    if (s < 60)  return `${s}d lalu`
    const m = Math.floor(s / 60)
    if (m < 60)  return `${m}m lalu`
    const h = Math.floor(m / 60)
    if (h < 24)  return `${h}j lalu`
    const d = Math.floor(h / 24)
    return `${d}hr lalu`
}

function bar(count, max, width = 10) {
    const filled = max > 0 ? Math.round((count / max) * width) : 0
    return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function fmtNum(n) {
    if (n >= 1000000) return `${(n/1000000).toFixed(1)}M`
    if (n >= 1000)    return `${(n/1000).toFixed(1)}K`
    return String(n)
}

/**
 * Ambil semua data statistik command dari database.
 * Setiap command yang dieksekusi disimpan sebagai `command_<nama>` di stats.
 * Return array of { name, count, category, lastUsed }
 */
function buildCommandStats(db) {
    const stats     = db.getStats()
    const allPlugin = getAllPlugins() // bisa Map, object, atau array — jangan asumsikan Map

    // Bangun lookup: commandName → category (aman untuk Map/Object/Array)
    const catMap = {}
    const entries = allPlugin instanceof Map
        ? allPlugin.values()
        : Array.isArray(allPlugin)
            ? allPlugin
            : Object.values(allPlugin || {})

    for (const plug of entries) {
        const cfg = plug?.config || {}
        const cat = cfg.category || 'other'
        // filter ketat: cuma string non-kosong yang boleh masuk (name/alias kadang bukan string)
        const names = [cfg.name, ...(cfg.alias || [])].filter(n => typeof n === 'string' && n.length > 0)
        for (const n of names) catMap[n.toLowerCase()] = cat
    }

    const result = []
    for (const [key, val] of Object.entries(stats)) {
        if (!key.startsWith('command_')) continue
        if (key.endsWith('_lastUsed')) continue
        const cmdName = key.slice(8) // strip 'command_'
        result.push({
            name: cmdName,
            count: val || 0,
            category: catMap[cmdName] || 'unknown',
            // lastUsed: opsional — kalau ada key command_<name>_lastUsed di stats
            lastUsed: stats[`command_${cmdName}_lastUsed`] || null
        })
    }

    return result.sort((a, b) => b.count - a.count)
}

// ─── Views ────────────────────────────────────────────────────────────────────

function viewTop(data, limit = 10) {
    const list  = data.slice(0, limit)
    const total = data.reduce((a, b) => a + b.count, 0)
    const max   = list[0]?.count || 1

    let txt = `📊 *ᴛᴏᴘ ${limit} ᴄᴏᴍᴍᴀɴᴅ ᴛᴇʀꜱᴇʀɪɴɢ ᴅɪᴘᴀᴋᴀɪ*\n`
    txt += `> Total eksekusi: *${fmtNum(total)}x*  |  Unik: *${data.length}* cmd\n\n`

    list.forEach((item, i) => {
        const rank  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`
        const pct   = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0.0'
        const b     = bar(item.count, max, 8)
        txt += `${rank} \`.${item.name}\`\n`
        txt += `┃ ${b} *${fmtNum(item.count)}x* (${pct}%)\n`
        txt += `┃ Kategori: ${item.category}\n`
        if (item.lastUsed) txt += `┃ Terakhir: ${timeAgo(item.lastUsed)}\n`
        txt += `┃\n`
    })

    txt += `\n_Gunakan_ \`.pluginstats bottom\` _untuk command paling jarang_`
    return txt
}

function viewBottom(data, limit = 10) {
    const sorted = [...data].sort((a, b) => a.count - b.count)
    const list   = sorted.slice(0, limit)
    const total  = data.reduce((a, b) => a + b.count, 0)

    let txt = `📉 *ᴄᴏᴍᴍᴀɴᴅ ᴘᴀʟɪɴɢ ᴊᴀʀᴀɴɢ ᴅɪᴘᴀᴋᴀɪ* (${limit} terbawah)\n`
    txt += `> Kandidat untuk dipertimbangkan ulang atau dihapus:\n\n`

    list.forEach((item, i) => {
        txt += `${i+1}. \`.${item.name}\` — *${item.count}x*`
        txt += ` _(${item.category})_\n`
    })

    txt += `\n_Lihat top command: \`.pluginstats top\`_`
    return txt
}

function viewCategory(data, catFilter) {
    const filtered = data.filter(d => d.category.toLowerCase() === catFilter.toLowerCase())

    if (!filtered.length) {
        return `❌ *Kategori "${catFilter}" tidak ditemukan atau belum ada data*\n\n` +
               `> Coba: owner, group, downloader, ai, sticker, game, tools, dll`
    }

    const total = filtered.reduce((a, b) => a + b.count, 0)
    const max   = filtered[0]?.count || 1

    let txt = `📂 *ᴋᴀᴛᴇɢᴏʀɪ: ${catFilter.toUpperCase()}*\n`
    txt += `> ${filtered.length} command  |  Total: *${fmtNum(total)}x*\n\n`

    filtered.forEach((item, i) => {
        const b   = bar(item.count, max, 8)
        const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0.0'
        txt += `${i+1}. \`.${item.name}\`\n`
        txt += `   ${b} *${fmtNum(item.count)}x* (${pct}%)\n`
    })

    return txt
}

function viewFind(data, keyword) {
    const kw      = keyword.toLowerCase()
    const matched = data.filter(d => d.name.includes(kw))

    if (!matched.length) {
        return `🔍 *Tidak ditemukan command dengan kata "${keyword}"*\n\n` +
               `> Coba keyword lain atau cek nama command-nya~`
    }

    const total = matched.reduce((a, b) => a + b.count, 0)
    let txt = `🔍 *Hasil pencarian: "${keyword}"*\n`
    txt += `> ${matched.length} command ditemukan  |  Total: *${fmtNum(total)}x*\n\n`

    matched.forEach((item, i) => {
        txt += `${i+1}. \`.${item.name}\`\n`
        txt += `   👑 Kategori: ${item.category}\n`
        txt += `   📊 Dipakai: *${fmtNum(item.count)}x*`
        if (item.lastUsed) txt += `  🕐 ${timeAgo(item.lastUsed)}`
        txt += `\n`
    })

    return txt
}

function viewSummary(data) {
    const total    = data.reduce((a, b) => a + b.count, 0)
    const used     = data.filter(d => d.count > 0).length
    const unused   = data.filter(d => d.count === 0).length
    const allPlugs = getAllPlugins()
    const totalCmd = allPlugs instanceof Map
        ? allPlugs.size
        : Array.isArray(allPlugs)
            ? allPlugs.length
            : Object.keys(allPlugs || {}).length

    // Group by category
    const catMap = {}
    for (const d of data) {
        if (!catMap[d.category]) catMap[d.category] = { count: 0, uses: 0 }
        catMap[d.category].count++
        catMap[d.category].uses += d.count
    }
    const catSorted = Object.entries(catMap).sort((a, b) => b[1].uses - a[1].uses)

    let txt = `📊 *ᴘʟᴜɢɪɴ ꜱᴛᴀᴛꜱ — ᴏᴠᴇʀᴠɪᴇᴡ*\n\n`
    txt += `╭┈┈⬡「 📋 *ꜱᴜᴍᴍᴀʀʏ* 」\n`
    txt += `┃ ⚡ Total eksekusi : *${fmtNum(total)}x*\n`
    txt += `┃ 📦 Total command  : *${totalCmd}* terdaftar\n`
    txt += `┃ ✅ Pernah dipakai : *${used}* command\n`
    txt += `┃ 💤 Belum dipakai  : *${unused}* command\n`
    txt += `╰┈┈⬡\n\n`

    txt += `╭┈┈⬡「 📂 *ᴘᴇʀ ᴋᴀᴛᴇɢᴏʀɪ* 」\n`
    for (const [cat, info] of catSorted.slice(0, 10)) {
        const pct = total > 0 ? ((info.uses / total) * 100).toFixed(1) : '0.0'
        txt += `┃ ${cat.padEnd(12)} *${fmtNum(info.uses)}x* (${pct}%)\n`
    }
    txt += `╰┈┈⬡\n\n`

    const top3 = data.slice(0, 3)
    if (top3.length) {
        txt += `╭┈┈⬡「 🏆 *ᴛᴏᴘ 3 ᴄᴏᴍᴍᴀɴᴅ* 」\n`
        const medals = ['🥇', '🥈', '🥉']
        top3.forEach((item, i) => {
            txt += `┃ ${medals[i]} .${item.name} — *${fmtNum(item.count)}x*\n`
        })
        txt += `╰┈┈⬡\n\n`
    }

    txt += `_Subcommand tersedia:_\n`
    txt += `> \`.pluginstats top [N]\` — top N command\n`
    txt += `> \`.pluginstats bottom [N]\` — command paling jarang\n`
    txt += `> \`.pluginstats cat <kategori>\` — filter per kategori\n`
    txt += `> \`.pluginstats find <keyword>\` — cari command\n`
    txt += `> \`.pluginstats reset <cmd>\` — reset counter 1 command\n`
    txt += `> \`.pluginstats resetall\` — reset semua counter`

    return txt
}

// ─── Handler ──────────────────────────────────────────────────────────────────

async function handler(m, { sock }) {
    const db   = getDatabase()
    const sub  = (m.args?.[0] || '').toLowerCase()
    const arg2 = m.args?.[1] || ''

    // ── Reset satu command ────────────────────────────────────────────────────
    if (sub === 'reset') {
        if (!arg2) return m.reply(
            `❌ *Masukin nama command-nya~*\n\n` +
            `> Contoh: \`.pluginstats reset ping\``
        )
        const key = `command_${arg2.toLowerCase().replace(/^\./, '')}`
        const stats = db.getStats()
        if (!stats[key] && stats[key] !== 0) {
            return m.reply(
                `❌ *Command ".${arg2}" belum ada data-nya*\n\n` +
                `> Command ini belum pernah dieksekusi atau nama salah.`
            )
        }
        // Set ke 0 lewat incrementStat dengan nilai negatif
        const cur = stats[key] || 0
        db.incrementStat(key, -cur)
        m.react('✅')
        return m.reply(
            `✅ *Counter direset!*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ Command : \`.${arg2}\`\n` +
            `┃ Sebelum : *${fmtNum(cur)}x*\n` +
            `┃ Sesudah : *0x*\n` +
            `╰┈┈⬡`
        )
    }

    // ── Reset semua ───────────────────────────────────────────────────────────
    if (sub === 'resetall') {
        const stats   = db.getStats()
        const cmdKeys = Object.keys(stats).filter(k => k.startsWith('command_') && !k.endsWith('_lastUsed'))
        const total   = cmdKeys.reduce((a, k) => a + (stats[k] || 0), 0)

        if (!cmdKeys.length) {
            return m.reply(`📭 *Belum ada data yang perlu direset~*`)
        }

        for (const k of cmdKeys) {
            const cur = stats[k] || 0
            if (cur > 0) db.incrementStat(k, -cur)
        }
        m.react('✅')
        return m.reply(
            `✅ *Semua counter berhasil direset!*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ Command direset : *${cmdKeys.length}*\n` +
            `┃ Total dihapus   : *${fmtNum(total)}x* eksekusi\n` +
            `╰┈┈⬡\n\n` +
            `> Stats dimulai fresh dari sekarang~ 💖`
        )
    }

    // Bangun data untuk semua view berikutnya
    m.react('📊')
    const data = buildCommandStats(db)

    if (!data.length) {
        return m.reply(
            `📭 *Belum ada data statistik~*\n\n` +
            `> Stats akan terisi otomatis setelah user menjalankan command.\n` +
            `> Pastikan \`db.incrementStat('command_xxx')\` sudah dipanggil di handler.`
        )
    }

    // ── Top N ─────────────────────────────────────────────────────────────────
    if (sub === 'top' || sub === 'topn') {
        const limit = Math.min(parseInt(arg2) || 10, 25)
        return m.reply(viewTop(data, limit))
    }

    // ── Bottom N ──────────────────────────────────────────────────────────────
    if (sub === 'bottom' || sub === 'least') {
        const limit = Math.min(parseInt(arg2) || 10, 25)
        return m.reply(viewBottom(data, limit))
    }

    // ── Filter kategori ───────────────────────────────────────────────────────
    if (sub === 'cat' || sub === 'kategori' || sub === 'category') {
        if (!arg2) return m.reply(
            `❌ *Masukin nama kategorinya~*\n\n` +
            `> Contoh: \`.pluginstats cat downloader\`\n` +
            `> Kategori: owner, group, downloader, ai, sticker, game, tools, canvas, dll`
        )
        return m.reply(viewCategory(data, arg2))
    }

    // ── Cari keyword ──────────────────────────────────────────────────────────
    if (sub === 'find' || sub === 'cari' || sub === 'search') {
        if (!arg2) return m.reply(
            `❌ *Masukin keyword-nya~*\n\n` +
            `> Contoh: \`.pluginstats find tiktok\``
        )
        return m.reply(viewFind(data, arg2))
    }

    // ── Default: summary ──────────────────────────────────────────────────────
    return m.reply(viewSummary(data))
}

module.exports = { config: pluginConfig, handler }