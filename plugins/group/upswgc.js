const { generateWAMessageContent, generateWAMessageFromContent } = require('hsnai')
const crypto = require('crypto')

const pluginConfig = {
    name: 'upswgc',
    alias: ['swgcadmin', 'grupstory'],
    category: 'group', // Kategori diubah ke group
    description: 'Post Story Group (border hijau) khusus untuk Admin di grup ini',
    usage: '.upswgc <teks> atau reply media',
    example: '.upswgc Halo warga grup!',
    isOwner: false,
    isAdmin: true,   // Hanya admin yang bisa eksekusi
    isPremium: false,
    isGroup: true,    // Wajib di dalam grup
    isPrivate: false,
    cooldown: 10,
    isEnabled: true
}

/**
 * Fungsi internal untuk mengirim status grup (V2)
 */
async function sendGroupStatus(sock, jid, content) {
    const inside = await generateWAMessageContent(content, {
        upload: sock.waUploadToServer
    })
    const messageSecret = crypto.randomBytes(32)
    const m = generateWAMessageFromContent(jid, {
        messageContextInfo: {
            messageSecret
        },
        groupStatusMessageV2: {
            message: {
                ...inside,
                messageContextInfo: {
                    messageSecret
                }
            }
        }
    }, {})
    await sock.relayMessage(jid, m.message, {
        messageId: m.key.id
    })
    return m
}

async function handler(m, { sock }) {
    const text = m.text || ''
    let content = {}

    // 1. Cek jika reply media (Gambar/Video)
    if (m.quoted && (m.quoted.isImage || m.quoted.isVideo)) {
        try {
            const buffer = await m.quoted.download()
            const mediaType = m.quoted.isImage ? 'image' : 'video'
            content[mediaType] = buffer
            content.caption = text || ''
        } catch (e) {
            return m.reply(`❌ *Gomen ne~* Gagal mengambil media dari balasan: ${e.message} 🥺`)
        }
    } 
    // 2. Cek jika kirim media langsung dengan caption
    else if (m.isImage || m.isVideo) {
        try {
            const buffer = await m.download()
            const mediaType = m.isImage ? 'image' : 'video'
            content[mediaType] = buffer
            content.caption = text || ''
        } catch (e) {
            return m.reply(`❌ *Gomen ne~* Gagal mendownload media: ${e.message} 🥺`)
        }
    } 
    // 3. Jika hanya teks
    else if (text && text.trim()) {
        content = { 
            text: text,
            font: 0,
            backgroundColor: '#128C7E' 
        }
    } 
    // 4. Jika tidak ada input sama sekali
    else {
        return m.reply(
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> \`${m.prefix}upswgc teks\`\n` +
            `> Reply gambar/video + \`${m.prefix}upswgc\`\n` +
            `> Kirim gambar/video + caption \`${m.prefix}upswgc\``
        )
    }

    try {
        await m.react('⏳')
        
        // Kirim langsung ke m.chat (ID grup tempat perintah diketik)
        await sendGroupStatus(sock, m.chat, content)
        
        await m.react('✅')
        await m.reply(`✅ *Berhasil!* Status grup telah diperbarui oleh admin.`)
        
    } catch (error) {
        await m.react('❌')
        await m.reply(
            `❌ *ꜰᴀɪʟᴇᴅ*\n\n` +
            `> Terjadi kesalahan saat memposting status.\n` +
            `> _${error.message}_`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}