const { createCanvas, loadImage } = require('@napi-rs/canvas')
const fs = require('fs')
const path = require('path')
const ffmpeg = require('fluent-ffmpeg')

const pluginConfig = {
    name: 'pov',
    alias: ['belike'],
    category: 'maker',
    description: 'Jika aku yang menyulap gambar dan videomu jadi meme POV bercahaya~ Karena cintaku tidak pernah bohong!',
    usage: '.pov [left|center|right] <perasaanmu> (reply gambar/video)',
    example: '.pov center Jika aku yang berdiri di atas panggung itu~',
    cooldown: 15,
    energi: 1,
    isEnabled: true
}

// ── PARSE ARGS ─────────────────────────────────────────────────────────────
// Ambil alignment + teks dari m.body (preserve newline)
// Format: .pov [left|center|right] teks...
// Default alignment: center
function parseInput(m) {
    const prefix = m.prefix || '.'
    const cmd = pluginConfig.name

    const raw = (m.body || m.text || '').replace(/\r\n/g, '\n')
    const cmdRegex = new RegExp(`^\\${prefix}(?:${[cmd, ...(pluginConfig.alias || [])].join('|')})`, 'i')
    const afterCmd = raw.replace(cmdRegex, '').replace(/^ /, '')

    const ALIGNMENTS = ['left', 'center', 'right']

    let align = 'center'
    let text = afterCmd

    // Format: .pov #left Teks / .pov #center Teks / .pov #right Teks
    const hashMatch = afterCmd.match(/^#(\w+)[ \t]?/)
    if (hashMatch && ALIGNMENTS.includes(hashMatch[1].toLowerCase())) {
        align = hashMatch[1].toLowerCase()
        text = afterCmd.slice(hashMatch[0].length)
    }

    return { align, text: text.trim() }
}

// ── WRAP LINES ─────────────────────────────────────────────────────────────
// Support newline literal (\n) dalam teks
function getWrappedLines(ctx, text, maxWidth) {
    const paragraphs = text.split('\n')
    const allLines = []

    for (const para of paragraphs) {
        if (para.trim() === '') {
            allLines.push('') // baris kosong / enter
            continue
        }
        const words = para.split(' ')
        let currentLine = ''

        for (const word of words) {
            if (ctx.measureText(word).width > maxWidth) {
                if (currentLine) { allLines.push(currentLine); currentLine = '' }
                let charLine = ''
                for (const char of word) {
                    if (ctx.measureText(charLine + char).width > maxWidth) {
                        allLines.push(charLine)
                        charLine = char
                    } else {
                        charLine += char
                    }
                }
                if (charLine) currentLine = charLine
            } else {
                const test = currentLine ? `${currentLine} ${word}` : word
                if (ctx.measureText(test).width > maxWidth && currentLine) {
                    allLines.push(currentLine)
                    currentLine = word
                } else {
                    currentLine = test
                }
            }
        }
        if (currentLine) allLines.push(currentLine)
    }

    return allLines
}

// ── BANNER ─────────────────────────────────────────────────────────────────
async function makeBanner(text, width, align = 'center') {
    const padding = Math.round(width * 0.06)
    const textAreaW = width - padding * 2

    const tmpCanvas = createCanvas(width, 100)
    const tmpCtx = tmpCanvas.getContext('2d')

    let fontSize = Math.round(width * 0.085)
    let lines = []
    const lineHeightRatio = 1.25

    while (fontSize >= 16) {
        tmpCtx.font = `bold ${fontSize}px sans-serif`
        lines = getWrappedLines(tmpCtx, text, textAreaW)
        const totalH = lines.length * fontSize * lineHeightRatio
        if (totalH <= width * 0.45) break // sedikit lebih longgar buat multiline
        fontSize -= 2
    }

    const lineHeight = fontSize * lineHeightRatio
    const textBlockH = lines.length * lineHeight
    const bannerH = Math.round(textBlockH + padding * 2)

    const canvas = createCanvas(width, bannerH)
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, bannerH)

    ctx.fillStyle = '#000000'
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.textBaseline = 'top'

    // Alignment
    const alignMap = { left: 'left', center: 'center', right: 'right' }
    ctx.textAlign = alignMap[align] || 'center'

    const xMap = {
        left: padding,
        center: width / 2,
        right: width - padding
    }
    const x = xMap[align] || width / 2

    lines.forEach((line, i) => {
        ctx.fillText(line, x, padding + i * lineHeight)
    })

    return { buffer: canvas.toBuffer('image/png'), bannerH }
}

