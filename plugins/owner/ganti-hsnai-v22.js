const hsAsset = require('../../src/lib/assets')
const { uploadToCatbox } = require('../../src/lib/uploader')

const pluginConfig = {
name: 'ganti-hsnai-v22.jpg',
alias: ['gantihsnaiv22', 'sethsnaiv22'],
category: 'owner',
description: 'Ganti gambar hsnai-v22.jpg',
usage: '.ganti-hsnai-v22.jpg (reply/kirim gambar atau URL)',
example: '.ganti-hsnai-v22.jpg',
isOwner: true,
isPremium: false,
isGroup: false,
isPrivate: false,
cooldown: 5,
energi: 0,
isEnabled: true
}

const KEYS = ['images/hsnai-v22']
const LABEL = 'hsnai-v22.jpg'

async function handler(m, { sock }) {
const arg = (m.args?.[0] ? String(m.args[0]) : '').trim()

if (arg.toLowerCase() === 'reset') {
    KEYS.forEach(key => hsAsset.setUrl(key, ''))
    return m.reply(`✅ *BERHASIL*\n\n> Override URL ${LABEL} dihapus.\n> Gambar kembali menggunakan URL bawaan config.js.`)
}

if (/^https?:\/\//i.test(arg)) {
    KEYS.forEach(key => hsAsset.setUrl(key, arg))
    return m.reply(`✅ *BERHASIL*\n\n> ${LABEL} berhasil diganti.\n> URL: ${arg}`)
}

const quoted = m.quoted
const isImage = m.isImage || quoted?.type === 'imageMessage'

if (!isImage) {
    return m.reply(
        `🖼️ *GANTI ${LABEL.toUpperCase()}*\n\n` +
        '> Kirim/reply gambar atau masukkan URL gambar.\n' +
        '> Reset: .ganti-hsnai-v22.jpg reset'
    )
}

try {
    await m.react('🕕')

    let buffer
    if (quoted && (quoted.isMedia || quoted.type === 'imageMessage')) {
        buffer = await quoted.download()
    } else if (m.isMedia || m.isImage) {
        buffer = await m.download()
    }

    if (!buffer) {
        await m.react('❌')
        return m.reply('❌ Gagal mengunduh gambar.')
    }

    const hostedUrl = await uploadToCatbox(buffer, LABEL)

    if (!hostedUrl || !/^https?:\/\//i.test(hostedUrl)) {
        throw new Error('Upload Catbox tidak menghasilkan URL yang valid.')
    }

    KEYS.forEach(key => hsAsset.setUrl(key, hostedUrl))

    await m.react('✅')
    return m.reply(
        `✅ *BERHASIL*\n\n` +
        `> Gambar ${LABEL} berhasil diganti.\n` +
        `> URL: ${hostedUrl}\n` +
        '> URL override dikelola oleh sistem asset bot.'
    )
} catch (error) {
    await m.react('❌')
    return m.reply(`❌ *ERROR*\n\n> ${error.message}`)
}

}

module.exports = {
config: pluginConfig,
handler
}