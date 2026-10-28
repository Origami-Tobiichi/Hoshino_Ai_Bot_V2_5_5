const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
/* npm install javascript-obfuscator */
const config = require('../../config')

let JavaScriptObfuscator
try {
    JavaScriptObfuscator = require('javascript-obfuscator')
} catch {
    console.error('[ENC] Package "javascript-obfuscator" belum terinstall. Install dulu: npm install javascript-obfuscator')
    JavaScriptObfuscator = null
}

const pluginConfig = {
    name: 'enc',
    alias: ['obfuscate', 'obf'],
    category: 'tools',
    description: 'Obfuscate kode JavaScript agar tidak mudah dibaca',
    usage: '.enc <code> atau reply file .js',
    example: '.enc console.log("Hello World")',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 2,
    isEnabled: true
}

const LEVELS = ['basic', 'medium', 'hard', 'extreme']
const DEFAULT_LEVEL = 'medium'

/*
 * Preset dibuat dengan opsi yang umum tersedia di javascript-obfuscator versi 2.x-4.x.
 * getObfuscatorPreset() membangun object opsi secara defensif: opsi yang berpotensi
 * tidak dikenali versi lama dibungkus try/catch saat build (lihat safeObfuscate).
 */
function getObfuscatorPreset(level) {
    switch (level) {
        case 'basic':
            // Ringan & cepat: cuma compact + rename identifier sederhana
            return {
                compact: true,
                controlFlowFlattening: false,
                deadCodeInjection: false,
                stringArray: true,
                stringArrayEncoding: [],
                stringArrayThreshold: 0.5,
                identifierNamesGenerator: 'mangled',
                renameGlobals: false,
                simplify: true,
                selfDefending: false,
                disableConsoleOutput: false
            }

        case 'hard':
            // Perlindungan berat: control flow flattening, string array encoding,
            // identifier renaming, transform objects, numbers-to-expressions, split strings
            return {
                compact: true,
                controlFlowFlattening: true,
                controlFlowFlatteningThreshold: 0.75,
                deadCodeInjection: true,
                deadCodeInjectionThreshold: 0.4,
                stringArray: true,
                stringArrayEncoding: ['base64'],
                stringArrayThreshold: 0.85,
                stringArrayIndexShift: true,
                stringArrayRotate: true,
                stringArrayShuffle: true,
                stringArrayWrappersCount: 2,
                stringArrayWrappersChainedCalls: true,
                stringArrayWrappersParametersMaxCount: 4,
                stringArrayWrappersType: 'function',
                splitStrings: true,
                splitStringsChunkLength: 8,
                identifierNamesGenerator: 'hexadecimal',
                renameGlobals: false,
                transformObjectKeys: true,
                numbersToExpressions: true,
                simplify: true,
                unicodeEscapeSequence: false,
                selfDefending: true,
                disableConsoleOutput: true
            }

        case 'extreme':
            // Paling agresif tapi masih realistis dijalankan di Node.js
            return {
                compact: true,
                controlFlowFlattening: true,
                controlFlowFlatteningThreshold: 1,
                deadCodeInjection: true,
                deadCodeInjectionThreshold: 1,
                stringArray: true,
                stringArrayEncoding: ['rc4'],
                stringArrayThreshold: 1,
                stringArrayIndexShift: true,
                stringArrayRotate: true,
                stringArrayShuffle: true,
                stringArrayWrappersCount: 5,
                stringArrayWrappersChainedCalls: true,
                stringArrayWrappersParametersMaxCount: 8,
                stringArrayWrappersType: 'function',
                stringArrayCallsTransform: true,
                stringArrayCallsTransformThreshold: 1,
                splitStrings: true,
                splitStringsChunkLength: 3,
                identifierNamesGenerator: 'hexadecimal',
                renameGlobals: false,
                transformObjectKeys: true,
                numbersToExpressions: true,
                simplify: true,
                unicodeEscapeSequence: true,
                selfDefending: true,
                debugProtection: false,
                disableConsoleOutput: true
            }

        case 'medium':
        default:
            // Perlindungan standar
            return {
                compact: true,
                controlFlowFlattening: true,
                controlFlowFlatteningThreshold: 0.5,
                deadCodeInjection: true,
                deadCodeInjectionThreshold: 0.2,
                stringArray: true,
                stringArrayEncoding: ['base64'],
                stringArrayThreshold: 0.75,
                stringArrayIndexShift: true,
                stringArrayRotate: true,
                identifierNamesGenerator: 'hexadecimal',
                renameGlobals: false,
                transformObjectKeys: false,
                numbersToExpressions: false,
                simplify: true,
                selfDefending: false,
                disableConsoleOutput: false
            }
    }
}

