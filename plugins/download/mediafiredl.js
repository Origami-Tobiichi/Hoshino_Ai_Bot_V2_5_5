const config = require('../../config')
const { f } = require('./../../src/lib/undici')
const axios = require('axios')

const pluginConfig = {
    name: 'mediafiredl',
    alias: ['mfdl', 'mediafire', 'mf'],
    category: 'download',
    description: 'Download file dari MediaFire',
    usage: '.mfdl <url>',
    example: '.mfdl https://www.mediafire.com/file/xxx',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 1,
    isEnabled: true
}

async function getMediafireLink(url) {
    const { data: html } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    })

    const match = html.match(/href="(https:\/\/download\d+\.mediafire\.com\/[^"]+)"/)
    if (!match) throw new Error('Link download tidak ditemukan. File mungkin sudah dihapus.')

    const nameMatch = html.match(/<div class="filename"[^>]*>([^<]+)<\/div>/) ||
                      url.match(/\/([^/]+\.\w+)\/file/)

    const fileName = nameMatch ? nameMatch[1].trim() : 'file'

    return {
        url: match[1],
        title: fileName,
        mime: 'application/octet-stream',
        size: 0
    }
}

async function handler(m, { sock }) {
    const url = m.text?.trim()

    if (!url) {
        return m.reply(
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> \`${m.prefix}mfdl <url>\`\n\n` +
            `> Contoh:\n` +
            `> \`${m.prefix}mfdl https://www.mediafire.com/file/xxx\``
        )
    }

    if (!url.match(/mediafire\.com/i)) {
        return m.reply(`❌ *URL tidak valid. Gunakan link MediaFire.*`)
    }

    await m.react('🕕')

    try {
        const data = await getMediafireLink(url)

        await sock.sendMedia(m.chat, data.url, null, m, {
            type: 'document',
            fileName: data.title || 'file',
            mimetype: data.mime || 'application/octet-stream',
            fileSize: data.size,
            contextInfo: {
                forwardingScore: 99,
                isForwarded: true
            }
        })

    } catch (err) {
        return m.reply(`❌ *Gomen ne~* ✦\n\n> ${err.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}