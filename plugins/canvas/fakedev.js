const axios = require('axios')
const config = require('../../config')
const FormData = require('form-data')
const fetch = require('node-fetch')

const pluginConfig = {
    name: 'devmaker',
    alias: ['fakedev', 'fakedev2'],
    category: 'canvas',
    description: 'Membuat gambar fake developer card',
    usage: '.devmaker <nama> [--verified]',
    example: '.devmaker SeaPRST --verified',
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const rawText = m.text
    if (!rawText) return m.reply(
        `📱 *FAKE DEV*\n\n` +
        `> \`${m.prefix}devmaker <nama>\`\n` +
        `> \`${m.prefix}devmaker <nama> --verified\`\n\n` +
        `💡 *Tips:* Reply gambar untuk custom foto`
    )

    const isImage = m.isImage || (m.quoted && m.quoted.type === 'imageMessage')
    if (!isImage) return m.reply(`📷 *ꜰᴀᴋᴇ ᴅᴇᴠ*\n\nReply gambar dulu ya~`)

    // Parse --verified flag
    const verified = rawText.includes('--verified')
    const nama = rawText.replace('--verified', '').trim()

    if (!nama) return m.reply(`❌ *Ehh~* Nama tidak boleh kosong~ 🥺`)

    m.react('🕕')

    try {
        let buffer = await (m.isImage ? m.download() : m.quoted.download())
        if (!buffer) throw new Error('Gagal download gambar.')

        // --- UPLOAD KE LITTERBOX ---
        let imageUrl
        try {
            const form = new FormData()
            form.append('fileToUpload', buffer, { filename: 'pfp.jpg', contentType: 'image/jpeg' })
            form.append('reqtype', 'fileupload')
            form.append('time', '1h')
            const resUp = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, {
                headers: form.getHeaders()
            })
            imageUrl = resUp.data
        } catch (e) {
            // Fallback ke Telegraph
            const formTel = new FormData()
            formTel.append('file', buffer, 'tmp.jpg')
            const resTel = await fetch('https://telegra.ph/upload', { method: 'POST', body: formTel })
            const jsonTel = await resTel.json()
            imageUrl = 'https://telegra.ph' + jsonTel[0].src
        }

        if (!imageUrl || !imageUrl.includes('http')) throw new Error('Gagal upload foto.')

        // --- API 1: OMEGATECH ---
        try {
            const apiOmega = `https://omegatech-api.dixonomega.tech/api/tools/fakedev?name=${encodeURIComponent(nama)}&image=${encodeURIComponent(imageUrl)}`

            const res = await fetch(apiOmega, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://omegatech-api.dixonomega.tech/'
                }
            })

            const buff = await res.buffer()

            if (buff.toString().includes('statusCode')) {
                const errJson = JSON.parse(buff.toString())
                throw new Error(errJson.error || 'Server API Error')
            }

            if (buff.length > 2000) {
                m.react('⭐')
                return await sock.sendMessage(m.chat, {
                    image: buff,
                    caption: `✅ *FAKE DEV SUCCESS*\n\n> Nama: ${nama}\n> Verified: ${verified ? '✅' : '❌'}\n> API: Omegatech ✨`
                }, { quoted: m })
            } else {
                throw new Error('Hasil gambar korup/kosong.')
            }

        } catch (e) {
            console.log('[devmaker] Omegatech gagal, coba Theresav:', e.message)
        }

        // --- API 2: THERESAV (Fallback) ---
        try {
            const params = {
                name: nama,
                imageUrl: imageUrl,
                apikey: 'JpLZ3'
            }
            if (verified) params.verified = 'True'

            const { data } = await axios.get('https://api.theresav.biz.id/canvas/fakedev', {
                params,
                responseType: 'arraybuffer',
                timeout: 20000
            })

            const buff = Buffer.from(data)

            if (buff.length > 2000) {
                m.react('⭐')
                return await sock.sendMessage(m.chat, {
                    image: buff,
                    caption: `✅ *FAKE DEV SUCCESS*\n\n> Nama: ${nama}\n> Verified: ${verified ? '✅' : '❌'}\n> API: Theresav ✨`
                }, { quoted: m })
            } else {
                throw new Error('Hasil gambar korup/kosong.')
            }

        } catch (e) {
            throw new Error(`Semua API gagal: ${e.message}`)
        }

    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = { config: pluginConfig, handler }