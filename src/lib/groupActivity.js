/**
 * groupActivity.js - Tracker aktivitas grup untuk groupsummary.js
 * Menyimpan timestamp pesan & command per user per grup, untuk rekap 24 jam.
 */

const fs = require('fs')
const path = require('path')

const DATA_FILE = path.join(process.cwd(), 'database', 'other', 'groupActivity.json')
const MAX_AGE_MS = 26 * 60 * 60 * 1000 // simpan sedikit lebih dari 24 jam buat buffer

let cache = null
let dirty = false
let saveTimer = null

function ensureDir() {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function load() {
    if (cache) return cache
    try {
        ensureDir()
        if (fs.existsSync(DATA_FILE)) {
            cache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
        } else {
            cache = {}
        }
    } catch {
        cache = {}
    }
    return cache
}

function scheduleSave() {
    dirty = true
    if (saveTimer) return
    saveTimer = setTimeout(() => {
        saveTimer = null
        if (!dirty) return
        try {
            ensureDir()
            fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2), 'utf8')
            dirty = false
        } catch (e) {
            console.error('[GroupActivity] Gagal simpan:', e.message)
        }
    }, 3000)
}

function prune(groupData, now) {
    // Buang entry pesan/command yang udah lebih dari MAX_AGE_MS
    for (const sender in groupData.users || {}) {
        const u = groupData.users[sender]
        if (u.messages) u.messages = u.messages.filter(t => now - t < MAX_AGE_MS)
        if (u.commands) u.commands = u.commands.filter(c => now - c.t < MAX_AGE_MS)
        if ((!u.messages || !u.messages.length) && (!u.commands || !u.commands.length)) {
            delete groupData.users[sender]
        }
    }
}

/**
 * Catat 1 pesan masuk dari user di grup
 */
function recordMessage(chat, sender) {
    const data = load()
    const now = Date.now()
    if (!data[chat]) data[chat] = { users: {} }
    if (!data[chat].users[sender]) data[chat].users[sender] = { messages: [], commands: [] }

    data[chat].users[sender].messages.push(now)
    scheduleSave()
}

/**
 * Catat 1 eksekusi command dari user di grup
 */
function recordCommand(chat, sender, command) {
    const data = load()
    const now = Date.now()
    if (!data[chat]) data[chat] = { users: {} }
    if (!data[chat].users[sender]) data[chat].users[sender] = { messages: [], commands: [] }

    data[chat].users[sender].commands.push({ t: now, cmd: command })
    scheduleSave()
}

/**
 * Ambil rekap aktivitas grup dalam X jam terakhir (default 24)
 * @returns {{
 *   totalMessages: number,
 *   totalCommands: number,
 *   activeUsers: {jid: string, messages: number, commands: number}[],
 *   topCommands: {cmd: string, count: number}[]
 * }}
 */
function getSummary(chat, hours = 24) {
    const data = load()
    const now = Date.now()
    const windowMs = hours * 60 * 60 * 1000
    const groupData = data[chat]

    if (!groupData || !groupData.users) {
        return { totalMessages: 0, totalCommands: 0, activeUsers: [], topCommands: [] }
    }

    prune(groupData, now)

    let totalMessages = 0
    let totalCommands = 0
    const activeUsers = []
    const cmdCount = {}

    for (const sender in groupData.users) {
        const u = groupData.users[sender]
        const messages = (u.messages || []).filter(t => now - t < windowMs)
        const commands = (u.commands || []).filter(c => now - c.t < windowMs)

        for (const c of commands) {
            cmdCount[c.cmd] = (cmdCount[c.cmd] || 0) + 1
        }

        totalMessages += messages.length
        totalCommands += commands.length

        if (messages.length || commands.length) {
            activeUsers.push({ jid: sender, messages: messages.length, commands: commands.length })
        }
    }

    activeUsers.sort((a, b) => (b.messages + b.commands) - (a.messages + a.commands))

    const topCommands = Object.entries(cmdCount)
        .sort((a, b) => b[1] - a[1])
        .map(([cmd, count]) => ({ cmd, count }))

    return { totalMessages, totalCommands, activeUsers, topCommands }
}

module.exports = {
    recordMessage,
    recordCommand,
    getSummary,
}
