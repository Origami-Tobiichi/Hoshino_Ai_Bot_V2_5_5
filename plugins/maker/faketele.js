/**
‎✧ Name    : faketele
‎✧ Category: maker
‎✧ Original: Rin imup (canvas base)
‎✧ Note    : Jangan hapus watermark canvas, susah bikinnya
**/

const hsAsset = require('../../src/lib/assets')
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas')
const { writeFile, mkdir, readFile } = require('node:fs/promises')
const { existsSync, unlinkSync } = require('node:fs')
const { join } = require('node:path')
const axios = require('axios')
const config = require('../../config')

let fontBufferCache = null
let fontRegistered = false
const FONT_NAME = 'TeleRobotoMono'

const pluginConfig = {
    name: 'faketele',
    alias: ['faketelegram'],
    category: 'maker',
    description: 'Bikin fake profile Telegram dari foto + data yang di-reply',
    usage: '.faketele <Nama | Nomor HP | Bio | Username> (reply foto)',
    example: '.faketele Ai Hoshino | +81 90-1234-5678 | Idol lagi debut~ | hoshino_ai',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 3,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.text?.trim()
    const isImage = m.quoted && m.quoted.type === 'imageMessage'

    if (!isImage) {
        return m.reply(
            `📦 *ғᴀᴋᴇ ᴛᴇʟᴇɢʀᴀᴍ ᴘʀᴏғɪʟᴇ* 🎤\n\n` +
            `> \`${m.prefix}faketele Nama | Nomor HP | Bio | Username\` (reply gambar)\n\n` +
            `╭┈┈⬡「 💡 ɪɴꜰᴏ 」\n` +
            `┃ Reply foto yang mau dijadiin PP dulu ya~\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> ${m.prefix}faketele Ai Hoshino | +81 90-1234-5678 | Idol lagi debut~ | hoshino_ai`
        )
    }

    if (!text) {
        return m.reply(
            `📦 *ғᴀᴋᴇ ᴛᴇʟᴇɢʀᴀᴍ ᴘʀᴏғɪʟᴇ* 🎤\n\n` +
            `> Teksnya kosong dong~ ✨\n\n` +
            `> ${m.prefix}faketele <Nama | Nomor HP | Bio | Username>`
        )
    }

    const [namaInput, ponselInput, bioInput, userInput] = text.split('|').map(v => v ? v.trim() : '')

    if (!namaInput || !ponselInput || !bioInput || !userInput) {
        return m.reply(
            `❌ *sᴇᴍᴜᴀ ɪɴᴘᴜᴛ ᴡᴀᴊɪʙ ᴅɪɪsɪ!*\n\n` +
            `Format lengkap:\n${m.prefix}faketele Nama | Nomor HP | Bio | Username`
        )
    }

    m.react('🕕')

    try {
        if (!m.quoted?.isMedia) throw new Error('Gagal baca media dari pesan yang di-reply')
        const ppBuffer = await m.quoted.download()

        const TMP_DIR = join(process.cwd(), 'tmp')

        const TTF_URL = 'https://cdn.jsdelivr.net/fontsource/fonts/roboto-mono@latest/latin-700-normal.ttf'
        const BG_URL = 'https://raw.githubusercontent.com/ryyntwx/Image-rinn/refs/heads/main/c8ac4ffc-618c-411c-b36c-45c06c7e5a5e.png'

        await mkdir(TMP_DIR, { recursive: true })

        if (!fontRegistered) {
            try {
                if (!fontBufferCache) {
                    const fontRes = await axios.get(TTF_URL, {
                        responseType: 'arraybuffer',
                        headers: { 'User-Agent': 'Mozilla/5.0' }
                    })
                    fontBufferCache = Buffer.from(fontRes.data)
                }
                fontRegistered = GlobalFonts.register(fontBufferCache, FONT_NAME)
            } catch (errFont) {
                console.error('[faketele] Gagal load font, pakai fallback system font:', errFont.message)
            }
        }

        const fontFamily = fontRegistered ? FONT_NAME : 'sans-serif'

        // URL dari config.assets.faketele.bg_tele (kalau kosong, pakai URL bawaan)
        const BG_LOCAL = await hsAsset.file('faketele/bg_tele', BG_URL)

        const bgImg = await loadImage(BG_LOCAL)
        const ppImg = await loadImage(ppBuffer)

        const canvas = createCanvas(bgImg.width, bgImg.height)
        const ctx = canvas.getContext('2d')
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height)

        const nama = namaInput
        const ponsel = ponselInput
        const bio = bioInput
        const username = userInput.startsWith('@') ? userInput : '@' + userInput

        const layout = {
            pp: { x: 571, y: 244, r: 137 },
            nama: { y: 448, size: 50 },
            ponsel: { x: 80, y: 883, size: 35 },
            bio: { x: 83, y: 996, size: 36 },
            username: { x: 83, y: 1143, size: 38 }
        }

        // PP bulat
        ctx.save()
        ctx.beginPath()
        ctx.arc(layout.pp.x, layout.pp.y, layout.pp.r, 0, Math.PI * 2, true)
        ctx.closePath()
        ctx.clip()
        ctx.drawImage(ppImg, layout.pp.x - layout.pp.r, layout.pp.y - layout.pp.r, layout.pp.r * 2, layout.pp.r * 2)
        ctx.restore()

        // Nama
        ctx.fillStyle = '#FFFFFF'
        ctx.font = `bold ${layout.nama.size}px ${fontFamily}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(nama, canvas.width / 2, layout.nama.y)

        // Nomor HP
        ctx.textAlign = 'left'
        ctx.font = `${layout.ponsel.size}px ${fontFamily}`
        ctx.fillText(ponsel, layout.ponsel.x, layout.ponsel.y)

        // Bio
        ctx.font = `${layout.bio.size}px ${fontFamily}`
        ctx.fillText(bio, layout.bio.x, layout.bio.y)

        // Username
        ctx.font = `${layout.username.size}px ${fontFamily}`
        ctx.fillText(username, layout.username.x, layout.username.y)

        const outPath = join(TMP_DIR, `faketele-${Date.now()}.png`)
        await writeFile(outPath, await canvas.encode('png'))

        const outBuffer = await readFile(outPath)

        m.react('✅')
        await sock.sendMessage(m.chat, {
            image: outBuffer,
            caption:
                `— *FAKE TELEGRAM PROFILE* —\n\n` +
                `👤 *Nama:* ${nama}\n` +
                `📞 *Ponsel:* ${ponsel}\n` +
                `📝 *Bio:* ${bio}\n` +
                `🏷️ *User:* ${username}`
        }, { quoted: m })

        if (existsSync(outPath)) unlinkSync(outPath)
    } catch (error) {
        console.log('[faketele] Error:', error.message)
        m.react('❌')
        return m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}