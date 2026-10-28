const path = require('path')
const fs   = require('fs')

// ── Load errorLog library ────────────────────────────────────────────────────
let errLib = null
try { errLib = require('../../src/lib/errorLog') } catch { errLib = null }

const pluginConfig = {
    name: 'pluginlog',
    alias: ['plog', 'logerr', 'errplugin', 'pluginerr', 'cekerrplugin'],
    category: 'owner',
    description: 'Filter error log per nama plugin/command, lihat stacktrace lengkap, dan analisis pola error',
    usage: '.pluginlog <nama> | .pluginlog <nama> full | .pluginlog <nama> clear',
    example: '.pluginlog smeme | .pluginlog tiktokdl full | .pluginlog autoai clear',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(isoString) {
    const diff = Date.now() - new Date(isoString).getTime()
    const s = Math.floor(diff / 1000)
    if (s < 60)  return `${s}d lalu`
    const m = Math.floor(s / 60)
    if (m < 60)  return `${m}m lalu`
    const h = Math.floor(m / 60)
    if (h < 24)  return `${h}j lalu`
    const d = Math.floor(h / 24)
    return `${d}hr lalu`
}

/**
 * Match entry ke keyword.
 * Cek di: command, plugin, stack (nama file), message.
 * Contoh: keyword "smeme" cocok dengan command="smeme" ATAU stack yang ada "smeme.js"
 */
function matchEntry(entry, keyword) {
    const kw = keyword.toLowerCase()

    // Match langsung di command name
    if (entry.command?.toLowerCase() === kw) return true

    // Match partial di command (misal "tiktok" cocok "tiktokdl", "tiktokdl2")
    if (entry.command?.toLowerCase().includes(kw)) return true

    // Match di plugin field (kalau ada)
    if (entry.plugin?.toLowerCase().includes(kw)) return true

    // Match di stacktrace — nama file plugin
    if (entry.stack?.toLowerCase().includes(`${kw}.js`)) return true
    if (entry.stack?.toLowerCase().includes(`plugins/${kw}`)) return true

    // Match di pesan error
    if (entry.message?.toLowerCase().includes(kw)) return true

    return false
}

function formatEntryShort(e, idx) {
    const lines = [
        `╭┈┈⬡「 ❌ *ERROR #${idx}* — ${timeAgo(e.timestamp)} 」`,
    ]
    if (e.command) lines.push(`┃ ⚡ Command  : \`.${e.command}\``)
    if (e.sender)  lines.push(`┃ 👤 Sender   : ${e.sender.split('@')[0]}`)
    lines.push(    `┃ 💔 Error    : ${(e.message || '-').substring(0, 100)}`)

    // Satu baris stack paling relevan (baris yang ada "plugins/")
    if (e.stack) {
        const relevantLine = e.stack.split('\n')
            .find(l => l.includes('plugins/') || l.includes('at handler'))
            ?.trim()
        if (relevantLine) lines.push(`┃ 📍 Stack    : ${relevantLine.substring(0, 90)}`)
    }

    lines.push(`╰┈┈⬡`)
    return lines.join('\n')
}

function formatEntryFull(e, idx) {
    const lines = [
        `╭┈┈⬡「 ❌ *ERROR #${idx}* 」`,
        `┃ 🕐 Waktu    : ${e.timestamp} (${timeAgo(e.timestamp)})`,
    ]
    if (e.command) lines.push(`┃ ⚡ Command  : \`.${e.command}\``)
    if (e.plugin)  lines.push(`┃ 🔌 Plugin   : ${e.plugin}`)
    if (e.sender)  lines.push(`┃ 👤 Sender   : ${e.sender.split('@')[0]}`)
    if (e.chat)    lines.push(`┃ 💬 Chat     : ${e.chat.split('@')[0]}`)
    if (e.args?.length) lines.push(`┃ 📝 Args     : ${JSON.stringify(e.args).substring(0, 60)}`)
    lines.push(    `┃ 💔 Error    : ${e.message || '-'}`)
    lines.push(    `╰┈┈⬡`)

    if (e.stack) {
        lines.push(`\`\`\`\n${e.stack.substring(0, 600)}\`\`\``)
    }

    return lines.join('\n')
}

// ─── Analisis pola error untuk satu plugin ───────────────────────────────────

function analyzeErrors(entries) {
    if (!entries.length) return null

    // Frekuensi pesan error
    const msgCount = {}
    for (const e of entries) {
        const key = (e.message || 'unknown').substring(0, 80)
        msgCount[key] = (msgCount[key] || 0) + 1
    }
    const topMsgs = Object.entries(msgCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)

    // Frekuensi sender yang trigger error
    const senderCount = {}
    for (const e of entries) {
        if (e.sender) {
            const s = e.sender.split('@')[0]
            senderCount[s] = (senderCount[s] || 0) + 1
        }
    }
    const topSenders = Object.entries(senderCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)

    // Error dalam 24 jam terakhir
    const last24h = entries.filter(e => Date.now() - new Date(e.timestamp).getTime() < 86400000).length

    // Deteksi pola berulang — kalau pesan error top 1 muncul > 50% → kemungkinan bug sistematis
    const dominantPct = entries.length > 0 ? ((topMsgs[0]?.[1] || 0) / entries.length) * 100 : 0

    return { topMsgs, topSenders, last24h, dominantPct }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

async function handler(m, { sock }) {
    // Cek library
    if (!errLib) {
        return m.reply(
            `❌ *Library errorLog tidak ditemukan!*\n\n` +
            `> Pastikan file \`src/lib/errorLog.js\` ada.\n` +
            `> Dan \`logError\` sudah di-import di \`src/handler.js\`.`
        )
    }

    const args    = m.args || []
    const keyword = args[0]?.toLowerCase().replace(/^\./, '')
    const sub     = args[1]?.toLowerCase() || ''

    // ── Tidak ada keyword → tampilkan ringkasan semua command yang pernah error ──
    if (!keyword) {
        m.react('📋')
        const all = errLib.getAllErrors()

        if (!all.length) {
            return m.reply(
                `📭 *Log kosong~*\n\n` +
                `> Belum ada error yang tercatat. Bot sehat! 💪`
            )
        }

        // Kelompokkan per command
        const byCmd = {}
        for (const e of all) {
            const key = e.command || e.plugin || '(unknown)'
            if (!byCmd[key]) byCmd[key] = { count: 0, last: e.timestamp }
            byCmd[key].count++
            // timestamp sudah sort terbaru di atas, jadi first = terbaru
        }

        const sorted = Object.entries(byCmd).sort((a, b) => b[1].count - a[1].count)

        let txt = `📋 *ᴘʟᴜɢɪɴ ʟᴏɢ — ꜱᴇᴍᴜᴀ ᴄᴏᴍᴍᴀɴᴅ ᴇʀʀᴏʀ*\n`
        txt += `> Total: *${all.length}* error dari *${sorted.length}* command\n\n`
        txt += `╭┈┈⬡「 🔥 *ᴇʀʀᴏʀ ᴛᴇʀʙᴀɴʏᴀᴋ* 」\n`

        for (const [cmd, info] of sorted.slice(0, 15)) {
            txt += `┃ \`.${cmd}\` — *${info.count}x* (${timeAgo(info.last)})\n`
        }
        if (sorted.length > 15) txt += `┃ ...dan ${sorted.length - 15} command lainnya\n`

        txt += `╰┈┈⬡\n\n`
        txt += `_Filter per plugin: \`.pluginlog <nama>\`_\n`
        txt += `_Stacktrace lengkap: \`.pluginlog <nama> full\`_`

        return m.reply(txt)
    }

    // ── Ada keyword → filter errors untuk plugin itu ────────────────────────────
    m.react('🔍')
    const all     = errLib.getAllErrors()
    const matched = all.filter(e => matchEntry(e, keyword))

    if (!matched.length) {
        return m.reply(
            `📭 *Tidak ada error untuk "${keyword}"*\n\n` +
            `> Plugin ini belum pernah tercatat error~ 🎉\n` +
            `> Atau coba keyword lain (nama command, alias, atau keyword di stacktrace).`
        )
    }

    // ── Sub: clear — hapus error untuk plugin ini ────────────────────────────
    if (sub === 'clear' || sub === 'hapus' || sub === 'reset') {
        const remaining = all.filter(e => !matchEntry(e, keyword))

        // Tulis ulang log tanpa entry yang matched
        // errLib tidak punya clearByFilter, jadi akses file langsung
        const LOG_FILE = path.join(process.cwd(), 'logs', 'error.log')
        try {
            fs.writeFileSync(LOG_FILE, JSON.stringify(remaining, null, 2), 'utf-8')
        } catch (e) {
            return m.reply(`❌ *Gomen ne~* Gagal hapus log: ${e.message} 🥺`)
        }

        m.react('✅')
        return m.reply(
            `✅ *Error log "${keyword}" dihapus!*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 🗑️ Dihapus  : *${matched.length}* entry\n` +
            `┃ 📦 Sisa log : *${remaining.length}* entry\n` +
            `╰┈┈⬡`
        )
    }

    // ── Sub: full — tampilkan dengan stacktrace lengkap ──────────────────────
    if (sub === 'full' || sub === 'stack' || sub === 'detail') {
        const limit   = Math.min(matched.length, 5)
        const entries = matched.slice(0, limit)
        const analysis = analyzeErrors(matched)

        let txt = `🔍 *ᴘʟᴜɢɪɴ ʟᴏɢ (ꜰᴜʟʟ): ${keyword}*\n`
        txt += `> ${matched.length} error — menampilkan ${limit} terbaru\n\n`

        if (analysis) {
            txt += `╭┈┈⬡「 📊 *ᴀɴᴀʟɪꜱɪꜱ* 」\n`
            txt += `┃ 24 jam terakhir : *${analysis.last24h}x*\n`
            if (analysis.dominantPct > 50) {
                txt += `┃ ⚠️ Bug sistematis: *${analysis.dominantPct.toFixed(0)}%* error sama\n`
            }
            if (analysis.topSenders.length) {
                txt += `┃ Sering dari     : ${analysis.topSenders.map(([s,c]) => `${s}(${c}x)`).join(', ')}\n`
            }
            txt += `╰┈┈⬡\n\n`
        }

        txt += entries.map((e, i) => formatEntryFull(e, i + 1)).join('\n\n')

        if (matched.length > limit) {
            txt += `\n\n> _(${matched.length - limit} error lainnya tidak ditampilkan)_`
        }

        return m.reply(txt)
    }

    // ── Default: tampilkan ringkasan + analisis ───────────────────────────────
    const limit    = Math.min(matched.length, 8)
    const entries  = matched.slice(0, limit)
    const analysis = analyzeErrors(matched)

    let txt = `🔍 *ᴘʟᴜɢɪɴ ʟᴏɢ: ${keyword}*\n`
    txt += `> *${matched.length}* error ditemukan\n\n`

    // Analisis
    if (analysis) {
        txt += `╭┈┈⬡「 📊 *ᴀɴᴀʟɪꜱɪꜱ* 」\n`
        txt += `┃ 24j terakhir  : *${analysis.last24h}x*\n`

        if (analysis.topMsgs.length) {
            txt += `┃ Error terbanyak:\n`
            for (const [msg, count] of analysis.topMsgs) {
                txt += `┃   [${count}x] ${msg.substring(0, 60)}\n`
            }
        }

        if (analysis.dominantPct > 60) {
            txt += `┃ ⚠️ *${analysis.dominantPct.toFixed(0)}%* error identik — kemungkinan bug konsisten\n`
        }

        if (analysis.topSenders.length) {
            txt += `┃ Trigger terbanyak dari:\n`
            for (const [s, c] of analysis.topSenders) {
                txt += `┃   ${s} (${c}x)\n`
            }
        }
        txt += `╰┈┈⬡\n\n`
    }

    // Daftar error
    txt += entries.map((e, i) => formatEntryShort(e, i + 1)).join('\n\n')

    if (matched.length > limit) {
        txt += `\n\n> _(${matched.length - limit} error lainnya — gunakan \`.pluginlog ${keyword} full\` untuk detail)_`
    }

    txt += `\n\n_Subcommand:_\n`
    txt += `> \`.pluginlog ${keyword} full\` — stacktrace lengkap\n`
    txt += `> \`.pluginlog ${keyword} clear\` — hapus log ini`

    return m.reply(txt)
}

module.exports = { config: pluginConfig, handler }