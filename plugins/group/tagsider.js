const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: 'tagsider',
    alias: ['tagnonaktif', 'panggilsider'],
    category: 'group',
    description: 'Memanggil member tidak aktif dengan gaya idol ekspresif ✨',
    usage: '.tagsider <pesan>',
    example: '.tagsider Ayo aktif ya~',
    cooldown: 30,
    energi: 2,
    isGroup: true,
    isAdmin: true,
    isBotAdmin: true
}

async function handler(m, { sock }) {
    try {
        const jidGrup = m.chat
        const PERIODE_MENIT = 7 * 24 * 60
        const DB_PATH = path.join(__dirname, '../../database/other/sider.json')

        const textInput = m.text ? m.text.trim() : ''
        const pesanUser = textInput || 'Nee~ kok cuma diam aja? 🥺 Ayo ngobrol bareng aku dong~ ✨'

        if (!fs.existsSync(DB_PATH)) {
            return m.reply(
`🌸 *Hoshino Ai Notice* 🌸

🥺 Yah... databasenya belum ada...
👉 Gunakan *.resetsider* dulu ya~

✨ Aku tunggu ya!`
            )
        }

        const db = JSON.parse(fs.readFileSync(DB_PATH))
        const dataGrup = db[jidGrup] || {}

        if (!dataGrup.startDate) {
            return m.reply(
`💫 *Belum dimulai nih~*

😳 Aku belum bisa pantau kalian...
👉 Jalankan *.resetsider* dulu ya!

✨ Biar aku bisa lihat siapa yang aktif~`
            )
        }

        const startDate = new Date(dataGrup.startDate)
        const sekarang = new Date()
        const selisihMs = sekarang - startDate
        const totalDetik = Math.floor(selisihMs / 1000)

        const sisaTotalDetik = Math.max(0, (PERIODE_MENIT * 60) - totalDetik)
        const periodeSelesai = sisaTotalDetik <= 0

        if (!periodeSelesai) {
            const sisaJam = Math.floor(sisaTotalDetik / 3600)
            const sisaMenit = Math.floor((sisaTotalDetik % 3600) / 60)

            const sisaWaktu = `${sisaJam.toString().padStart(2, '0')}j ${sisaMenit.toString().padStart(2, '0')}m`

            return m.reply(
`⏳ *Sabar ya~* 😣

Aku masih mengamati kalian semua... 👀✨  
Belum waktunya manggil yang diam 😴

🕒 Sisa waktu: *${sisaWaktu}*

💭 Tunggu aku ya... nanti aku panggil satu-satu 😏`
            )
        }

        await m.react('👀')

        const metaGrup = await sock.groupMetadata(jidGrup)
        const senderId = m.sender

        const semuaAnggota = metaGrup.participants.map(p => {
            let userId = p.jid || p.id || ''
            return userId.replace('@lid', '@s.whatsapp.net').split('@')[0]
        })

        const anggotaAktif = (dataGrup.activeUsers || []).map(id => id.split('@')[0])
        const siderList = semuaAnggota.filter(uid => !anggotaAktif.includes(uid))

        if (siderList.length === 0) {
            await m.react('🥳')
            return m.reply(
`🌟 *WOWWW!* 😆✨

Semua member aktif dong?!  
💖 Aku bangga banget sama kalian~

🥰 Kalian bener-bener bersinar!`
            )
        }

        const siderMentions = siderList.map(n => n + '@s.whatsapp.net')

        const listText = siderList
            .map((nomor, i) => `│ ${i + 1}. @${nomor}`)
            .join('\n')

        const message =
`╭━━━『 🌸 *Ai Calling You~* 🌸 』━━━
│
│ 🥺 *Pesan:*
│ ${pesanUser}
│
│ 😎 *Yang manggil:*
│ @${senderId.split('@')[0]}
│
├━━━『 😶 *Yang cuma ngintip* 😶 』━━━
${listText}
│
╰━━━━━━━━━━━━━━━━━━━━━━━

😏 "Aku tahu kalian online..."
🥀 "Tapi kenapa cuma dibaca aja? hm?"
🥺 "Ayo dong... ngobrol sedikit aja~"
✨ "Biar aku makin suka sama kalian 💖"`

        await sock.sendMessage(m.chat, {
            text: message,
            mentions: [...siderMentions, senderId]
        }, { quoted: m })

        await m.react('💖')

    } catch (err) {
        console.error('[TAGSIDER ERROR]', err)
        await m.react('😵')

        return m.reply(
`❌ *Eh?! Error?!* 😖

💔 Ada yang salah...
👉 ${err.message}

🥺 Maafin aku ya... aku bakal coba lagi nanti...`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}