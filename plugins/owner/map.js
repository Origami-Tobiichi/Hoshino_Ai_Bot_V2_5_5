const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { createCanvas } = require('@napi-rs/canvas')

const pluginConfig = {
    name: 'map',
    alias: ['filemap', 'treemap', 'struktur'],
    category: 'owner',
    description: 'Tampilkan & kelola struktur folder bot',
    usage: '.map <mode>',
    example: '.map image\n.map text\n.map backup\n.map cekbug\n.map duplikat\n.map zombie\n.map health\n.map storage\n.map delete <file>\n.map rename <lama> <baru>\n.map preview <file>',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

// ─── Whitelist & Skip ────────────────────────────────────────────────────────
const ROOT_WHITELIST = new Set(['case', 'data', 'database', 'plugins', 'src'])
const SKIP_SUBDIRS = new Set([
    'node_modules', '.git', '.github', 'auth_info_baileys',
    'auth_info', 'session', '__pycache__', '.cache', 'tmp', 'temp', 'backup'
])

// ─── Theme ───────────────────────────────────────────────────────────────────
const THEME = {
    bg: '#07040f', bgCard: '#120a1e', primary: '#ff3ea5', secondary: '#b44fff',
    tertiary: '#ffe066', success: '#ff79c6', textPrimary: '#fff0f8',
    textSecondary: '#c9aee0', textDim: '#7a5f99', border: '#3d1f5c',
    folderColor: '#b44fff', fileColor: '#c9aee0', jsColor: '#ffe066',
    jsonColor: '#34d399', mdColor: '#8be9fd', shColor: '#fb923c', lineColor: '#3d1f5c',
    warnColor: '#ff6b35', dangerColor: '#ff3333'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
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
    ctx.globalAlpha = alpha; ctx.fillStyle = color
    if (blur > 0) { ctx.shadowColor = color; ctx.shadowBlur = blur }
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2
        const r = i % 2 === 0 ? outerR : innerR
        ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
    }
    ctx.closePath(); ctx.fill(); ctx.restore()
}

function drawStarField(ctx, W, H) {
    const stars = [
        [40, 28, 6, 0.85, THEME.tertiary], [W - 40, 28, 5, 0.75, THEME.primary],
        [W / 2, 18, 4, 0.6, THEME.secondary], [80, H - 28, 5, 0.7, THEME.primary],
        [W - 80, H - 28, 6, 0.85, THEME.tertiary], [W - 20, H / 2, 3, 0.5, THEME.secondary],
        [20, H / 2, 3, 0.5, THEME.tertiary],
    ]
    stars.forEach(([cx, cy, r, a, col]) => drawStar(ctx, cx, cy, r, r * 0.4, col, a, r * 3))
    ctx.save()
    ;[[200, 60, 1.5], [W - 200, 40, 1.5], [120, H - 60, 2], [W - 120, H - 50, 2]].forEach(([x, y, r]) => {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fillStyle = THEME.textPrimary; ctx.globalAlpha = 0.35
        ctx.shadowColor = THEME.primary; ctx.shadowBlur = 6; ctx.fill()
    })
    ctx.restore()
}

function getFileColor(name) {
    const ext = path.extname(name).toLowerCase()
    if (ext === '.js') return THEME.jsColor
    if (ext === '.json') return THEME.jsonColor
    if (ext === '.md') return THEME.mdColor
    if (ext === '.sh') return THEME.shColor
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) return THEME.primary
    return THEME.fileColor
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function getDirSize(dirPath) {
    let total = 0
    try {
        const items = fs.readdirSync(dirPath)
        for (const item of items) {
            if (SKIP_SUBDIRS.has(item)) continue
            const full = path.join(dirPath, item)
            try {
                const stat = fs.statSync(full)
                if (stat.isDirectory()) total += getDirSize(full)
                else total += stat.size
            } catch {}
        }
    } catch {}
    return total
}

function getAllFiles(dirPath, ext = null, depth = 0) {
    const results = []
    let items
    try { items = fs.readdirSync(dirPath) } catch { return results }
    for (const item of items) {
        if (item.startsWith('.') || SKIP_SUBDIRS.has(item)) continue
        const full = path.join(dirPath, item)
        let stat
        try { stat = fs.statSync(full) } catch { continue }
        if (stat.isDirectory()) {
            results.push(...getAllFiles(full, ext, depth + 1))
        } else {
            if (!ext || path.extname(item).toLowerCase() === ext) {
                results.push({ path: full, name: item, size: stat.size, mtime: stat.mtime })
            }
        }
    }
    return results
}

// ─── Build tree ───────────────────────────────────────────────────────────────
function buildTree(dirPath, depth = 0) {
    const entries = []
    let items
    try { items = fs.readdirSync(dirPath).sort() } catch { return entries }
    for (const item of items) {
        if (item.startsWith('.')) continue
        const fullPath = path.join(dirPath, item)
        let stat
        try { stat = fs.statSync(fullPath) } catch { continue }
        if (stat.isDirectory()) {
            if (depth === 0 && !ROOT_WHITELIST.has(item)) continue
            if (SKIP_SUBDIRS.has(item)) continue
            const children = buildTree(fullPath, depth + 1)
            entries.push({ name: item, type: 'dir', children, size: 0, depth })
        } else {
            entries.push({ name: item, type: 'file', size: stat.size, depth })
        }
    }
    return entries
}

