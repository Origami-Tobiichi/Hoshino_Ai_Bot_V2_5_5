const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { exec } = require('child_process')
const { promisify } = require('util')
const { downloadMediaMessage } = require('hsnai')
const config = require('../../config.js')
const { getDatabase } = require('../../src/lib/database.js')
const { generateWAMessageFromContent, proto } = require('@itsliaaa/baileys')

const run = promisify(exec)

const pluginConfig = {
    name: "upch",
    alias: ["uploadch", "uploadsaluran", "uch"],
    category: "owner",
    description: "Kirim pesan atau media ke saluran. Gunakan #test untuk channel test.",
    usage: ".upch [#set/#test] <pesan/media> [--hsnai=<link_pesan_ch>]",
    example: ".upch Halo! --hsnai=https://whatsapp.com/channel/xxx/1083",
    cooldown: 5,
    energi: 0,
    isOwner: true,
    isEnabled: true
}

async function toOggOpus(inputBuf) {
    const tmp = path.join(process.cwd(), "temp")
    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true })
    const id = crypto.randomBytes(6).toString("hex")
    const inp = path.join(tmp, `upch_in_${id}`)
    const out = path.join(tmp, `upch_out_${id}.ogg`)
    fs.writeFileSync(inp, inputBuf)
    await run(`ffmpeg -y -i "${inp}" -vn -map_metadata -1 -ac 1 -ar 48000 -c:a libopus -b:a 96k -vbr on -application audio -f ogg "${out}"`)
    const buf = fs.readFileSync(out)
    try { fs.unlinkSync(inp); fs.unlinkSync(out); } catch {}
    return buf
}

// Parse --hsnai=<url> dari body, return { replyLink, cleanBody }
function parseHsnaiFlag(body) {
    const match = body.match(/--hsnai=(\S+)/)
    if (!match) return { replyLink: null, cleanBody: body.trim() }
    const replyLink = match[1]
    const cleanBody = body.replace(/--hsnai=\S+/, '').trim()
    return { replyLink, cleanBody }
}

// Parse server message ID dari link channel
// Format: https://whatsapp.com/channel/<invite>/1083
function parseChannelMsgId(link) {
    const match = link.match(/whatsapp\.com\/channel\/[a-zA-Z0-9_-]+\/(\d+)/)
    return match ? parseInt(match[1]) : null
}

// Fetch message key ID dari server message ID
async function fetchMsgKeyId(sock, channelJid, serverMsgId) {
    try {
        const msgs = await sock.newsletterFetchMessages('jid', channelJid, 1, serverMsgId - 1)
        const found = msgs?.find(m => String(m.server_id) === String(serverMsgId))
        return found?.message?.key?.id || null
    } catch {
        return null
    }
}

