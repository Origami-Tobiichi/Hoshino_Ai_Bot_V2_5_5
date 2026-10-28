const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const FormData = require('form-data')

const pluginConfig = {
    name: 'deepai',
    alias: ['dai', 'claude'],
    category: 'ai',
    description: 'Chat, vision, generate, dan edit gambar dengan AI',
    usage: '.deepai <text>',
    example: '.deepai Halo',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

const API = 'https://omegatech-api.dixonomega.tech/api/ai/Claude-pro'

const dbPath = path.join(process.cwd(), 'database', 'deepai_db.json')

if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
}

if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({
        settings: {
            global: {
                all: false,
                private: false
            }
        },
        sessions: {},
        prefs: {}
    }, null, 2))
}

const getDB = () => JSON.parse(fs.readFileSync(dbPath, 'utf8'))
const saveDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2))

const MODELS = [
    'deepseek-v3.2',
    'gemini-2.5-flash-lite',
    'gpt-5-nano',
    'llama-3.3-70b-instruct',
    'llama-4-scout',
    'claudeai_0',
    'claudeai_1',
    'gpt4_0',
    'gpt4_1',
    'deepai_chat',
    'helpful_assistant',
    'genius',
    'code_assistant',
    'creative_writer',
    'debate_master',
    'philosopher'
]

const STYLES = [
    'chat',
    'claudeai_0',
    'claudeai_1',
    'gpt4_0',
    'gpt4_1',
    'deepai_chat',
    'helpful_assistant',
    'genius',
    'code_assistant',
    'creative_writer',
    'debate_master',
    'philosopher'
]

async function apiChat(prompt, sessionId, model, chatStyle, tools, attachmentUuid) {
    const params = new URLSearchParams({
        action: 'chat',
        prompt,
        model,
        chatStyle,
        tools
    })

    if (sessionId) {
        params.set('sessionId', sessionId)
    }

    if (attachmentUuid) {
        params.set('attachmentUuid', attachmentUuid)
    }

    const response = await fetch(`${API}?${params}`)
    return response.json()
}

async function apiUpload(buffer, filename = 'image.jpg') {
    const form = new FormData()

    form.append('file', buffer, {
        filename,
        contentType: 'image/jpeg'
    })

    const response = await fetch(`${API}?action=upload`, {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
    })

    return response.json()
}

async function apiGenerate(prompt, size = 'portrait', version = 'hd') {
    const params = new URLSearchParams({
        action: 'generate',
        prompt,
        size,
        version
    })

    const response = await fetch(`${API}?${params}`)
    return response.json()
}

async function apiEdit(imageUrl, prompt, version = 'hd') {
    const params = new URLSearchParams({
        action: 'edit',
        imageUrl,
        prompt,
        version
    })

    const response = await fetch(`${API}?${params}`)
    return response.json()
}

function isBotMentioned(m, sock) {
    try {
        const botNumber = (sock.user.id || '').split(':')[0] + '@s.whatsapp.net'

        return (
            m.mentionedJid &&
            m.mentionedJid.includes(botNumber)
        )
    } catch {
        return false
    }
}

async function getQuotedImage(m) {
    try {
        const quoted = m.quoted ? m.quoted : m

        const mime = quoted.mimetype || quoted.msg?.mimetype || ''

        if (!/image|sticker/.test(mime)) {
            return null
        }

        return await quoted.download()
    } catch {
        return null
    }
}

async function runChat(m, sock, prompt, options = {}) {
    const db = getDB()

    const prefs = db.prefs[m.sender] || {
        model: 'llama-4-scout',
        chatStyle: 'chat',
        tools: 'all'
    }

    const session = db.sessions[m.sender] || {}

    const model = options.model || prefs.model
    const chatStyle = options.chatStyle || prefs.chatStyle
    const tools = options.tools || prefs.tools

    await sock.sendPresenceUpdate('composing', m.chat)

    const result = await apiChat(
        prompt,
        session.id || null,
        model,
        chatStyle,
        tools,
        options.attachmentUuid || null
    )

    if (result.sessionId) {
        db.sessions[m.sender] = {
            id: result.sessionId
        }

        saveDB(db)
    }

    return result.response || result.error || 'Tidak ada respon'
}

