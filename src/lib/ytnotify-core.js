const axios = require('axios')
const fs = require('fs')
const path = require('path')
const config = require('../../config.js')

const DATA_DIR = path.join(process.cwd(), 'src', 'data')
const SENT_FILE = path.join(DATA_DIR, 'ytnotify_sent.json')
const STATE_FILE = path.join(DATA_DIR, 'ytnotify_state.json')
const API_BASE = 'https://www.googleapis.com/youtube/v3'

function getApiKey() {
    return config.APIkey?.youtube || ''
}

function loadSent() {
    try {
        if (!fs.existsSync(SENT_FILE)) return new Set()
        return new Set(JSON.parse(fs.readFileSync(SENT_FILE, 'utf8')))
    } catch {
        return new Set()
    }
}

function saveSent(sentSet) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
        // Batasi ukuran file biar gak membengkak tanpa henti
        const arr = [...sentSet].slice(-3000)
        fs.writeFileSync(SENT_FILE, JSON.stringify(arr, null, 2))
    } catch (e) {
        console.error('[YTNotify] Gagal simpan sent:', e.message)
    }
}

function loadState() {
    try {
        if (!fs.existsSync(STATE_FILE)) {
            return { enabled: false, groups: [], salurans: [], channels: [], interval: 10 }
        }
        const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
        return {
            enabled: data.enabled || false,
            groups: data.groups || [],
            salurans: data.salurans || [],
            channels: data.channels || [],
            interval: data.interval || 10
        }
    } catch {
        return { enabled: false, groups: [], salurans: [], channels: [], interval: 10 }
    }
}

function saveState(state) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
    } catch (e) {
        console.error('[YTNotify] Gagal simpan state:', e.message)
    }
}

/**
 * Mengubah berbagai bentuk input (URL channel, @handle, username lama, atau
 * channel ID langsung) menjadi channel ID YouTube yang valid (diawali "UC").
 */
async function resolveChannelId(input) {
    const apiKey = getApiKey()
    if (!apiKey) throw new Error('API key YouTube belum diatur di config.js (APIkey.youtube)')

    let raw = input.trim()

    const urlMatch = raw.match(/youtube\.com\/(channel\/|c\/|user\/|@)([^/?&\s]+)/i)
    if (urlMatch) {
        const kind = urlMatch[1]
        const value = urlMatch[2]
        raw = kind === '@' ? `@${value.replace(/^@/, '')}` : value
    }

    // Channel ID asli selalu diawali "UC" + total 24 karakter
    if (/^UC[a-zA-Z0-9_-]{22}$/.test(raw)) {
        return raw
    }

    // Coba sebagai handle (@nama) — cara resmi terbaru YouTube
    const handle = raw.startsWith('@') ? raw : `@${raw}`
    try {
        const res = await axios.get(`${API_BASE}/channels`, {
            params: { part: 'id', forHandle: handle, key: apiKey },
            timeout: 15000
        })
        const item = res.data?.items?.[0]
        if (item?.id) return item.id
    } catch {
        // lanjut coba cara lain
    }

    // Coba sebagai username lama (legacy, banyak channel lama masih pakai ini)
    try {
        const res = await axios.get(`${API_BASE}/channels`, {
            params: { part: 'id', forUsername: raw.replace(/^@/, ''), key: apiKey },
            timeout: 15000
        })
        const item = res.data?.items?.[0]
        if (item?.id) return item.id
    } catch {
        // lanjut ke pencarian
    }

    // Fallback terakhir: search (lebih boros quota API, dipakai seperlunya saja)
    try {
        const res = await axios.get(`${API_BASE}/search`, {
            params: { part: 'snippet', type: 'channel', q: raw, maxResults: 1, key: apiKey },
            timeout: 15000
        })
        const item = res.data?.items?.[0]
        if (item?.snippet?.channelId) return item.snippet.channelId
    } catch {
        // biarkan return null di bawah
    }

    return null
}

async function getChannelInfo(channelId) {
    const apiKey = getApiKey()
    if (!apiKey) throw new Error('API key YouTube belum diatur di config.js (APIkey.youtube)')

    const res = await axios.get(`${API_BASE}/channels`, {
        params: { part: 'snippet,contentDetails', id: channelId, key: apiKey },
        timeout: 15000
    })
    const item = res.data?.items?.[0]
    if (!item) return null

    return {
        channelId,
        title: item.snippet?.title || channelId,
        thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '',
        uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads || null
    }
}

async function getLatestVideos(uploadsPlaylistId, maxResults = 5) {
    const apiKey = getApiKey()
    const res = await axios.get(`${API_BASE}/playlistItems`, {
        params: { part: 'snippet,contentDetails', playlistId: uploadsPlaylistId, maxResults, key: apiKey },
        timeout: 15000
    })
    const items = res.data?.items || []
    return items
        .map(it => ({
            videoId: it.contentDetails?.videoId,
            title: it.snippet?.title || '',
            publishedAt: it.contentDetails?.videoPublishedAt || it.snippet?.publishedAt || null,
            thumbnail:
                it.snippet?.thumbnails?.high?.url ||
                it.snippet?.thumbnails?.medium?.url ||
                it.snippet?.thumbnails?.default?.url ||
                ''
        }))
        .filter(v => v.videoId)
}

let globalSock = null
let autoInterval = null
let isRunning = false

