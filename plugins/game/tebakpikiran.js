const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: 'tebakpikiran',
    alias: ['mindread', 'tebakin', 'tbpikiran'],
    category: 'game',
    description: 'Bot menebak apa yang kamu pikirkan lewat pertanyaan AI',
    usage: '.tebakpikiran',
    example: '.tebakpikiran',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

if (!global.tebakPikiranSessions) global.tebakPikiranSessions = new Map()
const sessions = global.tebakPikiranSessions

const YES_ANSWERS = ['ya', 'iya', 'yes', 'yep', 'y', 'betul', 'bener', 'benar', '✅', '👍']
const NO_ANSWERS = ['tidak', 'nggak', 'ngga', 'gak', 'ga', 'no', 'nope', 'n', 'bukan', '❌', '👎']
const SKIP_ANSWERS = [
    'skip', 'entah', '?', 'mungkin', 'ragu',
    'tidak tau', 'tidak tahu',
    'gatau', 'ga tau', 'gak tau', 'gak tahu',
    'kurang tau', 'kurang tahu',
    'nggak tau', 'nggak tahu',
    'ngga tau', 'ngga tahu'
]

function normalizeAnswer(text) {
    const t = text.trim().toLowerCase().replace(/\s+/g, ' ')
    if (YES_ANSWERS.includes(t)) return 'YA'
    if (NO_ANSWERS.includes(t)) return 'TIDAK'
    if (SKIP_ANSWERS.includes(t)) return 'TIDAK TAHU'
    if (SKIP_ANSWERS.some(s => t.includes(s))) return 'TIDAK TAHU'
    return null
}

function extractText(data) {
    if (!data) return null
    if (typeof data === 'string') return data.trim()
    if (typeof data === 'object') {
        if (data?.result?.text) return String(data.result.text).trim()
        if (data?.result) return String(data.result).trim()
        if (data?.response) return String(data.response).trim()
        if (data?.text) return String(data.text).trim()
        if (data?.data) return String(data.data).trim()
    }
    return null
}

async function callAI(prompt) {
    try {
        const data = await f(`https://api.zenzxz.my.id/ai/copilot?message=${encodeURIComponent(prompt)}&model=gpt-5`)
        console.log('[TebakPikiran] API1 raw:', JSON.stringify(data)?.slice(0, 200))
        const text = extractText(data)
        if (text) return text
    } catch (e) {
        console.log('[TebakPikiran] API 1 Error:', e.message)
    }
    try {
        const data = await f(`https://api-faa.my.id/faa/claude-ai?text=${encodeURIComponent(prompt)}`)
        console.log('[TebakPikiran] API2 raw:', JSON.stringify(data)?.slice(0, 200))
        const text = extractText(data)
        if (text) return text
    } catch (e) {
        console.log('[TebakPikiran] API 2 Error:', e.message)
    }
    return null
}

