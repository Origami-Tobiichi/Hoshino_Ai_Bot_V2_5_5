/**
✧ Name    : tostickerpack
✧ Category: sticker
**/

const crypto = require('crypto')
const https = require('https')
const JSZip = require('jszip')
const sharp = require('sharp')
const { downloadMediaMessage } = require('hsnai')
const config = require('../../config')

// ============================================================
// ALBUM BUFFER (in-memory, taro di global)
// Nampung child image dari album real-time via messages.upsert,
// di-link balik lewat messageContextInfo.messageAssociation.parentMessageKey.id
//
// PENTING: pakai global, bukan variabel module-scope biasa.
// Kalau plugin loader hsnai nge-clear require.cache tiap command
// dipanggil (hot-reload), variabel module-scope bakal ke-reset jadi
// instance baru tiap kali file ini di-require ulang — sementara
// listener yang udah nempel di sock.ev masih nunjuk ke instance lama.
// Taro di global memastikan listener dan handler selalu baca/tulis
// ke Map yang sama, apapun yang terjadi sama module cache-nya.
// ============================================================
if (!global.__tostickerpackAlbumBuffer) {
    global.__tostickerpackAlbumBuffer = new Map() // parentId -> { items: [], updatedAt }
}

function registerAlbumListener(sock) {
    // PENTING: dedup flag ditaro di properti sock itu sendiri, BUKAN di
    // global. Kalau ditaro di global, begitu WhatsApp reconnect dan
    // connection.js bikin instance sock baru (makeWASocket ulang), flag
    // global yang udah true bakal nyegah listener nempel ke sock BARU
    // itu — padahal sock baru itu jelas belum punya listener ini di
    // sock.ev-nya sendiri. Buffer datanya tetap global (biar survive
    // hot-reload plugin), tapi status attach harus per-instance sock.
    if (sock.__tostickerpackListenerAttached) return
    sock.__tostickerpackListenerAttached = true

    sock.ev.on('messages.upsert', ({ messages }) => {
        const albumBuffer = global.__tostickerpackAlbumBuffer

        for (const msg of messages) {
            const assoc = msg.message?.messageContextInfo?.messageAssociation
            if (assoc?.associationType !== 'MEDIA_ALBUM') continue

            const parentId = assoc.parentMessageKey?.id
            if (!parentId) continue

            const isFirstChunk = !albumBuffer.has(parentId)

            if (!albumBuffer.has(parentId)) albumBuffer.set(parentId, { items: [], updatedAt: Date.now() })
            albumBuffer.get(parentId).items.push(msg)
            albumBuffer.get(parentId).updatedAt = Date.now()

            // ===== DEBUG TEMP — hapus setelah selesai debugging =====
            // Lapor ke chat asal cuma sekali per album (pas chunk pertama),
            // biar keliatan langsung di WA tanpa perlu buka console.
            if (isFirstChunk) {
                sock.sendMessage(msg.key.remoteJid, {
                    text: `🔍 [DEBUG tostickerpack] Album chunk pertama kedeteksi.\nparentId: ${parentId}`
                }).catch(() => {})
            }
            // ===== END DEBUG =====
        }
    })

    // prune entri lebih dari 15 menit biar gak leak memory
    setInterval(() => {
        const now = Date.now()
        const albumBuffer = global.__tostickerpackAlbumBuffer
        for (const [k, v] of albumBuffer) {
            if (now - v.updatedAt > 15 * 60 * 1000) albumBuffer.delete(k)
        }
    }, 5 * 60 * 1000)
}

function getAlbum(parentId) {
    return global.__tostickerpackAlbumBuffer.get(parentId) || null
}

// ============================================================
// STICKER PACK BUILDER
// Reimplementasi manual upload media terenkripsi + relay stickerPackMessage
// (karena hsnai belum punya method bawaan yang jalan buat ini)
// ============================================================
function sha256(buf) {
    return crypto.createHash('sha256').update(buf).digest()
}

