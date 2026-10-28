const { Image } = require('node-webpmux')

const pluginConfig = {
    name: 'slock',
    alias: ['stickerlock', 'anticolongsticker'],
    category: 'sticker',
    description: 'Mengubah sticker biasa menjadi avatar sticker (locked)',
    usage: '.slock',
    example: '.slock',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const q = m.quoted

    if (!q || !q.isSticker) {
        return m.reply(
            `╭┈┈⬡「 ⭐ *sᴛɪᴄᴋᴇʀ ʟᴏᴄᴋ* 」\n` +
            `┃ Reply sticker yang mau di-lock jadi avatar sticker!\n` +
            `┃ Penggunaan: \`${m.prefix}slock\`\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }

    try {
        const buffer = await q.download()
        const img = new Image()
        await img.load(buffer)

        const json = {
            'sticker-pack-id': 'whatsapp',
            'sticker-pack-name': 'Hoshino Ai',
            'sticker-pack-publisher': 'SeaPRST',
            'android-app-store-link': 'https://whatsapp.com',
            'ios-app-store-link': 'https://whatsapp.com/ios',
            'emojis': ['😂', '🔥', '💀'],
            'is-from-sticker-maker': 0,
            'is-avatar-sticker': 1,
            'avatar-sticker-template-id': 'whatsapp',
            'is-ai-sticker': 1,
            'is-avatar-country-sticker': 1,
            'is-avatar-instant-sticker': 1,
            'sticker-maker-source-type': 4,
            'is-avatar-social-sticker': 1,
            'avatar-sticker-style': 'whatsapp',
            'avatar-sticker-revision-id': '2026',
            'is-from-user-created-pack': 1,
            'origin-pack-id': 'whatsapp',
            'is-text-sticker': 1,
            'premium': 0
        }

        const exifAttr = Buffer.from([
            0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00,
            0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00
        ])
        const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8')
        const exif = Buffer.concat([exifAttr, jsonBuffer])
        exif.writeUIntLE(jsonBuffer.length, 14, 4)
        img.exif = exif

        const newBuffer = await img.save(null)

        await sock.sendMessage(m.chat, { sticker: newBuffer }, { quoted: m })
        m.react('✅')

    } catch (e) {
        console.error('[slock]', e)
        m.react('❌')
        m.reply(
            `╭┈┈⬡「 📋 *ɪɴғᴏ* 」\n` +
            `┃ ❌ Gagal\n` +
            `┃ ${e.message}\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}