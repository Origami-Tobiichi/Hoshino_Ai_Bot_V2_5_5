const fs = require('fs')
const path = require('path')
const vm = require('vm')
const config = require('../../config')
const { pluginStore } = require('../../src/lib/plugins')

const pluginConfig = {
    name: 'pluginhealth',
    alias: ['ph', 'scanplugin', 'pluginscan', 'phscan', 'cekplugin'],
    category: 'owner',
    description: 'Scan semua plugin file — detect error, missing export, syntax issue (Owner Only)',
    usage: '.pluginhealth [all|fail|ok|full|cat <kategori>|check <nama>]',
    example: '.pluginhealth all\n.pluginhealth fail\n.pluginhealth cat owner\n.pluginhealth check menu',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

const REQUIRED_EXPORTS = ['config', 'handler']
const REQUIRED_CONFIG_FIELDS = ['name', 'category']
const VALID_SUBCOMMANDS = ['all', 'fail', 'ok', 'full', 'cat', 'check']

// ---------- style helpers (Hoshino Ai) ----------

const HEADER = '╭─❖ *ʜᴏsʜɪɴᴏ ᴀɪ • ᴘʟᴜɢɪɴ ʜᴇᴀʟᴛʜ* ❖─╮'
const FOOTER = '╰───────────────────╯'

function safeString(value, fallback) {
    if (typeof value === 'string' && value.trim() !== '') return value
    return fallback
}

function classifyRequireError(e) {
    if (e.code === 'MODULE_NOT_FOUND') {
        const match = e.message.match(/Cannot find module '([^']+)'/)
        return {
            type: 'MODULE_NOT_FOUND',
            text: `Module tidak ditemukan: \`${match ? match[1] : '?'}\``,
            requireStack: e.requireStack || null
        }
    }
    if (e.code === 'ERR_REQUIRE_ESM') {
        return { type: 'ESM_MISMATCH', text: `Konflik ESM/CommonJS: ${e.message}` }
    }
    return { type: 'RUNTIME_ERROR', text: `require() gagal: ${e.message}` }
}

function renderHelp(prefix) {
    return `${HEADER}\n\n` +
        `⭐ Eh, formatnya kurang tepat nih~\n` +
        `Aku, Hoshino Ai, gak ngerti maksudnya kalau cuma \`${prefix}ph\` doang 🌸\n\n` +
        `✦ \`${prefix}ph all\`\n` +
        `   Scan semua plugin, summary + detail error/warning\n\n` +
        `✦ \`${prefix}ph fail\`\n` +
        `   Tampilin plugin yang gagal load aja\n\n` +
        `✦ \`${prefix}ph ok\`\n` +
        `   Tampilin plugin yang sehat aja\n\n` +
        `✦ \`${prefix}ph full\`\n` +
        `   List semua plugin + status icon (✅/⚠️/❌)\n\n` +
        `✦ \`${prefix}ph cat <kategori>\`\n` +
        `   Scan satu folder aja, contoh: \`${prefix}ph cat store\`\n\n` +
        `✦ \`${prefix}ph check <namafile>\`\n` +
        `   Detail lengkap satu plugin, contoh: \`${prefix}ph check menu\`\n\n` +
        `> _Alias: ph, pluginhealth, scanplugin, pluginscan, phscan, cekplugin_\n` +
        `${FOOTER}`
}

// ---------- scanner core ----------

