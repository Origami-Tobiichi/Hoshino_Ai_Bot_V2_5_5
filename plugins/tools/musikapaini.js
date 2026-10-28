const hsAsset = require('../../src/lib/assets')
const axios = require('axios')
const FormData = require('form-data')
const config = require('../../config')
const { downloadMediaMessage } = require('hsnai')
const path = require('path')
const fs = require('fs')
const os = require('os')
const crypto = require('crypto')
const { execFile } = require('child_process')

const pluginConfig = {
    name: 'musikapaini',
    alias: ['whatmusic', 'shazam', 'idmusik', 'ai-shazam'],
    category: 'tools',
    description: 'Identifikasi lagu lewat suara bersama Ai-chan! ✨',
    usage: '.musikapaini (reply audio)',
    example: '.musikapaini',
    cooldown: 15,
    energi: 2,
    isEnabled: true
}

// 🌸 Thumbnail fallback
let thumbTools = null
hsAsset.tryBuffer('images/hsnai-tools').then(b => { if (b) thumbTools = b }).catch(() => {})

// 🌸 Hard timeout wrapper — memastikan promise APAPUN nggak nyangkut selamanya
// walau axios/timeout internalnya gagal ke-trigger (koneksi nyangkut, dsb).
function withTimeout(promise, ms, label) {
    let timer
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`⏱️ Timeout: ${label} kelamaan (>${ms / 1000}s)`)), ms)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// 🌸 Convert buffer audio APAPUN formatnya (ogg/opus, m4a, webm, dll) jadi mp3 asli.
// Ini penting karena API pengenal musik biasanya decode berdasarkan ekstensi file —
// kalau isinya ogg/opus tapi dikasih nama .mp3, API bisa gagal decode dan selalu
// balikin "tidak ditemukan" walau lagunya jelas dan full.
async function convertToMp3(buffer) {
    const tmpDir = os.tmpdir()
    const id = crypto.randomBytes(6).toString('hex')
    const inputPath = path.join(tmpDir, `hsnai_in_${id}`)
    const outputPath = path.join(tmpDir, `hsnai_out_${id}.mp3`)

    fs.writeFileSync(inputPath, buffer)

    try {
        await new Promise((resolve, reject) => {
            execFile(
                'ffmpeg',
                ['-y', '-i', inputPath, '-vn', '-ar', '44100', '-ac', '2', '-b:a', '192k', outputPath],
                { timeout: 30000 },
                (err) => (err ? reject(err) : resolve())
            )
        })

        return fs.readFileSync(outputPath)
    } finally {
        // 🌸 Bersih-bersih file sementara, apapun hasilnya
        try { fs.unlinkSync(inputPath) } catch {}
        try { fs.unlinkSync(outputPath) } catch {}
    }
}

// 🌸 Ambil thumbnail dari YouTube
function getYoutubeThumbnail(urls = []) {
    if (!Array.isArray(urls)) return null

    const yt = urls.find(v => v.includes('youtu'))
    if (!yt) return null

    const match = yt.match(/(?:youtu\.be\/|v=)([^&]+)/)
    if (!match) return null

    const videoId = match[1]
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

// 🌸 Context Info
function getContextInfo(title, body, thumbUrl = null) {
    const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    const saluranName = 'Stars of B-Komachi ✨'

    return {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: saluranId,
            newsletterName: saluranName,
            serverMessageId: 127
        },
    }
}

// 🌸 Upload audio
async function uploadToTmpFiles(buffer, filename) {
    const form = new FormData()
    form.append('file', buffer, { filename, contentType: 'application/octet-stream' })

    const res = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
        headers: form.getHeaders(),
        timeout: 60000
    })

    if (!res.data?.data?.url) throw new Error('Duh, Ai gagal upload audionya.. 😭')

    return res.data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
}

// 🌸 Identifikasi lagu — primary API
async function detectWithPrimary(audioUrl) {
    const apiUrl = `https://api.nexray.web.id/tools/whatsmusic?url=${encodeURIComponent(audioUrl)}`
    const { data } = await axios.get(apiUrl, { timeout: 30000 })
    if (!data?.status || !data?.result) return null
    return data.result
}

// 🌸 Identifikasi lagu — fallback API
async function detectWithFallback(audioUrl) {
    const apiUrl = `https://api-faa.my.id/faa/whatmusic?url=${encodeURIComponent(audioUrl)}`
    const { data } = await axios.get(apiUrl, { timeout: 30000 })
    if (!data?.status || !data?.result) return null
    return data.result
}

