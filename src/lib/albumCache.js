/**
‎✧ Name    : albumCache
‎✧ Category: lib
‎✧ Deskripsi: Cache in-memory buat ngelacak album (multi-foto/video) WhatsApp.
‎✧          Dipisah dari img2sp.js supaya bisa dipake plugin manapun (crm,
‎✧          relaymsg, img2sp, dst) tanpa harus saling require satu sama lain.
**/

const { proto } = require('hsnai') // sesuaikan kalau nama package proto fork kamu beda

const ALBUM_ASSOCIATION_TYPE = 1
const ALBUM_CACHE_TTL_MS = 15 * 60 * 1000 // 15 menit
const ALBUM_CACHE_MAX_PER_CHAT = 200

// PENTING: pakai global, BUKAN const module-scope biasa. Setiap hot-reload
// (.ganticode) bikin instance module BARU dengan closure baru — kalau Map ini
// cuma module-scope const, plugin yang require() sekali pas boot dan gak pernah
// di-reload (misal handler.js) bakal terus nunjuk ke Map versi LAMA, sementara
// plugin yang abis di-reload nunjuk ke Map versi BARU yang kosong. Data yang
// ditulis salah satu gak akan pernah kebaca yang lain. Pakai global supaya
// semua instance module (lama maupun baru, dari file manapun) selalu baca/tulis
// Map yang sama persis.
if (!global.__albumMessageCache) global.__albumMessageCache = new Map()
const albumMessageCache = global.__albumMessageCache // chat -> Array<{ id, timestamp, normalized }>

function normalizeMessage(rmsg) {
    return proto.WebMessageInfo.toObject(
        proto.WebMessageInfo.fromObject(rmsg),
        {
            enums: Number,
            longs: Number,
            bytes: String,
            defaults: false,
        },
    )
}

function getSenderId(key) {
    if (!key) return null
    if (key.fromMe) return 'me'
    return key.participant || key.remoteJid || null
}

// Buka bungkus associatedChildMessage (kalau ada) jadi bentuk message biasa,
// biar konsumen (img2sp, crm, dst) gak perlu tau soal struktur asosiasi album.
function unwrapAssociatedChild(msg) {
    const contextInfo = msg.message?.messageContextInfo
    const inner = msg.message?.associatedChildMessage?.message
    if (!inner) return msg

    return {
        ...msg,
        message: {
            ...inner,
            messageContextInfo: contextInfo,
        },
    }
}

function pruneAlbumCacheEntry(list) {
    const cutoff = Date.now() - ALBUM_CACHE_TTL_MS
    let start = 0
    while (start < list.length && list[start].timestamp < cutoff) start++
    if (start > 0) list.splice(0, start)
    if (list.length > ALBUM_CACHE_MAX_PER_CHAT) list.splice(0, list.length - ALBUM_CACHE_MAX_PER_CHAT)
}

// Dipanggil untuk SETIAP pesan masuk (biasanya dari messageHandler di handler.js,
// sebelum atau sesudah serialize — bebas, asal raw msg ala Baileys). Bukan cuma
// pas command dipanggil, karena kalau gitu, album yang direply pasti udah lewat
// duluan dan gak ketangkep. Konsekuensinya: pencarian album cuma nemu item yang
// diterima SELAGI bot lagi nyala (album yang masuk sebelum bot restart gak ada).
function cacheAlbumCandidate(rawMsg) {
    if (!rawMsg) return

    const chat = rawMsg.key?.remoteJid
    if (!chat || !rawMsg.message) return

    let normalized
    try {
        normalized = normalizeMessage(rawMsg)
    } catch (e) {
        console.log('[albumCache] DEBUG cacheAlbumCandidate normalize gagal:', e.message)
        return
    }

    const assoc = normalized?.message?.messageContextInfo?.messageAssociation
    const hasAssocChild = normalized?.message?.associatedChildMessage

    // Cuma perlu simpen pesan yang emang bagian dari asosiasi album (hemat memori)
    if (!assoc?.parentMessageKey && !hasAssocChild) return

    if (!albumMessageCache.has(chat)) albumMessageCache.set(chat, [])
    const list = albumMessageCache.get(chat)

    list.push({
        id: normalized.key?.id,
        timestamp: Date.now(),
        normalized,
    })

    pruneAlbumCacheEntry(list)
}

function findAlbumChildren(chat, parentId, parentSender) {
    const list = albumMessageCache.get(chat)
    if (!list?.length) return []

    const children = []

    for (const entry of list) {
        if (entry.id === parentId) continue

        const normalized = entry.normalized
        const assoc = normalized?.message?.messageContextInfo?.messageAssociation
        if (!assoc?.parentMessageKey) continue
        if (assoc.parentMessageKey.id !== parentId) continue
        if (assoc.parentMessageKey.remoteJid && assoc.parentMessageKey.remoteJid !== chat) continue
        if (assoc.associationType !== ALBUM_ASSOCIATION_TYPE) continue

        if (getSenderId(normalized.key) !== parentSender) continue

        children.push(normalized)
    }

    return children
}

module.exports = {
    ALBUM_ASSOCIATION_TYPE,
    normalizeMessage,
    getSenderId,
    unwrapAssociatedChild,
    cacheAlbumCandidate,
    findAlbumChildren,
}