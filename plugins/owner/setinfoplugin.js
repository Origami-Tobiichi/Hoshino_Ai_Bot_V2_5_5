const hsAsset = require('../../src/lib/assets')
const fs = require('fs')
const path = require('path')
const config = require('../../config')
const { generateWAMessageFromContent, proto } = require('hsnai')

const pluginConfig = {
    name: 'setinfoplugin',
    alias: ['infopluginvariant', 'infopluginstyle', 'sipv'],
    category: 'owner',
    description: 'Mengatur variant tampilan notif info plugin (add/del). Gunakan #test untuk preview ke test channel.',
    usage: '.setinfoplugin <v1-v5> [#test] / .setinfoplugin #set <link/jid>',
    example: '.setinfoplugin v1 #test',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

const VARIANTS = {
    v1: { id: 1, name: 'Simple',        desc: 'Teks biasa, tanpa gambar, tanpa button' },
    v2: { id: 2, name: 'Button + Thumb', desc: 'Thumbnail + caption + button URL kontak owner' },
    v3: { id: 3, name: 'Carousel',       desc: 'Carousel card dengan thumbnail + caption per aksi' },
    v4: {
        id: 4, name: 'Deployment Console', desc: 'Dashboard deployment premium dengan identity panel, timeline, system console, metrics, dan progress' },
    v5: { id: 5, name: 'GIF + Font',     desc: 'GIF thumbnail + caption dengan font bold Unicode' },
}

const toMonoUpperBold = (text) => {
    const chars = {
        'A':'𝗔','B':'𝗕','C':'𝗖','D':'𝗗','E':'𝗘','F':'𝗙','G':'𝗚',
        'H':'𝗛','I':'𝗜','J':'𝗝','K':'𝗞','L':'𝗟','M':'𝗠','N':'𝗡',
        'O':'𝗢','P':'𝗣','Q':'𝗤','R':'𝗥','S':'𝗦','T':'𝗧','U':'𝗨',
        'V':'𝗩','W':'𝗪','X':'𝗫','Y':'𝗬','Z':'𝗭'
    }
    return String(text).toUpperCase().split('').map(c => chars[c] || c).join('')
}

// ─── Actor name resolver ─────────────────────────────────────────────────────

function getActorName(actorJid, db) {
    try {
        const { getOwnerDisplayName } = require('./renameowner')
        const number = String(actorJid).replace(/[^0-9]/g, '')
        return getOwnerDisplayName(number, db)
    } catch {
        try {
            const names  = db?.setting?.('ownerNames') || {}
            const number = String(actorJid).replace(/[^0-9]/g, '')
            if (names[number]) return names[number]
            const userDb = db?.getUser?.(actorJid.includes('@') ? actorJid : actorJid + '@s.whatsapp.net')
            return userDb?.name || userDb?.pushName || number
        } catch {
            return String(actorJid).replace(/[^0-9]/g, '') || 'Owner'
        }
    }
}

// ─── Caption builder ──────────────────────────────────────────────────────────

function buildCaption(emoji, actionLabel, action, pluginData, time, actorName) {
    const cmdList = pluginData.commands?.length
        ? pluginData.commands.join(', ')
        : pluginData.name

    return (
        `${emoji} *${toMonoUpperBold(actionLabel)}*\n\n` +
        `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ ᴘʟᴜɢɪɴ* 」\n` +
        `┃ 📝 Nama     : *${pluginData.name}*\n` +
        `┃ 📂 Path     : plugins/${pluginData.folder || 'other'}/${pluginData.name}.js\n` +
        `┃ 🏷️ Kategori : ${pluginData.category || pluginData.folder || 'other'}\n` +
        `┃ ⌨️ Commands : \`${cmdList}\`\n` +
        `┃ 📊 Ukuran   : ${pluginData.size || 'N/A'} bytes\n` +
        `┃ 🔄 Reload   : ${pluginData.reload ? '✅ Sukses' : '⚠️ Pending'}\n` +
        `┃ ⚡ Aksi     : ${action}\n` +
        `┃ ⏱️ Waktu    : ${time}\n` +
        `┃ 👤 Oleh     : ${actorName}\n` +
        `╰┈┈⬡\n\n` +
        `_Ada masalah? Hubungi owner~ 💕_`
    )
}

function buildCaptionBold(emoji, actionLabel, action, pluginData, time, actorName) {
    const cmdList = pluginData.commands?.length
        ? pluginData.commands.join(', ')
        : pluginData.name

    return (
        `${emoji} ${toMonoUpperBold(actionLabel)}\n\n` +
        `╭┈┈⬡「 ${toMonoUpperBold('Detail Plugin')} 」\n` +
        `┃ ${toMonoUpperBold('Nama')}     : ${pluginData.name}\n` +
        `┃ ${toMonoUpperBold('Path')}     : plugins/${pluginData.folder || 'other'}/${pluginData.name}.js\n` +
        `┃ ${toMonoUpperBold('Kategori')} : ${pluginData.category || pluginData.folder || 'other'}\n` +
        `┃ ${toMonoUpperBold('Commands')} : ${cmdList}\n` +
        `┃ ${toMonoUpperBold('Ukuran')}   : ${pluginData.size || 'N/A'} bytes\n` +
        `┃ ${toMonoUpperBold('Reload')}   : ${pluginData.reload ? '✅' : '⚠️'}\n` +
        `┃ ${toMonoUpperBold('Aksi')}     : ${action}\n` +
        `┃ ${toMonoUpperBold('Waktu')}    : ${time}\n` +
        `┃ ${toMonoUpperBold('Oleh')}     : ${actorName}\n` +
        `╰┈┈⬡\n\n` +
        `[ ⭐ ] - ${toMonoUpperBold('Hoshino Ai')} • ${toMonoUpperBold('Plugin Manager')} 💕`
    )
}

// ─── Canvas helpers (V4) ──────────────────────────────────────────────────────

function truncateText(ctx, text, maxWidth) {
    text = String(text ?? '')
    if (ctx.measureText(text).width <= maxWidth) return text
    let out = text
    while (out.length > 0 && ctx.measureText(out + '…').width > maxWidth) {
        out = out.slice(0, -1)
    }
    return out + '…'
}

function roundRect(ctx, x, y, w, h, r) {
    if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r }
    ctx.beginPath()
    ctx.moveTo(x + r.tl, y)
    ctx.lineTo(x + w - r.tr, y)
    ctx.arcTo(x + w, y, x + w, y + r.tr, r.tr)
    ctx.lineTo(x + w, y + h - r.br)
    ctx.arcTo(x + w, y + h, x + w - r.br, y + h, r.br)
    ctx.lineTo(x + r.bl, y + h)
    ctx.arcTo(x, y + h, x, y + h - r.bl, r.bl)
    ctx.lineTo(x, y + r.tl)
    ctx.arcTo(x, y, x + r.tl, y, r.tl)
    ctx.closePath()
}

