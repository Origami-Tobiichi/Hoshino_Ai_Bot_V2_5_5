const axios = require('axios')
const crypto = require('crypto')
const {
    generateWAMessage,
    generateWAMessageFromContent,
    jidNormalizedUser,
    downloadContentFromMessage
} = require('hsnai')

let mupdfLib = null
async function loadMupdf() {
    if (mupdfLib) return mupdfLib
    mupdfLib = await import('mupdf')
    return mupdfLib
}

// ================= CONFIG =================
const pluginConfig = {
    name: 'pdf2img',
    alias: ['pdftoimg', 'pdf2image'],
    category: 'tools',
    description: 'Convert halaman PDF jadi gambar',
    usage: '.pdf2img (reply PDF) [range halaman, cth 1-5]',
    example: '.pdf2img 1-10',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 1,
    isEnabled: true
}

const MAX_PAGES = 20

// ================= HELPER =================
function parseRange(str, total) {
    if (!str) return [1, Math.min(total, MAX_PAGES)]
    const match = str.match(/^(\d+)-(\d+)$/)
    if (match) {
        let start = parseInt(match[1])
        let end = parseInt(match[2])
        if (start < 1) start = 1
        if (end > total) end = total
        if (start > end) [start, end] = [end, start]
        if (end - start + 1 > MAX_PAGES) end = start + MAX_PAGES - 1
        return [start, end]
    }
    const single = parseInt(str)
    if (!isNaN(single)) {
        const page = Math.min(Math.max(single, 1), total)
        return [page, page]
    }
    return [1, Math.min(total, MAX_PAGES)]
}

// NOTE: sesuaikan bagian pengambilan quoted message ini sama struktur `m` di hsnai kamu.
async function getPdfBuffer(m) {
    const quotedMsg = m.quoted?.message
    const docMsg = quotedMsg?.documentMessage

    if (docMsg) {
        const stream = await downloadContentFromMessage(docMsg, 'document')
        let buffer = Buffer.from([])
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk])
        }
        return buffer
    }

    const arg = (m.text || '').trim().split(' ')[0]
    if (arg && arg.startsWith('http')) {
        const res = await axios.get(arg, { responseType: 'arraybuffer', timeout: 30000 })
        return Buffer.from(res.data)
    }

    return null
}

