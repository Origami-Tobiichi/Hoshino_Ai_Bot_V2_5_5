/**
 * ✧ Asset Loader (URL-based)
 *
 * Semua aset bot (gambar, video, audio, font, template) sekarang diambil dari URL
 * yang diisi di `config.js` → `assets: { ... }`, bukan dari folder `assets/` lokal.
 *
 * Key formatnya: '<grup>/<nama>'  →  contoh: 'images/hsnai', 'video/hsnai', 'fonts/Epep'
 *   config.assets.images.hsnai  ↔  asset.url('images/hsnai')
 *
 * Kalau URL kosong / gagal di-download, aset dianggap "tidak ada" (sama seperti
 * dulu waktu file lokalnya tidak ditemukan), jadi fallback di tiap plugin tetap jalan.
 *
 * API:
 *   asset.url(key)            → string URL ('' kalau belum diisi)
 *   asset.has(key)            → boolean, ada URL-nya atau belum (sync)
 *   asset.peek(key)           → Buffer|null (sync, dari cache memori; kalau belum ada, download di background)
 *   asset.buffer(key)         → Promise<Buffer>   (throw kalau tidak ada / gagal)
 *   asset.tryBuffer(key)      → Promise<Buffer|null>
 *   asset.file(key)           → Promise<string>   path file lokal hasil cache (untuk font / ffmpeg / loadImage)
 *   asset.tryFile(key)        → Promise<string|null>
 *   (buffer/tryBuffer/file/tryFile menerima argumen ke-2 opsional: fallbackUrl, dipakai kalau config-nya masih kosong)
 *   asset.shuffle()           → Buffer|null       (random dari config.assets.shuffle + hasil .srt c, sync/peek)
 *   asset.shuffleList()       → string[]          (semua URL shuffle)
 *   asset.preload([keys])     → Promise           (download di awal biar peek() langsung siap)
 *   asset.setUrl(key, url)    → simpan override URL (dipakai plugin ganti-*), persist ke database/main/assetUrls.json
 *   asset.list(grup?)         → daftar key + URL
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const crypto = require('crypto')
const axios = require('axios')
const config = require('../../config')

const OVERRIDE_FILE = path.join(process.cwd(), 'database', 'main', 'assetUrls.json')
const MEM_LIMIT = 8 * 1024 * 1024 // buffer > 8MB tidak ditaruh di memori, cukup di disk cache
const DEFAULT_EXT = {
    images: '.jpg', video: '.mp4', audio: '.mp3', fonts: '.ttf', shuffle: '.jpg', categories: '.jpg'
}

let overrides = {}
try {
    if (fs.existsSync(OVERRIDE_FILE)) overrides = JSON.parse(fs.readFileSync(OVERRIDE_FILE, 'utf8')) || {}
} catch { overrides = {} }

function saveOverrides() {
    try {
        fs.mkdirSync(path.dirname(OVERRIDE_FILE), { recursive: true })
        fs.writeFileSync(OVERRIDE_FILE, JSON.stringify(overrides, null, 2))
    } catch (e) {
        console.error('[assets] gagal simpan override:', e.message)
    }
}

// ── cache dir ────────────────────────────────────────────────────────────
let _cacheDir = null
function cacheDir() {
    if (_cacheDir) return _cacheDir
    const candidates = [
        path.join(os.tmpdir(), 'hsnai-assets'),
        path.join(process.cwd(), '.cache', 'assets')
    ]
    for (const dir of candidates) {
        try {
            fs.mkdirSync(dir, { recursive: true })
            fs.accessSync(dir, fs.constants.W_OK)
            _cacheDir = dir
            return dir
        } catch {}
    }
    _cacheDir = candidates[0]
    return _cacheDir
}

// ── normalisasi URL ──────────────────────────────────────────────────────
// Link GitHub tipe "github.com/u/r/blob/branch/file" itu halaman HTML, bukan file aslinya.
// Otomatis diubah ke raw.githubusercontent.com biar yang ke-download beneran gambar/video/font-nya.
function normalizeUrl(u) {
    if (!u) return u
    const m = String(u).trim().match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/blob\/(.+?)(?:\?.*)?$/i)
    if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`
    return String(u).trim()
}

// ── resolve key → url ────────────────────────────────────────────────────
function splitKey(key) {
    const i = String(key).indexOf('/')
    if (i === -1) return [String(key), null]
    return [key.slice(0, i), key.slice(i + 1)]
}

function url(key) {
    if (!key) return ''
    if (overrides[key]) return normalizeUrl(overrides[key])
    const [group, name] = splitKey(key)
    const g = config.assets?.[group]
    if (!g || name === null) return ''
    const val = g[name]
    return typeof val === 'string' ? normalizeUrl(val) : ''
}

function has(key) {
    return !!url(key)
}

function extFor(key, u) {
    try {
        const clean = u.split('?')[0].split('#')[0]
        const e = path.extname(clean).toLowerCase()
        if (e && e.length <= 6) return e
    } catch {}
    const [group] = splitKey(key)
    return DEFAULT_EXT[group] || '.bin'
}

// ── download ─────────────────────────────────────────────────────────────
const isRemote = (u) => /^https?:\/\//i.test(u)
const memCache = new Map()      // url → Buffer
const inflight = new Map()      // url → Promise<filePath>
const failedAt = new Map()      // url → timestamp (biar tidak spam retry)
const RETRY_AFTER = 60 * 1000

function cachePathFor(key, u) {
    const hash = crypto.createHash('sha1').update(u).digest('hex').slice(0, 16)
    return path.join(cacheDir(), `${hash}${extFor(key, u)}`)
}

async function download(key, u) {
    const dest = cachePathFor(key, u)
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest
    if (inflight.has(u)) return inflight.get(u)

    const job = (async () => {
        let lastErr
        for (let attempt = 0; attempt < 3; attempt++) {
            const tmp = `${dest}.${process.pid}.part`
            try {
                const res = await axios.get(u, {
                    responseType: 'stream',
                    timeout: 45000,
                    maxRedirects: 5,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
                        'Accept': 'image/*,video/*,audio/*,*/*;q=0.8'
                    }
                })
                await new Promise((resolve, reject) => {
                    const ws = fs.createWriteStream(tmp)
                    res.data.pipe(ws)
                    res.data.on('error', reject)
                    ws.on('error', reject)
                    ws.on('finish', resolve)
                })
                if (fs.statSync(tmp).size === 0) {
                    throw new Error(`file kosong (status ${res.status}, content-length ${res.headers['content-length']}, type ${res.headers['content-type']})`)
                }
                fs.renameSync(tmp, dest)
                return dest
            } catch (e) {
                lastErr = e
                try { fs.unlinkSync(tmp) } catch {}
                if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
            }
        }
        throw lastErr
    })()

    inflight.set(u, job)
    try {
        return await job
    } finally {
        inflight.delete(u)
    }
}

