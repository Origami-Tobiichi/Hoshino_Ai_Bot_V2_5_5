/*
 * TempMail Lib ( Token Support )
 * Sumber logic: temp-mail.io (Ryusei Hoshino)
 */

const fs = require('fs/promises')
const path = require('path')

const DB_PATH = path.join(__dirname, '../../data/tempMails.json')

async function readDb() {
    try {
        const content = await fs.readFile(DB_PATH, 'utf8')
        return JSON.parse(content)
    } catch {
        return { emails: {}, bySender: {} }
    }
}

async function writeDb(data) {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true })
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2))
}

// ── Bikin email baru, jadiin "aktif" buat sender ini ──────────────────────────
async function createEmail(senderJid) {
    const response = await fetch('https://api.internal.temp-mail.io/api/v3/email/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ min_name_length: 10, max_name_length: 10 })
    })

    if (!response.ok) throw new Error(`Gagal generate email: ${response.status}`)

    const data = await response.json()
    if (!data.email || !data.token) throw new Error('Response API tidak lengkap (email/token kosong)')

    const db = await readDb()
    db.emails[data.email] = { token: data.token, created_at: new Date().toISOString(), owner: senderJid }
    db.bySender[senderJid] = data.email
    await writeDb(db)

    return { email: data.email, token: data.token }
}

async function getActiveEmail(senderJid) {
    const db = await readDb()
    const email = db.bySender[senderJid]
    if (!email || !db.emails[email]) return null
    return { email, ...db.emails[email] }
}

async function deleteActiveEmail(senderJid) {
    const db = await readDb()
    const email = db.bySender[senderJid]
    if (!email) return false
    delete db.emails[email]
    delete db.bySender[senderJid]
    await writeDb(db)
    return true
}

// ── Cek inbox ──────────────────────────────────────────────────────────────
async function checkInbox(email, token) {
    if (!email || !token) throw new Error('Parameter email dan token wajib diisi.')

    const response = await fetch(
        `https://api.internal.temp-mail.io/api/v3/email/${email}/messages?token=${encodeURIComponent(token)}`,
        {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                origin: 'https://temp-mail.io',
                referer: 'https://temp-mail.io/',
                'application-name': 'web',
                'application-version': '4.0.0',
                'user-agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0',
            },
        },
    )

    const text = await response.text()
    let inboxData = []
    try {
        inboxData = JSON.parse(text)
    } catch {
        try {
            inboxData = JSON.parse(text.replace(/^\uFEFF/, '').trim())
        } catch {
            inboxData = []
        }
    }

    const result = {
        success: response.ok,
        httpStatus: response.status,
        extractedLinks: [],
        inbox_data: inboxData,
    }

    if (!response.ok) {
        result.error = `HTTP Error dari temp-mail: ${response.status}`
        return result
    }

    if (Array.isArray(inboxData) && inboxData.length > 0) {
        const bodyText = inboxData[0].body_text || ''
        const matches = bodyText.match(/https:\/\/[^\s"'><)]+/g)
        if (matches) result.extractedLinks = [...new Set(matches)]
    }

    return result
}

module.exports = { createEmail, getActiveEmail, deleteActiveEmail, checkInbox }