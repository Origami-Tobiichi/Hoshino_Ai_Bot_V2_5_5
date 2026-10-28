const { createCanvas, loadImage } = require('@napi-rs/canvas')
const os = require('os')
const { execSync } = require('child_process')
const config = require('../../config')
const { getDatabase } = require('../../src/lib/database')

// ─── Oshi no Ko Theme ────────────────────────────────────────────────────────
const THEME = {
    bg0:          '#04010d',
    bg1:          '#0b0320',
    bg2:          '#130630',
    card:         '#0f0525',
    cardBorder:   '#2a0e5c',
    primary:      '#ff2d8f',   // idol pink
    primaryDim:   '#7a1045',
    secondary:    '#c44dff',   // violet
    secondaryDim: '#5c1c80',
    gold:         '#ffe566',   // star gold
    goldDim:      '#7a6400',
    cyan:         '#5eeeff',
    success:      '#3dffa0',
    warning:      '#ffb347',
    danger:       '#ff4466',
    textPrimary:  '#fff0fb',
    textSub:      '#c9aee0',
    textMuted:    '#6b4a8a',
    gridLine:     '#1e0a3a',
}

// ─── History Tracker (module-level singleton) ─────────────────────────────────
const HISTORY_MAX    = 24    // 24 samples = 2 minutes at 10s interval
const SAMPLE_INTERVAL = 10000 // 10 seconds

const cpuHistory  = []
const ramHistory  = []
let   trackerStarted = false

let prevCpu = null

function snapCpu() {
    return os.cpus().reduce((a, c) => {
        const tot = Object.values(c.times).reduce((x, y) => x + y, 0)
        return { total: a.total + tot, idle: a.idle + c.times.idle }
    }, { total: 0, idle: 0 })
}

function getCpuPercent() {
    const cur = snapCpu()
    const fallback = Math.min(100, os.loadavg()[0] / os.cpus().length * 100)
    if (!prevCpu) { prevCpu = cur; return fallback }
    const dt = cur.total - prevCpu.total
    const di = cur.idle - prevCpu.idle
    prevCpu = cur
    return dt > 0 ? Math.max(0, Math.min(100, (dt - di) / dt * 100)) : fallback
}

function getRamPercent() {
    return (os.totalmem() - os.freemem()) / os.totalmem() * 100
}

function startTracker() {
    if (trackerStarted) return
    trackerStarted = true

    const c = getCpuPercent(), r = getRamPercent()
    for (let i = 0; i < HISTORY_MAX; i++) { cpuHistory.push(c); ramHistory.push(r) }

    setInterval(() => {
        cpuHistory.push(getCpuPercent())
        ramHistory.push(getRamPercent())
        if (cpuHistory.length > HISTORY_MAX) cpuHistory.shift()
        if (ramHistory.length > HISTORY_MAX) ramHistory.shift()
    }, SAMPLE_INTERVAL).unref?.()
}

// ─── Plugin Config ────────────────────────────────────────────────────────────
const pluginConfig = {
    name: 'ping',
    alias: ['speed', 'p', 'latency', 'sys', 'status'],
    category: 'main',
    description: 'Cek kecepatan respon bot dengan dashboard Oshi no Ko',
    usage: '.ping',
    example: '.ping',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

// ─── Utilities ────────────────────────────────────────────────────────────────
const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B'
    const s = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + s[i]
}

const formatTime = (seconds) => {
    seconds = Number(seconds)
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    if (d > 0) return `${d}d ${h}h ${m}m`
    if (h > 0) return `${h}h ${m}m ${s}s`
    return `${m}m ${s}s`
}

const pingLevel = (ms) =>
    ms < 400  ? { label: 'EXCELLENT', status: 'Online', emoji: '🟢 Excellent', color: THEME.success } :
    ms < 900  ? { label: 'GOOD',      status: 'Stable', emoji: '🟡 Good',      color: THEME.warning } :
                { label: 'SLOW',      status: 'Lag',    emoji: '🔴 Poor',      color: THEME.danger }

// ─── Canvas Helpers ───────────────────────────────────────────────────────────
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

function drawStar(ctx, cx, cy, outerR, innerR, color, alpha = 1, glow = 0) {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    if (glow > 0) { ctx.shadowColor = color; ctx.shadowBlur = glow }
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2
        const r = i % 2 === 0 ? outerR : innerR
        i === 0
            ? ctx.moveTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
            : ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
    }
    ctx.closePath(); ctx.fill()
    ctx.restore()
}

