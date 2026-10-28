const cheerio = require('cheerio')
const axios = require('axios')

const BASE_URL = 'https://reelsvideo.io'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

class ReelsSession {
    constructor() {
        this.cookies = {}
        this.tt = null
        this.ts = null
    }

    cookieHeader() {
        return Object.entries(this.cookies)
            .filter(([, v]) => v !== undefined && v !== null && String(v).length)
            .map(([k, v]) => `${k}=${v}`)
            .join('; ')
    }

    saveCookies(setCookieHeader) {
        if (!setCookieHeader) return
        const items = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]
        for (const item of items) {
            const part = item.split(';')[0]
            const i = part.indexOf('=')
            if (i > -1) this.cookies[part.slice(0, i).trim()] = part.slice(i + 1).trim()
        }
    }

    // GET halaman utama dulu buat dapetin cookie session sebelum POST.
    // Tanpa ini, server sering nolak POST dan balikin pesan rate-limit generik.
    async warmup() {
        const res = await axios.get(`${BASE_URL}/`, {
            timeout: 30000,
            headers: {
                'User-Agent': UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            validateStatus: () => true
        })

        this.saveCookies(res.headers['set-cookie'])

        // tt/ts sekarang di-generate server-side dan ditanam di hidden input,
        // bukan dihitung dari formula MD5 statis lagi (secret lama udah invalid)
        const $ = cheerio.load(res.data)
        this.ts = $('#ts').attr('value') || null
        this.tt = $('#tt').attr('value') || null

        if (!this.ts || !this.tt) {
            const err = new Error('reelsvideo: gagal ambil tt/ts dari halaman warmup')
            err.isMissingToken = true
            throw err
        }

        return res.data
    }

    async submit(url) {
        if (!this.tt || !this.ts) {
            throw new Error('reelsvideo: submit() dipanggil sebelum warmup() berhasil')
        }

        const body = new URLSearchParams()
        body.append('id', url)
        body.append('locale', 'en')
        body.append('cf-turnstile-response', '')
        body.append('tt', this.tt)
        body.append('ts', this.ts)

        const res = await axios.post(`${BASE_URL}/`, body, {
            timeout: 30000,
            headers: {
                'User-Agent': UA,
                'Accept': '*/*',
                'hx-request': 'true',
                'hx-current-url': `${BASE_URL}/`,
                'hx-target': 'target',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Origin': BASE_URL,
                'Referer': `${BASE_URL}/`,
                'Cookie': this.cookieHeader()
            },
            validateStatus: () => true
        })

        this.saveCookies(res.headers['set-cookie'])
        return res
    }
}

async function fetchReels(url) {
    const session = new ReelsSession()

    // 1. Warmup: ambil cookie session dari halaman utama
    await session.warmup()

    // 2. Submit form dengan cookie yang udah didapat
    const res = await session.submit(url)

    const rawHtml = typeof res.data === 'string' ? res.data : ''

    if (/making requests too fast/i.test(rawHtml)) {
        const err = new Error('reelsvideo: rate limited oleh server')
        err.isRateLimit = true
        throw err
    }

    if (res.status !== 200) {
        throw new Error(`reelsvideo: server merespons status ${res.status}`)
    }

    const $ = cheerio.load(rawHtml)

    const username = $('.bg-white span.text-400-16-18').first().text().trim() || null
    const thumb = $('div[data-bg]').first().attr('data-bg') || null

    const videos = []
    $('a.type_videos').each((_, el) => {
        const href = $(el).attr('href')
        if (href) videos.push(href)
    })

    const images = []
    $('a.type_images').each((_, el) => {
        const href = $(el).attr('href')
        if (href) images.push(href)
    })

    const mp3 = []
    $('a.type_audio').each((_, el) => {
        const href = $(el).attr('href')
        const id = $(el).attr('data-id')
        if (href && id) mp3.push({ id, url: href })
    })

    let type = 'unknown'
    if (videos.length && images.length) type = 'carousel'
    else if (videos.length) type = 'video'
    else if (images.length) type = 'photo'

    return { type, username, thumb, videos, images, mp3 }
}

async function reelsvideo(url, maxRetry = 3, retryDelay = 11000) {
    let lastError
    for (let attempt = 1; attempt <= maxRetry; attempt++) {
        try {
            const result = await fetchReels(url)
            if (result.type === 'unknown' && attempt < maxRetry) {
                await delay(retryDelay)
                continue
            }
            return result
        } catch (err) {
            lastError = err
            if (attempt < maxRetry) {
                const waitTime = err.isRateLimit ? retryDelay * 1.5 : retryDelay
                await delay(waitTime)
            }
        }
    }
    throw lastError
}

module.exports = { reelsvideo }
