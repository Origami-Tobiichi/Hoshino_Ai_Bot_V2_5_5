const axios = require('axios')

const BASE_URL = 'https://saveig.in'
const API_URL = 'https://saveig.in/wp-json/visolix/api/download'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

// Beberapa pola umum tempat WP nge-localize nonce ke halaman.
// Nonce WP standar = 10 karakter hex-ish, tapi kita nggak asumsiin persis itu,
// cukup ambil grup ("nonce":"...") pertama yang match dari salah satu pola.
const NONCE_PATTERNS = [
    /visolix[\w-]*\s*=\s*{[^}]*?"nonce"\s*:\s*"([a-zA-Z0-9]+)"/i,
    /"nonce"\s*:\s*"([a-zA-Z0-9]{6,20})"/i,
    /data-nonce=["']([a-zA-Z0-9]{6,20})["']/i,
    /x-visolix-nonce["']?\s*[:=]\s*["']([a-zA-Z0-9]{6,20})["']/i
]

function extractNonce(html) {
    for (const re of NONCE_PATTERNS) {
        const m = html.match(re)
        if (m && m[1]) return m[1]
    }
    return null
}

// Ambil halaman utama buat nyari nonce yang masih hidup.
// WP nonce biasanya cuma valid belasan jam, jadi jangan pernah di-hardcode.
async function fetchNonce() {
    const res = await axios.get(`${BASE_URL}/`, {
        timeout: 30000,
        headers: {
            'User-Agent': UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        validateStatus: () => true
    })

    if (res.status !== 200 || typeof res.data !== 'string') {
        throw new Error(`saveig: gagal fetch homepage, status ${res.status}`)
    }

    const nonce = extractNonce(res.data)
    if (!nonce) {
        const err = new Error('saveig: nonce nggak ketemu di homepage, pola regex perlu diupdate')
        err.isMissingNonce = true
        throw err
    }
    return nonce
}

// Server saveig.in kadang balikin HTTP 200 + json.status:true walau
// sebenarnya gagal ambil media (misal post private/dibatasi/tidak didukung).
// Pesan errornya di-embed di dalam HTML json.data, jadi harus dicek manual.
const SERVER_ERROR_PATTERNS = [
    /download-error/i,
    /download link not found/i
]

function extractServerErrorMessage(html) {
    for (const re of SERVER_ERROR_PATTERNS) {
        if (re.test(html)) {
            const m = html.match(/<div id=['"]download-error['"]>([^<]+)<\/div>/i)
            return m ? m[1].trim() : 'Download link not found'
        }
    }
    return null
}

async function saveig(url) {
    const nonce = await fetchNonce()

    const res = await axios.post(API_URL, {
        url,
        format: '',
        captcha_response: null
    }, {
        timeout: 30000,
        headers: {
            'accept': '*/*',
            'content-type': 'application/json',
            'origin': BASE_URL,
            'referer': `${BASE_URL}/`,
            'user-agent': UA,
            'x-visolix-nonce': nonce
        },
        validateStatus: () => true
    })

    const json = res.data

    if (!json || typeof json !== 'object') {
        throw new Error(`saveig: response nggak valid, status ${res.status}`)
    }

    if (!json.status) {
        const msg = json.message || json.data || 'unknown error'
        const err = new Error(`saveig: gagal fetch media - ${msg}`)
        if (res.status === 403 || /nonce/i.test(String(msg))) err.isMissingNonce = true
        throw err
    }

    const html = json.data

    // Cek dulu apakah html ini sebenarnya pesan error yang nyamar jadi status:true
    const serverErrMsg = extractServerErrorMessage(html)
    if (serverErrMsg) {
        const err = new Error(`saveig: server gagal ambil media - "${serverErrMsg}" (kemungkinan post private/dibatasi/tidak didukung)`)
        err.isServerSideFailure = true
        throw err
    }

    const results = [...html.matchAll(/href="([^"]*dl\.php\?id=[^"]+)"/g)]
        .map(m => m[1].replace(/&amp;/g, '&'))

    if (!results.length) {
        // Fallback safety: kalau bukan pola error yang dikenal tapi tetep kosong,
        // biar ketauan ini kasus baru yang belum ke-cover regex/pattern manapun.
        const err = new Error('saveig: hasil kosong dan bukan pola error yang dikenal, kemungkinan format HTML server berubah')
        err.isUnknownEmptyResult = true
        throw err
    }

    return {
        status: true,
        url,
        total: results.length,
        result: results
    }
}

async function saveigRetry(url, maxRetry = 2, retryDelay = 4000) {
    let lastError
    for (let attempt = 1; attempt <= maxRetry; attempt++) {
        try {
            return await saveig(url)
        } catch (err) {
            lastError = err
            // Kalau ini kegagalan sisi server (post beneran nggak bisa diambil),
            // retry nggak akan ngebantu, jadi langsung lempar tanpa nunggu.
            if (err.isServerSideFailure) throw err
            // nonce expired di tengah jalan -> retry langsung fetch ulang nonce baru
            if (attempt < maxRetry) await new Promise(r => setTimeout(r, retryDelay))
        }
    }
    throw lastError
}

module.exports = { saveig: saveigRetry }

// Usage (jalanin langsung: node saveig.js)
if (require.main === module) {
    (async () => {
        try {
            const data = await saveigRetry(
                process.argv[2] || 'https://www.instagram.com/p/DZm4ZVYk00W/?img_index=1'
            )
            console.log(JSON.stringify(data, null, 2))
        } catch (err) {
            console.error('ERROR:', err.message)
        }
    })()
}