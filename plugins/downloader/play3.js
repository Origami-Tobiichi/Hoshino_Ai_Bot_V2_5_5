/**
‎✧ Name    : play3
‎✧ Category: downloader
**/

'use strict'

const axios = require('axios')
const config = require('../../config')
const { createDecipheriv, randomUUID } = require('crypto')
const { spawn } = require('child_process')
const yts = require('yt-search')
const YTMusic = require('ytmusic-api')
const sharp = require('sharp')
const { prepareWAMessageMedia } = require('hsnai')
const { f } = require('../../src/lib/undici')
const fs = require('fs/promises')
const os = require('os')
const path = require('path')

/* =========================================================
 * PLUGIN CONFIG
 * ========================================================= */
const pluginConfig = {
    name: 'play3',
    alias: ['musik3', 'ytm3'],
    category: 'downloader',
    description: 'Cari lagu di YT Music, lirik synced, audio HD, player HTML interaktif',
    usage: '.play3 <judul lagu / link youtube>',
    example: '.play3 another love tom odell',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 2,
    isEnabled: true
}

/* =========================================================
 * CONFIG INTERNAL
 * ========================================================= */
const METADATA_DECRYPTION_KEY = Buffer.from('C5D58EF67A7584E4A29F6C35BBC4EB12', 'hex')

const HEADERS = {
    'Content-Type': 'application/json',
    'Origin': 'https://yt.savetube.me',
    'Referer': 'https://yt.savetube.me/',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'
}

// PAKAI WEBM/OPUS SEPERTI PLAY2 (ANTI BLOKIR)
const FFMPEG_CODEC = 'libopus'
const FFMPEG_FORMAT = 'webm'
const FFMPEG_MIME = 'audio/webm;codecs=opus'
const MAX_B64_BYTES = 750 * 1024 // Maksimal 750KB biar aman di WhatsApp

const MAX_ORIGINAL_AUDIO_MB = 25
const MAX_ORIGINAL_AUDIO_SIZE = MAX_ORIGINAL_AUDIO_MB * 1024 * 1024

const LRCLIB_API = 'https://lrclib.net/api'
const LRCLIB_USER_AGENT = 'HoshinoAi-Play3/1.0 (https://github.com/)'
const YOUTUBE_ID_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|shorts\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/

/* =========================================================
 * HELPERS
 * ========================================================= */
function extractVideoId(url) {
    return String(url || '').match(YOUTUBE_ID_REGEX)?.[1] || null
}

function looksLikeAudio(buf) {
    if (!buf || buf.length < 4) return false
    const hex = buf.subarray(0, 4).toString('hex').toLowerCase()
    const ascii = buf.subarray(0, 4).toString('ascii')
    return (
        ascii.startsWith('ID3') || hex.startsWith('fffb') || hex.startsWith('fff3') ||
        ascii.startsWith('RIFF') || ascii.startsWith('OggS') || hex.startsWith('1a45dfa3') ||
        hex.startsWith('0000001c') || hex.startsWith('00000020')
    )
}

async function withRetry(fn, { retries = 3, delayMs = 2000, label = '' } = {}) {
    let lastError
    for (let i = 1; i <= retries; i++) {
        try { return await fn() } catch (e) {
            lastError = e
            if (i < retries) await new Promise(r => setTimeout(r, delayMs * i))
        }
    }
    throw lastError
}

function secondsFromTimestamp(timestamp = '') {
    if (!timestamp) return 0
    const parts = String(timestamp).split(':').map(Number)
    if (parts.some(Number.isNaN)) return 0
    if (parts.length === 2) return parts[0] * 60 + parts[1]
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return 0
}

function formatDuration(seconds = 0) {
    seconds = Number(seconds)
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
    return m + ':' + String(s).padStart(2, '0')
}

/* =========================================================
 * LIRIK & PARSER
 * ========================================================= */
async function getLRCLyrics({ title, artist, duration = 0, album = '' }) {
    try {
        if (!title || !artist) return null
        const params = new URLSearchParams({ track_name: String(title).trim(), artist_name: String(artist).trim() })
        if (album) params.set('album_name', String(album).trim())
        if (duration > 0) params.set('duration', String(Math.round(duration)))
        const res = await fetch(`${LRCLIB_API}/get?${params.toString()}`, { headers: { 'User-Agent': LRCLIB_USER_AGENT } })
        if (!res.ok) return null
        const data = await res.json()
return {
    plainLyrics: typeof data?.plainLyrics === 'string' ? data.plainLyrics : '',
    syncedLyrics: typeof data?.syncedLyrics === 'string' ? data.syncedLyrics : '',
    albumName: typeof data?.albumName === 'string' ? data.albumName : '',
    artistName: typeof data?.artistName === 'string' ? data.artistName : ''
}
    } catch { return null }
}

function parseSyncedLyrics(lrc = '') {
    if (!lrc) return []
    const result = []
    const timestampRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g
    for (const rawLine of lrc.split(/\r?\n/)) {
        const matches = [...rawLine.matchAll(timestampRegex)]
        if (!matches.length) continue
        const text = rawLine.replace(timestampRegex, '').trim()
        if (!text) continue
        for (const match of matches) {
            const minutes = Number(match[1]), seconds = Number(match[2]), fractionText = match[3] || ''
            let milliseconds = 0
            if (fractionText) {
                if (fractionText.length === 1) milliseconds = Number(fractionText) * 100
                else if (fractionText.length === 2) milliseconds = Number(fractionText) * 10
                else milliseconds = Number(fractionText.slice(0, 3))
            }
            result.push({ time: minutes * 60 + seconds + milliseconds / 1000, text })
        }
    }
    return result.sort((a, b) => a.time - b.time)
}

function plainLyricsToSynced(lyrics = '', duration = 0) {
    const lines = String(lyrics).split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (!lines.length) return []
    const interval = duration > 0 && lines.length > 1 ? Math.max(2, Math.min(8, duration / lines.length)) : 5
    return lines.map((text, index) => ({ time: index * interval, text }))
}

function normalizeLyrics(lyrics = []) {
    return lyrics.filter(item => item && Number.isFinite(Number(item.time)) && typeof item.text === 'string')
        .map(item => ({ time: Number(item.time), text: String(item.text).trim() })).filter(item => item.text)
}

let ytMusicInstance = null
async function getYTMusic() {
    if (!ytMusicInstance) {
        ytMusicInstance = new YTMusic()
        await ytMusicInstance.initialize()
    }
    return ytMusicInstance
}

