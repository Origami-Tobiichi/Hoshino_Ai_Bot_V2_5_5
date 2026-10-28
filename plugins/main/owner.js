const config = require('../../config')
const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'owner',
    alias: ['creator', 'dev', 'developer'],
    category: 'main',
    description: 'Menampilkan kontak owner bot',
    usage: '.owner',
    example: '.owner',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

// ─── Header type 5: video typography seamless loop ───────────────────────────
// addImage() di AIRich tampil kotak putih di chat, sedangkan addVideo() terbukti
// normal (lihat manggilhoshinoai.js). Jadi header dibuat video typography 6 detik:
// gambar header digelapkan jadi background + tulisan "OWNER" besar (bergelombang,
// kilau, glow berdenyut) + ticker teks geser atas/bawah + bintang berkedip.
// Semua animasi periodik, jadi frame terakhir nyambung ke frame pertama (seamless).
// Dirender pakai @napi-rs/canvas → di-encode ffmpeg → upload Uguu (cadangan Catbox)
// → addVideo. Hasil di-cache 30 menit (link Uguu sementara). Kalau gagal di mana
// pun, otomatis balik ke rich.addImage() dengan URL asli.
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { spawn } = require('child_process')

const HEADER_IMAGE_URL = 'https://raw.githubusercontent.com/fiturmediafire-beep/Hsn-ai-Tourl/main/uploads/1789285684791-c9210383.jpg'
const HEADER_W = 1280
const HEADER_H = 720
const HEADER_SECONDS = 6
const HEADER_FPS = 25
const HEADER_FONT_KEY = 'Rajdhani-Bold'   // dari config.assets.fonts
const HEADER_CACHE_TTL = 30 * 60 * 1000
const headerCache = { url: null, at: 0 }

let FF_BIN = null
async function findFfmpeg() {
    if (FF_BIN) return FF_BIN
    const cands = [process.env.FFMPEG_BIN, 'ffmpeg']
    try { cands.push(require('ffmpeg-static')) } catch { }
    for (const bin of cands.filter(Boolean)) {
        const ok = await new Promise(res => {
            const p = spawn(bin, ['-version'], { stdio: 'ignore' })
            p.on('error', () => res(false))
            p.on('close', c => res(c === 0))
        })
        if (ok) { FF_BIN = bin; return FF_BIN }
    }
    throw new Error('ffmpeg tidak ditemukan')
}

