const axios = require('axios')

const pluginConfig = {
    name: 'ytvidstalk',
    alias: ['videostalk', 'stalkvideo', 'ytvstalk'],
    category: 'stalker',
    description: 'Stalk info detail video YouTube (tanpa download)',
    usage: '.ytvidstalk <url/id video>',
    example: '.ytvidstalk https://youtu.be/dQw4w9WgXcQ',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function extractVideoId(input) {
    const u = input.trim()
    const patterns = [
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/))([\w-]{11})/,
        /^([\w-]{11})$/
    ]
    for (const re of patterns) {
        const m = u.match(re)
        if (m) return m[1]
    }
    return null
}

function extractJsonVar(html, varName) {
    const patterns = [
        new RegExp(`var ${varName}\\s*=\\s*(\\{.+?\\});</script>`, 's'),
        new RegExp(`window\\["${varName}"\\]\\s*=\\s*(\\{.+?\\});`, 's'),
        new RegExp(`${varName}\\s*=\\s*(\\{.+?\\});`, 's')
    ]
    for (const re of patterns) {
        const match = html.match(re)
        if (match) {
            try { return JSON.parse(match[1]) } catch (e) { /* try next pattern */ }
        }
    }
    return null
}

function deepFind(obj, targetKey, results = [], depth = 0) {
    if (depth > 25 || !obj || typeof obj !== 'object') return results
    for (const key in obj) {
        if (key === targetKey) results.push(obj[key])
        if (typeof obj[key] === 'object') deepFind(obj[key], targetKey, results, depth + 1)
    }
    return results
}

function formatNumber(n) {
    if (n === undefined || n === null) return '-'
    const num = typeof n === 'string' ? parseInt(n.replace(/[^\d]/g, ''), 10) : n
    if (isNaN(num)) return '-'
    return num.toLocaleString('id-ID')
}

async function getThumbnailBuffer(videoId, vd) {
    const thumbs = vd?.thumbnail?.thumbnails || []
    const candidates = [
        `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        thumbs.length ? thumbs[thumbs.length - 1].url.split('?')[0] : null,
        `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    ].filter(Boolean)

    for (const url of candidates) {
        try {
            const r = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: { 'User-Agent': UA }
            })
            if (r.data && r.data.length > 2000) return Buffer.from(r.data)
        } catch (e) { /* coba kandidat berikutnya */ }
    }
    return null
}

