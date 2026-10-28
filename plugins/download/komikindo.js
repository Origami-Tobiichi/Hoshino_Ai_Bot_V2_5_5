const axios = require('axios')

const pluginConfig = {
    name: 'komikindo',
    alias: ['komikindo2', 'kmk'],
    category: 'download',
    description: 'Cari dan download komik dari Komikindo sebagai PDF',
    usage: '.komikindo <judul/url>',
    example: '.komikindo bocchi the rock',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 2,
    isEnabled: true
}

const API = 'https://api.kaicloud.my.id/api/manga/komikindo'

function cleanTitle(t = '') {
    return t.replace(/^Komik\s*/i, '').replace(/\s+/g, ' ').trim()
}

function extractImageUrl(v) {
    if (typeof v === 'string') return v
    return v?.url || v?.image || v?.src || v?.link || ''
}

async function downloadImage(url) {
    const { data } = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: { 'Referer': 'https://komikindo.ch/' }
    })
    return Buffer.from(data)
}

async function imagesToPDF(imageUrls) {
    const PDFDocument = require('pdfkit')
    const sharp = require('sharp')

    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ autoFirstPage: false })
            const chunks = []
            doc.on('data', chunk => chunks.push(chunk))
            doc.on('end', () => resolve(Buffer.concat(chunks)))
            doc.on('error', reject)

            for (const url of imageUrls) {
                try {
                    let buffer = await downloadImage(url)
                    buffer = await sharp(buffer).jpeg({ quality: 85 }).toBuffer()
                    const meta = await sharp(buffer).metadata()
                    doc.addPage({ size: [meta.width, meta.height] })
                    doc.image(buffer, 0, 0, { width: meta.width, height: meta.height })
                } catch (e) {
                    console.log('[Komikindo] Gagal proses gambar:', url, e.message)
                }
            }

            doc.end()
        } catch (e) {
            reject(e)
        }
    })
}