function drawInfoCard(ctx, x, y, w, h, label, value, accent) {
    roundRect(ctx, x, y, w, h, 12)
    ctx.fillStyle = 'rgba(255,255,255,0.045)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = accent
    ctx.font = 'bold 11px sans-serif'
    ctx.fillText(truncateText(ctx, label, w - 24), x + 14, y + 22)

    ctx.fillStyle = '#F2F2F7'
    ctx.font = 'bold 15px sans-serif'
    ctx.fillText(truncateText(ctx, value, w - 24), x + 14, y + 44)
}

function drawStar(ctx, cx, cy, outerR, innerR, color) {
    const spikes = 5
    let rot = (Math.PI / 2) * 3
    const step = Math.PI / spikes
    ctx.beginPath()
    ctx.moveTo(cx, cy - outerR)
    for (let i = 0; i < spikes; i++) {
        let x = cx + Math.cos(rot) * outerR
        let y = cy + Math.sin(rot) * outerR
        ctx.lineTo(x, y)
        rot += step
        x = cx + Math.cos(rot) * innerR
        y = cy + Math.sin(rot) * innerR
        ctx.lineTo(x, y)
        rot += step
    }
    ctx.lineTo(cx, cy - outerR)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
}

function drawStatusIcon(ctx, cx, cy, size, action, color) {
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = size * 0.16
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    if (action === 'ADD') {
        ctx.moveTo(cx - size * 0.5, cy + size * 0.02)
        ctx.lineTo(cx - size * 0.1, cy + size * 0.42)
        ctx.lineTo(cx + size * 0.55, cy - size * 0.42)
    } else {
        ctx.moveTo(cx - size * 0.4, cy - size * 0.4)
        ctx.lineTo(cx + size * 0.4, cy + size * 0.4)
        ctx.moveTo(cx + size * 0.4, cy - size * 0.4)
        ctx.lineTo(cx - size * 0.4, cy + size * 0.4)
    }
    ctx.stroke()
    ctx.restore()
}

// ─── Thumbnail tint helper (accent per aksi, tanpa canvas berat) ────────────
async function tintThumbnail(buffer, hexColor, opacity = 0.32) {
    try {
        const sharp = require('sharp')
        const hex = hexColor.replace('#', '')
        const r = parseInt(hex.substring(0, 2), 16)
        const g = parseInt(hex.substring(2, 4), 16)
        const b = parseInt(hex.substring(4, 6), 16)

        const overlay = await sharp({
            create: { width: 400, height: 400, channels: 4, background: { r, g, b, alpha: opacity } }
        }).png().toBuffer()

        return await sharp(buffer)
            .resize(400, 400, { fit: 'cover' })
            .composite([{ input: overlay, blend: 'overlay' }])
            .jpeg({ quality: 85 })
            .toBuffer()
    } catch (e) {
        console.error('[setinfoplugin] tintThumbnail gagal:', e.message)
        return buffer
    }
}

