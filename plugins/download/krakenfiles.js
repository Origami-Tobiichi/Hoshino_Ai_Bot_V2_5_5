const { f } = require('../../src/lib/undici')
const cheerio = require('cheerio')
const axios = require('axios')

const pluginConfig = {
    name: ['krakenfiles', 'kfiles', 'kf'],
    alias: ['kraken', 'kfdl'],
    category: 'download',
    description: 'Download file dari KrakenFiles',
    usage: '.krakenfiles <url>',
    example: '.krakenfiles https://krakenfiles.com/view/xxxx/file.html',
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.text?.trim()
    const prefix = m.prefix

    if (!text) {
        m.react('❌')
        return m.reply(`📌 Contoh: *${prefix}krakenfiles https://krakenfiles.com/view/...*`)
    }

    m.react('⏱️')

    try {
        // ==================================
        // 📡 SCRAPING DATA
        // ==================================
        const pageRes = await axios.get(text, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                'Referer': 'https://krakenfiles.com',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        })

        const $ = cheerio.load(pageRes.data)

        // EXTRACT INFO
        let filename = $('.coin-info .coin-name h5').text().trim() || 'file_unknown'
        let file_size = null
        let upload_date = null
        
        $('.nk-iv-wg4 .nk-iv-wg4-overview li').each((_, el) => {
            let key = $(el).find('.sub-text').text().trim().toLowerCase()
            let val = $(el).find('.lead-text').text().trim()
            if (key.includes('size')) file_size = val
            if (key.includes('date')) upload_date = val
        })

        let type = filename.includes('.') ? filename.split('.').pop() : 'unknown'
        let token = $('#dl-token').val()
        let hash = text.match(/krakenfiles\.com\/view\/([^/]+)/)?.[1]

        if (!hash) throw 'URL tidak valid Bos!'

        // GET LINK DOWNLOAD
        let download = null
        let videoSrc = $('video source').attr('src')
        let gallerySrc = $('.lightgallery a').attr('href')

        if (videoSrc) {
            download = videoSrc.startsWith('http') ? videoSrc : 'https:' + videoSrc
        } else if (gallerySrc) {
            download = gallerySrc.startsWith('http') ? gallerySrc : 'https:' + gallerySrc
        } else {
            let postRes = await axios.post(`https://krakenfiles.com/download/${hash}`,
                new URLSearchParams({ token: token || '' }).toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                        'Referer': text,
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                }
            )
            download = postRes.data?.url || postRes.data?.download_url || null
        }

        if (!download) throw 'Gagal ambil link download!'

        // ==================================
        // 📥 DOWNLOADING FILE
        // ==================================
        const fileRes = await axios.get(download, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                'Referer': text,
                'Accept': '*/*'
            },
            responseType: 'arraybuffer'
        })

        // ==================================
        // ✨ CAPTION STYLE HOSHINO AI
        // ==================================
        const caption = `
🌸✨ *H O S H I N O  A I  D O W N L O A D E R* ✨🌸

╭┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈⬡
┃ 📂 *Nama File:* ${filename}
┃ 📦 *Ukuran:* ${file_size || 'N/A'}
┃ 📅 *Upload:* ${upload_date || '-'}
┃ 📡 *Host:* KrakenFiles
╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈⬡

💫 *Successfully downloaded by Hoshino Ai*
💖 Semoga harimu menyenangkan!
`

        // ==================================
        // 📤 SEND FILE
        // ==================================
        await sock.sendMessage(m.chat, {
            document: Buffer.from(fileRes.data),
            fileName: filename,
            mimetype: type,
            caption: caption
        }, { quoted: m })

        m.react('✅')

    } catch (e) {
        console.error(e)
        m.react('❌')
        m.reply(`💥 *E R R O R*\n\n> ${e.message || e}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}