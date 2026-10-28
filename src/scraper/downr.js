const axios = require('axios')

const BASE_URL = 'https://downr.org'
const UA = 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36'

const HEADERS = {
    'authority': 'downr.org',
    'accept': '*/*',
    'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'content-type': 'application/json',
    'origin': BASE_URL,
    'referer': `${BASE_URL}/`,
    'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"Android"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': UA
}

function mergeCookies(...headers) {
    const jar = {}
    for (const h of headers) {
        if (!h) continue
        const items = Array.isArray(h) ? h : [h]
        for (const item of items) {
            const part = item.split(';')[0]
            const i = part.indexOf('=')
            if (i > -1) jar[part.slice(0, i).trim()] = part.slice(i + 1).trim()
        }
    }
    return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
}

// Bikin session baru tiap request, jangan hardcode cookie GA/Clarity lama.
// 1. GET homepage buat cookie awal
// 2. GET endpoint analytics (situs ini butuh ini sebelum nyt/download jalan)
// 3. Gabungin semua set-cookie yang didapat
async function getSessionCookie() {
    const home = await axios.get(`${BASE_URL}/`, {
        headers: { ...HEADERS },
        validateStatus: () => true
    })
    const cookieAfterHome = mergeCookies(home.headers['set-cookie'])

    const analytics = await axios.get(`${BASE_URL}/.netlify/functions/analytics`, {
        headers: { ...HEADERS, cookie: cookieAfterHome },
        validateStatus: () => true
    })
    const cookieAfterAnalytics = mergeCookies(home.headers['set-cookie'], analytics.headers['set-cookie'])

    return cookieAfterAnalytics || cookieAfterHome
}

// downr nolak link Instagram yang masih ada tracking query (?igsh=, ?img_index=, dll),
// tapi platform lain (misal YouTube) butuh query-nya (?v=...), jadi cuma bersihin IG aja.
function cleanUrl(url) {
    if (/instagram\.com/i.test(url)) {
        return url.split('?')[0]
    }
    return url
}

async function getVideoInfo(url) {
    url = cleanUrl(url)
    const cookie = await getSessionCookie()

    const res = await axios.post(
        `${BASE_URL}/.netlify/functions/nyt`,
        { url },
        {
            headers: { ...HEADERS, cookie },
            validateStatus: () => true
        }
    )

    const data = res.data
    if (!data || typeof data !== 'object' || (!data.medias && !data.url)) {
        throw new Error(`downr: response nggak valid (status ${res.status})`)
    }

    return {
        url: data.url || null,
        title: data.title || null,
        author: data.author || null,
        duration: data.duration || null,
        thumbnail: data.thumbnail || null,
        medias: data.medias || []
    }
}

module.exports = { getVideoInfo }