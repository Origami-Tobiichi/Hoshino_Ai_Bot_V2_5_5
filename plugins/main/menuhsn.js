const hsAsset = require('../../src/lib/assets')
const config = require('../../config')
const { getCommandsByCategory, getCategories } = require('../../src/lib/plugins')
const { getDatabase } = require('../../src/lib/database')
const { generateWAMessageFromContent, proto } = require('hsnai')
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const pluginConfig = {
    name: 'menuhsn',
    alias: ['mh', 'category', 'hsn'],
    category: 'main',
    description: 'Menampilkan commands dalam kategori tertentu',
    usage: '.menuhsn <kategori>',
    example: '.menuhsn tools',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

const CATEGORY_EMOJIS = {
    owner: '👑', main: '🏠', utility: '🔧', fun: '🎮', group: '👥',
    download: '📥', search: '🔍', tools: '🛠️', sticker: '🖼️',
    ai: '🤖', game: '🎯', media: '🎬', info: 'ℹ️', religi: '☪️',
    panel: '🖥️', user: '📊', jpm: '📢', pushkontak: '📱', ephoto: '🎨',
    store: '🛒', canvas: '🎨', random: '🎲', vps: '🌊'
}

function toMonoUpperBold(text) {
    const chars = {
        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚',
        'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡',
        'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨',
        'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭'
    }
    return text.toUpperCase().split('').map(c => chars[c] || c).join('')
}

function toSmallCaps(text) {
    const smallCaps = {
        'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ꜰ', 'g': 'ɢ',
        'h': 'ʜ', 'i': 'ɪ', 'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ',
        'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ', 's': 's', 't': 'ᴛ', 'u': 'ᴜ',
        'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ'
    }
    return text.toLowerCase().split('').map(c => smallCaps[c] || c).join('')
}

const categoryOrder = ['owner', 'main', 'utility', 'tools', 'fun', 'game', 'download', 'search', 'sticker', 'media', 'ai', 'group', 'religi', 'info', 'cek', 'economy', 'user', 'canvas', 'random', 'premium', 'ephoto', 'jpm', 'pushkontak', 'panel', 'store']

let cachedThumb = null
let cachedImage = null

async function getFlatBuffer(buffer, bg = { r: 255, g: 255, b: 255 }) {
    if (!buffer) return null
    try {
        return await sharp(buffer).flatten({ background: bg }).jpeg({ quality: 90 }).toBuffer()
    } catch (e) {
        return buffer
    }
}

let _flatImageCache = null
async function getCachedFlatImage() {
    if (_flatImageCache) return _flatImageCache
    if (!cachedImage) return null
    _flatImageCache = await getFlatBuffer(cachedImage)
    return _flatImageCache
}

hsAsset.tryBuffer('images/hsnai2').then(b => { if (b) cachedThumb = b }).catch(() => {})
hsAsset.tryBuffer('images/hsnai').then(b => { if (b) cachedImage = b }).catch(() => {})

function getContextInfo(extra = {}) {
    return {
        forwardingScore: 9999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06',
            newsletterName: config.saluran?.name || config.bot?.name || 'Hoshino Ai-Bot',
            serverMessageId: 127
        },
        ...extra
    }
}

