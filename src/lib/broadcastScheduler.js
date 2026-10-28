/**
 * broadcastScheduler.js - Library untuk schedulebroadcast.js
 * Jadwalkan broadcast (teks/media) ke target grup/user/all di tanggal & jam tertentu (one-time atau repeat harian).
 */

const fs = require('fs')
const path = require('path')
const moment = require('moment-timezone')
const { logger } = require('./colors')

const STATE_FILE = path.join(process.cwd(), 'database', 'other', 'broadcastSchedule.json')
const TZ = 'Asia/Jakarta'

const activeTimers = new Map() // id -> timeoutId
let _sock = null

// ── Persist ──────────────────────────────────────────────────────────────────
function ensureDir() {
    const dir = path.dirname(STATE_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function loadTasks() {
    try {
        ensureDir()
        if (fs.existsSync(STATE_FILE)) {
            return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
        }
    } catch {}
    return []
}

function saveTasks(tasks) {
    try {
        ensureDir()
        fs.writeFileSync(STATE_FILE, JSON.stringify(tasks, null, 2), 'utf8')
    } catch (e) {
        logger?.error?.('BroadcastScheduler', `Gagal simpan: ${e.message}`)
    }
}

function getTask(id) {
    return loadTasks().find(t => t.id === id) || null
}

function upsertTask(task) {
    const tasks = loadTasks()
    const idx = tasks.findIndex(t => t.id === task.id)
    if (idx >= 0) tasks[idx] = task
    else tasks.push(task)
    saveTasks(tasks)
}

function removeTask(id) {
    const tasks = loadTasks()
    const filtered = tasks.filter(t => t.id !== id)
    saveTasks(filtered)
    return filtered.length !== tasks.length
}

// ── Resolve target JIDs ──────────────────────────────────────────────────────
async function resolveTargets(targetType, sock, db) {
    let targets = []

    if (targetType === 'grup' || targetType === 'all') {
        try {
            const chats = await sock.groupFetchAllParticipating()
            targets.push(...Object.keys(chats || {}))
        } catch {}
    }

    if (targetType === 'user' || targetType === 'all') {
        try {
            const users = db.data.users || {}
            targets.push(...Object.keys(users).filter(j => j.endsWith('@s.whatsapp.net')))
        } catch {}
    }

    return [...new Set(targets)]
}

// ── Eksekusi broadcast ────────────────────────────────────────────────────────
const delay = ms => new Promise(res => setTimeout(res, ms))

async function executeBroadcast(task) {
    if (!_sock) {
        logger.error('BroadcastScheduler', `Sock belum siap, broadcast ${task.id} dilewati`)
        return
    }

    const { getDatabase } = require('./database')
    const db = getDatabase()

    const targets = await resolveTargets(task.targetType, _sock, db)

    let success = 0
    let fail = 0

    for (const jid of targets) {
        try {
            if (task.media) {
                const buffer = Buffer.from(task.media.data, 'base64')
                const mimetype = task.media.mimetype || ''

                if (mimetype.startsWith('video/')) {
                    await _sock.sendMessage(jid, { video: buffer, caption: task.text || '', mimetype })
                } else if (mimetype.startsWith('application/')) {
                    await _sock.sendMessage(jid, { document: buffer, caption: task.text || '', mimetype, fileName: task.media.fileName || 'file' })
                } else {
                    await _sock.sendMessage(jid, { image: buffer, caption: task.text || '' })
                }
            } else {
                await _sock.sendMessage(jid, { text: task.text })
            }
            success++
        } catch {
            fail++
        }
        await delay(1500)
    }

    logger.success('BroadcastScheduler', `Broadcast ${task.id} selesai: ${success} sukses, ${fail} gagal dari ${targets.length} target`)

    // Notif ke owner
    try {
        const config = require('../../config')
        const ownerNumber = config.owner?.number?.[0]
        if (ownerNumber) {
            await _sock.sendMessage(ownerNumber + '@s.whatsapp.net', {
                text: `📣 *sᴄʜᴇᴅᴜʟᴇᴅ ʙʀᴏᴀᴅᴄᴀsᴛ sᴇʟᴇsᴀɪ*\n\n` +
                      `> 🆔 ID: ${task.id}\n` +
                      `> 🎯 Target: *${task.targetType}* (${targets.length})\n` +
                      `> ✅ Sukses: *${success}*\n` +
                      `> ❌ Gagal: *${fail}*\n` +
                      `> 🔁 Repeat: ${task.repeat ? 'Harian' : 'Sekali'}`
            })
        }
    } catch {}

    task.lastRun = new Date().toISOString()
    task.runCount = (task.runCount || 0) + 1

    if (task.repeat) {
        scheduleTask(task)
    } else {
        removeTask(task.id)
        activeTimers.delete(task.id)
    }
}

// ── Hitung ms sampai waktu eksekusi ───────────────────────────────────────────
function getRunAt(task) {
    if (task.repeat) {
        // Repeat harian: cari jam:menit hari ini/besok
        const now = moment.tz(TZ)
        let target = moment.tz(TZ).hour(task.hour).minute(task.minute).second(0).millisecond(0)
        if (target.isSameOrBefore(now)) target.add(1, 'day')
        return target.valueOf()
    }
    // One-time: pakai timestamp absolut yang udah disimpan
    return task.runAt
}

// ── Jadwalkan 1 task ──────────────────────────────────────────────────────────
function scheduleTask(task) {
    if (activeTimers.has(task.id)) {
        clearTimeout(activeTimers.get(task.id))
        activeTimers.delete(task.id)
    }

    const runAt = getRunAt(task)
    task.runAt = runAt
    upsertTask(task)

    const msUntil = Math.max(0, runAt - Date.now())

    // setTimeout max ~24.8 hari, untuk delay lebih lama dipecah bertahap
    const MAX_DELAY = 2147483647 // ~24.8 hari

    const fire = () => {
        const remaining = runAt - Date.now()
        if (remaining > MAX_DELAY) {
            const t = setTimeout(fire, MAX_DELAY)
            activeTimers.set(task.id, t)
            return
        }
        const t = setTimeout(() => executeBroadcast(task), Math.max(0, remaining))
        activeTimers.set(task.id, t)
    }

    fire()

    logger.info('BroadcastScheduler', `Task ${task.id} dijadwalkan pada ${moment(runAt).tz(TZ).format('DD/MM/YYYY HH:mm')} WIB`)

    return task
}

// ── Tambah scheduled broadcast baru ───────────────────────────────────────────
/**
 * @param {Object} opts
 * @param {string} opts.text - Isi pesan
 * @param {string} opts.targetType - 'grup' | 'user' | 'all'
 * @param {number} opts.runAt - timestamp ms untuk one-time
 * @param {boolean} [opts.repeat] - repeat harian
 * @param {number} [opts.hour] - dipakai kalau repeat
 * @param {number} [opts.minute] - dipakai kalau repeat
 * @param {Object} [opts.media] - { data (base64), mimetype, fileName }
 */
function addScheduledBroadcast(opts) {
    const id = `bcsched_${Date.now()}`
    const task = {
        id,
        text: opts.text || '',
        targetType: opts.targetType || 'grup',
        repeat: !!opts.repeat,
        hour: opts.hour,
        minute: opts.minute,
        runAt: opts.runAt,
        media: opts.media || null,
        createdAt: new Date().toISOString(),
        runCount: 0,
    }

    return scheduleTask(task)
}

function cancelScheduledBroadcast(id) {
    if (activeTimers.has(id)) {
        clearTimeout(activeTimers.get(id))
        activeTimers.delete(id)
    }
    return removeTask(id)
}

function getScheduledBroadcasts() {
    return loadTasks()
}

// ── Init saat koneksi terbuka ──────────────────────────────────────────────────
function initBroadcastScheduler(sock) {
    _sock = sock

    const tasks = loadTasks()
    for (const task of tasks) {
        // Buang task one-time yang udah lewat & ga repeat
        if (!task.repeat && task.runAt && task.runAt < Date.now()) {
            removeTask(task.id)
            continue
        }
        scheduleTask(task)
    }

    logger.info('BroadcastScheduler', `Loaded ${loadTasks().length} scheduled broadcast`)
}

module.exports = {
    initBroadcastScheduler,
    addScheduledBroadcast,
    cancelScheduledBroadcast,
    getScheduledBroadcasts,
    getTask,
}
