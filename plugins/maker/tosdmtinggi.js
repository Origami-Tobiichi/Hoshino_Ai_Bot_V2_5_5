const config = require('../../config')
const { default: axios } = require('axios')
const FormData = require('form-data')

const pluginConfig = {
    name: 'tosdmtinggi',
    alias: ['tosdm', 'dmtinggi'],
    category: 'maker',
    description: '🎀 Bikin gambar Fake DM Tinggi biar temen kamu panik~ Hehe! 🤭',
    usage: '.tosdm (reply/kirim gambar)',
    example: '.tosdm',
    cooldown: 10,
    energi: 5,
    isEnabled: true
}

async function handler(m, { sock }) {
    const isImage = m.isImage || (m.quoted && m.quoted.type === 'imageMessage')

    if (!isImage) {
        return m.reply(`✨ *Hoshino Ai Fake DM*\n\n> Reply atau kirim gambar ya, senpai~ biar aku edit! 🎤`)
    }

    m.react('🕕')

    try {
        let buffer
        if (m.quoted && m.quoted.isMedia) {
            buffer = await m.quoted.download()
        } else if (m.isMedia) {
            buffer = await m.download()
        }

        if (!buffer) throw new Error('Gagal download gambar~')

        // 🔥 Step 1: Upload ke Catbox
        const form = new FormData()
        form.append('fileToUpload', buffer, 'image.jpg')
        form.append('reqtype', 'fileupload')

        const catbox = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: form.getHeaders(),
            timeout: 20000 // Kasih waktu tunggu lebih lama
        }).catch(e => { throw new Error('Catbox lagi error/down nih, Senpai! 😅') })

        const imageUrl = catbox.data.trim()
        
        // Cek apakah hasil upload beneran link
        if (!imageUrl.startsWith('http')) {
            throw new Error('Gagal dapetin link gambar dari uploader.')
        }

        console.log('Link Gambar:', imageUrl) // Cek di terminal/console log kamu

        // 🔥 Step 2: Tembak ke API Fake DM dengan Response Type Arraybuffer (Lebih Aman)
        const apiUrl = `https://api-faa.my.id/faa/tosdmtinggi?url=${encodeURIComponent(imageUrl)}`
        
        const response = await axios.get(apiUrl, { 
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        }).catch(e => {
            throw new Error(`API FAA Error 500 (Mungkin lagi maintenance, Senpai~ 😅)`)
        })

        if (!response.data) throw new Error('Hasil API kosong!')

        await sock.sendMessage(m.chat, {
            image: Buffer.from(response.data),
            caption: `✨ *Hoshino Ai Fake DM*\n\n> Tadaaa~! Ini dia hasilnya, Senpai! Hehe~ 🤭💖`
        }, { quoted: m })

        m.react('✨')

    } catch (error) {
        console.error('Error Details:', error.message)
        m.react('❌')
        m.reply(`❌ *Hoshino Ai Error*\n\n> ${error.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}