/**
✧ Name    : typogaleri
✧ Category: maker
✧ Creator : SeaPRST
✧ Note : Sesuaikan Dengan Bot Kalian Plus Jangan Hapus WM Ini, Hargai Dev plis
**/

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const dns = require('dns')
const { Readable } = require('stream')
const { spawn, execFile } = require('child_process')
const { promisify } = require('util')

/* FIX IPv6: penyebab umum "fetch failed" di VPS/panel */
try { dns.setDefaultResultOrder?.('ipv4first') } catch { }

const runF = promisify(execFile)

const pluginConfig = {
    name: 'typogaleri',
    alias: ['tg'],
    category: 'maker',
    description: 'Bikin video typography galeri 1:1 gaya editorial (reply media)',
    usage: '.typogaleri judul|tempat',
    example: '.typogaleri senja kota|bandung',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 2,
    isEnabled: true
}

/* ════════════════════════════════════════════════════════════
 *  KONFIG
 * ════════════════════════════════════════════════════════════ */

const CFG = {
    dirTmp: './tmp/typogaleri1',
    fontDir: './tmp/typogaleri/fonts',
    duration: 15,
    maxDur: 15,
    minDur: 3,
    fps: 30,
    srcSize: 720,
    dlTimeout: 120000,
    dlRetry: 3,
    sendRetry: 3,
    maxKeep: 15
}

const FONT_LIST = [
    ['Poppins-Regular.ttf', 'Pop', 'ofl/poppins/Poppins-Regular.ttf'],
    ['Poppins-Medium.ttf', 'PopM', 'ofl/poppins/Poppins-Medium.ttf'],
    ['Poppins-SemiBold.ttf', 'PopSB', 'ofl/poppins/Poppins-SemiBold.ttf'],
    ['Poppins-Bold.ttf', 'PopB', 'ofl/poppins/Poppins-Bold.ttf'],
    ['GreatVibes-Regular.ttf', 'Vibes', 'ofl/greatvibes/GreatVibes-Regular.ttf'],
    ['Anton-Regular.ttf', 'Anton', 'ofl/anton/Anton-Regular.ttf'],
    /* fallback huruf Jepang (buat pushname kayak "の") */
    ['NotoSansJP.ttf', 'NotoJP', 'ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf']
]

const DEFAULT_JUDUL = 'Galeri'
const DEFAULT_TEMPAT = 'Indonesia'

const cap = s => String(s).replace(/\b\w/g, c => c.toUpperCase())

/* ════════════════════════════════════════════════════════════
 *  UTIL DASAR
 * ════════════════════════════════════════════════════════════ */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const clamp01 = t => clamp(t, 0, 1)
const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3)
const easeInOut = t => { t = clamp01(t); return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2 }
const easeBack = t => { t = clamp01(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2) }
const win = (t, a, b) => clamp01((t - a) / (b - a))
const TAU = Math.PI * 2
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function fetchBin(url, timeoutMs = 45000) {
    const ac = new AbortController()
    const to = setTimeout(() => ac.abort(), timeoutMs)
    try {
        const res = await fetch(url, { signal: ac.signal, headers: { 'User-Agent': 'Mozilla/5.0', Origin: 'https://web.whatsapp.com' } })
        if (!res.ok) throw new Error('HTTP ' + res.status)
        return Buffer.from(await res.arrayBuffer())
    } finally { clearTimeout(to) }
}

/** bongkar penyebab asli error (undici nyembunyiin di e.cause) */
const errWhy = (e) => {
    if (!e) return 'unknown'
    const cause = e.cause || e.error
    const parts = [e.shortMessage || e.message || String(e)]
    const code = cause?.code || cause?.errno
    if (code) parts.push(`(${code})`)
    const st = e.statusCode || e.status || cause?.statusCode
    if (st) parts.push(`[${st}]`)
    const cm = cause?.message && cause.message !== parts[0] ? cause.message : ''
    if (cm) parts.push('→ ' + cm)
    return parts.join(' ')
}