function getVerifiedQuoted() {
    return {
        key: { participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast' },
        message: {
            contactMessage: {
                displayName: `🪸 ${config.bot?.name}`,
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:XL;ttname,;;;\nFN:ttname\nitem1.TEL;waid=13135550002:+1 (313) 555-0002\nitem1.X-ABLabel:Ponsel\nEND:VCARD`,
                sendEphemeral: true
            }
        }
    }
}

async function getSimpleContextInfo(sock, m, text, defaultOptions = {}, options = {}) {
    const quotedMsg = {
        key: {
            participant: '0@s.whatsapp.net',
            remoteJid: 'status@broadcast'
        },
        message: {
            contactMessage: {
                displayName: `🪸 ${config.bot?.name}`,
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:XL;ttname,;;;\nFN:ttname\nitem1.TEL;waid=13135550002:+1 (313) 555-0002\nitem1.X-ABLabel:Ponsel\nEND:VCARD`,
                sendEphemeral: true
            }
        }
    }

    return sock.sendMessage(m.chat, {
        document: fs.readFileSync(path.join(process.cwd(), 'package.json')),
        mimetype: 'image/png',
        fileName: config.bot?.name || 'Hoshino Ai-Bot',
        fileLength: 99999999999999,
        jpegThumbnail: cachedThumb
            ? await sharp(cachedThumb)
                .resize(300, 300, { fit: 'cover' })
                .jpeg({ quality: 80 })
                .toBuffer()
            : null,
        caption: text,
        ...defaultOptions,
        ...options
    }, {
        quoted: quotedMsg
    })
}

// ─── SEND CATEGORY LIST ─────────────────────────────────────────────────────

async function sendCategoryList(m, sock, db, variant) {
    const prefix = config.command?.prefix || '.'
    const categories = getCategories()
    const commandsByCategory = getCommandsByCategory()
    const { getCasesByCategory } = require('../../case/hsnai')
    const casesByCategory = getCasesByCategory()

    const groupData = m.isGroup ? (db.getGroup(m.chat) || {}) : {}
    const botMode = groupData.botMode || 'md'

    let modeExcludeMap = {
        md: ['panel', 'pushkontak', 'store'],
        store: ['panel', 'pushkontak', 'jpm', 'ephoto', 'cpanel'],
        pushkontak: ['panel', 'store', 'jpm', 'ephoto', 'cpanel'],
    }
    try {
        const botmodePlugin = require('../group/botmodegc')
        if (botmodePlugin?.MODES) {
            modeExcludeMap = {}
            for (const [key, val] of Object.entries(botmodePlugin.MODES)) {
                if (val.excludeCategories) modeExcludeMap[key] = val.excludeCategories
            }
        }
    } catch (e) {}

    const excludeCategories = modeExcludeMap[botMode] || modeExcludeMap.md || []
    const allCats = [...new Set([...categories, ...Object.keys(casesByCategory)])]
    const sortedCats = allCats.sort((a, b) => {
        const iA = categoryOrder.indexOf(a), iB = categoryOrder.indexOf(b)
        return (iA === -1 ? 999 : iA) - (iB === -1 ? 999 : iB)
    })

    const visibleCats = sortedCats.filter(cat => {
        if (cat === 'owner' && !m.isOwner) return false
        if (excludeCategories.includes(cat.toLowerCase())) return false
        const total = (commandsByCategory[cat] || []).length + (casesByCategory[cat] || []).length
        return total > 0
    })

    // ── V1: plain text doang, tanpa trik apapun ──
    if (variant === 1) {
        let txt = `📂 *ᴅᴀꜰᴛᴀʀ ᴋᴀᴛᴇɢᴏʀɪ*\n\n`
        for (const cat of visibleCats) {
            const total = (commandsByCategory[cat] || []).length + (casesByCategory[cat] || []).length
            const emoji = CATEGORY_EMOJIS[cat] || '📁'
            txt += `${emoji} ${prefix}menuhsn ${cat} - ${total} cmds\n`
        }
        txt += `\nContoh: ${prefix}menuhsn tools`
        return m.reply(txt)
    }

    // ── V2: gaya box (dulu V1) + fake document verified quoted ──
    if (variant === 2) {
        let txt = `╭─〔 📂 *ᴅᴀꜰᴛᴀʀ ᴋᴀᴛᴇɢᴏʀɪ* 〕\n`
        for (const cat of visibleCats) {
            const total = (commandsByCategory[cat] || []).length + (casesByCategory[cat] || []).length
            const emoji = CATEGORY_EMOJIS[cat] || '📁'
            txt += `*│* ${emoji} \`${prefix}menuhsn ${cat}\` ➤ *${total}* cmds\n`
        }
        txt += `╰────────────────⬣\n\n`
        txt += `_Contoh: \`${prefix}menuhsn tools\`_`

        return getSimpleContextInfo(sock, m, txt)
    }

    // ── V3: TIDAK DIUBAH (udah bener) ──
    if (variant === 3) {
        const rows = visibleCats.map(cat => {
            const total = (commandsByCategory[cat] || []).length + (casesByCategory[cat] || []).length
            const emoji = CATEGORY_EMOJIS[cat] || '📁'
            return {
                title: `${emoji} ${toMonoUpperBold(cat)}`,
                description: `${total} commands`,
                id: `${prefix}menuhsn ${cat}`
            }
        })

        const bodyText = `📂 *ᴅᴀꜰᴛᴀʀ ᴋᴀᴛᴇɢᴏʀɪ*\n\n> Pilih kategori di bawah untuk melihat daftar command`

        try {
            const msg = generateWAMessageFromContent(m.chat, {
                viewOnceMessage: {
                    message: {
                        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                        interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                            body: proto.Message.InteractiveMessage.Body.fromObject({ text: bodyText }),
                            footer: proto.Message.InteractiveMessage.Footer.fromObject({
                                text: `© ${config.bot?.name || 'Hoshino Ai-Bot'} | ${visibleCats.length} Kategori`
                            }),
                            header: proto.Message.InteractiveMessage.Header.fromObject({
                                title: config.bot?.name || 'Hoshino Ai-Bot',
                                hasMediaAttachment: false
                            }),
                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                                buttons: [
                                    {
                                        name: 'single_select',
                                        buttonParamsJson: JSON.stringify({
                                            title: '📁 ᴘɪʟɪʜ ᴋᴀᴛᴇɢᴏʀɪ',
                                            sections: [{ title: '📋 KATEGORI', rows }]
                                        })
                                    },
                                    {
                                        name: 'quick_reply',
                                        buttonParamsJson: JSON.stringify({
                                            display_text: '📊 Semua Menu',
                                            id: `${prefix}allmenu`
                                        })
                                    }
                                ]
                            }),
                            contextInfo: {
                                mentionedJid: [m.sender],
                                forwardingScore: 9999,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06',
                                    newsletterName: config.saluran?.name || config.bot?.name || 'Hoshino Ai-Bot',
                                    serverMessageId: 127
                                }
                            }
                        })
                    }
                }
            }, { userJid: m.sender, quoted: getVerifiedQuoted() })

            return sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
        } catch (e) {
            return sendCategoryList(m, sock, db, 2)
        }
    }

    // ── V4: ASCII box + ftroli, background transparan di-fix jadi putih ──
    if (variant === 4) {
        const sparkles = ['✦', '✧', '⋆', '˚', '✵', '⊹']
        const rSpark = () => sparkles[Math.floor(Math.random() * sparkles.length)]

        let txt = `${rSpark()}━━━━━━━━━━━━━━━━━${rSpark()}\n`
        txt += `*📂 DAFTAR KATEGORI*\n`
        txt += `${rSpark()}━━━━━━━━━━━━━━━━━${rSpark()}\n\n`

        for (const cat of visibleCats) {
            const total = (commandsByCategory[cat] || []).length + (casesByCategory[cat] || []).length
            const emoji = CATEGORY_EMOJIS[cat] || '▣'
            txt += `┌─────「 ${emoji} *${cat.toUpperCase()}* 」\n`
            txt += `│ ✦ ${total} commands\n`
            txt += `│ ├➤ \`${prefix}menuhsn ${cat}\`\n`
            txt += `└───────────────────\n\n`
        }

        txt += `> ${rSpark()} *${config.bot?.name}* ${rSpark()}`

        const flatImage = await getCachedFlatImage()

        let thumbV4 = flatImage || cachedThumb
        if (thumbV4) {
            try { thumbV4 = await sharp(thumbV4).resize(300, 300, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer() } catch (e) {}
        }

        const totalAll = visibleCats.reduce((a, cat) => a + (commandsByCategory[cat] || []).length + (casesByCategory[cat] || []).length, 0)

        const ftroliQuoted = {
            key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast' },
            message: {
                orderMessage: {
                    orderId: '1337',
                    thumbnail: thumbV4 || null,
                    itemCount: totalAll,
                    status: 'INQUIRY',
                    surface: 'CATALOG',
                    message: `${config.bot?.name || 'Hoshino Ai-Bot'} Menu`,
                    orderTitle: `📋 ${totalAll} Commands`,
                    sellerJid: config.botNumber ? `${config.botNumber}@s.whatsapp.net` : m.sender,
                    token: 'hsnai-menuhsn-v4',
                    totalAmount1000: 0,
                    totalCurrencyCode: 'IDR',
                    contextInfo: {
                        isForwarded: true,
                        forwardingScore: 9999,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06',
                            newsletterName: config.saluran?.name || config.bot?.name || 'Hoshino Ai-Bot',
                            serverMessageId: 127
                        }
                    }
                }
            }
        }

        return sock.sendMessage(m.chat, {
            image: flatImage || cachedImage || cachedThumb || Buffer.from(''),
            caption: txt,
            contextInfo: getContextInfo()
        }, { quoted: ftroliQuoted })
    }

    // ── V5: cuma 2 quick_reply (allmenu, owner), list kategori dipindah ke footer ──
    if (variant === 5) {
        const flatImage = await getCachedFlatImage()
        let headerThumb = null

if (cachedImage) {
    try {
        const meta = await sharp(cachedImage).metadata()

        headerThumb = await sharp(cachedImage)
            .resize(
                300,
                Math.round((meta.height / meta.width) * 300)
            )
            .jpeg({ quality: 85 })
            .toBuffer()
    } catch (e) {
        headerThumb = cachedImage
    }
}

        const catListFooter = visibleCats.map(cat => {
            const total = (commandsByCategory[cat] || []).length + (casesByCategory[cat] || []).length
            const emoji = CATEGORY_EMOJIS[cat] || '📁'
            return `${emoji} ${prefix}menuhsn ${cat} (${total})`
        }).join('\n')
        
        const rows = visibleCats.map(cat => {
    const total = (commandsByCategory[cat] || []).length + (casesByCategory[cat] || []).length
    const emoji = CATEGORY_EMOJIS[cat] || '📁'

    return {
        title: `${emoji} ${toMonoUpperBold(cat)}`,
        description: `${total} commands`,
        id: `${prefix}menuhsn ${cat}`
    }
})

        const zanton = [
    {
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
            title: '📂 Pilih Kategori',
            sections: [
                {
                    title: 'Daftar Kategori',
                    rows
                }
            ]
        })
    },
    {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
            display_text: '🎀 Lihat Semua Menu',
            id: `${prefix}allmenu`
        })
    },
    {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
            display_text: '💌 Owner',
            id: `${prefix}owner`
        })
    }
]

        try {
            const msg = generateWAMessageFromContent(m.chat, {
                viewOnceMessage: {
                    message: {
                        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                        interactiveMessage: proto.Message.InteractiveMessage.create({
                            contextInfo: {
                                mentionedJid: [m.sender],
                                forwardingScore: 19,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06',
                                    newsletterName: `- ${config.saluran?.name || config.bot?.name || 'Hoshino Ai-Bot'}`,
                                    serverMessageId: -1
                                }
                            },
                            header: proto.Message.InteractiveMessage.Header.create({
                                title: null,
                                locationMessage: {
                                    degreesLatitude: 0,
                                    degreesLongitude: 0,
                                    name: `꫶ᥫ᭡꫶ ${m.pushName || 'User'}`,
                                    url: 'https://ss.ss',
                                    address: `Semoga harimu menyenangkan :3`,
                                    jpegThumbnail: headerThumb || undefined
                                },
                                hasMediaAttachment: false
                            }),
                            body: proto.Message.InteractiveMessage.Body.create({
                                text: `Hai *@${m.sender.split('@')[0]}*, silakan pilih kategori di bawah.`
                            }),
                            footer: proto.Message.InteractiveMessage.Footer.create({
    text: `© ${config.bot?.name} • ${visibleCats.length} kategori tersedia`
}),
                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                                buttons: zanton,
                                messageParamsJson: JSON.stringify({
                                    bottom_sheet: {
                                        in_thread_buttons_limit: 1,
                                        divider_indices: [1],
                                        list_title: '📂 Info',
                                        button_title: '𖤍'
                                    }
                                })
                            })
                        })
                    }
                }
            }, { quoted: m, userJid: sock.user?.id })

            return sock.relayMessage(msg.key.remoteJid, msg.message, { messageId: msg.key.id, quoted: m })
        } catch (e) {
            return sendCategoryList(m, sock, db, 2)
        }
    }
}

