const fs   = require('fs')
const path = require('path')

const pluginConfig = {
    name: 'plugindiff',
    alias: ['diffplugin', 'pdiff', 'plugincompare', 'cekdiff'],
    category: 'owner',
    description: 'Compare perbedaan antar versi plugin dari backup — lihat baris apa yang berubah',
    usage: '.plugindiff <nama> [versi1] [versi2]',
    example: '.plugindiff addplugin | .plugindiff addplugin 1 2 | .plugindiff addplugin latest prev',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

// ─── Konstanta path ───────────────────────────────────────────────────────────
const ROOT        = process.cwd()
const BACKUP_DIR  = path.join(ROOT, 'backup', 'plugins')
const PLUGINS_DIR = path.join(ROOT, 'plugins')

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format timestamp dari nama file backup → string manusiawi */
function fmtTimestamp(ts) {
    // format: 2026-03-31T15-22-31  →  31 Mar 2026, 15:22
    try {
        const isoLike = ts.replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3')
        const d = new Date(isoLike)
        if (isNaN(d)) return ts
        return d.toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false
        })
    } catch { return ts }
}

/** Ambil semua versi backup untuk satu plugin, sorted terlama → terbaru */
function getVersions(pluginName) {
    if (!fs.existsSync(BACKUP_DIR)) return []
    const prefix = `${pluginName.toLowerCase()}_`
    return fs.readdirSync(BACKUP_DIR)
        .filter(f => f.toLowerCase().startsWith(prefix) && f.endsWith('.js'))
        .sort() // ISO timestamp sort = chronological
        .map((f, i) => {
            const ts = f.slice(prefix.length, -3) // strip prefix & .js
            return { index: i + 1, filename: f, timestamp: ts, label: fmtTimestamp(ts) }
        })
}

/** Cari file plugin aktif di semua subfolder */
function findActiveFile(pluginName) {
    if (!fs.existsSync(PLUGINS_DIR)) return null
    const dirs = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory()).map(d => d.name)
    for (const dir of dirs) {
        const p = path.join(PLUGINS_DIR, dir, `${pluginName}.js`)
        if (fs.existsSync(p)) return p
    }
    return null
}

// ─── Diff engine ─────────────────────────────────────────────────────────────

/**
 * Minimal line diff — Myers-style simplified:
 * Return array of { type: 'add'|'del'|'same', line }
 */
function diffLines(oldText, newText) {
    const A = oldText.split('\n')
    const B = newText.split('\n')

    // LCS-based diff menggunakan DP (capped biar ga OOM di file besar)
    const MAX = 300 // max baris per sisi yang di-diff detail
    const a = A.slice(0, MAX)
    const b = B.slice(0, MAX)

    const m = a.length
    const n = b.length
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i-1] === b[j-1]
                ? dp[i-1][j-1] + 1
                : Math.max(dp[i-1][j], dp[i][j-1])
        }
    }

    // Backtrack
    const result = []
    let i = m, j = n
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && a[i-1] === b[j-1]) {
            result.unshift({ type: 'same', line: a[i-1] })
            i--; j--
        } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
            result.unshift({ type: 'add', line: b[j-1] })
            j--
        } else {
            result.unshift({ type: 'del', line: a[i-1] })
            i--
        }
    }

    // Kalau file melebihi MAX, append sisa sebagai konteks
    if (A.length > MAX || B.length > MAX) {
        result.push({ type: 'truncated', line: `... (file terlalu panjang, hanya ${MAX} baris pertama yang di-diff)` })
    }

    return result
}

/**
 * Format hasil diff jadi teks WhatsApp-friendly.
 * Hanya tampilkan baris yang berubah + N baris konteks di sekitarnya.
 */
