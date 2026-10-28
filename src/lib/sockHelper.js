const fs = require('fs');
const path = require('path');
const { downloadMediaMessage, getContentType } = require('hsnai');
const { addExifToWebp, DEFAULT_METADATA } = require('./exif');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const { config } = require('./../../config');
const mime = require('mime-types');
const { getProfilePicture, getProfileBuffer } = require('./profilePicture');

/**
 * Get temp directory
 */
function getTempDir() {
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
}

/**
 * Download buffer from URL
 */
async function downloadBuffer(url) {
    const axios = require('axios');
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    return Buffer.from(response.data);
}

/**
 * Convert image buffer to WebP sticker using sharp
 */
async function imageToWebp(buffer) {
    try {
        const sharp = require('sharp');
        return await sharp(buffer)
            .resize(512, 512, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .webp({ quality: 80 })
            .toBuffer();
    } catch (error) {
        throw new Error('Failed to convert image to webp: ' + error.message);
    }
}

/**
 * Convert video to WebP sticker using fluent-ffmpeg
 */
function videoToWebp(buffer) {
    return new Promise((resolve, reject) => {
        const tmpDir = getTempDir();
        const inputPath = path.join(tmpDir, `input_${Date.now()}.mp4`);

        if (!buffer || buffer.length < 1000) {
            return reject(new Error('Invalid video buffer'));
        }

        fs.writeFileSync(inputPath, buffer);

        const cleanup = () => {
            try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch {}
        };

        const MAX_SIZE = 500 * 1024; // 500KB max (batas WA stiker)

        const encode = (quality, fps, duration, scale) => {
            return new Promise((res, rej) => {
                const outputPath = path.join(tmpDir, `output_${Date.now()}_q${quality}.webp`);
                const timeout = setTimeout(() => rej(new Error('Timeout')), 60000);

                ffmpeg(inputPath)
                    .inputOptions(['-y', '-t', String(duration)])
                    .outputOptions([
                        '-vcodec', 'libwebp_anim',
                        '-vf', `fps=${fps},scale='min(${scale},iw)':'min(${scale},ih)':force_original_aspect_ratio=decrease,pad=${scale}:${scale}:(ow-iw)/2:(oh-ih)/2:color=0x00000000,setsar=1`,
                        '-loop', '0',
                        '-preset', 'default',
                        '-an',
                        '-vsync', '0',
                        '-pix_fmt', 'yuva420p',
                        '-q:v', String(quality)
                    ])
                    .toFormat('webp')
                    .on('end', () => {
                        clearTimeout(timeout);
                        try {
                            if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 100) {
                                return rej(new Error('Output empty'));
                            }
                            const buf = fs.readFileSync(outputPath);
                            try { fs.unlinkSync(outputPath); } catch {}
                            res(buf);
                        } catch (err) { rej(err); }
                    })
                    .on('error', (err) => {
                        clearTimeout(timeout);
                        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
                        rej(new Error('FFmpeg error: ' + err.message));
                    })
                    .save(outputPath);
            });
        };

        (async () => {
            try {
                // Auto compress: turunin resolusi + fps + quality sampai <= 500KB
                const attempts = [
                    { quality: 50, fps: 15, duration: 10, scale: 512 },
                    { quality: 70, fps: 10, duration: 10, scale: 384 },
                    { quality: 80, fps: 8,  duration: 10, scale: 256 },
                    { quality: 90, fps: 6,  duration: 10, scale: 256 },
                    { quality: 95, fps: 4,  duration: 10, scale: 192 },
                ];

                let result;
                for (const attempt of attempts) {
                    console.log(`[Sticker] Encoding q=${attempt.quality} fps=${attempt.fps} t=${attempt.duration}s scale=${attempt.scale}...`);
                    result = await encode(attempt.quality, attempt.fps, attempt.duration, attempt.scale);
                    console.log(`[Sticker] Output: ${(result.length / 1024).toFixed(1)} KB`);
                    if (result.length <= MAX_SIZE) break;
                    console.log(`[Sticker] Too large (${(result.length / 1024).toFixed(0)} KB > 500 KB), retrying...`);
                }

                cleanup();
                resolve(result);
            } catch (err) {
                cleanup();
                reject(err);
            }
        })();
    });
}

/**
 * Simple image to webp without sharp (using raw webp)
 */
async function simpleImageToWebp(buffer) {
    const tmpDir = getTempDir();
    const inputPath = path.join(tmpDir, `img_${Date.now()}.png`);
    const outputPath = path.join(tmpDir, `sticker_${Date.now()}.webp`);
    
    fs.writeFileSync(inputPath, buffer);
    
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions([
                '-vcodec', 'libwebp',
                '-vf', "scale='min(512,iw)':min'(512,ih)':force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000",
                '-loop', '0',
                '-preset', 'default',
                '-an',
                '-vsync', '0'
            ])
            .toFormat('webp')
            .on('end', () => {
                try {
                    const webpBuffer = fs.readFileSync(outputPath);
                    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                    resolve(webpBuffer);
                } catch (err) {
                    reject(err);
                }
            })
            .on('error', (err) => {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                reject(err);
            })
            .save(outputPath);
    });
}

/**
 * Extend socket with helper methods
 */
