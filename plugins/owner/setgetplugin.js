// plugins/owner/setgetplugin.js
const config = require('../../config')
const { generateWAMessageFromContent, proto } = require('hsnai')

const pluginConfig = {
    name: 'setgetplugin',
    alias: ['sgp', 'getpluginvariant', 'setgp'],
    category: 'owner',
    description: 'Mengatur variant tampilan getplugin',
    usage: '.setgetplugin <v1-v3>',
    example: '.setgetplugin v2',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

const VARIANTS = {
    v1: { id: 1, name: 'Simple Text',  desc: 'Teks biasa + kode langsung di chat (code block)' },
    v2: { id: 2, name: 'Button Copy',  desc: 'Interactive message + tombol Salin Kode (default)' },
    v3: { id: 3, name: 'Rich Code',    desc: 'Native WhatsApp code block via sendCodehsn' }
}

async function handler(m, { sock, db }) {
    const variant = m.args?.[0]?.toLowerCase()

    if (variant) {
        const selected = VARIANTS[variant]
        if (!selected) {
            return m.reply(`❌ Variant tidak valid!\n\nGunakan: v1, v2, atau v3`)
        }

        db.setting('getPluginVariant', selected.id)
        await db.save()

        return m.reply(
            `✅ GetPlugin variant diubah ke *V${selected.id}*\n\n` +
            `> *${selected.name}*\n` +
            `> _${selected.desc}_`
        )
    }

    const current = db?.setting('getPluginVariant') || config.ui?.getPluginVariant || 2

    const rows = Object.entries(VARIANTS).map(([key, val]) => ({
        title: `${key.toUpperCase()}${val.id === current ? ' ✓' : ''} — ${val.name}`,
        description: val.desc,
        id: `${m.prefix}setgetplugin ${key}`
    }))

    const bodyText =
        `📦 *sᴇᴛ ɢᴇᴛᴘʟᴜɢɪɴ ᴠᴀʀɪᴀɴᴛ*\n\n` +
        `> Variant aktif: *V${current}*\n` +
        `> _${VARIANTS[`v${current}`]?.name || 'Unknown'}_\n\n` +
        `> Pilih variant dari daftar di bawah`

    try {
        const msg = generateWAMessageFromContent(m.chat, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2
                    },
                    interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                        body: proto.Message.InteractiveMessage.Body.fromObject({ text: bodyText }),
                        footer: proto.Message.InteractiveMessage.Footer.fromObject({
                            text: config.bot?.name || 'Hoshino Ai'
                        }),
                        header: proto.Message.InteractiveMessage.Header.fromObject({
                            title: '📦 GetPlugin Variant',
                            subtitle: '3 variant tersedia',
                            hasMediaAttachment: false
                        }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                            buttons: [{
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({
                                    title: '📦 ᴘɪʟɪʜ ᴠᴀʀɪᴀɴᴛ',
                                    sections: [{
                                        title: 'ᴅᴀꜰᴛᴀʀ ᴠᴀʀɪᴀɴᴛ',
                                        rows
                                    }]
                                })
                            }]
                        }),
                        contextInfo: {
                            mentionedJid: [m.sender],
                            forwardingScore: 9999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: config.saluran?.id || '120363409928671192@newsletter',
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
        let txt = `📦 *sᴇᴛ ɢᴇᴛᴘʟᴜɢɪɴ ᴠᴀʀɪᴀɴᴛ*\n\n`
        txt += `> Variant saat ini: *V${current}*\n\n`
        for (const [key, val] of Object.entries(VARIANTS)) {
            const mark = val.id === current ? ' ✓' : ''
            txt += `> *${key.toUpperCase()}*${mark} — _${val.desc}_\n`
        }
        txt += `\n_Gunakan: \`.setgetplugin v1\` dst._`
        await m.reply(txt)
    }
}

module.exports = { config: pluginConfig, handler }