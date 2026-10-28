const fs = require('fs')
const path = require('path')
const { getAllPlugins } = require('../../src/lib/plugins')
const { createCanvas } = require('@napi-rs/canvas')
const config = require('../../config')

const pluginConfig = {
    name: 'totalfitur',
    alias: ['totalfeature', 'totalcmd', 'countplugin', 'distribusi', 'ttf'],
    category: 'main',
    description: 'Lihat total fitur/command bot dengan chart premium, riwayat pertumbuhan, achievement, dan analisis project',
    usage: '.totalfitur [kategori|search <q>|grafik [7|30]|heatmap|baru [n]|terbesar [n]|dependency|complexity|achievement|riwayat|project|quality|dev|tema <nama>]',
    example: '.totalfitur ai',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

// ─── Hoshino Ai Theme (per waktu — WITA) ──────────────────────────────────────

const TIME_THEMES = {
    pagi: {
        label: 'PAGI', icon: '🌅',
        bg: '#1a0f2e', bgCard: '#241237',
        primary: '#ff8fab', primaryLight: '#ffb3c6',
        secondary: '#ffb997', secondaryLight: '#ffd4b8',
        tertiary: '#ffe66d', tertiaryDim: '#ffd23f',
        accent: '#ff9ecb', cyan: '#a8dadc', green: '#95d5b2', red: '#f28482',
        textPrimary: '#fff4fb', textSecondary: '#e0b8cc', textDim: '#8a6a7a',
        border: '#3a1f45', borderBright: '#7c3f70',
        colors: ['#ff8fab', '#ffb997', '#ffe66d', '#f6bd60', '#f28482',
                 '#ffcdb2', '#84a59d', '#f6ae2d', '#e07a5f', '#81b29a']
    },
    siang: {
        label: 'SIANG', icon: '☀️',
        bg: '#061428', bgCard: '#0d1f3a',
        primary: '#4cc9f0', primaryLight: '#7fdcf7',
        secondary: '#4361ee', secondaryLight: '#7b8ff5',
        tertiary: '#ffd60a', tertiaryDim: '#ffc300',
        accent: '#48bfe3', cyan: '#90e0ef', green: '#57cc99', red: '#f72585',
        textPrimary: '#eef9ff', textSecondary: '#a8cfe0', textDim: '#5a7a90',
        border: '#0f2a4a', borderBright: '#1f5c9a',
        colors: ['#4cc9f0', '#4361ee', '#ffd60a', '#7209b7', '#f72585',
                 '#4895ef', '#560bad', '#80ffdb', '#3a86ff', '#ffbe0b']
    },
    sore: {
        label: 'SORE', icon: '🌇',
        bg: '#2e0f1a', bgCard: '#3a1522',
        primary: '#ff6b35', primaryLight: '#ff9166',
        secondary: '#f72585', secondaryLight: '#ff5ca8',
        tertiary: '#ffbe0b', tertiaryDim: '#fb8500',
        accent: '#ff8552', cyan: '#ffd6a5', green: '#c9ada7', red: '#f94144',
        textPrimary: '#fff1e6', textSecondary: '#e0a8a0', textDim: '#8a5a5a',
        border: '#451f2a', borderBright: '#9a1f5c',
        colors: ['#ff6b35', '#f72585', '#ffbe0b', '#c9184a', '#ff9e00',
                 '#ff4d6d', '#7209b7', '#f3722c', '#f94144', '#f9c74f']
    },
    malam: {
        label: 'MALAM', icon: '🌙',
        bg: '#04020a', bgCard: '#0d0718',
        primary: '#ff2d9b', primaryLight: '#ff6ec7',
        secondary: '#a020f0', secondaryLight: '#c96aff',
        tertiary: '#ffe44d', tertiaryDim: '#ffcc00',
        accent: '#ff79c6', cyan: '#7df9f9', green: '#3dffd0', red: '#f9527e',
        textPrimary: '#fff4fb', textSecondary: '#c9a8e8', textDim: '#7a5a9a',
        border: '#2a0f45', borderBright: '#5c1fa0',
        colors: ['#ff2d9b', '#a020f0', '#ffe44d', '#ff79c6', '#c084fc',
                 '#fb923c', '#f472b6', '#818cf8', '#3dffd0', '#facc15']
    }
}

// Tema manual tambahan (fitur #13) — bisa dipanggil via `.totalfitur tema <nama>`
const MANUAL_THEMES = {
    cyber: {
        label: 'CYBER', icon: '🖥️',
        bg: '#02040a', bgCard: '#050b18',
        primary: '#00fff2', primaryLight: '#7dfff8',
        secondary: '#ff00c8', secondaryLight: '#ff6ee0',
        tertiary: '#f5ff00', tertiaryDim: '#c9d400',
        accent: '#00b8ff', cyan: '#00fff2', green: '#39ff14', red: '#ff2d55',
        textPrimary: '#eaffff', textSecondary: '#8ad9d4', textDim: '#4a6a68',
        border: '#0a2a2a', borderBright: '#0f7a72',
        colors: ['#00fff2', '#ff00c8', '#f5ff00', '#39ff14', '#00b8ff',
                 '#ff2d55', '#7d5fff', '#ffb703', '#06d6a0', '#ef476f']
    },
    sakura: {
        label: 'SAKURA', icon: '🌸',
        bg: '#2a1420', bgCard: '#331a28',
        primary: '#ffb7c5', primaryLight: '#ffd6df',
        secondary: '#ff8fa3', secondaryLight: '#ffb3c1',
        tertiary: '#fff0f3', tertiaryDim: '#ffd6de',
        accent: '#f7cad0', cyan: '#f9dbbd', green: '#c9ada7', red: '#e56b8f',
        textPrimary: '#fff5f7', textSecondary: '#e8b3c2', textDim: '#8a5f6c',
        border: '#4a1f30', borderBright: '#8f3f5c',
        colors: ['#ffb7c5', '#ff8fa3', '#f7cad0', '#ffd6de', '#e56b8f',
                 '#f9dbbd', '#ffafcc', '#cdb4db', '#ffc8dd', '#bde0fe']
    },
    neon: {
        label: 'NEON', icon: '💡',
        bg: '#050014', bgCard: '#0c0322',
        primary: '#ff00ff', primaryLight: '#ff7dff',
        secondary: '#00ffea', secondaryLight: '#7dfff2',
        tertiary: '#faff00', tertiaryDim: '#c9cc00',
        accent: '#ff2fd1', cyan: '#00ffea', green: '#00ff85', red: '#ff003c',
        textPrimary: '#ffffff', textSecondary: '#c9a8ff', textDim: '#6a4a9a',
        border: '#22084a', borderBright: '#6a1fb0',
        colors: ['#ff00ff', '#00ffea', '#faff00', '#ff2fd1', '#00ff85',
                 '#ff003c', '#7d3fff', '#3fd8ff', '#ffb703', '#ff5cad']
    },
    galaxy: {
        label: 'GALAXY', icon: '🌌',
        bg: '#03010a', bgCard: '#0a0518',
        primary: '#7b2ff7', primaryLight: '#a878ff',
        secondary: '#f107a3', secondaryLight: '#ff6ec7',
        tertiary: '#ffd60a', tertiaryDim: '#ffc300',
        accent: '#9d4edd', cyan: '#5390d9', green: '#56cfe1', red: '#ef476f',
        textPrimary: '#f3e8ff', textSecondary: '#b399d4', textDim: '#5a4a7a',
        border: '#1a0a3a', borderBright: '#4a1f8a',
        colors: ['#7b2ff7', '#f107a3', '#ffd60a', '#9d4edd', '#5390d9',
                 '#56cfe1', '#ef476f', '#c77dff', '#3a86ff', '#ffbe0b']
    },
    hoshino: {
        label: 'HOSHINO', icon: '⭐',
        bg: '#08020f', bgCard: '#100826',
        primary: '#ff5fa2', primaryLight: '#ff9ecb',
        secondary: '#8a2be2', secondaryLight: '#b47ef0',
        tertiary: '#ffe066', tertiaryDim: '#ffd23f',
        accent: '#ff7fc4', cyan: '#7dd8ff', green: '#7bf1a8', red: '#ff5c7a',
        textPrimary: '#fff4fb', textSecondary: '#d4a8e8', textDim: '#7a5a9a',
        border: '#2a0f45', borderBright: '#6a1fa0',
        colors: ['#ff5fa2', '#8a2be2', '#ffe066', '#ff9ecb', '#b47ef0',
                 '#7dd8ff', '#7bf1a8', '#ff7fc4', '#ffb703', '#c084fc']
    },
    minimal: {
        label: 'MINIMAL', icon: '◻️',
        bg: '#0f0f12', bgCard: '#17171b',
        primary: '#e8e8ea', primaryLight: '#ffffff',
        secondary: '#8a8a92', secondaryLight: '#b0b0b8',
        tertiary: '#f5c542', tertiaryDim: '#d4a52f',
        accent: '#a8a8b0', cyan: '#8ac9d4', green: '#7bc99a', red: '#d4626b',
        textPrimary: '#f2f2f4', textSecondary: '#a0a0a8', textDim: '#5a5a62',
        border: '#26262c', borderBright: '#3a3a42',
        colors: ['#e8e8ea', '#8a8a92', '#f5c542', '#8ac9d4', '#7bc99a',
                 '#d4626b', '#b0b0b8', '#c9a5d4', '#e0a870', '#7b93c9']
    },
    ocean: {
        label: 'OCEAN', icon: '🌊',
        bg: '#020c14', bgCard: '#05141f',
        primary: '#00b4d8', primaryLight: '#48cae4',
        secondary: '#0077b6', secondaryLight: '#3a9fd6',
        tertiary: '#90e0ef', tertiaryDim: '#61c8dc',
        accent: '#00a8cc', cyan: '#ade8f4', green: '#2dd4bf', red: '#f77f6b',
        textPrimary: '#eafcff', textSecondary: '#8fc4d8', textDim: '#4a6a78',
        border: '#0a2a3a', borderBright: '#1f6a8a',
        colors: ['#00b4d8', '#0077b6', '#90e0ef', '#48cae4', '#2dd4bf',
                 '#023e8a', '#ade8f4', '#0096c7', '#caf0f8', '#f77f6b']
    },
    fire: {
        label: 'FIRE', icon: '🔥',
        bg: '#140402', bgCard: '#220805',
        primary: '#ff4d00', primaryLight: '#ff8a4d',
        secondary: '#ff0044', secondaryLight: '#ff5c85',
        tertiary: '#ffc300', tertiaryDim: '#e0a800',
        accent: '#ff6b00', cyan: '#ffb347', green: '#c9ada7', red: '#ff0044',
        textPrimary: '#fff2e8', textSecondary: '#e0a082', textDim: '#8a5a4a',
        border: '#3a1005', borderBright: '#8a2a0a',
        colors: ['#ff4d00', '#ff0044', '#ffc300', '#ff8a4d', '#ff6b00',
                 '#e85d04', '#dc2f02', '#faa307', '#f48c06', '#9d0208']
    }
}

function getCurrentTheme() {
    const moment = require('moment-timezone')
    const hour = moment().tz('Asia/Makassar').hour()
    let key = 'malam'
    if (hour >= 5 && hour < 10) key = 'pagi'
    else if (hour >= 10 && hour < 15) key = 'siang'
    else if (hour >= 15 && hour < 18) key = 'sore'
    return { ...TIME_THEMES[key], key }
}

function resolveTheme(manualName) {
    if (manualName && MANUAL_THEMES[manualName]) {
        return { ...MANUAL_THEMES[manualName], key: manualName, manual: true }
    }
    return getCurrentTheme()
}

const CATEGORY_ICONS = {
    main: '🏠', tools: '🔧', downloader: '📥', download: '📥',
    sticker: '🎨', ai: '🤖', media: '📷', game: '🎮',
    rpg: '⚔️', maker: '🖼️', fun: '🎭', group: '👥',
    owner: '👑', premium: '💎', info: '📊', search: '🔍',
    canvas: '🎨', anime: '🌸', nsfw: '🔞', utility: '🛠️',
    economy: '💰', other: '📦'
}

// ─── Canvas Helpers (dipakai lintas fitur, NO EMOJI di dalam sini) ────────────

function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '')
    const r = parseInt(h.substring(0, 2), 16)
    const g = parseInt(h.substring(2, 4), 16)
    const b = parseInt(h.substring(4, 6), 16)
    return `rgba(${r},${g},${b},${alpha})`
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
}

