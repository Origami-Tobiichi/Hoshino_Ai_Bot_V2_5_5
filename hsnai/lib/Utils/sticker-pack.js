"use strict";
// lib/Utils/sticker-pack.js
// Normalizes a loose array of stickers (Buffer / {url} / full descriptor)
// into a ready-to-send `stickerPack` message payload for sock.sendMessage.
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeStickerPack = void 0;
/** Default emojis assigned to stickers when none are provided, rotated by index. */
const DEFAULT_EMOJIS = ["😀", "😂", "😍", "🔥", "👍", "🎉", "😎", "🤩", "💯", "🥳"];
const normalizeSticker = (entry, index) => {
    if (Buffer.isBuffer(entry) ||
        (entry &&
            typeof entry === "object" &&
            "url" in entry &&
            !("sticker" in entry))) {
        return {
            sticker: entry,
            emojis: [DEFAULT_EMOJIS[index % DEFAULT_EMOJIS.length]],
            accessibilityLabel: "",
        };
    }
    return {
        sticker: entry.sticker || entry.data,
        emojis: entry.emojis || [DEFAULT_EMOJIS[index % DEFAULT_EMOJIS.length]],
        accessibilityLabel: entry.accessibilityLabel || "",
    };
};
/**
 * Build a stickerPack message object ready to pass to sock.sendMessage.
 * Example:
 *   await sock.sendMessage(jid, makeStickerPack({
 *       name: 'Hoshino Ai Pack',
 *       stickers: [buf1, { url: 'https://.../s2.webp' }]
 *   }))
 */
const makeStickerPack = ({ name, publisher = "Hoshino Ai Bot", description = "", packId, stickers = [], cover, contextInfo, } = {}) => {
    if (!name)
        throw new Error("makeStickerPack: name is required");
    if (!stickers.length)
        throw new Error("makeStickerPack: at least one sticker is required");
    const normalizedStickers = stickers.map(normalizeSticker);
    const resolvedCover = cover !== null && cover !== void 0 ? cover : normalizedStickers[0].sticker;
    return Object.assign({ stickerPack: {
            name,
            publisher,
            description,
            ...(packId ? { packId } : {}),
            stickers: normalizedStickers,
            cover: resolvedCover,
        } }, (contextInfo ? { contextInfo } : {}));
};
exports.makeStickerPack = makeStickerPack;
