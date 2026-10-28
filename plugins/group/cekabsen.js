const config = require('../../config')

const pluginConfig = {
    name: 'cekabsen',
    alias: ['listabsen', 'daftarabsen', 'lihathadir'],
    category: 'group',
    description: 'Lihat daftar peserta yang sudah absen',
    usage: '.cekabsen',
    example: '.cekabsen',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

if (!global.absensi) global.absensi = {}

async function handler(m, { sock }) {
    const chatId = m.chat

    if (!global.absensi[chatId]) {
        return m.reply(
`╭━━━〔 🌸 𝐇𝐎𝐒𝐇𝐈𝐍𝐎 𝐀𝐈 𝐀𝐁𝐒𝐄𝐍 🌸 〕━━━⬣
┃ ❌ *Belum ada sesi absen~*
┃
┃ 💬 Minta admin untuk memulai yaa~
┃ ✨ Gunakan:
┃ ➤ *.mulaiabsen [keterangan]*
╰━━━━━━━━━━━━━━━━⬣`
        )
    }

    const absen = global.absensi[chatId]

    if (!absen.data) absen.data = {}
    if (!absen.peserta) absen.peserta = []

    const moment = require('moment-timezone')
    const now = moment().tz('Asia/Jakarta')

    const dateStr = now.format('dddd, D MMMM YYYY')
    const createdDate = moment(absen.createdAt).tz('Asia/Jakarta')
    const timeStr = createdDate.format('HH:mm:ss')

    // 🔥 LIST PESERTA FULL NAMA WA
    let list = '┃ _Belum ada yang hadir~_'

    if (absen.peserta.length > 0) {
        const arr = await Promise.all(absen.peserta.map(async (jid, i) => {
            let name = absen.data?.[jid]

            if (!name) {
                try {
                    name = await sock.getName(jid)
                } catch {
                    name = jid.split('@')[0]
                }
            }

            return `┃ ${i + 1}. ${name}`
        }))

        list = arr.join('\n')
    }

    // 🔥 CREATOR NAME FIX
    let creatorName = absen.data?.[absen.createdBy]

    if (!creatorName) {
        try {
            creatorName = await sock.getName(absen.createdBy)
        } catch {
            creatorName = 'Admin'
        }
    }

    await m.reply(
`╭━━━〔 🌸 𝐇𝐎𝐒𝐇𝐈𝐍𝐎 𝐀𝐈 𝐀𝐁𝐒𝐄𝐍 🌸 〕━━━⬣
┃ 📋 *Daftar Kehadiran*
┃
┃ 💖 *Tujuan:* ${absen.keterangan}
┃
┣━━━〔 📊 𝐈𝐍𝐅𝐎 〕━━━⬣
┃ 📅 ${dateStr}
┃ ⏰ Dimulai: ${timeStr}
┃ 👑 Dibuat oleh: ${creatorName}
┃ 👥 Total Hadir: ${absen.peserta.length} orang
┃
┣━━━〔 📝 𝐏𝐄𝐒𝐄𝐑𝐓𝐀 〕━━━⬣
${list}
┃
╰━━━〔 🌟 𝐍𝐎𝐓𝐄 〕━━━⬣
> ✨ Ketik *${m.prefix}absen* untuk ikut hadir
`
    )
}

module.exports = {
    config: pluginConfig,
    handler
}