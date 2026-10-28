const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
/* npm install webcrack */
const config = require('../../config')

const pluginConfig = {
    name: 'dec',
    alias: ['deobfuscate', 'deobf', 'unobf'],
    category: 'tools',
    description: 'Deobfuscate/membongkar kode JavaScript yang teracak (javascript-obfuscator, dll)',
    usage: '.dec <code> atau reply file .js',
    example: '.dec .enc console.log("Hello World")',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 2,
    isEnabled: true
}

async function handler(m, { sock }) {
    let webcrack
    try {
        ;({ webcrack } = await import('webcrack'))
    } catch {
        return m.reply(
            `❌ *Package \`webcrack\` belum terinstall!*\n\n` +
            `> Jalankan perintah berikut:\n\n` +
            `\`\`\`\n$ npm install webcrack\n\`\`\`\n\n` +
            `> Lalu restart bot`
        )
    }

    const inputText = m.text?.trim()
    const quoted = m.quoted

    if (!inputText && !quoted) {
        return m.reply(
            `🧩 *ᴊs ᴅᴇᴏʙFᴜsᴄᴀᴛᴏʀ*\n\n` +
            `> Membongkar kode JavaScript yang di-obfuscate jadi lebih terbaca\n\n` +
            `*Format:*\n` +
            `> \`${m.prefix}dec <code>\`\n\n` +
            `*Cara pakai:*\n` +
            `> 1. Kirim code langsung\n` +
            `> 2. Reply teks berisi code\n` +
            `> 3. Reply file \`.js\``
        )
    }

    let inputCode = null
    let sourceType = ''

    if (inputText) {
        inputCode = inputText
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
        return m.reply(`❌ *Ehh~* Reply teks atau file .js yang mau di-deobfuscate~ 🥺`)
    }

    m.react('⏳')
    await m.reply(`🧩 *ᴍᴇᴍʙᴏɴɢᴋᴀʀ ᴋᴏᴅᴇ...*`)

    try {
        const tempDir = path.join(process.cwd(), 'temp')
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true })
        }

        const result = await webcrack(inputCode)
        const code = result.code

        if (!code || !code.trim()) {
            throw new Error('Hasil deobfuscate kosong — kemungkinan input bukan kode obfuscated yang dikenali')
        }

        const filename = `Deobfuscated_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.js`
        const outPath = path.join(tempDir, filename)
        fs.writeFileSync(outPath, code)

        const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
        const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'

        await sock.sendMessage(m.chat, {
            document: fs.readFileSync(outPath),
            mimetype: 'application/javascript',
            fileName: filename,
            caption: `🧩 *JavaScript Deobfuscated*\n> Source: ${sourceType}`,
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

        if (fs.existsSync(outPath)) fs.unlinkSync(outPath)

        m.react('✅')

    } catch (err) {
        console.error('[DEC] Error:', err.message)
        m.react('❌')
        return m.reply(
            `❌ *ɢᴀɢᴀʟ ᴅᴇᴏʙFᴜsᴄᴀᴛᴇ*\n\n` +
            `> ${err.message}\n\n` +
            `⚠️ Pastikan kode yang dimasukkan valid & memang hasil obfuscator (obfuscator.io/javascript-obfuscator)`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}