async function handler(m, { sock }) {
    const input = m.args?.join(' ')?.trim()

    if (!input) {
        return m.reply(
            `『 🌸 *ᴋᴏᴍɪᴋɪɴᴅᴏ* 🌸 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `✨ *Cara pakai:*\n` +
            `\`${m.prefix}komikindo <judul>\` — cari komik\n` +
            `\`${m.prefix}komikindo <url komik>\` — lihat chapter\n\n` +
            `💫 *Contoh:*\n` +
            `\`${m.prefix}komikindo bocchi the rock\`\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `> 💖 Ai siap bantu cari komik buat kamu~ 🌸`
        )
    }

    m.react('⭐')

    // ── Download chapter (dari list chapter) ──────────────────────────────
    if (input.includes('|')) {
        const [, chapterUrl] = input.split('|')

        await m.reply(
            `『 🌸 *ᴘʀᴇᴘᴀʀɪɴɢ ᴘᴅꜰ~* 』\n\n` +
            `> ✨ Sedang mengambil gambar & membuat PDF~\n` +
            `> 💖 Tunggu sebentar ya~`
        )

        const { data } = await axios.get(`${API}/read`, {
            params: { url: chapterUrl.trim() },
            headers: { accept: 'application/json' },
            timeout: 30000
        })

        if (!data?.status || !data?.data?.images?.length) {
            m.react('❌')
            return m.reply(`『 💥 *E R R O R* 』\n\n> Gagal mengambil gambar chapter~`)
        }

        const images = data.data.images.map(extractImageUrl).filter(Boolean)
        const title = cleanTitle(data.data.title) || 'Komik'

        if (!images.length) {
            m.react('❌')
            return m.reply(`『 💥 *E R R O R* 』\n\n> Gagal mengambil gambar chapter~`)
        }

        const pdfBuffer = await imagesToPDF(images)
        const fileName = title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60) + '.pdf'

        await sock.sendMessage(
            m.chat,
            {
                document: pdfBuffer,
                mimetype: 'application/pdf',
                fileName,
                caption:
                    `『 ✅ *ᴘᴅꜰ sᴇʟᴇsᴀɪ~* 』\n\n` +
                    `📄 *${title}*\n` +
                    `📑 Total halaman: ${images.length}\n\n` +
                    `> 💖 Enjoy baca komiknya~ 🌸`
            },
            { quoted: m }
        )

        m.react('✅')
        return
    }

    // ── Lihat daftar chapter dari URL komik ───────────────────────────────
    if (/^https:\/\/komikindo\.ch\/komik\//i.test(input)) {
        const { data } = await axios.get(`${API}/detail`, {
            params: { url: input.trim() },
            headers: { accept: 'application/json' },
            timeout: 30000
        })

        if (!data?.status || !data?.data?.chapters?.length) {
            m.react('❌')
            return m.reply(`『 💥 *E R R O R* 』\n\n> Chapter tidak ditemukan~`)
        }

        const detail = data.data
        const title = cleanTitle(detail.title)

        const chapters = detail.chapters.slice(0, 30)

        // Simpan pending pilihan chapter
        if (!global.komikPending) global.komikPending = {}
        global.komikPending[m.sender] = {
            type: 'chapter',
            items: chapters,
            ts: Date.now()
        }

        const chapterText = chapters.map((c, i) =>
            `┃ *${i + 1}.* Chapter ${c.chapter}${c.date ? ' — ' + c.date : ''}`
        ).join('\n')

        await sock.sendMessage(
            m.chat,
            {
                image: { url: detail.image },
                caption:
                    `『 🌸 *ᴋᴏᴍɪᴋɪɴᴅᴏ* 🌸 』\n` +
                    `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
                    `📛 *${title}*\n` +
                    `📊 Status: ${detail.info?.status || '-'}\n` +
                    `✍️ Author: ${detail.info?.author || '-'}\n` +
                    `🏷️ Genre: ${(detail.genres || []).join(', ')}\n` +
                    `📚 Total Chapter: ${detail.chapterCount ?? detail.chapters.length}\n\n` +
                    `╭┈┈⬡\n` +
                    chapterText + '\n' +
                    `╰┈┈⬡\n\n` +
                    `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
                    `> 💖 Balas dengan *nomor* untuk download PDF~ 🌸`
            },
            { quoted: m }
        )

        m.react('✅')
        return
    }

    // ── Cari komik ────────────────────────────────────────────────────────
    const { data } = await axios.get(`${API}/search`, {
        params: { q: input },
        headers: { accept: 'application/json' },
        timeout: 30000
    })

    if (!data?.status || !data?.data?.length) {
        m.react('❌')
        return m.reply(
            `『 💔 *Tidak Ditemukan~* 』\n\n` +
            `> Komik \`${input}\` tidak ditemukan nih~\n` +
            `> Coba keyword lain ya~ 💕`
        )
    }

    const hasil = data.data

    // Simpan pending pilihan
    if (!global.komikPending) global.komikPending = {}
    global.komikPending[m.sender] = {
        type: 'search',
        items: hasil.slice(0, 20),
        ts: Date.now()
    }

    const listText = hasil.slice(0, 20).map((v, i) =>
        `┃ *${i + 1}.* ${v.title}\n┃     ${v.type || '-'}${v.rating ? ' | ⭐ ' + v.rating : ''}`
    ).join('\n')

    await sock.sendMessage(
        m.chat,
        {
            image: { url: hasil[0].image },
            caption:
                `『 🌸 *ʜᴀsɪʟ ᴘᴇɴᴄᴀʀɪᴀɴ* 🌸 』\n` +
                `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
                `🔍 Keyword: *${input}*\n` +
                `📚 Total: *${hasil.length} komik*\n\n` +
                `╭┈┈⬡\n` +
                listText + '\n' +
                `╰┈┈⬡\n\n` +
                `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
                `> 💖 Balas dengan *nomor* untuk lihat chapter~ 🌸`
        },
        { quoted: m }
    )

    m.react('✅')
}

async function answerHandler(m, sock) {
    if (!global.komikPending) return false
    const pending = global.komikPending[m.sender]
    if (!pending) return false

    if (Date.now() - pending.ts > 5 * 60 * 1000) {
        delete global.komikPending[m.sender]
        return false
    }

    const text = m.body?.trim()
    const num = parseInt(text)
    if (isNaN(num) || num < 1 || num > pending.items.length) return false

    const selected = pending.items[num - 1]
    delete global.komikPending[m.sender]

    if (pending.type === 'search') {
        // Pilih komik → tampil daftar chapter
        const fakeM = Object.assign({}, m, {
            body: selected.link,
            args: [selected.link]
        })
        await handler(fakeM, { sock })
        return true
    }

    if (pending.type === 'chapter') {
        // Pilih chapter → download PDF
        const fakeM = Object.assign({}, m, {
            body: `chapter|${selected.link}`,
            args: [`chapter|${selected.link}`]
        })
        await handler(fakeM, { sock })
        return true
    }

    return false
}

module.exports = {
    config: pluginConfig,
    handler,
    answerHandler
}