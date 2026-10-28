const axios = require('axios')
const FormData = require('form-data')

const pluginConfig = {
    name: 'iqcsticker',
    alias: ['iqcs', 'chatiphonesticker'],
    category: 'maker',
    description: 'Bikin fake chat iPhone style sticker ✨',
    usage: '.iqcsticker <teks>',
    example: '.iqcsticker Halo Sayang!',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.args.join(' ')
    const isImage = m.quoted && m.quoted.type === 'imageMessage'

    if (!text) {
        return m.reply(`🌸 *Yahhoo! Mau bikin chat palsu ya?* 🌸\n\nKasih teks caption ya!\n\n\`Contoh: ${m.prefix}iqcsticker Halo Sayang!\``)
    }

    if (!isImage) {
        return m.reply(`🌸 *Eh, kurang gambarnya!* 🌸\n\nReply sebuah gambar dulu ya~\n\n\`Contoh: reply gambar + ${m.prefix}iqcsticker Halo Sayang!\``)
    }

    m.react('⏳')

    try {
        let buffer = await m.quoted.download()

        const form = new FormData()
        form.append('files[]', buffer, 'image.jpg')
        const { data } = await axios.post('https://uguu.se/upload.php', form, {
            headers: form.getHeaders()
        })
        const imageUrl = data.files[0].url

        const messageText = text?.trim() || ' '

        const res = await axios.get(
            `https://api.azbry.com/api/maker/iqc-sticker?text=${encodeURIComponent(messageText)}&img=${encodeURIComponent(imageUrl)}`,
            { responseType: 'arraybuffer', timeout: 15000 }
        )

        const imgBuffer = Buffer.from(res.data)

        await sock.sendMessage(m.chat, {
            image: imgBuffer,
            caption: `🌸 *Tadaaa~! Chat iPhone-nya sudah jadi!* 🌸\n\nGimana? Kelihatan asli kan? Hehe...\n\n> ✨ *Hoshino Ai Stage Production*`
        }, { quoted: m })

        m.react('✨')

    } catch (e) {
        console.error('[IQCSticker] Error:', e.message, e.response?.data?.toString())
        m.react('❌')
        m.reply(`❌ *Aduh... panggungnya lagi kacau!* 💔\n> ${e.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}