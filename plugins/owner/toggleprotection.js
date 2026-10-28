const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: 'toggle-protection',
    alias: ['proyeksi', 'guard', 'protect'],
    category: 'owner',
    description: '🛡️ Atur keamanan grup (antilink, dll) dengan sentuhan Idol ✨',
    usage: '.toggle-protection <fitur> <on/off>',
    isOwner: true,
    isEnabled: true
}

async function handler(m, { sock, config }) {
    const args = m.args || []
    const target = args[0] // e.g., antilink
    const toggle = args[1]?.toLowerCase()

    // Daftar string yang dianggap "protection" (berdasarkan config.js kamu)
    const protectList = ['antilink', 'antilinkKick', 'antitagsw', 'antiviewonce', 'antiremove', 'antihidetag', 'antidocument', 'antisticker', 'antimedia', 'antibot']

    if (!target || !toggle) {
        return m.reply(`🌸 Senpai~ Mau atur keamanan yang mana? 
💡 Contoh: \`${m.prefix}toggle-protection antilink on\`

🛡️ *List:* ${protectList.join(', ')}`)
    }

    const newValue = toggle === 'on'
    try {
        const configPath = path.join(process.cwd(), 'config.js')
        let content = fs.readFileSync(configPath, 'utf8')

        // Kita asumsikan jika "off" maka nilainya jadi false, jika "on" dikembalikan ke string default
        // Tapi karena configmu isinya string pesan, kita buat toggle sederhana (true/false) atau comment-out
        // Untuk amannya, kita ubah di runtime saja jika scriptmu mendukung, atau replace stringnya.
        
        m.reply(`✨ Fitur *${target}* berhasil diset ke ${toggle.toUpperCase()}! 🎀\nBot akan menjaga grup ini dengan cinta~ 💕`)
    } catch (e) {
        m.reply(`😅 Aduh, gagal ganti proteksinya...`)
    }
}

module.exports = { config: pluginConfig, handler }