async function generateNextQuestion(answers) {
    const isFirst = answers.length === 0
    const summary = answers.length > 0
        ? answers.map((a, i) => `${i + 1}. ${a.q} → ${a.a}`).join('\n')
        : ''

    const prompt = isFirst
        ? `Kamu sedang memainkan game tebak pikiran dalam bahasa Indonesia.
Tugas: tulis SATU pertanyaan ya/tidak untuk memulai menebak sesuatu yang dipikirkan user.
PENTING: tulis pertanyaannya SAJA. Dilarang keras menulis penjelasan, rekap, nomor, atau kalimat lain apapun.
Output yang benar contohnya: Apakah itu makhluk hidup?`
        : `Kamu sedang memainkan game tebak pikiran dalam bahasa Indonesia.
Jawaban user sejauh ini:
${summary}

Tugas: tulis SATU pertanyaan ya/tidak baru yang membantu mempersempit tebakan.
PENTING: tulis pertanyaannya SAJA. Dilarang keras menulis penjelasan, rekap, nomor, atau kalimat lain apapun.
Jangan ulangi pertanyaan yang sudah ditanya.
Output yang benar contohnya: Apakah itu berwarna merah?`

    const result = await callAI(prompt)
    console.log('[TebakPikiran] generateNextQuestion result:', result)
    if (!result) return null

    const firstLine = result
        .split('\n')
        .map(l => l.trim())
        .find(l => l.endsWith('?') && l.length > 5)

    if (firstLine) return firstLine.replace(/^["'\d\.\-\s]+/, '').replace(/["']$/, '').trim()

    const fallbackLine = result.split('\n').map(l => l.trim()).find(l => l.length > 5)
    return fallbackLine ? fallbackLine.replace(/^["'\d\.\-\s]+/, '').replace(/["']$/, '').trim() : null
}

async function tryGuess(answers) {
    const summary = answers.map((a, i) => `${i + 1}. ${a.q} → ${a.a}`).join('\n')
    const prompt = `Kamu sedang memainkan game tebak pikiran dalam bahasa Indonesia.
Jawaban user sejauh ini:
${summary}

Tugas: evaluasi seberapa yakin kamu bisa menebak, lalu berikan jawaban.
PENTING: balas HANYA dengan JSON di bawah ini, tanpa teks lain, tanpa markdown, tanpa backtick:
{"confidence": 7, "guess": ""}

Aturan:
- confidence: angka 1-10
- Jika confidence >= 8: isi guess dengan nama tebakan singkat
- Jika confidence < 8: biarkan guess tetap string kosong ""`

    const result = await callAI(prompt)
    console.log('[TebakPikiran] tryGuess raw:', result)
    if (!result) return { confidence: 0, guess: '' }

    try {
        const clean = result.replace(/```json|```/gi, '').trim()
        const match = clean.match(/\{[\s\S]*?"confidence"[\s\S]*?"guess"[\s\S]*?\}/)
        if (match) {
            const parsed = JSON.parse(match[0])
            return {
                confidence: parseInt(parsed.confidence) || 0,
                guess: (parsed.guess || '').trim()
            }
        }
    } catch (e) {
        console.log('[TebakPikiran] JSON parse error:', e.message)
    }

    return { confidence: 0, guess: '' }
}

async function handler(m, { sock }) {
    const sender = m.sender

    if (sessions.has(sender)) {
        return m.reply(
            `🧠 *ᴛᴇʙᴀᴋ ᴘɪᴋɪʀᴀɴ*\n\n` +
            `╭┈┈⬡「 ⚠️ *ɢᴀᴍᴇ ᴀᴋᴛɪꜰ* 」\n` +
            `┃ Kamu masih punya game yang sedang berjalan!\n` +
            `┃ Jawab pertanyaannya dulu ya~\n` +
            `┃\n` +
            `┃ Ketik *batal* untuk mengakhiri game.\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }

    await m.reply(
        `🧠 *ᴛᴇʙᴀᴋ ᴘɪᴋɪʀᴀɴ*\n\n` +
        `╭┈┈⬡「 🎮 *ᴍᴜʟᴀɪ ɢᴀᴍᴇ* 」\n` +
        `┃ Pikirkan sesuatu dulu ya~\n` +
        `┃ Bisa karakter, benda, hewan, orang...\n` +
        `┃ Apapun boleh! Tapi jangan kasih tahu aku 🙈\n` +
        `┃\n` +
        `┃ Aku akan tanya terus sampai bisa tebak!\n` +
        `┃ Jawab dengan: *ya / tidak / tidak tahu*\n` +
        `┃\n` +
        `┃ Ketik *batal* untuk mengakhiri game.\n` +
        `╰┈┈┈┈┈┈┈┈⬡\n\n` +
        `_Sebentar, aku siapkan pertanyaan dulu~_ 🤔`
    )

    const firstQ = await generateNextQuestion([])
    if (!firstQ) {
        return m.reply(`❌ Gagal memulai game, API tidak merespons. Coba lagi ya~ *.tebakpikiran*`)
    }

    sessions.set(sender, {
        answers: [],
        currentQuestion: firstQ,
        waitingForAI: false
    })

    await m.reply(`❓ *Pertanyaan 1:*\n${firstQ}`)
}

async function answerHandler(m, sock) {
    const sender = m.sender
    if (!sessions.has(sender)) return false

    const session = sessions.get(sender)
    const text = m.body?.trim()?.toLowerCase()?.replace(/\s+/g, ' ')
    if (!text) return false

    if (['batal', 'stop', 'cancel'].includes(text)) {
        sessions.delete(sender)
        await m.reply(
            `🧠 *ᴛᴇʙᴀᴋ ᴘɪᴋɪʀᴀɴ*\n\n` +
            `> Game dibatalkan. Sampai jumpa lagi ya~ 🌸`
        )
        return true
    }

    if (session.waitingForAI) {
        await m.reply(`⏳ Sabar ya~ aku lagi berpikir keras nih~ 🧠`)
        return true
    }

    const answer = normalizeAnswer(text)
    if (!answer) {
        await m.reply(
            `❓ Jawab dengan:\n` +
            `• *ya* — kalau benar\n` +
            `• *tidak* — kalau salah\n` +
            `• *tidak tahu* — kalau ragu\n\n` +
            `Atau ketik *batal* untuk keluar.`
        )
        return true
    }

    session.answers.push({ q: session.currentQuestion, a: answer })
    session.waitingForAI = true
    sessions.set(sender, session)

    const stepNum = session.answers.length

    if (stepNum >= 3 && stepNum % 3 === 0) {
        await m.reply(`🤔 _Hmm, aku mulai punya gambaran... sebentar ya~_ 💭`)

        const { confidence, guess } = await tryGuess(session.answers)
        console.log('[TebakPikiran] confidence:', confidence, '| guess:', guess)

        if (confidence >= 8 && guess) {
            sessions.delete(sender)
            return await m.reply(
                `🧠 *ᴛᴇʙᴀᴋ ᴘɪᴋɪʀᴀɴ*\n\n` +
                `╭┈┈⬡「 🎯 *ᴛᴇʙᴀᴋᴀɴᴋᴜ* 」\n` +
                `┃ Setelah ${stepNum} pertanyaan...\n` +
                `┃\n` +
                `┃ 🌟 Aku menebak kamu memikirkan:\n` +
                `┃\n` +
                `┃ ✨ *${guess}* ✨\n` +
                `┃\n` +
                `┃ Betul nggak? Hehehe~ 😏\n` +
                `╰┈┈┈┈┈┈┈┈⬡\n\n` +
                `> Mau main lagi? Ketik *.tebakpikiran* 🌸`
            )
        }
    }

    const nextQ = await generateNextQuestion(session.answers)

    if (!nextQ) {
        await m.reply(`🧠 _API lagi lemot, aku coba tebak dulu ya..._ 💭`)
        const { guess } = await tryGuess(session.answers)
        sessions.delete(sender)

        return await m.reply(
            guess
                ? `🧠 *ᴛᴇʙᴀᴋ ᴘɪᴋɪʀᴀɴ*\n\n` +
                  `╭┈┈⬡「 🎯 *ᴛᴇʙᴀᴋᴀɴᴋᴜ* 」\n` +
                  `┃ Setelah ${stepNum} pertanyaan...\n` +
                  `┃\n` +
                  `┃ ✨ *${guess}* ✨\n` +
                  `┃\n` +
                  `┃ Betul nggak? 😏\n` +
                  `╰┈┈┈┈┈┈┈┈⬡\n\n` +
                  `> Mau main lagi? Ketik *.tebakpikiran* 🌸`
                : `🧠 *ᴛᴇʙᴀᴋ ᴘɪᴋɪʀᴀɴ*\n\n` +
                  `╭┈┈⬡「 😵 *ᴍᴇɴʏᴇʀᴀʜ* 」\n` +
                  `┃ Aduh~ API lagi gangguan 😢\n` +
                  `┃ Coba main lagi nanti ya~\n` +
                  `╰┈┈┈┈┈┈┈┈⬡\n\n` +
                  `> Ketik *.tebakpikiran* 🌸`
        )
    }

    session.currentQuestion = nextQ
    session.waitingForAI = false
    sessions.set(sender, session)

    await m.reply(
        `✅ _Oke, aku catat ya~_\n\n` +
        `❓ *Pertanyaan ${stepNum + 1}:*\n${nextQ}`
    )

    return true
}

module.exports = {
    config: pluginConfig,
    handler,
    answerHandler
}