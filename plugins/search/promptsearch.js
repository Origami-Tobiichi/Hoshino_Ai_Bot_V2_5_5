/**
 * ✧ Name    : prompthero
 * ✧ Category: ai
 **/

const config = require('../../config')
const https = require('https')
const { URL } = require('url')
const zlib = require('zlib')

const pluginConfig = {
    name: 'promptsearch',
    alias: ['promptcari', 'searchprompt', 'cariprompt', 'prompthero'],
    category: 'search',
    description: 'Cari prompt AI di PromptHero.com',
    usage: '.promptsearch <keyword>',
    example: '.promptsearch anime girl',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

class PromptHeroScraper {
    constructor() {
        this.baseUrl = 'https://prompthero.com'
        this.apiUrl = 'https://prompthero.com/api/trpc/prompt.getModelsForSearch,category.getIndexedOptions,prompt.search'
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    async search(query) {
        try {
            const data = await this._fetchAPI(query)
            const results = this._parseResults(data)
            return { success: true, total: results.length, hasil: results }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    _fetchAPI(query) {
        return new Promise((resolve, reject) => {
            const payload = {
                "0": { "json": null, "meta": { "values": ["undefined"], "v": 1 } },
                "1": { "json": null, "meta": { "values": ["undefined"], "v": 1 } },
                "2": {
                    "json": {
                        "query": query,
                        "searchMode": null, "searchType": null,
                        "page": 1, "pageSize": 24, "sort": null,
                        "model": null, "modelVersion": null, "type": null,
                        "timeRange": null, "nsfw": false, "nsfwOnly": null,
                        "sortOverride": null, "featured": null, "category": null,
                        "excludeNsfwDiscoveryContent": null
                    },
                    "meta": {
                        "values": {
                            "searchMode": ["undefined"], "searchType": ["undefined"],
                            "sort": ["undefined"], "model": ["undefined"],
                            "modelVersion": ["undefined"], "type": ["undefined"],
                            "timeRange": ["undefined"], "nsfwOnly": ["undefined"],
                            "sortOverride": ["undefined"], "featured": ["undefined"],
                            "category": ["undefined"], "excludeNsfwDiscoveryContent": ["undefined"]
                        },
                        "v": 1
                    }
                }
            }

            const url = `${this.apiUrl}?batch=1&input=${encodeURIComponent(JSON.stringify(payload))}`
            const parsedUrl = new URL(url)
            const options = {
                hostname: parsedUrl.hostname,
                port: 443,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json',
                    'x-trpc-source': 'nextjs-react',
                    'Accept-Encoding': 'gzip, deflate, br'
                }
            }

            const req = https.request(options, (res) => {
                const chunks = []
                const encoding = res.headers['content-encoding']
                res.on('data', (chunk) => chunks.push(chunk))
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks)
                    if (encoding === 'gzip' || encoding === 'deflate') {
                        zlib.unzip(buffer, (err, decoded) => {
                            if (err) reject(new Error('Gagal dekompres: ' + err.message))
                            else resolve(decoded.toString())
                        })
                    } else if (encoding === 'br') {
                        zlib.brotliDecompress(buffer, (err, decoded) => {
                            if (err) reject(new Error('Gagal dekompres brotli: ' + err.message))
                            else resolve(decoded.toString())
                        })
                    } else {
                        resolve(buffer.toString())
                    }
                })
            })

            req.on('error', reject)
            req.end()
        })
    }

    _parseResults(data) {
        const results = []
        try {
            const json = JSON.parse(data)
            const items = json?.[2]?.result?.data?.json?.items || []
            items.forEach(item => {
                if (item.prompt && item.asset) {
                    results.push({
                        judul: item.prompt.title || 'No Title',
                        prompt: item.prompt.prompt || '',
                        model: item.prompt.modelUsed || 'Unknown',
                        versi: item.prompt.modelUsedVersion || '',
                        kategori: item.prompt.category || 'General',
                        dilihat: item.prompt.viewCount || 0,
                        favorit: item.prompt.favCount || 0,
                        gambar: item.asset.url || null,
                        url: item.prompt.slug ? `${this.baseUrl}/${item.prompt.slug}` : null
                    })
                }
            })
        } catch (e) {}
        return results
    }
}

async function handler(m, { sock }) {
    const query = m.text?.trim()

    if (!query) {
        return m.reply(
            `🤖 *ᴘʀᴏᴍᴘᴛʜᴇʀᴏ sᴇᴀʀᴄʜ*\n\n` +
            `> Cari prompt AI di PromptHero.com~\n\n` +
            `*ᴄᴀʀᴀ ᴘᴀᴋᴀɪ:*\n` +
            `> ${m.prefix}promptsearch <keyword>\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> ${m.prefix}promptsearch anime girl`
        )
    }

    await m.react('🕕')

    try {
        const scraper = new PromptHeroScraper()
        const result = await scraper.search(query)

        if (!result.success || result.total === 0) {
            await m.react('❌')
            return m.reply(`❌ *ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ*\n\n> Tidak ada prompt untuk keyword: *${query}*`)
        }

        // Ambil 5 hasil pertama
        const items = result.hasil.slice(0, 5)

        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            const caption =
                `🎨 *[${i + 1}/${items.length}] ${item.judul}*\n\n` +
                `╭┈┈⬡「 📋 *ɪɴғᴏ* 」\n` +
                `┃ 🤖 Model: ${item.model}${item.versi ? ` (${item.versi})` : ''}\n` +
                `┃ 📂 Kategori: ${item.kategori}\n` +
                `┃ 👁️ Dilihat: ${item.dilihat.toLocaleString()}\n` +
                `┃ ❤️ Favorit: ${item.favorit.toLocaleString()}\n` +
                `╰┈┈⬡\n\n` +
                `📝 *ᴘʀᴏᴍᴘᴛ:*\n` +
                `> ${item.prompt.slice(0, 500)}${item.prompt.length > 500 ? '...' : ''}\n\n` +
                `🔗 ${item.url || '-'}`

            if (item.gambar) {
                await sock.sendMessage(m.chat, {
                    image: { url: item.gambar },
                    caption
                }, { quoted: m.raw })
            } else {
                await m.reply(caption)
            }

            // Delay antar pesan biar gak spam
            if (i < items.length - 1) await new Promise(r => setTimeout(r, 1000))
        }

        await m.react('✅')

    } catch (error) {
        console.error('[prompthero] Error:', error)
        await m.react('❌')
        return m.reply(`❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ*\n\n> ${error.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}