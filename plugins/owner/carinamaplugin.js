const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: 'carinamaplugin',
    alias: ['cnp', 'namafile'],
    category: 'owner',
    description: 'Cari nama file .js plugin berdasarkan nama command atau alias',
    usage: '.cnp <command/alias>',
    example: '.cnp rvoown',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

function loadAllPluginsWithPath() {
    const results = []
    const pluginsDir = path.join(__dirname, '..')

    try {
        const categories = fs.readdirSync(pluginsDir).filter(f => {
            try {
                return fs.statSync(path.join(pluginsDir, f)).isDirectory()
            } catch {
                return false
            }
        })

        for (const category of categories) {
            const categoryPath = path.join(pluginsDir, category)
            const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'))

            for (const file of files) {
                const filePath = path.join(categoryPath, file)
                try {
                    const plugin = require(filePath)
                    if (plugin.config && plugin.config.name) {
                        results.push({
                            fileName: file,
                            filePath: `plugins/${category}/${file}`,
                            name: Array.isArray(plugin.config.name) ? plugin.config.name[0] : plugin.config.name,
                            alias: plugin.config.alias || [],
                            category: plugin.config.category || category,
                            description: plugin.config.description || 'Tidak ada deskripsi',
                            usage: plugin.config.usage || 'Tidak ada',
                            example: plugin.config.example || 'Tidak ada',
                            isEnabled: plugin.config.isEnabled !== false,
                            isPremium: plugin.config.isPremium || false,
                            isOwner: plugin.config.isOwner || false,
                            isGroup: plugin.config.isGroup || false,
                            isPrivate: plugin.config.isPrivate || false,
                            cooldown: plugin.config.cooldown || 0,
                            energi: plugin.config.energi || 0
                        })
                    }
                } catch {}
            }
        }
    } catch {}

    return results
}

async function handler(m, { sock }) {
    const keyword = m.body.split(' ').slice(1).join(' ').trim().toLowerCase()

    if (!keyword) {
        return m.reply(
            `⭐ *Hoshino Ai - Cari Nama Plugin*\n\n` +
            `Fufu~ Kasih keyword-nya dulu ya senpai~\n` +
            `Biar Ai bisa bantu cariin nama file plugin-nya ♡\n\n` +
            `*Cara pakai:*\n` +
            `*.cnp <nama command atau alias>*\n\n` +
            `_Contoh: .cnp rvoown_\n` +
            `_Contoh: .cnp sticker_\n\n` +
            `> _"Ai loves you~!"_ ⭐`
        )
    }

    m.react('⭐')

    try {
        const allPlugins = loadAllPluginsWithPath()
        const matches = []

        for (const plugin of allPlugins) {
            const nameMatch = plugin.name.toLowerCase() === keyword ||
                plugin.name.toLowerCase().includes(keyword)

            const aliasMatch = plugin.alias.some(a =>
                a.toLowerCase() === keyword ||
                a.toLowerCase().includes(keyword)
            )

            const fileMatch = plugin.fileName.toLowerCase().replace('.js', '') === keyword ||
                plugin.fileName.toLowerCase().includes(keyword)

            if (nameMatch || aliasMatch || fileMatch) {
                matches.push({
                    ...plugin,
                    exactMatch: plugin.name.toLowerCase() === keyword || plugin.alias.some(a => a.toLowerCase() === keyword)
                })
            }
        }

        matches.sort((a, b) => b.exactMatch - a.exactMatch)

        if (matches.length === 0) {
            m.react('❌')
            return m.reply(
                `⭐ *Hoshino Ai - Cari Nama Plugin*\n\n` +
                `Muu~ Gak ketemu plugin dengan keyword *"${keyword}"* senpai~\n` +
                `Mungkin nama atau alias-nya beda~ Coba keyword lain ya ♡\n\n` +
                `> _"Ai loves you~!"_ ⭐`
            )
        }

        let text = `⭐ *Hoshino Ai - Hasil Cari Plugin*\n\n`
        text += `Fufu~ Ai ketemu *${matches.length}* plugin untuk keyword *"${keyword}"*~\n`
        text += `Ini dia info lengkapnya senpai ♡\n\n`

        for (let i = 0; i < matches.length; i++) {
            const p = matches[i]

            const badges = []
            if (p.isPremium) badges.push('💎 Premium')
            if (p.isOwner) badges.push('👑 Owner Only')
            if (!p.isEnabled) badges.push('🔴 Disabled')

            const restrictions = []
            if (p.isGroup) restrictions.push('Grup Only')
            if (p.isPrivate) restrictions.push('Private Only')
            if (!p.isGroup && !p.isPrivate) restrictions.push('Semua Chat')

            text += `*${i + 1}. Info Plugin*\n`
            text += `┌─────────────────\n`
            text += `│ 📄 *Nama File:* \`${p.fileName}\`\n`
            text += `│ 📂 *Path File:* \`${p.filePath}\`\n`
            text += `│ 🏷️ *Nama Command:* \`${p.name}\`\n`
            text += `│ 🔗 *Alias:* ${p.alias.length > 0 ? p.alias.map(a => `\`${a}\``).join(', ') : '_Tidak ada_'}\n`
            text += `│ 📁 *Kategori:* \`${p.category}\`\n`
            text += `│ 📝 *Deskripsi:* ${p.description}\n`
            text += `│ 💡 *Usage:* \`${p.usage}\`\n`
            text += `│ 📌 *Contoh:* \`${p.example}\`\n`
            text += `│ ⏱️ *Cooldown:* ${p.cooldown}s\n`
            text += `│ ⚡ *Energi:* ${p.energi}\n`
            text += `│ 🔒 *Akses:* ${badges.length > 0 ? badges.join(', ') : 'Semua User'}\n`
            text += `│ 📍 *Restriksi:* ${restrictions.join(', ')}\n`
            text += `│ 🟢 *Status:* ${p.isEnabled ? 'Aktif' : 'Nonaktif'}\n`
            text += `└─────────────────\n\n`
        }

        text += `_Ditemukan ${matches.length} plugin ~ Semoga membantu senpai!_\n\n`
        text += `> _"Tidak ada yang tersembunyi dari Ai~"_ ⭐`

        m.react('💛')
        await sock.sendMessage(m.chat, { text }, { quoted: m })

    } catch (error) {
        console.log('[cnp] error:', error.message)
        m.react('❌')
        m.reply(
            `❌ *Hoshino Ai Sedih...*\n\n` +
            `Muu~ Ai gagal cariin plugin-nya senpai~\n` +
            `Ada yang salah nih ♡\n\n` +
            `*Error:* _${error.message}_\n\n` +
            `> _"Ai loves you~!"_ ⭐`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}