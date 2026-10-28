const axios = require('axios')
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas')

const pluginConfig = {
    name: 'stalkcoc',
    alias: ['cocstalk', 'coc'],
    category: 'stalker',
    description: 'Lihat stats player Clash of Clans',
    usage: '.stalkcoc <tag>',
    example: '.stalkcoc 8PG0GQ9QU',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const API_KEY = 'qK5WU'
const API_URL = 'https://api.theresav.biz.id/stalk/coc'

// ── Font loader ───────────────────────────────────────────────────────────
const _fc = new Set()
const _fb = 'https://raw.githubusercontent.com/Reyz2902/font2/main/'

async function lf(file, alias) {
    if (_fc.has(alias)) return
    const r = await fetch(_fb + encodeURIComponent(file))
    if (!r.ok) throw new Error('Font gagal: ' + file)
    GlobalFonts.register(Buffer.from(await r.arrayBuffer()), alias)
    _fc.add(alias)
}

// ── Canvas helpers ────────────────────────────────────────────────────────
function rrp(ctx, x, y, w, h, r) {
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

function clamp(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text
    while (ctx.measureText(text + '…').width > maxW && text.length > 0)
        text = text.slice(0, -1)
    return text + '…'
}

function fmtNum(n) {
    const num = parseInt(String(n).replace(/,/g, ''))
    if (isNaN(num)) return String(n)
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B'
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
    return String(num)
}

function h2r(hex, a) {
    const h = hex.replace('#', '')
    const rv = parseInt(h.slice(0, 2), 16)
    const gv = parseInt(h.slice(2, 4), 16)
    const bv = parseInt(h.slice(4, 6), 16)
    return `rgba(${rv},${gv},${bv},${a})`
}

function divider(ctx, x, y, w, col = '#a855f7') {
    const g = ctx.createLinearGradient(x, y, x + w, y)
    g.addColorStop(0, 'transparent')
    g.addColorStop(0.2, h2r(col, 0.22))
    g.addColorStop(0.8, h2r(col, 0.22))
    g.addColorStop(1, 'transparent')
    ctx.save()
    ctx.strokeStyle = g
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + w, y)
    ctx.stroke()
    ctx.restore()
}

function sectionLabel(ctx, x, y, title, sub, col = '#a855f7') {
    ctx.save()
    const barG = ctx.createLinearGradient(x, y - 9, x, y + 9)
    barG.addColorStop(0, '#d8b4fe')
    barG.addColorStop(0.45, col)
    barG.addColorStop(1, '#6d28d9')
    ctx.fillStyle = barG
    ctx.shadowColor = col
    ctx.shadowBlur = 8
    ctx.fillRect(x, y - 9, 3, 18)
    ctx.restore()

    ctx.textAlign = 'left'
    ctx.font = 'bold 13px SFBold'
    ctx.fillStyle = '#f0eaff'
    ctx.fillText(title, x + 10, y + 4)

    if (sub) {
        ctx.font = '10px SFRegular'
        ctx.fillStyle = '#6b5f90'
        ctx.fillText(sub, x + 10, y + 18)
    }
}

// ── Warna Hoshino Ai theme ────────────────────────────────────────────────
const C = {
    // Background
    bg0: '#0a0015',
    bg2: '#140a2a',
    // Accent Hoshino Ai — pink/magenta/purple star
    glowA: '#e040a0',   // pink utama
    glowB: '#7b1fa2',   // ungu
    glowC: '#f48fb1',   // pink muda
    bladeEdge: '#f8bbd0',
    // Stats
    gold: '#ffd54f',
    red: '#ef9a9a',
    blue: '#90caf9',
    green: '#a5d6a7',
    // Text
    text0: '#fff0fa',
    text1: '#e0b4d4',
    text2: '#9e6f8e',
    text3: '#4a2a40',
    // Heroes
    heroA: '#f48fb1', heroB: '#ce93d8', heroC: '#90caf9', heroD: '#80cbc4',
    heroE: '#ffe082', heroF: '#ef9a9a', heroG: '#f48fb1', heroH: '#80deea',
    // Spells
    spA: '#ba68c8', spB: '#9575cd', spC: '#64b5f6', spD: '#4db6ac',
    spE: '#ffb74d', spF: '#e57373', spG: '#f06292', spH: '#4dd0e1',
    spI: '#f48fb1', spJ: '#aed581', spK: '#b0bec5', spL: '#ce93d8',
    cardBorderHi: 'rgba(240,128,180,0.32)',
}

// ── Generate canvas ───────────────────────────────────────────────────────
async function generateCocCanvas(data) {
    await Promise.all([
        lf('SFPRODISPLAYBOLD.OTF', 'SFBold'),
        lf('SFPRODISPLAYMEDIUM.OTF', 'SFMedium'),
        lf('SFPRODISPLAYREGULAR.OTF', 'SFRegular'),
    ])

    const r = data.result
    const ms = r.main_stats || {}
    const heroes = r.units?.heroes || []
    const spells = r.units?.spells || []
    const troops = (r.units?.troops || []).filter(t => t.village === 'Home Village').slice(0, 12)
    const thLvl = ms.town_hall || '?'
    const trophies = ms.trophies || '0'
    const warStars = ms.war_stars || '0'
    const exp = ms.experience || '0'
    const achDone = (r.achievements || []).filter(a => a.progress === '100%').length
    const achTotal = (r.achievements || []).length

    const W = 1100, H = 900
    const PAD = 26, GAP = 11

    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')

    // Background
    const bgG = ctx.createLinearGradient(0, 0, W, H)
    bgG.addColorStop(0, C.bg0)
    bgG.addColorStop(0.5, C.bg2)
    bgG.addColorStop(1, C.bg0)
    ctx.fillStyle = bgG
    ctx.fillRect(0, 0, W, H)

    // Glow orbs
    ;[
        [W * 0.08, H * 0.14, 360, C.glowA, 0.18],
        [W * 0.92, H * 0.84, 300, C.glowB, 0.22],
        [W * 0.5,  H * 0.46, 200, C.glowA, 0.06],
        [W * 0.3,  H * 0.7,  180, C.glowC, 0.05],
    ].forEach(([ax, ay, ar, ac, aa]) => {
        const ag = ctx.createRadialGradient(ax, ay, 0, ax, ay, ar)
        ag.addColorStop(0, h2r(ac, aa))
        ag.addColorStop(1, 'transparent')
        ctx.fillStyle = ag
        ctx.fillRect(0, 0, W, H)
    })

    // Grid lines
    ctx.save()
    ctx.globalAlpha = 0.018
    ctx.strokeStyle = C.glowA
    ctx.lineWidth = 1
    for (let gx = 0; gx < W; gx += 70) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke() }
    for (let gy = 0; gy < H; gy += 70) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke() }
    ctx.restore()

    // Diagonal blade
    ctx.save()
    const sl = ctx.createLinearGradient(0, H * 0.08, W, H * 0.5)
    sl.addColorStop(0, 'transparent')
    sl.addColorStop(0.3, h2r(C.bladeEdge, 0.06))
    sl.addColorStop(0.7, h2r(C.glowA, 0.05))
    sl.addColorStop(1, 'transparent')
    ctx.strokeStyle = sl
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, H * 0.08); ctx.lineTo(W, H * 0.5); ctx.stroke()
    ctx.restore()

    // Outer border
    rrp(ctx, 2, 2, W - 4, H - 4, 20)
    const ob = ctx.createLinearGradient(0, 0, W, H)
    ob.addColorStop(0, h2r(C.bladeEdge, 0.45))
    ob.addColorStop(0.5, h2r(C.glowA, 0.18))
    ob.addColorStop(1, h2r(C.glowB, 0.38))
    ctx.strokeStyle = ob
    ctx.lineWidth = 1.5
    ctx.stroke()

    let curY = PAD

    // ── Header ────────────────────────────────────────────────────────────
    const hH = 96
    rrp(ctx, PAD, curY, W - PAD * 2, hH, 16)
    const hBg = ctx.createLinearGradient(PAD, curY, W - PAD, curY + hH)
    hBg.addColorStop(0, h2r(C.glowA, 0.18))
    hBg.addColorStop(1, h2r(C.glowB, 0.08))
    ctx.fillStyle = hBg
    ctx.fill()
    rrp(ctx, PAD, curY, W - PAD * 2, hH, 16)
    const hBord = ctx.createLinearGradient(PAD, curY, W - PAD, curY + hH)
    hBord.addColorStop(0, h2r(C.bladeEdge, 0.55))
    hBord.addColorStop(1, h2r(C.glowB, 0.18))
    ctx.strokeStyle = hBord
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Avatar circle
    const aCX = PAD + 48, aCY = curY + hH / 2
    ctx.save()
    ctx.beginPath()
    ctx.arc(aCX, aCY, 30, 0, Math.PI * 2)
    const aG = ctx.createRadialGradient(aCX - 6, aCY - 8, 1, aCX, aCY, 30)
    aG.addColorStop(0, h2r(C.bladeEdge, 0.95))
    aG.addColorStop(0.5, h2r(C.glowA, 0.75))
    aG.addColorStop(1, h2r(C.glowB, 0.38))
    ctx.fillStyle = aG
    ctx.shadowColor = C.glowA
    ctx.shadowBlur = 22
    ctx.fill()
    ctx.restore()
    ctx.font = 'bold 20px SFBold'
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.fillText('⚔️', aCX, aCY + 7)

    // Name & info
    const nameX = PAD + 90
    ctx.font = 'bold 26px SFBold'
    ctx.fillStyle = C.text0
    ctx.textAlign = 'left'
    ctx.fillText(clamp(ctx, r.name || 'Unknown', 380), nameX, curY + 37)
    ctx.font = '12px SFRegular'
    ctx.fillStyle = C.text1
    ctx.fillText(`${r.tag || ''}  ·  ${r.clan?.name || 'No Clan'}`, nameX, curY + 57)
    ctx.font = '11px SFRegular'
    ctx.fillStyle = C.text2
    ctx.fillText('Clash of Clans  ·  Hoshino Ai Bot', nameX, curY + 75)

    // Live badge
    const bw = 116, bh = 26, bx = W - PAD - bw, by = curY + (hH - bh) / 2
    rrp(ctx, bx, by, bw, bh, 8)
    ctx.fillStyle = 'rgba(10,0,21,0.93)'
    ctx.fill()
    rrp(ctx, bx, by, bw, bh, 8)
    ctx.strokeStyle = h2r(C.glowA, 0.28)
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.save()
    ctx.beginPath()
    ctx.arc(bx + 14, by + bh / 2, 4, 0, Math.PI * 2)
    ctx.fillStyle = C.green
    ctx.shadowColor = C.green
    ctx.shadowBlur = 7
    ctx.fill()
    ctx.restore()
    ctx.font = '11px SFMedium'
    ctx.fillStyle = C.text1
    ctx.textAlign = 'left'
    ctx.fillText('Live Data', bx + 25, by + bh / 2 + 4)

    curY += hH + GAP

    // ── Stat cards ────────────────────────────────────────────────────────
    const statCards = [
        { label: 'Town Hall', value: `TH ${thLvl}`, col: C.glowA },
        { label: 'Trophies',  value: fmtNum(trophies), col: C.gold },
        { label: 'War Stars', value: fmtNum(warStars),  col: C.red  },
        { label: 'EXP Level', value: String(exp),        col: C.blue },
    ]
    const cW = (W - PAD * 2 - GAP * 3) / 4
    const cH = 104

    statCards.forEach((card, i) => {
        const cx = PAD + i * (cW + GAP), cy = curY
        rrp(ctx, cx, cy, cW, cH, 14)
        const cg = ctx.createLinearGradient(cx, cy, cx + cW, cy + cH)
        cg.addColorStop(0, h2r(card.col, 0.13))
        cg.addColorStop(1, h2r(card.col, 0.04))
        ctx.fillStyle = cg
        ctx.fill()
        rrp(ctx, cx, cy, cW, cH, 14)
        ctx.strokeStyle = h2r(card.col, 0.38)
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.save()
        ctx.beginPath()
        ctx.arc(cx + cW - 4, cy + 4, 46, 0, Math.PI * 2)
        ctx.fillStyle = h2r(card.col, 0.05)
        ctx.fill()
        ctx.restore()

        ctx.font = '11px SFRegular'
        ctx.fillStyle = C.text2
        ctx.textAlign = 'left'
        ctx.fillText(card.label, cx + 16, cy + 26)

        ctx.font = 'bold 28px SFBold'
        ctx.fillStyle = card.col
        ctx.shadowColor = card.col
        ctx.shadowBlur = 12
        ctx.fillText(card.value, cx + 16, cy + 66)
        ctx.shadowBlur = 0

        rrp(ctx, cx + 16, cy + cH - 13, cW - 32, 3, 2)
        const bG = ctx.createLinearGradient(cx + 16, 0, cx + cW - 16, 0)
        bG.addColorStop(0, card.col)
        bG.addColorStop(1, h2r(card.col, 0.18))
        ctx.fillStyle = bG
        ctx.fill()
    })

    curY += cH + GAP

    // ── Heroes & Spells ───────────────────────────────────────────────────
    const heroW = Math.floor(W * 0.54) - PAD
    const spellW = W - heroW - PAD * 2 - GAP
    const midH = 160

    // Heroes panel
    const hpX = PAD, hpY = curY
    rrp(ctx, hpX, hpY, heroW, midH, 14)
    ctx.fillStyle = h2r(C.glowB, 0.10)
    ctx.fill()
    rrp(ctx, hpX, hpY, heroW, midH, 14)
    ctx.strokeStyle = C.cardBorderHi
    ctx.lineWidth = 1
    ctx.stroke()

    sectionLabel(ctx, hpX + 14, hpY + 22, 'Heroes', `${heroes.length} hero`, C.glowA)
    divider(ctx, hpX + 14, hpY + 38, heroW - 28, C.glowA)

    const heroColorList = [C.heroA, C.heroB, C.heroC, C.heroD, C.heroE, C.heroF, C.heroG, C.heroH]
    const heroSlotW = (heroW - 28) / Math.max(heroes.length, 1)
    const heroCardH = midH - 52, heroCardY = hpY + 44

    heroes.forEach((hero, i) => {
        const hx = hpX + 14 + i * heroSlotW
        const col = heroColorList[i % heroColorList.length]
        const cardW = heroSlotW - 6
        const midX = hx + cardW / 2

        rrp(ctx, hx, heroCardY, cardW, heroCardH, 10)
        const hcg = ctx.createLinearGradient(hx, heroCardY, hx, heroCardY + heroCardH)
        hcg.addColorStop(0, h2r(col, 0.16))
        hcg.addColorStop(1, h2r(col, 0.05))
        ctx.fillStyle = hcg
        ctx.fill()
        rrp(ctx, hx, heroCardY, cardW, heroCardH, 10)
        ctx.strokeStyle = h2r(col, 0.44)
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.font = 'bold 22px SFBold'
        ctx.fillStyle = col
        ctx.shadowColor = col
        ctx.shadowBlur = 10
        ctx.textAlign = 'center'
        ctx.fillText(hero.level.replace('Lv ', ''), midX, heroCardY + heroCardH / 2 + 2)
        ctx.shadowBlur = 0

        const abbr = hero.name
            .replace('Barbarian King', 'BK').replace('Archer Queen', 'AQ')
            .replace('Grand Warden', 'GW').replace('Royal Champion', 'RC')
            .replace('Battle Machine', 'BM').replace('Battle Copter', 'BC')
            .replace('Minion Prince', 'MP').replace('Dragon Duke', 'DD')

        const lbH = 15, lbW = cardW - 10
        const lbX = hx + 5, lbY = heroCardY + heroCardH - lbH - 5
        rrp(ctx, lbX, lbY, lbW, lbH, 4)
        const lG = ctx.createLinearGradient(lbX, 0, lbX + lbW, 0)
        lG.addColorStop(0, h2r(col, 0.88))
        lG.addColorStop(1, h2r(col, 0.48))
        ctx.fillStyle = lG
        ctx.fill()
        ctx.font = '8px SFBold'
        ctx.fillStyle = '#0a0015'
        ctx.textAlign = 'center'
        ctx.fillText(abbr, midX, lbY + 10)
    })

    // Spells panel
    const spX = PAD + heroW + GAP, spY = curY
    rrp(ctx, spX, spY, spellW, midH, 14)
    ctx.fillStyle = h2r(C.glowB, 0.10)
    ctx.fill()
    rrp(ctx, spX, spY, spellW, midH, 14)
    ctx.strokeStyle = C.cardBorderHi
    ctx.lineWidth = 1
    ctx.stroke()

    sectionLabel(ctx, spX + 14, spY + 22, 'Spells', `${spells.length} spell`, C.glowA)
    divider(ctx, spX + 14, spY + 38, spellW - 28, C.glowA)

    const spCols = 6
    const spSize = Math.min(44, Math.floor((spellW - 28) / spCols) - 4)
    const spColorList = [C.spA, C.spB, C.spC, C.spD, C.spE, C.spF, C.spG, C.spH, C.spI, C.spJ, C.spK, C.spL]

    spells.slice(0, 12).forEach((spell, i) => {
        const sc = i % spCols, sr = Math.floor(i / spCols)
        const sx = spX + 14 + sc * (spSize + 4)
        const sy = spY + 44 + sr * (spSize + 4)
        const col = spColorList[i % spColorList.length]

        rrp(ctx, sx, sy, spSize, spSize, 7)
        const scg = ctx.createLinearGradient(sx, sy, sx + spSize, sy + spSize)
        scg.addColorStop(0, h2r(col, 0.22))
        scg.addColorStop(1, h2r(col, 0.07))
        ctx.fillStyle = scg
        ctx.fill()
        rrp(ctx, sx, sy, spSize, spSize, 7)
        ctx.strokeStyle = h2r(col, 0.52)
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.font = 'bold 13px SFBold'
        ctx.fillStyle = col
        ctx.shadowColor = col
        ctx.shadowBlur = 6
        ctx.textAlign = 'center'
        ctx.fillText(spell.level.replace('Lv ', ''), sx + spSize / 2, sy + spSize / 2 + 5)
        ctx.shadowBlur = 0

        ctx.font = '7px SFRegular'
        ctx.fillStyle = C.text2
        ctx.fillText(spell.name.split(' ')[0].slice(0, 6), sx + spSize / 2, sy + spSize - 3)
    })

    curY += midH + GAP

    // ── Troops ────────────────────────────────────────────────────────────
    const tpH = 148
    rrp(ctx, PAD, curY, W - PAD * 2, tpH, 14)
    ctx.fillStyle = h2r(C.glowB, 0.08)
    ctx.fill()
    rrp(ctx, PAD, curY, W - PAD * 2, tpH, 14)
    ctx.strokeStyle = C.cardBorderHi
    ctx.lineWidth = 1
    ctx.stroke()

    sectionLabel(ctx, PAD + 14, curY + 22, 'Troops — Home Village', 'Top 12', C.glowA)
    divider(ctx, PAD + 14, curY + 38, W - PAD * 2 - 28, C.glowA)

    const tSize = 74
    const tGap = Math.floor((W - PAD * 2 - 28 - tSize * 12) / 11)
    const troopY = curY + 44

    troops.forEach((troop, i) => {
        const tx = PAD + 14 + i * (tSize + tGap)

        rrp(ctx, tx, troopY, tSize, tSize, 10)
        const tcg = ctx.createLinearGradient(tx, troopY, tx + tSize, troopY + tSize)
        tcg.addColorStop(0, h2r(C.glowA, 0.15))
        tcg.addColorStop(1, h2r(C.glowB, 0.06))
        ctx.fillStyle = tcg
        ctx.fill()
        rrp(ctx, tx, troopY, tSize, tSize, 10)
        ctx.strokeStyle = h2r(C.glowA, 0.40)
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.font = 'bold 20px SFBold'
        ctx.fillStyle = C.bladeEdge
        ctx.shadowColor = C.glowA
        ctx.shadowBlur = 11
        ctx.textAlign = 'center'
        ctx.fillText(troop.level.replace('Lv ', ''), tx + tSize / 2, troopY + tSize / 2 + 4)
        ctx.shadowBlur = 0

        const lbW2 = 30, lbH2 = 13
        const lbX2 = tx + (tSize - lbW2) / 2, lbY2 = troopY + tSize - 15
        rrp(ctx, lbX2, lbY2, lbW2, lbH2, 3)
        const tlG = ctx.createLinearGradient(lbX2, 0, lbX2 + lbW2, 0)
        tlG.addColorStop(0, C.glowA)
        tlG.addColorStop(1, C.glowB)
        ctx.fillStyle = tlG
        ctx.fill()
        ctx.font = '7px SFBold'
        ctx.fillStyle = '#fff0fa'
        ctx.textAlign = 'center'
        ctx.fillText(troop.name.split(' ')[0].slice(0, 5), lbX2 + lbW2 / 2, lbY2 + 9)
    })

    curY += tpH + GAP

    // ── Achievements & Player Info ────────────────────────────────────────
    const achW = Math.floor(W * 0.46) - PAD
    const clanW = W - achW - PAD * 2 - GAP
    const botH = H - curY - PAD

    // Achievements
    const acX = PAD, acY = curY
    rrp(ctx, acX, acY, achW, botH, 14)
    ctx.fillStyle = h2r(C.glowB, 0.09)
    ctx.fill()
    rrp(ctx, acX, acY, achW, botH, 14)
    ctx.strokeStyle = C.cardBorderHi
    ctx.lineWidth = 1
    ctx.stroke()

    sectionLabel(ctx, acX + 14, acY + 22, 'Achievements', `${achDone} / ${achTotal} completed`, C.glowA)
    divider(ctx, acX + 14, acY + 38, achW - 28, C.glowA)

    const pbX = acX + 14, pbY = acY + 45, pbW = achW - 80, pbH = 7
    rrp(ctx, pbX, pbY, pbW, pbH, 3)
    ctx.fillStyle = h2r(C.glowB, 0.30)
    ctx.fill()
    const pct = achTotal > 0 ? achDone / achTotal : 0
    if (pct > 0) {
        rrp(ctx, pbX, pbY, Math.round(pbW * pct), pbH, 3)
        const pbFill = ctx.createLinearGradient(pbX, pbY, pbX, pbY + pbH)
        pbFill.addColorStop(0, h2r(C.bladeEdge, 0.92))
        pbFill.addColorStop(0.5, C.glowA)
        pbFill.addColorStop(1, C.glowB)
        ctx.fillStyle = pbFill
        ctx.shadowColor = C.glowA
        ctx.shadowBlur = 9
        ctx.fill()
        ctx.shadowBlur = 0
    }
    ctx.font = 'bold 11px SFMedium'
    ctx.fillStyle = C.glowC
    ctx.textAlign = 'right'
    ctx.fillText(`${Math.round(pct * 100)}%`, acX + achW - 14, pbY + pbH - 1)

    const notable = (r.achievements || []).filter(a => a.progress === '100%').slice(0, 5)
    notable.forEach((ach, i) => {
        const ay = acY + 58 + i * 30
        const rowH = 24

        rrp(ctx, acX + 12, ay, achW - 24, rowH, 6)
        ctx.fillStyle = h2r(C.glowA, 0.06)
        ctx.fill()
        rrp(ctx, acX + 12, ay, achW - 24, rowH, 6)
        ctx.strokeStyle = h2r(C.glowA, 0.12)
        ctx.lineWidth = 1
        ctx.stroke()

        const midRowY = ay + rowH / 2
        ctx.font = 'bold 10px SFMedium'
        ctx.fillStyle = C.green
        ctx.textAlign = 'left'
        ctx.fillText('✓', acX + 20, midRowY + 4)

        ctx.font = '11px SFRegular'
        ctx.fillStyle = C.text1
        ctx.fillText(clamp(ctx, ach.name, achW - 88), acX + 34, midRowY + 4)

        ctx.font = '10px SFRegular'
        ctx.fillStyle = C.text2
        ctx.textAlign = 'right'
        ctx.fillText(ach.value.split('/')[0].trim(), acX + achW - 20, midRowY + 4)
    })

    // Player info
    const clX = PAD + achW + GAP, clY = curY
    rrp(ctx, clX, clY, clanW, botH, 14)
    ctx.fillStyle = h2r(C.glowB, 0.09)
    ctx.fill()
    rrp(ctx, clX, clY, clanW, botH, 14)
    ctx.strokeStyle = C.cardBorderHi
    ctx.lineWidth = 1
    ctx.stroke()

    sectionLabel(ctx, clX + 14, clY + 22, 'Player Info', '', C.glowA)
    divider(ctx, clX + 14, clY + 38, clanW - 28, C.glowA)

    const infoRows = [
        ['Clan',         r.clan?.name || 'No Clan'],
        ['League',       r.league || 'Unranked'],
        ['War Stars',    fmtNum(warStars)],
        ['Builder Hall', `BH ${r.builder_base?.stats?.builder_hall_level || '?'}`],
        ['EXP Level',    String(exp)],
    ]
    const rowStartY = clY + 46
    const rowH2 = (botH - 52) / infoRows.length

    infoRows.forEach(([lbl, val], i) => {
        const ry = rowStartY + i * rowH2
        const rInnerH = rowH2 - 5

        rrp(ctx, clX + 12, ry, clanW - 24, rInnerH, 6)
        ctx.fillStyle = h2r(C.glowA, 0.05)
        ctx.fill()
        rrp(ctx, clX + 12, ry, clanW - 24, rInnerH, 6)
        ctx.strokeStyle = h2r(C.glowA, 0.12)
        ctx.lineWidth = 1
        ctx.stroke()

        const midY = ry + rInnerH / 2 + 4
        ctx.font = '11px SFRegular'
        ctx.fillStyle = C.text2
        ctx.textAlign = 'left'
        ctx.fillText(lbl, clX + 22, midY)

        ctx.font = 'bold 12px SFMedium'
        ctx.fillStyle = C.text0
        ctx.textAlign = 'right'
        ctx.fillText(val, clX + clanW - 18, midY)
    })

    // Footer
    ctx.save()
    const fG = ctx.createLinearGradient(PAD, 0, W - PAD, 0)
    fG.addColorStop(0, 'transparent')
    fG.addColorStop(0.2, h2r(C.glowA, 0.28))
    fG.addColorStop(0.8, h2r(C.glowA, 0.28))
    fG.addColorStop(1, 'transparent')
    ctx.strokeStyle = fG
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(PAD, H - PAD - 16)
    ctx.lineTo(W - PAD, H - PAD - 16)
    ctx.stroke()
    ctx.restore()

    ctx.font = '10px SFRegular'
    ctx.fillStyle = C.text3
    ctx.textAlign = 'center'
    ctx.fillText('Hoshino Ai Bot  ·  推しの子  ·  Clash of Clans Stats', W / 2, H - PAD - 3)

    return canvas.toBuffer('image/jpeg', { quality: 96 })
}

