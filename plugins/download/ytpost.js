const axios = require('axios')
const sharp = require('sharp')
const crypto = require('crypto')

const {
    generateWAMessage,
    generateWAMessageFromContent,
    jidNormalizedUser
} = require('hsnai')

const pluginConfig = {
    name: 'ytpost',
    alias: ['ytcommunity', 'ytupdate'],
    category: 'download',
    description: 'Ambil konten dari YouTube Community Post',
    usage: '.ytpost <url>',
    example: '.ytpost https://youtube.com/post/xxx',
    cooldown: 15,
    energi: 1,
    isEnabled: true
}

const YOUTUBE_POST_REGEX = /youtube\.com\/post\/([a-zA-Z0-9_-]+)/

function extractPostId(url) {
    return String(url || '').match(YOUTUBE_POST_REGEX)?.[1] || null
}

function normalizeImgUrl(url) {
    if (!url) return null
    return url.startsWith('//') ? `https:${url}` : url
}

function findNode(obj, key) {
    if (!obj || typeof obj !== 'object') return null
    if (obj[key]) return obj[key]
    for (const k of Object.keys(obj)) {
        const found = findNode(obj[k], key)
        if (found) return found
    }
    return null
}

async function downloadImageBuffer(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': 'https://www.youtube.com/'
        }
    })

    const rawBuffer = Buffer.from(res.data)
    return await sharp(rawBuffer).jpeg({ quality: 90 }).toBuffer()
}

async function getPostInfo(postId) {
    const res = await axios.get(`https://www.youtube.com/post/${postId}`, {
        timeout: 30000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cookie': 'CONSENT=YES+1'
        }
    })

    const match = res.data.match(/var ytInitialData\s*=\s*(\{.*?\});<\/script>/s)
    if (!match) throw new Error('Gagal parsing halaman post.')

    const data = JSON.parse(match[1])
    const post = findNode(data, 'backstagePostRenderer')
    if (!post) throw new Error('Post tidak ditemukan atau bersifat privat.')

    const author = post.authorText?.runs?.[0]?.text || 'Unknown'
    const authorThumbs = post.authorThumbnail?.thumbnails || []
    const authorPic = normalizeImgUrl(authorThumbs[authorThumbs.length - 1]?.url)
    const text = (post.contentText?.runs || []).map(r => r.text).join('')
    const attachment = post.backstageAttachment || {}

    const result = { author, authorPic, text, type: 'text', images: [], videoId: null, videoTitle: null, poll: null }

    if (attachment.videoRenderer) {
        result.type = 'video'
        result.videoId = attachment.videoRenderer.videoId
        result.videoTitle = attachment.videoRenderer.title?.simpleText
            || (attachment.videoRenderer.title?.runs || []).map(r => r.text).join('')
    } else if (attachment.backstageImageRenderer) {
        result.type = 'image'
        const thumbs = attachment.backstageImageRenderer.image?.thumbnails || []
        result.images = [normalizeImgUrl(thumbs[thumbs.length - 1]?.url)].filter(Boolean)
    } else if (attachment.postMultiImageRenderer) {
        result.type = 'image'
        result.images = (attachment.postMultiImageRenderer.images || []).map(img => {
            const thumbs = img.backstageImageRenderer?.image?.thumbnails || []
            return normalizeImgUrl(thumbs[thumbs.length - 1]?.url)
        }).filter(Boolean)
    } else if (attachment.pollRenderer) {
        result.type = 'poll'
        result.poll = {
            choices: (attachment.pollRenderer.choices || []).map(c => (c.text?.runs || []).map(r => r.text).join('')),
            total: attachment.pollRenderer.totalVotes?.simpleText || ''
        }
    }

    return result
}

