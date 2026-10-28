const fs = require('fs')
const path = require('path')
const { hotReloadPlugin } = require('../../src/lib/plugins')

const pluginConfig = {
    name: 'renamepg',
    alias: ['renamepl', 'renameplugin', 'renamapl'],
    category: 'owner',
    description: 'Ganti nama file plugin',
    usage: '.renamepg <namalama.js> <namabaru.js>',
    example: '.renamepg bliblidl.js shopeedl.js',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

function findPluginFile(pluginsDir, targetName) {
    // Normalisasi + lowercase, biar konsisten sama addplugin.js/ganticode.js
    // dan case-insensitive kayak findPluginFile di ganticode.js
    const normalizedInput = (targetName.endsWith('.js') ? targetName : `${targetName}.js`).toLowerCase()

    const folders = fs.readdirSync(pluginsDir).filter(f =>
        fs.statSync(path.join(pluginsDir, f)).isDirectory()
    )

    for (const folder of folders) {
        const folderPath = path.join(pluginsDir, folder)
        const files = fs.readdirSync(folderPath)
        const match = files.find(f => f.toLowerCase() === normalizedInput)
        if (match) {
            return {
                folder,
                folderPath,
                filePath: path.join(folderPath, match),
                fileName: match
            }
        }
    }
    return null
}

async function handler(m, { sock }) {
    const args = m.args

    if (args.length < 2) return m.reply(
`📝 *ʀᴇɴᴀᴍᴇ ᴘʟᴜɢɪɴ*

> Gunakan format:
> \`${m.prefix}renamepg <namalama.js> <namabaru.js>\`

*Contoh:*
> \`${m.prefix}renamepg bliblidl.js shopeedl.js\`
> \`${m.prefix}renamepg bliblidl shopeedl\`
> \`${m.prefix}renamepg wa-me wa-me-v2\`

> ℹ️ Ekstensi .js boleh disertakan atau tidak`
    )

    const oldNameRaw = args[0]
    const newNameRaw = args[1]

    // Validasi + normalisasi nama baru: lowercase, boleh huruf/angka/hyphen
    // (disamain sama convention addplugin.js & ganticode.js, gak ada underscore)
    const newNameClean = newNameRaw.replace(/\.js$/i, '').toLowerCase().replace(/[^a-z0-9-]/g, '')

    if (!newNameClean || newNameClean.startsWith('-') || newNameClean.endsWith('-'))
        return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Nama baru tidak valid\n> Hanya boleh huruf kecil, angka, dan strip (tidak di awal/akhir)`)

    const pluginsDir = path.join(process.cwd(), 'plugins')

    if (!fs.existsSync(pluginsDir))
        return m.reply(`❌ *Gomen ne~* ✦\n\n> Folder plugins tidak ditemukan~ 🥺`)

    // Cari file lama
    const found = findPluginFile(pluginsDir, oldNameRaw)
    if (!found)
        return m.reply(`❌ *Gomen ne~* ✦\n\n> File *${oldNameRaw}* tidak ditemukan di semua folder plugins~ 🥺`)

    const newFileName = `${newNameClean}.js`
    const newFilePath = path.join(found.folderPath, newFileName)

    // Cek nama baru sudah ada (case-insensitive juga, biar konsisten)
    const existingFiles = fs.readdirSync(found.folderPath)
    if (existingFiles.some(f => f.toLowerCase() === newFileName.toLowerCase()))
        return m.reply(`❌ *Gomen ne~* ✦\n\n> File *${newFileName}* sudah ada di folder *${found.folder}*~ 🥺`)

    m.react('🕕')

    // Rename
    try {
        fs.renameSync(found.filePath, newFilePath)
    } catch (e) {
        m.react('❌')
        return m.reply(`❌ *Gomen ne~* ✦\n\n> Gagal rename: ${e.message} 🥺`)
    }

    // Hot reload file baru
    let reloadInfo = '⚠️ Pending (restart manual)'
    try {
        // Hapus cache require file lama kalau masih ada
        const oldCacheKey = Object.keys(require.cache).find(k => k.endsWith(found.fileName) && k.includes(found.folder))
        if (oldCacheKey) delete require.cache[oldCacheKey]

        const reloadResult = hotReloadPlugin(newFilePath)
        reloadInfo = reloadResult.success ? '✅ Sukses' : '⚠️ Pending (restart manual)'
    } catch (e) {
        reloadInfo = '⚠️ Pending (restart manual)'
    }

    m.react('✅')
    return m.reply(
`✅ *Plugin berhasil di-rename*
╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」
┃ 📁 Folder: ${found.folder}
┃ 🔴 Lama: ${found.fileName}
┃ 🟢 Baru: ${newFileName}
┃ 🔄 Hot reload: ${reloadInfo}
╰┈┈⬡

> Plugin baru sudah aktif!`
    )
}

module.exports = { config: pluginConfig, handler }