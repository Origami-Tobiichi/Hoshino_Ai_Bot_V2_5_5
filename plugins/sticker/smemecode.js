const { config } = require('../../config')
const { generateWAMessageFromContent, proto } = require('hsnai')

const pluginConfig = {
    name: 'smemecode',
    alias: ['sendwmcode'],
    category: 'sticker',
    description: 'Kirim kode rahasia smeme ke PM owner',
    usage: '.smemecode',
    example: '.smemecode',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const ownerNumbers = config.owner?.number || []
    const prefix = config.command?.prefix || '.'
    const SECRET_CODE = `--()()++&-&`
    const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    const saluranName = config.saluran?.name || config.bot?.name || 'Hoshino-AI'

    if (!ownerNumbers.length) return m.reply(`⚠️ *Eh eh~* Nomor owner tidak ditemukan di config~ 🌸`)

    const infoText =
        `🔐 *ʜᴏsʜɪɴᴏ ᴀɪ — ᴋᴏᴅᴇ ʀᴀʜᴀsɪᴀ sᴍᴇᴍᴇ*\n\n` +
        `Ini kode rahasia watermark smeme kamu~ 🤫\n` +
        `Jangan kasih tau siapa-siapa ya~ ✨\n\n` +
        `╭┈┈⬡「 🔑 *ᴋᴏᴅᴇ* 」\n` +
        `┃\n` +
        `┃ Kode: \`${SECRET_CODE}\`\n` +
        `┃\n` +
        `╰┈┈⬡\n\n` +
        `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
        `┃\n` +
        `┃ Format:\n` +
        `┃ \`${prefix}smeme <teks>|<teks> ${SECRET_CODE}<namamu>\`\n` +
        `┃\n` +
        `┃ Contoh:\n` +
        `┃ \`${prefix}smeme Aku|Wibu ${SECRET_CODE}SeaPRST\`\n` +
        `┃\n` +
        `╰┈┈⬡`

    const buttons = [
        {
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
                display_text: '📋 Salin Kode',
                copy_code: SECRET_CODE
            })
        }
    ]

    let successCount = 0
    for (const number of ownerNumbers) {
        try {
            const jid = number.includes('@s.whatsapp.net')
                ? number
                : `${number}@s.whatsapp.net`

            const msg = generateWAMessageFromContent(jid, {
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
                                text: `💖 Hoshino Ai Bot | B-Komachi Production`
                            }),
                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                                buttons: buttons
                            }),
                            contextInfo: {
                                mentionedJid: [jid],
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
            }, { userJid: jid })

            await sock.relayMessage(jid, msg.message, { messageId: msg.key.id })
            successCount++
            console.log(`✅ [smemecode] Terkirim ke owner: ${number}`)
        } catch (e) {
            console.warn(`⚠️ [smemecode] Gagal kirim ke ${number}: ${e.message}`)
        }
    }

    if (successCount > 0) {
        m.react('💌')
        m.reply(`✅ Kode rahasia berhasil dikirim ke PM kamu~ 💖`)
    } else {
        m.react('💔')
        m.reply(`💔 Gagal kirim. Cek console ya~`)
    }
}

module.exports = { config: pluginConfig, handler }