// ── scene typography (kode yang sama dites di Chromium: frame 0 == frame terakhir) ──
// Scene typography header: semua animasi periodik (kelipatan bulat dari 2π per loop),
// jadi frame terakhir nyambung mulus ke frame pertama = seamless loop.
function createHeaderScene({ mk, W, H, bgImg, bigFont, midFont, bigText, subText, tickerWords }) {
    const TAU = Math.PI * 2
    const BAND = 70

    // ── background statis (gambar header digelapkan + tint pink/ungu) ──
    const bg = mk(W, H)
    const b = bg.getContext('2d')
    b.fillStyle = '#12001f'
    b.fillRect(0, 0, W, H)
    if (bgImg) {
        const s = Math.max(W / bgImg.width, H / bgImg.height)
        const dw = bgImg.width * s
        const dh = bgImg.height * s
        b.drawImage(bgImg, (W - dw) / 2, (H - dh) / 2, dw, dh)
    }
    const tint = b.createLinearGradient(0, 0, W, H)
    tint.addColorStop(0, 'rgba(70,0,95,0.80)')
    tint.addColorStop(0.5, 'rgba(25,0,45,0.66)')
    tint.addColorStop(1, 'rgba(140,0,80,0.78)')
    b.fillStyle = tint
    b.fillRect(0, 0, W, H)
    const vg = b.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, W * 0.7)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, 'rgba(0,0,0,0.55)')
    b.fillStyle = vg
    b.fillRect(0, 0, W, H)

    const tl = mk(W, H)
    const t = tl.getContext('2d')
    const mctx = mk(8, 8).getContext('2d')

    // ── layout teks besar ──
    const SP = 14
    const measureBig = (size) => {
        mctx.font = bigFont(size)
        const ws = [...bigText].map(c => mctx.measureText(c).width)
        return { ws, total: ws.reduce((a, v) => a + v, 0) + SP * (ws.length - 1) }
    }
    let bigSize = 300
    let ml = measureBig(bigSize)
    while (ml.total > W - 260 && bigSize > 80) { bigSize -= 8; ml = measureBig(bigSize) }
    const bigBase = H / 2 + bigSize * 0.3 - 18
    const letterX = []
    {
        let cx = (W - ml.total) / 2
        for (const w of ml.ws) { letterX.push(cx); cx += w + SP }
    }
    const letters = [...bigText]

    // ── layout subtitle ──
    const SUBSP = 9
    mctx.font = midFont(30)
    const subWs = [...subText].map(c => mctx.measureText(c).width)
    const subW = subWs.reduce((a, v) => a + v, 0) + SUBSP * (subWs.length - 1)
    const subX0 = (W - subW) / 2
    const subY = bigBase + 78
    const subLetterX = []
    {
        let cx = subX0
        for (const w of subWs) { subLetterX.push(cx); cx += w + SUBSP }
    }
    const subChars = [...subText]

    // ── ticker ──
    const unit = tickerWords.join('  •  ') + '  •  '
    mctx.font = midFont(26)
    const unitW = mctx.measureText(unit).width

    // ── bintang (posisi deterministik) ──
    const stars = []
    let seed = 7
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    for (let i = 0; i < 22; i++) {
        stars.push({
            x: 60 + rnd() * (W - 120),
            y: BAND + 30 + rnd() * (H - 2 * BAND - 60),
            r: 6 + rnd() * 12,
            m: 1 + Math.floor(rnd() * 2),
            off: rnd()
        })
    }

    const sparkle = (x, cx, cy, r) => {
        x.beginPath()
        x.moveTo(cx, cy - r)
        x.quadraticCurveTo(cx, cy, cx + r, cy)
        x.quadraticCurveTo(cx, cy, cx, cy + r)
        x.quadraticCurveTo(cx, cy, cx - r, cy)
        x.quadraticCurveTo(cx, cy, cx, cy - r)
        x.closePath()
        x.fill()
    }

    const drawTicker = (x, p, y, dir, c1, c2) => {
        const g = x.createLinearGradient(0, 0, W, 0)
        g.addColorStop(0, c1)
        g.addColorStop(1, c2)
        x.fillStyle = g
        x.fillRect(0, y, W, BAND)
        x.font = midFont(26)
        x.textBaseline = 'middle'
        x.textAlign = 'left'
        x.fillStyle = '#ffffff'
        const off = dir * p * unitW
        const n = Math.ceil(W / unitW) + 3
        for (let k = -2; k < n; k++) x.fillText(unit, k * unitW + off, y + BAND / 2 + 1)
    }

    function paint(x, p) {
        x.globalAlpha = 1
        x.globalCompositeOperation = 'source-over'
        x.shadowBlur = 0
        x.drawImage(bg, 0, 0)

        // bintang berkedip
        x.fillStyle = '#ffffff'
        for (const s of stars) {
            const a = 0.15 + 0.85 * Math.max(0, Math.sin(TAU * (p * s.m + s.off)))
            x.globalAlpha = a
            sparkle(x, s.x, s.y, s.r * (0.6 + 0.4 * a))
        }
        x.globalAlpha = 1

        // ticker atas (geser kiri) & bawah (geser kanan)
        drawTicker(x, p, 0, -1, 'rgba(255,40,130,0.92)', 'rgba(170,60,255,0.92)')
        drawTicker(x, p, H - BAND, 1, 'rgba(170,60,255,0.92)', 'rgba(255,40,130,0.92)')
        x.fillStyle = 'rgba(255,255,255,0.35)'
        x.fillRect(0, BAND, W, 2)
        x.fillRect(0, H - BAND - 2, W, 2)

        // siku bracket berdenyut
        const ba = 0.45 + 0.3 * Math.sin(TAU * p)
        x.strokeStyle = `rgba(255,255,255,${ba})`
        x.lineWidth = 3
        x.lineCap = 'round'
        const bx = 62, by1 = BAND + 28, by2 = H - BAND - 28, bl = 46
        const corner = (cx, cy, sx, sy) => {
            x.beginPath()
            x.moveTo(cx + sx * bl, cy)
            x.lineTo(cx, cy)
            x.lineTo(cx, cy + sy * bl)
            x.stroke()
        }
        corner(bx, by1, 1, 1)
        corner(W - bx, by1, -1, 1)
        corner(bx, by2, 1, -1)
        corner(W - bx, by2, -1, -1)

        const bob = (i) => Math.sin(TAU * (p + i * 0.12)) * 10

        // echo outline muter pelan di belakang teks
        const ex = Math.cos(TAU * p) * 9
        const ey = Math.sin(TAU * p) * 9
        x.font = bigFont(bigSize)
        x.textBaseline = 'alphabetic'
        x.textAlign = 'left'
        x.lineJoin = 'round'
        x.strokeStyle = 'rgba(255,140,210,0.6)'
        x.lineWidth = 3
        letters.forEach((c, i) => x.strokeText(c, letterX[i] + ex, bigBase + bob(i) + ey))

        // teks utama (layer terpisah biar bisa dikasih kilau)
        t.globalCompositeOperation = 'source-over'
        t.clearRect(0, 0, W, H)
        t.font = bigFont(bigSize)
        t.textBaseline = 'alphabetic'
        t.textAlign = 'left'
        const fg = t.createLinearGradient(0, bigBase - bigSize * 0.75, 0, bigBase)
        fg.addColorStop(0, '#ffffff')
        fg.addColorStop(0.55, '#ffd6ef')
        fg.addColorStop(1, '#ff7ac8')
        t.fillStyle = fg
        letters.forEach((c, i) => t.fillText(c, letterX[i], bigBase + bob(i)))
        t.globalCompositeOperation = 'source-atop'
        const sx = -260 + p * (W + 520)
        const sg = t.createLinearGradient(sx - 130, 0, sx + 130, 0)
        sg.addColorStop(0, 'rgba(255,255,255,0)')
        sg.addColorStop(0.5, 'rgba(255,255,255,0.95)')
        sg.addColorStop(1, 'rgba(255,255,255,0)')
        t.fillStyle = sg
        t.fillRect(0, 0, W, H)
        t.globalCompositeOperation = 'source-over'

        const pulse = 0.5 + 0.5 * Math.sin(TAU * p)
        x.save()
        x.shadowColor = 'rgba(255,60,170,0.95)'
        x.shadowBlur = 22 + 20 * pulse
        x.drawImage(tl, 0, 0)
        x.restore()
        x.drawImage(tl, 0, 0)

        // subtitle
        x.font = midFont(30)
        x.textBaseline = 'alphabetic'
        x.fillStyle = 'rgba(255,255,255,0.95)'
        subChars.forEach((c, i) => x.fillText(c, subLetterX[i], subY))

        // garis di bawah subtitle + kilau menyapu
        const ly = subY + 24
        x.fillStyle = 'rgba(255,255,255,0.28)'
        x.fillRect(subX0, ly, subW, 2)
        const hx = subX0 - 140 + p * (subW + 280)
        const x0 = Math.max(subX0, hx - 70)
        const x1 = Math.min(subX0 + subW, hx + 70)
        if (x1 > x0) {
            const hg = x.createLinearGradient(hx - 70, 0, hx + 70, 0)
            hg.addColorStop(0, 'rgba(255,255,255,0)')
            hg.addColorStop(0.5, 'rgba(255,255,255,1)')
            hg.addColorStop(1, 'rgba(255,255,255,0)')
            x.fillStyle = hg
            x.fillRect(x0, ly - 1, x1 - x0, 4)
        }
    }

    return { paint }
}