/** Glassmorphism card */
function drawCard(ctx, x, y, w, h, accent, radius = 14) {
    ctx.save()
    roundRect(ctx, x, y, w, h, radius)
    const g = ctx.createLinearGradient(x, y, x + w, y + h)
    g.addColorStop(0, `${accent}22`)
    g.addColorStop(1, `${accent}08`)
    ctx.fillStyle = g; ctx.fill()
    ctx.strokeStyle = `${accent}44`; ctx.lineWidth = 1; ctx.stroke()

    // top-left corner accent bar
    ctx.beginPath()
    ctx.moveTo(x + 2, y + 18); ctx.lineTo(x + 2, y + 4)
    ctx.quadraticCurveTo(x + 2, y + 2, x + 4, y + 2)
    ctx.lineTo(x + 32, y + 2)
    ctx.strokeStyle = accent; ctx.lineWidth = 2
    ctx.shadowColor = accent; ctx.shadowBlur = 10
    ctx.stroke()
    ctx.restore()
}

function drawCardTitle(ctx, x, y, text, color) {
    ctx.save()
    ctx.fillStyle = color
    ctx.font = 'bold 11px Arial'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.shadowColor = color; ctx.shadowBlur = 10
    ctx.fillText(text, x, y)
    ctx.restore()
}

function drawRow(ctx, x, y, label, value, valColor, rowW = 220) {
    ctx.save()
    ctx.fillStyle = THEME.textMuted; ctx.font = '10px Arial'
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(label, x, y)
    ctx.fillStyle = valColor || THEME.textPrimary; ctx.font = 'bold 10px Arial'
    ctx.textAlign = 'right'
    let v = String(value)
    if (ctx.measureText(v).width > rowW * 0.52) v = v.substring(0, 18) + '..'
    ctx.fillText(v, x + rowW, y)
    ctx.restore()
}

/** Glow arc gauge */
function drawGauge(ctx, cx, cy, R, pct, color, label, valText, iconText) {
    ctx.save()

    // outer soft halo
    const halo = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R + 16)
    halo.addColorStop(0, `${color}00`)
    halo.addColorStop(1, `${color}15`)
    ctx.fillStyle = halo
    ctx.beginPath(); ctx.arc(cx, cy, R + 16, 0, Math.PI * 2); ctx.fill()

    // track ring
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.strokeStyle = `${THEME.cardBorder}cc`; ctx.lineWidth = 8; ctx.stroke()

    // progress arc
    const sa = -Math.PI / 2
    const ea = sa + (Math.PI * 2 * Math.min(pct, 100) / 100)
    ctx.beginPath(); ctx.arc(cx, cy, R, sa, ea)
    ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.lineCap = 'round'
    ctx.shadowColor = color; ctx.shadowBlur = 24; ctx.stroke()
    ctx.shadowBlur = 0

    // inner fill pulse
    ctx.beginPath(); ctx.arc(cx, cy, R - 10, 0, Math.PI * 2)
    ctx.fillStyle = `${color}0d`; ctx.fill()

    // icon
    ctx.fillStyle = color; ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.shadowColor = color; ctx.shadowBlur = 12
    ctx.fillText(iconText, cx, cy - 11)
    ctx.shadowBlur = 0

    // value
    ctx.fillStyle = THEME.textPrimary; ctx.font = 'bold 12px Arial'
    ctx.fillText(valText, cx, cy + 10)

    // label
    ctx.fillStyle = THEME.textSub; ctx.font = '9px Arial'
    ctx.fillText(label, cx, cy + R + 18)
    ctx.restore()
}

/** Mini bar */
function drawBar(ctx, x, y, w, h, pct, color) {
    roundRect(ctx, x, y, w, h, h / 2)
    ctx.fillStyle = `${THEME.cardBorder}bb`; ctx.fill()
    if (pct > 0) {
        const fw = Math.max(h, w * Math.min(pct, 100) / 100)
        ctx.save()
        roundRect(ctx, x, y, fw, h, h / 2)
        ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.fill()
        ctx.restore()
    }
}

// ─── Line Chart ───────────────────────────────────────────────────────────────
/**
 * Draw a smooth line chart inside a card
 * data: number[] (0-100), color: hex, label: string
 */
