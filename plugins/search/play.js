const axios = require("axios")
const { fetchBuffer } = require("../../src/lib/functions")
const { prepareWAMessageMedia, generateWAMessageFromContent, proto } = require("hsnai")
const config = require("../../config")

const pluginConfig = {
    name: "play",
    alias: ["playaudio"],
    category: "search",
    description: "Putar musik dari YouTube (Faa API)",
    usage: ".play <query>",
    example: ".play Star T Rain",
    cooldown: 15,
    energi: 1,
    isEnabled: true
}

function formatDuration(ms) {
    const totalSec = Math.floor(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${min}:${sec.toString().padStart(2, "0")}`
}

async function handler(m, { sock }) {
    const query = m.text?.trim()

    if (!query) {
        return m.reply(
            `🎤 *𝑷𝑳𝑨𝒀 - 𝑰𝑫𝑶𝑳 𝑺𝑻𝑨𝑮𝑬*\n\n` +
            `> Contoh:\n` +
            `\`${m.prefix}play Star T Rain\``
        )
    }

    await m.react("🎧")

    try {
        // =========================
        // FETCH API (PRIMARY + FALLBACK)
        // =========================
        let data, isFallback = false
        try {
            const api = `https://api-faa.my.id/faa/ytplay?query=${encodeURIComponent(query)}`
            const resp = await axios.get(api)
            if (!resp.data.status || !resp.data.result) throw new Error("primary empty")
            data = resp.data
        } catch (primaryErr) {
            console.error("[Play] Primary API failed, trying fallback:", primaryErr.message)
            const fallbackApi = `https://api-faa.my.id/faa/soundcloud-play?query=${encodeURIComponent(query)}`
            const fbResp = await axios.get(fallbackApi)
            if (!fbResp.data.status || !fbResp.data.result) {
                throw new Error("Lagu tidak ditemukan di kedua API")
            }
            data = fbResp.data
            isFallback = true
        }

        const raw = data.result

        const res = isFallback
            ? {
                title: raw.title,
                author: raw.user,
                duration_timestamp: formatDuration(raw.duration),
                views: 0,
                mp3: raw.download_url,
                thumbnail: raw.thumbnail,
                url: raw.source_url
              }
            : raw

        const caption = `
╭━━━〔 🌟 𝑯𝑶𝑺𝑯𝑰𝑵𝑶 𝑨𝑰 𝑺𝑻𝑨𝑮𝑬 🌟 〕━━━⬣
┃ 🎤 𝑵𝒐𝒘 𝑷𝒍𝒂𝒚𝒊𝒏𝒈…
┃
┃ 🎶 𝑻𝒊𝒕𝒍𝒆 : ${res.title}
┃ 📺 𝑪𝒉𝒂𝒏𝒏𝒆𝒍 : ${res.author}
┃ ⏱ 𝑫𝒖𝒓𝒂𝒕𝒊𝒐𝒏 : ${res.duration_timestamp}${!isFallback ? `\n┃ 👁 𝑽𝒊𝒆𝒘𝒔 : ${Number(res.views || 0).toLocaleString()}` : ""}
┃
┃ 🌸 Enjoy the music ~
╰━━━━━━━━━━━━━━━━━━⬣
        `.trim()

        // =========================
        // PRELOAD AUDIO & THUMBNAIL
        // =========================
        const audioBuffer = await fetchBuffer(res.mp3)
        const thumbBuf = await fetchBuffer(res.thumbnail)

        // =========================
        // PREPARE HEADER IMAGE
        // =========================
        let headerMedia = null
        try {
            headerMedia = await prepareWAMessageMedia(
                { image: thumbBuf },
                { upload: sock.waUploadToServer }
            )
        } catch (e) {
            console.error("[Play] Media prep error:", e.message)
        }

        const previewUrl = res.url || res.videoUrl || res.link ||
            `https://youtube.com/results?search_query=${encodeURIComponent(query)}`

        const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
        const saluranName = config.saluran?.name || config.bot?.name || 'Hoshino Ai-Bot'
        const saluranLink = config.saluran?.link || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'

        const buttons = [
            {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                    display_text: "▶️ Buka di YouTube",
                    url: previewUrl,
                    merchant_url: previewUrl
                })
            },
            {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                    display_text: `✨ Ikuti Saluran ${saluranName}`,
                    url: saluranLink,
                    merchant_url: saluranLink
                })
            }
        ]

        // =========================
        // KIRIM INTERACTIVE + LIMITED TIME OFFER
        // =========================
        try {
            const msg = generateWAMessageFromContent(m.chat, {
                viewOnceMessage: {
                    message: {
                        messageContextInfo: {
                            deviceListMetadata: {},
                            deviceListMetadataVersion: 2
                        },
                        interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                            body: proto.Message.InteractiveMessage.Body.fromObject({
                                text: caption
                            }),
                            footer: proto.Message.InteractiveMessage.Footer.fromObject({
                                text: `© ${config.bot?.name || 'Hoshino Ai-Bot'} v${config.bot?.version || '1.0.0'}`
                            }),
                            header: proto.Message.InteractiveMessage.Header.fromObject({
                                hasMediaAttachment: !!headerMedia,
                                ...(headerMedia || {})
                            }),
                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                                messageParamsJson: JSON.stringify({
                                    limited_time_offer: {
                                        text: res.title,
                                        url: previewUrl,
                                        copy_code: res.author,
                                        expiration_time: Date.now() * 999
                                    },
                                    bottom_sheet: {
                                        in_thread_buttons_energi: 2,
                                        divider_indices: [1, 2, 999],
                                        list_title: res.title,
                                        button_title: '🎵 Music Player'
                                    }
                                }),
                                buttons
                            }),
                            contextInfo: {
                                mentionedJid: [m.sender],
                                forwardingScore: 9999,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: saluranId,
                                    newsletterName: saluranName,
                                    serverMessageId: 127
                                }
                            }
                        })
                    }
                }
            }, { userJid: m.sender, quoted: m })

            await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id })

        } catch (interactiveErr) {
            console.error("[Play] Interactive error:", interactiveErr.message)
            // fallback biasa
            await sock.sendMessage(m.chat, { image: thumbBuf, caption }, { quoted: m })
        }

        // =========================
        // KIRIM AUDIO
        // =========================
        await sock.sendMessage(
            m.chat,
            {
                audio: audioBuffer,
                mimetype: "audio/mpeg",
                ptt: false,
                fileName: `${res.title}.mp3`
            },
            { quoted: m }
        )

        await m.react("✨")

} catch (err) {
        console.error("[Play Error]", err)
        await m.react("❌")

        const status = err.response?.status
        const msg = (status === 404 || status === 400)
            ? "Lagu tidak ditemukan. Coba pakai kata kunci lain (judul + artis lebih spesifik)."
            : err.message

        await m.reply(`❌ ERROR\n\n${msg}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}