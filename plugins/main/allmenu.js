// ============================================================
// allmenu.js — V2 quoted stiker | V4 list kategori (tanpa carousel) |
// V6 thumb proporsional + buttonId | V7 header video
// ============================================================

const hsAsset = require('../../src/lib/assets')
const config = require('../../config')
const { formatUptime, getTimeGreeting } = require('../../src/lib/formatter')
const { getCommandsByCategory, getCategories, getPlugin } = require('../../src/lib/plugins')
const { getDatabase } = require('../../src/lib/database')
const { getCasesByCategory, getCaseCount } = require('../../case/hsnai')
const { generateWAMessageFromContent } = require('hsnai')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const axios = require('axios')

const pluginConfig = {
    name: 'allmenu',
    alias: ['fullmenu', 'allcommand', 'semua'],
    category: 'main',
    description: 'Menampilkan semua command lengkap per kategori',
    usage: '.allmenu',
    example: '.allmenu',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

const CATEGORY_EMOJIS = {
    owner: '👑', main: '🏠', utility: '🔧', fun: '🎮', group: '👥',
    download: '📥', search: '🔍', tools: '🛠️', sticker: '🖼️',
    ai: '🤖', game: '🎯', media: '🎬', info: 'ℹ️', religi: '☪️',
    panel: '🖥️', user: '📊', linode: '☁️', random: '🎲', canvas: '🎨',
    vps: '🌊', store: '🏪', premium: '💎', convert: '🔄', economy: '💰',
    cek: '📋', ephoto: '🎨', jpm: '📢', pushkontak: '📱'
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

// diperluas: nambah 🅖 (Group Only) & 🅟🅡 (Private Only), nyusul yang ada di ourin
function getCommandSymbols(cmdName) {
    const plugin = getPlugin(cmdName)
    if (!plugin || !plugin.config) return ''
    const symbols = []
    if (plugin.config.isOwner) symbols.push('Ⓞ')
    if (plugin.config.isPremium) symbols.push('ⓟ')
    if (plugin.config.limit && plugin.config.limit > 0) symbols.push('Ⓛ')
    if (plugin.config.isAdmin) symbols.push('Ⓐ')
    if (plugin.config.isGroup) symbols.push('🅖')
    if (plugin.config.isPrivate) symbols.push('🅟🅡')
    return symbols.length > 0 ? ' ' + symbols.join(' ') : ''
}

function buildText(sortedCategories, commandsByCategory, casesByCategory, m, botConfig, prefix) {
    let txt = `Hai *@${m.pushName || 'User'}* 🪸\nAku ${botConfig.bot?.name || 'Hoshino Ai'}, bot WhatsApp yang siap bantu kamu.\n\nKamu bisa pakai aku buat cari info, ambil data, atau bantu hal-hal sederhana langsung lewat WhatsApp — praktis tanpa ribet.\n\n`
    txt += `╭┈┈⬡「 📖 *ᴋᴇᴛᴇʀᴀɴɢᴀɴ* 」\n`
    txt += `┃ Ⓞ = Owner Only\n`
    txt += `┃ ⓟ = Premium Only\n`
    txt += `┃ Ⓛ = Limit Required\n`
    txt += `┃ Ⓐ = Admin Only\n`
    txt += `┃ 🅖 = Group Only\n`
    txt += `┃ 🅟🅡 = Private Only\n`
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`
    for (const category of sortedCategories) {
        const pluginCmds = commandsByCategory[category] || []
        const caseCmds = casesByCategory[category] || []
        const allCmds = [...pluginCmds, ...caseCmds]
        if (allCmds.length === 0) continue
        const emoji = CATEGORY_EMOJIS[category] || '📋'
        const categoryName = toSmallCaps(category)
        txt += `╭┈┈⬡「 ${emoji} *${categoryName}* 」\n`
        for (const cmd of allCmds) {
            const symbols = getCommandSymbols(cmd)
            txt += `┃ ◦ *${prefix}${toSmallCaps(cmd)}*${symbols}\n`
        }
        txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`
    }
    txt += `_© ${botConfig.bot?.name || 'Hoshino Ai'} | ${new Date().getFullYear()}_\n`
    txt += `_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ${botConfig.bot?.developer || 'SeaPRST'}_`
    return txt
}

// ─── Weather helper ───────────────────────────────────────────────────────────
const WEATHER_CODE = {
    0: '☀️ Cerah', 1: '🌤️ Cerah Berawan', 2: '⛅ Berawan', 3: '☁️ Mendung',
    45: '🌫️ Berkabut', 48: '🌫️ Kabut Tebal', 51: '🌦️ Gerimis',
    61: '🌧️ Hujan Ringan', 63: '🌧️ Hujan', 65: '⛈️ Hujan Lebat',
    80: '🌦️ Hujan Lokal', 95: '⛈️ Badai Petir'
}

async function weatherMenu(city = 'Jakarta') {
    try {
        const geo = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`)
        const loc = geo.data.results?.[0]
        if (!loc) return 'Cuaca tidak tersedia'
        const res = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code`)
        const current = res.data.current
        const kondisi = WEATHER_CODE[current.weather_code] || '🌍 Tidak diketahui'
        return `${kondisi} | 🌡️ ${Math.round(current.temperature_2m)}°C\n📍 ${loc.name}`
    } catch {
        return 'Cuaca tidak tersedia'
    }
}
// ─────────────────────────────────────────────────────────────────────────────