function drawLineChart(ctx, x, y, w, h, data, color, label, unit = '%') {
    if (!data || data.length < 2) return

    const padL = 28, padR = 12, padT = 20, padB = 22
    const chartX = x + padL
    const chartY = y + padT
    const chartW = w - padL - padR
    const chartH = h - padT - padB

    ctx.save()

    // clip to chart area so curves don't bleed outside
    ctx.beginPath()
    ctx.rect(x, y, w, h)
    ctx.clip()

    // grid lines (horizontal)
    ctx.strokeStyle = THEME.gridLine; ctx.lineWidth = 0.6
    for (let i = 0; i <= 4; i++) {
        const gy = chartY + (chartH / 4) * i
        ctx.beginPath(); ctx.moveTo(chartX, gy); ctx.lineTo(chartX + chartW, gy); ctx.stroke()
    }

    // Y axis labels
    ctx.fillStyle = THEME.textMuted; ctx.font = '8px Arial'; ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let i = 0; i <= 4; i++) {
        const val = 100 - (100 / 4) * i
        const gy = chartY + (chartH / 4) * i
        ctx.fillText(`${val.toFixed(0)}`, chartX - 3, gy)
    }

    // X axis labels (time ticks)
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    const tickCount = Math.min(5, data.length)
    for (let i = 0; i < tickCount; i++) {
        const idx  = Math.round((data.length - 1) * i / (tickCount - 1))
        const gx   = chartX + (chartW / (data.length - 1)) * idx
        const secs = (data.length - 1 - idx) * (SAMPLE_INTERVAL / 1000)
        const lbl  = secs === 0 ? 'now' : `-${secs}s`
        ctx.fillText(lbl, gx, chartY + chartH + 4)
    }

    // build point coords
    const pts = data.map((v, i) => ({
        px: chartX + (chartW / (data.length - 1)) * i,
        py: chartY + chartH - (Math.min(v, 100) / 100) * chartH
    }))

    // gradient fill under curve
    const fillGrad = ctx.createLinearGradient(0, chartY, 0, chartY + chartH)
    fillGrad.addColorStop(0, `${color}55`)
    fillGrad.addColorStop(1, `${color}00`)

    ctx.beginPath()
    ctx.moveTo(pts[0].px, chartY + chartH)
    ctx.lineTo(pts[0].px, pts[0].py)
    for (let i = 1; i < pts.length; i++) {
        const cp1x = (pts[i - 1].px + pts[i].px) / 2
        ctx.bezierCurveTo(cp1x, pts[i - 1].py, cp1x, pts[i].py, pts[i].px, pts[i].py)
    }
    ctx.lineTo(pts[pts.length - 1].px, chartY + chartH)
    ctx.closePath()
    ctx.fillStyle = fillGrad; ctx.fill()

    // stroke curve
    ctx.beginPath()
    ctx.moveTo(pts[0].px, pts[0].py)
    for (let i = 1; i < pts.length; i++) {
        const cp1x = (pts[i - 1].px + pts[i].px) / 2
        ctx.bezierCurveTo(cp1x, pts[i - 1].py, cp1x, pts[i].py, pts[i].px, pts[i].py)
    }
    ctx.strokeStyle = color; ctx.lineWidth = 2
    ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.stroke()
    ctx.shadowBlur = 0

    // current value dot (last point)
    const last = pts[pts.length - 1]
    ctx.beginPath(); ctx.arc(last.px, last.py, 4, 0, Math.PI * 2)
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 16; ctx.fill()
    ctx.shadowBlur = 0

    // label + current value top-left
    ctx.fillStyle = color; ctx.font = 'bold 10px Arial'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.shadowColor = color; ctx.shadowBlur = 8
    ctx.fillText(`${label}  ${data[data.length - 1].toFixed(1)}${unit}`, x + padL, y + 4)
    ctx.shadowBlur = 0

    ctx.restore()
}

// ─── Decorative Stars ────────────────────────────────────────────────────────
function drawStarField(ctx, W, H) {
    const stars = [
        [38, 28, 9, 0.95, THEME.gold],
        [W - 38, 28, 7, 0.85, THEME.primary],
        [W / 2 - 6, 14, 5, 0.7, THEME.secondary],
        [65, H - 28, 7, 0.8, THEME.primary],
        [W - 65, H - 28, 9, 0.9, THEME.gold],
        [W - 18, H / 2, 4, 0.5, THEME.secondary],
        [14, H / 2, 5, 0.55, THEME.gold],
        [W * 0.72, 16, 4, 0.6, THEME.primary],
        [W * 0.28, H - 16, 4, 0.65, THEME.secondary],
    ]
    stars.forEach(([cx, cy, r, a, c]) => drawStar(ctx, cx, cy, r, r * 0.42, c, a, r * 3))

    // tiny sparkle dots
    ctx.save()
    const dots = [[190, 10, 2], [W - 190, 10, 1.5], [95, H - 11, 1.5], [W - 95, H - 11, 2], [W / 2, H - 8, 1.5]]
    dots.forEach(([x, y, r]) => {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fillStyle = THEME.textPrimary; ctx.globalAlpha = 0.3
        ctx.shadowColor = THEME.primary; ctx.shadowBlur = 8; ctx.fill()
    })
    ctx.restore()
}

