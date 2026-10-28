const path = require('path')
const fs   = require('fs')
const config = require('../../config')
const { generateWAMessageFromContent, proto } = require('hsnai')

// ── Import library error log ──────────────────────────────────────────────────
let errLib = null
try {
    errLib = require('../../src/lib/errorLog')
} catch {
    errLib = null
}

const pluginConfig = {
    name: 'errorlog',
    alias: ['erlog', 'errlog', 'cekeror', 'logerror', 'clearerrorlog', 'statslog'],
    category: 'owner',
    description: 'Lihat, filter, dan kelola error log runtime bot',
    usage: '.errorlog [recent|stats|clear|clearold <hari>|find <kata>]',
    example: '.errorlog recent | .errorlog stats | .errorlog clear | .errorlog find connection',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

// ── Formatter waktu relatif ───────────────────────────────────────────────────
function timeAgo(isoString) {
    const diff = Date.now() - new Date(isoString).getTime()
    const s = Math.floor(diff / 1000)
    if (s < 60)   return `${s}d lalu`
    const m = Math.floor(s / 60)
    if (m < 60)   return `${m}m lalu`
    const h = Math.floor(m / 60)
    if (h < 24)   return `${h}j lalu`
    const d = Math.floor(h / 24)
    return `${d}hr lalu`
}

// ── Format satu entry error ───────────────────────────────────────────────────
function formatEntry(e, idx) {
    const lines = [
        `╭┈┈⬡「 ❌ *ERROR #${idx}* 」`,
        `┃ 🕐 ${timeAgo(e.timestamp)}`,
    ]
    if (e.command) lines.push(`┃ ⚡ Command: \`.${e.command}\``)
    if (e.sender)  lines.push(`┃ 👤 Sender: ${e.sender.split('@')[0]}`)
    if (e.chat)    lines.push(`┃ 💬 Chat: ${e.chat.split('@')[0]}`)
    lines.push(`┃ 💔 Error: ${(e.message || '-').substring(0, 120)}`)
    if (e.stack) {
        const stackLine = e.stack.split('\n')[1]?.trim()
        if (stackLine) lines.push(`┃ 📍 ${stackLine.substring(0, 80)}`)
    }
    lines.push(`╰┈┈┈┈┈┈┈┈⬡`)
    return lines.join('\n')
}

// ── Format lengkap untuk isi copy button ──────────────────────────────────────
function formatEntryCopy(e) {
    const lines = [
        `ERROR LOG`,
        `Waktu: ${new Date(e.timestamp).toLocaleString('id-ID')}`,
    ]
    if (e.command) lines.push(`Command: .${e.command}`)
    if (e.sender)  lines.push(`Sender: ${e.sender}`)
    if (e.chat)    lines.push(`Chat: ${e.chat}`)
    lines.push(`Message: ${e.message || '-'}`)
    if (e.stack)   lines.push(`Stack:\n${e.stack}`)
    return lines.join('\n')
}

// ── Kirim list error + tombol select berisi semua button salin ───────────────
async function sendWithCopyButtons(m, sock, entries, headerText, refreshCmd) {
    const prefix = m.prefix || '.'

    const buttons = [
        {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
                display_text: '🔄 Refresh Error Log',
                id: `${prefix}${refreshCmd}`
            })
        },
        ...entries.map((e, i) => ({
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
                display_text: `📋 Salin Error Log ${i + 1}`,
                copy_code: formatEntryCopy(e)
            })
        }))
    ]

    const saluranId   = config.saluran?.id || config.info?.website
    const saluranName = config.saluran?.name || config.bot?.name || 'Hoshino Ai'

    const msg = generateWAMessageFromContent(
        m.chat,
        {
            viewOnceMessage: {
                message: {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2,
                    },
                    interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                        body: proto.Message.InteractiveMessage.Body.fromObject({
                            text: headerText,
                        }),
                        footer: proto.Message.InteractiveMessage.Footer.fromObject({
                            text: `© ${config.bot?.name || 'Hoshino Ai'}`,
                        }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                            messageParamsJson: JSON.stringify({
                                bottom_sheet: {
                                    in_thread_buttons_limit: 2,
                                    divider_indices: [1],
                                    list_title: 'Pilih error yang mau disalin~',
                                    button_title: '📋 Salin Error Log'
                                }
                            }),
                            buttons: buttons
                        }),
                        contextInfo: {
                            mentionedJid: [m.sender],
                            forwardingScore: 9999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: saluranId,
                                newsletterName: saluranName,
                                serverMessageId: 127,
                            },
                        },
                    }),
                },
            },
        },
        { userJid: m.sender, quoted: m },
    )

    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}

