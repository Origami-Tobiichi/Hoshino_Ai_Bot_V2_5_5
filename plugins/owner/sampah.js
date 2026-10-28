const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: 'sampah',
    alias: ['clearsampah', 'cleartemp', 'deltemp'],
    category: 'owner',
    description: 'Menghapus semua sampah di temp',
    usage: '.sampah',
    example: '.sampah',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 60,
    energi: 0,
    isEnabled: true
}

async function handler(m) {
    const tempPath = path.join(process.cwd(), 'temp')

    if (!fs.existsSync(tempPath)) {
        return m.reply('❌ *Ehh~* Folder temp tidak ditemukan~ 🥺')
    }

    m.react('🗑️')

    try {
        const files = fs.readdirSync(tempPath)

        if (!files.length) {
            return m.reply('📁 Folder temp sudah kosong!')
        }

        let deleted = 0

        for (const file of files) {
            const filePath = path.join(tempPath, file)

            fs.rmSync(filePath, { recursive: true, force: true })
            deleted++
        }

        m.react('✅')
        await m.reply(
            `🗑️ *TEMP CLEANED!*\n\n` +
            `> Total file/folder dihapus: *${deleted}*`
        )

    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