// ─── Main Render ──────────────────────────────────────────────────────────────
async function renderDashboard(stats, cpuHist, ramHist) {
    const W = 940, H = 700
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')

    // ── Background ────────────────────────────────────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, W, H)
    bgGrad.addColorStop(0,    '#04010d')
    bgGrad.addColorStop(0.4,  '#0c0324')
    bgGrad.addColorStop(0.75, '#100428')
    bgGrad.addColorStop(1,    '#04010d')
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H)

    // spotlight glows
    ;[
        [W * 0.82, H * 0.12, 460, THEME.secondary, '1e'],
        [W * 0.12, H * 0.88, 400, THEME.primary,   '16'],
        [W * 0.5,  H * 0.5,  300, THEME.gold,       '08'],
    ].forEach(([gx, gy, gr, gc, ga]) => {
        const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr)
        glow.addColorStop(0, `${gc}${ga}`)
        glow.addColorStop(1, 'transparent')
        ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
    })

    // scanlines
    ctx.globalAlpha = 0.018; ctx.strokeStyle = THEME.primary; ctx.lineWidth = 0.5
    for (let i = 0; i < H; i += 24) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke()
    }
    ctx.globalAlpha = 1

    drawStarField(ctx, W, H)

    // ── Header ────────────────────────────────────────────────────────────────
    drawStar(ctx, 30, 42, 15, 6, THEME.gold, 1, 24)

    ctx.font = 'bold 26px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillStyle = THEME.textPrimary; ctx.shadowColor = THEME.primary; ctx.shadowBlur = 20
    ctx.fillText('SYSTEM DASHBOARD', 56, 38); ctx.shadowBlur = 0

    ctx.font = 'italic 11px Arial'; ctx.fillStyle = THEME.textSub
    ctx.shadowColor = THEME.secondary; ctx.shadowBlur = 6
    ctx.fillText(`* ${config.bot?.name || 'Ourin-AI'} — Real-time Monitor *`, 56, 60)
    ctx.shadowBlur = 0

    // ping badge
    const lvl = pingLevel(stats.ping)
