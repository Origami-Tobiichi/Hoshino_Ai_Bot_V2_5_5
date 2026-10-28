/**
‎✧ Name    : ttsprabowo
‎✧ Category: tools
**/

const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: 'ttsprabowo',
    alias: [],
    category: 'tools',
    description: 'Text-to-speech pakai suara Prabowo',
    usage: '.ttsprabowo <teks>',
    example: '.ttsprabowo Selamat pagi rakyat Indonesia',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

// Cache voice_id "prabowo" biar gak nembak endpoint pencarian tiap kali dipanggil
let _cachedVoiceId = null

async function resolveVoiceId(apiKey) {
    if (_cachedVoiceId) return _cachedVoiceId

    const { data } = await axios.get('https://api.fish.audio/model', {
        headers: { Authorization: `Bearer ${apiKey}` },
        params: {
            title: 'prabowo',
            page_size: 5,
            sort_by: 'task_count'
        },
        timeout: 15000
    })

    const items = data?.items || data?.data?.items || []
    if (!items.length) throw new Error('Voice "prabowo" tidak ditemukan di Fish Audio')

    _cachedVoiceId = items[0].id || items[0]._id
    return _cachedVoiceId
}

async function handler(m, { sock }) {
    // Ambil teks dari argumen, atau dari pesan yang di-quote kalau kosong
    let text = m.text?.trim()
    if (!text && m.quoted?.text) text = m.quoted.text

    if (!text) {
        return m.reply(
            `📦 *ᴛᴛs ᴘʀᴀʙᴏᴡᴏ* 🎤\n\n` +
            `> Masukkan teks yang mau diucapkan dulu~ ✨\n\n` +
            `> ${m.prefix}ttsprabowo <teks>\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> ${m.prefix}ttsprabowo Selamat pagi rakyat Indonesia`
        )
    }

    const apiKey = config.APIkey?.fishaudio
    if (!apiKey) {
        return m.reply(
            `❌ *Fish Audio API key belum di-set*\n\n` +
            `> Tambahin \`APIkey.fishaudio\` di config.js dulu ya~`
        )
    }

    await m.react('🕕')

    try {
        const referenceId = await resolveVoiceId(apiKey)

        const { data } = await axios.post(
            'https://api.fish.audio/v1/tts',
            { text, reference_id: referenceId },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    model: 's2.1-pro-free',
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer',
                timeout: 30000
            }
        )

        await sock.sendMessage(m.chat, {
            audio: data,
            mimetype: 'audio/mpeg',
            ptt: false
        }, { quoted: m })

        await m.react('✅')
    } catch (error) {
        // Kalau voice_id yang di-cache ternyata invalid/expired, reset biar dicari ulang next call
        _cachedVoiceId = null
        console.error('[ttsprabowo] Error:', error)
        await m.react('❌')
        return m.reply(`❌ *TTS Gagal!*\n\n> ${error.message.slice(0, 150)}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}