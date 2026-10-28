const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'lapor',
    alias: ['report', 'laporerror', 'bugreport', 'setlapor'],
    category: 'tools',
    description: 'Laporkan bug/error fitur ke owner',
    usage: '.lapor [deskripsi masalah] | .setlapor <nomor/@tag/reply>',
    example: '.lapor fitur addsong error | .setlapor 6281234567890',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 0,
    isEnabled: true
}

if (!global.laporSessions) global.laporSessions = new Map()

// ── Limit harian per user ─────────────────────────────────────────────────────
const DAILY_LIMIT = 3

if (!global.laporCount) global.laporCount = new Map()

function checkLimit(sender) {
    const today = new Date().toDateString()
    const data  = global.laporCount.get(sender)
    if (!data || data.date !== today) {
        global.laporCount.set(sender, { count: 0, date: today })
        return { ok: true, count: 0 }
    }
    if (data.count >= DAILY_LIMIT) return { ok: false, count: data.count }
    return { ok: true, count: data.count }
}

function incrementCount(sender) {
    const today = new Date().toDateString()
    const data  = global.laporCount.get(sender) || { count: 0, date: today }
    global.laporCount.set(sender, { count: data.count + 1, date: today })
}

// ── Ambil semua nomor owner yang valid ───────────────────────────────────────
function getAllOwnerNumbers(db, config) {
    const configOwners = [].concat(config.owner?.number || [])
    const dbOwners     = Array.isArray(db.db?.data?.owner) ? db.db.data.owner : []
    return [...new Set([...configOwners, ...dbOwners])]
        .map(n => String(n).replace(/[^0-9]/g, ''))
        .filter(n => n.length >= 10)
}

// ── Ambil nomor tujuan laporan ────────────────────────────────────────────────
function getLaporTarget(db, config) {
    const setting = db.setting('laporTarget')
    if (setting) return setting
    return (config.owner?.number?.[0] || '') + '@s.whatsapp.net'
}


// ── Ekstrak nomor dari tag, reply, atau teks ──────────────────────────────────
function extractNomor(m, arg) {
    let nomor = ''

    if (m.quoted) {
        nomor = (m.quoted.sender || '').replace(/[^0-9]/g, '')
    } else if (m.mentionedJid?.length) {
        nomor = m.mentionedJid[0].replace(/[^0-9]/g, '')
    } else if (arg) {
        nomor = arg.replace(/[^0-9]/g, '')
    }

    // Normalisasi 08xxx → 628xxx
    if (nomor.startsWith('08')) nomor = '62' + nomor.slice(1)

    return nomor
}