function drawStar(ctx, cx, cy, outerR, innerR, color, alpha = 1, blur = 0) {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    if (blur > 0) { ctx.shadowColor = color; ctx.shadowBlur = blur }
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2
        const r = i % 2 === 0 ? outerR : innerR
        ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()
}

function drawSparkle(ctx, cx, cy, r, color, alpha = 1, blur = 0) {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    if (blur > 0) { ctx.shadowColor = color; ctx.shadowBlur = blur }
    ctx.beginPath()
    ctx.moveTo(cx, cy - r)
    ctx.lineTo(cx + r * 0.25, cy)
    ctx.lineTo(cx, cy + r)
    ctx.lineTo(cx - r * 0.25, cy)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(cx - r, cy)
    ctx.lineTo(cx, cy + r * 0.25)
    ctx.lineTo(cx + r, cy)
    ctx.lineTo(cx, cy - r * 0.25)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
}

function drawGlowDot(ctx, x, y, r, color, alpha = 1) {
    ctx.save()
    ctx.globalAlpha = alpha
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3)
    g.addColorStop(0, color)
    g.addColorStop(0.3, `${color}80`)
    g.addColorStop(1, 'transparent')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r * 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
}

function drawGlassCard(ctx, x, y, w, h, r, borderColor, fillAlpha = 0.07) {
    roundRect(ctx, x, y, w, h, r)
    const cfill = ctx.createLinearGradient(x, y, x, y + h)
    cfill.addColorStop(0, `rgba(180,80,255,${fillAlpha})`)
    cfill.addColorStop(1, `rgba(255,45,155,${fillAlpha * 0.4})`)
    ctx.fillStyle = cfill
    ctx.fill()

    roundRect(ctx, x, y, w, h, r)
    ctx.strokeStyle = borderColor
    ctx.lineWidth = 1.2
    ctx.stroke()

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x + r, y + 1)
    ctx.lineTo(x + w - r, y + 1)
    ctx.strokeStyle = `rgba(255,255,255,0.12)`
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
}

function drawBackground(ctx, W, H, theme) {
    ctx.fillStyle = theme.bg
    ctx.fillRect(0, 0, W, H)

    const nebulas = [
        { x: 0,   y: 0,   r: 620, c: `${theme.primary}18` },
        { x: W,   y: H,   r: 680, c: `${theme.secondary}1a` },
        { x: W/2, y: H/2, r: 420, c: `${theme.secondary}0a` },
        { x: 100, y: H-100, r: 360, c: `${theme.primary}10` },
        { x: W-80, y: 80,   r: 320, c: `${theme.tertiary}0c` },
    ]
    nebulas.forEach(n => {
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r)
        g.addColorStop(0, n.c)
        g.addColorStop(1, 'transparent')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, W, H)
    })

    ctx.save()
    for (let y = 0; y < H; y += 4) {
        ctx.globalAlpha = 0.018
        ctx.strokeStyle = theme.primary
        ctx.lineWidth = 0.5
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }
    for (let x = 0; x < W; x += 80) {
        ctx.globalAlpha = 0.012
        ctx.strokeStyle = theme.secondary
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    ctx.restore()
}

function drawStarField(ctx, W, H, theme) {
    const bigStars = [
        [58,  32,  12, 5,  theme.tertiary, 1.0, 24],
        [W-55, 38,  9,  4,  theme.primary,  0.9, 18],
        [W-120,H-30, 11, 4.5,theme.tertiary, 0.9, 20],
        [80,  H-40, 8,  3,  theme.primaryLight, 0.8, 14],
        [W/2+10,H-38,10, 4,  theme.secondary,0.7, 16],
    ]
    bigStars.forEach(([cx, cy, r, ir, c, a, bl]) => drawStar(ctx, cx, cy, r, ir, c, a, bl))

    const sparkles = [
        [W-200, 25,  9, theme.tertiary,  0.85, 16],
        [220,   H-38,7, theme.primary,   0.8,  12],
        [W-300, H-45,6, theme.secondaryLight,0.7,10],
        [420,   18,  8, theme.tertiary,  0.75, 14],
        [680,   H-30,7, theme.cyan,      0.65, 10],
    ]
    sparkles.forEach(([cx, cy, r, c, a, bl]) => drawSparkle(ctx, cx, cy, r, c, a, bl))

    const dots = [
        [170, 70,  2.5, theme.primary,  0.5],
        [750, 100, 2,   theme.tertiary, 0.6],
        [95,  430, 2,   theme.cyan,     0.4],
        [840, 460, 2.5, theme.primary,  0.5],
        [390, H-12,2,   theme.secondary,0.55],
        [600, 22,  1.8, theme.accent,   0.45],
        [W-30, 200, 2,  theme.tertiary, 0.4],
        [30,  300, 1.5, theme.primary,  0.35],
    ]
    dots.forEach(([x, y, r, c, a]) => drawGlowDot(ctx, x, y, r, c, a))
}

function drawBgPhoto(ctx, img, W, H, theme) {
    if (!img) return
    const scale = Math.max(W / img.width, H / img.height)
    const dw = img.width  * scale
    const dh = img.height * scale
    const dx = (W - dw) / 2
    const dy = (H - dh) / 2
    ctx.save()
    ctx.globalAlpha = 0.16
    ctx.drawImage(img, dx, dy, dw, dh)
    ctx.restore()
    const vig = ctx.createRadialGradient(W/2, H/2, H*0.15, W/2, H/2, H*0.85)
    vig.addColorStop(0, hexToRgba(theme.bg, 0))
    vig.addColorStop(1, hexToRgba(theme.bg, 0.75))
    ctx.fillStyle = vig
    ctx.fillRect(0, 0, W, H)
}

function drawSeparator(ctx, W, y, theme) {
    const g = ctx.createLinearGradient(30, y, W - 30, y)
    g.addColorStop(0,   'transparent')
    g.addColorStop(0.15, theme.secondary)
    g.addColorStop(0.4,  theme.primary)
    g.addColorStop(0.5,  theme.tertiary)
    g.addColorStop(0.6,  theme.primary)
    g.addColorStop(0.85, theme.secondary)
    g.addColorStop(1,   'transparent')
    ctx.strokeStyle = g
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(W - 30, y); ctx.stroke()

    drawSparkle(ctx, W / 2 - 14, y, 5, theme.primary, 0.7, 8)
    drawStar(ctx, W / 2, y, 8, 3.5, theme.tertiary, 1, 14)
    drawSparkle(ctx, W / 2 + 14, y, 5, theme.primary, 0.7, 8)
}

function drawFooter(ctx, W, H, label, theme) {
    const fh = 60
    const fy = H - fh

    const fg = ctx.createLinearGradient(0, fy, W, H)
    fg.addColorStop(0,   `${theme.primary}28`)
    fg.addColorStop(0.35,`${theme.secondary}22`)
    fg.addColorStop(0.65,`${theme.secondary}22`)
    fg.addColorStop(1,   `${theme.primary}28`)
    ctx.fillStyle = fg
    ctx.fillRect(0, fy, W, fh)

    const fbg = ctx.createLinearGradient(0, fy, W, fy)
    fbg.addColorStop(0, 'transparent')
    fbg.addColorStop(0.2, theme.primary)
    fbg.addColorStop(0.5, theme.tertiary)
    fbg.addColorStop(0.8, theme.secondary)
    fbg.addColorStop(1, 'transparent')
    ctx.strokeStyle = fbg
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(W, fy); ctx.stroke()

    drawStar(ctx, 55,   H - 28, 8, 3.5, theme.tertiary, 0.9, 14)
    drawStar(ctx, W-55, H - 28, 8, 3.5, theme.tertiary, 0.9, 14)
    drawSparkle(ctx, 85, H - 28, 5, theme.primary, 0.6, 8)
    drawSparkle(ctx, W-85, H - 28, 5, theme.primary, 0.6, 8)

    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const ftGrad = ctx.createLinearGradient(W/2 - 200, 0, W/2 + 200, 0)
    ftGrad.addColorStop(0, theme.primaryLight)
    ftGrad.addColorStop(0.5, theme.tertiary)
    ftGrad.addColorStop(1, theme.secondaryLight)
    ctx.fillStyle = ftGrad
    ctx.font = 'bold 16px Arial'
    ctx.shadowColor = theme.primary
    ctx.shadowBlur = 22
    ctx.fillText(label, W / 2, H - 36)
    ctx.shadowBlur = 0

    ctx.fillStyle = theme.textDim
    ctx.font = 'italic 9.5px Arial'
    ctx.fillText(
        `${theme.label} - Generated at ${require('moment-timezone')().tz('Asia/Makassar').format('DD/MM/YYYY HH:mm')} WITA`,
        W / 2, H - 14
    )
    ctx.restore()
}

