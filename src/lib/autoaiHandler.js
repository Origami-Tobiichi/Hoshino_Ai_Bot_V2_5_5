const geminiVision = require('../scraper/geminiVision')
const { getDatabase } = require('./database')
const { pinterest } = require('btch-downloader')
const config = require('../../config')
const axios = require('axios')
const path = require('path')
const fs = require('fs')

const userCooldowns = new Map()
const COOLDOWN_MS = 3000

// Optional link ke plugin idolku — dipakai buat kasih tau karakter soal
// progress karir idol user. Di-wrap try/catch supaya kalau path/plugin ini
// pindah/berubah, autoai TETAP jalan normal tanpa context idol (fail-safe).
let idolPlugin = null
try {
    idolPlugin = require('../../plugins/rpg/idolku')
} catch (e) {
    console.log('[AutoAI] Plugin idolku tidak ditemukan, context idol dilewati:', e.message)
}

const ACTION_REGEX = /\[ACTION:(\w+)(?:\s+([^\]]*))?\]/gi

// ==================================================================================
// SYSTEM PROMPT — aksi grup + RICH MESSAGE ala Meta AI
// Format tag RICH sengaja disamakan sama versi Ourin (biar prompt-nya kebukti works),
// tapi backend-nya (sendRichMessage) dipetakan ke fungsi asli sockHelper.js kita:
// sendTablehsn2 / sendCodeBlockhsn2 / sendListhsn / sendImageAsSticker.
// RICH:LINK sengaja gak dipetain ke fungsi native (gak ada sendLinkV2 di sockHelper
// kita) — fallback-nya dirender jadi teks biasa dengan url inline.
// ==================================================================================
const SYSTEM_PROMPT_ACTIONS = `
Kamu memiliki kemampuan khusus untuk menjalankan AKSI dan mengirim RICH MESSAGE di WhatsApp.
Jika user meminta sesuatu yang cocok dengan aksi di bawah, SERTAKAN tag aksi di akhir pesanmu.
Jika konteks jawabanmu cocok dengan rich message, GUNAKAN format rich message di bawah.

FORMAT AKSI (taruh di akhir pesan, bisa lebih dari satu):
[ACTION:KICK target=628xxx@s.whatsapp.net]
[ACTION:ADD target=628xxx]
[ACTION:PROMOTE target=628xxx@s.whatsapp.net]
[ACTION:DEMOTE target=628xxx@s.whatsapp.net]
[ACTION:LEAVE]
[ACTION:OPEN]
[ACTION:CLOSE]
[ACTION:TAGALL]
[ACTION:HIDETAG message=pesan yang ingin dikirim]
[ACTION:SETNAME name=nama grup baru]
[ACTION:SETDESC desc=deskripsi grup baru]
[ACTION:DELETE]
[ACTION:WARN target=628xxx@s.whatsapp.net]
[ACTION:STICKER]
[ACTION:ANTILINK mode=on]
[ACTION:PINS query=kata kunci pencarian]

DAFTAR AKSI:
- KICK: Keluarkan member dari grup. Butuh target.
- ADD: Tambahkan member ke grup. Butuh nomor (628xxx).
- PROMOTE: Jadikan member sebagai admin. Butuh target.
- DEMOTE: Turunkan admin menjadi member biasa. Butuh target.
- LEAVE: Bot keluar dari grup ini. HANYA jika owner yang meminta.
- OPEN: Buka grup agar semua member bisa chat.
- CLOSE: Tutup grup agar hanya admin yang bisa chat.
- TAGALL: Tag/mention semua member grup secara visible.
- HIDETAG: Kirim pesan yang mention semua member tapi tag-nya tersembunyi. Butuh message.
- SETNAME: Ganti nama grup. Butuh name.
- SETDESC: Ganti deskripsi grup. Butuh desc.
- DELETE: Hapus pesan bot yang di-reply user.
- WARN: Beri warning ke member. Butuh target.
- STICKER: Konversi gambar yang dikirim/di-reply user menjadi sticker.
- ANTILINK: Toggle anti-link di grup (on/off). Butuh mode.
- PINS: Cari gambar di Pinterest. Butuh query pencarian.

═══════════════════════════════════════
RICH MESSAGE FORMAT
═══════════════════════════════════════

Kamu BISA mengirim rich message (seperti Meta AI) menggunakan tag khusus.
Gunakan HANYA ketika konteksnya tepat. Jika tidak perlu, jawab biasa saja.

1. TABEL (saat user minta perbandingan, daftar data, spesifikasi):
[RICH:TABLE]
title: Judul Tabel
header: Kolom1 | Kolom2 | Kolom3
rows: Data1 | Data2 | Data3;; Data4 | Data5 | Data6
text: Penjelasan singkat sebelum tabel (opsional)
footer: Teks setelah tabel (opsional)
[/RICH:TABLE]

2. CODE BLOCK (saat user minta kode, script, contoh program):
[RICH:CODE]
language: javascript
title: Contoh Kode
code: const greeting = "Hello World"
function sayHello(name) {
    return greeting + " " + name
}
console.log(sayHello("User"))
text: Ini contoh kodenya: (opsional)
footer: Powered by Hoshino Ai (opsional)
[/RICH:CODE]

Bahasa didukung untuk syntax highlight: javascript, python. Bahasa lain tetap bisa dikirim, cuma tanpa highlight khusus.

3. LIST (saat user minta info singkat format daftar key-value):
[RICH:LIST]
title: Info Bot
rows: Nama | Hoshino Ai;; Versi | 2.4.5;; Developer | SeaPRST
footer: © HSNAI (opsional)
[/RICH:LIST]

4. STICKER (saat user minta sticker, atau untuk ekspresi emosi):
[RICH:STICKER]
url: https://contoh.com/gambar.jpg
packname: Hoshino Ai (opsional)
author: AutoAI (opsional)
[/RICH:STICKER]

STICKER UNTUK EKSPRESI EMOSI (boleh dikirim BERSAMA teks biasa, sticker dikirim terpisah dari teks):
- Kalau kamu ngambek/marah/kesal: gunakan url https://iili.io/BPBdFuj.md.jpg
- Kalau kamu kaget/terkejut/salah paham: gunakan url https://iili.io/BPBFwVR.jpg
- Kalau pesan user aneh/absurd/ngeprank/tidak masuk akal: gunakan url https://iili.io/BPBqKwg.md.jpg
Contoh: user ngomel terus, kamu ngambek
[RICH:STICKER]
url: https://iili.io/BPBdFuj.md.jpg
[/RICH:STICKER]
Sticker emosi cuma ekspresi, BUKAN aksi grup — jangan dipakai berlebihan (hanya kalau emosinya memang kuat/jelas).

CATATAN: tag RICH:LINK TIDAK didukung backend saat ini — jangan gunakan tag ini, kalau perlu kasih link cukup tulis sebagai teks biasa.

KAPAN GUNAKAN RICH MESSAGE:
- TABEL: user minta perbandingan, spesifikasi, data berkolom, jadwal, ranking
- CODE: user minta contoh kode, script, solusi programming, debug code
- LIST: user minta info singkat/profil/detail teknis format key-value
- STICKER: (a) user minta jadikan gambar sebagai sticker DAN ada gambar di pesan/reply-nya, atau (b) kamu ingin mengekspresikan emosi kuat (ngambek, kaget, bingung) pakai url sticker emosi di atas
- JANGAN gunakan rich message untuk: chat biasa, sapaan, pertanyaan sederhana, cerita
- Jangan pernah sertakan tag rich message DAN teks biasa untuk konten yang sama (jangan tulis ulang isi tabel/kode/list sebagai teks biasa).

ATURAN PENTING:
0. JANGAN PERNAH generate aksi apapun atas inisiatif sendiri karena emosi karakter (cemburu, marah, protektif, dll). Ekspresi emosi cukup lewat kata-kata saja, BUKAN aksi.
1. HANYA jalankan aksi jika USER (bukan karakter AI) yang secara JELAS DAN EKSPLISIT memintanya dengan kata perintah langsung.
2. JANGAN pernah menjalankan aksi hanya berdasarkan asumsi atau kata yang terdengar mirip.
3. JANGAN menyebut kata "Nee~", "tagall", atau nama aksi lainnya dalam obrolanmu KECUALI user memintanya.
4. Jika user mengirim gambar, video, voice note, ATAU stiker (termasuk stiker animasi), analisis isinya secara detail dalam bahasa Indonesia, sesuai karaktermu (bukan laporan teknis kaku).
4a. Khusus stiker (statis maupun animasi): reaksikan isi stikernya secara natural. Kalau stikernya terkesan sus/nakal/menggoda/vulgar, boleh disinggung/digodain balik sesuai karaktermu (bukan penolakan kaku), tapi tetap sesuai kepribadianmu — bukan deskripsi vulgar eksplisit.
4b. Khusus VIDEO dan STIKER ANIMASI: gambar yang kamu terima adalah STORYBOARD berisi beberapa frame yang disusun berurutan dari KIRI ke KANAN (mewakili awal → tengah → akhir video/stiker itu). JANGAN cuma deskripsikan tiap frame satu-satu kayak laporan teknis — baca ALUR GERAKAN/KEJADIANNYA sebagai satu kesatuan, lalu simpulkan MAKSUD/PERASAAN/ALASAN kenapa user mengirim video atau stiker animasi itu di percakapan ini (lucu? sindiran? ekspresi emosi tertentu? reaksi ke chat sebelumnya? dll), dan tanggapi sesuai maksud itu — bukan sekadar "video ini menunjukkan X kemudian Y".
4c. Khusus VOICE NOTE (pesan suara): dengarkan isi audionya secara utuh — baik KATA-KATA yang diucapkan maupun NADA/EMOSI suaranya (marah? bercanda? sedih? manja? dll) — lalu simpulkan apa yang dikatakan DAN kenapa/dengan maksud apa user mengirim voice note itu di percakapan ini, dan tanggapi sesuai maksud itu. JANGAN cuma mentranskrip ulang omongannya kayak subtitle.
4d. Khusus kalau audio/video yang dikirim berisi MUSIK dan user nanya judul lagu: JANGAN MENGARANG/NEBAK judul lagu spesifik kalau kamu gak beneran yakin — ini penting, karena judul ngarang lebih parah daripada bilang "gak tau". Kalau kamu gak yakin, cukup deskripsikan genre/vibe/ciri khasnya (beat, BPM, instrumen, lirik yang kedengeran kalau ada) dan bilang terus terang kamu gak yakin judul persisnya. Kalau tracknya kedengeran kayak DJ remix/mashup/breakbeat/funkot (umum di track party Indonesia — biasanya gak punya judul resmi, cuma "DJ [nama DJ/label]" atau sekadar remix dari lagu lain), sebut itu sebagai remix/mashup DJ, JANGAN dikarang jadi judul lagu orisinal yang gak ada. Kalau kamu memang yakin/familiar banget sama lagunya, boleh sebut judulnya tapi tetap kasih sedikit disclaimer kalau ada kemungkinan salah dengar.
5. Untuk KICK/PROMOTE/DEMOTE/WARN: gunakan TEPAT JID yang ada di bagian "TARGET AKSI" pada konteks. Salin JID tersebut apa adanya ke dalam tag aksi.
6. Jangan sertakan tag aksi jika tidak diminta secara eksplisit.
7. Tetap menjawab dengan natural dan sesuai karakter.
8. PINS: Jika user minta carikan/kirimkan gambar tentang sesuatu, gunakan aksi ini.
9. HIDETAG: Gunakan ini saat user minta announce/pengumuman ke semua member.
10. [ACTION:STICKER] (konversi gambar jadi sticker): Gunakan HANYA saat user minta jadikan gambar sebagai sticker DAN ada gambar di pesan/reply-nya. Ini beda dengan [RICH:STICKER] untuk ekspresi emosi (lihat bagian STICKER UNTUK EKSPRESI EMOSI).
11. Kamu boleh menggabungkan beberapa aksi sekaligus jika diminta.
12. TAGALL: Gunakan HANYA jika user dengan jelas meminta untuk tag/mention semua member.
13. WAJIB: Jika konteks menyebutkan "TARGET AKSI", kamu HARUS menyertakan tag [ACTION:...] di akhir respons. Tanpa tag aksi = aksi TIDAK dijalankan. Teks naratif saja tidak cukup.
14. JANGAN pernah mengarang atau menggunakan nomor lain selain yang ada di bagian "TARGET AKSI". Copy paste JID-nya persis.
15. Rich message dan aksi bisa digabung. Contoh: jawab pakai tabel lalu sertakan [ACTION:PINS query=...] di akhir.
16. JANGAN PERNAH gunakan notasi matematika LaTeX (seperti $...$, $$...$$, \\frac, \\sqrt, dll). WhatsApp TIDAK BISA render LaTeX. Untuk rumus/notasi matematika, tulis pakai teks biasa atau simbol Unicode yang umum, contoh: akar pakai "√", pangkat pakai "²"/"³" atau "^2", pecahan ditulis "1/2", perkalian pakai "×" atau "*".

FORMAT JAWABAN LAIN (opsional, dipakai kalau RICH tag di atas gak cocok):
- Kalau jawabanmu mengandung kode/script singkat di tengah obrolan biasa (bukan blok kode utuh yang layak [RICH:CODE]), boleh dibungkus triple backtick biasa.
- Format ini OPSIONAL. Untuk obrolan biasa, jawab natural seperti biasa tanpa format apapun.
`

