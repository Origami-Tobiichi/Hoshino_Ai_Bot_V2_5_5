/**
‎✧ Name    : img2sp
‎✧ Category: sticker
**/

const config = require('../../config')
const crypto = require('crypto')
const https = require('https')
const JSZip = require('jszip')
const ffmpeg = require('fluent-ffmpeg')
const { promises: fsp } = require('fs')
const os = require('os')
const path = require('path')
const { proto, downloadContentFromMessage } = require('hsnai')

const pluginConfig = {
    name: 'img2sp',
    alias: ['i2sp'],
    category: 'sticker',
    description: 'Ubah 1 media atau 1 album (gambar/video) jadi WhatsApp Sticker Pack',
    usage: '.img2sp [-crop|-fit] <nama pack>|<deskripsi>',
    example: '.img2sp -crop Ai Pack|Sticker pack by Ai',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 3,
    isEnabled: true
}

const MAX_STICKER_BYTES = 1024 * 1024
const BASE_WIDTH = 512
const MIN_WIDTH = 240
const RESOLUTION_STEP = 64

function toBuffer(value) {
    if (Buffer.isBuffer(value)) return value
    if (value && value.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data)
    if (typeof value === 'string') return Buffer.from(value, 'base64')
    throw new Error('Format buffer tidak dikenali')
}

function toStoredBuffer(buffer) {
    return Buffer.from(buffer).toString('base64')
}

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest()
}

function toB64Url(buffer) {
    return Buffer.from(buffer)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '')
}

function requireSharp() {
    try {
        return require('sharp')
    } catch {
        throw new Error('Install sharp dulu:\nnpm i sharp')
    }
}

async function makeTrayWebp(buffer) {
    const sharp = requireSharp()

    return await sharp(buffer, { animated: false })
        .resize(252, 252, { fit: 'cover' })
        .webp()
        .toBuffer()
}

async function makeBlankTrayWebp() {
    const sharp = requireSharp()

    return await sharp({
        create: {
            width: 252,
            height: 252,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    })
        .webp()
        .toBuffer()
}

async function makeThumbnailJpeg(buffer) {
    const sharp = requireSharp()

    return await sharp(buffer)
        .resize(252, 252, { fit: 'cover' })
        .jpeg()
        .toBuffer()
}

async function uploadToServer(sock, buffer, { hkdf, mediaPath, mediaKey = crypto.randomBytes(32) }) {
    const expanded = Buffer.from(
        crypto.hkdfSync('sha256', mediaKey, Buffer.alloc(32), Buffer.from(hkdf), 112),
    )

    const iv = expanded.subarray(0, 16)
    const cipherKey = expanded.subarray(16, 48)
    const macKey = expanded.subarray(48, 80)

    const cipher = crypto.createCipheriv('aes-256-cbc', cipherKey, iv)
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])

    const mac = crypto
        .createHmac('sha256', macKey)
        .update(iv)
        .update(encrypted)
        .digest()
        .subarray(0, 10)

    const encBuffer = Buffer.concat([encrypted, mac])

    const fileSha256 = sha256(buffer)
    const fileEncSha256 = sha256(encBuffer)

    const iq = await sock.query({
        tag: 'iq',
        attrs: {
            id: sock.generateMessageTag?.() ?? Date.now().toString(),
            to: 's.whatsapp.net',
            type: 'set',
            xmlns: 'w:m',
        },
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

async function sendCustomStickerPack(sock, m, pack, packName, packDescription, publisher) {
    const zip = new JSZip()
    const stickersMetadata = []
    const hydrated = pack.map(item => ({ ...item, buffer: toBuffer(item.buffer) }))

    for (const item of hydrated) {
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
    const traySource = hydrated.find(v => !v.isLottie)?.buffer

    const trayBuffer = traySource
        ? await makeTrayWebp(traySource)
        : await makeBlankTrayWebp()

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
                name: packName,
                publisher: publisher || m.pushName || 'Unknown',
                packDescription,

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

// Semua logic cache & pencarian album sekarang tinggal di lib bersama,
// biar plugin lain (crm, relaymsg, dst) bisa pake tanpa require img2sp.js.
const {
    unwrapAssociatedChild,
    findAlbumChildren,
} = require('../../src/lib/albumCache')


function hydrateMediaBuffers(media) {
    const fields = ['mediaKey', 'fileEncSha256', 'fileSha256']
    const clone = { ...media }

    for (const f of fields) {
        if (typeof clone[f] === 'string') {
            clone[f] = Buffer.from(clone[f], 'base64')
        }
    }

    return clone
}

async function downloadAlbumMedia(mediaMessage, type) {
    const hydrated = hydrateMediaBuffers(mediaMessage)
    const stream = await downloadContentFromMessage(hydrated, type)

    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)

    return Buffer.concat(chunks)
}

function ffprobeDuration(inputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, data) => {
            if (err) return reject(err)
            resolve(data?.format?.duration || 0)
        })
    })
}

