/*
 ════════════════════════════════════════════════════════════
  CATATAN PENTING: HOST UPLOAD VIDEO (jangan salah curiga)
 ════════════════════════════════════════════════════════════
  Tes 2026-10-04 (AIRich.addVideo(url) di WhatsApp):
    • Uguu   → video BISA diputar
    • Catbox → video MUTER TERUS / tidak bisa diputar

  Urutan di uploadVideo() sengaja: Uguu dulu, Catbox hanya cadangan.

  Kalau suatu hari video mendadak muter lagi:
    1. Cek log "[hoshinoai] upload via ...".
    2. Kalau yang keluar "Catbox", artinya Uguu gagal/down lalu
       jatuh ke cadangan. Penyebab video muter = LINK CATBOX,
       BUKAN kode render, AIRich, addWidget, addSuggest, setFooter,
       maupun quoted (semuanya sudah dites aman dengan Uguu).
    3. Solusi: tunggu Uguu normal, atau tambah host cadangan lain
       yang sudah dites bisa diputar. Jangan ubah struktur
       render/typography untuk masalah ini.

  Catatan lain:
    • Link Uguu bersifat sementara (kedaluwarsa dalam hitungan jam).
    • Cache render + link: CACHE_TTL = 30 menit.
 ════════════════════════════════════════════════════════════
*/

const fs = require('fs')
const path = require('path')
const dns = require('dns')
const crypto = require('crypto')
const { spawn } = require('child_process')
const FormData = require('form-data')
const nfetch = require('node-fetch')
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas')
const { AIRich } = require('hsnai')
const config = require('../../config')

/* FIX IPv6: penyebab umum "fetch failed" di VPS/panel */
try { dns.setDefaultResultOrder?.('ipv4first') } catch { }

const pluginConfig = {
    name: 'manggilhoshinoai',
    alias: ['bot', 'hoshino', 'hoshinoai', 'idol', 'halo', 'hi'],
    category: 'info',
    description: 'Sapaan visual interaktif dari idol legendaris Hoshino Ai 💖',
    usage: '.ai',
    example: '.ai',
    isOwner: false,
    cooldown: 5,
    isEnabled: true
}

/* ════════════════════════════════════════════════════════════
 *  KONFIG
 * ════════════════════════════════════════════════════════════ */

const DIR_TMP = './tmp/hoshinoai'
const DIR_FONT = './tmp/hoshinoai/fonts'
const VIDEO_KEY = 'hsnai'          // config.assets.video.hsnai
const W = 960, H = 540, FPS = 24
const OUT_DUR = 15                 // durasi hasil (detik), video sumber di-loop kalau lebih pendek
const PHOTO_COUNT = 5
const PHOTO_T0 = [2.6, 4.4, 6.2, 8.0, 9.8]   // detik foto 1..5 muncul
const PAGE2_T = 8.2                           // quote ganti halaman
const FINALE_T = 12.4                         // mulai penutup typography
const CLOSING = 'Jangan pernah alihkan pandanganmu dariku ya... Karena bintang yang paling terang hanya ada di sini!'
const PHOTO_POS = [
    { x: 590, y: 205, rot: -.09 },
    { x: 730, y: 182, rot: .06 },
    { x: 850, y: 215, rot: -.04 },
    { x: 665, y: 275, rot: .08 },
    { x: 800, y: 282, rot: -.07 }
]
const CACHE_TTL = 30 * 60 * 1000   // hasil render disimpan 30 menit per variasi quote

const QUOTES = [
    'Eh...? Kamu manggil aku lagi ya? Hehe... aku seneng banget loh~ Soalnya... cuma kamu yang selalu lihat aku bersinar secerah ini...',
    'Sebagai idol... aku harus selalu terlihat sempurna, kan? Jadi... hari ini juga aku bakal kasih senyuman terbaikku khusus buat kamu aja ya~',
    'Kalau aku bilang aku mencintaimu... kamu bakal percaya, kan? Hehe... sebagai idol, kebohongan adalah bentuk cintaku!'
]

const FONT_LIST = [
    ['Poppins-Medium.ttf', 'HsPopM', 'ofl/poppins/Poppins-Medium.ttf'],
    ['Poppins-Bold.ttf', 'HsPopB', 'ofl/poppins/Poppins-Bold.ttf'],
    ['GreatVibes-Regular.ttf', 'HsVibes', 'ofl/greatvibes/GreatVibes-Regular.ttf'],
    ['Anton-Regular.ttf', 'HsAnton', 'ofl/anton/Anton-Regular.ttf']
]

const F = {
    anton: s => `${s}px HsAnton, Impact, sans-serif`,
    popM: s => `${s}px HsPopM, Arial, sans-serif`,
    popB: s => `${s}px HsPopB, Arial, sans-serif`,
    vibes: s => `${s}px HsVibes, cursive`
}

/* ════════════════════════════════════════════════════════════
 *  UTIL
 * ════════════════════════════════════════════════════════════ */