// V1 — Simple Text
async function sendV1(m, sock, txt) {
    await m.reply(txt)
}

// V2 — viewOnce interactiveMessage + image header + limited_time_offer + quick_reply
//      + quoted message bergaya reply stiker (stiker dibuat dari images/hsnai2 di config)
async function sendV2(m, sock, txt, botConfig, imageBuffer, thumbBuffer) {
    const { prepareWAMessageMedia } = require('hsnai')
    const saluranId = botConfig.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    const saluranName = botConfig.saluran?.name || botConfig.bot?.name || 'Hoshino Ai'
    const greeting = getTimeGreeting ? getTimeGreeting() : 'Halo'
    const botName = botConfig.bot?.name || 'Hoshino Ai'

    let mediaV2 = null
    if (imageBuffer) {
        try {
            mediaV2 = await prepareWAMessageMedia({ image: imageBuffer }, { upload: sock.waUploadToServer })
        } catch (e) {
            console.error('[AllMenu V2] Media prep error:', e.message)
        }
    }

    // quoted: stiker dari images/hsnai2 (config.assets.images.hsnai2), fallback ke teks biasa
    let quotedMsgV2 = { conversation: botName }
    const stickerSrcV2 = thumbBuffer || (hsAsset.has('images/hsnai2') ? await hsAsset.buffer('images/hsnai2') : null)
    if (stickerSrcV2) {
        try {
            const stickerBufV2 = await sharp(stickerSrcV2)
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp({ quality: 90 })
                .toBuffer()
            const stickerMediaV2 = await prepareWAMessageMedia({ image: stickerBufV2 }, { upload: sock.waUploadToServer })
            quotedMsgV2 = {
                stickerMessage: {
                    ...stickerMediaV2.imageMessage,
                    mimetype: 'image/webp'
                }
            }
        } catch (e) {
            console.error('[AllMenu V2] Quoted sticker error:', e.message)
        }
    }

    await sock.relayMessage(m.chat, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {},
                interactiveMessage: {
                    header: {
                        title: '',
                        subtitle: '',
                        hasMediaAttachment: !!mediaV2,
                        ...(mediaV2?.imageMessage ? { imageMessage: mediaV2.imageMessage } : {})
                    },
                    body: { text: txt },
                    footer: { text: 'Pilih tombol di bawah untuk kembali ke menu utama' },
                    contextInfo: {
                        isForwarded: true,
                        forwardingScore: 9,
                        stanzaId: crypto.randomBytes(16).toString('hex').toUpperCase(),
                        participant: '0@s.whatsapp.net',
                        quotedMessage: quotedMsgV2,
                        mentionedJid: [m.sender]
                    },
                    nativeFlowMessage: {
                        messageParamsJson: JSON.stringify({
                            limited_time_offer: {
                                text: greeting,
                                url: 'Hai',
                                copy_code: 'Dibuat oleh ' + (botConfig.bot?.developer || 'SeaPRST'),
                                expiration_time: Date.now() + 1000000
                            }
                        }),
                        buttons: [{
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: '🍅 Kembali Ke Menu Utama',
                                id: m.prefix + 'menu'
                            })
                        }]
                    }
                }
            }
        }
    }, {})
}