function extendSocket(sock) {
    // sock.sendImageAsSticker
    // await sock.sendImageAsSticker(m.chat, buffer, m)
    // await sock.sendImageAsSticker(m.chat, 'https://...', m, { packname: 'Pack', author: 'Ai' })
    sock.sendImageAsSticker = async (jid, input, m, options = {}) => {
        let buffer;
        
        if (Buffer.isBuffer(input)) {
            buffer = input;
        } else if (typeof input === 'string') {
            if (input.startsWith('http')) {
                buffer = await downloadBuffer(input);
            } else if (fs.existsSync(input)) {
                buffer = fs.readFileSync(input);
            } else {
                throw new Error('Invalid input');
            }
        } else {
            throw new Error('Invalid input type');
        }
        
        // Deteksi format buffer
        // WA sering kirim stiker animasi sebagai video (MP4/dll) atau animated WebP
        // dengan metadata isAnimated: false — jangan percaya metadata WA
        const isWebp = buffer.length > 12 &&
            buffer.slice(0, 4).toString('hex') === '52494646' &&
            buffer.slice(8, 12).toString('ascii') === 'WEBP';
        
        const hasAnimChunk = isWebp && (
            buffer.indexOf(Buffer.from('ANIM')) !== -1 ||
            buffer.indexOf(Buffer.from('ANMF')) !== -1
        );
        
        // Bukan WebP = video/format lain (MP4, dll) — harus FFmpeg
        const isVideoFormat = !isWebp;
        
        let webpBuffer;
        
        if (hasAnimChunk) {
            // Animated WebP — bypass sharp, langsung pakai buffer asli
            console.log('[Sticker] Animated WebP detected (ANIM/ANMF chunk), skipping sharp');
            webpBuffer = buffer;
        } else if (isVideoFormat) {
            // Video/format non-WebP — convert pakai FFmpeg ke animated WebP
            console.log('[Sticker] Non-WebP format detected, using FFmpeg');
            webpBuffer = await videoToWebp(buffer);
        } else {
            // Static WebP atau image biasa — proses normal pakai sharp
            try {
                const sharp = require('sharp');
                webpBuffer = await sharp(buffer)
                    .resize(512, 512, {
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    })
                    .webp({ quality: 80 })
                    .toBuffer();
            } catch (err) {
                throw new Error('Failed to convert image: ' + err.message);
            }
        }
        
        try {
            webpBuffer = await addExifToWebp(webpBuffer, {
                packname: options.packname ?? DEFAULT_METADATA.packname,
                author: (options.author != null && String(options.author).trim() !== '') ? options.author : DEFAULT_METADATA.author,
                emojis: options.emojis || DEFAULT_METADATA.emojis
            });
        } catch (e) {
            console.log('[Sticker] EXIF error:', e.message);
        }
        
        return sock.sendMessage(jid, {
            sticker: webpBuffer,
            contextInfo: {
                isForwarded: true,
                forwardingScore: 1,
            }
        }, {
            quoted: m
        });
    };
    
    // sock.sendVideoAsSticker
    // await sock.sendVideoAsSticker(m.chat, buffer, m)
    // await sock.sendVideoAsSticker(m.chat, 'https://example.com/anim.mp4', m, { author: 'Ai' })
    sock.sendVideoAsSticker = async (jid, input, m, options = {}) => {
        let buffer;
        
        if (Buffer.isBuffer(input)) {
            buffer = input;
        } else if (typeof input === 'string') {
            if (input.startsWith('http')) {
                buffer = await downloadBuffer(input);
            } else if (fs.existsSync(input)) {
                buffer = fs.readFileSync(input);
            } else {
                throw new Error('Invalid input');
            }
        } else {
            throw new Error('Invalid input type');
        }
        let webpBuffer = await videoToWebp(buffer);
        try {
            webpBuffer = await addExifToWebp(webpBuffer, {
                packname: options.packname ?? DEFAULT_METADATA.packname,
                author: (options.author != null && String(options.author).trim() !== '') ? options.author : DEFAULT_METADATA.author,
                emojis: options.emojis || DEFAULT_METADATA.emojis
            });
        } catch (e) {
            console.log('[Sticker] EXIF error:', e.message);
        }
        
        return sock.sendMessage(jid, {
            sticker: webpBuffer,
            contextInfo: {
                isForwarded: true,
                forwardingScore: 999,
            }
        }, {
            quoted: m
        });
    };
    
    // sock.sendStickerPack
    // await sock.sendStickerPack(m.chat, [buf1, buf2, buf3], m, { name: 'Pack Name', publisher: 'Ai' })
    // NOTE: fixed 2026-07-12 — old implementation built a .wastickers zip via archiver
    // and relayed a manual stickerPackMessage, which no longer works. hsnai supports the
    // native `stickerPack` message key directly through sock.sendMessage, same as the
    // Ourin fork. Confirmed working via eval test with sharp({ animated: true }) buffers.
    sock.sendStickerPack = async (jid, stickers, m, options = {}) => {
        const crypto = require('crypto');

        if (!stickers || !stickers.length) {
            throw new Error('No stickers provided');
        }

        const packname = options.name || options.packname || 'Sticker Pack';
        const publisher = options.publisher || options.author || 'Ourin-AI';
        const packDescription = options.description || '';
        const stickerPackId = options.id || crypto.randomUUID();
        const defaultEmojis = options.emojis || ['🎨'];

        console.log(`[StickerPack] Preparing pack: ${packname} with ${stickers.length} stickers`);

        const stickerList = [];
        let coverBuffer = null;

        for (let i = 0; i < stickers.length; i++) {
            try {
                let stickerBuffer = stickers[i];

                if (typeof stickerBuffer === 'string') {
                    if (stickerBuffer.startsWith('http')) {
                        stickerBuffer = await downloadBuffer(stickerBuffer);
                    } else if (fs.existsSync(stickerBuffer)) {
                        stickerBuffer = fs.readFileSync(stickerBuffer);
                    }
                }

                if (!Buffer.isBuffer(stickerBuffer) || stickerBuffer.length < 100) continue;

                const isGif = stickerBuffer.slice(0, 4).toString('hex') === '47494638';
                const isWebp = stickerBuffer.slice(0, 4).toString('hex') === '52494646';
                const isPng = stickerBuffer.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
                const isJpeg = stickerBuffer.slice(0, 2).toString('hex') === 'ffd8';

                let webpBuffer;
                if (isGif) webpBuffer = await videoToWebp(stickerBuffer);
                else if (isWebp) webpBuffer = stickerBuffer;
                else if (isPng || isJpeg) webpBuffer = await imageToWebp(stickerBuffer);
                else {
                    try { webpBuffer = await imageToWebp(stickerBuffer); }
                    catch { webpBuffer = await videoToWebp(stickerBuffer); }
                }

                if (!coverBuffer) coverBuffer = webpBuffer;

                stickerList.push({
                    sticker: webpBuffer,
                    emojis: defaultEmojis,
                    accessibilityLabel: ''
                });

                console.log(`[StickerPack] Processed ${i + 1}/${stickers.length}`);
            } catch (e) {
                console.log(`[StickerPack] Failed ${i + 1}:`, e.message);
            }
        }

        if (stickerList.length === 0) {
            throw new Error('No stickers could be prepared');
        }

        console.log(`[StickerPack] Sending "${packname}" natively with ${stickerList.length} stickers`);

        return sock.sendMessage(jid, {
            stickerPack: {
                packId: stickerPackId,
                name: packname,
                publisher,
                description: packDescription,
                cover: coverBuffer,
                stickers: stickerList
            }
        }, m ? { quoted: m } : {});
    };
    
        // =======================
    // 🌸 sock.sendStickerPackRaw
    // Upload manual bypass generateWAMessageContent bawaan hsnai — dipakai
    // karena sock.sendStickerPack (native, di atas) kadang "Media upload
    // failed on all hosts" begitu jumlah/size sticker naik, gak konsisten.
    // Ini gabung semua sticker jadi 1 ZIP (STORE), upload manual ke
    // media_conn host, rakit stickerPackMessage manual, kirim via relayMessage.
    // Terpisah total dari sock.sendStickerPack — jangan dihapus/gabung,
    // biar plugin lama yang masih pakai sendStickerPack gak kebawa dampak.
    //
    // await sock.sendStickerPackRaw(m.chat, [{ buffer, isAnimated, emojis }, ...], m, { name, publisher, description })
    // stickers juga bisa berupa array of Buffer polos.
    // =======================
    sock.sendStickerPackRaw = async (jid, stickers, m, options = {}) => {
        const JSZip = require('jszip')
        const https = require('https')
        const crypto = require('crypto')

        if (!stickers || !stickers.length) {
            throw new Error('No stickers provided')
        }

        function rawSha256(buffer) {
            return crypto.createHash('sha256').update(buffer).digest()
        }

        function rawToB64Url(buffer) {
            return Buffer.from(buffer)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/g, '')
        }

        function isWebP(buffer) {
            return buffer.length >= 12 &&
                buffer.toString('ascii', 0, 4) === 'RIFF' &&
                buffer.toString('ascii', 8, 12) === 'WEBP'
        }

        function isAnimatedWebP(buffer) {
            if (!isWebP(buffer)) return false
            let offset = 12
            while (offset < buffer.length - 8) {
                const chunk = buffer.toString('ascii', offset, offset + 4)
                const size = buffer.readUInt32LE(offset + 4)
                if (chunk === 'VP8X' && (buffer[offset + 8] & 0x02)) return true
                if (chunk === 'ANIM' || chunk === 'ANMF') return true
                offset += 8 + size + (size % 2)
            }
            return false
        }

        async function rawMakeTrayWebp(buffer) {
            const sharp = require('sharp')
            return await sharp(buffer, { animated: false })
                .resize(252, 252, { fit: 'cover' })
                .webp()
                .toBuffer()
        }

        async function rawMakeThumbnailJpeg(buffer) {
            const sharp = require('sharp')
            return await sharp(buffer)
                .resize(252, 252, { fit: 'cover' })
                .jpeg()
                .toBuffer()
        }

        async function rawUploadToServer(buffer, { hkdf, mediaPath, mediaKey = crypto.randomBytes(32) }) {
            const expanded = Buffer.from(
                crypto.hkdfSync('sha256', mediaKey, Buffer.alloc(32), Buffer.from(hkdf), 112)
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
            const fileSha256 = rawSha256(buffer)
            const fileEncSha256 = rawSha256(encBuffer)

            const iq = await sock.query({
                tag: 'iq',
                attrs: {
                    id: sock.generateMessageTag?.() ?? Date.now().toString(),
                    to: 's.whatsapp.net',
                    type: 'set',
                    xmlns: 'w:m'
                },
                content: [{ tag: 'media_conn', attrs: {} }]
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
                fileEncSha256.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
            )

            let lastError

            for (const host of hosts) {
                try {
                    const json = await new Promise((resolve, reject) => {
                        const url = new URL(
                            `https://${host}${mediaPath}/${token}?auth=${encodeURIComponent(auth)}&token=${token}`
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
                                    'Content-Length': encBuffer.length
                                }
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
                            }
                        )
                        req.on('error', reject)
                        req.write(encBuffer)
                        req.end()
                    })

                    const directPath = json.direct_path ?? json.directPath ?? json.url ?? json.path
                    if (!directPath) throw new Error('directPath tidak ditemukan')

                    return { mediaKey, fileLength: buffer.length, fileSha256, fileEncSha256, directPath, ...json }
                } catch (e) {
                    lastError = e
                }
            }

            throw lastError ?? new Error('Semua host upload gagal')
        }

        const pack = stickers.map(s => {
            if (Buffer.isBuffer(s)) {
                return { buffer: s, isAnimated: isAnimatedWebP(s), emojis: undefined }
            }
            const buffer = s.buffer || s.sticker
            return {
                buffer,
                isAnimated: s.isAnimated ?? isAnimatedWebP(buffer),
                emojis: s.emojis
            }
        })

        const zip = new JSZip()
        const stickersMetadata = []

        for (const item of pack) {
            const fileName = `${rawToB64Url(rawSha256(item.buffer))}.webp`
            zip.file(fileName, item.buffer)
            stickersMetadata.push({
                fileName,
                isAnimated: !!item.isAnimated,
                emojis: item.emojis || ['✨'],
                accessibilityLabel: '',
                isLottie: false,
                mimetype: 'image/webp'
            })
        }

        const trayIconFileName = 'tray_icon.webp'
        const trayBuffer = await rawMakeTrayWebp(pack[0].buffer)
        zip.file(trayIconFileName, trayBuffer)

        const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })

        const packUpload = await rawUploadToServer(archive, {
            hkdf: 'WhatsApp Sticker Pack Keys',
            mediaPath: '/mms/sticker-pack'
        })

        const thumbnailBuffer = await rawMakeThumbnailJpeg(trayBuffer)

        const thumbUpload = await rawUploadToServer(thumbnailBuffer, {
            hkdf: 'WhatsApp Sticker Pack Thumbnail Keys',
            mediaPath: '/mms/thumbnail-sticker-pack',
            mediaKey: packUpload.mediaKey
        })

        const packname = options.name || options.packname || 'Sticker Pack'
        const publisher = options.publisher || options.author || 'Ourin-AI'
        const packDescription = options.description || ''

        return sock.relayMessage(
            jid,
            {
                messageContextInfo: {
                    messageSecret: crypto.randomBytes(32)
                },
                stickerPackMessage: {
                    stickerPackId: options.id || 'Pack_' + crypto.randomBytes(8).toString('hex'),
                    name: packname,
                    publisher,
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
                    imageDataHash: thumbUpload.fileSha256.toString('base64')
                }
            },
            {
                messageId: crypto.randomBytes(8).toString('hex').toUpperCase(),
                ...(m ? { quoted: m } : {})
            }
        )
    };
 
    if (!global.stickerPackCache) {
        global.stickerPackCache = new Map();
    }
    
    sock.saveStickerPack = (packId, messageContent, packName = 'Unknown') => {
        global.stickerPackCache.set(packId, {
            message: messageContent,
            name: packName,
            savedAt: Date.now()
        });
        console.log(`[StickerPack] Saved pack "${packName}" (${packId})`);
    };
    
    sock.getSavedPacks = () => {
        const packs = [];
        for (const [id, data] of global.stickerPackCache.entries()) {
            packs.push({ id, name: data.name, savedAt: data.savedAt });
        }
        return packs;
    };
    
    // sock.forwardStickerPack
    // await sock.forwardStickerPack(m.chat, packIdString, m)
    // await sock.forwardStickerPack(m.chat, cachedPackMessage, m)
    sock.forwardStickerPack = async (jid, packIdOrMessage, m) => {
        const { generateWAMessageFromContent } = require('hsnai');
        const crypto = require('crypto');
        
        let messageContent;
        
        if (typeof packIdOrMessage === 'string') {
            const cached = global.stickerPackCache.get(packIdOrMessage);
            if (!cached) {
                throw new Error(`Sticker pack "${packIdOrMessage}" not found in cache`);
            }
            messageContent = cached.message;
        } else if (packIdOrMessage?.stickerPackMessage) {
            messageContent = packIdOrMessage;
        } else {
            throw new Error('Invalid sticker pack message format');
        }
        
        const message = generateWAMessageFromContent(jid, messageContent, {
            quoted: m,
            userJid: sock.user?.id,
            messageId: crypto.randomBytes(8).toString('hex').toUpperCase()
        });
        
        await sock.relayMessage(jid, message.message, { messageId: message.key.id });
        
        console.log(`[StickerPack] Forwarded pack to ${jid}`);
        
        return message;
    };
    
    // sock.sendDocumentRaw
