/**
 * canvas meledak
 * -----------------------------
 * type    : Plugins CJS (hsnai)
 * creator : Hilman
 * Sumber  : https://whatsapp.com/channel/0029VbAYjQgKrWQulDTYcg2K/1892
 * Penyesuaian: SeaPRST
 */

'use strict'

const { createCanvas, loadImage } = require('@napi-rs/canvas')

const pluginConfig = {
    name: 'meledak',
    alias: [],
    category: 'maker',
    description: 'Bikin gambar efek meledak dari foto / stiker',
    usage: '.meledak (kirim / reply gambar atau stiker)',
    example: '.meledak',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 2,
    isEnabled: true
}

const BACKGROUND_URL = 'https://raw.githubusercontent.com/himanackerman/Image/refs/heads/main/anu/10a1fe0d21270e01da6efa113c26203b.jpg'

async function removeBgNet(buffer) {
    const blob = new Blob([buffer], { type: 'image/png' })
    const form = new FormData()
    form.append('image', blob, 'image.png')
    form.append('format', 'png')
    form.append('model', 'v1')

    const res = await fetch('https://api2.pixelcut.app/image/matte/v1', {
        method: 'POST',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'x-client-version': 'web:pixa.com:4a5b0af2'
        },
        body: form
    })

    if (!res.ok) throw new Error(`Status ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
}

async function handler(m, { sock }) {
    const quotedType = m.quoted?.type
    const isValid =
        m.isImage ||
        m.type === 'stickerMessage' ||
        quotedType === 'imageMessage' ||
        quotedType === 'stickerMessage'

    if (!isValid) {
        return m.reply(
            `📦 *ᴍᴇʟᴇᴅᴀᴋ* 💥\n\n` +
            `> Ai butuh gambar atau stiker dulu dong~ ✨\n\n` +
            `> Kirim atau reply gambar/stiker dengan ${m.prefix}meledak`
        )
    }

    await m.react('🕒')

    try {
        let mediaBuffer
        if (m.quoted?.isMedia) {
            mediaBuffer = await m.quoted.download()
        } else if (m.isMedia) {
            mediaBuffer = await m.download()
        }
        if (!mediaBuffer) throw new Error('Gagal mengunduh gambar/stiker.')

        // Hapus background; kalau API gagal, pakai gambar asli
        let transparentBuffer
        try {
            transparentBuffer = await removeBgNet(mediaBuffer)
        } catch {
            transparentBuffer = mediaBuffer
        }

        const targetImg = await loadImage(transparentBuffer)

        let bgImg
        try {
            const bgRes = await fetch(BACKGROUND_URL)
            if (!bgRes.ok) throw new Error(`Status ${bgRes.status}`)
            bgImg = await loadImage(Buffer.from(await bgRes.arrayBuffer()))
        } catch {
            throw new Error('Gagal memuat mentahan background.')
        }

        const canvasWidth = bgImg.width
        const canvasHeight = bgImg.height

        const canvas = createCanvas(canvasWidth, canvasHeight)
        const ctx = canvas.getContext('2d')

        ctx.drawImage(bgImg, 0, 0, canvasWidth, canvasHeight)

        const isPortrait = targetImg.height > targetImg.width
        let scale = isPortrait
            ? canvasHeight / targetImg.height
            : (canvasWidth * 0.75) / targetImg.width

        let fgWidth = targetImg.width * scale
        let fgHeight = targetImg.height * scale

        if (fgWidth > canvasWidth * 0.85) {
            scale = (canvasWidth * 0.85) / targetImg.width
            fgWidth = targetImg.width * scale
            fgHeight = targetImg.height * scale
        }

        const fgX = canvasWidth - fgWidth
        const fgY = canvasHeight - fgHeight

        ctx.drawImage(targetImg, fgX, fgY, fgWidth, fgHeight)

        const buffer = canvas.toBuffer('image/png')

        await sock.sendMessage(m.chat, { image: buffer }, { quoted: m })
        await m.react('💥')
    } catch (error) {
        console.error('[meledak] Error:', error)
        await m.react('❌')
        return m.reply(
            `❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ*\n\n` +
            `> ${error?.message || 'Unknown error'}\n\n` +
            `> Coba lagi ya, Ai janji next take bakal lebih bagus~`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}