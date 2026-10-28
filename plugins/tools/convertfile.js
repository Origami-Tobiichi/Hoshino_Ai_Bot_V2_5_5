const { exec } = require('child_process')
const util = require('util')
const fs = require('fs')
const path = require('path')
const os = require('os')
const execPromise = util.promisify(exec)
const sharp = require('sharp')

const pluginConfig = {
    name: 'Convert File',
    alias: ['convertfile', 'cvf'],
    category: 'tools',
    description: 'Konversi file audio atau gambar ke format lain (reply ke media)',
    usage: '.convertfile <format>',
    example: '.convertfile mp3',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

const AUDIO_FORMATS = ['mp3', 'wav', 'ogg', 'opus', 'm4a', 'aac', 'flac']
const IMAGE_FORMATS = ['jpeg', 'jpg', 'png', 'webp']

async function handler(m, { sock }) {
    const args = (m.args || (m.text ? m.text.trim().split(/\s+/) : []))
    const format = (args[0] || '').toLowerCase().replace('.', '')

    if (!format) {
        return await m.reply(
            `╭┈┈⬡\n` +
            `│ ᴄᴏɴᴠᴇʀᴛ ꜰɪʟᴇ\n` +
            `├┈┈⬡\n` +
            `│ ʀᴇᴘʟʏ ᴋᴇ ᴀᴜᴅɪᴏ/ɢᴀᴍʙᴀʀ\n` +
            `│ ʟᴀʟᴜ ᴋᴇᴛɪᴋ:\n` +
            `│ .convertfile <format>\n` +
            `│\n` +
            `│ ᴀᴜᴅɪᴏ: ${AUDIO_FORMATS.join(', ')}\n` +
            `│ ɢᴀᴍʙᴀʀ: ${IMAGE_FORMATS.join(', ')}\n` +
            `╰┈┈⬡`
        )
    }

    // Media bisa dari pesan yang di-reply (quoted) atau langsung dikirim bareng caption
    const target = m.quoted && m.quoted.isMedia ? m.quoted : (m.isMedia ? m : null)

    if (!target) {
        return await m.reply(
            `╭┈┈⬡\n` +
            `│ ʀᴇᴘʟʏ ᴋᴇ ꜰɪʟᴇ ᴀᴜᴅɪᴏ ᴀᴛᴀᴜ ɢᴀᴍʙᴀʀ ᴅᴜʟᴜ ʏᴀ~\n` +
            `╰┈┈⬡`
        )
    }

    const isAudio = target.isAudio
    const isImage = target.isImage
    const mime = (target.message && target.type ? target.message[target.type]?.mimetype : null)
        || (isAudio ? 'audio/ogg' : isImage ? 'image/jpeg' : '')

    if (!isAudio && !isImage) {
        return await m.reply(
            `╭┈┈⬡\n` +
            `│ ᴛɪᴘᴇ ꜰɪʟᴇ ɪɴɪ ʙᴇʟᴜᴍ ᴅɪᴅᴜᴋᴜɴɢ\n` +
            `╰┈┈⬡`
        )
    }

    if (isAudio && !AUDIO_FORMATS.includes(format)) {
        return await m.reply(
            `╭┈┈⬡\n` +
            `│ ꜰᴏʀᴍᴀᴛ ᴀᴜᴅɪᴏ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ\n` +
            `│ ᴘɪʟɪʜ: ${AUDIO_FORMATS.join(', ')}\n` +
            `╰┈┈⬡`
        )
    }

    if (isImage && !IMAGE_FORMATS.includes(format)) {
        return await m.reply(
            `╭┈┈⬡\n` +
            `│ ꜰᴏʀᴍᴀᴛ ɢᴀᴍʙᴀʀ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ\n` +
            `│ ᴘɪʟɪʜ: ${IMAGE_FORMATS.join(', ')}\n` +
            `╰┈┈⬡`
        )
    }

    let tempInput, tempOutput

    try {
        await m.reply(
            `╭┈┈⬡\n` +
            `│ ꜱᴇᴅᴀɴɢ ᴍᴇɴɢᴋᴏɴᴠᴇʀꜱɪ...\n` +
            `╰┈┈⬡`
        )

        // target (m atau m.quoted) sama-sama sudah punya method .download()
        // bawaan dari serialize.js
        const buffer = await target.download()

        const tmpDir = os.tmpdir()
        const inputExt = mime.split('/')[1] || 'bin'
        tempInput = path.join(tmpDir, `conv_in_${Date.now()}.${inputExt}`)
        tempOutput = path.join(tmpDir, `conv_out_${Date.now()}.${format}`)

        fs.writeFileSync(tempInput, buffer)

        if (isAudio) {
            // butuh ffmpeg terinstall di server (Pterodactyl egg biasanya sudah include)
            await execPromise(`ffmpeg -y -i "${tempInput}" "${tempOutput}"`)

            const outBuffer = fs.readFileSync(tempOutput)
            await sock.sendMessage(m.chat, {
                audio: outBuffer,
                mimetype: format === 'mp3' ? 'audio/mpeg' : `audio/${format}`,
                fileName: `converted.${format}`
            }, { quoted: m })
        } else {
            const sharpFormat = format === 'jpg' ? 'jpeg' : format
            await sharp(tempInput)[sharpFormat]().toFile(tempOutput)

            const outBuffer = fs.readFileSync(tempOutput)
            await sock.sendMessage(m.chat, {
                image: outBuffer,
                mimetype: `image/${sharpFormat}`
            }, { quoted: m })
        }

        await m.reply(
            `╭┈┈⬡\n` +
            `│ ʙᴇʀʜᴀꜱɪʟ ᴅɪᴋᴏɴᴠᴇʀꜱɪ ᴋᴇ .${format}\n` +
            `╰┈┈⬡`
        )
    } catch (error) {
        console.error('Convert Plugin Error:', error)
        await m.reply(
            `❌ *GAGAL*\n\n` +
            `> ${error.message}`
        )
    } finally {
        try { if (tempInput && fs.existsSync(tempInput)) fs.unlinkSync(tempInput) } catch (e) {}
        try { if (tempOutput && fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput) } catch (e) {}
    }
}

module.exports = {
    config: pluginConfig,
    handler
}