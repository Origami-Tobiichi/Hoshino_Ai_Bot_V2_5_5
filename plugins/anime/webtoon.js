const axios = require('axios')
const fs = require('fs')
const path = require('path')
let PDFDocument

try {
    PDFDocument = require('pdfkit')
} catch {
    console.log('[Webtoon] pdfkit belum di install!')
}

const { finished } = require('stream/promises')
const sharp = require('sharp')

// ================= CONFIG =================
const config = {
    name: 'webtoon',
    alias: ['wt', 'read'],
    category: 'anime',
    description: '💖 Hoshino Ai siap bantu cari & download Webtoon jadi PDF!',
    usage: '.webtoon search <judul>',
    example: '.webtoon search Lookism',
    isOwner: false,
    isGroup: false,
    isPrivate: false
}

const TMP_DIR = path.join(__dirname, '../../tmp')
const apikey = 'JpLZ3'

// ================= HOSHINO AI STYLE =================
const ICON = {
    star: '🌟',
    heart: '💖',
    spark: '✨',
    search: '🔍',
    wait: '⏳',
    done: '✅',
    error: '❌',
    download: '📥',
    book: '📖',
    idol: '🎤'
}

function aiMessage(title, content, footer = '— Hoshino Ai 💖 Idol Mode') {
    return `${ICON.star} *${title}* ${ICON.spark}

${content}

${footer}`
}

// ================= HELPER =================
async function downloadImage(url, filepath) {
    const res = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://www.webtoons.com/'
        }
    })

    const writer = fs.createWriteStream(filepath)
    res.data.pipe(writer)
    await finished(writer)
}

// ================= HANDLER =================
async function handler(m, { sock }) {
    const command = (m.command || '').toLowerCase()
    if (!['webtoon', 'wt', 'read'].includes(command)) return

    const text = (m.text || m.body || '').trim()
    let args = text.split(' ')

    if (args[0].toLowerCase().includes(command)) {
        args = args.slice(1)
    }

    const sub = (args[0] || '').toLowerCase()

    // ===== MENU =====
    if (!sub) {
        return m.reply(aiMessage(
            'WEBTOON MENU',
`${ICON.idol} *Hai~ Aku Ai! Mau baca apa hari ini?* 💖

${ICON.search} *Search*
> .webtoon search <judul>

${ICON.book} *Detail*
> .webtoon detail <link>

${ICON.download} *Download*
> .webtoon download <link>

${ICON.heart} Aku bakal ubah jadi PDF biar kamu nyaman baca ya~ ✨`
        ))
    }

    // ===== SEARCH =====
    if (sub === 'search') {
        const q = args.slice(1).join(' ')
        if (!q) return m.reply(`${ICON.error} Contoh: .webtoon search Lookism ya~ 💖`)

        await m.react('🔍')

        try {
            const url = `https://api.theresav.my.id/manga/webtoon/search?q=${encodeURIComponent(q)}&apikey=${apikey}`
            const { data } = await axios.get(url)

            if (!data?.status || !data?.result) {
                return m.reply(aiMessage('Upss~', 'Ai nggak nemu judulnya... coba lagi ya 💔'))
            }

            const all = [...(data.result.original || []), ...(data.result.canvas || [])]

            let txt = `${ICON.spark} *Hasil Pencarian: ${q.toUpperCase()}*\n\n`

            all.slice(0, 15).forEach((v, i) => {
                txt += `${ICON.star} *${v.title}*\n`
                txt += `👤 ${v.author || '-'}\n`
                txt += `🔗 ${v.link}\n\n`
            })

            txt += `Ketik: .webtoon detail <link> ya~ 💖`

            m.reply(aiMessage('Search Result', txt))
        } catch {
            m.reply(aiMessage('Error', 'Servernya lagi malu-malu 😖 coba lagi nanti ya~'))
        }
    }

    // ===== DETAIL =====
    else if (sub === 'detail') {
        const webUrl = args[1]
        if (!webUrl) return m.reply(`${ICON.error} Masukin link webtoon ya~`)

        await m.react('⏳')

        try {
            const apiUrl = `https://api.theresav.my.id/manga/webtoon/detail?url=${encodeURIComponent(webUrl)}&apikey=${apikey}`
            const { data } = await axios.get(apiUrl)
            const r = data.result

            let txt = `
${ICON.book} *${r.title}*
👤 ${r.authors?.join(', ') || '-'}
🏷️ ${r.genre || '-'}

${ICON.spark} *Episode List:*
`

            r.episodes.slice(0, 50).forEach((ep, i) => {
                txt += `${i + 1}. ${ep.title}\n${ep.link}\n\n`
            })

            txt += `Download pakai:\n.webtoon download <link> 💖`

            m.reply(aiMessage('Detail Webtoon', txt))
        } catch {
            m.reply(aiMessage('Error', 'Ai gagal ambil detailnya 😭'))
        }
    }

    // ===== DOWNLOAD =====
    else if (sub === 'download') {
        const dlUrl = args[1]
        if (!dlUrl) return m.reply(`${ICON.error} Masukin link episode ya~`)

        await m.react('📥')
        m.reply(aiMessage('Download', 'Ai lagi nyusun PDF buat kamu... tunggu ya~ 💖✨'))

        try {
            if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })

            const apiUrl = `https://api.theresav.my.id/manga/webtoon/download?url=${encodeURIComponent(dlUrl)}&apikey=${apikey}`
            const { data } = await axios.get(apiUrl)

            const images = data.images
            const imgPaths = []

            for (let i = 0; i < images.length; i += 5) {
                const batch = images.slice(i, i + 5)
                const results = await Promise.allSettled(batch.map((img, idx) => {
                    const p = path.join(TMP_DIR, `wt-${Date.now()}-${i + idx}.jpg`)
                    return downloadImage(img, p).then(() => p)
                }))
                results.forEach(r => {
                    if (r.status === 'fulfilled') imgPaths.push(r.value)
                })
            }

            const pdfPath = path.join(TMP_DIR, `webtoon-${Date.now()}.pdf`)
            const doc = new PDFDocument({ autoFirstPage: false, margin: 0 })
            const stream = fs.createWriteStream(pdfPath)
            doc.pipe(stream)

            for (const img of imgPaths) {
                try {
                    const meta = await sharp(img).metadata()
                    doc.addPage({ size: [meta.width, meta.height] })
                    doc.image(img, 0, 0, { width: meta.width, height: meta.height })
                    fs.unlinkSync(img)
                } catch {}
            }

            doc.end()
            await finished(stream)

            await sock.sendMessage(m.chat, {
                document: fs.readFileSync(pdfPath),
                mimetype: 'application/pdf',
                fileName: `${data.title || 'Webtoon'}.pdf`,
                caption: aiMessage('Selesai~ 💖', `PDF kamu udah jadi!\n\n📖 ${data.title}`)
            }, { quoted: m })

            fs.unlinkSync(pdfPath)
            await m.react('✅')
        } catch {
            m.reply(aiMessage('Error', 'Gagal download... Ai sedih 😭'))
        }
    }
}

module.exports = { config, handler }