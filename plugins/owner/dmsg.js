/**
 * ✦ Hoshino Ai — DMSG
 * ✦ Category: Owner
 */

const { delay } = require('hsnai')

const pluginConfig = {
    name: 'dmsg',
    alias: [],
    category: 'owner',
    description: 'Memproses pesan yang direply menggunakan metode dmsg',
    usage: '.dmsg (reply pesan)',
    example: '.dmsg',
    isOwner: true,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function dmsg(sock, chatId, stanzaId) {
    const tempMsg = await sock.relayMessage(
        chatId,
        {
            groupStatusMessageV2: {
                message: {
                    extendedTextMessage: {
                        text: '',
                        contextInfo: {
                            isGroupStatus: true
                        }
                    }
                }
            }
        },
        {}
    )

    const tempId = tempMsg.key.id

    const editedMsg = await sock.relayMessage(
        chatId,
        {
            protocolMessage: {
                key: {
                    remoteJid: chatId,
                    fromMe: true,
                    id: tempId
                },
                type: 14,
                editedMessage: {
                    extendedTextMessage: {
                        text: '\0',
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
        sock.sendMessage(chatId, {
            delete: {
                remoteJid: chatId,
                id: tempId,
                fromMe: true
            }
        }),
        sock.sendMessage(chatId, {
            delete: {
                remoteJid: chatId,
                id: tempId2,
                fromMe: true
            }
        })
    ])
}

async function handler(m, { sock }) {
    if (!m.isGroup) {
        return m.reply(
            '💗 *Ehh, Senpai~!*\n\n' +
            'Command ini khusus digunakan di grup, yaa~ ✨'
        )
    }

    if (!m.quoted) {
        return m.reply(
            '🌟 *Ehh? Belum ada pesan yang direply~*\n\n' +
            'Reply dulu pesan yang ingin diproses, Senpai~ 💫'
        )
    }

    const stanzaId = m.quoted.key?.id

    if (!stanzaId) {
        return m.reply(
            '💔 *Aduh... ID pesannya tidak ditemukan~*\n\n' +
            'Coba reply pesan tersebut lagi, Senpai.'
        )
    }

    try {
        await dmsg(sock, m.chat, stanzaId)

    } catch (error) {
        console.error('[dmsg]', error)

        return m.reply(
            '💔 *Aww... terjadi kesalahan, Senpai~*\n\n' +
            'DMSG gagal memproses pesan tersebut.\n\n' +
            `> ${error?.message || error}`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}