const withTimeout = (p, ms, label) => Promise.race([
    Promise.resolve(p),
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timeout ${Math.round(ms / 1000)}s`)), ms)),
])

/* ════════════════════════════════════════════════════════════
 *  FFMPEG (sistem dulu, lalu ffmpeg-static)
 * ════════════════════════════════════════════════════════════ */

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
    throw new Error('ffmpeg tidak ditemukan. Install: apt install ffmpeg -y  (atau: npm install ffmpeg-static)')
}

function runFF(args) {
    return new Promise(async (resolve, reject) => {
        let bin
        try { bin = await findFfmpeg() } catch (e) { return reject(e) }
        const proc = spawn(bin, ['-hide_banner', '-loglevel', 'error', '-nostats', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] })
        let stderr = ''
        proc.stderr.on('data', d => { stderr += d.toString(); if (stderr.length > 6000) stderr = stderr.slice(-3000) })
        proc.on('error', reject)
        proc.on('close', code => code === 0
            ? resolve()
            : reject(new Error(`ffmpeg exit ${code}\n${stderr.slice(-1200)}`)))
    })
}

/** info video: durasi + ada audio atau nggak */
async function probeMedia(file) {
    let info = ''
    try {
        const bin = await findFfmpeg()
        info = await new Promise((resolve, reject) => {
            const p = spawn(bin, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] })
            let err = ''
            p.stderr.on('data', d => { err += d.toString() })
            p.on('error', reject)
            p.on('close', () => resolve(err))
        })
    } catch { }
    let dur = CFG.duration
    const mm = info.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/)
    if (mm) {
        const d = (+mm[1]) * 3600 + (+mm[2]) * 60 + parseFloat(mm[3])
        if (isFinite(d) && d > 0) dur = d
    }
    if (dur === CFG.duration) {
        try {
            const probe = (await findFfmpeg()).replace(/ffmpeg[^/]*$/, 'ffprobe')
            const { stdout } = await runF(probe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { maxBuffer: 1 << 20 })
            const d = parseFloat(stdout)
            if (isFinite(d) && d > 0) dur = d
        } catch { }
    }
    const hasAudio = /Stream #\d+:\d+.*Audio:/.test(info)
    return { dur, hasAudio }
}

/** ambil 1 frame pada detik `at` */
async function grabStill(basePath, at, outPath) {
    const run = async (seekFirst) => {
        const args = [
            ...(seekFirst ? ['-ss', at.toFixed(2)] : []), '-i', basePath,
            '-frames:v', '1', '-vf', "scale='min(900,iw)':-2", '-q:v', '3', outPath
        ]
        if (!seekFirst) args.unshift('-ss', at.toFixed(2))
        await runFF(args)
    }
    try {
        await run(true)
        if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 500) throw new Error('still kosong')
    } catch { await run(false) }
    return outPath
}

/* ════════════════════════════════════════════════════════════
 *  BAILEYS AUTO-DETECT (fork apa pun)
 * ════════════════════════════════════════════════════════════ */

let BAILEYS_MOD = null
async function getBaileys() {
    if (BAILEYS_MOD?.downloadContentFromMessage) return BAILEYS_MOD
    const candidates = ['@itsliaaa/baileys', '@whiskeysockets/baileys', '@nazedev/baileys', '@neoxr/baileys', '@adiwajshing/baileys', 'baileys']
    try {
        const pj = JSON.parse(fs.readFileSync('./package.json', 'utf8'))
        for (const name of Object.keys({ ...pj.dependencies, ...pj.devDependencies }))
            if (/baileys/i.test(name) && !candidates.includes(name)) candidates.unshift(name)
    } catch { }
    try {
        for (const d of fs.readdirSync('./node_modules')) {
            if (d.startsWith('@')) {
                try {
                    for (const s of fs.readdirSync(`./node_modules/${d}`)) {
                        const full = `${d}/${s}`
                        if (/baileys/i.test(full) && !candidates.includes(full)) candidates.unshift(full)
                    }
                } catch { }
            } else if (/baileys/i.test(d) && !candidates.includes(d)) candidates.unshift(d)
        }
    } catch { }
    for (const pkg of candidates) {
        try {
            const mod = await import(pkg)
            if (mod?.downloadContentFromMessage) { BAILEYS_MOD = mod; return BAILEYS_MOD }
        } catch { }
    }
    return BAILEYS_MOD || {}
}

/* ════════════════════════════════════════════════════════════
 *  SMART DOWNLOAD — anti "fetch failed"
 * ════════════════════════════════════════════════════════════ */

function pickMediaProto(obj) {
    if (!obj) return null
    const mt = String(obj.mtype || '').toLowerCase()
    const direct = obj.videoMessage || obj.imageMessage || obj.documentMessage
        || obj.message?.videoMessage || obj.message?.imageMessage || obj.message?.documentMessage
    if (direct) return direct
    if (mt === 'videomessage' || mt === 'imagemessage' || mt === 'documentmessage') {
        const msg = obj.msg?.videoMessage || obj.msg?.imageMessage || obj.msg?.documentMessage
            || obj.message?.videoMessage || obj.message?.imageMessage || obj.message?.documentMessage
            || ((obj.url || obj.mediaKey || obj.jpegThumbnail) ? obj : null)
        return msg || null
    }
    return null
}

let _waAgent
async function getWaAgent() {
    if (_waAgent !== undefined) return _waAgent
    try {
        const { Agent } = await import('undici')
        _waAgent = new Agent({ connect: { family: 4, timeout: 30000 }, headersTimeout: CFG.dlTimeout, bodyTimeout: CFG.dlTimeout })
    } catch { _waAgent = null }
    return _waAgent
}

async function smartDownload(node, sock, waType) {
    const errs = []
    // 1) serializer bawaan (m.quoted.download()) + retry
    if (typeof node?.download === 'function') {
        for (let i = 1; i <= CFG.dlRetry; i++) {
            try {
                const buf = await withTimeout(Promise.resolve(node.download()), CFG.dlTimeout, 'unduh media')
                if (buf && buf.length > 0) return buf
                throw new Error('media kosong / URL media tidak tersedia')
            } catch (e) { errs.push(errWhy(e)); if (i < CFG.dlRetry) await sleep(1200 * i) }
        }
    }
    // 2) helper sock
    if (typeof sock?.downloadMediaMessage === 'function') {
        try {
            const buf = await withTimeout(Promise.resolve(sock.downloadMediaMessage(node)), CFG.dlTimeout, 'unduh media (sock)')
            if (buf && buf.length > 0) return buf
        } catch (e) { errs.push(errWhy(e)) }
    }

    const raw = pickMediaProto(node)
    if (!raw) throw new Error('media tidak bisa dibaca dari pesan' + (errs.length ? ' · ' + errs[0] : ''))

    // 3) downloadContentFromMessage (undici agent IPv4 kalau ada)
    const baid = await getBaileys()
    if (typeof baid?.downloadContentFromMessage === 'function') {
        const agent = await getWaAgent()
        for (let i = 1; i <= 2; i++) {
            try {
                let stream = await Promise.resolve().then(() =>
                    agent
                        ? baid.downloadContentFromMessage(raw, waType, { options: { dispatcher: agent } })
                        : baid.downloadContentFromMessage(raw, waType)
                )
                if (stream?.pipe || stream?.getReader) stream = Readable.from(stream)
                if (stream && typeof stream.on === 'function') {
                    const buf = await new Promise((resolve, reject) => {
                        const chunks = []
                        stream.on('data', c => chunks.push(c))
                        stream.on('end', () => resolve(Buffer.concat(chunks)))
                        stream.on('error', reject)
                    })
                    if (buf.length > 0) return buf
                }
                throw new Error('stream kosong')
            } catch (e) { errs.push(errWhy(e)); if (i < 2) await sleep(1200) }
        }
    }

    // 4) unduh URL + dekripsi AES-256-CBC manual
    try {
        const { getMediaKeys, getUrlFromDirectPath } = baid
        const url = raw.url || (raw.directPath && getUrlFromDirectPath ? getUrlFromDirectPath(raw.directPath) : null)
        if (url && raw.mediaKey && typeof getMediaKeys === 'function') {
            for (let i = 1; i <= 2; i++) {
                try {
                    const enc = await fetchBin(url, CFG.dlTimeout)
                    const keys = await getMediaKeys(raw.mediaKey, waType)
                    const d = crypto.createDecipheriv('aes-256-cbc', keys.cipherKey, keys.iv)
                    const buf = Buffer.concat([d.update(enc), d.final()])
                    if (buf.length > 0) return buf
                    throw new Error('hasil dekripsi kosong')
                } catch (e) { errs.push(errWhy(e)); if (i < 2) await sleep(1200) }
            }
        } else if (url) {
            const buf = await fetchBin(url, CFG.dlTimeout)
            if (buf.length > 0) return buf
        }
    } catch (e) { errs.push(errWhy(e)) }

    throw new Error('semua metode unduh gagal → ' + errs.join(' | '))
}

async function sendWithRetry(fn, tries = CFG.sendRetry) {
    let lastErr = null
    for (let i = 1; i <= tries; i++) {
        try { return await fn() } catch (e) { lastErr = e; if (i < tries) await sleep(2000 * i) }
    }
    throw new Error('kirim/upload video gagal → ' + errWhy(lastErr))
}

/* ════════════════════════════════════════════════════════════
 *  CANVAS + FONT (lazy init, unduh otomatis sekali)
 * ════════════════════════════════════════════════════════════ */

let CV = null
let fontsReady = false

async function initCanvas() {
    if (!CV) {
        let mod
        try {
            mod = require('@napi-rs/canvas')
        } catch {
            throw new Error('Package @napi-rs/canvas belum terpasang. Jalankan di folder bot:\nnpm install @napi-rs/canvas')
        }
        CV = { createCanvas: mod.createCanvas, loadImage: mod.loadImage, GlobalFonts: mod.GlobalFonts }
    }
    return CV
}

async function ensureFonts() {
    if (fontsReady || !CV) return
    fs.mkdirSync(CFG.fontDir, { recursive: true })
    for (const [file, alias, repo] of FONT_LIST) {
        const dest = path.join(CFG.fontDir, file)
        if (!fs.existsSync(dest) || fs.statSync(dest).size < 10000) {
            const urls = [
                `https://raw.githubusercontent.com/google/fonts/main/${repo}`,
                `https://cdn.jsdelivr.net/gh/google/fonts@main/${repo}`
            ]
            let ok = false
            for (const u of urls) {
                try {
                    const buf = await fetchBin(u, 45000)
                    if (buf.length > 10000) { fs.writeFileSync(dest, buf); ok = true; break }
                } catch { }
            }
            if (!ok) console.error(`[typogaleri] font ${file} gagal diunduh (dipakai font bawaan)`)
        }
        try { CV.GlobalFonts.registerFromPath(dest, alias) } catch { }
    }
    fontsReady = true
}