const TAU = Math.PI * 2
const sleep = ms => new Promise(r => setTimeout(r, ms))
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const clamp01 = t => clamp(t, 0, 1)
const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3)
const easeBack = t => { t = clamp01(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2) }
const win = (t, a, b) => clamp01((t - a) / (b - a))

const errWhy = (e) => {
    if (!e) return 'unknown'
    const cause = e.cause || e.error
    const parts = [e.shortMessage || e.message || String(e)]
    const code = cause?.code || cause?.errno
    if (code) parts.push(`(${code})`)
    if (cause?.message && cause.message !== parts[0]) parts.push('→ ' + cause.message)
    return parts.join(' ')
}

async function fetchBin(url, timeoutMs = 60000) {
    const ac = new AbortController()
    const to = setTimeout(() => ac.abort(), timeoutMs)
    try {
        const res = await fetch(url, { signal: ac.signal, headers: { 'User-Agent': 'HoshinoAiBot/1.0' } })
        if (!res.ok) throw new Error('HTTP ' + res.status)
        return Buffer.from(await res.arrayBuffer())
    } finally { clearTimeout(to) }
}

/* ════════════════════════════════════════════════════════════
 *  FFMPEG
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
    throw new Error('ffmpeg tidak ditemukan (apt install ffmpeg -y atau npm install ffmpeg-static)')
}

async function probeDuration(file) {
    try {
        const bin = await findFfmpeg()
        const info = await new Promise((resolve, reject) => {
            const p = spawn(bin, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] })
            let err = ''
            p.stderr.on('data', d => { err += d.toString() })
            p.on('error', reject)
            p.on('close', () => resolve(err))
        })
        const mm = info.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/)
        if (mm) {
            const d = (+mm[1]) * 3600 + (+mm[2]) * 60 + parseFloat(mm[3])
            if (isFinite(d) && d > 0) return d
        }
    } catch { }
    return 6
}

const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

async function grabStills(src, srcDur, outDir, id) {
    const bin = await findFfmpeg()
    const outs = []
    for (let i = 0; i < PHOTO_COUNT; i++) {
        const at = clamp(srcDur * (0.1 + i * 0.2), 0.1, Math.max(0.1, srcDur - 0.2))
        const file = path.join(outDir, `st_${id}_${i}.jpg`)
        try {
            await new Promise((resolve, reject) => {
                const p = spawn(bin, ['-hide_banner', '-loglevel', 'error', '-y',
                    '-ss', at.toFixed(2), '-i', src, '-frames:v', '1',
                    '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},scale=480:-2`,
                    '-q:v', '3', file], { stdio: 'ignore' })
                p.on('error', reject)
                p.on('close', c => c === 0 ? resolve() : reject(new Error('still exit ' + c)))
            })
            if (fs.statSync(file).size < 500) throw new Error('still kosong')
            outs.push({ file, at })
        } catch {
            if (outs.length) outs.push(outs[outs.length - 1])
        }
    }
    if (!outs.length) throw new Error('gagal mengambil foto dari video config')
    while (outs.length < PHOTO_COUNT) outs.push(outs[outs.length - 1])
    return outs
}

/* ════════════════════════════════════════════════════════════
 *  FONT (unduh sekali, fallback ke font bawaan kalau gagal)
 * ════════════════════════════════════════════════════════════ */

let fontsP = null
function ensureFonts() {
    if (fontsP) return fontsP
    fontsP = (async () => {
        try { fs.mkdirSync(DIR_FONT, { recursive: true }) } catch { }
        await Promise.all(FONT_LIST.map(async ([file, alias, repo]) => {
            const dest = path.join(DIR_FONT, file)
            if (!fs.existsSync(dest) || fs.statSync(dest).size < 10000) {
                for (const u of [
                    `https://raw.githubusercontent.com/google/fonts/main/${repo}`,
                    `https://cdn.jsdelivr.net/gh/google/fonts@main/${repo}`
                ]) {
                    try {
                        const buf = await fetchBin(u, 45000)
                        if (buf.length > 10000) { fs.writeFileSync(dest, buf); break }
                    } catch { }
                }
            }
            try { if (fs.existsSync(dest)) GlobalFonts.registerFromPath(dest, alias) } catch { }
        }))
    })()
    return fontsP
}

/* ════════════════════════════════════════════════════════════
 *  PRIMITIF GAMBAR
 * ════════════════════════════════════════════════════════════ */

function rr(x, px, py, w, h, r) {
    x.beginPath()
    x.moveTo(px + r, py)
    x.arcTo(px + w, py, px + w, py + h, r)
    x.arcTo(px + w, py + h, px, py + h, r)
    x.arcTo(px, py + h, px, py, r)
    x.arcTo(px, py, px + w, py, r)
    x.closePath()
}

function sparkle(x, cx, cy, r) {
    x.beginPath()
    x.moveTo(cx, cy - r)
    x.quadraticCurveTo(cx, cy, cx + r, cy)
    x.quadraticCurveTo(cx, cy, cx, cy + r)
    x.quadraticCurveTo(cx, cy, cx - r, cy)
    x.quadraticCurveTo(cx, cy, cx, cy - r)
    x.closePath()
    x.fill()
}

