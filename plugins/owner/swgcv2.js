const hsAsset = require('../../src/lib/assets')
const { fileTypeFromBuffer } = require('file-type')
const fs = require('fs')
const path = require('path')
const { config } = require('../../config')
const { generateWAMessage } = require('hsnai')

const botConfig = config

const pluginConfig = {
    name: 'swgcv2',
    alias: ['statusgrupv2'],
    category: 'owner',
    description: 'Post Group Status V2 ke grup pilihan (ring pink)',
    usage: '.swgcv2 <teks> atau reply media',
    example: '.swgcv2 Halo semua!',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

const pendingSwgcV2 = new Map()

async function sendGroupStatusV2(sock, targetGroupId, baseContent) {
    const genMsg = await generateWAMessage(targetGroupId, baseContent, {
        userJid: sock.user.id,
        upload: sock.waUploadToServer
    })

    const msgType = Object.keys(genMsg.message).find(k => k.endsWith('Message') && k !== 'senderKeyDistributionMessage')

    let mediaMessage = {}
    if (msgType) {
        mediaMessage[msgType] = genMsg.message[msgType]
        const newContextInfo = {
            isGroupStatus: true,
            statusSourceType: baseContent.text ? 4 : baseContent.audio ? 3 : baseContent.video ? 1 : 0,
            featureEligibilities: { canBeReshared: true, canReceiveMultiReact: false },
            statusAttributions: [{ type: 10 }],
            statusAudienceMetadata: { audienceType: 1 }
        }
        if (mediaMessage[msgType].contextInfo) Object.assign(mediaMessage[msgType].contextInfo, newContextInfo)
        else mediaMessage[msgType].contextInfo = newContextInfo
    }

    await sock.relayMessage(targetGroupId, { groupStatusMessageV2: { message: mediaMessage } }, { messageId: genMsg.key.id })
    return genMsg
}

async function handler(m, { sock }) {
    const args = m.args || []
    const text = m.text || ''

    // ── Konfirmasi --confirm <groupId> ────────────────────────────────────
    if (args[0] === '--confirm' && args[1]) {
        const targetGroupId = args[1]
        const pendingData = pendingSwgcV2.get(m.sender)

        if (!pendingData) {
            return m.reply(`Muu~ nggak ada data pending nih~ Kirim ulang media + .swgcv2 dulu ya! 🌸`)
        }

        try {
            let groupName = 'Grup'
            try {
                const meta = await sock.groupMetadata(targetGroupId)
                groupName = meta.subject
            } catch {}

            await m.react('🕕')

            const rawContent = pendingData.rawContent
            let baseContent = {}
            if (rawContent.image)      baseContent = { image: rawContent.image, caption: rawContent.caption || '' }
            else if (rawContent.video) baseContent = { video: rawContent.video, caption: rawContent.caption || '' }
            else if (rawContent.audio) baseContent = { audio: rawContent.audio, mimetype: rawContent.mimetype || 'audio/mpeg', ptt: rawContent.ptt || false }
            else if (rawContent.text)  baseContent = { text: rawContent.text }

            await sendGroupStatusV2(sock, targetGroupId, baseContent)

            await m.reply(`✅ Yeay~ berhasil up SW V2 (ring pink) ke grup *${groupName}*! ⭐💕`)
            pendingSwgcV2.delete(m.sender)

            if (pendingData.tempFile && fs.existsSync(pendingData.tempFile)) {
                setTimeout(() => { try { fs.unlinkSync(pendingData.tempFile) } catch {} }, 5000)
            }
        } catch (error) {
            await m.reply(`Muu~ gagal posting story V2 nih~ _${error.message}_ 🌸`)
        }
        return
    }

    // ── Proses media/teks ──────────────────────────────────────────────────
    let rawContent = {}
    let buffer, ext, tempFile
    const tempDir = path.join(process.cwd(), 'temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

    const source = m.quoted && (m.quoted.isImage || m.quoted.isVideo || m.quoted.isAudio || m.quoted.mimetype?.startsWith('audio'))
        ? m.quoted
        : (m.isImage || m.isVideo || m.isAudio || m.mimetype?.startsWith('audio')) ? m : null

    if (source) {
        try {
            buffer = await source.download()
            if (!buffer) return m.reply(`Eeh~ gagal ambil medianya nih~ Coba lagi ya! 💕`)

            const fileType = await fileTypeFromBuffer(buffer)
            ext = fileType?.ext || 'bin'
            tempFile = path.join(tempDir, `swgcv2_${Date.now()}.${ext}`)
            fs.writeFileSync(tempFile, buffer)

            const isImage = source.isImage || fileType?.mime?.startsWith('image')
            const isVideo = source.isVideo || fileType?.mime?.startsWith('video')
            const isAudio = source.isAudio || fileType?.mime?.startsWith('audio') || source.mimetype?.startsWith('audio')

            if (isImage)      { rawContent.image = buffer; rawContent.caption = text || '' }
            else if (isVideo) { rawContent.video = buffer; rawContent.caption = text || '' }
            else if (isAudio) { rawContent.audio = buffer; rawContent.mimetype = fileType?.mime || source.mimetype || 'audio/mpeg'; rawContent.ptt = source.msg?.ptt || false }
        } catch (e) {
            return m.reply(`Muu~ medianya gagal diproses nih~ ${e.message} 🌸`)
        }
    } else if (text && text.trim()) {
        rawContent.text = text
        rawContent.font = 0
        rawContent.backgroundColor = '#128C7E'
    } else {
        return m.reply(
            `Nee~ cara pakainya gini lho~ ✨\n\n` +
            `> \`${m.prefix}swgcv2 teks\` - Story teks\n` +
            `> Reply gambar/video/audio + \`${m.prefix}swgcv2\`\n` +
            `> Kirim gambar/video + caption \`${m.prefix}swgcv2\``
        )
    }

    pendingSwgcV2.set(m.sender, { rawContent, tempFile, timestamp: Date.now() })

    // ── Fetch grup & tampilkan dropdown ───────────────────────────────────
    try {
        global.isFetchingGroups = true
        const groups = await sock.groupFetchAllParticipating()
        global.isFetchingGroups = false
        const groupList = Object.entries(groups)

        if (groupList.length === 0) return m.reply(`Eeh~ aku nggak ada di grup manapun nih~ 👥`)

        const groupRows = groupList.map(([id, meta]) => ({
            title: meta.subject || 'Unknown Group',
            description: id,
            id: `${m.prefix}swgcv2 --confirm ${id}`
        }))

        const mediaType = rawContent.text ? 'Teks' : rawContent.image ? 'Gambar' : rawContent.video ? 'Video' : rawContent.audio ? (rawContent.ptt ? 'Voice Note' : 'Audio') : 'Media'

        let thumbnail = null
        try { thumbnail = (await hsAsset.buffer('images/hsnai2')) } catch {}

        await sock.sendMessage(m.chat, {
            text:
                `📋 *Pilih grup untuk post story V2~* ✨\n\n` +
                `> Media: *${mediaType}*\n` +
                `> Total Grup: *${groupList.length}*\n\n` +
                `_Pilih grup dari daftar di bawah ya~_ 💕`,
            contextInfo: {
                isForwarded: true,
                forwardingScore: 999,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: botConfig?.saluran?.id,
                    newsletterName: botConfig?.saluran?.name
                },
},
            footer: botConfig.bot?.name || 'Hoshino Ai Bot',
            interactiveButtons: [
                {
                    name: 'single_select',
                    buttonParamsJson: JSON.stringify({
                        title: '🏠 Pilih Grup',
                        sections: [{ title: 'Daftar Grup', rows: groupRows }]
                    })
                },
                {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: '❌ Batal',
                        id: `${m.prefix}cancelswgcv2`
                    })
                }
            ]
        })
    } catch (error) {
        await m.reply(`Muu~ gagal ambil daftar grup nih~ _${error.message}_ 🌸`)
        if (tempFile && fs.existsSync(tempFile)) try { fs.unlinkSync(tempFile) } catch {}
        pendingSwgcV2.delete(m.sender)
    }
}

module.exports = { config: pluginConfig, handler, pendingSwgcV2 }