/**
 * errorLog.js - Error Logger Library
 * Import di handler.js untuk nyimpen error runtime
 * 
 * Usage di handler.js (catch block):
 *   const { logError } = require('./lib/errorLog')
 *   logError(error, { command: m.command, sender: m.sender, chat: m.chat })
 */

const fs   = require('fs')
const path = require('path')

const LOG_DIR  = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'error.log')

const MAX_ENTRIES = 200  // maksimal entry yang disimpan

// ── Pastikan folder logs ada ──────────────────────────────────────────────────
function ensureDir() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true })
    }
}

// ── Baca semua log ────────────────────────────────────────────────────────────
function readLogs() {
    ensureDir()
    if (!fs.existsSync(LOG_FILE)) return []
    try {
        const raw = fs.readFileSync(LOG_FILE, 'utf-8').trim()
        if (!raw) return []
        return JSON.parse(raw)
    } catch {
        return []
    }
}

// ── Tulis semua log ───────────────────────────────────────────────────────────
function writeLogs(logs) {
    ensureDir()
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8')
}

// ── Tambah entry error baru ───────────────────────────────────────────────────
function logError(error, context = {}) {
    try {
        const logs = readLogs()

        const entry = {
            id:        Date.now(),
            timestamp: new Date().toISOString(),
            message:   error?.message || String(error),
            stack:     error?.stack?.split('\n').slice(0, 5).join('\n') || null,
            command:   context.command  || null,
            sender:    context.sender   || null,
            chat:      context.chat     || null,
            args:      context.args     || null,
            plugin:    context.plugin   || null,
        }

        logs.unshift(entry)  // terbaru di atas

        // Trim kalau melebihi MAX_ENTRIES
        if (logs.length > MAX_ENTRIES) {
            logs.splice(MAX_ENTRIES)
        }

        writeLogs(logs)
    } catch {
        // silent — jangan sampai error logger malah crash handler
    }
}

// ── Ambil N error terakhir ────────────────────────────────────────────────────
function getRecentErrors(n = 10) {
    return readLogs().slice(0, n)
}

// ── Ambil semua error ─────────────────────────────────────────────────────────
function getAllErrors() {
    return readLogs()
}

// ── Hapus semua log ───────────────────────────────────────────────────────────
function clearLogs() {
    writeLogs([])
}

// ── Hapus log lebih tua dari X hari ──────────────────────────────────────────
function clearOlderThan(days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    const logs   = readLogs().filter(e => e.id > cutoff)
    writeLogs(logs)
    return logs.length
}

// ── Statistik error ───────────────────────────────────────────────────────────
function getErrorStats() {
    const logs = readLogs()
    if (!logs.length) return null

    const now      = Date.now()
    const last24h  = logs.filter(e => now - e.id < 86400000)
    const last7d   = logs.filter(e => now - e.id < 7 * 86400000)

    // Command paling sering error
    const cmdCount = {}
    for (const e of logs) {
        if (e.command) cmdCount[e.command] = (cmdCount[e.command] || 0) + 1
    }
    const topCmd = Object.entries(cmdCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)

    // Pesan error paling sering
    const msgCount = {}
    for (const e of logs) {
        const key = (e.message || '').substring(0, 60)
        msgCount[key] = (msgCount[key] || 0) + 1
    }
    const topMsg = Object.entries(msgCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)

    return {
        total:   logs.length,
        last24h: last24h.length,
        last7d:  last7d.length,
        topCmd,
        topMsg,
        oldest:  logs[logs.length - 1]?.timestamp || null,
        newest:  logs[0]?.timestamp || null,
    }
}

module.exports = {
    logError,
    getRecentErrors,
    getAllErrors,
    clearLogs,
    clearOlderThan,
    getErrorStats,
}
