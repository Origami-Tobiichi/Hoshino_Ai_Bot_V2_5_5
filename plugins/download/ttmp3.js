const axios = require('axios')
const { queueFFmpeg } = require('../../src/lib/ffmpegQueue')
const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: ['ttmp3'],
    alias: ['ttmusic', 'tiktokmusic'],
    category: 'download',
    description: 'Download video TikTok lalu konversi ke audio MP3',
    usage: '.ttmp3 <url>',
    example: '.ttmp3 https://vt.tiktok.com/xxx',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function fetchTikTok(url) {
    const { data } = await axios.get(
        `https://api-faa.my.id/faa/tiktok?url=${encodeURIComponent(url)}`,
        { timeout: 30000 }
    )
    if (!data?.status) throw new Error('API tidak mengembalikan data yang valid.')
    return data.result
}

async function downloadBuffer(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
            Referer: 'https://www.tiktok.com/'
        }
    })
    return Buffer.from(res.data)
}

function isValidMp4Buffer(buf) {
    if (!buf || buf.length < 10000) return false
    return buf.slice(4, 8).toString('ascii') === 'ftyp'
}

// Coba tiap kandidat video, ambil yang pertama valid (cek magic bytes ftyp)
async function downloadValidVideoBuffer(result) {
    const alt = result?.alternatives
    const candidates = [
        typeof result?.data === 'string' ? result.data : null,
        Array.isArray(result?.data) ? result.data[0] : null,
        typeof alt === 'string' ? alt : null,
        alt?.hd,
        alt?.selected,
        alt?.sd,
        Array.isArray(alt) ? alt[0] : null,
        alt?.wm
    ].filter(u => typeof u === 'string' && u.startsWith('http'))

    if (!candidates.length) throw new Error('URL video tidak ditemukan di response API.')

    let lastErr = null
    for (const url of candidates) {
        try {
            const buf = await downloadBuffer(url)
            if (isValidMp4Buffer(buf)) return buf
            console.log(`[TTMP3] kandidat video corrupt, coba berikutnya...`)
        } catch (e) {
            lastErr = e
            console.log(`[TTMP3] kandidat gagal didownload: ${e.message}`)
        }
    }
    throw new Error(lastErr?.message || 'Semua kandidat video corrupt/gagal didownload.')
}

// Extract audio dari buffer video — pola sama persis kayak toaudio.js
async function extractAudioFromVideo(videoBuffer) {
    const tempDir = path.join(process.cwd(), 'temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

    const inputPath = path.join(tempDir, `ttmp3_in_${Date.now()}.mp4`)
    const outputPath = path.join(tempDir, `ttmp3_out_${Date.now()}.mp3`)

    try {
        fs.writeFileSync(inputPath, videoBuffer)

        await queueFFmpeg(`ffmpeg -y -i "${inputPath}" -vn -ar 44100 -ac 2 -b:a 192k "${outputPath}"`)

        if (!fs.existsSync(outputPath)) {
            throw new Error('Gagal mengekstrak audio dari video.')
        }

        return fs.readFileSync(outputPath)
    } finally {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
    }
}

async function handler(m, { sock }) {
  const url = m.text?.trim()

  if (!url) {
    return m.reply(
`╭┈┈⬡「 🎵 *ᴛɪᴋᴛᴏᴋ ᴅᴏᴡɴʟᴏᴀᴅ* 」
┃ ㊗ ᴜsᴀɢᴇ: \`${m.prefix}ttmp3 <url>\`
╰┈┈⬡

> Contoh: ${m.prefix}ttmp3 https://vt.tiktok.com/xxx`
    )
  }

  if (!url.match(/tiktok\.com|vt\.tiktok/i)) {
    return m.reply('❌ *Ehh~* URL tidak valid. Gunakan link TikTok~ 🥺')
  }

  m.react('🕕')

  try {
    const result = await fetchTikTok(url)

    if (result.type === 'image') {
        m.react('❌')
        return m.reply('❌ *Ehh~* TikTok ini berupa slide gambar, tidak ada video untuk dikonversi~ 🥺')
    }

    // 1. Download video (tervalidasi ftyp box, coba beberapa kandidat)
    const videoBuffer = await downloadValidVideoBuffer(result)

    // 2. Convert video -> audio (sama persis pola toaudio.js)
    const audioBuffer = await extractAudioFromVideo(videoBuffer)

    // 3. Kirim sebagai audio
    const title = result.music_info?.title || result.title || 'TikTok Audio'

    await sock.sendMessage(m.chat, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${title}.mp3`
    }, { quoted: m })

    m.react('✅')

  } catch (err) {
    console.error('[TTMP3] Error:', err)
    m.react('❌')
    m.reply(`❌ *ɢᴀɢᴀʟ ᴍᴇɴɢᴜɴᴅᴜʜ*\n\n> ${err.message}`)
  }
}

module.exports = {
    config: pluginConfig,
    handler
}