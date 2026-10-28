/**
‎✧ Name    : playcall
‎✧ Category: search
**/

'use strict'

const axios = require('axios')
const yts = require('yt-search')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// pluginConfig = metadata plugin, dipakai handler.js buat registrasi command
const pluginConfig = {
    name: 'playcall',
    alias: ['telepon', 'call'],
    category: 'search',
    description: 'Putar musik dari YouTube lewat telpon',
    usage: '.playcall <query>',
    example: '.playcall komang',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 2,
    isEnabled: true
}

// handler = fungsi utama yang dijalanin tiap kali command ke-trigger.
// m    = objek pesan (m.text, m.sender, m.chat, m.reply(), m.react(), dll)
// sock = instance socket Baileys
async function handler(m, { sock }) {
    const query = m.text?.trim()

    if (!query) {
        return m.reply(
            `🎵 *ᴘʟᴀʏ ᴄᴀʟʟ*\n\n` +
            `> Ai butuh judul lagunya dulu dong~ ✨\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> ${m.prefix}playcall surat cinta untuk starla`
        )
    }

    if (!global.voipClient) {
        return m.reply('Fitur panggilan suara tidak diaktifkan (VoipClient belum ready).')
    }

    await m.react('📞')

    let tmpFile = null
    const cleanup = () => {
        try { if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile) } catch {}
        tmpFile = null
    }

    try {
        console.log('[PlayCall] Searching for:', query)

        const search = await yts(query)
        if (!search.videos?.length) throw new Error('Video tidak ditemukan')
        const video = search.videos[0]

        const res = await axios.get(
            `https://api.azbry.com/api/download/ytmp3?url=${encodeURIComponent(video.url)}`,
            { timeout: 60000 }
        )
        const data = res.data

        if (!data?.status || !data?.result?.download) {
            throw new Error('Gagal mengambil audio dari API')
        }

        await m.react('🕕')

        console.log('[PlayCall] Downloading audio from:', data.result.download)
        const audioRes = await axios.get(data.result.download, {
            responseType: 'arraybuffer',
            timeout: 60000
        })
        const audioBuffer = Buffer.from(audioRes.data)
        if (!audioBuffer.length) throw new Error('Audio kosong setelah diunduh')

        console.log('[PlayCall] Audio downloaded, buffer size:', audioBuffer.length)

        const tmpDir = path.join(process.cwd(), 'tmp')
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
        tmpFile = path.join(tmpDir, `call_${crypto.randomBytes(4).toString('hex')}.mp3`)
        fs.writeFileSync(tmpFile, audioBuffer)

        const targetNumber = m.sender.split('@')[0]

        if (m.isGroup) {
            await m.reply(`_📞 Panggilan grup tidak didukung oleh library saat ini. Memanggil nomormu secara privat (${targetNumber})..._`)
        } else {
            await m.reply(`_📞 Memanggil nomormu (${targetNumber})..._`)
        }

        const call = await global.voipClient.call(targetNumber, {
            audioSource: tmpFile,
            durationMs: 300000
        })

        call.on('connected', () => {
            m.reply(`✅ *TERHUBUNG*\nLagu *${video.title}* sedang diputar di telpon!`)
        })

        call.on('ended', reason => {
            cleanup()
            m.reply(`📵 Panggilan diakhiri: ${reason}`)
        })

        call.on('error', err => {
            console.error('[VoIP Call Error]', err)
            cleanup()
        })
    } catch (err) {
        console.error('[PlayCall]', err)
        cleanup()
        await m.react('😭')
        return m.reply(`Gagal menelpon / memainkan lagu: ${err.message}`)
    }
}

// Wajib export { config, handler } biar plugin loader (handler.js) bisa
// baca metadata dan manggil fungsi handler-nya
module.exports = {
    config: pluginConfig,
    handler
}