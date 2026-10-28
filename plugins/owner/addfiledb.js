const fs = require('fs')
const path = require('path')

const DATABASE_DIR = '/home/container/database/'

const pluginConfig = {
    name: 'addfiledb',
    alias: ['dbadd', 'tambahdb'],
    category: 'owner',
    description: 'Tambah file JSON baru ke database',
    usage: '.addfiledb [namafile] [folder]',
    example: '.addfiledb userdata users',
    isOwner: true,
    cooldown: 5,
    isEnabled: true
}

async function handler(m, { sock }) {
    const quoted = m.quoted
    const args = m.args

    if (!quoted) return m.reply(
`📦 *ᴀᴅᴅ ᴅᴀᴛᴀʙᴀsᴇ*
> Reply file dengan caption:
> \`${m.prefix}addfiledb\` - Auto detect
> \`${m.prefix}addfiledb namafile\` - Custom nama
> \`${m.prefix}addfiledb namafile folder\` - Custom nama + folder`
    )

    let code = quoted.text || quoted.body || '{}'
    if (quoted.filename || quoted.mimetype) {
        try { code = (await quoted.download()).toString() } 
        catch { return m.reply('❌ *Gomen ne~* Gagal download file~ 🥺') }
    }

    if (!code) code = '{}'

    const fileName = (args[0] || 'file').toLowerCase().replace(/[^a-z0-9]/g,'')
    const folderName = (args[1] || 'other').toLowerCase().replace(/[^a-z0-9]/g,'')
    const folderPath = path.join(DATABASE_DIR, folderName)
    const filePath = path.join(folderPath, `${fileName}.json`)

    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true })
    if (fs.existsSync(filePath)) return m.reply(`❌ *Ehh~* File ${fileName}.json sudah ada~ 🥺`)

    fs.writeFileSync(filePath, code)
    m.react('✅')
    return m.reply(`✅ File JSON berhasil ditambahkan!\n📁 Folder: ${folderName}\n📝 Nama: ${fileName}.json\n📊 Size: ${code.length} bytes`)
}

module.exports = { config: pluginConfig, handler }