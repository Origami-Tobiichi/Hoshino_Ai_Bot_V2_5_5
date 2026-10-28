const { getDatabase } = require('../../src/lib/database') // Pastikan path ini benar
const { getContentType } = require('hsnai')

const pluginConfig = {
    name: 'controlgrup',
    alias: ['ctrlgc', 'controlgc'],
    category: 'owner',
    description: 'Kontrol grup jarak jauh',
    usage: '.ctrlgc <id/index> <aksi>',
    example: '.ctrlgc 1203xxxxx@g.us #close',
    isOwner: true,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    isEnabled: true
}

const delay = ms => new Promise(res => setTimeout(res, ms))
const getQuotedText = (q) => q?.text || q?.body || q?.caption || ''

// FIX: m.quoted gak punya field `mimetype` di root-nya.
// Deteksi tipe media harus lewat getContentType(m.quoted.message),
// sama kayak pola yang dipakai di tourl.js.
const isImage = (q) => {
    if (!q?.message) return false
    const type = getContentType(q.message)
    return type === 'imageMessage'
}

async function handler(m, { sock }) {
    try {
        if (m.fromMe) return

        let text = m.args?.join(' ') || m.text || ''

        if (!text) {
            return m.reply(
`🌸 *Hoshino Ai Control*

╭┈┈⬡「 📖 CARA PAKAI 」
┃ .ctrlgc <id/index> <aksi>
╰┈┈⬡

╭┈┈⬡「 ⚙️ AKSI 」
┃ #open | #close | #leave
┃ #ignore (Mute/Unmute bot)
┃ #setname | #setdesk (reply)
┃ #setpp (reply gambar)
┃ #faketag nomor|tag|pesan
┃ bebas teks
╰┈┈⬡`
            )
        }

        let split = text.trim().split(' ')
        if (split.length < 2) return m.reply('❌ *Ehh~* Format salah~ 🥺')

        let input = split[0]
        let action = split.slice(1).join(' ')
        let target

        // ================= TARGET =================
        if (input.endsWith('@g.us')) {
            target = input
        } else if (!isNaN(input)) {
            if (!global.gcMap || !global.gcMap[input]) {
                return m.reply('❌ *Ehh~* ID tidak ditemukan! Jalankan .listgc dulu~ 🥺')
            }
            target = global.gcMap[input]
        } else {
            return m.reply('❌ *Ehh~* Format salah~ 🥺')
        }

        const makeNotif = (msg) => {
            return `🌸 *Hoshino Ai Notification*\n\n╭┈┈⬡「 📢 INFO 」\n┃ Pesan dari owner:\n┃\n┃ "${msg}" 💌\n╰┈┈⬡`
        }

        // ================= AKSI IGNORE (NEW) =================
        if (action === '#ignore') {
            const db = getDatabase()
            const group = db.getGroup(target) || {}
            const newState = !group.ignore
            
            db.setGroup(target, { ...group, ignore: newState })
            
            return m.reply(
                `✅ *STATUS IGNORE DIUBAH*\n\n` +
                `🎯 Target: ${target}\n` +
                `📢 Status: ${newState ? 'AKTIF (Bot Diam)' : 'NON-AKTIF (Bot Respon)'}`
            )
        }

        // ================= FAKETAG =================
        if (action.startsWith('#faketag')) {
            let raw = action.replace('#faketag', '').trim()
            if (!raw.includes('|')) return m.reply('❌ *Ehh~* Format faketag salah~ 🥺')

            let [nomor, pesanTag, pesan] = raw.split('|')
            nomor = nomor.replace(/[^0-9]/g, '')
            let jid = nomor + '@s.whatsapp.net'

            let fakeQuoted = {
                key: { fromMe: false, participant: jid, remoteJid: target },
                message: { conversation: pesanTag }
            }

            await sock.sendMessage(target, {
                text: pesan,
                contextInfo: { mentionedJid: [jid], quotedMessage: fakeQuoted.message, participant: jid }
            }, { quoted: fakeQuoted })

            return m.reply(`✅ *Yatta~* FAKETAG TERKIRIM ke ${target} ✨`)
        }

        // ================= AKSI LAIN =================
        if (action === '#close') {
            await sock.groupSettingUpdate(target, 'announcement')
            await sock.sendMessage(target, { text: makeNotif('Grup ditutup oleh owner') })
            return m.reply(`✅ *Yatta~* Close: ${target} ✨`)
        }

        if (action === '#open') {
            await sock.groupSettingUpdate(target, 'not_announcement')
            await sock.sendMessage(target, { text: makeNotif('Grup dibuka kembali') })
            return m.reply(`✅ *Yatta~* Open: ${target} ✨`)
        }

        if (action === '#leave') {
            await sock.sendMessage(target, { text: makeNotif('Bot keluar 👋') })
            await delay(1000)
            await sock.groupLeave(target)
            return m.reply(`👋 Keluar: ${target}`)
        }

        if (action.startsWith('#setname')) {
            if (!m.quoted) return m.reply('❌ *Ehh~* Reply teks~ 🥺')
            await sock.groupUpdateSubject(target, getQuotedText(m.quoted))
            return m.reply('✅ *Yatta~* Nama diubah~ ✨')
        }

        if (action.startsWith('#setpp')) {
            if (!m.quoted || !isImage(m.quoted)) return m.reply('❌ *Ehh~* Reply gambar~ 🥺')
            let media = await m.quoted.download()
            await sock.updateProfilePicture(target, media)
            return m.reply('✅ *Yatta~* PP diubah~ ✨')
        }

        // ================= DEFAULT (KIRIM PESAN) =================
        await sock.sendMessage(target, { text: makeNotif(action) })
        return m.reply(`✅ *Yatta~* Pesan terkirim ke ${target} ✨`)

    } catch (err) {
        console.error('[CTRLGC ERROR]', err)
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${err.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}