// Build contextInfo untuk reply pesan channel
async function buildReplyContext(sock, serverMsgId, channelJid) {
    if (!serverMsgId || !channelJid) return {}
    const msgKeyId = await fetchMsgKeyId(sock, channelJid, serverMsgId)
    return {
        contextInfo: {
            remoteJid: channelJid,
            stanzaId: msgKeyId || String(serverMsgId),
            participant: channelJid,
            quotedMessage: {
                conversation: ''
            }
        }
    }
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const rawBody = m.body?.replace(/^\.\w+\s*/i, '').trim() || ''

    // ── Parse --hsnai flag ────────────────────────────────────────────────
    const { replyLink, cleanBody: bodyAfterFlag } = parseHsnaiFlag(rawBody)

    let replyContext = {}
    if (replyLink) {
        const serverMsgId = parseChannelMsgId(replyLink)
        // Ambil channel JID dari link
        const inviteMatch = replyLink.match(/whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)/)
        let channelJid = null

        if (inviteMatch) {
            try {
                const meta = await sock.newsletterMetadata('invite', inviteMatch[1])
                channelJid = meta?.id || null
            } catch {}
        }

        if (!channelJid || !serverMsgId) {
            m.react('❌')
            return m.reply(
                `✨ *【 ᴜᴘᴄʜ — ʀᴇᴘʟʏ 】* ✨\n\n` +
                `❌ Link pesan channel tidak valid!\n\n` +
                `📝 *Format:*\n` +
                `\`.upch <teks> --hsnai=https://whatsapp.com/channel/xxx/1083\`\n\n` +
                `> Pastikan link-nya ada nomor pesan di akhir ya~`
            )
        }

        replyContext = await buildReplyContext(sock, serverMsgId, channelJid)
    }

    const body = bodyAfterFlag

    // ===== #set =====
    const isSet = /^#set\b/i.test(body)
    if (isSet) {
        const setInput = body.replace(/^#set\s*/i, '').trim()

        let newJid = null
        let newName = 'Test Channel'

        const linkMatch = setInput.match(/whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)/)
        if (linkMatch) {
            try {
                const meta = await sock.newsletterMetadata('invite', linkMatch[1])
                newJid = meta?.id || null
                newName = meta?.name || 'Test Channel'
            } catch {}
        }

        if (!newJid) {
            const jidMatch = setInput.match(/(\d+@newsletter)/)
            if (jidMatch) {
                newJid = jidMatch[1]
                try {
                    const followedList = await sock.newsletterFetchAllSubscribe()
                    const found = followedList?.find(c => c.id === newJid)
                    if (found?.name) newName = found.name
                } catch {}
            }
        }

        if (!newJid) {
            m.react('❌')
            return m.reply(
                `✨ *【 ᴜᴘᴄʜ — sᴇᴛ ᴛᴇsᴛ ᴄʜᴀɴɴᴇʟ 】* ✨\n\n` +
                `❌ Link/JID tidak valid!\n\n` +
                `📝 *Format:*\n` +
                `\`.upch #set https://whatsapp.com/channel/xxx\`\n` +
                `\`.upch #set 120363xxx@newsletter\``
            )
        }

        db.setting('testChannelId', newJid)
        db.setting('testChannelName', newName)

        m.react('✅')
        return m.reply(
            `✨ *【 ᴜᴘᴄʜ — sᴇᴛ ᴛᴇsᴛ ᴄʜᴀɴɴᴇʟ 】* ✨\n\n` +
            `✅ Test channel berhasil diset!\n\n` +
            `📛 *Nama:* ${newName}\n` +
            `🆔 *JID:* ${newJid}\n\n` +
            `> Sekarang \`.upch #test\` akan kirim ke channel ini~ 🌟`
        )
    }

    // ===== #test =====
    const isTest = /^#test\b/i.test(body)
    const caption = isTest ? body.replace(/^#test\s*/i, '').trim() : body

    const testChId = db.setting('testChannelId') || null
    const testChName = db.setting('testChannelName') || 'Test Channel'

    if (isTest && !testChId) {
        m.react('❌')
        return m.reply(
            `✨ *【 ᴜᴘᴄʜ — ᴛᴇsᴛ ᴄʜᴀɴɴᴇʟ 】* ✨\n\n` +
            `❌ Test channel belum diset!\n\n` +
            `📝 *Set dulu dengan:*\n` +
            `\`.upch #set https://whatsapp.com/channel/xxx\``
        )
    }

    const chId = isTest ? testChId : config.saluran.id
    const chName = isTest ? testChName : config.saluran.name

    const quoted = m.quoted || m
    const isImage = m.isImage || (m.quoted && m.quoted.type === 'imageMessage')
    const isVideo = m.isVideo || (m.quoted && m.quoted.type === 'videoMessage')
    const isAudio = m.type === 'audioMessage' || (m.quoted && m.quoted.type === 'audioMessage')
    const isSticker = m.type === 'stickerMessage' || (m.quoted && m.quoted.type === 'stickerMessage')
    const isMedia = isImage || isVideo || isAudio || isSticker

    const aiHeader = `✨ *【 ɪᴅᴏʟ sᴛᴀɢᴇ ᴜᴘʟᴏᴀᴅ${isTest ? ' — 🧪 TEST' : ''} 】* ✨\n\n`
    const aiFooter = `\n\n🎤 *Target:* _${chName}_` + (replyLink ? `\n💬 *Reply ke:* pesan #${parseChannelMsgId(replyLink)}` : '')

    if (!isMedia && !caption) {
        return m.reply(
            aiHeader +
            `Halo Manager! Ayo kirim sesuatu ke Saluran! 🌟\n\n` +
            `📝 *Mode Normal:*\n` +
            `\`.upch <teks>\` atau reply media\n\n` +
            `🧪 *Mode Test:*\n` +
            `\`.upch #test <teks>\` → kirim ke test channel\n` +
            `\`.upch #set <link/jid>\` → set test channel\n\n` +
            `💬 *Mode Reply:*\n` +
            `\`.upch <teks> --hsnai=https://whatsapp.com/channel/xxx/1083\`\n\n` +
            `📸 *Support:* Gambar, Video, Audio (VN), & Sticker` +
            aiFooter
        )
    }

    m.react("🌟")

    try {
        if (!isMedia && caption) {
            await sock.sendMessage(chId, { text: caption, ...replyContext })
            m.react("💖")
            return m.reply(`${aiHeader}Yatta! Teks sudah terkirim ke panggung utama! ✨${aiFooter}`)
        }

        const mediaBuf = await downloadMediaMessage(quoted, "buffer", {})
        if (!mediaBuf) throw new Error("Gagal mengambil media.")

        if (isImage) {
            await sock.sendMessage(chId, { image: mediaBuf, caption: caption || undefined, ...replyContext })
            m.react("📸")
            return m.reply(`${aiHeader}Foto cantik ini sudah tayang di saluran! 🎀${aiFooter}`)
        }

        if (isVideo) {
            await sock.sendMessage(chId, { video: mediaBuf, caption: caption || undefined, ...replyContext })
            m.react("🎬")
            return m.reply(`${aiHeader}Video luar biasa ini sudah di-publish! 💫${aiFooter}`)
        }

        if (isAudio) {
            const opusBuf = await toOggOpus(mediaBuf)
            await sock.sendMessage(chId, {
                audio: opusBuf,
                mimetype: "audio/ogg; codecs=opus",
                ptt: true,
                ...replyContext
            })
            m.react("🎶")
            return m.reply(`${aiHeader}Suara merdu ini sudah terkirim sebagai VN! 🎙${aiFooter}`)
        }

        if (isSticker) {
            const msg = quoted.message?.stickerMessage || quoted.message?.[quoted.type] || {}

            const stickerMessage = proto.Message.StickerMessage.fromObject({
                url: msg.url,
                fileSha256: msg.fileSha256,
                fileEncSha256: msg.fileEncSha256,
                mediaKey: msg.mediaKey,
                mimetype: msg.mimetype || 'image/webp',
                height: msg.height || 512,
                width: msg.width || 512,
                directPath: msg.directPath,
                fileLength: msg.fileLength,
                mediaKeyTimestamp: msg.mediaKeyTimestamp,
                isAnimated: msg.isAnimated || false,
                stickerSentTs: Date.now(),
                isAvatar: false,
                isAiSticker: true,
                premium: 1,
                isLottie: false,
                accessibilityLabel: msg.accessibilityLabel || '',
                ...(replyContext.contextInfo ? { contextInfo: replyContext.contextInfo } : {})
            })

            const waMsg = generateWAMessageFromContent(
                chId,
                { stickerMessage },
                { userJid: sock.user.id }
            )

            await sock.relayMessage(chId, waMsg.message, {
                messageId: waMsg.key.id
            })

            m.react("🎴")
            return m.reply(`${aiHeader}Sticker premium sudah dikirim ke saluran! 🎀${aiFooter}`)
        }

    } catch (e) {
        console.error(e)
        m.react("💔")
        m.reply(`Gomen ne, Manager... Sepertinya ada masalah teknis saat upload. ☹\n\n_${e.message}_`)
    }
}

module.exports = { config: pluginConfig, handler }