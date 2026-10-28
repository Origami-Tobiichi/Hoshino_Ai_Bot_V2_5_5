const sharp = require('sharp')
const { spawn } = require('child_process')
const { writeFile, unlink, mkdir } = require('node:fs/promises')
const { existsSync } = require('node:fs')
const { join } = require('node:path')
const os = require('node:os')

const pluginConfig = {
    name: 'autocrop',
    alias: ['crop', 'acrop'],
    category: 'maker',
    description: 'Potong gambar/video otomatis sesuai rasio',
    usage: '.autocrop <rasio> (reply gambar/video)',
    example: '.autocrop 9:16',
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

// Jalanin ffmpeg sebagai child process, reject kalau exit code != 0
function runFfmpeg(args) {
    return new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', args)
        let stderr = ''
        proc.stderr.on('data', (d) => { stderr += d.toString() })
        proc.on('error', reject) // ffmpeg binary nggak ketemu, dll
        proc.on('close', (code) => {
            if (code === 0) resolve()
            else reject(new Error(`ffmpeg exit code ${code}: ${stderr.slice(-500)}`))
        })
    })
}

async function cropImage(buffer, ratio) {
    return sharp(buffer)
        .resize({
            width: 1080,
            height: Math.round(1080 / ratio),
            fit: 'cover',
            position: 'center' // ✅ crop fokus ke tengah
        })
        .toBuffer()
}

// Sama logic-nya kayak sharp fit:'cover' + position:'center':
// scale video biar salah satu sisi pas, terus crop sisa kelebihannya di tengah.
// ffmpeg filter expression pake variabel `a` (aspect ratio input) bawaan ffmpeg,
// jadi gak perlu ffprobe manual buat baca width/height dulu.
async function cropVideo(inputPath, outputPath, ratio) {
    const targetW = 1080
    const targetH = Math.round(1080 / ratio)

    // Kalau video lebih lebar dari target rasio -> samain tinggi dulu (scale height),
    // lebar kelebihannya nanti kepotong pas crop. Sebaliknya kalau lebih "kurus" -> samain lebar.
    const filter =
        `scale=w='if(gt(a,${ratio}),-2,${targetW})':h='if(gt(a,${ratio}),${targetH},-2)',` +
        `crop=${targetW}:${targetH}`

    const args = [
        '-y',
        '-i', inputPath,
        '-vf', filter,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-c:a', 'aac',
        '-movflags', '+faststart',
        outputPath
    ]

    await runFfmpeg(args)
}

async function handler(m, { sock }) {
    const isImage = m.isImage || (m.quoted && m.quoted.type === 'imageMessage')
    const isVideo = m.isVideo || (m.quoted && m.quoted.type === 'videoMessage')

    if (!isImage && !isVideo) {
        return m.reply(`✨ *Hoshino Ai Autocrop*\n\n> Mana gambar/video yang mau di-crop? 🎤`)
    }

    const ratioStr = m.args[0] || '1:1'
    const parts = ratioStr.split(':')
    const ratio = parseFloat(parts[0]) / parseFloat(parts[1])

    if (isNaN(ratio) || ratio <= 0) {
        return m.reply(`❌ *Ehh~* Format rasio salah! Contoh: \`9:16\` atau \`1:1\``)
    }

    m.react('🕕')

    try {
        let buffer = m.quoted?.isMedia ? await m.quoted.download() : await m.download()

        if (isImage) {
            const outBuffer = await cropImage(buffer, ratio)

            m.react('✅')
            return sock.sendMessage(m.chat, {
                image: outBuffer,
                caption: `✨ *Hoshino Ai Autocrop*\n\n> Crop rasio ${ratioStr} selesai! 📐`
            }, { quoted: m })
        }

        // isVideo: butuh file fisik buat ffmpeg (gak bisa dari buffer langsung)
        const tmpDir = join(os.tmpdir(), 'autocrop')
        if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true })

        const inputPath = join(tmpDir, `in-${Date.now()}.mp4`)
        const outputPath = join(tmpDir, `out-${Date.now()}.mp4`)

        await writeFile(inputPath, buffer)

        try {
            await cropVideo(inputPath, outputPath, ratio)

            m.react('✅')
            await sock.sendMessage(m.chat, {
                video: { url: outputPath },
                caption: `✨ *Hoshino Ai Autocrop*\n\n> Crop video rasio ${ratioStr} selesai! 📐🎬`
            }, { quoted: m })
        } finally {
            // Bersihin file temp apapun hasilnya (sukses/gagal)
            await unlink(inputPath).catch(() => {})
            await unlink(outputPath).catch(() => {})
        }

    } catch (e) {
        console.error('[Autocrop] Error:', e.message)
        m.react('❌')
        m.reply(
            /ffprobe|ffmpeg/i.test(e.message)
                ? `❌ *Hoshino Ai Error*\n\n> Gagal memotong video. Pastikan \`ffmpeg\`/\`ffprobe\` terinstall di server.`
                : `❌ *Hoshino Ai Error*\n\n> Gagal memotong media.`
        )
    }
}

module.exports = { config: pluginConfig, handler }