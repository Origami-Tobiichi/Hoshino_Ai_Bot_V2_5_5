const path = require('path')
const fs   = require('fs')

const LOG_FILE    = path.join(__dirname, '../../data/consoleLog.json')
const MAX_ENTRIES = 500

let logs = []
let patched = false
const originalConsoleLog = console.log.bind(console)

function loadLogs() {
    try {
        if (fs.existsSync(LOG_FILE)) logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'))
    } catch {
        logs = []
    }
}

function saveLogs() {
    try {
        fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })
        fs.writeFileSync(LOG_FILE, JSON.stringify(logs.slice(-MAX_ENTRIES), null, 2))
    } catch (e) {
        originalConsoleLog('[consoleLog] Gagal simpan log:', e.message)
    }
}

// ── Cari file plugin pemanggil lewat stack trace ────────────────────────────
function getCallerPluginFile() {
    const stackLines = new Error().stack.split('\n').slice(1)
    for (const line of stackLines) {
        const match = line.match(/\(?(.*?):(\d+):(\d+)\)?$/)
        if (!match) continue
        const filePath = match[1]
        if (filePath.includes(`${path.sep}plugins${path.sep}`) && !filePath.includes('consoleLog.js')) {
            return path.basename(filePath)
        }
    }
    return null // bukan dipanggil dari plugin, skip
}

function patchConsole() {
    if (patched) return
    patched = true
    loadLogs()

    console.log = (...args) => {
        originalConsoleLog(...args) // tetap print seperti biasa

        const file = getCallerPluginFile()
        if (!file) return // hanya rekam kalau asalnya dari plugins/

        const message = args.map(a => {
            if (typeof a === 'string') return a
            try { return JSON.stringify(a) } catch { return String(a) }
        }).join(' ')

        logs.push({
            timestamp: new Date().toISOString(),
            file,
            message: message.substring(0, 1000)
        })

        if (logs.length > MAX_ENTRIES) logs = logs.slice(-MAX_ENTRIES)
        saveLogs()
    }
}

function getRecentLogs(limit = 5) {
    return logs.slice(-limit).reverse()
}

function getAllLogs() {
    return [...logs].reverse()
}

function getLogStats() {
    if (!logs.length) return null

    const now = Date.now()
    const last24h = logs.filter(l => now - new Date(l.timestamp).getTime() < 86400000).length
    const last7d  = logs.filter(l => now - new Date(l.timestamp).getTime() < 604800000).length

    const fileCount = {}
    for (const l of logs) fileCount[l.file] = (fileCount[l.file] || 0) + 1
    const topFile = Object.entries(fileCount).sort((a, b) => b[1] - a[1]).slice(0, 5)

    return {
        total: logs.length,
        last24h,
        last7d,
        oldest: logs[0]?.timestamp,
        newest: logs[logs.length - 1]?.timestamp,
        topFile
    }
}

function clearLogs() {
    logs = []
    saveLogs()
}

function clearOlderThan(days) {
    const cutoff = Date.now() - days * 86400000
    logs = logs.filter(l => new Date(l.timestamp).getTime() >= cutoff)
    saveLogs()
    return logs.length
}

patchConsole()

module.exports = {
    getRecentLogs,
    getAllLogs,
    getLogStats,
    clearLogs,
    clearOlderThan
}