function formatDiff(diffResult, contextLines = 2) {
    const changes = []
    // Tandai index yang berubah
    const changedIdx = new Set()
    diffResult.forEach((d, i) => {
        if (d.type === 'add' || d.type === 'del' || d.type === 'truncated') {
            for (let k = Math.max(0, i - contextLines); k <= Math.min(diffResult.length - 1, i + contextLines); k++) {
                changedIdx.add(k)
            }
        }
    })

    if (!changedIdx.size) return null // tidak ada perubahan

    let txt = ''
    let lastIdx = -2
    let lineNum = 0 // approx line number in new file

    diffResult.forEach((d, i) => {
        if (d.type !== 'del') lineNum++

        if (!changedIdx.has(i)) return

        if (i > lastIdx + 1 && lastIdx >= 0) txt += `\n  ··· ···\n\n`
        lastIdx = i

        const ln = String(lineNum).padStart(3, ' ')
        if (d.type === 'add')       txt += `+ ${ln} │ ${d.line}\n`
        else if (d.type === 'del')  txt += `- ${ln} │ ${d.line}\n`
        else if (d.type === 'truncated') txt += `  ··· ${d.line}\n`
        else                        txt += `  ${ln} │ ${d.line}\n`
    })

    return txt.trim()
}

// ─── View: daftar versi ───────────────────────────────────────────────────────

function viewVersionList(pluginName, versions, hasActive) {
    let txt = `📂 *ᴠᴇʀꜱɪ ʙᴀᴄᴋᴜᴘ: ${pluginName}*\n`
    txt += `> ${versions.length} versi ditemukan\n\n`

    versions.forEach(v => {
        txt += `*${v.index}.* ${v.label}\n`
        txt += `   \`${v.filename}\`\n`
    })

    if (hasActive) {
        txt += `\n*${versions.length + 1}.* 🟢 *AKTIF* (versi saat ini di \`plugins/\`)`
    }

    txt += `\n\n_Cara pakai:_\n`
    txt += `> \`.plugindiff ${pluginName} 1 2\` — diff versi 1 vs 2\n`
    txt += `> \`.plugindiff ${pluginName} latest prev\` — versi terbaru vs sebelumnya\n`
    txt += `> \`.plugindiff ${pluginName} 1 aktif\` — versi 1 vs yang aktif sekarang`

    return txt
}

// ─── Handler ──────────────────────────────────────────────────────────────────

