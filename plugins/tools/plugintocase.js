const config = require('../../config')

const pluginConfig = {
    name: 'plugintocase',
    alias: ['plugin2case', 'pluginconvert'],
    category: 'tools',
    description: 'Convert format plugin Baileys ke switch-case',
    usage: '.plugintocase <reply kode plugin>',
    example: '.plugintocase',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

function convertPluginToCase(code) {
    let commandName = 'command'
    let aliases = []

    const helpMatch = code.match(/handler\.help\s*=\s*\[([^\]]+)\]/)
    if (helpMatch) {
        const helps = helpMatch[1].match(/['"]([^'"]+)['"]/g)?.map(h => h.replace(/['"]/g, '')) || []
        if (helps.length > 0) {
            commandName = helps[0]
            aliases = helps.slice(1)
        }
    }

    const tagsMatch = code.match(/handler\.tags\s*=\s*\[([^\]]+)\]/)
    const tags = tagsMatch ? tagsMatch[1].replace(/['"]/g, '').trim() : 'general'

    // Ambil semua match, gunakan yang TERAKHIR (handler asli selalu paling bawah)
    const arrowRegex = /(?:let|const|var)\s+handler\s*=\s*async\s*\([^)]*\)\s*=>\s*\{/g
    const allMatches = [...code.matchAll(arrowRegex)]
    if (allMatches.length === 0) throw new Error('Format handler tidak ditemukan')

    const lastMatch = allMatches[allMatches.length - 1]
    const braceStart = lastMatch.index + lastMatch[0].length - 1

    // Hitung brace secara manual
    let depth = 0
    let i = braceStart
    for (; i < code.length; i++) {
        if (code[i] === '{') depth++
        else if (code[i] === '}') {
            depth--
            if (depth === 0) break
        }
    }

    let body = code.slice(braceStart + 1, i).trim()
    body = body.replace(/\n{3,}/g, '\n\n').trim()
    body = body.replace(/usedPrefix/g, 'prefix')

    if (!body) throw new Error('Isi body handler tidak ditemukan')

    const allCommands = [commandName, ...aliases]
    let result = `// tags: ${tags}\n`
    allCommands.forEach((cmd) => {
        result += `case "${cmd}": {\n`
        result += body.split('\n').map(l => '    ' + l).join('\n')
        result += '\n}\nbreak\n\n'
    })

    return result.trim()
}

async function handler(m, { sock }) {
    let code = m.quotedBody || m.text?.trim()

    if (!code) {
        return m.reply(
            `🔄 *ᴘʟᴜɢɪɴ ᴛᴏ ᴄᴀsᴇ ᴄᴏɴᴠᴇʀᴛᴇʀ*\n\n` +
            `> Convert format plugin Baileys ke switch-case\n\n` +
            `> *Cara pakai:*\n` +
            `> Reply kode plugin dengan ${m.prefix}plugintocase\n\n` +
            `> *Contoh input:*\n` +
            `> \`let handler = async (m, { conn, text }) => { ... }\`\n` +
            `> \`handler.command = /^namacommand$/i\`\n` +
            `> \`export default handler\``
        )
    }

    try {
        const converted = convertPluginToCase(code)

        const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
        const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'

        await sock.sendMessage(m.chat, {
            text: `✅ *ᴄᴏɴᴠᴇʀᴛᴇᴅ ᴛᴏ sᴡɪᴛᴄʜ-ᴄᴀsᴇ*\n\n\`\`\`${converted}\n\`\`\``,
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

    } catch (error) {
        await m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}