function scanFile(filePath) {
    const result = {
        filePath,
        fileName: path.basename(filePath),
        relPath: path.relative(process.cwd(), filePath),
        status: 'ok',
        errors: [],
        warnings: [],
        meta: null
    }

    // Safety net: apapun yang meledak selama scan SATU file,
    // jangan sampai bikin seluruh Array.map ikut berhenti.
    try {
        let raw
        try {
            raw = fs.readFileSync(filePath, 'utf-8')
        } catch (e) {
            result.status = 'error'
            result.errors.push(`Tidak bisa baca file: ${e.message}`)
            return result
        }

        try {
            // vm.Script cuma nge-parse buat cek syntax, gak eksekusi & gak
            // spawn proses baru — jauh lebih cepat & aman dibanding
            // execSync('node --check') buat ratusan file sekaligus.
            new vm.Script(raw, { filename: filePath, displayErrors: true })
        } catch (e) {
            result.status = 'error'
            result.errors.push(`Syntax error: ${e.message}`)
            return result
        }

        let mod
        try {
            delete require.cache[require.resolve(filePath)]
            mod = require(filePath)
        } catch (e) {
            result.status = 'error'
            const classified = classifyRequireError(e)
            result.errors.push(classified.text)
            if (classified.requireStack) result.requireStack = classified.requireStack
            return result
        }

        if (!mod || typeof mod !== 'object') {
            result.status = 'error'
            result.errors.push('module.exports tidak valid (kosong/bukan object)')
            return result
        }

        for (const key of REQUIRED_EXPORTS) {
            if (!(key in mod)) {
                result.status = 'error'
                result.errors.push(`Missing export: \`${key}\``)
            }
        }

        if (mod.config) {
            if (typeof mod.handler !== 'function') {
                result.status = 'error'
                result.errors.push(`handler bukan function (got ${typeof mod.handler})`)
            }

            for (const field of REQUIRED_CONFIG_FIELDS) {
                const val = mod.config[field]
                if (!val || (Array.isArray(val) && val.length === 0)) {
                    result.warnings.push(`config.${field} kosong atau tidak ada`)
                } else if (typeof val !== 'string' && !(field === 'name' && Array.isArray(val))) {
                    result.warnings.push(`config.${field} bukan string (got ${typeof val})`)
                }
            }

            if (mod.config.alias && !Array.isArray(mod.config.alias)) {
                result.warnings.push(`config.alias bukan Array (got ${typeof mod.config.alias})`)
            }

            if (mod.config.cooldown !== undefined && typeof mod.config.cooldown !== 'number') {
                result.warnings.push(`config.cooldown bukan number`)
            }

            const isSelf = path.basename(filePath) === 'pluginhealth.js'
            if (!isSelf && raw.includes('externalAdReply')) {
                result.warnings.push('Masih memakai `externalAdReply` (harusnya sudah dihapus)')
            }
            if (!isSelf && raw.includes('viewOnceMessage')) {
                result.warnings.push('Memakai `viewOnceMessage` — cek potensi error "versi WA tidak mendukung"')
            }

            const rawName = Array.isArray(mod.config.name) ? mod.config.name[0] : mod.config.name
            result.meta = {
                name: safeString(rawName, path.basename(filePath, '.js')),
                category: safeString(mod.config.category, '?'),
                alias: Array.isArray(mod.config.alias) ? mod.config.alias : [],
                isEnabled: mod.config.isEnabled !== false,
                isOwner: !!mod.config.isOwner,
            }
        }

        const registeredName = result.meta?.name?.toLowerCase()
        const isRegistered = registeredName ? pluginStore.commands.has(registeredName) : false
        if (!isRegistered && result.status === 'ok') {
            result.warnings.push(`Tidak terdaftar di pluginStore (mungkin belum di-load atau nama beda)`)
        }

        if (result.errors.length > 0) result.status = 'error'
        else if (result.warnings.length > 0) result.status = 'warn'

        return result
    } catch (e) {
        result.status = 'error'
        result.errors.push(`Scanner internal error: ${e.message}`)
        return result
    }
}

function collectPluginFiles(pluginsDir) {
    const files = []
    if (!fs.existsSync(pluginsDir)) return files

    const entries = fs.readdirSync(pluginsDir)
    for (const entry of entries) {
        const fullPath = path.join(pluginsDir, entry)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
            const subFiles = fs.readdirSync(fullPath)
            for (const f of subFiles) {
                if (f.endsWith('.js') && !f.startsWith('_')) {
                    files.push({ filePath: path.join(fullPath, f), category: entry })
                }
            }
        } else if (entry.endsWith('.js') && !entry.startsWith('_')) {
            files.push({ filePath: fullPath, category: 'root' })
        }
    }
    return files
}

