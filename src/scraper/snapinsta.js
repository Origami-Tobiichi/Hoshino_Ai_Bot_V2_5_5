const axios = require('axios')
const FormData = require('form-data')
const cheerio = require('cheerio')

const BASE_URL = 'https://snapinsta.top'
const API_URL = 'https://snapinsta.top/action.php'
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36'

async function snapinsta(url) {
    const form = new FormData()
    form.append('url', url)
    form.append('action', 'post')

    const res = await axios.post(API_URL, form, {
        timeout: 30000,
        validateStatus: () => true,
        headers: {
            ...form.getHeaders(),
            'user-agent': UA,
            'accept': '*/*',
            'origin': BASE_URL,
            'referer': `${BASE_URL}/`
        }
    })

    if (res.status !== 200 || typeof res.data !== 'string') {
        throw new Error(`snapinsta: gagal fetch, status ${res.status}`)
    }

    const $ = cheerio.load(res.data)
    const downloads = []

    $('.download-items__btn a').each((_, el) => {
        let path = $(el).attr('href')
        if (!path) return
        if (!path.startsWith('http')) path = BASE_URL + path
        downloads.push(path)
    })

    if (!downloads.length) {
        throw new Error('snapinsta: hasil kosong, kemungkinan post private/dibatasi/tidak didukung')
    }

    return {
        status: true,
        url,
        total: downloads.length,
        result: downloads
    }
}

module.exports = { snapinsta }