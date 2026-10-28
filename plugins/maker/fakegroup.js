const axios = require('axios')
const FormData = require('form-data')

const pluginConfig = {
    name: 'fakegroup',
    alias: ['fg'],
    category: 'maker',
    description: 'Buat fake WhatsApp group screenshot',
    usage: '.fakegroup url|title|number|time\n.fakegroup title|number|time (reply gambar)',
    example: '.fakegroup https://i.imgur.com/xxx.jpg|Nama Group|628xxxxxxxxx|12:00',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 2,
    isEnabled: true
}

// Primary: catbox.moe (tidak expired, stabil)
async function catbox(buffer) {
    try {
        const form = new FormData()
        form.append('reqtype', 'fileupload')
        form.append('userhash', '')
        form.append('fileToUpload', buffer, 'image.jpg')

        const { data } = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: form.getHeaders(),
            timeout: 15000
        })

        return data?.startsWith('https://') ? data.trim() : null
    } catch {
        return null
    }
}

// Fallback: tmpfiles.org
async function tmpfiles(buffer) {
    try {
        const form = new FormData()
        form.append('file', buffer, 'image.jpg')

        const { data } = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
            headers: form.getHeaders(),
            timeout: 15000
        })

        return data?.data?.url?.replace('tmpfiles.org/', 'tmpfiles.org/dl/') || null
    } catch {
        return null
    }
}

async function uploadImage(buffer) {
    const url = await catbox(buffer)
    if (url) return url
    return await tmpfiles(buffer)
}

async function handler(m, { sock }) {
    const text = m.text
    const usedPrefix = m.prefix
    const command = m.command

    const q = m.quoted ? m.quoted : m

    if (!text) {
        return await m.reply(
            `📋 *Format Penggunaan:*\n\n` +
            `*Dengan URL gambar:*\n` +
            `${usedPrefix}${command} url|title|number|time\n\n` +
            `*Reply gambar:*\n` +
            `${usedPrefix}${command} title|number|time`
        )
    }

    try {
        let url, title, number, time
        const args = text.split('|').map(v => v?.trim())

        if (args.length === 4) {
            [url, title, number, time] = args

        } else if (args.length === 3) {
            if (!m.quoted || !q.isImage) {
                throw 'Reply gambar terlebih dahulu untuk dijadikan foto grup.'
            }
            ;[title, number, time] = args
            const media = await q.download()
            url = await uploadImage(media)
            if (!url) throw 'Gagal upload gambar ke server. Coba lagi nanti.'

        } else {
            throw `Format salah.\n${usedPrefix}${command} url|title|number|time`
        }

        const apiUrl = `https://api.zenzxz.my.id/maker/fakegroup?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&number=${encodeURIComponent(number)}&time=${encodeURIComponent(time)}`

        const { data } = await axios.get(apiUrl, { responseType: 'arraybuffer' })
        const buffer = Buffer.from(data)

        await sock.sendMessage(m.chat, {
            image: buffer,
            caption: '✅ Fake group berhasil dibuat!'
        }, { quoted: m })

    } catch (error) {
        console.error('Fakegroup Plugin Error:', error)
        await m.reply(`❌ *GAGAL*\n\n> ${typeof error === 'string' ? error : error.message}`)
    }
}

module.exports = { config: pluginConfig, handler }