// V3 — Mirip Ourin V5: video header (gifPlayback) + quoted locationMessage (cuaca) + bottom_sheet + quick_reply buttons
async function sendV3(m, sock, txt, botConfig, imageBuffer, thumbBuffer) {
    const { prepareWAMessageMedia } = require('hsnai')
    const saluranId = botConfig.info?.website || botConfig.saluran?.link || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    const saluranName = botConfig.saluran?.name || botConfig.bot?.name || 'Hoshino Ai'
    const greeting = getTimeGreeting ? getTimeGreeting() : 'Halo'

    const srcBuf = imageBuffer || thumbBuffer
    let thumbV3 = null
    if (srcBuf) {
        try {
            thumbV3 = await sharp(srcBuf).resize(300, 300).toBuffer()
        } catch (e) {
            thumbV3 = srcBuf
        }
    }

    const weatherName = await weatherMenu()
    const qLocation = {
        key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: m.sender },
        message: {
            locationMessage: {
                degreesLatitude: 0,
                degreesLongitude: 0,
                name: weatherName,
                jpegThumbnail: thumbV3
            }
        }
    }


    let mediaV3 = null
    if (hsAsset.has('video/hsnai-allmenu')) {
        try {
            mediaV3 = await prepareWAMessageMedia(
                { video: (await hsAsset.buffer('video/hsnai-allmenu')), gifPlayback: true },
                { upload: sock.waUploadToServer }
            )
        } catch (e) {
            console.error('[AllMenu V3] Video prep error:', e.message)
        }
    }
    if (!mediaV3 && imageBuffer) {
        try {
            mediaV3 = await prepareWAMessageMedia({ image: imageBuffer }, { upload: sock.waUploadToServer })
        } catch (e) {
            console.error('[AllMenu V3] Image fallback error:', e.message)
        }
    }

    const headerObj = mediaV3?.videoMessage
        ? { hasMediaAttachment: true, videoMessage: mediaV3.videoMessage }
        : mediaV3?.imageMessage
            ? { hasMediaAttachment: true, imageMessage: mediaV3.imageMessage }
            : { hasMediaAttachment: false }

    const msgV3 = generateWAMessageFromContent(m.chat, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {},
                interactiveMessage: {
                    header: { title: '', subtitle: '', ...headerObj },
                    body: { text: txt },
                    footer: { text: 'Please select the button in below' },
                    contextInfo: {
                        mentionedJid: [m.sender],
                        isForwarded: true,
                        forwardingScore: 9,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: saluranId,
                            newsletterName: saluranName,
                            serverMessageId: 127
                        }
                    },
                    nativeFlowMessage: {
                        messageParamsJson: JSON.stringify({
                            limited_time_offer: {
                                text: greeting,
                                url: 'Hai',
                                expiration_time: Date.now() + 10000
                            },
                            bottom_sheet: {
                                in_thread_buttons_limit: 2,
                                divider_indices: [1, 2, 3, 4, 5, 999],
                                list_title: 'Please select the menu',
                                button_title: '🍙 See Category'
                            }
                        }),
                        buttons: [
                            { name: '', buttonParamsJson: '' },
                            {
                                name: 'quick_reply',
                                buttonParamsJson: JSON.stringify({
                                    display_text: '📂 Kembali Ke Daftar Kategori',
                                    id: m.prefix + 'menucat'
                                })
                            },
                            {
                                name: 'quick_reply',
                                buttonParamsJson: JSON.stringify({
                                    display_text: '🍅 Kembali Ke Menu Utama',
                                    id: m.prefix + 'menu'
                                })
                            }
                        ]
                    }
                }
            }
        }
    }, { quoted: qLocation, userJid: sock.user?.jid || sock.user?.id })

    await sock.relayMessage(m.chat, msgV3.message, { messageId: msgV3.key.id })
}

