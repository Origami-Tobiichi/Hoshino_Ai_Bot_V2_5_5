const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')
let PDFDocument

try {
    PDFDocument = require('pdfkit')
} catch {
    console.log('[Webtoons] pdfkit belum di install!')
}

const { finished } = require('stream/promises')
const TMP_DIR = path.join(__dirname, '../../tmp')

// ================= CONFIG =================
const config = {
    name: 'webtoons',
    alias: ['wt'],
    category: 'anime',
    description: 'Webtoons WA + PDF + kategori filter',
    usage: '.webtoons search <judul> [original|canvas]',
    example: '.webtoons search my dear cold-blooded king original',
    isOwner: false,
    isGroup: false,
    isPrivate: false
}

// ================= HELPERS =================
async function downloadImage(url, filepath) {
    const res = await axios({ url, responseType: 'stream', headers: { 'User-Agent': 'Mozilla/5.0' } })
    const writer = fs.createWriteStream(filepath)
    res.data.pipe(writer)
    await finished(writer)
}

// ================= SEARCH =================
async function searchWebtoon(query, category='original') {
    const searchUrl = `https://www.webtoons.com/en/search?keyword=${encodeURIComponent(query)}`
    const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const $ = cheerio.load(data)
    const results = []

    $('ul#searchList > li').each((i, el) => {
        const type = $(el).find('.badge').text().toLowerCase() || 'original'
        if (category && type !== category.toLowerCase()) return // filter kategori

        const a = $(el).find('a')
        results.push({
            title: $(el).find('.subj').text().trim(),
            author: $(el).find('.author').text().trim(),
            link: a.attr('href'),
            thumbnail: $(el).find('img').attr('src'),
            category: type
        })
    })
    return results.slice(0, 5)
}

// ================= DETAIL =================
async function detailWebtoon(url) {
    const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const $ = cheerio.load(data)

    const title = $('h1').text().trim() || 'Unknown'
    const desc = $('.summary').text().trim() || '-'
    const episodes = []

    $('.episode_lst a').each((i, el) => {
        const link = $(el).attr('href')
        const epTitle = $(el).find('.subj').text().trim()
        episodes.push({ title: epTitle, link })
    })

    return { title, desc, episodes }
}

// ================= PDF =================
async function downloadEpisodePDF(episodeUrl, filename) {
    if (!PDFDocument) throw 'pdfkit belum di install!'

    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })

    const { data } = await axios.get(episodeUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const $ = cheerio.load(data)
    const images = []

    $('.viewer_img img').each((i, el) => {
        const src = $(el).attr('data-url') || $(el).attr('src')
        if (src) images.push(src)
    })

    if (!images.length) throw 'Tidak ada gambar di episode ini!'

    const files = []
    for (let i = 0; i < images.length; i++) {
        const file = path.join(TMP_DIR, `page-${Date.now()}-${i}.jpg`)
        await downloadImage(images[i], file)
        files.push(file)
    }

    const pdfPath = path.join(TMP_DIR, filename)
    const doc = new PDFDocument({ autoFirstPage: false })
    const stream = fs.createWriteStream(pdfPath)
    doc.pipe(stream)

    for (const img of files) {
        doc.addPage()
        doc.image(img, 0, 0, { fit: [595, 842] })
    }

    doc.end()
    await finished(stream)
    files.forEach(f => fs.unlinkSync(f))
    return pdfPath
}

// ================= HANDLER =================
async function handler(m, { sock }) {
    const full = (m.text || '').trim()
    const args = full.split(' ').slice(1)
    const sub = (args[0] || '').toLowerCase()

    if (!sub) return m.reply(`🌸 *Webtoons Bot*

╭┈┈⬡「 📚 MENU 」
┃ 🔎 search
┃ > .webtoons search <judul> [original|canvas]
┃
┃ 📖 detail
┃ > .webtoons detail <url>
┃
┃ 📥 download
┃ > .webtoons download <episode_url>
╰┈┈⬡`)

    // ===== SEARCH =====
    if (sub === 'search') {
        const q = args.slice(1, -1).join(' ')
        const category = args[args.length - 1] || 'original'
        if (!q) return m.reply('❌ *Ehh~* Contoh: .webtoons search my dear cold-blooded king original~ 🥺')

        m.reply('🔍 Searching...')
        try {
            const res = await searchWebtoon(q, category)
            if (!res.length) return m.reply('❌ *Ehh~* Tidak ditemukan~ 🥺')

            let txt = `🌸 *Hasil Search*\n\n`
            res.forEach((v, i) => {
                txt += `${i + 1}. ${v.title}\n`
                txt += `Author: ${v.author}\n`
                txt += `Category: ${v.category}\n`
                txt += `Link: ${v.link}\n\n`
            })
            m.reply(txt)
        } catch (e) {
            console.error(e)
            m.reply('❌ *Gomen ne~* Error saat search~ 🥺')
        }
    }

    // ===== DETAIL =====
    else if (sub === 'detail') {
        const url = args[1]
        if (!url) return m.reply('❌ *Ehh~* Masukkan link~ 🥺')

        m.reply('⏳ Mengambil detail...')
        try {
            const data = await detailWebtoon(url)
            let txt = `🌸 *${data.title}*\n\n`
            txt += `📝 ${data.desc}\n\n`
            txt += `📚 Episodes:\n`
            data.episodes.slice(0, 20).forEach((ep, i) => {
                txt += `${i + 1}. ${ep.title}\n`
                txt += `${ep.link}\n\n`
            })
            txt += `\nGunakan:\n.webtoons download <episode_url>`
            m.reply(txt)
        } catch (e) {
            console.error(e)
            m.reply('❌ *Gomen ne~* Gagal ambil detail~ 🥺')
        }
    }

    // ===== DOWNLOAD =====
    else if (sub === 'download') {
        const episodeUrl = args[1]
        if (!episodeUrl) return m.reply('❌ *Ehh~* Masukkan episode URL~ 🥺')

        m.reply('📥 Downloading PDF...')
        try {
            const filename = `webtoons-${Date.now()}.pdf`
            const pdfPath = await downloadEpisodePDF(episodeUrl, filename)

            await sock.sendMessage(m.chat, {
                document: { url: pdfPath },
                mimetype: 'application/pdf',
                fileName: filename
            })
            fs.unlinkSync(pdfPath)
        } catch (e) {
            console.error(e)
            m.reply(`❌ Gagal!\n${e}`)
        }
    }

    else {
        m.reply('❌ *Ehh~* Perintah tidak dikenal~ 🥺')
    }
}

module.exports = { config, handler }