// 🌸 Handler utama
async function handler(m, { sock }) {
    let audioBuffer = null

    const quoted = m.quoted ? m.quoted : m
    const msg = quoted.message || quoted
    const mime = (quoted.msg || quoted).mimetype || ''

    // 🎧 Ambil audio (dibatasi 25s, biar nggak nyangkut kalau media expired)
    if (/audio|voice/.test(mime) || msg.audioMessage) {
        try {
            audioBuffer = await withTimeout(
                downloadMediaMessage({ key: quoted.key, message: msg }, 'buffer', {}),
                25000,
                'download audio'
            )
        } catch (e) {
            console.error('[musikapaini] Download Error:', e.message)
        }
    }

    if (!audioBuffer) {
        return m.reply(
            `🌟 *Hᴀɪ Hᴀɪ! Iᴛ's Aɪ-ᴄʜᴀɴ!* 🌟\n\n` +
            `Aduuuh... Ai nggak dengar apa-apa nih. 🎤\n\n` +
            `*Caranya:* \n` +
            `> Reply audio/vn-nya terus ketik \`${m.prefix}${pluginConfig.name}\` ya!`
        )
    }

    m.react('🎤')

    // 🌸 Watchdog keseluruhan proses — kalau lebih dari 70s belum selesai, paksa gagal
    // supaya user selalu dapat balasan, nggak diem loading selamanya.
    try {
        await withTimeout(processMusic(m, sock, audioBuffer), 70000, 'proses identifikasi lagu')
    } catch (error) {
        console.error('[musikapaini] FATAL:', error.message)
        m.react('❌')
        m.reply(`💔 *Aᴅᴜʜ, ᴇʀʀᴏʀ!* \n\n> ${error.message}`)
    }
}

// 🌸 Proses inti (dipisah biar bisa dibungkus watchdog)
async function processMusic(m, sock, audioBuffer) {
    await m.reply('✨ *Sɪᴀᴘ-sɪᴀᴘ!* Ai sedang mendengarkan melodi indahnya... ✨')

    console.log('[musikapaini] step: converting audio to mp3...')
    let mp3Buffer
    try {
        mp3Buffer = await withTimeout(convertToMp3(audioBuffer), 30000, 'konversi audio ke mp3')
    } catch (e) {
        console.warn('[musikapaini] Convert error, pakai buffer asli sebagai fallback:', e.message)
        mp3Buffer = audioBuffer
    }
    console.log('[musikapaini] step: convert done')

    console.log('[musikapaini] step: uploading audio...')
    const audioUrl = await withTimeout(
        uploadToTmpFiles(mp3Buffer, `detect_${Date.now()}.mp3`),
        45000,
        'upload audio'
    )
    console.log('[musikapaini] step: upload done ->', audioUrl)

    // 🌸 Coba primary dulu, fallback kalau error atau result kosong
    let res = null

    console.log('[musikapaini] step: trying primary API...')
    try {
        res = await withTimeout(detectWithPrimary(audioUrl), 32000, 'primary API')
    } catch (e) {
        console.warn('[musikapaini] Primary API error, trying fallback...', e.message)
    }

    if (!res) {
        console.log('[musikapaini] step: trying fallback API...')
        try {
            res = await withTimeout(detectWithFallback(audioUrl), 32000, 'fallback API')
        } catch (e) {
            console.warn('[musikapaini] Fallback API error:', e.message)
        }
    }

    if (!res) {
        m.react('💔')
        return m.reply('Gomen ne.. 😭 Ai tidak bisa mengenali lagunya. Mungkin suaranya kurang jelas?')
    }

    console.log('[musikapaini] step: result found ->', res.title)

    // 🎯 Thumbnail ambil dari YouTube
    const thumbUrl = getYoutubeThumbnail(res.url)

    // 📝 Caption
    let caption = `🌟 *Lᴀɢᴜɴʏᴀ Kᴇᴛᴇᴍᴜ! Yᴀʏ!* 🌟\n\n`
    caption += `┌───〔 *ᴍᴜsɪᴄ ɪɴғᴏ* 〕\n`
    caption += `│ 🎵 *Judul:* ${res.title}\n`
    caption += `│ 👤 *Artis:* ${res.artist}\n`
    caption += `│ 🎯 *Akurasi:* ${res.score}%\n`
    caption += `│ 📅 *Rilis:* ${res.release || '-'}\n`
    caption += `│ ⏳ *Durasi:* ${res.duration || '-'}\n`
    caption += `└────────────⬡\n\n`

    if (Array.isArray(res.url) && res.url.length > 0) {
        caption += `*Dengerin di sini yuk:* ✨\n`
        res.url.forEach((link) => {
            if (link.includes('spotify')) caption += `> 🎧 [Spotify](${link})\n`
            else if (link.includes('youtu')) caption += `> ▶️ [YouTube](${link})\n`
            else if (link.includes('deezer')) caption += `> 🎵 [Deezer](${link})\n`
            else caption += `> 🔗 [Link](${link})\n`
        })
        caption += `\n`
    }

    caption += `*"Lies are the most exquisite love!"* ✨`

    const contextInfo = getContextInfo(
        `🎶 Music Found by Ai-chan`,
        `Song: ${res.title}`,
        thumbUrl
    )

    await sock.sendMessage(m.chat, {
        text: caption,
        contextInfo
    }, { quoted: m })

    m.react('⭐')
}

module.exports = {
    config: pluginConfig,
    handler
}