// V4 — Pilih Kategori (single_select) — pengganti carousel
//      Header gambar + ringkasan jumlah command per kategori + tombol list kategori.
//      Tiap row kategori ngirim `.menuhsn <kategori>`.
async function sendV4(m, sock, txt, botConfig, imageBuffer, thumbBuffer, ctx = {}) {
    const { prepareWAMessageMedia } = require('hsnai')
    const prefix = m.prefix || botConfig.command?.prefix || '.'
    const botName = botConfig.bot?.name || 'Hoshino Ai'
    const pushName = m.pushName || 'User'
    const greeting = getTimeGreeting ? getTimeGreeting() : 'Halo'

    const cmdsByCat = ctx.commandsByCategory || getCommandsByCategory()
    const casesByCat = ctx.casesByCategory || getCasesByCategory()
    const catList = ctx.categories || getCategories().filter(c => c !== 'owner' || m.isOwner)

    const entries = []
    for (const cat of catList) {
        const count = (cmdsByCat[cat] || []).length + (casesByCat[cat] || []).length
        if (count > 0) entries.push({ cat, count })
    }

    if (entries.length === 0) { await m.reply(txt); return }

    const totalCmds = entries.reduce((a, b) => a + b.count, 0)

    // body: ringkasan kategori
    let body = `${greeting} *${pushName}* 🪸\nAku *${botName}*, ini daftar kategori menu yang tersedia.\n\n`
    body += `╭┈┈⬡「 🗂️ *${toSmallCaps('daftar kategori')}* 」\n`
    for (const { cat, count } of entries) {
        body += `┃ ${CATEGORY_EMOJIS[cat] || '📋'} *${toSmallCaps(cat)}* ➜ ${count}\n`
    }
    body += `╰┈┈┈┈┈┈┈┈⬡\n\n`
    body += `> Total: *${totalCmds}* command • *${entries.length}* kategori\n`
    body += `> Ketuk *Pilih Kategori* di bawah buat lihat command-nya ya~ ✨`

    // rows single_select (dipecah per 8 kategori biar list tetap rapi)
    const rows = entries.map(({ cat, count }) => ({
        header: '',
        title: `${CATEGORY_EMOJIS[cat] || '📋'} ${cat.charAt(0).toUpperCase()}${cat.slice(1)}`,
        description: `${count} command tersedia`,
        id: `${prefix}menuhsn ${cat}`
    }))
    const sections = []
    for (let i = 0; i < rows.length; i += 8) {
        const chunk = rows.slice(i, i + 8)
        sections.push({
            title: rows.length > 8 ? `📋 Kategori ${i + 1}-${i + chunk.length}` : '📋 Kategori Menu',
            rows: chunk
        })
    }

    let mediaV4 = null
    if (imageBuffer) {
        try {
            mediaV4 = await prepareWAMessageMedia({ image: imageBuffer }, { upload: sock.waUploadToServer })
        } catch (e) {
            console.error('[AllMenu V4] Media prep error:', e.message)
        }
    }

    await sock.relayMessage(m.chat, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {},
                interactiveMessage: {
                    header: {
                        title: '',
                        subtitle: '',
                        hasMediaAttachment: !!mediaV4,
                        ...(mediaV4?.imageMessage ? { imageMessage: mediaV4.imageMessage } : {})
                    },
                    body: { text: body },
                    footer: { text: `${botName} v${botConfig.bot?.version || '1.0'}` },
                    contextInfo: {
                        isForwarded: true,
                        forwardingScore: 9,
                        mentionedJid: [m.sender]
                    },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({
                                    title: '📜 Pilih Kategori',
                                    sections
                                })
                            },
                            {
                                name: 'quick_reply',
                                buttonParamsJson: JSON.stringify({
                                    display_text: '🍅 Menu Utama',
                                    id: prefix + 'menu'
                                })
                            },
                            {
                                name: 'quick_reply',
                                buttonParamsJson: JSON.stringify({
                                    display_text: '🧀 Owner',
                                    id: prefix + 'owner'
                                })
                            }
                        ]
                    }
                }
            }
        }
    }, {})
}

