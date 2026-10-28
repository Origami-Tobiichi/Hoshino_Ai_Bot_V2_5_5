const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: 'ai4chat',
    alias: ['ai'],
    category: 'ai',
    description: 'Chat dengan AI4Chat',
    usage: '.ai4chat <pertanyaan>',
    example: '.ai4chat Apa itu JavaScript?',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m) {
    const text = m.text
    if (!text) {
        return m.reply(`🤖 *ᴀɪᴄʜᴀᴛ*\n\nHaii~ Ai siap dengerin! Tulis dulu pertanyaannya ya~ 🌸\n\n\`Contoh: ${m.prefix}ai4chat Apa itu JavaScript?\``)
    }

    m.react('🕕')

    try {
        // 🔥 API utama
        const data = await f(`https://api.zenzxz.my.id/ai/copilot?message=${encodeURIComponent(text)}&model=gpt-5`)

        if (!data?.result?.text) throw new Error('Response kosong dari API utama')

        m.react('✅')
        return m.reply(data.result.text)

    } catch (err1) {
        console.log('API 1 Error:', err1.message)

        try {
            // 🔥 Fallback API
            const fallback = await f(`https://api-faa.my.id/faa/claude-ai?text=${encodeURIComponent(text)}`)

            if (!fallback?.result) throw new Error('Response kosong dari API fallback')

            // API fallback ini kadang balikin pesan cooldown internal + metadata debug
            // yang nyampur di field result, bukan jawaban beneran -> anggap gagal
            if (/character_cooldown/i.test(fallback.result) || /\{"[a-z_]+":\s*(true|false)\}\s*$/i.test(fallback.result)) {
                throw new Error('API fallback sedang cooldown, coba lagi nanti')
            }

            m.react('✅')
            return m.reply(fallback.result)

        } catch (err2) {
            console.log('API 2 Error:', err2.message)

            m.react('❌')
            return m.reply(`❌ *Gomen ne~* ✦\n\n> API utama & fallback sama-sama gagal\n> ${err2.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
        }
    }
}

module.exports = {
    config: pluginConfig,
    handler
}