// Upload manual bypass timeoutMs bawaan hsnai (sock.sendMessage({document}) sering
// gagal "Media upload failed on all hosts" buat file besar karena tiap host cuma
// dikasih timeout singkat — kalau bandwidth ke WA lambat, semua host abis waktu
// sebelum transfer selesai. Ini upload manual tanpa batas waktu ketat.
// await sock.sendDocumentRaw(m.chat, buffer, { fileName: 'x.zip', mimetype: 'application/zip', caption: '...' }, m)
sock.sendDocumentRaw = async (jid, buffer, options = {}, m) => {
    const crypto = require('crypto')
    const https = require('https')

    const mediaKey = crypto.randomBytes(32)
    const expanded = Buffer.from(
        crypto.hkdfSync('sha256', mediaKey, Buffer.alloc(32), Buffer.from('WhatsApp Document Keys'), 112)
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
    const fileSha256 = crypto.createHash('sha256').update(buffer).digest()
    const fileEncSha256 = crypto.createHash('sha256').update(encBuffer).digest()

    const iq = await sock.query({
        tag: 'iq',
        attrs: {
            id: sock.generateMessageTag?.() ?? Date.now().toString(),
            to: 's.whatsapp.net',
            type: 'set',
            xmlns: 'w:m'
        },
        content: [{ tag: 'media_conn', attrs: {} }]
    })

    const mediaConn = iq.content?.find(v => v.tag === 'media_conn')
    if (!mediaConn) throw new Error('media_conn tidak ditemukan')

    const auth = mediaConn.attrs?.auth
    const hosts = (mediaConn.content || [])
        .filter(v => v.tag === 'host')
        .map(v => v.attrs?.hostname)
        .filter(Boolean)

    if (!hosts.length) throw new Error('host upload tidak ditemukan')

    const token = encodeURIComponent(
        fileEncSha256.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
    )

    let lastError, uploadResult

    for (const host of hosts) {
        try {
            console.log(`[SendDocRaw] Uploading ke ${host} (${(encBuffer.length / 1024 / 1024).toFixed(2)} MB, tanpa timeout ketat)...`)
            const t0 = Date.now()

            uploadResult = await new Promise((resolve, reject) => {
                const url = new URL(
                    `https://${host}/mms/document/${token}?auth=${encodeURIComponent(auth)}&token=${token}`
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
                            'Content-Length': encBuffer.length
                        }
                        // sengaja TANPA opsi timeout — biar gak keputus di tengah upload lambat
                    },
                    (res) => {
                        let body = ''
                        res.on('data', c => body += c)
                        res.on('end', () => {
                            console.log(`[SendDocRaw] ${host} selesai dalam ${Date.now() - t0}ms, status ${res.statusCode}`)
                            if (res.statusCode < 200 || res.statusCode >= 300) {
                                return reject(new Error(`Upload gagal ${res.statusCode}: ${body}`))
                            }
                            try { resolve(JSON.parse(body)) }
                            catch { reject(new Error(`Response bukan JSON: ${body}`)) }
                        })
                    }
                )
                req.on('error', reject)
                req.write(encBuffer)
                req.end()
            })

            const directPath = uploadResult.direct_path ?? uploadResult.directPath
            if (directPath) break
            uploadResult = null
        } catch (e) {
            lastError = e
            console.log(`[SendDocRaw] ${host} gagal: ${e.message}`)
        }
    }

    if (!uploadResult) throw lastError ?? new Error('Upload gagal di semua host')

    const directPath = uploadResult.direct_path ?? uploadResult.directPath

    const content = {
        documentMessage: {
            url: `https://${hosts[0]}${directPath}`,
            mimetype: options.mimetype || 'application/octet-stream',
            fileSha256,
            fileEncSha256,
            mediaKey,
            fileName: options.fileName || 'file',
            fileLength: buffer.length,
            mediaKeyTimestamp: Math.floor(Date.now() / 1000),
            directPath,
            caption: options.caption || '',
            contextInfo: options.contextInfo || {}
        }
    }

    return sock.relayMessage(jid, content, {
        messageId: crypto.randomBytes(8).toString('hex').toUpperCase(),
        ...(m ? { quoted: m } : {})
    })
}
    
    // sock.sendFile
    // await sock.sendFile(m.chat, buffer, { filename: 'file.pdf', caption: 'ini file' })
    // await sock.sendFile(m.chat, 'https://...', { quoted: msg })
    sock.sendFile = async (jid, input, options = {}) => {
        let buffer;
        let filename = options.filename || 'file';
        let mimetype = options.mimetype;
        
        if (Buffer.isBuffer(input)) {
            buffer = input;
        } else if (typeof input === 'string') {
            if (input.startsWith('http')) {
                buffer = await downloadBuffer(input);
                filename = options.filename || path.basename(new URL(input).pathname) || 'file';
            } else if (fs.existsSync(input)) {
                buffer = fs.readFileSync(input);
                filename = options.filename || path.basename(input);
            } else {
                throw new Error('Invalid input');
            }
        } else {
            throw new Error('Invalid input type');
        }
        if (!mimetype) {
            const ext = path.extname(filename).toLowerCase();
            const mimeTypes = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.mp4': 'video/mp4',
                '.mp3': 'audio/mpeg',
                '.ogg': 'audio/ogg',
                '.pdf': 'application/pdf',
                '.zip': 'application/zip'
            };
            mimetype = mimeTypes[ext] || 'application/octet-stream';
        }
        
        let messageContent = {};
        
        if (mimetype.startsWith('image/')) {
            messageContent.image = buffer;
            if (options.caption) messageContent.caption = options.caption;
        } else if (mimetype.startsWith('video/')) {
            messageContent.video = buffer;
            messageContent.mimetype = mimetype;
            if (options.caption) messageContent.caption = options.caption;
        } else if (mimetype.startsWith('audio/')) {
            messageContent.audio = buffer;
            messageContent.mimetype = mimetype;
            messageContent.ptt = options.ptt || false;
        } else {
            messageContent.document = buffer;
            messageContent.mimetype = mimetype;
            messageContent.fileName = filename;
            if (options.caption) messageContent.caption = options.caption;
        }
        
        return sock.sendMessage(jid, messageContent, {
            quoted: options.quoted
        });
    };

    // sock.sendMedia
    // await sock.sendMedia(m.chat, buffer, 'caption', msg, { type: 'image' })
    // await sock.sendMedia(m.chat, 'https://...', 'caption', msg, { type: 'video' })
    // await sock.sendMedia(m.chat, './path/file.mp3', '', msg, { type: 'audio', ptt: true })
    sock.sendMedia = async function (jid, source, caption = '', quoted, options = {}) {
        function isUrlObject(value) {
            return (
                value &&
                typeof value === 'object' &&
                !Buffer.isBuffer(value) &&
                typeof value.url === 'string'
            )
        }
        if (
      source &&
      typeof source === 'object' &&
        (source.image || source.video || source.audio || source.document)
        ) {
        return this.sendMessage(jid, source, options)
        }

        let data = source
        let mimeType = options.mimetype || 'application/octet-stream'
        let fileName = options.fileName || 'file'

        if (Buffer.isBuffer(source)) {
        } else if (typeof source === 'string' && /^https?:\/\//.test(source)) {
        data = { url: source }
        } else if (typeof source === 'string' && fs.existsSync(source)) {
        mimeType = mime.lookup(source) || 'application/octet-stream'
        fileName = path.basename(source)
        data = fs.readFileSync(source)
        } else if (isUrlObject(source)) {
        data = { url: source.url }
        } else {
        throw new Error(
            'Source harus berupa Buffer, URL string, path file, object { url }, atau payload media'
        )
        }

        const mediaType = options.type || options.mediaType
        const captionField = caption != null ? { caption } : {}

        let payload = {}

        if (mediaType === 'image') {
        payload = {
            image: data,
            ...captionField,
            ...options
        }
        } else if (mediaType === 'video') {
        payload = {
            video: data,
            ...captionField,
            ...options
        }
        } else if (mediaType === 'audio') {
        const audioMime = (mimeType && mimeType !== 'application/octet-stream') ? mimeType : 'audio/mpeg'
        payload = {
            audio: data,
            mimetype: audioMime,
            ptt: options.ptt || false,
            ...options
        }
        } else {
        payload = {
            document: data,
            mimetype: mimeType ? mimeType : 'application/octet-stream' ,
            fileName,
            ...captionField,
            ...options
        }
        }

        delete payload.type
        delete payload.mediaType

        return sock.sendMessage(jid, payload, { quoted })
    }

    // sock.sendButton
    // await sock.sendButton(m.chat, imageBuffer, 'teks', msg, { buttons: [...], footer: 'footer' })
    sock.sendButton = async function (jid, source, text = null, quoted, options = {}) {
        const msg = {}
        if (options.header) msg.header = options.header
        if (options.contextInfo) msg.contextInfo = options.contextInfo
        if (text !== null) msg.caption = text
        if (options.footer) msg.footer = options.footer
        if (options.buttons) msg.interactiveButtons = options.buttons
        if(!options.footer) msg.footer = config.bot?.name || 'Ourin-AI'
        if (source) {
            let data = source
            const mediaType = options.type || options.mediaType || 'image'

            if (Buffer.isBuffer(source)) {
            } else if (typeof source === 'string' && /^https?:\/\//.test(source)) {
                data = { url: source }
            } else if (typeof source === 'string' && fs.existsSync(source)) {
                data = fs.readFileSync(source)
            } else if (source === null) data = null

            if (mediaType === 'image' && data) {
                msg.image = data
            } else if (mediaType === 'video' && data) {
                msg.video = data
                msg.mimetype = options.mimetype || 'video/mp4'
                if (options.gifPlayback) msg.gifPlayback = false
            } else if (mediaType === 'audio' && data) {
                msg.audio = data
                msg.mimetype = options.mimetype || 'audio/mpeg'
                if (options.ptt) msg.ptt = false
            } else if (mediaType === 'document' && data) {
                msg.document = data
                msg.mimetype = options.mimetype || 'application/octet-stream'
                if (options.fileName) msg.fileName = options.fileName
            }
        }
        console.log(msg)
        return sock.sendMessage(jid, msg, { quoted })
    }
    
    // sock.sendCodehsn
    // await sock.sendCodehsn(m.chat, 'console.log("hi")', 'javascript', msg)
    // await sock.sendCodehsn(m.chat, code, 'python', msg, { header: 'Judul', footer: 'Footer' })
    sock.sendCodehsn = async function (jid, code, language = 'javascript', quoted, options = {}) {
        const { prepareRichResponseMessage, generateWAMessageFromContent, tokenizeCode } = await import('@itsliaaa/baileys');

        const blocks = [];

        if (options.header) {
            blocks.push({ text: options.header });
        }

        blocks.push({
            code: tokenizeCode(code, language),
            language
        });

        if (options.footer) {
            blocks.push({ text: options.footer });
        }

        const richMessage = prepareRichResponseMessage({ richResponse: blocks });
        const msg = generateWAMessageFromContent(jid, richMessage, { quoted });
        await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
        return msg;
    }

    // sock.sendTablehsn
    // await sock.sendTablehsn(m.chat, 'Judul Tabel', [['Col1','Col2'],['val1','val2']], msg)
    sock.sendTablehsn = async function (jid, title = '', rows = [], quoted, options = {}) {
        const { prepareRichResponseMessage, generateWAMessageFromContent } = await import('@itsliaaa/baileys');

        const blocks = [];

        if (options.header) {
            blocks.push({ text: options.header });
        }

        blocks.push({
            table: rows.map((row, index) => ({
                isHeading: index === 0,
                items: row.map(v => String(v))
            })),
            title
        });

        if (options.footer) {
            blocks.push({ text: options.footer });
        }

        const richMessage = prepareRichResponseMessage({ richResponse: blocks });
        const msg = generateWAMessageFromContent(jid, richMessage, { quoted });
        await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
        return msg;
    }

    // sock.sendTablehsn2
    // await sock.sendTablehsn2(m.chat, 'Judul', ['Header1','Header2'], [['A','B'],['C','D']], msg)
    // await sock.sendTablehsn2(m.chat, 'Judul', ['No','Nama'], rows, msg, { headerText: 'Info:', footer: 'Footer' })
    sock.sendTablehsn2 = async function (jid, title = '', header = [], rows = [], quoted, options = {}) {
        const { generateMessageIDV2 } = require('hsnai')
        const { footer, headerText } = options

        const tableRows = [
            { items: header, isHeading: true },
            ...rows.map(row => ({ items: row.map(String) }))
        ]

        const submessages = []
        if (headerText) submessages.push({ messageType: 2, messageText: headerText })
        submessages.push({ messageType: 4, tableMetadata: { title, rows: tableRows } })
        if (footer) submessages.push({ messageType: 2, messageText: footer })

        const ctxInfo = {
            forwardingScore: 1,
            isForwarded: true,
            forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
            forwardOrigin: 4
        }
        if (quoted?.key) {
            ctxInfo.stanzaId = quoted.key.id
            ctxInfo.participant = quoted.key.participant || quoted.sender || quoted.key.remoteJid
            ctxInfo.quotedMessage = quoted.message
        }

        const content = {
            botForwardedMessage: {
                message: {
                    richResponseMessage: {
                        messageType: 1,
                        submessages,
                        contextInfo: ctxInfo
                    }
                }
            }
        }

        const msgId = generateMessageIDV2()
        await sock.relayMessage(jid, content, { messageId: msgId })
        return { message: content, messageId: msgId }
    }

    // sock.sendListhsn
    // await sock.sendListhsn(m.chat, 'Judul List', ['item1','item2','item3'], msg)
    sock.sendListhsn = async function (jid, title = '', items = [], quoted, options = {}) {
        const { generateMessageIDV2 } = require('hsnai')
        const { footer, headerText } = options
        const tableRows = items.map(item => ({ items: Array.isArray(item) ? item.map(String) : [String(item)] }))
        const submessages = []
        if (headerText) submessages.push({ messageType: 2, messageText: headerText })
        submessages.push({ messageType: 4, tableMetadata: { title, rows: tableRows } })
        if (footer) submessages.push({ messageType: 2, messageText: footer })
        const ctxInfo = { forwardingScore: 1, isForwarded: true, forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' }, forwardOrigin: 4 }
        if (quoted?.key) { ctxInfo.stanzaId = quoted.key.id; ctxInfo.participant = quoted.key.participant || quoted.sender || quoted.key.remoteJid; ctxInfo.quotedMessage = quoted.message }
        const content2 = { botForwardedMessage: { message: { richResponseMessage: { messageType: 1, submessages, contextInfo: ctxInfo } } } }
        const msgId2 = generateMessageIDV2()
        await sock.relayMessage(jid, content2, { messageId: msgId2 })
        return { message: content2, messageId: msgId2 }
    }

    // sock.sendCodeBlockhsn2
    // await sock.sendCodeBlockhsn2(m.chat, 'const x = 1', msg)
    // await sock.sendCodeBlockhsn2(m.chat, code, msg, { language: 'python', text: 'Header', footer: 'Footer' })
    sock.sendCodeBlockhsn2 = async function (jid, code, quoted, options = {}) {
        const { randomBytes, randomUUID } = require('crypto')
        const { generateMessageIDV2 } = require('hsnai')
        const { footer, language = 'javascript', text } = options
        const kwMap = {
            javascript: new Set(['break','case','catch','const','continue','delete','do','else','export','finally','for','function','if','import','in','instanceof','let','new','return','switch','this','throw','try','typeof','var','void','while','class','extends','super','yield','static','async','await','get','set','true','false','null','undefined']),
            python: new Set(['import','from','as','def','class','return','if','elif','else','for','while','break','continue','try','except','finally','raise','with','yield','lambda','pass','del','global','nonlocal','assert','True','False','None','and','or','not','in','is','async','await','self','print'])
        }
        const keywords = kwMap[language] || kwMap.javascript
        const HIGHLIGHT_TYPE_MAP = { 0: 'DEFAULT', 1: 'KEYWORD', 2: 'METHOD', 3: 'STR', 4: 'NUMBER', 5: 'COMMENT' }
        const tokens = []
        let i = 0
        const n = code.length
        const push = (ch, t) => {
            if (!ch) return
            const last = tokens[tokens.length - 1]
            if (last && last.highlightType === t) last.codeContent += ch
            else tokens.push({ codeContent: ch, highlightType: t })
        }
        while (i < n) {
            const ch = code[i]
            if (/\s/.test(ch)) {
                let s = i
                while (i < n && /\s/.test(code[i])) i++
                push(code.slice(s, i), 0)
                continue
            }
            if (ch === '/' && code[i + 1] === '/') {
                let s = i
                i += 2
                while (i < n && code[i] !== '\n') i++
                push(code.slice(s, i), 5)
                continue
            }
            if (ch === '"' || ch === "'" || ch === '`') {
                let s = i, q = ch
                i++
                while (i < n) {
                    if (code[i] === '\\' && i + 1 < n) i += 2
                    else if (code[i] === q) { i++; break }
                    else i++
                }
                push(code.slice(s, i), 3)
                continue
            }
            if (/[0-9]/.test(ch)) {
                let s = i
                while (i < n && /[0-9.]/.test(code[i])) i++
                push(code.slice(s, i), 4)
                continue
            }
            if (/[a-zA-Z_$]/.test(ch)) {
                let s = i
                while (i < n && /[a-zA-Z0-9_$]/.test(code[i])) i++
                const word = code.slice(s, i)
                let j = i
                while (j < n && /\s/.test(code[j])) j++
                push(word, keywords.has(word) ? 1 : code[j] === '(' ? 2 : 0)
                continue
            }
            push(ch, 0)
            i++
        }
        const unified_codeBlock = tokens.map(t => ({ content: t.codeContent, type: HIGHLIGHT_TYPE_MAP[t.highlightType] || 'DEFAULT' }))
        const sections = []
        if (text) sections.push({ view_model: { primitive: { text, __typename: 'GenAIMarkdownTextUXPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } })
        sections.push({ view_model: { primitive: { language, code_blocks: unified_codeBlock, __typename: 'GenAICodeUXPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } })
        if (footer) sections.push({ view_model: { primitive: { text: footer, __typename: 'GenAIMarkdownTextUXPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } })
        const base64Data = Buffer.from(JSON.stringify({ response_id: randomUUID(), sections })).toString('base64')
        const ctxInfo = {
            mentionedJid: [], groupMentions: [], statusAttributions: [],
            forwardingScore: 2, isForwarded: true,
            forwardedAiBotMessageInfo: { botJid: '259786046210223@bot' },
            forwardOrigin: 4, botMessageSharingInfo: { botEntryPointOrigin: 1, forwardScore: 2 }
        }
        if (quoted && quoted.key) {
            ctxInfo.stanzaId = quoted.key.id
            ctxInfo.participant = quoted.key.participant || quoted.sender || quoted.key.remoteJid
            ctxInfo.quotedMessage = quoted.message
        }
        const content2 = {
            messageContextInfo: { threadId: [], deviceListMetadata: { senderKeyIndexes: [], recipientKeyIndexes: [], recipientKeyHash: '', recipientTimestamp: Math.floor(Date.now() / 1000) }, deviceListMetadataVersion: 2, messageSecret: randomBytes(32) },
            botForwardedMessage: { message: { richResponseMessage: { submessages: [], messageType: 1, unifiedResponse: { data: base64Data }, contextInfo: ctxInfo } } }
        }
        const msgId2 = generateMessageIDV2()
        await sock.relayMessage(jid, content2, { messageId: msgId2 })
        return { message: content2, messageId: msgId2 }
    }

    // sock.sendLinkhsn
    // await sock.sendLinkhsn(m.chat, 'Teks dengan link', [{ url: 'https://...', displayName: 'Nama Link' }], msg)
    sock.sendLinkhsn = async function (jid, text, links = [], quoted, options = {}) {
        const { randomBytes, randomUUID } = require('crypto')
        const { generateMessageIDV2 } = require('hsnai')
        const { footer, botJid = '867051314767696@bot', forwardingScore = 3 } = options
        const submessages = [{ messageType: 2, messageText: footer ? `${text}${footer}` : text }]
        const inlineEntities = links.map((link, i) => { const url = typeof link === 'string' ? link : link.url; const displayName = typeof link === 'object' && link.displayName ? link.displayName : `Link ${i + 1}`; return { key: `IE_${i}`, metadata: { display_name: displayName, is_trusted: false, url, __typename: 'GenAIInlineLinkItem' } } })
        const sections = [{ view_model: { primitive: { text, inline_entities: inlineEntities, __typename: 'GenAIMarkdownTextUXPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } }]
        if (footer) sections.push({ view_model: { primitive: { text: footer, __typename: 'GenAIMarkdownTextUXPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } })
        const base64Data = Buffer.from(JSON.stringify({ response_id: randomUUID(), sections })).toString('base64')
        const ctxInfo = { forwardingScore, isForwarded: true, forwardedAiBotMessageInfo: { botJid }, forwardOrigin: 4, botMessageSharingInfo: { forwardScore: forwardingScore } }
        if (quoted?.key) { ctxInfo.stanzaId = quoted.key.id; ctxInfo.participant = quoted.key.participant || quoted.sender || quoted.key.remoteJid; ctxInfo.quotedMessage = quoted.message }
        const content2 = { messageContextInfo: { messageSecret: randomBytes(32) }, botForwardedMessage: { message: { richResponseMessage: { messageType: 1, submessages, unifiedResponse: { data: base64Data }, contextInfo: ctxInfo } } } }
        const msgId2 = generateMessageIDV2()
        await sock.relayMessage(jid, content2, { messageId: msgId2 })
        return { message: content2, messageId: msgId2 }
    }

    // sock.sendLinkhsn2
    // await sock.sendLinkhsn2(m.chat, 'Teks', [{ url: 'https://...', displayName: 'Judul', sourceDisplayName: 'Source', sourceSubtitle: 'sub' }], msg)
    sock.sendLinkhsn2 = async function (jid, text, links = [], quoted, options = {}) {
        const { randomBytes, randomUUID } = require('crypto')
        const { generateMessageIDV2 } = require('hsnai')
        const { footer, searchEngine = 'MAME' } = options
        const submessages = [{ messageType: 2, messageText: footer ? `${text}${footer}` : text }]
        const inlineEntities = links.map((link, i) => { const url = typeof link === 'string' ? link : link.url; const displayName = typeof link === 'object' && link.displayName ? link.displayName : `Link ${i + 1}`; const sourceDisplayName = typeof link === 'object' && link.sourceDisplayName ? link.sourceDisplayName : `Source ${i + 1}`; const sourceSubtitle = typeof link === 'object' && link.sourceSubtitle ? link.sourceSubtitle : ''; return { key: `IE_${i}`, metadata: { reference_id: i + 1, reference_url: url, reference_title: displayName, reference_display_name: displayName, sources: [{ source_type: 'THIRD_PARTY', source_display_name: sourceDisplayName, source_subtitle: sourceSubtitle, source_url: url }], __typename: 'GenAISearchCitationItem' } } })
        const searchSources = links.map((link, i) => { const url = typeof link === 'string' ? link : link.url; const sourceDisplayName = typeof link === 'object' && link.sourceDisplayName ? link.sourceDisplayName : `Source ${i + 1}`; const sourceSubtitle = typeof link === 'object' && link.sourceSubtitle ? link.sourceSubtitle : ''; return { source_type: 'THIRD_PARTY', source_display_name: sourceDisplayName, source_subtitle: sourceSubtitle, source_url: url } })
        const sections = [{ view_model: { primitive: { text, inline_entities: inlineEntities, __typename: 'GenAIMarkdownTextUXPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } }, { view_model: { primitive: { sources: searchSources, search_engine: searchEngine, __typename: 'GenAISearchResultPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } }]
        if (footer) sections.push({ view_model: { primitive: { text: footer, __typename: 'GenAIMarkdownTextUXPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } })
        const base64Data = Buffer.from(JSON.stringify({ response_id: randomUUID(), sections })).toString('base64')
        const ctxInfo = { isForwarded: true, forwardOrigin: 4 }
        if (quoted?.key) { ctxInfo.participant = quoted.key.participant || quoted.sender || quoted.key.remoteJid; ctxInfo.quotedMessage = quoted.message }
        const content2 = { messageContextInfo: { threadId: [], messageSecret: randomBytes(32) }, botForwardedMessage: { message: { richResponseMessage: { messageType: 1, submessages, unifiedResponse: { data: base64Data }, contextInfo: ctxInfo } } } }
        const msgId2 = generateMessageIDV2()
        await sock.relayMessage(jid, content2, { messageId: msgId2 })
        return { message: content2, messageId: msgId2 }
    }

    const _originalProfilePictureUrl = sock.profilePictureUrl.bind(sock)

    sock.profilePictureUrl = async function (jid) {
        return await getProfilePicture({ profilePictureUrl: _originalProfilePictureUrl }, jid)
    }

    sock.profileBuffer = async function (jid) {
        return await getProfileBuffer({ profilePictureUrl: _originalProfilePictureUrl }, jid)
    }

    // sock.sendText
    // await sock.sendText(m.chat, 'teks biasa', msg)
    sock.sendText = async function (jid, text, quoted, options = {}) {
        return await sock.sendMessage(jid, { text, ...options }, { quoted })
    }
    // sock.sendContact
    // await sock.sendContact(m.chat, { name: 'Nama', number: '628xxx' }, { quoted: msg })
    // await sock.sendContact(m.chat, [{ name: 'A', number: '628xxx' }, { name: 'B', number: '629xxx' }])
    sock.sendContact = async (jid, contacts, options = {}) => {
        const contactArray = Array.isArray(contacts) ? contacts : [contacts];
        
        const vcards = contactArray.map(contact => {
            const name = contact.name || 'Unknown';
            const number = contact.number?.replace(/[^0-9]/g, '') || '';
            const org = contact.org || '';
            
            let vcard = `BEGIN:VCARD\nVERSION:3.0\n`;
            vcard += `FN:${name}\n`;
            if (org) vcard += `ORG:${org}\n`;
            vcard += `TEL;type=CELL;type=VOICE;waid=${number}:+${number}\n`;
            vcard += `END:VCARD`;
            
            return { vcard };
        });
        
        const displayName = contactArray.length === 1 
            ? contactArray[0].name || 'Contact'
            : `${contactArray.length} Contacts`;
        
        return sock.sendMessage(jid, {
            contacts: {
                displayName,
                contacts: vcards
            }
        }, {
            quoted: options.quoted
        });
    };
    
    // sock.downloadAndSaveMediaMessage
    // const { buffer, path, type } = await sock.downloadAndSaveMediaMessage(msg)
    // const { buffer } = await sock.downloadAndSaveMediaMessage(msg, './storage/temp/file.jpg')
    sock.downloadAndSaveMediaMessage = async (msg, savePath = null) => {
        const message = msg.message || msg;
        const type = getContentType(message);
        
        if (!type) {
            throw new Error('No media found in message');
        }
        
        const buffer = await downloadMediaMessage(
            { message },
            'buffer',
            {},
            {
                logger: console,
                reuploadRequest: sock.updateMediaMessage
            }
        );
        
        let savedPath = null;
        
        if (savePath) {
            const dir = path.dirname(savePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(savePath, buffer);
            savedPath = savePath;
        }
        
        return {
            buffer,
            path: savedPath,
            type
        };
    };
    
    // sock.getName
    // const nama = await sock.getName('628xxx@s.whatsapp.net')
    // const nama = await sock.getName(m.sender, m.chat)
    sock.getName = async (jid, groupJid = null) => {
        if (!jid) return 'Unknown';
        
        const { isLid, isLidConverted, resolveAnyLidToJid, getCachedJid } = require('./lidHelper');
        
        let id = jid;
        if (isLid(jid) || isLidConverted(jid)) {
            const cached = getCachedJid(jid);
            if (cached) {
                id = cached;
            } else if (groupJid) {
                try {
                    const groupMeta = await sock.groupMetadata(groupJid);
                    id = resolveAnyLidToJid(jid, groupMeta.participants || []);
                } catch {
                    id = jid.replace('@lid', '@s.whatsapp.net');
                }
            } else {
                id = jid.replace('@lid', '@s.whatsapp.net');
            }
        }
        
        if (id.endsWith('@g.us')) {
            try {
                let v = sock.store?.contacts?.[id] || {};
                if (!(v.name || v.subject)) {
                    v = await sock.groupMetadata(id).catch(() => ({}));
                }
                return v.name || v.subject || id.split('@')[0];
            } catch {
                return id.split('@')[0];
            }
        }
        
        if (id === '0@s.whatsapp.net') {
            return 'WhatsApp';
        }
        
        const botId = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
        if (id === botId) {
            return sock.user?.name || sock.user?.verifiedName || 'Bot';
        }
        
        let v = sock.store?.contacts?.[id] || {};
        
        if (v.name) return v.name;
        if (v.notify) return v.notify;
        if (v.pushName) return v.pushName;
        if (v.verifiedName) return v.verifiedName;
        if (v.subject) return v.subject;
        
        if (groupJid) {
            try {
                const groupMeta = await sock.groupMetadata(groupJid);
                const targetNum = id.replace(/[^0-9]/g, '');
                const participant = groupMeta.participants?.find(p => {
                    const pNum = (p.jid || p.id || '').replace(/[^0-9]/g, '');
                    return pNum === targetNum;
                });
                if (participant) {
                    const pJid = participant.jid || participant.id || '';
                    if (sock.store?.contacts?.[pJid]) {
                        const contact = sock.store.contacts[pJid];
                        if (contact.name) return contact.name;
                        if (contact.notify) return contact.notify;
                        if (contact.pushName) return contact.pushName;
                    }
                }
            } catch {}
        }
        
        try {
            if (sock.getBusinessProfile) {
                const profile = await sock.getBusinessProfile(id).catch(() => null);
                if (profile?.wid?.user) {
                    const profileName = profile.name || profile.pushname || profile.verifiedName;
                    if (profileName) {
                        if (sock.store?.contacts) {
                            sock.store.contacts[id] = { ...sock.store.contacts[id], name: profileName };
                        }
                        return profileName;
                    }
                }
            }
        } catch {}
        
        try {
            if (sock.onWhatsApp) {
                const [result] = await sock.onWhatsApp(id).catch(() => []);
                if (result?.exists && result?.jid) {
                    const contactJid = result.jid;
                    if (sock.store?.contacts?.[contactJid]) {
                        const contact = sock.store.contacts[contactJid];
                        if (contact.name) return contact.name;
                        if (contact.notify) return contact.notify;
                    }
                }
            }
        } catch {}
        
        const number = id.replace(/@.+/g, '');
        if (number && number.length > 0) {
            if (number.startsWith('62')) {
                return '+62' + number.slice(2);
            }
            return '+' + number;
        }
        
        return 'Unknown';
    };

    
    // sock.getNameFromParticipants
    // const nama = sock.getNameFromParticipants(m.sender, m.groupMembers)
    sock.getNameFromParticipants = (jid, participants = []) => {
        if (!jid) return 'Unknown';
        const { isLid, isLidConverted, resolveAnyLidToJid } = require('./lidHelper');
        let resolvedJid = jid;
        if (isLid(jid) || isLidConverted(jid)) {
            resolvedJid = resolveAnyLidToJid(jid, participants);
        }
        const targetNum = resolvedJid.replace(/[^0-9]/g, '');
        const participant = participants.find(p => {
            const pNum = (p.jid || p.id || '').replace(/[^0-9]/g, '');
            return pNum === targetNum;
        });
        if (participant) {
            const pJid = participant.jid || participant.id || '';
            if (sock.store?.contacts?.[pJid]) {
                const contact = sock.store.contacts[pJid];
                if (contact.name) return contact.name;
                if (contact.notify) return contact.notify;
            }
        }
        const number = resolvedJid.replace(/@.+/g, '');
        if (number.startsWith('62')) return '0' + number.slice(2);
        return number || 'Unknown';
    };

    // sock.parseMention
    // const mentions = sock.parseMention('@628xxx halo')
    sock.parseMention = (text = '') => {
        return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net');
    };

    // sock.reply
    // await sock.reply(m.chat, 'teks', msg)
    sock.reply = (jid, text = '', quoted, options = {}) => {
        return Buffer.isBuffer(text) 
            ? sock.sendMessage(jid, { document: text, ...options }, { quoted })
            : sock.sendMessage(jid, { ...options, text, mentions: sock.parseMention(text) }, { quoted, ...options, mentions: sock.parseMention(text) });
    };

    sock.cMod = async (jid, message, text = '', sender = sock.user?.id, options = {}) => {
        const { proto, areJidsSameUser } = require('hsnai');
        if (options.mentions && !Array.isArray(options.mentions)) options.mentions = [options.mentions];
        let copy = message.toJSON ? message.toJSON() : JSON.parse(JSON.stringify(message));
        delete copy.message?.messageContextInfo;
        delete copy.message?.senderKeyDistributionMessage;
        let mtype = Object.keys(copy.message || {})[0];
        let msg = copy.message;
        let content = msg?.[mtype];
        if (typeof content === 'string') msg[mtype] = text || content;
        else if (content?.caption) content.caption = text || content.caption;
        else if (content?.text) content.text = text || content.text;
        if (typeof content !== 'string' && content) {
            msg[mtype] = { ...content, ...options };
            msg[mtype].contextInfo = {
                ...(content.contextInfo || {}),
                mentionedJid: options.mentions || content.contextInfo?.mentionedJid || []
            };
        }
        if (copy.participant) sender = copy.participant = sender || copy.participant;
        else if (copy.key?.participant) sender = copy.key.participant = sender || copy.key.participant;
        if (copy.key?.remoteJid?.includes('@s.whatsapp.net')) sender = sender || copy.key.remoteJid;
        else if (copy.key?.remoteJid?.includes('@broadcast')) sender = sender || copy.key.remoteJid;
        copy.key.remoteJid = jid;
        copy.key.fromMe = areJidsSameUser(sender, sock.user?.id) || false;
        return proto.WebMessageInfo.create(copy);
    };

    sock.cMods = (jid, message, text = '', sender = sock.user?.id, options = {}) => {
        const { proto, areJidsSameUser } = require('hsnai');
        let copy = message.toJSON ? message.toJSON() : JSON.parse(JSON.stringify(message));
        let mtype = Object.keys(copy.message || {})[0];
        let isEphemeral = false;
        if (isEphemeral) {
            mtype = Object.keys(copy.message?.ephemeralMessage?.message || {})[0];
        }
        let msg = isEphemeral ? copy.message.ephemeralMessage.message : copy.message;
        let content = msg?.[mtype];
        if (typeof content === 'string') msg[mtype] = text || content;
        else if (content?.caption) content.caption = text || content.caption;
        else if (content?.text) content.text = text || content.text;
        if (typeof content !== 'string' && content) msg[mtype] = { ...content, ...options };
        if (copy.participant) sender = copy.participant = sender || copy.participant;
        else if (copy.key?.participant) sender = copy.key.participant = sender || copy.key.participant;
        if (copy.key?.remoteJid?.includes('@s.whatsapp.net')) sender = sender || copy.key.remoteJid;
        else if (copy.key?.remoteJid?.includes('@broadcast')) sender = sender || copy.key.remoteJid;
        copy.key.remoteJid = jid;
        copy.key.fromMe = areJidsSameUser(sender, sock.user?.id) || false;
        return proto.WebMessageInfo.create(copy);
    };

    // sock.copyNForward
    // await sock.copyNForward(m.chat, msg, true)
    sock.copyNForward = async (jid, message, forwardingScore = true, options = {}) => {
        const { generateForwardMessageContent, generateWAMessageFromContent } = require('hsnai');
        let m = generateForwardMessageContent(message, !!forwardingScore);
        let mtype = Object.keys(m)[0];
        if (forwardingScore && typeof forwardingScore === 'number' && forwardingScore > 1) {
            m[mtype].contextInfo = m[mtype].contextInfo || {};
            m[mtype].contextInfo.forwardingScore = (m[mtype].contextInfo.forwardingScore || 0) + forwardingScore;
        }
        if (options.quoted) {
            m[mtype].contextInfo = m[mtype].contextInfo || {};
            m[mtype].contextInfo.quotedMessage = options.quoted.message;
            m[mtype].contextInfo.stanzaId = options.quoted.key?.id;
            m[mtype].contextInfo.participant = options.quoted.key?.participant || options.quoted.key?.remoteJid;
            m[mtype].contextInfo.remoteJid = options.quoted.key?.remoteJid;
        }
        m = generateWAMessageFromContent(jid, m, { ...options, userJid: sock.user?.id });
        await sock.relayMessage(jid, m.message, { messageId: m.key.id, additionalAttributes: { ...options } });
        return m;
    };

    // sock.fakeReply
    // await sock.fakeReply(m.chat, 'teks', '628xxx@s.whatsapp.net', 'teks palsu')
    sock.fakeReply = async (jid, text = '', fakeJid = sock.user?.id, fakeText = '', fakeGroupJid, options = {}) => {
        const { areJidsSameUser } = require('hsnai');
        return sock.reply(jid, text, { 
            key: { 
                fromMe: areJidsSameUser(fakeJid, sock.user?.id), 
                participant: fakeJid, 
                ...(fakeGroupJid ? { remoteJid: fakeGroupJid } : {}) 
            }, 
            message: { conversation: fakeText }, 
            ...options 
        });
    };
    
    // sock.sendLinkPreview
    // await sock.sendLinkPreview(m.chat, 'teks pesan', { thumbnail: bufferGambar, quoted: msg })           // besar (default)
    // await sock.sendLinkPreview(m.chat, 'teks pesan', { thumbnail: bufferGambar, large: false, quoted: msg }) // kecil
    // await sock.sendLinkPreview(m.chat, 'teks', { title: 'Judul', description: 'Desc', thumbnail: buf, quoted: msg })
    sock.sendLinkPreview = async (jid, text, options = {}) => {
        const { generateWAMessageFromContent, prepareWAMessageMedia } = require('hsnai')
        const saluranLink = config.saluran?.link || config.info?.website || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
        const extContent = {
            text: `${saluranLink}\n\n${text}`,
            matchedText: saluranLink,
            previewType: 0,
            renderLargerThumbnail: options.large !== false,
            title: options.title || config.bot?.name || 'Hoshino Ai',
            description: options.description || `Pengembang: ${config.bot?.developer || 'Developer'} | Versi: ${config.bot?.version || '1.0.0'}`,
            contextInfo: {
                mentionedJid: options.mentions || [],
                isForwarded: true,
                forwardingScore: 9,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.saluran?.id || saluranLink,
                    newsletterName: config.saluran?.name || config.bot?.name || 'Hoshino Ai',
                    serverMessageId: Math.floor(Math.random() * 1000000)
                },
                ...options.contextInfo
            }
        }
        if (options.thumbnail) {
            try {
                const { imageMessage } = await prepareWAMessageMedia(
                    { image: options.thumbnail },
                    { upload: sock.waUploadToServer, mediaTypeOverride: 'thumbnail-link' }
                )
                if (imageMessage) {
                    extContent.jpegThumbnail = imageMessage.jpegThumbnail
                    if (imageMessage.directPath) extContent.thumbnailDirectPath = imageMessage.directPath
                    if (imageMessage.mediaKey) extContent.mediaKey = imageMessage.mediaKey
                    if (imageMessage.mediaKeyTimestamp) extContent.mediaKeyTimestamp = imageMessage.mediaKeyTimestamp
                    if (imageMessage.fileSha256) extContent.thumbnailSha256 = imageMessage.fileSha256
                    if (imageMessage.fileEncSha256) extContent.thumbnailEncSha256 = imageMessage.fileEncSha256
                    if (imageMessage.width) extContent.thumbnailWidth = imageMessage.width
                    if (imageMessage.height) extContent.thumbnailHeight = imageMessage.height
                }
            } catch {
                extContent.jpegThumbnail = options.thumbnail
            }
        }
        const msg = generateWAMessageFromContent(jid, {
            extendedTextMessage: extContent
        }, { quoted: options.quoted, userJid: sock.user?.jid || sock.user?.id })
        return sock.relayMessage(jid, msg.message, { messageId: msg.key.id })
    }
    
    // sock.sendBusinessCard
    // await sock.sendBusinessCard(m.chat, {
    //   title: 'Hoshino Ai',           // nama di card (default: config.bot.name)
    //   body: 'teks pesan',            // isi pesan
    //   footer: 'footer',              // footer (default: config.info.website)
    //   buttons: [{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Klik', id: 'id1' }) }],
    //   additionalNodes: [...],        // opsional
    //   quoted: msg
    // })
    sock.sendBusinessCard = async (jid, options = {}) => {
        const { generateMessageIDV2 } = require('hsnai')
        const crypto = require('crypto')

        const message = {
            senderKeyDistributionMessage: options.senderKeyDistributionMessage || undefined,
            messageContextInfo: {
                messageSecret: options.messageSecret || crypto.randomBytes(32),
                ...(options.threadId ? { threadId: options.threadId } : {})
            },
            interactiveMessage: {
                header: {
                    title: options.title || config.bot?.name || 'Hoshino Ai',
                    subtitle: options.subtitle || '',
                    hasMediaAttachment: false,
                    ...options.header
                },
                body: { text: options.body || '' },
                footer: { text: options.footer || config.info?.website || '' },
                nativeFlowMessage: {
                    buttons: options.buttons || [
                        {
                            name: 'inapp_signup',
                            buttonParamsJson: JSON.stringify({})
                        }
                    ],
                    messageParamsJson: options.messageParamsJson || '{}'
                },
                contextInfo: {
                    ...(options.quoted ? {
                        stanzaId: options.quoted.key?.id,
                        participant: options.quoted.key?.participant || options.quoted.key?.remoteJid,
                        quotedMessage: options.quoted.message
                    } : {}),
                    ...options.contextInfo
                }
            }
        }

        // hapus senderKeyDistributionMessage kalau undefined
        if (!message.senderKeyDistributionMessage) {
            delete message.senderKeyDistributionMessage
        }

        const msgId = generateMessageIDV2()

        return sock.relayMessage(jid, message, {
            messageId: msgId,
            additionalNodes: options.additionalNodes || [
                {
                    tag: 'biz',
                    attrs: {},
                    content: [
                        {
                            tag: 'interactive',
                            attrs: { type: 'native_flow', v: '1' },
                            content: [
                                {
                                    tag: 'native_flow',
                                    attrs: { v: '9', name: 'mixed' }
                                }
                            ]
                        }
                    ]
                }
            ]
        })
    }

    return sock;
}

module.exports = {
    extendSocket,
    downloadBuffer,
    imageToWebp,
    videoToWebp,
    simpleImageToWebp,
    getTempDir
};