/* =========================================================
 * DOWNLOADER METHODS
 * ========================================================= */
function decryptSavetube(data) {
    const encrypted = Buffer.from(data, 'base64')
    const decipher = createDecipheriv('aes-128-cbc', METADATA_DECRYPTION_KEY, encrypted.subarray(0, 16))
    return JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(16)), decipher.final()]).toString())
}

async function downloadAudioViaSavetube(url) {
    const videoId = extractVideoId(url)
    if (!videoId) throw new Error('URL YouTube tidak valid')
    const { data: cdnData } = await axios.get('https://media.savetube.vip/api/random-cdn', { headers: HEADERS, timeout: 15000 })
    if (!cdnData?.cdn) throw new Error('CDN savetube tidak tersedia')
    const cdn = cdnData.cdn
    const { data: info } = await axios.post(`https://${cdn}/v2/info`, { url: `https://www.youtube.com/watch?v=${videoId}` }, { headers: HEADERS, timeout: 20000 })
    if (!info?.data) throw new Error('Metadata savetube kosong')
    const metadata = decryptSavetube(info.data)
    if (!metadata?.key) throw new Error('Key savetube tidak ditemukan')
    const { data: dl } = await axios.post(`https://${cdn}/download`, { id: videoId, downloadType: 'audio', quality: '128kbps', key: metadata.key }, { headers: HEADERS, timeout: 30000 })
    if (!dl?.data?.downloadUrl) throw new Error(dl?.message || 'Gagal mendapatkan link savetube')
    return { url: dl.data.downloadUrl, title: metadata.title, thumbnail: metadata.thumbnail, duration: metadata.durationLabel }
}

async function downloadAudioViaNexray(url) {
    const { result } = await f(`https://api.nexray.web.id/downloader/ytmp3?url=${encodeURIComponent(url)}`)
    if (!result?.url) throw new Error('No URL from nexray')
    return { url: result.url, title: result.title, thumbnail: result.thumbnail, duration: result.duration }
}

async function downloadAudioViaFaa(url) {
    const { result } = await f(`https://api-faa.my.id/faa/ytmp3?url=${encodeURIComponent(url)}`)
    if (!result?.mp3) throw new Error('No URL from api-faa')
    return { url: result.mp3, title: result.title, thumbnail: result.thumbnail, duration: result.duration }
}