// ── IMAGE ──────────────────────────────────────────────────────────────────
async function handleImage(m, sock, text, align, imgBuffer) {
    const photo = await loadImage(imgBuffer)

    const canvasW = Math.min(photo.width, 800)
    const scale = canvasW / photo.width
    const photoH = Math.round(photo.height * scale)

    const { buffer: bannerBuf, bannerH } = await makeBanner(text, canvasW, align)
    const banner = await loadImage(bannerBuf)

    const canvas = createCanvas(canvasW, bannerH + photoH)
    const ctx = canvas.getContext('2d')

    ctx.drawImage(banner, 0, 0, canvasW, bannerH)
    ctx.drawImage(photo, 0, bannerH, canvasW, photoH)

    const finalBuf = canvas.toBuffer('image/jpeg', { quality: 92 })

    await sock.sendMessage(m.chat, {
        image: finalBuf,
        caption: `☆ *ʜᴏsʜɪɴᴏ ᴀɪ ᴘᴏᴠ ᴍᴀᴋᴇʀ* ☆\n\n✦ ${text}\n\n_"Ai wa uso ja nai... hontou no kimochi da yo~ 💫"_`
    }, { quoted: m })
}

// ── VIDEO ──────────────────────────────────────────────────────────────────
async function handleVideo(m, sock, text, align, vidBuffer) {
    const tempDir = path.join(process.cwd(), 'temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

    const ts = Date.now()
    const inputPath  = path.join(tempDir, `pov_in_${ts}.mp4`)
    const bannerPath = path.join(tempDir, `pov_banner_${ts}.png`)
    const outputPath = path.join(tempDir, `pov_out_${ts}.mp4`)

    fs.writeFileSync(inputPath, vidBuffer)

    try {
        const videoWidth = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(inputPath, (err, meta) => {
                if (err) return reject(err)
                const vs = meta.streams.find(s => s.codec_type === 'video')
                resolve(vs ? vs.width : 640)
            })
        })

        const { buffer: bannerBuf, bannerH } = await makeBanner(text, videoWidth, align)
        fs.writeFileSync(bannerPath, bannerBuf)

        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .input(bannerPath)
                .complexFilter([
                    `[0:v]scale=${videoWidth}:-2[vid]`,
                    `[1:v]scale=${videoWidth}:${bannerH}[banner]`,
                    `[banner][vid]vstack=inputs=2[out]`
                ])
                .outputOptions([
                    '-map [out]',
                    '-map 0:a?',
                    '-c:v libx264',
                    '-c:a aac',
                    '-preset fast',
                    '-crf 23',
                    '-movflags +faststart'
                ])
                .output(outputPath)
                .on('end', resolve)
                .on('error', reject)
                .run()
        })

        const outBuf = fs.readFileSync(outputPath)

        await sock.sendMessage(m.chat, {
            video: outBuf,
            caption: `☆ *ʜᴏsʜɪɴᴏ ᴀɪ ᴘᴏᴠ ᴍᴀᴋᴇʀ* ☆\n\n✦ ${text}\n\n_"Ai wa uso ja nai... hontou no kimochi da yo~ 💫"_`
        }, { quoted: m })

    } finally {
        for (const f of [inputPath, bannerPath, outputPath]) {
            try { if (fs.existsSync(f)) fs.unlinkSync(f) } catch (_) {}
        }
    }
}

// ── HANDLER ────────────────────────────────────────────────────────────────
async function handler(m, { sock }) {
    const { align, text } = parseInput(m)

    const isImage = m.isImage || (m.quoted?.type === 'imageMessage')
    const isVideo = m.isVideo || (m.quoted?.type === 'videoMessage')

    if (!text || (!isImage && !isVideo)) {
        return m.reply(
            `☆ *ʜᴏsʜɪɴᴏ ᴀɪ ᴘᴏᴠ ᴍᴀᴋᴇʀ* ☆\n\n` +
            `╭─「 ✦ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
            `│ ◦ Reply gambar/video dengan:\n` +
            `│   \`${m.prefix}pov <teks>\`\n` +
            `│ ◦ Alignment (opsional, pakai #):\n` +
            `│   \`${m.prefix}pov #left <teks>\`\n` +
            `│   \`${m.prefix}pov #center <teks>\` ← default\n` +
            `│   \`${m.prefix}pov #right <teks>\`\n` +
            `│ ◦ Enter/newline didukung~ tekan enter aja!\n` +
            `╰─✦\n\n` +
            `_"Minna no koto ga daisuki da yo~ 🌟"_`
        )
    }

    m.react('🕕')

    try {
        let mediaBuffer
        if (m.quoted?.isMedia) {
            mediaBuffer = await m.quoted.download()
        } else if (m.isMedia) {
            mediaBuffer = await m.download()
        }
        if (!mediaBuffer) throw new Error('Gagal download media')

        if (isVideo) {
            if (mediaBuffer.length > 50 * 1024 * 1024) {
                m.react('❌')
                return m.reply('╭─「 ✦ *ʜᴏsʜɪɴᴏ ᴀɪ* 」\n│ Video terlalu besar! Maks 50MB ya~\n╰─✦')
            }
            await handleVideo(m, sock, text, align, mediaBuffer)
        } else {
            await handleImage(m, sock, text, align, mediaBuffer)
        }

        m.react('✅')
    } catch (err) {
        console.error('POV error:', err)
        m.react('❌')
        m.reply(`╭─「 ✦ *ʜᴏsʜɪɴᴏ ᴀɪ ᴇʀʀᴏʀ* 」\n│ Gomennasai~ gagal nih 🌸\n│ ${err.message}\n╰─✦`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}