const pingColor = lvl.color
const pingLabel = lvl.label
    ctx.save()
    roundRect(ctx, W - 152, 14, 128, 58, 14)
    ctx.fillStyle = `${pingColor}22`; ctx.fill()
    ctx.strokeStyle = `${pingColor}66`; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.fillStyle = pingColor; ctx.font = 'bold 24px Arial'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.shadowColor = pingColor; ctx.shadowBlur = 16
    ctx.fillText(`${stats.ping}ms`, W - 88, 35); ctx.shadowBlur = 0
    ctx.fillStyle = THEME.textSub; ctx.font = '9px Arial'
    ctx.fillText(pingLabel, W - 88, 57)
    ctx.restore()

    // separator
    const sep = ctx.createLinearGradient(28, 80, W - 28, 80)
    sep.addColorStop(0, 'transparent'); sep.addColorStop(0.25, THEME.primary)
    sep.addColorStop(0.5, THEME.gold);  sep.addColorStop(0.75, THEME.secondary)
    sep.addColorStop(1, 'transparent')
    ctx.strokeStyle = sep; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(28, 82); ctx.lineTo(W - 28, 82); ctx.stroke()
    drawStar(ctx, W / 2, 82, 7, 3, THEME.gold, 1, 14)

    // ── Gauges ────────────────────────────────────────────────────────────────
    const gaugeY = 158
    const ramPct  = (stats.ramUsed / stats.ramTotal) * 100
    const diskPct = stats.diskTotal > 0 ? (stats.diskUsed / stats.diskTotal) * 100 : 0

    drawGauge(ctx,  88, gaugeY, 46, parseFloat(stats.cpuLoad), THEME.primary,   'CPU LOAD', `${stats.cpuLoad}%`,          'CPU')
    drawGauge(ctx, 216, gaugeY, 46, ramPct,                    THEME.success,   'MEMORY',   `${ramPct.toFixed(0)}%`,       'RAM')
    drawGauge(ctx, 344, gaugeY, 46, diskPct,                   THEME.secondary, 'STORAGE',  `${diskPct.toFixed(0)}%`,      'DISK')

    // ── Network + Uptime mini cards ───────────────────────────────────────────
    drawCard(ctx, 410, 100, 234, 120, THEME.primary)
    drawCardTitle(ctx, 426, 114, '[ NETWORK ]', THEME.primary)
    ctx.fillStyle = THEME.primary;    ctx.font = 'bold 14px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillText(`DL  ${formatSize(stats.networkRx)}`, 426, 138)
    ctx.fillStyle = THEME.secondary
    ctx.fillText(`UL  ${formatSize(stats.networkTx)}`, 426, 158)
    drawRow(ctx, 426, 192, 'Interface', stats.networkInterface, THEME.textSub, 204)
    drawRow(ctx, 426, 208, 'Status', lvl.status, pingColor, 204)

    drawCard(ctx, 660, 100, 252, 120, THEME.success)
    drawCardTitle(ctx, 676, 114, '[ UPTIME ]', THEME.success)
    ctx.fillStyle = THEME.success; ctx.font = 'bold 22px Arial'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.shadowColor = THEME.success; ctx.shadowBlur = 16
    ctx.fillText(stats.uptimeBot, 676, 140); ctx.shadowBlur = 0
    ctx.fillStyle = THEME.textSub; ctx.font = '10px Arial'
    ctx.fillText('Bot Runtime', 676, 172)
    ctx.fillText(`Server: ${stats.uptimeServer}`, 676, 188)

    // ── Three info cards ──────────────────────────────────────────────────────
    const cY = 238, cH = 168, cW = 290, cGap = 15
    const rGap = 20

    // SERVER
    drawCard(ctx, 28, cY, cW, cH, THEME.secondary)
    drawCardTitle(ctx, 46, cY + 14, '[ SERVER INFO ]', THEME.secondary)
    let rY = cY + 42
    drawRow(ctx, 46, rY,          'Hostname',    stats.hostname,                 THEME.textPrimary, 258)
    drawRow(ctx, 46, rY += rGap,  'Platform',    stats.platform,                 THEME.primary,     258)
    drawRow(ctx, 46, rY += rGap,  'Arch',        stats.arch,                     THEME.textPrimary, 258)
    drawRow(ctx, 46, rY += rGap,  'Kernel',      stats.release.substring(0, 20), THEME.textSub,     258)
    drawRow(ctx, 46, rY += rGap,  'Node.js',     stats.nodeVersion,              THEME.success,     258)
    drawRow(ctx, 46, rY += rGap,  'V8',          stats.v8Version,                THEME.secondary,   258)

    // CPU
    const cX2 = 28 + cW + cGap
    drawCard(ctx, cX2, cY, cW, cH, THEME.primary)
    drawCardTitle(ctx, cX2 + 18, cY + 14, '[ CPU DETAILS ]', THEME.primary)
    rY = cY + 42
    drawRow(ctx, cX2 + 18, rY,         'Model',    stats.cpuModel.substring(0, 22),   THEME.textPrimary, 258)
    drawRow(ctx, cX2 + 18, rY += rGap, 'Cores',   `${stats.cpuCores} cores`,          THEME.primary,     258)
    drawRow(ctx, cX2 + 18, rY += rGap, 'Speed',   stats.cpuSpeed ? `${stats.cpuSpeed} MHz` : 'N/A', THEME.textPrimary, 258)
    drawRow(ctx, cX2 + 18, rY += rGap, 'Load Avg', stats.loadAvg,                     THEME.warning,     258)
    drawRow(ctx, cX2 + 18, rY += rGap, 'Usage',   `${stats.cpuLoad}%`,
        parseFloat(stats.cpuLoad) > 80 ? THEME.danger : THEME.success, 258)
    rY += rGap + 2
    drawBar(ctx, cX2 + 18, rY, 256, 6, parseFloat(stats.cpuLoad),
        parseFloat(stats.cpuLoad) > 80 ? THEME.danger : THEME.primary)

    // MEMORY
    const cX3 = 28 + (cW + cGap) * 2
    drawCard(ctx, cX3, cY, cW, cH, THEME.gold)
    drawCardTitle(ctx, cX3 + 18, cY + 14, '[ MEMORY DETAILS ]', THEME.gold)
    rY = cY + 42
    drawRow(ctx, cX3 + 18, rY,         'Total RAM', formatSize(stats.ramTotal),             THEME.textPrimary, 258)
    drawRow(ctx, cX3 + 18, rY += rGap, 'Used',      formatSize(stats.ramUsed),              THEME.warning,     258)
    drawRow(ctx, cX3 + 18, rY += rGap, 'Free',      formatSize(stats.ramTotal - stats.ramUsed), THEME.success, 258)
    drawRow(ctx, cX3 + 18, rY += rGap, 'Heap Used', stats.heapUsed,                        THEME.primary,     258)
    drawRow(ctx, cX3 + 18, rY += rGap, 'RSS',       stats.rss,                             THEME.secondary,   258)
    rY += rGap + 2
    drawBar(ctx, cX3 + 18, rY, 256, 6, ramPct, ramPct > 80 ? THEME.danger : THEME.success)

    // ── LINE CHARTS ───────────────────────────────────────────────────────────
    const chartY = 424
    const chartH = 130
    const chartW = (W - 28 * 2 - 16) / 2  // two charts side by side

    drawCard(ctx, 28, chartY, chartW, chartH, THEME.primary)
    drawLineChart(ctx, 28 + 4, chartY + 4, chartW - 8, chartH - 8, cpuHist, THEME.primary, 'CPU', '%')

    drawCard(ctx, 28 + chartW + 16, chartY, chartW, chartH, THEME.success)
    drawLineChart(ctx, 28 + chartW + 16 + 4, chartY + 4, chartW - 8, chartH - 8, ramHist, THEME.success, 'RAM', '%')

    // ── Bottom: Process + Storage ─────────────────────────────────────────────
    const btY = 570, btH = 100, btW = (W - 28 * 2 - 16) / 2

    drawCard(ctx, 28, btY, btW, btH, THEME.warning)
    drawCardTitle(ctx, 44, btY + 12, '[ PROCESS INFO ]', THEME.warning)
    const c1 = 44, c2 = 44 + btW / 2, cColW = btW / 2 - 18
    rY = btY + 36
    drawRow(ctx, c1, rY,         'PID',      `#${stats.pid}`,          THEME.warning,      cColW)
    drawRow(ctx, c2, rY,         'Handles',  stats.activeHandles,      THEME.success,      cColW)
    drawRow(ctx, c1, rY += rGap, 'Node.js',  stats.nodeVersion,        THEME.textPrimary,  cColW)
    drawRow(ctx, c2, rY,         'Requests', stats.activeRequests,     THEME.primary,      cColW)
    drawRow(ctx, c1, rY += rGap, 'Heap',    `${stats.heapUsed}`,       THEME.textSub,      cColW)
    drawRow(ctx, c2, rY,         'RSS',      stats.rss,                THEME.textSub,      cColW)

    const stX = 28 + btW + 16
    drawCard(ctx, stX, btY, btW, btH, THEME.success)
    drawCardTitle(ctx, stX + 16, btY + 12, '[ STORAGE & ENV ]', THEME.success)
    rY = btY + 36
    drawRow(ctx, stX + 16, rY,         'Total Disk', formatSize(stats.diskTotal),                    THEME.textPrimary, btW - 32)
    drawRow(ctx, stX + 16, rY += rGap, 'Used',       `${formatSize(stats.diskUsed)} (${diskPct.toFixed(0)}%)`, THEME.warning, btW - 32)
    drawRow(ctx, stX + 16, rY += rGap, 'Free',       formatSize(stats.diskTotal - stats.diskUsed),   THEME.success,    btW - 32)
    drawRow(ctx, stX + 16, rY += rGap, 'Env',        stats.nodeEnv || 'production',                 THEME.primary,    btW - 32)

    // ── Footer ────────────────────────────────────────────────────────────────
    const ftGrad = ctx.createLinearGradient(0, H - 32, W, H)
    ftGrad.addColorStop(0,   `${THEME.primary}1a`)
    ftGrad.addColorStop(0.5, `${THEME.secondary}14`)
    ftGrad.addColorStop(1,   `${THEME.primary}1a`)
    ctx.fillStyle = ftGrad; ctx.fillRect(0, H - 32, W, 32)
    ctx.strokeStyle = `${THEME.primary}44`; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, H - 32); ctx.lineTo(W, H - 32); ctx.stroke()

    drawStar(ctx, 52, H - 16, 5, 2, THEME.gold, 0.85, 8)
    drawStar(ctx, W - 52, H - 16, 5, 2, THEME.gold, 0.85, 8)

    const now = new Date()
    const wib = new Date(now.getTime() + (7 * 60 * 60 * 1000))
    const ts  = wib.toISOString().replace('T', ' ').substring(0, 19) + ' WIB'
    ctx.fillStyle = THEME.textSub; ctx.font = 'italic 10px Arial'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(`Generated at ${ts}`, W / 2, H - 16)

    return canvas.toBuffer('image/png')
}

