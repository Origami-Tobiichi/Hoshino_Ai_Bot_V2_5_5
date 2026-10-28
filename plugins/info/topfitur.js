const { getDatabase } = require('../../src/lib/database')
const { pluginStore } = require('../../src/lib/plugins')

const pluginConfig = {
    name: 'topfitur',
    alias: ['topfeature', 'fiturterpakai', 'topf', 'rankfitur'],
    category: 'info',
    description: 'Melihat ranking fitur yang paling sering dipakai (global atau per grup)',
    usage: '.topfitur [global/grup] [limit]',
    example: '.topfitur global 10',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

function toSmallCaps(text) {
    const map = {
        'a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ꜰ','g':'ɢ','h':'ʜ','i':'ɪ',
        'j':'ᴊ','k':'ᴋ','l':'ʟ','m':'ᴍ','n':'ɴ','o':'ᴏ','p':'ᴘ','q':'ǫ','r':'ʀ',
        's':'s','t':'ᴛ','u':'ᴜ','v':'ᴠ','w':'ᴡ','x':'x','y':'ʏ','z':'ᴢ'
    }
    return text.toLowerCase().split('').map(c => map[c] || c).join('')
}

function formatNumber(num) {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
    return num.toString()
}

function getRankMedal(rank) {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `${rank}.`
}

function getUsageBar(count, max, bars = 8) {
    const filled = Math.round((count / max) * bars)
    return '▰'.repeat(filled) + '▱'.repeat(bars - filled)
}

/**
 * Ambil set command name yang isOwner: true dari pluginStore
 */
function getOwnerCommandSet() {
    const ownerSet = new Set()
    for (const [cmdName, plugin] of pluginStore.commands.entries()) {
        if (plugin.config?.isOwner === true) {
            ownerSet.add(cmdName.toLowerCase())
        }
    }
    return ownerSet
}

/**
 * Baca semua stats fitur global dari database.stats
 * key format: command_<cmdname>  (ditambah handler.js setiap eksekusi sukses)
 * Filter: hapus command isOwner, hapus non-command keys
 */
function getGlobalFeatureRanking(limit = 15) {
    const db = getDatabase()
    const stats = db.getStats()
    const ownerSet = getOwnerCommandSet()

    const entries = []
    for (const [key, count] of Object.entries(stats)) {
        if (!key.startsWith('command_')) continue
        const cmd = key.replace('command_', '').toLowerCase()
        if (ownerSet.has(cmd)) continue
        if (!count || count <= 0) continue
        entries.push({ cmd, count })
    }

    entries.sort((a, b) => b.count - a.count)
    return entries.slice(0, limit)
}

/**
 * Baca stats fitur per grup dari db.groups[groupJid].featureStats
 * format: groups[jid].featureStats = { cmdname: count }
 */
function getGroupFeatureRanking(groupJid, limit = 15) {
    const db = getDatabase()
    const ownerSet = getOwnerCommandSet()

    const group = db.getGroup(groupJid)
    if (!group || !group.featureStats) return []

    const entries = []
    for (const [cmd, count] of Object.entries(group.featureStats)) {
        const cmdLower = cmd.toLowerCase()
        if (ownerSet.has(cmdLower)) continue
        if (!count || count <= 0) continue
        entries.push({ cmd: cmdLower, count })
    }

    entries.sort((a, b) => b.count - a.count)
    return entries.slice(0, limit)
}

async function handler(m, { sock }) {
    const args = m.body?.trim().split(/\s+/).slice(1) || []

    // Parse mode: global / grup
    let mode = 'global'
    let limit = 15

    for (const arg of args) {
        if (['global', 'all', 'semua'].includes(arg.toLowerCase())) mode = 'global'
        if (['grup', 'group', 'here', 'sini'].includes(arg.toLowerCase())) mode = 'group'
        if (/^\d+$/.test(arg)) {
            limit = Math.min(25, Math.max(5, parseInt(arg)))
        }
    }

    // Kalau di private chat dan minta mode grup → fallback ke global
    if (mode === 'group' && !m.isGroup) {
        mode = 'global'
        await m.react('ℹ️')
    }

    await m.react('📊')

    if (mode === 'global') {
        // ── GLOBAL ──────────────────────────────────────────────
        const ranking = getGlobalFeatureRanking(limit)

        if (ranking.length === 0) {
            return m.reply(
                `📊 *ᴛᴏᴘ ꜰɪᴛᴜʀ ɢʟᴏʙᴀʟ*\n\n` +
                `> Belum ada data penggunaan fitur nih~\n` +
                `> Mulai pakai fitur bot biar muncul di ranking! 🌟`
            )
        }

        const maxCount = ranking[0].count
        const totalUsage = ranking.reduce((s, e) => s + e.count, 0)

        let txt = `╔══════════════════════╗\n`
        txt += `   📊 *${toSmallCaps('TOP FITUR GLOBAL')}*\n`
        txt += `╚══════════════════════╝\n\n`

        txt += `╭┈┈⬡「 🌐 *sᴛᴀᴛɪsᴛɪᴋ* 」\n`
        txt += `┃ 🔢 Total Pemakaian: *${formatNumber(totalUsage)}x*\n`
        txt += `┃ 📌 Top ${ranking.length} Fitur Terpopuler\n`
        txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`

        ranking.forEach((entry, i) => {
            const medal = getRankMedal(i + 1)
            const bar = getUsageBar(entry.count, maxCount)
            const pct = ((entry.count / totalUsage) * 100).toFixed(1)
            txt += `${medal} *.${entry.cmd}*\n`
            txt += `  ${bar} *${formatNumber(entry.count)}x* _(${pct}%)_\n`
        })

        txt += `\n*━━━━━━━━━━━━━━━━*\n`
        txt += `💡 *.topfitur grup* — lihat ranking di grup ini`

        await m.reply(txt)

    } else {
        // ── PER GRUP ─────────────────────────────────────────────
        const ranking = getGroupFeatureRanking(m.chat, limit)

        let groupName = m.chat
        try {
            const meta = await sock.groupMetadata(m.chat)
            groupName = meta.subject || m.chat
        } catch {}

        if (ranking.length === 0) {
            return m.reply(
                `📊 *ᴛᴏᴘ ꜰɪᴛᴜʀ ɢʀᴜᴘ*\n\n` +
                `> Belum ada data penggunaan fitur di grup ini~\n` +
                `> Mulai pakai fitur bot biar muncul di ranking! 🌟`
            )
        }

        const maxCount = ranking[0].count
        const totalUsage = ranking.reduce((s, e) => s + e.count, 0)

        let txt = `╔══════════════════════╗\n`
        txt += `   📊 *${toSmallCaps('TOP FITUR GRUP')}*\n`
        txt += `╚══════════════════════╝\n\n`

        txt += `╭┈┈⬡「 👥 *ɪɴꜰᴏ* 」\n`
        txt += `┃ 🏠 Grup: *${groupName}*\n`
        txt += `┃ 🔢 Total Pemakaian: *${formatNumber(totalUsage)}x*\n`
        txt += `┃ 📌 Top ${ranking.length} Fitur Terpopuler\n`
        txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`

        ranking.forEach((entry, i) => {
            const medal = getRankMedal(i + 1)
            const bar = getUsageBar(entry.count, maxCount)
            const pct = ((entry.count / totalUsage) * 100).toFixed(1)
            txt += `${medal} *.${entry.cmd}*\n`
            txt += `  ${bar} *${formatNumber(entry.count)}x* _(${pct}%)_\n`
        })

        txt += `\n*━━━━━━━━━━━━━━━━*\n`
        txt += `💡 *.topfitur global* — lihat ranking semua grup`

        await m.reply(txt)
    }

    await m.react('✅')
}

module.exports = {
    config: pluginConfig,
    handler
}