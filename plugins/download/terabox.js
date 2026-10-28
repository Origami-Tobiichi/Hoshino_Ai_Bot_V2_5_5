const config = require("../../config")
const { f } = require("../../src/lib/undici")

const pluginConfig = {
    name: 'terabox',
    alias: ['tb','tera'],
    category: 'download',
    description: 'Download file dari TeraBox',
    usage: '.terabox <url | nomor>',
    example: '.terabox https://1024terabox.com/s/xxxx',
    cooldown: 20,
    energi: 2,
    isEnabled: true
}

async function handler(m, { sock }) {
    const input = m.text?.trim()

    if (!input.includes('terabox') && !input.includes('1024terabox')) {
        return m.reply('❌ *Ehh~* URL tidak valid~ 🥺')
    }

    m.react('🕕')

    const { data } = await f(`https://api.neoxr.eu/api/terabox?url=${encodeURIComponent(input)}&apikey=${config.APIkey.neoxr}`)
    const result = data[0]
    await sock.sendMedia(m.chat, result.dlink, null, m, {
        type: result.server_filename.includes('.mp4') ? 'video' : result.server_filename.includes('.jpg') || result.server_filename.includes('.jpeg') || result.server_filename.includes('.png') ? 'image' : 'document',
        fileName: result.server_filename,
        mimetype: result.server_filename.includes('.mp4') ? 'video/mp4' : result.server_filename.includes('.jpg') || result.server_filename.includes('.jpeg') || result.server_filename.includes('.png') ? 'image/jpeg' : 'application/octet-stream',
        contextInfo: {
            forwardingScore: 99,
            isForwarded: true
        }
    })

    m.react('✅')
}

module.exports = {
    config: pluginConfig,
    handler
}
