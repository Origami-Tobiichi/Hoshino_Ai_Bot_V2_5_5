/**
 * healthCheck.js - Health Check Library
 * Bisa dipanggil manual via plugin, atau auto-report ke owner tiap X jam
 */

const os   = require('os')
const fs   = require('fs')
const path = require('path')

let _sock         = null
let _interval     = null
let _intervalMs   = 0
let _intervalStr  = '-'
let _reportCount  = 0
let _startedAt    = null

const STATE_FILE = path.join(process.cwd(), 'database', 'healthcheck.json')

// ── Persist state ─────────────────────────────────────────────────────────────
function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    } catch {}
    return { enabled: false, intervalMs: 0, intervalStr: '-', reportCount: 0 }
}

function saveState(state) {
    try {
        const dir = path.dirname(STATE_FILE)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8')
    } catch {}
}

// ── Parse interval string (1h, 30m, 6h, 1d) ──────────────────────────────────
function parseInterval(str) {
    const match = String(str).match(/^(\d+)(m|h|d)$/)
    if (!match) return null
    const [, n, unit] = match
    const map = { m: 60000, h: 3600000, d: 86400000 }
    const ms = parseInt(n) * map[unit]
    if (ms < 60000) return null  // minimum 1 menit
    return { ms, str }
}

// ── Kumpulkan data kesehatan bot ──────────────────────────────────────────────
function collectStats() {
    const totalMem = os.totalmem()
    const freeMem  = os.freemem()
    const usedMem  = totalMem - freeMem
    const ramPct   = (usedMem / totalMem * 100).toFixed(1)

    // CPU load average (1 menit)
    const loadAvg  = os.loadavg()[0]
    const cpuCount = os.cpus().length
    const cpuPct   = Math.min(100, (loadAvg / cpuCount * 100)).toFixed(1)

    // Uptime bot (process) dan sistem
    const procUptime = process.uptime()
    const sysUptime  = os.uptime()

    // Disk usage folder bot (cwd)
    let diskInfo = null
    try {
        const { execSync } = require('child_process')
        const raw = execSync(`df -k "${process.cwd()}" 2>/dev/null | tail -1`).toString().trim()
        const parts = raw.split(/\s+/)
        if (parts.length >= 4) {
            const total = parseInt(parts[1]) * 1024
            const used  = parseInt(parts[2]) * 1024
            const pct   = parseInt(parts[4]) || Math.round(used / total * 100)
            diskInfo = { total, used, pct }
        }
    } catch {}

    // Jumlah plugin aktif
    let pluginCount = 0
    try {
        const pluginDir = path.join(process.cwd(), 'plugins')
        function countJs(dir) {
            if (!fs.existsSync(dir)) return
            for (const f of fs.readdirSync(dir)) {
                const full = path.join(dir, f)
                if (fs.statSync(full).isDirectory()) countJs(full)
                else if (f.endsWith('.js') && !f.startsWith('_')) pluginCount++
            }
        }
        countJs(pluginDir)
    } catch {}

    // Jumlah error log (kalau ada)
    let errorCount = 0
    try {
        const logFile = path.join(process.cwd(), 'logs', 'error.log')
        if (fs.existsSync(logFile)) {
            const logs = JSON.parse(fs.readFileSync(logFile, 'utf8') || '[]')
            const cutoff = Date.now() - 86400000
            errorCount = logs.filter(e => e.id > cutoff).length
        }
    } catch {}

    // Node.js memory usage
    const memUsage = process.memoryUsage()

    return {
        timestamp:   new Date().toISOString(),
        cpu:         cpuPct,
        ram:         { pct: ramPct, used: usedMem, total: totalMem, free: freeMem },
        disk:        diskInfo,
        uptime:      { process: procUptime, system: sysUptime },
        node:        { heapUsed: memUsage.heapUsed, heapTotal: memUsage.heapTotal, rss: memUsage.rss },
        pluginCount,
        errorCount,
        platform:    os.platform(),
        nodeVersion: process.version,
    }
}

// ── Format bytes ──────────────────────────────────────────────────────────────
function fmt(bytes) {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB'
    if (bytes >= 1048576)    return (bytes / 1048576).toFixed(1) + ' MB'
    return (bytes / 1024).toFixed(0) + ' KB'
}

// ── Format uptime ─────────────────────────────────────────────────────────────
function fmtUptime(seconds) {
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const parts = []
    if (d) parts.push(`${d}h`)
    if (h) parts.push(`${h}j`)
    if (m) parts.push(`${m}m`)
    if (!parts.length) parts.push(`${Math.floor(seconds)}d`)
    return parts.join(' ')
}

// ── Status emoji berdasarkan nilai ───────────────────────────────────────────
function statusEmoji(pct) {
    if (pct >= 90) return '🔴'
    if (pct >= 70) return '🟡'
    return '🟢'
}

