const hsAsset = require('../../src/lib/assets')
const config  = require('../../config')
const path    = require('path')
const fs      = require('fs')
const { createCanvas } = require('@napi-rs/canvas')

const W = 1200
const H = 1500
const COLORS = {
    bg:          '#0a0010',
    pink:        '#ff2d8f',
    pinkLight:   '#ff6bbd',
    purple:      '#c026d3',
    purpleLight: '#e879f9',
    cyan:        '#00f5ff',
    gold:        '#ffd700',
    white:       '#ffffff',
    whiteDim:    'rgba(255,255,255,0.85)',
    whiteFade:   'rgba(255,255,255,0.45)',
    rowEven:     'rgba(255,45,143,0.07)',
    rowOdd:      'rgba(0,245,255,0.04)',
}

// ─── Helpers ─────────────────────────────────────────────────
function glowText(ctx, text, x, y, color, blur = 18, passes = 3) {
    ctx.save()
    ctx.shadowColor = color
    ctx.shadowBlur = blur
    for (let i = 0; i < passes; i++) ctx.fillText(text, x, y)
    ctx.restore()
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

function hexagon(ctx, cx, cy, r) {
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6
        const px = cx + r * Math.cos(angle)
        const py = cy + r * Math.sin(angle)
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
    }
    ctx.closePath()
}

function diamond(ctx, cx, cy, r) {
    ctx.beginPath()
    ctx.moveTo(cx, cy - r)
    ctx.lineTo(cx + r, cy)
    ctx.lineTo(cx, cy + r)
    ctx.lineTo(cx - r, cy)
    ctx.closePath()
}

function star(ctx, cx, cy, rOuter, rInner, points = 4) {
    ctx.beginPath()
    const step = Math.PI / points
    for (let j = 0; j < points * 2; j++) {
        const angle = step * j - Math.PI / 2
        const rr = j % 2 === 0 ? rOuter : rInner
        const px = cx + rr * Math.cos(angle)
        const py = cy + rr * Math.sin(angle)
        j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
    }
    ctx.closePath()
}

// ─── Vector role icons (no emoji) ────────────────────────────
function iconCrown(ctx, cx, cy, s, color) {
    ctx.save()
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 14
    ctx.beginPath()
    ctx.moveTo(cx - s, cy + s * 0.6)
    ctx.lineTo(cx - s, cy - s * 0.1)
    ctx.lineTo(cx - s * 0.55, cy + s * 0.3)
    ctx.lineTo(cx - s * 0.28, cy - s * 0.55)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx + s * 0.28, cy - s * 0.55)
    ctx.lineTo(cx + s * 0.55, cy + s * 0.3)
    ctx.lineTo(cx + s, cy - s * 0.1)
    ctx.lineTo(cx + s, cy + s * 0.6)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(cx - s, cy + s * 0.6, s * 2, s * 0.22)
    ctx.restore()
}

function iconShield(ctx, cx, cy, s, color) {
    ctx.save()
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 12
    ctx.globalAlpha = 0.25
    ctx.beginPath()
    ctx.moveTo(cx, cy - s)
    ctx.lineTo(cx + s * 0.85, cy - s * 0.55)
    ctx.lineTo(cx + s * 0.85, cy + s * 0.25)
    ctx.quadraticCurveTo(cx + s * 0.85, cy + s, cx, cy + s * 1.15)
    ctx.quadraticCurveTo(cx - s * 0.85, cy + s, cx - s * 0.85, cy + s * 0.25)
    ctx.lineTo(cx - s * 0.85, cy - s * 0.55)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 0.9
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()
}

function iconChip(ctx, cx, cy, s, color) {
    ctx.save()
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 12
    roundRect(ctx, cx - s * 0.6, cy - s * 0.6, s * 1.2, s * 1.2, 4)
    ctx.globalAlpha = 0.25
    ctx.fill()
    ctx.globalAlpha = 0.9
    ctx.lineWidth = 2
    ctx.stroke()
    const legs = [-0.8, -0.3, 0.3, 0.8]
    ctx.lineWidth = 1.5
    for (const l of legs) {
        ctx.beginPath(); ctx.moveTo(cx + l * s * 0.6, cy - s * 0.6); ctx.lineTo(cx + l * s * 0.6, cy - s * 0.9); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(cx + l * s * 0.6, cy + s * 0.6); ctx.lineTo(cx + l * s * 0.6, cy + s * 0.9); ctx.stroke()
    }
    ctx.restore()
}