async function loadImageFromUrls(urls) {
    const { loadImage } = require('@napi-rs/canvas')
    const https = require('https')
    const http  = require('http')
    for (const url of urls) {
        try {
            const buf = await new Promise((resolve, reject) => {
                const mod = url.startsWith('https') ? https : http
                mod.get(url, { timeout: 8000 }, res => {
                    if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
                    const chunks = []
                    res.on('data', c => chunks.push(c))
                    res.on('end', () => resolve(Buffer.concat(chunks)))
                    res.on('error', reject)
                }).on('error', reject)
            })
            return await loadImage(buf)
        } catch (_) {}
    }
    return null
}

const BG_URLS = [
    'https://files.catbox.moe/rae6rk.jpeg',
    'https://litter.catbox.moe/h2hj7j.jpg',
    'https://tmpfiles.org/dl/wXwweFJZ6tAL/file.jpg',
    'https://put.icu/s/ac7ugpkj.jpg',
    'https://c.termai.cc/i134/YKqiwq.jpg',
]

// ─── Fitur 1 & shared: Snapshot / Riwayat Pertumbuhan Harian ─────────────────
// Disimpan lewat modul database yang sudah dipakai bot (bukan file JSON terpisah)
// supaya konsisten dengan konvensi project.

function todayKey() {
    return require('moment-timezone')().tz('Asia/Makassar').format('YYYY-MM-DD')
}

function getDB() {
    try {
        return require('../../src/lib/database').getDatabase()
    } catch {
        return null
    }
}

async function persistDB(db) {
    if (!db) return
    try {
        if (typeof db.write === 'function') await db.write()
        else if (typeof db.save === 'function') await db.save()
        else if (typeof db.commit === 'function') await db.commit()
    } catch (_) {}
}

async function saveSnapshotAndGetHistory(stats) {
    const db = getDB()
    if (!db || !db.data) return { history: {}, todayEntry: stats }

    if (!db.data.totalfiturHistory) db.data.totalfiturHistory = {}
    const key = todayKey()
    db.data.totalfiturHistory[key] = {
        plugin: stats.plugin,
        command: stats.command,
        alias: stats.alias,
        category: stats.category
    }

    // batasi riwayat maksimal 90 hari biar db gak membengkak
    const dates = Object.keys(db.data.totalfiturHistory).sort()
    if (dates.length > 90) {
        dates.slice(0, dates.length - 90).forEach(d => delete db.data.totalfiturHistory[d])
    }

    await persistDB(db)
    return { history: db.data.totalfiturHistory, todayEntry: db.data.totalfiturHistory[key] }
}

function getPreviousEntry(history, todayKeyStr) {
    const dates = Object.keys(history).filter(d => d !== todayKeyStr).sort()
    if (!dates.length) return null
    return { date: dates[dates.length - 1], entry: history[dates[dates.length - 1]] }
}

function diffLine(label, todayVal, prevVal) {
    if (prevVal === undefined || prevVal === null) return `┃ ◦ ${label.padEnd(10, ' ')}: *${todayVal}* _(baru)_\n`
    const delta = todayVal - prevVal
    const sign = delta > 0 ? `+${delta}` : `${delta}`
    return `┃ ◦ ${label.padEnd(10, ' ')}: *${todayVal}* (${sign})\n`
}

function buildGrowthCaption(history, todayEntry) {
    const prev = getPreviousEntry(history, todayKey())
    let caption = `╭┈┈✦「 📈 *ᴘᴇʀᴛᴜᴍʙᴜʜᴀɴ ʜᴀʀɪ ɪɴɪ* 」\n`
    if (!prev) {
        caption += `┃ Belum ada data kemarin untuk dibandingkan.\n╰┈┈✦\n\n`
        return caption
    }
    caption += diffLine('Plugin', todayEntry.plugin, prev.entry.plugin)
    caption += diffLine('Command', todayEntry.command, prev.entry.command)
    caption += diffLine('Alias', todayEntry.alias, prev.entry.alias)
    caption += diffLine('Kategori', todayEntry.category, prev.entry.category)
    caption += `┃ _dibanding ${prev.date}_\n╰┈┈✦\n\n`
    return caption
}

// `.totalfitur riwayat` — daftar riwayat harian ringkas (teks)
async function handleRiwayat(m, sock, theme, history) {
    const dates = Object.keys(history).sort().reverse().slice(0, 14)
    if (!dates.length) {
        await m.reply('Belum ada riwayat yang tersimpan. Jalankan `.totalfitur` dulu beberapa hari supaya ada data untuk dibandingkan.')
        return
    }
    let caption = `⭐ *ʀɪᴡᴀʏᴀᴛ ᴘᴇʀᴛᴜᴍʙᴜʜᴀɴ* ${theme.icon}\n\n`
    caption += `╭┈┈✦「 📅 *14 ʜᴀʀɪ ᴛᴇʀᴀᴋʜɪʀ* 」\n`
    dates.forEach((d, i) => {
        const e = history[d]
        const prevD = dates[i + 1]
        const prevE = prevD ? history[prevD] : null
        const delta = prevE ? (e.plugin - prevE.plugin) : null
        const deltaStr = delta === null ? '' : (delta > 0 ? ` (+${delta})` : delta < 0 ? ` (${delta})` : ' (=)')
        caption += `┃ ${d} → *${e.plugin}* plugin, *${e.command}* cmd${deltaStr}\n`
    })
    caption += `╰┈┈✦`
    await m.reply(caption)
}

// ─── Fitur 2: Grafik Perkembangan (line chart canvas, 7 atau 30 hari) ────────

async function createGrowthChart(history, days, theme) {
    const dates = Object.keys(history).sort().slice(-days)
    const W = 900, H = 560
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')

    drawBackground(ctx, W, H, theme)
    drawStarField(ctx, W, H, theme)

    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const titleGrad = ctx.createLinearGradient(W/2 - 220, 0, W/2 + 220, 0)
    titleGrad.addColorStop(0, theme.primaryLight)
    titleGrad.addColorStop(0.5, theme.textPrimary)
    titleGrad.addColorStop(1, theme.secondaryLight)
    ctx.fillStyle = titleGrad
    ctx.font = 'bold 24px Arial'
    ctx.shadowColor = theme.primary
    ctx.shadowBlur = 20
    ctx.fillText(`GRAFIK PERTUMBUHAN - ${days} HARI TERAKHIR`, W / 2, 40)
    ctx.shadowBlur = 0
    ctx.restore()

    drawSeparator(ctx, W, 66, theme)

    if (dates.length < 2) {
        ctx.save()
        ctx.fillStyle = theme.textSecondary
        ctx.font = '14px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('Data riwayat belum cukup untuk membuat grafik.', W / 2, H / 2)
        ctx.restore()
        drawFooter(ctx, W, H, '- BELUM CUKUP DATA -', theme)
        return canvas.toBuffer('image/png')
    }

    const plotX = 90, plotY = 110, plotW = W - 180, plotH = 340
    const series = ['plugin', 'command']
    const seriesColor = { plugin: theme.primary, command: theme.tertiary }
    const seriesLabel = { plugin: 'PLUGIN', command: 'COMMAND' }

    const allVals = dates.flatMap(d => series.map(s => history[d][s] || 0))
    const maxV = Math.max(...allVals)
    const minV = Math.min(...allVals)
    const pad = Math.max(1, Math.round((maxV - minV) * 0.15))
    const top = maxV + pad, bottom = Math.max(0, minV - pad)

    // grid
    ctx.save()
    for (let i = 0; i <= 4; i++) {
        const gy = plotY + (plotH / 4) * i
        ctx.strokeStyle = `${theme.border}90`
        ctx.lineWidth = 0.8
        ctx.beginPath(); ctx.moveTo(plotX, gy); ctx.lineTo(plotX + plotW, gy); ctx.stroke()
        const val = Math.round(top - ((top - bottom) / 4) * i)
        ctx.fillStyle = theme.textDim
        ctx.font = '9px Arial'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(val.toString(), plotX - 10, gy)
    }
    ctx.restore()

    const stepX = dates.length > 1 ? plotW / (dates.length - 1) : 0

    series.forEach(s => {
        const color = seriesColor[s]
        const points = dates.map((d, i) => {
            const val = history[d][s] || 0
            const x = plotX + i * stepX
            const y = plotY + plotH - ((val - bottom) / (top - bottom || 1)) * plotH
            return [x, y]
        })

        ctx.save()
        ctx.beginPath()
        points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
        ctx.lineTo(points[points.length - 1][0], plotY + plotH)
        ctx.lineTo(points[0][0], plotY + plotH)
        ctx.closePath()
        const areaG = ctx.createLinearGradient(0, plotY, 0, plotY + plotH)
        areaG.addColorStop(0, `${color}30`)
        areaG.addColorStop(1, 'transparent')
        ctx.fillStyle = areaG
        ctx.fill()
        ctx.restore()

        ctx.save()
        ctx.beginPath()
        points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
        ctx.strokeStyle = color
        ctx.lineWidth = 2.5
        ctx.shadowColor = color
        ctx.shadowBlur = 12
        ctx.stroke()
        ctx.restore()

        points.forEach(([x, y]) => drawGlowDot(ctx, x, y, 3, color, 0.9))
    })

    // x labels (skip biar gak numpuk)
    const labelEvery = Math.max(1, Math.ceil(dates.length / 8))
    ctx.save()
    ctx.fillStyle = theme.textDim
    ctx.font = '8.5px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    dates.forEach((d, i) => {
        if (i % labelEvery !== 0 && i !== dates.length - 1) return
        const x = plotX + i * stepX
        ctx.fillText(d.slice(5), x, plotY + plotH + 10)
    })
    ctx.restore()

    // legend
    ctx.save()
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    series.forEach((s, i) => {
        const lx = plotX + i * 140, ly = 90
        drawGlowDot(ctx, lx, ly, 3, seriesColor[s], 0.9)
        ctx.fillStyle = theme.textSecondary
        ctx.font = 'bold 10px Arial'
        ctx.fillText(seriesLabel[s], lx + 12, ly)
    })
    ctx.restore()

    drawFooter(ctx, W, H, `${dates[dates.length - 1]} vs ${dates[0]}`, theme)
    return canvas.toBuffer('image/png')
}

