const hsAsset = require('../../src/lib/assets')
const config = require('../../config')
const { getDatabase } = require('../../src/lib/database')
const { createGoodbyeCard } = require('../../src/lib/welcomeCard')
const { resolveAnyLidToJid } = require('../../src/lib/lidHelper')
const path = require('path')
const fs = require('fs')
const axios = require('axios')
const sharp = require('sharp')

const pluginConfig = {
    name: 'goodbye',
    alias: ['gbye', 'gleave'],
    category: 'group',
    description: 'Mengatur goodbye message untuk grup',
    usage: '.goodbye <on/off>',
    example: '.goodbye on',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    isAdmin: true,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

const GOODBYE_BUTTON_TEXTS = [
    '★ Mata ne~ ☆',
    '🌙 Sampai Jumpa Lagi~ ☆',
    '🌸 Sayonara, Bintang Ai~ ★',
    '💫 Ai Bakal Kangen~ 🤍',
    '🎐 Jaa ne, Hati-hati~ ☆',
    '✨ Semoga Kita Ketemu Lagi~ ★',
    '🤍 Makasih Udah Mampir~ ☆',
    '👋 Dadah dari Ai~ ★'
]

function randomButtonText() {
    return GOODBYE_BUTTON_TEXTS[Math.floor(Math.random() * GOODBYE_BUTTON_TEXTS.length)]
}

function buildGoodbyeMessage(participant, groupName, memberCount, customMsg = null) {
    const farewells = [
        `Mata ne 👋`,
        `Sayonara 🌙`,
        `Jaa ne~ 🤍`,
        `Itterasshai ✨`,
        `Bye bye 👐`,
        `Mata itsuka 🌸`,
        `Otsukaresama~ 💫`
    ]

    const quotes = [
        `Cinta itu... bukan hanya soal bertemu. Tapi juga soal melepaskan dengan ikhlas ☆ 🤍`,
        `Setiap perpisahan menyimpan kenangan yang tak akan pudar, seperti cahaya bintang~ ✨`,
        `Ai selalu percaya... orang baik akan selalu menemukan jalannya kembali ☆ 🌸`,
        `Walau kamu pergi, cahayamu tetap bersinar di hati kami, minna 💫 ☆`,
        `Ini bukan akhir. Ini hanya jeda sebelum bintang kita bertemu lagi~ 🌙`,
        `Love itu nyata. Dan salah satu buktinya adalah kenangan bersamamu ☆ 🤍`
    ]

    const headers = [
`☆ Minna... dengerin Ai sebentar~ 🌙
Hari ini, satu bintang dari grup kita berpindah langit.
Tapi cahayanya... nggak akan pernah padam. ☆`,

`★ Nee, minna-san... 💫
Ada yang pergi hari ini. Hati Ai sedikit sedih~
Tapi Ai percaya, ini bukan perpisahan yang sesungguhnya ☆`,

`☆ Minna, Ai mau bilang sesuatu~ 🌸
Setiap orang yang masuk ke hidup kita adalah anugerah ★
Dan hari ini, kita melepas salah satu dari mereka dengan penuh cinta~`,

`★ Nee nee, minna-san! ✨
Ai selalu bilang... love itu yang terpenting ☆
Dan hari ini, kita kirimkan love kita buat yang akan pergi~ 🤍`
    ]

    const farewell = farewells[Math.floor(Math.random() * farewells.length)]
    const quote = quotes[Math.floor(Math.random() * quotes.length)]
    const header = headers[Math.floor(Math.random() * headers.length)]
    const username = participant?.split('@')[0] || 'User'

    if (customMsg) {
        return customMsg
            .replace(/{user}/gi, `@${username}`)
            .replace(/{group}/gi, groupName || 'Grup')
            .replace(/{count}/gi, memberCount?.toString() || '0')
    }

    return `
${header}

★ ${farewell}, *@${username}* ☆

╭─〔 📌 *ɪɴꜰᴏ ɢʀᴏᴜᴘ* 〕─✧
│ 🏠 *Nama*        : \`${groupName}\`
│ 👥 *Sisa Member* : ${memberCount}
│ 📅 *Tanggal*     : ${require('moment-timezone')()
        .tz('Asia/Jakarta')
        .format('DD/MM/YYYY')}
╰──────────────────────✦

💌 *Pesan dari Ai~*
「 ${quote} 」

☆ _Mata ne, bintangku. Ai akan selalu ingat kamu~_ ★
`
}

async function sendGoodbyeMessage(sock, groupJid, participant, groupMeta) {
    try {
        const db = getDatabase()
        const groupData = db.getGroup(groupJid)
        
        if (groupData?.goodbye !== true && groupData?.leave !== true) return false

        const goodbyeType = db.setting('goodbyeType') || 1
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
            ppUrl = await sock.profilePictureUrl(realParticipant, 'image') || ppUrl
        } catch {}

        const text = buildGoodbyeMessage(
            realParticipant,
            groupMeta?.subject,
            memberCount,
            groupData?.goodbyeMsg
        )

        const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
        const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'

        if (goodbyeType === 2) {
            await sock.sendMessage(groupJid, {
                text: `Mata ne, minna~ ☆`,
                title: `★ Sayonara ${userName} ☆`,
                subtitle: groupName,
                footer: `Sisa ${memberCount} Bintang ☆`,
                cards: [
                    {
                        image: { url: ppUrl },
                        title: `★ Mata ne, ${userName}~`,
                        body: `Makasih udah jadi bagian dari ${groupName} ☆`,
                        footer: `Ai akan selalu ingat kamu~ ★`,
                        buttons: [
                            {
                                name: 'quick_reply',
                                buttonParamsJson: JSON.stringify({
                                    display_text: randomButtonText(),
                                    id: 'bye'
                                })
                            },
                            {
                                name: 'cta_url',
                                buttonParamsJson: JSON.stringify({
                                    display_text: '☆ Website',
                                    url: config.info?.website || 'https://sc.hsnai.my.id/'
                                })
                            }
                        ]
                    }
                ]
            })
        } else if (goodbyeType === 3) {
            const { generateWAMessageFromContent, prepareWAMessageMedia } = require('hsnai')

            let pushName = userName
            try {
                const resolved = await sock.getName?.(realParticipant, groupJid)
                if (resolved) pushName = resolved
            } catch {}

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
                title: `★ Sayonara ${pushName}~ ☆`,
                description: `Sisa ${memberCount} Bintang di ${groupName}`,
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
        } else if (goodbyeType === 4) {
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
        } else if (goodbyeType === 5) {
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
                                    name: `★ Sayonara dari ${groupName} ☆`,
                                    address: `Sisa ${memberCount} Bintang | ${displayName}`,
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
        } else if (goodbyeType === 6) {
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
                        id: 'bye'
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
                                            text: `★ Sayonara ${userName}~ ☆`,
                                            copy_code: groupName,
                                            expiration_time: Date.now() * 999
                                        },
                                        bottom_sheet: {
                                            in_thread_buttons_limit: 2,
                                            divider_indices: [1, 999],
                                            list_title: `Sisa ${memberCount} Bintang`,
                                            button_title: '🌙 Goodbye'
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
        } else if (goodbyeType === 7) {
            // Type 7: Canvas Image
            let canvasBuffer = null
            try {
                canvasBuffer = await createGoodbyeCard(userName, ppUrl, groupName, memberCount.toLocaleString())
            } catch (e) {
                console.error('Goodbye Canvas Error:', e.message)
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
                text,
                mentions: [realParticipant]
            })
        }
        
        return true
    } catch (error) {
        console.error('Goodbye Error:', error)
        return false
    }
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const args = m.args || []
    const sub = args[0]?.toLowerCase()
    const sub2 = args[1]?.toLowerCase()
    const groupData = db.getGroup(m.chat) || {}
    const currentStatus = groupData.goodbye === true
    
    if (sub === 'on' && sub2 === 'all') {
        if (!m.isOwner) {
            return m.reply(`❌ Nee, fitur ini khusus buat owner aja ya~ ☆`)
        }
        
        m.react('🕕')
        
        try {
            const groups = await sock.groupFetchAllParticipating()
            const groupIds = Object.keys(groups)
            let count = 0
            
            for (const groupId of groupIds) {
                db.setGroup(groupId, { goodbye: true, leave: true })
                count++
            }
            
            m.react('✅')
            return m.reply(
                `★ *ɢᴏᴏᴅʙʏᴇ ɢʟᴏʙᴀʟ ᴏɴ* ☆\n\n` +
                `> ✨ Ai udah aktifkan Goodbye di *${count}* grup! ★\n` +
                `> Semua perpisahan akan selalu berkesan~ 🌸`
            )
        } catch (err) {
            m.react('❌')
            return m.reply(`❌ Aduh, ada yang salah nih~ Error: ${err.message}`)
        }
    }
    
    if (sub === 'off' && sub2 === 'all') {
        if (!m.isOwner) {
            return m.reply(`❌ Nee, fitur ini khusus buat owner aja ya~ ☆`)
        }
        
        m.react('🕕')
        
        try {
            const groups = await sock.groupFetchAllParticipating()
            const groupIds = Object.keys(groups)
            let count = 0
            
            for (const groupId of groupIds) {
                db.setGroup(groupId, { goodbye: false, leave: false })
                count++
            }
            
            m.react('✅')
            return m.reply(
                `★ *ɢᴏᴏᴅʙʏᴇ ɢʟᴏʙᴀʟ ᴏꜰꜰ* ☆\n\n` +
                `> 🌙 Ai udah nonaktifkan Goodbye di *${count}* grup~\n` +
                `> Tapi kenangan tetap ada ya, minna 🤍`
            )
        } catch (err) {
            m.react('❌')
            return m.reply(`❌ Aduh, ada yang salah nih~ Error: ${err.message}`)
        }
    }
    
    if (sub === 'on') {
        if (currentStatus) {
            return m.reply(
                `☆ *ɢᴏᴏᴅʙʏᴇ ᴜᴅᴀʜ ᴀᴋᴛɪꜰ ʟʜᴏ~* ★\n\n` +
                `> Status: *✅ ON* ☆\n` +
                `> Nee, Goodbye udah menyala di grup ini~\n\n` +
                `_Gunakan \`${m.prefix}goodbye off\` kalau mau dimatiin ya ☆_`
            )
        }
        db.setGroup(m.chat, { goodbye: true, leave: true })
        return m.reply(
            `★ *ɢᴏᴏᴅʙʏᴇ ᴀᴋᴛɪꜰ~* ☆\n\n` +
            `> ✨ Goodbye message udah hidup! ★\n` +
            `> Setiap perpisahan akan penuh cinta dari Ai~ 🌸\n\n` +
            `_Gunakan \`${m.prefix}setgoodbye\` untuk custom pesan ya!_`
        )
    }
    
    if (sub === 'off') {
        if (!currentStatus) {
            return m.reply(
                `☆ *ɢᴏᴏᴅʙʏᴇ ᴜᴅᴀʜ ᴍᴀᴛɪ ʟʜᴏ~* ★\n\n` +
                `> Status: *❌ OFF* ☆\n` +
                `> Nee, Goodbye emang udah nonaktif di sini~\n\n` +
                `_Gunakan \`${m.prefix}goodbye on\` kalau mau dihidupin lagi ya ☆_`
            )
        }
        db.setGroup(m.chat, { goodbye: false, leave: false })
        return m.reply(
            `★ *ɢᴏᴏᴅʙʏᴇ ɴᴏɴᴀᴋᴛɪꜰ~* ☆\n\n` +
            `> 🌙 Goodbye message udah Ai matiin~\n` +
            `> Member yang pergi nggak akan dapet pesan dulu ya 🤍`
        )
    }
    
    m.reply(
        `★ *ɢᴏᴏᴅʙʏᴇ sᴇᴛᴛɪɴɢs* ☆\n\n` +
        `> 💫 Nee minna, ini setting Goodbye-nya~ ★\n` +
        `> Status: *${currentStatus ? '✅ ON ☆' : '❌ OFF'}*\n\n` +
        `\`\`\`━━━ ᴘɪʟɪʜᴀɴ ━━━\`\`\`\n` +
        `> \`${m.prefix}goodbye on\` → Aktifkan 🌸\n` +
        `> \`${m.prefix}goodbye off\` → Nonaktifkan 🌙\n` +
        `> \`${m.prefix}goodbye on all\` → Global ON (owner) ★\n` +
        `> \`${m.prefix}goodbye off all\` → Global OFF (owner)\n` +
        `> \`${m.prefix}setgoodbye\` → Custom pesan ✨\n` +
        `> \`${m.prefix}resetgoodbye\` → Reset default`
    )
}

module.exports = {
    config: pluginConfig,
    handler,
    sendGoodbyeMessage
}