const ICONS = { crown: iconCrown, shield: iconShield, chip: iconChip }

// ─── Background layers ────────────────────────────────────────
function drawBackground(ctx) {
    const bgGrad = ctx.createRadialGradient(W / 2, H * 0.25, 0, W / 2, H * 0.5, W * 1.1)
    bgGrad.addColorStop(0, '#22004a')
    bgGrad.addColorStop(0.35, '#12002a')
    bgGrad.addColorStop(1, '#050008')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, W, H)

    // Aurora sweeps
    const auroras = [
        { y: H * 0.1, color: COLORS.pink },
        { y: H * 0.4, color: COLORS.cyan },
        { y: H * 0.7, color: COLORS.purple },
    ]
    for (const a of auroras) {
        ctx.save()
        ctx.globalAlpha = 0.10
        const g = ctx.createLinearGradient(0, a.y - 100, W, a.y + 100)
        g.addColorStop(0, 'rgba(0,0,0,0)')
        g.addColorStop(0.5, a.color)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, a.y - 60, W, 160)
        ctx.restore()
    }

    const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.8)
    vignette.addColorStop(0, 'rgba(0,0,0,0)')
    vignette.addColorStop(1, 'rgba(0,0,0,0.65)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, W, H)
}

function drawParticles(ctx) {
    const rand = (seed) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x) }
    for (let i = 0; i < 60; i++) {
        const x = rand(i * 7.3) * W
        const y = rand(i * 3.7) * H
        const r = rand(i * 1.9) * 2.4 + 0.6
        const color = [COLORS.pink, COLORS.cyan, COLORS.gold, COLORS.purpleLight][Math.floor(rand(i * 5.1) * 4)]
        ctx.save()
        ctx.globalAlpha = rand(i * 4.1) * 0.5 + 0.25
        ctx.shadowColor = color
        ctx.shadowBlur = 8
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
    }
}

function drawGeometryAccents(ctx) {
    const hexConfigs = [
        { cx: 50, cy: 90, r: 30, color: COLORS.pink },
        { cx: W - 50, cy: 90, r: 30, color: COLORS.cyan },
        { cx: 40, cy: H - 60, r: 22, color: COLORS.purple },
        { cx: W - 40, cy: H - 60, r: 22, color: COLORS.gold },
    ]
    for (const h of hexConfigs) {
        ctx.save()
        ctx.globalAlpha = 0.18
        hexagon(ctx, h.cx, h.cy, h.r)
        ctx.strokeStyle = h.color
        ctx.lineWidth = 1.4
        ctx.stroke()
        ctx.restore()
    }
    const diamondCfg = [
        { cx: W * 0.5, cy: 18, color: COLORS.gold },
        { cx: 18, cy: H * 0.5, color: COLORS.pink },
        { cx: W - 18, cy: H * 0.5, color: COLORS.cyan },
    ]
    for (const d of diamondCfg) {
        ctx.save()
        ctx.globalAlpha = 0.55
        diamond(ctx, d.cx, d.cy, 7)
        ctx.fillStyle = d.color
        ctx.shadowColor = d.color
        ctx.shadowBlur = 12
        ctx.fill()
        ctx.restore()
    }
}