function flattenTree(nodes, depth = 0, isLastArr = []) {
    const rows = []
    nodes.forEach((node, i) => {
        const isLast = i === nodes.length - 1
        rows.push({ ...node, depth, isLast, isLastArr: [...isLastArr, isLast] })
        if (node.type === 'dir' && node.children?.length) {
            rows.push(...flattenTree(node.children, depth + 1, [...isLastArr, isLast]))
        }
    })
    return rows
}

// ─── Draw canvas page ─────────────────────────────────────────────────────────
async function drawPage(rows, title, pageNum, totalPages) {
    const W = 900, ROW_H = 28, HEADER_H = 88, FOOTER_H = 52, PAD = 24
    const H = HEADER_H + rows.length * ROW_H + FOOTER_H + PAD
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')

    const bgGrad = ctx.createLinearGradient(0, 0, W, H)
    bgGrad.addColorStop(0, '#07040f'); bgGrad.addColorStop(0.5, '#0e0619'); bgGrad.addColorStop(1, '#07040f')
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H)
    ;[
        [0, 0, 400, `${THEME.primary}20`], [W, H, 500, `${THEME.secondary}18`],
        [W / 2, H / 2, 350, `${THEME.border}30`]
    ].forEach(([x, y, r, col]) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, col); g.addColorStop(1, 'transparent')
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    })
    ctx.globalAlpha = 0.02; ctx.strokeStyle = THEME.primary; ctx.lineWidth = 0.5
    for (let i = 0; i < H; i += 28) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke()
    }
    ctx.globalAlpha = 1
    drawStarField(ctx, W, H)

    drawStar(ctx, 30, 38, 13, 5, THEME.tertiary, 1, 18)
    ctx.save()
    ctx.font = 'bold 22px Arial'; ctx.fillStyle = THEME.textPrimary
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
    ctx.shadowColor = THEME.primary; ctx.shadowBlur = 16
    ctx.fillText('FILE MAP', 56, 32); ctx.shadowBlur = 0

    roundRect(ctx, 56, 48, ctx.measureText(title).width + 24, 24, 12)
    ctx.fillStyle = `${THEME.secondary}30`; ctx.fill()
    ctx.strokeStyle = `${THEME.secondary}60`; ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle = THEME.secondary; ctx.font = 'bold 12px Arial'
    ctx.textBaseline = 'middle'; ctx.shadowColor = THEME.secondary; ctx.shadowBlur = 8
    ctx.fillText(title, 68, 60); ctx.shadowBlur = 0

    const badge = `${pageNum} / ${totalPages}`
    const bw = ctx.measureText(badge).width + 20
    roundRect(ctx, W - bw - 20, 14, bw, 24, 12)
    ctx.fillStyle = `${THEME.primary}25`; ctx.fill()
    ctx.strokeStyle = `${THEME.primary}60`; ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle = THEME.primary; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'right'
    ctx.shadowColor = THEME.primary; ctx.shadowBlur = 8
    ctx.fillText(badge, W - 20 - 10, 26); ctx.shadowBlur = 0

    const files = rows.filter(r => r.type === 'file').length
    const dirs = rows.filter(r => r.type === 'dir').length
    ctx.fillStyle = THEME.textSecondary; ctx.font = '10px Arial'; ctx.textAlign = 'right'
    ctx.fillText(`${dirs} folder  ${files} file`, W - 20, 52)
    ctx.restore()

    const sepG = ctx.createLinearGradient(20, 0, W - 20, 0)
    sepG.addColorStop(0, 'transparent'); sepG.addColorStop(0.3, THEME.primary)
    sepG.addColorStop(0.5, THEME.tertiary); sepG.addColorStop(0.7, THEME.secondary)
    sepG.addColorStop(1, 'transparent')
    ctx.strokeStyle = sepG; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(20, HEADER_H - 4); ctx.lineTo(W - 20, HEADER_H - 4); ctx.stroke()
    drawStar(ctx, W / 2, HEADER_H - 4, 6, 2.5, THEME.tertiary, 1, 10)

    const INDENT = 18, LEFT = 28
    rows.forEach((row, i) => {
        const y = HEADER_H + PAD / 2 + i * ROW_H
        const x = LEFT + row.depth * INDENT

        if (i % 2 === 0) {
            ctx.fillStyle = `${THEME.border}22`
            ctx.fillRect(0, y - 1, W, ROW_H - 2)
        }

        // Size warning highlight
        if (row.type === 'file' && row.size > 500 * 1024) {
            ctx.fillStyle = `${THEME.warnColor}15`
            ctx.fillRect(0, y - 1, W, ROW_H - 2)
        }
        if (row.type === 'file' && row.size > 2 * 1024 * 1024) {
            ctx.fillStyle = `${THEME.dangerColor}20`
            ctx.fillRect(0, y - 1, W, ROW_H - 2)
        }

        ctx.strokeStyle = THEME.lineColor; ctx.lineWidth = 1
        for (let d = 0; d < row.depth; d++) {
            const lx = LEFT + d * INDENT + 8
            if (!row.isLastArr[d]) {
                ctx.globalAlpha = 0.5
                ctx.beginPath(); ctx.moveTo(lx, y - 1); ctx.lineTo(lx, y + ROW_H - 2); ctx.stroke()
                ctx.globalAlpha = 1
            }
        }
        if (row.depth > 0) {
            const lx = LEFT + (row.depth - 1) * INDENT + 8
            const midY = y + ROW_H / 2 - 1
            ctx.globalAlpha = 0.5; ctx.beginPath()
            ctx.moveTo(lx, y - 1); ctx.lineTo(lx, midY)
            ctx.moveTo(lx, midY); ctx.lineTo(x + 2, midY)
            ctx.stroke(); ctx.globalAlpha = 1
        }

        const iconX = x + 4, midY = y + ROW_H / 2 - 1
        if (row.type === 'dir') {
            ctx.save()
            roundRect(ctx, iconX, midY - 7, 14, 12, 3)
            ctx.fillStyle = `${THEME.folderColor}35`; ctx.fill()
            ctx.strokeStyle = `${THEME.folderColor}80`; ctx.lineWidth = 1; ctx.stroke()
            ctx.fillStyle = `${THEME.folderColor}60`
            ctx.fillRect(iconX + 2, midY - 9, 6, 3)
            ctx.restore()
        } else {
            const fc = getFileColor(row.name)
            ctx.save()
            roundRect(ctx, iconX + 1, midY - 7, 12, 12, 2)
            ctx.fillStyle = `${fc}25`; ctx.fill()
            ctx.strokeStyle = `${fc}70`; ctx.lineWidth = 1; ctx.stroke()
            ctx.beginPath(); ctx.arc(iconX + 7, midY, 2.5, 0, Math.PI * 2)
            ctx.fillStyle = fc; ctx.shadowColor = fc; ctx.shadowBlur = 6; ctx.fill()
            ctx.restore()
        }

        const labelX = iconX + 20
        ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
        if (row.type === 'dir') {
            ctx.font = 'bold 12px Arial'; ctx.fillStyle = THEME.folderColor
            ctx.shadowColor = THEME.secondary; ctx.shadowBlur = 6
            ctx.fillText(row.name + '/', labelX, midY)
        } else {
            const fc = getFileColor(row.name)
            const sizeWarn = row.size > 2 * 1024 * 1024 ? THEME.dangerColor : row.size > 500 * 1024 ? THEME.warnColor : null
            ctx.font = '11px Arial'
            ctx.fillStyle = sizeWarn || (fc === THEME.fileColor ? THEME.textPrimary : fc)
            ctx.shadowColor = sizeWarn || fc; ctx.shadowBlur = sizeWarn ? 8 : fc !== THEME.fileColor ? 4 : 0
            ctx.fillText(row.name, labelX, midY)
        }
        if (row.type === 'file' && row.size > 0) {
            ctx.font = '9px Arial'
            ctx.fillStyle = row.size > 2 * 1024 * 1024 ? THEME.dangerColor : row.size > 500 * 1024 ? THEME.warnColor : THEME.textDim
            ctx.shadowBlur = 0; ctx.textAlign = 'right'
            ctx.fillText(formatSize(row.size), W - 20, midY)
        }
        ctx.restore()
    })

    const footerY = H - FOOTER_H
    const footerGrad = ctx.createLinearGradient(0, footerY, W, H)
    footerGrad.addColorStop(0, `${THEME.primary}20`)
    footerGrad.addColorStop(0.5, `${THEME.secondary}18`)
    footerGrad.addColorStop(1, `${THEME.primary}20`)
    ctx.fillStyle = footerGrad; ctx.fillRect(0, footerY, W, FOOTER_H)
    ctx.strokeStyle = `${THEME.primary}45`; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, footerY); ctx.lineTo(W, footerY); ctx.stroke()
    drawStar(ctx, 60, footerY + 26, 5, 2, THEME.tertiary, 0.8, 8)
    drawStar(ctx, W - 60, footerY + 26, 5, 2, THEME.tertiary, 0.8, 8)
    ctx.save()
    ctx.font = 'bold 13px Arial'; ctx.fillStyle = THEME.primary
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.shadowColor = THEME.primary; ctx.shadowBlur = 14
    ctx.fillText(`★  FILE STRUCTURE MAP  ★`, W / 2, footerY + 18); ctx.shadowBlur = 0
    ctx.font = 'italic 10px Arial'; ctx.fillStyle = THEME.textSecondary
    ctx.fillText(`page ${pageNum} of ${totalPages}  —  ${new Date().toLocaleDateString('id-ID')}`, W / 2, footerY + 36)
    ctx.restore()

    return canvas.toBuffer('image/png')
}