async function handler(m, { sock }) {
    const input = m.args[0]

    if (!input) {
        return m.reply(
            `『 🎬 *ʏᴏᴜᴛᴜʙᴇ ᴠɪᴅᴇᴏ sᴛᴀʟᴋ* 🎬 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `✨ *Cara pakai:*\n` +
            `\`${m.prefix}ytvidstalk <url/id video>\`\n\n` +
            `💫 *Contoh:*\n` +
            `\`${m.prefix}ytvidstalk https://youtu.be/dQw4w9WgXcQ\`\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `> 💖 Ai stalk info video, gak download apapun~ 🌸`
        )
    }

    const videoId = extractVideoId(input)
    if (!videoId) {
        return m.reply(`『 💔 』\n> URL/ID video gak valid nih~ 💕`)
    }

    m.react('⭐')

    try {
        const res = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
            timeout: 30000,
            headers: {
                'User-Agent': UA,
                'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
                'Cookie': 'CONSENT=YES+1; SOCS=CAI'
            }
        })

        const html = res.data
        const playerData = extractJsonVar(html, 'ytInitialPlayerResponse')
        const initialData = extractJsonVar(html, 'ytInitialData')

        if (!playerData?.videoDetails) {
            m.react('❌')
            return m.reply(
                `『 💔 *Tidak Ditemukan~* 』\n\n` +
                `> Video tidak ditemukan / private / kena region-lock~\n` +
                `> Coba video lain ya~ 💕`
            )
        }

        const vd = playerData.videoDetails
        const micro = playerData.microformat?.playerMicroformatRenderer || {}

        const title = vd.title || '-'
        const channelName = vd.author || micro.ownerChannelName || '-'
        const channelId = vd.channelId || micro.externalChannelId || '-'
        const duration = vd.lengthSeconds
            ? `${Math.floor(vd.lengthSeconds / 60)}m ${vd.lengthSeconds % 60}s`
            : '-'
        const viewCount = formatNumber(vd.viewCount || micro.viewCount)
        const publishDate = micro.publishDate || '-'
        const uploadDate = micro.uploadDate || '-'
        const category = micro.category || '-'
        const isLive = vd.isLiveContent ? '🔴 Ya' : '❌ Tidak'
        const isFamilySafe = micro.isFamilySafe !== undefined ? (micro.isFamilySafe ? '✅ Ya' : '❌ Tidak') : '-'
        const keywords = Array.isArray(vd.keywords) ? vd.keywords.slice(0, 8).join(', ') : '-'
        const descRaw = vd.shortDescription || ''
        const desc = descRaw ? descRaw.substring(0, 300).trim() + (descRaw.length > 300 ? '...' : '') : '-'

// Like count: cari lewat buttonViewModel (struktur baru YouTube)
let likeCount = '-'
const likeButtons = deepFind(initialData, 'buttonViewModel')
    .find(b => b?.iconName === 'LIKE' && b?.title)
if (likeButtons) {
    likeCount = likeButtons.title
} else {
    // fallback ke struktur lama kalau masih ada
    const oldLike = deepFind(initialData, 'defaultText')
        .map(t => t?.accessibility?.accessibilityData?.label || t?.simpleText)
        .filter(Boolean)
        .find(t => /like|suka/i.test(t))
    if (oldLike) {
        const numMatch = oldLike.match(/[\d.,]+[KMB]?/)
        if (numMatch) likeCount = numMatch[0]
    }
}

// Comment count: cari lewat engagementPanels (struktur terbaru)
let commentCount = '-'
const panels = initialData?.engagementPanels || []
const commentPanel = panels.find(p =>
    p?.engagementPanelSectionListRenderer?.panelIdentifier === 'engagement-panel-comments-section'
)
const header = commentPanel?.engagementPanelSectionListRenderer?.header
    ?.engagementPanelTitleHeaderRenderer

if (header?.contextualInfo) {
    const ci = header.contextualInfo
    commentCount = ci.simpleText || (Array.isArray(ci.runs) ? ci.runs.map(r => r.text).join('') : '-')
} else {
    // fallback lama, jaga-jaga kalau struktur beda lagi
    const commentMatches = deepFind(initialData, 'commentCount')
    if (commentMatches.length) {
        const c = commentMatches[0]
        commentCount = c?.simpleText || (Array.isArray(c?.runs) ? c.runs.map(r => r.text).join('') : '-')
    }
}

        const caption =
            `『 🌟 *ʜᴏsʜɪɴᴏ ᴀɪ* — ᴠɪᴅᴇᴏ sᴛᴀʟᴋ 🌟 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `🎬 *ɪɴꜰᴏ ᴠɪᴅᴇᴏ*\n` +
            `┌─────────────────\n` +
            `│ 📌 *Judul:*\n│ ${title}\n` +
            `│ 👤 *Channel:*     ${channelName}\n` +
            `│ 🆔 *Channel ID:*  ${channelId}\n` +
            `│ ⏱️ *Durasi:*      ${duration}\n` +
            `│ 👁️ *Views:*       ${viewCount}\n` +
            `│ 👍 *Likes:*       ${likeCount}\n` +
            `│ 💬 *Comments:*    ${commentCount}\n` +
            `│ 📅 *Upload:*      ${uploadDate}\n` +
            `│ 📅 *Publish:*     ${publishDate}\n` +
            `│ 🏷️ *Kategori:*    ${category}\n` +
            `│ 🔴 *Live:*        ${isLive}\n` +
            `│ 👨‍👩‍👧 *Family Safe:* ${isFamilySafe}\n` +
            `└─────────────────\n\n` +
            `🔖 *ᴛᴀɢs*\n` +
            `┌─────────────────\n` +
            `│ ${keywords}\n` +
            `└─────────────────\n\n` +
            `📝 *ᴅᴇsᴄʀɪᴘᴛɪᴏɴ*\n` +
            `┌─────────────────\n` +
            `│ ${desc.replace(/\n/g, '\n│ ')}\n` +
            `└─────────────────\n` +
            `\n✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `🌸 *Hoshino Ai Bot* ✨\n` +
            `> 「 *推しの子* 」\n` +
            `> Ai selalu ada buat kamu~ 💖⭐`

                const thumb = await getThumbnailBuffer(videoId, vd)

        m.react('✅')
        if (thumb) {
            await sock.sendMessage(m.chat, { image: thumb, caption }, { quoted: m })
        } else {
            await m.reply(caption)
        }

    } catch (error) {
        m.react('❌')
        m.reply(
            `『 💥 *E R R O R* 』\n\n` +
            `> ${error.message || 'Unknown error'}\n\n` +
            `> 💔 Maaf ya~ Ai gagal kali ini...\n` +
            `> Coba lagi nanti ya~ 🌸`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}