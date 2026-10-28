const fs   = require('fs')
const path = require('path')
const { hotReloadPlugin, getPlugin, getAllPlugins } = require('../../src/lib/plugins')
const { execSync } = require('child_process')

const pluginConfig = {
    name: 'hotreload',
    alias: ['rl', 'reload', 'reloadplugin', 'refreshplugin', 'hr'],
    category: 'owner',
    description: 'Hot reload satu plugin, beberapa sekaligus, atau semua plugin — tanpa restart bot',
    usage: '.hotreload <nama|all|cat <kategori>>',
    example: '.hotreload ping | .hotreload ping,addplugin,menu | .hotreload cat owner | .hotreload all',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

const ROOT        = process.cwd()
const PLUGINS_DIR = path.join(ROOT, 'plugins')

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Cari file plugin di seluruh subfolder plugins/ by nama (tanpa .js) */
function findPluginFile(name) {
    if (!fs.existsSync(PLUGINS_DIR)) return null
    const nameLower = name.toLowerCase()

    const dirs = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())

    for (const dir of dirs) {
        const candidate = path.join(PLUGINS_DIR, dir.name, `${nameLower}.js`)
        if (fs.existsSync(candidate)) return candidate

        // Juga coba case-insensitive scan kalau nama plugin beda casing
        const files = fs.readdirSync(path.join(PLUGINS_DIR, dir.name))
        for (const f of files) {
            if (f.toLowerCase() === `${nameLower}.js`) {
                return path.join(PLUGINS_DIR, dir.name, f)
            }
        }
    }
    return null
}

/** Ambil semua file .js dari folder kategori tertentu */
function getFilesByCategory(category) {
    const catDir = path.join(PLUGINS_DIR, category.toLowerCase())
    if (!fs.existsSync(catDir) || !fs.statSync(catDir).isDirectory()) return []
    return fs.readdirSync(catDir)
        .filter(f => f.endsWith('.js'))
        .map(f => path.join(catDir, f))
}

/** Ambil semua file .js plugin dari semua subfolder */
function getAllPluginFiles() {
    if (!fs.existsSync(PLUGINS_DIR)) return []
    const files = []
    const dirs = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
    for (const dir of dirs) {
        const dirPath = path.join(PLUGINS_DIR, dir.name)
        const jsFiles = fs.readdirSync(dirPath)
            .filter(f => f.endsWith('.js'))
            .map(f => path.join(dirPath, f))
        files.push(...jsFiles)
    }
    return files
}

/** Validasi syntax JS sebelum reload */
function checkSyntax(filePath) {
    try {
        execSync(`node --check "${filePath}"`, { stdio: 'pipe' })
        return { ok: true }
    } catch (e) {
        const msg = (e.stderr?.toString() || e.message || '').split('\n').slice(0, 3).join('\n')
        return { ok: false, error: msg }
    }
}

/** Format durasi milliseconds */
function fmtMs(ms) {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
}

// ─── Reload satu file ─────────────────────────────────────────────────────────

