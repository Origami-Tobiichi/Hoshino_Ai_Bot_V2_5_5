const hsAsset = require('../../src/lib/assets')
const { fileTypeFromBuffer } = require('file-type')
const fs = require('fs')
const path = require('path')
const { config } = require('../../config')
const { generateWAMessageContent, generateWAMessageFromContent } = require('hsnai')
const crypto = require('crypto')
const botConfig = config

const pluginConfig = {
    name: 'swgc',
    alias: ['statusgrup', 'swgroup', 'groupstory', 'toswgc'],
    category: 'owner',
    description: 'Post Group Status/Story ke grup pilihan (border hijau)',
    usage: '.swgc <teks> atau reply media',
    example: '.swgc Halo semua!',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

const pendingSwgc = new Map()

async function sendGroupStatus(sock, jid, content) {
    const inside = await generateWAMessageContent(content, {
        upload: sock.waUploadToServer
    })
    const messageSecret = crypto.randomBytes(32)
    const m = generateWAMessageFromContent(jid, {
        messageContextInfo: {
            messageSecret
        },
        groupStatusMessageV2: {
            message: {
                ...inside,
                messageContextInfo: {
                    messageSecret
                }
            }
        }
    }, {})
    await sock.relayMessage(jid, m.message, {
        messageId: m.key.id
    })
    return m
}

async function handler(m, { sock, db }) {
    const args = m.args || []
    const text = m.text || ''
    
    if (args[0] === '--confirm' && args[1]) {
        const targetGroupId = args[1]
        const pendingData = pendingSwgc.get(m.sender)
        
        if (!pendingData) {
            await m.reply(`⚠️ *Tidak ada data pending. Silakan kirim ulang media + .swgc*`)
            return
        }
        
        try {
            let groupName = 'Grup'
            try {
                const meta = await sock.groupMetadata(targetGroupId)
                groupName = meta.subject
            } catch (e) {}
            
            await m.react('🕕')
            
            const rawContent = pendingData.rawContent
            let content = {}
            
            if (rawContent.image) {
                content = { image: rawContent.image, caption: rawContent.caption || '' }
            } else if (rawContent.video) {
                content = { video: rawContent.video, caption: rawContent.caption || '' }
            } else if (rawContent.text) {
                content = { text: rawContent.text }
            }
            
            await sendGroupStatus(sock, targetGroupId, content)
            
            const mediaType = pendingData.rawContent.text ? 'Teks' 
                            : pendingData.rawContent.image ? 'Gambar' 
                            : 'Video'
            
            const successMsg = `✅ Berhasil up sw ke grup ${groupName}`
            
            await m.reply(successMsg)
            pendingSwgc.delete(m.sender)
            
            if (pendingData.tempFile && fs.existsSync(pendingData.tempFile)) {
                setTimeout(() => {
                    try { fs.unlinkSync(pendingData.tempFile) } catch (e) {}
                }, 5000)
            }
            
        } catch (error) {
            await m.reply(
                `❌ *ᴇʀʀᴏʀ*\n\n` +
                `> Gagal posting story.\n` +
                `> _${error.message}_`
            )
        }
        return
    }
    
    let rawContent = {}
    let buffer, ext, tempFile
    const tempDir = path.join(process.cwd(), 'temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
    
    if (m.quoted && (m.quoted.isImage || m.quoted.isVideo)) {
        try {
            buffer = await m.quoted.download()
            if (!buffer) {
                await m.reply(`❌ *Gomen ne~* Gagal mengambil media~ 🥺`)
                return
            }
            const fileType = await fileTypeFromBuffer(buffer)
            ext = fileType?.ext || 'bin'
            tempFile = path.join(tempDir, `swgc_${Date.now()}.${ext}`)
            fs.writeFileSync(tempFile, buffer)
            
            if (m.quoted.isImage) {
                rawContent.image = buffer
                rawContent.caption = text || ''
            } else if (m.quoted.isVideo) {
                rawContent.video = buffer
                rawContent.caption = text || ''
            }
        } catch (e) {
            await m.reply(`❌ *Gomen ne~* Media gagal diproses: ${e.message} 🥺`)
            return
        }
    } else if (m.isImage || m.isVideo) {
        try {
            buffer = await m.download()
            if (!buffer) {
                await m.reply(`❌ *Gomen ne~* Gagal mengambil media~ 🥺`)
                return
            }
            const fileType = await fileTypeFromBuffer(buffer)
            ext = fileType?.ext || 'bin'
            tempFile = path.join(tempDir, `swgc_${Date.now()}.${ext}`)
            fs.writeFileSync(tempFile, buffer)
            
            if (m.isImage) {
                rawContent.image = buffer
                rawContent.caption = text || ''
            } else if (m.isVideo) {
                rawContent.video = buffer
                rawContent.caption = text || ''
            }
        } catch (e) {
            await m.reply(`❌ *Gomen ne~* Media gagal diproses: ${e.message} 🥺`)
            return
        }
    } else if (text && text.trim()) {
        rawContent.text = text
        rawContent.font = 0
        rawContent.backgroundColor = '#128C7E'
    } else {
        await m.reply(
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> \`${m.prefix}swgc teks\` - Story teks\n` +
            `> Reply gambar/video + \`${m.prefix}swgc\`\n` +
            `> Kirim gambar/video + caption \`${m.prefix}swgc\``
        )
        return
    }
    
    pendingSwgc.set(m.sender, {
        rawContent: rawContent,
        tempFile: tempFile,
        timestamp: Date.now()
    })
    
    try {
        global.isFetchingGroups = true
        const groups = await sock.groupFetchAllParticipating()
        global.isFetchingGroups = false
        const groupList = Object.entries(groups)
        
        if (groupList.length === 0) {
            await m.reply(`⚠️ *Bot tidak berada di grup manapun.*`)
            return
        }
        
        const groupRows = groupList.map(([id, meta]) => ({
            title: meta.subject || 'Unknown Group',
            description: id,
            id: `${m.prefix}swgc --confirm ${id}`
        }))
        
        const prefix = m.prefix || '.'
        const mediaType = rawContent.text ? 'Teks' : rawContent.image ? 'Gambar' : 'Video'
        
        let thumbnail = null
        try {
            thumbnail = (await hsAsset.buffer('images/hsnai2'))
        } catch (e) {}
        
        await sock.sendMessage(m.chat, {
            text: `📋 *ᴘɪʟɪʜ ɢʀᴜᴘ ᴜɴᴛᴜᴋ ᴘᴏsᴛ sᴛᴏʀʏ*\n\n` +
                  `> Media: *${mediaType}*\n` +
                  `> Total Grup: *${groupList.length}*\n\n` +
                  `_Pilih grup dari daftar di bawah:_`,
            contextInfo: {
                isForwarded: true,
                forwardingScore: 999,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: botConfig?.saluran?.id,
                    newsletterName: botConfig?.saluran?.name
                },
},
            footer: 'OURIN MD',
            interactiveButtons: [
                {
                    name: 'single_select',
                    buttonParamsJson: JSON.stringify({
                        title: '🏠 Pilih Grup',
                        sections: [{
                            title: 'Daftar Grup',
                            rows: groupRows
                        }]
                    })
                },
                {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: '❌ Batal',
                        id: `${prefix}cancelswgc`
                    })
                }
            ]
        })
    } catch (error) {
        await m.reply(
            `❌ *ᴇʀʀᴏʀ*\n\n` +
            `> Gagal mengambil daftar grup.\n` +
            `> _${error.message}_`
        )
        if (tempFile && fs.existsSync(tempFile)) {
            try { fs.unlinkSync(tempFile) } catch (e) {}
        }
        pendingSwgc.delete(m.sender)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}