/** Path file lokal untuk sebuah key (download dulu kalau perlu). null kalau tidak ada. */
async function tryFile(key, fallbackUrl) {
    const u = url(key) || normalizeUrl(fallbackUrl || '')
    if (!u) return null
    try {
        if (!isRemote(u)) {
            const local = path.resolve(process.cwd(), u)
            return fs.existsSync(local) ? local : null
        }
        const t = failedAt.get(u)
        if (t && Date.now() - t < RETRY_AFTER) return null
        const p = await download(key, u)
        failedAt.delete(u)
        return p
    } catch (e) {
        failedAt.set(u, Date.now())
        console.error(`[assets] gagal ambil "${key}": ${e.message}`)
        return null
    }
}

async function file(key, fallbackUrl) {
    const p = await tryFile(key, fallbackUrl)
    if (!p) throw new Error(`Asset "${key}" belum diisi / gagal di-download (cek config.assets)`)
    return p
}

async function tryBuffer(key, fallbackUrl) {
    const u = url(key) || normalizeUrl(fallbackUrl || '')
    if (!u) return null
    if (memCache.has(u)) return memCache.get(u)
    const p = await tryFile(key, fallbackUrl)
    if (!p) return null
    try {
        const buf = fs.readFileSync(p)
        if (buf.length <= MEM_LIMIT) memCache.set(u, buf)
        return buf
    } catch {
        return null
    }
}

async function buffer(key, fallbackUrl) {
    const buf = await tryBuffer(key, fallbackUrl)
    if (!buf) throw new Error(`Asset "${key}" belum diisi / gagal di-download (cek config.assets)`)
    return buf
}

/** Sync: ambil dari cache memori. Kalau belum ada, kick off download di background dan return null. */
function peek(key) {
    const u = url(key)
    if (!u) return null
    if (memCache.has(u)) return memCache.get(u)
    tryBuffer(key).catch(() => {})
    return null
}

