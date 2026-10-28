const nanoBanana = require('../../src/scraper/nanobanana')
const FormData = require('form-data')
const fetch = require('node-fetch')

const pluginConfig = {
    name: 'tomanga',
    alias: ['mangafy', 'mangastyle'],
    category: 'ai',
    description: 'Ubah foto menjadi gaya manga Jepang',
    usage: '.tomanga (reply/kirim gambar)',
    example: '.tomanga',
    isOwner: false,
    isPremium: true,
    isGroup: false,
    isPrivate: false,
    cooldown: 60,
    energi: 3,
    isEnabled: true
}

const PROMPT = `Transform this image into Japanese manga style illustration. 
Apply black and white manga aesthetics with dramatic shading, speed lines, 
expressive eyes, and detailed screentones. Keep the original composition 
but convert it to look like a page from a Japanese manga with bold ink lines, 
dynamic poses, and that distinctive manga art style.`

async function handler(m, { sock }) {
    const isImage = m.isImage || (m.quoted && (m.quoted.isImage || m.quoted.type === 'imageMessage'))

    if (!isImage) {
        return m.reply(
            `📖 *ᴛᴏ ᴍᴀɴɢᴀ*\n\n` +
            `Kyaa~ Ai seneng banget sama manga! Tapi reply atau kirim gambarnya dulu dong~ 🌸\n\n` +
            `\`${m.prefix}tomanga\``
        )
    }

    m.react('🕕')

    try {
        let buffer
        if (m.quoted && m.quoted.isMedia) {
            buffer = await m.quoted.download()
        } else if (m.isMedia) {
            buffer = await m.download()
        }

        if (!buffer) {
            m.react('❌')
            return m.reply(`❌ *Ara ara~*\n\n> Ai gagal download gambarnya nih... coba lagi ya~ 🥺`)
        }

        // 🔥 1. COBA NANOBANANA
        try {
            const result = await nanoBanana(buffer, PROMPT)
            m.react('✅')
            return await sock.sendMedia(m.chat, result, null, m, { type: 'image' })
        } catch (e) {
            console.log('[ToManga] NanoBanana gagal:', e.message)
        }

        // 🔥 2. FALLBACK THERESAV
        try {
            const form = new FormData()
            form.append('image', buffer, {
                filename: 'image.jpg',
                contentType: 'image/jpeg'
            })

            const res = await fetch(
                global.API('theresav', '/image/tomanga', {}, 'apikey'),
                {
                    method: 'POST',
                    body: form,
                    headers: form.getHeaders()
                }
            )

            if (!res.ok) {
                const text = await res.text().catch(() => '')
                throw new Error(`Status ${res.status}${text ? ` - ${text}` : ''}`)
            }

            const result = Buffer.from(await res.arrayBuffer())

            if (!result || result.length < 1000) throw new Error('Hasil gambar tidak valid')

            m.react('✅')

            return await sock.sendMessage(m.chat, {
                image: result,
                caption: `📖 *ᴛᴏ ᴍᴀɴɢᴀ*\n\n> Sugoi~! Foto kamu udah jadi manga sekarang! Kawaii kan? ⭐`
            }, { quoted: m })
        } catch (e) {
            console.log('[ToManga] Theresav gagal:', e.message)
        }

        throw new Error('Semua API lagi sibuk, coba lagi nanti ya~ 💀')

    } catch (error) {
        m.react('❌')
        m.reply(
            `❌ *Gomen ne~* ✦\n\n` +
            `> ${error.message}\n\n` +
            `_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}