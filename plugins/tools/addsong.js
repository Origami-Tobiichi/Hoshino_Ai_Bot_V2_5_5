const { queueFFmpeg } = require('../../src/lib/ffmpegQueue')
const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: 'addsong',
    alias: ['imgtosong', 'songtovideo', 'photosong'],
    category: 'tools',
    description: 'Gabungkan gambar + audio menjadi video (gambar diam + lagu)',
    usage: '.addsong (kirim gambar sambil reply audio)',
    example: '.addsong',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 2,
    isEnabled: true
}

async function handler(m, { sock }) {
    // ── Deteksi gambar (dari pesan saat ini) ──
    const selfIsImage = m.isImage || m.type === 'imageMessage' || m.message?.imageMessage

    // ── Deteksi audio (dari quoted/reply) ──
    const quotedIsAudio = m.quoted && (
        m.quoted.isAudio ||
        m.quoted.type === 'audioMessage' ||
        m.quoted.mtype === 'audioMessage' ||
        m.quoted.message?.audioMessage
    )

    // Validasi: harus ada gambar di pesan sekarang
    if (!selfIsImage) {
        await m.reply(
            `⭐ *Ai Hoshino AddSong!*\n\n` +
            `Eeh~? Gambarnya mana nih? 🌸\n` +
            `Aku nggak bisa bikin videonya tanpa gambar lho~\n\n` +
            `*Cara pakainya:*\n` +
            `> 1. Reply audio/lagu yang kamu mau~ 🎵\n` +
            `> 2. Kirim gambar + caption \`${m.prefix}addsong\`\n\n` +
            `> Aku tunggu ya~ 💕`
        )
        return
    }

    // Validasi: harus reply ke audio
    if (!quotedIsAudio) {
        await m.reply(
            `⭐ *Ai Hoshino AddSong!*\n\n` +
            `Muu~ lagunya belum di-reply nih! 🎶\n` +
            `Aku butuh lagunya juga dong buat bikin videonya~\n\n` +
            `*Cara pakainya:*\n` +
            `> 1. Reply audio/lagu yang kamu mau~ 🎵\n` +
            `> 2. Kirim gambar + caption \`${m.prefix}addsong\`\n\n` +
            `> Coba lagi ya~ aku tunggu! 💕`
        )
        return
    }

    await m.react('🎵')
    await m.reply(
        `⭐ *Ai Hoshino AddSong!*\n\n` +
        `Sebentar ya~ aku lagi gabungin gambar sama lagunya~ 🌸\n` +
        `> Nggak kemana-mana kok, aku di sini~ ✨💕`
    )

    const tempDir = path.join(process.cwd(), 'temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

    const ts = Date.now()
    const imgPath   = path.join(tempDir, `addsong_img_${ts}.jpg`)
    const audioPath = path.join(tempDir, `addsong_audio_${ts}.mp3`)
    const outPath   = path.join(tempDir, `addsong_out_${ts}.mp4`)

    try {
        const [imgBuffer, audioBuffer] = await Promise.all([
            m.download(),
            m.quoted.download()
        ])

        if (!imgBuffer || imgBuffer.length === 0) {
            await m.react('💔')
            await m.reply(
                `⭐ *Ai Hoshino AddSong!*\n\n` +
                `Kyaa~ aku gagal download gambarnya nih~ 😢\n` +
                `> Coba kirim ulang ya~ 🌸`
            )
            return
        }
        if (!audioBuffer || audioBuffer.length === 0) {
            await m.react('💔')
            await m.reply(
                `⭐ *Ai Hoshino AddSong!*\n\n` +
                `Kyaa~ aku gagal download lagunya nih~ 😢\n` +
                `> Coba reply ulang audionya ya~ 🌸`
            )
            return
        }

        fs.writeFileSync(imgPath, imgBuffer)
        fs.writeFileSync(audioPath, audioBuffer)

        const cmd = [
            `ffmpeg -y`,
            `-loop 1 -i "${imgPath}"`,
            `-i "${audioPath}"`,
            `-c:v libx264 -preset ultrafast`,
            `-tune stillimage`,
            `-c:a aac -b:a 192k`,
            `-pix_fmt yuv420p`,
            `-vf "scale=trunc(iw/2)*2:trunc(ih/2)*2"`,
            `-shortest`,
            `"${outPath}"`
        ].join(' ')

        await queueFFmpeg(cmd)

        if (!fs.existsSync(outPath)) {
            await m.react('💔')
            await m.reply(
                `⭐ *Ai Hoshino AddSong!*\n\n` +
                `Muu~ videonya gagal dibuat nih~ 😔\n` +
                `> Pastiin ffmpeg udah terinstall ya~ 🌸`
            )
            return
        }

        const videoBuffer = fs.readFileSync(outPath)

        await sock.sendMessage(m.chat, {
            video: videoBuffer,
            mimetype: 'video/mp4',
            caption:
                `⭐ *Ai Hoshino AddSong!*\n\n` +
                `Ja~n! Videonya udah jadi~ 🎵✨\n` +
                `Gambar + lagunya berhasil digabung lho!\n\n` +
                `> *"Ai loves you~!"* 💕🌸`
        }, { quoted: m })

        await m.react('⭐')

    } catch (error) {
        console.error('[AddSong] Error:', error)
        await m.react('💔')
        await m.reply(
            `⭐ *Ai Hoshino AddSong!*\n\n` +
            `Kyaa~ ada yang salah nih, maaf ya~ 🙏\n` +
            `> _${error.message}_\n\n` +
            `> Coba lagi nanti ya~ 💕`
        )
    } finally {
        for (const f of [imgPath, audioPath, outPath]) {
            try { if (fs.existsSync(f)) fs.unlinkSync(f) } catch (_) {}
        }
    }
}

module.exports = {
    config: pluginConfig,
    handler
}