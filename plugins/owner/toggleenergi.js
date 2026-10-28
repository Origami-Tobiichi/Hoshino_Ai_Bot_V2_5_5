const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: 'toggle-energi',
    alias: ['tglenergy', 'unlimit'],
    category: 'owner',
    description: '⚡ Atur apakah user butuh energi atau gratisan!',
    usage: '.toggle-energi <on/off>',
    isOwner: true,
    isEnabled: true
}

async function handler(m, { sock, config }) {
    const toggle = m.args[0]?.toLowerCase()

    if (!['on', 'off'].includes(toggle)) return m.reply('⚡ Senpai, pilih `on` (pakai limit) atau `off` (unlimited) ya!')

    const newValue = toggle === 'on'
    try {
        const configPath = path.join(process.cwd(), 'config.js')
        let content = fs.readFileSync(configPath, 'utf8')
        
        // Regex khusus untuk bagian energi: { enabled: ... }
        content = content.replace(/(energi:\s*{[\s\S]*?enabled:\s*)(true|false)/, `$1${newValue}`)
        fs.writeFileSync(configPath, content)
        config.energi.enabled = newValue

        const msg = newValue 
            ? '⚡ Sistem energi AKTIF! User harus hemat-hemat ya~ 💎' 
            : '🌈 Yay! Sistem energi NONAKTIF! Semuanya gratis buat semua orang~ 💖'
        
        m.reply(msg)
    } catch (e) {
        m.reply(`⚠️ *Eh eh~* Gagal mengubah sistem energi, Senpai..~ 🌸`)
    }
}

module.exports = { config: pluginConfig, handler }