/**
‎✧ Name    : web2apk
‎✧ Category: tools
‎✧ Original author: kyzz (masih pemula)
‎✧ Channel : https://whatsapp.com/channel/0029Vb7gcbuLdQelWzrTzD3D
‎✧ Note    : Dikonversi ke format CJS Hoshino Ai Bot, kredit original tetap dipertahankan
**/

const config = require('../../config')
const axios = require('axios')
const FormData = require('form-data')

const BASE_URL = 'https://api.kyzzz.eu.cc'
const API_KEY = 'kyzz65442862'

const pluginConfig = {
    name: 'web2apk',
    alias: ['web2apk'],
    category: 'tools',
    description: 'Convert URL website jadi file APK Android',
    usage: '.web2apk <url>|<nama app>|<versi (opsional)>|<version code (opsional)>',
    example: '.web2apk https://google.com|Google App',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.text?.trim()

    if (!text) {
        return m.reply(
            `╭┈┈⬡「 📦 ᴡᴇʙ2ᴀᴘᴋ 」\n` +
            `┃ Kasih Ai URL + nama app-nya dulu~ ✨\n` +
            `┃\n` +
            `┃ ᴜsᴀɢᴇ:\n` +
            `┃ ${m.prefix}web2apk <url>|<nama app>|<versi (opsional)>|<version code (opsional)>\n` +
            `┃\n` +
            `┃ ᴄᴏɴᴛᴏʜ:\n` +
            `┃ ${m.prefix}web2apk https://google.com|Google App\n` +
            `┃\n` +
            `┃ ⚠️ Jangan lupa reply gambar buat icon APK-nya!\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }

    await m.react('🕕')

    try {
        const [url, appName = 'MyApp', versionName = '1.0.0', versionCode = '1'] = text.split('|').map(v => v?.trim())

        if (!url || !/^https?:\/\//i.test(url)) {
            throw new Error('URL tidak valid, harus diawali http:// atau https://')
        }

         const isImage = m.isImage || (m.quoted && m.quoted.type === 'imageMessage')

if (!isImage || !m.quoted?.isMedia) {
    throw new Error('Reply gambar sebagai icon APK dulu, ya!')
}

const iconBuffer = await m.quoted.download()

        const form = new FormData()
        form.append('url', url)
        form.append('app_name', appName)
        form.append('version_name', versionName)
        form.append('version_code', versionCode)
        form.append('icon', iconBuffer, { filename: 'icon.png', contentType: 'image/png' })

        await m.reply(
            `╭┈┈⬡「 🕕 ᴘʀᴏᴄᴇssɪɴɢ 」\n` +
            `┃ Sedang build APK, harap tunggu ya...\n` +
            `┃ Bisa agak lama tergantung ukuran website~\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )

        const res = await axios.post(`${BASE_URL}/api/tools/web2apk?apikey=${API_KEY}`, form, {
            headers: form.getHeaders(),
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        })

        const data = res.data
        if (!data.status) throw new Error(data.error || 'Build APK gagal')

        const { appName: name, packageName, downloadUrl } = data.result

        const apkRes = await axios.get(downloadUrl, { responseType: 'arraybuffer' })
        const apkBuffer = Buffer.from(apkRes.data)

        await sock.sendMessage(m.chat, {
            document: apkBuffer,
            mimetype: 'application/vnd.android.package-archive',
            fileName: `${name}.apk`,
            caption: `╭┈┈⬡「 ✅ ʙᴇʀʜᴀsɪʟ~ 」\n` +
                `┃ Web to APK sukses dibikin! 🎤✨\n` +
                `┃\n` +
                `┃ 📦 App     : ${name}\n` +
                `┃ 🔖 Package : ${packageName}\n` +
                `┃ 🔗 URL     : ${url}\n` +
                `╰┈┈┈┈┈┈┈┈⬡`,
        }, { quoted: m })

        await m.react('✅')
    } catch (error) {
        console.error('[web2apk] Error:', error)
        await m.react('❌')
        return m.reply(
            `╭┈┈⬡「 ❌ ᴀᴅᴜʜ, ɢᴀɢᴀʟ 」\n` +
            `┃ ${error.message}\n` +
            `┃\n` +
            `┃ Coba lagi ya, Ai janji next take bakal lebih bagus~\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}