// ─── Fitur 3: Achievement System (teks) ──────────────────────────────────────

const MILESTONES = {
    plugin:   [50, 100, 150, 200, 250, 300, 400, 500],
    command:  [200, 500, 750, 1000, 1500, 2000],
    alias:    [200, 500, 750, 1000, 1500],
    category: [5, 10, 15, 20, 25]
}

function buildAchievementCaption(stats, theme) {
    let caption = `⭐ *ᴀᴄʜɪᴇᴠᴇᴍᴇɴᴛ & ᴍɪʟᴇsᴛᴏɴᴇ* ${theme.icon}\n\n`
    const sections = [
        ['plugin', 'PLUGIN'],
        ['command', 'COMMAND'],
        ['alias', 'ALIAS'],
        ['category', 'KATEGORI']
    ]
    sections.forEach(([key, label]) => {
        const val = stats[key]
        const list = MILESTONES[key]
        caption += `╭┈┈✦「 🏆 *${label}* 」\n`
        list.forEach(ms => {
            const reached = val >= ms
            caption += `┃ ${reached ? '✔' : '⬜'} ${ms} ${label.toLowerCase()}\n`
        })
        const nextMs = list.find(ms => ms > val)
        if (nextMs) {
            const pct = ((val / nextMs) * 100).toFixed(0)
            caption += `┃ Progress ke ${nextMs}: *${pct}%* (${val}/${nextMs})\n`
        } else {
            caption += `┃ Semua milestone ${label.toLowerCase()} tercapai!\n`
        }
        caption += `╰┈┈✦\n\n`
    })
    return caption
}

// ─── Fitur 4 & 5: Plugin Terbaru / Terbesar (scan filesystem) ───────────────

function getPluginRootDir() {
    // file plugin ini diasumsikan ada di plugins/<kategori>/totalfitur.js
    return path.resolve(__dirname, '..')
}

function walkJsFiles(dir, out = []) {
    let entries = []
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
    for (const e of entries) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue
        const full = path.join(dir, e.name)
        if (e.isDirectory()) walkJsFiles(full, out)
        else if (e.isFile() && e.name.endsWith('.js')) out.push(full)
    }
    return out
}

function buildNewestCaption(n, theme) {
    const files = walkJsFiles(getPluginRootDir())
    const withStat = files.map(f => {
        try {
            const st = fs.statSync(f)
            return { name: path.basename(f), mtime: st.mtimeMs }
        } catch { return null }
    }).filter(Boolean)
    withStat.sort((a, b) => b.mtime - a.mtime)
    const top = withStat.slice(0, n)

    let caption = `⭐ *ᴘʟᴜɢɪɴ ᴛᴇʀʙᴀʀᴜ* ${theme.icon}\n\n╭┈┈✦「 🆕 *${n} ᴛᴇʀᴀᴋʜɪʀ ᴅɪʙᴜᴀᴛ/ᴅɪᴜʙᴀʜ* 」\n`
    top.forEach((f, i) => {
        const d = new Date(f.mtime)
        caption += `┃ ${i + 1}. \`${f.name}\` — ${d.toLocaleDateString('id-ID')}\n`
    })
    caption += `╰┈┈✦`
    return caption
}

function buildBiggestCaption(n, theme) {
    const files = walkJsFiles(getPluginRootDir())
    const withStat = files.map(f => {
        try {
            const st = fs.statSync(f)
            return { name: path.basename(f), kb: st.size / 1024 }
        } catch { return null }
    }).filter(Boolean)
    withStat.sort((a, b) => b.kb - a.kb)
    const top = withStat.slice(0, n)
    const warnThreshold = 60

    let caption = `⭐ *ᴘʟᴜɢɪɴ ᴛᴇʀʙᴇsᴀʀ* ${theme.icon}\n\n╭┈┈✦「 📦 *${n} ꜰɪʟᴇ ᴛᴇʀʙᴇsᴀʀ* 」\n`
    top.forEach((f, i) => {
        const warn = f.kb > warnThreshold ? ' ⚠ pertimbangkan dipecah' : ''
        caption += `┃ ${i + 1}. \`${f.name}\` — *${f.kb.toFixed(1)} KB*${warn}\n`
    })
    caption += `╰┈┈✦`
    return caption
}

// ─── Fitur 6: Dependency Analyzer ────────────────────────────────────────────

function buildDependencyCaption(theme) {
    const files = walkJsFiles(getPluginRootDir())
    const counts = {}
    const reqRegex = /require\(\s*['"]([^'"]+)['"]\s*\)/g

    files.forEach(f => {
        let content = ''
        try { content = fs.readFileSync(f, 'utf8') } catch { return }
        const seenInFile = new Set()
        let match
        while ((match = reqRegex.exec(content)) !== null) {
            let mod = match[1]
            if (mod.startsWith('.') || mod.startsWith('/')) continue // skip file lokal
            mod = mod.split('/')[0]
            if (mod.startsWith('@')) mod = match[1].split('/').slice(0, 2).join('/')
            seenInFile.add(mod)
        }
        seenInFile.forEach(mod => { counts[mod] = (counts[mod] || 0) + 1 })
    })

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15)

    let caption = `⭐ *ᴅᴇᴘᴇɴᴅᴇɴᴄʏ ᴀɴᴀʟʏᴢᴇʀ* ${theme.icon}\n\n╭┈┈✦「 📚 *ʟɪʙʀᴀʀʏ ᴛᴇʀʙᴀɴʏᴀᴋ ᴅɪᴘᴀᴋᴀɪ* 」\n`
    sorted.forEach(([mod, count], i) => {
        caption += `┃ ${i + 1}. \`${mod}\` — *${count}* plugin\n`
    })
    caption += `╰┈┈✦\n\n> Total library unik terdeteksi: *${Object.keys(counts).length}*`
    return caption
}

// ─── Fitur 7: Complexity Score ───────────────────────────────────────────────

