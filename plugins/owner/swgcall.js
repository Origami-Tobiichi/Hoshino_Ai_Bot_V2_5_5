const hsAsset = require('../../src/lib/assets')
const { fileTypeFromBuffer } = require('file-type')
const fs = require('fs')
const path = require('path')
const { config } = require('../../config')

const botConfig = config

const pluginConfig = {
    name: 'swgcall',
    alias: ['swgcsemua', 'swgcbroadcast', 'swgcbc', 'groupstoryall'],
    category: 'owner',
    description: 'Post Group Status/Story ke SEMUA grup sekaligus (border hijau)',
    usage: '.swgcall <teks> atau reply media',
    example: '.swgcall Pengumuman penting!',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 0,
    isEnabled: true
}

if (!global._swgcallPending) global._swgcallPending = new Map()

async function handler(m, { sock }) {
    const args = m.args || []
    const text = m.text || ''

    // ── Konfirmasi --yes ───────────────────────────────────────────────────
    if (args[0] === '--yes') {
        const pending = global._swgcallPending?.get(m.sender)
        if (!pending) {
            return m.reply(`Muu~ nggak ada data pending nih~ Kirim ulang media + .swgcall dulu ya! 🌸`)
        }

        const { rawContent, groups, tempFile } = pending

        await m.react('🔄')

        let content = {}
        if (rawContent.image)      content = { image: rawContent.image, caption: rawContent.caption || '' }
        else if (rawContent.video) content = { video: rawContent.video, caption: rawContent.caption || '' }
        else if (rawContent.audio) content = { audio: rawContent.audio, mimetype: rawContent.mimetype || 'audio/mpeg', ptt: rawContent.ptt || false }
        else if (rawContent.text)  content = { text: rawContent.text }

        let success = 0
        let failed = 0
        const failedGroups = []
        const total = groups.length
        const delay = ms => new Promise(r => setTimeout(r, ms))

        for (let i = 0; i < groups.length; i++) {
            const [groupId, meta] = groups[i]
            try {
                await sock.sendMessage(groupId, { groupStatusMessage: content })
                success++
            } catch (e) {
                failed++
                failedGroups.push(meta.subject || groupId)
            }
            if ((i + 1) % 5 === 0) await delay(2000)
            else await delay(500)
        }

        global._swgcallPending.delete(m.sender)
        if (tempFile && fs.existsSync(tempFile)) {
            try { fs.unlinkSync(tempFile) } catch {}
        }

        let report =
            `✅ *Broadcast SW GC selesai~* ⭐\n\n` +
            `> Total: *${total}* grup\n` +
            `> Berhasil: *${success}* ✅\n` +
            `> Gagal: *${failed}* ❌`

        if (failedGroups.length > 0) {
            report += `\n\n*Grup yang gagal:*\n` + failedGroups.map(g => `> • ${g}`).join('\n')
        }

        await m.reply(report)
        await m.react('✅')
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
            tempFile = path.join(tempDir, `swgcall_${Date.now()}.${ext}`)
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
            `> \`${m.prefix}swgcall teks\` - Story teks ke semua grup\n` +
            `> Reply gambar/video/audio + \`${m.prefix}swgcall\`\n` +
            `> Kirim gambar/video + caption \`${m.prefix}swgcall\`\n\n` +
            `⚠️ _Fitur ini akan kirim story ke SEMUA grup lho~_`
        )
    }

    // ── Fetch grup & konfirmasi ────────────────────────────────────────────
    try {
        global.isFetchingGroups = true
        const groups = await sock.groupFetchAllParticipating()
        global.isFetchingGroups = false
        const groupList = Object.entries(groups)

        if (groupList.length === 0) return m.reply(`Eeh~ aku nggak ada di grup manapun nih~ 👥`)

        global._swgcallPending.set(m.sender, {
            rawContent,
            groups: groupList,
            tempFile,
            timestamp: Date.now()
        })

        const mediaType = rawContent.text ? 'Teks' : rawContent.image ? 'Gambar' : rawContent.video ? 'Video' : rawContent.audio ? (rawContent.ptt ? 'Voice Note' : 'Audio') : 'Unknown'
        const estimatedTime = Math.ceil(groupList.length * 1.5)

        let thumbnail = null
        try { thumbnail = (await hsAsset.buffer('images/hsnai2')) } catch {}

        await sock.sendMessage(m.chat, {
            text:
                `📢 *Konfirmasi Broadcast SW GC~* ✨\n\n` +
                `> Media: *${mediaType}*\n` +
                `> Total Grup: *${groupList.length}*\n` +
                `> Estimasi: *~${estimatedTime} detik*\n\n` +
                `⚠️ _Story bakal dipost ke SEMUA grup lho~_\n` +
                `_Tekan tombol konfirmasi untuk lanjut ya!_ 💕`,
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
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: `✅ Kirim ke ${groupList.length} Grup`,
                        id: `${m.prefix}swgcall --yes`
                    })
                },
                {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: '❌ Batal',
                        id: `${m.prefix}cancelswgcall`
                    })
                }
            ]
        })
    } catch (error) {
        await m.reply(`Muu~ gagal ambil daftar grup nih~ _${error.message}_ 🌸`)
        if (tempFile && fs.existsSync(tempFile)) try { fs.unlinkSync(tempFile) } catch {}
        global._swgcallPending?.delete(m.sender)
    }
}

module.exports = { config: pluginConfig, handler }