// ─── Header ────────────────────────────────────────────────
function drawHeader(ctx, botName) {
    const centerX = W / 2
    ctx.save()
    ctx.globalAlpha = 0.5
    const lineGrad = ctx.createLinearGradient(80, 0, W - 80, 0)
    lineGrad.addColorStop(0, 'rgba(255,45,143,0)')
    lineGrad.addColorStop(0.2, COLORS.pink)
    lineGrad.addColorStop(0.5, COLORS.gold)
    lineGrad.addColorStop(0.8, COLORS.cyan)
    lineGrad.addColorStop(1, 'rgba(0,245,255,0)')
    ctx.strokeStyle = lineGrad
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(80, 78)
    ctx.lineTo(W - 80, 78)
    ctx.stroke()
    ctx.restore()

    ctx.save()
    ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = COLORS.cyan
    ctx.letterSpacing = '6px'
    glowText(ctx, '✦  O S H I  N O  K O   ×   H O S H I N O  A I  B O T  ✦', centerX, 38, COLORS.cyan, 10)
    ctx.restore()

    ctx.save()
    ctx.textAlign = 'center'
    ctx.font = 'bold 54px sans-serif'
    glowText(ctx, botName.toUpperCase(), centerX, 78, COLORS.pink, 30, 4)
    ctx.fillStyle = COLORS.white
    ctx.fillText(botName.toUpperCase(), centerX, 78)
    ctx.restore()

    ctx.save()
    ctx.textAlign = 'center'
    ctx.font = 'bold 15px sans-serif'
    ctx.fillStyle = COLORS.pinkLight
    ctx.letterSpacing = '10px'
    glowText(ctx, 'A C K N O W L E D G E M E N T   &   C R E D I T S', centerX, 102, COLORS.pink, 8)
    ctx.restore()
}

// ─── Stats panel ─────────────────────────────────────────────
function drawStatsPanel(ctx, y, stats) {
    const panelX = 55, panelW = W - 110, panelH = 84
    ctx.save()
    roundRect(ctx, panelX, y, panelW, panelH, 14)
    ctx.fillStyle = 'rgba(10,0,20,0.65)'
    ctx.fill()
    roundRect(ctx, panelX, y, panelW, panelH, 14)
    ctx.strokeStyle = COLORS.cyan
    ctx.globalAlpha = 0.4
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()

    const colW = panelW / stats.length
    stats.forEach((s, i) => {
        const cx = panelX + colW * i + colW / 2
        ctx.save()
        ctx.textAlign = 'center'
        ctx.font = 'bold 26px sans-serif'
        ctx.fillStyle = s.color
        ctx.shadowColor = s.color
        ctx.shadowBlur = 10
        ctx.fillText(String(s.value), cx, y + 34)
        ctx.font = '12px sans-serif'
        ctx.fillStyle = COLORS.whiteFade
        ctx.shadowBlur = 0
        ctx.letterSpacing = '2px'
        ctx.fillText(s.label.toUpperCase(), cx, y + 58)
        ctx.restore()
        if (i > 0) {
            ctx.save()
            ctx.strokeStyle = 'rgba(255,255,255,0.15)'
            ctx.beginPath()
            ctx.moveTo(panelX + colW * i, y + 14)
            ctx.lineTo(panelX + colW * i, y + panelH - 14)
            ctx.stroke()
            ctx.restore()
        }
    })
    return y + panelH
}

