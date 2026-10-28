const hsAsset = require('../../src/lib/assets')
const { getDatabase } = require('../../src/lib/database')
const config = require('../../config')
const { prepareWAMessageMedia } = require('hsnai')
const { getUptime } = require('../../src/connection')
const fs = require('fs')
const path = require('path')

// ── DB Keys ──────────────────────────────────────────────────────────────────
const DB_KEY            = 'autoSambutOwner'         // per grup: true/false/null (null = ikut global)
const DB_TEXT_KEY       = 'autoSambutOwnerText'     // per grup: teks custom
const DB_LAST_CHAT_KEY  = 'ownerLastChat'           // per grup: { [ownerJid]: timestamp }
const DB_COOLDOWN_KEY   = 'autoSambutOwnerCooldown' // per grup: menit

const GLOBAL_KEY         = 'autoSambutOwnerGlobal'        // di db.data.settings
const GLOBAL_TEXT_KEY    = 'autoSambutOwnerGlobalText'
const GLOBAL_COOLDOWN_KEY= 'autoSambutOwnerGlobalCooldown'

const DEFAULT_COOLDOWN_MENIT = 60
const DEFAULT_TEXT =
  '🌟 *Ownerku dateng~!*\n\nWaaa~ @{owner} akhirnya masuk ke sini juga! Seneng banget~ 💕\nSelamat datang di *{group}* ya kak Owner~\n\nAku udah nungguin dari tadi lho~ ✨'