function toB64Url(buf) {
    return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function makeTrayWebp(buffer) {
    return sharp(buffer, { animated: false }).resize(252, 252, { fit: 'cover' }).webp().toBuffer()
}

async function makeThumbnailJpeg(buffer) {
    return sharp(buffer).resize(252, 252, { fit: 'cover' }).jpeg().toBuffer()
}

async function uploadToServer(sock, buffer, { hkdf, mediaPath, mediaKey = crypto.randomBytes(32) }) {
    const expanded = Buffer.from(crypto.hkdfSync('sha256', mediaKey, Buffer.alloc(32), Buffer.from(hkdf), 112))
    const iv = expanded.subarray(0, 16)
    const cipherKey = expanded.subarray(16, 48)
    const macKey = expanded.subarray(48, 80)

    const cipher = crypto.createCipheriv('aes-256-cbc', cipherKey, iv)
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
    const mac = crypto.createHmac('sha256', macKey).update(iv).update(encrypted).digest().subarray(0, 10)
    const encBuffer = Buffer.concat([encrypted, mac])

    const fileSha256 = sha256(buffer)
    const fileEncSha256 = sha256(encBuffer)

    const iq = await sock.query({
        tag: 'iq',
        attrs: { id: sock.generateMessageTag?.() ?? Date.now().toString(), to: 's.whatsapp.net', type: 'set', xmlns: 'w:m' },
        content: [{ tag: 'media_conn', attrs: {} }],
    })

    const mediaConn = iq.content?.find(v => v.tag === 'media_conn')
    if (!mediaConn) throw new Error('media_conn tidak ditemukan')

    const auth = mediaConn.attrs?.auth
    if (!auth) throw new Error('auth media_conn tidak ditemukan')

    const hosts = (mediaConn.content || [])
        .filter(v => v.tag === 'host')
        .map(v => v.attrs?.hostname)
        .filter(Boolean)

    if (!hosts.length) throw new Error('host upload tidak ditemukan')

    const token = encodeURIComponent(
        fileEncSha256.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''),
    )

    let lastError

    for (const host of hosts) {
        try {
            const json = await new Promise((resolve, reject) => {
                const url = new URL(
                    `https://${host}${mediaPath}/${token}?auth=${encodeURIComponent(auth)}&token=${token}`,
                )

                const req = https.request(
                    {
                        hostname: url.hostname,
                        port: 443,
                        path: url.pathname + url.search,
                        method: 'POST',
                        headers: {
                            Origin: 'https://web.whatsapp.com',
                            Referer: 'https://web.whatsapp.com/',
                            'Content-Type': 'application/octet-stream',
                            'Content-Length': encBuffer.length,
                        },
                    },
                    (res) => {
                        let body = ''
                        res.on('data', c => body += c)
                        res.on('end', () => {
                            if (res.statusCode < 200 || res.statusCode >= 300) {
                                return reject(new Error(`Upload gagal ${res.statusCode}: ${body}`))
                            }
                            try {
                                resolve(JSON.parse(body))
                            } catch {
                                reject(new Error(`Response bukan JSON: ${body}`))
                            }
                        })
                    },
                )

                req.on('error', reject)
                req.write(encBuffer)
                req.end()
            })

            const directPath = json.direct_path ?? json.directPath ?? json.url ?? json.path
            if (!directPath) throw new Error('directPath tidak ditemukan')

            return {
                mediaKey,
                fileLength: buffer.length,
                fileSha256,
                fileEncSha256,
                directPath,
                ...json,
            }
        } catch (e) {
            lastError = e
        }
    }

    throw lastError ?? new Error('Semua host upload gagal')
}

async function buildAndSendStickerPack(sock, m, { name, publisher, description, items }) {
    const zip = new JSZip()
    const stickersMetadata = []

    for (const item of items) {
        const fileName = `${toB64Url(sha256(item.buffer))}.${item.ext}`

        zip.file(fileName, item.buffer)

        stickersMetadata.push({
            fileName,
            isAnimated: item.isAnimated,
            emojis: [''],
            accessibilityLabel: '',
            isLottie: item.isLottie,
            mimetype: item.mimetype,
        })
    }

    const trayIconFileName = 'tray_icon.webp'
    const trayBuffer = await makeTrayWebp(items[0].buffer)

    zip.file(trayIconFileName, trayBuffer)

    const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })

    const packUpload = await uploadToServer(sock, archive, {
        hkdf: 'WhatsApp Sticker Pack Keys',
        mediaPath: '/mms/sticker-pack',
    })

    const thumbnailBuffer = await makeThumbnailJpeg(trayBuffer)

    const thumbUpload = await uploadToServer(sock, thumbnailBuffer, {
        hkdf: 'WhatsApp Sticker Pack Thumbnail Keys',
        mediaPath: '/mms/thumbnail-sticker-pack',
        mediaKey: packUpload.mediaKey,
    })

    await sock.relayMessage(
        m.chat,
        {
            messageContextInfo: {
                messageSecret: crypto.randomBytes(32),
            },
            stickerPackMessage: {
                stickerPackId: 'Pack_' + crypto.randomBytes(8).toString('hex'),
                name,
                publisher,
                packDescription: description,

                stickers: stickersMetadata,

                fileLength: packUpload.fileLength,
                fileSha256: packUpload.fileSha256,
                fileEncSha256: packUpload.fileEncSha256,
                mediaKey: packUpload.mediaKey,
                directPath: packUpload.directPath,
                mediaKeyTimestamp: Math.floor(Date.now() / 1000),
                stickerPackSize: packUpload.fileLength,
                stickerPackOrigin: 2,

                trayIconFileName,
                thumbnailDirectPath: thumbUpload.directPath,
                thumbnailSha256: thumbUpload.fileSha256,
                thumbnailEncSha256: thumbUpload.fileEncSha256,
                thumbnailHeight: 252,
                thumbnailWidth: 252,
                imageDataHash: thumbUpload.fileSha256.toString('base64'),
            },
        },
        {
            quoted: m,
        },
    )
}