let headerFontOk = null
async function ensureHeaderFont(GlobalFonts) {
    if (headerFontOk !== null) return headerFontOk
    headerFontOk = false
    try {
        const url = config.assets?.fonts?.[HEADER_FONT_KEY]
        if (!url) return false
        const dest = path.join(os.tmpdir(), `hsn_${HEADER_FONT_KEY}.ttf`)
        if (!fs.existsSync(dest) || fs.statSync(dest).size < 10000) {
            const nfetch = require('node-fetch')
            const res = await nfetch(url, { timeout: 45000 })
            if (!res.ok) throw new Error('HTTP ' + res.status)
            await fs.promises.writeFile(dest, await res.buffer())
        }
        GlobalFonts.registerFromPath(dest, 'HsnRajdhani')
        headerFontOk = true
    } catch (e) {
        console.error('[owner] font header gagal, pakai font bawaan →', e.message)
    }
    return headerFontOk
}

async function renderHeaderVideo(srcBuf, outFile, botName) {
    const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas')
    const bin = await findFfmpeg()
    const hasFont = await ensureHeaderFont(GlobalFonts)
    const fontOf = (px) => hasFont ? `${px}px HsnRajdhani` : `bold ${px}px sans-serif`

    let bgImg = null
    try { bgImg = await loadImage(srcBuf) } catch { }

    const BOT = String(botName || 'Hoshino Ai').toUpperCase()
    const canvas = createCanvas(HEADER_W, HEADER_H)
    const x = canvas.getContext('2d')
    const scene = createHeaderScene({
        mk: (w, h) => createCanvas(w, h),
        W: HEADER_W,
        H: HEADER_H,
        bgImg,
        bigFont: fontOf,
        midFont: fontOf,
        bigText: 'OWNER',
        subText: `PUSAT KONTAK • ${BOT}`,
        tickerWords: ['OWNER', BOT, 'THE PERFECT IDOL']
    })

    const ff = spawn(bin, [
        '-hide_banner', '-loglevel', 'error', '-nostats', '-y',
        '-f', 'image2pipe', '-framerate', String(HEADER_FPS), '-i', '-',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', outFile
    ], { stdio: ['pipe', 'ignore', 'pipe'] })

    let ffErr = ''
    ff.stderr.on('data', d => { ffErr += d; if (ffErr.length > 4000) ffErr = ffErr.slice(-2000) })
    ff.stdin.on('error', () => { })
    const done = new Promise((resolve, reject) => {
        ff.on('error', reject)
        ff.on('close', c => c === 0 ? resolve() : reject(new Error('ffmpeg exit ' + c + ' ' + ffErr.slice(-300))))
    })
    done.catch(() => { })

    const frames = HEADER_SECONDS * HEADER_FPS
    try {
        for (let i = 0; i < frames; i++) {
            scene.paint(x, i / frames)
            const jpg = await canvas.encode('jpeg', 88)
            if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r))
        }
    } finally {
        try { ff.stdin.end() } catch { }
    }
    await done
}