async function ytdlYmcdn(url, format = 'mp3') {
    const videoId = extractVideoId(url)
    if (!videoId) throw new Error('URL YouTube tidak valid')
    const client = axios.create({ timeout: 60000, maxRedirects: 10, headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://id.ytmp3.mobi/' } })
    const { data: init } = await client.get('https://d.ymcdn.org/api/v1/init', { params: { p: 'y', 23: '1llum1n471', _: Math.random() } })
    if (!init?.convertURL) throw new Error('Gagal init ymcdn')
    const { data: convert } = await client.get(init.convertURL, { params: { v: videoId, f: format, _: Math.random() } })
    if (!convert?.progressURL || !convert?.downloadURL) throw new Error('Gagal convert ymcdn')
    let progress = 0, attempts = 0, title = convert.title || ''
    while (progress < 3 && attempts < 20) {
        const { data } = await client.get(convert.progressURL)
        if ((data?.error || 0) > 0) throw new Error(`Error ymcdn: ${data.error}`)
        progress = Number(data?.progress || 0)
        title = data?.title || title
        if (progress < 3) { attempts++; await new Promise(r => setTimeout(r, 250)) }
    }
    return { url: convert.downloadURL, title, thumbnail: null, duration: null }
}

async function getAudioUrlWithFallback(url) {
    const methods = [
        { name: 'savetube', fn: () => downloadAudioViaSavetube(url) },
        { name: 'nexray', fn: () => downloadAudioViaNexray(url) },
        { name: 'api-faa', fn: () => downloadAudioViaFaa(url) },
        { name: 'ymcdn', fn: () => ytdlYmcdn(url, 'mp3') }
    ]
    for (const method of methods) {
        try {
            const result = await withRetry(method.fn, { retries: 2, delayMs: 2000, label: method.name })
            if (result?.url) return result
        } catch (e) { console.warn(`[play3] ❌ ${method.name} gagal:`, e.message) }
    }
    throw new Error('Semua metode downloader gagal.')
}

async function downloadAudioBuffer(url) {
    if (!url) throw new Error('URL audio kosong')
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) throw new Error(`Download audio gagal (HTTP ${res.status})`)
    const buffer = Buffer.from(await res.arrayBuffer())
    if (!buffer.length || buffer.length > MAX_ORIGINAL_AUDIO_SIZE) throw new Error('Buffer audio kosong atau terlalu besar')
    return buffer
}

/* =========================================================
 * FFMPEG COMPRESS (KAYAK PLAY2)
 * ========================================================= */
function compressOpus(inputBuffer, { bitrate, label = 'audio' }) {
    return new Promise(async (resolve, reject) => {
        const tmpDir = os.tmpdir()
        const safe = String(label).replace(/[^a-zA-Z0-9]/g, '') || 'audio'
        const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const inPath = path.join(tmpDir, `op_in_${safe}_${stamp}.tmp`)
        const outPath = path.join(tmpDir, `op_out_${safe}_${stamp}.webm`)

        const cleanup = async () => {
            try { await fs.unlink(inPath) } catch {}
            try { await fs.unlink(outPath) } catch {}
        }

        try { await fs.writeFile(inPath, inputBuffer) }
        catch (e) { await cleanup(); return reject(new Error(`tulis input: ${e.message}`)) }

        const args = [
            '-y', '-i', inPath,
            '-vn', '-ac', '1', '-ar', '48000',
            '-c:a', 'libopus', '-b:a', bitrate, '-vbr', 'on',
            '-application', 'audio', '-frame_duration', '40', '-compression_level', '10',
            outPath,
        ]

        const ff = spawn('ffmpeg', args)
        let stderr = ''
        ff.stderr.on('data', (d) => { stderr += d.toString() })

        ff.on('error', async (e) => { await cleanup(); reject(new Error(`ffmpeg error: ${e.message}`)) })
        ff.on('close', async (code) => {
            if (code !== 0) { await cleanup(); return reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-300)}`)) }
            try {
                const out = await fs.readFile(outPath)
                await cleanup()
                if (!out?.byteLength) throw new Error('output kosong')
                resolve(out)
            } catch (e) { await cleanup(); reject(e) }
        })
    })
}

async function compressWithFallback(inputBuffer, label) {
    let best = null
    const chain = ['24k', '16k', '12k']
    for (const bitrate of chain) {
        const buf = await compressOpus(inputBuffer, { bitrate, label })
        const b64 = Math.ceil(buf.length * 4 / 3)
        best = { buf, bitrate, b64len: b64 }
        if (b64 <= MAX_B64_BYTES) return best
    }
    return best
}

/* =========================================================
 * THUMBNAIL
 * ========================================================= */
async function getThumb(url) {
    try {
        if (!url) return Buffer.alloc(0)
        const res = await fetch(url)
        if (!res.ok) throw new Error('Thumbnail gagal diambil')
        const raw = Buffer.from(await res.arrayBuffer())
        return await sharp(raw).resize(400, 400, { fit: 'cover' }).jpeg({ quality: 70 }).toBuffer()
    } catch { return Buffer.alloc(0) }
}

/* =========================================================
 * HTML MUSIC PLAYER (FIXED SETTINGS)
 * ========================================================= */
function createMusicPlayer({ title, artist, album, duration, audioSrc, imageSrc, lyrics }) {
    const coverUrl = imageSrc || ''
    const audioUrl = audioSrc || ''
    const track = { title: String(title), artist: String(artist), album: String(album), audio: audioUrl, cover: coverUrl, lyrics: lyrics || [] }
    const tracksJson = JSON.stringify([track]).replace(/</g, '\\u003c')
    const durationText = String(duration || '0:00')

    return `
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#180d25">
<title>Hoshino Ai Music Player ✦</title>
<style>
:root{color-scheme:dark;--bg:#100a1c;--panel:rgba(31,18,46,.84);--panel2:rgba(255,255,255,.055);--pink:#ff83c5;--pink2:#ffb5df;--violet:#bca2ff;--blue:#8fdcff;--text:#fff8ff;--muted:#c4b5ce;--line:rgba(255,255,255,.12);--shadow:0 24px 70px rgba(0,0,0,.42);--radius:26px;font-family:ui-rounded,"SF Pro Display",system-ui,-apple-system,"Segoe UI",sans-serif;}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{min-height:100%;background:var(--bg)}
body{margin:0;min-height:100vh;color:var(--text);background:radial-gradient(ellipse at 12% 0%,rgba(255,105,190,.18),transparent 40%),radial-gradient(ellipse at 95% 35%,rgba(148,112,255,.18),transparent 36%),linear-gradient(155deg,#100a1c,#1a1028 55%,#0c1021);font-family:var(--sys,ui-rounded,system-ui,sans-serif)}
button,input{font:inherit}
button{color:inherit;cursor:pointer}
button:focus-visible,input:focus-visible{outline:2px solid var(--pink2);outline-offset:3px}
button:disabled{opacity:.35;cursor:not-allowed}
.app{width:min(100%,440px);margin:0 auto;padding:20px 16px 26px;position:relative;isolation:isolate}
.ambient{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:-1}
.orb{position:absolute;width:260px;height:260px;border-radius:50%;filter:blur(65px);opacity:.2;animation:float 12s ease-in-out infinite alternate}
.orb.one{background:#ff69bf;top:8%;left:-130px}.orb.two{background:#9272ff;right:-150px;top:48%;animation-delay:-5s}
.starfield{position:absolute;inset:0;background-image:radial-gradient(#fff 1px,transparent 1.5px),radial-gradient(#ffb5df 1px,transparent 1.5px);background-size:83px 83px,137px 137px;background-position:0 0,38px 54px;opacity:.18}
.topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:19px}
.brand{display:flex;align-items:center;gap:10px;min-width:0}
.brand-mark{display:grid;place-items:center;width:42px;height:42px;border-radius:15px;background:linear-gradient(145deg,#ff9bd2,#a48aff);color:#25122d;box-shadow:0 7px 24px #ff83c533;font-size:21px}
.brand-name{font-size:14px;font-weight:850;letter-spacing:.08em}
.brand-sub{font-size:10px;color:var(--muted);margin-top:3px;letter-spacing:.12em}
.icon-btn{border:1px solid var(--line);background:var(--panel2);width:40px;height:40px;border-radius:14px;display:grid;place-items:center;transition:.2s}
.icon-btn:hover,.secondary:hover{background:rgba(255,255,255,.1);transform:translateY(-1px)}
.icon-btn svg,.ctrl svg,.fav svg,.play svg,.section-title svg{width:20px;height:20px;display:block}
.status{display:flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid var(--line);border-radius:99px;font-size:10px;color:var(--muted);background:#ffffff08}
.status-dot{width:6px;height:6px;border-radius:50%;background:#ff83c5;box-shadow:0 0 9px #ff83c5}
.player{position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.13);border-radius:30px;background:linear-gradient(155deg,rgba(43,25,61,.92),rgba(18,13,31,.96));box-shadow:var(--shadow)}
.player::before{content:"";position:absolute;inset:0 0 auto;height:290px;background:radial-gradient(ellipse at 50% 0%,#ff87cb28,transparent 68%);pointer-events:none}
.inner{position:relative;padding:20px}
.eyebrow{font-size:10px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--pink2);display:flex;align-items:center;justify-content:center;gap:8px}
.eyebrow:before,.eyebrow:after{content:"";height:1px;width:24px;background:linear-gradient(90deg,transparent,var(--pink))}
.eyebrow:after{transform:rotate(180deg)}
.cover-wrap{width:min(100%,310px);margin:20px auto 21px;position:relative}
.cover-glow{position:absolute;inset:9% 8%;border-radius:27px;background:linear-gradient(135deg,#ff7ac0,#8d78ff);filter:blur(28px);opacity:.38}
.cover{position:relative;aspect-ratio:1;border-radius:24px;overflow:hidden;background:linear-gradient(145deg,#ff9ed8,#9b7cff 65%,#24204d);box-shadow:0 18px 38px #0006;border:1px solid #ffffff35}
.cover img{width:100%;height:100%;object-fit:cover;display:block}
.cover-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;background:radial-gradient(circle at 50% 40%,#ffb7e5,#c78bff 45%,#3c286c 100%);text-align:center}
.cover-fallback .big-star{font-size:82px;line-height:1;filter:drop-shadow(0 0 20px #fff8);animation:twinkle 3s ease-in-out infinite}
.cover-fallback strong{font-size:13px;letter-spacing:.2em}
.cover-fallback small{font-size:10px;letter-spacing:.25em;opacity:.8}
.cover-label{position:absolute;left:12px;bottom:12px;padding:7px 10px;border-radius:99px;background:#12091eb8;border:1px solid #ffffff25;backdrop-filter:blur(12px);font-size:9px;letter-spacing:.12em}
.song-row{display:flex;align-items:center;gap:12px}
.song-info{min-width:0;flex:1}
.song-title{font-size:21px;line-height:1.25;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.035em}
.song-artist{font-size:13px;color:var(--muted);margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.song-tag{display:inline-flex;align-items:center;gap:5px;margin-top:9px;color:#ffc4e5;font-size:9px;font-weight:750;letter-spacing:.1em;text-transform:uppercase}
.fav{flex:none;width:44px;height:44px;border:0;background:transparent;color:#c9bad4;display:grid;place-items:center;border-radius:14px}
.fav.active{color:#ff77bd;filter:drop-shadow(0 0 8px #ff77bd66)}
.fav.active svg{fill:currentColor}
.progress-wrap{margin-top:22px}
.progress{position:relative;height:6px;border-radius:99px;background:#ffffff20;cursor:pointer;touch-action:pan-y}
.progress-fill{height:100%;width:0;background:linear-gradient(90deg,var(--pink),var(--violet));border-radius:99px;position:relative;pointer-events:none}
.progress-fill:after{content:"";position:absolute;right:-4px;top:50%;transform:translateY(-50%);width:11px;height:11px;border-radius:50%;background:#fff;box-shadow:0 0 0 4px #ff9bd22b,0 0 12px #ff83c5}
.times{display:flex;justify-content:space-between;color:#b9a9c7;font-size:10px;font-variant-numeric:tabular-nums;margin-top:10px}
.controls{display:flex;align-items:center;justify-content:space-between;margin-top:19px;gap:8px}
.ctrl{border:0;background:transparent;color:#e7d9f0;display:grid;place-items:center;width:39px;height:42px;border-radius:13px;transition:.18s}
.ctrl:hover{background:#ffffff0d;color:#fff}
.ctrl.active{color:var(--pink2)}
.play{display:grid;place-items:center;width:62px;height:62px;border:0;border-radius:22px;background:linear-gradient(145deg,#ffd5ee,#ff8bc9 65%,#c6a1ff);color:#2a1535;box-shadow:0 8px 26px #ff83c544;transition:transform .18s,box-shadow .18s}
.play:hover{transform:translateY(-2px);box-shadow:0 12px 30px #ff83c566}
.play svg{width:27px;height:27px}
.volume-row{display:flex;align-items:center;gap:10px;margin-top:19px;color:#b9a9c7}
.volume-row svg{width:17px;height:17px;flex:none}
input[type=range]{width:100%;accent-color:var(--pink);height:4px;cursor:pointer}
.section{margin-top:16px;border:1px solid var(--line);border-radius:23px;background:rgba(26,16,40,.7);backdrop-filter:blur(18px);overflow:hidden}
.section-head{display:flex;align-items:center;justify-content:space-between;padding:16px 17px 11px}
.section-title{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:850;letter-spacing:.04em}
.section-title svg{color:var(--pink2);width:17px;height:17px}
.pill{font-size:9px;color:#e6c7f3;background:#ffffff0b;border:1px solid var(--line);border-radius:99px;padding:5px 8px}
.lyrics{height:154px;overflow:auto;scrollbar-width:none;padding:5px 17px 16px;mask-image:linear-gradient(180deg,transparent,black 12%,black 88%,transparent)}
.lyrics::-webkit-scrollbar{display:none}
.lyric-line{font-size:12px;line-height:1.6;color:#9f8eaf;padding:5px 0;transition:color .25s,transform .25s,font-size .25s;overflow-wrap:anywhere}
.lyric-line.active{color:#fff;font-size:14px;font-weight:850;transform:translateX(4px);text-shadow:0 0 18px #ff8bce66}
.lyrics-empty{font-size:11px;line-height:1.7;color:#b9a9c7;padding:17px 0}
.lyrics-empty b{color:#ffe0f2}
.queue-list{padding:0 10px 10px}
.track{display:flex;align-items:center;gap:11px;padding:10px;border-radius:15px;border:1px solid transparent;cursor:pointer}
.track:hover{background:#ffffff08}
.track.current{background:#ff8bce12;border-color:#ff8bce28}
.track-art{width:42px;height:42px;flex:none;border-radius:12px;display:grid;place-items:center;background:linear-gradient(145deg,#ff9bd2,#8c78ed);font-size:18px}
.track-copy{min-width:0;flex:1}
.track-title{font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.track-artist{font-size:10px;color:var(--muted);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.track-time{font-size:10px;color:var(--muted);font-variant-numeric:tabular-nums}
.footer{text-align:center;color:#9684a8;font-size:10px;line-height:1.8;padding:18px 6px 0}
.footer strong{color:#ffb5df;letter-spacing:.12em}
.toast{position:fixed;left:50%;bottom:20px;transform:translate(-50%,15px);opacity:0;pointer-events:none;z-index:5;background:#271735f2;border:1px solid #ffffff20;border-radius:14px;padding:11px 15px;font-size:11px;box-shadow:var(--shadow);transition:.25s;max-width:calc(100vw - 30px);text-align:center}
.toast.show{opacity:1;transform:translate(-50%,0)}

/* CSS BARU UNTUK SETTINGS YANG GAK BUG */
.settings-panel {
  position: absolute;
  inset: 0;
  z-index: 100;
  background: #1b1029;
  padding: 20px 16px;
  overflow-y: auto;
  border-radius: 30px;
  display: none;
}
.settings-panel .modal { border: none; background: transparent; padding: 0; box-shadow: none; max-height: none; }
.modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:15px;font-weight:850}
.field{display:block;margin:12px 0}
.field span{display:block;color:var(--muted);font-size:11px;margin-bottom:7px}
.field input{width:100%;border:1px solid var(--line);border-radius:12px;background:#ffffff08;color:#fff;padding:12px;font-size:12px;min-width:0}
.modal-actions{display:flex;gap:9px;margin-top:16px}
.secondary,.primary{border:1px solid var(--line);border-radius:13px;padding:11px 13px;font-size:11px;font-weight:800}
.secondary{background:#ffffff08}.primary{background:linear-gradient(110deg,#ff9bd2,#c0a1ff);color:#27152e;border:0;flex:1}

@keyframes float{to{transform:translate(45px,35px) scale(1.12)}}
@keyframes twinkle{50%{transform:scale(1.06) rotate(5deg);opacity:.82}}
@media(min-width:600px){.app{padding-top:30px}.inner{padding:24px}.cover-wrap{width:290px}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
</style>
</head>
<body>
<div class="ambient" aria-hidden="true"><div class="starfield"></div><div class="orb one"></div><div class="orb two"></div></div>
<main class="app">
  <header class="topbar">
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">✦</div>
      <div><div class="brand-name">HOSHINO AI</div><div class="brand-sub">MUSIC UNIVERSE ♡</div></div>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      <div class="status"><span class="status-dot"></span><span id="statusText">PLAYER READY</span></div>
      <button class="icon-btn" id="openSettings" aria-label="Pengaturan" title="Pengaturan">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 15 .1.1 1.1.9-1.2 2.1-1.4-.5a7.8 7.8 0 0 1-1.5.9l-.3 1.5h-2.4l-.3-1.5a7.8 7.8 0 0 1-1.5-.9l-1.4.5-1.2-2.1 1.1-.9a7 7 0 0 1 0-1.8l-1.1-.9 1.2-2.1 1.4.5a7.8 7.8 0 0 1 1.5-.9l.3-1.5h2.4l.3 1.5a7.8 7.8 0 0 1 1.5.9l1.4-.5 1.2 2.1-1.1.9a7 7 0 0 1 0 1.7Z" transform="translate(-1 -1) scale(.96)"/></svg>
      </button>
    </div>
  </header>

  <section class="player" aria-label="Pemutar musik">
    <div class="inner">
      <div class="eyebrow">YOUR IDOL, YOUR UNIVERSE</div>
      <div class="cover-wrap">
        <div class="cover-glow"></div>
        <div class="cover">
          <img id="coverImage" alt="Sampul lagu" hidden>
          <div class="cover-fallback" id="coverFallback"><div class="big-star">✦</div><strong>HOSHINO AI</strong><small>SHINING FOREVER ♡</small></div>
          <div class="cover-label">✧ HOSHINO EDITION</div>
        </div>
      </div>
      <div class="song-row">
        <div class="song-info">
          <div class="song-title" id="songTitle">Starlight Memories</div>
          <div class="song-artist" id="songArtist">Hoshino Ai · Demo Track</div>
          <div class="song-tag">✦ <span id="songAlbum">Dreamy night collection</span></div>
        </div>
        <button class="fav" id="favoriteBtn" aria-label="Tambahkan ke favorit" aria-pressed="false" title="Favorit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.8 5.8a5 5 0 0 0-7.1 0L12 7.5l-1.7-1.7a5 5 0 0 0-7.1 7.1l1.7 1.7L12 21l7.1-6.4 1.7-1.7a5 5 0 0 0 0-7.1Z"/></svg>
        </button>
      </div>
      <div class="progress-wrap">
        <div class="progress" id="progress" role="slider" tabindex="0" aria-label="Posisi lagu" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="progress-fill" id="progressFill"></div>
        </div>
        <div class="times"><span id="currentTime">0:00</span><span id="duration">${durationText}</span></div>
      </div>
      <div class="controls">
        <button class="ctrl" id="shuffleBtn" aria-label="Acak lagu" title="Acak lagu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 5 0v5M4 20 21 3M21 16v5h-5M4 4l5 5m3 3 4 4"/></svg>
        </button>
        <button class="ctrl" id="prevBtn" aria-label="Lagu sebelumnya" title="Sebelumnya">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM19 6.2v11.6a1 1 0 0 1-1.5.86l-9.8-5.8a1 1 0 0 1 0-1.72l9.8-5.8a1 1 0 0 1 1.5.86Z"/></svg>
        </button>
        <button class="play" id="playBtn" aria-label="Putar" title="Putar / jeda">
          <svg id="playIcon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.6v12.8a.8.8 0 0 0 1.2.68l10-6.4a.8.8 0 0 0 0-1.36l-10-6.4A.8.8 0 0 0 8 5.6Z"/></svg>
          <svg id="pauseIcon" viewBox="0 0 24 24" fill="currentColor" hidden><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>
        </button>
        <button class="ctrl" id="nextBtn" aria-label="Lagu berikutnya" title="Berikutnya">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM5 6.2v11.6a1 1 0 0 0 1.5.86l9.8-5.8a1 1 0 0 0 0-1.72L6.5 5.34A1 1 0 0 0 5 6.2Z"/></svg>
        </button>
        <button class="ctrl" id="repeatBtn" aria-label="Ulangi lagu" title="Ulangi">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>
        </button>
      </div>
      <div class="volume-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>
        <input type="range" id="volume" min="0" max="1" step=".01" value=".8" aria-label="Volume">
        <span id="volumeLabel" style="font-size:10px;min-width:29px;text-align:right">80%</span>
      </div>

      <!-- PANEL SETTINGS BARU -->
      <div class="settings-panel" id="settingsModal">
        <div class="modal">
          <div class="modal-head"><span id="settingsTitle">✦ Customize your universe</span><button class="icon-btn" id="closeSettings" aria-label="Tutup">✕</button></div>
          <label class="field"><span>Judul lagu</span><input id="editTitle" placeholder="Judul lagu"></label>
          <label class="field"><span>Nama artis</span><input id="editArtist" placeholder="Nama artis"></label>
          <label class="field"><span>Album / subtitle</span><input id="editAlbum" placeholder="Dreamy night collection"></label>
          <label class="field"><span>URL audio langsung</span><input id="editAudio" type="url" placeholder="https://example.com/song.mp3" inputmode="url"></label>
          <label class="field"><span>URL gambar sampul</span><input id="editCover" type="url" placeholder="https://example.com/cover.jpg" inputmode="url"></label>
          <label class="field"><span>Lirik JSON bertimestamp</span><input id="editLyrics" placeholder='[{"time":0,"text":"Baris pertama"}]'></label>
          <div class="modal-actions"><button class="secondary" id="resetSettings">Reset demo</button><button class="primary" id="saveSettings">Simpan perubahan ✦</button></div>
        </div>
      </div>

    </div>
  </section>

  <section class="section" aria-label="Lirik lagu">
    <div class="section-head">
      <div class="section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> LYRICS <span style="color:var(--pink2)">♡</span></div>
      <span class="pill" id="lyricStatus">SYNC MODE</span>
    </div>
    <div class="lyrics" id="lyrics">
      <div class="lyrics-empty">Lirik akan tampil di sini ✦<br><b>Tambahkan lirik bertimestamp</b> melalui pengaturan untuk sinkronisasi otomatis.</div>
    </div>
  </section>

  <section class="section" aria-label="Daftar putar">
    <div class="section-head">
      <div class="section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg> STARLIGHT QUEUE</div>
      <span class="pill" id="queueCount">1 TRACK</span>
    </div>
    <div class="queue-list" id="queueList"></div>
  </section>
  <footer class="footer"><strong>HOSHINO AI ✦</strong><br>made with a little love, lots of stars & pink magic ♡</footer>
</main>

<div class="toast" id="toast" role="status" aria-live="polite"></div>

<audio id="audio-src" style="display:none"></audio>

<script>
(() => {
  'use strict';

  const DEFAULT_TRACKS = ${tracksJson};
  let tracks = DEFAULT_TRACKS.map(t => ({...t, lyrics:[...(t.lyrics || [])]}));
  let currentIndex = 0;
  let shuffle = false;
  let repeat = false;
  let favorites = new Set();
  let lastShuffleIndex = -1;
  let toastTimer;
  let lyrics = [];
  let lyricElements = [];
  let activeLyricIndex = -1;

  // WEB AUDIO API VARIABLES (DARI PLAY2)
  let audioCtx = null;
  let audioBuffer = null;
  let sourceNode = null;
  let isDecoded = false;
  let startCtxTime = 0;
  let pauseOffset = 0;
  let isPlaying = false;

  const $ = id => document.getElementById(id);
  const audioEl = $('audio-src');

  const els = {
    title:$('songTitle'), artist:$('songArtist'), album:$('songAlbum'),
    cover:$('coverImage'), fallback:$('coverFallback'), play:$('playBtn'),
    playIcon:$('playIcon'), pauseIcon:$('pauseIcon'), progress:$('progress'),
    fill:$('progressFill'), current:$('currentTime'), duration:$('duration'),
    lyrics:$('lyrics'), lyricStatus:$('lyricStatus'), queue:$('queueList'),
    queueCount:$('queueCount'), status:$('statusText'), favorite:$('favoriteBtn'),
    shuffle:$('shuffleBtn'), repeat:$('repeatBtn'), volume:$('volume'),
    volumeLabel:$('volumeLabel'), modal:$('settingsModal')
  };

  function toast(message) {
    const node = $('toast'); node.textContent = message; node.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 2600);
  }
  function formatTime(value) {
    const n = Number(value); if (!Number.isFinite(n) || n < 0) return '0:00';
    const sec = Math.floor(n), h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? \`\${h}:\${String(m).padStart(2,'0')}:\${String(s).padStart(2,'0')}\` : \`\${m}:\${String(s).padStart(2,'0')}\`;
  }
  function currentTrack() { return tracks[currentIndex]; }
  function safeUrl(value) {
    try { const u = new URL(String(value), location.href); return ['http:','https:','blob:','data:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
  }
  function setStatus(text) { els.status.textContent = text; }

  // --- WEB AUDIO CORE ---
  function ensureContext() {
    if (audioCtx) return audioCtx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) { setStatus('Web Audio tidak didukung'); return null; }
    audioCtx = new Ctor();
    return audioCtx;
  }

  function dataUriToArrayBuffer(dataUri) {
    const commaIndex = dataUri.indexOf(',');
    const base64 = commaIndex >= 0 ? dataUri.slice(commaIndex + 1) : dataUri;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function decodeAudio() {
    return new Promise((resolve, reject) => {
      try {
        const arrayBuffer = dataUriToArrayBuffer(audioEl.src);
        const promise = audioCtx.decodeAudioData(arrayBuffer, 
          (buffer) => { audioBuffer = buffer; isDecoded = true; resolve(buffer); },
          (err) => { reject(err || new Error('decode error')); }
        );
        if (promise && typeof promise.then === 'function') {
          promise.then((buffer) => { if (!isDecoded) { audioBuffer = buffer; isDecoded = true; resolve(buffer); } }, () => {});
        }
      } catch (err) { reject(err); }
    });
  }

  function stopSource() {
    if (sourceNode) { try { sourceNode.onended = null; sourceNode.stop(); } catch(e){} try { sourceNode.disconnect(); } catch(e){} sourceNode = null; }
  }

  function startPlayback(offset) {
    stopSource();
    sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(audioCtx.destination);
    const safeOffset = Math.max(0, Math.min(offset, audioBuffer.duration - 0.1));
    sourceNode.start(0, safeOffset);
    startCtxTime = audioCtx.currentTime - safeOffset;
    pauseOffset = safeOffset;
    isPlaying = true;
    setPlayState(true);
  }

  async function loadAndDecode() {
    if (!audioEl || !audioEl.src) return;
    setStatus('MEMUAT AUDIO...');
    try {
      const ctx = ensureContext();
      if (ctx.state === 'suspended') await ctx.resume();
      await decodeAudio();
      els.duration.textContent = formatTime(audioBuffer.duration);
      setStatus('AUDIO SIAP!');
    } catch (e) {
      setStatus('❌ GAGAL DECODE');
      toast('Audio gagal diputar.');
    }
  }

  function setPlayState(playing) {
    els.playIcon.hidden = playing; els.pauseIcon.hidden = !playing;
    if (playing) setStatus('NOW PLAYING'); else setStatus('PAUSED');
  }

  async function togglePlay() {
    if (!isDecoded) { toast('Audio belum siap...'); return; }
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();

    if (isPlaying) {
      pauseOffset = ctx.currentTime - startCtxTime;
      stopSource();
      isPlaying = false;
      setPlayState(false);
    } else {
      if (pauseOffset >= audioBuffer.duration) pauseOffset = 0;
      startPlayback(pauseOffset);
    }
    renderQueue();
  }

  // --- UI & LYRICS ---
  function renderCover(track) {
    const url = safeUrl(track.cover || '');
    if (!url) { els.cover.hidden = true; els.fallback.hidden = false; return; }
    els.cover.hidden = false; els.fallback.hidden = true;
    els.cover.onerror = () => { els.cover.hidden = true; els.fallback.hidden = false; };
    els.cover.src = url;
  }

  function renderLyrics() {
    const track = currentTrack();
    els.lyrics.replaceChildren();
    lyrics = track.lyrics || [];
    lyricElements = [];
    activeLyricIndex = -1;
    if (!lyrics.length) {
      const empty = document.createElement('div'); empty.className = 'lyrics-empty';
      empty.textContent = 'Lirik belum tersedia untuk lagu ini ✦';
      els.lyrics.appendChild(empty); els.lyricStatus.textContent = 'NO LYRICS'; return;
    }
    els.lyricStatus.textContent = 'SYNC MODE';
    lyrics.forEach((line, i) => {
      const div = document.createElement('div'); div.className = 'lyric-line';
      div.textContent = line.text; div.dataset.time = String(line.time); div.dataset.index = String(i);
      els.lyrics.appendChild(div); lyricElements.push(div);
    });
  }

  function updateLyrics(currentTime) {
    if (!lyrics.length || !lyricElements.length) return;
    let index = -1;
    for (let i = 0; i < lyrics.length; i++) { if (lyrics[i].time <= currentTime) index = i; else break; }
    if (index === activeLyricIndex) return;
    activeLyricIndex = index;
    lyricElements.forEach((el, i) => el.classList.toggle('active', i === index));
    if (index >= 0) {
      const active = lyricElements[index];
      const top = active.offsetTop - els.lyrics.offsetTop - (els.lyrics.clientHeight / 2) + active.offsetHeight / 2;
      els.lyrics.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  }

  function renderQueue() {
    els.queue.replaceChildren();
    tracks.forEach((track, index) => {
      const row = document.createElement('div');
      row.className = 'track' + (index === currentIndex ? ' current' : '');
      row.tabIndex = 0; row.setAttribute('role','button');
      const art = document.createElement('div'); art.className = 'track-art';
      art.textContent = index === currentIndex && isPlaying ? '♫' : '✦';
      const copy = document.createElement('div'); copy.className = 'track-copy';
      const title = document.createElement('div'); title.className = 'track-title'; title.textContent = track.title || 'Untitled';
      const artist = document.createElement('div'); artist.className = 'track-artist'; artist.textContent = track.artist || 'Unknown artist';
      copy.append(title,artist);
      const time = document.createElement('div'); time.className = 'track-time';
      time.textContent = index === currentIndex && isDecoded && audioBuffer ? formatTime(audioBuffer.duration) : '✧';
      row.append(art,copy,time);
      row.addEventListener('click', () => loadTrack(index, true));
      els.queue.appendChild(row);
    });
    els.queueCount.textContent = \`\${tracks.length} TRACK\${tracks.length === 1 ? '' : 'S'}\`;
  }

  function renderTrack() {
    const track = currentTrack();
    els.title.textContent = track.title || 'Untitled';
    els.artist.textContent = track.artist || 'Unknown artist';
    els.album.textContent = track.album || 'Hoshino Ai collection';
    renderCover(track); renderLyrics();
    els.fill.style.width = '0%'; els.current.textContent = '0:00'; els.duration.textContent = '0:00';
    
    // Reset Audio
    stopSource(); isPlaying = false; isDecoded = false; audioBuffer = null; pauseOffset = 0; setPlayState(false);
    
    const src = safeUrl(track.audio || '');
    audioEl.pause(); audioEl.removeAttribute('src'); audioEl.load();
    if (src) { audioEl.src = src; audioEl.load(); loadAndDecode(); }
    
    renderQueue();
  }

  function loadTrack(index, autoplay = false) {
    if (!tracks.length) return;
    currentIndex = (index + tracks.length) % tracks.length;
    renderTrack();
    if (autoplay) setTimeout(() => { if (isDecoded) togglePlay(); }, 500);
  }

  function updateProgress() {
    if (!isDecoded || !isPlaying) return;
    const current = Math.max(0, Math.min(audioBuffer.duration, audioCtx.currentTime - startCtxTime));
    const pct = (current / audioBuffer.duration) * 100;
    els.fill.style.width = pct + '%';
    els.current.textContent = formatTime(current);
    updateLyrics(current);
    if (current >= audioBuffer.duration - 0.1) { stopSource(); isPlaying = false; setPlayState(false); }
  }
  setInterval(updateProgress, 250);

  function seekTo(time) {
    if (!isDecoded) return;
    time = Math.max(0, Math.min(audioBuffer.duration, time));
    if (isPlaying) startPlayback(time); else pauseOffset = time;
    updateProgress();
  }

  function seek(clientX) {
    if (!isDecoded) return;
    const rect = els.progress.getBoundingClientRect();
    seekTo(Math.max(0,Math.min(1,(clientX - rect.left)/rect.width)) * audioBuffer.duration);
  }

  let seeking = false;
  els.progress.addEventListener('pointerdown', e => { if (!isDecoded) return; seeking = true; els.progress.setPointerCapture?.(e.pointerId); seek(e.clientX); });
  els.progress.addEventListener('pointermove', e => { if (seeking) seek(e.clientX); });
  els.progress.addEventListener('pointerup', () => { seeking = false; });

  els.play.addEventListener('click', togglePlay);
  $('nextBtn').addEventListener('click', () => loadTrack(currentIndex + 1, true));
  $('prevBtn').addEventListener('click', () => loadTrack(currentIndex - 1, true));

  els.volume.addEventListener('input', () => {
    els.volumeLabel.textContent = \`\${Math.round(Number(els.volume.value)*100)}%\`;
  });

  // Settings Panel Logic (Fixed)
  $('openSettings').addEventListener('click', () => {
    const track = currentTrack();
    $('editTitle').value = track.title || '';
    $('editArtist').value = track.artist || '';
    $('editAlbum').value = track.album || '';
    $('editAudio').value = track.audio || '';
    $('editCover').value = track.cover || '';
    $('editLyrics').value = JSON.stringify(track.lyrics || []);
    els.modal.style.display = 'block';
  });

  $('closeSettings').addEventListener('click', () => {
    els.modal.style.display = 'none';
  });

  $('saveSettings').addEventListener('click', () => {
    const audioUrl = $('editAudio').value.trim();
    const coverUrl = $('editCover').value.trim();
    if (audioUrl && !safeUrl(audioUrl)) { toast('URL audio tidak valid.'); return; }
    if (coverUrl && !safeUrl(coverUrl)) { toast('URL cover tidak valid.'); return; }
    let parsedLyrics;
    try { parsedLyrics = JSON.parse($('editLyrics').value || '[]'); }
    catch (e) { toast('Format lirik JSON belum valid.'); return; }
    
    tracks[currentIndex] = {
      ...currentTrack(),
      title: $('editTitle').value.trim() || 'Untitled',
      artist: $('editArtist').value.trim() || 'Unknown artist',
      album: $('editAlbum').value.trim() || 'Hoshino Ai collection',
      audio: audioUrl, cover: coverUrl, lyrics: parsedLyrics
    };
    els.modal.style.display = 'none';
    renderTrack();
    toast('Universe berhasil diperbarui ✦');
  });

  $('resetSettings').addEventListener('click', () => {
    tracks = DEFAULT_TRACKS.map(t => ({...t,lyrics:[...(t.lyrics || [])]}));
    currentIndex = 0; favorites.clear(); shuffle = false; repeat = false;
    els.modal.style.display = 'none'; 
    renderTrack(); toast('Demo berhasil direset ♡');
  });

  renderTrack();
})();
</script>
</body>
</html>
`
}

/* =========================================================
 * MESSAGE SENDER
 * ========================================================= */
async function sendMusicPlayer(sock, m, html) {
    const responseId = randomUUID()
    await sock.relayMessage(
        m.chat,
        {
            messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2, botMetadata: { messageDisclaimerText: '', botResponseId: responseId } },
            botForwardedMessage: {
                message: {
                    richResponseMessage: {
                        messageType: 1,
                        submessages: [{ messageType: 2, messageText: 'Music Player' }],
                        unifiedResponse: {
                            data: Buffer.from(JSON.stringify({
                                response_id: responseId,
                                sections: [{ view_model: { primitive: { __typename: 'GenAIaeacdsnwHtmlPrimitive', payload: html, trusted_sources: [] }, __typename: 'GenAISingleLayoutViewModel' } }]
                            })).toString('base64')
                        },
                        contextInfo: { forwardingScore: 1, isForwarded: true, forwardedAiBotMessageInfo: { botJid: '0@bot' }, forwardOrigin: 4 }
                    }
                }
            }
        },
        { messageId: responseId }
    )
}

/* =========================================================
 * HANDLER UTAMA
 * ========================================================= */
async function handler(m, { sock }) {
    const text = m.text?.trim()
    if (!text) return m.reply(`📦 *ᴘʟᴀʏ3* 🎤\n\n> ${m.prefix}play3 <judul lagu>`)

    await m.react('🎧')

    try {
        let ytUrl = text
        let title = 'Unknown', artist = 'Unknown Artist', duration = '0:00', durationSec = 0, thumbUrl = '', trackIdForLyrics = null, album = ''

        if (!/youtube\.com|youtu\.be/i.test(text)) {
            const ytm = await getYTMusic()
            const songs = await ytm.search(text)
            const track = songs.find(s => s.type === 'SONG') || songs[0]
            if (!track || !track.videoId) throw new Error('Lagu tidak ditemukan di YT Music')
            trackIdForLyrics = track.videoId
            ytUrl = `https://www.youtube.com/watch?v=${track.videoId}`
            title = track.name || track.title || 'Unknown'
            artist = track.artists?.length ? track.artists.map(a => a.name).join(', ') : (track.artist?.name || 'Unknown Artist')
            durationSec = Number(track.duration || 0)
            duration = formatDuration(durationSec)
            if (track.thumbnails?.length) thumbUrl = track.thumbnails[track.thumbnails.length - 1].url
            album = track.album?.name || track.album?.title || ''
        } else {
            const detail = await yts(ytUrl)
            const vid = detail?.videos?.[0]
            if (!vid) throw new Error('Video tidak ditemukan')
            title = vid.title || 'Unknown'
            artist = vid.author?.name || 'YouTube'
            duration = vid.timestamp || '0:00'
            durationSec = secondsFromTimestamp(duration)
            thumbUrl = vid.thumbnail
            const match = ytUrl.match(/(?:v=|shorts\/|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)
            if (match) trackIdForLyrics = match[1]
        }

        // --- 2. CARI LIRIK & UPDATE METADATA DARI LRCLIB ---
let syncedLyrics = []
const lrclib = await getLRCLyrics({ title, artist, duration: durationSec, album })

// Ini trik biar album & artis selalu dapet
if (lrclib) {
    if (lrclib.albumName) album = lrclib.albumName // Timpa album kalau di LRCLIB ada
    if (lrclib.artistName && (!artist || artist === 'YouTube')) artist = lrclib.artistName // Timpa kalau artisnya cuma "YouTube"
}

if (lrclib?.syncedLyrics) syncedLyrics = parseSyncedLyrics(lrclib.syncedLyrics)
if (!syncedLyrics.length && lrclib?.plainLyrics) syncedLyrics = plainLyricsToSynced(lrclib.plainLyrics, durationSec)
syncedLyrics = normalizeLyrics(syncedLyrics)

        const thumb = await getThumb(thumbUrl)
        const imageSrc = thumb?.length ? `data:image/jpeg;base64,${thumb.toString('base64')}` : ''

        const audioInfo = await getAudioUrlWithFallback(ytUrl)
        const originalBuffer = await downloadAudioBuffer(audioInfo.url)

        if (!looksLikeAudio(originalBuffer)) throw new Error('Server download ngasih data aneh (bukan audio).')

        // KOMPRES PAKAI METODE PLAY2 (WEBM)
        const compressed = await compressWithFallback(originalBuffer, title)
        const audioSrc = `data:${FFMPEG_MIME};base64,${compressed.buf.toString('base64')}`

        console.log('[play3] audio KB:', Math.round(compressed.buf.length / 1024), '| html KB:', Math.round(Buffer.byteLength(audioSrc) / 1024))

        const html = createMusicPlayer({
            title, artist, album,
            duration: audioInfo.duration || duration,
            audioSrc, imageSrc, lyrics: syncedLyrics
        })

        await sendMusicPlayer(sock, m, html)
        await m.react('✅')
    } catch (error) {
        console.error('[play3] Error:', error)
        await m.react('❌')
        return m.reply(`❌ *Gagal*: ${error?.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}