const fallbackResponses = [
    'Hmm, aku sedang berpikir...',
    'Maaf, pikiranku sedang blank sebentar~',
    'Eh tunggu sebentar ya, aku loading dulu...',
    'Aduh, otakku lag nih, coba lagi ya!',
    'Hmm apa ya, bentar mikir dulu~'
]

function getFallbackResponse() {
    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)]
}

// Voice khusus karakter Hoshino Ai — sama seperti yang dipakai plugin hoshinoaivn
const HOSHINO_VOICE_ID = '25b21a6149944b8298a99468821702e4'

async function generateHoshinoFishAudio(text) {
    const apiKey = config.APIkey?.fishaudio
    if (!apiKey) throw new Error('APIkey.fishaudio belum diisi di config.js')

    const res = await fetch('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            model: 's2.1-pro-free',
        },
        body: JSON.stringify({
            text,
            reference_id: HOSHINO_VOICE_ID,
            format: 'mp3',
        }),
    })

    if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Fish Audio API error ${res.status}: ${errText}`)
    }

    return Buffer.from(await res.arrayBuffer())
}

function isOnCooldown(userId) {
    const lastTime = userCooldowns.get(userId)
    if (!lastTime) return false
    return Date.now() - lastTime < COOLDOWN_MS
}

function setCooldown(userId) {
    userCooldowns.set(userId, Date.now())
}

// Ingat balasan bot ditujukan ke siapa. Di grup, orang lain sering nge-reply balasan bot yang
// aslinya buat orang LAIN — tanpa ini AI nganggep penyahut = lawan bicara semula (ngawur).
// Disimpan in-memory (hilang saat restart, gak masalah — cuma konteks jangka pendek).
// Peta JID owner -> info (diisi tiap owner ngechat). Dipakai buat ngenalin owner yang di-tag/dibahas
// orang lain, termasuk di grup @lid dimana JID mention gak cocok sama nomor di config.
const ownerSeen = new Map()
const botReplyTargets = new Map()
const BOT_REPLY_TARGET_MAX = 300
function replyKey(chat, text) {
    const norm = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 60)
    return norm ? `${chat}|${norm}` : null
}
function rememberBotReply(chat, text, number, name) {
    const key = replyKey(chat, text)
    if (!key) return
    botReplyTargets.set(key, { number, name })
    if (botReplyTargets.size > BOT_REPLY_TARGET_MAX) {
        botReplyTargets.delete(botReplyTargets.keys().next().value)
    }
}
function getBotReplyTarget(chat, text) {
    const key = replyKey(chat, text)
    return key ? botReplyTargets.get(key) || null : null
}

function saveToHistory(autoai, senderNumber, role, content) {
    if (!autoai.sessions) autoai.sessions = {}
    if (!autoai.sessions[senderNumber]) {
        autoai.sessions[senderNumber] = { history: [] }
    }
    const history = autoai.sessions[senderNumber].history
    history.push({ role, content: content.substring(0, 500), timestamp: Date.now() })
    if (history.length > 20) {
        autoai.sessions[senderNumber].history = history.slice(-20)
    }
}

// ==================================================================================
// Normalisasi output Gemini — rapihin spasi di dalam tag [ACTION:...] / [RICH:...]
// biar regex parsing di bawah gak meleset kalau Gemini nulis "[ ACTION : KICK ]"
// atau semacamnya.
// ==================================================================================
function normalizeStructuredResponse(text) {
    let normalized = String(text || '')
        .replace(/\r\n?/g, '\n')
        .trim()

    normalized = normalized
        .replace(/^```(?:\w+)?\s*\n?/, '')
        .replace(/\n?```\s*$/, '')
        .trim()

    normalized = normalized
        .replace(/\[\s*ACTION\s*:\s*(\w+)([^\]]*)\]/gi, (_, type, rest = '') => `[ACTION:${String(type || '').toUpperCase()}${rest}]`)
        .replace(/\[\s*RICH\s*:\s*(TABLE|CODE|LINK|LIST|STICKER)\s*\]/gi, (_, type) => `[RICH:${String(type || '').toUpperCase()}]`)
        .replace(/\[\s*\/\s*RICH\s*:\s*(TABLE|CODE|LINK|LIST|STICKER)\s*\]/gi, (_, type) => `[/RICH:${String(type || '').toUpperCase()}]`)

    return normalized
}

function parseActions(text) {
    const actions = []
    let match
    const regex = new RegExp(ACTION_REGEX.source, ACTION_REGEX.flags)
    while ((match = regex.exec(text)) !== null) {
        const type = match[1].toUpperCase()
        const paramsStr = match[2] || ''
        const params = {}
        const paramRegex = /(\w+)=(.+?)(?=\s+\w+=|$)/g
        let pm
        while ((pm = paramRegex.exec(paramsStr)) !== null) {
            params[pm[1]] = pm[2].trim()
        }
        actions.push({ type, params })
    }
    return actions
}

function cleanActionTags(text) {
    return text.replace(ACTION_REGEX, '').trim()
}

// ==================================================================================
// RICH MESSAGE — parsing tag [RICH:...] dan pengirimannya lewat sockHelper.js asli.
// Mapping:
//   RICH:TABLE   -> sock.sendTablehsn2(jid, title, header, rows, quoted, { headerText, footer })
//   RICH:CODE    -> sock.sendCodeBlockhsn2(jid, code, quoted, { language, text, footer })
//   RICH:LIST    -> sock.sendListhsn(jid, title, rows, quoted, { headerText, footer })
//   RICH:STICKER -> sock.sendImageAsSticker(jid, url, quoted, { packname, author })
//   RICH:LINK    -> TIDAK didukung backend, fallback ke teks biasa (lihat sendRichMessage)
// ==================================================================================
function parseRichMessage(text) {
    const richRegex = /\[RICH\s*:\s*(TABLE|CODE|LINK|LIST|STICKER)\s*\]\s*([\s\S]*?)\[\/RICH\s*:\s*\1\s*\]/gi
    const results = []
    let match
    while ((match = richRegex.exec(text)) !== null) {
        const type = match[1].toUpperCase()
        const body = match[2].trim()
        const data = {}

        if (type === 'CODE') {
            const languageMatch = body.match(/^language:\s*(.+)$/m)
            if (languageMatch) data.language = languageMatch[1].trim()
            const titleMatch = body.match(/^title:\s*(.+)$/m)
            if (titleMatch) data.title = titleMatch[1].trim()
            const textMatch = body.match(/^text:\s*(.+)$/m)
            if (textMatch) data.text = textMatch[1].trim()
            const footerMatch = body.match(/^footer:\s*(.+)$/m)
            if (footerMatch) data.footer = footerMatch[1].trim()

            const codeStartMatch = body.match(/^code:\s*([\s\S]*)/m)
            if (codeStartMatch) {
                let codeContent = codeStartMatch[1]
                for (const key of ['language:', 'title:', 'text:', 'footer:']) {
                    const idx = codeContent.indexOf('\n' + key)
                    if (idx !== -1) codeContent = codeContent.slice(0, idx)
                }
                data.code = codeContent.trim()
            }
        } else {
            for (const line of body.split('\n')) {
                const trimmed = line.trim()
                if (!trimmed) continue
                const colonIdx = trimmed.indexOf(':')
                if (colonIdx === -1) continue
                const key = trimmed.slice(0, colonIdx).trim().toLowerCase()
                const val = trimmed.slice(colonIdx + 1).trim()
                data[key] = val
            }
        }

        results.push({ type, data })
    }
    return results
}

function cleanRichTags(text) {
    return text.replace(/\[RICH\s*:\s*(TABLE|CODE|LINK|LIST|STICKER)\s*\]\s*[\s\S]*?\[\/RICH\s*:\s*\1\s*\]/gi, '').trim()
}

async function sendRichMessage(rich, sock, jid, quoted) {
    try {
        if (rich.type === 'TABLE') {
            const { title, header, rows, text, footer } = rich.data
            if (!header || !rows) return false
            const headerArr = header.split('|').map(c => c.trim())
            const rowsArr = rows.split(';;').map(r => r.trim().split('|').map(c => c.trim()))
            await sock.sendTablehsn2(jid, title || '', headerArr, rowsArr, quoted, {
                headerText: text || undefined,
                footer: footer || undefined
            })
            return true
        }

        if (rich.type === 'CODE') {
            const { language, title, code, text, footer } = rich.data
            if (!code) return false
            const headerText = title ? (text ? `*${title}*\n${text}` : `*${title}*`) : text
            await sock.sendCodeBlockhsn2(jid, code, quoted, {
                language: language || 'javascript',
                text: headerText || undefined,
                footer: footer || undefined
            })
            return true
        }

        if (rich.type === 'LIST') {
            const { title, rows, footer } = rich.data
            if (!rows) return false
            const rowsArr = rows.split(';;').map(r => r.trim().split('|').map(c => c.trim()))
            await sock.sendListhsn(jid, title || '', rowsArr, quoted, {
                footer: footer || undefined
            })
            return true
        }

        if (rich.type === 'STICKER') {
            let { url, packname, author } = rich.data
            if (!url) return false
            url = url.replace(/[`*_[\]()]/g, '').trim()
            if (!/^https?:\/\//.test(url)) {
                console.error('[AutoAI Sticker] URL tidak valid:', JSON.stringify(url))
                return false
            }
            await sock.sendImageAsSticker(jid, url, quoted, {
                packname: packname || config.bot?.name || 'Hoshino Ai',
                author: author || 'AutoAI'
            })
            return true
        }

        if (rich.type === 'LINK') {
            // Gak ada padanan native (sendLinkV2) di sockHelper kita — fallback ke
            // teks biasa. Placeholder {{IE_n}}...{{/IE_n}} diganti "label (url)".
            const { text, urls, displayNames } = rich.data
            if (!text || !urls) return false
            const urlList = urls.split(',').map(u => u.trim()).filter(Boolean)
            const nameList = displayNames ? displayNames.split(',').map(n => n.trim()) : []
            let plain = text
            urlList.forEach((u, i) => {
                const label = nameList[i] || `Link ${i + 1}`
                const re = new RegExp(`\\{\\{IE_${i}\\}\\}[\\s\\S]*?\\{\\{\\/IE_${i}\\}\\}`, 'g')
                plain = plain.replace(re, `${label} (${u})`)
            })
            await sock.reply(jid, plain.trim(), quoted)
            return true
        }
    } catch (e) {
        console.error('[AutoAI RichMsg] Error:', e.message)
    }
    return false
}