/* ════════════════════════════════════════════════════════════
 *  5 GAMBAR DARI INPUT (untuk filmstrip)
 * ════════════════════════════════════════════════════════════ */

async function stillsFromVideo(videoPath, outDir, stamp) {
    const { dur } = await probeMedia(videoPath)
    const at = p => Math.max(0.1, Math.min(Math.max(0.1, dur - 0.25), dur * p / 100))
    const outs = []
    for (let i = 0; i < 5; i++) {
        outs.push(await grabStill(videoPath, at(20 * (i + 1)), path.join(outDir, `st_${stamp}_${i}.jpg`)))
    }
    return { photos: outs }
}

async function stillsFromPhoto(photoPath, outDir, stamp) {
    const { createCanvas, loadImage } = CV
    const img = await loadImage(photoPath)
    const zoom = 1.18
    const focusPts = [[.12, .18], [.88, .18], [.5, .5], [.12, .82], [.88, .82]]
    const outs = []
    for (let i = 0; i < 5; i++) {
        const c = createCanvas(900, 640)
        const x = c.getContext('2d')
        x.fillStyle = '#101010'
        x.fillRect(0, 0, 900, 640)
        const s = Math.max(900 / img.width, 640 / img.height) * zoom
        const dw = img.width * s, dh = img.height * s
        const dx = (900 - dw) * focusPts[i][0]
        const dy = (640 - dh) * focusPts[i][1]
        x.drawImage(img, dx, dy, dw, dh)
        const p = path.join(outDir, `st_${stamp}_${i}.jpg`)
        fs.writeFileSync(p, await c.encode('jpeg', 92))
        outs.push(p)
    }
    return { photos: outs }
}

/* ════════════════════════════════════════════════════════════
 *  MUSIK AMBIENT (fallback bila tidak ada audio asli)
 * ════════════════════════════════════════════════════════════ */