function encodeAnimatedWebp(inputPath, outputPath, { width, duration, mode }) {
    const filters = mode === 'crop'
        ? [
            'fps=15',
            'crop=min(iw\\,ih):min(iw\\,ih)',
            `scale=${width}:${width}:flags=lanczos`,
        ]
        : [
            'fps=15',
            `scale=${width}:${width}:force_original_aspect_ratio=decrease:flags=lanczos`,
            `pad=${width}:${width}:(ow-iw)/2:(oh-ih)/2:color=black@0.0`,
        ]

    const outputOptions = ['-loop', '0', '-preset', 'default', '-an', '-vsync', '0', '-vcodec', 'libwebp']
    if (mode !== 'crop') outputOptions.push('-pix_fmt', 'yuva420p')

    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .inputOptions(['-t', String(duration)])
            .videoFilters(filters)
            .outputOptions(outputOptions)
            .save(outputPath)
            .on('end', resolve)
            .on('error', reject)
    })
}

async function videoToStickerWebp(buffer, mode) {
    const tmpDir = os.tmpdir()
    const uid = crypto.randomBytes(6).toString('hex')
    const inputPath = path.join(tmpDir, `img2sp-in-${uid}.mp4`)

    await fsp.writeFile(inputPath, buffer)

    try {
        const rawDuration = await ffprobeDuration(inputPath)

        let duration = Math.min(rawDuration || 10, 10)
        let width = BASE_WIDTH
        let result

        for (let i = 0; i < 30; i++) {
            const outputPath = path.join(tmpDir, `img2sp-out-${uid}-${i}.webp`)

            await encodeAnimatedWebp(inputPath, outputPath, { width, duration, mode })

            const out = await fsp.readFile(outputPath)
            await fsp.unlink(outputPath).catch(() => {})

            result = out

            if (out.length <= MAX_STICKER_BYTES) break
            if (width <= MIN_WIDTH && duration <= 1) break

            if (width > MIN_WIDTH) {
                width = Math.max(MIN_WIDTH, width - RESOLUTION_STEP)
            } else {
                width = BASE_WIDTH
                duration = Math.max(1, duration - 1)
            }
        }

        return result
    } finally {
        await fsp.unlink(inputPath).catch(() => {})
    }
}

async function imageToStickerWebp(buffer, mode) {
    const sharp = requireSharp()

    const resizeOptions = mode === 'crop'
        ? { fit: 'cover', position: 'centre' }
        : { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }

    let width = BASE_WIDTH
    let result

    for (let i = 0; i < 20; i++) {
        const out = await sharp(buffer)
            .resize(width, width, resizeOptions)
            .webp({ quality: 80 })
            .toBuffer()

        result = out

        if (out.length <= MAX_STICKER_BYTES) break
        if (width <= MIN_WIDTH) break

        width = Math.max(MIN_WIDTH, width - RESOLUTION_STEP)
    }

    return result
}

async function convertToStickerBuffer(mediaType, buffer, mode) {
    if (mediaType === 'imageMessage') {
        const webp = await imageToStickerWebp(buffer, mode)
        return { buffer: webp, ext: 'webp', mimetype: 'image/webp', isAnimated: false, isLottie: false }
    }

    if (mediaType === 'videoMessage') {
        const webp = await videoToStickerWebp(buffer, mode)
        return { buffer: webp, ext: 'webp', mimetype: 'image/webp', isAnimated: true, isLottie: false }
    }

    return null
}

async function writeExif(buffer, packname, author) {
    const { addExifToWebp } = require('../../src/lib/exif.js')

    return await addExifToWebp(buffer, {
        packname: packname || '',
        author: author || '',
    })
}

async function buildPackItem(mediaType, rawBuffer, mode, packName, publisher) {
    const converted = await convertToStickerBuffer(mediaType, rawBuffer, mode)
    if (!converted) return null

    const withExif = await writeExif(converted.buffer, packName, publisher)

    return {
        sha256: sha256(withExif).toString('hex'),
        buffer: toStoredBuffer(withExif),
        ext: converted.ext,
        mimetype: converted.mimetype,
        isAnimated: converted.isAnimated,
        isLottie: converted.isLottie,
    }
}