// V5 — viewOnce interactiveMessage + location header + fake order quoted
async function sendV5(m, sock, txt, botConfig, imageBuffer, thumbBuffer) {
    const saluranId = botConfig.info?.website || botConfig.saluran?.link || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    const saluranName = botConfig.saluran?.name || botConfig.bot?.name || 'Hoshino Ai'
    const saluranLink = botConfig.saluran?.link || botConfig.info?.website || 'https://hoshino.site'
    const ownerNumber = botConfig.owner?.number?.[0]
    const ownerUrl = ownerNumber ? 'https://wa.me/' + ownerNumber : saluranLink
    const greeting = getTimeGreeting ? getTimeGreeting() : 'Halo'

    const srcBuf = imageBuffer || thumbBuffer
    let locationThumb = null
    if (srcBuf) {
        try {
            const metaV5 = await sharp(srcBuf).metadata();
            const wV5 = metaV5.width || 300;
            const hV5 = metaV5.height || 300;
            const targetW = 300;
            const targetH = Math.round((hV5 / wV5) * targetW);
            locationThumb = await sharp(srcBuf).resize(targetW, targetH).jpeg({ quality: 85 }).toBuffer()
        } catch (e) {
            locationThumb = srcBuf
        }
    }


    let orderThumb = null
    if (hsAsset.has('images/hsnai2')) {
        try {
            orderThumb = await sharp((await hsAsset.buffer('images/hsnai2'))).resize(300, 300).toBuffer()
        } catch (e) {
            orderThumb = hsAsset.has('images/hsnai2') ? (await hsAsset.buffer('images/hsnai2')) : null
        }
    }

    const totalCmds = (() => {
        let n = 0
        const cats = getCommandsByCategory()
        for (const k of Object.keys(cats)) n += (cats[k] || []).length
        n += getCaseCount()
        return n
    })()

    const fakeOrder = {
        key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast' },
        message: {
            orderMessage: {
                orderId: '1337',
                thumbnail: orderThumb,
                itemCount: `${totalCmds} Commands`,
                status: 'INQUIRY',
                surface: 'CATALOG',
                message: `★ ${botConfig.bot?.name || 'Hoshino Ai'}`,
                orderTitle: `📋 ${botConfig.bot?.name || 'Hoshino Ai'} — AllMenu`,
                sellerJid: botConfig.botNumber ? `${botConfig.botNumber}@s.whatsapp.net` : m.sender,
                token: 'hsnai-allmenu-v5',
                totalAmount1000: 0,
                totalCurrencyCode: 'IDR',
                contextInfo: {
                    isForwarded: true,
                    forwardingScore: 9999,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: saluranId,
                        newsletterName: saluranName,
                        serverMessageId: 127
                    }
                }
            }
        }
    }

    const msgV5 = generateWAMessageFromContent(m.chat, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {},
                interactiveMessage: {
                    header: {
                        hasMediaAttachment: !!locationThumb,
                        locationMessage: {
                            degreesLatitude: 0,
                            degreesLongitude: 0,
                            name: botConfig.bot?.name || 'Hoshino Ai',
                            address: `v${botConfig.bot?.version || '1.0'} | ${botConfig.bot?.developer || 'Developer'}`,
                            jpegThumbnail: locationThumb
                        }
                    },
                    body: { text: txt },
                    footer: { text: `© ${botConfig.bot?.name || 'Hoshino Ai'} v${botConfig.bot?.version || '1.0'}` },
                    contextInfo: {
                        mentionedJid: [m.sender],
                        isForwarded: true,
                        forwardingScore: 9,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: saluranId,
                            newsletterName: saluranName,
                            serverMessageId: 127
                        }
                    },
                    nativeFlowMessage: {
                        messageParamsJson: JSON.stringify({
                            limited_time_offer: {
                                text: `Follow channel kami ya~ 💫`,
                                url: saluranLink,
                                copy_code: null,
                                expiration_time: null
                            },
                            bottom_sheet: {
                                in_thread_buttons_limit: 2,
                                divider_indices: [1, 2, 3, 999],
                                list_title: botConfig.bot?.name || 'Hoshino Ai',
                                button_title: '✨ Lihat Menu'
                            }
                        }),
                        buttons: [
                            {
                                name: 'cta_url',
                                buttonParamsJson: JSON.stringify({
                                    display_text: '🌐 Channel Kami',
                                    url: saluranLink,
                                    merchant_url: saluranLink
                                })
                            },
                            {
                                name: 'quick_reply',
                                buttonParamsJson: JSON.stringify({
                                    display_text: '🏠 Menu Utama',
                                    id: m.prefix + 'menu'
                                })
                            },
                            {
                                name: 'cta_url',
                                buttonParamsJson: JSON.stringify({
                                    display_text: '📞 Hubungi Owner',
                                    url: ownerUrl,
                                    merchant_url: ownerUrl
                                })
                            }
                        ]
                    }
                }
            }
        }
    }, { quoted: fakeOrder, userJid: sock.user?.jid || sock.user?.id })

    await sock.relayMessage(m.chat, msgV5.message, { messageId: msgV5.key.id })
}

