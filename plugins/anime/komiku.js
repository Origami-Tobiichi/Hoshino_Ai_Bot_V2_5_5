const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')
const { finished } = require('stream/promises')

let PDFDocument
try {
    PDFDocument = require('pdfkit')
} catch {
    console.log('[Komiku] pdfkit belum di install!')
}

let sharp
try {
    sharp = require('sharp')
} catch {
    console.log('[Komiku] sharp belum di install!')
}

const TMP_DIR = path.join(__dirname, '../../tmp')
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })

const KOMIKU_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
    'Referer': 'https://komiku.org/',
    'Origin': 'https://komiku.org'
}

// ================= CONFIG =================
const pluginConfig = {
    name: 'komiku',
    alias: [],
    category: 'anime',
    description: 'Search & download manga dari Komiku',
    usage: '.komiku search <judul>',
    example: '.komiku search one piece',
    isOwner: false,
    isGroup: false,
    isPrivate: false
}

// ================= KOMIKU API =================
class KomikuAPI {
    constructor() {
        this.baseUrl = 'https://komiku.org'
        this.apiUrl = 'https://api.komiku.org'
    }

    async search(keyword, page = 1) {
        try {
            const searchUrl = `${this.apiUrl}/?post_type=manga&s=${encodeURIComponent(keyword)}&page=${page}`
            const response = await axios.get(searchUrl, { headers: KOMIKU_HEADERS, timeout: 30000 })
            const $ = cheerio.load(response.data)
            const items = []

            $('.bge').each((i, el) => {
                const title = $(el).find('.kan h3').text().trim()
                const mangaUrl = $(el).find('.bgei a').first().attr('href')
                const image = $(el).find('.bgei img').attr('src')
                const type = $(el).find('.tpe1_inf b').text().trim()
                const genre = $(el).find('.tpe1_inf').text().trim().replace(type, '').trim()
                const update = $(el).find('.kan p').text().trim()
                const latestChapterUrl = $(el).find('.new1:last a').attr('href')
                const latestChapterText = $(el).find('.new1:last a span:last-child').text().trim()

                if (title) {
                    items.push({
                        title,
                        url: mangaUrl ? (mangaUrl.startsWith('http') ? mangaUrl : this.baseUrl + mangaUrl) : null,
                        image,
                        type,
                        genre,
                        latest_update: update,
                        latest_chapter: {
                            title: latestChapterText,
                            url: latestChapterUrl ? this.baseUrl + latestChapterUrl : null
                        }
                    })
                }
            })

            return { status: true, data: items, total: items.length }
        } catch (error) {
            return { status: false, message: error.message }
        }
    }

    async getDetail(url) {
        try {
            const response = await axios.get(url, { headers: KOMIKU_HEADERS, timeout: 30000 })
            const $ = cheerio.load(response.data)

            const thumbnail = $('.ims img').attr('src')
            const judul = $('h1 span').text().trim()
            const judulAlternatif = $('.j2').text().trim()
            const tipe = $('.inftable td').eq(5).text().trim()
            const tema = $('.inftable td').eq(7).text().trim()
            const genre = []
            $('.genre li a span').each((i, el) => genre.push($(el).text().trim()))
            const author = $('.inftable td').eq(11).text().trim()
            const status = $('.inftable td').eq(13).text().trim()
            const rating = $('.inftable td').eq(15).text().trim()
            const sinopsis = $('.desc').text().trim()
            const chapters = []

            $('#Daftar_Chapter tbody tr').each((i, el) => {
                const chapterLink = $(el).find('td.judulseries a').attr('href')
                const chapterTitle = $(el).find('td.judulseries a span').text().trim()
                const date = $(el).find('td.tanggalseries').text().trim()
                if (chapterLink && chapterTitle) {
                    chapters.push({
                        chapter_number: chapterTitle,
                        url: this.baseUrl + chapterLink,
                        date
                    })
                }
            })

            return {
                status: true,
                thumbnail,
                title: judul,
                alternative_title: judulAlternatif,
                type: tipe,
                theme: tema,
                genres: genre,
                author,
                status,
                rating,
                synopsis: sinopsis,
                total_chapters: chapters.length,
                chapters: chapters.reverse()
            }
        } catch (error) {
            return { status: false, message: error.message }
        }
    }