async function handler(m, { sock }) {
    const db = getDB()

    const text = m.args.join(' ').trim()
    const args = text ? text.split(' ') : []

    const sub = args[0]?.toLowerCase()

    // ON OFF
    if (sub === 'on' || sub === 'off') {
        const enable = sub === 'on'

        if (!db.settings[m.chat]) {
            db.settings[m.chat] = {}
        }

        db.settings[m.chat].enabled = enable

        saveDB(db)

        return m.reply(
            `✅ *ᴅᴇᴇᴘᴀɪ* 🌸\n\n> Yatta~ DeepAI udah Ai *${enable ? 'aktifkan' : 'nonaktifkan'}* ya!`
        )
    }

    // RESET
    if (sub === 'reset') {
        delete db.sessions[m.sender]

        saveDB(db)

        return m.reply('✅ *Session direset~*\n\n> Ai udah lupain obrolan tadi, kita mulai dari awal lagi ya! 🌸')
    }

    // MODELS
    if (sub === 'models') {
        let teks = `🤖 *ʟɪsᴛ ᴍᴏᴅᴇʟ ᴀɪ*\n\nAi punya model-model ini~ pilih favoritmu ya! 🌸\n\n`

        teks += MODELS.map((v, i) => {
            return `${i + 1}. ${v}`
        }).join('\n')

        teks += `\n\nContoh:\n${m.prefix}deepai model gpt-5-nano`

        return m.reply(teks)
    }

    // MODEL
    if (sub === 'model') {
        const modelName = args[1]?.toLowerCase()

        if (!modelName || !MODELS.includes(modelName)) {
            return m.reply(
                `❌ *Ehh~ modelnya nggak ketemu!*\n\n` +
                `> Cek daftarnya dulu ya: \`${m.prefix}deepai models\` 🌸`
            )
        }

        if (!db.prefs[m.sender]) {
            db.prefs[m.sender] = {
                model: 'llama-4-scout',
                chatStyle: 'chat',
                tools: 'all'
            }
        }

        db.prefs[m.sender].model = modelName

        saveDB(db)

        return m.reply(`✅ *Yatta~* Model udah Ai ganti ke *${modelName}*! ✨`)
    }

    // STYLE
    if (sub === 'style') {
        const styleName = args[1]?.toLowerCase()

        if (!styleName || !STYLES.includes(styleName)) {
            return m.reply(`❌ *Ehh~ style-nya nggak ketemu!*\n\n> Coba cek lagi namanya ya~ 🌸`)
        }

        if (!db.prefs[m.sender]) {
            db.prefs[m.sender] = {
                model: 'llama-4-scout',
                chatStyle: 'chat',
                tools: 'all'
            }
        }

        db.prefs[m.sender].chatStyle = styleName

        saveDB(db)

        return m.reply(`✅ *Yatta~* Style udah Ai ganti ke *${styleName}*! ✨`)
    }

    // GENERATE IMAGE
    if (sub === 'gen' || sub === 'generate') {
        const prompt = args.slice(1).join(' ')

        if (!prompt) {
            return m.reply(
                `🎨 *ɢᴇɴᴇʀᴀᴛᴇ ɪᴍᴀɢᴇ*\n\n` +
                `Kyaa~ Ai mau gambarin apa nih? Tulis deskripsinya dulu ya~ 🌸\n\n` +
                `Contoh:\n${m.prefix}deepai gen Hoshino Ai anime`
            )
        }

        m.react('🎨')

        try {
            const result = await apiGenerate(prompt)

            if (!result.success) {
                m.react('❌')
                return m.reply(`❌ *Gomen ne~* ✦\n\n> ${result.error}\n\n_Coba lagi nanti ya~ 🌸_`)
            }

            await sock.sendMessage(m.chat, {
                image: {
                    url: result.imageUrl
                },
                caption:
                    `🎨 *ɢᴇɴᴇʀᴀᴛᴇᴅ ɪᴍᴀɢᴇ*\n\n` +
                    `> Sugoi~! Gambarnya udah jadi, Ai bangga banget! ⭐\n\n` +
                    `📝 Prompt: ${prompt}`
            }, {
                quoted: m
            })

            m.react('✅')

        } catch (error) {
            console.error(error)

            m.react('❌')

            m.reply(
                `❌ *Gomen ne~* ✦\n\n` +
                `> ${error.message}\n\n` +
                `_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`
            )
        }

        return
    }

    // EDIT IMAGE
    if (sub === 'edit') {
        const instruction = args.slice(1).join(' ')

        if (!instruction) {
            return m.reply(
                `🖌️ *ᴇᴅɪᴛ ɪᴍᴀɢᴇ*\n\n` +
                `Haii~ Ai bisa edit gambarmu lho! Reply gambar lalu:\n` +
                `${m.prefix}deepai edit ubah jadi anime`
            )
        }

        const image = await getQuotedImage(m)

        if (!image) {
            return m.reply('🖼️ *Ehh~ gambarnya mana?*\n\n> Reply gambar dulu ya~ Ai tunggu! 🌸')
        }

        m.react('🕕')

        try {
            const upload = await apiUpload(image)

            if (!upload.success) {
                return m.reply(`❌ *Ara ara~*\n\n> Ai gagal upload gambarnya nih... coba lagi ya~ 🥺`)
            }

            const result = await apiEdit(
                upload.attachment.download_url,
                instruction
            )

            if (!result.success) {
                return m.reply(`❌ *Gomen ne~* ✦\n\n> ${result.error}\n\n_Coba lagi nanti ya~ 🌸_`)
            }

            await sock.sendMessage(m.chat, {
                image: {
                    url: result.imageUrl
                },
                caption:
                    `🖌️ *ᴇᴅɪᴛᴇᴅ ɪᴍᴀɢᴇ*\n\n` +
                    `> Yatta~ Ai udah selesai edit gambarnya! ⭐\n\n` +
                    `📝 Instruksi: ${instruction}`
            }, {
                quoted: m
            })

            m.react('✅')

        } catch (error) {
            console.error(error)

            m.react('❌')

            m.reply(
                `❌ *Gomen ne~* ✦\n\n` +
                `> ${error.message}\n\n` +
                `_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`
            )
        }

        return
    }

    // VISION
    if (sub === 'vision' || sub === 'see') {
        const question = args.slice(1).join(' ') || 'Jelaskan gambar ini'

        const image = await getQuotedImage(m)

        if (!image) {
            return m.reply(
                `🖼️ *Ehh~ gambarnya mana?*\n\n> Reply gambar dulu ya~ Ai tunggu! 🌸`
            )
        }

        m.react('🕕')

        try {
            const upload = await apiUpload(image)

            if (!upload.success) {
                return m.reply(`❌ *Ara ara~*\n\n> Ai gagal upload gambarnya nih... coba lagi ya~ 🥺`)
            }

            const reply = await runChat(
                m,
                sock,
                question,
                {
                    attachmentUuid: upload.attachment.uuid
                }
            )

            m.reply(reply)

            m.react('✅')

        } catch (error) {
            console.error(error)

            m.react('❌')

            m.reply(
                `❌ *Gomen ne~* ✦\n\n` +
                `> ${error.message}\n\n` +
                `_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`
            )
        }

        return
    }

    // HELP
    if (!text || sub === 'help') {
        const prefs = db.prefs[m.sender] || {
            model: 'llama-4-scout',
            chatStyle: 'chat'
        }

        let teks = `🤖 *ᴅᴇᴇᴘᴀɪ ᴀɪ*\n\nHaii~ ini menu DeepAI dari Ai! Pilih yang kamu mau ya~ 🌸\n\n`

        teks += `╭─ ❍ *CHATBOT*\n`
        teks += `│ ◦ ${m.prefix}deepai <text>\n`
        teks += `│ ◦ ${m.prefix}deepai reset\n`
        teks += `│ ◦ ${m.prefix}deepai on/off\n`
        teks += `╰────────────\n\n`

        teks += `╭─ ❍ *IMAGE AI*\n`
        teks += `│ ◦ ${m.prefix}deepai gen <prompt>\n`
        teks += `│ ◦ ${m.prefix}deepai edit <instruksi>\n`
        teks += `│ ◦ ${m.prefix}deepai vision <pertanyaan>\n`
        teks += `╰────────────\n\n`

        teks += `╭─ ❍ *SETTINGS*\n`
        teks += `│ ◦ ${m.prefix}deepai models\n`
        teks += `│ ◦ ${m.prefix}deepai model <nama>\n`
        teks += `│ ◦ ${m.prefix}deepai style <nama>\n`
        teks += `╰────────────\n\n`

        teks += `⚙️ Model: ${prefs.model}\n`
        teks += `🎭 Style: ${prefs.chatStyle}`

        return m.reply(teks)
    }

    // CHAT
    try {
        const quotedImage = await getQuotedImage(m)

        // AUTO VISION
        if (quotedImage) {
            m.react('🕕')

            const upload = await apiUpload(quotedImage)

            if (!upload.success) {
                return m.reply('❌ *Ara ara~*\n\n> Ai gagal upload gambarnya nih... coba lagi ya~ 🥺')
            }

            const reply = await runChat(
                m,
                sock,
                text,
                {
                    attachmentUuid: upload.attachment.uuid
                }
            )

            await m.reply(reply)

            m.react('✅')

            return
        }

        m.react('🕕')

        const reply = await runChat(m, sock, text)

        await m.reply(reply)

        m.react('✅')

    } catch (error) {
        console.error(error)

        m.react('❌')

        m.reply(
            `❌ *Gomen ne~* ✦\n\n` +
            `> DeepAI lagi nggak tersedia nih...\n\n` +
            `_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`
        )
    }
}

// AUTO AI
handler.before = async (m, { sock }) => {
    if (!m.body) return
    if (m.fromMe) return
    if (m.isBaileys) return
    if (/^[./#!]/.test(m.body)) return

    const db = getDB()

    const chatSettings = db.settings[m.chat] || {}

    const shouldReply =
        chatSettings.enabled === true

    if (!shouldReply) return

    if (m.isGroup && !isBotMentioned(m, sock)) {
        return
    }

    try {
        const reply = await runChat(
            m,
            sock,
            m.body.trim()
        )

        await m.reply(reply)

    } catch (error) {
        console.error('Auto DeepAI Error:', error)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}