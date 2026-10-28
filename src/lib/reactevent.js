// lib/reactevent.js
const fs = require('fs')
const path = require('path')
const { getDatabase } = require('./database')

// Semua stub type "notif event grup" (ganti nama, foto, deskripsi, invite link,
// settings, member masuk/keluar/promote/demote, dll)
const GROUP_EVENT_STUBS = new Set([
  21, // GROUP_CHANGE_SUBJECT      - ganti nama grup
  22, // GROUP_CHANGE_ICON         - ganti foto grup
  23, // GROUP_CHANGE_INVITE_LINK  - reset link invite
  24, // GROUP_CHANGE_DESCRIPTION  - ganti deskripsi
  25, // GROUP_CHANGE_RESTRICT     - ubah setting "edit info grup"
  26, // GROUP_CHANGE_ANNOUNCE     - ubah setting "hanya admin kirim pesan"
  27, // GROUP_PARTICIPANT_ADD     - member ditambahkan
  28, // GROUP_PARTICIPANT_REMOVE  - member dikeluarkan
  29, // GROUP_PARTICIPANT_PROMOTE - dijadiin admin
  30, // GROUP_PARTICIPANT_DEMOTE  - admin diturunin
  31, // GROUP_PARTICIPANT_INVITE  - join lewat invite link
  32, // GROUP_PARTICIPANT_LEAVE   - member keluar sendiri
  71, // GROUP_PARTICIPANT_ADD_REQUEST_JOIN - approve join request
])

const DEFAULT_EMOJIS = ['🍓', '🔥', '✨', '🎉', '💥', '😎', '🌸', '⚡']

// ── Global config (bukan per-grup) — disimpen di file JSON terpisah ──────────
const GLOBAL_CONF_PATH = path.join(process.cwd(), 'database', 'main', 'reactevent.global.json')

// Global conf sekarang cuma nyimpen default emoji + default enabled buat GRUP BARU
function getGlobalConf() {
  try {
    if (fs.existsSync(GLOBAL_CONF_PATH)) {
      return JSON.parse(fs.readFileSync(GLOBAL_CONF_PATH, 'utf8'))
    }
  } catch (e) {
    console.error('[reactevent] gagal baca global conf:', e.message)
  }
  return { enabled: true, emojis: [...DEFAULT_EMOJIS] }
}

function saveGlobalConf(conf) {
  try {
    fs.mkdirSync(path.dirname(GLOBAL_CONF_PATH), { recursive: true })
    fs.writeFileSync(GLOBAL_CONF_PATH, JSON.stringify(conf, null, 2))
  } catch (e) {
    console.error('[reactevent] gagal simpan global conf:', e.message)
  }
}

// Baca (atau bikin default) config reactevent buat 1 grup.
// Disimpen nempel di groups.json -> groups[jid].chat.reactevent (persisten).
// Default enabled buat grup baru ngikut niat "global" terakhir.
function getConf(jid) {
  const db = getDatabase()
  const group = db.getGroup(jid) || db.setGroup(jid)
  const chat = group.chat || {}

  if (!chat.reactevent) {
    const gconf = getGlobalConf()
    chat.reactevent = { enabled: gconf.enabled, emojis: [...DEFAULT_EMOJIS] }
    db.setGroup(jid, { chat })
  }

  return chat.reactevent
}

function saveConf(jid, conf) {
  const db = getDatabase()
  const group = db.getGroup(jid) || db.setGroup(jid)
  const chat = group.chat || {}
  chat.reactevent = conf
  db.setGroup(jid, { chat })
  db.markDirty('groups')
}

function pickEmoji(conf) {
  const list = conf.emojis?.length ? conf.emojis : DEFAULT_EMOJIS
  return list[Math.floor(Math.random() * list.length)]
}

// Aksi massal: paksa set enabled ke SEMUA grup yang udah ada di database,
// gak peduli status sebelumnya masing-masing apa.
function setAllGroups(enabled) {
  const db = getDatabase()
  const groups = db.getAllGroups() // <-- cek lagi nama method aslinya di database.js kamu

  for (const jid of Object.keys(groups)) {
    const group = groups[jid]
    const chat = group.chat || {}
    chat.reactevent = {
      enabled,
      emojis: chat.reactevent?.emojis?.length ? chat.reactevent.emojis : [...DEFAULT_EMOJIS]
    }
    db.setGroup(jid, { chat })
  }
  db.markDirty('groups')

  // simpen juga sebagai default buat grup baru yang belum pernah ke-init
  const gconf = getGlobalConf()
  gconf.enabled = enabled
  saveGlobalConf(gconf)
}

function reactEvent(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const m = messages[0]
      if (!m || m.messageStubType == null) return
      if (!GROUP_EVENT_STUBS.has(m.messageStubType)) return

      const jid = m.key.remoteJid
      const conf = getConf(jid)
      if (!conf.enabled) return

      await sock.sendMessage(jid, {
        react: { text: pickEmoji(conf), key: m.key }
      })
    } catch (e) {
      console.error('[reactevent]', e)
    }
  })
}

module.exports = reactEvent
module.exports.getConf = getConf
module.exports.saveConf = saveConf
module.exports.getGlobalConf = getGlobalConf
module.exports.saveGlobalConf = saveGlobalConf
module.exports.setAllGroups = setAllGroups
module.exports.DEFAULT_EMOJIS = DEFAULT_EMOJIS