    async getChapterImages(chapterUrl) {
        try {
            const response = await axios.get(chapterUrl, { headers: KOMIKU_HEADERS, timeout: 30000 })
            const $ = cheerio.load(response.data)

            let chapterData = {}
            const scriptMatch = response.data.match(/var chapterData = ({[\s\S]*?});/)
            if (scriptMatch) {
                try { chapterData = eval('(' + scriptMatch[1] + ')') } catch (e) {}
            }

            const images = []
            $('#Baca_Komik img').each((i, el) => {
                const src = $(el).attr('src')
                if (src && !src.includes('lazy.jpg')) images.push(src)
            })

            const seriesTitle = $('.breadcrumb a').eq(1).text().trim() || chapterData.series
            const chapterTitle = $('h1').first().text().trim()

            return {
                status: true,
                series: seriesTitle,
                chapter: chapterTitle,
                chapter_number: chapterData.chapter,
                total_pages: images.length,
                image_urls: images
            }
        } catch (error) {
            return { status: false, message: error.message }
        }
    }
}

const komiku = new KomikuAPI()

// ================= HELPER =================
const downloadImageFast = (url, filePath) => {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await axios({
                method: 'GET',
                url,
                responseType: 'stream',
                headers: KOMIKU_HEADERS,
                timeout: 60000,
                maxRedirects: 5
            })
            const writer = fs.createWriteStream(filePath)
            response.data.pipe(writer)
            writer.on('finish', resolve)
            writer.on('error', reject)
        } catch (e) {
            reject(e)
        }
    })
}

const getBufferFast = async (url) => {
    try {
        const response = await axios.get(url, {
            headers: KOMIKU_HEADERS,
            responseType: 'arraybuffer',
            timeout: 30000,
            maxRedirects: 5
        })
        return Buffer.from(response.data)
    } catch {
        return null
    }
}

