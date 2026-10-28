/**
✧ Name    : swhd
✧ Category: tools
**/

const config = require('../../config')

const pluginConfig = {
    name: 'swhd',
    alias: ['swhd'],
    category: 'tools',
    description: 'Balikin document (video/gambar/sticker/audio yang dikirim sebagai file) jadi media aslinya',
    usage: '.swhd (reply document) [caption]',
    example: '.swhd',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

/**
 * Tentuin bentuk asli media dari raw message type Baileys ("documentMessage",
 * "imageMessage", dst) + mimetype.
 *
 * Kalau tipenya memang udah bukan document (reply audio/gambar langsung),
 * pakai apa adanya. Kalau document, bentuk aslinya ditebak dari mimetype —
 * ini kasus utama fitur ini: file yang dikirim sebagai document dibalikin
 * jadi media yang bisa diputar/dilihat langsung.
 */
function detectKind(rawType, mimeType = '') {
    const base = (rawType || '').replace(/Message$/, '') // "documentMessage" -> "document"
    if (base && base !== 'document') return base
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType === 'image/webp') return 'sticker' // webp hampir selalu sticker
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('audio/')) return 'audio'
    return null
}

async function handler(m, { sock }) {
    const target = m.quoted || m
    const rawMsg = target?.message?.[target?.type] || {}
    const mimeType = rawMsg.mimetype || rawMsg.mimeType || ''

    // Gak ada document yang di-reply / gak ke-detect mimetype-nya
    if (!target?.type || !mimeType) {
        return m.reply(
            `📦 *sᴡʜᴅ ᴘʟᴜɢɪɴ* 🎤\n\n` +
            `> Ai gak nemu document-nya nih~ ✨\n\n` +
            `> ${m.prefix}swhd (reply document)\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> ${m.prefix}swhd`
        )
    }

    await m.react('🕕')

    try {
        const buffer = await target.download()
        if (!buffer || buffer.length < 10) {
            throw new Error('Gagal download media, buffer kosong')
        }

        // Auto resend berdasarkan bentuk asli
        const kind = detectKind(target.type, mimeType)
        const caption = m.text || ''

        if (kind === 'video') {
            await sock.sendMessage(m.chat, { video: buffer, caption }, { quoted: m })
        } else if (kind === 'image') {
            await sock.sendMessage(m.chat, { image: buffer, caption }, { quoted: m })
        } else if (kind === 'sticker') {
            await sock.sendMessage(m.chat, { sticker: buffer }, { quoted: m })
        } else if (kind === 'audio') {
            // WhatsApp pakai ogg/opus khusus buat voice note, format lain (mp3, m4a)
            // dikirim sebagai audio biasa. Audio nggak support caption.
            const isVoiceNote = /ogg|opus/i.test(mimeType)
            await sock.sendMessage(
                m.chat,
                { audio: buffer, mimetype: mimeType, ptt: isVoiceNote },
                { quoted: m }
            )
        } else {
            throw new Error(`Tipe tidak didukung: ${mimeType}`)
        }

        await m.react('✅')
        return m.reply(`✅ *ʙᴇʀʜᴀsɪʟ~* 🎤✨\n\n> Nih, Ai udah balikin document-nya jadi media asli`)
    } catch (error) {
        console.error('[swhd] Error:', error)
        await m.react('❌')
        return m.reply(`❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ*\n\n> ${error.message}\n\n> Coba lagi ya, Ai janji next take bakal lebih bagus~`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}