// ─── Storage canvas ───────────────────────────────────────────────────────────
async function drawStorage(folders) {
    const W = 900, PAD = 40, BAR_H = 50, GAP = 20
    const H = 120 + folders.length * (BAR_H + GAP) + 80
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')

    const bgGrad = ctx.createLinearGradient(0, 0, W, H)
    bgGrad.addColorStop(0, '#07040f'); bgGrad.addColorStop(1, '#0e0619')
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H)

    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 600)
    g.addColorStop(0, `${THEME.primary}15`); g.addColorStop(1, 'transparent')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)

    drawStarField(ctx, W, H)

    drawStar(ctx, 30, 38, 13, 5, THEME.tertiary, 1, 18)
    ctx.save()
    ctx.font = 'bold 24px Arial'; ctx.fillStyle = THEME.textPrimary
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
    ctx.shadowColor = THEME.primary; ctx.shadowBlur = 16
    ctx.fillText('STORAGE USAGE', 56, 38); ctx.shadowBlur = 0
    ctx.font = '12px Arial'; ctx.fillStyle = THEME.textSecondary
    ctx.fillText(`Total: ${formatSize(folders.reduce((a, f) => a + f.size, 0))}`, 56, 62)
    ctx.restore()

    const maxSize = Math.max(...folders.map(f => f.size), 1)
    const barColors = [THEME.primary, THEME.secondary, THEME.tertiary, THEME.success, THEME.mdColor, THEME.jsonColor, THEME.shColor]

    folders.forEach((folder, i) => {
        const y = 100 + i * (BAR_H + GAP)
        const pct = folder.size / maxSize
        const barW = Math.max((W - PAD * 2 - 160) * pct, 4)
        const col = barColors[i % barColors.length]

        ctx.save()
        ctx.font = 'bold 13px Arial'; ctx.fillStyle = THEME.textSecondary
        ctx.textBaseline = 'middle'; ctx.textAlign = 'right'
        ctx.fillText(folder.name, PAD + 140, y + BAR_H / 2)

        roundRect(ctx, PAD + 150, y, W - PAD * 2 - 150, BAR_H, 10)
        ctx.fillStyle = `${THEME.border}40`; ctx.fill()

        roundRect(ctx, PAD + 150, y, barW, BAR_H, 10)
        const barGrad = ctx.createLinearGradient(PAD + 150, 0, PAD + 150 + barW, 0)
        barGrad.addColorStop(0, `${col}90`); barGrad.addColorStop(1, col)
        ctx.fillStyle = barGrad; ctx.fill()
        ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.fill()

        ctx.font = 'bold 11px Arial'; ctx.fillStyle = THEME.textPrimary
        ctx.textAlign = 'left'; ctx.shadowBlur = 0
        ctx.fillText(formatSize(folder.size), PAD + 150 + barW + 10, y + BAR_H / 2)

        ctx.font = '10px Arial'; ctx.fillStyle = THEME.textDim
        ctx.fillText(`${folder.fileCount} file`, PAD + 150 + barW + 10, y + BAR_H / 2 + 14)
        ctx.restore()
    })

    const footerY = H - 60
    ctx.save()
    ctx.font = 'bold 13px Arial'; ctx.fillStyle = THEME.primary
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.shadowColor = THEME.primary; ctx.shadowBlur = 14
    ctx.fillText(`★  STORAGE MAP  ★`, W / 2, footerY + 20); ctx.shadowBlur = 0
    ctx.font = 'italic 10px Arial'; ctx.fillStyle = THEME.textSecondary
    ctx.fillText(new Date().toLocaleDateString('id-ID'), W / 2, footerY + 38)
    ctx.restore()

    return canvas.toBuffer('image/png')
}

