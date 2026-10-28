// lib/groupMetaCache.js
// Cache in-memory untuk groupMetadata biar gak fetch ke WA server tiap pesan masuk.
// Cache di-update lewat event ('group-participants.update' & 'groups.update'),
// bukan dari messageHandler. messageHandler cuma BACA dari sini.

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 jam, tetep di-refresh duluan lewat event

const store = new Map(); // groupJid -> { data, ts }

/**
 * Ambil metadata grup dari cache. Kalau kosong/expired, fallback fetch live
 * (sekali) lalu simpan ke cache biar pesan berikutnya gak fetch lagi.
 * @param {import('@whiskeysockets/baileys').WASocket} sock
 * @param {string} groupJid
 * @returns {Promise<object|null>}
 */
async function getGroupMetadata(sock, groupJid) {
  const cached = store.get(groupJid);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    console.log('🔥 CACHE HIT:', groupJid);   // 👈 tambahin ini
    return cached.data;
  }

  try {
    const meta = await sock.groupMetadata(groupJid);
    store.set(groupJid, { data: meta, ts: Date.now() });
    console.log('🔥 CACHE MISS (fetch baru):', groupJid);   // 👈 tambahin ini
    return meta;
  } catch (e) {
    // Kalau fetch gagal tapi masih ada cache lama (walau expired), lebih baik
    // pakai itu daripada return null (mencegah fitur yang butuh groupMeta rusak total).
    if (cached) return cached.data;
    return null;
  }
}

/**
 * Dipanggil dari event listener (group-participants.update, groups.update)
 * setelah dapat groupMeta terbaru. Ini yang bikin cache selalu fresh tanpa
 * perlu fetch di messageHandler.
 * @param {string} groupJid
 * @param {object} meta
 */
function setGroupMetadata(groupJid, meta) {
  if (!groupJid || !meta) return;
  store.set(groupJid, { data: meta, ts: Date.now() });
}

/**
 * Hapus entry cache tertentu (misal saat bot di-kick dari grup).
 * @param {string} groupJid
 */
function invalidate(groupJid) {
  store.delete(groupJid);
}

/**
 * Buang seluruh cache (jarang dipakai, misal reconnect total).
 */
function clearAll() {
  store.clear();
}

module.exports = {
  getGroupMetadata,
  setGroupMetadata,
  invalidate,
  clearAll,
};