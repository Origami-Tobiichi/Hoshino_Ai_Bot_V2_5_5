const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: 'set-bot',
    alias: ['botset', 'ubahbot', 'setv', 'setmode'],
    category: 'owner',
    description: '👗 Ganti kostum (nama/mode/versi) Hoshino Ai biar makin fresh!',
    usage: '.set-bot <name/mode/version> <teks>',
    example: '.set-bot version 2.3.0',
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
    const type = args[0]?.toLowerCase()
    const value = args.slice(1).join(' ')

    // Menu bantuan jika input kosong atau salah
    if (!type || !value) {
        return m.reply(
`🌸 *Hoshino Ai - Config Editor* 🌸

Hai Senpai! Mau ubah identitasku ya? Hehe~ 🤭
Gunakan format: \`${m.prefix}${pluginConfig.name} <tipe> <nilai>\`

✨ *Daftar yang bisa diubah:*
1. 📛 \`name\` — Ganti nama bot
2. 🆙 \`version\` — Ganti versi bot
3. 🔓 \`mode\` — Ganti mode (public / self)

💡 *Contoh:*
- \`${m.prefix}set-bot name Hoshino Ai v2\`
- \`${m.prefix}set-bot version 2.3.5\`
- \`${m.prefix}set-bot mode self\`

Jangan sampai salah ya, nanti aku bingung! 💕`)
    }

    const configPath = path.join(process.cwd(), 'config.js')
    
    try {
        let content = fs.readFileSync(configPath, 'utf8')
        let successMsg = ''

        if (type === 'name') {
            // Regex khusus mencari "name" di dalam object "bot"
            content = content.replace(/(bot:\s*{[\s\S]*?name:\s*['"])(.*?)(['"])/, `$1${value}$3`)
            config.bot.name = value
            successMsg = `🌟 Yay! Panggil aku *${value}* sekarang ya, Senpai~ Hehe! 😘`
        } 
        else if (type === 'version') {
            // Regex khusus mencari "version" di dalam object "bot"
            content = content.replace(/(bot:\s*{[\s\S]*?version:\s*['"])(.*?)(['"])/, `$1${value}$3`)
            config.bot.version = value
            successMsg = `🆙 Selesai! Sekarang aku sudah versi *${value}*. Makin canggih kan? ✨`
        } 
        else if (type === 'mode') {
            const modeVal = value.toLowerCase()
            if (!['public', 'self'].includes(modeVal)) {
                return m.reply('🌸 Uh-oh~ Pilihannya cuma ada `public` atau `self` ya, Senpai! 😅')
            }
            content = content.replace(/(mode:\s*['"])(.*?)(['"])/, `$1${modeVal}$3`)
            config.mode = modeVal
            successMsg = `💫 Oke! Sekarang aku mode *${modeVal}*. Fokus ke Senpai aja nih~ 💖`
        } 
        else {
            return m.reply('😅 Tipe itu nggak ada di list, Senpai~ Coba cek lagi deh! 🌟')
        }

        // Simpan perubahan ke file config.js secara permanen
        fs.writeFileSync(configPath, content)
        
        // Kirim pesan sukses
        m.reply(successMsg)

    } catch (error) {
        m.reply(
`⚠️ Aduh! Ada kendala pas mau simpan config nih 😅
> ${error.message}

Coba cek file \`config.js\` kamu ya, Senpai! 🌟`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}