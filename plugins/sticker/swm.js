/**
 * @file plugins/sticker/swm.js
 * @description Plugin untuk mengganti packname dan author pada sticker
 */

const config = require('../../config')
const { addExifToWebp, isAnimatedWebp } = require('../../src/lib/exif')

const pluginConfig = {
    name: 'swm',
    alias: ['wm', 'stickerwm', 'stickermark', 'colong'],
    category: 'sticker',
    description: 'Mengganti packname dan author pada sticker',
    usage: '.swm <packname>|<author>',
    example: '.swm BotName|Author',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock, config: botConfig }) {
    const quoted = m.quoted
    
    if (!quoted) {
        return m.reply(
`⭐ *Ai Hoshino Sticker WM~!*

Eeeh, stickernya mana?! Ai-chan nggak bisa kerja kalau nggak ada yang di-reply lho! 😤💕

📌 *Cara pakainya gini ya~*
Reply sticker dengan perintah:
> \`${m.prefix}swm Packname|Author\`

💡 *Contohnya~*
> \`${m.prefix}swm Hoshino Ai|Idol\`
> \`${m.prefix}swm BotKu\` *(Hanya Packname)*
> \`${m.prefix}swm |Author\` *(Hanya Author)*

> *"Ai loves you~!"* 🌸`
        )
    }
    
    const isSticker = quoted.type === 'stickerMessage' || quoted.isSticker
    if (!isSticker) {
        return m.reply(
`💔 *Ai-chan Bingung...*

Itu bukan sticker, tau! Ai-chan mintanya sticker, bukan *${quoted.type?.replace('Message', '') || 'media lain'}* 😢

Coba reply sticker yang beneran ya~ Ai-chan tunggu! 🌸`
        )
    }
    
    const input = m.text?.trim()
    if (!input) {
        return m.reply(
`💔 *Eh, ketinggalan sesuatu~!*

Kamu lupa nulis Packname atau Author-nya lho! Ai-chan nggak bisa nebak sendiri, meskipun Ai-chan pinter~ 😤💕

💡 *Contohnya gini ya~*
> \`${m.prefix}swm Hoshino Ai|Idol\`

> *"Ai loves you~!"* 🌸`
        )
    }
    
    let packname, author
    let userProvidedAuthor = false

    if (input.includes('|')) {
        const parts = input.split('|')
        packname = parts[0]?.trim() || botConfig.sticker?.packname || botConfig.bot?.name || 'Hoshino Ai'
        const authorInput = parts[1]?.trim()
        if (authorInput) {
            author = authorInput
            userProvidedAuthor = true
        } else {
            author = botConfig.sticker?.author || botConfig.owner?.name || 'Idol'
        }
    } else {
        packname = input
        author = botConfig.sticker?.author || botConfig.owner?.name || 'Idol'
    }
    
    if (packname.length > 50) {
        return m.reply(
`😤 *Kepanjangan tau, Packname-nya!*

Masa Packname-nya sepanjang itu sih~? Ai-chan aja namanya cuma "Ai" lho! 💕
Maksimal 50 karakter aja ya, oke~? 🌸`
        )
    }
    
    if (userProvidedAuthor && author?.length > 50) {
        return m.reply(
`😤 *Author-nya kepanjangan juga~!*

Itu Author apa novel sih, panjang banget~! 😂💕
Maksimal 50 karakter aja ya, untuk Ai-chan~ 🌸`
        )
    }
    
    m.react('⭐')
    
    try {
        const buffer = await quoted.download()
        
        if (!buffer || buffer.length === 0) {
            m.react('💔')
            return m.reply(
`😢 *Aduh, Ai-chan Gagal...*

Stickernya nggak bisa ke-download~ Ai-chan udah berusaha keras lho! 💔
Coba lagi nanti ya, Ai-chan janji bakal coba lagi! 🌸`
            )
        }

        const meta = { packname, ...(author ? { author } : {}) }

        // Cek apakah stiker ini animated WebP (GIF stiker)
        const animated = quoted.msg?.isAnimated || isAnimatedWebp(buffer)

        if (animated) {
            // ── Stiker GIF / animated: langsung inject EXIF ke buffer WebP ──
            // Tidak di-re-encode, animasinya tetap utuh
            const stickerBuffer = await addExifToWebp(buffer, meta)

            await sock.sendMessage(m.chat, {
                sticker: stickerBuffer,
                isAnimated: true
            }, { quoted: m })
        } else {
            // ── Stiker gambar biasa ──
            await sock.sendImageAsSticker(m.chat, buffer, m, meta)
        }
        
        m.react('⭐')
        m.reply(
`⭐ *Selesai~!*

Ja~n! Ai-chan berhasil ganti Packname & Author-nya! ✨
Keren kan? Ini semua berkat kerja kerasnya Ai-chan lho~ 💕

> *"Ai loves you~!"* 🌸`
        )
        
    } catch (error) {
        console.error('[SWM] Error:', error.message)
        m.react('💔')
        m.reply(
`💔 *Ai-chan Sedih Banget...*

Maaf ya, Ai-chan nggak sengaja~ 😢
> ${error.message}

Jangan marah sama Ai-chan... nanti Ai-chan nangis lho! 🌸`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}