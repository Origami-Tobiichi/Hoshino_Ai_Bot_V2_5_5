/**
 * rawContextCache.js
 * Cache contextInfo mentah dari tiap pesan masuk/keluar SEBELUM di-serialize.
 * Dipakai sebagai fallback saat sock.store.loadMessage() gagal (mis. pesan
 * yang baru aja dikirim bot sendiri dan belum sempat ke-index di store),
 * karena m.quoted hasil serialize framework hsnai udah "dibersihin" dan
 * gak bawa contextInfo (externalAdReply, quotedMessage, dll) lagi.
 *
 * Pola cache & auto-expire niru albumCache.js.
 */

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 menit
const rawContextStore = new Map(); // key: message id -> { contextInfo, cachedAt }

/**
 * Simpan contextInfo mentah dari sebuah raw message (sebelum serialize).
 * @param {Object} msg - Raw message dari Baileys (messages.upsert item)
 */
function cacheRawContext(msg) {
  try {
    const id = msg?.key?.id;
    if (!id) return;

    const content = msg?.message;
    if (!content) return;

    // contextInfo bisa nempel di berbagai tipe konten (extendedTextMessage,
    // interactiveMessage, imageMessage, dst) — ambil yang pertama ketemu.
    const type = Object.keys(content).find((k) => content[k]?.contextInfo);
    const contextInfo = type ? content[type].contextInfo : null;

    if (!contextInfo) return;

    rawContextStore.set(id, {
      contextInfo,
      cachedAt: Date.now(),
    });
  } catch (e) {
    // silent fail, ini cuma fallback layer
  }
}

/**
 * Ambil contextInfo mentah berdasarkan message id.
 * @param {string} id - Message id (m.key.id / m.id)
 * @returns {Object|null}
 */
function getRawContext(id) {
  if (!id) return null;
  const entry = rawContextStore.get(id);
  if (!entry) return null;

  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    rawContextStore.delete(id);
    return null;
  }

  return entry.contextInfo;
}

// Bersihin entry basi tiap 5 menit biar Map gak bengkak
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of rawContextStore) {
    if (now - entry.cachedAt > CACHE_TTL_MS) rawContextStore.delete(id);
  }
}, 5 * 60 * 1000);

module.exports = { cacheRawContext, getRawContext };