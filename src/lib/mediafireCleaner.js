const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')

const QUEUE_PATH = path.join(process.cwd(), 'database', 'mediafireQueue.json')
const CHECK_INTERVAL = 10 * 60 * 1000
const DELETE_DELAY = 24 * 60 * 60 * 1000

const mediafireConfig = {
    email: process.env.MEDIAFIRE_EMAIL || '',
    password: process.env.MEDIAFIRE_PASSWORD || '',
    appId: process.env.MEDIAFIRE_APP_ID || '42511'
}

function _loadQueue() {
    try {
        return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'))
    } catch {
        return []
    }
}

function _saveQueue(queue) {
    fs.mkdirSync(path.dirname(QUEUE_PATH), { recursive: true })
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2))
}

function queueMediafireDelete(quickkey, delayMs = DELETE_DELAY) {
    const queue = _loadQueue()
    queue.push({ quickkey, deleteAt: Date.now() + delayMs })
    _saveQueue(queue)
}

async function _getSessionToken() {
    const { email, password, appId } = mediafireConfig
    const url = `https://www.mediafire.com/api/1.5/user/get_session_token.php?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&application_id=${appId}&token_version=2&response_format=json`
    const res = await fetch(url)
    const data = await res.json()
    if (data?.response?.result !== 'Success') throw new Error(data?.response?.message || 'Login MediaFire gagal')
    return data.response.session_token
}

async function _deleteFile(sessionToken, quickkey) {
    const url = `https://www.mediafire.com/api/1.5/file/delete.php?quick_key=${quickkey}&session_token=${sessionToken}&response_format=json`
    const res = await fetch(url)
    const data = await res.json()
    if (data?.response?.result !== 'Success') throw new Error(data?.response?.message || 'Gagal hapus')
}

let started = false
function startMediafireCleaner() {
    if (started) return
    started = true

    setInterval(async () => {
        const queue = _loadQueue()
        if (queue.length === 0) return

        const now = Date.now()
        const due = queue.filter(q => q.deleteAt <= now)
        if (due.length === 0) return

        const remaining = queue.filter(q => q.deleteAt > now)
        let sessionToken = null
        try {
            sessionToken = await _getSessionToken()
        } catch (e) {
            console.log('[mediafire-cleaner] gagal login:', e.message)
            return
        }

        for (const item of due) {
            try {
                await _deleteFile(sessionToken, item.quickkey)
                console.log('[mediafire-cleaner] terhapus:', item.quickkey)
            } catch (e) {
                console.log('[mediafire-cleaner] gagal hapus:', item.quickkey, e.message)
                remaining.push(item)
            }
        }
        _saveQueue(remaining)
    }, CHECK_INTERVAL)

    console.log('[mediafire-cleaner] aktif, cek tiap 10 menit')
}

module.exports = { queueMediafireDelete, startMediafireCleaner }