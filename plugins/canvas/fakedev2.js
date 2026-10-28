const hsAsset = require('../../src/lib/assets')
const {
    createCanvas,
    loadImage,
    GlobalFonts
} = require('@napi-rs/canvas')

const axios = require('axios')

const pluginConfig = {
    name: 'fakedev2',
    alias: ['devmaker2', 'hoshinodev2'],
    category: 'canvas',
    description: 'Membuat fake developer profile style Hoshino Ai',
    usage: '.fakedev2 <nama>',
    example: '.fakedev2 Hoshino Ai',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

// FONT (diambil dari config.assets.fonts.Epep)
let _epepReady = false
async function ensureFont() {
    if (_epepReady) return
    try {
        const fontPath = await hsAsset.tryFile('fonts/Epep')
        if (fontPath) {
            GlobalFonts.registerFromPath(fontPath, 'Epep')
            _epepReady = true
        }
    } catch (e) {
        console.log('Font Error:', e)
    }
}

async function loadImageSafe(url) {
    try {
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 15000
        })
        return await loadImage(res.data)
    } catch {
        return null
    }
}

async function handler(m, { sock }) {
    await ensureFont()

    try {

        const body =
            m.body ||
            m.text ||
            ''

        const name =
            body
                .trim()
                .split(' ')
                .slice(1)
                .join(' ')

        if (!name) {
            return m.reply(
                `╭━━━━━━━━━━━━━━━━╮\n` +
                `  ⭐ *ꜰᴀᴋᴇ ᴅᴇᴠ* ⭐\n` +
                `╰━━━━━━━━━━━━━━━━╯\n\n` +
                `✦ *Usage*  : \`${pluginConfig.usage}\`\n` +
                `✦ *Contoh* : \`${pluginConfig.example}\`\n\n` +
                `> _Reply gambar untuk custom foto profil_`
            )
        }

        await m.react('🕕')

        let avatar = null

        // REPLY IMAGE
        if (
            m.quoted &&
            /image/.test(m.quoted.mimetype || '')
        ) {
            try {
                const buffer = await m.quoted.download()
                avatar = await loadImage(buffer)
            } catch {}
        }

        // DIRECT IMAGE
        else if (/image/.test(m.mimetype || '')) {
            try {
                const buffer = await m.download()
                avatar = await loadImage(buffer)
            } catch {}
        }

        // PROFILE
        if (!avatar) {
            try {
                const pp = await sock.profilePictureUrl(m.sender, 'image')
                avatar = await loadImageSafe(pp)
            } catch {}
        }

        // FALLBACK
        if (!avatar) {
            avatar = await loadImage(await hsAsset.buffer('images/pp-kosong'))
        }

        // BACKGROUND
        const bg =
            await loadImageSafe('https://c.termai.cc/i189/mfJahyH.jpg')

        // CROWN
        const crown =
            await loadImageSafe('https://files.catbox.moe/ionw8n.png')

        const canvas = createCanvas(800, 800)
        const ctx    = canvas.getContext('2d')

        // BG
        if (bg) {
            ctx.drawImage(bg, 0, 0, 800, 800)
        } else {
            ctx.fillStyle = '#000'
            ctx.fillRect(0, 0, 800, 800)
        }

        const centerX = 400
        const centerY = 340
        const radius  = 180

        // SHADOW
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius + 18, 0, Math.PI * 2)
        ctx.fillStyle = 'black'
        ctx.fill()

        // AVATAR
        ctx.save()
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
        ctx.closePath()
        ctx.clip()
        ctx.drawImage(avatar, centerX - radius, centerY - radius, radius * 2, radius * 2)
        ctx.restore()

        // BORDER
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius + 3, 0, Math.PI * 2)
        ctx.lineWidth   = 7
        ctx.strokeStyle = 'white'
        ctx.stroke()

        // CROWN
        if (crown) {
            ctx.save()
            ctx.translate(centerX + 95, centerY - 175)
            ctx.rotate(0.3)
            ctx.drawImage(crown, -65, -65, 130, 100)
            ctx.restore()
        }

        // TEXT MELENGKUNG
        const curvedText = name.toUpperCase()
        const chars      = curvedText.split('')
        const len        = chars.length

        ctx.font         = 'bold 42px "Epep"'
        ctx.fillStyle    = 'white'
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'

        const textRadius = radius + 48
        const arc        = Math.min(Math.PI * 0.9, len * 0.16)
        const startAngle = Math.PI * 0.5 + arc / 2

        for (let i = 0; i < len; i++) {
            const angle =
                startAngle - (arc / (len - 1 || 1)) * i
            const x =
                centerX + Math.cos(angle) * textRadius
            const y =
                centerY + Math.sin(angle) * textRadius

            ctx.save()
            ctx.translate(x, y)
            ctx.rotate(angle - Math.PI / 2)
            ctx.fillText(chars[i], 0, 0)
            ctx.restore()
        }

        const buffer = canvas.toBuffer('image/png')

        await sock.sendMessage(
            m.chat,
            {
                image: buffer,
                caption:
                    `╭━━━━━━━━━━━━━━━━╮\n` +
                    `  ⭐ *ꜰᴀᴋᴇ ᴅᴇᴠ* ⭐\n` +
                    `╰━━━━━━━━━━━━━━━━╯\n\n` +
                    `✦ *Nama*   : ${name}\n` +
                    `✦ *Req by* : @${m.sender.split('@')[0]}\n\n` +
                    `> _「 ᴀᴋᴜ ᴀᴅᴀʟᴀʜ ɪᴅᴏʟ ᴛᴇʀʙᴇsᴀʀ ᴅɪ ᴅᴜɴɪᴀ 」_`,
                mentions: [m.sender]
            },
            { quoted: m }
        )

        await m.react('⭐')

    } catch (e) {

        console.log(e)
        await m.react('❌')
        m.reply(
            `╭━━━━━━━━━━━━━━━━╮\n` +
            `  ⭐ *ꜰᴀᴋᴇ ᴅᴇᴠ* ⭐\n` +
            `╰━━━━━━━━━━━━━━━━╯\n\n` +
            `✦ *Status* : ❌ Gagal\n` +
            `✦ *Error*  : ${e.message}\n\n` +
            `> _Coba lagi nanti ya~ 🌸_`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}