// V6 — header locationMessage LANGSUNG (bukan quoted) dengan cuaca real-time di
// field `address`. Sekarang pakai buttonsMessage + buttonId (cara kerja menu.js case 17).
// Thumbnail diresize PROPORSIONAL (lebar 300, tinggi ngikut rasio gambar) — gak di-crop.
async function sendV6(m, sock, txt, botConfig, imageBuffer, thumbBuffer) {
    const { generateMessageIDV2 } = require('hsnai')
    const prefix = m.prefix || botConfig.command?.prefix || '.'
    const saluranId = botConfig.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    const saluranName = botConfig.saluran?.name || botConfig.bot?.name || 'Hoshino Ai'
    const botName = botConfig.bot?.name || 'Hoshino Ai'

    const srcBuf = imageBuffer || thumbBuffer
    let thumbV6 = null
    if (srcBuf) {
        try {
            const metaV6 = await sharp(srcBuf).metadata()
            const wV6 = metaV6.width || 300
            const hV6 = metaV6.height || 300
            const targetW = 300
            const targetH = Math.max(1, Math.round((hV6 / wV6) * targetW))
            thumbV6 = await sharp(srcBuf)
                .resize(targetW, targetH, { fit: 'fill' })
                .jpeg({ quality: 85 })
                .toBuffer()
        } catch (e) {
            thumbV6 = srcBuf
        }
    }

    const weatherAddress = await weatherMenu()

    const buttonsV6 = [
        {
            buttonId: `${prefix}menu`,
            buttonText: { displayText: '🏠' },
            type: 1
        },
        {
            buttonId: `${prefix}owner`,
            buttonText: { displayText: '👑' },
            type: 1
        }
    ]

    const contentV6 = {
        buttonsMessage: {
            buttons: buttonsV6,
            locationMessage: {
                degreesLatitude: 0,
                degreesLongitude: 0,
                name: botName,
                address: weatherAddress,
                jpegThumbnail: thumbV6 || undefined
            },
            contentText: txt,
            footerText: `© ${botName}`,
            headerType: 6,
            viewOnce: true,
            contextInfo: {
                mentionedJid: [m.sender],
                isForwarded: true,
                forwardingScore: 9,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: saluranId,
                    newsletterName: saluranName,
                    serverMessageId: 127
                }
            }
        }
    }

    const msgV6 = generateWAMessageFromContent(m.chat, contentV6, {
        quoted: m,
        userJid: sock.user?.jid || sock.user?.id,
        messageId: generateMessageIDV2()
    })

    await sock.relayMessage(m.chat, msgV6.message, {
        messageId: msgV6.key.id,
        additionalNodes: [
            {
                tag: 'biz',
                attrs: {},
                content: [
                    {
                        tag: 'interactive',
                        attrs: { type: 'native_flow', v: '1' },
                        content: [
                            { tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }
                        ]
                    }
                ]
            }
        ]
    })
}