async function uploadHeaderVideo(buffer, filename = 'owner-header.mp4') {
    const FormData = require('form-data')
    const nfetch = require('node-fetch')
    const uploaders = [
        ['Uguu', async () => {
            const f = new FormData()
            f.append('files[]', buffer, { filename, contentType: 'video/mp4' })
            const r = await nfetch('https://uguu.se/upload.php', { method: 'POST', body: f, headers: f.getHeaders(), timeout: 120000 })
            const d = await r.json()
            if (!d?.files?.[0]?.url) throw new Error('response invalid')
            return d.files[0].url
        }],
        ['Catbox', async () => {
            const f = new FormData()
            f.append('reqtype', 'fileupload')
            f.append('fileToUpload', buffer, { filename, contentType: 'video/mp4' })
            const r = await nfetch('https://catbox.moe/user/api.php', { method: 'POST', body: f, headers: f.getHeaders(), timeout: 120000 })
            const t = (await r.text()).trim()
            if (!t.startsWith('http')) throw new Error(t.slice(0, 80))
            return t
        }]
    ]
    const gagal = []
    for (const [nama, fn] of uploaders) {
        try {
            const u = await fn()
            console.log('[owner] header video upload via', nama, u)
            return u
        } catch (e) { gagal.push(`${nama}: ${e.message}`) }
    }
    throw new Error('Upload gagal → ' + gagal.join(' | '))
}