async function processAlbumToPack(sock, m, children, { mode, packName, packDescription, publisher }) {
    await m.reply(`🕕 *ᴅɪᴘʀᴏsᴇs~* 🎤\n\n> Ditemukan ${children.length} media, Ai lagi bikinin sticker pack-nya ya~ ✨`)

    const packItems = []
    const errors = []

    for (const child of children) {
        const unwrapped = unwrapAssociatedChild(child)

        const mediaType = Object.keys(unwrapped.message)
            .find(v => v === 'imageMessage' || v === 'videoMessage')

        if (!mediaType) continue

        try {
            const rawBuffer = await downloadAlbumMedia(
                unwrapped.message[mediaType],
                mediaType === 'imageMessage' ? 'image' : 'video',
            )

            const item = await buildPackItem(mediaType, rawBuffer, mode, packName, publisher)
            if (!item) continue

            packItems.push(item)
        } catch (e) {
            console.error('[img2sp] gagal proses 1 item:', e)
            errors.push(e?.message || String(e))
        }
    }

    if (!packItems.length) {
        const reason = errors[0] ? `\n\n> Error: ${errors[0]}` : ''
        return m.reply(`❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ*\n\n> Gagal proses semua media di album ini.${reason}`)
    }

    await sendCustomStickerPack(sock, m, packItems, packName, packDescription, publisher)
    return m.reply(`✅ *ʙᴇʀʜᴀsɪʟ~* 🎤✨\n\n> Sticker pack "${packName}" udah jadi, ${packItems.length}/${children.length} media berhasil diolah!`)
}

function parseAlbumArgs(text) {
    let mode = 'fit'
    let cleanText = (text || '').trim()

    const flagMatch = cleanText.match(/^-(crop|fit)\b\s*/i)
    if (flagMatch) {
        mode = flagMatch[1].toLowerCase()
        cleanText = cleanText.slice(flagMatch[0].length)
    }

    const [rawName, rawDescription] = cleanText.split('|')
    const packName = rawName?.trim() || config.sticker?.packname || 'Sea Album'
    const packDescription = rawDescription?.trim() || undefined

    return { mode, packName, packDescription }
}

async function handler(m, { sock }) {
    const text = m.text?.trim()

    const { mode, packName, packDescription } = parseAlbumArgs(text)
    const publisher = m.pushName

    if (!m.quoted) {
        return m.reply(
            `📦 *ɪᴍɢ2sᴘ* 🎤\n\n` +
            `> Reply pesan album atau 1 gambar/video buat dijadiin sticker pack ya~ ✨\n\n` +
            `> ${m.prefix}img2sp [-crop|-fit] <nama pack>|<deskripsi>\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> ${m.prefix}img2sp -crop Ai Pack|Sticker pack by Ai`
        )
    }

    // FIX: quoted (dari serialize.js versi hsnai) gak punya `.chat` maupun `.fromMe`
    // di top-level — yang ada `.key.remoteJid` dan `.key.fromMe`.
    const chatId = m.quoted.key?.remoteJid || m.chat
    const parentId = m.quoted.id
    const parentSender = m.quoted.key?.fromMe ? 'me' : (m.quoted.key?.participant || m.quoted.sender || null)

    console.log('[img2sp] DEBUG quoted mentah:', {
        chatId,
        parentId,
        parentSender,
        quotedKey: m.quoted.key,
        quotedSender: m.quoted.sender,
        quotedType: m.quoted.type,
    })

    const children = findAlbumChildren(chatId, parentId, parentSender)

    if (children.length) {
        await m.react('🕕')

        try {
            await processAlbumToPack(sock, m, children, { mode, packName, packDescription, publisher })
            return await m.react('✅')
        } catch (error) {
            console.error('[img2sp] Error:', error)
            await m.react('❌')
            return m.reply(`❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ*\n\n> ${error.message}\n\n> Coba lagi ya, Ai janji next take bakal lebih bagus~`)
        }
    }

    // Bukan bagian dari album -> bikin pack isi 1 sticker dari media yang di-reply
    // FIX: quoted gak punya `.msg`/`.mimetype`/`.seconds` di top-level — pakai flag
    // isImage/isVideo yang udah disediain serialize.js, dan ambil `seconds` dari
    // dalam `quoted.message[quoted.type]`.
    const q = m.quoted
    const isImage = q.isImage
    const isVideo = q.isVideo

    if (!isImage && !isVideo) {
        return m.reply('❌ *ᴀᴅᴜʜ*\n\n> Reply ke gambar atau video buat dijadiin sticker pack ya~')
    }

    const mediaContent = q.message?.[q.type] || {}

    if (isVideo && mediaContent.seconds > 10) {
        return m.reply('❌ *ᴀᴅᴜʜ*\n\n> Video harus berdurasi di bawah 10 detik.')
    }

    await m.react('🕕')

    try {
        const rawBuffer = await q.download()
        const mediaType = isVideo ? 'videoMessage' : 'imageMessage'

        const item = await buildPackItem(mediaType, rawBuffer, mode, packName, publisher)
        if (!item) throw new Error('Gagal konversi media jadi sticker.')

        await sendCustomStickerPack(sock, m, [item], packName, packDescription, publisher)

        await m.react('✅')
        return m.reply(`✅ *ʙᴇʀʜᴀsɪʟ~* 🎤✨\n\n> Sticker pack "${packName}" udah jadi!`)
    } catch (error) {
        console.error('[img2sp] Error:', error)
        await m.react('❌')
        return m.reply(`❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ*\n\n> ${error.message}\n\n> Coba lagi ya, Ai janji next take bakal lebih bagus~`)
    }
}

module.exports = {
    config: pluginConfig,
    handler,
}