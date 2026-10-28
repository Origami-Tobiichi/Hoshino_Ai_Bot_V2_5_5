const { generateWAMessageFromContent, proto } = require('@itsliaaa/baileys')

const pluginConfig = {
    name: 'sprem',
    alias: ['stickerpremium', 'premiumsticker'],
    category: 'owner',
    description: 'Mengubah sticker biasa menjadi sticker premium',
    usage: '.sprem [nomor]',
    example: '.sprem',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const q = m.quoted

    // Cek apakah reply sticker
    if (!q || !q.isSticker) {
        return m.reply(
            `⭐ *sᴛɪᴄᴋᴇʀ ᴘʀᴇᴍɪᴜᴍ*\n\n` +
            `> Reply sticker yang mau dijadikan premium!\n\n` +
            `> Penggunaan: \`${m.prefix}sprem\``
        )
    }

    try {
        // Ambil data sticker dari quoted.message.stickerMessage
        const msg = q.message?.stickerMessage || q.message?.[q.type] || {}

        const stickerMessage = proto.Message.StickerMessage.fromObject({
            url: msg.url,
            fileSha256: msg.fileSha256,
            fileEncSha256: msg.fileEncSha256,
            mediaKey: msg.mediaKey,
            mimetype: msg.mimetype || 'image/webp',
            height: msg.height || 512,
            width: msg.width || 512,
            directPath: msg.directPath,
            fileLength: msg.fileLength,
            mediaKeyTimestamp: msg.mediaKeyTimestamp,
            isAnimated: msg.isAnimated || false,
            stickerSentTs: Date.now(),
            isAvatar: false,
            isAiSticker: true,
            premium: 1,
            isLottie: false,
            accessibilityLabel: msg.accessibilityLabel || '',
            contextInfo: {
                stanzaId: q.id,
                participant: q.sender,
                remoteJid: m.chat
            }
        })

        let targetJid = m.chat
        const num = m.args?.[0]?.replace(/[^0-9]/g, '')
        if (num) targetJid = num + '@s.whatsapp.net'

        const waMsg = generateWAMessageFromContent(
            targetJid,
            { stickerMessage },
            {
                userJid: sock.user.id,
                quoted: m
            }
        )

        await sock.relayMessage(targetJid, waMsg.message, {
            messageId: waMsg.key.id
        })

        m.react('✅')

    } catch (e) {
        console.error('[sprem]', e)
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${e.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}