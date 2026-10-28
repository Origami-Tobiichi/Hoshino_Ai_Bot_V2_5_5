const { collectStats } = require('../../src/lib/healthCheck')
const { getConnectionState, isConnected, getUptime } = require('../../src/connection')
const { getAllErrors } = require('../../src/lib/errorLog')

const pluginConfig = {
    name: 'healthdashboard',
    alias: ['hdash', 'dashboard', 'statusbot'],
    category: 'owner',
    description: 'Dashboard gabungan: uptime, RAM/CPU, status koneksi WA, dan error 1 jam terakhir',
    usage: '.healthdashboard',
    example: '.healthdashboard',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

function fmtBytes(bytes) {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB'
    if (bytes >= 1048576)    return (bytes / 1048576).toFixed(1) + ' MB'
    return (bytes / 1024).toFixed(0) + ' KB'
}

function fmtDuration(seconds) {
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const mn = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    const parts = []
    if (d) parts.push(`${d}h`)
    if (h) parts.push(`${h}j`)
    if (mn) parts.push(`${mn}m`)
    if (!d && !h) parts.push(`${s}d`)
    return parts.join(' ') || '0d'
}

function statusEmoji(pct) {
    if (pct >= 90) return '🔴'
    if (pct >= 70) return '🟡'
    return '🟢'
}

const handler = async (m) => {
    m.react('🩺')

    const stats = collectStats()
    const cpuN  = parseFloat(stats.cpu)
    const ramN  = parseFloat(stats.ram.pct)

    // Status koneksi WhatsApp
    const connState  = getConnectionState()
    const waConnected = isConnected()
    const waUptimeMs = getUptime()

    // Error 1 jam terakhir
    const oneHourAgo = Date.now() - 3600000
    let errorsLastHour = []
    try {
        errorsLastHour = getAllErrors().filter(e => e.id > oneHourAgo)
    } catch {}

    let txt = `🩺 *ʜᴇᴀʟᴛʜ ᴅᴀsʜʙᴏᴀʀᴅ*\n`
    txt += `> ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB\n\n`

    // Uptime
    txt += `╭┈┈⬡「 ⏱️ *ᴜᴘᴛɪᴍᴇ* 」\n`
    txt += `┃ 🤖 Bot: *${fmtDuration(stats.uptime.process)}*\n`
    txt += `┃ 🖥️ VPS: *${fmtDuration(stats.uptime.system)}*\n`
    if (waConnected) {
        txt += `┃ 📡 Koneksi WA: *${fmtDuration(waUptimeMs / 1000)}*\n`
    }
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`

    // CPU & RAM
    txt += `╭┈┈⬡「 📊 *ʀᴇsᴏᴜʀᴄᴇ* 」\n`
    txt += `┃ ${statusEmoji(cpuN)} CPU: *${stats.cpu}%*\n`
    txt += `┃ ${statusEmoji(ramN)} RAM: *${stats.ram.pct}%* (${fmtBytes(stats.ram.used)} / ${fmtBytes(stats.ram.total)})\n`
    if (stats.disk) {
        txt += `┃ ${statusEmoji(stats.disk.pct)} Disk: *${stats.disk.pct}%* (${fmtBytes(stats.disk.used)} / ${fmtBytes(stats.disk.total)})\n`
    }
    txt += `┃ 📦 Heap Node: *${fmtBytes(stats.node.heapUsed)}* / ${fmtBytes(stats.node.heapTotal)}\n`
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`

    // Koneksi WhatsApp
    txt += `╭┈┈⬡「 📱 *ᴋᴏɴᴇᴋsɪ ᴡᴀ* 」\n`
    txt += `┃ ${waConnected ? '🟢 Status: *Terhubung*' : '🔴 Status: *Terputus*'}\n`
    txt += `┃ 🔁 Reconnect attempt: *${connState.reconnectAttempts || 0}*\n`
    if (connState.connectedAt) {
        const connectedAt = new Date(connState.connectedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
        txt += `┃ 🕐 Terhubung sejak: *${connectedAt}*\n`
    }
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`

    // Error 1 jam terakhir
    txt += `╭┈┈⬡「 ❌ *ᴇʀʀᴏʀ (1 ᴊᴀᴍ ᴛᴇʀᴀᴋʜɪʀ)* 」\n`
    txt += `┃ 📋 Total: *${errorsLastHour.length}*\n`
    if (errorsLastHour.length > 0) {
        const cmdCount = {}
        for (const e of errorsLastHour) {
            const key = e.command || e.plugin || 'unknown'
            cmdCount[key] = (cmdCount[key] || 0) + 1
        }
        const top = Object.entries(cmdCount).sort((a, b) => b[1] - a[1]).slice(0, 3)
        for (const [cmd, count] of top) {
            txt += `┃ • \`${cmd}\` — ${count}x\n`
        }
        const latest = errorsLastHour[0]
        if (latest) {
            const shortMsg = (latest.message || '').substring(0, 60)
            txt += `┃ 🕐 Terbaru: ${shortMsg}\n`
        }
    } else {
        txt += `┃ ✅ Tidak ada error~\n`
    }
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`

    // Kesimpulan
    const warnings = []
    if (cpuN >= 90) warnings.push('🔴 CPU sangat tinggi!')
    else if (cpuN >= 70) warnings.push('🟡 CPU mulai tinggi')
    if (ramN >= 90) warnings.push('🔴 RAM hampir penuh!')
    else if (ramN >= 70) warnings.push('🟡 RAM mulai penuh')
    if (stats.disk?.pct >= 90) warnings.push('🔴 Disk hampir penuh!')
    if (!waConnected) warnings.push('🔴 Koneksi WA terputus!')
    if (errorsLastHour.length >= 5) warnings.push(`🟡 ${errorsLastHour.length} error dalam 1 jam terakhir`)

    if (warnings.length) {
        txt += `⚠️ *ᴘᴇʀʜᴀᴛɪᴀɴ*\n`
        for (const w of warnings) txt += `> ${w}\n`
    } else {
        txt += `> ✅ Semua sistem normal~ Ai sehat dan siap melayani! 💖`
    }

    m.react('✅')
    return m.reply(txt)
}

module.exports = { config: pluginConfig, handler }