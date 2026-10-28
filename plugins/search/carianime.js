const axios = require('axios')
const config = require('../../config')
const { AIRich } = require('../../src/lib/aiRich')

const NEOXR_APIKEY = config.APIkey?.neoxr || 'Milik-Bot-OurinMD'

const pluginConfig = {
    name: 'carianime',
    alias: ['carianime', 'cariAnime'],
    category: 'search',
    description: 'Cari informasi lengkap anime',
    usage: '.carianime <judul>',
    example: '.carianime jujutsu kaisen',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const QUERY = `
query ($search: String) {
    Media(search: $search, type: ANIME) {
        id
        title { romaji english native }
        description(asHtml: false)
        format
        status
        episodes
        duration
        season
        seasonYear
        averageScore
        popularity
        favourites
        genres
        studios(isMain: true) { nodes { name } }
        startDate { year month day }
        endDate { year month day }
        coverImage { extraLarge }
        siteUrl
        rankings { rank type allTime }
    }
}
`

function formatDate(date) {
    if (!date?.year) return 'N/A'
    return `${date.day || '?'}/${date.month || '?'}/${date.year}`
}

function formatStatus(status) {
    const map = {
        FINISHED: '✅ Selesai',
        RELEASING: '🔴 Ongoing',
        NOT_YET_RELEASED: '⏳ Belum Tayang',
        CANCELLED: '❌ Dibatalkan',
        HIATUS: '⏸️ Hiatus'
    }
    return map[status] || status
}

function formatSeason(season, year) {
    if (!season) return 'N/A'
    const map = { WINTER: '❄️ Winter', SPRING: '🌸 Spring', SUMMER: '☀️ Summer', FALL: '🍂 Fall' }
    return `${map[season] || season} ${year || ''}`
}

function formatFormat(format) {
    const map = {
        TV: 'TV Series', TV_SHORT: 'TV Short', MOVIE: 'Movie',
        SPECIAL: 'Special', OVA: 'OVA', ONA: 'ONA', MUSIC: 'Music'
    }
    return map[format] || format
}

function cleanDesc(text, maxLen = 300) {
    if (!text) return 'Tidak ada sinopsis.'
    const clean = text.replace(/<[^>]*>/g, '').replace(/\n+/g, ' ').trim()
    return clean.length > maxLen ? clean.slice(0, maxLen) + '...' : clean
}

async function handler(m, { sock }) {
    const query = m.text?.trim()

    if (!query) {
        return m.reply(
            `🎬 *ᴄᴀʀɪ ᴀɴɪᴍᴇ*\n\n` +
            `> Masukkan judul anime\n\n` +
            `> Contoh: \`${m.prefix}carianime jujutsu kaisen\``
        )
    }

    m.react('🔍')

    try {
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query: QUERY, variables: { search: query } })
        })

        const json = await res.json()
        const anime = json?.data?.Media

        if (!anime) {
            m.react('❌')
            return m.reply(`❌ *Ehh~* Tidak ditemukan anime dengan judul: *${query}*~ 🥺`)
        }

        const title = anime.title.english || anime.title.romaji
        const native = anime.title.native || ''
        const romaji = anime.title.romaji || ''
        const studio = anime.studios?.nodes?.[0]?.name || 'N/A'
        const genres = anime.genres?.join(', ') || 'N/A'
        const score = anime.averageScore ? `${anime.averageScore}/100` : 'N/A'
        const popularity = anime.popularity?.toLocaleString('id-ID') || 'N/A'
        const favourites = anime.favourites?.toLocaleString('id-ID') || 'N/A'
        const episodes = anime.episodes || 'N/A'
        const duration = anime.duration ? `${anime.duration} menit` : 'N/A'
        const topRank = anime.rankings?.find(r => r.type === 'RATED' && r.allTime)
        const rankText = topRank ? `#${topRank.rank} All Time` : 'N/A'

        const infoText =
            `*${title}*\n` +
            (native ? `_${native}_\n` : '') +
            (romaji !== title ? `_${romaji}_\n` : '') +
            `\n` +
            `📺 *Format:* ${formatFormat(anime.format)}\n` +
            `📡 *Status:* ${formatStatus(anime.status)}\n` +
            `🎬 *Episode:* ${episodes}\n` +
            `⏱️ *Durasi:* ${duration}\n` +
            `🗓️ *Season:* ${formatSeason(anime.season, anime.seasonYear)}\n` +
            `📅 *Tayang:* ${formatDate(anime.startDate)}\n` +
            `🏁 *Selesai:* ${formatDate(anime.endDate)}\n` +
            `🎨 *Studio:* ${studio}\n` +
            `🏷️ *Genre:* ${genres}\n` +
            `⭐ *Score:* ${score}\n` +
            `👥 *Populer:* ${popularity}\n` +
            `❤️ *Favorit:* ${favourites}\n` +
            `🏆 *Rank:* ${rankText}\n` +
            `\n📖 *Sinopsis:*\n${cleanDesc(anime.description)}\n` +
            `\n🔗 ${anime.siteUrl}`

        await new AIRich(sock)
            .addImage(anime.coverImage?.extraLarge)
            .addText(infoText)
            .addSuggest(anime.genres?.slice(0, 4) || [])
            .setFooter('#Sea')
            .send(m.chat, { quoted: m.raw })

        m.react('✅')

    } catch (err) {
        m.react('❌')
        return m.reply(`❌ *Gomen ne~* ✦\n\n> ${err.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}