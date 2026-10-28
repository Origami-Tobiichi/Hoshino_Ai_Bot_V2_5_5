const gTTS = require('gtts')
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: 'tts',
    alias: ['say'],
    category: 'tts',
    description: 'Google Text To Speech',
    usage: '.tts <text>',
    example: '.tts halo semua',
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.text?.trim()

    if (!text) {
        return m.reply(`🎤 *Google TTS*\n\nGunakan:\n${m.prefix}tts halo dunia`)
    }

    m.react('🎤')

async function textToSpeech2(text) {
    try {
        const res = await fetch(`https://api.nexray.web.id/ai/gemini-tts?text=${encodeURIComponent(text)}`)
        const json = await res.json()
        console.log('TTS JSON:', JSON.stringify(json))
        return json
    } catch (error) {
        console.log('TTS Error:', error)
        return null
    }
}

    try {

        const t = await textToSpeech2(text)

// Cek dulu isi response-nya
console.log('TTS Response:', JSON.stringify(t))

if (!t || !t.result) {
    return m.reply(`❌ TTS gagal: API tidak mengembalikan audio.\nResponse: ${JSON.stringify(t)}`)
}

await sock.sendMessage(m.chat, {
    audio: { url: t.result },
    mimetype: 'audio/mpeg',
}, { quoted: m })
        m.react('✅')

    } catch (err) {
        m.react('❌')
        m.reply(`Error: ${err.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}