// ================= HANDLER =================
async function handler(m, { sock }) {
    let mupdf
    try {
        mupdf = await loadMupdf()
    } catch (e) {
        return m.reply(
            `『 ⚠️ ᴍɪssɪɴɢ ᴅᴇᴘᴇɴᴅᴇɴᴄʏ 』✦✦✦\n\n` +
            `mupdf gagal dimuat: ${e.message}\n` +
            `Jalankan: \`npm install mupdf\`\n\n` +
            `Ai nunggu sampai siap ya~ 🌸`
        )
    }

    const pdfBuffer = await getPdfBuffer(m)
    if (!pdfBuffer) {
        return m.reply(
            `『 📄 ᴘᴅꜰ ᴛᴏ ɪᴍᴀɢᴇ 』✦✦✦\n\n` +
            `╭┈┈⬡\n` +
            `┃ Reply ke file PDF ya~\n` +
            `┃ Bisa tambah range halaman\n` +
            `┃ 📖 contoh: 1-10\n` +
            `╰┈┈⬡\n\n` +
            `💖 *Cara pakai:*\n` +
            `\`${m.prefix}pdf2img 1-10\` (reply PDF)\n\n` +
            `Ai selalu ada buat kamu~ 🌸`
        )
    }

    m.react('🕕')

    try {
        const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf')
        const totalPages = doc.countPages()

        const args = (m.text || '').trim().split(' ')
        const rangeArg = args.find(a => /^\d+(-\d+)?$/.test(a))
        const [start, end] = parseRange(rangeArg, totalPages)

        m.reply(
            `『 ⏳ ᴍᴇʀᴇɴᴅᴇʀ 』✦✦✦\n\n` +
            `📄 Total halaman: *${totalPages}*\n` +
            `🖼️ Merender halaman: *${start}-${end}*\n\n` +
            `Sabar ya, Ai lagi kerjain~ 💖`
        )

        const mediaList = []
        const scale = 2 // ~144 DPI, naikkan ke 3 kalau mau lebih tajam

        for (let i = start; i <= end; i++) {
            try {
                const page = doc.loadPage(i - 1) // mupdf pakai index 0-based
                const matrix = mupdf.Matrix.scale(scale, scale)
                const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true)
                const pngBuffer = pixmap.asPNG()

                mediaList.push({
                    image: Buffer.from(pngBuffer),
                    caption: i === start ? `📑 Halaman ${i}` : undefined
                })

                pixmap.destroy()
                page.destroy()
            } catch (e) {
                console.log(`[PDF2Img] Gagal render halaman ${i}:`, e.message)
            }
        }

        if (!mediaList.length) {
            m.react('❌')
            return m.reply(
                `『 ❌ ɢᴀɢᴀʟ 』✦✦✦\n\n` +
                `Ai gak berhasil render halamannya 😢\n` +
                `Coba lagi ya~`
            )
        }

        // ===== Kirim single image =====
        if (mediaList.length === 1) {
            await sock.sendMessage(m.chat, {
                image: mediaList[0].image,
                caption:
                    `『 ✅ sᴇʟᴇsᴀɪ 』✦✦✦\n\n` +
                    `📑 Halaman: *${start}*\n\n` +
                    `Ai selalu ada buat kamu~ 🌸`
            }, { quoted: m })
            m.react('✅')
            return
        }

        // ===== Kirim album (multi-halaman) =====
        try {
            const opener = generateWAMessageFromContent(
                m.chat,
                {
                    messageContextInfo: { messageSecret: crypto.randomBytes(32) },
                    albumMessage: {
                        expectedImageCount: mediaList.length,
                        expectedVideoCount: 0
                    }
                },
                {
                    userJid: jidNormalizedUser(sock.user.id),
                    quoted: m,
                    upload: sock.waUploadToServer
                }
            )

            await sock.relayMessage(opener.key.remoteJid, opener.message, {
                messageId: opener.key.id
            })

            const generatedMessages = await Promise.all(mediaList.map(async (content) => {
                const msg = await generateWAMessage(opener.key.remoteJid, content, {
                    upload: sock.waUploadToServer
                })

                msg.message.messageContextInfo = {
                    messageSecret: crypto.randomBytes(32),
                    messageAssociation: {
                        associationType: 1,
                        parentMessageKey: opener.key
                    }
                }
                return msg
            }))

            for (const msg of generatedMessages) {
                await sock.relayMessage(msg.key.remoteJid, msg.message, {
                    messageId: msg.key.id
                })
            }

            m.reply(
                `『 ✅ sᴇʟᴇsᴀɪ 』✦✦✦\n\n` +
                `📄 Total: *${mediaList.length}* halaman\n` +
                `📑 Range: *${start}-${end}*\n\n` +
                `✨ Enjoy~ Ai selalu ada buat kamu 💖`
            )
            m.react('✅')

        } catch (err) {
            console.log('[PDF2Img] Album gagal, kirim satu-satu:', err.message)

            for (const content of mediaList) {
                await sock.sendMessage(m.chat, { image: content.image }, { quoted: m })
            }

            m.reply(
                `『 ✅ sᴇʟᴇsᴀɪ 』✦✦✦\n\n` +
                `Terkirim satu-satu ya (album gagal)~\n` +
                `Total: *${mediaList.length}* halaman 🌸`
            )
            m.react('✅')
        }

    } catch (err) {
        console.error('[PDF2Img] Error:', err.message)
        m.react('❌')
        m.reply(
            `『 ❌ ᴇʀʀᴏʀ 』✦✦✦\n\n` +
            `${err.message}\n\n` +
            `Ai coba lagi nanti ya~ 😢`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}