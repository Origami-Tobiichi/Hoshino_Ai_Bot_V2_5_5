const fs = require('fs')
const path = require('path')
const config = require('../../config')
const { generateWAMessageFromContent, proto } = require('hsnai')

const pluginConfig = {
    name: 'getplugin',
    alias: ['gp', 'getcode', 'plugincode', 'sourcecode'],
    category: 'owner',
    description: 'Dapatkan source code plugin',
    usage: '.getplugin <nama plugin> [-now]',
    example: '.getplugin menu -now',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

function searchPlugin(name, pluginsDir) {
    const categories = fs.readdirSync(pluginsDir).filter(f =>
        fs.statSync(path.join(pluginsDir, f)).isDirectory()
    )
    for (const category of categories) {
        const categoryPath = path.join(pluginsDir, category)
        const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'))
        for (const file of files) {
            if (file.replace('.js', '').toLowerCase() === name.toLowerCase()) {
                return { path: path.join(categoryPath, file), category, file }
            }
        }
    }
    for (const category of categories) {
        const categoryPath = path.join(pluginsDir, category)
        const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'))
        for (const file of files) {
            const filePath = path.join(categoryPath, file)
            try {
                const content = fs.readFileSync(filePath, 'utf-8')
                const aliasMatch = content.match(/alias:\s*\[([^\]]+)\]/)
                if (aliasMatch) {
                    const aliases = aliasMatch[1].match(/['"`]([^'"`]+)['"`]/g)
                    if (aliases) {
                        const cleanAliases = aliases.map(a => a.replace(/['"`]/g, '').toLowerCase())
                        if (cleanAliases.includes(name.toLowerCase())) {
                            return { path: filePath, category, file }
                        }
                    }
                }
            } catch {}
        }
    }
    return null
}

function getSimilarPlugins(name, pluginsDir) {
    const results = []
    const categories = fs.readdirSync(pluginsDir).filter(f =>
        fs.statSync(path.join(pluginsDir, f)).isDirectory()
    )
    for (const category of categories) {
        const categoryPath = path.join(pluginsDir, category)
        const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'))
        for (const file of files) {
            const baseName = file.replace('.js', '').toLowerCase()
            if (baseName.includes(name.toLowerCase()) || name.toLowerCase().includes(baseName)) {
                results.push(`${category}/${file}`)
            }
        }
    }
    return results.slice(0, 5)
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(date) {
    return date.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    }) + ' WIB'
}

// ─── VARIANT SENDERS ─────────────────────────────────────────────────────────

async function sendV1(sock, targetJid, caption, code, m) {
    const text = caption + `\n\n\`\`\`javascript\n${code}\n\`\`\``
    await sock.sendMessage(targetJid, { text }, { quoted: m })
}

async function sendV2(sock, targetJid, caption, code, config, m) {
    const saluranId   = config.saluran?.id   || 'xxx@newsletter'
    const saluranName = config.saluran?.name  || config.bot?.name || 'Hoshino Ai'

    const buttons = [{
        name: 'cta_copy',
        buttonParamsJson: JSON.stringify({
            display_text: '📋 Salin Kode Plugin',
            copy_code: code
        })
    }]

    const waMsg = generateWAMessageFromContent(targetJid, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2
                },
                interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                    body: proto.Message.InteractiveMessage.Body.fromObject({ text: caption }),
                    footer: proto.Message.InteractiveMessage.Footer.fromObject({
                        text: `© ${config.bot?.name || 'Hoshino Ai'}`
                    }),
                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                        buttons
                    }),
                    contextInfo: {
                        forwardingScore: 9999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: saluranId,
                            newsletterName: saluranName,
                            serverMessageId: 127
                        }
                    }
                })
            }
        }
    }, { userJid: targetJid })

    await sock.relayMessage(targetJid, waMsg.message, { messageId: waMsg.key.id })
}