async function handler(m, { sock, db }) {
    const args     = m.args || []
    const lowerArgs = args.map(a => a.toLowerCase())

    // ===== #set — set test channel target (dipakai bareng sama .upch #set) =====
    if (lowerArgs[0] === '#set') {
        const setInput = args.slice(1).join(' ').trim()

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
                `⭐ *Ai Hoshino — Set Test Channel!*\n\n` +
                `❌ Link/JID tidak valid!\n\n` +
                `📝 *Format:*\n` +
                `\`.setinfoplugin #set https://whatsapp.com/channel/xxx\`\n` +
                `\`.setinfoplugin #set 120363xxx@newsletter\``
            )
        }

        db.setting('testChannelId', newJid)
        db.setting('testChannelName', newName)
        try { db.flushAll ? db.flushAll() : await db.save() } catch { await db.save() }

        m.react('✅')
        return m.reply(
            `⭐ *Ai Hoshino — Set Test Channel!*\n\n` +
            `✅ Test channel berhasil diset!\n\n` +
            `📛 *Nama:* ${newName}\n` +
            `🆔 *JID:* ${newJid}\n\n` +
            `> Sekarang \`.setinfoplugin v1 #test\` bisa dipakai preview~ 🌟`
        )
    }

    const variant = lowerArgs.find(a => /^v[1-5]$/.test(a))
    const isTest  = lowerArgs.includes('#test')

    // ===== #test — kirim preview ADD & DELETE ke test channel =====
    if (isTest) {
        const testChId   = db.setting('testChannelId') || null
        const testChName = db.setting('testChannelName') || 'Test Channel'

        if (!testChId) {
            m.react('❌')
            return m.reply(
                `⭐ *Ai Hoshino — Preview Test!*\n\n` +
                `❌ Test channel belum diset!\n\n` +
                `📝 *Set dulu dengan:*\n` +
                `\`.setinfoplugin #set https://whatsapp.com/channel/xxx\``
            )
        }

        const forceVariant = variant ? VARIANTS[variant].id : (db.setting('infopluginVariant') || 1)
        const variantMeta  = VARIANTS[`v${forceVariant}`]

        const dummyPlugin = {
            name: 'testplugin',
            folder: 'owner',
            category: 'owner',
            commands: ['testplugin'],
            size: 4321,
            reload: true
        }

        m.react('🧪')
        try {
            await sendInfoPlugin('ADD', dummyPlugin, sock, db, config, m.sender, {
                forceVariant,
                channelIdOverride: testChId,
                channelNameOverride: testChName
            })
            await sendInfoPlugin('DELETE', dummyPlugin, sock, db, config, m.sender, {
                forceVariant,
                channelIdOverride: testChId,
                channelNameOverride: testChName
            })
            m.react('✅')
            return m.reply(
                `⭐ *Ai Hoshino — Preview Test!*\n\n` +
                `✅ Preview *V${forceVariant} — ${variantMeta?.name || 'Unknown'}* (ADD & DELETE) sudah dikirim! ✨\n\n` +
                `> 📡 Target: _${testChName}_\n` +
                `> _Variant aktif global tidak berubah ya~ 💕_`
            )
        } catch (e) {
            console.error('[setinfoplugin #test]', e)
            m.react('💔')
            return m.reply(`Gomen ne~ preview-nya gagal terkirim. ☹\n\n_${e.message}_`)
        }
    }

    if (variant) {
        const selected = VARIANTS[variant]
        if (!selected) {
            return m.reply(
                `⭐ *Ai Hoshino — Set Info Plugin!*\n\n` +
                `Eeh~ \`${variant}\` bukan variant yang Ai kenal deh~ 🌸\n` +
                `Gunakan: \`v1\` s/d \`v5\` ya~`
            )
        }

        db.setting('infopluginVariant', selected.id)
        try { db.flushAll ? db.flushAll() : await db.save() } catch { await db.save() }

        return m.reply(
            `⭐ *Ai Hoshino — Set Info Plugin!*\n\n` +
            `Yay~ Ai sudah ganti tampilan notif plugin-nya! ✨\n\n` +
            `> 🎨 *V${selected.id} — ${selected.name}*\n` +
            `> _${selected.desc}_\n\n` +
            `_Semoga tampilannya makin cantik ya~ 💕_`
        )
    }

    const current = db.setting('infopluginVariant') || 1

    const rows = Object.entries(VARIANTS).map(([key, val]) => ({
        title: `${key.toUpperCase()}${val.id === current ? ' ✓' : ''} — ${val.name}`,
        description: val.desc,
        id: `${m.prefix}setinfoplugin ${key}`
    }))

    const bodyText =
        `⭐ *Ai Hoshino — Set Info Plugin!*\n\n` +
        `Kon-Ai~ Kak *${m.pushName || 'Owner'}*! 🌟\n` +
        `Di sini Ai bisa atur tampilan notif saat plugin di-add atau di-delete~\n\n` +
        `> Variant aktif: *V${current}*\n` +
        `> _${VARIANTS[`v${current}`]?.name || 'Unknown'}_\n\n` +
        `> Pilih variant dari daftar di bawah ya~ 💕`

    try {
        const interactiveButtons = [
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: '🎨 ᴘɪʟɪʜ ᴠᴀʀɪᴀɴᴛ',
                    sections: [{
                        title: 'ᴅᴀꜰᴛᴀʀ ᴠᴀʀɪᴀɴᴛ ɪɴꜰᴏ ᴘʟᴜɢɪɴ',
                        rows
                    }]
                })
            }
        ]

        const msg = generateWAMessageFromContent(m.chat, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                    interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                        body: proto.Message.InteractiveMessage.Body.fromObject({ text: bodyText }),
                        footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: config.bot?.name || 'Hoshino Ai' }),
                        header: proto.Message.InteractiveMessage.Header.fromObject({
                            title: '🎨 Info Plugin Variant',
                            subtitle: `${Object.keys(VARIANTS).length} variant tersedia`,
                            hasMediaAttachment: false
                        }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                            buttons: interactiveButtons
                        }),
                        contextInfo: {
                            mentionedJid: [m.sender],
                            forwardingScore: 9999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: config.saluran?.id || '',
                                newsletterName: config.saluran?.name || config.bot?.name || 'Hoshino Ai',
                                serverMessageId: 127
                            }
                        }
                    })
                }
            }
        }, { userJid: m.sender, quoted: m })

        await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id })

    } catch {
        let txt = `⭐ *Ai Hoshino — Set Info Plugin!*\n\nVariant aktif: *V${current}*\n\n`
        for (const [key, val] of Object.entries(VARIANTS)) {
            const mark = val.id === current ? ' ✓' : ''
            txt += `> *${key.toUpperCase()}*${mark} — _${val.desc}_\n`
        }
        txt += `\n_Gunakan: \`.setinfoplugin v1\` dst._`
        await m.reply(txt)
    }
}

// ─── sendInfoPlugin ───────────────────────────────────────────────────────────