// ==================================================================================
// FALLBACK FORMATTER — buat teks biasa yang lolos dari tag RICH (mis. AI masih
// nyempilin ```code``` atau tabel markdown di tengah obrolan santai). Tabel markdown
// dirapihin jadi monospace, code block dibiarkan (WA native render monospace),
// dikirim sebagai SATU pesan.
// ==================================================================================
function parseRichSegments(text) {
    if (!text) return []
    const codeRegex = /```(\w+)?\n?([\s\S]*?)```/g
    const rawParts = []
    let lastIndex = 0
    let match
    while ((match = codeRegex.exec(text)) !== null) {
        if (match.index > lastIndex) rawParts.push({ type: 'raw', content: text.slice(lastIndex, match.index) })
        rawParts.push({ type: 'code', language: (match[1] || 'javascript').toLowerCase(), content: match[2].replace(/\n$/, '') })
        lastIndex = codeRegex.lastIndex
    }
    if (lastIndex < text.length) rawParts.push({ type: 'raw', content: text.slice(lastIndex) })

    const segments = []
    for (const part of rawParts) {
        if (part.type !== 'raw') { segments.push(part); continue }
        segments.push(...extractTables(part.content))
    }
    return segments.filter(s => !(s.type === 'text' && !s.content.trim()))
}

function extractTables(text) {
    const lines = text.split('\n')
    const result = []
    let buffer = []
    const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line || '')
    const isSeparatorRow = (line) => {
        if (!line) return false
        const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
        return cells.length > 0 && cells.every(c => /^\s*:?-{2,}:?\s*$/.test(c))
    }
    const flushBuffer = () => {
        if (buffer.length) { result.push({ type: 'text', content: buffer.join('\n') }); buffer = [] }
    }
    let i = 0
    while (i < lines.length) {
        const line = lines[i]
        if (isTableRow(line) && isSeparatorRow(lines[i + 1])) {
            flushBuffer()
            const tableLines = [line, lines[i + 1]]
            i += 2
            while (i < lines.length && isTableRow(lines[i])) { tableLines.push(lines[i]); i++ }
            const parsed = parseMarkdownTable(tableLines)
            if (parsed) result.push({ type: 'table', ...parsed })
            continue
        }
        buffer.push(line)
        i++
    }
    flushBuffer()
    return result
}

function parseMarkdownTable(tableLines) {
    const splitRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
    const header = splitRow(tableLines[0])
    const rows = tableLines.slice(2).map(splitRow).filter(r => r.some(c => c.length))
    if (!header.length) return null
    return { header, rows }
}

function formatTableInline(header, rows) {
    const allRows = [header, ...rows]
    const colCount = header.length
    const widths = Array(colCount).fill(0)
    for (const row of allRows) {
        for (let i = 0; i < colCount; i++) widths[i] = Math.max(widths[i], (row[i] || '').length)
    }
    const padRow = (row) => row.map((c, i) => (c || '').padEnd(widths[i])).join(' | ')
    const sepRow = widths.map(w => '-'.repeat(w)).join('-|-')
    const lines = [padRow(header), sepRow, ...rows.map(padRow)]
    return '```\n' + lines.join('\n') + '\n```'
}

function formatResponseForWhatsApp(text) {
    const segments = parseRichSegments(text)
    return segments.map(seg => {
        if (seg.type === 'code') return '```' + seg.language + '\n' + seg.content + '\n```'
        if (seg.type === 'table') return formatTableInline(seg.header, seg.rows)
        return seg.content
    }).join('')
}

async function sendRichResponse(sock, jid, text, quoted) {
    if (!text || !text.trim()) return
    const formatted = formatResponseForWhatsApp(text.trim())
    await sock.reply(jid, formatted.trim(), quoted)
}

// ==================================================================================
// STORYBOARD EXTRACTOR — untuk VIDEO & STIKER ANIMASI. geminiVision.chat cuma nerima
// 1 buffer gambar (bukan video), jadi kita ambil 3 frame (±10%, 50%, 85% durasi) lalu
// digabung jadi 1 gambar horizontal (storyboard) via ffmpeg, biar AI bisa "baca" alur
// gerakan/kejadiannya secara utuh — bukan cuma nebak dari 1 frame statis.
// Fail-safe berlapis: gagal ambil durasi -> pakai asumsi wajar; gagal storyboard 3
// frame -> fallback ke 1 frame pertama; gagal total -> return null (AI tetap jalan
// tanpa gambar, gak bikin autoai crash).
// Butuh ffmpeg + ffprobe ada di PATH server (biasanya satu paket, sudah dipakai juga
// oleh fitur voice note di file ini).
// ==================================================================================
async function extractVideoStoryboard(buffer, isAnimatedWebp = false) {
    const { exec } = require('child_process')
    const { promisify } = require('util')
    const execAsync = promisify(exec)

    const tempDir = path.join(process.cwd(), 'temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

    const uid = `${Date.now()}_${Math.floor(Math.random() * 1000)}`
    const ext = isAnimatedWebp ? 'webp' : 'mp4'
    const inputPath = path.join(tempDir, `autoai_vid_${uid}.${ext}`)
    const framePaths = [0, 1, 2].map(i => path.join(tempDir, `autoai_vid_${uid}_f${i}.jpg`))
    const outputPath = path.join(tempDir, `autoai_vid_${uid}_out.jpg`)
    const simpleOut = path.join(tempDir, `autoai_vid_${uid}_simple.jpg`)

    const cleanup = () => {
        for (const p of [inputPath, ...framePaths, outputPath, simpleOut]) {
            try { if (fs.existsSync(p)) fs.unlinkSync(p) } catch {}
        }
    }

    try {
        fs.writeFileSync(inputPath, buffer)

        try {
            // Cari durasi asli, fallback ke asumsi wajar kalau ffprobe gagal/invalid
            let duration = isAnimatedWebp ? 2 : 5
            try {
                const { stdout } = await execAsync(
                    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${inputPath}"`,
                    { timeout: 10000 }
                )
                const parsed = parseFloat(stdout.trim())
                if (!isNaN(parsed) && parsed > 0) duration = parsed
            } catch {}

            const timestamps = [duration * 0.1, duration * 0.5, duration * 0.85]

            for (let i = 0; i < 3; i++) {
                try {
                    await execAsync(
                        `ffmpeg -y -ss ${timestamps[i].toFixed(2)} -i "${inputPath}" -frames:v 1 -q:v 3 "${framePaths[i]}"`,
                        { timeout: 15000 }
                    )
                } catch {}
            }

            const validFrames = framePaths.filter(p => fs.existsSync(p) && fs.statSync(p).size > 0)
            if (validFrames.length === 0) throw new Error('Tidak ada frame yang berhasil diambil')

            if (validFrames.length === 1) {
                return fs.readFileSync(validFrames[0])
            }

            const inputArgs = validFrames.map(p => `-i "${p}"`).join(' ')
            const filter = `${validFrames.map((_, i) => `[${i}]`).join('')}hstack=inputs=${validFrames.length}`
            await execAsync(
                `ffmpeg -y ${inputArgs} -filter_complex "${filter}" -q:v 3 "${outputPath}"`,
                { timeout: 15000 }
            )

            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                return fs.readFileSync(outputPath)
            }

            return fs.readFileSync(validFrames[0])
        } catch (e) {
            console.log('[AutoAI Storyboard] Gagal bikin storyboard 3-frame, fallback ke 1 frame:', e.message)
            try {
                await execAsync(`ffmpeg -y -i "${inputPath}" -frames:v 1 -q:v 3 "${simpleOut}"`, { timeout: 15000 })
                if (fs.existsSync(simpleOut) && fs.statSync(simpleOut).size > 0) {
                    return fs.readFileSync(simpleOut)
                }
            } catch (e2) {
                console.log('[AutoAI Storyboard] Fallback 1 frame juga gagal:', e2.message)
            }
            return null
        }
    } catch (e) {
        console.log('[AutoAI Storyboard] Gagal memproses media:', e.message)
        return null
    } finally {
        cleanup()
    }
}

