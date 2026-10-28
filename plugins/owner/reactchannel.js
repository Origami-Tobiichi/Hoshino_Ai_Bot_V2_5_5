/**
✧ Name    : reactchannel
✧ Alias   : rc
✧ Category: owner
✧ Deskripsi: Memberikan reaction ke postingan WhatsApp Channel.
**/

const config = require('../../config')

const API_URL = 'https://reaction-whatsapp.edgeone.dev/react'
const API_KEY = 'XMNQ92FH'

const DEFAULT_REACTIONS = ['😗', '🤪', '😎']

const pluginConfig = {
    name: 'reactchannel',
    alias: ['rc', 'reactch'],
    category: 'owner',
    description: 'Memberikan reaction ke postingan WhatsApp Channel',
    usage: '.reactchannel <link> [reaction]',
    example: '.reactchannel https://whatsapp.com/channel/xxxx/123 🎊🎉🥳✨',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function sendReaction(link, emoji) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({ link, emoji }),
        signal: AbortSignal.timeout(30000)
    })

    const raw = await response.text()

    console.log(`[reactchannel] ${emoji} HTTP:`, response.status)
    console.log(`[reactchannel] ${emoji} RAW :`, raw)

    let result = null

    try {
        result = JSON.parse(raw)
    } catch {
        result = null
    }

    const failed =
        !response.ok ||
        result?.status === false ||
        result?.success === false ||
        !!result?.error

    if (failed) {
        const reason =
            result?.message ||
            result?.error ||
            `HTTP ${response.status}`

        throw new Error(typeof reason === 'string' ? reason : JSON.stringify(reason))
    }

    return result
}

async function handler(m, { sock }) {
    const text = m.text?.trim()

    if (!text) {
        return m.reply(
            `📦 *ʀᴇᴀᴄᴛ ᴄʜᴀɴɴᴇʟ* 🎤✨\n\n` +
            `> Masukkan link postingan WhatsApp Channel dulu yaa~\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> ${m.prefix}rc https://whatsapp.com/channel/xxxx/123\n\n` +
            `*ᴄᴜsᴛᴏᴍ ʀᴇᴀᴄᴛɪᴏɴ:*\n` +
            `> ${m.prefix}rc https://whatsapp.com/channel/xxxx/123 🎊🎉🥳✨🎂🍰`
        )
    }

    // ============================================================
    // AMBIL LINK WHATSAPP CHANNEL
    // ============================================================

    const urlMatch = text.match(
        /https?:\/\/(?:www\.)?whatsapp\.com\/channel\/[^\s]+/i
    )

    if (!urlMatch) {
        return m.reply(
            `❌ *ʟɪɴᴋ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ*\n\n` +
            `> Masukkan link postingan WhatsApp Channel yang benar.`
        )
    }

    const url = urlMatch[0].replace(/[.,!?]+$/, '')

    // ============================================================
    // AMBIL REACTION SETELAH LINK
    // ============================================================

    const reactionText = text
        .slice(urlMatch.index + urlMatch[0].length)
        .trim()

    let reactions

    if (!reactionText) {
        reactions = DEFAULT_REACTIONS
    } else {
        /*
         * Mendukung:
         * 🎊🎉🥳✨🎂🍰
         * maupun:
         * 🎊, 🎉, 🥳, ✨, 🎂, 🍰
         */
        const parsed = reactionText
            .split(/[\s,]+/)
            .filter(Boolean)
            .flatMap(item => Array.from(item))

        reactions = [...new Set(parsed)]
    }

    await m.react('🕕')

    try {
        console.log('[reactchannel] Target   :', url)
        console.log('[reactchannel] Reaction :', reactions.join(', '))

        // ====================================================
        // KIRIM REACTION SATU PER SATU
        // ====================================================

        const success = []
        const failed = []

        for (const emoji of reactions) {
            try {
                await sendReaction(url, emoji)
                success.push(emoji)
            } catch (err) {
                console.error(`[reactchannel] Gagal ${emoji}:`, err.message)
                failed.push({ emoji, reason: err.message })
            }

            if (emoji !== reactions[reactions.length - 1]) {
                await sleep(1000)
            }
        }

        // ====================================================
        // SEMUA GAGAL
        // ====================================================

        if (success.length === 0) {
            throw new Error(failed[0]?.reason || 'Semua reaction gagal dikirim')
        }

        await m.react('✅')

        let message =
            `✅ *ʀᴇᴀᴄᴛ ᴄʜᴀɴɴᴇʟ ʙᴇʀʜᴀsɪʟ~* 🎀✨\n\n` +
            `╭┈┈⬡「 🎤 ʀᴇᴀᴄᴛ 」\n` +
            `┃ 🎯 Target : Berhasil\n` +
            `┃ 💫 React  : ${success.join(', ')}\n`

        if (failed.length > 0) {
            message += `┃ ⚠️ Gagal  : ${failed.map(f => f.emoji).join(', ')}\n`
        }

        message += `╰┈┈┈┈┈┈┈┈⬡`

        if (failed.length > 0) {
            message += `\n\n> ${failed[0].reason}`
        }

        return m.reply(message)

    } catch (error) {
        console.error('[reactchannel] Error:', error)

        await m.react('❌')

        return m.reply(
            `❌ *ʀᴇᴀᴄᴛ ᴄʜᴀɴɴᴇʟ ɢᴀɢᴀʟ*\n\n` +
            `> ${error.message}\n\n` +
            `*ᴛᴀʀɢᴇᴛ:*\n` +
            `> ${url}\n\n` +
            `*ʀᴇᴀᴄᴛ:*\n` +
            `> ${reactions.join(', ')}`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}