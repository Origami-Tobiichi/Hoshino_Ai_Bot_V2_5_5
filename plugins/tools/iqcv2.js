const axios = require('axios')
const FormData = require('form-data')

const pluginConfig = {
    name: 'iqcv2',
    alias: ['iqcv2', 'chatiphone'],
    category: 'tools',
    description: 'Bikin fake chat iPhone ala Hoshino Ai ✨',
    usage: '.iqcv2 <teks>',
    example: '.iqcv2 Halo Sayang!',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function uploadUguu(buffer) {
    let form = new FormData()
    form.append('files[]', buffer, 'image.jpg')
    const { data } = await axios.post('https://uguu.se/upload.php', form, {
        headers: form.getHeaders()
    })
    return data.files[0].url
}

async function handler(m, { sock }) {
    let q = m.quoted ? m.quoted : m
    let mime = (q.msg || q).mimetype || ''
    const text = m.args.join(' ')

    if (!text && !/image/.test(mime)) {
        return m.reply(`🌸 *Yahhoo! Mau bikin chat palsu ya?* 🌸\n\nKirim gambar atau reply gambarnya terus kasih caption teks ya!\n\n\`Contoh: ${m.prefix}iqcv2 Halo Sayang!\``)
    }

    m.react('⏳')
    
    try {
        let imageUrl
        if (/image/.test(mime)) {
            let media = await q.download()
            imageUrl = await uploadUguu(media)
        }

        const messageText = text?.trim() || ' '
        const timeNow = require("moment-timezone").tz("Asia/Jakarta").format("HH.mm")

        const json = {
            sender: "other",
            message: messageText,
            imageUrl,
            timestamp: timeNow,
            time: timeNow,
            status: {
                carrierName: "HOSHINO-NET",
                batteryPercentage: 99,
                signalStrength: 4,
                wifi: true
            },
            backgroundUrl: "",
            readStatus: true,
            emojiStyle: "apple"
        }

        const res = await axios.post(
            'https://brat.siputzx.my.id/v2/iphone-quoted',
            json,
            {
                headers: { 'Content-Type': 'application/json' },
                responseType: 'arraybuffer'
            }
        )

        let buffer = Buffer.from(res.data)
        
        let caption = `🌸 *Tadaaa~! Chat iPhone-nya sudah jadi!* 🌸\n\n`
        caption += `Gimana? Kelihatan asli kan? Hehe...\nKebohongan yang indah adalah bentuk cinta yang sempurna! 💖\n\n`
        caption += `> ✨ *Hoshino Ai Stage Production*`

        await sock.sendMessage(m.chat, {
            image: buffer,
            caption
        }, { quoted: m })

        m.react('✨')

    } catch (e) {
        console.error(e)
        m.react('❌')
        m.reply('❌ *Aduh... panggungnya lagi kacau!* 💔\nAi gagal bikin chat-nya, coba lagi nanti ya!')
    }
}

module.exports = { 
    config: pluginConfig, 
    handler 
}