async function getAmbient(duration = CFG.duration) {
    const secs = Math.max(CFG.minDur, Math.round(duration))
    const out = path.join(CFG.dirTmp, `ambient_${secs}.m4a`)
    if (fs.existsSync(out) && fs.statSync(out).size > 10000) return out
    const SR = 44100
    const N = Math.round(secs * SR)
    const chord = [98.0, 146.83, 196.0, 246.94, 392.0]
    const mix = [0.32, 0.26, 0.22, 0.20, 0.10]
    const buf = new Int16Array(N * 2)
    let lpL = 0, lpR = 0
    for (let i = 0; i < N; i++) {
        const t = i / SR
        const env = Math.min(1, t / 1.2) * Math.min(1, Math.max(0, (secs - t) / 2.5))
        let L = 0, R = 0
        chord.forEach((f, k) => {
            const lfo = .55 + .45 * Math.sin(TAU * (.05 + .013 * k) * t + k * 1.7)
            const det = 1 + .0015 * Math.sin(TAU * .07 * t + k)
            const sv = Math.sin(TAU * f * det * t + Math.sin(TAU * .5 * t) * .3)
            const pan = .5 + .35 * Math.sin(k * 2.1)
            L += sv * lfo * mix[k] * (1 - pan)
            R += sv * lfo * mix[k] * pan
        })
        const sub = .10 * Math.sin(TAU * 49 * t) * (.6 + .4 * Math.sin(TAU * .08 * t))
        const sh = (t % 1) < .04 ? (Math.random() * 2 - 1) * .04 * (1 - (t % 1) / .04) : 0
        L = (L * .5 + sub + sh * .7) * env
        R = (R * .5 + sub + sh) * env
        lpL += .18 * (L - lpL); lpR += .18 * (R - lpR)
        buf[2 * i] = Math.max(-32768, Math.min(32767, lpL * 32767 * .8)) | 0
        buf[2 * i + 1] = Math.max(-32768, Math.min(32767, lpR * 32767 * .8)) | 0
    }
    const raw = path.join(CFG.dirTmp, `amb_${secs}.raw`)
    fs.writeFileSync(raw, Buffer.from(buf.buffer))
    await runFF(['-f', 's16le', '-ar', String(SR), '-ac', '2', '-i', raw, '-c:a', 'aac', '-b:a', '128k', out])
    fs.unlinkSync(raw)
    return out
}

/* ════════════════════════════════════════════════════════════
 *  PRIMITIF GAMBAR
 * ════════════════════════════════════════════════════════════ */

const W = 1080, H = 1080
const INK = '#141414'
const PAPER = '#ece5d6'
const CORAL = '#ff4b2b'

/* arch (jendela lengkung) */
const AW = 470, AH = 640
const AX = (W - AW) / 2, AY = 150
const AB = AY + AH

function roundRect(x, px, py, w, h, r) {
    x.beginPath()
    x.moveTo(px + r, py)
    x.arcTo(px + w, py, px + w, py + h, r)
    x.arcTo(px + w, py + h, px, py + h, r)
    x.arcTo(px, py + h, px, py, r)
    x.arcTo(px, py, px + w, py, r)
    x.closePath()
}

function archPath(x, px, py, w, h, close = true) {
    const r = w / 2
    x.beginPath()
    x.moveTo(px, py + h)
    x.lineTo(px, py + r)
    x.arc(px + r, py + r, r, Math.PI, 0)
    x.lineTo(px + w, py + h)
    if (close) x.closePath()
}

function drawCover(x, img, px, py, w, h, focusY = .5, zoom = 1) {
    const s = Math.max(w / img.width, h / img.height) * zoom
    const dw = img.width * s, dh = img.height * s
    x.drawImage(img, px + (w - dw) / 2, py + (h - dh) * focusY, dw, dh)
}

/** teks dengan jarak antar huruf manual (align: center / left) */
function spaced(x, text, px, py, sp = 4, align = 'center') {
    const ws = [...text].map(ch => x.measureText(ch).width)
    const total = ws.reduce((a, b) => a + b + sp, -sp)
    let cx = align === 'center' ? px - total / 2 : px
    const prev = x.textAlign
    x.textAlign = 'left'
    ;[...text].forEach((ch, i) => { x.fillText(ch, cx, py); cx += ws[i] + sp })
    x.textAlign = prev
}

function star(x, cx, cy, rOut, rIn, points = 8) {
    x.beginPath()
    for (let k = 0; k < points * 2; k++) {
        const r = k % 2 ? rIn : rOut
        const a = (k / (points * 2)) * TAU - Math.PI / 2
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r
        k === 0 ? x.moveTo(px, py) : x.lineTo(px, py)
    }
    x.closePath()
}

/* ════════════════════════════════════════════════════════════
 *  RENDERER TYPOGALERI (1:1 • editorial arch + filmstrip)
 * ════════════════════════════════════════════════════════════ */