async function handler(m, { sock }) {
    const args       = m.args || []
    const pluginName = args[0]?.toLowerCase().replace(/\.js$/, '')
    const argA       = args[1] || ''
    const argB       = args[2] || ''

    if (!pluginName) {
        return m.reply(
            `🔍 *ᴘʟᴜɢɪɴ ᴅɪꜰꜰ*\n\n` +
            `> Lihat perubahan antar versi plugin dari backup.\n\n` +
            `*Cara pakai:*\n` +
            `> \`.plugindiff <nama>\` — list semua versi\n` +
            `> \`.plugindiff <nama> 1 2\` — diff versi 1 vs 2\n` +
            `> \`.plugindiff <nama> latest prev\` — terbaru vs sebelumnya\n` +
            `> \`.plugindiff <nama> 1 aktif\` — backup vs file aktif\n\n` +
            `*Simbol diff:*\n` +
            `> \`+\` baris ditambah   \`-\` baris dihapus`
        )
    }

    m.react('🔍')

    const versions   = getVersions(pluginName)
    const activeFile = findActiveFile(pluginName)

    if (!versions.length && !activeFile) {
        return m.reply(
            `❌ *Plugin "${pluginName}" tidak ditemukan*\n\n` +
            `> Tidak ada backup di \`backup/plugins/\` dan tidak ada file aktif.\n` +
            `> Cek nama plugin-nya~`
        )
    }

    // Kalau tidak ada argumen kedua → tampilkan daftar versi
    if (!argA) {
        return m.reply(viewVersionList(pluginName, versions, !!activeFile))
    }

    // ── Resolve versi A & B ───────────────────────────────────────────────────
    function resolveVersion(arg) {
        const a = arg.toLowerCase()
        // "aktif" / "active" / "now" / "current" → file aktif
        if (['aktif', 'active', 'now', 'current', 'live'].includes(a)) {
            if (!activeFile) return { err: `File aktif "${pluginName}.js" tidak ditemukan di folder plugins.` }
            return { label: '🟢 AKTIF', content: fs.readFileSync(activeFile, 'utf-8') }
        }
        // "latest" / "terbaru" → versi backup terbaru
        if (['latest', 'terbaru', 'last'].includes(a)) {
            if (!versions.length) return { err: 'Tidak ada backup tersedia.' }
            const v = versions[versions.length - 1]
            return { label: `v${v.index} (${v.label})`, content: fs.readFileSync(path.join(BACKUP_DIR, v.filename), 'utf-8') }
        }
        // "prev" / "sebelumnya" → versi backup ke-2 dari belakang
        if (['prev', 'previous', 'sebelumnya', 'before'].includes(a)) {
            if (versions.length < 2) return { err: 'Perlu minimal 2 versi backup untuk "prev".' }
            const v = versions[versions.length - 2]
            return { label: `v${v.index} (${v.label})`, content: fs.readFileSync(path.join(BACKUP_DIR, v.filename), 'utf-8') }
        }
        // Angka → index versi (1-based)
        const idx = parseInt(a)
        if (!isNaN(idx)) {
            if (idx < 1 || idx > versions.length) {
                return { err: `Versi ${idx} tidak ada. Range: 1–${versions.length}` }
            }
            const v = versions[idx - 1]
            return { label: `v${idx} (${v.label})`, content: fs.readFileSync(path.join(BACKUP_DIR, v.filename), 'utf-8') }
        }
        return { err: `Argumen "${arg}" tidak dikenali. Gunakan angka, "latest", "prev", atau "aktif".` }
    }

    const resolvedA = resolveVersion(argA)
    if (resolvedA.err) return m.reply(`❌ *Versi pertama:* ${resolvedA.err}`)

    // Kalau argB kosong tapi argA ada → diff argA vs aktif (default)
    const effectiveB = argB || 'aktif'
    const resolvedB  = resolveVersion(effectiveB)
    if (resolvedB.err) return m.reply(`❌ *Versi kedua:* ${resolvedB.err}`)

    // ── Jalankan diff ─────────────────────────────────────────────────────────
    const diffResult = diffLines(resolvedA.content, resolvedB.content)

    // Hitung stats
    const added   = diffResult.filter(d => d.type === 'add').length
    const removed = diffResult.filter(d => d.type === 'del').length
    const same    = diffResult.filter(d => d.type === 'same').length

    if (added === 0 && removed === 0) {
        m.react('✅')
        return m.reply(
            `✅ *Tidak ada perbedaan!*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ A : ${resolvedA.label}\n` +
            `┃ B : ${resolvedB.label}\n` +
            `┃ Baris: ${same} baris identik\n` +
            `╰┈┈⬡\n\n` +
            `> Kedua versi ini sama persis~ 💖`
        )
    }

    const diffText = formatDiff(diffResult)

    // Header
    let reply = `🔄 *ᴅɪꜰꜰ: ${pluginName}*\n\n`
    reply += `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n`
    reply += `┃ A (lama) : ${resolvedA.label}\n`
    reply += `┃ B (baru) : ${resolvedB.label}\n`
    reply += `┃ + Ditambah: *${added}* baris\n`
    reply += `┃ - Dihapus : *${removed}* baris\n`
    reply += `┃ ~ Sama    : *${same}* baris\n`
    reply += `╰┈┈⬡\n\n`

    // Body diff
    if (diffText) {
        // WhatsApp code block, potong kalau terlalu panjang
        const MAX_CHARS = 3500
        const truncated = diffText.length > MAX_CHARS
        const body = truncated ? diffText.slice(0, MAX_CHARS) + '\n... (terpotong)' : diffText

        reply += `\`\`\`\n${body}\`\`\``
    }

    m.react('✅')
    return m.reply(reply)
}

module.exports = { config: pluginConfig, handler }