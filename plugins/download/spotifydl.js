const { f } = require("../../src/lib/undici")

const pluginConfig = {
    name: 'spotifydl',
    alias: ['spdl', 'spotify-dl', 'spotdl'],
    category: 'download',
    description: 'Download lagu dari Spotify',
    usage: '.spdl <url>',
    example: '.spdl https://open.spotify.com/track/xxx',
    cooldown: 15,
    energi: 1,
    isEnabled: true
}

// ==================== SPOTISAVER FALLBACK ====================
const SPOTISAVER_BASE = "https://spotisaver.net"
const SPOTISAVER_MAX_RETRY = 5
const SPOTISAVER_RETRY_DELAYS = [5000, 8000, 12000, 18000, 25000]
const SPOTISAVER_UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36"

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function spotisaverCleanInput(input) {
    return String(input || "")
        .trim()
        .replace(/%0A/gi, "")
        .replace(/%0D/gi, "")
        .replace(/\r|\n/g, "")
}

function spotisaverRandomIp() {
    return [
        Math.floor(Math.random() * 223) + 1,
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256)
    ].join(".")
}

function spotisaverParse(input) {
    const cleaned = spotisaverCleanInput(input)
    const url = new URL(cleaned)
    const parts = url.pathname.split("/").filter(Boolean)
    return {
        raw: cleaned,
        type: parts[0] || "track",
        id: parts[1] || cleaned
    }
}