const pluginConfig = {
  name: 'autosambutowner',
  alias: ['sambutowner', 'asambutowner'],
  category: 'group',
  description: 'Kelola fitur auto sambut owner saat masuk grup — support global & per grup',
  usage: '.autosambutowner <on/off/global/setteks/resetteks/cekteks/setwaktu>',
  example: '.autosambutowner global on\n.autosambutowner on',
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getGlobalSetting(db) {
  return db.data?.settings?.[GLOBAL_KEY] ?? false
}

function setGlobalSetting(db, val) {
  if (!db.data.settings) db.data.settings = {}
  db.data.settings[GLOBAL_KEY] = val
  db.save?.()
}

function getGlobalText(db) {
  return db.data?.settings?.[GLOBAL_TEXT_KEY] || DEFAULT_TEXT
}

function setGlobalText(db, val) {
  if (!db.data.settings) db.data.settings = {}
  db.data.settings[GLOBAL_TEXT_KEY] = val
  db.save?.()
}

function getGlobalCooldown(db) {
  return db.data?.settings?.[GLOBAL_COOLDOWN_KEY] ?? DEFAULT_COOLDOWN_MENIT
}

function setGlobalCooldown(db, val) {
  if (!db.data.settings) db.data.settings = {}
  db.data.settings[GLOBAL_COOLDOWN_KEY] = val
  db.save?.()
}

/**
 * Resolve apakah fitur aktif di grup tertentu:
 * - Per grup null  → ikut global
 * - Per grup true  → aktif (override global)
 * - Per grup false → mati (override global)
 */
function isEnabledForGroup(groupData, db) {
  const perGrup = groupData[DB_KEY]
  if (perGrup === true) return true
  if (perGrup === false) return false
  return getGlobalSetting(db)
}

function getSambutText(groupData, db) {
  return groupData[DB_TEXT_KEY] || getGlobalText(db)
}

function getCooldownMenit(groupData, db) {
  return groupData[DB_COOLDOWN_KEY] ?? getGlobalCooldown(db)
}

function formatUptime(ms) {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}j ${m}m ${s}d`
  if (m > 0) return `${m}m ${s}d`
  return `${s}d`
}

function formatText(text, ownerNumber, groupName, extra = {}) {
  const now = new Date()
  const wib = new Date(now.getTime() + (7 * 60 * 60 * 1000))

  const jam = wib.toTimeString().slice(0, 5) + ' WIB'

  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  const hari = HARI[wib.getUTCDay()]
  const tgl = wib.getUTCDate()
  const bln = BULAN[wib.getUTCMonth()]
  const thn = wib.getUTCFullYear()
  const tanggal = `${hari}, ${tgl} ${bln} ${thn}`

  let uptimeStr = '-'
  try { uptimeStr = formatUptime(getUptime()) } catch {}

  return text
    .replace(/{owner}/g, ownerNumber)
    .replace(/{ownername}/g, extra.ownerName || ownerNumber)
    .replace(/{group}/g, groupName)
    .replace(/{totalmember}/g, extra.totalMember ?? '-')
    .replace(/{botname}/g, config.bot?.name || 'Bot')
    .replace(/{versi}/g, config.bot?.version || config.version || '-')
    .replace(/{uptime}/g, uptimeStr)
    .replace(/{waktu}/g, jam)
    .replace(/{tanggal}/g, tanggal)
    .replace(/{hari}/g, hari)
}

function formatDurasi(menit) {
  if (menit >= 60) {
    const jam = Math.floor(menit / 60)
    const sisa = menit % 60
    return `${jam} jam${sisa ? ` ${sisa} menit` : ''}`
  }
  return `${menit} menit`
}

// ── Handler ───────────────────────────────────────────────────────────────────
async function handler(m, { sock }) {
  const db = getDatabase()
  const args = m.args || []
  const sub = (args[0] || '').toLowerCase()
  const prefix = m.prefix || '.'
  const groupData = m.isGroup ? (db.getGroup(m.chat) || {}) : {}

  // ── .autosambutowner (info) ─────────────────────────────────────────────────
  if (!sub) {
    const globalStatus = getGlobalSetting(db)
    const globalCooldown = getGlobalCooldown(db)
    const globalText = getGlobalText(db)

    let text = `╭─「 👑 *AUTO SAMBUT OWNER* 」\n`
    text += `│\n`
    text += `│ 🌐 *GLOBAL*\n`
    text += `│ Status  : ${globalStatus ? '✅ ON' : '❌ OFF'}\n`
    text += `│ Cooldown: ⏱️ ${formatDurasi(globalCooldown)}\n`
    text += `│ Teks    : ${(globalText).substring(0, 30)}...\n`
    text += `│\n`

    if (m.isGroup) {
      const perGrup = groupData[DB_KEY]
      const resolved = isEnabledForGroup(groupData, db)
      const perGrupCooldown = groupData[DB_COOLDOWN_KEY]
      text += `│ 📌 *GRUP INI*\n`
      text += `│ Override: ${perGrup === true ? '✅ ON' : perGrup === false ? '❌ OFF' : '➖ Ikut global'}\n`
      text += `│ Status  : ${resolved ? '✅ Aktif' : '❌ Nonaktif'}\n`
      if (perGrupCooldown) text += `│ Cooldown: ⏱️ ${formatDurasi(perGrupCooldown)}\n`
      if (groupData[DB_TEXT_KEY]) text += `│ Teks    : Custom ✅\n`
      text += `│\n`
    }

    text += `│ 📌 *Placeholder tersedia:*\n`
    text += `│ {owner}       → nomor owner\n`
    text += `│ {ownername}   → nama display owner\n`
    text += `│ {group}       → nama grup\n`
    text += `│ {totalmember} → jumlah member\n`
    text += `│ {botname}     → nama bot\n`
    text += `│ {versi}       → versi bot\n`
    text += `│ {uptime}      → uptime bot\n`
    text += `│ {waktu}       → jam WIB\n`
    text += `│ {tanggal}     → tanggal lengkap\n`
    text += `│ {hari}        → nama hari\n`
    text += `│\n`
    text += `│ ⚙️ *Perintah Global:*\n`
    text += `│ ${prefix}autosambutowner global on/off\n`
    text += `│ ${prefix}autosambutowner global setteks <teks>\n`
    text += `│ ${prefix}autosambutowner global setwaktu <menit>\n`
    text += `│ ${prefix}autosambutowner global resetteks\n`
    text += `│\n`
    text += `│ ⚙️ *Perintah Per Grup (di dalam grup):*\n`
    text += `│ ${prefix}autosambutowner on/off\n`
    text += `│ ${prefix}autosambutowner reset → ikut global lagi\n`
    text += `│ ${prefix}autosambutowner setteks <teks>\n`
    text += `│ ${prefix}autosambutowner setwaktu <menit>\n`
    text += `│ ${prefix}autosambutowner resetteks\n`
    text += `│ ${prefix}autosambutowner cekteks\n`
    text += `╰────────────────────`

    return m.reply(text)
  }

  // ── .autosambutowner global ... ────────────────────────────────────────────
  if (sub === 'global') {
    const globalSub = (args[1] || '').toLowerCase()

    if (globalSub === 'on') {
      setGlobalSetting(db, true)
      return m.reply(`✅ *Auto sambut owner diaktifkan secara global!*\n\n> Semua grup yang tidak punya override khusus akan ikut setting ini~ 💕`)
    }

    if (globalSub === 'off') {
      setGlobalSetting(db, false)
      return m.reply(`❌ *Auto sambut owner dimatikan secara global!*\n\n> Grup yang punya override ON tetap aktif~ 🌸`)
    }

    if (globalSub === 'setteks' || globalSub === 'settext') {
      const newText = args.slice(2).join(' ').trim()
      if (!newText) return m.reply(`⚠️ Teks tidak boleh kosong!\n> \`${prefix}autosambutowner global setteks Halo @{owner}!\``)
      setGlobalText(db, newText)
      const preview = formatText(newText, m.senderNumber || '628xxx', 'Nama Grup', { ownerName: m.pushName || '628xxx', totalMember: '???' })
      return m.reply(`✅ *Teks global berhasil diubah!*\n\n*Preview:*\n${preview}`)
    }

    if (globalSub === 'resetteks' || globalSub === 'resettext') {
      setGlobalText(db, DEFAULT_TEXT)
      return m.reply(`🔄 *Teks global direset ke default!*`)
    }

    if (globalSub === 'setwaktu' || globalSub === 'setdelay') {
      const menit = parseInt(args[2])
      if (isNaN(menit) || menit < 1) return m.reply(`⚠️ Masukkan menit yang valid (min. 1)!\n> \`${prefix}autosambutowner global setwaktu 60\``)
      setGlobalCooldown(db, menit)
      return m.reply(`⏱️ *Cooldown global diubah ke ${formatDurasi(menit)}!*`)
    }

    return m.reply(`❓ Sub-command global tidak dikenal!\n> global on | off | setteks | resetteks | setwaktu`)
  }

  // ── Per grup — wajib di dalam grup ────────────────────────────────────────
  if (!m.isGroup) {
    return m.reply(`⚠️ Command per-grup harus dijalankan di dalam grup!\n> Untuk setting global, gunakan \`${prefix}autosambutowner global ...\``)
  }

  if (sub === 'on') {
    db.setGroup(m.chat, { [DB_KEY]: true })
    return m.reply(`✅ *Auto sambut owner diaktifkan untuk grup ini!*\n> Override: ON (tidak ikut global lagi)`)
  }

  if (sub === 'off') {
    db.setGroup(m.chat, { [DB_KEY]: false })
    return m.reply(`❌ *Auto sambut owner dimatikan untuk grup ini!*\n> Override: OFF (tidak ikut global lagi)`)
  }

  if (sub === 'reset') {
    db.setGroup(m.chat, { [DB_KEY]: null })
    const globalStatus = getGlobalSetting(db)
    return m.reply(`🔄 *Override grup dihapus!*\n> Grup ini sekarang ikut setting global (${globalStatus ? '✅ ON' : '❌ OFF'})`)
  }

  if (sub === 'setteks' || sub === 'settext') {
    const newText = args.slice(1).join(' ').trim()
    if (!newText) return m.reply(`⚠️ Teks tidak boleh kosong!\n> \`${prefix}autosambutowner setteks Halo @{owner}!\``)
    db.setGroup(m.chat, { [DB_TEXT_KEY]: newText })
    const preview = formatText(newText, m.senderNumber || '628xxx', m.groupName || 'Grup Ini', { ownerName: m.pushName || '628xxx', totalMember: '???' })
    return m.reply(`✅ *Teks sambutan grup berhasil diubah!*\n\n*Preview:*\n${preview}`)
  }

  if (sub === 'resetteks' || sub === 'resettext') {
    db.setGroup(m.chat, { [DB_TEXT_KEY]: null })
    return m.reply(`🔄 *Teks grup direset! Sekarang pakai teks global/default.*`)
  }

  if (sub === 'cekteks' || sub === 'cektext' || sub === 'preview') {
    const currentText = getSambutText(groupData, db)
    const preview = formatText(currentText, m.senderNumber || '628xxx', m.groupName || 'Grup Ini', { ownerName: m.pushName || '628xxx', totalMember: '???' })
    const source = groupData[DB_TEXT_KEY] ? 'per grup' : getGlobalText(db) !== DEFAULT_TEXT ? 'global custom' : 'default'
    return m.reply(`👁️ *Preview teks sambutan owner* (sumber: ${source}):\n\n${preview}`)
  }

  if (sub === 'setwaktu' || sub === 'setdelay') {
    const menit = parseInt(args[1])
    if (isNaN(menit) || menit < 1) return m.reply(`⚠️ Masukkan menit yang valid!\n> \`${prefix}autosambutowner setwaktu 30\``)
    db.setGroup(m.chat, { [DB_COOLDOWN_KEY]: menit })
    return m.reply(`⏱️ *Cooldown grup diubah ke ${formatDurasi(menit)}!*`)
  }

  return m.reply(
    `❓ Sub-command tidak dikenal!\n\n` +
    `*Per grup:* on | off | reset | setteks | resetteks | cekteks | setwaktu\n` +
    `*Global:* global on | off | setteks | resetteks | setwaktu`
  )
}

