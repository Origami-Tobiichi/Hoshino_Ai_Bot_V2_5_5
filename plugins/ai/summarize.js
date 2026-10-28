const { f } = require('../../src/lib/undici')
const axios = require('axios')

const pluginConfig = {
    name: 'summarize',
    alias: ['sum', 'ringkas', 'tldr', 'rangkum'],
    category: 'ai',
    description: 'Rangkum artikel dari URL, teks panjang, atau reply pesan',
    usage: '.summarize <url/teks> atau reply pesan panjang',
    example: '.summarize https://detik.com/artikel/xxx | .summarize teks panjang...',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 2,
    isEnabled: true
}

// ── Deteksi apakah string adalah URL ─────────────────────────────────────────
function isUrl(str) {
    try {
        const url = new URL(str)
        return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
        return false
    }
}

// ── Fetch & ekstrak teks dari URL (tanpa browser) ─────────────────────────────
async function fetchArticleText(url) {
    const res = await axios.get(url, {
        timeout: 15000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml'
        },
        maxContentLength: 5 * 1024 * 1024  // max 5MB
    })

    const html = res.data

    // Strip HTML tags & ekstrak teks bersih
    let text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s{2,}/g, ' ')
        .trim()

    // Ambil max 4000 karakter biar gak overlimit AI
    if (text.length > 4000) text = text.substring(0, 4000) + '...'

    return text
}

// ── Panggil AI buat rangkum ───────────────────────────────────────────────────
async function callAI(content, sourceType) {
    const prompt = `Kamu adalah Hoshino Ai, idol cerdas yang bisa merangkum konten dengan baik~

Rangkum ${sourceType} berikut dalam format yang menarik:
- 📌 Topik utama (1 kalimat)
- 🔑 Poin-poin penting (3-5 poin, tiap poin 1-2 kalimat)
- 💡 Kesimpulan singkat (1-2 kalimat)

Gunakan bahasa Indonesia yang natural dan mudah dipahami. Jangan terlalu formal~

Konten:
${content}`

    // Coba nexray GPT-4o dulu
    try {
        const data = await f(`https://api.nexray.web.id/ai/chatgpt?text=${encodeURIComponent(prompt)}&model=gpt-4o`)
        if (data?.result) return data.result
    } catch {}

    // Fallback DeepSeek
    try {
        const data = await f(`https://api.nexray.web.id/ai/deepseek?text=${encodeURIComponent(prompt)}`)
        if (data?.result) return data.result
    } catch {}

    throw new Error('Semua AI endpoint gagal')
}

async function handler(m, { sock }) {
    const args   = m.args || []
    const text   = args.join(' ').trim()
    const quoted = m.quoted

    // ── Validasi input ────────────────────────────────────────────────────────
    if (!text && !quoted) {
        return m.reply(
            `📝 *sᴜᴍᴍᴀʀɪᴢᴇ*\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
            `┃ 🔗 URL artikel:\n` +
            `┃    \`${m.prefix}summarize https://detik.com/...\`\n` +
            `┃\n` +
            `┃ 📄 Teks langsung:\n` +
            `┃    \`${m.prefix}summarize teks panjang...\`\n` +
            `┃\n` +
            `┃ 💬 Reply pesan panjang:\n` +
            `┃    reply pesan + \`${m.prefix}summarize\`\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> Support: artikel web, teks biasa, reply pesan~ ✨`
        )
    }

    m.react('🕕')

    try {
        let content    = ''
        let sourceType = 'teks'
        let sourceInfo = ''

        // ── Mode 1: URL ───────────────────────────────────────────────────────
        if (text && isUrl(text.split(' ')[0])) {
            const url = text.split(' ')[0]
            sourceType = 'artikel'
            sourceInfo = `🔗 *URL:* ${url}`

            await m.reply(`🌐 *Mengambil konten artikel...*\n\n> Sabar ya~ Ai lagi baca artikelnya dulu! 💖`)

            try {
                content = await fetchArticleText(url)
            } catch (err) {
                return m.reply(
                    `❌ *Gagal mengambil artikel~*\n\n` +
                    `> ${err.message}\n\n` +
                    `> Coba paste teks artikelnya langsung ya~`
                )
            }

            if (content.length < 100) {
                return m.reply(
                    `⚠️ *Konten terlalu pendek~*\n\n` +
                    `> Artikel ini mungkin butuh login atau JS rendering\n` +
                    `> Coba copy-paste teksnya langsung~`
                )
            }

        // ── Mode 2: Reply pesan ───────────────────────────────────────────────
        } else if (quoted && !text) {
            const quotedText = quoted.text || quoted.caption || ''
            if (!quotedText || quotedText.length < 50) {
                return m.reply(
                    `⚠️ *Pesan yang di-reply terlalu pendek~*\n\n` +
                    `> Minimal 50 karakter biar Ai bisa rangkum dengan baik~`
                )
            }
            content    = quotedText
            sourceType = 'pesan'
            sourceInfo = `💬 *Sumber:* Pesan yang di-reply`

        // ── Mode 3: Teks langsung ─────────────────────────────────────────────
        } else {
            content    = text
            sourceType = 'teks'
            sourceInfo = `📄 *Sumber:* Teks langsung`

            if (content.length < 50) {
                return m.reply(
                    `⚠️ *Teks terlalu pendek~*\n\n` +
                    `> Minimal 50 karakter biar Ai bisa rangkum dengan baik~\n` +
                    `> Atau kirim URL artikel~`
                )
            }
        }

        // ── Panggil AI ────────────────────────────────────────────────────────
        const result = await callAI(content, sourceType)

        m.react('✅')
        await m.reply(
            `📝 *ʀᴀɴɢᴋᴜᴍᴀɴ ᴀɪ*\n` +
            `${sourceInfo}\n\n` +
            `${result}\n\n` +
            `> ✨ *Dirangkum oleh Hoshino Ai~ 💖*`
        )

    } catch (err) {
        m.react('❌')
        await m.reply(
            `❌ *ɢᴀɢᴀʟ ᴍᴇʀᴀɴɢᴋᴜᴍ~*\n\n` +
            `> ${err.message}\n\n` +
            `> Coba lagi ya~ 🙏`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}