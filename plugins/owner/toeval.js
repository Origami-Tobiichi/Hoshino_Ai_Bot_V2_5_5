/**
‎✧ Name    : toeval
‎✧ Category: owner
**/

'use strict'

const { getDatabase } = require('../../src/lib/database')
const config = require('../../config')
const util = require('util')
const { generateWAMessageFromContent, proto } = require('hsnai')

const pluginConfig = {
    name: 'toeval',
    alias: ['tev', 'autoeval', '2eval'],
    category: 'owner',
    description: 'Reply kode plugin (ESM/CJS), auto-convert ke bentuk eval-able lalu langsung dijalanin persis seperti .ev',
    usage: '.toeval (reply ke pesan/file berisi kode)',
    example: '.toeval',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

/* =========================================================
 * KONVERSI ESM -> BENTUK YANG BISA DIEVAL (require-based)
 * ========================================================= */

function convertEsmToEval(rawCode) {
    let code = rawCode

    // import { a, b } from 'x'  ->  const { a, b } = require('x')
    // PENTING: pakai [ \t]* (bukan \s*) di akhir biar newline gak ikut kemakan,
    // kalau pakai \s* baris import berikutnya bisa nempel jadi satu baris
    code = code.replace(
        /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"][ \t]*;?/g,
        (_, names, mod) => `const {${names.trim()}} = require('${mod}')`
    )

    // import * as a from 'x'  ->  const a = require('x')
    code = code.replace(
        /import\s*\*\s*as\s+(\w+)\s+from\s*['"]([^'"]+)['"][ \t]*;?/g,
        (_, name, mod) => `const ${name} = require('${mod}')`
    )

    // import a from 'x'  ->  const a = require('x')
    code = code.replace(
        /import\s+(\w+)\s+from\s*['"]([^'"]+)['"][ \t]*;?/g,
        (_, name, mod) => `const ${name} = require('${mod}')`
    )

    // const { x } = await import('y')  ->  const { x } = require('y')
    code = code.replace(
        /await\s+import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        (_, mod) => `require('${mod}')`
    )

    // export default <apapun>  ->  const __toevalExport = <apapun>
    code = code.replace(/export\s+default\s+/g, 'const __toevalExport = ')

    // ganti semua pemakaian `conn` (whole word) jadi `sock`,
    // karena eval bot ini nyediain `sock`, bukan `conn`
    code = code.replace(/\bconn\b/g, 'sock')

    return code
}

/* =========================================================
 * BUANG METADATA PLUGIN YANG GAK PERLU DIEVAL
 * (handler.help/.tags/.command, module.exports = {...})
 * ========================================================= */

function stripPluginMetadata(code) {
    let out = code

    // handler.help = [...]
    // handler.tags = [...]
    // handler.command = /.../
    // (baris tunggal, apapun isinya setelah tanda =)
    out = out.replace(/^\s*handler\s*\.\s*\w+\s*=.*$/gm, '')

    // module.exports = { config: pluginConfig, handler }
    // (object literal sederhana tanpa nested braces)
    out = out.replace(/module\.exports\s*=\s*\{[^{}]*\}\s*;?/g, '')

    return out
}

function detectIsEsm(code) {
    return /\bimport\s.+\sfrom\s*['"]/.test(code) ||
           /\bexport\s+default\b/.test(code) ||
           /await\s+import\s*\(/.test(code)
}

// Ambil nama command ASLI dari kode yang di-reply (sebelum di-strip),
// biar pesan error dari plugin yang ditest gak ketuker nyebut ".tev"
function extractOriginalCommand(rawCode) {
    // \b di depan "name" penting banget — tanpa itu, regex bisa ke-tipu
    // sama tulisan "__typename:" (mengandung substring "name:") yang
    // sering muncul di kode HTML rich-response kayak GenAI primitive
    const nameStr = rawCode.match(/\bname\s*:\s*['"`]([^'"`]+)['"`]/)
    if (nameStr) return nameStr[1]

    const nameArrItem = rawCode.match(/\bname\s*:\s*\[\s*['"`]([^'"`]+)['"`]/)
    if (nameArrItem) return nameArrItem[1]

    const helpArrItem = rawCode.match(/handler\.help\s*=\s*\[\s*['"`]([^'"`]+)['"`]/)
    if (helpArrItem) return helpArrItem[1]

    const cmdRegexMatch = rawCode.match(/handler\.command\s*=\s*\/([^/]+)\//)
    if (cmdRegexMatch) {
        // bersihin syntax regex (^ $ ? ( ) |) biar jadi nama yang gampang dibaca
        return cmdRegexMatch[1].replace(/[\^$?()|\\]/g, '')
    }

    // handler.command = ['chess', 'catur']  (array literal, bukan regex)
    const cmdArrItem = rawCode.match(/handler\.command\s*=\s*\[\s*['"`]([^'"`]+)['"`]/)
    if (cmdArrItem) return cmdArrItem[1]

    return null
}

// Buang trigger command yang ikut ke-quote, misal ".ev ", ".toeval ", "=> "
// (kejadian kalau yang di-reply itu pesan command asli, bukan file mentah)
function stripLeadingCommandPrefix(text) {
    return text.replace(/^\s*(?:\.\S+|=>)\s*/, '')
}

/* =========================================================
 * AMBIL KODE DARI QUOTED MESSAGE (mirip ganticode)
 * ========================================================= */

async function extractCodeFromQuoted(quoted) {
    if (quoted.isDocument) {
        const docFileName =
            quoted.message?.documentMessage?.fileName ||
            quoted.message?.documentWithCaptionMessage?.message?.documentMessage?.fileName ||
            ''

        if (docFileName && !docFileName.toLowerCase().endsWith('.js')) {
            throw new Error(`File terdeteksi \`${docFileName}\`, tapi Ai cuma bisa proses file \`.js\` ya~`)
        }

        const buf = await quoted.download()
        if (!buf || buf.length === 0) throw new Error('Buffer file kosong')
        return buf.toString('utf-8')
    }

    if (quoted.isImage || quoted.isVideo || quoted.isAudio || quoted.isSticker) {
        throw new Error('Yang di-reply harus teks/file `.js` ya, bukan media~')
    }

    const text = quoted.text || quoted.body || ''
    if (!text.trim()) throw new Error('Gak ada kode yang bisa diambil dari pesan yang di-reply~')
    return stripLeadingCommandPrefix(text)
}

/* =========================================================
 * KIRIM HASIL DENGAN TOMBOL COPY (isi copy = ".eval <kode>")
 * ========================================================= */

async function sendResultWithCopyButton(sock, m, { bodyText, footerText, copyCode }) {
    const finalCopy = `.eval ${copyCode}`

    try {
        const msg = generateWAMessageFromContent(m.chat, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2
                    },
                    interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                        body: proto.Message.InteractiveMessage.Body.fromObject({
                            text: bodyText
                        }),
                        footer: proto.Message.InteractiveMessage.Footer.fromObject({
                            text: footerText || 'Tap buat copy ke .eval'
                        }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                            buttons: [
                                {
                                    name: 'cta_copy',
                                    buttonParamsJson: JSON.stringify({
                                        display_text: '📋 Copy .eval',
                                        copy_code: finalCopy
                                    })
                                }
                            ]
                        }),
                        contextInfo: {
                            mentionedJid: [m.sender]
                        }
                    })
                }
            }
        }, { userJid: m.sender, quoted: m })

        await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    } catch (e) {
        // fallback: kalau interactive button gagal (device/versi gak support),
        // tetep kirim hasilnya sebagai teks biasa
        await m.reply(bodyText + `\n\n⚠️ Gagal kirim tombol copy: ${e.message}`)
    }
}

/* =========================================================
 * HANDLER
 * ========================================================= */

async function handler(m, { sock, store }) {
    const quoted = m.quoted

    if (!quoted) {
        return m.reply(
            `📦 *ᴛᴏᴇᴠᴀʟ* ⚡\n\n` +
            `> Reply pesan atau file \`.js\` yang isinya kode plugin ya~ ✨\n` +
            `> Ai bakal auto-convert dari ESM (\`import\`/\`export default\`) ke bentuk\n` +
            `> yang bisa langsung dieksekusi (sama persis mekanismenya kayak \`.ev\`),\n` +
            `> sekalian ganti \`conn\` → \`sock\`.\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> Reply kode plugin lama, terus ketik \`${m.prefix}toeval\``
        )
    }

    await m.react('🕕')

    let rawCode
    try {
        rawCode = await extractCodeFromQuoted(quoted)
    } catch (e) {
        await m.react('❌')
        return m.reply(`❌ *ɢᴀɢᴀʟ ᴀᴍʙɪʟ ᴋᴏᴅᴇ*\n\n> ${e.message}`)
    }

    const isEsm = detectIsEsm(rawCode)
    const originalCommand = extractOriginalCommand(rawCode) || 'test'
    let converted = isEsm ? convertEsmToEval(rawCode) : rawCode

    // Buang metadata plugin (handler.help/.tags/.command, module.exports)
    // yang sering ikut ke-paste pas reply full file tapi gak perlu buat eval
    converted = stripPluginMetadata(converted)

    // Panggil otomatis handler/export kalau terdeteksi, biar mirip .ev.
    // Kasih juga alias param umum (text, usedPrefix, command, q, args) biar
    // plugin dari fork lain yang gak pakai konvensi m.text/m.prefix tetap
    // kebagian nilai — teks setelah ".toeval <ini>" dineruskan sebagai `text`.
    // `command` dipaksa pake nama ASLI plugin yang ditest (bukan "tev"),
    // biar pesan error dari plugin itu sendiri nunjuk command yang benar.
    converted += `
        const __toevalParams = {
            sock,
            conn: sock,
            text: (typeof m !== 'undefined' && (m.text || m.body)) || '',
            usedPrefix: (typeof m !== 'undefined' && m.prefix) || '.',
            command: ${JSON.stringify(originalCommand)},
            args: (typeof m !== 'undefined' && m.args) || [],
            q: (typeof m !== 'undefined' && (m.quoted || m)) || m
        }
        if (typeof __toevalExport === 'function') {
            return await __toevalExport(m, __toevalParams)
        }
        if (typeof handler === 'function') {
            return await handler(m, __toevalParams)
        }
    `

    const db = getDatabase()

    let result
    let isError = false

    try {
        // Sama persis mekanisme eval.js: new Function + params yang sama
        const fn = new Function(
            'm',
            'sock',
            'store',
            'db',
            'config',
            'util',
            'require',
            `
            return (async () => {
                ${converted}
            })()
            `
        )

        result = await fn(m, sock, store, db, config, util, require)
    } catch (e) {
        isError = true
        result = e
    }

    let output

    if (typeof result === 'undefined') {
        output = 'undefined'
    } else if (result === null) {
        output = 'null'
    } else if (typeof result === 'object') {
        try {
            output = util.inspect(result, { depth: 2, maxArrayLength: 50 })
        } catch {
            output = String(result)
        }
    } else {
        output = String(result)
    }

    if (output.length > 3000) {
        output = output.slice(0, 3000) + '\n\n... (truncated)'
    }

    const status = isError ? '❌ Error' : '✅ Success'
    const type = isError ? (result?.name || 'Error') : typeof result

    await m.react(isError ? '❌' : '✅')

    let reply =
        `⚙️ *ᴛᴏᴇᴠᴀʟ ʀᴇsᴜʟᴛ*${isEsm ? ' (auto-converted dari ESM)' : ''}\n\n` +
        `╭┈┈⬡「 📋 *ɪɴғᴏ* 」\n` +
        `┃ ${status}\n` +
        `┃ Type: ${type}\n` +
        `╰┈┈┈┈┈┈┈┈⬡\n\n` +
        `\`\`\`${output}\`\`\``

    if (isError && isEsm) {
        reply +=
            `\n\n⚠️ *ᴄᴀᴛᴀᴛᴀɴ:*\n` +
            `> Kalau errornya soal \`require('./...')\`/\`require('../...')\` yang gak ketemu,\n` +
            `> itu karena path relative-nya diresolve dari lokasi \`toeval.js\` (folder \`owner/\`).\n` +
            `> Biasanya tetap sama-sama benar kalau file asli juga ada di \`plugins/<folder>/\`,\n` +
            `> tapi kalau file aslinya lebih dalam/berbeda struktur, ganti ke path absolut manual.`
    }

    return sendResultWithCopyButton(sock, m, {
        bodyText: reply,
        footerText: `Copy buat re-run cepat via .eval`,
        copyCode: converted
    })
}

module.exports = {
    config: pluginConfig,
    handler
}