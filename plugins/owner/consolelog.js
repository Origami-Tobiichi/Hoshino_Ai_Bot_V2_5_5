const path = require('path')
const fs   = require('fs')
const config = require('../../config')
const { generateWAMessageFromContent, proto } = require('hsnai')

let logLib = null
try {
    logLib = require('../../src/lib/consoleLog')
} catch {
    logLib = null
}

const pluginConfig = {
    name: 'consolelog',
    alias: ['clog', 'ceklog', 'logconsole', 'clearconsolelog', 'statsclog'],
    category: 'owner',
    description: 'Lihat, filter, dan kelola console.log dari file plugin',
    usage: '.consolelog [recent|stats|clear|clearold <hari>|find <kata>]',
    example: '.consolelog recent | .consolelog stats | .consolelog clear | .consolelog find fetch',
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

// ── Format satu entry log ─────────────────────────────────────────────────────
function formatEntry(l, idx) {
    const lines = [
        `╭┈┈⬡「 📝 *LOG #${idx}* 」`,
        `┃ 🕐 ${timeAgo(l.timestamp)}`,
        `┃ 📄 File: \`${l.file}\``,
        `┃ 💬 ${l.message.substring(0, 200)}`,
        `╰┈┈┈┈┈┈┈┈⬡`
    ]
    return lines.join('\n')
}

// ── Format lengkap untuk isi copy button ──────────────────────────────────────
function formatEntryCopy(l) {
    const lines = [
        `CONSOLE LOG`,
        `Waktu: ${new Date(l.timestamp).toLocaleString('id-ID')}`,
        `File: ${l.file}`,
        `Message: ${l.message}`
    ]
    return lines.join('\n')
}

// ── Kirim list log + tombol select berisi semua button salin ─────────────────
async function sendWithCopyButtons(m, sock, entries, headerText, refreshCmd) {
    const prefix = m.prefix || '.'

    const buttons = [
        {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
                display_text: '🔄 Refresh Console Log',
                id: `${prefix}${refreshCmd}`
            })
        },
        ...entries.map((l, i) => ({
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
                display_text: `📋 Salin Log ${i + 1}`,
                copy_code: formatEntryCopy(l)
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
                                    list_title: 'Pilih log yang mau disalin~',
                                    button_title: '📋 Salin Log'
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
    if (!logLib) {
        return m.reply(
            `❌ *Library consoleLog belum diinstall!*\n\n` +
            `> Taruh file \`src/lib/consoleLog.js\` dulu~\n` +
            `> Lalu tambahkan di paling atas entry point (index.js), sebelum plugin di-load:\n\n` +
            `\`\`\`require('./src/lib/consoleLog')\`\`\``
        )
    }

    const sub  = (m.args?.[0] || 'recent').toLowerCase()
    const arg2 = m.args?.[1] || ''

    // ── .consolelog stats ─────────────────────────────────────────────────────
    if (sub === 'stats') {
        m.react('📊')
        const stats = logLib.getLogStats()

        if (!stats) {
            return m.reply(
                `📭 *Log masih kosong~*\n\n` +
                `> Belum ada console.log yang tercatat dari plugin. 💖`
            )
        }

        let txt = `📊 *ꜱᴛᴀᴛɪꜱᴛɪᴋ ᴄᴏɴꜱᴏʟᴇ ʟᴏɢ*\n\n`
        txt += `╭┈┈⬡「 📋 *ᴏᴠᴇʀᴠɪᴇᴡ* 」\n`
        txt += `┃ 📦 Total: *${stats.total}* log\n`
        txt += `┃ 🕐 24 jam terakhir: *${stats.last24h}* log\n`
        txt += `┃ 📅 7 hari terakhir: *${stats.last7d}* log\n`
        txt += `┃ 🕰️ Log terlama: ${stats.oldest ? timeAgo(stats.oldest) : '-'}\n`
        txt += `┃ 🆕 Log terbaru: ${stats.newest ? timeAgo(stats.newest) : '-'}\n`
        txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`

        if (stats.topFile.length) {
            txt += `╭┈┈⬡「 📄 *ꜰɪʟᴇ ᴘᴀʟɪɴɢ sᴇʀɪɴɢ ʟᴏɢ* 」\n`
            for (const [file, count] of stats.topFile) {
                txt += `┃ ${file} → *${count}x*\n`
            }
            txt += `╰┈┈┈┈┈┈┈┈⬡`
        }

        return m.reply(txt)
    }

    // ── .consolelog clear ─────────────────────────────────────────────────────
    if (sub === 'clear' || m.command === 'clearconsolelog') {
        m.react('🗑️')
        logLib.clearLogs()
        m.react('✅')
        return m.reply(
            `✅ *Console log berhasil dihapus!*\n\n` +
            `> Semua log sudah dibersihkan~ Fresh start! 💖✨`
        )
    }

    // ── .consolelog clearold <hari> ───────────────────────────────────────────
    if (sub === 'clearold') {
        const days = parseInt(arg2) || 7
        m.react('🧹')
        const remaining = logLib.clearOlderThan(days)
        m.react('✅')
        return m.reply(
            `✅ *Log lama berhasil dibersihkan!*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 🗑️ Hapus log > *${days} hari*\n` +
            `┃ 📦 Sisa log: *${remaining}* entry\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }

    // ── .consolelog find <keyword> ────────────────────────────────────────────
    if (sub === 'find') {
        if (!arg2) return m.reply(`❌ Masukin keyword-nya ya~\n\n> Contoh: \`.consolelog find fetch\``)

        m.react('🔍')
        const keyword = arg2.toLowerCase()
        const all     = logLib.getAllLogs()
        const found   = all.filter(l =>
            l.message?.toLowerCase().includes(keyword) ||
            l.file?.toLowerCase().includes(keyword)
        ).slice(0, 5)

        if (!found.length) {
            return m.reply(
                `🔍 *Tidak ditemukan~*\n\n` +
                `> Keyword "*${arg2}*" tidak ada di console log.`
            )
        }

        let txt = `🔍 *ʜᴀꜱɪʟ ᴘᴇɴᴄᴀʀɪᴀɴ: "${arg2}"*\n`
        txt += `> Ditemukan ${found.length} log\n\n`
        txt += found.map((l, i) => formatEntry(l, i + 1)).join('\n\n')

        return sendWithCopyButtons(m, sock, found, txt, `consolelog find ${arg2}`)
    }

    // ── .consolelog recent (default) ──────────────────────────────────────────
    m.react('📋')
    const n      = parseInt(arg2) || 5
    const limit  = Math.min(n, 20)  // max 20 sekaligus
    const recent = logLib.getRecentLogs(limit)

    if (!recent.length) {
        return m.reply(
            `📭 *Log masih kosong~*\n\n` +
            `> Belum ada console.log yang tercatat dari plugin. 💪✨`
        )
    }

    const stats = logLib.getLogStats()
    let txt = `📋 *${limit} ʟᴏɢ ᴛᴇʀʙᴀʀᴜ*\n`
    txt += `> Total: ${stats?.total || recent.length} log tersimpan\n\n`
    txt += recent.map((l, i) => formatEntry(l, i + 1)).join('\n\n')
    txt += `\n\n> Ketik \`.consolelog stats\` untuk statistik lengkap~`

    return sendWithCopyButtons(m, sock, recent, txt, `consolelog recent ${limit}`)
}

module.exports = {
    config: pluginConfig,
    handler
}