function renderSummary(results, prefix) {
    const total = results.length
    const ok = results.filter(r => r.status === 'ok').length
    const warn = results.filter(r => r.status === 'warn').length
    const fail = results.filter(r => r.status === 'error').length

    const failList = results.filter(r => r.status === 'error')
    const warnList = results.filter(r => r.status === 'warn')

    let out = `${HEADER}\n\n`
    out += `⭐ Selesai discan~ Ini laporannya dari aku, Ai! 🌸\n\n`
    out += `┌ 📦 Total  : ${total} plugin\n`
    out += `├ ✅ Sehat  : ${ok}\n`
    out += `├ ⚠️ Warning: ${warn}\n`
    out += `└ ❌ Error  : ${fail}\n`
    out += `${FOOTER}\n`

    if (failList.length > 0) {
        out += `\n💫 *ɢᴀɢᴀʟ ʟᴏᴀᴅ (${failList.length}):*\n`
        for (const r of failList) {
            out += `\n> 📄 \`${r.relPath}\`\n`
            for (const e of r.errors) {
                out += `> • ${e}\n`
            }
            if (r.requireStack && r.requireStack.length) {
                out += `> stack:\n`
                out += r.requireStack.slice(0, 4).map(s => `>   - ${s}`).join('\n') + '\n'
            }
        }
    }

    if (warnList.length > 0) {
        out += `\n🎀 *ᴡᴀʀɴɪɴɢ (${warnList.length}):*\n`
        for (const r of warnList) {
            out += `\n> 📄 \`${r.relPath}\`\n`
            for (const w of r.warnings) {
                out += `> • ${w}\n`
            }
        }
    }

    if (failList.length === 0 && warnList.length === 0) {
        out += `\n> 🎉 Yeay~ semua plugin sehat! Aku bangga sama kamu~ ✨`
    } else {
        out += `\n> Ketik \`${prefix}ph check <nama>\` buat lihat detailnya ya~ 💖`
    }

    return out
}

// ---------- handler ----------