async function renderTypogaleri({ bgPath, videoPath, photos, outPath, theme, archiveBy, outDur }) {
    const { createCanvas, loadImage } = CV
    const DURATION = Math.max(CFG.minDur, outDur || CFG.duration)
    const fps = CFG.fps
    const frames = Math.round(DURATION * fps)
    const VS = CFG.srcSize

    const ph = await Promise.all(photos.map(p => loadImage(p).catch(() => null)))
    const bgImg = videoPath ? null : await loadImage(bgPath)
    const slot = i => ph[i] || ph[0] || bgImg

    const canvas = createCanvas(W, H)
    const x = canvas.getContext('2d')

    let bgCanvas = null, bgCtx = null
    if (videoPath) {
        bgCanvas = createCanvas(VS, VS)
        bgCtx = bgCanvas.getContext('2d')
    }

    const big = theme.bigWord || 'GALERI'
    const placeArr = (Array.isArray(theme.place) ? theme.place : String(theme.place || 'Indonesia').split(','))
        .map(s => s.trim()).filter(Boolean).slice(0, 2)
    const placeUp = placeArr.join(', ').toUpperCase()
    const placeScript = cap(placeArr.join(', '))
    const year = new Date().getFullYear()

    /* FIX pushname: kalau font Jepang berhasil kepasang, tampilkan apa adanya.
       Kalau gagal, buang karakter non-ASCII supaya nggak muncul kotak. */
    let jpOk = false
    try {
        const GF = CV.GlobalFonts
        jpOk = typeof GF.has === 'function'
            ? !!GF.has('NotoJP')
            : !!GF.families?.some?.(f => f.family === 'NotoJP')
    } catch { }
    const authorTxt = jpOk
        ? archiveBy
        : (String(archiveBy).replace(/[^\x20-\x7E]/g, '').trim() || 'bxb_')

    /* judul raksasa: pas selebar kanvas */
    const maxBigW = W - 80
    const letterSpace = 4
    let bigSize = 330
    const measureBig = size => {
        x.font = `${size}px Anton`
        return [...big].map(ch => x.measureText(ch).width)
    }
    const totalW = ws => ws.reduce((a, b) => a + b + letterSpace, -letterSpace)
    let letterWs = measureBig(bigSize)
    while (totalW(letterWs) > maxBigW && bigSize > 50) {
        bigSize -= 6
        letterWs = measureBig(bigSize)
    }
    const letters = [...big].map((ch, i) => ({ ch, w: letterWs[i] }))
    let lx = (W - totalW(letterWs)) / 2
    for (const l of letters) { l.x = lx; lx += l.w + letterSpace }
    const bigY = 775

    /* FIX judul: kata pendek (<=7 huruf) = efek "nyelip di belakang arch".
       Kata panjang = tampil penuh di depan arch (tanpa clip) + outline kertas. */
    const nLetters = letters.filter(l => l.ch !== ' ').length
    const frontRatio = nLetters <= 7 ? .34 : 1
    const frontY = bigY - bigSize * frontRatio

    /* ticker band atas */
    const tickerText = `${big}  •  ${placeUp}  •  TYPOGRAPHY GALLERY  •  `
    /* teks lingkaran badge */
    const ringText = `TYPOGRAPHY • GALLERY • ${placeUp.slice(0, 10)} • `

    /* grain (3 varian, dipakai bergantian) */
    const grains = [0, 1, 2].map(() => {
        const n = createCanvas(270, 270)
        const nx = n.getContext('2d')
        const id = nx.createImageData(270, 270)
        for (let i = 0; i < id.data.length; i += 4) {
            const v = (90 + Math.random() * 120) | 0
            id.data[i] = id.data[i + 1] = id.data[i + 2] = v
            id.data[i + 3] = 255
        }
        nx.putImageData(id, 0, 0)
        return n
    })

    /* decoder video → frame RGBA VSxVS (crop tengah 1:1) */
    let readFrame = null, lastBG = null, dec = null
    if (videoPath) {
        const bin = await findFfmpeg()
        dec = spawn(bin, ['-hide_banner', '-loglevel', 'error', '-nostats',
            '-t', String(DURATION), '-i', videoPath,
            '-vf', `scale=${VS}:${VS}:force_original_aspect_ratio=increase,crop=${VS}:${VS},fps=${fps}`,
            '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'],
            { stdio: ['ignore', 'pipe', 'ignore'] })
        const FB = VS * VS * 4
        let pool = [], poolLen = 0, ended = false
        dec.stdout.on('data', c => { pool.push(c); poolLen += c.length })
        dec.stdout.once('end', () => { ended = true })
        dec.once('error', () => { ended = true })
        readFrame = async () => {
            while (poolLen < FB) {
                if (ended) return null
                await sleep(2)
            }
            const need = Buffer.allocUnsafe(FB)
            let off = 0
            while (off < FB) {
                const head = pool[0]
                const take = Math.min(head.length, FB - off)
                head.copy(need, off, 0, take)
                off += take; poolLen -= take
                if (take === head.length) pool.shift()
                else pool[0] = head.subarray(take)
            }
            return need
        }
    }

    function drawTitle(t, front) {
        letters.forEach((l, i) => {
            if (l.ch === ' ') return
            const a = easeOut(win(t, .6 + i * .06, 1.3 + i * .06))
            if (a <= 0) return
            x.save()
            /* clip cuma buat efek "nyelip"; mode penuh = tanpa clip */
            if (front && frontRatio < 1) {
                x.beginPath()
                x.rect(0, frontY, W, bigSize * frontRatio + 60)
                x.clip()
            }
            x.globalAlpha = a
            x.font = `${bigSize}px Anton`
            const yy = bigY + (1 - a) * 70
            /* outline warna kertas supaya huruf hitam tetap kebaca di atas foto gelap */
            if (front && frontRatio >= 1) {
                x.lineJoin = 'round'
                x.lineWidth = 8
                x.strokeStyle = PAPER
                x.strokeText(l.ch, l.x, yy)
            }
            x.fillStyle = INK
            x.fillText(l.ch, l.x, yy)
            x.restore()
        })
    }

    function paint(t, fi) {
        /* KERTAS */
        x.fillStyle = PAPER
        x.fillRect(0, 0, W, H)
        const pg = x.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .8)
        pg.addColorStop(0, 'rgba(255,255,255,.28)')
        pg.addColorStop(1, 'rgba(120,90,50,.20)')
        x.fillStyle = pg
        x.fillRect(0, 0, W, H)

        /* PITA TICKER CORAL (atas) */
        {
            const a = easeOut(win(t, 0, .5))
            x.save()
            x.translate(0, -62 * (1 - a))
            x.fillStyle = CORAL
            x.fillRect(0, 0, W, 58)
            x.beginPath(); x.rect(0, 0, W, 58); x.clip()
            x.font = '22px PopB'
            x.fillStyle = INK
            const tw = x.measureText(tickerText).width
            const off = (t * 110) % tw
            for (let px = -off; px < W; px += tw) x.fillText(tickerText, px, 38)
            x.restore()
        }

        /* BARIS META + GARIS */
        {
            const a = easeOut(win(t, .2, .8))
            x.save()
            x.globalAlpha = a
            x.fillStyle = INK
            x.font = '18px PopM'
            spaced(x, `VOL. 01 — ${year}`, 44, 100, 3, 'left')
            x.font = '18px PopM, NotoJP'   // fallback Jepang cuma buat baris ©
            x.textAlign = 'right'
            x.fillText(`© ${authorTxt}`, W - 44, 100)
            x.textAlign = 'left'
            x.fillRect(44, 114, (W - 88) * easeInOut(win(t, .3, 1.1)), 2)
            x.restore()
        }

        /* JUDUL (di belakang arch) */
        drawTitle(t, false)

        /* ARCH + MEDIA */
        {
            const p = easeInOut(win(t, .2, 1.25))
            if (p > 0) {
                x.save()
                x.globalAlpha = p
                x.shadowColor = 'rgba(0,0,0,.38)'
                x.shadowBlur = 38
                x.shadowOffsetY = 20
                x.fillStyle = INK
                archPath(x, AX, AY, AW, AH)
                x.fill()
                x.restore()

                x.save()
                archPath(x, AX, AY, AW, AH)
                x.clip()
                x.beginPath()
                x.rect(AX - 5, AB - AH * p, AW + 10, AH * p + 2)
                x.clip()
                const zoom = 1.04 + .08 * (t / DURATION)
                if (videoPath && bgCanvas) drawCover(x, bgCanvas, AX, AY, AW, AH, .5, zoom)
                else if (bgImg) drawCover(x, bgImg, AX, AY, AW, AH, .45, zoom + .02 * Math.sin(TAU * t / DURATION))
                const g = x.createLinearGradient(0, AY, 0, AB)
                g.addColorStop(0, 'rgba(0,0,0,.12)')
                g.addColorStop(.6, 'rgba(0,0,0,0)')
                g.addColorStop(1, 'rgba(0,0,0,.28)')
                x.fillStyle = g
                x.fillRect(AX, AY, AW, AH)
                x.restore()

                /* garis lengkung luar */
                x.save()
                x.globalAlpha = easeOut(win(t, .9, 1.7))
                x.strokeStyle = INK
                x.lineWidth = 2.5
                archPath(x, AX - 18, AY - 18, AW + 36, AH + 18, false)
                x.stroke()
                x.restore()
            }
        }

        /* JUDUL (bagian depan menimpa arch) */
        drawTitle(t, true)

        /* TEKS VERTIKAL KIRI & KANAN */
        {
            const a = easeOut(win(t, 1.5, 2.2))
            if (a > 0) {
                x.save()
                x.globalAlpha = a
                x.fillStyle = INK
                x.font = '17px PopSB'
                x.save()
                x.translate(50, 330)
                x.rotate(-Math.PI / 2)
                spaced(x, placeUp.slice(0, 24), 0, 0, 6, 'center')
                x.restore()
                x.save()
                x.translate(W - 50, 330)
                x.rotate(Math.PI / 2)
                spaced(x, 'TYPOGRAPHY GALLERY', 0, 0, 6, 'center')
                x.restore()
                x.restore()
            }
        }

        /* BADGE BERPUTAR */
        {
            const al = easeOut(win(t, 1.8, 2.3))
            const bk = easeBack(win(t, 1.8, 2.5))
            if (al > 0) {
                const BX = 852, BY = 236
                x.save()
                x.globalAlpha = al
                x.translate(BX, BY)
                x.scale(.6 + .4 * bk, .6 + .4 * bk)
                x.rotate(t * .7)
                x.shadowColor = 'rgba(0,0,0,.3)'
                x.shadowBlur = 16
                x.shadowOffsetY = 6
                x.fillStyle = CORAL
                x.beginPath(); x.arc(0, 0, 92, 0, TAU); x.fill()
                x.shadowColor = 'transparent'
                x.fillStyle = INK
                x.font = '15px PopSB'
                x.textAlign = 'center'
                const n = ringText.length
                for (let i = 0; i < n; i++) {
                    x.save()
                    x.rotate((i / n) * TAU)
                    x.translate(0, -68)
                    x.fillText(ringText[i], 0, 0)
                    x.restore()
                }
                x.strokeStyle = INK
                x.lineWidth = 1.5
                x.beginPath(); x.arc(0, 0, 46, 0, TAU); x.stroke()
                x.rotate(-t * 1.4)
                star(x, 0, 0, 30, 13, 8)
                x.fill()
                x.restore()
            }
        }

        /* FILMSTRIP BERGERAK */
        {
            const a = easeOut(win(t, 1.2, 1.9))
            if (a > 0) {
                const SY = 842, SH = 150, fw = 170, fh = 108, gap = 16
                const unit = fw + gap
                const total = unit * 5
                const off = (t * 70) % total
                x.save()
                x.translate(0, (1 - a) * 140)
                x.globalAlpha = a
                x.fillStyle = INK
                x.fillRect(0, SY, W, SH)
                x.beginPath(); x.rect(0, SY, W, SH); x.clip()
                /* lubang sprocket */
                x.fillStyle = PAPER
                const hOff = (t * 70) % 30
                for (let hx = -30; hx < W + 30; hx += 30) {
                    roundRect(x, hx - hOff, SY + 6, 14, 9, 2.5); x.fill()
                    roundRect(x, hx - hOff, SY + SH - 15, 14, 9, 2.5); x.fill()
                }
                /* frame foto */
                for (let n = 0; n < 15; n++) {
                    const px = n * unit - off
                    if (px > W || px + fw < 0) continue
                    const im = slot(n % 5)
                    if (!im) continue
                    x.save()
                    roundRect(x, px, SY + 21, fw, fh, 6)
                    x.clip()
                    drawCover(x, im, px, SY + 21, fw, fh, .5, 1.05)
                    x.restore()
                }
                x.restore()
            }
        }

        /* TEKS BAWAH */
        {
            const a = easeOut(win(t, 1.8, 2.5))
            if (a > 0) {
                x.save()
                x.globalAlpha = a
                x.font = '46px Vibes'
                x.fillStyle = CORAL
                x.fillText(placeScript, 48, 1052)
                x.font = 'italic 19px PopM'
                x.fillStyle = INK
                x.textAlign = 'right'
                x.fillText('Aesthetic • Beautiful', W - 48, 1050)
                x.restore()
            }
        }

        /* light sweep */
        {
            const s0 = DURATION * .55, s1 = s0 + 2.4
            const p = (t - s0) / (s1 - s0)
            if (p > 0 && p < 1) {
                const px = -400 + p * (W + 800)
                x.save()
                const lg = x.createLinearGradient(px - 220, 0, px + 220, H)
                lg.addColorStop(0, 'rgba(255,255,255,0)')
                lg.addColorStop(.5, `rgba(255,255,255,${.22 * Math.sin(Math.PI * p)})`)
                lg.addColorStop(1, 'rgba(255,255,255,0)')
                x.globalCompositeOperation = 'soft-light'
                x.fillStyle = lg
                x.fillRect(0, 0, W, H)
                x.restore()
            }
        }

        /* grain kertas */
        x.save()
        x.globalAlpha = .07
        x.globalCompositeOperation = 'multiply'
        x.drawImage(grains[fi % 3], 0, 0, W, H)
        x.restore()
    }

    /* encode: frame canvas → H264 yuv420p */
    const bin = await findFfmpeg()
    const ff = spawn(bin, ['-hide_banner', '-loglevel', 'error', '-nostats', '-y',
        '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
        '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level:v', '4.0',
        '-movflags', '+faststart', outPath],
        { stdio: ['pipe', 'ignore', 'pipe'] })
    let ffErr = ''
    ff.stderr.on('data', d => { ffErr += d; if (ffErr.length > 8000) ffErr = ffErr.slice(-4000) })
    const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c + ' ' + ffErr.slice(-1200)))))

    try {
        for (let i = 0; i < frames; i++) {
            if (readFrame) {
                const f = await readFrame()
                if (f) {
                    lastBG = f
                    const id = bgCtx.createImageData(VS, VS)
                    id.data.set(f)
                    bgCtx.putImageData(id, 0, 0)
                } else if (lastBG) {
                    const id = bgCtx.createImageData(VS, VS)
                    id.data.set(lastBG)
                    bgCtx.putImageData(id, 0, 0)
                } else break
            }
            paint(i / fps, i)
            const buf = await canvas.encode('jpeg', 92)
            if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r))
        }
    } finally {
        ff.stdin.end()
        if (dec) { try { dec.kill('SIGKILL') } catch { } }
    }
    await done
}

