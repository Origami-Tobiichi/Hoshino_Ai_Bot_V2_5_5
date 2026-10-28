/**
‎✧ Name    : chatgot
‎✧ Category: ai
**/

const config = require('../../config')
// sesuaikan path ke file scraper chatgot kamu
const chatgot = require('../../src/scraper/chatgot')

const MODELS = ['gpt41mini', 'gpt4omini', 'gemini', 'deepseek']

const pluginConfig = {
    name: 'chatgot',
    alias: ['cgot', 'gotai'],
    category: 'ai',
    description: 'Chat AI via ChatGot (multi model)',
    usage: '.chatgot [model] <pertanyaan>',
    example: '.chatgot gemini apa itu node.js',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    let text = m.text?.trim()

    if (!text) {
        return m.reply(
            `📦 *ᴄʜᴀᴛɢᴏᴛ* 🎤

` +
            `> Ai butuh input dulu dong~ ✨

` +
            `> ${m.prefix}chatgot [model] <pertanyaan>

` +
            `*ᴍᴏᴅᴇʟ:*
` +
            `> ${MODELS.join(', ')}

` +
            `*ᴄᴏɴᴛᴏʜ:*
` +
            `> ${m.prefix}chatgot gemini halo`
        )
    }

    // kalau kata pertama = nama model, pakai itu. Default: gpt4omini
    let model = 'gpt4omini'
    const [first, ...rest] = text.split(/\s+/)
    if (MODELS.includes(first.toLowerCase())) {
        model = first.toLowerCase()
        text = rest.join(' ').trim()
        if (!text) return m.reply(`❌ Pertanyaannya mana? Contoh: ${m.prefix}chatgot ${model} halo`)
    }

    await m.react('🕕')

    try {
        const result = await chatgot(text, model)
        if (!result) throw new Error('Respon kosong dari ChatGot')

        await m.react('✅')
        return m.reply(`✅ *ᴄʜᴀᴛɢᴏᴛ* 🎤✨

> ${result}`)
    } catch (error) {
        console.error('[chatgot] Error:', error)
        await m.react('❌')
        return m.reply(`❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ*

> ${error.message}

> Coba lagi ya, Ai janji next take bakal lebih bagus~`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}