async function sendV3(sock, targetJid, caption, code, m) {
    await sock.sendMessage(targetJid, { text: caption }, { quoted: m })

    await sock.sendCodehsn(
        targetJid,
        code,
        'javascript',
        m,
        { footer: `© ${config.bot?.name || 'Hoshino Ai'}` }
    )
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────

async function handler(m, { sock, db }) {
    const rawArgs = m.args || []

    // Cek flag -now (bisa di posisi mana aja, case-insensitive)
    const sendNow = rawArgs.some(a => a.toLowerCase() === '-now')
    const cleanArgs = rawArgs.filter(a => a.toLowerCase() !== '-now')
    const pluginName = cleanArgs?.[0]?.trim()

    if (!pluginName) {
        return m.reply(
            `📦 *ɢᴇᴛ ᴘʟᴜɢɪɴ*\n\n` +
            `> Dapatkan source code plugin\n\n` +
            `╭┈┈⬡「 📋 *ғᴏʀᴍᴀᴛ* 」\n` +
            `┃ .getplugin <nama>\n` +
            `┃ .getplugin <nama> -now\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `*Contoh:*\n` +
            `> .getplugin menu\n` +
            `> .getplugin sticker -now\n` +
            `> .getplugin game/tebakgambar\n\n` +
            `_Tambahin -now buat kirim langsung ke grup, gak lewat PM~_`
        )
    }

    const pluginsDir = path.join(process.cwd(), 'plugins')
    let pluginInfo = null

    if (pluginName.includes('/')) {
        const [category, file] = pluginName.split('/')
        const filePath = path.join(pluginsDir, category, file.endsWith('.js') ? file : `${file}.js`)
        if (fs.existsSync(filePath)) {
            pluginInfo = { path: filePath, category, file: file.endsWith('.js') ? file : `${file}.js` }
        }
    } else {
        pluginInfo = searchPlugin(pluginName, pluginsDir)
    }

    if (!pluginInfo) {
        const similar = getSimilarPlugins(pluginName, pluginsDir)
        let text = `❌ *ᴘʟᴜɢɪɴ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ*\n\n`
        text += `> Plugin \`${pluginName}\` tidak ditemukan\n\n`
        if (similar.length > 0) {
            text += `*Mungkin maksud kamu:*\n`
            similar.forEach(s => { text += `> - \`${s}\`\n` })
        }
        return m.reply(text)
    }

    const code       = fs.readFileSync(pluginInfo.path, 'utf-8')
    const fileSize   = formatBytes(fs.statSync(pluginInfo.path).size)
    const accessTime = formatDate(new Date())
    const isGroup    = m.chat.endsWith('@g.us')
    const chatType   = isGroup ? 'Grup' : 'Private'
    const senderNum  = m.sender.split('@')[0]

    // Kalo -now dipake di grup, kirim langsung ke grup. Selain itu tetep ke PM kayak biasa.
    const targetJid = (isGroup && sendNow) ? m.chat : m.sender

    if (isGroup && !sendNow) {
        await m.reply(
            `Ssstt~ kodenya udah Ai kirim ke PM kamu ya~ ✨\n` +
            `Cek sana deh, Ai udah kirim dengan penuh cinta~ ♡\n\n` +
            `_Mau langsung di grup? Pake \`-now\` abis nama plugin~_`
        )
    }

    m.react('✨')

    try {
        const caption =
            `📦 *ɢᴇᴛ ᴘʟᴜɢɪɴ*\n\n` +
            `╭┈┈⬡「 👤 *ɪɴꜰᴏ ʀᴇǫᴜᴇsᴛ* 」\n` +
            `┃ 📱 Nomor : +${senderNum}\n` +
            `┃ 💬 Chat  : ${chatType}\n` +
            `┃ 🕐 Waktu : ${accessTime}\n` +
            `╰┈┈⬡\n\n` +
            `╭┈┈⬡「 📦 *ᴅᴀᴛᴀ ᴘʟᴜɢɪɴ* 」\n` +
            `┃ 📝 File   : ${pluginInfo.file}\n` +
            `┃ 📁 Folder : ${pluginInfo.category}\n` +
            `┃ 📊 Ukuran : ${fileSize}\n` +
            `╰┈┈⬡`

        const gpVariant = db?.setting('getPluginVariant') || config.ui?.getPluginVariant || 2

        if (gpVariant === 1) {
            await sendV1(sock, targetJid, caption, code, m)
        } else if (gpVariant === 3) {
            await sendV3(sock, targetJid, caption, code, m)
        } else {
            await sendV2(sock, targetJid, caption, code, config, m)
        }

    } catch (err) {
        console.error('[GETPLUGIN] Gagal kirim ke sender:', err.message)
    }
}

module.exports = { config: pluginConfig, handler }