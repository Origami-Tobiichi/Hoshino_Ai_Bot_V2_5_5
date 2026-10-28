/**
 * ✧ lib/underDevStore.js
 * ✧ Fungsi: nyimpen daftar PRIMARY COMMAND NAME plugin yang lagi
 *   ditandain "masih otak-atik" alias belum boleh dipake user biasa.
 *
 * Disimpen berdasarkan config.name (bukan alias, bukan raw text yang
 * diketik owner) karena pluginStore.commands di lib/plugins.js itu Map
 * yang di-key pakai nama itu secara unik — jadi gak akan pernah ada
 * dua plugin beda nabrak di key yang sama.
 *
 * FIX: config.name kadang berupa array (mis. ['tiktokdl3']). Dulu array itu
 * ikut disimpan mentah ke underdev.json, lalu x.toLowerCase() meledak di
 * setiap pesan. Sekarang semua input/isi db dinormalisasi jadi string.
 */

const fs = require('fs')
const path = require('path')

const DB_PATH = path.join(__dirname, '../data/underdev.json')

function ensureFile() {
    if (!fs.existsSync(DB_PATH)) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
        fs.writeFileSync(DB_PATH, JSON.stringify({ plugins: [] }, null, 2))
    }
}

// ratakan array bersarang, buang yang bukan string / kosong, hapus duplikat
function normalize(input) {
    const out = []
    const seen = new Set()
    for (const item of [].concat(input).flat(Infinity)) {
        if (typeof item !== 'string') continue
        const name = item.trim()
        if (!name) continue
        const key = name.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(name)
    }
    return out
}

function readAll() {
    ensureFile()
    try {
        const raw = fs.readFileSync(DB_PATH, 'utf-8')
        const data = JSON.parse(raw)
        return Array.isArray(data.plugins) ? normalize(data.plugins) : []
    } catch (e) {
        console.error('[underDevStore] Gagal baca db, reset ke kosong:', e)
        return []
    }
}

function writeAll(list) {
    ensureFile()
    fs.writeFileSync(DB_PATH, JSON.stringify({ plugins: normalize(list) }, null, 2))
}

// Daftar primary name yang lagi ditandain
function getList() {
    return readAll()
}

// name boleh string atau array (plugin.config.name), dua-duanya aman
function isMarked(name) {
    const names = normalize(name).map(x => x.toLowerCase())
    if (!names.length) return false
    const list = readAll().map(x => x.toLowerCase())
    return names.some(n => list.includes(n))
}

function add(name) {
    const names = normalize(name)
    if (!names.length) return false
    const list = readAll()
    const lower = list.map(x => x.toLowerCase())
    let changed = false
    for (const n of names) {
        if (lower.includes(n.toLowerCase())) continue
        list.push(n)
        lower.push(n.toLowerCase())
        changed = true
    }
    if (!changed) return false
    writeAll(list)
    return true
}

function remove(name) {
    const names = normalize(name).map(x => x.toLowerCase())
    if (!names.length) return false
    const list = readAll()
    const filtered = list.filter(x => !names.includes(x.toLowerCase()))
    if (filtered.length === list.length) return false
    writeAll(filtered)
    return true
}

module.exports = {
    getList,
    isMarked,
    add,
    remove
}