async function handler(m, { sock }) {
    const url = m.text?.trim()
    if (!url) return m.reply(`Contoh: ${m.prefix}ytpost https://youtube.com/post/xxx`)

    const postId = extractPostId(url)
    if (!postId) {
        return m.reply(
            `╭┈┈⬡「 ❌ ᴏᴏᴘs 」\n` +
            `┃ Link-nya bukan YouTube Community Post nih~\n` +
            `┃ Formatnya: youtube.com/post/xxx\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }

    m.react('🕕')
    try {
        const info = await getPostInfo(postId)

        if (info.type === 'video' && info.videoId) {
            const watchUrl = `https://youtube.com/watch?v=${info.videoId}`
            await m.reply(
                `╭┈┈⬡「 🎬 ᴠɪᴅᴇᴏ ᴘᴏsᴛ 」\n` +
                `┃ ✨ ${info.videoTitle || 'Video dari Community Post'}\n` +
                `┃\n` +
                `┃ 👤 ᴀᴜᴛʜᴏʀ: ${info.author}\n` +
                `┃ 📝 ${info.text || '(tanpa teks)'}\n` +
                `┃\n` +
                `┃ 🔗 ${watchUrl}\n` +
                `╰┈┈┈┈┈┈┈┈⬡\n\n` +
                `Hoshino nemuin videonya, ne~! Ketik .ytmp4 buat download 🎤`
            )
            return m.react('✅')
        }

        if (info.type === 'image' && info.images.length) {

    const mediaList = []

    for (const img of info.images) {
        try {
            const buffer = await downloadImageBuffer(img)
            mediaList.push({
                image: buffer
            })
        } catch (e) {
            console.log(e)
        }
    }

    if (!mediaList.length)
        return m.reply('Semua gambar gagal diunduh.')

    const opener = generateWAMessageFromContent(
        m.chat,
        {
            messageContextInfo: {
                messageSecret: crypto.randomBytes(32)
            },
            albumMessage: {
                expectedImageCount: mediaList.length,
                expectedVideoCount: 0
            }
        },
        {
            quoted: m,
            userJid: jidNormalizedUser(sock.user.id),
            upload: sock.waUploadToServer
        }
    )

    await sock.relayMessage(
        opener.key.remoteJid,
        opener.message,
        { messageId: opener.key.id }
    )

    const caption =
`╭┈┈⬡「 📸 ᴄᴏᴍᴍᴜɴɪᴛʏ ᴘᴏsᴛ 」
┃ 👤 ${info.author}
┃ 📝 ${info.text || '(tanpa teks)'}
╰┈┈┈┈┈┈┈┈⬡

_via Hoshino Ai Bot_ ⭐`

    const messages = await Promise.all(
        mediaList.map(async (content, index) => {

            const msg = await generateWAMessage(
                opener.key.remoteJid,
                {
                    ...content,
                    caption: index === 0 ? caption : undefined
                },
                {
                    upload: sock.waUploadToServer
                }
            )

            msg.message.messageContextInfo = {
                messageSecret: crypto.randomBytes(32),
                messageAssociation: {
                    associationType: 1,
                    parentMessageKey: opener.key
                }
            }

            return msg
        })
    )

    for (const msg of messages) {
        await sock.relayMessage(
            msg.key.remoteJid,
            msg.message,
            { messageId: msg.key.id }
        )
    }

    m.react('✅')
    return
}

        if (info.type === 'poll' && info.poll) {
            const list = info.poll.choices.map((c, i) => `┃ ${i + 1}. ${c}`).join('\n')
            await m.reply(
                `╭┈┈⬡「 📊 ᴘᴏʟʟ ᴘᴏsᴛ 」\n` +
                `┃ 👤 ${info.author}\n` +
                `┃ 📝 ${info.text || '(tanpa teks)'}\n` +
                `┃\n` +
                list + '\n' +
                `┃\n` +
                `┃ 🗳️ ᴛᴏᴛᴀʟ sᴜᴀʀᴀ: ${info.poll.total}\n` +
                `╰┈┈┈┈┈┈┈┈⬡\n\n` +
                `Yuk vote, Hoshino penasaran hasilnya~ 🎀`
            )
            return m.react('✅')
        }

        await m.reply(
            `╭┈┈⬡「 📝 ᴄᴏᴍᴍᴜɴɪᴛʏ ᴘᴏsᴛ 」\n` +
            `┃ 👤 ${info.author}\n` +
            `┃ 📝 ${info.text || '(post tanpa konten media)'}\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `_via Hoshino Ai Bot_ ⭐`
        )
        m.react('✅')
    } catch (err) {
        m.react('❌')
        m.reply(
            `╭┈┈⬡「 ❌ ɢᴀɢᴀʟ 」\n` +
            `┃ Hoshino gagal ambil post-nya, gomen~ 🎀\n` +
            `┃\n` +
            `┃ _${err.message}_\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}