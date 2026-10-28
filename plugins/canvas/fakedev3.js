const hsAsset = require('../../src/lib/assets')
const axios = require('axios')
const fs = require('fs')
const FormData = require('form-data')

const pluginConfig = {
    name: 'fakedev3',
    alias: ['devmaker3', 'hoshinodev3'],
    category: 'canvas',
    description: 'Membuat fake developer profile card style Hoshino Ai',
    usage: '.fakedev3 <nama>',
    example: '.fakedev3 Hoshino Ai',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

// 🔥 UPLOAD IMAGE
async function uploadToPomf(buffer) {

    try {

        const form =
            new FormData()

        form.append(
            'files',
            buffer,
            'image.jpg'
        )

        const { data } =
            await axios.post(
                'https://pomf2.lain.la/upload.php',
                form,
                {
                    headers:
                        form.getHeaders(),
                    timeout: 30000
                }
            )

        if (
            !data ||
            !data.files ||
            !data.files[0]
        ) {

            return null
        }

        return {
            directUrl:
                data.files[0].url
        }

    } catch (e) {

        console.log(
            'Upload Error:',
            e.message
        )

        return null
    }
}

async function handler(m, { sock }) {

    try {

        const body =
            m.body ||
            m.text ||
            ''

        const name =
            body
            .trim()
            .split(' ')
            .slice(1)
            .join(' ')

        if (!name) {
            return m.reply(
                `╭━━━━━━━━━━━━━━━━╮\n` +
                `  ⭐ *ꜰᴀᴋᴇ ᴅᴇᴠ* ⭐\n` +
                `╰━━━━━━━━━━━━━━━━╯\n\n` +
                `✦ *Usage*  : \`${pluginConfig.usage}\`\n` +
                `✦ *Contoh* : \`${pluginConfig.example}\`\n\n` +
                `> _Kirim/reply foto + command ya~ 🌸_`
            )
        }

        await m.react('🕕')

        let buffer = null

        // 🔥 REPLY IMAGE
        if (
            m.quoted &&
            (
                m.quoted.type === 'imageMessage' ||
                m.quoted.mimetype?.includes('image')
            )
        ) {

            try {

                buffer =
                    await m.quoted.download()

            } catch {}
        }

        // 🔥 DIRECT IMAGE
        else if (
            m.mimetype?.includes('image')
        ) {

            try {

                buffer =
                    await m.download()

            } catch {}
        }

        // 🔥 PROFILE PHOTO
        else {

            try {

                const pp =
                    await sock.profilePictureUrl(
                        m.sender,
                        'image'
                    )

                const res =
                    await axios.get(pp, {
                        responseType:
                            'arraybuffer'
                    })

                buffer =
                    Buffer.from(res.data)

            } catch {

                buffer =
                    (await hsAsset.buffer('images/pp-kosong'))
            }
        }

        if (!buffer) {
            return m.reply(
                `╭━━━━━━━━━━━━━━━━╮\n` +
                `  ⭐ *ꜰᴀᴋᴇ ᴅᴇᴠ* ⭐\n` +
                `╰━━━━━━━━━━━━━━━━╯\n\n` +
                `✦ *Status* : ❌ Gagal\n` +
                `✦ *Error*  : Gagal mengambil gambar\n\n` +
                `> _Coba lagi nanti ya~ 🌸_`
            )
        }

        // 🔥 UPLOAD IMAGE
        const uploaded =
            await uploadToPomf(buffer)

        if (!uploaded) {
            return m.reply(
                `╭━━━━━━━━━━━━━━━━╮\n` +
                `  ⭐ *ꜰᴀᴋᴇ ᴅᴇᴠ* ⭐\n` +
                `╰━━━━━━━━━━━━━━━━╯\n\n` +
                `✦ *Status* : ❌ Gagal\n` +
                `✦ *Error*  : Upload gambar gagal\n\n` +
                `> _Coba lagi nanti ya~ 🌸_`
            )
        }

        // 🔥 API
        const api =
`https://api.ourin.my.id/api/fake-developer-2?text=${encodeURIComponent(name)}&image=${encodeURIComponent(uploaded.directUrl)}`

        // 🔥 SEND RESULT
        await sock.sendMessage(
            m.chat,
            {
                image: { url: api },
                caption:
                    `╭━━━━━━━━━━━━━━━━╮\n` +
                    `  ⭐ *ꜰᴀᴋᴇ ᴅᴇᴠ* ⭐\n` +
                    `╰━━━━━━━━━━━━━━━━╯\n\n` +
                    `✦ *Nama*   : ${name}\n` +
                    `✦ *Req by* : @${m.sender.split('@')[0]}\n\n` +
                    `> _「 ᴀᴋᴜ ᴀᴅᴀʟᴀʜ ɪᴅᴏʟ ᴛᴇʀʙᴇsᴀʀ ᴅɪ ᴅᴜɴɪᴀ 」_`,
                mentions: [m.sender]
            },
            { quoted: m }
        )

        await m.react('⭐')

    } catch (e) {

        console.log(e)
        await m.react('❌')
        m.reply(
            `╭━━━━━━━━━━━━━━━━╮\n` +
            `  ⭐ *ꜰᴀᴋᴇ ᴅᴇᴠ* ⭐\n` +
            `╰━━━━━━━━━━━━━━━━╯\n\n` +
            `✦ *Status* : ❌ Gagal\n` +
            `✦ *Error*  : ${e.message}\n\n` +
            `> _Coba lagi nanti ya~ 🌸_`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}