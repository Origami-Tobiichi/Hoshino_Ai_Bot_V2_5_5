/**
 * ✦ Hoshino Ai — Fake Message
 * ✦ Category: Owner
 */

const { delay } = require('hsnai')

const pluginConfig = {
    name: 'fakemsg',
    alias: ['fmsg'],
    category: 'owner',
    description: 'Fake status-styled message — reply pesan + teks pengganti',
    usage: '.fakemsg <teks baru> (reply pesan)',
    example: '.fakemsg Ai sayang Senpai~',
    isOwner: true,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    if (!m.isGroup) {
        return m.reply(
            '💗 *Ehh, Senpai~!*\n\n' +
            'Command ini cuma boleh dipakai di grup, yaa~ ✨'
        )
    }

    if (!m.quoted) {
        return m.reply(
            '🌟 *Ehh? Pesannya mana, Senpai?*\n\n' +
            'Reply dulu pesan yang ingin diubah, lalu tulis teks penggantinya~ 💫'
        )
    }

    const text = m.text?.trim()

    if (!text) {
        return m.reply(
            '🎀 *Teksnya belum ada nih~*\n\n' +
            'Tulis teks pengganti setelah command, ya Senpai~ ✨\n\n' +
            'Contoh:\n' +
            '`.fakemsg Hai semuanya~`'
        )
    }

    const stanzaId = m.quoted.key?.id

    if (!stanzaId) {
        return m.reply(
            '💔 *Aduh... pesan yang direply tidak bisa dibaca.*\n\n' +
            'Coba reply pesannya lagi, Senpai~'
        )
    }

    try {
        const tempMsg = await sock.relayMessage(
            m.chat,
            {
                extendedTextMessage: {
                    text: '',
                    contextInfo: {
                        isGroupStatus: true
                    }
                }
            },
            {
                quoted: m
            }
        )

        const tempId = tempMsg.key.id

        const editedMsg = await sock.relayMessage(
            m.chat,
            {
                protocolMessage: {
                    key: {
                        remoteJid: m.chat,
                        fromMe: true,
                        id: tempId
                    },
                    type: 14,
                    editedMessage: {
                        extendedTextMessage: {
                            text,
                            contextInfo: {
                                isGroupStatus: false
                            }
                        }
                    }
                }
            },
            {
                messageId: stanzaId
            }
        )

        const tempId2 = editedMsg.key.id

        await delay(100)

        await Promise.allSettled([
            sock.sendMessage(m.chat, {
                delete: {
                    remoteJid: m.chat,
                    id: tempId,
                    fromMe: true
                }
            }),
            sock.sendMessage(m.chat, {
                delete: {
                    remoteJid: m.chat,
                    id: tempId2,
                    fromMe: true
                }
            })
        ])

    } catch (error) {
        console.error('[fakemsg]', error)

        return m.reply(
            '💔 *Aww... gagal diproses, Senpai~*\n\n' +
            'Terjadi kesalahan saat membuat fake message.\n\n' +
            `> ${error?.message || error}`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}