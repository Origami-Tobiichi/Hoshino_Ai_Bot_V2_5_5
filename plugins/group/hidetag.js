const { getParticipantJids } = require('../../src/lib/lidHelper')

const pluginConfig = {
    name: ['hidetag'],
    alias: ['ht', 'h'],
    category: 'group',
    description: 'Hidetag dengan support reply pesan (teks/media) atau caption langsung',
    usage: '.ht [pesan] / reply pesan / kirim media dengan caption .ht [pesan]',
    example: '.ht atau reply pesan lalu .ht atau kirim foto+caption .ht pesan',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 30,
    energi: 0,
    isEnabled: true,
    isAdmin: true,
    isBotAdmin: false
}

const MEDIA_TYPES = ['imageMessage', 'videoMessage', 'stickerMessage', 'audioMessage', 'documentMessage']

async function sendMedia(sock, chat, type, media, caption, mentions, extra = {}) {
    if (type === 'imageMessage') {
        return sock.sendMessage(chat, { image: media, caption, mentions })
    }
    if (type === 'videoMessage') {
        return sock.sendMessage(chat, { video: media, caption, mentions })
    }
    if (type === 'stickerMessage') {
        await sock.sendMessage(chat, { sticker: media, mentions })
        if (caption) await sock.sendMessage(chat, { text: caption, mentions })
        return
    }
    if (type === 'audioMessage') {
        await sock.sendMessage(chat, {
            audio: media,
            mimetype: extra.mimetype,
            ptt: extra.ptt || false,
            mentions
        })
        if (caption) await sock.sendMessage(chat, { text: caption, mentions })
        return
    }
    if (type === 'documentMessage') {
        await sock.sendMessage(chat, {
            document: media,
            mimetype: extra.mimetype,
            fileName: extra.fileName || 'file',
            mentions
        })
        if (caption) await sock.sendMessage(chat, { text: caption, mentions })
        return
    }
}

async function handler(m, { sock }) {
    try {
        const groupMeta = m.groupMetadata
        const participants = groupMeta.participants || []
        const mentions = getParticipantJids(participants)

        const quoted = m.quoted
        const text = m.fullArgs?.trim()

        // ===== REPLY MODE =====
        if (quoted) {
            const qMsg = quoted.message || {}
            const type = Object.keys(qMsg)[0]

            if (MEDIA_TYPES.includes(type)) {
                const media = await quoted.download()
                const ownCaption =
                    qMsg.imageMessage?.caption ||
                    qMsg.videoMessage?.caption ||
                    ''
                const caption = ownCaption || text || ''
                const audioMsg = qMsg.audioMessage || {}
                const docMsg = qMsg.documentMessage || {}

                return sendMedia(sock, m.chat, type, media, caption, mentions, {
                    mimetype: audioMsg.mimetype || docMsg.mimetype,
                    ptt: audioMsg.ptt,
                    fileName: docMsg.fileName
                })
            }

            // ===== TEXT / OTHER =====
            const quotedText =
                quoted.text ||
                qMsg.conversation ||
                qMsg.extendedTextMessage?.text ||
                ''

            const finalText = text || quotedText

            if (!finalText) {
                return m.reply('❌ *Pesan kosong*')
            }

            return sock.sendMessage(m.chat, {
                text: finalText,
                mentions
            })
        }

        // ===== DIRECT MEDIA + CAPTION MODE =====
        const ownType =
            (m.isImage && 'imageMessage') ||
            (m.isVideo && 'videoMessage') ||
            (m.isSticker && 'stickerMessage') ||
            (m.isAudio && 'audioMessage') ||
            (m.isDocument && 'documentMessage') ||
            null

        if (ownType) {
            const media = await m.download()

            return sendMedia(sock, m.chat, ownType, media, text || '', mentions, {
                mimetype: m.mimetype,
                ptt: m.ptt,
                fileName: m.fileName
            })
        }

        // ===== TEXT ONLY =====
        if (!text) {
            return m.reply(
                `📢 *HIDETAG*\n\n` +
                `• Reply pesan lalu ketik \`${m.prefix}ht\`\n` +
                `• Atau ketik \`${m.prefix}ht <pesan>\`\n` +
                `• Atau kirim media dengan caption \`${m.prefix}ht <pesan>\`\n\n` +
                `Support: teks, gambar, video, sticker, audio, dokumen`
            )
        }

        await sock.sendMessage(m.chat, {
            text,
            mentions
        }, { quoted: m })

    } catch (err) {
        await m.reply(`❌ *Gomen ne~* ✦\n\n> ${err.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}