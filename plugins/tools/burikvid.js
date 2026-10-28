const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: 'burikvid',
    alias: ['burik', 'jelekin', 'lowquality'],
    category: 'tools',
    description: 'Jelekin kualitas video (kebalikan dari hdvid) buat meme',
    usage: '.burikvid (reply video) <level/resolusi> <--doc>',
    example: '.burikvid parah / .burikvid 840 / .burikvid parah --doc',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 1,
    isEnabled: true
}

function runFfmpeg(args) {
    return new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', args)
        let stderr = ''
        proc.stderr.on('data', (d) => { stderr += d.toString() })
        proc.on('error', reject)
        proc.on('close', (code) => {
            if (code === 0) resolve()
            else reject(new Error(`ffmpeg exit code ${code}: ${stderr.slice(-500)}`))
        })
    })
}

function probeSize(filePath) {
    return new Promise((resolve, reject) => {
        const args = [
            '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=width,height',
            '-of', 'csv=s=x:p=0',
            filePath
        ]
        const proc = spawn('ffprobe', args)
        let out = ''
        let err = ''
        proc.stdout.on('data', (d) => { out += d.toString() })
        proc.stderr.on('data', (d) => { err += d.toString() })
        proc.on('error', reject)
        proc.on('close', (code) => {
            if (code !== 0) return reject(new Error(`ffprobe gagal: ${err.slice(-300)}`))
            const [w, h] = out.trim().split('x').map(Number)
            if (!w || !h) return reject(new Error('ffprobe: gagal baca resolusi video'))
            resolve({ width: w, height: h })
        })
    })
}

// Level "kebusukan" resolusi, biar bisa dipilih seberapa parah
const LEVELS = {
    ringan: { downscale: 360, crf: '28' },
    sedang: { downscale: 240, crf: '35' },
    parah: { downscale: 144, crf: '40' }
}

// Buat input custom berupa angka (mis. ".burikvid 840"), pakai crf tengah
const CUSTOM_CRF = '35'

// Regex buat flag "kirim sebagai dokumen", selalu dicek di argumen PALING AKHIR
const DOC_FLAG_RE = /^--?(doc|dokumen|dok)$/i

/**
 * Cek & pisahkan flag --doc/--dokumen/--dok dari akhir array argumen.
 * Return { asDocument, rest } dimana `rest` adalah sisa argumen tanpa flag tsb.
 */
function extractDocFlag(args) {
    const list = Array.isArray(args) ? [...args] : []
    if (list.length === 0) return { asDocument: false, rest: list }

    const last = list[list.length - 1]
    if (DOC_FLAG_RE.test((last || '').trim())) {
        list.pop()
        return { asDocument: true, rest: list }
    }
    return { asDocument: false, rest: list }
}

/**
 * Parse argumen level dari user.
 * - Kalau cocok nama level (ringan/sedang/parah) -> pakai preset LEVELS
 * - Kalau berupa angka murni (mis. "840") -> dipakai sebagai target downscale
 *   (hanya SATU angka, bukan format RESOLxRESOL)
 * - Selain itu -> default 'sedang'
 */
function parseLevelArg(raw) {
    const arg = (raw || '').toLowerCase().trim()

    if (LEVELS[arg]) {
        return { label: arg, downscale: LEVELS[arg].downscale, crf: LEVELS[arg].crf }
    }

    // Tolak kalau user masih nulis format lama RESOLxRESOL
    if (/^\d+\s*[xX]\s*\d+$/.test(arg)) {
        return { invalidFormat: true }
    }

    if (/^\d+$/.test(arg)) {
        const n = parseInt(arg, 10)
        return { label: `${n}`, downscale: n, crf: CUSTOM_CRF }
    }

    return { label: 'sedang', downscale: LEVELS.sedang.downscale, crf: LEVELS.sedang.crf }
}

