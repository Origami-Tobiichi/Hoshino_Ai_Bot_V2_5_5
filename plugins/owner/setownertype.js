const config = require('../../config')
const { getDatabase } = require('../../src/lib/database')
const { generateWAMessageFromContent, proto } = require('hsnai')

const pluginConfig = {
    name: 'setownertype',
    alias: ['ownertype', 'ownervariant', 'ownerstyle'],
    category: 'owner',
    description: 'Mengatur variant tampilan owner message',
    usage: '.setownertype',
    example: '.setownertype',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

const VARIANTS = {
    1: { name: 'Current Design',    desc: 'Tampilan default saat ini',              emoji: '🌟' },
    2: { name: 'Carousel Cards',    desc: 'Kartu carousel dengan foto owner',        emoji: '🎠' },
    3: { name: 'Multiple Contact',  desc: 'Kirim contact card semua owner',          emoji: '📇' },
    4: { name: 'AIRich Post Card',  desc: 'Card bergaya post dengan foto profil',    emoji: '🖼️' }, 
    5: { name: 'AIRich Id Card',   desc: 'Card bergaya id dengan foto profil',    emoji: '🗿' }
}

async function handler(m, { sock, db }) {
    const args = m.args || []
    const variant = args[0]?.toLowerCase()
    const current = db.setting('ownerType') || 1

    if (variant && /^v?[1-5]$/.test(variant)) {
        const id = parseInt(variant.replace('v', ''))
        db.setting('ownerType', id)
        await db.save()

        await m.reply(
            `✦ *ᴏᴡɴᴇʀ ᴛʏᴘᴇ ᴅɪᴘᴇʀʙᴀʀᴜɪ~* ✦\n\n` +
            `Yay~ Ai sudah ganti tampilan owner-nya! ⭐\n\n` +
            `> ${VARIANTS[id].emoji} *V${id} — ${VARIANTS[id].name}*\n` +
            `> _${VARIANTS[id].desc}_\n\n` +
            `_Semoga tampilannya makin memukau ya Kak~ 💕_`
        )
        return
    }

    const rows = Object.entries(VARIANTS).map(([id, val]) => ({
        title: `${val.emoji} V${id}${parseInt(id) === current ? ' ✓' : ''} — ${val.name}`,
        description: val.desc,
        id: `${m.prefix}setownertype v${id}`
    }))

    const bodyText =
        `✦ *sᴇᴛ ᴏᴡɴᴇʀ ᴛʏᴘᴇ* ✦\n\n` +
        `Kon-Ai~ Kak *${m.pushName}*! 🌟\n` +
        `Di sini Ai bisa atur tampilan info owner bot-nya~\n\n` +
        `> Type aktif: *V${current}*\n` +
        `> ${VARIANTS[current]?.emoji || '🌟'} _${VARIANTS[current]?.name || 'Unknown'}_\n\n` +
        `> Pilih variant dari daftar di bawah ya~ 💕`

    try {
        const interactiveButtons = [
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: '👑 ᴘɪʟɪʜ ᴛʏᴘᴇ',
                    sections: [{
                        title: 'ᴅᴀꜰᴛᴀʀ ᴏᴡɴᴇʀ ᴛʏᴘᴇ',
                        rows
                    }]
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
                            text: bodyText
                        }),
                        footer: proto.Message.InteractiveMessage.Footer.fromObject({
                            text: config.bot?.name || 'Hoshino Ai'
                        }),
                        header: proto.Message.InteractiveMessage.Header.fromObject({
                            title: '👑 Owner Type',
                            subtitle: `${Object.keys(VARIANTS).length} variant tersedia`,
                            hasMediaAttachment: false
                        }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                            buttons: interactiveButtons
                        }),
                        contextInfo: {
                            mentionedJid: [m.sender],
                            forwardingScore: 9999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: config.saluran?.id || 'https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o',
                                newsletterName: config.saluran?.name || config.bot?.name || 'Hoshino Ai',
                                serverMessageId: 127
                            }
                        }
                    })
                }
            }
        }, { userJid: m.sender, quoted: m })

        await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    } catch {
        let txt = `✦ *sᴇᴛ ᴏᴡɴᴇʀ ᴛʏᴘᴇ* ✦\n\n`
        txt += `Kon-Ai~! 🌟 Type aktif: *V${current}*\n\n`
        for (const [id, val] of Object.entries(VARIANTS)) {
            const mark = parseInt(id) === current ? ' ✓' : ''
            txt += `> ${val.emoji} *V${id}*${mark} — _${val.desc}_\n`
        }
        txt += `\n_Gunakan: \`.setownertype v1\` s/d \`.setownertype v5\`_`
        await m.reply(txt)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}