function scorePluginComplexity(content) {
    const ifCount = (content.match(/\bif\s*\(/g) || []).length
    const switchCount = (content.match(/\bswitch\s*\(/g) || []).length
    const funcCount = (content.match(/\bfunction\b/g) || []).length
    const classCount = (content.match(/\bclass\s+\w+/g) || []).length
    const reqCount = (content.match(/\brequire\(/g) || []).length
    const lineCount = content.split('\n').length

    const raw = ifCount * 1 + switchCount * 1.5 + funcCount * 1.2 + classCount * 3 + reqCount * 0.5 + lineCount * 0.02
    return raw
}

function buildComplexityCaption(theme, categoryFilter) {
    const allPlugins = getAllPlugins()
    const perCategory = {}

    allPlugins.forEach(p => {
        if (!p.config) return
        const cat = p.config.category || 'other'
        if (categoryFilter && cat !== categoryFilter) return
        let content = ''
        try {
            if (p.filePath) content = fs.readFileSync(p.filePath, 'utf8')
        } catch { content = '' }
        const score = scorePluginComplexity(content)
        if (!perCategory[cat]) perCategory[cat] = { total: 0, count: 0 }
        perCategory[cat].total += score
        perCategory[cat].count += 1
    })

    const rows = Object.entries(perCategory).map(([cat, d]) => ({ cat, avg: d.total / d.count }))
    rows.sort((a, b) => b.avg - a.avg)

    if (!rows.length) {
        return `⭐ *ᴄᴏᴍᴘʟᴇxɪᴛʏ sᴄᴏʀᴇ* ${theme.icon}\n\nTidak ada data (kemungkinan \`filePath\` tidak tersedia dari \`getAllPlugins()\` — sesuaikan sumber baca file plugin jika perlu).`
    }

    const maxAvg = Math.max(...rows.map(r => r.avg))
    let caption = `⭐ *ᴄᴏᴍᴘʟᴇxɪᴛʏ sᴄᴏʀᴇ* ${theme.icon}\n\n╭┈┈✦「 🧠 *sᴋᴏʀ ᴋᴏᴍᴘʟᴇᴋsɪᴛᴀs ᴘᴇʀ ᴋᴀᴛᴇɢᴏʀɪ* 」\n`
    rows.forEach(r => {
        const stars = Math.max(1, Math.round((r.avg / maxAvg) * 5))
        caption += `┃ \`${r.cat.toUpperCase()}\` — ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}\n`
    })
    caption += `╰┈┈✦`
    return caption
}

// ─── Fitur 8: Heatmap Kategori (canvas) ──────────────────────────────────────

async function createHeatmapChart(categories, totalCommands, theme) {
    const sorted = Object.entries(categories).sort((a, b) => b[1].total - a[1].total)
    const W = 900, H = 120 + sorted.length * 46 + 80
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')

    drawBackground(ctx, W, H, theme)
    drawStarField(ctx, W, H, theme)

    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const titleGrad = ctx.createLinearGradient(W/2 - 200, 0, W/2 + 200, 0)
    titleGrad.addColorStop(0, theme.primaryLight)
    titleGrad.addColorStop(0.5, theme.textPrimary)
    titleGrad.addColorStop(1, theme.secondaryLight)
    ctx.fillStyle = titleGrad
    ctx.font = 'bold 24px Arial'
    ctx.shadowColor = theme.primary
    ctx.shadowBlur = 20
    ctx.fillText('HEATMAP KATEGORI', W / 2, 40)
    ctx.shadowBlur = 0
    ctx.restore()

    drawSeparator(ctx, W, 66, theme)

    const maxVal = Math.max(...sorted.map(([, d]) => d.total))
    const barX = 220, barW = W - barX - 60, rowH = 46
    let y = 100

    sorted.forEach(([cat, data]) => {
        const pct = data.total / maxVal
        const intensity = 0.25 + pct * 0.75
        const color = theme.primary

        ctx.save()
        ctx.fillStyle = theme.textSecondary
        ctx.font = 'bold 11px Arial'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(cat.toUpperCase(), barX - 16, y + rowH / 2)
        ctx.restore()

        // heat cells (segmented block style)
        const cells = 20
        const cellW = barW / cells
        const activeCells = Math.max(1, Math.round(pct * cells))
        for (let i = 0; i < cells; i++) {
            const cx = barX + i * cellW
            const active = i < activeCells
            roundRect(ctx, cx + 1, y + 6, cellW - 2, rowH - 12, 3)
            if (active) {
                const heatFrac = i / cells
                const heatColor = heatFrac < 0.5 ? theme.secondary : heatFrac < 0.8 ? theme.primary : theme.tertiary
                ctx.fillStyle = heatColor
                ctx.globalAlpha = intensity
                ctx.shadowColor = heatColor
                ctx.shadowBlur = 6
            } else {
                ctx.fillStyle = `${theme.border}80`
                ctx.globalAlpha = 1
                ctx.shadowBlur = 0
            }
            ctx.fill()
            ctx.globalAlpha = 1
            ctx.shadowBlur = 0
        }

        ctx.save()
        ctx.fillStyle = theme.textPrimary
        ctx.font = 'bold 10px Arial'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${data.total}`, barX + barW + 10, y + rowH / 2)
        ctx.restore()

        y += rowH
    })

    drawFooter(ctx, W, H, `${sorted.length} KATEGORI TERPETAKAN`, theme)
    return canvas.toBuffer('image/png')
}

// ─── Fitur 9: Detail Kategori (teks) ─────────────────────────────────────────

function buildCategoryDetailCaption(catName, allPlugins, theme) {
    const inCat = allPlugins.filter(p => p.config && (p.config.category || 'other') === catName)
    if (!inCat.length) return null

    const totalCallable = inCat.reduce((sum, p) => {
        const aliases = Array.isArray(p.config.alias) ? p.config.alias.length : 0
        return sum + 1 + aliases
    }, 0)

    const withStat = inCat.map(p => {
        let mtime = 0, kb = 0
        try {
            if (p.filePath) {
                const st = fs.statSync(p.filePath)
                mtime = st.mtimeMs
                kb = st.size / 1024
            }
        } catch {}
        return { name: p.config.name, mtime, kb }
    })
    const newest = [...withStat].sort((a, b) => b.mtime - a.mtime)[0]
    const biggest = [...withStat].sort((a, b) => b.kb - a.kb)[0]

    const ownerOnly = inCat.filter(p => p.config.isOwner).length
    const premOnly = inCat.filter(p => p.config.isPremium && !p.config.isOwner).length
    const publicCmd = inCat.length - ownerOnly - premOnly

    let caption = `⭐ *ᴅᴇᴛᴀɪʟ ᴋᴀᴛᴇɢᴏʀɪ: ${catName.toUpperCase()}* ${theme.icon}\n\n`
    caption += `╭┈┈✦「 📂 *ʀɪɴɢᴋᴀsᴀɴ* 」\n`
    caption += `┃ ◦ Plugin           : *${inCat.length}*\n`
    caption += `┃ ◦ Callable Command : *${totalCallable}*\n`
    if (newest && newest.name) caption += `┃ ◦ Terbaru          : \`${newest.name}\`\n`
    if (biggest && biggest.name) caption += `┃ ◦ Terbesar         : \`${biggest.name}\` (${biggest.kb.toFixed(1)} KB)\n`
    caption += `┃ ◦ Owner            : *${ownerOnly}*\n`
    caption += `┃ ◦ Premium          : *${premOnly}*\n`
    caption += `┃ ◦ Public           : *${publicCmd}*\n`
    caption += `╰┈┈✦\n\n`
    caption += `╭┈┈✦「 📋 *ᴅᴀꜰᴛᴀʀ ᴘʟᴜɢɪɴ* 」\n`
    inCat.forEach(p => { caption += `┃ • \`${p.config.name}\`\n` })
    caption += `╰┈┈✦`
    return caption
}

// ─── Fitur 10: Search Plugin (teks) ──────────────────────────────────────────

function buildSearchCaption(query, allPlugins, theme) {
    const q = query.toLowerCase()
    const matches = allPlugins.filter(p => {
        if (!p.config) return false
        const nameMatch = (p.config.name || '').toLowerCase().includes(q)
        const aliasMatch = Array.isArray(p.config.alias) && p.config.alias.some(a => a.toLowerCase().includes(q))
        const catMatch = (p.config.category || '').toLowerCase().includes(q)
        const descMatch = (p.config.description || '').toLowerCase().includes(q)
        return nameMatch || aliasMatch || catMatch || descMatch
    })

    let caption = `⭐ *ʜᴀsɪʟ ᴘᴇɴᴄᴀʀɪᴀɴ: "${query}"* ${theme.icon}\n\n`
    if (!matches.length) {
        caption += `Tidak ditemukan plugin yang cocok.`
        return caption
    }
    caption += `╭┈┈✦「 🔍 *${matches.length} ᴘʟᴜɢɪɴ ᴅɪᴛᴇᴍᴜᴋᴀɴ* 」\n`
    matches.slice(0, 25).forEach(p => {
        const icon = CATEGORY_ICONS[p.config.category] || '📦'
        caption += `┃ ${icon} \`${p.config.name}\` _(${p.config.category || 'other'})_\n`
    })
    if (matches.length > 25) caption += `┃ ...dan ${matches.length - 25} lainnya\n`
    caption += `╰┈┈✦`
    return caption
}

// ─── Fitur 11: Dashboard Project ─────────────────────────────────────────────

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const mnt = Math.floor((seconds % 3600) / 60)
    const parts = []
    if (d) parts.push(`${d}h`)
    if (h) parts.push(`${h}j`)
    parts.push(`${mnt}m`)
    return parts.join(' ')
}

function buildProjectCaption(theme, totalPlugins, totalCommand, dbUsers, dbGroups) {
    const mem = process.memoryUsage()
    const uptime = process.uptime()

    let dbSizeStr = 'n/a'
    try {
        const dbPath = path.resolve(process.cwd(), 'database.json')
        if (fs.existsSync(dbPath)) dbSizeStr = formatBytes(fs.statSync(dbPath).size)
    } catch {}

    let cpuPct = 'n/a'
    try {
        const os = require('os')
        const load = os.loadavg()[0]
        const cores = os.cpus().length || 1
        cpuPct = `${Math.min(100, (load / cores) * 100).toFixed(0)}%`
    } catch {}

    let caption = `⭐ *ᴅᴀsʜʙᴏᴀʀᴅ ᴘʀᴏᴊᴇᴄᴛ* ${theme.icon}\n\n`
    caption += `╭┈┈✦「 🖥️ *sᴛᴀᴛᴜs ʙᴏᴛ* 」\n`
    caption += `┃ ◦ Plugin       : *${totalPlugins}*\n`
    caption += `┃ ◦ Command      : *${totalCommand}*\n`
    caption += `┃ ◦ Users        : *${dbUsers}*\n`
    caption += `┃ ◦ Groups       : *${dbGroups}*\n`
    caption += `┃ ◦ Database     : *${dbSizeStr}*\n`
    caption += `┃ ◦ Runtime      : *${formatUptime(uptime)}*\n`
    caption += `┃ ◦ Memory (RSS) : *${formatBytes(mem.rss)}*\n`
    caption += `┃ ◦ Heap Used    : *${formatBytes(mem.heapUsed)}*\n`
    caption += `┃ ◦ CPU (approx) : *${cpuPct}*\n`
    caption += `┃ ◦ Node.js      : *${process.version}*\n`
    caption += `╰┈┈✦`
    return caption
}

// ─── Fitur 12: Analisis Kualitas Plugin (teks) ───────────────────────────────

function buildQualityCaption(allPlugins, theme) {
    const total = allPlugins.length
    const enabled = allPlugins.filter(p => p.config && p.config.isEnabled !== false).length
    const disabled = total - enabled

    const withAlias = allPlugins.filter(p => Array.isArray(p.config?.alias) && p.config.alias.length > 0)
    const avgAlias = total ? (allPlugins.reduce((s, p) => s + (Array.isArray(p.config?.alias) ? p.config.alias.length : 0), 0) / total).toFixed(1) : '0'
    const noAlias = total - withAlias.length

    const ownerOnly = allPlugins.filter(p => p.config?.isOwner).length
    const premOnly = allPlugins.filter(p => p.config?.isPremium && !p.config?.isOwner).length

    const noCategory = allPlugins.filter(p => !p.config?.category).length
    const noDescription = allPlugins.filter(p => !p.config?.description).length
    const noExample = allPlugins.filter(p => !p.config?.example).length

    let caption = `⭐ *ᴀɴᴀʟɪsɪs ᴋᴜᴀʟɪᴛᴀs ᴘʟᴜɢɪɴ* ${theme.icon}\n\n`
    caption += `╭┈┈✦「 ✅ *ᴋᴜᴀʟɪᴛᴀs* 」\n`
    caption += `┃ ◦ Plugin aktif    : *${total ? ((enabled / total) * 100).toFixed(0) : 0}%*\n`
    caption += `┃ ◦ Plugin disable  : *${total ? ((disabled / total) * 100).toFixed(0) : 0}%*\n`
    caption += `┃ ◦ Rata-rata alias : *${avgAlias}*\n`
    caption += `┃ ◦ Tanpa alias     : *${noAlias}*\n`
    caption += `┃ ◦ Plugin owner    : *${ownerOnly}*\n`
    caption += `┃ ◦ Plugin premium  : *${premOnly}*\n`
    caption += `╰┈┈✦\n\n`

    const warnings = []
    if (noCategory > 0) warnings.push(`⚠ ${noCategory} plugin belum punya category`)
    if (noDescription > 0) warnings.push(`⚠ ${noDescription} plugin belum punya description`)
    if (noExample > 0) warnings.push(`⚠ ${noExample} plugin belum punya example`)

    if (warnings.length) {
        caption += `╭┈┈✦「 ⚠️ *ᴘᴇʀɪɴɢᴀᴛᴀɴ* 」\n`
        warnings.forEach(w => { caption += `┃ ${w}\n` })
        caption += `╰┈┈✦`
    } else {
        caption += `Semua plugin sudah lengkap metadata-nya.`
    }
    return caption
}

// ─── Fitur 14: Developer Insight (teks) ──────────────────────────────────────

function buildDevInsightCaption(theme, dependencyCounts) {
    const projectRoot = path.resolve(__dirname, '../../')
    let totalLines = 0, totalFolders = 0, totalFiles = 0
    const sizeList = []

    function walk(dir) {
        let entries = []
        try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
        for (const e of entries) {
            if (e.name === 'node_modules' || e.name === '.git' || e.name.startsWith('.')) continue
            const full = path.join(dir, e.name)
            if (e.isDirectory()) {
                totalFolders++
                walk(full)
            } else if (e.isFile() && e.name.endsWith('.js')) {
                totalFiles++
                try {
                    const content = fs.readFileSync(full, 'utf8')
                    totalLines += content.split('\n').length
                    sizeList.push({ name: e.name, kb: Buffer.byteLength(content) / 1024 })
                } catch {}
            }
        }
    }
    walk(projectRoot)

    sizeList.sort((a, b) => b.kb - a.kb)
    const biggest = sizeList[0]
    const smallest = sizeList[sizeList.length - 1]

    let caption = `⭐ *ᴅᴇᴠᴇʟᴏᴘᴇʀ ɪɴsɪɢʜᴛ* ${theme.icon}\n\n`
    caption += `╭┈┈✦「 🧩 *sᴛᴀᴛɪsᴛɪᴋ ᴘʀᴏᴊᴇᴄᴛ* 」\n`
    caption += `┃ ◦ Total Baris Kode : *${totalLines.toLocaleString('id-ID')}*\n`
    caption += `┃ ◦ Total Folder     : *${totalFolders}*\n`
    caption += `┃ ◦ Total File JS    : *${totalFiles}*\n`
    if (biggest) caption += `┃ ◦ Plugin Terbesar  : \`${biggest.name}\` (${biggest.kb.toFixed(1)} KB)\n`
    if (smallest) caption += `┃ ◦ Plugin Terkecil  : \`${smallest.name}\` (${smallest.kb.toFixed(1)} KB)\n`
    caption += `┃ ◦ Library Digunakan: *${Object.keys(dependencyCounts).length}*\n`
    caption += `╰┈┈✦`
    return caption
}

// ─── Header / stats untuk chart utama ────────────────────────────────────────

function drawHeader(ctx, W, totalCommands, enabledCommands, categoriesCount, theme) {
    ctx.save()
    roundRect(ctx, 50, 14, 340, 38, 10)
    const hbg = ctx.createLinearGradient(50, 14, 390, 52)
    hbg.addColorStop(0, `${theme.primary}22`)
    hbg.addColorStop(1, `${theme.secondary}18`)
    ctx.fillStyle = hbg
    ctx.fill()
    ctx.strokeStyle = `${theme.primary}55`
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()

    drawStar(ctx, 68, 34, 13, 5.5, theme.tertiary, 1, 22)

    ctx.save()
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'

    const titleGrad = ctx.createLinearGradient(88, 0, 380, 0)
    titleGrad.addColorStop(0, theme.primaryLight)
    titleGrad.addColorStop(0.5, theme.textPrimary)
    titleGrad.addColorStop(1, theme.secondaryLight)
    ctx.fillStyle = titleGrad
    ctx.font = 'bold 26px Arial'
    ctx.shadowColor = theme.primary
    ctx.shadowBlur = 22
    ctx.fillText('DISTRIBUSI FITUR', 88, 31)

    ctx.fillStyle = theme.textSecondary
    ctx.font = 'italic 10.5px Arial'
    ctx.shadowColor = theme.secondary
    ctx.shadowBlur = 8
    ctx.fillText(`${config.bot?.name || 'Ourin-AI'} - Command Statistics`, 88, 52)
    ctx.restore()

    const stats = [
        { label: 'TOTAL CMD',  value: totalCommands,    shape: 'star',    color: theme.primary },
        { label: 'AKTIF',      value: enabledCommands,  shape: 'sparkle', color: theme.green },
        { label: 'KATEGORI',   value: categoriesCount,  shape: 'ring',    color: theme.secondary },
    ]

    const bw = 116, bh = 56, bx0 = W - 378
    stats.forEach((s, i) => {
        const bx = bx0 + i * (bw + 10)
        const by = 12

        drawGlassCard(ctx, bx, by, bw, bh, 14, `${s.color}60`, 0.09)

        ctx.save()
        ctx.beginPath()
        ctx.arc(bx + 22, by + bh / 2, 12, 0, Math.PI * 2)
        const cg = ctx.createRadialGradient(bx+22, by+bh/2, 0, bx+22, by+bh/2, 12)
        cg.addColorStop(0, `${s.color}50`)
        cg.addColorStop(1, 'transparent')
        ctx.fillStyle = cg
        ctx.fill()
        ctx.restore()

        const iconCx = bx + 22, iconCy = by + bh / 2 - 4
        if (s.shape === 'star') {
            drawStar(ctx, iconCx, iconCy, 7, 3, s.color, 1, 10)
        } else if (s.shape === 'sparkle') {
            drawSparkle(ctx, iconCx, iconCy, 6.5, s.color, 1, 8)
        } else {
            ctx.save()
            ctx.beginPath()
            ctx.arc(iconCx, iconCy, 6, 0, Math.PI * 2)
            ctx.strokeStyle = s.color
            ctx.lineWidth = 2.5
            ctx.shadowColor = s.color
            ctx.shadowBlur = 8
            ctx.stroke()
            ctx.restore()
        }

        ctx.save()
        ctx.fillStyle = s.color
        ctx.font = 'bold 20px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.shadowColor = s.color
        ctx.shadowBlur = 18
        ctx.fillText(s.value.toString(), bx + bw / 2 + 8, by + bh / 2 - 4)
        ctx.shadowBlur = 0

        ctx.fillStyle = theme.textDim
        ctx.font = 'bold 8.5px Arial'
        ctx.fillText(s.label, bx + bw / 2 + 8, by + bh - 11)
        ctx.restore()
    })
}

function drawRadialRings(ctx, topCategories, totalCommands, cx, cy, baseR, theme) {
    const rings = topCategories.slice(0, 5)
    const maxVal = Math.max(...rings.map(([, d]) => d.total))
    const ringWidth = 15
    const gapWidth = 7

    ctx.save()
    const halo = ctx.createRadialGradient(cx, cy, baseR * 0.5, cx, cy, baseR + 50)
    halo.addColorStop(0, `${theme.primary}15`)
    halo.addColorStop(0.5, `${theme.secondary}0c`)
    halo.addColorStop(1, 'transparent')
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(cx, cy, baseR + 50, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    rings.forEach(([cat, data], i) => {
        const r = baseR - i * (ringWidth + gapWidth)
        const color = theme.colors[i % theme.colors.length]
        const pct = data.total / maxVal
        const startAngle = -Math.PI / 2
        const endAngle = startAngle + Math.max(pct, 0.02) * Math.PI * 2

        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.strokeStyle = `${theme.border}90`
        ctx.lineWidth = ringWidth
        ctx.stroke()
        ctx.restore()

        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, r, startAngle, endAngle)
        ctx.strokeStyle = color
        ctx.lineWidth = ringWidth
        ctx.lineCap = 'round'
        ctx.shadowColor = color
        ctx.shadowBlur = 16
        ctx.stroke()
        ctx.restore()

        const dotX = cx + r * Math.cos(endAngle)
        const dotY = cy + r * Math.sin(endAngle)
        drawGlowDot(ctx, dotX, dotY, 3, color, 0.9)

        const badgeX = cx + r * Math.cos(startAngle)
        const badgeY = cy + r * Math.sin(startAngle)
        ctx.save()
        ctx.beginPath()
        ctx.arc(badgeX, badgeY, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = theme.bg
        ctx.fill()
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.restore()
    })

    const holeR = baseR - rings.length * (ringWidth + gapWidth) - 4
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, holeR, 0, Math.PI * 2)
    const holeFill = ctx.createRadialGradient(cx, cy, 0, cx, cy, holeR)
    holeFill.addColorStop(0, hexToRgba(theme.bg, 1))
    holeFill.addColorStop(1, theme.bg)
    ctx.fillStyle = holeFill
    ctx.fill()
    ctx.strokeStyle = `${theme.borderBright}60`
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()

    drawStar(ctx, cx, cy - 26, 9, 4, theme.tertiary, 0.95, 16)

    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const numGrad = ctx.createLinearGradient(cx - 25, 0, cx + 25, 0)
    numGrad.addColorStop(0, theme.primaryLight)
    numGrad.addColorStop(1, theme.secondaryLight)
    ctx.fillStyle = numGrad
    ctx.font = 'bold 26px Arial'
    ctx.shadowColor = theme.primary
    ctx.shadowBlur = 24
    ctx.fillText(totalCommands.toString(), cx, cy + 6)
    ctx.shadowBlur = 0

    ctx.fillStyle = theme.textDim
    ctx.font = 'bold 8px Arial'
    ctx.fillText('COMMANDS', cx, cy + 24)
    ctx.restore()
}

function drawPodium(ctx, topCategories, totalCommands, x, y, w, theme) {
    const rings = topCategories.slice(0, 5)
    const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32', theme.textDim, theme.textDim]
    const rowH = 38
    const gap = 6

    ctx.save()
    ctx.fillStyle = theme.textSecondary
    ctx.font = 'bold 9px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = theme.primary
    ctx.shadowBlur = 6
    ctx.fillText('TOP 5 KATEGORI', x, y - 12)
    ctx.shadowBlur = 0
    ctx.restore()

    rings.forEach(([cat, data], i) => {
        const yy = y + i * (rowH + gap)
        const color = theme.colors[i % theme.colors.length]
        const pct = ((data.total / totalCommands) * 100).toFixed(1)

        drawGlassCard(ctx, x, yy, w, rowH, 10, `${color}55`, 0.07)

        const badgeCx = x + 18, badgeCy = yy + rowH / 2
        ctx.save()
        ctx.beginPath()
        ctx.arc(badgeCx, badgeCy, 10, 0, Math.PI * 2)
        ctx.fillStyle = rankColors[i]
        if (i < 3) { ctx.shadowColor = rankColors[i]; ctx.shadowBlur = 10 }
        ctx.fill()
        ctx.restore()

        ctx.save()
        ctx.fillStyle = i < 3 ? '#1a1020' : theme.bg
        ctx.font = 'bold 10px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText((i + 1).toString(), badgeCx, badgeCy)
        ctx.restore()

        drawGlowDot(ctx, x + 38, yy + rowH / 2, 3, color, 0.9)

        ctx.save()
        ctx.fillStyle = i < 3 ? theme.textPrimary : theme.textSecondary
        ctx.font = i < 3 ? 'bold 10.5px Arial' : '10px Arial'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        if (i < 3) { ctx.shadowColor = color; ctx.shadowBlur = 6 }
        ctx.fillText(cat.toUpperCase(), x + 48, yy + rowH / 2)
        ctx.restore()

        ctx.save()
        ctx.fillStyle = color
        ctx.font = 'bold 10.5px Arial'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.shadowColor = color
        ctx.shadowBlur = 8
        ctx.fillText(`${data.total} - ${pct}%`, x + w - 12, yy + rowH / 2)
        ctx.restore()
    })
}

function drawBars(ctx, topCategories, totalCommands, theme) {
    const bx0    = 460
    const by0    = 132
    const bw     = 380
    const bh     = 24
    const gap    = 47
    const maxVal = Math.max(...topCategories.map(([, d]) => d.total))

    ctx.save()
    ctx.fillStyle = theme.textSecondary
    ctx.font = 'bold 9.5px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = theme.primary
    ctx.shadowBlur = 6
    ctx.fillText('SEMUA KATEGORI', bx0, by0 - 16)
    ctx.shadowBlur = 0
    ctx.strokeStyle = `${theme.primary}60`
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(bx0, by0 - 6)
    ctx.lineTo(bx0 + 130, by0 - 6)
    ctx.stroke()
    ctx.restore()

    topCategories.forEach(([cat, data], i) => {
        const y = by0 + i * gap
        const color = theme.colors[i % theme.colors.length]
        const pct = ((data.total / totalCommands) * 100).toFixed(1)
        const fw = (data.total / maxVal) * bw

        if (i % 2 === 0) {
            roundRect(ctx, bx0 - 100, y - 3, bw + 150, bh + 6, 6)
            ctx.fillStyle = `rgba(255,255,255,0.018)`
            ctx.fill()
        }

        drawGlowDot(ctx, bx0 - 96, y + bh / 2, 2.5, color, 0.85)

        ctx.save()
        ctx.fillStyle = i < 3 ? theme.textPrimary : theme.textSecondary
        ctx.font = i < 3 ? 'bold 10.5px Arial' : '10.5px Arial'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        if (i < 3) { ctx.shadowColor = color; ctx.shadowBlur = 8 }
        ctx.fillText(cat.toUpperCase(), bx0 - 14, y + bh / 2)
        ctx.restore()

        roundRect(ctx, bx0, y, bw, bh, 7)
        ctx.fillStyle = `${theme.border}70`
        ctx.fill()
        ctx.strokeStyle = `${theme.border}40`
        ctx.lineWidth = 0.8
        ctx.stroke()

        if (fw > 5) {
            ctx.save()
            const bg = ctx.createLinearGradient(bx0, 0, bx0 + fw, 0)
            bg.addColorStop(0, theme.primary)
            bg.addColorStop(0.45, color)
            bg.addColorStop(1, `${color}55`)
            roundRect(ctx, bx0, y, fw, bh, 7)
            ctx.fillStyle = bg
            ctx.shadowColor = color
            ctx.shadowBlur = 14
            ctx.fill()
            ctx.restore()

            ctx.save()
            ctx.beginPath()
            ctx.moveTo(bx0 + 7, y + 2)
            ctx.lineTo(bx0 + fw - 7, y + 2)
            ctx.strokeStyle = 'rgba(255,255,255,0.18)'
            ctx.lineWidth = 1
            ctx.stroke()
            ctx.restore()

            if (fw > 34) {
                ctx.save()
                ctx.fillStyle = '#ffffffcc'
                ctx.font = 'bold 9.5px Arial'
                ctx.textAlign = 'left'
                ctx.textBaseline = 'middle'
                ctx.shadowColor = theme.primary
                ctx.shadowBlur = 4
                ctx.fillText(data.total.toString(), bx0 + 9, y + bh / 2)
                ctx.restore()
            }

            drawGlowDot(ctx, bx0 + fw, y + bh / 2, 2.5, color, 0.8)
        }

        ctx.save()
        const pctX = bx0 + bw + 10
        roundRect(ctx, pctX, y + 3, 40, bh - 6, 5)
        ctx.fillStyle = `${color}20`
        ctx.fill()
        ctx.strokeStyle = `${color}50`
        ctx.lineWidth = 0.7
        ctx.stroke()

        ctx.fillStyle = i < 3 ? color : theme.textSecondary
        ctx.font = 'bold 9.5px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${pct}%`, pctX + 20, y + bh / 2)
        ctx.restore()
    })
}

function drawTopBadge(ctx, biggestCat, totalCommands, x, y, w, theme) {
    const [cat, data] = biggestCat
    const pct = ((data.total / totalCommands) * 100).toFixed(1)
    const h = 54

    drawGlassCard(ctx, x, y, w, h, 14, `${theme.tertiary}60`, 0.1)

    ctx.save()
    ctx.beginPath()
    ctx.arc(x + 32, y + h / 2, 16, 0, Math.PI * 2)
    const cg = ctx.createRadialGradient(x+32, y+h/2, 0, x+32, y+h/2, 16)
    cg.addColorStop(0, `${theme.tertiary}50`)
    cg.addColorStop(1, 'transparent')
    ctx.fillStyle = cg
    ctx.fill()
    ctx.restore()

    drawStar(ctx, x + 32, y + h / 2, 12, 5, theme.tertiary, 1, 14)

    ctx.save()
    ctx.fillStyle = theme.textDim
    ctx.font = 'bold 8px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('KATEGORI TERPOPULER', x + 58, y + 16)

    ctx.fillStyle = theme.textPrimary
    ctx.font = 'bold 13px Arial'
    ctx.shadowColor = theme.tertiary
    ctx.shadowBlur = 8
    ctx.fillText(cat.toUpperCase(), x + 58, y + 33)
    ctx.shadowBlur = 0

    ctx.fillStyle = theme.tertiary
    ctx.font = 'bold 11px Arial'
    ctx.textAlign = 'right'
    ctx.fillText(`${data.total} cmd - ${pct}%`, x + w - 16, y + 33)
    ctx.restore()
}

async function createPremiumChart(categories, totalCommands, enabledCommands, theme) {
    const sorted = Object.entries(categories).sort((a, b) => b[1].total - a[1].total)
    const topCategories = sorted.slice(0, 10)

    const W = 900
    const H = 760
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')

    const bgImg = await loadImageFromUrls(BG_URLS)

    drawBackground(ctx, W, H, theme)
    drawBgPhoto(ctx, bgImg, W, H, theme)
    drawStarField(ctx, W, H, theme)
    drawHeader(ctx, W, totalCommands, enabledCommands, sorted.length, theme)
    drawSeparator(ctx, W, 92, theme)

    drawRadialRings(ctx, topCategories, totalCommands, 200, 260, 130, theme)
    drawPodium(ctx, topCategories, totalCommands, 55, 430, 290, theme)
    drawBars(ctx, topCategories, totalCommands, theme)
    drawTopBadge(ctx, sorted[0], totalCommands, 460, 132 + topCategories.length * 47 + 12, 380, theme)

    drawSeparator(ctx, W, 660, theme)
    drawFooter(ctx, W, H, `${totalCommands} TOTAL COMMANDS AVAILABLE`, theme)

    return canvas.toBuffer('image/png')
}

// ─── Caption utama (chart default) ───────────────────────────────────────────

function buildCaption(allPlugins, categories, totalPlugins, totalCommands, enabledCommands, dbUsers, dbGroups, theme, growthCaption) {
    const sorted = Object.entries(categories).sort((a, b) => b[1].total - a[1].total)
    const disabledCommands = totalPlugins - enabledCommands

    const biggestCat  = sorted[0]
    const smallestCat = sorted[sorted.length - 1]

    const totalCallable = allPlugins.reduce((sum, p) => {
        if (!p.config) return sum
        const aliases = Array.isArray(p.config.alias) ? p.config.alias.length : 0
        return sum + 1 + aliases
    }, 0)

    const avgAlias = (totalCallable / totalPlugins).toFixed(1)

    const topAliasPlugins = allPlugins
        .filter(p => p.config?.name)
        .map(p => ({
            name: p.config.name,
            count: Array.isArray(p.config.alias) ? p.config.alias.length : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)

    const ownerOnly  = allPlugins.filter(p => p.config?.isOwner).length
    const premOnly   = allPlugins.filter(p => p.config?.isPremium && !p.config?.isOwner).length
    const publicCmd  = totalPlugins - ownerOnly - premOnly

    let caption = `⭐ *ᴅɪsᴛʀɪʙᴜsɪ ꜰɪᴛᴜʀ ʙᴏᴛ* ${theme.icon}\n\n`

    if (growthCaption) caption += growthCaption

    caption +=
        `╭┈┈✦「 📦 *ᴘʟᴜɢɪɴ* 」\n` +
        `┃ ◦ Total Plugin    : *${totalPlugins}*\n` +
        `┃ ◦ Aktif           : *${enabledCommands}*\n` +
        (disabledCommands > 0
            ? `┃ ◦ Nonaktif        : *${disabledCommands}*\n`
            : '') +
        `╰┈┈✦\n\n`

    caption +=
        `╭┈┈✦「 ⌨️ *ᴄᴏᴍᴍᴀɴᴅs* 」\n` +
        `┃ ◦ Total Callable  : *${totalCallable}*\n` +
        `┃ ◦ Rata-rata Alias : *${avgAlias}* per plugin\n` +
        `╰┈┈✦\n\n`

    caption += `╭┈┈✦「 🏆 *ᴛᴏᴘ ᴀʟɪᴀs* 」\n`
    topAliasPlugins.forEach((p, i) => {
        const medal = ['🥇', '🥈', '🥉'][i]
        caption += `┃ ${medal} \`${p.name}\` — *${p.count}* alias\n`
    })
    caption += `╰┈┈✦\n\n`

    caption +=
        `╭┈┈✦「 🔐 *ᴀᴋsᴇs* 」\n` +
        `┃ ◦ Public          : *${publicCmd}*\n` +
        `┃ ◦ Premium         : *${premOnly}*\n` +
        `┃ ◦ Owner Only      : *${ownerOnly}*\n` +
        `╰┈┈✦\n\n`

    caption +=
        `╭┈┈✦「 📂 *ᴋᴀᴛᴇɢᴏʀɪ* 」\n` +
        `┃ ◦ Total           : *${sorted.length}*\n` +
        `┃ ◦ Terbesar        : *${biggestCat[0]}* (${biggestCat[1].total} plugin)\n` +
        `┃ ◦ Terkecil        : *${smallestCat[0]}* (${smallestCat[1].total} plugin)\n` +
        `╰┈┈✦\n\n`

    caption +=
        `╭┈┈✦「 🗄️ *ᴅᴀᴛᴀʙᴀsᴇ* 」\n` +
        `┃ ◦ Total Users     : *${dbUsers}*\n` +
        `┃ ◦ Total Groups    : *${dbGroups}*\n` +
        `╰┈┈✦\n\n`

    caption += `╭┈┈✦「 📋 *sᴇᴍᴜᴀ ᴋᴀᴛᴇɢᴏʀɪ* 」\n`
    sorted.forEach(([cat, data]) => {
        const pct  = ((data.total / totalPlugins) * 100).toFixed(1)
        const icon = CATEGORY_ICONS[cat] || '📦'
        caption += `┃ ${icon} \`${cat.toUpperCase()}\`: *${data.total}* _(${pct}%)_\n`
    })
    caption += `╰┈┈✦\n\n`

    caption += `> ★ *${totalCallable}* callable commands dari *${totalPlugins}* plugin\n`
    caption += `> Ketik \`.totalfitur\` tanpa argumen untuk lihat menu subcommand lengkap (grafik, heatmap, achievement, dll)`

    return caption
}

function buildHelpCaption(theme) {
    let caption = `⭐ *ᴍᴇɴᴜ .ᴛᴏᴛᴀʟꜰɪᴛᴜʀ* ${theme.icon}\n\n`
    caption += `╭┈┈✦「 🧭 *sᴜʙᴄᴏᴍᴍᴀɴᴅ* 」\n`
    caption += `┃ • \`.totalfitur\` — chart utama\n`
    caption += `┃ • \`.totalfitur riwayat\` — riwayat pertumbuhan harian\n`
    caption += `┃ • \`.totalfitur grafik [7|30]\` — grafik pertumbuhan\n`
    caption += `┃ • \`.totalfitur heatmap\` — heatmap kategori\n`
    caption += `┃ • \`.totalfitur achievement\` — milestone & achievement\n`
    caption += `┃ • \`.totalfitur baru [n]\` — plugin terbaru\n`
    caption += `┃ • \`.totalfitur terbesar [n]\` — plugin terbesar\n`
    caption += `┃ • \`.totalfitur dependency\` — library terbanyak dipakai\n`
    caption += `┃ • \`.totalfitur complexity\` — skor kompleksitas per kategori\n`
    caption += `┃ • \`.totalfitur search <kata kunci>\` — cari plugin\n`
    caption += `┃ • \`.totalfitur <kategori>\` — detail kategori\n`
    caption += `┃ • \`.totalfitur project\` — dashboard project (RAM, uptime, dll)\n`
    caption += `┃ • \`.totalfitur quality\` — analisis kualitas metadata plugin\n`
    caption += `┃ • \`.totalfitur dev\` — developer insight (LOC, folder, dll)\n`
    caption += `┃ • \`.totalfitur tema <nama>\` — pakai tema chart manual (${Object.keys(MANUAL_THEMES).join(', ')})\n`
    caption += `╰┈┈✦`
    return caption
}

// ─── Handler ──────────────────────────────────────────────────────────────────

async function handler(m, { sock, args }) {
    try {
        const allPlugins = getAllPlugins()

        const categories = {}
        let totalPlugins = 0
        let enabledCommands = 0

        for (const plugin of allPlugins) {
            if (!plugin.config) continue
            const cat = plugin.config.category || 'other'
            if (!categories[cat]) categories[cat] = { total: 0, enabled: 0 }
            categories[cat].total++
            totalPlugins++
            if (plugin.config.isEnabled !== false) {
                categories[cat].enabled++
                enabledCommands++
            }
        }

        const totalCallable = allPlugins.reduce((sum, p) => {
            if (!p.config) return sum
            const aliases = Array.isArray(p.config.alias) ? p.config.alias.length : 0
            return sum + 1 + aliases
        }, 0)

        let dbUsers = 0, dbGroups = 0
        try {
            const db = require('../../src/lib/database').getDatabase()
            if (db && db.data) {
                dbUsers  = Object.keys(db.data.users  || {}).length
                dbGroups = Object.keys(db.data.groups || {}).length
            }
        } catch {}

        // simpan snapshot harian setiap kali dijalankan (fitur 1)
        const { history, todayEntry } = await saveSnapshotAndGetHistory({
            plugin: totalPlugins,
            command: totalCallable,
            alias: totalCallable - totalPlugins,
            category: Object.keys(categories).length
        })

        const raw = (args || []).join(' ').trim()
        const [sub, ...rest] = raw.split(/\s+/).filter(Boolean)
        const subLower = (sub || '').toLowerCase()

        // deteksi override tema manual: `... tema <nama>`
        let manualTheme = null
        const temaIdx = raw.toLowerCase().indexOf('tema ')
        if (temaIdx !== -1) manualTheme = raw.toLowerCase().slice(temaIdx + 5).trim().split(/\s+/)[0]
        const theme = resolveTheme(manualTheme)

        await m.react('⭐')

        // ── Routing subcommand ──
        if (!sub || subLower === 'help' || subLower === 'menu') {
            if (!sub) {
                // default: chart utama
                const chartBuffer = await createPremiumChart(categories, totalCallable, enabledCommands, theme)
                const growthCaption = buildGrowthCaption(history, todayEntry)
                const caption = buildCaption(allPlugins, categories, totalPlugins, totalCallable, enabledCommands, dbUsers, dbGroups, theme, growthCaption)
                await sock.sendMessage(m.chat, {
                    image: chartBuffer,
                    caption,
                    contextInfo: { forwardingScore: 99, isForwarded: true }
                }, { quoted: m })
                return
            }
            await m.reply(buildHelpCaption(theme))
            return
        }

        if (subLower === 'riwayat' || subLower === 'history') {
            await handleRiwayat(m, sock, theme, history)
            return
        }

        if (subLower === 'grafik' || subLower === 'growth' || subLower === 'chart') {
            const days = parseInt(rest[0], 10) === 30 ? 30 : 7
            const buffer = await createGrowthChart(history, days, theme)
            await sock.sendMessage(m.chat, { image: buffer, caption: `Grafik pertumbuhan ${days} hari terakhir.` }, { quoted: m })
            return
        }

        if (subLower === 'heatmap') {
            const buffer = await createHeatmapChart(categories, totalCallable, theme)
            await sock.sendMessage(m.chat, { image: buffer, caption: 'Heatmap distribusi kategori.' }, { quoted: m })
            return
        }

        if (subLower === 'achievement' || subLower === 'milestone') {
            await m.reply(buildAchievementCaption(todayEntry, theme))
            return
        }

        if (subLower === 'baru' || subLower === 'newest' || subLower === 'terbaru') {
            const n = Math.min(20, Math.max(1, parseInt(rest[0], 10) || 5))
            await m.reply(buildNewestCaption(n, theme))
            return
        }

        if (subLower === 'terbesar' || subLower === 'biggest') {
            const n = Math.min(20, Math.max(1, parseInt(rest[0], 10) || 5))
            await m.reply(buildBiggestCaption(n, theme))
            return
        }

        if (subLower === 'dependency' || subLower === 'dependencies' || subLower === 'library') {
            await m.reply(buildDependencyCaption(theme))
            return
        }

        if (subLower === 'complexity' || subLower === 'kompleksitas') {
            await m.reply(buildComplexityCaption(theme, rest[0] ? rest[0].toLowerCase() : null))
            return
        }

        if (subLower === 'search' || subLower === 'cari') {
            const query = rest.join(' ').trim()
            if (!query) { await m.reply('Gunakan format: `.totalfitur search <kata kunci>`'); return }
            await m.reply(buildSearchCaption(query, allPlugins, theme))
            return
        }

        if (subLower === 'project' || subLower === 'dashboard') {
            await m.reply(buildProjectCaption(theme, totalPlugins, totalCallable, dbUsers, dbGroups))
            return
        }

        if (subLower === 'quality' || subLower === 'kualitas') {
            await m.reply(buildQualityCaption(allPlugins, theme))
            return
        }

        if (subLower === 'dev' || subLower === 'developer') {
            const depCounts = {}
            walkJsFiles(getPluginRootDir()).forEach(f => {
                let content = ''
                try { content = fs.readFileSync(f, 'utf8') } catch { return }
                const re = /require\(\s*['"]([^'"]+)['"]\s*\)/g
                let mm
                while ((mm = re.exec(content)) !== null) {
                    let mod = mm[1]
                    if (mod.startsWith('.') || mod.startsWith('/')) continue
                    mod = mod.split('/')[0]
                    depCounts[mod] = (depCounts[mod] || 0) + 1
                }
            })
            await m.reply(buildDevInsightCaption(theme, depCounts))
            return
        }

        if (subLower === 'tema' || subLower === 'theme') {
            if (!manualTheme || !MANUAL_THEMES[manualTheme]) {
                await m.reply(`Tema tidak dikenal. Pilihan: ${Object.keys(MANUAL_THEMES).join(', ')}\nContoh: \`.totalfitur tema galaxy\``)
                return
            }
            const chartBuffer = await createPremiumChart(categories, totalCallable, enabledCommands, theme)
            await sock.sendMessage(m.chat, { image: chartBuffer, caption: `Chart dengan tema *${manualTheme.toUpperCase()}*.` }, { quoted: m })
            return
        }

        // fallback: cek apakah argumen adalah nama kategori (fitur 9)
        const catDetail = buildCategoryDetailCaption(subLower, allPlugins, theme)
        if (catDetail) {
            await m.reply(catDetail)
            return
        }

        await m.reply(`Subcommand \`${sub}\` tidak dikenal dan bukan nama kategori yang valid.\n\n${buildHelpCaption(theme)}`)

    } catch (error) {
        await m.react('❌')
        await m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