function reloadOne(filePath, skipSyntax = false) {
    const name = path.basename(filePath, '.js')

    if (!skipSyntax) {
        const syntax = checkSyntax(filePath)
        if (!syntax.ok) return { name, success: false, error: `Syntax error:\n${syntax.error}` }
    }

    try {
        const result = hotReloadPlugin(filePath)
        if (result.success) {
            return { name: result.name || name, success: true }
        }
        return { name, success: false, error: result.error || 'hotReloadPlugin returned false' }
    } catch (e) {
        return { name, success: false, error: e.message }
    }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

async function handler(m, { sock }) {
    const args  = m.args || []
    const sub   = (args[0] || '').toLowerCase().trim()

    if (!sub) {
        return m.reply(
            `🔄 *ʜᴏᴛ ʀᴇʟᴏᴀᴅ*\n\n` +
            `> Reload plugin tanpa restart bot.\n\n` +
            `*Cara pakai:*\n` +
            `> \`.hotreload ping\` — reload 1 plugin\n` +
            `> \`.hotreload ping,menu,addplugin\` — reload beberapa\n` +
            `> \`.hotreload cat owner\` — reload semua plugin 1 kategori\n` +
            `> \`.hotreload all\` — reload SEMUA plugin ⚠️\n\n` +
            `> Alias: \`.rl\`, \`.reload\`, \`.hr\``
        )
    }

    // ── Mode: cat <kategori> ─────────────────────────────────────────────────
    if (sub === 'cat' || sub === 'category' || sub === 'kategori') {
        const catName = args[1]?.toLowerCase()
        if (!catName) return m.reply(`❌ Masukin nama kategorinya~\n\n> Contoh: \`.hotreload cat owner\``)

        m.react('🔄')
        const files = getFilesByCategory(catName)
        if (!files.length) {
            return m.reply(
                `❌ *Kategori "${catName}" tidak ditemukan*\n\n` +
                `> Cek nama folder di \`plugins/\` — gunakan nama folder persis.`
            )
        }

        const start   = Date.now()
        const results = files.map(f => reloadOne(f))
        const elapsed = Date.now() - start

        const ok  = results.filter(r => r.success)
        const err = results.filter(r => !r.success)

        m.react(err.length === 0 ? '✅' : '⚠️')

        let txt = `🔄 *ʀᴇʟᴏᴀᴅ ᴋᴀᴛᴇɢᴏʀɪ: ${catName}*\n\n`
        txt += `╭┈┈⬡「 📋 *ʀᴇꜱᴜʟᴛ* 」\n`
        txt += `┃ ✅ Berhasil : *${ok.length}* plugin\n`
        txt += `┃ ❌ Gagal    : *${err.length}* plugin\n`
        txt += `┃ ⏱️ Waktu    : *${fmtMs(elapsed)}*\n`
        txt += `╰┈┈⬡\n`

        if (ok.length) {
            txt += `\n✅ *Berhasil:*\n`
            txt += ok.map(r => `  • \`.${r.name}\``).join('\n')
        }
        if (err.length) {
            txt += `\n\n❌ *Gagal:*\n`
            txt += err.map(r => `  • \`.${r.name}\`\n    _${r.error?.split('\n')[0]}_`).join('\n')
        }

        return m.reply(txt)
    }

    // ── Mode: all ─────────────────────────────────────────────────────────────
    if (sub === 'all' || sub === 'semua') {
        m.react('⏳')

        const files   = getAllPluginFiles()
        const start   = Date.now()
        const results = files.map(f => reloadOne(f, true)) // skip syntax check per file biar cepat
        const elapsed = Date.now() - start

        const ok   = results.filter(r => r.success)
        const err  = results.filter(r => !r.success)

        m.react(err.length === 0 ? '✅' : '⚠️')

        let txt = `🔄 *ʀᴇʟᴏᴀᴅ ᴀʟʟ ᴘʟᴜɢɪɴꜱ*\n\n`
        txt += `╭┈┈⬡「 📋 *ʀᴇꜱᴜʟᴛ* 」\n`
        txt += `┃ 📦 Total    : *${files.length}* plugin\n`
        txt += `┃ ✅ Berhasil : *${ok.length}* plugin\n`
        txt += `┃ ❌ Gagal    : *${err.length}* plugin\n`
        txt += `┃ ⏱️ Waktu    : *${fmtMs(elapsed)}*\n`
        txt += `╰┈┈⬡`

        if (err.length) {
            txt += `\n\n❌ *Plugin gagal reload:*\n`
            txt += err.slice(0, 10).map(r => `  • \`.${r.name}\` — ${r.error?.split('\n')[0]}`).join('\n')
            if (err.length > 10) txt += `\n  ...dan ${err.length - 10} lainnya`
        }

        txt += `\n\n> Semua plugin sudah di-reload~ 💖`
        return m.reply(txt)
    }

    // ── Mode: satu atau beberapa nama (dipisah koma) ──────────────────────────
    const names = sub.split(',').map(n => n.trim().replace(/^\./, '')).filter(Boolean)

    // Resolve filePath untuk setiap nama
    const tasks = names.map(name => {
        // Prioritas 1: dari pluginStore (plugin sudah loaded, ada filePath)
        const existing = getPlugin(name)
        if (existing?.filePath && fs.existsSync(existing.filePath)) {
            return { name, filePath: existing.filePath }
        }
        // Prioritas 2: scan disk
        const found = findPluginFile(name)
        if (found) return { name, filePath: found }
        // Tidak ditemukan
        return { name, filePath: null }
    })

    const notFound = tasks.filter(t => !t.filePath)
    if (notFound.length === tasks.length) {
        // Semua tidak ditemukan
        const list = notFound.map(t => `\`.${t.name}\``).join(', ')
        return m.reply(
            `❌ *Plugin tidak ditemukan:* ${list}\n\n` +
            `> Cek nama plugin-nya, atau gunakan \`.listplugin\` buat lihat semua plugin.`
        )
    }

    m.react('🔄')
    const start   = Date.now()
    const results = tasks.map(t => {
        if (!t.filePath) return { name: t.name, success: false, error: 'File tidak ditemukan' }
        return reloadOne(t.filePath)
    })
    const elapsed = Date.now() - start

    const ok  = results.filter(r => r.success)
    const err = results.filter(r => !r.success)

    // ── Single plugin reply ───────────────────────────────────────────────────
    if (names.length === 1) {
        const r = results[0]
        if (r.success) {
            m.react('✅')
            return m.reply(
                `✅ *ʀᴇʟᴏᴀᴅ ꜱᴜᴋꜱᴇꜱ*\n\n` +
                `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
                `┃ 📝 Plugin  : \`.${r.name}\`\n` +
                `┃ ⏱️ Waktu   : *${fmtMs(elapsed)}*\n` +
                `╰┈┈⬡\n\n` +
                `> Plugin sudah aktif dengan versi terbaru~ 💖`
            )
        } else {
            m.react('❌')
            return m.reply(
                `❌ *ʀᴇʟᴏᴀᴅ ɢᴀɢᴀʟ*\n\n` +
                `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
                `┃ 📝 Plugin : \`.${r.name}\`\n` +
                `┃ 💔 Error  : ${(r.error || '-').split('\n')[0]}\n` +
                `╰┈┈⬡\n\n` +
                (r.error?.includes('Syntax') ? `\`\`\`\n${r.error}\`\`\`` : '')
            )
        }
    }

    // ── Multi plugin reply ────────────────────────────────────────────────────
    m.react(err.length === 0 ? '✅' : '⚠️')

    let txt = `🔄 *ʀᴇʟᴏᴀᴅ ${names.length} ᴘʟᴜɢɪɴ*\n\n`
    txt += `╭┈┈⬡「 📋 *ʀᴇꜱᴜʟᴛ* 」\n`
    txt += `┃ ✅ Berhasil : *${ok.length}*\n`
    txt += `┃ ❌ Gagal    : *${err.length}*\n`
    txt += `┃ ⏱️ Waktu    : *${fmtMs(elapsed)}*\n`
    txt += `╰┈┈⬡\n`

    if (ok.length) {
        txt += `\n✅ *Berhasil:*\n`
        txt += ok.map(r => `  • \`.${r.name}\``).join('\n')
    }
    if (err.length) {
        txt += `\n\n❌ *Gagal:*\n`
        txt += err.map(r => `  • \`.${r.name}\` — ${r.error?.split('\n')[0]}`).join('\n')
    }

    return m.reply(txt)
}

module.exports = { config: pluginConfig, handler }