async function handler(m, { sock, config }) {
    const db = getDatabase()

    // ════════════════════════════════════════════════════════════════════════
    // .setlapor — khusus owner
    // ════════════════════════════════════════════════════════════════════════
    if (m.command === 'setlapor') {
        if (!m.isOwner) {
            return m.reply(`❌ *Cuma owner yang bisa setlapor~*`)
        }

        const arg      = m.args?.[0]?.trim() || ''
        const hasInput = arg || m.quoted || m.mentionedJid?.length

        // .setlapor (tanpa apapun) — lihat target saat ini
        if (!hasInput) {
            const current = getLaporTarget(db, config)
            const num     = current.replace('@s.whatsapp.net', '')
            return m.reply(
                `⚙️ *sᴇᴛʟᴀᴘᴏʀ*\n\n` +
                `╭┈┈⬡「 📋 *ɪɴꜰᴏ* 」\n` +
                `┃ 📤 Target laporan saat ini:\n` +
                `┃    *${num}*\n` +
                `╰┈┈┈┈┈┈┈┈⬡\n\n` +
                `*ᴄᴀʀᴀ ᴜʙᴀʜ:*\n` +
                `> \`.setlapor 6281234567890\` — ketik nomor\n` +
                `> \`.setlapor @tag\` — tag mention\n` +
                `> reply pesan + \`.setlapor\` — dari reply\n` +
                `> \`.setlapor reset\` — balik ke default owner`
            )
        }

        // .setlapor reset
        if (arg.toLowerCase() === 'reset') {
            db.setting('laporTarget', null)
            const defaultNum = config.owner?.number?.[0]
            return m.reply(
                `✅ *Target laporan direset~*\n\n` +
                `> Sekarang laporan kembali ke:\n` +
                `> *${defaultNum}* (default owner)`
            )
        }

        // Ekstrak nomor
        const nomor = extractNomor(m, arg)

        if (!nomor || nomor.length < 10 || nomor.length > 15) {
            return m.reply(
                `❌ *Nomor tidak valid~*\n\n` +
                `> Bisa ketik nomor, tag @mention, atau reply pesan\n` +
                `> Contoh: \`.setlapor 6281234567890\``
            )
        }

        // ── Validasi harus owner ──────────────────────────────────────────────
        const allOwners = getAllOwnerNumbers(db, config)

        if (!allOwners.includes(nomor)) {
            return m.reply(
                `❌ *Nomor bukan owner~*\n\n` +
                `╭┈┈⬡「 🚫 *ɪɴꜰᴏ* 」\n` +
                `┃ *${nomor}* tidak terdaftar sebagai owner\n` +
                `╰┈┈┈┈┈┈┈┈⬡\n\n` +
                `> Laporan hanya bisa diarahkan ke owner terdaftar~\n` +
                `> Tambah owner dulu via \`.addowner\``
            )
        }

        db.setting('laporTarget', nomor + '@s.whatsapp.net')

        m.react('✅')
        return m.reply(
            `✅ *Target laporan diubah~*\n\n` +
            `╭┈┈⬡「 ⚙️ *sᴇᴛᴛɪɴɢ* 」\n` +
            `┃ 📤 Laporan sekarang dikirim ke:\n` +
            `┃    *${nomor}* ✅ Owner\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> Gunakan \`.setlapor reset\` untuk balik ke default~`
        )
    }

    // ════════════════════════════════════════════════════════════════════════
    // .lapor — user biasa
    // ════════════════════════════════════════════════════════════════════════
    const deskripsi = m.args?.join(' ')?.trim()
    const adaGambar = m.isImage || m.type === 'imageMessage' || m.message?.imageMessage

    if (!deskripsi) {
        return m.reply(
            `⭐ *Ai Hoshino — Lapor Bug!*\n\n` +
            `Eeh~? Mau lapor apa nih? 🌸\n` +
            `Ceritain dulu masalahnya biar Ai bisa sampaikan ke owner ya~\n\n` +
            `*Cara pakainya:*\n` +
            `> \`${m.prefix}lapor [deskripsi masalah]\`\n` +
            `> Boleh juga kirim gambar bukti errornya~ 📸\n\n` +
            `*Contoh:*\n` +
            `> \`${m.prefix}lapor fitur addsong error waktu proses video\`\n\n` +
            `> Aku tunggu laporannya ya~ 💕`
        )
    }

    // ── Cek limit harian ──────────────────────────────────────────────────────
    const limitCheck = checkLimit(m.sender)
    if (!limitCheck.ok) {
        return m.reply(
            `⚠️ *ʟɪᴍɪᴛ ʟᴀᴘᴏʀ ʜᴀʀɪᴀɴ~*\n\n` +
            `╭┈┈⬡「 🚫 *ɪɴꜰᴏ* 」\n` +
            `┃ Kamu sudah lapor *${limitCheck.count}x* hari ini\n` +
            `┃ Batas: *${DAILY_LIMIT}x per hari*\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> Coba lagi besok ya~ Ai sayang kamu tapi harus adil~ 💕`
        )
    }

    await m.react('📨')

    try {
        const targetJid  = getLaporTarget(db, config)
        const senderJid  = m.sender || m.chat
        const senderName = m.pushName || senderJid.split('@')[0]
        const chatJid    = m.chat
        const isGroup    = chatJid?.endsWith('@g.us')
        const waktu      = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
        const metadata   = `\n\n__LAPOR__sender=${senderJid}__chat=${chatJid}__`
        const sisaLimit  = DAILY_LIMIT - (limitCheck.count + 1)

        const captionLaporan =
            `🚨 *LAPORAN BUG MASUK~!*\n\n` +
            `👤 *Dari:* ${senderName} (@${senderJid.split('@')[0]})\n` +
            `📍 *Lokasi:* ${isGroup ? `Grup (${chatJid})` : 'Private Chat'}\n` +
            `🕐 *Waktu:* ${waktu}\n` +
            `📊 *Laporan hari ini:* ${limitCheck.count + 1}/${DAILY_LIMIT}\n\n` +
            `📝 *Deskripsi Masalah:*\n` +
            `> ${deskripsi}\n\n` +
            `> Reply pesan ini untuk membalas ke user~ 💕⭐` +
            metadata

        let sentMsg = null

        if (adaGambar) {
            const imgBuffer = await m.download()
            if (imgBuffer && imgBuffer.length > 0) {
                sentMsg = await sock.sendMedia(targetJid, imgBuffer, captionLaporan, null, {
                    type: 'image',
                    mentions: [senderJid]
                })
            } else {
                sentMsg = await sock.sendMessage(targetJid, {
                    text: captionLaporan + `\n_(Gambar bukti gagal diunduh)_`,
                    mentions: [senderJid]
                })
            }
        } else {
            sentMsg = await sock.sendMessage(targetJid, {
                text: captionLaporan,
                mentions: [senderJid]
            })
        }

        if (sentMsg?.key?.id) {
            global.laporSessions.set(sentMsg.key.id, {
                senderJid,
                senderName,
                chatJid
            })
        }

        incrementCount(m.sender)

        await m.react('✅')
        await m.reply(
            `⭐ *Ai Hoshino — Lapor Bug!*\n\n` +
            `Laporan kamu udah Ai sampaikan~ 📨✨\n` +
            `Sabar ya, owner pasti segera balas~ 🌸\n\n` +
            `╭┈┈⬡「 📊 *ɪɴꜰᴏ* 」\n` +
            `┃ Sisa laporan hari ini: *${sisaLimit}x*\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> *"Makasih udah lapor~ Ai senang ada yang peduli!"* 💕`
        )

    } catch (error) {
        console.error('[Lapor] Error:', error)
        await m.react('💔')
        await m.reply(
            `⭐ *Ai Hoshino — Lapor Bug!*\n\n` +
            `Kyaa~ gagal ngirim laporannya nih~ 😢\n` +
            `> _${error.message}_\n\n` +
            `> Coba lagi nanti ya~ 💕`
        )
    }
}