// ── Handler ───────────────────────────────────────────────────────────────
async function handler(m, { sock }) {
    const rawTag = m.args?.[0]?.trim()

    if (!rawTag) {
        return m.reply(
            `『 ⚔️ *sᴛᴀʟᴋ ᴄᴏᴄ* ⚔️ 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `✨ *Cara pakai:*\n` +
            `\`${m.prefix}stalkcoc <tag>\`\n\n` +
            `💫 *Contoh:*\n` +
            `\`${m.prefix}stalkcoc 8PG0GQ9QU\`\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `> 💖 Ai siap cek stats COC kamu~ 🌸`
        )
    }

    const tag = rawTag.replace('#', '').toUpperCase()
    m.react('⭐')

    let data
    try {
        const res = await axios.get(`${API_URL}?id=${tag}&apikey=${API_KEY}`, {
            timeout: 20000
        })
        data = res.data
    } catch (e) {
        m.react('❌')
        return m.reply(
            `『 💥 *E R R O R* 』\n\n` +
            `> Gagal fetch data~\n` +
            `> Pastikan tag benar & coba lagi ya~ 🌸\n\n` +
            `> \`${e.message}\``
        )
    }

    if (!data?.status || !data?.result) {
        m.react('❌')
        return m.reply(
            `『 💔 *Tidak Ditemukan~* 』\n\n` +
            `> Player dengan tag \`#${tag}\` tidak ditemukan nih~\n` +
            `> Cek lagi tag-nya ya~ 💕`
        )
    }

    const r = data.result
    const ms = r.main_stats || {}

    try {
        const img = await generateCocCanvas(data)
        await sock.sendMessage(
            m.chat,
            {
                image: img,
                caption:
                    `『 🌟 *ʜᴏsʜɪɴᴏ ᴀɪ* — ᴄʟᴀsʜ ᴏꜰ ᴄʟᴀɴs 🌟 』\n` +
                    `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
                    `┌─────────────────\n` +
                    `│ ⚔️ *Name:*     ${r.name}\n` +
                    `│ 🏷️ *Tag:*      ${r.tag}\n` +
                    `│ 🏰 *TH:*       ${ms.town_hall}\n` +
                    `│ 👥 *Clan:*     ${r.clan?.name || 'No Clan'}\n` +
                    `│ 🏆 *Trophies:* ${ms.trophies}\n` +
                    `│ ⭐ *War Stars:* ${ms.war_stars}\n` +
                    `│ 📊 *EXP:*      ${ms.experience}\n` +
                    `└─────────────────\n\n` +
                    `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
                    `> 💖 Ai selalu ada buat kamu~ 🌸⭐`,
                mimetype: 'image/jpeg'
            },
            { quoted: m }
        )
        m.react('✅')
    } catch (e) {
        console.error('[StalkCOC] Canvas error:', e)
        m.react('⚠️')
        // Fallback teks
        await m.reply(
            `『 🌟 *ʜᴏsʜɪɴᴏ ᴀɪ* — ᴄᴏᴄ sᴛᴀᴛs 🌟 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `┌─────────────────\n` +
            `│ ⚔️ *Name:*     ${r.name}\n` +
            `│ 🏷️ *Tag:*      ${r.tag}\n` +
            `│ 🏰 *TH:*       ${ms.town_hall}\n` +
            `│ 👥 *Clan:*     ${r.clan?.name || 'No Clan'}\n` +
            `│ 🏆 *Trophies:* ${ms.trophies}\n` +
            `│ ⭐ *War Stars:* ${ms.war_stars}\n` +
            `│ 📊 *EXP:*      ${ms.experience}\n` +
            `└─────────────────\n\n` +
            `*Heroes:*\n` +
            (r.units?.heroes || []).map(h => `> • ${h.name} — ${h.level}`).join('\n') +
            `\n\n✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `> 💖 Ai selalu ada buat kamu~ 🌸⭐`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}