const fs = require('fs')
const path = require('path')

// ===== CONFIG =====
const pluginConfig = {
    name: 'resetsider',
    alias: ['resetsiders', 'startsider', 'mulaisider'],
    category: 'group',
    description: 'Mereset periode pengecekan sider (7 Hari)',
    usage: '.resetsider',
    cooldown: 10,
    energi: 2,
    isGroup: true,
    isAdmin: true
}

// ===== HANDLER =====
async function handler(m, { sock }) {
    try {
        const jidGrup = m.chat
        const metaGrup = await sock.groupMetadata(jidGrup)
        const namaGrup = metaGrup.subject

        // SIMPAN KE DATABASE
        const DB_PATH = path.join(__dirname, '../../database/other/sider.json')
        let db = {}
        if (fs.existsSync(DB_PATH)) db = JSON.parse(fs.readFileSync(DB_PATH))
        
        db[jidGrup] = {
            groupName: namaGrup,
            startDate: new Date().toISOString(),
            activeUsers: []
        }

        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
        
        // FORMAT PESAN STYLE HOSHINO AI
        let reply = `╭───〔 ✨ *H O S H I N O* 〕───⬡
┃ 🚀 *S Y S T E M - R E S E T*
┃
┃ 📛 Nama Grup: *${namaGrup}*
┃ ⏱️ Mode Waktu: *L O N G - T E R M*
┃ ⏳ Durasi: *7 HARI / 168 JAM*
┃
┃ ✅ Timer Berhasil Dihidupkan!
┃ Silakan cek hasilnya dengan *.sider*
┗━━━━━━━━━━━━━━━━━━━━━━━━━⬡

╭───〔 💫 *I D O L  P R O J E C T* 〕───⬡
┃ Jangan sampai jadi Sider ya! 😎
╰───────────────────────────────⬡`
        
        return m.reply(reply)
        
    } catch (err) {
        console.error('[RESETSIDER ERROR]', err)
        return m.reply('❌ *Ehh~* Terjadi kesalahan saat mereset periode~ 🥺')
    }
}

// ===== EXPORT =====
module.exports = {
    config: pluginConfig,
    handler
}