async function handler(m, { sock }) {
    // ── Cek library tersedia ──────────────────────────────────────────────────
    if (!errLib) {
        return m.reply(
            `❌ *Library errorLog belum diinstall!*\n\n` +
            `> Taruh file \`src/lib/errorLog.js\` dulu~\n` +
            `> Lalu tambahkan di \`src/handler.js\`:\n\n` +
            `\`\`\`const { logError } = require('./lib/errorLog')\n` +
            `// di catch block:\nlogError(error, { command: m.command, sender: m.sender, chat: m.chat })\`\`\``
        )
    }

    const sub  = (m.args?.[0] || 'recent').toLowerCase()
    const arg2 = m.args?.[1] || ''

    // ── .errorlog stats ───────────────────────────────────────────────────────
    if (sub === 'stats') {
        m.react('📊')
        const stats = errLib.getErrorStats()

        if (!stats) {
            return m.reply(
                `📭 *Log masih kosong~*\n\n` +
                `> Belum ada error yang tercatat. Bagus dong! 💖`
            )
        }

        let txt = `📊 *ꜱᴛᴀᴛɪꜱᴛɪᴋ ᴇʀʀᴏʀ ʟᴏɢ*\n\n`
        txt += `╭┈┈⬡「 📋 *ᴏᴠᴇʀᴠɪᴇᴡ* 」\n`
        txt += `┃ 📦 Total: *${stats.total}* error\n`
        txt += `┃ 🕐 24 jam terakhir: *${stats.last24h}* error\n`
        txt += `┃ 📅 7 hari terakhir: *${stats.last7d}* error\n`
        txt += `┃ 🕰️ Error terlama: ${stats.oldest ? timeAgo(stats.oldest) : '-'}\n`
        txt += `┃ 🆕 Error terbaru: ${stats.newest ? timeAgo(stats.newest) : '-'}\n`
        txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`

        if (stats.topCmd.length) {
            txt += `╭┈┈⬡「 ⚡ *ᴄᴏᴍᴍᴀɴᴅ ᴘᴀʟɪɴɢ ꜱᴇʀɪɴɢ ᴇʀʀᴏʀ* 」\n`
            for (const [cmd, count] of stats.topCmd) {
                txt += `┃ .${cmd} → *${count}x*\n`
            }
            txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`
        }

        if (stats.topMsg.length) {
            txt += `╭┈┈⬡「 💔 *ᴘᴇꜱᴀɴ ᴇʀʀᴏʀ ᴛᴇʀꜱᴇʀɪɴɢ* 」\n`
            for (const [msg, count] of stats.topMsg) {
                txt += `┃ [${count}x] ${msg}\n`
            }
            txt += `╰┈┈┈┈┈┈┈┈⬡`
        }

        return m.reply(txt)
    }

    // ── .errorlog clear ───────────────────────────────────────────────────────
    if (sub === 'clear' || m.command === 'clearerrorlog') {
        m.react('🗑️')
        errLib.clearLogs()
        m.react('✅')
        return m.reply(
            `✅ *Error log berhasil dihapus!*\n\n` +
            `> Semua log sudah dibersihkan~ Fresh start! 💖✨`
        )
    }

    // ── .errorlog clearold <hari> ─────────────────────────────────────────────
    if (sub === 'clearold') {
        const days = parseInt(arg2) || 7
        m.react('🧹')
        const remaining = errLib.clearOlderThan(days)
        m.react('✅')
        return m.reply(
            `✅ *Log lama berhasil dibersihkan!*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 🗑️ Hapus log > *${days} hari*\n` +
            `┃ 📦 Sisa log: *${remaining}* entry\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }

    // ── .errorlog find <keyword> ──────────────────────────────────────────────
    if (sub === 'find') {
        if (!arg2) return m.reply(`❌ Masukin keyword-nya ya~\n\n> Contoh: \`.errorlog find connection\``)

        m.react('🔍')
        const keyword = arg2.toLowerCase()
        const all     = errLib.getAllErrors()
        const found   = all.filter(e =>
            e.message?.toLowerCase().includes(keyword) ||
            e.command?.toLowerCase().includes(keyword) ||
            e.stack?.toLowerCase().includes(keyword)
        ).slice(0, 5)

        if (!found.length) {
            return m.reply(
                `🔍 *Tidak ditemukan~*\n\n` +
                `> Keyword "*${arg2}*" tidak ada di error log.`
            )
        }

        let txt = `🔍 *ʜᴀꜱɪʟ ᴘᴇɴᴄᴀʀɪᴀɴ: "${arg2}"*\n`
        txt += `> Ditemukan ${found.length} error\n\n`
        txt += found.map((e, i) => formatEntry(e, i + 1)).join('\n\n')

        return sendWithCopyButtons(m, sock, found, txt, `errorlog find ${arg2}`)
    }

    // ── .errorlog recent (default) ────────────────────────────────────────────
    m.react('📋')
    const n      = parseInt(arg2) || 5
    const limit  = Math.min(n, 20)  // max 20 sekaligus
    const recent = errLib.getRecentErrors(limit)

    if (!recent.length) {
        return m.reply(
            `📭 *Log masih kosong~*\n\n` +
            `> Belum ada error yang tercatat. Bot sehat! 💪✨`
        )
    }

    const stats = errLib.getErrorStats()
    let txt = `📋 *${limit} ᴇʀʀᴏʀ ᴛᴇʀʙᴀʀᴜ*\n`
    txt += `> Total: ${stats?.total || recent.length} error tersimpan\n\n`
    txt += recent.map((e, i) => formatEntry(e, i + 1)).join('\n\n')
    txt += `\n\n> Ketik \`.errorlog stats\` untuk statistik lengkap~`

    return sendWithCopyButtons(m, sock, recent, txt, `errorlog recent ${limit}`)
}

module.exports = {
    config: pluginConfig,
    handler
}