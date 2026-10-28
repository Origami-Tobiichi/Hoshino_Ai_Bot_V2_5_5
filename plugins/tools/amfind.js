/*
# Name : Preset AlightMotion Finder
# Type : CJS
# Primary API : Rin API - /search/amfinder
# Fallback API : BintangAPI
# Penyesuaian : SeaPRST
*/

const axios = require('axios')
const sharp = require('sharp')

// ===== CONFIG =====
const pluginConfig = {
    name: 'amfind',
    alias: ['amfinder'],
    category: 'tools',
description: 'Cari preset Alight Motion dari link video',
usage: '.amfind <link video>',
    example: '.amfind https://www.youtube.com/watch?v=xxxx',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'

const RIN_API = 'https://apiii-xrina.my.id/search/amfinder'
const BINTANG_API = 'https://bintangapi.my.id/api/amfind/'

// ===== HELPER =====
function formatNumber(number) {
    const num = Number(number)
    return Number.isFinite(num) ? num.toLocaleString('id-ID') : '0'
}

async function react(sock, m, emoji) {
    try {
        await sock.sendMessage(m.chat, {
            react: { text: emoji, key: m.key }
        })
    } catch {}
}

function isValidVideoUrl(url) {
    try {
        const parsed = new URL(url)
        if (!['http:', 'https:'].includes(parsed.protocol)) return false

        return /(^|\.)tiktok\.com$|(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)instagram\.com$/i.test(parsed.hostname)
    } catch {
        return false
    }
}

function normalizeRin(response) {
    if (response?.status !== true || !response?.data) {
        throw new Error(
            response?.message ||
            response?.error ||
            'Rin API tidak menemukan preset.'
        )
    }

    const d = response.data
    const v = d.video || {}
    const stats = v.stats || {}
    const links = Array.isArray(d.presetLinks) ? d.presetLinks : []

    if (!links.length) {
        throw new Error('Rin API tidak menemukan link preset.')
    }

    return {
        source: 'Rin API',
        platform: d.platform || 'video',
        author: d.author || '-',
        username: '',
        title: v.title || '-',
        caption: v.description || v.title || '-',
        url: v.url || '',
        cover: v.cover || d.avatar || null,
        views: stats.views ?? 0,
        likes: stats.likes ?? 0,
        comments: stats.comments ?? 0,
        duration: v.duration ?? null,
        links: links.map(item => ({
            label: item.title || item.type || 'Preset',
            url: item.url,
            type: item.type || '',
            size: item.size || '',
            thumb: item.thumb || null
        })).filter(item => item.url),
        raw: d
    }
}

function normalizeBintang(response) {
    if (!response?.success || !response?.data) {
        throw new Error(
            response?.error || 'BintangAPI tidak menemukan preset.'
        )
    }

    const d = response.data
    const v = d.video || {}
    const u = d.user || {}
    const p = d.preset || {}
    const items = Array.isArray(p.items) ? p.items : []

    const views = v.views ?? v.play_count ?? v.playCount ?? d.views ?? 0
    const likes = v.likes ?? v.digg_count ?? v.diggCount ?? d.likes ?? 0
    const comments = v.comments ?? v.comment_count ?? v.commentCount ?? d.comments ?? 0

    if (!items.some(item => item?.url)) {
        throw new Error('BintangAPI tidak menemukan link preset.')
    }

    return {
        source: 'BintangAPI',
        platform: 'tiktok',
        author: u.display_name || '-',
        username: u.username || '',
        title: v.title || v.caption || '-',
        caption: v.caption || '-',
        url: v.url || '',
        cover: v.cover || v.origin_cover || v.dynamic_cover || d.thumbnail || null,
        views,
        likes,
        comments,
        duration: v.duration ?? null,
        links: items.map(item => ({
            label: item.label || 'Preset',
            url: item.url,
            type: '',
            size: '',
            thumb: null
        })).filter(item => item.url),
        raw: d
    }
}

// ===== API UTAMA + FALLBACK =====
async function searchPreset(url) {
    // 1. Coba Rin API terlebih dahulu
    try {
        console.log('[AMFIND] Mencoba Rin API...')

        const { data } = await axios.get(RIN_API, {
            params: { url },
            timeout: 30000,
            headers: {
                Accept: 'application/json',
                'User-Agent': UA
            }
        })

        const result = normalizeRin(data)
        console.log('[AMFIND] Berhasil melalui Rin API')
        return result
    } catch (err) {
        console.error(
            '[AMFIND] Rin API gagal:',
            err.response?.data || err.message
        )
    }

    // 2. Jika Rin gagal, coba BintangAPI
    try {
        console.log('[AMFIND] Mencoba fallback BintangAPI...')

        const finalUrl = await resolveTikTok(url).catch(() => url)

        const { data } = await axios.get(BINTANG_API, {
            params: { url: finalUrl },
            timeout: 30000,
            headers: {
                Accept: '*/*',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                Origin: 'https://starlabs.biz.id',
                Referer: 'https://starlabs.biz.id/',
                'User-Agent': UA
            }
        })

        const result = normalizeBintang(data)
        console.log('[AMFIND] Berhasil melalui BintangAPI')
        return result
    } catch (err) {
        console.error(
            '[AMFIND] BintangAPI gagal:',
            err.response?.data || err.message
        )
        throw new Error('Kedua API gagal mendapatkan preset.')
    }
}

// ===== RESOLVE LINK TIKTOK =====
const FULL_URL = /(https?:\/\/[^/]*tiktok\.com\/@[^/]+\/(?:video|photo)\/\d+)/i

async function resolveTikTok(url) {
    const direct = url.match(FULL_URL)
    if (direct) return direct[1]

    let current = url

    for (let i = 0; i < 5; i++) {
        const response = await axios.get(current, {
            maxRedirects: 0,
            validateStatus: () => true,
            timeout: 12000,
            headers: { 'User-Agent': UA }
        })

        const location = response.headers?.location

        if (
            response.status >= 300 &&
            response.status < 400 &&
            location
        ) {
            current = new URL(location, current).href
            continue
        }

        break
    }

    const match = current.match(FULL_URL)
    return match ? match[1] : current
}

// ===== THUMBNAIL =====
async function getThumbnail(result, pageUrl) {
    const candidates = []
    const add = url => {
        if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
            candidates.push(url)
        }
    }

    add(result.cover)

    for (const item of result.links || []) {
        add(item.thumb)
    }

    // Ambil thumbnail TikTok jika cover API tidak tersedia
    if (!candidates.length && /tiktok\.com/i.test(pageUrl)) {
        try {
            const { data } = await axios.get(
                'https://www.tiktok.com/oembed',
                {
                    params: { url: pageUrl },
                    timeout: 12000,
                    headers: { 'User-Agent': UA }
                }
            )

            add(data?.thumbnail_url)
        } catch (err) {
            console.error('[AMFIND] oEmbed:', err.message)
        }
    }

    for (const url of [...new Set(candidates)]) {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: {
                    'User-Agent': UA,
                    Accept: 'image/*'
                }
            })

            return await sharp(Buffer.from(response.data))
                .jpeg({ quality: 85 })
                .toBuffer()
        } catch (err) {
            console.error(
                '[AMFIND] Thumbnail gagal:',
                err.response?.status || err.message
            )
        }
    }

    return null
}