// ── Format report teks ────────────────────────────────────────────────────────
function formatReport(stats, extra = {}) {
    const { cpu, ram, disk, uptime, node, pluginCount, errorCount } = stats
    const cpuN   = parseFloat(cpu)
    const ramN   = parseFloat(ram.pct)

    let txt = `🏥 *ʜᴇᴀʟᴛʜ ᴄʜᴇᴄᴋ ʀᴇᴘᴏʀᴛ*\n`
    if (extra.isAuto) txt += `> Auto report #${extra.reportNum || 1} — ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n`
    txt += `\n`

    // System
    txt += `╭┈┈⬡「 🖥️ *sʏsᴛᴇᴍ* 」\n`
    txt += `┃ ${statusEmoji(cpuN)} CPU: *${cpu}%*\n`
    txt += `┃ ${statusEmoji(ramN)} RAM: *${ram.pct}%* (${fmt(ram.used)} / ${fmt(ram.total)})\n`
    if (disk) {
        txt += `┃ ${statusEmoji(disk.pct)} Disk: *${disk.pct}%* (${fmt(disk.used)} / ${fmt(disk.total)})\n`
    }
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`

    // Bot
    txt += `╭┈┈⬡「 🤖 *ʙᴏᴛ* 」\n`
    txt += `┃ ⏱️ Uptime Bot: *${fmtUptime(uptime.process)}*\n`
    txt += `┃ 🖥️ Uptime VPS: *${fmtUptime(uptime.system)}*\n`
    txt += `┃ 🔌 Plugin aktif: *${pluginCount}*\n`
    txt += `┃ ❌ Error (24j): *${errorCount}*\n`
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`

    // Node.js
    txt += `╭┈┈⬡「 🟢 *ɴᴏᴅᴇ.ᴊs* 」\n`
    txt += `┃ 📦 Heap: *${fmt(node.heapUsed)}* / ${fmt(node.heapTotal)}\n`
    txt += `┃ 💾 RSS: *${fmt(node.rss)}*\n`
    txt += `┃ 🔖 Version: *${stats.nodeVersion}*\n`
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`

    // Kondisi keseluruhan
    const warnings = []
    if (cpuN >= 90)  warnings.push('🔴 CPU sangat tinggi!')
    if (cpuN >= 70)  warnings.push('🟡 CPU mulai tinggi')
    if (ramN >= 90)  warnings.push('🔴 RAM hampir penuh!')
    if (ramN >= 70)  warnings.push('🟡 RAM mulai penuh')
    if (disk?.pct >= 90) warnings.push('🔴 Disk hampir penuh!')
    if (errorCount >= 10) warnings.push(`🟡 ${errorCount} error dalam 24 jam`)

    if (warnings.length) {
        txt += `╭┈┈⬡「 ⚠️ *ᴡᴀʀɴɪɴɢ* 」\n`
        for (const w of warnings) txt += `┃ ${w}\n`
        txt += `╰┈┈┈┈┈┈┈┈⬡`
    } else {
        txt += `> ✅ Semua kondisi normal~ Bot sehat! 💖`
    }

    return txt
}

// ── Kirim report ke owner ─────────────────────────────────────────────────────
async function sendReport(sock, extra = {}) {
    try {
        const config = require('../../config')
        const ownerNumber = config.owner?.number?.[0]
        if (!ownerNumber || !sock) return

        const jid   = ownerNumber + '@s.whatsapp.net'
        const stats = collectStats()
        const text  = formatReport(stats, extra)

        await sock.sendMessage(jid, { text })
    } catch (e) {
        console.error('[HealthCheck] Gagal kirim report:', e.message)
    }
}

// ── Start auto health check ───────────────────────────────────────────────────
function startAutoHealthCheck(intervalStr, sock) {
    const parsed = parseInterval(intervalStr)
    if (!parsed) return { success: false, error: 'Format interval salah. Contoh: 30m, 1h, 6h, 1d' }

    stopAutoHealthCheck()

    _sock       = sock
    _intervalMs = parsed.ms
    _intervalStr = parsed.str
    _startedAt  = Date.now()

    _interval = setInterval(async () => {
        _reportCount++
        saveState({ enabled: true, intervalMs: _intervalMs, intervalStr: _intervalStr, reportCount: _reportCount })
        await sendReport(_sock, { isAuto: true, reportNum: _reportCount })
    }, _intervalMs)

    saveState({ enabled: true, intervalMs: _intervalMs, intervalStr: _intervalStr, reportCount: _reportCount })
    return { success: true, intervalStr: parsed.str, ms: parsed.ms }
}

// ── Stop auto health check ────────────────────────────────────────────────────
function stopAutoHealthCheck() {
    if (_interval) {
        clearInterval(_interval)
        _interval = null
    }
    _sock = null
    saveState({ enabled: false, intervalMs: 0, intervalStr: '-', reportCount: _reportCount })
}

// ── Get status ────────────────────────────────────────────────────────────────
function getHealthStatus() {
    return {
        enabled:     !!_interval,
        intervalStr: _intervalStr,
        intervalMs:  _intervalMs,
        reportCount: _reportCount,
        startedAt:   _startedAt,
    }
}

module.exports = {
    collectStats,
    formatReport,
    sendReport,
    startAutoHealthCheck,
    stopAutoHealthCheck,
    getHealthStatus,
    parseInterval,
    fmt,
    fmtUptime,
}
