const config = require('../../config')
const { generateWAMessageFromContent, proto } = require('hsnai')

const pluginConfig = {
    name: 'whatsappme',
    alias: ['wame', 'pesanme', 'messageme', 'chatme', 'wme'],
    category: 'tools',
    description: 'Buat link WhatsApp wa.me dengan nomor dan pesan otomatis',
    usage: '.wame <nomor/tag> <pesan>',
    example: '.wame 621234567890 Hoshino Ai',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    try {
        const args = m.body.trim().split(' ').slice(1)

        // Wajib ada pesan
        if (args.length === 0) {
            return await m.reply(
                `✨ *Hoshino Ai — WhatsApp Link Generator* ✨\n\n` +
                `Eeh~ Jangan lupa pesannya dong! ><\n` +
                `Masa mau kirim link kosong? Ai nggak mau~ 🌟\n\n` +
                `*Format:*\n` +
                `› \`${m.prefix}wame 621234567890 pesan\`\n` +
                `› \`${m.prefix}wame pesan\` _(nomor kamu sendiri)_\n` +
                `› \`${m.prefix}wame @tag pesan\`\n\n` +
                `*Contoh:*\n` +
                `› \`${m.prefix}wame 621234567890 Hoshino Ai\`\n` +
                `› \`${m.prefix}wame Yuk gabung!\`\n` +
                `› \`${m.prefix}wame @tag Halo kak~\``
            )
        }

        const senderNumber = m.sender.replace(/@s\.whatsapp\.net$/, '')

        let targetNumber = null
        let messageText = ''

        // Case 1: Ada @mention → ambil nomor dari mention
        if (m.mentionedJid && m.mentionedJid.length > 0) {
            targetNumber = m.mentionedJid[0].replace(/@s\.whatsapp\.net$/, '')
            const filtered = args.filter(a => !a.startsWith('@'))
            messageText = filtered.join(' ').trim()
        }
        // Case 2: Arg pertama adalah nomor (hanya angka, bisa diawali +)
        else if (args.length > 0 && /^\+?\d{7,15}$/.test(args[0])) {
            targetNumber = args[0].replace(/^\+/, '')
            messageText = args.slice(1).join(' ').trim()
        }
        // Case 3: Tidak ada nomor → pakai nomor sender sendiri
        else {
            targetNumber = senderNumber
            messageText = args.join(' ').trim()
        }

        // Normalize nomor: strip +, 0 → 62
        targetNumber = targetNumber.replace(/^\+/, '')
        if (targetNumber.startsWith('0')) {
            targetNumber = '62' + targetNumber.slice(1)
        }

        // Validasi nomor
        if (!/^\d{7,15}$/.test(targetNumber)) {
            return await m.reply(
                `✨ *Hoshino Ai — WhatsApp Link Generator* ✨\n\n` +
                `Aah~ Nomornya nggak valid dong! ><\n` +
                `Ai nggak bisa buatin link kalau nomornya salah~ 🌟\n\n` +
                `*Format:*\n` +
                `› \`${m.prefix}wame 621234567890 pesan\`\n` +
                `› \`${m.prefix}wame pesan\` _(nomor kamu sendiri)_\n` +
                `› \`${m.prefix}wame @tag pesan\``
            )
        }

        // Validasi pesan wajib ada isinya
        if (!messageText) {
            return await m.reply(
                `✨ *Hoshino Ai — WhatsApp Link Generator* ✨\n\n` +
                `Eeh~ Pesannya mana? Jangan dikosongkan dong~ ><\n\n` +
                `*Contoh:*\n` +
                `› \`${m.prefix}wame ${targetNumber} Hoshino Ai\``
            )
        }

        // Build wa.me link
        const encodedText = '?text=' + encodeURIComponent(messageText)
        const waLink = `https://wa.me/${targetNumber}${encodedText}`

        const displayNumber = `+${targetNumber}`

        const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
        const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'

        const infoText =
            `✨ *Hoshino Ai — WhatsApp Link* ✨\n\n` +
            `Tadaa~! Ai sudah buatkan link-nya untukmu! 💫\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 📱 ɴᴏᴍᴏʀ: \`${displayNumber}\`\n` +
            `┃ 💬 ᴘᴇsᴀɴ: \`${messageText}\`\n` +
            `┃ 🔗 ʟɪɴᴋ: ${waLink}\n` +
            `╰┈┈⬡\n\n` +
            `_Klik linknya dan langsung chat deh~ Ai selalu support kamu! 🌟_`

        const buttons = [
            {
                name: 'cta_copy',
                buttonParamsJson: JSON.stringify({
                    display_text: '📋 Salin Link',
                    copy_code: waLink
                })
            },
            {
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                    display_text: '💬 Buka Chat',
                    url: waLink
                })
            }
        ]

        const msg = generateWAMessageFromContent(m.chat, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2
                    },
                    interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                        body: proto.Message.InteractiveMessage.Body.fromObject({
                            text: infoText
                        }),
                        footer: proto.Message.InteractiveMessage.Footer.fromObject({
                            text: `© ${config.bot?.name || 'Ourin-AI'}`
                        }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                            buttons: buttons
                        }),
                        contextInfo: {
                            mentionedJid: [m.sender],
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
        }, { userJid: m.sender, quoted: m })

        await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
        m.react('✅')

    } catch (error) {
        console.error('WhatsAppMe Plugin Error:', error)
        m.react('❌')
        await m.reply(
            `✨ *Hoshino Ai* ✨\n\n` +
            `Eh?! Ada yang salah... Ai minta maaf ya~ 🙏\n\n` +
            `❌ *Error:*\n> ${error.message}`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}