// ── shuffle (SRT) ────────────────────────────────────────────────────────
function shuffleUrls() {
    const list = config.assets?.shuffle
    const base = Array.isArray(list) ? list.filter(u => typeof u === 'string' && u.trim()).map(normalizeUrl) : []
    const extra = Array.isArray(overrides.__shuffle) ? overrides.__shuffle.map(e => e.url).filter(Boolean) : []
    return [...new Set([...base, ...extra])]
}

// gambar hasil capture (.srt c) disimpan sebagai URL di database/main/assetUrls.json
function addShuffle(u, hash) {
    if (!Array.isArray(overrides.__shuffle)) overrides.__shuffle = []
    overrides.__shuffle.push({ hash, url: u })
    saveOverrides()
}
function hasShuffle(hash) {
    return Array.isArray(overrides.__shuffle) && overrides.__shuffle.some(e => e.hash === hash)
}
function removeShuffle(hash) {
    if (!hasShuffle(hash)) return false
    const gone = overrides.__shuffle.filter(e => e.hash === hash)
    overrides.__shuffle = overrides.__shuffle.filter(e => e.hash !== hash)
    for (const e of gone) memCache.delete(e.url)
    saveOverrides()
    return true
}
function pruneShuffle(urls) {
    if (!Array.isArray(overrides.__shuffle)) return 0
    const set = new Set(urls)
    const before = overrides.__shuffle.length
    overrides.__shuffle = overrides.__shuffle.filter(e => !set.has(e.url))
    for (const u of urls) memCache.delete(u)
    saveOverrides()
    return before - overrides.__shuffle.length
}

/** Random dari config.assets.shuffle (+ hasil capture). Sync; null kalau kosong / belum ke-download. */
function shuffle() {
    const list = shuffleUrls()
    if (!list.length) return null
    const ready = list.filter(u => memCache.has(u))
    if (ready.length) return memCache.get(ready[Math.floor(Math.random() * ready.length)])
    // belum ada yang siap → download semuanya di background
    for (const u of list) {
        if (!memCache.has(u)) downloadRaw(u).catch(() => {})
    }
    return null
}

async function downloadRaw(u) {
    if (memCache.has(u)) return memCache.get(u)
    const p = await download('shuffle/x', u)
    const buf = fs.readFileSync(p)
    if (buf.length <= MEM_LIMIT) memCache.set(u, buf)
    return buf
}

// ── preload ──────────────────────────────────────────────────────────────
function allKeys(group) {
    const out = []
    const a = config.assets || {}
    for (const g of Object.keys(a)) {
        if (group && g !== group) continue
        if (g === 'shuffle') continue
        for (const name of Object.keys(a[g] || {})) out.push(`${g}/${name}`)
    }
    for (const k of Object.keys(overrides)) if (!k.startsWith('__') && (!group || k.startsWith(group + '/')) && !out.includes(k)) out.push(k)
    return out
}

/**
 * Download di awal supaya asset.peek() langsung siap.
 * Default: semua gambar (+ shuffle). Video/audio/font diambil saat dipakai.
 */
async function preload(keys) {
    const targets = (keys || allKeys('images')).filter(has)
    const queue = [...targets]
    const workers = Array.from({ length: 4 }, async () => {
        while (queue.length) {
            const k = queue.shift()
            await tryBuffer(k).catch(() => {})
        }
    })
    await Promise.all(workers)
    if (!keys) {
        const sh = shuffleUrls()
        await Promise.all(sh.map(u => downloadRaw(u).catch(() => {})))
    }
    return targets.length
}

// ── override (dipakai plugin ganti-*) ────────────────────────────────────
function setUrl(key, newUrl) {
    const old = url(key)
    if (old) memCache.delete(old)
    if (!newUrl) delete overrides[key]
    else overrides[key] = String(newUrl).trim()
    saveOverrides()
    if (newUrl) failedAt.delete(newUrl)
}

function list(group) {
    return allKeys(group).map(k => ({ key: k, url: url(k) }))
}

module.exports = {
    url, has, peek, buffer, tryBuffer, file, tryFile, shuffle, preload, setUrl, list,
    normalizeUrl,
    shuffleList: shuffleUrls, addShuffle, hasShuffle, removeShuffle, pruneShuffle,
    urlBuffer: downloadRaw,   // Buffer dari URL mentah (di-cache)
    groups: () => Object.keys(config.assets || {})
}