// ── Track owner last chat (dipanggil dari handler.js) ─────────────────────────
function trackOwnerLastChat(groupJid, ownerJid, db) {
  try {
    if (!config.isOwner(ownerJid)) return
    const groupData = db.getGroup(groupJid) || {}
    const lastChats = groupData[DB_LAST_CHAT_KEY] || {}
    lastChats[ownerJid] = Date.now()
    db.setGroup(groupJid, { [DB_LAST_CHAT_KEY]: lastChats })
  } catch (e) {}
}

// ── handleAutoSambutOwner (dipanggil dari groupUpdate handler) ─────────────────
async function handleAutoSambutOwner(sock, groupJid, participant, groupMeta, db) {
  try {
    if (!config.isOwner(participant)) return

    const groupData = db.getGroup(groupJid) || {}

    // Resolve aktif/tidaknya berdasarkan per-grup + global
    if (!isEnabledForGroup(groupData, db)) return

    // Cek cooldown
    const lastChats = groupData[DB_LAST_CHAT_KEY] || {}
    const lastChat = lastChats[participant] || 0
    const cooldownMs = getCooldownMenit(groupData, db) * 60 * 1000
    if (Date.now() - lastChat < cooldownMs) return

    const ownerNumber = participant.split('@')[0]
    const groupName = groupMeta?.subject || 'grup ini'
    const totalMember = groupMeta?.participants?.length ?? '-'

    // Ambil nama display owner
    let ownerName = ownerNumber
    try {
      const contact = await sock.onWhatsApp(participant)
      ownerName = contact?.[0]?.notify || ownerNumber
    } catch {}

    const rawText = getSambutText(groupData, db)
    const finalText = formatText(rawText, ownerNumber, groupName, { ownerName, totalMember })

    const saluranLink = config.saluran?.link || config.info?.website || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    const botName = config.bot?.name || 'Bot'

    // Thumbnail dari foto profil grup, fallback hsnai.jpg
    let thumbBuf = null
    try {
      const { default: axios } = require('axios')
      const ppUrl = await sock.profilePictureUrl(groupJid, 'image')
      const res = await axios.get(ppUrl, { responseType: 'arraybuffer' })
      thumbBuf = Buffer.from(res.data)
    } catch {

      if (hsAsset.has('images/hsnai')) thumbBuf = (await hsAsset.buffer('images/hsnai'))
    }

    let hqImage = null
    if (thumbBuf) {
      try {
        const { imageMessage } = await prepareWAMessageMedia(
          { image: thumbBuf },
          { upload: sock.waUploadToServer, mediaTypeOverride: 'thumbnail-link' }
        )
        imageMessage.width = 1280
        imageMessage.height = 720
        hqImage = imageMessage
      } catch (e) {
        console.error('[AutoSambutOwner] prepareWAMessageMedia error:', e.message)
      }
    }

    const invisible = '\u200B'.repeat(400)
    const msgText = `${saluranLink}${invisible}\n\n${finalText}`

    await sock.sendMessage(groupJid, {
      text: msgText,
      mentions: [participant],
      linkPreview: {
        'matched-text': saluranLink,
        title: `👑 Owner Masuk — ${botName}`,
        description: groupName,
        previewType: 0,
        jpegThumbnail: thumbBuf,
        ...(hqImage ? { highQualityThumbnail: hqImage } : {}),
        linkPreviewMetadata: { linkMediaDuration: 0, socialMediaPostType: 4 }
      }
    })

    // Update last chat setelah sambutan dikirim
    const updatedLastChats = (db.getGroup(groupJid)?.[DB_LAST_CHAT_KEY]) || {}
    updatedLastChats[participant] = Date.now()
    db.setGroup(groupJid, { [DB_LAST_CHAT_KEY]: updatedLastChats })
  } catch (e) {
    console.error('[AutoSambutOwner] Error:', e.message)
  }
}

module.exports = {
  config: pluginConfig,
  handler,
  handleAutoSambutOwner,
  trackOwnerLastChat
}