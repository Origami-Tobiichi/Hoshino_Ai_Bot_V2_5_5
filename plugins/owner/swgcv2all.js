const { fileTypeFromBuffer } = require('file-type')
const fs = require('fs')
const path = require('path')
const { config } = require('../../config')
const { generateWAMessage } = require('hsnai')

const botConfig = config

const pluginConfig = {
    name: 'swgcv2all',
    alias: ['statusgrupv2all'],
    category: 'owner',
    description: 'Post Group Status V2 ke SEMUA grup (ring pink)',
    usage: '.swgcv2all <teks> atau reply media',
    example: '.swgcv2all Halo semua grup!',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.text || ''
    let rawContent = null

    const source = m.quoted && (m.quoted.isImage || m.quoted.isVideo || m.quoted.isAudio || m.quoted.mimetype?.startsWith('audio'))
        ? m.quoted
        : (m.isImage || m.isVideo || m.isAudio || m.mimetype?.startsWith('audio')) ? m : null

    if (source) {
        try {
            const buffer = await source.download()
            if (!buffer) return m.reply(`Eeh~ gagal ambil medianya nih~ Coba lagi ya! 💕`)

            const fileType = await fileTypeFromBuffer(buffer)
            const mime = fileType?.mime || 'application/octet-stream'

            if (mime.startsWith('image/'))      rawContent = { image: buffer, caption: text }
            else if (mime.startsWith('video/')) rawContent = { video: buffer, caption: text }
            else if (mime.startsWith('audio/')) rawContent = { audio: buffer, mimetype: 'audio/mpeg', ptt: source.msg?.ptt || source.ptt || false }
            else return m.reply(`Muu~ format medianya nggak didukung untuk SW GC nih~ 🌸`)
        } catch (e) {
            return m.reply(`Muu~ medianya gagal diproses nih~ ${e.message} 🌸`)
        }
    } else if (text && text.trim()) {
        rawContent = { text }
    } else {
        return m.reply(
            `Nee~ cara pakainya gini lho~ ✨\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
            `┃ ${m.prefix}swgcv2all Halo semua!\n` +
            `┃ atau reply gambar/video dengan caption ${m.prefix}swgcv2all\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }

    await m.react('🕕')

    try {
        const groups = await sock.groupFetchAllParticipating()
        const groupIds = Object.keys(groups)

        if (groupIds.length === 0) {
            await m.react('❌')
            return m.reply(`Eeh~ aku nggak ada di grup manapun nih~ 👥`)
        }

        await m.reply(`⏳ Lagi broadcast SW GC V2 ke *${groupIds.length}* grup~ Tunggu sebentar ya! 💕`)

        let successCount = 0
        let failCount = 0
        const delay = ms => new Promise(r => setTimeout(r, ms))

        for (let i = 0; i < groupIds.length; i++) {
            const targetGroupId = groupIds[i]
            try {
                let baseContent = {}
                if (rawContent.image)      baseContent = { image: rawContent.image, caption: rawContent.caption || '' }
                else if (rawContent.video) baseContent = { video: rawContent.video, caption: rawContent.caption || '' }
                else if (rawContent.audio) baseContent = { audio: rawContent.audio, mimetype: rawContent.mimetype || 'audio/mpeg', ptt: rawContent.ptt || false }
                else if (rawContent.text)  baseContent = { text: rawContent.text }

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
                        statusSourceType: rawContent.text ? 4 : rawContent.audio ? 3 : rawContent.video ? 1 : 0,
                        featureEligibilities: { canBeReshared: true, canBeSentToParticipants: true },
                        statusAttributions: [{ type: 10 }],
                        statusAudienceMetadata: { audienceType: 1 }
                    }
                    if (mediaMessage[msgType].contextInfo) Object.assign(mediaMessage[msgType].contextInfo, newContextInfo)
                    else mediaMessage[msgType].contextInfo = newContextInfo
                }

                await sock.relayMessage(targetGroupId, {
                    groupStatusMessageV2: { message: mediaMessage }
                }, { messageId: genMsg.key.id })

                successCount++
            } catch { failCount++ }

            if ((i + 1) % 5 === 0) await delay(2000)
            else await delay(500)
        }

        await m.react('✅')
        await m.reply(
            `✅ *Broadcast SW GC V2 selesai~* ⭐\n\n` +
            `╭┈┈⬡「 📊 *ʀᴇsᴜʟᴛ* 」\n` +
            `┃ 🌐 Total Grup: *${groupIds.length}*\n` +
            `┃ ✅ Sukses: *${successCount}*\n` +
            `┃ ❌ Gagal: *${failCount}*\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> Story V2 (ring pink) udah kekirim ke semua grup~ 💕`
        )
    } catch (error) {
        await m.react('❌')
        await m.reply(`Muu~ ada yang salah nih~ _${error.message}_ 🌸`)
    }
}

module.exports = { config: pluginConfig, handler }