function heart(x, cx, cy, s) {
    x.beginPath()
    x.moveTo(cx, cy + s * .9)
    x.bezierCurveTo(cx - s * 1.3, cy, cx - s * .7, cy - s * .9, cx, cy - s * .35)
    x.bezierCurveTo(cx + s * .7, cy - s * .9, cx + s * 1.3, cy, cx, cy + s * .9)
    x.closePath()
    x.fill()
}

function spaced(x, text, px, py, sp) {
    let cx = px
    for (const ch of text) {
        x.fillText(ch, cx, py)
        cx += x.measureText(ch).width + sp
    }
    return cx
}

function wrapText(x, text, maxW) {
    const words = text.split(' ')
    const lines = []
    let cur = ''
    for (const w of words) {
        const test = cur ? cur + ' ' + w : w
        if (x.measureText(test).width > maxW && cur) { lines.push(cur); cur = w } else cur = test
    }
    if (cur) lines.push(cur)
    return lines
}

/* ════════════════════════════════════════════════════════════
 *  SCENE "IDOL STAGE" (overlay di atas video config)
 * ════════════════════════════════════════════════════════════ */

function createScene(x, quote, photos) {
    let seed = 20240417
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
    const parts = Array.from({ length: 30 }, (_, i) => ({
        x: rnd() * W, y: rnd() * (H + 60), sp: 18 + rnd() * 34,
        r: 2.5 + rnd() * 5, ph: rnd() * TAU, heart: i % 6 === 0, pink: i % 3 === 0
    }))
    const burst = Array.from({ length: 10 }, (_, i) => ({ a: (i / 10) * TAU + rnd() * .4, d: 50 + rnd() * 50, r: 3 + rnd() * 4 }))

    /* judul "HOSHINO" */
    const big = 'HOSHINO'
    const bigSize = 98, bigGap = 7
    x.font = F.anton(bigSize)
    const lw = [...big].map(c => x.measureText(c).width)
    const letters = []
    let lx = 56
    ;[...big].forEach((ch, i) => { letters.push({ ch, x: lx }); lx += lw[i] + bigGap })

    x.font = F.vibes(132)
    const aiW = x.measureText('Ai').width

    /* kartu quote: 2 halaman */
    const CARD = { x: 40, y: 358, w: W - 80, h: 144 }
    x.font = F.popM(20)
    const maxQW = CARD.w - 30 - 118
    const pages = [quote, CLOSING].map(tx => {
        const lines = wrapText(x, tx, maxQW).slice(0, 4)
        return { lines, total: lines.reduce((a, l) => a + l.length, 0) }
    })

    /* ticker */
    const tickTxt = 'HOSHINO AI  •  THE PERFECT IDOL  •  LIVE NOW  •  '
    x.font = F.popB(14)
    const tickW = x.measureText(tickTxt).width

    /* penutup typography */
    const finWord = 'THE PERFECT IDOL'
    const finGap = 8
    let finSize = 96
    x.font = F.anton(finSize)
    const measureFin = () => [...finWord].map(c => x.measureText(c).width)
    const totalFin = ws => ws.reduce((a, b) => a + b + finGap, -finGap)
    let fw = measureFin()
    while (totalFin(fw) > W - 120 && finSize > 40) { finSize -= 4; x.font = F.anton(finSize); fw = measureFin() }
    const fin = []
    let fx = (W - totalFin(fw)) / 2
    ;[...finWord].forEach((ch, i) => { fin.push({ ch, x: fx }); fx += fw[i] + finGap })
    x.font = F.vibes(84)
    const finAiW = x.measureText('Hoshino Ai').width

    function polaroidCard(img, label, cx, cy, w, h, rot, sc, glow) {
        x.save()
        x.translate(cx, cy)
        x.rotate(rot)
        x.scale(sc, sc)
        x.shadowColor = glow ? 'rgba(244,114,182,.95)' : 'rgba(0,0,0,.45)'
        x.shadowBlur = glow ? 28 : 16
        x.shadowOffsetY = 6
        x.fillStyle = '#fff7fb'
        rr(x, -w / 2, -h / 2, w, h, 8)
        x.fill()
        x.shadowBlur = 0
        x.shadowOffsetY = 0
        const pad = 8, iw = w - pad * 2, ih = h * .70
        x.save()
        rr(x, -w / 2 + pad, -h / 2 + pad, iw, ih, 4)
        x.clip()
        const s = Math.max(iw / img.width, ih / img.height)
        x.drawImage(img, -w / 2 + pad + (iw - img.width * s) / 2, -h / 2 + pad + (ih - img.height * s) / 2, img.width * s, img.height * s)
        x.restore()
        x.fillStyle = '#be185d'
        x.font = F.popB(12)
        x.fillText(label, -w / 2 + pad + 2, h / 2 - 12)
        x.restore()
    }

    return function paint(t, DUR) {
        /* tint pink-ungu */
        let g = x.createLinearGradient(0, 0, W, H)
        g.addColorStop(0, 'rgba(255,105,180,.26)')
        g.addColorStop(.55, 'rgba(236,72,153,.10)')
        g.addColorStop(1, 'rgba(124,58,237,.38)')
        x.fillStyle = g
        x.fillRect(0, 0, W, H)

        g = x.createLinearGradient(0, H * .4, 0, H)
        g.addColorStop(0, 'rgba(20,0,30,0)')
        g.addColorStop(1, 'rgba(20,0,30,.62)')
        x.fillStyle = g
        x.fillRect(0, H * .4, W, H * .6)

        /* sorot lampu panggung */
        for (const [ox, base, ph] of [[110, .32, 0], [W - 110, -.32, 1.7]]) {
            const a = base + Math.sin(t * .9 + ph) * .22
            const len = 640, sp = .12
            x.save()
            x.translate(ox, -10)
            x.rotate(a)
            const bg = x.createLinearGradient(0, 0, 0, len)
            bg.addColorStop(0, 'rgba(255,255,255,.30)')
            bg.addColorStop(1, 'rgba(255,182,220,0)')
            x.fillStyle = bg
            x.beginPath()
            x.moveTo(0, 0)
            x.lineTo(-len * sp, len)
            x.lineTo(len * sp, len)
            x.closePath()
            x.fill()
            x.restore()
        }

        /* bintang & hati jatuh */
        for (const p of parts) {
            const py = ((p.y + t * p.sp) % (H + 60)) - 30
            const px = p.x + Math.sin(t * .8 + p.ph) * 18
            const al = .35 + .65 * Math.abs(Math.sin(t * 2 + p.ph))
            x.save()
            x.globalAlpha = al
            x.fillStyle = p.pink ? '#f9a8d4' : '#ffffff'
            x.shadowColor = '#f472b6'
            x.shadowBlur = 8
            if (p.heart) heart(x, px, py, p.r * .9)
            else sparkle(x, px, py, p.r * 1.6)
            x.restore()
        }

        /* bracket sudut */
        {
            const al = .55 + .25 * Math.sin(t * 3)
            const o = 22, l = 28
            x.save()
            x.globalAlpha = al
            x.strokeStyle = '#fff'
            x.lineWidth = 3
            x.shadowColor = '#f472b6'
            x.shadowBlur = 8
            for (const [cx, cy, dx, dy] of [[o, o, 1, 1], [W - o, o, -1, 1], [o, H - o - 34, 1, -1], [W - o, H - o - 34, -1, -1]]) {
                x.beginPath()
                x.moveTo(cx, cy + dy * l); x.lineTo(cx, cy); x.lineTo(cx + dx * l, cy)
                x.stroke()
            }
            x.restore()
        }

        /* progress bar + penanda foto + timer */
        {
            const a = easeOut(win(t, .1, .6))
            x.save()
            x.globalAlpha = a
            x.fillStyle = 'rgba(255,255,255,.28)'
            rr(x, 56, 16, W - 112, 5, 2.5)
            x.fill()
            const pw = (W - 112) * clamp01(t / DUR)
            if (pw > 6) {
                const pg = x.createLinearGradient(56, 0, W - 56, 0)
                pg.addColorStop(0, '#f472b6')
                pg.addColorStop(1, '#c084fc')
                x.fillStyle = pg
                rr(x, 56, 16, pw, 5, 2.5)
                x.fill()
            }
            PHOTO_T0.forEach(pt => {
                const on = t >= pt
                x.fillStyle = on ? '#fff' : 'rgba(255,255,255,.5)'
                x.shadowColor = '#f472b6'
                x.shadowBlur = on ? 10 : 0
                x.beginPath()
                x.arc(56 + (W - 112) * (pt / DUR), 18.5, on ? 5 : 3.5, 0, TAU)
                x.fill()
            })
            x.shadowBlur = 0
            x.font = F.popB(12)
            x.fillStyle = 'rgba(255,255,255,.9)'
            x.textAlign = 'right'
            x.fillText(`${fmt(Math.min(t, DUR))} / ${fmt(DUR)}`, W - 56, 40)
            x.restore()
        }

        /* pill LIVE */
        {
            const a = easeOut(win(t, .15, .7))
            if (a > 0) {
                x.save()
                x.globalAlpha = a
                x.translate(-60 * (1 - a), 0)
                x.fillStyle = '#e11d48'
                x.shadowColor = 'rgba(225,29,72,.8)'
                x.shadowBlur = 14
                rr(x, 56, 48, 100, 32, 16)
                x.fill()
                x.shadowBlur = 0
                x.fillStyle = '#fff'
                x.globalAlpha = a * (.55 + .45 * Math.abs(Math.sin(t * 4)))
                x.beginPath(); x.arc(76, 64, 5, 0, TAU); x.fill()
                x.globalAlpha = a
                x.font = F.popB(16)
                x.fillText('LIVE', 90, 70)
                x.restore()
            }
        }

        /* rating bintang kanan atas */
        {
            x.save()
            x.shadowColor = '#fbbf24'
            x.shadowBlur = 10
            for (let i = 0; i < 5; i++) {
                const a = easeOut(win(t, .9 + i * .12, 1.3 + i * .12))
                if (a <= 0) continue
                x.globalAlpha = a
                x.fillStyle = '#fde68a'
                sparkle(x, W - 76 - (4 - i) * 32, 62, 13 * a)
            }
            const ta = easeOut(win(t, 1.5, 2.0))
            x.globalAlpha = ta
            x.shadowBlur = 0
            x.fillStyle = 'rgba(255,255,255,.9)'
            x.font = F.popB(13)
            x.textAlign = 'right'
            x.fillText('IDOL MODE', W - 56, 98)
            x.restore()
        }

        /* tagline */
        {
            const a = easeOut(win(t, .5, 1.1))
            x.save()
            x.globalAlpha = a
            x.fillStyle = '#fff'
            x.font = F.popB(15)
            x.shadowColor = 'rgba(244,114,182,.9)'
            x.shadowBlur = 10
            spaced(x, 'THE PERFECT IDOL', 58 - (1 - a) * 30, 128, 6)
            x.restore()
        }

        /* HOSHINO (huruf jatuh memantul) */
        letters.forEach((l, i) => {
            const a = easeOut(win(t, .7 + i * .06, 1.2 + i * .06))
            if (a <= 0) return
            const back = easeBack(win(t, .7 + i * .06, 1.4 + i * .06))
            x.save()
            x.globalAlpha = a
            x.font = F.anton(bigSize)
            const gg = x.createLinearGradient(0, 150, 0, 225)
            gg.addColorStop(0, '#ffffff')
            gg.addColorStop(1, '#fbcfe8')
            x.fillStyle = gg
            x.shadowColor = 'rgba(244,114,182,.95)'
            x.shadowBlur = 24
            x.fillText(l.ch, l.x, 224 - (1 - back) * 70)
            x.restore()
        })

        /* "Ai" script + kilau */
        {
            const a = easeOut(win(t, 1.3, 2.0))
            if (a > 0) {
                x.save()
                x.globalAlpha = a
                x.translate(0, (1 - a) * 24)
                x.font = F.vibes(132)
                const ag = x.createLinearGradient(50, 0, 50 + aiW, 0)
                ag.addColorStop(0, '#f472b6')
                ag.addColorStop(1, '#c084fc')
                x.fillStyle = ag
                x.shadowColor = 'rgba(244,114,182,.9)'
                x.shadowBlur = 22
                x.fillText('Ai', 50, 330)
                x.restore()

                const pulse = 1 + .25 * Math.sin(t * 3.2)
                x.save()
                x.globalAlpha = a
                x.fillStyle = '#fff'
                x.shadowColor = '#f472b6'
                x.shadowBlur = 16
                sparkle(x, 50 + aiW + 26, 262, 20 * pulse)
                sparkle(x, 50 + aiW + 58, 300, 9 * pulse)
                x.restore()
            }
        }

        /* galeri foto: foto 1..5 muncul sesuai PHOTO_T0 */
        {
            const shown = PHOTO_T0.filter(v => t >= v).length
            photos.forEach((ph, i) => {
                const t0 = PHOTO_T0[i], pos = PHOTO_POS[i]
                if (t < t0) return
                const a = easeOut(win(t, t0, t0 + .45))
                const back = easeBack(win(t, t0, t0 + .7))
                const float = 3.5 * Math.sin(TAU * t / 6 + i * 1.3)
                x.save()
                x.globalAlpha = a
                polaroidCard(ph.img, ph.label, pos.x, pos.y - (1 - back) * 70 + float, 176, 160,
                    pos.rot * (.4 + .6 * a), .85 + .15 * back, i === shown - 1)
                x.restore()
            })
        }

        /* kartu kaca + quote typewriter (2 halaman) */
        {
            const a = easeOut(win(t, 1.0, 1.6))
            if (a > 0) {
                x.save()
                x.globalAlpha = a
                x.translate(0, (1 - a) * 44)
                x.fillStyle = 'rgba(255,255,255,.15)'
                x.strokeStyle = 'rgba(255,255,255,.55)'
                x.lineWidth = 1.5
                rr(x, CARD.x, CARD.y, CARD.w, CARD.h, 22)
                x.fill()
                x.stroke()

                const ac = x.createLinearGradient(0, CARD.y, 0, CARD.y + CARD.h)
                ac.addColorStop(0, '#f472b6')
                ac.addColorStop(1, '#a855f7')
                x.fillStyle = ac
                rr(x, CARD.x + 14, CARD.y + 18, 6, CARD.h - 36, 3)
                x.fill()

                x.font = F.popB(13)
                x.fillStyle = '#fbcfe8'
                spaced(x, 'HOSHINO AI  SAYS', CARD.x + 36, CARD.y + 30, 3)

                const onP2 = t >= PAGE2_T
                const pg = pages[onP2 ? 1 : 0]
                const typed = onP2 ? win(t, PAGE2_T + .4, FINALE_T - .6) : win(t, 1.8, PAGE2_T - 1.2)
                const fadeOut = onP2 ? 1 : 1 - win(t, PAGE2_T - .3, PAGE2_T)
                x.save()
                x.globalAlpha = a * fadeOut
                x.font = F.popM(20)
                x.fillStyle = '#fff'
                x.shadowColor = 'rgba(0,0,0,.55)'
                x.shadowBlur = 6
                let rem = Math.floor(typed * pg.total)
                pg.lines.forEach((ln, i) => {
                    if (rem <= 0) return
                    x.fillText(ln.slice(0, rem), CARD.x + 36, CARD.y + 62 + i * 27)
                    rem -= ln.length
                })
                x.restore()

                /* equalizer */
                x.shadowBlur = 0
                const bx = CARD.x + CARD.w - 30 - 7 * 11
                for (let i = 0; i < 7; i++) {
                    const bh = 10 + Math.abs(Math.sin(t * 4.2 + i * .9)) * 34
                    const bgd = x.createLinearGradient(0, CARD.y + CARD.h - 24 - bh, 0, CARD.y + CARD.h - 24)
                    bgd.addColorStop(0, '#f9a8d4')
                    bgd.addColorStop(1, '#c084fc')
                    x.fillStyle = bgd
                    rr(x, bx + i * 11, CARD.y + CARD.h - 24 - bh, 7, bh, 3)
                    x.fill()
                }
                x.restore()
            }
        }

        /* ticker bawah */
        {
            const ty = H - 34
            x.save()
            x.fillStyle = 'rgba(219,39,119,.90)'
            x.fillRect(0, ty, W, 34)
            x.beginPath(); x.rect(0, ty, W, 34); x.clip()
            x.font = F.popB(14)
            x.fillStyle = '#fff'
            const off = -((t * 90) % tickW)
            for (let k = 0; k < Math.ceil(W / tickW) + 2; k++) x.fillText(tickTxt, off + k * tickW, ty + 22)
            x.restore()
        }

        /* kilau + flash tiap foto muncul */
        PHOTO_T0.forEach((t0, i) => {
            const age = t - t0
            if (age < 0 || age > .9) return
            const pos = PHOTO_POS[i]
            const k = easeOut(age / .9)
            x.save()
            x.fillStyle = '#fff'
            x.shadowColor = '#f472b6'
            x.shadowBlur = 10
            x.globalAlpha = 1 - age / .9
            burst.forEach(b => sparkle(x, pos.x + Math.cos(b.a) * b.d * k, pos.y + Math.sin(b.a) * b.d * k, b.r * (1 - .5 * k)))
            x.restore()
            if (age < .18) {
                x.fillStyle = `rgba(255,255,255,${.28 * (1 - age / .18)})`
                x.fillRect(0, 0, W, H)
            }
        })

        /* penutup typography */
        {
            const fnA = easeOut(win(t, FINALE_T, FINALE_T + .6))
            if (fnA > 0) {
                x.save()
                x.globalAlpha = fnA * .62
                x.fillStyle = '#14001e'
                x.fillRect(0, 0, W, H)
                x.restore()

                fin.forEach((l, i) => {
                    if (l.ch === ' ') return
                    const a = easeOut(win(t, FINALE_T + .2 + i * .05, FINALE_T + .7 + i * .05))
                    if (a <= 0) return
                    const back = easeBack(win(t, FINALE_T + .2 + i * .05, FINALE_T + .9 + i * .05))
                    x.save()
                    x.globalAlpha = a
                    x.font = F.anton(finSize)
                    const gg = x.createLinearGradient(0, 200, 0, 280)
                    gg.addColorStop(0, '#ffffff')
                    gg.addColorStop(1, '#fbcfe8')
                    x.fillStyle = gg
                    x.shadowColor = 'rgba(244,114,182,.95)'
                    x.shadowBlur = 24
                    x.fillText(l.ch, l.x, 270 - (1 - back) * 50)
                    x.restore()
                })

                const a2 = easeOut(win(t, FINALE_T + 1.1, FINALE_T + 1.8))
                if (a2 > 0) {
                    x.save()
                    x.globalAlpha = a2
                    x.translate(0, (1 - a2) * 20)
                    x.font = F.vibes(84)
                    const ag = x.createLinearGradient((W - finAiW) / 2, 0, (W + finAiW) / 2, 0)
                    ag.addColorStop(0, '#f472b6')
                    ag.addColorStop(1, '#c084fc')
                    x.fillStyle = ag
                    x.shadowColor = 'rgba(244,114,182,.9)'
                    x.shadowBlur = 22
                    x.fillText('Hoshino Ai', (W - finAiW) / 2, 372)
                    x.restore()

                    const pulse = 1 + .25 * Math.sin(t * 3.2)
                    x.save()
                    x.globalAlpha = a2
                    x.fillStyle = '#fff'
                    x.shadowColor = '#f472b6'
                    x.shadowBlur = 16
                    sparkle(x, (W - finAiW) / 2 - 34, 340, 18 * pulse)
                    sparkle(x, (W + finAiW) / 2 + 34, 352, 12 * pulse)
                    x.restore()
                }
            }
        }

        /* fade in / out */
        const fi = 1 - clamp01(t / .5)
        const fo = clamp01((t - (DUR - .5)) / .5)
        const fa = Math.max(fi, fo)
        if (fa > 0) {
            x.fillStyle = `rgba(30,0,40,${fa})`
            x.fillRect(0, 0, W, H)
        }
    }
}

