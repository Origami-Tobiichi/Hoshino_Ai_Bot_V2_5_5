const axios = require('axios')
const FormData = require('form-data')

const pluginConfig = {
    name: ['qwa'],
    alias: ['quotewa', 'fakeqwa'],
    category: 'tools',
    description: 'Membuat gambar quote WhatsApp palsu',
    usage: '.qwa <teks> atau reply pesan',
    example: '.qwa Halo Dunia',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 2,
    isEnabled: true
}

async function getPp(sock, jid) {
    try {
        return await sock.profilePictureUrl(jid, 'image')
    } catch {
        return 'https://files.catbox.moe/ios0gb.jfif'
    }
}

async function uploadImage(buffer) {
    const form = new FormData()
    form.append('file', buffer, { filename: 'image.jpg' })
    const res = await axios.post(
        'https://c.termai.cc/api/upload?key=AIzaBj7z2z3xBjsk',
        form,
        {
            headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0' },
            timeout: 60000
        }
    )
    if (res.data?.status && res.data?.path) return res.data.path
    throw new Error('Upload gambar gagal')
}

function formatNumber(jid) {
    try {
        return '+' + jid.split('@')[0].split(':')[0]
    } catch {
        return jid.split('@')[0]
    }
}

async function handler(m, { sock }) {
    let mainMsg = m
    let quoteMsg = null
    let textToQuote = m.args.join(' ').trim()

    if (m.quoted && !textToQuote) {
        mainMsg = m.quoted
        textToQuote = m.quoted.body || m.quoted.text || ''
    } else if (m.quoted && textToQuote) {
        mainMsg = m
        quoteMsg = m.quoted
    }

    if (!textToQuote && !mainMsg.isMedia) {
        m.react('❌')
        return m.reply(
            `『 🌸 *ꜰᴀᴋᴇ ǫᴜᴏᴛᴇ ᴡᴀ* 🌸 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `✨ *Cara pakai:*\n\n` +
            `*Mode 1 — Teks manual:*\n` +
            `\`${m.prefix}qwa <teks>\`\n\n` +
            `*Mode 2 — Reply pesan:*\n` +
            `Reply pesan lalu kirim \`${m.prefix}qwa\`\n\n` +
            `*Mode 3 — Reply + teks baru:*\n` +
            `Reply pesan lalu \`${m.prefix}qwa <teks>\`\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `> 💖 Ai siap buatin quote WA keren buat kamu~ 🌸`
        )
    }

    m.react('⭐')

    try {
        const msgTime = mainMsg.messageTimestamp
            ? new Date(mainMsg.messageTimestamp * 1000)
            : new Date()
        const timeStr = `${String(msgTime.getHours()).padStart(2, '0')}.${String(msgTime.getMinutes()).padStart(2, '0')}`

        // Upload media utama kalau ada
        let mainImage = null
        if (mainMsg.isMedia) {
            try {
                const buffer = await mainMsg.download()
                if (buffer) mainImage = await uploadImage(buffer)
            } catch (e) {
                console.error('[QWA] Gagal upload media utama:', e.message)
            }
        }

        // Upload media quoted kalau ada
        let quotedImage = null
        if (quoteMsg?.isMedia) {
            try {
                const buffer = await quoteMsg.download()
                if (buffer) quotedImage = await uploadImage(buffer)
            } catch (e) {
                console.error('[QWA] Gagal upload media quoted:', e.message)
            }
        }

        const payload = {
            sender_name: `~ ${mainMsg.pushName || 'User'}`,
            sender_number: formatNumber(mainMsg.sender),
            sender_avatar: await getPp(sock, mainMsg.sender),
            message: textToQuote,
            time: timeStr,
            background: false
        }

        if (mainImage) payload.sender_image = mainImage

        if (quoteMsg) {
            payload.quoted = {
                name: `~ ${quoteMsg.pushName || 'User'}`,
                number: formatNumber(quoteMsg.sender),
                message: quoteMsg.body || quoteMsg.text || ''
            }
            if (quotedImage) payload.quoted.image = quotedImage
        }

        const res = await axios.post(
            'https://qwa.eeq.my.id/api/generate',
            payload,
            {
                headers: { 'Content-Type': 'application/json' },
                responseType: 'arraybuffer',
                timeout: 60000
            }
        )

        await sock.sendMessage(
            m.chat,
            {
                image: Buffer.from(res.data),
                caption:
                    `『 🌟 *ʜᴏsʜɪɴᴏ ᴀɪ* — ꜰᴀᴋᴇ ǫᴜᴏᴛᴇ ᴡᴀ 🌟 』\n` +
                    `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
                    `💬 *${mainMsg.pushName || 'User'}*\n` +
                    `_"${textToQuote.slice(0, 100)}${textToQuote.length > 100 ? '...' : ''}"_\n\n` +
                    `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
                    `🌸 *Hoshino Ai Bot* ✨\n` +
                    `> 「 *推しの子* 」\n` +
                    `> Ini quote WA-nya~ semoga suka! 💖⭐`
            },
            { quoted: m }
        )

        m.react('✅')

    } catch (err) {
        console.error('[QWA] Error:', err.message)
        m.react('❌')
        m.reply(
            `『 💥 *E R R O R* 』\n\n` +
            `> ${err?.message || err?.toString() || 'Unknown error'}\n\n` +
            `> 💔 Maaf ya~ Ai gagal bikin quote-nya...\n` +
            `> Coba lagi nanti ya~ 🌸`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}