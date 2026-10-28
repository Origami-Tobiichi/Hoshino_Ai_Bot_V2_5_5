const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: 'bratvid',
    alias: ['bratgif', 'bratvideo'],
    category: 'sticker',
    description: 'Membuat sticker brat animated',
    usage: '.bratvid <text>',
    example: '.bratvid Hai semua',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 1,
    isEnabled: true
}

const MAX_LENGTH = 200

// Ambil video dari API (support response langsung berupa video, atau JSON berisi url)
async function fetchFromApi(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000
    })
    const type = String(res.headers['content-type'] || '')
    let buffer = Buffer.from(res.data)

    if (type.includes('json')) {
        const json = JSON.parse(buffer.toString())
        const link = json.url || json.result?.url || json.result || json.data?.url || json.data
        if (typeof link !== 'string' || !/^https?:\/\//.test(link)) {
            throw new Error('Response JSON tidak berisi url video')
        }
        const dl = await axios.get(link, { responseType: 'arraybuffer', timeout: 30000 })
        buffer = Buffer.from(dl.data)
    }

    if (!buffer.length) throw new Error('Response API kosong')
    return buffer
}

// 1. api-faa
async function generateFaa(text) {
    return fetchFromApi(`https://api-faa.my.id/faa/bratvid?text=${encodeURIComponent(text)}`)
}

// 2. nexray
async function generateNexray(text) {
    return fetchFromApi(`https://api.nexray.web.id/maker/bratvid?text=${encodeURIComponent(text)}`)
}

// 3. brat-canvas lokal (ESM, jadi pakai dynamic import)
const CANDIDATES = ['brat-canvas/video', 'brat-canvas']
let bratVidFn = null

async function loadBratVid() {
    if (bratVidFn) return bratVidFn

    const errors = []
    for (const id of CANDIDATES) {
        try {
            const mod = await import(id)
            const fn = mod.bratVid || mod.default?.bratVid || (typeof mod.default === 'function' ? mod.default : null)
            if (typeof fn === 'function') {
                bratVidFn = fn
                return fn
            }
            errors.push(`${id}: export bratVid tidak ada`)
        } catch (e) {
            errors.push(`${id}: ${e.message}`)
        }
    }
    throw new Error(`brat-canvas tidak bisa dimuat. ${errors.join(' | ')}`)
}

async function generateLocal(text) {
    const bratVid = await loadBratVid()
    const vid = await bratVid(text, {
        outputFormat: 'mp4',
        fast_progress: true,
        lyric: { maxWordPerLayer: 5 }
    })
    if (!vid) throw new Error('Hasil brat-canvas kosong')
    return vid
}

async function handler(m, { sock }) {
    const text = m.args.join(' ') || m.quoted?.text || m.quoted?.body || ''

    if (!text) {
        return m.reply(`🎬 *ʙʀᴀᴛ ᴀɴɪᴍᴀᴛᴇᴅ*\n\n> Masukkan teks atau reply pesan\n\n\`Contoh: ${m.prefix}bratvid Hai semua\``)
    }

    if (text.length > MAX_LENGTH) {
        return m.reply(`❌ *ᴛᴇᴋs ᴛᴇʀʟᴀʟᴜ ᴘᴀɴᴊᴀɴɢ*\n\n> Maksimal ${MAX_LENGTH} karakter`)
    }

    m.react('🕕')

    const methods = [
        { name: 'api-faa', run: generateFaa },
        { name: 'nexray', run: generateNexray },
        { name: 'brat-canvas', run: generateLocal }
    ]

    const errors = []

    for (const method of methods) {
        try {
            const vid = await method.run(text)
            await sock.sendVideoAsSticker(m.chat, vid, m, {
                packname: config.sticker.packname,
                author: config.sticker.author
            })
            m.react('✅')
            return
        } catch (error) {
            errors.push(`${method.name}: ${error.message}`)
            console.error(`[bratvid] ${method.name} gagal:`, error.message)
        }
    }

    m.react('❌')
    m.reply(`❌ *Gomen ne~* ✦\n\n> Semua metode gagal\n\n${errors.map(e => `> ${e}`).join('\n')}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
}

module.exports = {
    config: pluginConfig,
    handler
}