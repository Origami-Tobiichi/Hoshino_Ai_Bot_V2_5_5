/**
‎✧ Name    : dictreveal
‎✧ Category: maker
‎✧ Note    : Dictionary "pretty" reveal meme, canvas-based
‎✧ Owner   : SeaPRST
‎✧ Bot     : Hoshino Ai
‎✧ Dev Team: HSNAI™
**/

const { createCanvas, loadImage } = require('@napi-rs/canvas')
const fetch = require('node-fetch')

const pluginConfig = {
    name: 'dictreveal',
    alias: ['dictmeme', 'defmeme', 'kamusmeme', 'wordreveal'],
    category: 'maker',
    description: 'Bikin meme dictionary "pretty" dengan gambar custom di lingkaran',
    usage: '.dictreveal (reply gambar)',
    example: '.dictreveal',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

const TEMPLATE = 'https://raw.githubusercontent.com/fiturmediafire-beep/Hsn-ai-Tourl/main/uploads/1784901940623-6eb07dc9.jpg'
const CENTER_X = 861.65
const CENTER_Y = 345
const SIZE = 618
const RADIUS = SIZE / 2

async function bufferFromUrl(url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Gagal fetch template')
    return Buffer.from(await res.arrayBuffer())
}

async function handler(m, { sock }) {
    const isImage = m.isImage || (m.quoted && m.quoted.type === 'imageMessage')

    if (!isImage) {
        return m.reply(
            `📦 *ᴅɪᴄᴛʀᴇᴠᴇᴀʟ ᴘʟᴜɢɪɴ* 🖼️\n\n` +
            `> Reply gambar dulu ya~ ✨\n\n` +
            `> ${m.prefix}dictreveal\n\n` +
            `*ᴄᴀʀᴀ ᴘᴀᴋᴀɪ:*\n` +
            `> Reply foto lalu ketik ${m.prefix}dictreveal`
        )
    }

    await m.react('🕕')

    try {
        let imgBuffer
        if (m.quoted?.isMedia) {
            imgBuffer = await m.quoted.download()
        } else if (m.isMedia) {
            imgBuffer = await m.download()
        }

        if (!imgBuffer) throw new Error('Gagal mengambil gambar')

        const template = await loadImage(await bufferFromUrl(TEMPLATE))
        const avatar = await loadImage(imgBuffer)

        const canvas = createCanvas(template.width, template.height)
        const ctx = canvas.getContext('2d')

        ctx.drawImage(template, 0, 0)

        ctx.save()
        ctx.beginPath()
        ctx.arc(CENTER_X, CENTER_Y, RADIUS, 0, Math.PI * 2)
        ctx.closePath()
        ctx.clip()

        const sw = avatar.width
        const sh = avatar.height
        let sx = 0, sy = 0
        const sSize = Math.min(sw, sh)

        if (sw > sh) {
            sx = (sw - sh) / 2
        } else {
            sy = (sh - sw) / 2
        }

        ctx.drawImage(
            avatar,
            sx, sy, sSize, sSize,
            CENTER_X - RADIUS, CENTER_Y - RADIUS,
            SIZE, SIZE
        )

        ctx.restore()

        const buffer = await canvas.encode('png')

        await sock.sendMessage(
            m.chat,
            { image: buffer, caption: `✅ *ᴅɪᴄᴛʀᴇᴠᴇᴀʟ ᴅᴏɴᴇ~* 🖼️✨` },
            { quoted: m }
        )
        await m.react('✅')

    } catch (error) {
        console.error('[dictreveal] Error:', error)
        await m.react('❌')
        return m.reply(`❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ*\n\n> ${error.message}\n\n> Coba lagi ya~`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}