async function sendInfoPlugin(action, pluginData, sock, db, cfg, actorJid, options = {}) {
    try {
        const variant     = options.forceVariant || db.setting('infopluginVariant') || 1
        const channelId   = options.channelIdOverride || cfg?.saluran?.id
        const channelName = options.channelNameOverride || cfg?.saluran?.name
        const isTestMode  = !!options.channelIdOverride

        console.log(`[setinfoplugin] action=${action}, variant=${variant}, channelId=${channelId}${isTestMode ? ' (TEST MODE)' : ''}`)

        if (!channelId) {
            console.warn('[setinfoplugin] channelId kosong, cek config.saluran.id')
            return
        }

        const actorName  = getActorName(actorJid || '', db)
        const time       = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
        const emoji      = action === 'ADD' ? '✅' : '🗑️'
        const actionLabel = action === 'ADD'
            ? (isTestMode ? 'Plugin Ditambahkan (TEST)' : 'Plugin Ditambahkan')
            : (isTestMode ? 'Plugin Dihapus (TEST)' : 'Plugin Dihapus')
        const botName    = cfg?.bot?.name || 'Hoshino Ai'


        const thumbBuffer = hsAsset.has('images/hsnai') ? (await hsAsset.buffer('images/hsnai')) : null

        const caption = buildCaption(emoji, actionLabel, action, pluginData, time, actorName)

        const newsletterCtx = {
            forwardingScore: 9999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: channelId,
                newsletterName: channelName || botName,
                serverMessageId: 127
            }
        }

        // ── V1: Teks biasa ────────────────────────────────────────────────────
        if (variant === 1) {
            await sock.sendMessage(channelId, { text: caption })
            return
        }

// ── V2: Action Card — native link preview via proto langsung ────────────
        if (variant === 2) {
            try {
                const { prepareWAMessageMedia } = require('hsnai')
                const accentColor = action === 'ADD' ? '#5EFFB0' : '#FF5C8A'
                const cmdList = pluginData.commands?.length
                    ? pluginData.commands.join(', ')
                    : pluginData.name
                const cmdCount = pluginData.commands?.length || 1

                const sourceUrl = config.info?.website || config.saluran?.link || 'https://whatsapp.com/channel/'

                const bodyText =
                    `${sourceUrl}\n\n` +
                    `${emoji} *${toMonoUpperBold(actionLabel)}*\n\n` +
                    `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ ᴘʟᴜɢɪɴ* 」\n` +
                    `┃ 📝 Nama      : *${pluginData.name}*\n` +
                    `┃ 📂 Path      : plugins/${pluginData.folder || 'other'}/${pluginData.name}.js\n` +
                    `┃ 🏷️ Kategori  : ${pluginData.category || pluginData.folder || 'other'}\n` +
                    `┃ ⌨️ Commands  : \`${cmdList}\` (${cmdCount})\n` +
                    `┃ 📊 Ukuran    : ${pluginData.size || 'N/A'} bytes\n` +
                    `┃ 🔄 Reload    : ${pluginData.reload ? '✅ Sukses' : '⚠️ Pending'}\n` +
                    `┃ ⚡ Aksi      : ${action}\n` +
                    `┃ ⏱️ Waktu     : ${time}\n` +
                    `┃ 👤 Oleh      : ${actorName}\n` +
                    `╰┈┈⬡\n\n` +
                    `_Ada masalah? Hubungi owner~ 💕_`

                let tinted = thumbBuffer
                if (thumbBuffer) {
                    try { tinted = await tintThumbnail(thumbBuffer, accentColor) } catch {}
                }

                // Upload thumbnail besar (untuk jpegThumbnail preview)
                let thumbMedia = null
                if (tinted) {
                    try {
                        thumbMedia = await prepareWAMessageMedia(
                            { image: tinted },
                            { upload: sock.waUploadToServer }
                        )
                    } catch {}
                }

                // Upload favicon kecil terpisah (mapping field imageMessage -> faviconMMSMetadata)
                let faviconObj = null
                if (thumbBuffer) {
                    try {
                        const sharp = require('sharp')
                        const faviconBuf = await sharp(thumbBuffer).resize(64, 64, { fit: 'cover' }).png().toBuffer()
                        const faviconMedia = await prepareWAMessageMedia(
                            { image: faviconBuf },
                            { upload: sock.waUploadToServer }
                        )
                        const im = faviconMedia?.imageMessage
                        if (im) {
                            faviconObj = {
                                thumbnailDirectPath: im.directPath,
                                thumbnailSha256: im.fileSha256,
                                thumbnailEncSha256: im.fileEncSha256,
                                mediaKey: im.mediaKey,
                                mediaKeyTimestamp: im.mediaKeyTimestamp,
                                thumbnailHeight: im.height,
                                thumbnailWidth: im.width
                            }
                        }
                    } catch {}
                }

                const extendedTextMessage = {
                    text: bodyText,
                    matchedText: sourceUrl,
                    canonicalUrl: sourceUrl,
                    title: `${emoji} ${actionLabel} — ${pluginData.name}`,
                    description: pluginData.category || pluginData.folder || 'other',
                    previewType: proto.Message.ExtendedTextMessage.PreviewType.VIDEO,
                    renderLargerThumbnail: true,
                    ...(thumbMedia?.imageMessage?.jpegThumbnail ? { jpegThumbnail: thumbMedia.imageMessage.jpegThumbnail } : {}),
                    ...(thumbMedia?.imageMessage ? {
                        mediaKey: thumbMedia.imageMessage.mediaKey,
                        mediaKeyTimestamp: thumbMedia.imageMessage.mediaKeyTimestamp,
                        thumbnailDirectPath: thumbMedia.imageMessage.directPath,
                        thumbnailSha256: thumbMedia.imageMessage.fileSha256,
                        thumbnailEncSha256: thumbMedia.imageMessage.fileEncSha256
                    } : {}),
                    ...(faviconObj ? { faviconMMSMetadata: faviconObj } : {}),
                    contextInfo: newsletterCtx
                }

                const msg = generateWAMessageFromContent(channelId, {
                    extendedTextMessage: proto.Message.ExtendedTextMessage.fromObject(extendedTextMessage)
                }, { userJid: channelId })

                await sock.relayMessage(channelId, msg.message, { messageId: msg.key.id })
                return
            } catch (e) { console.error('[setinfoplugin V2]', e) }
        }

        // ── V3: Carousel ──────────────────────────────────────────────────────
// ── V3: Stat Sheet — ringkasan gaya log, sekali lihat tanpa swipe ───────
        if (variant === 3) {
            try {
                const cmdList = pluginData.commands?.length
                    ? pluginData.commands.join(', ')
                    : pluginData.name

                const pad = (label) => label.padEnd(9, ' ')
                const sheetText =
                    '```' +
                    `${pad('NAME')}: ${pluginData.name}\n` +
                    `${pad('PATH')}: plugins/${pluginData.folder || 'other'}/${pluginData.name}.js\n` +
                    `${pad('CATEGORY')}: ${pluginData.category || pluginData.folder || 'other'}\n` +
                    `${pad('COMMANDS')}: ${cmdList}\n` +
                    `${pad('SIZE')}: ${pluginData.size || 'N/A'} bytes\n` +
                    `${pad('RELOAD')}: ${pluginData.reload ? 'ACTIVE' : 'PENDING'}\n` +
                    `${pad('ACTOR')}: ${actorName}\n` +
                    `${pad('TIME')}: ${time}` +
                    '```'

                const msg = generateWAMessageFromContent(channelId, {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                            interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                                body: proto.Message.InteractiveMessage.Body.fromObject({
                                    text: `${emoji} *${actionLabel}*\n\n${sheetText}`
                                }),
                                footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: botName }),
                                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({ buttons: [] }),
                                contextInfo: newsletterCtx
                            })
                        }
                    }
                }, { userJid: channelId })

                await sock.relayMessage(channelId, msg.message, { messageId: msg.key.id })
                return
            } catch (e) { console.error('[setinfoplugin V3]', e) }
        }