// ===== FORMAT HASIL =====
function createResultText(result) {
    const platform = String(result.platform || 'video').toUpperCase()
    const links = result.links || []

    let text =
`✅ *PRESET BERHASIL DITEMUKAN!* 🎬✨

╭┈┈⬡「 🎬 *ALIGHT MOTION PRESET* 」
┃ 🌐 *Platform:* ${platform}
┃ 👤 *Creator:* ${result.author || '-'}
┃ 📝 *Judul:* ${result.title || '-'}
┃ 👁️ *Views:* ${formatNumber(result.views)}
┃ ❤️ *Likes:* ${formatNumber(result.likes)}
┃ 💬 *Comments:* ${formatNumber(result.comments)}
┃ 🔎 *API:* ${result.source}
╰┈┈┈┈┈┈┈┈⬡`

    if (result.username) {
        text += `\n┃ 🔗 *Username:* @${result.username}`
    }

    if (result.duration !== null && result.duration !== undefined) {
        text += `\n┃ ⏱️ *Durasi:* ${result.duration}s`
    }

    text += `\n\n╭┈┈⬡「 📥 *DOWNLOAD PRESET* 」`

    for (const item of links) {
        text += `\n┃ 📁 *${item.label}*`

        if (item.size) {
            text += `\n┃ 📦 Ukuran: ${item.size}`
        }

        if (item.type) {
            text += `\n┃ 🏷️ Tipe: ${item.type}`
        }

        text += `\n┃ 🔗 ${item.url}`
    }

    text += `\n╰┈┈┈┈┈┈┈┈⬡`

    if (result.url) {
        text += `\n\n🎥 *Video sumber:*\n${result.url}`
    }

    text += '\n\nSelamat mengedit, semangat berkarya ya~ 🌸💖'

    return text
}

// ===== HANDLER =====
async function handler(m, { sock }) {
    const url = ((m.text || '').match(/https?:\/\/\S+/i) || [])[0]
        ?.replace(/[.,!?]+$/, '') || ''

    if (!url) {
        return m.reply(
            `📦 *ALIGHT MOTION PRESET FINDER* 🎬\n\n` +
            `> Cari preset dari video TikTok, YouTube, atau Instagram.\n\n` +
            `> Penggunaan: ${m.prefix}amfind <link video>\n` +
            `> Contoh: ${m.prefix}amfind https://www.youtube.com/watch?v=xxxx`
        )
    }

    if (!isValidVideoUrl(url)) {
        return m.reply(
            `❌ *Link tidak valid!*\n\n` +
            `Gunakan link video TikTok, YouTube, atau Instagram ya~ 🌸`
        )
    }

    await react(sock, m, '⏳')

    try {
        const result = await searchPreset(url)
        const text = createResultText(result)
        const thumb = await getThumbnail(result, result.url || url)

        if (thumb) {
            try {
                await sock.sendMessage(
                    m.chat,
                    { image: thumb, caption: text },
                    { quoted: m }
                )
            } catch (err) {
                console.error('[AMFIND] Gagal mengirim gambar:', err.message)
                await m.reply(text)
            }
        } else {
            await m.reply(text)
        }

        await react(sock, m, '✅')
    } catch (err) {
        console.error('[AMFIND ERROR]', err.message)
        await react(sock, m, '❌')

        return m.reply(
            `❌ *Preset gagal ditemukan*\n\n` +
            `Rin API dan BintangAPI sama-sama gagal memproses link tersebut.\n\n` +
            `Coba lagi nanti atau gunakan link video lain ya~ 🌸`
        )
    }
}

// ===== EXPORT =====
module.exports = {
    config: pluginConfig,
    handler
}