// ================= HANDLER =================
async function handler(m, { sock }) {
    const full = (m.text || m.body || '').trim()
    const raw = full.split(' ')

    // Buang element pertama kalau itu command (ada prefix atau tidak)
    const firstWord = raw[0]?.toLowerCase().replace(/^[^a-z]+/, '') // hapus prefix
    const args = firstWord === 'komiku' ? raw.slice(1) : raw

    const sub = (args[0] || '').toLowerCase()

    // ===== MENU =====
    if (!sub) {
        return m.reply(`🌸 *Hoshino Ai - Komiku*

╭┈┈⬡「 📚 MENU 」
┃ 🔎 *search*
┃ > .komiku search <judul>
┃
┃ 📖 *detail*
┃ > .komiku detail <url>
┃
┃ 📥 *download*
┃ > .komiku download <url_chapter>
╰┈┈⬡`)
    }

    // ===== SEARCH =====
    if (sub === 'search') {
        const q = args.slice(1).join(' ')
        if (!q) return m.reply('❌ *Ehh~* Contoh: .komiku search naruto~ 🥺')

        m.reply('🔍 *Mencari...*')

        try {
            const result = await komiku.search(q)

            if (!result.status || !result.data.length) {
                return m.reply('❌ *Ehh~* Tidak ditemukan! Coba kata kunci lain~ 🥺')
            }

            let txt = `🌸 *Hasil Search: ${q}*\n📦 Total: ${result.total} ditemukan\n\n`

            result.data.slice(0, 10).forEach((v, i) => {
                txt += `${i + 1}. *${v.title}*\n`
                txt += `   🏷️ ${v.type || '-'} | ${(v.genre || '-').substring(0, 40)}\n`
                txt += `   📌 Ch. terbaru: ${v.latest_chapter.title || '-'}\n`
                txt += `   🔗 ${v.url}\n\n`
            })

            txt += `\n📖 Gunakan:\n.komiku detail <url>`

            m.reply(txt)
        } catch (e) {
            console.error('[Komiku Search]', e.message)
            m.reply('❌ *Gomen ne~* Error saat search~ 🥺')
        }
    }

    // ===== DETAIL =====
    else if (sub === 'detail') {
        const url = args[1]
        let page = parseInt(args[2]) || 1
        const perPage = 50

        if (!url) return m.reply('❌ *Ehh~* Masukkan link manga~ 🥺')

        m.reply('⏳ *Mengambil detail...*')

        try {
            const detail = await komiku.getDetail(url)
            if (!detail.status) return m.reply('❌ *Gomen ne~* Gagal ambil detail! URL mungkin salah~ 🥺')

            if (!detail.chapters?.length) return m.reply('❌ *Ehh~* Tidak ada chapter tersedia~ 🥺')

            const total = detail.chapters.length
            const maxPage = Math.ceil(total / perPage)
            if (page < 1) page = 1
            if (page > maxPage) page = maxPage

            const start = (page - 1) * perPage
            const sliced = detail.chapters.slice(start, start + perPage)

            let txt = `🌸 *${detail.title || '-'}*\n\n`
            txt += `📌 Alt: ${detail.alternative_title || '-'}\n`
            txt += `🎭 Tipe: ${detail.type || '-'}\n`
            txt += `🏷️ Genre: ${detail.genres?.join(', ') || '-'}\n`
            txt += `✍️ Author: ${detail.author || '-'}\n`
            txt += `📊 Status: ${detail.status || '-'}\n`
            txt += `⭐ Rating: ${detail.rating || '-'}\n`
            txt += `📚 Total Ch: ${total} | 📄 Hal: ${page}/${maxPage}\n\n`
            txt += `📝 *Sinopsis:*\n${(detail.synopsis || '-').substring(0, 300)}${(detail.synopsis || '').length > 300 ? '...' : ''}\n\n`
            txt += `─────────────────\n`

            sliced.forEach((ch, i) => {
                txt += `${start + i + 1}. ${ch.chapter_number}\n`
                txt += `   📅 ${ch.date || '-'}\n`
                txt += `   🔗 ${ch.url}\n\n`
            })

            if (page < maxPage) txt += `\n➡️ Hal berikutnya:\n.komiku detail ${url} ${page + 1}`

            txt += `\n\n📥 Download:\n.komiku download <url_chapter>`

            // Kirim thumbnail kalau ada
            const thumbBuffer = await getBufferFast(detail.thumbnail)
            if (thumbBuffer) {
                await sock.sendMessage(m.chat, {
                    image: thumbBuffer,
                    caption: txt
                }, { quoted: m })
            } else {
                m.reply(txt)
            }

        } catch (e) {
            console.error('[Komiku Detail]', e.message)
            m.reply('❌ *Gomen ne~* Gagal ambil detail~ 🥺')
        }
    }

    // ===== DOWNLOAD =====
    else if (sub === 'download') {
        let url = args[1]
        if (!url || !url.startsWith('http')) return m.reply('❌ Masukkan URL chapter yang valid!\n\nContoh: .komiku download https://komiku.org/chapter/...')

        m.reply('📥 *Mengambil gambar chapter...*')

        const imgPaths = []
        const pdfPath = path.join(TMP_DIR, `komiku-${Date.now()}.pdf`)

        try {
            if (!PDFDocument) throw new Error('pdfkit belum di install! Jalankan: npm install pdfkit')

            const chapterData = await komiku.getChapterImages(url)
            if (!chapterData.status || !chapterData.image_urls.length) {
                return m.reply('❌ *Ehh~* Gambar tidak ditemukan! Chapter mungkin tidak tersedia~ 🥺')
            }

            const images = chapterData.image_urls
            m.reply(`🖼️ *Mengunduh ${images.length} halaman...*`)

            // Download per batch 10
            const limit = 10
            for (let i = 0; i < images.length; i += limit) {
                const batch = images.slice(i, i + limit)
                const results = await Promise.all(
                    batch.map((imgUrl, idx) => {
                        const p = path.join(TMP_DIR, `${Date.now()}-${i + idx}.jpg`)
                        return downloadImageFast(imgUrl, p).then(() => p)
                    })
                )
                imgPaths.push(...results)
            }

            if (!imgPaths.length) return m.reply('❌ *Gomen ne~* Semua gambar gagal diunduh~ 🥺')

            m.reply('📄 *Membuat PDF...*')

            const doc = new PDFDocument({ autoFirstPage: false, margin: 0 })
            const stream = fs.createWriteStream(pdfPath)
            doc.pipe(stream)

            for (const img of imgPaths) {
                try {
                    if (sharp) {
                        const meta = await sharp(img).metadata()
                        doc.addPage({ size: [meta.width, meta.height], margin: 0 })
                        doc.image(img, 0, 0, { width: meta.width, height: meta.height })
                    } else {
                        doc.addPage()
                        doc.image(img, 0, 0, { fit: [595, 842] })
                    }
                } catch (e) {}
                try { fs.unlinkSync(img) } catch (e) {}
            }

            doc.end()
            await finished(stream)

            const cleanName = (chapterData.series || 'komiku').replace(/[^\w\s]/gi, '').replace(/\s+/g, '-')
            const fileName = `${cleanName}-${chapterData.chapter_number || 'chapter'}.pdf`

            await sock.sendMessage(m.chat, {
                document: fs.readFileSync(pdfPath),
                mimetype: 'application/pdf',
                fileName,
                caption: `📖 *${chapterData.series || '-'}*\n📑 *${chapterData.chapter || '-'}*\n📄 *Total:* ${chapterData.total_pages} halaman\n\n✨ Enjoy reading!`
            }, { quoted: m })

        } catch (e) {
            console.error('[Komiku Download]', e.message)
            m.reply(`❌ Gagal download!\n${e.message}`)
        } finally {
            try { if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath) } catch (e) {}
            for (const img of imgPaths) {
                try { if (fs.existsSync(img)) fs.unlinkSync(img) } catch (e) {}
            }
        }
    }

    else {
        m.reply('❌ Perintah tidak dikenal!\n\nKetik .komiku untuk lihat menu')
    }
}

module.exports = {
    config: pluginConfig,
    handler
}