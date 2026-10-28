const { pinterestdl } = require('../../src/lib/pinterest')
const path = require('path')
const { queueFFmpeg } = require('./../../src/lib/ffmpegQueue')
const { f } = require('../../src/lib/undici')
const fs = require('fs')

const pluginConfig = {
    name: 'pindl',
    alias: ['pinterestdl', 'pindownload', 'pintdl'],
    category: 'download',
    description: 'Download gambar/video dari Pinterest',
    usage: '.pindl <url>',
    example: '.pindl https://pin.it/xxx',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

function formatNumber(n) {
    if (n == null) return '-'
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
    return n.toString()
}

function formatDuration(ms) {
    if (!ms) return null
    const sec = Math.floor(ms / 1000)
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
}

async function handler(m, { sock }) {
    const url = m.text?.trim()

    if (!url) {
        return m.reply(
            `📌 *ᴘɪɴᴛᴇʀᴇsᴛ ᴅᴏᴡɴʟᴏᴀᴅ*\n\n` +
            `Kyaa~ Ai suka banget Pinterest! Tapi link-nya mana dulu dong~ 🌸\n\n` +
            `*Cara pakai:*\n` +
            `> \`${m.prefix}pindl https://pin.it/xxx\`\n` +
            `> \`${m.prefix}pindl https://pinterest.com/pin/xxx\`\n` +
            `> \`${m.prefix}pindl https://i.pinimg.com/originals/xxx.jpg\`\n\n` +
            `_Support link pin, gambar, video, dan GIF~ ✨_`
        )
    }

    // Validasi domain Pinterest
    let parsedUrl

    try {
        parsedUrl = new URL(url)
    } catch {
        return m.reply(
            `❌ *Ara ara~*\n\n` +
            `> Itu bukan link Pinterest deh... Ai gak bisa download dari sana~ 🥺\n\n` +
            `_Gunakan link dari pinterest.com atau pin.it ya~_`
        )
    }

    const hostname = parsedUrl.hostname.toLowerCase()

    const isPinterestUrl =
        hostname === 'pinterest.com' ||
        hostname.endsWith('.pinterest.com') ||
        hostname === 'pin.it' ||
        hostname.endsWith('.pin.it') ||
        hostname === 'pinimg.com' ||
        hostname.endsWith('.pinimg.com')

    if (!['http:', 'https:'].includes(parsedUrl.protocol) || !isPinterestUrl) {
        return m.reply(
            `❌ *Ara ara~*\n\n` +
            `> Itu bukan link Pinterest yang didukung Ai~ 🥺\n\n` +
            `_Gunakan link pinterest.com, pin.it, atau i.pinimg.com ya~_`
        )
    }

    // Gambar langsung dari CDN Pinterest tidak perlu lewat pinterestdl()
    if (hostname === 'i.pinimg.com') {
        try {
            m.react('🕕')

            const buffer = await f(url, 'buffer')

            if (!buffer || !buffer.length) {
                throw new Error('Gagal mengunduh gambar dari URL')
            }

            // Periksa signature file agar URL gambar palsu tidak dikirim sebagai gambar
            const isJpeg =
                buffer.length >= 3 &&
                buffer[0] === 0xFF &&
                buffer[1] === 0xD8 &&
                buffer[2] === 0xFF

            const isPng =
                buffer.length >= 8 &&
                buffer.subarray(0, 8).equals(
                    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
                )

            const isWebp =
                buffer.length >= 12 &&
                buffer.toString('ascii', 0, 4) === 'RIFF' &&
                buffer.toString('ascii', 8, 12) === 'WEBP'

            const isGifFile =
                buffer.length >= 6 &&
                ['GIF87a', 'GIF89a'].includes(
                    buffer.toString('ascii', 0, 6)
                )

            if (!isJpeg && !isPng && !isWebp && !isGifFile) {
                throw new Error('URL tidak mengembalikan file gambar yang didukung')
            }

            const isGif = isGifFile

            await sock.sendMedia(m.chat, buffer, null, m, {
                type: isGif ? 'video' : 'image',
                ...(isGif ? { gifPlayback: true } : {}),
                caption:
                    `📌 *ᴘɪɴᴛᴇʀᴇsᴛ ɪᴍᴀɢᴇ*\n\n` +
                    `╭┈┈⬡「 📁 *ɪɴꜰᴏ ᴍᴇᴅɪᴀ* 」\n` +
                    `┃ 📂 *Tipe:* ${isGif ? '🎞️ GIF' : '🖼️ Gambar'}\n` +
                    `╰┈┈┈┈┈┈┈┈⬡\n\n` +
                    `_Berhasil Ai kirim gambarnya~ 💖_`,
                contextInfo: {
                    forwardingScore: 99,
                    isForwarded: true
                }
            })

            m.react('✅')
        } catch (error) {
            console.error('[PinDL] Direct image error:', error)
            m.react('❌')
            await m.reply(
                `❌ *Gomen ne~* ✦\n\n` +
                `> ${error.message}\n\n` +
                `_Gambar gagal diunduh. Coba periksa link-nya ya~ 🌸_`
            )
        }

        return
    }

    m.react('🕕')

    try {
        const result = await pinterestdl(url)

        if (!result || !result.media || result.media.length === 0) {
            throw new Error('Tidak ada media yang bisa didownload dari pin ini')
        }

        const media = result.media[0]
        const isVideo = media.type === 'video'
        const isGif = media.url?.toLowerCase().includes('.gif')
        const mediaType = isVideo ? '🎥 Video' : isGif ? '🎞️ GIF' : '🖼️ Gambar'

        // Informasi pin
        let caption = `📌 *ᴘɪɴᴛᴇʀᴇsᴛ ᴅᴏᴡɴʟᴏᴀᴅ*\n\n`

        caption += `╭┈┈⬡「 📋 *ɪɴꜰᴏ ᴘɪɴ* 」\n`
        if (result.title) caption += `┃ 🏷️ *Judul:* ${result.title}\n`
        if (result.description) caption += `┃ 📝 *Deskripsi:* ${result.description}\n`
        if (result.link) caption += `┃ 🔗 *Link:* ${result.link}\n`
        caption += `┃ 🆔 *Pin ID:* ${result.id || '-'}\n`
        if (result.pinUrl) caption += `┃ 🔖 *Pin URL:* ${result.pinUrl}\n`
        if (result.createdAt) caption += `┃ 📅 *Diposting:* ${result.createdAt}\n`
        if (result.dominantColor) caption += `┃ 🎨 *Warna Dominan:* ${result.dominantColor}\n`
        caption += `╰┈┈┈┈┈┈┈┈⬡\n\n`

        // Informasi media
        caption += `╭┈┈⬡「 📁 *ɪɴꜰᴏ ᴍᴇᴅɪᴀ* 」\n`
        caption += `┃ 📂 *Tipe:* ${mediaType}\n`

        if (isVideo) {
            if (media.quality) caption += `┃ 📶 *Kualitas:* ${media.quality}\n`
            if (media.width && media.height) {
                caption += `┃ 📐 *Resolusi:* ${media.width}x${media.height}\n`
            }
            if (media.duration) {
                caption += `┃ ⏱️ *Durasi:* ${formatDuration(media.duration)}\n`
            }
        } else if (media.width && media.height) {
            caption += `┃ 📐 *Resolusi:* ${media.width}x${media.height}\n`
        }

        caption += `╰┈┈┈┈┈┈┈┈⬡\n\n`

        // Informasi pemilik
        if (result.pinner?.username) {
            caption += `╭┈┈⬡「 👤 *ɪɴꜰᴏ ᴘᴇᴍɪʟɪᴋ* 」\n`
            if (result.pinner.fullName) {
                caption += `┃ 🧑 *Nama:* ${result.pinner.fullName}\n`
            }

            caption += `┃ 🪪 *Username:* @${result.pinner.username}\n`

            if (result.pinner.followers != null) {
                caption += `┃ 👥 *Followers:* ${formatNumber(result.pinner.followers)}\n`
            }
            if (result.pinner.profileUrl) {
                caption += `┃ 🔗 *Profil:* ${result.pinner.profileUrl}\n`
            }

            caption += `╰┈┈┈┈┈┈┈┈⬡\n\n`
        }

        // Informasi board
        if (result.board?.name) {
            caption += `╭┈┈⬡「 📋 *ɪɴꜰᴏ ʙᴏᴀʀᴅ* 」\n`
            caption += `┃ 📌 *Board:* ${result.board.name}\n`

            if (result.board.url) {
                caption += `┃ 🔗 *URL Board:* ${result.board.url}\n`
            }

            caption += `╰┈┈┈┈┈┈┈┈⬡\n\n`
        }

        // Statistik
        caption += `╭┈┈⬡「 📊 *sᴛᴀᴛɪsᴛɪᴋ* 」\n`
        caption += `┃ 🔁 *Repin/Save:* ${formatNumber(result.repinCount)}\n`
        caption += `┃ 💬 *Komentar:* ${formatNumber(result.commentCount)}\n`
        caption += `┃ ❤️ *Reaksi:* ${formatNumber(result.reactionCount)}\n`
        caption += `╰┈┈┈┈┈┈┈┈⬡\n\n`

        caption += `_Udah Ai download-in buat kamu~ Semoga suka! 💖_`

        // Download dan kirim video
        if (isVideo) {
            let sent = false

            // Percobaan pertama: download sebagai buffer
            try {
                const videoBuffer = await f(media.url, 'buffer')

                if (videoBuffer && videoBuffer.length > 10000) {
                    await sock.sendMedia(m.chat, videoBuffer, null, m, {
                        type: 'video',
                        caption,
                        contextInfo: {
                            forwardingScore: 99,
                            isForwarded: true
                        }
                    })

                    sent = true
                }
            } catch (e) {
                console.log('[PinDL] Buffer video gagal:', e.message)
            }

            // Percobaan kedua: kirim melalui URL
            if (!sent) {
                try {
                    await sock.sendMedia(m.chat, media.url, null, m, {
                        type: 'video',
                        caption,
                        contextInfo: {
                            forwardingScore: 99,
                            isForwarded: true
                        }
                    })

                    sent = true
                } catch (e) {
                    console.log('[PinDL] URL video gagal:', e.message)
                }
            }

            // Percobaan ketiga: kirim thumbnail dan URL video
            if (!sent) {
                const thumbCaption =
                    `⚠️ *ᴘɪɴᴛᴇʀᴇsᴛ ᴅᴏᴡɴʟᴏᴀᴅ*\n\n` +
                    `Gomen ne~ Ai udah coba keras tapi videonya susah didownload... 🥺\n\n` +
                    (result.title ? `> 🏷️ *Judul:* ${result.title}\n` : '') +
                    `> 🆔 *Pin ID:* ${result.id || '-'}\n` +
                    `> 🔗 *URL Video:*\n${media.url}\n\n` +
                    `_Ini thumbnailnya dulu ya~ Coba buka URL di atas manual~ 💕_`

                if (media.thumbnail) {
                    await sock.sendMedia(m.chat, media.thumbnail, null, m, {
                        type: 'image',
                        caption: thumbCaption,
                        contextInfo: {
                            forwardingScore: 99,
                            isForwarded: true
                        }
                    })
                } else {
                    await m.reply(thumbCaption)
                }
            }

        // Download dan kirim gambar atau GIF
        } else if (media.type === 'image') {
            if (isGif) {
                const tempPath = path.join(process.cwd(), 'temp')

                if (!fs.existsSync(tempPath)) {
                    fs.mkdirSync(tempPath, { recursive: true })
                }

                const id = Date.now()
                const gifPath = path.join(tempPath, `pin-${id}.gif`)
                const mp4Path = path.join(tempPath, `pin-${id}.mp4`)

                try {
                    const raw = await f(media.url, 'buffer')

                    if (!raw || !raw.length) {
                        throw new Error('Gagal download GIF')
                    }

                    fs.writeFileSync(gifPath, raw)

                    await queueFFmpeg(
                        `ffmpeg -y -ignore_loop 0 -i "${gifPath}" -t 30 -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -movflags faststart -preset ultrafast -an "${mp4Path}"`
                    )

                    if (!fs.existsSync(mp4Path)) {
                        throw new Error('Gagal convert GIF')
                    }

                    await sock.sendMedia(m.chat, fs.readFileSync(mp4Path), null, m, {
                        type: 'video',
                        gifPlayback: true,
                        caption,
                        contextInfo: {
                            forwardingScore: 99,
                            isForwarded: true
                        }
                    })
                } catch (gifErr) {
                    console.error('[PinDL] GIF convert error:', gifErr.message)

                    await sock.sendMedia(m.chat, media.url, null, m, {
                        type: 'image',
                        caption,
                        contextInfo: {
                            forwardingScore: 99,
                            isForwarded: true
                        }
                    })
                } finally {
                    if (fs.existsSync(gifPath)) fs.unlinkSync(gifPath)
                    if (fs.existsSync(mp4Path)) fs.unlinkSync(mp4Path)
                }
            } else {
                await sock.sendMedia(m.chat, media.url, null, m, {
                    type: 'image',
                    caption,
                    contextInfo: {
                        forwardingScore: 99,
                        isForwarded: true
                    }
                })
            }
        } else {
            throw new Error(`Tipe media tidak didukung: ${media.type}`)
        }

        m.react('✅')

    } catch (error) {
        console.error('[PinDL] Error:', error)
        m.react('❌')

        await m.reply(
            `❌ *Gomen ne~* ✦\n\n` +
            `> ${error.message}\n\n` +
            `_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}