/* ════════════════════════════════════════════════════════════
 *  RENDER: video config → frame → overlay → H264 (+audio asli)
 * ════════════════════════════════════════════════════════════ */

async function renderVideo({ src, out, dur, quote, photos }) {
    const bin = await findFfmpeg()
    const frames = Math.round(dur * FPS)
    const FB = W * H * 4

    const imgs = await Promise.all(photos.map(async (p, i) => ({
        img: await loadImage(p.file),
        label: `FOTO ${i + 1} • ${fmt(p.at)}`
    })))

    const canvas = createCanvas(W, H)
    const x = canvas.getContext('2d')
    const paint = createScene(x, quote, imgs)
    const id = x.createImageData(W, H)

    /* decoder video sumber (di-loop kalau lebih pendek dari durasi hasil) */
    const dec = spawn(bin, ['-hide_banner', '-loglevel', 'error', '-nostats',
        '-stream_loop', '-1', '-t', String(dur), '-i', src,
        '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS}`,
        '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'],
        { stdio: ['ignore', 'pipe', 'ignore'] })

    const pool = []
    let poolLen = 0, ended = false, paused = false
    dec.stdout.on('data', c => {
        pool.push(c); poolLen += c.length
        if (!paused && poolLen > FB * 4) { paused = true; dec.stdout.pause() }
    })
    dec.stdout.once('end', () => { ended = true })
    dec.once('error', () => { ended = true })
    dec.once('close', () => { ended = true })

    const readFrame = async () => {
        while (poolLen < FB) {
            if (ended) return null
            await sleep(3)
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
        if (paused && poolLen < FB * 2) { paused = false; dec.stdout.resume() }
        return need
    }

    /* encoder: frame jpeg → H264, audio asli (di-loop) kalau ada */
    const ff = spawn(bin, ['-hide_banner', '-loglevel', 'error', '-nostats', '-y',
        '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
        '-stream_loop', '-1', '-t', String(dur), '-i', src,
        '-map', '0:v:0', '-map', '1:a:0?',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24',
        '-pix_fmt', 'yuv420p', '-profile:v', 'main',
        '-c:a', 'aac', '-b:a', '96k', '-shortest',
        '-movflags', '+faststart', out],
        { stdio: ['pipe', 'ignore', 'pipe'] })
    let ffErr = '', ffClosed = false
    ff.stderr.on('data', d => { ffErr += d; if (ffErr.length > 8000) ffErr = ffErr.slice(-4000) })
    ff.stdin.on('error', () => { })
    const done = new Promise((res, rej) => ff.on('close', c => { ffClosed = true; c === 0 ? res() : rej(new Error('ffmpeg exit ' + c + ' ' + ffErr.slice(-800))) }))
    done.catch(() => { })

    let last = null, thumb = null, lastJpg = null
    try {
        for (let i = 0; i < frames; i++) {
            if (ffClosed) break
            const f = await readFrame()
            if (f) last = f
            if (!last) throw new Error('video config tidak bisa di-decode')
            id.data.set(last)
            x.putImageData(id, 0, 0)
            const t = i / FPS
            paint(t, dur)
            lastJpg = await canvas.encode('jpeg', 90)
            if (!thumb && t >= 6.9) thumb = lastJpg
            if (!ff.stdin.write(lastJpg)) await new Promise(r => ff.stdin.once('drain', r))
        }
    } finally {
        try { ff.stdin.end() } catch { }
        try { dec.kill('SIGKILL') } catch { }
    }
    await done
    return thumb || lastJpg
}

/* ════════════════════════════════════════════════════════════
 *  BUILD + CACHE
 * ════════════════════════════════════════════════════════════ */

let renderQueue = Promise.resolve()
const CACHE = new Map()

async function buildGreetingVideo(videoUrl, qi) {
    fs.mkdirSync(DIR_TMP, { recursive: true })
    const id = crypto.randomBytes(4).toString('hex')
    const src = path.join(DIR_TMP, `src_${id}.mp4`)
    const out = path.join(DIR_TMP, `out_${id}.mp4`)
    let stills = []
    try {
        const [, srcBuf] = await Promise.all([ensureFonts(), fetchBin(videoUrl, 90000)])
        if (!srcBuf || srcBuf.length < 1000) throw new Error('video dari config kosong / tidak valid')
        fs.writeFileSync(src, srcBuf)

        const srcDur = await probeDuration(src)
        stills = await grabStills(src, srcDur, DIR_TMP, id)
        const thumb = await renderVideo({ src, out, dur: OUT_DUR, quote: QUOTES[qi], photos: stills })

        const buffer = fs.readFileSync(out)
        if (buffer.length < 10000) throw new Error('hasil render kosong')
        return { buffer, thumb, dur: OUT_DUR }
    } finally {
        for (const f of [src, out, ...new Set(stills.map(s => s.file))]) await fs.promises.unlink(f).catch(() => { })
    }
}

function isCached(url, qi) {
    const hit = CACHE.get(`${url}|${qi}`)
    return !!(hit && Date.now() - hit.at < CACHE_TTL)
}

function getGreetingVideo(url, qi) {
    const key = `${url}|${qi}`
    const hit = CACHE.get(key)
    if (hit && Date.now() - hit.at < CACHE_TTL) return hit.p
    for (const [k, v] of CACHE) if (Date.now() - v.at >= CACHE_TTL) CACHE.delete(k)

    const run = renderQueue.then(() => buildGreetingVideo(url, qi))
    renderQueue = run.catch(() => { })
    CACHE.set(key, { at: Date.now(), p: run })
    run.catch(() => CACHE.delete(key))
    return run
}

/* ════════════════════════════════════════════════════════════
 *  UPLOAD KE HOST PUBLIK (fallback chain)
 * ════════════════════════════════════════════════════════════ */

async function uploadVideo(buffer, filename = 'hoshino-ai.mp4') {
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
        console.log('[hoshinoai] upload via', nama, u)
        return u
    } catch (e) { gagal.push(`${nama}: ${e.message}`) }
}
    throw new Error('Upload gagal → ' + gagal.join(' | '))
}

