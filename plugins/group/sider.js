const fs = require('fs')
const path = require('path')

// ===== CONFIG =====
const pluginConfig = {
    name: 'sider',
    alias: ['siders', 'nonaktif', 'tidakaktif'],
    category: 'group',
    description: 'Menampilkan anggota yang tidak pernah mengirim pesan selama periode aktifitas',
    usage: '.sider',
    cooldown: 5,
    energi: 1,
    isGroup: true,
    isAdmin: true
}

// ===== HANDLER =====
async function handler(m, { sock }) {
    try {
        const jidGrup = m.chat
        const PERIODE_MENIT = 7 * 24 * 60 // 7 HARI

        // BACA DATA DARI DATABASE
        const DB_PATH = path.join(__dirname, '../../database/other/sider.json')
        if (!fs.existsSync(DB_PATH)) return m.reply('⚠️ Periode belum dimulai!\nGunakan *.resetsider* dulu.')

        const db = JSON.parse(fs.readFileSync(DB_PATH))
        const dataGrup = db[jidGrup] || {}

        if (!dataGrup.startDate) return m.reply('⚠️ Periode belum dimulai!\nGunakan *.resetsider* dulu.')

        // HITUNG WAKTU
        const startDate = new Date(dataGrup.startDate)
        const sekarang = new Date()
        const selisihMs = sekarang - startDate
        
        // KONVERSI KE FORMAT HH:MM:SS
        const totalDetik = Math.floor(selisihMs / 1000)
        const jam = Math.floor(totalDetik / 3600)
        const menit = Math.floor((totalDetik % 3600) / 60)
        const detik = totalDetik % 60
        
        // Format jadi 2 digit (00:00:00)
        const waktuBerlalu = `${jam.toString().padStart(2, '0')}:${menit.toString().padStart(2, '0')}:${detik.toString().padStart(2, '0')}`
        
        // Hitung sisa waktu
        const sisaTotalDetik = Math.max(0, (PERIODE_MENIT * 60) - totalDetik)
        const sisaJam = Math.floor(sisaTotalDetik / 3600)
        const sisaMenit = Math.floor((sisaTotalDetik % 3600) / 60)
        const sisaDetik = sisaTotalDetik % 60
        const sisaWaktu = `${sisaJam.toString().padStart(2, '0')}:${sisaMenit.toString().padStart(2, '0')}:${sisaDetik.toString().padStart(2, '0')}`

        const periodeSelesai = sisaTotalDetik <= 0

        // AMBIL DATA GRUP
        const metaGrup = await sock.groupMetadata(jidGrup)
        const namaGrup = metaGrup.subject

        // AMBIL SEMUA ANGGOTA & NORMALISASI ID
        const semuaAnggota = metaGrup.participants.map(p => {
            let userId = p.jid || p.id || '';
            return userId.replace('@lid', '@s.whatsapp.net').split('@')[0];
        })

        // AMBIL DATA AKTIF DARI DB
        const anggotaAktif = (dataGrup.activeUsers || []).map(id => id.split('@')[0])

        // FILTER SIDER
        const siderList = semuaAnggota.filter(uid => !anggotaAktif.includes(uid))

        // HITUNG STATISTIK
        const totalAnggota = semuaAnggota.length
        const totalAktif = anggotaAktif.length
        const totalSider = siderList.length

        // FORMAT PESAN
        let reply = `╭───〔 📊 *H O S H I N O* 〕───⬡
┃ ✨ *S Y S T E M - S I D E R*
┃
┃ 📛 Nama Grup: *${namaGrup}*
┃ ⏱️ Durasi: *7 HARI*
┃ 🕒 Berlalu: *${waktuBerlalu}*
┃ 📊 Status: ${periodeSelesai ? '✅ *SELESAI*' : '⏳ *PROSES...*'}
┃
┃ 👥 Total Member: *${totalAnggota}*
┗━━━━━━━━━━━━━━━━━━━━━━━━━⬡\n`

        if (periodeSelesai) {
            reply += `╭───〔 📋 *D A T A  R E S U L T* 〕───⬡
┃ ✅ Sudah Chat: *${totalAktif}*
┃ ❌ Belum Chat: *${totalSider}*
╰───────────────────────────⬡\n\n`

            if (siderList.length > 0) {
                reply += `📌 *Daftar Anggota Non-Aktif :*\n\n`
                siderList.forEach((nomor, i) => {
                    reply += `${i+1}. ➤ @${nomor}\n`
                })
            } else {
                reply += `🎉 *Seluruh anggota grup sudah aktif*\nSemua sudah mengirim pesan! ✨`
            }
        } else {
            reply += `╭───〔 ⏳ *P R O G R E S S* 〕───⬡
┃ Masih dalam penghitungan...
┃ Sisa waktu: *${sisaWaktu}*
┃
┃ Cek kembali setelah waktu habis!
╰───────────────────────────⬡`
        }

        reply += `\n╭───〔 ✨ *H O S H I N O  A I* 〕───⬡
┃ 💫 *Idol Project System*
╰───────────────────────────⬡`
        
        return m.reply(reply, { mentions: periodeSelesai ? siderList.map(nomor => nomor + '@s.whatsapp.net') : [] })
        
    } catch (err) {
        console.error('[SIDER ERROR]', err)
        return m.reply('❌ *Ehh~* Terjadi kesalahan saat memproses data~ 🥺')
    }
}

// ===== EXPORT =====
module.exports = {
    config: pluginConfig,
    handler
}