// V7 — BARU, portingan ourin: sapaan singkat di BODY, daftar command lengkap
// dipindah ke FOOTER. Trik biar tampilan awal kelihatan ringkas di layar chat.
async function sendV7(m, sock, txt, botConfig, imageBuffer, thumbBuffer) {
    const { prepareWAMessageMedia } = require('hsnai')
    const greeting = getTimeGreeting ? getTimeGreeting() : 'Halo'
    const botName = botConfig.bot?.name || 'Hoshino Ai-Bot'
    const devName = botConfig.bot?.developer || 'SeaPRST'
    const pushName = m.pushName || 'User'

    // header: VIDEO dari config.assets.video (prioritas hsnai-allmenu, fallback hsnai),
    // kalau dua-duanya kosong / gagal baru jatuh ke gambar
    let mediaV7 = null
    const videoKeyV7 = hsAsset.has('video/hsnai-allmenu')
        ? 'video/hsnai-allmenu'
        : (hsAsset.has('video/hsnai') ? 'video/hsnai' : null)
    if (videoKeyV7) {
        try {
            mediaV7 = await prepareWAMessageMedia(
                { video: (await hsAsset.buffer(videoKeyV7)), gifPlayback: true },
                { upload: sock.waUploadToServer }
            )
        } catch (e) {
            console.error('[AllMenu V7] Video prep error:', e.message)
        }
    }
    if (!mediaV7 && imageBuffer) {
        try {
            mediaV7 = await prepareWAMessageMedia({ image: imageBuffer }, { upload: sock.waUploadToServer })
        } catch (e) {
            console.error('[AllMenu V7] Image fallback error:', e.message)
        }
    }

    const headerObjV7 = mediaV7?.videoMessage
        ? { hasMediaAttachment: true, videoMessage: mediaV7.videoMessage }
        : mediaV7?.imageMessage
            ? { hasMediaAttachment: true, imageMessage: mediaV7.imageMessage }
            : { hasMediaAttachment: false }

    await sock.relayMessage(m.chat, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {},
                interactiveMessage: {
                    header: { title: '', subtitle: '', ...headerObjV7 },
                    body: {
                        text: `> ${greeting} *${pushName}* 👋 Perkenalkan aku *${botName}*, buatan *${devName}*. Aku siap bantu kamu download video, main game, tanya jawab, cari info, bikin sticker, dan lain-lain.\n\n`
                    },
                    footer: {
                        text: txt
                    },
                    contextInfo: {
                        isForwarded: true,
                        forwardingScore: 9,
                        participant: '0@s.whatsapp.net',
                        quotedMessage: { conversation: botName },
                        mentionedJid: [m.sender]
                    },
                    nativeFlowMessage: {
                        messageParamsJson: JSON.stringify({
                            limited_time_offer: {
                                text: greeting,
                                url: 'Hai',
                                copy_code: 'Dibuat oleh ' + devName,
                                expiration_time: Date.now() + 1000000
                            }
                        }),
                        buttons: [{
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: '🍅 Kembali Ke Menu Utama',
                                id: m.prefix + 'menu'
                            })
                        }]
                    }
                }
            }
        }
    }, {})
}

