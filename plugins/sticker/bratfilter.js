/**
 * ✧ Name    : bratfilter
 * ✧ Category: sticker
 */

const { createCanvas, loadImage } = require('@napi-rs/canvas')
const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: 'bratfilter',
    alias: ['bfilter', 'bf', 'bratf', 'filterbrat'],
    category: 'sticker',
    description: 'Sticker anime dengan 3 kotak teks',
    usage: '.bratfilter <atas>|<kiri>|<kanan>',
    example: '.bratfilter Hoshino Ai|skip|claim',
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const bgUrls = [
    'https://files.catbox.moe/hsgwxy.jpg',
    'https://u.pone.rs/qayepuhq.jpg',
    'https://kappa.lol/M0ua4i',
    'https://qu.ax/O6Tuy',
    'https://leopard.hosting.pecon.us/dl/bovsb/file.jpg',
    'https://cdn.nekohime.site/file/z8vkunk0.jpg',
    'https://a.top4top.io/p_3842t21fp0.jpg',
    'https://www.upload.ee/image/19522813/file.jpg',
    'https://c.termai.cc/i109/DrXzYj.png',
    'https://litter.catbox.moe/hb9amj.jpg',
    'https://h.uguu.se/ghFActZB.jpg',
    'https://tmpfiles.org/dl/wEw53frihHJy/file.jpg'
]

async function loadBackground() {
    for (const url of bgUrls) {
        try {
            const { data } = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 8000
            })

            return await loadImage(Buffer.from(data))
        } catch (e) {
            console.warn('[bratfilter]', url, 'gagal')
        }
    }

    throw new Error('Semua server gambar gagal dimuat.')
}

function wrapText(ctx, text, maxWidth) {
    const words = text.split(/\s+/)
    const lines = []
    let currentLine = ''

    for (const word of words) {

        // Kalau satu kata saja sudah kepanjangan
        if (ctx.measureText(word).width > maxWidth) {

            if (currentLine) {
                lines.push(currentLine)
                currentLine = ''
            }

            let part = ''

            for (const ch of word) {
                const test = part + ch

                if (ctx.measureText(test).width > maxWidth) {
                    lines.push(part)
                    part = ch
                } else {
                    part = test
                }
            }

            currentLine = part
            continue
        }

        const test = currentLine
            ? currentLine + ' ' + word
            : word

        if (ctx.measureText(test).width > maxWidth && currentLine) {
            lines.push(currentLine)
            currentLine = word
        } else {
            currentLine = test
        }
    }

    if (currentLine)
        lines.push(currentLine)

    return lines
}

function fitFont(ctx, text, width, height) {

    let size = 110
    let lines = []

    while (size >= 16) {

        ctx.font = `bold ${size}px Arial`

        lines = wrapText(
            ctx,
            text,
            width - 24
        )

        const lineHeight = size * 1.2

        if (lines.length * lineHeight <= height - 24)
            break

        size -= 2
    }

    return {
        size,
        lines
    }
}

async function handler(m, { sock }) {

    const text = m.args.join(' ')

    if (!text) {
        return m.reply(
`🎀 *ʙʀᴀᴛғɪʟᴛᴇʀ*

> Format:
${m.prefix}bratfilter atas|kiri|kanan

Contoh:
${m.prefix}bratfilter Hoshino Ai|skip|claim`
        )
    }

    await m.react('🕕')

    try {

        const bg = await loadBackground()

        const canvas = createCanvas(1093, 1080)
const ctx = canvas.getContext('2d')

ctx.drawImage(bg, 0, 0, 1093, 1080)

        const [atas = '', kiri = '', kanan = ''] =
            text.split('|').map(v => v.trim())

        const boxTop = {
            x: 546.50,
            y: 142.46,
            w: 606,
            h: 259,
            rotation: 0
        }

        const boxLeft = {
            x: 332.74,
            y: 432.96,
            w: 339,
            h: 162,
            rotation: 0
        }

        const boxRight = {
            x: 891.24,
            y: 508.76,
            w: 371.7,
            h: 277.4,
            rotation: 21
        }
        
function drawText(box, text, customFit = null) {

    ctx.save()

ctx.translate(box.x, box.y)

if (box.rotation)
    ctx.rotate(box.rotation * Math.PI / 180)

if (box.rotation)
    ctx.translate(0, -8)

    const paddingX = 35
const paddingY = 30

    const fit = customFit || fitFont(
    ctx,
    text,
    box.w - paddingX * 2,
    box.h - paddingY * 2
)

    ctx.font = `bold ${fit.size}px Arial`
    ctx.fillStyle = '#000000'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const lineHeight = fit.size * 1.05
    const totalHeight = fit.lines.length * lineHeight

    let y = -totalHeight / 2 + lineHeight / 2

    for (const line of fit.lines) {
        ctx.fillText(line, 0, y)
        y += lineHeight
    }

    ctx.restore()
}

        const paddingX = 35
const paddingY = 30

// Hitung font untuk kiri & kanan
const leftFit = fitFont(
    ctx,
    kiri,
    boxLeft.w - paddingX * 2,
    boxLeft.h - paddingY * 2
)

const rightFit = fitFont(
    ctx,
    kanan,
    boxRight.w - paddingX * 2,
    boxRight.h - paddingY * 2
)

// Pakai ukuran font yang sama
const sideFontSize = Math.min(leftFit.size, rightFit.size)

// Kotak atas tetap otomatis
drawText(boxTop, atas)

// Override ukuran font kiri & kanan
leftFit.size = sideFontSize
rightFit.size = sideFontSize

drawText(boxLeft, kiri, leftFit)
drawText(boxRight, kanan, rightFit)

        const buffer = canvas.toBuffer('image/jpeg', {
    quality: 95
})

        await sock.sendImageAsSticker(
            m.chat,
            buffer,
            m,
            {
                packname: config.sticker.packname,
                author: config.sticker.author
            }
        )

        await m.react('✅')

    } catch (err) {

        console.error(err)

        await m.react('❌')

        m.reply(
            '❌ Gagal membuat sticker.\n\n> ' +
            err.message
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}