// ─── SEND COMMAND LIST ───────────────────────────────────────────────────────

async function sendCommandList(m, sock, matchedCat, variant) {
    const prefix = config.command?.prefix || '.'
    const commandsByCategory = getCommandsByCategory()
    const { getCasesByCategory } = require('../../case/hsnai')
    const casesByCategory = getCasesByCategory()

    const pluginCommands = commandsByCategory[matchedCat] || []
    const caseCommands = casesByCategory[matchedCat] || []
    const allCommands = [...pluginCommands, ...caseCommands]
    const emoji = CATEGORY_EMOJIS[matchedCat] || '📁'

    // ── V1: plain text doang ──
    if (variant === 1) {
        let txt = `${emoji} *${matchedCat.toUpperCase()}*\n\n`
        for (const cmd of allCommands) txt += `${prefix}${cmd}\n`
        txt += `\nTotal: ${allCommands.length} commands`
        if (caseCommands.length > 0) txt += ` (${pluginCommands.length} plugin + ${caseCommands.length} case)`
        return m.reply(txt)
    }

    // ── V2: gaya box (dulu V1) + fake document verified quoted ──
    if (variant === 2) {
        let txt = `╭─〔 ${emoji} *${matchedCat.toUpperCase()}* 〕\n`
        for (const cmd of allCommands) {
            txt += `*│* \`${prefix}${cmd}\`\n`
        }
        txt += `╰────────────────⬣\n\n`
        txt += `Total: \`${allCommands.length}\` commands`
        if (caseCommands.length > 0) txt += ` (${pluginCommands.length} plugin + ${caseCommands.length} case)`

        return getSimpleContextInfo(sock, m, txt)
    }

    // ── V3: delegasi ke V4 (ASCII box + ftroli), bukan button ──
    if (variant === 3) {
        return sendCommandList(m, sock, matchedCat, 4)
    }

    // ── V4: ASCII box + ftroli, background transparan di-fix jadi putih ──
    if (variant === 4) {
        const sparkles = ['✦', '✧', '⋆', '˚', '✵', '⊹']
        const rSpark = () => sparkles[Math.floor(Math.random() * sparkles.length)]

        let txt = `${rSpark()}━━━━━━━━━━━━━━━━━${rSpark()}\n`
        txt += `${emoji} *${matchedCat.toUpperCase()}*\n`
        txt += `${rSpark()}━━━━━━━━━━━━━━━━━${rSpark()}\n\n`
        txt += `┌─────「 📋 *COMMANDS* 」\n`
        txt += `│ ✦ Total: ${allCommands.length} commands\n│\n`
        for (const cmd of allCommands) {
            txt += `│ ├➤ ${prefix}${cmd}\n`
        }
        txt += `│\n└───────────────────\n\n`
        if (caseCommands.length > 0) txt += `> (${pluginCommands.length} plugin + ${caseCommands.length} case)\n`
        txt += `> ${rSpark()} *${config.bot?.name}* ${rSpark()}`

        const flatImage = await getCachedFlatImage()

        let thumbV4 = flatImage || cachedThumb
        if (thumbV4) {
            try { thumbV4 = await sharp(thumbV4).resize(300, 300, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer() } catch (e) {}
        }

        const ftroliQuoted = {
            key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast' },
            message: {
                orderMessage: {
                    orderId: '1337',
                    thumbnail: thumbV4 || null,
                    itemCount: allCommands.length,
                    status: 'INQUIRY',
                    surface: 'CATALOG',
                    message: `${matchedCat} Menu`,
                    orderTitle: `📋 ${allCommands.length} Commands`,
                    sellerJid: config.botNumber ? `${config.botNumber}@s.whatsapp.net` : m.sender,
                    token: 'hsnai-menuhsn-v4',
                    totalAmount1000: 0,
                    totalCurrencyCode: 'IDR',
                    contextInfo: {
                        isForwarded: true, forwardingScore: 9999,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06',
                            newsletterName: config.saluran?.name || config.bot?.name || 'Hoshino Ai-Bot',
                            serverMessageId: 127
                        }
                    }
                }
            }
        }

        return sock.sendMessage(m.chat, {
            image: flatImage || cachedImage || cachedThumb || Buffer.from(''),
            caption: txt,
            contextInfo: getContextInfo()
        }, { quoted: ftroliQuoted })
    }

    // ── V5: cuma 2 quick_reply, list command dipindah ke footer ──
    if (variant === 5) {
    try {
        const flatImage = await getCachedFlatImage()

let thumbV5 = null

if (cachedImage) {
    try {
        const meta = await sharp(cachedImage).metadata()

        thumbV5 = await sharp(cachedImage)
            .resize(
                300,
                Math.round((meta.height / meta.width) * 300)
            )
            .jpeg({ quality: 85 })
            .toBuffer()
    } catch (e) {
        thumbV5 = cachedImage
    }
}

        const text = `ੈ♡₊˚ *ＨＯＳＨＩＮＯ ＡＩ* ₊˚♡

Hai, *${m.pushName || 'User'}* ✨

Selamat datang di kategori *${matchedCat.toUpperCase()}*!

🎀 Total Command : *${allCommands.length}*
🌸 Gunakan command sesuai kebutuhan ya~
`
        const content = {
            buttonsMessage: {
                buttons: [
                    {
                        buttonId: `${prefix}owner`,
                        buttonText: {
                            displayText: '🌟 Owner'
                        },
                        type: 1
                    },
                    {
                        buttonId: `${prefix}allmenu`,
                        buttonText: {
                            displayText: '✨ All Menu'
                        },
                        type: 1
                    }
                ],
                locationMessage: {
    jpegThumbnail: thumbV5 || undefined,
    name: `${emoji} ${matchedCat.toUpperCase()}`,
    address: `${allCommands.length} Commands`
},
                contentText: text,
                footerText:
`📋 Daftar Command

${allCommands.map(cmd => `✦ ${prefix}${cmd}`).join('\n')}

━━━━━━━━━━━━━━
🌸 Total : ${allCommands.length} Commands`, 
                headerType: 6
            }
        }

        const msg = generateWAMessageFromContent(
            m.chat,
            content,
            {
                userJid: sock.user.jid || sock.user.id
            }
        )

        return sock.relayMessage(
            m.chat,
            msg.message,
            {
                messageId: msg.key.id
            }
        )

    } catch (e) {
        return sendCommandList(m, sock, matchedCat, 2)
    }
}
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

async function handler(m, { sock }) {
    const db = getDatabase()
    const variant = db.setting('menuhsnVariant') || 2
    const prefix = config.command?.prefix || '.'
    const args = m.args || []
    const categoryArg = args[0]?.toLowerCase()

    const categories = getCategories()
    const { getCasesByCategory } = require('../../case/hsnai')
    const casesByCategory = getCasesByCategory()

    // Tidak ada arg → tampilkan daftar kategori
    if (!categoryArg) {
        return sendCategoryList(m, sock, db, variant)
    }

    // Cari kategori
    const allCategories = [...new Set([...categories, ...Object.keys(casesByCategory)])]
    const matchedCat = allCategories.find(c => c.toLowerCase() === categoryArg)

    if (!matchedCat) {
        return m.reply(`❌ *ᴋᴀᴛᴇɢᴏʀɪ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ*\n\n> Kategori \`${categoryArg}\` tidak ada.\n> Ketik \`${prefix}menuhsn\` untuk list kategori.`)
    }

    if (matchedCat === 'owner' && !m.isOwner) {
        return m.reply(`❌ *ᴀᴋsᴇs ᴅɪᴛᴏʟᴀᴋ*\n\n> Kategori ini hanya untuk owner.`)
    }

    const commandsByCategory = getCommandsByCategory()
    const allCommands = [...(commandsByCategory[matchedCat] || []), ...(casesByCategory[matchedCat] || [])]

    if (allCommands.length === 0) {
        return m.reply(`❌ *ᴋᴏsᴏɴɢ*\n\n> Kategori \`${matchedCat}\` tidak memiliki command.`)
    }

    return sendCommandList(m, sock, matchedCat, variant)
}

module.exports = { config: pluginConfig, handler }