async function degradeVideo(inputPath, outputPath, downscale, crf) {
    // Perlu tau resolusi ASLI dulu (via ffprobe), karena begitu di-scale turun,
    // filter chain udah gak "inget" lagi ukuran original buat di-scale balik.
    const { width: origW, height: origH } = await probeSize(inputPath)

    // Sisi terpendek dari video asli -> patokan apakah target beneran
    // "menurunkan" kualitas atau justru mau "menaikkan" (upscale).
    const shortestSide = Math.min(origW, origH)

    if (downscale >= shortestSide) {
        const err = new Error(
            `Resolusi target (${downscale}) sama atau lebih besar dari sisi terpendek video asli (${shortestSide}). ` +
            `Fitur ini cuma buat NURUNIN kualitas, bukan naikin.`
        )
        err.reason = 'upscale_rejected'
        throw err
    }

    // Cuma resolusi yang disentuh: scale KECIL dulu pake nearest-neighbor
    // (bikin blocky/pecah), baru scale BALIK ke resolusi asli (origW x origH)
    // biar dimensi output normal/gak keliatan "sengaja resize" tapi isinya
    // udah pecah. Fps & audio dibiarin apa adanya (audio di-copy, gak di-encode ulang).
    const filter =
        `scale=-2:${downscale}:flags=neighbor,` +
        `scale=${origW}:${origH}:flags=neighbor`

    const args = [
        '-y',
        '-i', inputPath,
        '-vf', filter,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', crf,
        '-c:a', 'copy',
        '-movflags', '+faststart',
        outputPath
    ]

    await runFfmpeg(args)
}

/**
 * Cek apakah sebuah "target" (m atau m.quoted) adalah video,
 * baik dikirim sebagai videoMessage biasa MAUPUN sebagai documentMessage
 * dengan mimetype video (video dikirim "as document").
 */
