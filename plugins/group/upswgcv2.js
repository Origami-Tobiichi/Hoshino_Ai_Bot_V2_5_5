const { generateWAMessage } = require('hsnai')

const pluginConfig = {
    name: 'upswgcv2',
    alias: ['swgcadminv2', 'grupstoryv2'],
    category: 'group',
    description: 'Post Story Group V2 (ring pink) khusus untuk Admin di grup ini',
    usage: '.upswgcv2 <teks> atau reply media',
    example: '.upswgcv2 Halo warga grup!',
    isOwner: false,
    isAdmin: true,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    isEnabled: true
}

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

    await sock.relayMessage(targetGroupId, {
        groupStatusMessageV2: { message: mediaMessage }
    }, { messageId: genMsg.key.id })

    return genMsg
}

async function handler(m, { sock }) {
    const text = m.text || ''
    let content = {}

    if (m.quoted && (m.quoted.isImage || m.quoted.isVideo || m.quoted.isAudio || m.quoted.mimetype?.startsWith('audio'))) {
        try {
            const buffer = await m.quoted.download()
            if (m.quoted.isImage)       { content.image = buffer; content.caption = text || '' }
            else if (m.quoted.isVideo)  { content.video = buffer; content.caption = text || '' }
            else                        { content.audio = buffer; content.mimetype = m.quoted.mimetype || 'audio/mpeg'; content.ptt = m.quoted.msg?.ptt || false }
        } catch (e) {
            return m.reply(`Eeh~ gagal ambil media dari balasan nih~ ${e.message} 💕`)
        }
    } else if (m.isImage || m.isVideo || m.isAudio || m.mimetype?.startsWith('audio')) {
        try {
            const buffer = await m.download()
            if (m.isImage)       { content.image = buffer; content.caption = text || '' }
            else if (m.isVideo)  { content.video = buffer; content.caption = text || '' }
            else                 { content.audio = buffer; content.mimetype = m.mimetype || 'audio/mpeg'; content.ptt = m.msg?.ptt || false }
        } catch (e) {
            return m.reply(`Muu~ gagal download medianya nih~ ${e.message} 🌸`)
        }
    } else if (text && text.trim()) {
        content = { text, font: 0, backgroundColor: '#128C7E' }
    } else {
        return m.reply(
            `Nee~ cara pakainya gini lho~ ✨\n\n` +
            `> \`${m.prefix}upswgcv2 teks\`\n` +
            `> Reply gambar/video/audio + \`${m.prefix}upswgcv2\`\n` +
            `> Kirim gambar/video + caption \`${m.prefix}upswgcv2\``
        )
    }

    try {
        await m.react('⏳')
        await sendGroupStatusV2(sock, m.chat, content)
        await m.react('✅')
        await m.reply(`✅ Yeay~ Status grup V2 (ring pink) berhasil diperbarui~ ⭐💕`)
    } catch (error) {
        await m.react('❌')
        await m.reply(`Muu~ gagal posting status nih~ _${error.message}_ 🌸`)
    }
}

module.exports = { config: pluginConfig, handler }