async function handler(m, { sock }) {
  try {
    if (!config.isOwner(m.sender)) {
        return m.reply('❌ *Maaf, ini command khusus owner aja ya~* 🙏💕')
    }

    const args = (m.text?.trim() || '').split(/\s+/)
    const sub = args[0]?.toLowerCase() || ''
    const pluginsDir = path.join(process.cwd(), 'plugins')

    if (!VALID_SUBCOMMANDS.includes(sub)) {
        m.react('❌')
        return m.reply(renderHelp(m.prefix))
    }

    if (sub === 'check') {
        const target = args[1]?.toLowerCase()
        if (!target) return m.reply(`❌ Usage: \`${m.prefix}ph check <namafile>\`\n> Contoh: \`${m.prefix}ph check menu\``)

        m.react('🔍')

        const allFiles = collectPluginFiles(pluginsDir)
        const match = allFiles.find(({ filePath }) =>
            path.basename(filePath, '.js').toLowerCase() === target
        )

        if (!match) return m.reply(`❌ File plugin \`${target}.js\` gak ketemu nih~`)

        const r = scanFile(match.filePath)

        const statusEmoji = r.status === 'ok' ? '✅' : r.status === 'warn' ? '⚠️' : '❌'
        let out = `${HEADER}\n\n`
        out += `📄 *ꜰɪʟᴇ ɪɴꜰᴏ*\n`
        out += `┌ 📍 path : \`${r.relPath}\`\n`
        if (r.meta) {
            out += `├ 🏷️ name : \`${r.meta.name}\`\n`
            out += `├ 📂 cat  : \`${r.meta.category}\`\n`
            out += `├ 🔗 alias: ${r.meta.alias.length ? r.meta.alias.map(a => `\`${a}\``).join(' ') : '-'}\n`
            out += `├ ${r.meta.isEnabled ? '🟢' : '🔴'} enabled: ${r.meta.isEnabled}\n`
            out += `├ ${r.meta.isOwner ? '👑' : '👤'} owner only: ${r.meta.isOwner}\n`
        }
        out += `└ ${statusEmoji} status : ${r.status.toUpperCase()}\n`
        out += `${FOOTER}\n`

        if (r.errors.length > 0) {
            out += `\n💫 *ᴇʀʀᴏʀs:*\n`
            for (const e of r.errors) out += `> • ${e}\n`
            if (r.requireStack && r.requireStack.length) {
                out += `\n📚 *require stack:*\n`
                out += r.requireStack.slice(0, 5).map(s => `> - ${s}`).join('\n') + '\n'
            }
        }
        if (r.warnings.length > 0) {
            out += `\n🎀 *ᴡᴀʀɴɪɴɢs:*\n`
            for (const w of r.warnings) out += `> • ${w}\n`
        }
        if (r.errors.length === 0 && r.warnings.length === 0) {
            out += `\n> ✅ Plugin sehat, gak ada masalah~ ✨`
        }

        m.react(r.status === 'ok' ? '✅' : r.status === 'warn' ? '⚠️' : '❌')
        return m.reply(out)
    }

    m.react('🔍')

    const allFiles = collectPluginFiles(pluginsDir)

    let targetFiles = allFiles
    if (sub === 'cat' && args[1]) {
        const catTarget = args[1].toLowerCase()
        targetFiles = allFiles.filter(({ category }) => category.toLowerCase() === catTarget)
        if (targetFiles.length === 0) {
            m.react('❌')
            return m.reply(`❌ Kategori \`${catTarget}\` gak ketemu atau kosong nih~`)
        }
    }

    const results = targetFiles.map(({ filePath }) => scanFile(filePath))

    if (sub === 'fail') {
        const failed = results.filter(r => r.status === 'error')
        if (failed.length === 0) {
            m.react('✅')
            return m.reply(`${HEADER}\n\n> ✅ Yeay~ gak ada plugin yang gagal load! 🌸\n${FOOTER}`)
        }
        let out = `${HEADER}\n\n💫 *ɢᴀɢᴀʟ ʟᴏᴀᴅ (${failed.length})*\n`
        for (const r of failed) {
            out += `\n> 📄 \`${r.relPath}\`\n`
            for (const e of r.errors) out += `> • ${e}\n`
        }
        out += `\n${FOOTER}`
        m.react('❌')
        return m.reply(out)
    }

    if (sub === 'ok') {
        const healthy = results.filter(r => r.status === 'ok')
        let out = `${HEADER}\n\n✅ *sᴇʜᴀᴛ (${healthy.length})*\n\n`
        out += healthy.map(r => `> ✅ \`${r.relPath}\``).join('\n')
        out += `\n\n${FOOTER}`
        m.react('✅')
        return m.reply(out)
    }

    if (sub === 'full') {
        let out = `${HEADER}\n\n📋 *ꜰᴜʟʟ ʟɪsᴛ (${results.length})*\n\n`
        for (const r of results) {
            const icon = r.status === 'ok' ? '✅' : r.status === 'warn' ? '⚠️' : '❌'
            out += `> ${icon} \`${r.relPath}\`\n`
        }
        out += `\n${FOOTER}`
        m.react('✅')
        return m.reply(out)
    }

    let summary = renderSummary(results, m.prefix)
    const failCount = results.filter(r => r.status === 'error').length

    const MAX_LEN = 4000
    if (summary.length > MAX_LEN) {
        summary = summary.slice(0, MAX_LEN) +
            `\n\n> ... (dipotong, total ${results.length} plugin)\n` +
            `> Pakai \`${m.prefix}ph fail\` atau \`${m.prefix}ph cat <kategori>\` buat hasil lebih ringkas ya~ 🌸`
    }

    m.react(failCount > 0 ? '❌' : '✅')
    return m.reply(summary)

  } catch (e) {
    console.log('[pluginhealth] handler error:', e)
    try {
        await m.react('❌')
        await m.reply(
            `❌ *Kyaa~ ada yang salah nih waktu aku scan plugin~* 🙏💕\n\n` +
            `> \`${e.message}\`\n\n` +
            `> Cek console Pterodactyl buat stack trace lengkapnya ya~`
        )
    } catch {}
  }
}

module.exports = {
    config: pluginConfig,
    handler
}