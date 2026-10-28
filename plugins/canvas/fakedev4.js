const hsAsset = require('../../src/lib/assets')
const axios = require('axios')
const fs = require('fs')
const FormData = require('form-data')

const pluginConfig = {
    name: 'fakedev4',
    alias: ['devmaker4', 'hoshinodev4'],
    category: 'canvas',
    description: 'Membuat fake developer profile card style Hoshino Ai',
    usage: '.fakedev4 <nama>',
    example: '.fakedev4 Hoshino Ai',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

// 🔥 upload tmpfiles
async function uploadToTmpFiles(buffer) {

    try {

        const form =
            new FormData()

        form.append(
            'file',
            buffer,
            {
                filename: 'image.jpg',
                contentType: 'image/jpeg'
            }
        )

        const { data } =
            await axios.post(
                'https://tmpfiles.org/api/v1/upload',
                form,
                {
                    headers:
                        form.getHeaders()
                }
            )

        const url =
            data.data.url.replace(
                'tmpfiles.org/',
                'tmpfiles.org/dl/'
            )

        return {
            directUrl: url
        }

    } catch (e) {

        console.log(e)

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
            body.trim()
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

        let buffer = null

        // 🔥 reply image
        if (
            m.quoted &&
            m.quoted.mimetype?.includes('image')
        ) {

            buffer =
                await m.quoted.download()
        }

        // 🔥 send image
        else if (
            m.mimetype?.includes('image')
        ) {

            buffer =
                await m.download()
        }

        // 🔥 pp wa
        else {

            try {

                const pp =
                    await sock.profilePictureUrl(
                        m.sender,
                        'image'
                    )

                const { data } =
                    await axios.get(
                        pp,
                        {
                            responseType:
                                'arraybuffer'
                        }
                    )

                buffer =
                    Buffer.from(data)

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
                `✦ *Error*  : Gambar tidak ditemukan\n\n` +
                `> _Coba lagi nanti ya~ 🌸_`
            )
        }

        await m.react('🕕')

        // 🔥 upload image
        const uploaded =
            await uploadToTmpFiles(
                buffer
            )

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

        // 🔥 API FAKEDEV
        const api =
`https://api.ourin.my.id/api/fake-developer-1?text=${encodeURIComponent(name)}&image=${encodeURIComponent(uploaded.directUrl)}`

        // 🔥 SEND
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