function isVideoTarget(target) {
    if (!target) return false
    if (target.type === 'videoMessage') return true
    if (target.type === 'documentMessage' && /^video\//i.test(target.mimetype || '')) return true
    // fallback jika sebagian handler cuma set flag isVideo tanpa `type`
    if (target.isVideo) return true
    return false
}

async function handler(m, { sock }) {
    const quotedIsVideo = isVideoTarget(m.quoted)
    const directIsVideo = isVideoTarget(m) || m.isVideo

    const isVideo = quotedIsVideo || directIsVideo

    if (!isVideo) {
        return m.reply(
            `『 ✦ Hoshino Ai ✦ 』\n` +
            `✦✦✦ ʙᴜʀɪᴋ ᴠɪᴅᴇᴏ ᴍᴀᴋᴇʀ ✦✦✦\n\n` +
            `Ai bakal bikin video-mu jadi burik dulu ya~ 🌸\n\n` +
            `╭┈┈⬡「 📋 ᴄᴀʀᴀ ᴘᴀᴋᴀɪ 」\n` +
            `┃ ◦ Reply video: \`${m.prefix}burikvid <level/resolusi>\`\n` +
            `┃ ◦ Reply video yang dikirim sebagai dokumen? Ai juga bisa~\n` +
            `┃ ◦ Level: \`ringan\` / \`sedang\` / \`parah\` (default: sedang)\n` +
            `┃ ◦ Atau resolusi custom: satu angka aja, contoh \`840\`\n` +
            `┃   (bukan format 840x840 ya, cukup \`${m.prefix}burikvid 840\`)\n` +
            `┃ ◦ Tambahin \`--doc\` / \`--dokumen\` / \`--dok\` di PALING AKHIR\n` +
            `┃   biar hasilnya Ai kirim sebagai dokumen, bukan video\n` +
            `┃ ◦ Fitur ini cuma buat NURUNIN kualitas. Mau HD-in? Pakai \`.hdvid\` ya\n` +
            `╰┈┈⬡\n\n` +
            `『 ᴄᴏɴᴛᴏʜ 』\n` +
            `✧ \`${m.prefix}burikvid parah\`\n` +
            `✧ \`${m.prefix}burikvid 840\`\n` +
            `✧ \`${m.prefix}burikvid parah --doc\`\n\n` +
            `Ai selalu ada buat kamu~ 💖⭐`
        )
    }

    const { asDocument, rest } = extractDocFlag(m.args)
    const parsed = parseLevelArg(rest[0])

    if (parsed.invalidFormat) {
        return m.reply(
            `『 ✦ Hoshino Ai ✦ 』\n` +
            `✧ Ai bingung sama formatnya nih~ 🌸\n\n` +
            `╭┈┈⬡\n` +
            `┃ Cukup satu angka aja ya, jangan format RESOLxRESOL\n` +
            `┃ Contoh yang bener: \`${m.prefix}burikvid 840\`\n` +
            `╰┈┈⬡\n\n` +
            `Coba lagi ya, Ai tunggu~ 💖`
        )
    }

    m.react('🕕')

    let inputPath = null
    let outputPath = null

    try {
        const downloadTarget = (m.quoted && (m.quoted.isMedia || quotedIsVideo)) ? m.quoted : m
        const videoBuffer = await downloadTarget.download()

        if (!videoBuffer || videoBuffer.length === 0) {
            m.react('❌')
            return m.reply(
                `『 ✦ Hoshino Ai ✦ 』\n` +
                `✧ Ai gagal ngunduh videonya, maaf ya~ 🌸\n\n` +
                `Coba kirim ulang atau reply videonya lagi ya 💖`
            )
        }

        const tempDir = path.join(process.cwd(), 'temp')
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

        const timestamp = Date.now()
        inputPath = path.join(tempDir, `burik_in_${timestamp}.mp4`)
        outputPath = path.join(tempDir, `burik_out_${timestamp}.mp4`)

        fs.writeFileSync(inputPath, videoBuffer)

        await degradeVideo(inputPath, outputPath, parsed.downscale, parsed.crf)

        const caption =
            `『 ✦ Hoshino Ai ✦ 』\n` +
            `✧ Video-nya udah selesai Ai burikin~ 🌸💖\n\n` +
            `╭┈┈⬡\n` +
            `┃ Level : ${parsed.label}\n` +
            `┃ Mode  : ${asDocument ? 'dokumen' : 'video'}\n` +
            `╰┈┈⬡\n\n` +
            `Semoga suka sama hasilnya ya~ ⭐「推しの子」`

        if (asDocument) {
            await sock.sendMessage(m.chat, {
                document: { url: outputPath },
                mimetype: 'video/mp4',
                fileName: `burikvid_${parsed.label}.mp4`,
                caption
            }, { quoted: m })
        } else {
            await sock.sendMessage(m.chat, {
                video: { url: outputPath },
                caption
            }, { quoted: m })
        }

        m.react('✅')
    } catch (err) {
        console.error('[Burikvid] Error:', err.message)
        m.react('❌')

        if (err.reason === 'upscale_rejected') {
            m.reply(
                `『 ✦ Hoshino Ai ✦ 』\n` +
                `✧ Maaf, permintaannya Ai tolak dulu ya~ 🌸\n\n` +
                `╭┈┈⬡\n` +
                `┃ ${err.message}\n` +
                `╰┈┈⬡\n\n` +
                `Kalau maksudnya mau mempertajam/HD-in video, pakai \`${m.prefix}hdvid\` ya, bukan \`${m.prefix}burikvid\`~ 💖`
            )
        } else {
            m.reply(
                /ffmpeg/i.test(err.message)
                    ? `『 ✦ Hoshino Ai ✦ 』\n✧ Ai gagal proses videonya~ 🌸\n\nPastikan \`ffmpeg\` terinstall di server ya, Ai gak bisa kerja tanpa itu 💖`
                    : `『 ✦ Hoshino Ai ✦ 』\n✧ Ai gagal proses videonya~ 🌸\n\n╭┈┈⬡\n┃ ${err.message}\n╰┈┈⬡`
            )
        }
    } finally {
        if (inputPath && fs.existsSync(inputPath)) setTimeout(() => fs.unlink(inputPath, () => {}), 5000)
        if (outputPath && fs.existsSync(outputPath)) setTimeout(() => fs.unlink(outputPath, () => {}), 10000)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}