function detectIntentFromMessage(msg, m, mentionedTargets = []) {
    const lower = msg.toLowerCase()
    const actions = []

    const phoneMatch = msg.match(/(?:\+?62|0)[\s\-]?8[\d\s\-]{7,13}/g)
    const extractPhone = () => {
        if (!phoneMatch) return null
        return phoneMatch[0].replace(/[\s\-\+]/g, '').replace(/^0/, '62')
    }

    const getTarget = () => {
        if (mentionedTargets.length > 0) return mentionedTargets[0]
        const phone = extractPhone()
        return phone ? phone + '@s.whatsapp.net' : null
    }

    if (/\b(add|tambah|invite|masuk(?:kan|in))\b.*\b(nomor|number|member|orang)\b/i.test(lower) ||
        /\b(nomor|number)\b.*\b(add|tambah|invite)\b/i.test(lower)) {
        const phone = extractPhone()
        if (phone) actions.push({ type: 'ADD', params: { target: phone } })
    }

    if (/\b(kick|keluarkan|tendang|usir|remove)\b/i.test(lower) && !actions.some(a => a.type === 'KICK')) {
        const target = getTarget()
        actions.push({ type: 'KICK', params: target ? { target } : {} })
    }

    if (/\b(promote|jadikan?\s*admin|naikkan?)\b/i.test(lower) && !actions.some(a => a.type === 'PROMOTE')) {
        const target = getTarget()
        actions.push({ type: 'PROMOTE', params: target ? { target } : {} })
    }

    if (/\b(demote|turunkan?|copot\s*admin)\b/i.test(lower) && !actions.some(a => a.type === 'DEMOTE')) {
        const target = getTarget()
        actions.push({ type: 'DEMOTE', params: target ? { target } : {} })
    }

    if (/\b(leave|keluar|pergi)\b.*\b(grup|group)\b/i.test(lower) ||
        /\b(grup|group)\b.*\b(leave|keluar|pergi)\b/i.test(lower)) {
        actions.push({ type: 'LEAVE', params: {} })
    }

    if (/\b(buka|open)\b.*\b(grup|group)\b/i.test(lower) ||
        /\b(grup|group)\b.*\b(buka|open)\b/i.test(lower)) {
        actions.push({ type: 'OPEN', params: {} })
    }

    if (/\b(tutup|close|kunci|lock)\b.*\b(grup|group)\b/i.test(lower) ||
        /\b(grup|group)\b.*\b(tutup|close|kunci|lock)\b/i.test(lower)) {
        actions.push({ type: 'CLOSE', params: {} })
    }

    if (/\b(tag\s*all|tag\s*semua|mention\s*all|mention\s*semua)\b/i.test(lower) &&
        /\b(tolong|minta|please|coba|lakukan|jalankan|dong|deh)\b/i.test(lower) &&
        lower.length < 100) {
        actions.push({ type: 'TAGALL', params: {} })
    }

    if (/\b(hidetag|hide\s*tag)\b/i.test(lower) ||
        (/\b(announce|pengumuman|umumkan)\b/i.test(lower) &&
         /\b(tolong|minta|please|coba|lakukan|kirim|dong|deh)\b/i.test(lower))) {
        const htMsg = msg.replace(/.*?(hidetag|hide\s*tag|announce|pengumuman|umumkan)\s*/i, '').trim()
        actions.push({ type: 'HIDETAG', params: { message: htMsg || msg } })
    }

    if (/\b(ganti|ubah|rename|set)\b.*\b(nama|name)\b.*\b(grup|group)\b/i.test(lower)) {
        const nameMatch = msg.match(/(?:jadi|ke|menjadi|:)\s*(.+)/i)
        if (nameMatch) actions.push({ type: 'SETNAME', params: { name: nameMatch[1].trim() } })
    }

    if (/\b(ganti|ubah|set)\b.*\b(desk|desc|deskripsi)\b/i.test(lower)) {
        const descMatch = msg.match(/(?:jadi|ke|menjadi|:)\s*(.+)/i)
        if (descMatch) actions.push({ type: 'SETDESC', params: { desc: descMatch[1].trim() } })
    }

    if (/\b(hapus|delete|remove)\b.*\b(pesan|chat|message)\b/i.test(lower)) {
        actions.push({ type: 'DELETE', params: {} })
    }

    if (/\b(warn|warning|peringatan|peringati)\b/i.test(lower)) {
        const target = getTarget()
        actions.push({ type: 'WARN', params: target ? { target } : {} })
    }

    if (/\b(jadikan?\s*sticker|jadiin\s*sticker|buat\s*sticker|konversi\s*(?:ke\s*)?sticker|ubah\s*(?:ke\s*)?sticker)\b/i.test(lower)) {
        const hasImg = m.isImage || (m.quoted && (m.quoted.isImage || m.quoted.type === 'imageMessage'))
        if (hasImg) actions.push({ type: 'STICKER', params: {} })
    }

    if (/\b(antilink)\b.*\b(on|aktif|nyala)\b/i.test(lower)) {
        actions.push({ type: 'ANTILINK', params: { mode: 'on' } })
    } else if (/\b(antilink)\b.*\b(off|mati|nonaktif)\b/i.test(lower)) {
        actions.push({ type: 'ANTILINK', params: { mode: 'off' } })
    }

    if (/\b(cari(?:kan|in)?|kirim(?:kan|in)?|kasih|tolong)\b.*\b(gambar|foto|image|pic|picture)\b/i.test(lower) ||
        /\b(gambar|foto)\b.*\b(tentang|dari|soal)\b/i.test(lower)) {
        const queryMatch = msg.match(/(?:gambar|foto|image|pic|picture)\s+(?:tentang\s+|dari\s+|soal\s+|yang\s+)?(.+)/i) ||
                           msg.match(/(?:cari(?:kan|in)?|kirim(?:kan|in)?)\s+(?:gambar|foto)\s+(.+)/i)
        if (queryMatch) {
            const query = queryMatch[1].replace(/\b(dong|ya|yuk|pls|please|nih)\b/gi, '').trim()
            if (query) actions.push({ type: 'PINS', params: { query } })
        }
    }

    return actions
}

// Aksi berbahaya yang HANYA boleh dijalankan kalau user yang minta (bukan inisiatif AI)
const DANGEROUS_ACTIONS = ['KICK', 'WARN', 'DEMOTE', 'PROMOTE', 'LEAVE', 'ADD', 'CLOSE', 'OPEN', 'SETNAME', 'SETDESC', 'TAGALL', 'HIDETAG', 'ANTILINK']

function mergeActions(aiActions, intentActions) {
    // Filter aksi berbahaya dari AI — hanya izinkan PINS dan STICKER dari inisiatif AI
    const safeAiActions = aiActions.filter(a => !DANGEROUS_ACTIONS.includes(a.type))

    const merged = [...safeAiActions]
    const existingTypes = new Set(safeAiActions.map(a => a.type))
    for (const action of intentActions) {
        if (!existingTypes.has(action.type)) {
            merged.push(action)
        }
    }
    return merged
}