// pluginConfig = metadata plugin, dipakai handler.js buat registrasi command
const pluginConfig = {
    name: 'tostickerpack',
    alias: ['tospack', 'spack', 'tsp'],
    category: 'sticker',
    description: 'Ubah album foto yang di-reply jadi sticker pack WhatsApp',
    usage: '.tostickerpack <nama pack> (reply ke pesan album foto)',
    example: '.tostickerpack Elaina',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 3,
    isEnabled: true,
}

// handler = fungsi utama yang dijalanin tiap kali command ke-trigger.
async function handler(m, { sock }) {
    // registrasi listener album (sekali per proses socket, lazy attach)
    registerAlbumListener(sock)

    const name = m.text?.trim()

    if (!m.quoted) {
        return m.reply(
            `📦 *ᴛᴏsᴛɪᴄᴋᴇʀᴘᴀᴄᴋ* 🎤\n\n` +
            `> Reply pesan album foto yang mau diubah jadi sticker pack ya~ ✨\n\n` +
            `> ${m.prefix}tostickerpack <nama pack>\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> ${m.prefix}tostickerpack Elaina`
        )
    }

    if (!name) {
        return m.reply(
            `📦 *ᴛᴏsᴛɪᴄᴋᴇʀᴘᴀᴄᴋ* 🎤\n\n` +
            `> Ai butuh nama pack-nya dong~ ✨\n\n` +
            `> ${m.prefix}tostickerpack <nama pack>`
        )
    }

    const albumKeyId = m.quoted.key?.id || m.quoted.id
    const bufferedKeys = [...global.__tostickerpackAlbumBuffer.keys()]
    const album = getAlbum(albumKeyId)

    if (!album || !album.items.length) {
        return m.reply(
            `❌ *ᴀʟʙᴜᴍ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ*\n\n` +
            `> Pastikan reply pesan album yang masih fresh dan bot online pas album dikirim~\n\n` +
            `╭┈┈⬡「 🔍 ᴅᴇʙᴜɢ 」\n` +
            `┃ Quoted ID: ${albumKeyId}\n` +
            `┃ Listener attached: ${!!sock.__tostickerpackListenerAttached}\n` +
            `┃ Buffer punya ${bufferedKeys.length} album:\n` +
            (bufferedKeys.length ? bufferedKeys.map(k => `┃ - ${k}`).join('\n') : `┃ (kosong)`) +
            `\n╰┈┈┈┈┈┈┈┈⬡`
        )
    }

    await m.react('🕕')
    await m.reply(`> Ditemukan ${album.items.length} media, lagi diproses jadi sticker pack...`)

    try {
        const stickers = []

        for (const raw of album.items) {
            const type = Object.keys(raw.message || {})[0]
            if (type !== 'imageMessage') continue // video belum disupport

            const buffer = await downloadMediaMessage(raw, 'buffer', {})
            if (!buffer) continue

            const webp = await sharp(buffer)
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp()
                .toBuffer()

            stickers.push({ buffer: webp, ext: 'webp', mimetype: 'image/webp', isAnimated: false, isLottie: false })
        }

        if (!stickers.length) {
            await m.react('❌')
            return m.reply(`❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ*\n\n> Gak ada gambar valid di album ini.`)
        }

        await buildAndSendStickerPack(sock, m, {
            name,
            publisher: config.info?.name || 'Hoshino Ai',
            description: `Sticker pack ini di buat menggunakan ${config.info?.name || 'Hoshino Ai'}`,
            items: stickers,
        })

        await m.react('✅')
    } catch (error) {
        console.error('[tostickerpack] Error:', error)
        await m.react('❌')
        return m.reply(
            `❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ*\n\n` +
            `> ${error.message}\n\n` +
            `> Coba lagi ya, Ai janji next take bakal lebih bagus~`
        )
    }
}

// Wajib export { config, handler } biar plugin loader (handler.js) bisa
// baca metadata dan manggil fungsi handler-nya.
// registerAlbumListener di-export juga kalau mau di-hook manual lebih awal
// (misal di file yang manggil makeWASocket), biar album gak kelewat
// sebelum command pertama dipanggil.
module.exports = {
    config: pluginConfig,
    handler,
    registerAlbumListener,
}