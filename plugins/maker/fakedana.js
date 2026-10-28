const hsAsset = require('../../src/lib/assets')
const { Canvas, loadImage, FontLibrary } = require('skia-canvas')
const config = require('../../config')

// font diambil dari config.assets.fonts.Epep
let _fontReady = false
async function ensureFont() {
    if (_fontReady) return
    FontLibrary.use('CartoonVibes', await hsAsset.file('fonts/Epep'))
    _fontReady = true
}

async function generate(angka) {
    await ensureFont()

    const bg = await loadImage(
        'https://raw.githubusercontent.com/uploader762/dat3/main/uploads/9c18e0-1772932032348.jpg'
    )

    const logo = await loadImage(
        'https://raw.githubusercontent.com/uploader762/dat3/main/uploads/d0f081-1772929197100.png'
    )

    const canvas = new Canvas(bg.width, bg.height)
    const ctx = canvas.getContext('2d')

    ctx.drawImage(bg, 0, 0)

    ctx.font = '205px CartoonVibes'
    ctx.fillStyle = 'white'
    ctx.textBaseline = 'top'

    const x = 664
    const y = 293

    ctx.fillText(angka, x, y)

    const textWidth = ctx.measureText(angka).width

    const logoX = x + textWidth + 11
    const logoY = y - 31

    ctx.drawImage(
        logo,
        logoX,
        logoY,
        370,
        370
    )

    return await canvas.toBuffer('png')
}

const pluginConfig = {
    name: 'fakedana',
    alias: ['danafake'],
    category: 'maker',
    description: 'Fake saldo dana',
    usage: '.fakedana 10000',
    example: '.fakedana 10000',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {

    try {

        const body =
            m.body ||
            m.text ||
            m.message?.conversation ||
            ''

        const input = body.trim().split(' ').slice(1).join(' ')

        if (!input) {
            return await m.reply(
                `╭━━━━━━━━━━━━━━━━╮\n` +
                `  ⭐ *ꜰᴀᴋᴇ ᴅᴀɴᴀ* ⭐\n` +
                `╰━━━━━━━━━━━━━━━━╯\n\n` +
                `✦ *Usage*  : \`${pluginConfig.usage}\`\n` +
                `✦ *Contoh* : \`${pluginConfig.example}\`\n\n` +
                `> _Masukkan nominal saldo ya~ 🌸_`
            )
        }

        if (isNaN(input.replace(/[^0-9]/g, ''))) {
            return await m.reply(
                `╭━━━━━━━━━━━━━━━━╮\n` +
                `  ⭐ *ꜰᴀᴋᴇ ᴅᴀɴᴀ* ⭐\n` +
                `╰━━━━━━━━━━━━━━━━╯\n\n` +
                `✦ *Status* : ❌ Gagal\n` +
                `✦ *Error*  : Nominal harus angka\n\n` +
                `> _Coba lagi nanti ya~ 🌸_`
            )
        }

        const saldo = Number(
            input.replace(/[^0-9]/g, '')
        ).toLocaleString('id-ID')

        const image = await generate(saldo)

        await sock.sendMessage(
            m.chat,
            {
                image,
                caption:
                    `╭━━━━━━━━━━━━━━━━╮\n` +
                    `  ⭐ *ꜰᴀᴋᴇ ᴅᴀɴᴀ* ⭐\n` +
                    `╰━━━━━━━━━━━━━━━━╯\n\n` +
                    `✦ *Saldo* : Rp ${saldo}\n` +
                    `✦ *Req by* : @${m.sender.split('@')[0]}\n\n` +
                    `> _「 ᴀᴋᴜ ᴀᴅᴀʟᴀʜ ɪᴅᴏʟ ᴛᴇʀʙᴇsᴀʀ ᴅɪ ᴅᴜɴɪᴀ 」_`,
                mentions: [m.sender]
            },
            { quoted: m }
        )

        await m.react('⭐')

    } catch (error) {

        console.error('FakeDana Error:', error)
        await m.react('❌')
        await m.reply(
            `╭━━━━━━━━━━━━━━━━╮\n` +
            `  ⭐ *ꜰᴀᴋᴇ ᴅᴀɴᴀ* ⭐\n` +
            `╰━━━━━━━━━━━━━━━━╯\n\n` +
            `✦ *Status* : ❌ Gagal\n` +
            `✦ *Error*  : ${error.message}\n\n` +
            `> _Coba lagi nanti ya~ 🌸_`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}