/*
 * Coba obfuscate dengan preset penuh. Jika ada opsi yang ditolak oleh versi
 * javascript-obfuscator yang terpasang, buang opsi tersebut satu per satu
 * dan coba lagi, supaya tetap kompatibel tanpa bikin bot crash.
 */
function safeObfuscate(code, preset) {
    let options = { ...preset }
    let lastError = null

    for (let attempt = 0; attempt < 25; attempt++) {
        try {
            return JavaScriptObfuscator.obfuscate(code, options)
        } catch (err) {
            lastError = err
            const msg = err?.message || ''
            const match = msg.match(/`([a-zA-Z0-9]+)`/)
            const badKey = match ? match[1] : null

            if (badKey && Object.prototype.hasOwnProperty.call(options, badKey)) {
                delete options[badKey]
                continue
            }

            // Tidak tahu opsi mana yang bermasalah, jangan diulang tanpa henti
            throw err
        }
    }

    throw lastError || new Error('Gagal melakukan obfuscation setelah beberapa percobaan')
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function levelChoiceMessage(prefix) {
    return (
        `🔐 *ᴊs ᴏʙFᴜsᴄᴀᴛᴏʀ*\n\n` +
        `> Mengacak kode JavaScript agar tidak mudah dibaca\n\n` +
        `*Pilih level obfuscation:*\n` +
        `> 🟢 \`basic\` - ringan & cepat\n` +
        `> 🔵 \`medium\` - perlindungan standar (default)\n` +
        `> 🟠 \`hard\` - perlindungan berat\n` +
        `> 🔴 \`extreme\` - paling agresif\n\n` +
        `*Format:*\n` +
        `> \`${prefix}enc <level> <code>\`\n\n` +
        `*Contoh:*\n` +
        `> \`${prefix}enc hard console.log("Hello")\`\n\n` +
        `*Cara pakai:*\n` +
        `> 1. Kirim code langsung\n` +
        `> 2. Reply teks berisi code\n` +
        `> 3. Reply file \`.js\`\n` +
        `> 4. Tambahkan level di depan (opsional), contoh: \`${prefix}enc extreme\` sambil reply source`
    )
}

async function handler(m, { sock }) {
    if (!JavaScriptObfuscator) {
        return m.reply(
            `❌ *Package \`javascript-obfuscator\` belum terinstall!*\n\n` +
            `> Jalankan perintah berikut:\n\n` +
            `\`\`\`\n$ npm install javascript-obfuscator\n\`\`\`\n\n` +
            `> Lalu restart bot`
        )
    }

    const rawText = m.text?.trim() || ''
    const quoted = m.quoted

    // Deteksi level dari kata pertama input teks (mis. "hard console.log(...)")
    let level = null
    let remainingText = rawText

    if (rawText) {
        const firstSpace = rawText.indexOf(' ')
        const firstWord = (firstSpace === -1 ? rawText : rawText.slice(0, firstSpace)).toLowerCase()

        if (LEVELS.includes(firstWord)) {
            level = firstWord
            remainingText = firstSpace === -1 ? '' : rawText.slice(firstSpace + 1).trim()
        } else if (rawText.length > 0 && !quoted && LEVELS.includes(rawText.toLowerCase())) {
            // ".enc hard" tanpa reply dan tanpa code -> hanya level saja, code kosong
            level = rawText.toLowerCase()
            remainingText = ''
        }
    }

    const hasInlineCode = remainingText.length > 0
    const hasQuoted = !!quoted

    if (!hasInlineCode && !hasQuoted) {
        return m.reply(levelChoiceMessage(m.prefix))
    }

    if (!level) level = DEFAULT_LEVEL

    let inputCode = null
    let sourceType = ''

    if (hasInlineCode) {
        inputCode = remainingText
        sourceType = 'direct text'
    } else if (quoted?.text) {
        inputCode = quoted.text
        sourceType = 'quoted text'
    } else if (quoted?.isMedia) {
        const mime = quoted.message?.[quoted.type]?.mimetype || ''
        const fileName = quoted.message?.[quoted.type]?.fileName || ''
        const isJs = mime.includes('javascript') || fileName.endsWith('.js')

        if (!isJs) {
            return m.reply(`❌ *Nee~* Hanya file JavaScript (.js) yang didukung~ 🥺`)
        }

        const { downloadContentFromMessage } = require('hsnai')
        const stream = await downloadContentFromMessage(
            quoted.message[quoted.type],
            quoted.type.replace('Message', '')
        )
        const chunks = []
        for await (const chunk of stream) {
            chunks.push(chunk)
        }
        inputCode = Buffer.concat(chunks).toString('utf8')
        sourceType = 'js file'
    } else {
        return m.reply(`❌ *Ehh~* Reply teks atau file .js yang mau di-obfuscate~ 🥺`)
    }

    m.react('⏳')
    await m.reply(`🔐 *ᴍᴇᴍʙᴜᴀᴛ ᴏʙFᴜsᴄᴀᴛɪᴏɴ...* (level: *${level}*)`)

    const tempDir = path.join(process.cwd(), 'temp')
    let outPath = null

    try {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true })
        }

        const preset = getObfuscatorPreset(level)
        const startTime = Date.now()

        const result = safeObfuscate(inputCode, preset)

        const code = result.getObfuscatedCode()
        const elapsedMs = Date.now() - startTime

        const originalSize = Buffer.byteLength(inputCode, 'utf8')
        const resultSize = Buffer.byteLength(code, 'utf8')
        const ratio = originalSize > 0 ? ((resultSize / originalSize) * 100).toFixed(1) : '0.0'

        const filename = `Obfuscated_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.js`
        outPath = path.join(tempDir, filename)
        fs.writeFileSync(outPath, code)

        const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/'
        const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'

        const statsCaption =
            `🔐 *JavaScript Obfuscated*\n` +
            `> Source: ${sourceType}\n` +
            `> Level: *${level}*\n` +
            `> Ukuran asli: ${formatBytes(originalSize)}\n` +
            `> Ukuran hasil: ${formatBytes(resultSize)} (${ratio}%)\n` +
            `> Waktu proses: ${elapsedMs} ms`

        await sock.sendMessage(m.chat, {
            document: fs.readFileSync(outPath),
            mimetype: 'application/javascript',
            fileName: filename,
            caption: statsCaption,
            contextInfo: {
                forwardingScore: 9999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: saluranId,
                    newsletterName: saluranName,
                    serverMessageId: 127
                }
            }
        }, { quoted: m })

        m.react('✅')

    } catch (err) {
        console.error('[ENC] Error:', err.message)
        m.react('❌')
        return m.reply(
            `❌ *ɢᴀɢᴀʟ ᴏʙFᴜsᴄᴀᴛᴇ*\n\n` +
            `> ${err.message}\n\n` +
            `⚠️ Pastikan kode JavaScript yang dimasukkan valid`
        )
    } finally {
        if (outPath && fs.existsSync(outPath)) {
            try {
                fs.unlinkSync(outPath)
            } catch (cleanupErr) {
                console.error('[ENC] Gagal menghapus temp file:', cleanupErr.message)
            }
        }
    }
}

module.exports = {
    config: pluginConfig,
    handler
}