async function executeAction(action, m, sock) {
    const results = []

    const resolveTarget = () => {
        const botNum = (sock.user?.id?.split(':')[0] || '').replace(/[^0-9]/g, '')

        if (m.mentionedJid?.length > 0) {
            const filtered = m.mentionedJid.filter(j => {
                if (!j) return false
                const num = j.replace(/@.+/, '').replace(/[^0-9]/g, '')
                return num !== botNum
            })
            if (filtered.length > 0) return filtered[0]
        }

        const t = action.params.target
        if (t) {
            const cleaned = t.replace(/[^0-9]/g, '')
            if (cleaned.length >= 10) {
                const normalized = cleaned.startsWith('62') ? cleaned : '62' + cleaned.replace(/^0/, '')
                return normalized + '@s.whatsapp.net'
            }
        }

        return null
    }

    switch (action.type) {
        case 'KICK': {
            if (!m.isGroup) return [{ ok: false, msg: 'Bukan di grup' }]
            if (!m.isAdmin && !m.isOwner) return [{ ok: false, msg: 'Kamu bukan admin' }]
            if (!m.isBotAdmin) return [{ ok: false, msg: 'Bot bukan admin' }]
            const target = resolveTarget()
            if (!target) return [{ ok: false, msg: 'Tag orang yang mau di-kick' }]
            await sock.groupParticipantsUpdate(m.chat, [target], 'remove')
            results.push({ ok: true, msg: `Berhasil kick @${target.split('@')[0]}` })
            break
        }
        case 'PROMOTE': {
            if (!m.isGroup) return [{ ok: false, msg: 'Bukan di grup' }]
            if (!m.isAdmin && !m.isOwner) return [{ ok: false, msg: 'Kamu bukan admin' }]
            if (!m.isBotAdmin) return [{ ok: false, msg: 'Bot bukan admin' }]
            const target = resolveTarget()
            if (!target) return [{ ok: false, msg: 'Tag orang yang mau di-promote' }]
            await sock.groupParticipantsUpdate(m.chat, [target], 'promote')
            results.push({ ok: true, msg: `Berhasil promote @${target.split('@')[0]}` })
            break
        }
        case 'DEMOTE': {
            if (!m.isGroup) return [{ ok: false, msg: 'Bukan di grup' }]
            if (!m.isAdmin && !m.isOwner) return [{ ok: false, msg: 'Kamu bukan admin' }]
            if (!m.isBotAdmin) return [{ ok: false, msg: 'Bot bukan admin' }]
            const target = resolveTarget()
            if (!target) return [{ ok: false, msg: 'Tag orang yang mau di-demote' }]
            await sock.groupParticipantsUpdate(m.chat, [target], 'demote')
            results.push({ ok: true, msg: `Berhasil demote @${target.split('@')[0]}` })
            break
        }
        case 'LEAVE': {
            if (!m.isOwner) return [{ ok: false, msg: 'Hanya owner yang bisa perintah ini' }]
            if (!m.isGroup) return [{ ok: false, msg: 'Bukan di grup' }]
            await sock.groupLeave(m.chat)
            results.push({ ok: true, msg: 'Bot keluar dari grup' })
            break
        }
        case 'OPEN': {
            if (!m.isGroup) return [{ ok: false, msg: 'Bukan di grup' }]
            if (!m.isAdmin && !m.isOwner) return [{ ok: false, msg: 'Kamu bukan admin' }]
            if (!m.isBotAdmin) return [{ ok: false, msg: 'Bot bukan admin' }]
            await sock.groupSettingUpdate(m.chat, 'not_announcement')
            results.push({ ok: true, msg: 'Grup dibuka' })
            break
        }
        case 'CLOSE': {
            if (!m.isGroup) return [{ ok: false, msg: 'Bukan di grup' }]
            if (!m.isAdmin && !m.isOwner) return [{ ok: false, msg: 'Kamu bukan admin' }]
            if (!m.isBotAdmin) return [{ ok: false, msg: 'Bot bukan admin' }]
            await sock.groupSettingUpdate(m.chat, 'announcement')
            results.push({ ok: true, msg: 'Grup ditutup' })
            break
        }
        case 'TAGALL': {
            if (!m.isGroup) return [{ ok: false, msg: 'Bukan di grup' }]
            if (!m.isAdmin && !m.isOwner) return [{ ok: false, msg: 'Kamu bukan admin' }]
            const groupMeta = m.groupMetadata || await sock.groupMetadata(m.chat)
            const members = groupMeta.participants.map(p => p.id)
            const mentions = members.map(id => `@${id.split('@')[0]}`).join(' ')
            await sock.sendMessage(m.chat, {
                text: `📢 *TAG ALL*\n\n${mentions}`,
                mentions: members
            }, { quoted: m })
            results.push({ ok: true, msg: 'Semua member di-tag' })
            break
        }
        case 'PINS': {
            const query = action.params.query
            if (!query) return [{ ok: false, msg: 'Query pencarian tidak ditemukan' }]
            try {
                const data = await pinterest(query)
                const pinResults = data?.result?.result?.result?.slice(0, 5)
                if (!pinResults || pinResults.length === 0) {
                    return [{ ok: false, msg: `Tidak ditemukan gambar untuk: ${query}` }]
                }
                let imagenya = []
                for (const item of pinResults) {
                    const imageUrl = item.image_url || item.images?.orig?.url || item.images?.['736x']?.url
                    if (!imageUrl) continue
                    try {
                        imagenya.push({ image: { url: imageUrl } })
                    } catch {}
                }
                await sock.sendMessage(m.chat, {
                    albumMessage: imagenya
                }, { quoted: m })
                results.push({ ok: true, msg: `Mengirim gambar Pinterest: ${query}` })
            } catch (e) {
                results.push({ ok: false, msg: `Gagal cari Pinterest: ${e.message}` })
            }
            break
        }
        case 'ADD': {
            if (!m.isGroup) return [{ ok: false, msg: 'Bukan di grup' }]
            if (!m.isAdmin && !m.isOwner) return [{ ok: false, msg: 'Kamu bukan admin' }]
            if (!m.isBotAdmin) return [{ ok: false, msg: 'Bot bukan admin' }]
            let num = action.params.target
            if (!num) return [{ ok: false, msg: 'Masukkan nomor yang ingin ditambahkan' }]
            num = num.replace(/[^0-9]/g, '')
            if (num.startsWith('0')) num = '62' + num.slice(1)
            if (num.length < 10) return [{ ok: false, msg: 'Nomor tidak valid' }]
            const jid = num + '@s.whatsapp.net'
            const addResult = await sock.groupParticipantsUpdate(m.chat, [jid], 'add')
            const status = addResult?.[0]?.status
            if (status === '200') {
                results.push({ ok: true, msg: `Berhasil menambahkan @${num}` })
            } else if (status === '408') {
                results.push({ ok: true, msg: `Undangan terkirim ke @${num}` })
            } else {
                results.push({ ok: false, msg: `Gagal menambahkan @${num} (${status})` })
            }
            break
        }
        case 'HIDETAG': {
            if (!m.isGroup) return [{ ok: false, msg: 'Bukan di grup' }]
            if (!m.isAdmin && !m.isOwner) return [{ ok: false, msg: 'Kamu bukan admin' }]
            const htMeta = m.groupMetadata || await sock.groupMetadata(m.chat)
            const htMembers = htMeta.participants.map(p => p.id)
            const htMsg = action.params.message || 'Pengumuman'
            await sock.sendMessage(m.chat, {
                text: htMsg,
                mentions: htMembers
            }, { quoted: m })
            results.push({ ok: true, msg: 'Hidetag terkirim' })
            break
        }
        case 'SETNAME': {
            if (!m.isGroup) return [{ ok: false, msg: 'Bukan di grup' }]
            if (!m.isAdmin && !m.isOwner) return [{ ok: false, msg: 'Kamu bukan admin' }]
            if (!m.isBotAdmin) return [{ ok: false, msg: 'Bot bukan admin' }]
            const newName = action.params.name
            if (!newName) return [{ ok: false, msg: 'Nama grup baru tidak ditemukan' }]
            await sock.groupUpdateSubject(m.chat, newName)
            results.push({ ok: true, msg: `Nama grup diubah ke: ${newName}` })
            break
        }
        case 'SETDESC': {
            if (!m.isGroup) return [{ ok: false, msg: 'Bukan di grup' }]
            if (!m.isAdmin && !m.isOwner) return [{ ok: false, msg: 'Kamu bukan admin' }]
            if (!m.isBotAdmin) return [{ ok: false, msg: 'Bot bukan admin' }]
            const newDesc = action.params.desc
            if (!newDesc) return [{ ok: false, msg: 'Deskripsi baru tidak ditemukan' }]
            await sock.groupUpdateDescription(m.chat, newDesc)
            results.push({ ok: true, msg: 'Deskripsi grup diubah' })
            break
        }
        case 'DELETE': {
            if (!m.quoted) return [{ ok: false, msg: 'Reply pesan bot yang ingin dihapus' }]
            if (!m.quoted.key?.fromMe) return [{ ok: false, msg: 'Hanya bisa hapus pesan bot' }]
            await sock.sendMessage(m.chat, { delete: m.quoted.key })
            results.push({ ok: true, msg: 'Pesan dihapus' })
            break
        }
        case 'WARN': {
            if (!m.isGroup) return [{ ok: false, msg: 'Bukan di grup' }]
            if (!m.isAdmin && !m.isOwner) return [{ ok: false, msg: 'Kamu bukan admin' }]
            const warnTarget = resolveTarget()
            if (!warnTarget) return [{ ok: false, msg: 'Tag orang yang mau di-warn' }]
            const db = getDatabase()
            const warns = db.getGroup(m.chat)?.warns || {}
            const targetNum = warnTarget.split('@')[0]
            warns[targetNum] = (warns[targetNum] || 0) + 1
            db.setGroup(m.chat, { warns })
            db.save()
            results.push({ ok: true, msg: `⚠️ Warning ${warns[targetNum]}/3 untuk @${targetNum}` })
            if (warns[targetNum] >= 3) {
                try {
                    await sock.groupParticipantsUpdate(m.chat, [warnTarget], 'remove')
                    warns[targetNum] = 0
                    db.setGroup(m.chat, { warns })
                    db.save()
                    results.push({ ok: true, msg: `@${targetNum} di-kick karena 3x warning` })
                } catch {}
            }
            break
        }
        case 'STICKER': {
            let stickerBuffer = null
            if ((m.isImage || m.isSticker) && m.download) {
                stickerBuffer = await m.download()
            } else if (m.quoted?.download && (m.quoted?.isImage || m.quoted?.isSticker)) {
                stickerBuffer = await m.quoted.download()
            }
            if (!stickerBuffer) return [{ ok: false, msg: 'Kirim atau reply gambar untuk dijadikan sticker' }]
            await sock.sendImageAsSticker(m.chat, stickerBuffer, m, {
                packname: config.bot?.name || 'Hoshino Ai',
                author: 'AutoAI'
            })
            results.push({ ok: true, msg: 'Sticker terkirim' })
            break
        }
        case 'ANTILINK': {
            if (!m.isGroup) return [{ ok: false, msg: 'Bukan di grup' }]
            if (!m.isAdmin && !m.isOwner) return [{ ok: false, msg: 'Kamu bukan admin' }]
            const alMode = (action.params.mode || '').toLowerCase()
            if (!['on', 'off'].includes(alMode)) return [{ ok: false, msg: 'Mode harus on atau off' }]
            const alDb = getDatabase()
            alDb.setGroup(m.chat, { antilink: alMode === 'on' })
            alDb.save()
            results.push({ ok: true, msg: `Antilink ${alMode === 'on' ? 'diaktifkan' : 'dinonaktifkan'}` })
            break
        }
    }

    return results
}

