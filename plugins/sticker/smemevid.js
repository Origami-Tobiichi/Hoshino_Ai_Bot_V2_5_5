const fs = require('fs')
const path = require('path')
const os = require('os')
const axios = require('axios')
const ffmpeg = require('fluent-ffmpeg')
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg')
const { createCanvas, loadImage } = require('@napi-rs/canvas')
const { config } = require('../../config')

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

const pluginConfig = {
    name: 'smemevid',
    alias: ['smemevideo', 'memevid'],
    category: 'sticker',
    description: 'Membuat sticker meme dari video',
    usage: '.smemevid <top>|<bottom>',
    example: '.smemevid WIDTH OR HEIGHT|WHY NOT BOTH?',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 1,
    isEnabled: true
}

// ─── EMOJI CACHE ──────────────────────────────────────────────────────────────

const EMOJI_CACHE = path.join(process.cwd(), 'tmp', 'emoji-cache')
if (!fs.existsSync(EMOJI_CACHE)) fs.mkdirSync(EMOJI_CACHE, { recursive: true })

function emojiToFilename(emoji) {
    return [...emoji]
        .map(char => char.codePointAt(0))
        .filter(codePoint => codePoint !== 0xfe0f)
        .map(codePoint => codePoint.toString(16))
        .join('-') + '.png'
}

async function getEmojiPath(emoji) {
    const fileName = emojiToFilename(emoji)
    const localPath = path.join(EMOJI_CACHE, fileName)

    if (fs.existsSync(localPath)) return localPath

    try {
        const response = await axios.get(
            `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${fileName}`,
            { responseType: 'arraybuffer', timeout: 5000 }
        )
        fs.writeFileSync(localPath, Buffer.from(response.data))
        return localPath
    } catch (_) {
        return null
    }
}

function toSegments(text) {
    const emojiRe = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu
    const parts = []
    let last = 0

    for (const match of text.matchAll(emojiRe)) {
        if (match.index > last) parts.push({ t: 'text', v: text.slice(last, match.index) })
        parts.push({ t: 'emoji', v: match[0] })
        last = match.index + match[0].length
    }

    if (last < text.length) parts.push({ t: 'text', v: text.slice(last) })

    return parts
}

function segWidth(ctx, seg, fontSize) {
    return seg.t === 'text' ? ctx.measureText(seg.v).width : fontSize * 1.15
}

// ─── MEME TEXT OVERLAY (dengan dukungan emoji) ────────────────────────────────

async function drawMemeText(ctx, text, y, width, isBottom) {
    if (!text || text === '_') return

    const segments = toSegments(text)

    // Preload semua emoji yang dipakai di segmen ini
    const emojiPathMap = {}
    await Promise.all(
        segments
            .filter(seg => seg.t === 'emoji')
            .map(async seg => {
                if (!(seg.v in emojiPathMap)) emojiPathMap[seg.v] = await getEmojiPath(seg.v)
            })
    )

    let fontSize = Math.floor(width / 8)
    ctx.font = `bold ${fontSize}px Impact, Arial`

    let totalWidth = segments.reduce((sum, seg) => sum + segWidth(ctx, seg, fontSize), 0)
    while (totalWidth > width - 20 && fontSize > 10) {
        fontSize -= 2
        ctx.font = `bold ${fontSize}px Impact, Arial`
        totalWidth = segments.reduce((sum, seg) => sum + segWidth(ctx, seg, fontSize), 0)
    }

    ctx.textAlign = 'left'
    ctx.textBaseline = isBottom ? 'bottom' : 'top'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.floor(fontSize / 6)

    let startX = (width - totalWidth) / 2

    for (const seg of segments) {
        if (seg.t === 'text') {
            ctx.fillStyle = 'white'
            ctx.strokeStyle = 'black'
            ctx.strokeText(seg.v, startX, y)
            ctx.fillText(seg.v, startX, y)
            startX += ctx.measureText(seg.v).width
        } else {
            const emojiPath = emojiPathMap[seg.v]
            if (emojiPath && fs.existsSync(emojiPath)) {
                try {
                    const image = await loadImage(emojiPath)
                    // baseline 'bottom' berarti y = tepi bawah, jadi gambar perlu digeser ke atas sejauh tinggi emoji
                    const drawY = isBottom ? y - fontSize : y
                    ctx.drawImage(image, startX, drawY, fontSize, fontSize)
                } catch (_) {}
            }
            startX += fontSize * 1.15
        }
    }
}

// ─── WATERMARK OVERLAY ────────────────────────────────────────────────────────

