const { createCanvas } = require('@napi-rs/canvas')
const os = require('os')

// ===== CONFIG =====
const pluginConfig = {
    name: 'runtime',
    alias: ['rt', 'uptime'],
    category: 'main',
    description: 'Runtime bot dengan canvas ultra aesthetic',
    usage: '.runtime',
    cooldown: 5,
    energi: 0
}

// ===== FORMAT TIME =====
const formatTime = (seconds) => {
    seconds = Number(seconds || 0)
    const h = Math.floor(seconds / 3600)
    const m = Math.floor(seconds % 3600 / 60)
    const s = Math.floor(seconds % 60)
    return `${h}h ${m}m ${s}s`
}

// ===== BACKGROUND =====
function drawBackground(ctx, W, H) {
    const grad = ctx.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, '#070b14')
    grad.addColorStop(1, '#0f172a')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // ✨ Particle stars (ringan)
    for (let i = 0; i < 25; i++) {
        ctx.fillStyle = '#ffffff15'
        ctx.beginPath()
        ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 1.2, 0, Math.PI * 2)
        ctx.fill()
    }

    // 💖 Glow idol
    const glow = ctx.createRadialGradient(W * 0.8, H * 0.2, 0, W * 0.8, H * 0.2, 280)
    glow.addColorStop(0, '#ec489940')
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)
}

// ===== CARD =====
function card(ctx, x, y, w, h, color) {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, 18)
    ctx.fillStyle = '#0b1220'
    ctx.fill()

    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.shadowColor = color
    ctx.shadowBlur = 15
    ctx.stroke()
    ctx.shadowBlur = 0
}

// ===== PROGRESS RING =====
function ring(ctx, x, y, r, percent, color) {
    const start = -Math.PI / 2
    const end = start + (Math.PI * 2 * percent / 100)

    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 8
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(x, y, r, start, end)
    ctx.strokeStyle = color
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.shadowColor = color
    ctx.shadowBlur = 12
    ctx.stroke()
    ctx.shadowBlur = 0
}

