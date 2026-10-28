const fs = require('fs')
const path = require('path')

const DATABASE_DIR = '/home/container/database/'

const pluginConfig = {
    name: 'getfiledb',
    alias: ['dbget', 'ambildb'],
    category: 'owner',
    description: 'Ambil file JSON dari database',
    usage: '.getfiledb [namafile] [folder]',
    example: '.getfiledb userdata users',
    isOwner: true,
    cooldown: 5,
    isEnabled: true
}

async function handler(m, { sock }) {
    const args = m.args
    const fileName = args[0]?.toLowerCase().replace(/[^a-z0-9]/g,'')
    const folderName = (args[1]?.toLowerCase().replace(/[^a-z0-9]/g,'') || 'other')

    if (!fileName) return m.reply('❌ *Ehh~* Masukkan nama file untuk diambil~ 🥺')

    const filePath = path.join(DATABASE_DIR, folderName, `${fileName}.json`)
    if (!fs.existsSync(filePath)) return m.reply(`❌ *Ehh~* File ${fileName}.json tidak ditemukan~ 🥺`)

    await sock.sendMessage(m.chat, { 
        document: fs.readFileSync(filePath), 
        fileName: `${fileName}.json`, 
        mimetype: 'application/json' 
    })
}

module.exports = { config: pluginConfig, handler }