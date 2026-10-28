// plugins/group/onlyadmingc.js
// ʜᴏsʜɪɴᴏ ᴀɪ — ᴏɴʟʏᴀᴅᴍɪɴ ᴘᴇʀ ɢʀᴜᴘ
// Mode per grup: on (cuma admin) | off (semua boleh, abaikan onlyadmin global) | default (ikut global)
// Command: .onlyadmingc on|off|default|cek
// Gate dipanggil dari handler.js lewat require('./plugins/group/onlyadmingc').isBlocked(...)

const fs = require('fs')
const path = require('path')

const DB_PATH = path.join(process.cwd(), 'database', 'onlyadmin_gc.json')

function loadAll() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) } catch { return {} }
}
function saveAll(data) {
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
  } catch (e) { console.error('[onlyadmingc] gagal simpan:', e.message) }
}
function getMode(chat) {
  return loadAll()[chat] || 'default'
}
function setMode(chat, mode) {
  const all = loadAll()
  if (mode === 'default') delete all[chat]
  else all[chat] = mode
  saveAll(all)
}

/**
 * true = pesan/command harus DIBLOKIR.
 * globalOnlyAdmin = status onlyadmin global bot (boolean) dari setting-mu.
 */
function isBlocked(chat, { isAdmin = false, isOwner = false, globalOnlyAdmin = false } = {}) {
  if (isAdmin || isOwner) return false
  const mode = getMode(chat)
  if (mode === 'on') return true
  if (mode === 'off') return false
  return !!globalOnlyAdmin
}

async function isGroupAdmin(sock, chat, jid) {
  try {
    const meta = await sock.groupMetadata(chat)
    const p = meta.participants.find(
      x => x.id === jid || x.jid === jid || x.lid === jid
    )
    return !!(p && (p.admin === 'admin' || p.admin === 'superadmin'))
  } catch { return false }
}

const pluginConfig = {
  name: 'onlyadmingc',
  alias: ['adminonlygc', 'oagc'],
  category: 'group',
  description: 'Atur onlyadmin per grup (terpisah dari onlyadmin global)',
  usage: '.onlyadmingc on|off|default|cek',
  isGroup: true
}

async function handler(m, { sock }) {
  const chat = m.chat || m.key?.remoteJid
  const args = (m.args && m.args.length ? m.args : (m.text || '').trim().split(/\s+/).slice(1))
  const sub = (args[0] || '').toLowerCase()
  const mode = getMode(chat)

  const label = { on: 'Hanya admin ⭐', off: 'Semua boleh ✨', default: 'Ikut setting global 🌸' }

  const info = () => m.reply(
    `╭─❖ ᴏɴʟʏᴀᴅᴍɪɴ ɢʀᴜᴘ ❖─\n` +
    `┃ 🎀 Mode grup ini : ${label[mode]}\n` +
    `╰──────────❖\n\n` +
    `Atur (admin):\n` +
    `• .onlyadmingc on → cuma admin yang bisa pakai bot\n` +
    `• .onlyadmingc off → semua member bisa, walau onlyadmin global aktif\n` +
    `• .onlyadmingc default → ikut onlyadmin global 💖`
  )

  if (!sub || sub === 'cek' || sub === 'info') return info()

  const ok = m.key?.fromMe || await isGroupAdmin(sock, chat, m.sender)
  if (!ok) return m.reply('Hehe, cuma admin grup yang boleh ngatur ini ya~ 🎀')

  if (!['on', 'off', 'default'].includes(sub)) return info()
  setMode(chat, sub)
  return m.reply(`Siap! Mode grup ini sekarang: *${label[sub]}* 💫`)
}

module.exports = { config: pluginConfig, handler, isBlocked, getMode, setMode }