// ── replyHandler — owner reply laporan ───────────────────────────────────────
async function replyHandler(m, { sock }) {
    if (!m.isOwner) return false
    if (!m.quoted?.id) return false

    const quotedText  = m.quoted?.text || m.quoted?.caption || ''
    const metaMatch   = quotedText.match(/__LAPOR__sender=([^_]+)__chat=([^_]+)__/)
    const sessionData = global.laporSessions?.get(m.quoted.id)

    const senderJid  = metaMatch?.[1] || sessionData?.senderJid
    const chatJid    = metaMatch?.[2] || sessionData?.chatJid
    const senderName = sessionData?.senderName || senderJid?.split('@')[0]

    if (!senderJid || !chatJid) return false

    const jawabanOwner = m.text?.trim() || m.body?.trim()
    if (!jawabanOwner) return false

    try {
        const isGroup = chatJid.endsWith('@g.us')
        const tagUser = `@${senderJid.split('@')[0]}`
        const waktu   = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })

        await sock.sendMessage(chatJid, {
            text:
                `⭐ *Ai Hoshino — Balasan Owner!*\n\n` +
                `Haii ${tagUser}~ Ada balasan dari owner nih~ 🌸\n\n` +
                `💬 *Jawaban Owner:*\n` +
                `> ${jawabanOwner}\n\n` +
                `🕐 *Waktu:* ${waktu}\n\n` +
                `> Semoga masalahnya udah kelar ya~ 💕✨`,
            mentions: isGroup ? [senderJid] : []
        })

        await m.reply(
            `⭐ *Ai Hoshino — Lapor Bug!*\n\n` +
            `Balasanmu udah Ai terusin ke ${isGroup ? 'grup' : senderName} ya~ ✅\n` +
            `> Makasih udah respon cepet~ 💕`
        )

        if (global.laporSessions?.has(m.quoted.id)) {
            global.laporSessions.delete(m.quoted.id)
        }

        return true

    } catch (error) {
        console.error('[Lapor replyHandler] Error:', error)
        await m.reply(
            `⭐ *Ai Hoshino — Lapor Bug!*\n\n` +
            `Kyaa~ gagal kirim balasannya nih~ 😢\n` +
            `> _${error.message}_`
        )
        return true
    }
}

module.exports = {
    config: pluginConfig,
    handler,
    replyHandler
}