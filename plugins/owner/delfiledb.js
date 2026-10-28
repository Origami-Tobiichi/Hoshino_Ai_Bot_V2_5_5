const fs = require('fs')
const path = require('path')

const DATABASE_DIR = '/home/container/database/'

const pluginConfig = {
    name: 'delfiledb',
    alias: ['dbdel', 'hapusdb'],
    category: 'owner',
    description: 'Hapus file JSON dari database',
    usage: '.delfiledb [namafile] [folder]',
    example: '.delfiledb userdata users',
    isOwner: true,
    cooldown: 5,
    isEnabled: true
}

async function handler(m) {
    const args = m.args
    const fileName = args[0]?.toLowerCase().replace(/[^a-z0-9]/g,'')
    const folderName = (args[1]?.toLowerCase().replace(/[^a-z0-9]/g,'') || 'other')

    if (!fileName) return m.reply('❌ *Ehh~* Masukkan nama file untuk dihapus~ 🥺')

    const filePath = path.join(DATABASE_DIR, folderName, `${fileName}.json`)
    if (!fs.existsSync(filePath)) return m.reply(`❌ *Ehh~* File ${fileName}.json tidak ditemukan~ 🥺`)

    fs.unlinkSync(filePath)
    m.react('✅')
    return m.reply(`✅ *Yatta~* File ${fileName}.json berhasil dihapus dari folder ${folderName} ✨`)
}

module.exports = { config: pluginConfig, handler }