/* ════════════════════════════════════════════════════════════
 *  MUX AUDIO + THUMBNAIL
 * ════════════════════════════════════════════════════════════ */

async function muxAudio(videoPath, audioSrc, outPath) {
    await runFF(['-i', videoPath, '-i', audioSrc,
        '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
        '-shortest', '-movflags', '+faststart', outPath])
}

async function squareThumb(videoPath, outPath, size = 320) {
    const vf = `scale=${size}:${size}`
    try {
        await runFF(['-ss', '00:00:03', '-i', videoPath, '-frames:v', '1', '-vf', vf, '-q:v', '4', outPath])
    } catch {
        await runFF(['-i', videoPath, '-frames:v', '1', '-vf', vf, '-q:v', '4', outPath])
    }
    return outPath
}

/* ════════════════════════════════════════════════════════════
 *  HANDLER
 * ════════════════════════════════════════════════════════════ */

async function handler(m, { sock }) {
    const jid = m.chat
    const react = e => (typeof m.react === 'function' ? Promise.resolve(m.react(e)).catch(() => { }) : Promise.resolve())
    const tmpId = crypto.randomBytes(4).toString('hex')
    const cleanup = []
    let stage = 'mulai'

    try {
        const q = m.quoted ? m.quoted : m
        const mime = q.mimetype || q.msg?.mimetype
            || q.videoMessage?.mimetype || q.imageMessage?.mimetype || q.documentMessage?.mimetype
            || q.msg?.videoMessage?.mimetype || q.msg?.imageMessage?.mimetype || q.msg?.documentMessage?.mimetype
            || ''

        /* fallback deteksi via type serializer bila mimetype tidak terekspos */
        const qType = String(q.type || q.mtype || '')
        let mimeFinal = mime
        if (!mimeFinal) {
            if (m.isVideo || qType === 'videoMessage') mimeFinal = 'video/mp4'
            else if (m.isImage || qType === 'imageMessage') mimeFinal = 'image/jpeg'
        }

        if (!/video\/|image\//.test(mimeFinal) || /webp/.test(mimeFinal)) {
            return m.reply(
                `╭─❖ 🎞️ ᴛʏᴘᴏɢᴀʟᴇʀɪ ❖─\n` +
                `┃ ⭐ Ai butuh video / foto dulu dong~ ✨\n` +
                `┃\n` +
                `┃ 🌸 Reply media lalu ketik:\n` +
                `┃ ${m.prefix}typogaleri judul|tempat\n` +
                `┃\n` +
                `┃ 💫 ᴄᴏɴᴛᴏʜ:\n` +
                `┃ ${m.prefix}typogaleri senja kota|bandung\n` +
                `┃ ${m.prefix}typogaleri nelayan pantai|pantai kuta, bali\n` +
                `╰─────────❖`
            )
        }

        /* argumen: "judul|tempat" murni dari user */
        const rawText = String(m.text || '').trim()
        const parts = rawText.split('|').map(s => s.trim()).filter(Boolean)
        const judul = (parts[0] || DEFAULT_JUDUL).slice(0, 16)
        const tempatParts = (parts[1] || DEFAULT_TEMPAT).split(',').map(s => s.trim()).filter(Boolean).slice(0, 2)
        const theme = {
            bigWord: judul.toUpperCase(),
            place: tempatParts
        }

        const archiveBy = (m.pushName || 'bxb_').split(' ')[0].toLowerCase() || 'bxb_'

        await react('🕕')
        fs.mkdirSync(CFG.dirTmp, { recursive: true })

        const isVideo = /video\//.test(mimeFinal)
        const waType = isVideo ? 'video' : 'image'

        /* 1) unduh media */
        stage = 'unduh media'
        const fontsP = initCanvas().then(() => ensureFonts())
        const buf = await smartDownload(q, sock, waType)
        if (!buf || !buf.length) throw new Error('media kosong / tidak terbaca')
        await fontsP

        const inPath = path.join(CFG.dirTmp, `in_${tmpId}.${isVideo ? 'mp4' : 'jpg'}`)
        fs.writeFileSync(inPath, buf)
        cleanup.push(inPath)

        /* 2) info media + 5 gambar filmstrip */
        stage = 'ambil momen'
        let photos, outDur = CFG.duration, hasAudio = false
        if (isVideo) {
            ;({ photos } = await stillsFromVideo(inPath, CFG.dirTmp, tmpId))
            const info = await probeMedia(inPath)
            outDur = clamp(info.dur, CFG.minDur, CFG.maxDur)
            hasAudio = info.hasAudio
        } else {
            ;({ photos } = await stillsFromPhoto(inPath, CFG.dirTmp, tmpId))
        }
        cleanup.push(...photos)

        /* 3) render */
        stage = 'render'
        const t0 = Date.now()
        const silent = path.join(CFG.dirTmp, `s_${tmpId}.mp4`)
        cleanup.push(silent)
        await renderTypogaleri({
            bgPath: isVideo ? null : inPath,
            videoPath: isVideo ? inPath : null,
            photos,
            outPath: silent,
            theme,
            archiveBy,
            outDur
        })

        /* audio: asli dari video user, fallback ambient */
        const outPath = path.join(CFG.dirTmp, `tg1_${tmpId}.mp4`)
        cleanup.push(outPath)
        if (isVideo && hasAudio) {
            await muxAudio(silent, inPath, outPath)
        } else {
            const ambient = await getAmbient(outDur)
            await muxAudio(silent, ambient, outPath)
        }
        if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 10000)
            throw new Error('output render kosong')

        const thumbFile = path.join(CFG.dirTmp, `thumb_${tmpId}.jpg`)
        cleanup.push(thumbFile)
        let thumbBuf = null
        try { await squareThumb(outPath, thumbFile); thumbBuf = fs.readFileSync(thumbFile) } catch { }

        /* 4) kirim video */
        stage = 'kirim'
        const audioNote = isVideo && hasAudio ? '🔊 audio asli videomu' : '🎵 musik ambient'
        const caption =
            `╭─❖ 🎞️ ᴛʏᴘᴏɢᴀʟᴇʀɪ ❖─\n` +
            `┃ ⭐ Judul : ${cap(judul)}\n` +
            `┃ 📍 Tempat : ${cap(tempatParts.join(', '))}\n` +
            `┃ 🖼️ Rasio : 1:1 • ${Math.round(outDur)} dtk\n` +
            `┃ ${audioNote}\n` +
            `┃ ⏱️ Rakit : ${((Date.now() - t0) / 1000).toFixed(1)}s\n` +
            `╰─────────❖\n` +
            `> Udah jadi nih~ semoga suka ya 💖✨\n\n` +
            `© ${archiveBy}`

        const outBuf = fs.readFileSync(outPath)
        await sendWithRetry(() => sock.sendMessage(jid, {
            video: outBuf,
            caption,
            ...(thumbBuf ? { jpegThumbnail: thumbBuf } : {})
        }, { quoted: m }))

        await react('✅')

        /* bersih-bersih video lama */
        try {
            const files = fs.readdirSync(CFG.dirTmp).filter(f => /^tg1_.*\.mp4$/.test(f)).sort()
            while (files.length > CFG.maxKeep) fs.unlinkSync(path.join(CFG.dirTmp, files.shift()))
        } catch { }

    } catch (e) {
        console.error('[typogaleri] Error:', e)
        await react('❌')
        const why = errWhy(e)
        const hint = /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|ETIMEDOUT|EHOSTUNREACH|timeout|certificate|tls/i.test(why)
            ? `\n┃\n┃ 💡 Koneksi server ke CDN WhatsApp kayaknya lagi bermasalah (biasanya IPv6/DNS). Coba lagi atau set DNS 8.8.8.8 di server.`
            : ''
        return m.reply(
            `╭─❖ ❌ ᴀᴅᴜʜ, ɢᴀɢᴀʟ ❖─\n` +
            `┃ 🎀 Tahap : ${stage}\n` +
            `┃ ${why.slice(0, 300)}${hint}\n` +
            `╰─────────❖\n` +
            `> Coba lagi ya, Ai janji next take bakal lebih bagus~ 🌸`
        )
    } finally {
        for (const f of cleanup) await fs.promises.unlink(f).catch(() => { })
    }
}

module.exports = {
    config: pluginConfig,
    handler
}