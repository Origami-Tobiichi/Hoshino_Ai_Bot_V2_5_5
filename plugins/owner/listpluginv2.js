const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: 'listplugin',
    alias: ['listpl', 'pluginlist2', 'daftarplugin'],
    category: 'owner',
    description: 'Tampilkan semua plugin dalam folder tertentu secara detail',
    usage: '.listplugin <folder>',
    example: '.listplugin owner\n.listplugin downloader',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

function getPluginMeta(filePath) {
    try {
        delete require.cache[require.resolve(filePath)]
        const mod = require(filePath)
        const raw = mod.config || mod.pluginConfig || null
        if (!raw || typeof raw !== 'object') return null
        // Normalize semua field ke tipe yang benar
        return {
            name: typeof raw.name === 'string' ? raw.name : null,
            description: typeof raw.description === 'string' ? raw.description : null,
            alias: Array.isArray(raw.alias) ? raw.alias.filter(a => typeof a === 'string') : [],
            usage: typeof raw.usage === 'string' ? raw.usage : null,
            cooldown: typeof raw.cooldown === 'number' ? raw.cooldown : null,
            isEnabled: raw.isEnabled !== false,
            isOwner: !!raw.isOwner,
            isPremium: !!raw.isPremium,
            isGroup: !!raw.isGroup,
            isPrivate: !!raw.isPrivate,
        }
    } catch {
        return null
    }
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes}B`
    return `${(bytes / 1024).toFixed(1)}KB`
}

function formatDate(mtime) {
    const d = new Date(mtime)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yy = String(d.getFullYear()).slice(2)
    return `${dd}/${mm}/${yy}`
}

async function handler(m, { sock }) {
    const args = m.args

    if (!args[0]) return m.reply(
`🌟 *ʟɪsᴛ ᴘʟᴜɢɪɴ*

Haii~! Sebutkan nama foldernya dulu dong~ ✨

> *Format:* \`${m.prefix}listplugin <folder>\`
> *Contoh:* \`${m.prefix}listplugin owner\`

💡 Folder yang tersedia bisa dicek lewat \`.listfolder\` ya~`
    )

    const folderName = args[0].toLowerCase()
    const pluginsDir = path.join(process.cwd(), 'plugins')
    const folderPath = path.join(pluginsDir, folderName)

    if (!fs.existsSync(pluginsDir))
        return m.reply(`❌ Aduh~ folder plugins-nya nggak ada nih...`)

    if (!fs.existsSync(folderPath)) {
        // Kasih saran folder yang mirip
        const allFolders = fs.readdirSync(pluginsDir).filter(f =>
            fs.statSync(path.join(pluginsDir, f)).isDirectory()
        )
        const similar = allFolders.filter(f => f.includes(folderName) || folderName.includes(f))
        const saranText = similar.length > 0
            ? `\n\n💡 Maksud kamu mungkin: *${similar.join(', ')}*~?`
            : `\n\n📁 Folder tersedia: ${allFolders.map(f => `*${f}*`).join(', ')}`

        return m.reply(`❌ Folder *${folderName}* nggak ada nih~${saranText}`)
    }

    const files = fs.readdirSync(folderPath)
        .filter(f => f.endsWith('.js'))
        .sort()

    if (files.length === 0)
        return m.reply(`📭 Folder *${folderName}* masih kosong nih~\nBelum ada plugin sama sekali!`)

    // Kumpulin semua data plugin
    const pluginList = []
    let totalEnabled = 0
    let totalDisabled = 0
    let totalSize = 0

    for (const file of files) {
        const filePath = path.join(folderPath, file)
        const stat = fs.statSync(filePath)
        const meta = getPluginMeta(filePath)

        totalSize += stat.size

        const isEnabled = meta ? (meta.isEnabled !== false) : true
        if (isEnabled) totalEnabled++
        else totalDisabled++

        pluginList.push({
            file,
            meta,
            size: stat.size,
            mtime: stat.mtime,
            isEnabled
        })
    }

    // Build output style Hoshino Ai
    let out = ''
    out += `╔══「 ✦ *PLUGIN LIST* ✦ 」\n`
    out += `║  📁 Folder : *${folderName.toUpperCase()}*\n`
    out += `║  🗂️ Total  : *${files.length} plugin*\n`
    out += `║  ✅ Aktif  : *${totalEnabled}*  ❌ Nonaktif: *${totalDisabled}*\n`
    out += `║  💾 Size   : *${formatSize(totalSize)}*\n`
    out += `╚══════════════════════\n\n`

    pluginList.forEach((p, i) => {
        const num = String(i + 1).padStart(2, '0')
        const statusIcon = p.isEnabled ? '🟢' : '🔴'
        const name = String(p.meta?.name || p.file.replace('.js', ''))
        const desc = String(p.meta?.description || 'Tidak ada deskripsi')
        const alias = p.meta?.alias?.length ? p.meta.alias.join(', ') : '-'
        const usage = String(p.meta?.usage || '-')
        const cooldown = p.meta?.cooldown ?? '-'
        const isOwner = p.meta?.isOwner ? '👑 Owner' : ''
        const isPremium = p.meta?.isPremium ? '💎 Premium' : ''
        const isGroup = p.meta?.isGroup ? '👥 Group' : ''
        const tags = [isOwner, isPremium, isGroup].filter(Boolean).join(' · ') || '🌐 Public'

        out += `┌─「 ${statusIcon} *${num}. ${name.toUpperCase()}* 」\n`
        out += `│ 📄 File    : ${p.file}\n`
        out += `│ 📝 Desc    : ${desc}\n`
        out += `│ 🔖 Alias   : ${alias}\n`
        out += `│ 📌 Usage   : ${usage}\n`
        out += `│ ⏱️ Cooldown : ${cooldown}s\n`
        out += `│ 🏷️ Akses   : ${tags}\n`
        out += `│ 💾 Size    : ${formatSize(p.size)}  📅 ${formatDate(p.mtime)}\n`
        out += `└──────────────────\n`

        // Jeda setiap 5 plugin biar nggak kepanjangan di 1 blok
        if ((i + 1) % 5 === 0 && i + 1 < pluginList.length) {
            out += `\n`
        }
    })

    out += `\n★ _Semua yang bersinar pasti punya alasan untuk bersinar~_ ✨`

    return m.reply(out)
}

module.exports = { config: pluginConfig, handler }