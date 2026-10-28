const axios = require('axios')

const pluginConfig = {
    name: 'ytpoststalk',
    alias: ['communitystalk', 'stalkpost'],
    category: 'stalker',
    description: 'Stalk info detail Community Post YouTube (tanpa download)',
    usage: '.ytpoststalk <url post>',
    example: '.ytpoststalk https://www.youtube.com/post/Ugkx...',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function resolvePostUrl(input) {
    const u = input.trim()
    if (/^https?:\/\//i.test(u)) return u
    return `https://www.youtube.com/post/${u}`
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

function joinRuns(runsObj) {
    if (!runsObj) return '-'
    if (runsObj.simpleText) return runsObj.simpleText
    if (Array.isArray(runsObj.runs)) return runsObj.runs.map(r => r.text).join('')
    return '-'
}

// Cuma deskripsi tipe lampiran, gak ambil URL gambar/video sama sekali
function describeAttachment(att) {
    if (!att) return 'Tidak ada lampiran'
    if (att.pollRenderer) return '📊 Poll'
    if (att.backstageImageRenderer) return '🖼️ 1 gambar'
    if (att.postMultiImageRenderer) {
        const n = att.postMultiImageRenderer.images?.length || '?'
        return `🖼️ ${n} gambar (carousel)`
    }
    if (att.videoRenderer) return `🎬 Video: ${joinRuns(att.videoRenderer.title)}`
    return '📎 Lampiran (tipe tidak dikenali)'
}

async function handler(m, { sock }) {
    const input = m.args[0]

    if (!input) {
        return m.reply(
            `『 📝 *ʏᴏᴜᴛᴜʙᴇ ᴘᴏsᴛ sᴛᴀʟᴋ* 📝 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `✨ *Cara pakai:*\n` +
            `\`${m.prefix}ytpoststalk <url post>\`\n\n` +
            `💫 *Contoh:*\n` +
            `\`${m.prefix}ytpoststalk https://www.youtube.com/post/Ugkx...\`\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `> 💖 Ai stalk info post, gak download lampiran apapun~ 🌸`
        )
    }

    m.react('⭐')

    try {
        const targetUrl = resolvePostUrl(input)
        const res = await axios.get(targetUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': UA,
                'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
                'Cookie': 'CONSENT=YES+1; SOCS=CAI'
            }
        })

        const data = extractJsonVar(res.data, 'ytInitialData')
        if (!data) {
            m.react('❌')
            return m.reply(`『 💔 』\n> Ai gagal parsing halaman post~\n> Coba lagi nanti ya~ 🌸`)
        }

        const postRenderers = deepFind(data, 'backstagePostRenderer')
        const post = postRenderers[0]

        if (!post) {
            m.react('❌')
            return m.reply(
                `『 💔 *Tidak Ditemukan~* 』\n\n` +
                `> Post tidak ditemukan, private, atau URL salah~\n` +
                `> Coba lagi ya~ 💕`
            )
        }

        const authorName = post.authorText?.runs?.[0]?.text || '-'
        const contentText = joinRuns(post.contentText)
        const publishedTime = joinRuns(post.publishedTimeText)
        const voteCount = post.voteCount?.simpleText || joinRuns(post.voteCount) || '-'
        const attachmentInfo = describeAttachment(post.backstageAttachment)

        // comment/reply count best-effort (struktur bisa beda tergantung layout)
        let commentCount = '-'
        const commentMatches = deepFind(post, 'replyCount')
        if (commentMatches.length) commentCount = commentMatches[0]

        // detail poll kalau ada (cuma teks pilihan + persentase, gak ada media)
        let pollInfo = ''
        const poll = post.backstageAttachment?.pollRenderer
        if (poll) {
            const totalVotes = joinRuns(poll.totalVotes)
            const choices = (poll.choices || []).map((c, i) =>
                `│ ${i + 1}. ${joinRuns(c.text)}${c.votePercentage ? ` — ${joinRuns(c.votePercentage)}` : ''}`
            ).join('\n')
            pollInfo =
                `\n📊 *ᴘᴏʟʟ*\n` +
                `┌─────────────────\n` +
                `${choices}\n` +
                `│ Total suara: ${totalVotes}\n` +
                `└─────────────────\n`
        }

        const contentDisplay = contentText.length > 400
            ? contentText.substring(0, 400).trim() + '...'
            : contentText

        const caption =
            `『 🌟 *ʜᴏsʜɪɴᴏ ᴀɪ* — ᴘᴏsᴛ sᴛᴀʟᴋ 🌟 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `📝 *ɪɴꜰᴏ ᴘᴏsᴛ*\n` +
            `┌─────────────────\n` +
            `│ 👤 *Author:*      ${authorName}\n` +
            `│ 📅 *Waktu:*       ${publishedTime}\n` +
            `│ 👍 *Votes/Likes:* ${voteCount}\n` +
            `│ 💬 *Comments:*    ${commentCount}\n` +
            `│ 📎 *Lampiran:*    ${attachmentInfo}\n` +
            `└─────────────────\n\n` +
            `📝 *ɪsɪ ᴘᴏsᴛ*\n` +
            `┌─────────────────\n` +
            `│ ${contentDisplay.replace(/\n/g, '\n│ ')}\n` +
            `└─────────────────\n` +
            pollInfo +
            `\n✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `🌸 *Hoshino Ai Bot* ✨\n` +
            `> 「 *推しの子* 」\n` +
            `> Ai selalu ada buat kamu~ 💖⭐`

        m.react('✅')
        await m.reply(caption)

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