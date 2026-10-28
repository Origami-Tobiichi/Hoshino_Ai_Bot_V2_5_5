const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: 'toggle-feature',
    alias: ['fitur', 'onoff', 'toggle'],
    category: 'owner',
    description: '🌸 Hoshino Ai Style - Aktifkan atau nonaktifkan fitur di config.js dengan vibes imut & ceria ✨',
    usage: '.toggle-feature <namaFitur> <on/off>',
    example: '.toggle-feature antiSpam on',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock, config }) {
    const args = m.args || []
    const featureName = args[0]
    const toggle = args[1]?.toLowerCase()

    const formatStatus = (v) => v ? '💚 AKTIF' : '🖤 NONAKTIF'

    // Kalau input salah
    if (!featureName || !toggle || !['on','off'].includes(toggle)) {
        const fiturList = Object.entries(config.features || {})
            .map(([k,v]) => `- ${k}: ${formatStatus(v)}`)
            .join('\n') || '⚠️ Belum ada fitur di config.js nih~'

        return m.reply(
`🌸 Uh-oh~ Sepertinya ada yang kurang nih 😝

📜 *Daftar Fitur Saat Ini:*
${fiturList}

💡 Gunakan: \`${m.prefix}toggle-feature <namaFitur> <on/off>\`
✨ Contoh: \`${m.prefix}toggle-feature antiSpam on\`

Hehe~ jangan sampai salah ya, senpai~ 💕`)
    }

    // Kalau fitur nggak ada
    if (!(featureName in (config.features || {}))) {
        return m.reply(`😅 Eh? Fitur *${featureName}* nggak ketemu di config.js~
💡 Cek lagi ya, jangan sampai nyasar~ 🌟`)
    }

    const newValue = toggle === 'on'

    try {
        const configPath = path.join(process.cwd(), 'config.js')
        let configContent = fs.readFileSync(configPath, 'utf8')

        // Ganti nilai fitur di config.js
        const regex = new RegExp(`(${featureName}:\\s*)(true|false)`, 'i')
        configContent = configContent.replace(regex, `$1${newValue}`)

        fs.writeFileSync(configPath, configContent)

        // Update runtime config
        config.features[featureName] = newValue

        // Pesan gaya Hoshino Ai Idol
        const messages = [
            `🌟 Yay~ Fitur *${featureName}* sekarang ${formatStatus(newValue)}! Semangat terus ya~ 💖`,
            `💫 Oho~ aku baru aja nyetelin *${featureName}* ke ${formatStatus(newValue)} nih~ Hehe, senpai pasti senang kan? 😘`,
            `🎀 Hehe, *${featureName}* udah ${formatStatus(newValue)}! Siap-siap buat seru-seruan lagi ya~ 🌸`
        ]
        const randMsg = messages[Math.floor(Math.random() * messages.length)]

        m.reply(randMsg)
        
    } catch (error) {
        m.reply(
`⚠️ Aduh! Error deh 😅
> ${error.message}

💡 Cek config.js, jangan sampai ada yang aneh ya, senpai~ 🌟`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}