async function handler(m, { sock, config: botConfig, db, uptime }) {
    const prefix = botConfig.command?.prefix || '.'
    const groupData = m.isGroup ? (db.getGroup(m.chat) || {}) : {}
    const botMode = groupData.botMode || 'md'
    const variant = db.setting('allMenuVariant') || botConfig.ui?.allMenuVariant || 2

    const categories = getCategories()
    const commandsByCategory = getCommandsByCategory()
    const casesByCategory = getCasesByCategory()

    const categoryOrder = ['owner', 'main', 'utility', 'tools', 'fun', 'game', 'download', 'search', 'sticker', 'media', 'ai', 'group', 'religi', 'info', 'cek', 'economy', 'user', 'canvas', 'random', 'premium']
    const sortedCategories = [...categories].sort((a, b) => {
        const indexA = categoryOrder.indexOf(a)
        const indexB = categoryOrder.indexOf(b)
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB)
    })

    let modeAllowedMap = { md: null, store: ['main', 'group', 'sticker', 'owner', 'store'], pushkontak: ['main', 'group', 'sticker', 'owner', 'pushkontak'] }
    let modeExcludeMap = { md: ['panel', 'pushkontak', 'store'], store: null, pushkontak: null }

    try {
        const botmodePlugin = require('../group/botmodegc')
        if (botmodePlugin?.MODES) {
            modeAllowedMap = {}
            modeExcludeMap = {}
            for (const [key, val] of Object.entries(botmodePlugin.MODES)) {
                modeAllowedMap[key] = val.allowedCategories
                modeExcludeMap[key] = val.excludeCategories
            }
        }
    } catch (e) {}

    const allowedCategories = modeAllowedMap[botMode]
    const excludeCategories = modeExcludeMap[botMode] || []

    const filteredCategories = sortedCategories.filter(category => {
        if (category === 'owner' && !m.isOwner) return false
        if (allowedCategories && !allowedCategories.includes(category.toLowerCase())) return false
        if (excludeCategories && excludeCategories.includes(category.toLowerCase())) return false
        const pluginCmds = commandsByCategory[category] || []
        const caseCmds = casesByCategory[category] || []
        return (pluginCmds.length + caseCmds.length) > 0
    })

    const txt = buildText(filteredCategories, commandsByCategory, casesByCategory, m, botConfig, prefix)


    let imageBuffer = hsAsset.has('images/hsnai-allmenu') ? (await hsAsset.buffer('images/hsnai-allmenu')) : null

    let thumbBuffer = hsAsset.has('images/hsnai2') ? (await hsAsset.buffer('images/hsnai2')) : null

    try {
        switch (variant) {
            case 1: await sendV1(m, sock, txt); break
            case 2: await sendV2(m, sock, txt, botConfig, imageBuffer, thumbBuffer); break
            case 3: await sendV3(m, sock, txt, botConfig, imageBuffer, thumbBuffer); break
            case 4: await sendV4(m, sock, txt, botConfig, imageBuffer, thumbBuffer, { categories: filteredCategories, commandsByCategory, casesByCategory }); break
            case 5: await sendV5(m, sock, txt, botConfig, imageBuffer, thumbBuffer); break
            case 6: await sendV6(m, sock, txt, botConfig, imageBuffer, thumbBuffer); break
            case 7: await sendV7(m, sock, txt, botConfig, imageBuffer, thumbBuffer); break
            default: await sendV2(m, sock, txt, botConfig, imageBuffer, thumbBuffer)
        }
    } catch (error) {
        console.error(`[AllMenu] Error pada variant V${variant}:`, error.message)
        try {
            if (imageBuffer) await sendV5(m, sock, txt, botConfig, imageBuffer, thumbBuffer)
            else await sendV1(m, sock, txt)
        } catch {
            await m.reply(txt)
        }
    }
}

module.exports = { config: pluginConfig, handler }