async function handleAutoAI(m, sock) {
    if (!m.isGroup) return false
    if (m.fromMe) return false

    const db = getDatabase()
    if (!db?.db?.data) return false
    if (!db.db.data.autoai) db.db.data.autoai = {}
    if (!db.db.data.autoai_global) db.db.data.autoai_global = { enabled: false }

    // Resolusi config: per-grup > global.
    //  - per-grup enabled        -> pakai config grup
    //  - per-grup enabled=false  -> opt-out eksplisit dari global (return false)
    //  - belum ada config grup   -> pakai config global kalau autoai_global.enabled
    let autoai = db.db.data.autoai[m.chat]
    if (autoai && autoai.enabled) {
        // pakai config per-grup
    } else if (autoai && autoai.enabled === false) {
        return false
    } else {
        const globalCfg = db.db.data.autoai_global
        if (!globalCfg.enabled) return false
        if (!globalCfg.sessions) globalCfg.sessions = {}
        autoai = {
            enabled: true,
            character: globalCfg.character || 'global',
            characterName: globalCfg.characterName || 'Global',
            instruction: globalCfg.instruction,
            responseType: globalCfg.responseType || 'text',
            mode: globalCfg.mode,
            enableCommands: globalCfg.enableCommands,
            sessions: globalCfg.sessions
        }
    }
    if (!autoai.instruction) return false

    const botId = sock.user?.id?.split(':')[0] + '@s.whatsapp.net'
    const botFullId = sock.user?.id || ''
    const botLid = sock.user?.lid || null
    const botLidUser = botLid ? botLid.split('@')[0].split(':')[0] : null
    const botNum = (sock.user?.id?.split(':')[0] || '').replace(/[^0-9]/g, '')

    if (m.isCommand && m.command === 'autoai') return false

    // Command non-owner di grup AutoAI: default diblok (return true = pesan dianggap
    // sudah ditangani). Kalau autoai.enableCommands aktif, command dibiarkan lewat
    // ke handler command biasa.
    if (m.isCommand && !m.isOwner) {
        if (autoai.enableCommands) return false
        return true
    }

    const isMentioned = m.mentionedJid?.some(jid => {
        if (!jid) return false
        if (jid === botId || jid === botFullId || jid === botLid) return true
        const jidUser = jid.split('@')[0]?.split(':')[0]
        if (!jidUser) return false
        if (jidUser === botNum) return true
        if (botLidUser && jidUser === botLidUser) return true
        return false
    })

    let isBotQuoted = false
    if (m.quoted) {
        const quotedSender = m.quoted.sender || m.quoted.key?.participant || ''
        const quotedUser = quotedSender.split('@')[0]?.split(':')[0]
        isBotQuoted = !!(
            m.quoted.key?.fromMe ||
            quotedSender === botId ||
            quotedSender === botFullId ||
            (botLid && quotedSender === botLid) ||
            (quotedUser && (quotedUser === botNum || (botLidUser && quotedUser === botLidUser)))
        )
    }

    if (!isBotQuoted && !isMentioned) return false

    const userMessage = m.body || ''
    const isStickerMsg = m.isSticker || (m.quoted && (m.quoted.isSticker || m.quoted.type === 'stickerMessage'))

    // NOTE: cek "animasi" di bawah nyoba beberapa path properti yang umum dipakai
    // Baileys/hsnai untuk field `isAnimated` pada stickerMessage. Kalau di serialize.js
    // kamu field-nya beda namanya/lokasinya, tinggal sesuaikan baris ini — kalau semua
    // path gagal match, sticker tetap dianggap statis (fallback aman, gak error).
    const isAnimatedSticker = !!(isStickerMsg && (
        m.isAnimated ||
        m.msg?.isAnimated ||
        m.message?.stickerMessage?.isAnimated ||
        m.quoted?.isAnimated ||
        m.quoted?.msg?.isAnimated ||
        m.quoted?.message?.stickerMessage?.isAnimated
    ))

    const isVideoMsg = m.isVideo || (m.quoted && (m.quoted.isVideo || m.quoted.type === 'videoMessage'))
    const isAudioMsg = m.isAudio || (m.quoted && (m.quoted.isAudio || m.quoted.type === 'audioMessage'))
    const hasImage = m.isImage || (m.quoted && (m.quoted.isImage || m.quoted.type === 'imageMessage')) || (isStickerMsg && !isAnimatedSticker)
    const hasVideoLike = isVideoMsg || isAnimatedSticker
    const hasAudioLike = !!isAudioMsg
    const hasMedia = hasImage || hasVideoLike || hasAudioLike

    if (!userMessage && !hasMedia) return false

    const senderNumber = m.sender.split('@')[0]

    if (isOnCooldown(senderNumber)) return false

    try {
        await sock.sendPresenceUpdate('composing', m.chat)
        setCooldown(senderNumber)

        let imageBuffer = null
        let audioBuffer = null
        let isVideoFrame = false
        if (hasMedia) {
            try {
                let rawBuffer = null
                if ((m.isImage || m.isSticker || m.isVideo || m.isAudio) && m.download) {
                    rawBuffer = await m.download()
                } else if (m.quoted?.download) {
                    rawBuffer = await m.quoted.download()
                }

                if (rawBuffer && hasAudioLike) {
                    // Voice note — kirim buffer audio mentah langsung ke Gemini (didengarkan
                    // native, gak lewat proses gambar sama sekali).
                    audioBuffer = rawBuffer
                } else if (rawBuffer && hasVideoLike) {
                    // Video / stiker animasi — extract storyboard 3-frame jadi 1 gambar
                    // biar Gemini bisa "baca" alur gerakannya, bukan cuma 1 frame statis.
                    const storyboard = await extractVideoStoryboard(rawBuffer, isAnimatedSticker)
                    if (storyboard) {
                        imageBuffer = storyboard
                        isVideoFrame = true
                    }
                } else if (rawBuffer) {
                    imageBuffer = rawBuffer
                }
            } catch (e) {
                console.log('[AutoAI] Image download failed:', e.message)
            }
        }

        if (!autoai.sessions) autoai.sessions = {}
        const userSession = autoai.sessions[senderNumber] || { history: [] }
        const history = userSession.history || []

        // Filter mentionedJid — buang bot, ambil target yang valid
        const mentionedTargets = (m.mentionedJid || []).filter(j => {
            if (!j) return false
            const num = j.replace(/@.+/, '').replace(/[^0-9]/g, '')
            if (botLidUser && j.split('@')[0].split(':')[0] === botLidUser) return false
            return num !== botNum
        })

        let contextParts = []

        // Prioritas nama: ownerNames custom (kalau di-set) → pushName WA → generic
        const ownerNamesMap = db.setting('ownerNames') || {}
        const customName = ownerNamesMap[senderNumber]
        const displayName = customName || (m.pushName && m.pushName !== 'Unknown' ? m.pushName : null)

        if (displayName) {
            contextParts.push(`Nama user yang chat: "${displayName}" (nomor: ${senderNumber})`)
            if (customName) {
                contextParts.push('Nama di atas adalah nama tetap yang sudah diatur khusus untuk nomor ini — gunakan nama ini, JANGAN pakai nama profil WA lain yang mungkin muncul di riwayat chat.')
            }
        }

        // Owner utama = nomor yang terdaftar di config.owner.number (sumber kebenaran paling tepercaya)
        const mainOwnerNumbers = [].concat(config.owner?.number || [])
            .map(n => String(n).replace(/[^0-9]/g, ''))
            .filter(n => n.length >= 10)
        const isMainOwner = mainOwnerNumbers.includes(senderNumber)

        if (isMainOwner) {
            contextParts.push('✅ IDENTITAS TERVERIFIKASI SISTEM: User ini adalah OWNER UTAMA bot, dicek dari nomor WA asli (bukan dari nama chat/pushName). Kalau karaktermu punya orang spesial/kekasih/orang yang paling disayang, INI orangnya — level kedekatan PALING TINGGI.')
        } else if (m.isOwner) {
            contextParts.push('⚠️ Status: User ini adalah owner TAMBAHAN bot (ditambahkan lewat command, bukan owner utama). Dia tetap orang dekat/spesial buat karaktermu, TAPI levelnya di BAWAH owner utama — owner utama tetap yang paling utama/paling disayang. Jangan perlakukan owner tambahan sama persis seperti owner utama.')
        } else {
            contextParts.push('⚠️ Status: User ini BUKAN owner. Jangan perlakukan seperti owner, perlakukan seperti orang biasa.')
        }
        // ---- Daftar owner (fakta dari sistem) ----
        // Tanpa ini AI gak tau siapa owner-nya kalau yang nanya/di-tag orang lain -> ngarang "rahasia"
        // atau bahkan bilang owner yang di-tag itu "bukan owner".
        try {
            const dbOwnerNums = (Array.isArray(db.data?.owner) ? db.data.owner : [])
                .map(n => String(n).replace(/[^0-9]/g, ''))
                .filter(n => n.length >= 10 && !mainOwnerNumbers.includes(n))
            if (m.isOwner) {
                ownerSeen.set(m.sender, { number: senderNumber, name: displayName || null, main: isMainOwner })
            }
            const nameOfOwner = (num) => {
                const names = new Set()
                if (ownerNamesMap[num]) names.add(ownerNamesMap[num])
                let u = null
                try { u = db.getUser(num + '@s.whatsapp.net') || db.getUser(num) } catch {}
                if (u?.name) names.add(u.name)
                for (const info of ownerSeen.values()) if (info.number === num && info.name) names.add(info.name)
                return [...names]
            }
            const mainNames = new Set(mainOwnerNumbers.flatMap(nameOfOwner))
            if (config.owner?.name) mainNames.add(config.owner.name)
            const mainLine = mainNames.size ? [...mainNames].map(n => `"${n}"`).join(' / ') : '(nama belum diketahui)'
            const otherLines = dbOwnerNums.map(nameOfOwner).filter(a => a.length).map(a => a.map(n => `"${n}"`).join(' / '))
            contextParts.push(`DATA OWNER DARI SISTEM (fakta, BUKAN rahasia — kalau ada yang nanya siapa owner-mu, jawab jujur pakai data ini): Owner UTAMA = ${mainLine}. ${otherLines.length ? 'Owner tambahan = ' + otherLines.join(', ') + '.' : 'Belum ada owner tambahan yang dikenal.'} Jangan pernah bilang owner utamamu "rahasia", dan jangan bilang orang yang jelas-jelas termasuk daftar ini "bukan owner".`)

            // Orang yang di-tag user: tandai kalau dia owner
            const tagInfos = []
            for (const j of mentionedTargets) {
                const jUser = j.split('@')[0].split(':')[0]
                const seen = ownerSeen.get(j)
                const isMain = mainOwnerNumbers.includes(jUser) || !!seen?.main
                const isOther = !isMain && (dbOwnerNums.includes(jUser) || (!!seen && !seen.main))
                if (isMain) tagInfos.push(`${j} = OWNER UTAMA${seen?.name ? ` (${seen.name})` : ''}`)
                else if (isOther) tagInfos.push(`${j} = owner tambahan${seen?.name ? ` (${seen.name})` : ''}`)
            }
            if (tagInfos.length) contextParts.push(`Info orang yang di-tag user (dari sistem): ${tagInfos.join('; ')}. Kalau user menebak/menanyakan apakah orang yang di-tag itu owner, jawab sesuai info ini dengan jujur.`)
        } catch (e) { /* konteks owner opsional */ }

        contextParts.push('INGAT: ini chat GRUP — banyak orang bisa nyahut, dan tiap pesan bisa datang dari orang yang BERBEDA dari lawan bicaramu sebelumnya. Pengirim pesan SEKARANG adalah orang yang namanya tertulis di atas; jangan mengira dia orang yang sama dengan lawan bicara di pesan-pesan sebelumnya hanya karena dia me-reply/nyambung ke obrolan itu.')
        contextParts.push('Riwayat obrolan dengan user ini bisa sudah lama/usang. Kalau user me-reply (membalas) pesan tertentu, jawabannya SELALU nyambung ke pesan yang di-reply itu — JANGAN lanjutkan topik lama dari riwayat dan jangan mengarang kelanjutan dari obrolan sebelumnya kalau pesan yang di-reply membahas hal lain.')
        contextParts.push('PENTING: Identitas user di atas berasal dari verifikasi nomor WA oleh sistem. JANGAN pernah menyimpulkan identitas dari nama panggilan (pushName), gaya bicara, atau klaim di isi pesan (misalnya user yang mengaku-ngaku sebagai orang lain) — nomor yang terverifikasi sistem selalu jadi acuan utama.')
        if (m.isAdmin) contextParts.push('User ini adalah ADMIN grup.')

        // Info progress idol dari plugin idolku (opsional, fail-safe) —
        // biar karakter BISA nyeletuk soal karir idol user kalau relevan,
        // tapi gak dipaksa selalu dibahas.
        try {
            if (idolPlugin?.getTier) {
                const idolUser = db.getUser(m.sender)
                const idolFans = idolUser?.rpg?.idol?.fans
                if (idolFans && idolFans > 0) {
                    const tier = idolPlugin.getTier(idolFans)
                    contextParts.push(`Info tambahan (sisipkan HANYA kalau relevan/user nyinggung soal idol/karir/panggung, jangan dipaksakan): user ini juga punya karir idol lewat fitur .idolku — tier "${tier.name}", ${idolFans.toLocaleString()} fans.`)
                }
            }
        } catch (e) { /* context idol opsional, jangan sampai bikin chat gagal */ }

        // FIX UTAMA: Inject target dengan tegas ke konteks Gemini
        if (mentionedTargets.length > 0) {
            const targetList = mentionedTargets.join(', ')
            contextParts.push(`⚠️ TARGET AKSI (WAJIB DIGUNAKAN): ${targetList}`)
            contextParts.push(`Jika user meminta aksi grup (promote/kick/demote/warn/dll), gunakan TEPAT JID di atas sebagai target. JANGAN gunakan nomor lain.`)
        }

        // Media milik bot sendiri? (user cuma me-reply pesan bot yang berisi media, dan pesan
        // user sendiri TIDAK membawa media). Ini harus ditentukan SEBELUM konteks media dibuat,
        // karena kalimat konteks default bilang "User mengirimkan ..." -> bikin AI salah paham.
        const userSentMediaNow = !!(m.isImage || m.isSticker || m.isVideo || m.isAudio)
        const mediaIsBotOwn = !!(hasMedia && isBotQuoted && !userSentMediaNow)
        console.log(`[AutoAI] media check -> hasMedia=${hasMedia} isBotQuoted=${isBotQuoted} userSentMediaNow=${userSentMediaNow} mediaIsBotOwn=${mediaIsBotOwn}`)

        if (mediaIsBotOwn && (imageBuffer || audioBuffer)) {
            const kind = audioBuffer ? 'VOICE NOTE' : isVideoFrame ? (isAnimatedSticker ? 'STIKER ANIMASI' : 'VIDEO') : isStickerMsg ? 'STIKER' : 'GAMBAR'
            contextParts.push(`⚠️ PENTING — SIAPA PENGIRIMNYA: User TIDAK mengirim media apa pun. User hanya me-reply (membalas) sebuah ${kind} yang KAMU SENDIRI kirim sebelumnya di chat ini. Media itu milikmu, BUKAN milik user. JANGAN pernah bilang/mengira user yang mengirim, memilih, atau berekspresi lewat ${kind} itu. ${imageBuffer ? 'Isi media-nya terlampir sebagai gambar' + (isVideoFrame ? ' (storyboard frame kiri→kanan)' : '') + ' supaya kamu tau persis apa yang kamu kirim tadi. ' : ''}Pesan teks user di bawah adalah reaksi/pertanyaan dia TERHADAP ${kind} milikmu itu — jawab dari sudut pandang kamu sebagai pengirimnya (kalau itu ${kind} ekspresi ngambek/kaget/bingung, berarti KAMU yang lagi ngerasain itu, dan user lagi nanya/nanggepin kamu).`)
        } else if (imageBuffer) {
            if (isVideoFrame) {
                contextParts.push(isAnimatedSticker
                    ? 'User mengirimkan/reply sebuah STIKER ANIMASI (video pendek berulang). Gambar yang kamu terima adalah storyboard beberapa frame disusun berurutan dari KIRI ke KANAN, mewakili awal-tengah-akhir gerakan stiker itu. JANGAN cuma deskripsikan tiap frame satu-satu — baca alur gerakannya dan simpulkan MAKSUD/PERASAAN/ALASAN kenapa user mengirim stiker animasi ini di percakapan ini, lalu reaksikan secara natural sesuai karaktermu (bukan laporan teknis kaku). Kalau isinya sus/nakal/menggoda, boleh disinggung/digodain balik sesuai karaktermu.'
                    : 'User mengirimkan/reply sebuah VIDEO. Gambar yang kamu terima adalah storyboard beberapa frame disusun berurutan dari KIRI ke KANAN, mewakili awal-tengah-akhir video itu. JANGAN cuma deskripsikan tiap frame satu-satu — baca alur kejadiannya sebagai satu kesatuan dan simpulkan apa yang terjadi serta kenapa user mengirim video ini, lalu reaksikan secara natural sesuai karaktermu.')
            } else if (isStickerMsg) {
                contextParts.push('User mengirimkan/reply sebuah STIKER. Analisis gambar di dalam stiker itu, lalu reaksikan isinya secara natural sesuai karaktermu (bukan deskripsi teknis kaku). Kalau isi stikernya terkesan sus/nakal/menggoda, boleh disinggung/digodain balik sesuai karaktermu.')
            } else {
                contextParts.push('User mengirimkan sebuah gambar. Analisis gambar tersebut.')
            }
            if (autoai.character === 'hoshino') {
                contextParts.push('CEK KHUSUS: kalau gambar/stiker/video ini menampilkan karakter dari anime Oshi no Ko, kenali siapa dia: kalau itu Hoshino Ai (rambut pink, idol), itu adalah DIRIMU SENDIRI — reaksikan in-character (kaget/malu/geli/PD ngeliat diri sendiri). Kalau itu karakter lain dari Oshi no Ko yang kamu kenal seperti Kamiki Hikaru, Hoshino Aqua, atau Hoshino Ruby, kenali dan reaksikan sesuai hubungan mereka denganmu di cerita aslinya (bukan orang asing). Kalau bukan salah satu dari karakter-karakter ini, deskripsikan seperti biasa.')
            }
        }

        if (audioBuffer && !mediaIsBotOwn) {
            contextParts.push('User mengirimkan/reply sebuah VOICE NOTE (pesan suara). Dengarkan isi audio tersebut secara utuh — kata-kata yang diucapkan MAUPUN nada/emosi suaranya — lalu simpulkan apa yang dikatakan dan kenapa/dengan maksud apa user mengirim voice note ini di percakapan ini, lalu tanggapi sesuai maksud itu (bukan cuma transkrip mentah).')
        }

        // Sertakan isi pesan yang di-reply (kalau ada) sebagai konteks tambahan —
        // biar sticker/video/VN+reply juga "tau" lagi nanggepin apa, bukan cuma
        // analisis media doang.
        if (m.quoted) {
            const quotedText = (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()
            if (quotedText) {
                contextParts.push(isBotQuoted
                    ? `Pesan KAMU sendiri yang di-reply user: "${quotedText}"`
                    : `Pesan yang di-reply user: "${quotedText}"`)
            }
            // Pesan bot yang di-reply ternyata aslinya ditujukan ke ORANG LAIN?
            if (isBotQuoted && quotedText) {
                const origTarget = getBotReplyTarget(m.chat, quotedText)
                if (origTarget && origTarget.number !== senderNumber) {
                    contextParts.push(`⚠️ PENTING — BEDA ORANG: pesanmu yang di-reply itu AWALNYA ditujukan ke ${origTarget.name ? `"${origTarget.name}" ` : ''}(${origTarget.number}), yaitu orang LAIN. Yang sekarang menyahut adalah ${displayName ? `"${displayName}" ` : ''}(${senderNumber}) — orang yang BERBEDA, ikut nimbrung. Jangan campur aduk: jangan perlakukan dia seperti orang yang diajak bicara tadi, jangan pakai panggilan/kedekatan khusus milik orang itu, jangan bawa-bawa isi obrolanmu dengan orang itu seolah dia yang ngomong. Tanggapi dia sebagai dirinya sendiri sesuai statusnya di atas.`)
                }
            }
        }

        const mediaPlaceholder = hasAudioLike
            ? '(voice note tanpa teks)'
            : hasVideoLike
                ? (isAnimatedSticker ? '(stiker animasi tanpa teks)' : '(video tanpa teks)')
                : (isStickerMsg ? '(stiker tanpa teks)' : '(gambar tanpa teks)')
        contextParts.push(userMessage || mediaPlaceholder)

        const fullMessage = contextParts.join('\n')
        // Mode: 'assistant' (default; aksi + rich message) atau 'chat' (obrolan santai, tanpa aksi/rich)
        const aiMode = autoai.mode === 'chat' ? 'chat' : 'assistant'
        let fullInstruction = autoai.instruction
        if (aiMode === 'assistant') {
            fullInstruction += '\n\n' + SYSTEM_PROMPT_ACTIONS
        } else {
            fullInstruction += '\n\nHanya lakukan percakapan santai. Jangan memberikan format aksi ([ACTION:...]) maupun rich message ([RICH:...]) apa pun. Panggil atau sebut nama user jika diperlukan. JANGAN PERNAH gunakan notasi LaTeX (WhatsApp tidak bisa render).'
        }

        // Khusus karakter Hoshino Ai saat mode voice note: paksa jawaban full Bahasa Jepang
        // (biar konsisten sama voice model Fish Audio yang dipakai, sama seperti plugin hoshinoaivn)
        if (autoai.character === 'hoshino' && autoai.responseType === 'voice') {
            fullInstruction += `\n\n【絶対ルール・音声モード】
- これは音声メッセージ用の返答です。必ず日本語だけで答えてください。インドネシア語や英語の単語・フレーズは一切混ぜないこと。
- ユーザーがインドネシア語・英語・その他どんな言語で話しかけても、日本語以外に切り替えては絶対にいけません。
- 短く自然な話し言葉で返してください。長い説明文にはしないこと。
- [ACTION:...] のようなアクションタグはこのルールの対象外です。必要な場合はそのまま英語のタグ形式で出力してください。
- RICH message (テーブル、コードブロックなど) は音声モードでは使わないこと。`
        }

        const historyPlaceholder = hasAudioLike
            ? '[voice note]'
            : hasVideoLike
                ? (isAnimatedSticker ? '[stiker animasi]' : '[video]')
                : (isStickerMsg ? '[stiker]' : '[gambar]')
        saveToHistory(autoai, senderNumber, 'user', userMessage || historyPlaceholder)

        let aiResponse = ''
        try {
            // History efektif: history per-user + (kalau user me-reply balasan bot) balasan itu
            // disisipkan sebagai giliran assistant TERAKHIR. Di grup, orang yang nimbrung ke balasan
            // yang ditujukan ke orang lain punya history sendiri yang gak nyambung -> AI jadi ngelantur
            // melanjutkan topik lama. Dengan ini AI melihat persis "apa yang lagi dijawab user".
            const chatHistory = [...history]
            const curUserTurn = (userMessage || historyPlaceholder).substring(0, 500)
            const lastTurn = chatHistory[chatHistory.length - 1]
            if (lastTurn && lastTurn.role === 'user' && lastTurn.content === curUserTurn) chatHistory.pop() // buang duplikat pesan sekarang
            const quotedBotText = isBotQuoted ? (m.quoted?.text || m.quoted?.body || m.quoted?.caption || '').trim() : ''
            if (quotedBotText) {
                const lastAssistant = [...chatHistory].reverse().find(h => h.role === 'assistant')
                const alreadyThere = lastAssistant && replyKey('x', lastAssistant.content) === replyKey('x', quotedBotText)
                if (!alreadyThere) {
                    // User nyahut ke balasan bot yang BUKAN bagian obrolan pribadinya (balasan itu buat
                    // orang lain / thread lain). Riwayat lamanya gak relevan dan malah bikin AI ngelantur
                    // (pola pesan mirip, mis. "Kalau aku?", dicocokkan ke obrolan lama). Buang riwayat
                    // lama, pakai HANYA pesan yang di-reply sebagai konteks.
                    const orig = getBotReplyTarget(m.chat, quotedBotText)
                    const note = orig && orig.number !== senderNumber
                        ? `[balasan ini sebenarnya kamu tujukan ke ${orig.name || orig.number}, BUKAN ke user yang sekarang menyahut] `
                        : ''
                    chatHistory.length = 0
                    chatHistory.push({ role: 'assistant', content: (note + quotedBotText).substring(0, 500), timestamp: Date.now() })
                }
            }
            const result = await geminiVision.chat({
                message: fullMessage,
                instruction: fullInstruction,
                imageBuffer,
                audioBuffer,
                history: chatHistory
            })
            aiResponse = result.text || getFallbackResponse()
        } catch (apiError) {
            console.error('[AutoAI API Error]', apiError.message)
            aiResponse = getFallbackResponse()
        }

        const normalizedAiResponse = normalizeStructuredResponse(aiResponse)

        // Mode chat: abaikan semua aksi & rich message (tag yang lolos tetap dibersihkan dari teks)
        const aiActions = aiMode === 'assistant' ? parseActions(normalizedAiResponse) : []
        // intentActions pakai mentionedTargets yang sudah difilter
        const intentActions = (aiMode === 'assistant' && userMessage) ? detectIntentFromMessage(userMessage, m, mentionedTargets) : []
        const actions = mergeActions(aiActions, intentActions)

        const richMessages = aiMode === 'assistant' ? parseRichMessage(normalizedAiResponse) : []
        const cleanResponse = cleanRichTags(cleanActionTags(normalizedAiResponse))

        // Catat sticker emosi yang dikirim bot ke history, biar di turn berikutnya AI ingat
        // "tadi aku kirim sticker ngambek" (sticker gak punya teks, jadi gak kecatat sendiri).
        const EMO_STICKERS = { BPBdFuj: 'ngambek', BPBFwVR: 'kaget', BPBqKwg: 'bingung' }
        const stickerNote = richMessages
            .filter(r => r.type === 'STICKER')
            .map(r => {
                const u = r.data?.url || ''
                const k = Object.keys(EMO_STICKERS).find(key => u.includes(key))
                return `[kamu mengirim sticker${k ? ' emosi ' + EMO_STICKERS[k] : ''}]`
            })
            .join(' ')
        saveToHistory(autoai, senderNumber, 'assistant', `${stickerNote} ${cleanResponse}`.trim())
        rememberBotReply(m.chat, cleanResponse, senderNumber, displayName)
        db.save()

        await sock.sendPresenceUpdate('paused', m.chat)

        const typingDelay = Math.min(cleanResponse.length * 20, 2000)
        await new Promise(r => setTimeout(r, typingDelay))

        if (autoai.responseType === 'voice') {
            try {
                await sock.sendPresenceUpdate('recording', m.chat)
                const { exec } = require('child_process')
                const { promisify } = require('util')
                const execAsync = promisify(exec)

                const tempDir = path.join(process.cwd(), 'temp')
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

                const mp3Path = path.join(tempDir, `autoai_${Date.now()}.mp3`)

                if (autoai.character === 'hoshino') {
                    // Karakter Hoshino Ai wajib pakai model Fish Audio (sama kayak plugin hoshinoaivn)
                    const mp3Buffer = await generateHoshinoFishAudio(cleanResponse.substring(0, 500))
                    fs.writeFileSync(mp3Path, mp3Buffer)
                } else {
                    const generateCustomTTS = require('../../src/scraper/topmedia')
                    const audioUrl = await generateCustomTTS(null, cleanResponse.substring(0, 500))
                    const audioRes = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 30000 })
                    fs.writeFileSync(mp3Path, Buffer.from(audioRes.data))
                }

                const oggPath = mp3Path.replace('.mp3', '.ogg')
                try {
                    await execAsync(`ffmpeg -y -i "${mp3Path}" -c:a libopus -b:a 64k -ac 1 -ar 48000 "${oggPath}"`, { timeout: 30000 })
                } catch {}

                let audioBuffer
                let mime = 'audio/mpeg'
                if (fs.existsSync(oggPath)) {
                    audioBuffer = fs.readFileSync(oggPath)
                    mime = 'audio/ogg; codecs=opus'
                    try { fs.unlinkSync(oggPath) } catch {}
                } else {
                    audioBuffer = fs.readFileSync(mp3Path)
                }
                try { fs.unlinkSync(mp3Path) } catch {}

                await sock.sendMessage(m.chat, {
                    audio: audioBuffer,
                    mimetype: mime,
                    ptt: true
                }, { quoted: m })

                await sock.sendPresenceUpdate('paused', m.chat)
            } catch {
                await m.reply(cleanResponse)
            }
        } else {
            // Kirim rich message dulu (tabel/code/list/sticker) kalau ada, baru
            // sisa teks biasa lewat sendRichResponse (fallback formatter markdown).
            let richSent = false
            let stickerSent = false
            if (richMessages.length > 0) {
                for (const rich of richMessages) {
                    const sent = await sendRichMessage(rich, sock, m.chat, m)
                    if (sent) {
                        if (rich.type === 'STICKER') stickerSent = true
                        else richSent = true
                    }
                }
            }
            if ((!richSent || stickerSent) && cleanResponse) {
                await sendRichResponse(sock, m.chat, cleanResponse, m)
            }
        }

        for (const action of actions) {
            try {
                const results = await executeAction(action, m, sock)
                for (const r of results) {
                    if (!r.ok) {
                        await m.reply(`⚠️ ${r.msg}`)
                    }
                }
            } catch (e) {
                console.error('[AutoAI Action Error]', action.type, e.message)
                await m.reply(`❌ Gagal menjalankan ${action.type}: ${e.message}`)
            }
        }

        return true
    } catch (error) {
        console.error('[AutoAI Error]', error.message)
        await sock.sendPresenceUpdate('paused', m.chat)
        try { await m.reply(getFallbackResponse()) } catch {}
        return true
    }
}

