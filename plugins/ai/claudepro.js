const fetch = require('node-fetch')
const FormData = require('form-data')
const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'claudepro',
    alias: ['cldpro', 'aipro'],
    category: 'ai',
    description: 'AI Chat + Vision (Claude-Pro)',
    usage: '.claudepro <text> (reply gambar opsional)',
    example: '.claudepro ini error apa?',
    cooldown: 5,
    energi: 2,
    isEnabled: true
}

//
// 🔥 UPLOADER INTERNAL (ANTI GAGAL)
//

// CATBOX
async function uploadCatbox(buffer) {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('fileToUpload', buffer, {
        filename: 'file.jpg',
        contentType: 'image/jpeg'
    })

    const res = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
        timeout: 30000
    })

    if (!res.ok) throw new Error('Catbox gagal')

    const text = await res.text()
    if (!text.startsWith('http')) throw new Error('Catbox invalid')

    return text
}

// TMPFILES
async function uploadTmp(buffer) {
    const form = new FormData()
    form.append('file', buffer, 'file.jpg')

    const res = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
    })

    const json = await res.json()
    if (!json?.data?.url) throw new Error('Tmp gagal')

    let url = json.data.url
    const id = url.match(/\/(\d+)/)?.[1]
    if (id) url = `https://tmpfiles.org/dl/${id}/file.jpg`

    return url
}

// LITTERBOX
async function uploadLitter(buffer) {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('time', '72h')
    form.append('fileToUpload', buffer, 'file.jpg')

    const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
    })

    const text = await res.text()
    if (!text.startsWith('http')) throw new Error('Litter gagal')

    return text
}

// MULTI UPLOAD (fallback)
async function uploadImage(buffer) {
    const list = [uploadCatbox, uploadTmp, uploadLitter]

    for (const fn of list) {
        try {
            const url = await fn(buffer)
            if (url) return url
        } catch (e) {
            console.log('[UPLOAD ERROR]', e.message)
        }
    }

    throw new Error('Semua uploader gagal')
}

//
// 🔥 HANDLER
//

async function handler(m, { sock }) {
    const db = getDatabase()
    const prefix = m.prefix

    // ===== PARSE TEXT =====
    let text = ''
    if (m.args && Array.isArray(m.args)) {
        text = m.args.join(' ')
    } else if (m.text) {
        text = m.text.replace(new RegExp(`^\\${prefix}\\w+`), '').trim()
    }

    const userData = db.getUser(m.sender) || {}

    // ===== RESET =====
    if (text.toLowerCase() === 'reset') {
        db.setUser(m.sender, {
            ...userData,
            claudeSession: null
        })
        return m.reply('🧠 *Session direset~*\n\n> Ai udah lupain obrolan tadi, kita mulai lagi dari awal ya! 🌸')
    }

    if (!text) {
        return m.reply(
            `🎤 *ᴄʟᴀᴜᴅᴇ ᴘʀᴏ*\n\n` +
            `Haii~ Ai siap bantu! Tulis dulu pertanyaannya ya~ 🌸\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
            `┃ • \`${prefix}claudepro cara fix error\`\n` +
            `┃ • Reply gambar + \`${prefix}claudepro ini apa?\`\n` +
            `┃ • \`${prefix}claudepro reset\` — mulai session baru\n` +
            `╰┈┈⬡`
        )
    }

    // ===== SESSION =====
    let sessionId = userData.claudeSession
    if (!sessionId) {
        sessionId = `Ai_${Date.now()}`
        db.setUser(m.sender, {
            ...userData,
            claudeSession: sessionId
        })
    }

    await m.reply('🧠 Ai lagi mikir dulu ya~ tunggu sebentar... ✨')

    try {
        let imageUrl = ''
        let isImage = false

        // ===== DETEKSI MEDIA =====
        try {
            if (m.quoted) {
                const buffer = await m.quoted.download()
                if (buffer && buffer.length > 0) {
                    isImage = true
                    imageUrl = await uploadImage(buffer)
                }
            } else if (m.isMedia) {
                const buffer = await m.download()
                if (buffer && buffer.length > 0) {
                    isImage = true
                    imageUrl = await uploadImage(buffer)
                }
            }
        } catch (e) {
            console.log('[MEDIA ERROR]', e.message)
        }

        // ===== API =====
        const url =
            `https://omegatech-api.dixonomega.tech/api/ai/Claude-pro` +
            `?action=chat` +
            `&prompt=${encodeURIComponent(text)}` +
            `&model=code_assistant` +
            `&chatStyle=chat` +
            `&tools=all` +
            `&sessionId=${sessionId}` +
            `&imageUrl=${encodeURIComponent(imageUrl)}` +
            `&size=portrait` +
            `&version=hd` +
            `&clearSession=false`

        const res = await fetch(url)
        const json = await res.json()

        if (!json.success) throw new Error('API gagal')

        let replyText = json.response || '-'

        if (replyText.length > 1500) {
            replyText = replyText.slice(0, 1500) + '\n...'
        }

        let msg =
            `🌟 *Hoshino Ai – Claude Pro* 🌟\n\n` +
            `💭 ${text}\n\n`

        if (isImage) msg += `🖼️ Mode: Vision aktif\n\n`

        msg +=
            `🎤 ${replyText}\n\n` +
            `✨ Session: ${sessionId}`

        await m.reply(msg)

    } catch (e) {
        console.error(e)

        m.reply(
            `❌ *Gomen ne~* ✦\n\n` +
            `> ${e.message}\n\n` +
            `_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}