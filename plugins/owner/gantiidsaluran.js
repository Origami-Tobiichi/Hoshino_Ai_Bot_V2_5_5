const fs = require("fs")
const path = require("path")

const pluginConfig = {
    name: 'gantiidsaluran',
    alias: ['setidsaluran'],
    category: 'owner',
    description: 'Ganti semua ID saluran di seluruh SC (Hoshino Ai style)',
    usage: '.gantiidsaluran <idch>',
    example: '.gantiidsaluran 120363xxxx@newsletter',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

async function handler(m) {
    let msg = m.text || ""
    let newId = msg.replace(/^\.gantiidsaluran\s*/i, "").trim()

    if (!newId) {
        return m.reply(
`╭━━〔 ⚠️ Peringatan ⚠️ 〕━━⬣
┃ Contoh penggunaan:
┃ .gantiidsaluran 120363xxxx@newsletter
╰━━━━━━━━━━━━━━━━⬣`)
    }

    // scan semua file .js di folder SC
    function scan(dir) {
        const files = fs.readdirSync(dir)
        for (let file of files) {
            const fullPath = path.join(dir, file)
            const stat = fs.statSync(fullPath)

            if (stat.isDirectory()) {
                scan(fullPath)
            } else if (file.endsWith(".js")) {
                let data = fs.readFileSync(fullPath, "utf8")
                const match = data.match(/\d+@newsletter/g)
                if (match) {
                    data = data.replace(/\d+@newsletter/g, newId)
                    fs.writeFileSync(fullPath, data)
                }
            }
        }
    }

    scan("./") // mulai scan dari root SC

    await m.reply(
`╭━━〔 💖 Hoshino Ai System 💖 〕━━⬣
┃ ✅ Semua ID Saluran berhasil diganti!
┃
┃ 🌸 ID Baru :
┃ ${newId}
┃
┃ 🔄 Bot akan restart dalam 5 detik untuk menerapkan perubahan...
╰━━━━━━━━━━━━━━━━⬣`)

    setTimeout(() => process.exit(), 5000)
}

module.exports = {
    config: pluginConfig,
    handler
}