// ─── Featured creator card ────────────────────────────────────
function drawFeaturedCard(ctx, y, entry) {
    const cardX = 55, cardW = W - 110, cardH = 150
    ctx.save()
    roundRect(ctx, cardX, y, cardW, cardH, 18)
    const grad = ctx.createLinearGradient(cardX, y, cardX + cardW, y)
    grad.addColorStop(0, 'rgba(255,215,0,0.18)')
    grad.addColorStop(0.5, 'rgba(255,45,143,0.14)')
    grad.addColorStop(1, 'rgba(255,215,0,0.18)')
    ctx.fillStyle = grad
    ctx.fill()
    roundRect(ctx, cardX, y, cardW, cardH, 18)
    ctx.strokeStyle = COLORS.gold
    ctx.shadowColor = COLORS.gold
    ctx.shadowBlur = 26
    ctx.lineWidth = 2
    ctx.globalAlpha = 0.8
    ctx.stroke()
    ctx.restore()

    // Avatar circle (silhouette icon, no photo available)
    const avX = cardX + 90, avY = y + cardH / 2, avR = 46
    ctx.save()
    ctx.beginPath()
    ctx.arc(avX, avY, avR, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,215,0,0.12)'
    ctx.fill()
    ctx.strokeStyle = COLORS.gold
    ctx.shadowColor = COLORS.gold
    ctx.shadowBlur = 20
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()
    // silhouette
    ctx.save()
    ctx.fillStyle = COLORS.gold
    ctx.globalAlpha = 0.85
    ctx.beginPath()
    ctx.arc(avX, avY - 12, 16, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(avX, avY + 34, 30, Math.PI, 0)
    ctx.fill()
    ctx.restore()
    iconCrown(ctx, avX, avY - avR - 16, 16, COLORS.gold)

    ctx.save()
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 34px sans-serif'
    ctx.fillStyle = COLORS.white
    ctx.shadowColor = COLORS.gold
    ctx.shadowBlur = 18
    ctx.fillText(entry.name, cardX + 160, y + 58)
    ctx.font = 'bold 15px sans-serif'
    ctx.fillStyle = COLORS.gold
    ctx.shadowBlur = 8
    ctx.letterSpacing = '3px'
    ctx.fillText(entry.role.toUpperCase(), cardX + 160, y + 90)
    ctx.font = '13px sans-serif'
    ctx.fillStyle = COLORS.whiteFade
    ctx.shadowBlur = 0
    ctx.letterSpacing = '0px'
    ctx.fillText('Founder & Version Creator', cardX + 160, y + 116)
    ctx.restore()

    return y + cardH
}

// ─── Section of role cards ────────────────────────────────────
function drawSection(ctx, y, section) {
    const marginX = 55
    const contentW = W - 110

    ctx.save()
    ctx.textAlign = 'left'
    ctx.font = 'bold 16px sans-serif'
    ctx.fillStyle = section.color
    ctx.shadowColor = section.color
    ctx.shadowBlur = 10
    ctx.letterSpacing = '4px'
    ctx.fillText(`─ ${section.title.toUpperCase()}`, marginX, y)
    ctx.restore()

    let cursorY = y + 22
    const cardH = 68
    const gap = 12

    for (const entry of section.entries) {
        ctx.save()
        roundRect(ctx, marginX, cursorY, contentW, cardH, 12)
        ctx.fillStyle = 'rgba(255,255,255,0.04)'
        ctx.fill()
        roundRect(ctx, marginX, cursorY, contentW, cardH, 12)
        ctx.strokeStyle = section.color
        ctx.globalAlpha = 0.4
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()

        // accent bar
        ctx.save()
        ctx.fillStyle = section.color
        ctx.globalAlpha = 0.8
        ctx.fillRect(marginX, cursorY + 8, 4, cardH - 16)
        ctx.restore()

        // icon
        const iconFn = ICONS[section.icon]
        if (iconFn) iconFn(ctx, marginX + 46, cursorY + cardH / 2, 16, section.color)

        // name + role
        ctx.save()
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'left'
        ctx.font = 'bold 19px sans-serif'
        ctx.fillStyle = COLORS.white
        ctx.shadowColor = section.color
        ctx.shadowBlur = 6
        ctx.fillText(entry.name, marginX + 84, cursorY + cardH / 2 - 12)
        ctx.font = '13px sans-serif'
        ctx.fillStyle = section.color
        ctx.shadowBlur = 4
        ctx.fillText(entry.role, marginX + 84, cursorY + cardH / 2 + 14)
        ctx.restore()

        cursorY += cardH + gap
    }

    return cursorY + 6
}

// ─── Footer ────────────────────────────────────────────────
function drawFooter(ctx, botName, version) {
    const fy = H - 34
    ctx.save()
    ctx.globalAlpha = 0.35
    const footGrad = ctx.createLinearGradient(80, 0, W - 80, 0)
    footGrad.addColorStop(0, 'rgba(0,245,255,0)')
    footGrad.addColorStop(0.3, COLORS.cyan)
    footGrad.addColorStop(0.7, COLORS.pink)
    footGrad.addColorStop(1, 'rgba(255,45,143,0)')
    ctx.strokeStyle = footGrad
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(80, fy - 16)
    ctx.lineTo(W - 80, fy - 16)
    ctx.stroke()
    ctx.restore()

    ctx.save()
    ctx.textBaseline = 'middle'
    ctx.font = '11px sans-serif'
    ctx.fillStyle = COLORS.whiteFade
    ctx.textAlign = 'left'
    ctx.globalAlpha = 0.7
    ctx.fillText(`✦ Inspired by Oshi no Ko  ·  Hoshino Ai`, 80, fy)

    ctx.fillStyle = COLORS.gold
    ctx.textAlign = 'center'
    ctx.globalAlpha = 0.6
    ctx.shadowColor = COLORS.gold
    ctx.shadowBlur = 8
    ctx.fillText('★', W / 2, fy)

    ctx.fillStyle = COLORS.whiteFade
    ctx.textAlign = 'right'
    ctx.globalAlpha = 0.7
    ctx.shadowBlur = 0
    ctx.fillText(`${botName}  ·  v${version}`, W - 80, fy)
    ctx.restore()
}

// ─── Main render ───────────────────────────────────────────
async function renderCreditsCanvas(botName, version, creditGroups) {
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')

    drawBackground(ctx)
    drawParticles(ctx)
    drawGeometryAccents(ctx)
    drawHeader(ctx, botName)

    const totalContributors = creditGroups.reduce((n, s) => n + s.entries.length, 0)
    let y = 130
    y = drawStatsPanel(ctx, y, [
        { label: 'Contributor', value: totalContributors, color: COLORS.pink },
        { label: 'Roles', value: creditGroups.length, color: COLORS.cyan },
        { label: 'Version', value: version, color: COLORS.gold },
    ]) + 22

    const featuredSection = creditGroups.find(s => s.featured)
    if (featuredSection) {
        y = drawFeaturedCard(ctx, y, featuredSection.entries[0]) + 30
    }

    for (const section of creditGroups) {
        if (section.featured) continue
        y = drawSection(ctx, y, section) + 18
    }

    drawFooter(ctx, botName, version)

    return canvas.toBuffer('image/jpeg', 92)
}

// ─── Plugin Config & Handler ─────────────────────────────────
const pluginConfig = {
    name: 'tqto',
    alias: ['thanksto', 'credits', 'kredit'],
    category: 'main',
    description: 'Menampilkan daftar kontributor bot secara lengkap',
    usage: '.tqto',
    example: '.tqto',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock, db }) {
    const botName   = config.bot?.name    || 'Hoshino Ai Bot'
    const version   = config.bot?.version || '1.0.0'
    const developer = 'HsnAi™'

    let mode = 'v1'
    try {
        const current = db?.setting?.('tqtoVariant')
        if (current === 2) mode = 'v2'
        else if (current === 1) mode = 'v1'
        else mode = config.bot?.tqtoStyle || 'v1'
    } catch {
        mode = config.bot?.tqtoStyle || 'v1'
    }

    // =========================
    // 🚀 V2 (CANVAS)
    // =========================
    if (mode === 'v2') {
        const creditGroups = [
            {
                title: 'Creator',
                color: COLORS.gold,
                icon: 'crown',
                featured: true,
                entries: [
                    { name: 'Sea', role: 'Creator & Owner Utama' },
                ]
            },
            {
                title: 'Owner',
                color: COLORS.purpleLight,
                icon: 'shield',
                entries: [
                    { name: 'Xyrann', role: 'Owner' },
                    { name: 'Qynox', role: 'Owner' },
                ]
            },
            {
                title: 'Developer',
                color: COLORS.cyan,
                icon: 'chip',
                entries: [
                    { name: 'HsnAi™', role: 'Tim Pengembang Hoshino Ai Bot' },
                ]
            },
        ]

        try {
            const imgBuf = await renderCreditsCanvas(botName, version, creditGroups)

            const saluranId   = config.saluran?.id   || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
            const saluranName = config.saluran?.name || botName

            return sock.sendMessage(m.chat, {
                image: imgBuf,
                caption:
                    `✨ *${botName} — CREDITS*\n\n` +
                    `> Terima kasih sudah menjadi bagian dari perjalanan ini~ 💜\n` +
                    `> _"Aku menyukai semua orang yang menyukaiku"_ — Hoshino Ai`,
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: saluranId,
                        newsletterName: saluranName,
                        serverMessageId: 127
                    }
                }
            }, { quoted: m })

        } catch (e) {
            console.error('[tqto v2 canvas] Error:', e.message)
            return m.reply(`⚠️ *Eh eh~* Canvas render gagal: ${e.message} 🌸`)
        }
    }

    // =========================
    // 🌸 V1 (ASLI - NO TOUCH)
    // =========================

    let txt = `───  ✨ *ACKNOWLEDGEMENT* ───\n\n`
    txt += `> "Segala puji bagi Allah SWT, Tuhan semesta alam, yang telah memberikan kemudahan dalam pengembangan bot ini."\n\n`

    txt += `╭─「 🕊️ *MAIN FOUNDATION* 」\n`
    txt += `│ ✦ *Allah SWT* (The Creator)\n`
    txt += `│ ✦ *Agama Islam* (Way of Life)\n`
    txt += `│ ✦ *Sea* (Creator & Owner Utama)\n`
    txt += `│ ✦ *Xyrann* (Owner)\n`
    txt += `│ ✦ *Qynox* (Owner)\n`
    txt += `╰───────────────\n\n`

    txt += `╭─「 🌠 *INSPIRATION* 」\n`
    txt += `│ ✦ *Ai Hoshino* (The Brightest Idol)\n`
    txt += `│ ✦ *Oshi no Ko* (Main Concept)\n`
    txt += `│ ✦ *Aka Akasaka* (Original Author)\n`
    txt += `╰───────────────\n\n`

    txt += `╭─「 💻 *BUILT WITH* 」\n`
    txt += `│ ✦ *Node.js* (Runtime)\n`
    txt += `│ ✦ *Baileys* (WA Library)\n`
    txt += `│ ✦ *JavaScript* (Language)\n`
    txt += `│ ✦ *Axios* (HTTP Client)\n`
    txt += `╰───────────────\n\n`

    txt += `╭─「 🌐 *SERVICES* 」\n`
    txt += `│ ✦ *Google Cloud* (AI Engine)\n`
    txt += `│ ✦ *GitHub* (Repository)\n`
    txt += `│ ✦ *Provider VPS/Panel*\n`
    txt += `│ ✦ *NPM* (Package Manager)\n`
    txt += `╰───────────────\n\n`

    txt += `╭─「 💖 *SPECIAL THANKS* 」\n`
    txt += `│ • *HsnAi™* (Tim Pengembang Hoshino Ai Bot)\n`
    txt += `│ • *Semua Tester* (Bug Hunter)\n`
    txt += `│ • *User Setia* (Usage)\n`
    txt += `│ • *Open Source Community*\n`
    txt += `╰───────────────\n\n`

    txt += `╭─「 📋 *sʏsᴛᴇᴍ ɪɴꜰᴏ* 」\n`
    txt += `│ 🤖 \`ɴᴀᴍᴀ\`: *${botName}*\n`
    txt += `│ 📦 \`ᴠᴇʀsɪ\`: *${version}*\n`
    txt += `│ 👨‍💻 \`ᴅᴇᴠ\`: *${developer}*\n`
    txt += `╰───────────────\n\n`

    txt += `> Terimakasih telah menggunakan jasa kami.`

    const saluranId   = config.saluran?.id   || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    const saluranName = config.saluran?.name || botName

    let thumbBuffer = null
    if (hsAsset.has('images/hsnai')) thumbBuffer = (await hsAsset.buffer('images/hsnai'))

    const contextInfo = {
        mentionedJid: [],
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: saluranId,
            newsletterName: saluranName,
            serverMessageId: 127
        }
    }

    const fakeQuoted = {
        key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast' },
        message: {
            extendedTextMessage: {
                text: `🌟 "Kebohongan adalah cinta yang paling tulus."`,
                contextInfo: { isForwarded: true, forwardingScore: 999 }
            }
        }
    }

    // Kirim sebagai gambar (thumbnail bot) + caption; fallback ke teks biasa kalau aset belum ada
    if (thumbBuffer) {
        // batas aman caption WA ~1024 karakter; kalau kepanjangan, gambar dulu lalu teks lengkap
        if (txt.length <= 1024) {
            return sock.sendMessage(m.chat, {
                image: thumbBuffer,
                caption: txt,
                contextInfo
            }, { quoted: fakeQuoted })
        }
        await sock.sendMessage(m.chat, {
            image: thumbBuffer,
            caption: `✨ *BIG THANKS FROM - ${botName}*\n> Inspired by Oshi no Ko • v${version}`,
            contextInfo
        }, { quoted: fakeQuoted })
    }

    await sock.sendMessage(m.chat, {
        text: txt,
        contextInfo
    }, { quoted: fakeQuoted })
}

module.exports = { config: pluginConfig, handler }