/* ════════════════════════════════════════════════════════════
 *  HANDLER
 * ════════════════════════════════════════════════════════════ */

async function handler(m, { sock }) {
    await m.react('💖')

    try {
        const botName = config.bot?.name || 'Hoshino Ai-Bot'
        const videoUrl = config.assets?.video?.[VIDEO_KEY]
        if (!videoUrl) throw new Error(`config.assets.video.${VIDEO_KEY} masih kkosong`)

        const qi = Math.floor(Math.random() * QUOTES.length)
        if (!isCached(videoUrl, qi)) {
            await m.reply('> Ai lagi dandan buat tampil di panggung... tunggu bentar ya~ ✨')
        }

        // 1) render typography dari video config
        const vid = await getGreetingVideo(videoUrl, qi)

        // 2) upload ke host publik (hasilnya ikut ter-cache bersama render)
        vid.url = vid.url || await uploadVideo(vid.buffer)
        
        console.log('[hoshinoai] qi:', qi, 'url:', vid.url)

        let caption = `🌸 *Yahhooo~! Akhirnya ketemu lagi!* 🌸\n\n`
        caption += `Kamu kangen ya sama idol favoritmu ini?\nAku sudah nungguin kamu muncul loh~ ✨\n\n`
        caption += `Sebagai idol, aku akan selalu memberikan cinta yang paling indah...\nWalaupun sedikit berbohong, tapi ini tulus buat kamu! 💖\n\n`
        caption += `╭━━━〔 🎤 *Hoshino Ai Stage* 〕━━━⬡\n`
        caption += `┃ ✦ Status : Online & Berkilau ✨\n`
        caption += `┃ ✦ Role   : The Ultimate Idol 💖\n`
        caption += `┃ ✦ Mood   : Lagi pengen dimanjain fans nih!\n`
        caption += `╰━━━━━━━━━━━━━━━━⬡\n\n`
        caption += `Jangan pernah alihkan pandanganmu dariku ya...\nKarena bintang yang paling terang hanya ada di sini! 😊\n\n`
        caption += `> "Kebohongan adalah bentuk cinta yang paling indah..." ✨`

        const p = m.prefix || '.'

const ai = new AIRich(sock)
ai.addVideo(vid.url, { width: 1280, height: 720 })
ai.addText(caption)
ai.addWidget({
    title: '💫 Hoshino Ai • Idol Stage',
    actions: [
        { label: `${p}menu`, id: `${p}menu`, kind: 'OTHER', state: 'PENDING', toast: { label: 'Membuka menu~ ✨' } },
        { label: `${p}owner`, id: `${p}owner`, kind: 'OTHER', state: 'PENDING', toast: { label: 'Owner Hoshino Ai Bot~ ⭐' } },
        { label: `${p}allmenu`, id: `${p}allmenu`, kind: 'OTHER', state: 'PENDING', toast: { label: 'Hoshino Ai siap menjawab~ 💕' } }
    ]
})
ai.addSuggest(['hoshino ai', 'cjs', 'bot whatsapp'])
ai.setFooter(`${botName} • Idol Mode`)
await ai.send(m.chat, { quoted: m.raw || m })

        await m.react('✨')

    } catch (err) {
        console.error('[BOT PLUGIN CRASH]', err)
        await m.react('❌').catch(() => { })
        await m.reply(
            `❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ*\n\n` +
            `> ${errWhy(err).slice(0, 300)}\n\n` +
            `> Coba lagi ya, Ai janji next take bakal lebih bagus~`
        )
    }
}

module.exports = { config: pluginConfig, handler }