// ─── Network Stats ────────────────────────────────────────────────────────────
function getNetworkStats() {
    try {
        const interfaces = os.networkInterfaces()
        let activeInterface = 'N/A'
        for (const [name, addrs] of Object.entries(interfaces)) {
            if (name.toLowerCase().includes('lo')) continue
            for (const addr of addrs) {
                if (addr.family === 'IPv4' && !addr.internal) { activeInterface = name; break }
            }
        }
        let totalRx = 0, totalTx = 0
        try {
            if (process.platform === 'linux') {
                const netDev = require('fs').readFileSync('/proc/net/dev', 'utf8')
                for (const line of netDev.split('\n')) {
                    if (line.includes(':') && !line.includes('lo:')) {
                        const parts = line.trim().split(/\s+/)
                        if (parts.length >= 10) {
                            const ifName = parts[0].replace(':', '')
                            const rx = parseInt(parts[1]) || 0
                            const tx = parseInt(parts[9]) || 0
                            if (ifName === activeInterface || (activeInterface === 'N/A' && rx > 0)) {
                                totalRx = rx; totalTx = tx
                                if (activeInterface === 'N/A') activeInterface = ifName
                                break
                            }
                        }
                    }
                }
            }
        } catch {}
        return { totalRx, totalTx, activeInterface }
    } catch {
        return { totalRx: 0, totalTx: 0, activeInterface: 'N/A' }
    }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
async function handler(m, { sock }) {
    startTracker()

    try {
        const t0 = performance.now()
        await m.react('⭐')
        const latency = Math.max(1, Math.round(performance.now() - t0))

        const cpus = os.cpus()
        const totalMem = os.totalmem()
        const freeMem  = os.freemem()

        // CPU usage (dual snapshot)
        let cpuPercent = '0.0'
        try {
            const snap = (arr) => arr.reduce((a, c) => {
                const tot = Object.values(c.times).reduce((x, y) => x + y, 0)
                return { total: a.total + tot, idle: a.idle + c.times.idle }
            }, { total: 0, idle: 0 })
            const s1 = snap(os.cpus())
            await new Promise(r => setTimeout(r, 500))
            const s2 = snap(os.cpus())
            const dt = s2.total - s1.total, di = s2.idle - s1.idle
            cpuPercent = dt > 0
                ? Math.max(0, Math.min(100, ((dt - di) / dt * 100))).toFixed(1)
                : Math.min(100, os.loadavg()[0] / cpus.length * 100).toFixed(1)
        } catch {
            cpuPercent = Math.min(100, os.loadavg()[0] / cpus.length * 100).toFixed(1)
        }

        // Disk
        let diskTotal = 0, diskUsed = 0
        try {
            if (process.platform === 'win32') {
                const wmic = execSync('wmic logicaldisk where "DeviceID=\'C:\'" get Size,FreeSpace /format:value', { encoding: 'utf-8' })
                const fm = wmic.match(/FreeSpace=(\d+)/), sm = wmic.match(/Size=(\d+)/)
                if (sm && fm) { diskTotal = parseInt(sm[1]); diskUsed = diskTotal - parseInt(fm[1]) }
            } else {
                const df = execSync('df -k --output=size,used / 2>/dev/null').toString()
                const parts = df.trim().split('\n')[1]?.trim().split(/\s+/).map(Number)
                if (parts?.length >= 2) { diskTotal = parts[0] * 1024; diskUsed = parts[1] * 1024 }
            }
        } catch {
            diskTotal = 500 * 1024 ** 3; diskUsed = 250 * 1024 ** 3
        }

        const net  = getNetworkStats()
        const heap = process.memoryUsage()

        const stats = {
            ping: latency,
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            release: os.release(),
            nodeVersion: process.version,
            v8Version: process.versions.v8,
            uptimeBot: formatTime(process.uptime()),
            uptimeServer: formatTime(os.uptime()),
            cpuModel: cpus[0]?.model?.trim() || 'Unknown',
            cpuSpeed: cpus[0]?.speed || 0,
            cpuCores: cpus.length,
            cpuLoad: cpuPercent,
            loadAvg: os.loadavg().map(l => l.toFixed(2)).join(', '),
            ramTotal: totalMem,
            ramUsed: totalMem - freeMem,
            diskTotal, diskUsed,
            networkRx: net.totalRx,
            networkTx: net.totalTx,
            networkInterface: net.activeInterface,
            heapUsed: formatSize(heap.heapUsed),
            heapTotal: formatSize(heap.heapTotal),
            rss: formatSize(heap.rss),
            external: formatSize(heap.external),
            arrayBuffers: formatSize(heap.arrayBuffers || 0),
            pid: process.pid,
            uid: process.getuid?.() ?? 'N/A',
            cwd: process.cwd(),
            execPath: process.argv[0].split(/[/\\]/).pop(),
            nodeEnv: process.env.NODE_ENV || 'development',
            activeHandles: process._getActiveHandles?.()?.length ?? 'N/A',
            activeRequests: process._getActiveRequests?.()?.length ?? 'N/A'
        }

        const imageBuffer = await renderDashboard(stats, [...cpuHistory], [...ramHistory])

        const saluranId   = config.saluran?.id   || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
        const saluranName = config.saluran?.name  || config.bot?.name || 'Ourin-AI'
        const ramPct      = ((stats.ramUsed / stats.ramTotal) * 100).toFixed(1)
        const diskPct     = stats.diskTotal > 0 ? ((stats.diskUsed / stats.diskTotal) * 100).toFixed(1) : 0
        const pingStatus  = pingLevel(latency).emoji
        const osName = { linux: '🐧 Linux', darwin: '🍎 macOS', win32: '🪟 Windows', android: '🤖 Android' }[stats.platform] || `📦 ${stats.platform}`

        let dbUsers = 0, dbGroups = 0
        try {
            const db = getDatabase()
            if (db?.data) {
                dbUsers  = Object.keys(db.data.users  || {}).length
                dbGroups = Object.keys(db.data.groups || {}).length
            }
        } catch {}

        const caption =
            `⭐ *SYSTEM DASHBOARD*\n\n` +
            `╭┈┈✦「 🏓 *ʀᴇsᴘᴏɴsᴇ* 」\n` +
            `┃ ◦ Latency: *${latency}ms* ${pingStatus}\n` +
            `┃ ◦ Status: *Online*\n` +
            `╰┈┈✦\n\n` +
            `╭┈┈✦「 🖥️ *sᴇʀᴠᴇʀ* 」\n` +
            `┃ ◦ Hostname: *${stats.hostname}*\n` +
            `┃ ◦ OS: *${osName}*\n` +
            `┃ ◦ Arch: *${stats.arch}*\n` +
            `╰┈┈✦\n\n` +
            `╭┈┈✦「 💻 *ᴄᴘᴜ* 」\n` +
            `┃ ◦ Model: *${stats.cpuModel.  substring(0, 30)}*\n` +
`            ┃ ◦ Cores: *${stats.cpuCores} cores${stats.cpuSpeed ? ` @ ${stats.cpuSpeed} MHz` : ''}*\n` +
            `┃ ◦ Load: *${stats.cpuLoad}%*\n` +
            `╰┈┈✦\n\n` +
            `╭┈┈✦「 🧠 *ᴍᴇᴍᴏʀʏ* 」\n` +
            `┃ ◦ Total: *${formatSize(stats.ramTotal)}*\n` +
            `┃ ◦ Used: *${formatSize(stats.ramUsed)}* (${ramPct}%)\n` +
            `┃ ◦ Free: *${formatSize(stats.ramTotal - stats.ramUsed)}*\n` +
            `╰┈┈✦\n\n` +
            `╭┈┈✦「 💾 *sᴛᴏʀᴀɢᴇ* 」\n` +
            `┃ ◦ Total: *${formatSize(stats.diskTotal)}*\n` +
            `┃ ◦ Used: *${formatSize(stats.diskUsed)}* (${diskPct}%)\n` +
            `┃ ◦ Free: *${formatSize(stats.diskTotal - stats.diskUsed)}*\n` +
            `╰┈┈✦\n\n` +
            `╭┈┈✦「 🗄️ *ᴅᴀᴛᴀʙᴀsᴇ* 」\n` +
            `┃ ◦ Total Users: *${dbUsers}*\n` +
            `┃ ◦ Total Groups: *${dbGroups}*\n` +
            `╰┈┈✦\n\n` +
            `╭┈┈✦「 ⏱️ *ᴜᴘᴛɪᴍᴇ* 」\n` +
            `┃ ◦ Bot: *${stats.uptimeBot}*\n` +
            `┃ ◦ Server: *${stats.uptimeServer}*\n` +
            `╰┈┈✦`

        await sock.sendMessage(m.chat, {
            image: imageBuffer,
            caption,
            contextInfo: {
                forwardingScore: 9999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: saluranId,
                    newsletterName: saluranName,
                    serverMessageId: 127
                }
            }
        }, { quoted: m })

        await m.react('✅')

    } catch (error) {
        await m.react('❌')
        await m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = { config: pluginConfig, handler }