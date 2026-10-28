const cekfemboy = require('../../src/scraper/lufemboy')
const { fetchBuffer } = require('../../src/lib/functions')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

const pluginConfig = {
    name: 'cekfemboy',
    alias: ['femboy'],
    category: 'cek',
    description: 'Cek seberapa femboy kamu',
    usage: '.cekfemboy <nama>',
    example: '.cekfemboy Budi',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const mentioned = m.mentionedJid?.[0] || m.sender
    const nama = mentioned.split('@')[0]

    const result = cekfemboy(nama)

    // Ganti nomor jadi mention
    result.hasil = result.hasil.replace(
        nama,
        `@${nama}`
    )

    const txt = mentioned === m.sender
        ? `Hai @${nama}\n\n${result.hasil}`
        : `Kamu ingin ngecek tingkat kefemboyan @${nama} yak?\n\n${result.hasil}`

    // Coba kirim versi lengkap (gif + caption) dulu
    try {
        const gifBuffer = await fetchBuffer(result.gif)

        const tempDir = path.join(process.cwd(), 'temp')
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true })
        }

        const timestamp = Date.now()
        const gifPath = path.join(tempDir, `femboy_${timestamp}.gif`)
        const mp4Path = path.join(tempDir, `femboy_${timestamp}.mp4`)

        fs.writeFileSync(gifPath, gifBuffer)

        await execAsync(
            `ffmpeg -i "${gifPath}" -movflags faststart -pix_fmt yuv420p -vf "scale=512:-2:flags=lanczos" -y "${mp4Path}"`
        )

        const mp4Buffer = fs.readFileSync(mp4Path)

        await sock.sendMessage(
            m.chat,
            {
                video: mp4Buffer,
                gifPlayback: true,
                caption: txt,
                mentions: [mentioned]
            },
            { quoted: m }
        )

        if (fs.existsSync(gifPath)) fs.unlinkSync(gifPath)
        if (fs.existsSync(mp4Path)) fs.unlinkSync(mp4Path)

    } catch (err) {
        // Fallback: kalau gagal ambil/proses gif (misal server gif lagi down/kena limit),
        // tetep kirim hasilnya lewat m.reply() biar ikut variant reply yang lagi aktif.
        console.error('cekfemboy gif fetch/convert error, fallback ke reply variant:', err.message)
        return m.reply(txt)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}