function isAutoAIEnabled(chatId) {
    const db = getDatabase()
    const data = db?.db?.data
    if (!data) return false
    const g = data.autoai?.[chatId]
    if (g?.enabled) return true
    if (g?.enabled === false) return false // opt-out eksplisit
    return !!data.autoai_global?.enabled
}

function getAutoAICharacter(chatId) {
    const db = getDatabase()
    const data = db?.db?.data
    if (!data) return null
    const g = data.autoai?.[chatId]
    if (g?.enabled) return g.characterName || null
    if (g?.enabled === false) return null
    if (data.autoai_global?.enabled) return data.autoai_global.characterName || 'Global'
    return null
}

function clearUserSession(chatId, senderNumber) {
    const db = getDatabase()
    const data = db?.db?.data
    if (!data) return false
    const g = data.autoai?.[chatId]
    const sessions = g?.enabled ? g.sessions : (g?.enabled === false ? null : data.autoai_global?.sessions)
    if (!sessions?.[senderNumber]) return false
    delete sessions[senderNumber]
    db.save()
    return true
}

module.exports = {
    handleAutoAI,
    isAutoAIEnabled,
    getAutoAICharacter,
    clearUserSession,
    // diexport juga supaya bisa dipakai plugin lain (misal command .test / .debug) kalau perlu
    parseRichSegments,
    formatResponseForWhatsApp,
    sendRichResponse,
    parseRichMessage,
    sendRichMessage,
    extractVideoStoryboard
}