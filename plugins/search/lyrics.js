const axios = require('axios')

const AI = { warn: (...a) => console.error('[lirik]', ...a) }
const sleep = ms => new Promise(r => setTimeout(r, ms))

// Request dengan retry untuk error 5xx / 429 / timeout
async function req(url, opts = {}, tries = 3) {
    let err
    for (let i = 0; i < tries; i++) {
        try {
            return await axios.get(url, {
                timeout: 15000,
                headers: { 'User-Agent': 'HoshinoAiBot/1.0 (https://github.com/hsnai)' },
                ...opts
            })
        } catch (e) {
            err = e
            const s = e.response?.status
            // error 4xx (selain 429) tidak perlu diulang
            if (s && s < 500 && s !== 429) break
            await sleep(1000 * (i + 1))
        }
    }
    throw err
}

async function fromLrclib(query) {
    const bersih = query.replace(/\s*[-–]\s*/g, ' ').replace(/\s+/g, ' ').trim()
    const p = query.split(/\s*[-–]\s*/).map(s => s.trim())

    const percobaan = [{ q: bersih }, { q: query }]
    if (p.length >= 2) {
        // coba kedua urutan: "artis - judul" dan "judul - artis"
        percobaan.push({ artist_name: p[0], track_name: p.slice(1).join(' ') })
        percobaan.push({ artist_name: p.slice(1).join(' '), track_name: p[0] })
    }

    let gagal = 0
    let lastErr
    for (const params of percobaan) {
        try {
            const { data } = await req('https://lrclib.net/api/search', { params }, 2)
            const t = (Array.isArray(data) ? data : [])
                .find(x => x.plainLyrics && !x.instrumental)
            if (t) {
                return {
                    judul: t.trackName || query,
                    artis: t.artistName || '-',
                    lirik: t.plainLyrics.trim(),
                    sumber: 'LRCLIB'
                }
            }
        } catch (e) {
            gagal++
            lastErr = e
            AI.warn('lrclib', JSON.stringify(params), e.message)
        }
    }
    // kalau SEMUA percobaan error, lempar error biar lanjut ke fallback
    if (gagal === percobaan.length) throw lastErr
    return null
}

async function fromLyricsOvh(query) {
    const p = query.split(/\s*[-–]\s*/)
    if (p.length < 2) return null
    const [a, b] = [p[0].trim(), p.slice(1).join(' ').trim()]

    // urutan "artis - judul" atau "judul - artis", coba keduanya
    for (const [artis, judul] of [[a, b], [b, a]]) {
        try {
            const { data } = await req(
                `https://api.lyrics.ovh/v1/${encodeURIComponent(artis)}/${encodeURIComponent(judul)}`,
                {}, 1
            )
            if (data?.lyrics) {
                return { judul, artis, lirik: data.lyrics.trim(), sumber: 'lyrics.ovh' }
            }
        } catch (e) {
            AI.warn('lyrics.ovh', artis, judul, e.message)
        }
    }
    return null
}

async function getLyrics(query) {
    let lastErr
    for (const sumber of [fromLrclib, fromLyricsOvh]) {
        try {
            const r = await sumber(query)
            if (r) return r
        } catch (e) {
            lastErr = e
            AI.warn(sumber.name, e.message)
        }
    }
    throw new Error(
        lastErr
            ? 'Server lirik lagi gangguan, coba lagi nanti ya'
            : 'Lirik tidak ditemukan'
    )
}

const pluginConfig = {
    name: 'lyrics',
    alias: ['lyric', 'lirik', 'liriklagu'],
    category: 'search',
    description: 'Cari lirik lagu',
    usage: '.lirik <query>',
    example: '.lirik Somewhere only we know',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const query = m.text?.trim()

    if (!query) {
        return m.reply(
            `╭┈┈⬡「 ʟɪʀɪᴋ ʟᴀɢᴜ 」\n` +
            `│ Masukkan kata kunci pencarian\n` +
            `│\n` +
            `│ Contoh: \`${m.prefix}lirik Somewhere only we know\`\n` +
            `╰┈┈⬡`
        )
    }

    await m.react('🔍')

    try {
        const hasil = await getLyrics(query)

        let teks = `╭┈┈⬡「 🎶 ʟɪʀɪᴋ ʟᴀɢᴜ 」\n`
        teks += `│ *${hasil.judul}*\n`
        teks += `│ ${hasil.artis}\n`
        teks += `╰┈┈⬡\n\n`
        teks += `${hasil.lirik}\n\n`
        teks += `> sumber: ${hasil.sumber}`

        await m.reply(teks)
        await m.react('💖')
    } catch (error) {
        AI.warn(error)
        await m.react('❌')
        await m.reply(
            `╭┈┈⬡「 ❌ ᴇʀʀᴏʀ 」\n` +
            `│ Ai gagal nemuin liriknya~ 🌸\n` +
            `│ ${error.message}\n` +
            `╰┈┈⬡`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}