// ===== RENDER =====
// ===== RENDER =====
async function renderRuntime(stats) {
    const W = 1100
    const H = 450
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')

    // ===== BASE BG =====
    const bg = ctx.createLinearGradient(0, 0, W, H)
    bg.addColorStop(0, '#02040a')
    bg.addColorStop(1, '#0f172a')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // ===== SCANLINE EFFECT =====
    ctx.globalAlpha = 0.04
    for (let y = 0; y < H; y += 4) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, y, W, 1)
    }
    ctx.globalAlpha = 1

    // ===== GRID LAYER =====
    ctx.globalAlpha = 0.03
    for (let i = 0; i < W; i += 40) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i, H)
        ctx.strokeStyle = '#38bdf8'
        ctx.stroke()
    }
    for (let i = 0; i < H; i += 40) {
        ctx.beginPath()
        ctx.moveTo(0, i)
        ctx.lineTo(W, i)
        ctx.stroke()
    }
    ctx.globalAlpha = 1

    // ===== PARTICLE SYSTEM =====
    for (let i = 0; i < 80; i++) {
        ctx.beginPath()
        ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 2, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff20'
        ctx.fill()
    }

    // sparkle cross
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * W
        const y = Math.random() * H

        ctx.strokeStyle = '#ffffff30'
        ctx.beginPath()
        ctx.moveTo(x - 4, y)
        ctx.lineTo(x + 4, y)
        ctx.moveTo(x, y - 4)
        ctx.lineTo(x, y + 4)
        ctx.stroke()
    }

    // ===== MULTI GLOW =====
    const glow1 = ctx.createRadialGradient(W * 0.8, H * 0.2, 0, W * 0.8, H * 0.2, 400)
    glow1.addColorStop(0, '#ec489950')
    glow1.addColorStop(1, 'transparent')
    ctx.fillStyle = glow1
    ctx.fillRect(0, 0, W, H)

    const glow2 = ctx.createRadialGradient(W * 0.2, H * 0.8, 0, W * 0.2, H * 0.8, 350)
    glow2.addColorStop(0, '#38bdf840')
    glow2.addColorStop(1, 'transparent')
    ctx.fillStyle = glow2
    ctx.fillRect(0, 0, W, H)

    const glow3 = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, 300)
    glow3.addColorStop(0, '#7c3aed30')
    glow3.addColorStop(1, 'transparent')
    ctx.fillStyle = glow3
    ctx.fillRect(0, 0, W, H)

    // ===== HEADER =====
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 32px Arial'
    ctx.fillText('➷ HOSHINO AI RUNTIME', 50, 60)

    ctx.fillStyle = '#94a3b8'
    ctx.font = '13px Arial'
    ctx.fillText('Ultimate Idol Monitoring ✦ Galaxy Edition', 50, 85)

    // ===== GRADIENT LINE =====
    const line = ctx.createLinearGradient(50, 100, W - 50, 100)
    line.addColorStop(0, '#38bdf8')
    line.addColorStop(0.5, '#7c3aed')
    line.addColorStop(1, '#ec4899')
    ctx.strokeStyle = line
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(50, 100)
    ctx.lineTo(W - 50, 100)
    ctx.stroke()

    // ===== LATENCY BADGE =====
    const color = stats.ping < 100 ? '#10b981' : stats.ping < 300 ? '#f59e0b' : '#ef4444'

    ctx.beginPath()
    ctx.roundRect(W - 170, 30, 140, 55, 15)
    ctx.fillStyle = '#0b1220cc'
    ctx.fill()

    ctx.strokeStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 25
    ctx.stroke()
    ctx.shadowBlur = 0

    ctx.fillStyle = color
    ctx.font = 'bold 20px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`${stats.ping} ms`, W - 100, 65)
    ctx.textAlign = 'left'

    // ===== CARD FUNCTION =====
    function card(x, y, w, h, c) {
        ctx.beginPath()
        ctx.roundRect(x, y, w, h, 25)
        ctx.fillStyle = '#0b1220dd'
        ctx.fill()

        const inner = ctx.createLinearGradient(x, y, x, y + h)
        inner.addColorStop(0, c + '22')
        inner.addColorStop(1, 'transparent')
        ctx.fillStyle = inner
        ctx.fill()

        ctx.strokeStyle = c
        ctx.shadowColor = c
        ctx.shadowBlur = 20
        ctx.stroke()
        ctx.shadowBlur = 0
    }

    function ring(x, y, r, percent, c) {
        const start = -Math.PI / 2
        const end = start + (Math.PI * 2 * percent / 100)

        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.strokeStyle = '#1e293b'
        ctx.lineWidth = 14
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(x, y, r, start, end)
        ctx.strokeStyle = c
        ctx.lineWidth = 14
        ctx.lineCap = 'round'
        ctx.shadowColor = c
        ctx.shadowBlur = 20
        ctx.stroke()
        ctx.shadowBlur = 0

        ctx.fillStyle = c
        ctx.font = 'bold 16px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(`${Math.floor(percent)}%`, x, y + 5)
        ctx.textAlign = 'left'
    }

    // ===== BOT CARD =====
    card(60, 130, 440, 240, '#38bdf8')

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 16px Arial'
    ctx.fillText('★ BOT ACTIVE', 80, 170)

    ctx.font = 'bold 36px Arial'
    ctx.fillStyle = '#38bdf8'
    ctx.fillText(stats.bot, 80, 230)

    ctx.fillStyle = '#94a3b8'
    ctx.font = '13px Arial'
    ctx.fillText('Status: Idol Online ✦ Performance Stable', 80, 270)

    ring(440, 250, 60, stats.botPercent, '#38bdf8')

    // ===== SERVER CARD =====
    card(580, 130, 440, 240, '#ec4899')

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 16px Arial'
    ctx.fillText('✚ SERVER UP', 600, 170)

    ctx.font = 'bold 36px Arial'
    ctx.fillStyle = '#ec4899'
    ctx.fillText(stats.server, 600, 230)

    ctx.fillStyle = '#94a3b8'
    ctx.font = '13px Arial'
    ctx.fillText('Node: Premium ✦ Uptime Stable', 600, 270)

    ring(960, 250, 60, stats.serverPercent, '#ec4899')

    // ===== WAVE BAR =====
    for (let i = 0; i < 70; i++) {
        const h = Math.random() * 40
        ctx.fillStyle = '#38bdf855'
        ctx.fillRect(60 + i * 12, 400 - h, 8, h)
    }

    // ===== FOOTER =====
    ctx.fillStyle = '#94a3b8'
    ctx.font = '12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('Hoshino Ai Idol System ✦ Galaxy Runtime Panel', W / 2, H - 15)

    return canvas.toBuffer('image/png')
}

// ===== HANDLER =====
async function handler(m, { sock }) {
    await m.react('🌸')

    try {
        const latency = m.messageTimestamp
            ? Date.now() - (m.messageTimestamp * 1000)
            : 0

        const botUp = process.uptime()
        const serverUp = os.uptime()

        const stats = {
            bot: formatTime(botUp),
            server: formatTime(serverUp),
            ping: latency,
            botPercent: Math.min(100, (botUp % 3600) / 36),
            serverPercent: Math.min(100, (serverUp % 3600) / 36)
        }

        const image = await renderRuntime(stats)

        const caption = `🌸 *HOSHINO AI RUNTIME* 🌸

⏱️ Bot : *${stats.bot}*
🖥️ Server : *${stats.server}*
⚡ Speed : *${stats.ping} ms*

✨ *Idol Runtime Active*`

        await sock.sendMessage(m.chat, {
            image,
            caption
        }, { quoted: m })

        await m.react('✨')

    } catch (e) {
        await m.react('❌')
        await m.reply(`Error runtime:\n${e.message}`)
    }
}

// ===== EXPORT =====
module.exports = {
    config: pluginConfig,
    handler
}