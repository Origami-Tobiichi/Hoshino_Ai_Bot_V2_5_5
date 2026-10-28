const axios = require('axios')

const pluginConfig = {
    name: 'objectgeometrydash',
    alias: ['objgd', 'objgdsearch', 'searchobjgd'],
    category: 'search',
    description: 'Cari, list, & download PNG objek Geometry Dash dari wiki resmi (geometrydash.wiki.gg)',
    usage: '.objgd <nama objek> | .objgd <nomor> | .objgd --list [halaman]',
    example: '.objgd regular block 01',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const RESULT_LIMIT = 8
const LIST_PAGE_SIZE = 30
const LIST_CACHE_TTL_MS = 10 * 60 * 1000 // 10 menit
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 jam
const IMG_BASE = 'https://geometrydash.wiki.gg/images/'
const HEADERS = {
    'User-Agent': 'HoshinoAiBot/1.0 (+https://github.com/hoshinoai-bot)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
}

// Sumber daftar objek: subkategori resmi "Level object images" di wiki.
// Ini kategori yang dikurasi manual sama editor wiki (bukan tebakan/keyword),
// jadi otomatis gak nyampur sama icon/skin/item (yang punya kategori sendiri-sendiri).
const OBJECT_CATEGORIES = [
    'Category:Animated_decor_images',
    'Category:Animated_hazard_images',
    'Category:Block_images',
    'Category:Ground_decor_images',
    'Category:Other_level_object_images',
    'Category:Outline_images',
    'Category:Pick-up_images',
    'Category:Pit_images',
    'Category:Platform_images',
    'Category:Portal_images',
    'Category:Pulsating_decor_images',
    'Category:Regular_decor_images',
    'Category:Rotating_decor_images',
    'Category:Saw-blade_images',
    'Category:Slope_images',
    'Category:Spike_images',
    'Category:Transporter_images',
    'Category:Trigger_images'
]

// Cache index objek { filename, category } di memori, biar gak scrape ulang tiap kali ada yang search
let objectIndexCache = {
    items: [],
    cachedAt: 0
}
let lastScrapeErrors = []

// Cache daftar terakhir yang ditampilkan per chat, biar bisa dipilih pakai nomor
// Map<chatId, { items: [{filename, category}], offset: number, timestamp: number }>
const lastListCache = new Map()

/**
 * Scrape satu halaman wiki (artikel ATAU kategori), ambil semua nama file .png yang direferensikan.
 */
async function scrapePageFilenames(pageTitle) {
    const url = `https://geometrydash.wiki.gg/wiki/${pageTitle}`
    const { data: html } = await axios.get(url, {
        headers: HEADERS,
        timeout: 15000
    })

    const found = new Set()
    // Cocok untuk: /images/Foo.png , /images/thumb/Foo.png/123px-Foo.png , dst
    const regex = /\/images\/(?:thumb\/)?([A-Za-z0-9_\-]+\.png)/gi
    let match
    while ((match = regex.exec(html)) !== null) {
        found.add(match[1])
    }
    return [...found]
}

function categoryLabel(categoryTitle) {
    return categoryTitle.replace(/^Category:/, '').replace(/_/g, ' ')
}

/**
 * Bangun / refresh index objek dari semua kategori resmi di OBJECT_CATEGORIES.
 * Nyimpen filename + kategori asalnya (kategori pertama yang ketemu, kalau ada di lebih dari satu).
 */
async function refreshObjectIndex() {
    const map = new Map() // filename -> category label
    lastScrapeErrors = []
    for (const category of OBJECT_CATEGORIES) {
        try {
            const names = await scrapePageFilenames(category)
            for (const name of names) {
                if (!map.has(name)) {
                    map.set(name, categoryLabel(category))
                }
            }
        } catch (err) {
            const status = err.response?.status
            const msg = status ? `HTTP ${status}` : (err.code || err.message || String(err))
            lastScrapeErrors.push(`${category}: ${msg}`)
            console.error(`[objectgeometrydash] gagal scrape ${category}:`, err.message || err)
        }
    }
    objectIndexCache = {
        items: [...map.entries()].map(([filename, category]) => ({ filename, category })),
        cachedAt: Date.now()
    }
    return objectIndexCache.items
}

async function getObjectIndex() {
    const isStale = Date.now() - objectIndexCache.cachedAt > CACHE_TTL_MS
    if (!objectIndexCache.items.length || isStale) {
        await refreshObjectIndex()
    }
    return objectIndexCache.items
}

/**
 * Pecah "RegularBlock01.png" jadi "regular block 01" biar bisa dicocokkan
 * dengan query berbasis kata seperti "regular block 01".
 */
function normalizeName(filename) {
    return filename
        .replace(/\.png$/i, '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Za-z])(\d)/g, '$1 $2')
        .replace(/(\d)([A-Za-z])/g, '$1 $2')
        .replace(/[_\-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
}

function compact(str) {
    return str.replace(/\s+/g, '').toLowerCase()
}

/**
 * Cari kandidat objek yang cocok dengan query dari index lokal.
 * Mengembalikan array { filename, category, normalized, score } terurut dari paling cocok.
 */
function findMatches(query, items) {
    const qTokens = normalizeName(query).split(' ').filter(Boolean)
    const qCompact = compact(query)

    const scored = []
    for (const item of items) {
        const normalized = normalizeName(item.filename)
        const nCompact = compact(normalized)

        let score = 0
        if (nCompact === qCompact) {
            score = 1000 // exact match (tanpa spasi)
        } else if (nCompact.includes(qCompact)) {
            score = 500 // query adalah substring persis dari nama
        } else {
            const allTokensPresent = qTokens.every((t) => normalized.includes(t))
            if (allTokensPresent) {
                score = 100 + qTokens.length
            }
        }

        if (score > 0) {
            scored.push({ filename: item.filename, category: item.category, normalized, score })
        }
    }

    scored.sort((a, b) => b.score - a.score)
    return scored
}

async function downloadBuffer(url) {
    const res = await axios.get(url, {
        headers: HEADERS,
        responseType: 'arraybuffer',
        timeout: 15000
    })
    return Buffer.from(res.data)
}

/**
 * Baca lebar & tinggi dari header PNG (chunk IHDR), tanpa perlu library gambar tambahan.
 */
function getPngDimensions(buffer) {
    if (!buffer || buffer.length < 24) return null
    if (buffer.readUInt32BE(0) !== 0x89504e47) return null // signature PNG
    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20)
    }
}

function cacheList(chatId, items, offset = 0) {
    lastListCache.set(chatId, { items, offset, timestamp: Date.now() })
}

function getCachedList(chatId) {
    const cached = lastListCache.get(chatId)
    if (!cached) return null
    if (Date.now() - cached.timestamp > LIST_CACHE_TTL_MS) {
        lastListCache.delete(chatId)
        return null
    }
    return cached
}

function errorReply(m, error) {
    m.react('❌')
    return m.reply(
        `『 💥 *E R R O R* 』\n\n` +
        `> ${error.message || 'Unknown error'}\n\n` +
        `> 💔 Maaf ya~ Ai gagal kali ini...\n` +
        `> Coba lagi nanti ya~ 🌸`
    )
}

function noIndexReply(m) {
    m.react('❌')
    const detail = lastScrapeErrors.length
        ? '\n\n```' + lastScrapeErrors.slice(0, 6).join('\n') + '```'
        : ''
    return m.reply(
        `『 💥 *E R R O R* 』\n\n` +
        `> Ai gagal ambil daftar objek dari wiki 😢\n` +
        `> Coba lagi beberapa saat ya~${detail}`
    )
}

/**
 * Kirim gambar + dokumen PNG objek beserta caption info lengkap.
 */
async function sendObject(m, sock, item) {
    try {
        const imgUrl = `${IMG_BASE}${item.filename}`
        const buffer = await downloadBuffer(imgUrl)
        const dimensions = getPngDimensions(buffer)
        const sizeKb = (buffer.length / 1024).toFixed(1)
        const normalized = normalizeName(item.filename)

        m.react('✅')

        await sock.sendMessage(m.chat, {
            image: buffer,
            caption:
                `『 🌟 *ʜᴏsʜɪɴᴏ ᴀɪ* — ᴏʙᴊᴇᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ 🌟 』\n` +
                `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
                `🖼️ *Nama:* ${normalized}\n` +
                `📁 *Filename:* ${item.filename}\n` +
                `🏷️ *Kategori:* ${item.category || '-'}\n` +
                (dimensions ? `📐 *Dimensi:* ${dimensions.width}x${dimensions.height}px\n` : '') +
                `💾 *Ukuran file:* ${sizeKb} KB\n` +
                `🔗 *Sumber:* ${imgUrl}\n\n` +
                `> 💖 Ini objeknya~ file PNG-nya nyusul di bawah! ✨`
        }, { quoted: m })

        await sock.sendMessage(m.chat, {
            document: buffer,
            mimetype: 'image/png',
            fileName: item.filename
        }, { quoted: m })
    } catch (error) {
        errorReply(m, error)
    }
}

async function handleListCase(m, page) {
    m.react('⭐')
    try {
        const items = await getObjectIndex()
        if (!items.length) return noIndexReply(m)

        const sorted = [...items].sort((a, b) => a.filename.localeCompare(b.filename))
        const totalPages = Math.max(1, Math.ceil(sorted.length / LIST_PAGE_SIZE))
        const clampedPage = Math.min(Math.max(1, page), totalPages)
        const start = (clampedPage - 1) * LIST_PAGE_SIZE
        const pageItems = sorted.slice(start, start + LIST_PAGE_SIZE)

        cacheList(m.chat, pageItems, start)

        const list = pageItems
            .map((it, i) => `│ ${start + i + 1}. ${it.filename}`)
            .join('\n')

        m.react('✅')
        return m.reply(
            `『 📋 *ᴅᴀꜰᴛᴀʀ ᴏʙᴊᴇᴋ ɢᴇᴏᴍᴇᴛʀʏ ᴅᴀsʜ* 📋 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `📄 *Halaman:* ${clampedPage}/${totalPages}\n` +
            `📦 *Total objek:* ${sorted.length}\n\n` +
            list + '\n\n' +
            `💡 *Tips:*\n` +
            `• Ambil objek langsung pakai nomor: \`${m.prefix}objgd ${start + 1}\`\n` +
            `• Lihat halaman lain: \`${m.prefix}objgd --list ${clampedPage + 1}\`\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `🌸 *Hoshino Ai Bot* ✨`
        )
    } catch (error) {
        errorReply(m, error)
    }
}

async function handleNumberSelection(m, sock, number) {
    m.react('⭐')
    const cached = getCachedList(m.chat)
    if (!cached) {
        m.react('❌')
        return m.reply(
            `『 💔 *Belum Ada Daftar~* 』\n\n` +
            `> Belum ada daftar objek aktif di chat ini nih~\n` +
            `> Coba \`${m.prefix}objgd --list\` dulu ya buat liat daftarnya~ 💕`
        )
    }

    const localIndex = number - 1 - cached.offset
    const item = cached.items[localIndex]

    if (!item) {
        m.react('❌')
        return m.reply(
            `『 💔 *Nomor Gak Valid~* 』\n\n` +
            `> Nomor \`${number}\` gak ada di daftar yang lagi aktif~\n` +
            `> Coba \`${m.prefix}objgd --list\` lagi buat liat nomor yang valid~ 💕`
        )
    }

    return sendObject(m, sock, item)
}

async function handleSearch(m, sock, query) {
    m.react('⭐')
    try {
        const items = await getObjectIndex()
        if (!items.length) return noIndexReply(m)

        const matches = findMatches(query, items)

        if (!matches.length) {
            m.react('❌')
            return m.reply(
                `『 💔 *Tidak Ditemukan~* 』\n\n` +
                `> Objek dengan kata kunci \`${query}\` gak ketemu nih~\n` +
                `> Coba kata kunci lain, atau cek \`${m.prefix}objgd --list\` ya~ 💕`
            )
        }

        const top = matches[0]
        const isConfident = top.score >= 500 || matches.length === 1

        if (isConfident) {
            return sendObject(m, sock, top)
        }

        // Beberapa kandidat mirip skor-nya -> tampilkan list, minta refine (bisa pakai nomor)
        const pageItems = matches.slice(0, RESULT_LIMIT)
        cacheList(m.chat, pageItems, 0)

        const list = pageItems
            .map((r, i) => `│ ${i + 1}. ${r.filename}`)
            .join('\n')

        m.react('✅')
        return m.reply(
            `『 🌟 *ʜᴏsʜɪɴᴏ ᴀɪ* — ʜᴀsɪʟ ᴘᴇɴᴄᴀʀɪᴀɴ 🌟 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `🔍 *Kata kunci:* ${query}\n` +
            `📋 *Ada beberapa objek yang mirip:*\n\n` +
            list + '\n\n' +
            `💡 *Tips:* Pilih pakai nomor, contoh: \`${m.prefix}objgd 1\`\n` +
            `atau ketik ulang pakai nama yang lebih spesifik~\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `🌸 *Hoshino Ai Bot* ✨`
        )
    } catch (error) {
        errorReply(m, error)
    }
}

async function handler(m, { sock }) {
    const rawArgs = m.args.join(' ').trim()

    if (!rawArgs) {
        return m.reply(
            `『 🔍 *ᴄᴀʀɪ ᴏʙᴊᴇᴋ ɢᴇᴏᴍᴇᴛʀʏ ᴅᴀsʜ* 🔍 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `✨ *Cara pakai:*\n` +
            `\`${m.prefix}objgd <nama objek>\`\n` +
            `\`${m.prefix}objgd <nomor>\` (dari daftar terakhir)\n` +
            `\`${m.prefix}objgd --list [halaman]\`\n\n` +
            `💫 *Contoh:*\n` +
            `\`${m.prefix}objgd regular block 01\`\n` +
            `\`${m.prefix}objgd --list 2\`\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `> 💖 Ai bantu cariin objek GD-nya~ 🌸`
        )
    }

    // Case --list [halaman]
    if (/^--list\b/i.test(rawArgs)) {
        const rest = rawArgs.replace(/^--list\s*/i, '').trim()
        const page = parseInt(rest, 10) || 1
        return handleListCase(m, page)
    }

    // Pilih dari daftar terakhir pakai nomor
    if (/^\d+$/.test(rawArgs)) {
        return handleNumberSelection(m, sock, parseInt(rawArgs, 10))
    }

    // Search biasa by nama
    return handleSearch(m, sock, rawArgs)
}

module.exports = {
    config: pluginConfig,
    handler
}