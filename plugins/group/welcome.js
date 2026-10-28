const hsAsset = require('../../src/lib/assets')
const config = require('../../config')
const { getDatabase } = require('../../src/lib/database')
const { createWideDiscordCard } = require('../../src/lib/welcomeCard')
const path = require('path')
const fs = require('fs')
const axios = require('axios')
const sharp = require('sharp')

const pluginConfig = {
    name: 'welcome',
    alias: ['wc'],
    category: 'group',
    description: 'Mengatur welcome message untuk grup',
    usage: '.welcome <on/off>',
    example: '.welcome on',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    isAdmin: true,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

const WELCOME_BUTTON_TEXTS = [
    '💌 Sapa Ai, yuk kenalan~ ☆',
    '🌸 Salam Kenal, Bintang Baru ✨',
    '⭐ Yoroshiku ne, Minna~ ☆',
    '🎐 Gabung Rame Bareng Ai~ ★',
    '💫 Ai Seneng Kamu Datang~ 🤍',
    '✨ Nee, Kenalan Dulu Yuk~ ☆',
    '🌟 Siap Jadi Bintang Grup~ ★',
    '🤍 Hai-Hai dari Ai~ ☆'
]

function randomButtonText() {
    return WELCOME_BUTTON_TEXTS[Math.floor(Math.random() * WELCOME_BUTTON_TEXTS.length)]
}

function buildWelcomeMessage(participant, groupName, groupDesc, memberCount, customMsg = null) {
    const greetings = [
        `Yokoso~ 🎐`,
        `Irasshaimase ✨`,
        `Ohayou~ 🌸`,
        `Yaa, halo halo 👋`,
        `Hisashiburi~ 💫`,
        `Konnichiwa 🤍`,
        `Nee, akhirnya datang juga~ 🌟`
    ]

    const quotes = [
        `Ai selalu bilang... love itu yang paling penting! Dan kamu udah dapet love dari kita semua ☆ 🤍`,
        `Senyum kamu adalah bintang baru di langit grup ini~ ✨ ★`,
        `Nee, jangan jadi silent reader ya! Ai mau denger suaramu juga~ 🌸 ☆`,
        `Setiap orang yang masuk ke sini... pasti punya cahayanya sendiri. Termasuk kamu 💫 ★`,
        `Ai percaya, pertemuan ini bukan kebetulan. Ini udah takdir~ ☆ 🌟`,
        `Yuk gas! Jangan malu-malu, Ai ada di sini kok~ 👐 ★`
    ]

    const headers = [
`☆ Nee nee, minna-san~! 🌸
Hari ini ada bintang baru yang bergabung! ★
Yuk sambut bareng dengan penuh love~ 🤍`,

`★ Minna, dengerin Ai dulu~ ✨
Ada tomodachi baru yang datang hari ini ☆
Ai seneng banget bisa ketemu kamu di sini~ 🌟`,

`☆ Ohayou minna-san~! 🎐
Grup kita nambah satu cahaya baru hari ini ★
Ai udah nunggu kamu dari tadi lho~ 💫`,

`★ Nee nee~! 🌸
Ai mau kenalin seseorang ke minna semua ☆
Dia bintang baru kita... yuk sambut~ ✨`
    ]

    const greeting = greetings[Math.floor(Math.random() * greetings.length)]
    const quote = quotes[Math.floor(Math.random() * quotes.length)]
    const header = headers[Math.floor(Math.random() * headers.length)]
    const username = participant?.split('@')[0] || 'User'

    if (customMsg) {
        return customMsg
            .replace(/{user}/gi, `@${username}`)
            .replace(/{group}/gi, groupName || 'Grup')
            .replace(/{desc}/gi, groupDesc || '')
            .replace(/{count}/gi, memberCount?.toString() || '0')
    }

    let msg = `
${header}

★ ${greeting}, *@${username}* ☆

╭─〔 📌 *ɪɴꜰᴏ ɢʀᴏᴜᴘ* 〕─✧
│ 🏠 *Nama*     : \`${groupName}\`
│ 👥 *Member*   : ${memberCount}
│ 📅 *Tanggal*  : ${require('moment-timezone')()
        .tz('Asia/Jakarta')
        .format('DD/MM/YYYY')}
╰──────────────────────✦
`

    if (groupDesc) {
        msg += `
📝 *Deskripsi*
❝ ${groupDesc.slice(0, 120)}${groupDesc.length > 120 ? '...' : ''} ❞
`
    }

    msg += `
✨ *Pesan dari Ai~*
「 ${quote} 」

☆ _Yoroshiku ne~ Ai tunggu kamu ikut rame bareng ya!_ ★
`

    return msg
}

async function sendWelcomeMessage(sock, groupJid, participant, groupMeta) {
    try {
        const db = getDatabase()
        const groupData = db.getGroup(groupJid)

        if (groupData?.welcome !== true) return false

        const welcomeType = db.setting('welcomeType') || 1
        const { cacheParticipantLids, getCachedJid, isLid, isLidConverted, lidToJid } = require('../../src/lib/lidHelper')

        if (groupMeta?.participants) {
            cacheParticipantLids(groupMeta.participants)
        }

        let realParticipant = participant

        const cachedJid = getCachedJid(participant)
        if (cachedJid && !isLidConverted(cachedJid)) {
            realParticipant = cachedJid
        } else if (isLid(participant)) {
            const lidFormat = participant
            const cachedFromLid = getCachedJid(lidFormat)
            if (cachedFromLid && !isLidConverted(cachedFromLid)) {
                realParticipant = cachedFromLid
            } else {
                realParticipant = lidToJid(participant)
            }
        } else if (isLidConverted(participant)) {
            const lidNumber = participant.replace('@s.whatsapp.net', '')
            const lidFormat = lidNumber + '@lid'
            const cachedFromLid = getCachedJid(lidFormat)
            if (cachedFromLid && !isLidConverted(cachedFromLid)) {
                realParticipant = cachedFromLid
            }
        }

        const memberCount = groupMeta?.participants?.length || 0
        const groupName = groupMeta?.subject || 'Grup'

        let userName = realParticipant?.split('@')[0] || 'User'
        let ppUrl = 'https://cdn.gimita.id/download/pp%20kosong%20wa%20default%20(1)_1769506608569_52b57f5b.jpg'
        try {
            ppUrl = await sock.profilePictureUrl(realParticipant, 'image')
        } catch {}

        const text = buildWelcomeMessage(
            realParticipant,
            groupMeta?.subject,
            groupMeta?.descOwner,
            memberCount,
            groupData?.welcomeMsg
        )

        const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
        const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'

        if (welcomeType === 2) {
            await sock.sendMessage(groupJid, {
                text: `★ Welcome *${userName}*~\nAi udah nunggu kamu di *${groupName}* lho ☆`,
                title: ``,
                subtitle: groupName,
                footer: `Bintang ke-${memberCount} ☆`,
                cards: [
                    {
                        image: { url: ppUrl },
                        body: `Nee, selamat datang di ${groupName}~ ★`,
                        footer: `Ai seneng kamu di sini ☆`,
                        buttons: [
                            {
                                name: 'quick_reply',
                                buttonParamsJson: JSON.stringify({
                                    display_text: randomButtonText(),
                                    id: 'hi'
                                })
                            }
                        ]
                    }
                ]
            })
        } else if (welcomeType === 3) {
            const { generateWAMessageFromContent, prepareWAMessageMedia } = require('hsnai')

            let pushName = userName
            try {
                const resolved = await sock.getName?.(realParticipant, groupJid)
                if (resolved) pushName = resolved
            } catch {}

            // Link grup asli (fallback ke link saluran kalau bot bukan admin / gagal ambil)
            let groupLink = config.saluran?.link || config.info?.grupwa || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
            try {
                const inviteCode = await sock.groupInviteCode(groupJid)
                if (inviteCode) groupLink = `https://chat.whatsapp.com/${inviteCode}`
            } catch {}

            const extContent = {
                text: `${groupLink}\n\n${text}`,
                matchedText: groupLink,
                previewType: 0,
                renderLargerThumbnail: true,
                title: `★ Welcome ${pushName}~ ☆`,
                description: `Bintang ke-${memberCount} di ${groupName}`,
                contextInfo: {
                    mentionedJid: [realParticipant],
                    isForwarded: true,
                    forwardingScore: 9,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06',
                        newsletterName: config.saluran?.name || config.bot?.name || 'Hoshino Ai',
                        serverMessageId: Math.floor(Math.random() * 1000000)
                    }
                }
            }

            try {
                let thumbSrc = null
                try {
                    const ppRes = await axios.get(ppUrl, { responseType: 'arraybuffer', timeout: 5000 })
                    thumbSrc = Buffer.from(ppRes.data)
                } catch {}
                if (!thumbSrc) {

                    if (hsAsset.has('images/hsnai')) thumbSrc = (await hsAsset.buffer('images/hsnai'))
                }

                if (thumbSrc) {
                    const { imageMessage } = await prepareWAMessageMedia(
                        { image: thumbSrc },
                        { upload: sock.waUploadToServer, mediaTypeOverride: 'thumbnail-link' }
                    )
                    if (imageMessage) {
                        extContent.jpegThumbnail = imageMessage.jpegThumbnail
                        if (imageMessage.directPath) extContent.thumbnailDirectPath = imageMessage.directPath
                        if (imageMessage.mediaKey) extContent.mediaKey = imageMessage.mediaKey
                        if (imageMessage.mediaKeyTimestamp) extContent.mediaKeyTimestamp = imageMessage.mediaKeyTimestamp
                        if (imageMessage.fileSha256) extContent.thumbnailSha256 = imageMessage.fileSha256
                        if (imageMessage.fileEncSha256) extContent.thumbnailEncSha256 = imageMessage.fileEncSha256
                        if (imageMessage.width) extContent.thumbnailWidth = imageMessage.width
                        if (imageMessage.height) extContent.thumbnailHeight = imageMessage.height
                    }
                }
            } catch {}

            // Fake quoted contact — kartu kontak member baru yang "dibalas"
            const memberNumber = realParticipant?.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '') || '0'
            const fakeQuotedContact = {
                key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast' },
                message: {
                    contactMessage: {
                        displayName: userName,
                        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;${userName};;;\nFN:${userName}\nTEL;type=CELL;type=VOICE;waid=${memberNumber}:${memberNumber}\nEND:VCARD`
                    }
                }
            }

            const msgV3 = generateWAMessageFromContent(groupJid, {
                extendedTextMessage: extContent
            }, { quoted: fakeQuotedContact, userJid: sock.user?.id })
            await sock.relayMessage(groupJid, msgV3.message, { messageId: msgV3.key.id })
        } else if (welcomeType === 4) {
            const memberNumber = realParticipant?.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '') || '0'
            const fakeQuotedContact = {
                key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast' },
                message: {
                    contactMessage: {
                        displayName: userName,
                        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;${userName};;;\nFN:${userName}\nTEL;type=CELL;type=VOICE;waid=${memberNumber}:${memberNumber}\nEND:VCARD`
                    }
                }
            }


            const gifBuf = hsAsset.has('video/hsnai') ? (await hsAsset.buffer('video/hsnai')) : null

            if (gifBuf) {
                await sock.sendMessage(groupJid, {
                    video: gifBuf,
                    caption: text,
                    gifPlayback: true,
                    mentions: [realParticipant]
                }, { quoted: fakeQuotedContact })
            } else {
                await sock.sendMessage(groupJid, {
                    text,
                    mentions: [realParticipant]
                }, { quoted: fakeQuotedContact })
            }
        } else if (welcomeType === 5) {
            const { generateWAMessageFromContent } = require('hsnai')

            let thumbSrc = null
            try {
                const ppRes = await axios.get(ppUrl, { responseType: 'arraybuffer', timeout: 5000 })
                thumbSrc = Buffer.from(ppRes.data)
            } catch {}
            if (!thumbSrc) {

                if (hsAsset.has('images/hsnai')) thumbSrc = (await hsAsset.buffer('images/hsnai'))
            }

            let thumbResized = thumbSrc

            try {
                if (thumbSrc) {
                    thumbResized = await sharp(thumbSrc)
                        .resize(300, 300, { fit: 'cover' })
                        .jpeg({ quality: 70 })
                        .toBuffer()
                }
            } catch {
                thumbResized = thumbSrc
            }

            let displayName = userName

            try {
                const resolved = await sock.getName?.(realParticipant, groupJid)
                if (resolved) displayName = resolved
            } catch {}

            const msgV5 = generateWAMessageFromContent(groupJid, {
                viewOnceMessage: {
                    message: {
                        messageContextInfo: {},
                        interactiveMessage: {
                            header: {
                                hasMediaAttachment: true,
                                locationMessage: {
                                    degreesLatitude: 0,
                                    degreesLongitude: 0,
                                    name: `★ Welcome ke ${groupName} ☆`,
                                    address: `Bintang ke-${memberCount} | ${displayName}`,
                                    jpegThumbnail: thumbResized
                                }
                            },
                            body: { text },
                            footer: { text: config.bot?.name || 'Hoshino Ai' },
                            contextInfo: {
                                mentionedJid: [realParticipant],
                                isForwarded: true,
                                forwardingScore: 9
                            },
                            nativeFlowMessage: { buttons: [] }
                        }
                    }
                }
            }, { userJid: sock.user?.id })
            await sock.relayMessage(groupJid, msgV5.message, { messageId: msgV5.key.id })
        } else if (welcomeType === 6) {
            const { generateWAMessageFromContent, proto, prepareWAMessageMedia } = require('hsnai')

            let headerMedia = null
            try {
                const thumbBuf = await axios.get(ppUrl, { responseType: 'arraybuffer' }).then(r => Buffer.from(r.data))
                headerMedia = await prepareWAMessageMedia(
                    { image: thumbBuf },
                    { upload: sock.waUploadToServer }
                )
            } catch {}

            const buttons = [
                {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: randomButtonText(),
                        id: 'hi'
                    })
                },
                {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: `✨ Ikuti ${saluranName}`,
                        url: config.saluran?.link || saluranId,
                        merchant_url: config.saluran?.link || saluranId
                    })
                }
            ]

            try {
                const msg = generateWAMessageFromContent(groupJid, {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: {
                                deviceListMetadata: {},
                                deviceListMetadataVersion: 2
                            },
                            interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                                body: proto.Message.InteractiveMessage.Body.fromObject({
                                    text: text
                                }),
                                footer: proto.Message.InteractiveMessage.Footer.fromObject({
                                    text: config.bot?.name || 'Hoshino Ai'
                                }),
                                header: proto.Message.InteractiveMessage.Header.fromObject({
                                    hasMediaAttachment: !!headerMedia,
                                    ...(headerMedia || {})
                                }),
                                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                                    messageParamsJson: JSON.stringify({
                                        limited_time_offer: {
                                            text: `★ Welcome ${userName}~ ☆`,
                                            copy_code: groupName,
                                            expiration_time: Date.now() * 999
                                        },
                                        bottom_sheet: {
                                            in_thread_buttons_limit: 2,
                                            divider_indices: [1, 999],
                                            list_title: `Bintang ke-${memberCount}`,
                                            button_title: '🌸 Welcome'
                                        }
                                    }),
                                    buttons
                                }),
                                contextInfo: {
                                    mentionedJid: [realParticipant],
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
                }, { userJid: sock.user?.id })

                await sock.relayMessage(groupJid, msg.message, { messageId: msg.key.id })
            } catch {
                await sock.sendMessage(groupJid, { text, mentions: [realParticipant] })
            }
        } else if (welcomeType === 7) {
            // Type 7: Canvas Image
            let canvasBuffer = null
            try {
                canvasBuffer = await createWideDiscordCard(userName, ppUrl, groupName, memberCount.toLocaleString())
            } catch (e) {
                console.error('Welcome Canvas Error:', e.message)
            }

            await sock.sendMessage(groupJid, {
                image: canvasBuffer,
                caption: text,
                mentions: [realParticipant],
                contextInfo: {
                    mentionedJid: [realParticipant],
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: saluranId,
                        newsletterName: saluranName,
                        serverMessageId: 127
                    }
                }
            })
        } else {
            // Type 1: Text biasa (default)
            await sock.sendMessage(groupJid, {
                text: text,
                mentions: [realParticipant]
            })
        }

        return true
    } catch (error) {
        console.error('Welcome Error:', error)
        return false
    }
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const args = m.args || []
    const sub = args[0]?.toLowerCase()
    const sub2 = args[1]?.toLowerCase()
    const groupData = db.getGroup(m.chat) || {}
    const currentStatus = groupData.welcome === true

    if (sub === 'on' && sub2 === 'all') {
        if (!m.isOwner) {
            return m.reply(config.messages.ownerOnly)
        }

        m.react('🕕')

        try {
            const groups = await sock.groupFetchAllParticipating()
            const groupIds = Object.keys(groups)
            let count = 0

            for (const groupId of groupIds) {
                db.setGroup(groupId, { welcome: true })
                count++
            }

            m.react('✅')
            return m.reply(
                `★ *ᴡᴇʟᴄᴏᴍᴇ ɢʟᴏʙᴀʟ ᴏɴ* ☆\n\n` +
                `> ✨ Ai udah aktifkan Welcome di *${count}* grup! ★\n` +
                `> Semua bintang baru akan disambut dengan love~ 🌸`
            )
        } catch (err) {
            m.react('❌')
            return m.reply(`❌ Aduh, ada yang salah nih~ Error: ${err.message}`)
        }
    }

    if (sub === 'off' && sub2 === 'all') {
        if (!m.isOwner) {
            return m.reply(config.messages.ownerOnly)
        }

        m.react('🕕')

        try {
            const groups = await sock.groupFetchAllParticipating()
            const groupIds = Object.keys(groups)
            let count = 0

            for (const groupId of groupIds) {
                db.setGroup(groupId, { welcome: false })
                count++
            }

            m.react('✅')
            return m.reply(
                `★ *ᴡᴇʟᴄᴏᴍᴇ ɢʟᴏʙᴀʟ ᴏꜰꜰ* ☆\n\n` +
                `> 🌙 Ai udah nonaktifkan Welcome di *${count}* grup~\n` +
                `> Tapi love Ai tetap ada buat kalian ya 🤍`
            )
        } catch (err) {
            m.react('❌')
            return m.reply(`❌ Aduh, ada yang salah nih~ Error: ${err.message}`)
        }
    }

    if (sub === 'on') {
        if (currentStatus) {
            return m.reply(
                `☆ *ᴡᴇʟᴄᴏᴍᴇ ᴜᴅᴀʜ ᴀᴋᴛɪꜰ ʟʜᴏ~* ★\n\n` +
                `> Status: *✅ ON* ☆\n` +
                `> Nee, Welcome udah menyala di grup ini~\n\n` +
                `_Gunakan \`${m.prefix}welcome off\` kalau mau dimatiin ya ☆_`
            )
        }
        db.setGroup(m.chat, { welcome: true })
        return m.reply(
            `★ *ᴡᴇʟᴄᴏᴍᴇ ᴀᴋᴛɪꜰ~* ☆\n\n` +
            `> ✨ Welcome message udah hidup! ★\n` +
            `> Setiap bintang baru akan disambut penuh love dari Ai~ 🌸\n\n` +
            `_Gunakan \`${m.prefix}setwelcome\` untuk custom pesan ya!_`
        )
    }

    if (sub === 'off') {
        if (!currentStatus) {
            return m.reply(
                `☆ *ᴡᴇʟᴄᴏᴍᴇ ᴜᴅᴀʜ ᴍᴀᴛɪ ʟʜᴏ~* ★\n\n` +
                `> Status: *❌ OFF* ☆\n` +
                `> Nee, Welcome emang udah nonaktif di sini~\n\n` +
                `_Gunakan \`${m.prefix}welcome on\` kalau mau dihidupin lagi ya ☆_`
            )
        }
        db.setGroup(m.chat, { welcome: false })
        return m.reply(
            `★ *ᴡᴇʟᴄᴏᴍᴇ ɴᴏɴᴀᴋᴛɪꜰ~* ☆\n\n` +
            `> 🌙 Welcome message udah Ai matiin~\n` +
            `> Member baru nggak akan disambut dulu ya 🤍`
        )
    }

    m.reply(
        `★ *ᴡᴇʟᴄᴏᴍᴇ sᴇᴛᴛɪɴɢs* ☆\n\n` +
        `> 💫 Nee minna, ini setting Welcome-nya~ ★\n` +
        `> Status: *${currentStatus ? '✅ ON ☆' : '❌ OFF'}*\n\n` +
        `\`\`\`━━━ ᴘɪʟɪʜᴀɴ ━━━\`\`\`\n` +
        `> \`${m.prefix}welcome on\` → Aktifkan 🌸\n` +
        `> \`${m.prefix}welcome off\` → Nonaktifkan 🌙\n` +
        `> \`${m.prefix}welcome on all\` → Global ON (owner) ★\n` +
        `> \`${m.prefix}welcome off all\` → Global OFF (owner)\n` +
        `> \`${m.prefix}setwelcome\` → Custom pesan ✨\n` +
        `> \`${m.prefix}resetwelcome\` → Reset default`
    )
}

module.exports = {
    config: pluginConfig,
    handler,
    sendWelcomeMessage
}