function buildWatermarkLayer(size, customLeft = null) {
    const FONT_SIZE = 11
    const PADDING   = 6

    const canvas = createCanvas(size, size)
    const ctx    = canvas.getContext('2d')

    ctx.font          = `bold ${FONT_SIZE}px sans-serif`
    ctx.textBaseline  = 'bottom'

    const leftText  = customLeft || 'SeaPRST || Died100'
    const rightText = 'Hoshino Ai Bot'
    const rightW    = ctx.measureText(rightText).width

    ctx.shadowColor   = 'rgba(0,0,0,0.9)'
    ctx.shadowBlur    = 4
    ctx.shadowOffsetX = 1
    ctx.shadowOffsetY = 1
    ctx.fillStyle     = 'rgba(255,255,255,0.55)'

    ctx.fillText(leftText,                          PADDING, size - PADDING)
    ctx.fillText(rightText, size - rightW - PADDING,         size - PADDING)

    return canvas.toBuffer('image/png')
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

async function handler(m, { sock }) {
    const isVideo = m.isVideo || (m.quoted && m.quoted.isVideo) || (m.quoted && m.quoted.type === 'videoMessage')
    if (!isVideo) {
        return m.reply(`🎬 *ʜᴏsʜɪɴᴏ ᴀɪ ᴍᴇᴍᴇ ᴠɪᴅ*\n\n"Eh? Videonya mana?"\n\n> Balas video dengan caption ya! 💖\n\`Contoh: ${m.prefix}smemevid Top|Bottom\``)
    }

    const raw = m.args.join(' ')
    if (!raw || !raw.includes('|')) {
        return m.reply(`🎬 *ʜᴏsʜɪɴᴏ ᴀɪ ᴍᴇᴍᴇ ᴠɪᴅ*\n\n"Teksnya diisi dulu dong, Sayang~" 🎤\n\n> Format: top|bottom\n\`Contoh: ${m.prefix}smemevid WIDTH OR HEIGHT|WHY NOT BOTH?\``)
    }

    // ── Secret code parser (silent) ──
    const SECRET_RE   = /--\(\)\(\)\+\+&-&(.+)$/
    const secretMatch = raw.match(SECRET_RE)
    const customWmLeft = (secretMatch && (m.isPremium || m.isOwner)) ? secretMatch[1].trim() : null
    const input = raw.replace(SECRET_RE, '').trim()

    let [top, bottom] = input.includes('|')
        ? input.split('|').map(s => s.trim().toUpperCase())
        : ['', input.trim().toUpperCase()]

    top    = top    || '_'
    bottom = bottom || '_'

    m.react('⭐')

    const tempId       = Date.now()
    const inputVideo   = path.join(os.tmpdir(), `vid-${tempId}.mp4`)
    const outputVideo  = path.join(os.tmpdir(), `vid-out-${tempId}.mp4`)
    const overlayImg   = path.join(os.tmpdir(), `overlay-${tempId}.png`)
    const watermarkImg = path.join(os.tmpdir(), `wm-${tempId}.png`)

    try {
        let mediaBuffer
        if (m.quoted) {
            mediaBuffer = await m.quoted.download().catch(() => null)
        } else if (m.download) {
            mediaBuffer = await m.download().catch(() => null)
        }

        if (!mediaBuffer) {
            m.react('💔')
            return m.reply(`💔 *ᴇʀʀᴏʀ ᴘᴀɴɢɢᴜɴɢ*\n\n> Gagal ambil videonya... 😢`)
        }

        fs.writeFileSync(inputVideo, mediaBuffer)

        // ── Probe metadata ──
        const metadata = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(inputVideo, (err, data) => err ? reject(err) : resolve(data))
        })

        const videoStream = metadata.streams.find(s => s.codec_type === 'video')
        if (!videoStream) throw new Error('Stream video tidak ditemukan')

        const size = 512

        // ── Draw meme text layer (dengan dukungan emoji) ──
        const memeCanvas = createCanvas(size, size)
        const ctx = memeCanvas.getContext('2d')
        await drawMemeText(ctx, top,    10,        size, false)
        await drawMemeText(ctx, bottom, size - 10, size, true)
        fs.writeFileSync(overlayImg, memeCanvas.toBuffer('image/png'))

        // ── Build watermark layer ──
        fs.writeFileSync(watermarkImg, buildWatermarkLayer(size, customWmLeft))

        // ── Process video dengan ffmpeg (meme text + watermark sekaligus) ──
        await new Promise((resolve, reject) => {
            ffmpeg(inputVideo)
                .input(overlayImg)
                .input(watermarkImg)
                .complexFilter([
                    `[0:v]crop='min(iw,ih)':'min(iw,ih)',scale=${size}:${size},fps=60[vid]`,
                    `[vid][1:v]overlay=0:0[vidwm]`,
                    `[vidwm][2:v]overlay=0:0[out]`
                ])
                .outputOptions([
                    '-map [out]',
                    '-an',
                    '-c:v libx264',
                    '-preset fast',
                    '-crf 26',
                    '-t 4'
                ])
                .save(outputVideo)
                .on('end', resolve)
                .on('error', reject)
        })

        m.react('✅')

        const stickerConfig = config.sticker || {}

        await sock.sendVideoAsSticker(m.chat, outputVideo, m, {
            packname: stickerConfig.packname || '💖 Hoshino Ai Bot 💖',
            author:   stickerConfig.author   || 'B-Komachi Production'
        })

        m.react('💖')

    } catch (error) {
        console.error('[smemevid] Error:', error)
        m.react('💔')
        m.reply(`💔 *ᴇʀʀᴏʀ ᴘᴀɴɢɢᴜɴɢ*\n\n> Masalah: ${error.message || 'Terjadi kesalahan saat memproses video'}`)

    } finally {
        for (const f of [inputVideo, outputVideo, overlayImg, watermarkImg]) {
            try { fs.unlinkSync(f) } catch (_) {}
        }
    }
}

module.exports = { config: pluginConfig, handler }