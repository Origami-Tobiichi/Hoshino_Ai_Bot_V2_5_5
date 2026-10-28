/**
‎✧ Name   : Note ig
‎✧ Creator   : Hoshino Ai lucu🤤
‎✧ Category : Canvas
‎✧ sumber : https://whatsapp.com/channel/0029Vb6EHtR5Ui2gHMW9zX2x
‎✧ Note : Jangan hapus wm ya beb, max 7 kata buat notenya
**/

const hsAsset = require('../../src/lib/assets')
const axios = require('axios')
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas')
const { writeFile, mkdir } = require('node:fs/promises')
const { existsSync } = require('node:fs')
const { join } = require('node:path')
const config = require('../../config')

const pluginConfig = {
    name: 'noteig',
    alias: ['noteinstagram', 'ignote', 'catatanig', 'catataninstagram'],
    category: 'maker',
    description: 'Bikin Instagram Note dari foto profil/foto reply',
    usage: '.noteig <nama>|<catatan>|<waktu>',
    example: '.noteig Hoshino Ai|Aku Ingin Keduanya|3m',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const BG_URL = 'https://raw.githubusercontent.com/ryyntwx/allimagerin/refs/heads/main/bf3903f6-ae57-4d75-96a4-5c2e00c441c1.png'
const DEFAULT_AVATAR = 'https://i.ibb.co/4pDNDk1/avatar.png'

async function handler(m, { sock }) {
    const text = m.text

    if (!text) {
        return m.reply(
            `📝 *ɪɴsᴛᴀɢʀᴀᴍ ɴᴏᴛᴇ ᴍᴀᴋᴇʀ*\n\n` +
            `> \`${m.prefix}noteig <nama>|<catatan>|<waktu>\`\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> \`${m.prefix}noteig Hoshino Ai|Aku Ingin Keduanya|3m\`\n\n` +
            `╭┈┈⬡「 ⚠️ ɪɴꜰᴏ 」\n` +
            `┃ Catatan maks. 7 kata\n` +
            `┃ Reply foto = pake foto itu\n` +
            `┃ Gak reply = pake foto profil kamu\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }

    const [userPayload, notePayload, timePayload] = text.split('|')
    const username = userPayload ? userPayload.trim() : 'Hoshino Ai'
    const noteText = notePayload ? notePayload.trim() : 'Aku Ingin Keduanya'
    const timeStr = timePayload ? timePayload.trim() : '3m'

    await m.react('🕐')

    try {
        const TMP_DIR = join(process.cwd(), 'tmp')

        await mkdir(TMP_DIR, { recursive: true })

        const INTER_FONTS = [
            { url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2', key: 'ignotes/Inter-Medium' },
            { url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2', key: 'ignotes/Inter-SemiBold' }
        ]

        for (const font of INTER_FONTS) {
            // URL dari config.assets.ignotes (kalau kosong, pakai URL bawaan)
            const fontPath = await hsAsset.file(font.key, font.url)
            GlobalFonts.registerFromPath(fontPath, 'InterCustom')
        }

        const BG_LOCAL = await hsAsset.file('ignotes/template', BG_URL)

        let ppBuffer
        const isImage = m.quoted?.type === 'imageMessage' || m.isImage

        if (isImage) {
            const q = m.quoted?.isMedia ? m.quoted : (m.isMedia ? m : null)
            if (q) ppBuffer = await q.download()
        }

        if (!ppBuffer) {
            try {
                const ppUrl = await sock.profilePictureUrl(m.sender, 'image')
                const ppRes = await axios.get(ppUrl, { responseType: 'arraybuffer' })
                ppBuffer = Buffer.from(ppRes.data)
            } catch {
                const ppRes = await axios.get(DEFAULT_AVATAR, { responseType: 'arraybuffer' })
                ppBuffer = Buffer.from(ppRes.data)
            }
        }

        const canvas = createCanvas(1080, 1920)
        const ctx = canvas.getContext('2d')

        const bgImg = await loadImage(BG_LOCAL)
        ctx.drawImage(bgImg, 0, 0, 1080, 1920)
        const ppImg = await loadImage(ppBuffer)

        const ppX = 310, ppY = 779, ppRadius = 75
        const userX = 534, userY = 624, userSize = 36
        const cardX = 384, cardY = 777, baseTextSize = 40
        const msgX = 78, msgY = 1011, msgSize = 46
        const fontName = 'InterCustom'

        ctx.save()
        ctx.beginPath()
        ctx.arc(ppX, ppY, ppRadius, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(ppImg, ppX - ppRadius, ppY - ppRadius, ppRadius * 2, ppRadius * 2)
        ctx.restore()

        ctx.fillStyle = '#ffffff'
        ctx.font = `600 ${userSize}px ${fontName}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${username}  ·  ${timeStr}`, userX, userY)

        let displayNoteText = noteText
        const words = displayNoteText.trim().split(/\s+/).filter(Boolean)
        if (words.length > 7) {
            displayNoteText = 'max'
        }

        ctx.font = `500 ${baseTextSize}px ${fontName}`
        const textMetrics = ctx.measureText(displayNoteText).width
        const paddingX = 32
        const paddingY = 20
        const bubbleW = textMetrics + (paddingX * 2)
        const bubbleH = baseTextSize + (paddingY * 2)
        const radius = bubbleH / 2

        ctx.fillStyle = '#434954'
        ctx.beginPath()
        ctx.roundRect(cardX, cardY - (bubbleH / 2), bubbleW, bubbleH, radius)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(cardX - 6, cardY + 2, 14, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(displayNoteText, cardX + paddingX, cardY)

        ctx.fillStyle = '#727272'
        ctx.font = `500 ${msgSize}px ${fontName}`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(`Message ${username}`, msgX, msgY)

        const outPath = join(TMP_DIR, `ignote-${Date.now()}.png`)
        await writeFile(outPath, await canvas.encode('png'))

        await sock.sendMessage(m.chat, {
            image: { url: outPath },
            caption: `📝 *ɪɴsᴛᴀɢʀᴀᴍ ɴᴏᴛᴇ ʙᴇʀʜᴀsɪʟ* ✨`
        }, { quoted: m })

        await m.react('✅')

    } catch (err) {
        console.error(err)
        await m.react('❌')
        return m.reply(
            `❌ *ɢᴀɢᴀʟ*\n\n` +
            `> ${err.message}\n\n` +
            `╭┈┈⬡「 ⚠️ ɪɴꜰᴏ 」\n` +
            `┃ Coba lagi atau ganti foto\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}