async function notifyNewVideo(sock, groupIds, salurantIds, channel, video) {
    const url = `https://youtube.com/watch?v=${video.videoId}`
    const caption =
        `🔔 *VIDEO BARU!* 📺\n\n` +
        `📢 Channel: *${channel.title}*\n` +
        `🎬 Judul: ${video.title}`
    const captionWithLink = `${caption}\n\n▶️ ${url}`

    let thumbBuffer = null
    const thumbUrl = video.thumbnail || channel.thumbnail
    if (thumbUrl) {
        try {
            const res = await axios.get(thumbUrl, { responseType: 'arraybuffer', timeout: 15000 })
            thumbBuffer = Buffer.from(res.data)
        } catch (e) {
            console.log(`[YTNotify] ⚠️ Thumbnail gagal: ${e.message}`)
        }
    }

    // ── Grup: pakai tombol interaktif ──
    for (const gid of groupIds) {
        try {
            const msgPayload = thumbBuffer
                ? { image: thumbBuffer, caption, footer: 'Klik tombol di bawah untuk nonton 👇' }
                : { text: caption, footer: 'Klik tombol di bawah untuk nonton 👇' }

            await sock.sendMessage(gid, {
                ...msgPayload,
                interactiveButtons: [
                    {
                        name: 'cta_url',
                        buttonParamsJson: JSON.stringify({
                            display_text: '▶️ Tonton Video',
                            url
                        })
                    }
                ]
            })
            console.log(`[YTNotify] ✅ Notified (grup) ${gid}: ${channel.title} - ${video.title}`)
            await new Promise(r => setTimeout(r, 3000))
        } catch (e) {
            console.error(`[YTNotify] ❌ Send error ${gid}:`, e.message)
        }
    }

    // ── Saluran: tanpa tombol, link langsung di teks ──
    for (const sid of salurantIds) {
        try {
            const msgPayload = thumbBuffer
                ? { image: thumbBuffer, caption: captionWithLink }
                : { text: captionWithLink }

            await sock.sendMessage(sid, msgPayload)
            console.log(`[YTNotify] ✅ Notified (saluran) ${sid}: ${channel.title} - ${video.title}`)
            await new Promise(r => setTimeout(r, 3000))
        } catch (e) {
            console.error(`[YTNotify] ❌ Send error ${sid}:`, e.message)
        }
    }
}

async function runCheck() {
    const state = loadState()
    const groups = state.groups || []
    const salurans = state.salurans || []
    const destIds = [...groups, ...salurans]
    const channels = state.channels || []

    if (destIds.length === 0) {
        console.log('[YTNotify] ⚠️ No target groups/salurans configured')
        return { error: 'no_targets', results: [] }
    }
    if (channels.length === 0) {
        console.log('[YTNotify] ⚠️ No channels configured')
        return { error: 'no_channels', results: [] }
    }

    const apiKey = getApiKey()
    if (!apiKey) {
        return { error: 'no_apikey', results: [] }
    }

    const sent = loadSent()
    console.log(`[YTNotify] 🔍 Check: ${new Date().toLocaleString('id-ID')}`)

    const results = []

    for (const channel of channels) {
        const entry = { title: channel.title, status: null, video: null }
        try {
            if (!channel.uploadsPlaylistId) {
                entry.status = 'no_playlist'
                results.push(entry)
                continue
            }

            const videos = await getLatestVideos(channel.uploadsPlaylistId, 5)
            if (videos.length === 0) {
                entry.status = 'no_video'
                results.push(entry)
                continue
            }

            // Urutkan terbaru dulu berdasar publishedAt, ambil yang belum pernah dikirim
            videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
            const newVideo = videos.find(v => !sent.has(v.videoId))

            if (!newVideo) {
                entry.status = 'already_sent'
                entry.video = videos[0]?.title || null
                results.push(entry)
                continue
            }

            entry.video = newVideo.title

            await notifyNewVideo(globalSock, groups, salurans, channel, newVideo)

            sent.add(newVideo.videoId)
            saveSent(sent)
            entry.status = 'sent'
            results.push(entry)

            await new Promise(r => setTimeout(r, 2000))
        } catch (e) {
            entry.status = 'error'
            entry.detail = e.message
            results.push(entry)
            console.error(`[YTNotify] ❌ Error ${channel.title}:`, e.message)
        }
    }

    console.log('[YTNotify] ✅ Check complete')
    return { error: null, results }
}

function startAutoCheck(sock, intervalMinutes = 10) {
    if (autoInterval) clearInterval(autoInterval)
    globalSock = sock
    isRunning = true

    const ms = intervalMinutes * 60 * 1000
    runCheck().catch(e => console.error('[YTNotify]', e.message))
    autoInterval = setInterval(() => {
        runCheck().catch(e => console.error('[YTNotify]', e.message))
    }, ms)

    if (autoInterval.unref) autoInterval.unref()
}

function stopAutoCheck() {
    if (autoInterval) clearInterval(autoInterval)
    autoInterval = null
    isRunning = false
}

function initAutoStart(sock) {
    const state = loadState()
    if (!state.enabled) return
    console.log('[YTNotify] 🔄 Auto-restore enabled')
    startAutoCheck(sock, state.interval || 10)
}

module.exports = {
    loadSent,
    saveSent,
    loadState,
    saveState,
    resolveChannelId,
    getChannelInfo,
    getLatestVideos,
    notifyNewVideo,
    startAutoCheck,
    stopAutoCheck,
    initAutoStart,
    runCheck,
    get isRunning() { return isRunning }
}