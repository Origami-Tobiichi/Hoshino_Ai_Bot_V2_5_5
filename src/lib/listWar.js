const { getDatabase } = require('./database')

const MAX_LISTS = 50
const MAX_TRIGGER_LEN = 40
const cooldown = new Map()

// default OFF: hanya aktif kalau admin menjalankan .listwar on
function isEnabled(chat) {
    const g = getDatabase().getGroup(chat) || {}
    return g.listWar === 'on'
}

function norm(s) {
    return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function getLists(chat) {
    const g = getDatabase().getGroup(chat) || {}
    const lists = g.groupLists
    return lists && typeof lists === 'object' && !Array.isArray(lists) ? lists : {}
}

async function saveLists(chat, lists) {
    const db = getDatabase()
    db.setGroup(chat, { groupLists: lists })
    try { await db.save() } catch {}
}

// "war" -> semua list yang diawali kata "war"; "war m1" -> list itu saja
function findMatches(lists, text) {
    const t = norm(text)
    if (!t || t.length > MAX_TRIGGER_LEN) return []
    if (lists[t]) return [lists[t]]
    const byFirstWord = Object.values(lists).filter(l => l.name.split(' ')[0] === t)
    if (byFirstWord.length) return byFirstWord
    // kata kunci "war" tanpa list bernama war -> kirim semua list di grup
    if (t === 'war') return Object.values(lists)
    return []
}

const EMPTY_TEXT =
    `Tidak Ada List Di Grup Ini, silakan ketik *addlist* untuk membuat baru\n\n` +
    `Hanya *admin* yang dapat menambah / menghapus list`

function renderList(lists) {
    const names = Object.keys(lists)
    let txt = `╭┈┈⬡「 📋 *ᴅᴀꜰᴛᴀʀ ʟɪsᴛ* 」\n`
    for (const n of names) txt += `┃ • ${n}\n`
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n> Ketik nama list (contoh: *${names[0]}*) untuk melihat isinya\n> Hanya admin yang dapat menambah / menghapus list`
    return txt
}

function onCooldown(chat, body) {
    const key = `${chat}|${norm(body)}`
    const last = cooldown.get(key) || 0
    if (Date.now() - last < 5000) return true
    cooldown.set(key, Date.now())
    return false
}

async function handleTrigger(m, sock) {
    if (!m.isGroup || m.fromMe || !m.body) return false
    if (!isEnabled(m.chat)) return false
    const lists = getLists(m.chat)
    const hasLists = Object.keys(lists).length > 0
    const t = norm(m.body)

    // kata "list" polos (tanpa prefix) -> tampilkan daftar / info kosong
    if (t === 'list' && !lists[t]) {
        if (onCooldown(m.chat, m.body)) return true
        await m.reply(hasLists ? renderList(lists) : EMPTY_TEXT)
        return true
    }

    if (!hasLists) return false
    const found = findMatches(lists, m.body)
    if (!found.length) return false
    if (onCooldown(m.chat, m.body)) return true

    await m.reply(found.map(l => l.content).join('\n\n'))
    return true
}

module.exports = { isEnabled, norm, getLists, saveLists, findMatches, handleTrigger, renderList, EMPTY_TEXT, MAX_LISTS }
