const axios = require('axios')

const pluginConfig = {
    name: 'ytstalk',
    alias: ['youtubestalk', 'stalkyt'],
    category: 'stalker',
    description: 'Stalk channel YouTube (scrape langsung, no API)',
    usage: '.ytstalk <username/@handle/channelId>',
    example: '.ytstalk mrbeast',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function resolveChannelUrl(input) {
    const u = input.trim()
    if (/^https?:\/\//i.test(u)) return u
    if (u.startsWith('@')) return `https://www.youtube.com/${u}/videos`
    if (/^UC[\w-]{22}$/.test(u)) return `https://www.youtube.com/channel/${u}/videos`
    return `https://www.youtube.com/@${u}/videos`
}

function extractInitialData(html) {
    const patterns = [
        /var ytInitialData\s*=\s*(\{.+?\});<\/script>/s,
        /window\["ytInitialData"\]\s*=\s*(\{.+?\});<\/script>/s,
        /ytInitialData"\]\s*=\s*(\{.+?\});/s
    ]
    for (const re of patterns) {
        const match = html.match(re)
        if (match) {
            try {
                return JSON.parse(match[1])
            } catch (e) {
                // coba pattern berikutnya
            }
        }
    }
    return null
}

function getVideosFromData(data) {
    try {
        const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || []
        for (const tab of tabs) {
            const content = tab?.tabRenderer?.content
            if (!content) continue

            // Layout baru: richGridRenderer
            const richItems = content?.richGridRenderer?.contents
            if (richItems) {
                const vids = richItems
                    .map(it => it?.richItemRenderer?.content?.videoRenderer)
                    .filter(Boolean)
                if (vids.length) {
                    return vids.map(v => ({
                        title: v.title?.runs?.[0]?.text || v.title?.simpleText || '-',
                        viewCount: v.viewCountText?.simpleText || v.shortViewCountText?.simpleText || '-',
                        duration: v.lengthText?.simpleText || 'LIVE/Shorts',
                        videoId: v.videoId
                    }))
                }
            }

            // Layout lama: sectionListRenderer -> gridRenderer
            const sections = content?.sectionListRenderer?.contents || []
            for (const sec of sections) {
                const items = sec?.itemSectionRenderer?.contents?.[0]?.gridRenderer?.items
                if (items) {
                    const vids = items.map(it => it?.gridVideoRenderer).filter(Boolean)
                    if (vids.length) {
                        return vids.map(v => ({
                            title: v.title?.simpleText || v.title?.runs?.[0]?.text || '-',
                            viewCount: v.viewCountText?.simpleText || v.shortViewCountText?.simpleText || '-',
                            duration: v.thumbnailOverlays?.[0]?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText || '-',
                            videoId: v.videoId
                        }))
                    }
                }
            }
        }
    } catch (e) {
        console.log('[ytstalk] getVideosFromData error:', e.message)
    }
    return []
}

function getSubscriberCount(data) {
    const oldHeader = data?.header?.c4TabbedHeaderRenderer
    if (oldHeader?.subscriberCountText) {
        return oldHeader.subscriberCountText.simpleText || oldHeader.subscriberCountText.runs?.map(r => r.text).join('') || '-'
    }
    const newHeader = data?.header?.pageHeaderRenderer
    const rows = newHeader?.content?.pageHeaderViewModel?.metadata?.contentMetadataViewModel?.metadataRows || []
    for (const row of rows) {
        const part = row?.metadataParts?.find(p => p?.text?.content?.toLowerCase().includes('subscriber'))
        if (part) return part.text.content
    }
    return '-'
}

function getVideoCount(data) {
    const oldHeader = data?.header?.c4TabbedHeaderRenderer
    if (oldHeader?.videosCountText) {
        return oldHeader.videosCountText.runs?.map(r => r.text).join('') || oldHeader.videosCountText.simpleText || '-'
    }
    return '-'
}

async function handler(m, { sock }) {
    const username = m.args[0]

    if (!username) {
        return m.reply(
            `『 📺 *ʏᴏᴜᴛᴜʙᴇ sᴛᴀʟᴋ* 📺 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `✨ *Cara pakai:*\n` +
            `\`${m.prefix}ytstalk <username/@handle>\`\n\n` +
            `💫 *Contoh:*\n` +
            `\`${m.prefix}ytstalk mrbeast\`\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `> 💖 Ai siap stalk channel YouTube buat kamu~ 🌸`
        )
    }

    m.react('⭐')

    try {
        const targetUrl = resolveChannelUrl(username)

        const res = await axios.get(targetUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': UA,
                'Accept-Language': 'en-US,en;q=0.9',
                'Cookie': 'CONSENT=YES+1; SOCS=CAI'
            }
        })

        const data = extractInitialData(res.data)

        if (!data) {
            m.react('❌')
            return m.reply(
                `『 💔 *Gagal Ambil Data~* 』\n\n` +
                `> Ai gagal parsing halaman YouTube~\n` +
                `> Mungkin struktur halaman berubah atau kena redirect consent~\n` +
                `> Coba lagi nanti ya~ 🌸`
            )
        }

        const metadata = data?.metadata?.channelMetadataRenderer

        if (!metadata) {
            m.react('❌')
            return m.reply(
                `『 💔 *Tidak Ditemukan~* 』\n\n` +
                `> Channel \`${username}\` tidak ditemukan nih~\n` +
                `> Coba username lain ya~ 💕`
            )
        }

        const channelName = metadata.title || '-'
        const channelHandle = metadata.vanityChannelUrl?.split('/').pop() || '-'
        const channelId = metadata.externalId || '-'
        const channelUrl = metadata.vanityChannelUrl || (channelId !== '-' ? `https://www.youtube.com/channel/${channelId}` : targetUrl)
        const subscriberCount = getSubscriberCount(data)
        const videoCount = getVideoCount(data)
        const isFamilySafe = metadata.isFamilySafe !== undefined ? (metadata.isFamilySafe ? '✅ Ya' : '❌ Tidak') : '-'
        const rssUrl = metadata.rssUrl || '-'
        const avatarUrl = metadata.avatar?.thumbnails?.slice(-1)?.[0]?.url || null
        const descRaw = metadata.description || ''
        const desc = descRaw ? descRaw.substring(0, 250).trim() + (descRaw.length > 250 ? '...' : '') : '-'

        const videos = getVideosFromData(data)

        let caption =
            `『 🌟 *ʜᴏsʜɪɴᴏ ᴀɪ* — ʏᴏᴜᴛᴜʙᴇ sᴛᴀʟᴋ 🌟 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `📺 *ɪɴꜰᴏ ᴄʜᴀɴɴᴇʟ*\n` +
            `┌─────────────────\n` +
            `│ 👤 *Nama:*        ${channelName}\n` +
            `│ 🏷️ *Handle:*      ${channelHandle}\n` +
            `│ 🆔 *Channel ID:*  ${channelId}\n` +
            `│ 👥 *Subscribers:* ${subscriberCount}\n` +
            `│ 🎬 *Videos:*      ${videoCount}\n` +
            `│ 👨‍👩‍👧 *Family Safe:* ${isFamilySafe}\n` +
            `│ 🔗 *URL:*\n│ ${channelUrl}\n` +
            (rssUrl !== '-' ? `│ 📡 *RSS:*\n│ ${rssUrl}\n` : '') +
            `└─────────────────\n\n` +
            `📝 *ᴅᴇsᴄʀɪᴘᴛɪᴏɴ*\n` +
            `┌─────────────────\n` +
            `│ ${desc.replace(/\n/g, '\n│ ')}\n` +
            `└─────────────────\n`

        if (videos.length > 0) {
            caption += `\n📹 *ᴠɪᴅᴇᴏ ᴛᴇʀʙᴀʀᴜ*\n`
            caption += `┌─────────────────\n`
            videos.slice(0, 5).forEach((v, i) => {
                caption +=
                    `│ *${i + 1}.* ${v.title || '-'}\n` +
                    `│    ⏱️ ${v.duration || '-'} | 👁️ ${v.viewCount || '-'}\n`
            })
            caption += `└─────────────────\n`
        }

        caption +=
            `\n✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `🌸 *Hoshino Ai Bot* ✨\n` +
            `> 「 *推しの子* 」\n` +
            `> Ai selalu ada buat kamu~ 💖⭐`

        m.react('✅')

        if (avatarUrl) {
            await sock.sendMessage(
                m.chat,
                { image: { url: avatarUrl }, caption },
                { quoted: m }
            )
        } else {
            await m.reply(caption)
        }

    } catch (error) {
        m.react('❌')
        const status = error.response?.status
        let hint = ''
        if (status === 404) hint = '\n> Channel kemungkinan tidak ada / typo username~'
        else if (status === 429) hint = '\n> YouTube lagi rate-limit IP server, coba lagi beberapa saat~'

        m.reply(
            `『 💥 *E R R O R* 』\n\n` +
            `> ${error.message || 'Unknown error'}${hint}\n\n` +
            `> 💔 Maaf ya~ Ai gagal kali ini...\n` +
            `> Coba lagi nanti ya~ 🌸`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}