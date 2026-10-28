const axios = require('axios')
const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const { exec } = require('child_process')
const { promisify } = require('util')
const { zencf } = require('zencf')
const config = require('../../config')
const { wrapper } = require('axios-cookiejar-support')
const { CookieJar } = require('tough-cookie')
const cheerio = require('cheerio')
const { f } = require('../../src/lib/undici')

const execAsync = promisify(exec)

const pluginConfig = {
    name: 'spotplay',
    alias: ['splay'],
    category: 'search',
    description: 'Putar musik dari Spotify',
    usage: '.spotplay <query>',
    example: '.spotplay neffex grateful',
    cooldown: 20,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const query = m.text?.trim()
    if (!query)
        return m.reply(
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n> \`${m.prefix}spotplay <query>\``
        )

    m.react('🕕')

    try {
        const { result } = await f(`https://api.nexray.web.id/downloader/spotifyplay?q=${encodeURIComponent(query)}`)
        await sock.sendMedia(m.chat, result?.download_url, null, m, {
                type: 'audio',
                mimetype: 'audio/mpeg',
                ptt: false,
                fileName: `${result?.title}.mp3`,
                contextInfo: {
                }
            })
    } catch (e) {
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${e.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = { 
    config: pluginConfig, 
    handler 
}