// ─── Text tree ────────────────────────────────────────────────────────────────
function buildTextTree(nodes, prefix = '') {
    let out = ''
    nodes.forEach((node, i) => {
        const isLast = i === nodes.length - 1
        const connector = isLast ? '└─ ' : '├─ '
        const childPrefix = prefix + (isLast ? '    ' : '│   ')
        if (node.type === 'dir') {
            out += `${prefix}${connector}📁 *${node.name}/*\n`
            if (node.children?.length) out += buildTextTree(node.children, childPrefix)
        } else {
            const ext = path.extname(node.name).toLowerCase()
            const icon = ext === '.js' ? '📜' : ext === '.json' ? '📋' : ext === '.md' ? '📝' :
                ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? '🖼️' : '📄'
            const sizeStr = node.size > 0 ? ` _(${formatSize(node.size)})_` : ''
            const warn = node.size > 2 * 1024 * 1024 ? ' ⛔' : node.size > 500 * 1024 ? ' ⚠️' : ''
            out += `${prefix}${connector}${icon} ${node.name}${sizeStr}${warn}\n`
        }
    })
    return out
}

// ─── Handler ──────────────────────────────────────────────────────────────────
async function handler(m, { sock }) {
    const args = m.args
    const mode = args[0]?.toLowerCase()
    const rootDir = process.cwd()

    if (!mode) {
        return m.reply(
            `🌟 *ꜰɪʟᴇ ᴍᴀᴘ* — Hoshino Ai Bot\n\n` +
            `╭┈┈⬡「 📌 *ᴍᴏᴅᴇ* 」\n` +
            `┃ 🖼️  \`.map image\` — Canvas struktur folder\n` +
            `┃ 📝 \`.map text\` — Teks tree lengkap\n` +
            `┃ 📦 \`.map backup [folder]\` — Zip & kirim folder\n` +
            `┃ 🐛 \`.map cekbug\` — Scan syntax error plugin\n` +
            `┃ ⚡ \`.map duplikat\` — Deteksi command bentrok\n` +
            `┃ 👻 \`.map zombie\` — Cari file tidak terpakai\n` +
            `┃ 💊 \`.map health\` — Plugin health check\n` +
            `┃ 💾 \`.map storage\` — Canvas storage per folder\n` +
            `┃ 🗑️  \`.map delete <path>\` — Hapus file\n` +
            `┃ ✏️  \`.map rename <lama> <baru>\` — Rename file\n` +
            `┃ 👁️  \`.map preview <path>\` — Lihat isi file\n` +
            `╰┈┈┈┈┈┈┈┈┈┈⬡\n\n` +
            `> ✨ Pilih mode yang kamu butuhkan ya~`
        )
    }

    // ── IMAGE ────────────────────────────────────────────────────────────────
    if (mode === 'image') {
        await m.react('⭐')
        await m.reply(`_Sebentar ya~ lagi aku buat canvas-nya~ 💕✨_`)
        const tree = buildTree(rootDir)
        const pages = []
        for (const node of tree) {
            if (node.type === 'dir') {
                const rows = flattenTree([node])
                const CHUNK_SIZE = 60
                for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
                    pages.push({ title: `📁 ${node.name}/`, rows: rows.slice(i, i + CHUNK_SIZE) })
                }
            }
        }
        const rootFiles = tree.filter(n => n.type === 'file')
        if (rootFiles.length) pages.push({ title: `📄 root files`, rows: flattenTree(rootFiles) })
        if (!pages.length) return m.reply(`❌ Nggak ada yang bisa ditampilkan~`)

        for (let i = 0; i < pages.length; i++) {
            const { title, rows } = pages[i]
            try {
                const buf = await drawPage(rows, title, i + 1, pages.length)
                await sock.sendMessage(m.chat, {
                    image: buf,
                    caption: i === 0
                        ? `🗺️ *FILE STRUCTURE MAP*\n╭┈┈⬡\n┃ 📦 ${pages.length} section\n┃ 📁 ${tree.filter(n => n.type === 'dir').length} folder utama\n┃ ⚠️ File >500KB di-highlight kuning\n┃ ⛔ File >2MB di-highlight merah\n╰┈┈⬡\n\n★ _Ini peta lengkap botnya ya~_ ✨💕`
                        : `_${title} — halaman ${i + 1}/${pages.length}_`
                }, { quoted: i === 0 ? m : undefined })
                await new Promise(r => setTimeout(r, 2500))
            } catch (e) {
                await m.reply(`❌ *Gomen ne~* Gagal render *${title}*: ${e.message} 🥺`)
            }
        }
        return m.react('✅')
    }

    // ── TEXT ─────────────────────────────────────────────────────────────────
    if (mode === 'text') {
        await m.react('⭐')
        await m.reply(`_Bentar ya~ aku scanning semua file dulu~_ 🔍✨`)
        const tree = buildTree(rootDir)
        const rootName = path.basename(rootDir)
        let out = `📁 *${rootName}/* _(root)_\n`
        out += buildTextTree(tree)
        const chunks = []
        let chunk = ''
        for (const line of out.split('\n')) {
            if ((chunk + line + '\n').length > 3500) {
                chunks.push(chunk.trim()); chunk = ''
            }
            chunk += line + '\n'
        }
        if (chunk.trim()) chunks.push(chunk.trim())
        for (let i = 0; i < chunks.length; i++) {
            const header = i === 0 ? `🗺️ *FILE MAP — ${rootName}*\n\`\`\`\n` : `\`\`\`\n`
            const footer = i === chunks.length - 1
                ? `\n\`\`\`\n★ _Selesai~ itu semua struktur botnya!_ ✨`
                : `\n\`\`\`\n_...lanjut halaman ${i + 2}..._`
            await sock.sendMessage(m.chat, { text: header + chunks[i] + footer }, { quoted: m })
            await new Promise(r => setTimeout(r, 2500))
        }
        return
    }

    // ── BACKUP ───────────────────────────────────────────────────────────────
    if (mode === 'backup') {
        await m.react('⭐')
        const targetFolder = args[1] || null
        const tmpDir = path.join(rootDir, 'tmp')
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

        const timestamp = Date.now()
        const zipName = `backup_${targetFolder || 'full'}_${timestamp}.zip`
        const zipPath = path.join(tmpDir, zipName)

        await m.reply(`_⏳ Lagi nge-zip${targetFolder ? ` folder \`${targetFolder}\`` : ' semua folder'}... Tunggu ya~_`)

        try {
            let zipTarget
            if (targetFolder) {
                const targetPath = path.join(rootDir, targetFolder)
                if (!fs.existsSync(targetPath)) return m.reply(`❌ Folder \`${targetFolder}\` tidak ditemukan~`)
                zipTarget = targetFolder
            } else {
                zipTarget = [...ROOT_WHITELIST].join(' ')
            }

            execSync(`cd "${rootDir}" && zip -r "${zipPath}" ${zipTarget} 2>/dev/null || zip -r "${zipPath}" ${zipTarget}`, { timeout: 120000 })

            const stat = fs.statSync(zipPath)
            await sock.sendMessage(m.chat, {
                document: fs.readFileSync(zipPath),
                mimetype: 'application/zip',
                fileName: zipName,
                caption:
                    `╭┈┈⬡「 📦 *ʙᴀᴄᴋᴜᴘ sᴇʟᴇsᴀɪ* 」\n` +
                    `┃ 📁 Target: \`${targetFolder || 'semua folder'}\`\n` +
                    `┃ 💾 Size: ${formatSize(stat.size)}\n` +
                    `┃ 📅 ${new Date().toLocaleString('id-ID')}\n` +
                    `╰┈┈⬡\n\n> 💖 Backup selesai~ simpan baik-baik ya~`
            }, { quoted: m })

            try { fs.unlinkSync(zipPath) } catch {}
            m.react('✅')
        } catch (e) {
            try { fs.unlinkSync(zipPath) } catch {}
            m.react('❌')
            m.reply(`❌ *Gomen ne~* Backup gagal: ${e.message} 🥺`)
        }
        return
    }

    // ── CEK BUG ──────────────────────────────────────────────────────────────
    if (mode === 'cekbug') {
        await m.react('⭐')
        await m.reply(`_🔍 Scanning syntax error semua plugin... Tunggu ya~_`)

        const jsFiles = getAllFiles(path.join(rootDir, 'plugins'), '.js')
        const errors = []
        let checked = 0

        for (const file of jsFiles) {
            try {
                execSync(`node --check "${file.path}"`, { timeout: 10000 })
            } catch (e) {
                errors.push({
                    file: file.path.replace(rootDir + '/', ''),
                    error: e.stderr?.toString()?.split('\n')[0] || e.message
                })
            }
            checked++
        }

        if (errors.length === 0) {
            return m.reply(
                `╭┈┈⬡「 ✅ *ᴄᴇᴋ ʙᴜɢ* 」\n` +
                `┃ 📊 Diperiksa: ${checked} file\n` +
                `┃ ✅ Tidak ada syntax error!\n` +
                `╰┈┈⬡\n\n> 🌸 Semua plugin bersih~ Ai bangga!`
            )
        }

        let text = `╭┈┈⬡「 🐛 *ᴄᴇᴋ ʙᴜɢ* 」\n`
        text += `┃ 📊 Diperiksa: ${checked} file\n`
        text += `┃ ❌ Error ditemukan: ${errors.length}\n`
        text += `╰┈┈⬡\n\n`
        errors.forEach((e, i) => {
            text += `*${i + 1}. ${e.file}*\n\`\`\`${e.error.slice(0, 200)}\`\`\`\n\n`
        })
        return m.reply(text.trim())
    }

    // ── DUPLIKAT ─────────────────────────────────────────────────────────────
    if (mode === 'duplikat') {
        await m.react('⭐')
        await m.reply(`_⚡ Scanning command duplikat... Tunggu ya~_`)

        const jsFiles = getAllFiles(path.join(rootDir, 'plugins'), '.js')
        const commandMap = {}
        const conflicts = []

        for (const file of jsFiles) {
            try {
                const content = fs.readFileSync(file.path, 'utf8')
                const nameMatch = content.match(/name\s*[:=]\s*[\[']([^\]'"]+)[\]']/)
                const aliasMatches = [...content.matchAll(/alias\s*[:=]\s*\[([^\]]+)\]/g)]

                const commands = []
                if (nameMatch) {
                    const names = nameMatch[1].split(/[,'"]+/).map(s => s.trim()).filter(Boolean)
                    commands.push(...names)
                }
                for (const am of aliasMatches) {
                    const aliases = am[1].split(/[,'"]+/).map(s => s.trim()).filter(Boolean)
                    commands.push(...aliases)
                }

                const relPath = file.path.replace(rootDir + '/', '')
                for (const cmd of commands) {
                    if (!cmd) continue
                    if (commandMap[cmd]) {
                        conflicts.push({ cmd, files: [commandMap[cmd], relPath] })
                    } else {
                        commandMap[cmd] = relPath
                    }
                }
            } catch {}
        }

        if (conflicts.length === 0) {
            return m.reply(
                `╭┈┈⬡「 ✅ *ᴅᴜᴘʟɪᴋᴀᴛ* 」\n` +
                `┃ 📊 Total command: ${Object.keys(commandMap).length}\n` +
                `┃ ✅ Tidak ada command bentrok!\n` +
                `╰┈┈⬡\n\n> 🌸 Semua command unik~ Ai lega!`
            )
        }

        let text = `╭┈┈⬡「 ⚡ *ᴅᴜᴘʟɪᴋᴀᴛ ᴄᴏᴍᴍᴀɴᴅ* 」\n`
        text += `┃ ❌ Bentrok: ${conflicts.length} command\n`
        text += `╰┈┈⬡\n\n`
        conflicts.forEach((c, i) => {
            text += `*${i + 1}. \`.${c.cmd}\`*\n`
            c.files.forEach(f => text += `   • \`${f}\`\n`)
            text += '\n'
        })
        return m.reply(text.trim())
    }

    // ── ZOMBIE ───────────────────────────────────────────────────────────────
    if (mode === 'zombie') {
        await m.react('⭐')
        await m.reply(`_👻 Scanning file zombie... Ini agak lama ya~_`)

        const allJs = getAllFiles(rootDir, '.js')
        const allPaths = allJs.map(f => f.path)

        const requiredFiles = new Set()
        for (const file of allJs) {
            try {
                const content = fs.readFileSync(file.path, 'utf8')
                const requires = [...content.matchAll(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)]
                for (const r of requires) {
                    let reqPath = r[1]
                    if (!reqPath.startsWith('.')) continue
                    const resolved = path.resolve(path.dirname(file.path), reqPath)
                    const withExt = resolved.endsWith('.js') ? resolved : resolved + '.js'
                    requiredFiles.add(withExt)
                    requiredFiles.add(resolved)
                }
            } catch {}
        }

        const entryFiles = new Set([
            path.join(rootDir, 'index.js'),
            path.join(rootDir, 'src', 'handler.js'),
            path.join(rootDir, 'src', 'connection.js'),
        ])

        const zombies = allPaths.filter(p => {
            if (entryFiles.has(p)) return false
            if (p.includes('/plugins/')) return false
            if (p.includes('/case/')) return false
            return !requiredFiles.has(p)
        })

        if (zombies.length === 0) {
            return m.reply(
                `╭┈┈⬡「 ✅ *ᴢᴏᴍʙɪᴇ* 】\n` +
                `┃ ✅ Tidak ada file zombie!\n` +
                `╰┈┈⬡\n\n> 🌸 Semua file terpakai~ bersih!`
            )
        }

        let text = `╭┈┈⬡「 👻 *ꜰɪʟᴇ ᴢᴏᴍʙɪᴇ* 」\n`
        text += `┃ ❓ Tidak di-require: ${zombies.length} file\n`
        text += `╰┈┈⬡\n\n`
        zombies.forEach((z, i) => {
            text += `${i + 1}. \`${z.replace(rootDir + '/', '')}\`\n`
        })
        text += `\n> ⚠️ _Cek dulu sebelum hapus ya~ mungkin di-load dinamis_`
        return m.reply(text.trim())
    }

    // ── HEALTH ───────────────────────────────────────────────────────────────
    if (mode === 'health') {
        await m.react('⭐')
        await m.reply(`_💊 Scanning plugin health... Tunggu ya~_`)

        const jsFiles = getAllFiles(path.join(rootDir, 'plugins'), '.js')
        const issues = []
        let healthy = 0

        for (const file of jsFiles) {
            const relPath = file.path.replace(rootDir + '/', '')
            const fileIssues = []

            try {
                const content = fs.readFileSync(file.path, 'utf8')

                // Cek syntax
                try {
                    execSync(`node --check "${file.path}"`, { timeout: 5000 })
                } catch (e) {
                    fileIssues.push('❌ Syntax error')
                }

                // Cek module.exports
                if (!content.includes('module.exports')) {
                    fileIssues.push('⚠️ Tidak ada module.exports')
                }

                // Cek pluginConfig / config
                if (!content.includes('pluginConfig') && !content.includes('config')) {
                    fileIssues.push('⚠️ Tidak ada pluginConfig')
                }

                // Cek handler
                if (!content.includes('async function handler') && !content.includes('handler')) {
                    fileIssues.push('⚠️ Tidak ada handler')
                }

                if (fileIssues.length === 0) {
                    healthy++
                } else {
                    issues.push({ file: relPath, issues: fileIssues })
                }
            } catch (e) {
                issues.push({ file: relPath, issues: [`❌ Gagal baca: ${e.message}`] })
            }
        }

        let text = `╭┈┈⬡「 💊 *ᴘʟᴜɢɪɴ ʜᴇᴀʟᴛʜ* 」\n`
        text += `┃ ✅ Sehat: ${healthy} plugin\n`
        text += `┃ ❌ Bermasalah: ${issues.length} plugin\n`
        text += `┃ 📊 Total: ${healthy + issues.length} plugin\n`
        text += `╰┈┈⬡\n\n`

        if (issues.length === 0) {
            text += `> 🌸 Semua plugin sehat~ Ai senang!`
        } else {
            issues.slice(0, 20).forEach((p, i) => {
                text += `*${i + 1}. ${p.file}*\n`
                p.issues.forEach(iss => text += `   ${iss}\n`)
                text += '\n'
            })
            if (issues.length > 20) text += `_...dan ${issues.length - 20} plugin lainnya_`
        }
        return m.reply(text.trim())
    }

    // ── STORAGE ───────────────────────────────────────────────────────────────
    if (mode === 'storage') {
        await m.react('⭐')
        await m.reply(`_💾 Menghitung storage... Tunggu ya~_`)

        const folders = []
        const checkDirs = [...ROOT_WHITELIST, 'storage', 'tmp', 'temp']

        for (const dirName of checkDirs) {
            const dirPath = path.join(rootDir, dirName)
            if (!fs.existsSync(dirPath)) continue
            const size = getDirSize(dirPath)
            const files = getAllFiles(dirPath)
            folders.push({ name: dirName, size, fileCount: files.length })
        }

        folders.sort((a, b) => b.size - a.size)

        const buf = await drawStorage(folders)
        await sock.sendMessage(m.chat, {
            image: buf,
            caption:
                `╭┈┈⬡「 💾 *sᴛᴏʀᴀɢᴇ ᴜsᴀɢᴇ* 」\n` +
                `┃ 📊 ${folders.length} folder dipantau\n` +
                `┃ 💾 Total: ${formatSize(folders.reduce((a, f) => a + f.size, 0))}\n` +
                `╰┈┈⬡\n\n> 🌸 Ini breakdown storage botnya~`
        }, { quoted: m })
        return m.react('✅')
    }

    // ── DELETE ────────────────────────────────────────────────────────────────
    if (mode === 'delete') {
        const target = args.slice(1).join(' ').trim()
        if (!target) return m.reply(`❌ Sebutkan path file yang mau dihapus ya~\nContoh: \`.map delete plugins/tools/test.js\``)

        const targetPath = path.join(rootDir, target)

        if (!fs.existsSync(targetPath)) return m.reply(`❌ File \`${target}\` tidak ditemukan~`)

        const stat = fs.statSync(targetPath)
        if (stat.isDirectory()) return m.reply(`❌ Ini folder, bukan file~ Ai tidak bisa hapus folder~`)

        try {
            fs.unlinkSync(targetPath)
            m.react('✅')
            return m.reply(
                `╭┈┈⬡「 🗑️ *ᴅᴇʟᴇᴛᴇ* 」\n` +
                `┃ ✅ File berhasil dihapus!\n` +
                `┃ 📄 \`${target}\`\n` +
                `┃ 💾 ${formatSize(stat.size)}\n` +
                `╰┈┈⬡\n\n> 💖 File sudah dihapus ya~ hati-hati~`
            )
        } catch (e) {
            m.react('❌')
            return m.reply(`❌ *Gomen ne~* Gagal hapus: ${e.message} 🥺`)
        }
    }

    // ── RENAME ────────────────────────────────────────────────────────────────
    if (mode === 'rename') {
        const parts = args.slice(1)
        if (parts.length < 2) return m.reply(`❌ Format: \`.map rename <path lama> <path baru>\`\nContoh: \`.map rename plugins/tools/test.js plugins/tools/test2.js\``)

        const oldPath = path.join(rootDir, parts[0])
        const newPath = path.join(rootDir, parts[1])

        if (!fs.existsSync(oldPath)) return m.reply(`❌ File \`${parts[0]}\` tidak ditemukan~`)
        if (fs.existsSync(newPath)) return m.reply(`❌ File \`${parts[1]}\` sudah ada~ ganti nama lain ya~`)

        try {
            const newDir = path.dirname(newPath)
            if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true })
            fs.renameSync(oldPath, newPath)
            m.react('✅')
            return m.reply(
                `╭┈┈⬡「 ✏️ *ʀᴇɴᴀᴍᴇ* 」\n` +
                `┃ ✅ File berhasil direname!\n` +
                `┃ 📄 Dari: \`${parts[0]}\`\n` +
                `┃ 📄 Ke: \`${parts[1]}\`\n` +
                `╰┈┈⬡\n\n> 💖 Done~ nama filenya udah diganti~`
            )
        } catch (e) {
            m.react('❌')
            return m.reply(`❌ *Gomen ne~* Gagal rename: ${e.message} 🥺`)
        }
    }

    // ── PREVIEW ───────────────────────────────────────────────────────────────
    if (mode === 'preview') {
        const target = args.slice(1).join(' ').trim()
        if (!target) return m.reply(`❌ Sebutkan path file yang mau dilihat ya~\nContoh: \`.map preview plugins/tools/ping.js\``)

        const targetPath = path.join(rootDir, target)
        if (!fs.existsSync(targetPath)) return m.reply(`❌ File \`${target}\` tidak ditemukan~`)

        const stat = fs.statSync(targetPath)
        if (stat.isDirectory()) return m.reply(`❌ Ini folder, bukan file~`)

        const ext = path.extname(target).toLowerCase()
        const mediaExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.mp3', '.ogg']

        if (mediaExts.includes(ext)) {
            const isVideo = ['.mp4'].includes(ext)
            const isAudio = ['.mp3', '.ogg'].includes(ext)
            const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)

            try {
                if (isImage) {
                    await sock.sendMessage(m.chat, {
                        image: fs.readFileSync(targetPath),
                        caption: `🖼️ *${target}* _(${formatSize(stat.size)})_`
                    }, { quoted: m })
                } else if (isVideo) {
                    await sock.sendMessage(m.chat, {
                        video: fs.readFileSync(targetPath),
                        caption: `🎬 *${target}* _(${formatSize(stat.size)})_`
                    }, { quoted: m })
                } else if (isAudio) {
                    await sock.sendMessage(m.chat, {
                        audio: fs.readFileSync(targetPath),
                        mimetype: 'audio/mpeg'
                    }, { quoted: m })
                }
                return m.react('✅')
            } catch (e) {
                return m.reply(`❌ *Gomen ne~* Gagal kirim media: ${e.message} 🥺`)
            }
        }

        // File teks
        try {
            const content = fs.readFileSync(targetPath, 'utf8')
            const preview = content.slice(0, 3000)
            const lang = ext === '.js' ? 'js' : ext === '.json' ? 'json' : ext === '.md' ? '' : ''

            await sock.sendMessage(m.chat, {
                text:
                    `👁️ *PREVIEW: ${target}*\n` +
                    `💾 Size: ${formatSize(stat.size)} | 📝 ${content.split('\n').length} baris\n\n` +
                    `\`\`\`${lang}\n${preview}\n\`\`\`` +
                    (content.length > 3000 ? `\n\n_...dipotong, total ${content.length} karakter_` : '')
            }, { quoted: m })
            return m.react('✅')
        } catch (e) {
            return m.reply(`❌ *Gomen ne~* Gagal baca file: ${e.message} 🥺`)
        }
    }

    return m.reply(`❌ Mode \`${mode}\` tidak dikenal~\nKetik \`.map\` untuk lihat semua mode yang tersedia~`)
}

module.exports = { config: pluginConfig, handler }