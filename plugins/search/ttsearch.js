const axios  = require('axios')
const crypto = require('crypto')
const { generateWAMessage, generateWAMessageFromContent, jidNormalizedUser } = require('hsnai')
const config = require('../../config')

const pluginConfig = {
    name: 'ttsearch',
    alias: ['tiktoksearch', 'searchtiktok'],
    category: 'search',
    description: 'Cari video TikTok',
    usage: '.ttsearch <query>',
    example: '.ttsearch jj epep',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 1,
    isEnabled: true
}

async function tiktokSearchVideo(query) {
    // Primary: api-faa.my.id
    try {
        const { data } = await axios.get(
            `https://api-faa.my.id/faa/tiktok-search?q=${encodeURIComponent(query)}`,
            { timeout: 30000 }
        )
        const videos = data?.result || data?.data || null
        if (data?.status && Array.isArray(videos) && videos.length > 0) {
            return videos.map(v => ({
                video: v.url_nowm || v.url_wm || v.play || v.video || v.url || v.video_url,
                title: v.title || v.desc || '',
                author: v.author?.nickname || v.author || '',
            })).filter(v => v.video)
        }
    } catch (e) {
        console.log('[ttsearch] faa gagal:', e.message)
    }

    // Fallback: labs.shannzx.xyz
    try {
        const { data } = await axios.get(
            `https://labs.shannzx.xyz/api/v1/tiktok?query=${encodeURIComponent(query)}`,
            { timeout: 30000 }
        )
        if (data?.status && Array.isArray(data?.result) && data.result.length > 0) {
            return data.result.map(v => ({
                video: v.video || v.play || v.url,
                title: v.title || v.desc || '',
                author: v.author?.nickname || v.author || '',
            })).filter(v => v.video)
        }
    } catch (e) {
        console.log('[ttsearch] shannzx gagal:', e.message)
    }

    return null
}

async function handler(m, { sock }) {
    const query = m.args.join(' ')?.trim()

    if (!query) {
        return m.reply(
            `╭┈┈⬡「 🎵 *ᴛɪᴋᴛᴏᴋ sᴇᴀʀᴄʜ* 」\n` +
            `┃\n` +
            `┃ ㊗ ᴜsᴀɢᴇ: \`${m.prefix}ttsearch <query>\`\n` +
            `┃\n` +
            `╰┈┈⬡\n\n` +
            `> \`Contoh: ${m.prefix}ttsearch anime\``
        )
    }

    m.react('🔍')

    try {
        const videos = await tiktokSearchVideo(query)

        if (!videos || videos.length === 0) {
            m.react('❌')
            return m.reply(`❌ *Ehh~* Tidak ditemukan video untuk: ${query} 🥺`)
        }

        const maxShow   = Math.min(videos.length, 5)
        const mediaList = videos.slice(0, maxShow).map(video => ({
            video:       { url: video.video },
            mimetype:    'video/mp4',
            contextInfo: { forwardingScore: 99, isForwarded: true }
        }))

        try {
            const opener = generateWAMessageFromContent(
                m.chat,
                {
                    messageContextInfo: { messageSecret: crypto.randomBytes(32) },
                    albumMessage: {
                        expectedImageCount: 0,
                        expectedVideoCount: mediaList.length
                    }
                },
                {
                    userJid: jidNormalizedUser(sock.user.id),
                    quoted:  m,
                    upload:  sock.waUploadToServer
                }
            )

            await sock.relayMessage(opener.key.remoteJid, opener.message, { messageId: opener.key.id })

            const generatedMessages = await Promise.all(mediaList.map(async content => {
                const msg = await generateWAMessage(opener.key.remoteJid, content, { upload: sock.waUploadToServer })
                msg.message.messageContextInfo = {
                    messageSecret: crypto.randomBytes(32),
                    messageAssociation: { associationType: 1, parentMessageKey: opener.key }
                }
                return msg
            }))

            for (const msg of generatedMessages) {
                await sock.relayMessage(msg.key.remoteJid, msg.message, { messageId: msg.key.id })
            }

        } catch {
            for (const content of mediaList) {
                await sock.sendMessage(m.chat, content, { quoted: m })
            }
        }

        m.react('✅')

    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = { config: pluginConfig, handler, tiktokSearchVideo }