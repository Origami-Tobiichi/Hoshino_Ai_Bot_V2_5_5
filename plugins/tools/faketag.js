const { getConfig } = require('../../config')

const config = getConfig()

const HASH_KEYWORDS = ['#sticker', '#audio', '#voice']

const pluginConfig = {
    name: 'faketag',
    alias: ['ftag', 'fake'],
    category: 'tools',
    description: 'Fake tag dengan isi pesan custom, support media/stiker',
    usage: '.faketag @user|pesan tag|pesan\n.faketag @user|pesan tag|image|caption\n.faketag @user|pesan tag|#sticker\n.faketag @user|pesan tag|#audio\n.faketag @user|pesan tag|#voice',
    example: '.faketag @628xxx|Hoshino Ai|Hmm??\n.faketag @628xxx|Hoshino Ai|image|Caption ini~\n.faketag @628xxx|Hoshino Ai|#sticker',
    cooldown: 5,
    isGroup: true
}

async function handler(m, { sock }) {
    try {
        if (!m.mentionedJid || m.mentionedJid.length === 0) {
            return m.reply(
`╭━━━🌸〔 𝐇𝐎𝐒𝐇𝐈𝐍𝐎 𝐀𝐈 〕━━━⬣
┃ ❌ Wajib tag @user!
┃ 📌 Contoh: .faketag @user|pesan tag|pesan
╰━━━━━━━━━━━━━━━━━⬣`
            )
        }

        if (!m.body.includes('|')) {
            return m.reply(
`╭━━━🌸〔 𝐇𝐎𝐒𝐇𝐈𝐍𝐎 𝐀𝐈 〕━━━⬣
┃ ❌ Format salah!
┃ ✨ .faketag @user|pesan tag|pesan
┃ ✨ .faketag @user|pesan tag|image|caption
┃ ✨ .faketag @user|pesan tag|#sticker
┃ ✨ .faketag @user|pesan tag|#audio
┃ ✨ .faketag @user|pesan tag|#voice
╰━━━━━━━━━━━━━━━━━⬣`
            )
        }

        const parts = m.body.split('|')
        if (parts.length < 3) {
            return m.reply(
`╭━━━🌸〔 𝐇𝐎𝐒𝐇𝐈𝐍𝐎 𝐀𝐈 〕━━━⬣
┃ ❌ Kurang parameter!
┃ 📌 Format: @user|pesan tag|pesan/mode
╰━━━━━━━━━━━━━━━━━⬣`
            )
        }

        const target = m.mentionedJid[0]
        const pesanTag = parts[1].trim()
        const modeOrPesan = parts[2].trim()
        const extraPesan = parts[3] ? parts[3].trim() : ''

        const isImage = modeOrPesan.toLowerCase() === 'image'
        const isHashMedia = HASH_KEYWORDS.includes(modeOrPesan.toLowerCase())
        const isKeyword = isImage || isHashMedia
        const mode = isHashMedia
            ? modeOrPesan.slice(1).toLowerCase()
            : modeOrPesan.toLowerCase()

        const fakeQuotedBase = {
            key: {
                fromMe: false,
                participant: target,
                remoteJid: m.chat
            }
        }

        const fakeQuoted = {
            ...fakeQuotedBase,
            message: { conversation: pesanTag }
        }

        // ── Mode teks biasa ──────────────────────────────────────────
        if (!isKeyword) {
            return await sock.sendMessage(m.chat, {
                text: modeOrPesan,
                contextInfo: {
                    mentionedJid: [target],
                    quotedMessage: fakeQuoted.message,
                    participant: target
                }
            }, { quoted: fakeQuoted })
        }

        // ── Mode media — butuh reply ─────────────────────────────────
        if (!m.quoted) {
            return m.reply(
`╭━━━🌸〔 𝐇𝐎𝐒𝐇𝐈𝐍𝐎 𝐀𝐈 〕━━━⬣
┃ ❌ Reply dulu ke media/stiker/audio ya~
╰━━━━━━━━━━━━━━━━━⬣`
            )
        }

        if (!m.quoted.isMedia) {
            return m.reply(
`╭━━━🌸〔 𝐇𝐎𝐒𝐇𝐈𝐍𝐎 𝐀𝐈 〕━━━⬣
┃ ❌ Pesan yang di-reply bukan media!
╰━━━━━━━━━━━━━━━━━⬣`
            )
        }

        const mediaBuffer = await m.quoted.download()

        if (!mediaBuffer) {
            return m.reply(
`╭━━━🌸〔 𝐇𝐎𝐒𝐇𝐈𝐍𝐎 𝐀𝐈 〕━━━⬣
┃ ❌ Gagal download media!
╰━━━━━━━━━━━━━━━━━⬣`
            )
        }

        // ── Mode sticker ─────────────────────────────────────────────
        if (mode === 'sticker') {
            const stickerMsg = m.quoted?.message?.stickerMessage
            const isAnimated = !!(stickerMsg?.isAnimated)

            console.log('[FAKETAG] isAnimated:', isAnimated)
            console.log('[FAKETAG] buffer size:', mediaBuffer.length)

            // Sticker dari WA sudah dalam format webp (static/animated)
            // Kirim langsung tanpa FFmpeg conversion
            await sock.sendMessage(m.chat, {
                sticker: mediaBuffer,
                ...(isAnimated && { isAnimated: true })
            }, { quoted: fakeQuoted })
            return
        }

        // ── Mode image ───────────────────────────────────────────────
        if (mode === 'image') {
            return await sock.sendMessage(m.chat, {
                image: mediaBuffer,
                caption: extraPesan || '',
                contextInfo: {
                    mentionedJid: [target],
                    quotedMessage: fakeQuoted.message,
                    participant: target
                }
            }, { quoted: fakeQuoted })
        }

        // ── Mode audio ───────────────────────────────────────────────
        if (mode === 'audio') {
            const mimetype = m.quoted?.mimetype || 'audio/mpeg'
            return await sock.sendMessage(m.chat, {
                audio: mediaBuffer,
                mimetype,
                ptt: false,
                contextInfo: {
                    mentionedJid: [target],
                    quotedMessage: fakeQuoted.message,
                    participant: target
                }
            }, { quoted: fakeQuoted })
        }

        // ── Mode voice ───────────────────────────────────────────────
        if (mode === 'voice') {
            const mimetype = m.quoted?.mimetype || 'audio/ogg; codecs=opus'
            return await sock.sendMessage(m.chat, {
                audio: mediaBuffer,
                mimetype,
                ptt: true,
                contextInfo: {
                    mentionedJid: [target],
                    quotedMessage: fakeQuoted.message,
                    participant: target
                }
            }, { quoted: fakeQuoted })
        }

    } catch (err) {
        console.error('[FAKETAG ERROR]', err)
        m.reply(
`╭━━━🌸〔 𝐇𝐎𝐒𝐇𝐈𝐍𝐎 𝐀𝐈 〕━━━⬣
┃ ❌ Error!
┃ ⚠️ ${err.message}
╰━━━━━━━━━━━━━━━━━⬣`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}