async function getHeaderVideoUrl(srcUrl, botName) {
    if (headerCache.url && Date.now() - headerCache.at < HEADER_CACHE_TTL) return headerCache.url

    const outFile = path.join(os.tmpdir(), `owner_hdr_${crypto.randomBytes(6).toString('hex')}.mp4`)
    try {
        const nfetch = require('node-fetch')
        const res = await nfetch(srcUrl, { timeout: 60000 })
        if (!res.ok) throw new Error('download HTTP ' + res.status)
        const srcBuf = await res.buffer()

        await renderHeaderVideo(srcBuf, outFile, botName)
        const url = await uploadHeaderVideo(await fs.promises.readFile(outFile))

        headerCache.url = url
        headerCache.at = Date.now()
        return url
    } catch (e) {
        console.error('[owner] header video gagal →', e.message)
        return null
    } finally {
        await fs.promises.unlink(outFile).catch(() => { })
    }
}

async function handler(m, { sock, config: botConfig }) {
    const db        = getDatabase()
    const ownerType = db.setting('ownerType') || 1
    const botName   = botConfig.bot?.name || 'Hoshino Ai'

    function getOwnerName(cleanNumber) {
        const names  = db.setting('ownerNames') || {}
        if (names[cleanNumber]) return names[cleanNumber]
        const userDb = db.getUser(cleanNumber + '@s.whatsapp.net') || db.getUser(cleanNumber)
        return userDb?.name || botConfig.owner?.name || 'Owner'
    }

    const configOwners = [].concat(botConfig.owner?.number || [])
        .map(n => String(n).replace(/[^0-9]/g, ''))
        .filter(n => n.length >= 10)

    const dbOwners = (Array.isArray(db.data.owner) ? db.data.owner : [])
        .map(n => String(n).replace(/[^0-9]/g, ''))
        .filter(n => n.length >= 10 && !configOwners.includes(n))

    const ownerList = [
        ...configOwners.map(num => ({ num, label: '👑 Owner Utama' })),
        ...dbOwners.map((num, i) => ({ num, label: `⭐ Owner ${i + 1}` }))
    ]

    if (ownerList.length === 0) {
        return m.reply(`❌ *Belum ada owner terdaftar~*`)
    }

    // ── TYPE 1 — Teks + contact card ─────────────────────────────────────────
    if (ownerType === 1) {
        let ownerText = `👑 *ᴏᴡɴᴇʀ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ*\n\n`
        ownerText += `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n`
        ownerText += `┃ 🤖 ʙᴏᴛ: *${botName}*\n`
        ownerText += `┃ 👑 ᴏᴡɴᴇʀ ᴜᴛᴀᴍᴀ: *${configOwners.length}*\n`
        ownerText += `┃ ⭐ ᴏᴡɴᴇʀ ʟᴀɪɴɴʏᴀ: *${dbOwners.length}*\n`
        ownerText += `┃ 🟢 sᴛᴀᴛᴜs: *Online*\n`
        ownerText += `╰┈┈⬡\n\n`
        ownerText += `> _Hubungi owner via contact card di bawah~ 🌸_`

        await m.reply(ownerText)

        for (const { num, label } of ownerList) {
            const displayName = getOwnerName(num)
            const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${displayName} (${label})\nTEL;type=CELL;type=VOICE;waid=${num}:+${num}\nEND:VCARD`
            await sock.sendMessage(m.chat, {
                contacts: {
                    displayName,
                    contacts: [{ vcard }]
                }
            }, { quoted: m.raw })
        }

    // ── TYPE 2 — Carousel Cards ───────────────────────────────────────────────
    } else if (ownerType === 2) {
        const cards = []
        const DEFAULT_PP = 'https://cdn.gimita.id/download/pp%20kosong%20wa%20default%20(1)_1769506608569_52b57f5b.jpg'

        for (const { num, label } of ownerList) {
            const jid         = num + '@s.whatsapp.net'
            const displayName = getOwnerName(num)

            let ppUrl = DEFAULT_PP
            try { ppUrl = await sock.profilePictureUrl(jid, 'image') } catch {}

            cards.push({
                image: { url: ppUrl },
                body: `${label}\n${displayName}\n\nRules:\n- Jangan spam\n- Jangan VidCall/Call Sembarangan\n- Jangan jadiin bahan bug/banned`,
                footer: botName,
                buttons: [
                    {
                        name: 'cta_url',
                        buttonParamsJson: JSON.stringify({
                            display_text: '💬 Chat Owner',
                            url: `https://wa.me/${num}`
                        })
                    }
                ]
            })
        }

        await sock.sendMessage(m.chat, {
            text: `Hallo *${m.pushName}*\n\nKamu ingin mengetahui owner dari *${botName}*?\n\nBerikut daftar owner bot kami~`,
            title: 'Owner Info',
            footer: botName,
            cards
        }, { quoted: m.raw })

    // ── TYPE 3 — Contact card ─────────────────────────────────────────────────
    } else if (ownerType === 3) {
        const contacts = []

        for (const { num, label } of ownerList) {
            const displayName = getOwnerName(num)
            const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${displayName} (${label} ${botName})\nTEL;type=CELL;type=VOICE;waid=${num}:+${num}\nEND:VCARD`
            contacts.push({ vcard })
        }

        await sock.sendMessage(m.chat, {
            contacts: {
                displayName: `${botName} Owners`,
                contacts
            }
        }, { quoted: m.raw })

    // ── TYPE 4 — AIRich Post Card ─────────────────────────────────────────────
    } else if (ownerType === 4) {
        const { AIRich } = require('../../src/lib/aiRich')
        const DEFAULT_PP = 'https://cdn.gimita.id/download/pp%20kosong%20wa%20default%20(1)_1769506608569_52b57f5b.jpg'

        const posts = []
        for (const { num, label } of ownerList) {
            const jid         = num + '@s.whatsapp.net'
            const displayName = getOwnerName(num)

            let ppUrl = DEFAULT_PP
            try { ppUrl = await sock.profilePictureUrl(jid, 'image') } catch {}

            posts.push({
                profile_url: ppUrl,
                username: `~ ${displayName}`,
                caption: label,
                subtitle: `${label} • ${botName}`,
                thumbnail: ppUrl,
                footer: `Ketuk untuk chat ${displayName}~ 💖`,
                verified: configOwners.includes(num),
                source: 'NIXEL',
                orientation: 'LANDSCAPE',
                post_type: 'PHOTO',
                like: 0,
                comment: 0,
                share: 0,
                post_url: `https://wa.me/${num}?text=Hai%20${encodeURIComponent(displayName)}~`,
                post_deeplink: `https://wa.me/${num}?text=Hai%20${encodeURIComponent(displayName)}~`
            })
        }

        await new AIRich(sock)
            .addPost(posts)
            .send(m.chat, { quoted: m.raw })

    // ── TYPE 5 — AIRich Entity Sections ──────────────────────────────────────
    } else if (ownerType === 5) {
        const { AIRich } = require('hsnai')
        const rich = new AIRich(sock)

        // Header 16:9 di atas rich content: video loop dari gambar (fallback: addImage)
        if (HEADER_IMAGE_URL) {
            const videoUrl = await getHeaderVideoUrl(HEADER_IMAGE_URL, botName)
            if (videoUrl) {
                rich.addVideo(videoUrl, { width: HEADER_W, height: HEADER_H })
            } else {
                rich.addImage(HEADER_IMAGE_URL, { width: HEADER_W, height: HEADER_H })
            }
        }

        const sections = []

        for (const { num, label } of ownerList) {
            const displayName = getOwnerName(num)
            const isMainOwner = configOwners.includes(num)

            let ppUrl = 'https://cdn.gimita.id/download/pp%20kosong%20wa%20default%20(1)_1769506608569_52b57f5b.jpg'

            try {
                ppUrl = await sock.profilePictureUrl(
                    num + '@s.whatsapp.net',
                    'image'
                )
            } catch {}

            const ownerSection = AIRich.newLayout('Single', {
                __typename: 'GenAICompactEntityPrimitive',
                title: displayName,
                subtitle: label,
                secondary_subtitle: isMainOwner
                    ? `Owner Utama • ${botName}`
                    : `Owner • ${botName}`,
                entity_id: Number(num),
                entity_url: `https://wa.me/${num}`,
                entity_type: 'PERSON',
                action_type: 'MESSAGE',
                is_verified: isMainOwner,
                image: {
                    url: ppUrl
                }
            })

            sections.push(ownerSection)
        }

        const submessage = {
            messageType: 2,
            messageText: `Pusat Kontak Owner ${botName}`
        }

        rich._addContent(sections, submessage)

        await rich.send(m.chat, { quoted: m.raw })
    }
}

module.exports = {
    config: pluginConfig,
    handler
}