// ── V4: Hoshino Ai — Plugin Deployment Console (Premium) ────────────────
        if (variant === 4) {
            try {
                const { createCanvas, loadImage } = require('@napi-rs/canvas')
                const sharp = require('sharp')
                const https = require('https')

                const formatBytes = (bytes) => {
                    const n = Number(bytes)
                    if (!n || isNaN(n)) return 'N/A'
                    if (n < 1024) return `${n} B`
                    if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`
                    return `${(n / (1024 * 1024)).toFixed(2)} MB`
                }

                const makePluginId = () => {
                    const folder = String(pluginData.folder || 'other').toUpperCase().replace(/[^A-Z0-9]/g, '')
                    const name   = String(pluginData.name || 'plugin').toUpperCase().replace(/[^A-Z0-9]/g, '')
                    return `PLG-${folder}-${name}`
                }

                // ── Fetch owner PP with hard timeout so V4 never hangs offline ──
                async function getOwnerAvatarBuffer() {
                    return new Promise((resolve) => {
                        let settled = false
                        const done = (val) => { if (!settled) { settled = true; resolve(val) } }
                        const timeout = setTimeout(() => done(null), 3500)

                        ;(async () => {
                            try {
                                const ownerNum = [].concat(cfg?.owner?.number || [])[0]
                                if (!ownerNum) return done(null)
                                const ownerJid = String(ownerNum).includes('@') ? ownerNum : `${ownerNum}@s.whatsapp.net`
                                const ppUrl = await sock.profilePictureUrl(ownerJid, 'image').catch(() => null)
                                if (!ppUrl) return done(null)

                                const req = https.get(ppUrl, (res) => {
                                    const chunks = []
                                    res.on('data', (c) => chunks.push(c))
                                    res.on('end', () => { clearTimeout(timeout); done(Buffer.concat(chunks)) })
                                    res.on('error', () => done(null))
                                })
                                req.on('error', () => done(null))
                                req.setTimeout(3000, () => { req.destroy(); done(null) })
                            } catch {
                                done(null)
                            }
                        })()
                    })
                }

                function drawPlaceholderAvatar(ctx2, x, y, w, h, accent) {
                    const g = ctx2.createLinearGradient(x, y, x + w, y + h)
                    g.addColorStop(0, 'rgba(255,255,255,0.06)')
                    g.addColorStop(1, 'rgba(255,255,255,0.02)')
                    ctx2.fillStyle = g
                    ctx2.fillRect(x, y, w, h)
                    drawStar(ctx2, x + w / 2, y + h / 2, w * 0.22, w * 0.09, accent)
                }

                function drawProgressBar(ctx2, x, y, w, h, pct, accent) {
                    roundRect(ctx2, x, y, w, h, h / 2)
                    ctx2.fillStyle = 'rgba(255,255,255,0.06)'
                    ctx2.fill()
                    const fillW = Math.max(h, w * Math.min(1, Math.max(0, pct / 100)))
                    roundRect(ctx2, x, y, fillW, h, h / 2)
                    const g = ctx2.createLinearGradient(x, y, x + fillW, y)
                    g.addColorStop(0, accent)
                    g.addColorStop(1, accent + 'AA')
                    ctx2.fillStyle = g
                    ctx2.fill()
                }

                function drawHealthBar(ctx2, x, y, w, h, pct, accent, label) {
                    ctx2.fillStyle = 'rgba(255,255,255,0.5)'
                    ctx2.font = 'bold 10px sans-serif'
                    ctx2.fillText(label, x, y - 4)
                    roundRect(ctx2, x, y, w, h, h / 2)
                    ctx2.fillStyle = 'rgba(255,255,255,0.07)'
                    ctx2.fill()
                    const fillW = w * Math.min(1, Math.max(0, pct / 100))
                    if (fillW > 0) {
                        roundRect(ctx2, x, y, fillW, h, h / 2)
                        ctx2.fillStyle = accent
                        ctx2.fill()
                    }
                }

                const cmdList  = pluginData.commands?.length ? pluginData.commands.join(', ') : pluginData.name
                const cmdCount = pluginData.commands?.length || 1
                const isAdd    = action === 'ADD'
                const pct      = pluginData.reload ? 100 : 75

                const theme = isAdd
                    ? { accent: '#5EFFB0', accent2: '#00C896', bg2: 'rgba(94,255,176,0.10)',
                        badge: '✓  PLUGIN DEPLOYMENT SUCCESS', sub: 'PLUGIN REGISTERED TO HOSHINO AI CORE',
                        statusVal: 'SUCCESS', reloadDot: pluginData.reload ? 'COMPLETE' : 'PENDING',
                        timeline: ['FILE DETECTED', 'PLUGIN ANALYZED', 'COMMANDS REGISTERED', 'SYSTEM RELOAD', 'DEPLOYMENT COMPLETE'],
                        console: [
                            '[OK]   Scanning plugin directory...',
                            `[OK]   Plugin detected: ${pluginData.name}.js`,
                            '[OK]   Loading command registry...',
                            `[OK]   Commands registered: ${cmdList}`,
                            '[DONE] Operation completed'
                        ] }
                    : { accent: '#FF5C8A', accent2: '#D9365E', bg2: 'rgba(255,92,138,0.10)',
                        badge: '✕  PLUGIN REMOVAL COMPLETE', sub: 'PLUGIN SUCCESSFULLY REMOVED FROM CORE',
                        statusVal: 'DELETED', reloadDot: pluginData.reload ? 'COMPLETE' : 'PENDING',
                        timeline: ['PLUGIN LOCATED', 'COMMANDS UNREGISTERED', 'FILE REMOVED', 'SYSTEM RELOAD', 'REMOVAL COMPLETE'],
                        console: [
                            '[OK]   Scanning plugin directory...',
                            `[OK]   Plugin located: ${pluginData.name}.js`,
                            '[OK]   Unregistering commands...',
                            `[OK]   Commands removed: ${cmdList}`,
                            '[DONE] Operation completed'
                        ] }

                const W = 1200, H = 800
                const canvas = createCanvas(W, H)
                const ctx    = canvas.getContext('2d')

                // ══ Layer 1: base gradient ══
                const bg = ctx.createLinearGradient(0, 0, W, H)
                bg.addColorStop(0, '#0B0714')
                bg.addColorStop(0.5, '#160A2C')
                bg.addColorStop(1, '#050308')
                ctx.fillStyle = bg
                ctx.fillRect(0, 0, W, H)

                // ══ Layer 2: radial glow behind avatar ══
                const avatarGlow = ctx.createRadialGradient(180, 300, 20, 180, 300, 340)
                avatarGlow.addColorStop(0, 'rgba(150,110,255,0.14)')
                avatarGlow.addColorStop(1, 'rgba(0,0,0,0)')
                ctx.fillStyle = avatarGlow
                ctx.fillRect(0, 0, W, H)

                // ══ Layer 3: accent glow (action-based) ══
                const accentGlow = ctx.createRadialGradient(W - 260, 200, 20, W - 260, 200, 460)
                accentGlow.addColorStop(0, theme.accent + '1F')
                accentGlow.addColorStop(1, 'rgba(0,0,0,0)')
                ctx.fillStyle = accentGlow
                ctx.fillRect(0, 0, W, H)

                // ══ Layer 4: faint futuristic grid ══
                ctx.strokeStyle = 'rgba(255,255,255,0.025)'
                ctx.lineWidth = 1
                for (let gx = 0; gx <= W; gx += 60) {
                    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke()
                }
                for (let gy = 0; gy <= H; gy += 60) {
                    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke()
                }

                // ══ Layer 5: deterministic grain / particles ══
                for (let i = 0; i < 90; i++) {
                    const px = (i * 211 + 41) % W
                    const py = (i * 137 + 67) % H
                    const pr = 0.5 + (i % 3) * 0.35
                    ctx.beginPath()
                    ctx.arc(px, py, pr, 0, Math.PI * 2)
                    ctx.fillStyle = 'rgba(255,255,255,0.05)'
                    ctx.fill()
                }

                // ══ Layer 6: vignette ══
                const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85)
                vig.addColorStop(0, 'rgba(0,0,0,0)')
                vig.addColorStop(1, 'rgba(0,0,0,0.45)')
                ctx.fillStyle = vig
                ctx.fillRect(0, 0, W, H)

                // outer border
                roundRect(ctx, 6, 6, W - 12, H - 12, 26)
                ctx.strokeStyle = 'rgba(255,255,255,0.08)'
                ctx.lineWidth = 1.5
                ctx.stroke()

                // ══════════════════ HEADER ══════════════════
                drawStar(ctx, 46, 34, 11, 4.5, '#FFD700')
                ctx.fillStyle = '#FFD700'
                ctx.font = 'bold 20px sans-serif'
                ctx.fillText('HOSHINO AI', 64, 40)

                ctx.fillStyle = 'rgba(255,255,255,0.5)'
                ctx.font = 'bold 11px sans-serif'
                ctx.fillText('ADVANCED PLUGIN DEPLOYMENT SYSTEM', 64, 58)

                ctx.fillStyle = 'rgba(255,255,255,0.35)'
                ctx.font = '10px monospace'
                ctx.fillText('NODE: HSN-AI-01   •   SECURE SESSION: ACTIVE', 64, 74)

                // header right
                ctx.font = 'bold 12px sans-serif'
                const onlineLabel = '● SYSTEM ONLINE'
                ctx.fillStyle = '#5EFFB0'
                let tw = ctx.measureText(onlineLabel).width
                ctx.fillText(onlineLabel, W - 40 - tw, 38)

                ctx.font = '11px sans-serif'
                ctx.fillStyle = 'rgba(255,255,255,0.45)'
                const pmLabel = 'PLUGIN MANAGER v4.0'
                tw = ctx.measureText(pmLabel).width
                ctx.fillText(pmLabel, W - 40 - tw, 56)

                ctx.strokeStyle = 'rgba(255,255,255,0.12)'
                ctx.lineWidth = 1
                ctx.beginPath(); ctx.moveTo(36, 88); ctx.lineTo(W - 36, 88); ctx.stroke()

                // ══════════════════ LEFT: IDENTITY PANEL ══════════════════
                const lpX = 36, lpY = 100, lpW = 280, lpH = 460

                roundRect(ctx, lpX, lpY, lpW, lpH, 22)
                ctx.fillStyle = 'rgba(255,255,255,0.03)'
                ctx.fill()
                ctx.strokeStyle = 'rgba(255,255,255,0.09)'
                ctx.lineWidth = 1
                ctx.stroke()

                ctx.fillStyle = '#F5F3FF'
                ctx.font = 'bold 15px sans-serif'
                ctx.fillText('HOSHINO AI', lpX + 22, lpY + 30)
                ctx.fillStyle = 'rgba(255,255,255,0.4)'
                ctx.font = 'bold 10px sans-serif'
                ctx.fillText('SYSTEM IDENTITY', lpX + 22, lpY + 46)

                // avatar frame
                const avW = 176, avH = 176
                const avX = lpX + (lpW - avW) / 2
                const avY = lpY + 66

                roundRect(ctx, avX - 12, avY - 12, avW + 24, avH + 24, 24)
                ctx.fillStyle = 'rgba(255,255,255,0.025)'
                ctx.fill()

                roundRect(ctx, avX, avY, avW, avH, 18)
                ctx.strokeStyle = theme.accent
                ctx.lineWidth = 2.5
                ctx.stroke()
                roundRect(ctx, avX + 6, avY + 6, avW - 12, avH - 12, 13)
                ctx.strokeStyle = 'rgba(255,255,255,0.25)'
                ctx.lineWidth = 1
                ctx.stroke()

                let avatarSource = null
                try { avatarSource = await getOwnerAvatarBuffer() } catch { avatarSource = null }
                if (!avatarSource) avatarSource = thumbBuffer

                if (avatarSource) {
                    try {
                        const resized = await sharp(avatarSource).resize(avW - 16, avH - 16, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer()
                        const img = await loadImage(resized)
                        ctx.save()
                        roundRect(ctx, avX + 8, avY + 8, avW - 16, avH - 16, 11)
                        ctx.clip()
                        ctx.drawImage(img, avX + 8, avY + 8, avW - 16, avH - 16)
                        // subtle overlay gradient
                        const ov = ctx.createLinearGradient(avX, avY, avX, avY + avH)
                        ov.addColorStop(0, 'rgba(0,0,0,0)')
                        ov.addColorStop(1, 'rgba(0,0,0,0.25)')
                        ctx.fillStyle = ov
                        ctx.fillRect(avX, avY, avW, avH)
                        ctx.restore()
                    } catch {
                        drawPlaceholderAvatar(ctx, avX + 8, avY + 8, avW - 16, avH - 16, theme.accent)
                    }
                } else {
                    drawPlaceholderAvatar(ctx, avX + 8, avY + 8, avW - 16, avH - 16, theme.accent)
                }

                // corner decorations
                ctx.strokeStyle = theme.accent
                ctx.lineWidth = 3
                const cl = 16
                ;[[avX - 8, avY - 8, 1, 1], [avX + avW + 8, avY - 8, -1, 1],
                  [avX - 8, avY + avH + 8, 1, -1], [avX + avW + 8, avY + avH + 8, -1, -1]]
                    .forEach(([cx, cy, dx, dy]) => {
                        ctx.beginPath()
                        ctx.moveTo(cx, cy + cl * dy)
                        ctx.lineTo(cx, cy)
                        ctx.lineTo(cx + cl * dx, cy)
                        ctx.stroke()
                    })

                let ly = avY + avH + 34
                ctx.textAlign = 'center'
                const pillText = '● SYSTEM ONLINE'
                ctx.font = 'bold 11px sans-serif'
                const pillW = ctx.measureText(pillText).width + 26
                roundRect(ctx, lpX + lpW / 2 - pillW / 2, ly, pillW, 24, 12)
                ctx.fillStyle = 'rgba(94,255,176,0.12)'
                ctx.fill()
                ctx.strokeStyle = '#5EFFB0'
                ctx.lineWidth = 1
                ctx.stroke()
                ctx.fillStyle = '#5EFFB0'
                ctx.fillText(pillText, lpX + lpW / 2, ly + 16)
                ctx.textAlign = 'left'

                ly += 46
                ctx.fillStyle = 'rgba(255,255,255,0.4)'
                ctx.font = 'bold 10px sans-serif'
                ctx.fillText('AI CORE', lpX + 22, ly)
                ctx.fillStyle = '#F5F3FF'
                ctx.font = 'bold 14px monospace'
                ctx.fillText('HSN-CORE-01', lpX + 22, ly + 20)

                ly += 48
                ctx.fillStyle = 'rgba(255,255,255,0.4)'
                ctx.font = 'bold 10px sans-serif'
                ctx.fillText('OWNER', lpX + 22, ly)
                ctx.fillStyle = '#F5F3FF'
                ctx.font = 'bold 14px sans-serif'
                ctx.fillText(truncateText(ctx, actorName, lpW - 44), lpX + 22, ly + 20)

                // ══════════════════ RIGHT CONTENT ══════════════════
                const rx = lpX + lpW + 28
                const rw = W - 36 - rx

                // status badge
                roundRect(ctx, rx, 100, rw, 50, 12)
                ctx.fillStyle = theme.bg2
                ctx.fill()
                ctx.strokeStyle = theme.accent
                ctx.lineWidth = 1.5
                ctx.stroke()
                ctx.fillStyle = theme.accent
                ctx.font = 'bold 19px sans-serif'
                ctx.fillText(theme.badge, rx + 20, 130)

                // plugin name (with glow)
                ctx.save()
                ctx.shadowColor = theme.accent
                ctx.shadowBlur = 18
                ctx.fillStyle = '#F5F3FF'
                ctx.font = 'bold 46px sans-serif'
                ctx.fillText(truncateText(ctx, pluginData.name, rw), rx, 200)
                ctx.restore()

                ctx.fillStyle = theme.accent2
                ctx.font = 'bold 12px sans-serif'
                ctx.fillText(theme.sub, rx, 220)

                ctx.fillStyle = 'rgba(255,255,255,0.55)'
                ctx.font = '13px monospace'
                ctx.fillText(
                    truncateText(ctx, `plugins/${pluginData.folder || 'other'}/${pluginData.name}.js`, rw - 220),
                    rx, 242
                )
                ctx.fillStyle = 'rgba(255,255,255,0.4)'
                ctx.font = 'bold 11px sans-serif'
                const catLabel = `CATEGORY  ${(pluginData.category || pluginData.folder || 'OTHER').toUpperCase()}`
                const catW = ctx.measureText(catLabel).width
                ctx.fillText(catLabel, rx + rw - catW, 242)

                // stat cards
                const cardY = 258, cardH = 78, gap = 12
                const cardW = (rw - gap * 3) / 4

                drawInfoCard(ctx, rx, cardY, cardW, cardH, 'DEPLOYMENT', theme.statusVal, theme.accent)
                drawInfoCard(ctx, rx + (cardW + gap), cardY, cardW, cardH, 'FILE SIZE', formatBytes(pluginData.size), theme.accent)
                drawInfoCard(ctx, rx + (cardW + gap) * 2, cardY, cardW, cardH, 'COMMANDS', `${cmdCount} CMD`, theme.accent)
                drawInfoCard(ctx, rx + (cardW + gap) * 3, cardY, cardW, cardH, 'RELOAD', theme.reloadDot, theme.accent)

                // small dot-status under each card
                ctx.font = '9px sans-serif'
                ctx.fillStyle = theme.accent
                const dotLabels = [theme.statusVal === 'SUCCESS' || theme.statusVal === 'DELETED' ? '● COMPLETE' : '● PENDING', '● ANALYZED', '● REGISTERED', pluginData.reload ? '● ACTIVE' : '● WAITING']
                dotLabels.forEach((lbl, i) => {
                    ctx.fillStyle = theme.accent
                    ctx.fillText(lbl, rx + i * (cardW + gap) + 14, cardY + cardH - 10)
                })

                // ── Deployment / Removal timeline ──
                const tlY = cardY + cardH + 34
                ctx.fillStyle = 'rgba(255,255,255,0.45)'
                ctx.font = 'bold 11px sans-serif'
                ctx.fillText(isAdd ? 'DEPLOYMENT PROCESS' : 'REMOVAL PROCESS', rx, tlY)

                const steps = theme.timeline
                const stepY = tlY + 26
                const stepGap = rw / steps.length
                ctx.strokeStyle = theme.accent + '55'
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.moveTo(rx + stepGap / 2, stepY)
                ctx.lineTo(rx + rw - stepGap / 2, stepY)
                ctx.stroke()

                steps.forEach((step, i) => {
                    const cx = rx + stepGap * i + stepGap / 2
                    const isLast = i === steps.length - 1
                    ctx.beginPath()
                    ctx.arc(cx, stepY, isLast ? 6 : 5, 0, Math.PI * 2)
                    ctx.fillStyle = theme.accent
                    ctx.fill()
                    if (isLast) {
                        ctx.strokeStyle = theme.accent
                        ctx.lineWidth = 2
                        ctx.beginPath()
                        ctx.arc(cx, stepY, 10, 0, Math.PI * 2)
                        ctx.stroke()
                    }
                    ctx.fillStyle = 'rgba(255,255,255,0.6)'
                    ctx.font = '9px sans-serif'
                    ctx.textAlign = 'center'
                    ctx.fillText(truncateText(ctx, step, stepGap - 6), cx, stepY + 22)
                    ctx.textAlign = 'left'
                })

                // ── System console ──
                const conY = stepY + 40
                const conH = 110
                roundRect(ctx, rx, conY, rw, conH, 12)
                ctx.fillStyle = 'rgba(0,0,0,0.35)'
                ctx.fill()
                ctx.strokeStyle = 'rgba(255,255,255,0.1)'
                ctx.lineWidth = 1
                ctx.stroke()

                ctx.fillStyle = 'rgba(255,255,255,0.4)'
                ctx.font = 'bold 10px sans-serif'
                ctx.fillText('SYSTEM CONSOLE', rx + 16, conY + 18)
                ctx.strokeStyle = 'rgba(255,255,255,0.08)'
                ctx.beginPath(); ctx.moveTo(rx + 16, conY + 26); ctx.lineTo(rx + rw - 16, conY + 26); ctx.stroke()

                ctx.font = '12px monospace'
                theme.console.forEach((line, i) => {
                    const cy = conY + 44 + i * 15
                    const isDone = line.startsWith('[DONE]')
                    ctx.fillStyle = isDone ? theme.accent : 'rgba(255,255,255,0.7)'
                    let text = truncateText(ctx, line, rw - 60)
                    if (isDone) text += ' _'
                    ctx.fillText(text, rx + 16, cy)
                })

// ══════════════════ PROGRESS + HEALTH ROW ══════════════════
                const progY = lpY + lpH + 40
                ctx.fillStyle = 'rgba(255,255,255,0.45)'
                ctx.font = 'bold 11px sans-serif'
                ctx.fillText('DEPLOYMENT PROGRESS', 36, progY)

                const barX = 210, barW = 560, barH = 14
                drawProgressBar(ctx, barX, progY - 11, barW, barH, pct, theme.accent)
                ctx.fillStyle = theme.accent
                ctx.font = 'bold 12px sans-serif'
                ctx.fillText(`${pct}% ${pct === 100 ? 'COMPLETE' : 'WAITING RELOAD'}`, barX + barW + 16, progY)

                const healthX = barX + barW + 200
                ctx.fillStyle = 'rgba(255,255,255,0.4)'
                ctx.font = 'bold 10px sans-serif'
                ctx.fillText('SYSTEM HEALTH', healthX, progY - 36)
                drawHealthBar(ctx, healthX, progY - 8, 150, 6, 100, theme.accent, 'CORE')
                drawHealthBar(ctx, healthX, progY + 12, 150, 6, 100, theme.accent, 'REGISTRY')
                drawHealthBar(ctx, healthX, progY + 32, 150, 6, pct, theme.accent, 'RELOAD')

                // ══════════════════ METADATA STRIP ══════════════════
                const metaY = progY + 70
                ctx.strokeStyle = 'rgba(255,255,255,0.1)'
                ctx.lineWidth = 1
                ctx.beginPath(); ctx.moveTo(36, metaY - 16); ctx.lineTo(W - 36, metaY - 16); ctx.stroke()

                ctx.fillStyle = 'rgba(255,255,255,0.35)'
                ctx.font = 'bold 9px sans-serif'
                const metaFields = [
                    ['ID', makePluginId()],
                    ['CATEGORY', (pluginData.category || pluginData.folder || 'other').toUpperCase()],
                    ['COMMAND', truncateText(ctx, cmdList, 140)],
                    ['ACTOR', truncateText(ctx, actorName, 120)],
                    ['TIME', time]
                ]
                const metaColW = (W - 72) / metaFields.length
                metaFields.forEach(([label, val], i) => {
                    const mx = 36 + i * metaColW
                    ctx.fillStyle = 'rgba(255,255,255,0.35)'
                    ctx.font = 'bold 9px sans-serif'
                    ctx.fillText(label, mx, metaY)
                    ctx.fillStyle = '#F5F3FF'
                    ctx.font = '11px monospace'
                    ctx.fillText(truncateText(ctx, String(val), metaColW - 12), mx, metaY + 16)
                })

                // ══════════════════ FOOTER ══════════════════
                const footerLineY = metaY + 44
                ctx.strokeStyle = 'rgba(255,255,255,0.12)'
                ctx.lineWidth = 1
                ctx.beginPath(); ctx.moveTo(36, footerLineY); ctx.lineTo(W - 36, footerLineY); ctx.stroke()

                ctx.fillStyle = 'rgba(255,255,255,0.4)'
                ctx.font = 'bold 9px sans-serif'
                ctx.fillText('OPERATION BY', 36, footerLineY + 24)
                ctx.fillStyle = theme.accent2
                ctx.font = 'bold 13px sans-serif'
                ctx.fillText(truncateText(ctx, actorName, 260), 36, footerLineY + 40)

                ctx.textAlign = 'center'
                ctx.fillStyle = 'rgba(255,255,255,0.45)'
                ctx.font = '11px sans-serif'
                ctx.fillText(`${time}`, W / 2, footerLineY + 28)
                ctx.font = 'bold 10px sans-serif'
                ctx.fillStyle = 'rgba(255,255,255,0.3)'
                ctx.fillText('HOSHINO AI PLUGIN MANAGER', W / 2, footerLineY + 42)
                ctx.textAlign = 'left'

                ctx.textAlign = 'right'
                ctx.fillStyle = theme.accent
                ctx.font = 'bold 11px sans-serif'
                ctx.fillText('V4.0 • SECURE DEPLOYMENT INTERFACE', W - 36, footerLineY + 32)
                ctx.textAlign = 'left'

                const canvasBuffer = canvas.toBuffer('image/png')

                await sock.sendMessage(channelId, {
                    image: canvasBuffer,
                    caption,
                    contextInfo: newsletterCtx
                })
                return
            } catch (e) { console.error('[setinfoplugin V4]', e) }
        }

        // ── V5: GIF/video + bold Unicode caption ──────────────────────────────
        if (variant === 5) {
            try {

                const videoBuffer = hsAsset.has('video/hsnai') ? (await hsAsset.buffer('video/hsnai')) : thumbBuffer
                const captionBold = buildCaptionBold(emoji, actionLabel, action, pluginData, time, actorName)

                if (videoBuffer) {
                    await sock.sendMessage(channelId, {
                        video: videoBuffer,
                        caption: captionBold,
                        gifPlayback: true,
                        contextInfo: newsletterCtx
                    })
                } else {
                    await sock.sendMessage(channelId, { text: captionBold })
                }
                return
            } catch (e) { console.error('[setinfoplugin V5]', e) }
        }

        // ── Fallback ──────────────────────────────────────────────────────────
        await sock.sendMessage(channelId, { text: caption })

    } catch (e) {
        console.error('[setinfoplugin] ERROR:', e?.message || e)
    }
}

module.exports = {
    config: pluginConfig,
    handler,
    sendInfoPlugin
}