function spotisaverSafeName(name) {
    return String(name || "spotify-audio.mp3")
        .replace(/[\\/:*?"<>|]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180)
}

function spotisaverJsonBase64(data) {
    return Buffer.from(JSON.stringify(data)).toString("base64")
}

function getFilenameFromDisposition(disposition) {
    if (!disposition) return null
    const utf = disposition.match(/filename\*=UTF-8''([^;]+)/i)
    if (utf?.[1]) return decodeURIComponent(utf[1].replace(/^"|"$/g, ""))
    const normal = disposition.match(/filename="([^"]+)"/i)
    if (normal?.[1]) return normal[1]
    return null
}

class SpotisaverSession {
    constructor() {
        this.cookies = {
            "_s-uid": `v_${Math.random().toString(16).slice(2, 16)}.${Math.floor(Math.random() * 100000000)}`,
            lang: "en"
        }
    }

    cookieHeader() {
        return Object.entries(this.cookies)
            .filter(([, v]) => v !== undefined && v !== null && String(v).length)
            .map(([k, v]) => `${k}=${v}`)
            .join("; ")
    }

    splitSetCookie(value) {
        if (!value) return []
        return value.split(/,(?=\s*[^;,=\s]+=[^;,]+)/g)
    }

    saveCookies(headers) {
        const raw = typeof headers.getSetCookie === "function"
            ? headers.getSetCookie()
            : this.splitSetCookie(headers.get("set-cookie"))

        for (const item of raw) {
            const part = item.split(";")[0]
            const i = part.indexOf("=")
            if (i > -1) this.cookies[part.slice(0, i)] = part.slice(i + 1)
        }
    }

    async warmup(parsed) {
        const urls = [
            `${SPOTISAVER_BASE}/en1`,
            `${SPOTISAVER_BASE}/en/${parsed.type}/${parsed.id}/`
        ]

        for (const url of urls) {
            const res = await fetch(url, {
                method: "GET",
                signal: AbortSignal.timeout(60000),
                headers: {
                    "user-agent": SPOTISAVER_UA,
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
                    "cookie": this.cookieHeader()
                }
            }).catch(() => null)

            if (res) {
                this.saveCookies(res.headers)
                await res.arrayBuffer().catch(() => null)
            }
        }
    }

    async requestJson(url, extraHeaders = {}, referer) {
        const res = await fetch(url, {
            method: "GET",
            signal: AbortSignal.timeout(60000),
            headers: {
                "user-agent": SPOTISAVER_UA,
                "accept": "application/json",
                "sec-ch-ua-platform": "\"Android\"",
                "sec-ch-ua": "\"Google Chrome\";v=\"147\", \"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"147\"",
                "sec-ch-ua-mobile": "?1",
                "sec-fetch-site": "same-origin",
                "sec-fetch-mode": "cors",
                "sec-fetch-dest": "empty",
                "referer": referer,
                "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
                "cookie": this.cookieHeader(),
                "priority": "u=1, i",
                ...extraHeaders
            }
        })

        this.saveCookies(res.headers)
        const text = await res.text()
        let data = null
        try { data = JSON.parse(text) } catch {}

        return { code: res.status, ok: res.ok, contentType: res.headers.get("content-type") || "", text, data }
    }

    async requestDownloadOnce(url, body, referer) {
        const res = await fetch(url, {
            method: "POST",
            signal: AbortSignal.timeout(120000),
            headers: {
                "user-agent": SPOTISAVER_UA,
                "sec-ch-ua-platform": "\"Android\"",
                "sec-ch-ua": "\"Google Chrome\";v=\"147\", \"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"147\"",
                "sec-ch-ua-mobile": "?1",
                "content-type": "application/json",
                "accept": "*/*",
                "origin": SPOTISAVER_BASE,
                "sec-fetch-site": "same-origin",
                "sec-fetch-mode": "cors",
                "sec-fetch-dest": "empty",
                "referer": referer,
                "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
                "cookie": this.cookieHeader(),
                "priority": "u=1, i"
            },
            body: JSON.stringify(body)
        })

        this.saveCookies(res.headers)
        const contentType = res.headers.get("content-type") || ""
        const disposition = res.headers.get("content-disposition") || ""
        const buffer = Buffer.from(await res.arrayBuffer())

        let json = null
        const text = buffer.toString("utf8")
        if (contentType.includes("application/json") || text.trim().startsWith("{")) {
            try { json = JSON.parse(text) } catch {}
        }

        return { code: res.status, ok: res.ok, contentType, disposition, buffer, text, json }
    }

    async requestDownload(url, body, referer) {
        for (let attempt = 1; attempt <= SPOTISAVER_MAX_RETRY; attempt++) {
            const dl = await this.requestDownloadOnce(url, body, referer)
            const noSlots = dl.json?.error === "No available slots" || dl.text.includes("No available slots")

            if (dl.ok && dl.contentType.includes("audio")) return dl
            if (!noSlots || attempt >= SPOTISAVER_MAX_RETRY) return dl

            await sleep(SPOTISAVER_RETRY_DELAYS[attempt - 1] || 25000)
        }
    }

    async getSignature(action, ctxPayload, referer) {
        const ctx = spotisaverJsonBase64(ctxPayload)
        const url = `${SPOTISAVER_BASE}/api/get_signature.php?action=${encodeURIComponent(action)}&ctx=${encodeURIComponent(ctx)}`
        return await this.requestJson(url, {}, referer)
    }
}

async function viaSpotisaver(spotifyUrl) {
    const session = new SpotisaverSession()
    const parsed = spotisaverParse(spotifyUrl)
    const pageReferer = `${SPOTISAVER_BASE}/en/${parsed.type}/${parsed.id}/`

    await session.warmup(parsed)

    const playlistSig = await session.getSignature("get_playlist", {
        id: parsed.id,
        type: parsed.type,
        lang: "en"
    }, pageReferer)

    if (!playlistSig.ok || !playlistSig.data?.success || !playlistSig.data?.token || !playlistSig.data?.exp)
        throw new Error("Spotisaver: gagal ambil signature playlist")

    const playlistUrl = `${SPOTISAVER_BASE}/api/get_playlist.php?id=${encodeURIComponent(parsed.id)}&type=${encodeURIComponent(parsed.type)}&lang=en`

    const playlist = await session.requestJson(playlistUrl, {
        "x-pe": String(playlistSig.data.exp),
        "x-pt": String(playlistSig.data.token)
    }, pageReferer)

    if (!playlist.ok || !playlist.data?.tracks?.length)
        throw new Error("Spotisaver: track tidak ditemukan")

    const info = playlist.data.playlist_info || {}
    const track = playlist.data.tracks[0]
    const realTrackId = track.id || parsed.id
    const realReferer = `${SPOTISAVER_BASE}/en/track/${realTrackId}/`

    const downloadCtx = {
        lang: "en",
        id: String(realTrackId),
        name: String(track.name || ""),
        duration_ms: String(track.duration_ms || "")
    }

    const downloadSig = await session.getSignature("download_track", downloadCtx, realReferer)

    if (!downloadSig.ok || !downloadSig.data?.success || !downloadSig.data?.token || !downloadSig.data?.exp)
        throw new Error("Spotisaver: gagal ambil signature download")

    const sigPayload = spotisaverJsonBase64({
        token: String(downloadSig.data.token),
        exp: String(downloadSig.data.exp)
    })

    const dlUrl = `${SPOTISAVER_BASE}/api/download_track.php?sig=${encodeURIComponent(sigPayload)}`

    const body = {
        track,
        download_dir: "downloads",
        filename_tag: "HOSHINOAI",
        user_ip: spotisaverRandomIp(),
        is_premium: false,
        lang: "en"
    }

    const dl = await session.requestDownload(dlUrl, body, realReferer)

    if (!dl || !dl.ok || !dl.contentType.includes("audio"))
        throw new Error("Spotisaver: gagal download audio (server penuh / error)")

    const headerName = getFilenameFromDisposition(dl.disposition)
    const filename = spotisaverSafeName(headerName || `${track.artists?.join(", ") || info.owner || "Spotify"} - ${track.name || info.name || realTrackId}.mp3`)

    return {
        title: track.name || info.name || "Unknown Title",
        artist: track.artists?.length ? track.artists : [info.owner || "Unknown Artist"],
        thumbnail: track.image?.url || info.images?.[0]?.url || null,
        filename,
        buffer: dl.buffer
    }
}
// ==================== END SPOTISAVER FALLBACK ====================

async function handler(m, { sock }) {
    const url = m.text?.trim()

    if (!url)
        return m.reply(
            `🎵 *sᴘᴏᴛɪꜰʏ ᴅᴏᴡɴʟᴏᴀᴅ*\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
            `┃ \`${m.prefix}spdl <url>\`\n` +
            `╰┈┈⬡`
        )

    if (!/open\.spotify\.com\/track/i.test(url))
        return m.reply('❌ *Ehh~* URL tidak valid~ 🥺')

    m.react('🕕')

    // ---- Primary: nexray ----
    try {
        const dl = await f(`https://api.nexray.web.id/downloader/v1/spotify?url=${encodeURIComponent(url)}`)

        if (dl?.result?.url) {
            await sock.sendMedia(m.chat, dl.result.url, null, m, {
                type: 'audio',
                mimetype: 'audio/mpeg',
                fileName: `${dl.result.artist[0]} - ${dl.result.title}.mp3`
            })
            return m.react('✅')
        }

        throw new Error('nexray: response kosong / tidak valid')
    } catch (primaryErr) {
        // ---- Fallback: spotisaver ----
        try {
            const res = await viaSpotisaver(url)

            await sock.sendMedia(m.chat, res.buffer, null, m, {
                type: 'audio',
                mimetype: 'audio/mpeg',
                fileName: res.filename
            })

            m.react('✅')
        } catch (fallbackErr) {
            m.react('❌')
            m.reply(
                `❌ *ɢᴀɢᴀʟ*\n\n` +
                `╭┈┈⬡「 ⚠️ *ᴇʀʀᴏʀ* 」\n` +
                `┃ Primary: ${primaryErr.message}\n` +
                `┃ Fallback: ${fallbackErr.message}\n` +
                `╰┈┈⬡`
            )
        }
    }
}

module.exports = {
    config: pluginConfig,
    handler
}