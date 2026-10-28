/**
✧ Name    : battleshipmp
✧ Category: game
**/

'use strict'

// require dependency yang dibutuhin plugin ini.
const config = require('../../config')
const { proto, generateWAMessageFromContent, generateMessageIDV2 } = require('baileys')

/* =========================================================
 * pluginConfig = metadata plugin, dipakai handler.js buat registrasi command
 * ========================================================= */

const pluginConfig = {
    name: 'battleshipmp',
    alias: ['bsmp'],
    category: 'game',
    description: 'Battleship multiplayer realtime antar perangkat.',
    usage: '.battleshipmp',
    example: '.battleshipmp',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

/* =========================================================
 * CONFIG INTERNAL
 * ========================================================= */

const WEB_URL =
    'https://radiant-cucurucho-428266.netlify.app'
const WS_URL =
    'wss://free.blr2.piesocket.com/v3/1?api_key=lt5qIYUslL7ASeUOImmmWNfvg7PDOedN9Zcvfo0i&notify_self=1'
const BOT_JID =
    '0@bot'

/* =========================================================
 * STICKER SOURCES (SERVER-SIDE)
 *
 * Sticker WAJIB berupa gambar asli, bukan emoji. HTML
 * rich-response card WhatsApp tidak mengizinkan <img>
 * memuat gambar dari domain sembarang secara langsung,
 * jadi setiap sticker di-fetch di sisi bot (Node.js) lalu
 * dikonversi ke data URI base64 sebelum ditanam ke HTML.
 *
 * Untuk menambah sticker baru: cukup tambahkan satu
 * object { id, url } baru ke STICKER_SOURCES. id harus
 * unik, url mengarah ke gambar (WebP/PNG/JPG/JPEG
 * diprioritaskan). Ganti url di bawah dengan link sticker
 * kamu sendiri.
 * ========================================================= */

const STICKER_SOURCES = [
    {
        id: 'sticker1',
        url: 'https://files.catbox.moe/85mhje.webp'
    },
    {
        id: 'sticker2',
        url: 'https://files.catbox.moe/zh3paj.webp'
    },
    {
        id: 'sticker3',
        url: 'https://files.catbox.moe/8hcyes.webp'
    },
    {
        id: 'sticker4',
        url: 'https://files.catbox.moe/g1htjc.webp'
    },
    {
        id: 'sticker5',
        url: 'https://files.catbox.moe/e12mj3.webp'
    },
    {
        id: 'sticker6',
        url: 'https://files.catbox.moe/fyub9m.webp'
    }, 
    {
        id: 'sticker7', 
        url: 'https://files.catbox.moe/v13gj7.webp'
    }
]

/*
 * Cache ringan di memori proses bot, supaya sticker yang
 * sama tidak di-fetch ulang setiap kali seseorang membuka
 * game (mis. beberapa orang menjalankan .battleshipmp
 * dalam rentang waktu berdekatan).
 */

const STICKER_CACHE_TTL_MS = 10 * 60 * 1000
const stickerDataUriCache = new Map()

function guessImageMime(url = '') {
    const clean =
        String(url)
            .split('?')[0]
            .split('#')[0]
            .toLowerCase()
    if (clean.endsWith('.webp')) return 'image/webp'
    if (clean.endsWith('.png')) return 'image/png'
    if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg'
    if (clean.endsWith('.gif')) return 'image/gif'
    return ''
}

async function fetchStickerDataUri(source) {
    const cached =
        stickerDataUriCache.get(source.url)
    if (
        cached &&
        Date.now() - cached.ts < STICKER_CACHE_TTL_MS
    ) {
        return {
            id: source.id,
            url: cached.dataUri
        }
    }
    try {
        const response =
            await fetch(source.url)
        if (!response.ok) {
            console.error(
                '[battleshipmp][sticker] fetch gagal',
                source.id,
                response.status
            )
            return null
        }
        const contentType =
            String(
                response.headers.get('content-type') || ''
            )
                .split(';')[0]
                .trim()
        const mime =
            contentType.startsWith('image/')
                ? contentType
                : (guessImageMime(source.url) || 'image/webp')
        const buffer =
            Buffer.from(
                await response.arrayBuffer()
            )
        const dataUri =
            'data:' +
            mime +
            ';base64,' +
            buffer.toString('base64')
        stickerDataUriCache.set(
            source.url,
            {
                dataUri,
                ts: Date.now()
            }
        )
        return {
            id: source.id,
            url: dataUri
        }
    } catch (error) {
        console.error(
            '[battleshipmp][sticker] error',
            source.id,
            error?.message
        )
        return null
    }
}

async function resolveStickers() {
    const settled =
        await Promise.all(
            STICKER_SOURCES.map(
                source => fetchStickerDataUri(source)
            )
        )
    return settled.filter(Boolean)
}

/* =========================================================
 * HTML ESCAPE
 * ========================================================= */

function escapeHtml(text = '') {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}
function escapeForScript(text = '') {
    return JSON.stringify(String(text))
        .replace(/</g, '\\u003C')
        .replace(/>/g, '\\u003E')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
}
function escapeJsonForScript(json = '[]') {
    return String(json)
        .replace(/</g, '\\u003C')
        .replace(/>/g, '\\u003E')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
}

/* =========================================================
 * WHATSAPP IDENTITY
 * ========================================================= */

function jidToPhoneNumber(jid = '') {
    const raw =
        String(jid || '')
            .split('@')[0]
            .split(':')[0]
    const digits =
        raw.replace(/\D/g, '')
    if (!digits) return ''
    return '+' + digits
}
function getWhatsAppIdentity(m) {
    const pushName =
        String(
            m?.pushName ||
            m?.pushname ||
            m?.notifyName ||
            ''
        ).trim()
    if (pushName) {
        return pushName.slice(0, 20)
    }
    const jid =
        m?.sender ||
        m?.key?.participant ||
        m?.key?.remoteJid ||
        m?.chat ||
        ''
    const phone =
        jidToPhoneNumber(jid)
    if (phone) {
        return phone
    }
    return 'Player'
}

/* =========================================================
 * CREATE HTML
 * ========================================================= */

function createGameHTML(playerIdentity = '', stickers = []) {
    const safeWs =
        escapeHtml(WS_URL)
    const safeIdentity =
        escapeForScript(playerIdentity)
    const safeStickers =
        escapeJsonForScript(
            JSON.stringify(stickers)
        )
    return `
<style>

* {
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
}
html,
body {
    margin: 0;
    padding: 0;
    background: transparent;
    color: #fff;
    font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Roboto,
        Arial,
        sans-serif;
}
button,
input {
    font-family: inherit;
}
button {
    user-select: none;
}
.wrap {
    width: 100%;
    max-width: 460px;
    margin: auto;
    padding: 8px;
}
.game {
    position: relative;
    overflow: hidden;
    padding: 17px;
    border-radius: 22px;
    background:
        linear-gradient(
            145deg,
            rgba(255,255,255,.095),
            rgba(255,255,255,.035)
        );
    border:
        1px solid rgba(255,255,255,.12);
    box-shadow:
        0 20px 60px rgba(0,0,0,.45);
}
.glow {
    position: absolute;
    width: 190px;
    height: 190px;
    top: -100px;
    right: -70px;
    border-radius: 50%;
    background: rgba(100,180,255,.09);
    filter: blur(55px);
    pointer-events: none;
}
.header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}
.eyebrow {
    font-size: 9px;
    letter-spacing: 2px;
    color: rgba(255,255,255,.42);
}
.title {
    margin-top: 3px;
    font-size: 23px;
    font-weight: 800;
}
.connection {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 9px;
    color: rgba(255,255,255,.48);
}
.connection-dot {
    width: 7px;
    height: 7px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: #777;
}
.connection-dot.online {
    background: #65df91;
}
.connection-dot.error {
    background: #ff6060;
}
.menu {
    position: relative;
    margin-top: 17px;
}
.name-input,
.room-input,
.chat-input {
    width: 100%;
    outline: none;
    border:
        1px solid rgba(255,255,255,.1);
    background:
        rgba(255,255,255,.055);
    color: white;
}
.name-input,
.room-input {
    padding: 12px 13px;
    border-radius: 12px;
    font-size: 13px;
}
.name-input {
    margin-bottom: 8px;
}
.name-input::placeholder,
.room-input::placeholder,
.chat-input::placeholder {
    color: rgba(255,255,255,.35);
}
.who-am-i {
    text-align: center;
    font-size: 12px;
    color: rgba(255,255,255,.6);
    margin-bottom: 8px;
}
.menu-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
.btn {
    border: 0;
    border-radius: 12px;
    padding: 12px;
    color: white;
    background:
        rgba(255,255,255,.08);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
}
.btn:active {
    transform: scale(.97);
}
.btn-main {
    background: white;
    color: #111;
}
.join-box {
    margin-top: 8px;
}
.hidden {
    display: none !important;
}
.room-panel {
    display: none;
    margin-top: 15px;
    padding: 12px;
    border-radius: 14px;
    background:
        rgba(255,255,255,.045);
    border:
        1px solid rgba(255,255,255,.08);
}
.room-panel.show {
    display: block;
}
.room-label {
    font-size: 9px;
    letter-spacing: 1.5px;
    color: rgba(255,255,255,.4);
}
.room-code {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 4px;
}
.room-code strong {
    font-size: 22px;
    letter-spacing: 4px;
}
.copy-btn {
    padding: 8px 11px;
    border: 0;
    border-radius: 9px;
    background:
        rgba(255,255,255,.09);
    color: white;
    font-size: 10px;
    font-weight: 700;
}
.room-code-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 0 0 auto;
}
.share-btn {
    padding: 8px 10px;
    border: 0;
    border-radius: 9px;
    white-space: nowrap;
    cursor: pointer;
    background:
        rgba(100,180,255,.18);
    color: white;
    font-size: 10px;
    font-weight: 700;
}
.share-btn:disabled {
    cursor: not-allowed;
    opacity: .5;
    background:
        rgba(255,255,255,.06);
}
.bsmp-toast-layer {
    position: absolute;
    left: 12px;
    right: 12px;
    top: 12px;
    z-index: 40;
    display: flex;
    flex-direction: column;
    gap: 6px;
    pointer-events: none;
}
.bsmp-toast {
    padding: 10px 12px;
    border-radius: 10px;
    text-align: center;
    background:
        rgba(20,20,26,.92);
    border:
        1px solid rgba(255,255,255,.12);
    box-shadow:
        0 10px 30px rgba(0,0,0,.4);
    color: white;
    font-size: 11px;
    font-weight: 700;
    animation: bsmpToastIn .18s ease-out;
}
.bsmp-toast.ok {
    border-color: rgba(101,223,145,.4);
}
.bsmp-toast.warn {
    border-color: rgba(255,196,80,.4);
}
.bsmp-toast.err {
    border-color: rgba(255,96,96,.4);
}
@keyframes bsmpToastIn {
    from {
        opacity: 0;
        transform: translateY(-6px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
.players {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 12px;
}
.player {
    padding: 10px;
    border-radius: 12px;
    background:
        rgba(255,255,255,.045);
    border:
        1px solid rgba(255,255,255,.07);
}
.player.active {
    border-color:
        rgba(255,255,255,.3);
    background:
        rgba(255,255,255,.09);
}
.player-symbol {
    font-size: 17px;
    font-weight: 900;
}
.player-name {
    margin-top: 3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 10px;
    color: rgba(255,255,255,.65);
}
.phase {
    margin-top: 14px;
    text-align: center;
    font-size: 9px;
    letter-spacing: 1.5px;
    color: rgba(255,255,255,.4);
}
.status {
    margin-top: 7px;
    padding: 11px;
    border-radius: 12px;
    text-align: center;
    background:
        rgba(255,255,255,.045);
    font-size: 12px;
    font-weight: 700;
}
.spectator-badge {
    display: none;
    margin-top: 8px;
    padding: 8px 10px;
    border-radius: 10px;
    text-align: center;
    background:
        rgba(100,170,255,.08);
    border:
        1px solid rgba(100,170,255,.15);
    color:
        rgba(180,215,255,.8);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
}
.spectator-badge.show {
    display: block;
}
.boards {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 14px;
}
.spectator-watermark {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 3px 8px;
    border-radius: 8px;
    background:
        rgba(0,0,0,.3);
    border:
        1px solid rgba(255,255,255,.08);
    line-height: 1.05;
    pointer-events: none;
    z-index: 3;
    white-space: nowrap;
}
.spectator-watermark .eye {
    font-size: 11px;
    opacity: .85;
}
.spectator-watermark .count {
    font-size: 10px;
    font-weight: 800;
    color:
        rgba(180,215,255,.85);
}
.board-wrap {
    min-width: 0;
    padding: 6px;
    border-radius: 15px;
    border: 1px solid transparent;
    transition:
        border-color .25s ease,
        box-shadow .25s ease,
        background .25s ease;
}
.board-wrap.my-turn {
    border-color: rgba(101,223,145,.55);
    background: rgba(101,223,145,.04);
    animation: boardWrapGlow 1.8s ease-in-out infinite;
}
@keyframes boardWrapGlow {
    0%, 100% {
        box-shadow:
            0 0 0 1px rgba(101,223,145,.22),
            0 0 16px rgba(101,223,145,.2);
    }
    50% {
        box-shadow:
            0 0 0 1px rgba(101,223,145,.5),
            0 0 28px rgba(101,223,145,.42);
    }
}
.board-title-row {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 7px;
}
.board-title {
    margin-bottom: 0;
    text-align: center;
    font-size: 9px;
    letter-spacing: 1px;
    color: rgba(255,255,255,.48);
}
.turn-badge {
    display: none;
    align-items: center;
    gap: 3px;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .5px;
    padding: 2px 7px;
    border-radius: 20px;
    color: #0b2416;
    background: #65df91;
}
.turn-badge.show {
    display: inline-flex;
    animation: turnBadgePulse 1.4s ease-in-out infinite;
}
@keyframes turnBadgePulse {
    0%, 100% {
        opacity: 1;
        transform: scale(1);
    }
    50% {
        opacity: .78;
        transform: scale(1.07);
    }
}
.board {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 2px;
    width: 100%;
    padding: 4px;
    border-radius: 11px;
    background:
        rgba(0,0,0,.18);
}
.cell {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: 3px;
    background:
        rgba(255,255,255,.07);
    color: white;
    font-size: 9px;
    font-weight: 800;
    cursor: pointer;
}
.cell:active {
    transform: scale(.9);
}
.cell.ship {
    background:
        rgba(255,255,255,.22);
}
.cell.hit {
    background:
        rgba(255,80,80,.34);
    color: #fff;
}
.cell.miss {
    background:
        rgba(100,170,255,.22);
    color: #a9ceff;
}
.cell.sunk {
    background:
        rgba(255,80,80,.58);
    color: white;
}
.cell.sunk-pop {
    animation: cellSunkPop .5s ease;
}
@keyframes cellSunkPop {
    0% {
        transform: scale(1);
    }
    35% {
        transform: scale(1.28);
    }
    60% {
        transform: scale(.92);
    }
    100% {
        transform: scale(1);
    }
}
.cell.target:hover {
    background:
        rgba(255,255,255,.16);
}
.cell.disabled {
    cursor: default;
}
.legend {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
    font-size: 8px;
    color: rgba(255,255,255,.4);
}
.legend span {
    display: flex;
    align-items: center;
    gap: 3px;
}
.dot {
    width: 7px;
    height: 7px;
    border-radius: 2px;
    background:
        rgba(255,255,255,.22);
}
.dot.hit {
    background:
        rgba(255,80,80,.5);
}
.dot.miss {
    background:
        rgba(100,170,255,.4);
}
.ships {
    margin-top: 13px;
    padding: 10px;
    border-radius: 13px;
    background:
        rgba(255,255,255,.04);
    border:
        1px solid rgba(255,255,255,.07);
}
.ships-title {
    font-size: 9px;
    letter-spacing: 1px;
    color: rgba(255,255,255,.4);
}
.ship-list {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 7px;
}
.ship-btn {
    border: 0;
    padding: 7px 8px;
    border-radius: 8px;
    background:
        rgba(255,255,255,.07);
    color: white;
    font-size: 8px;
}
.ship-btn.selected {
    background: white;
    color: #111;
}
.ship-btn.done {
    opacity: .4;
}
.actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 12px;
}
.chat {
    position: relative;
    margin-top: 14px;
    overflow: visible;
    border-radius: 14px;
    background:
        rgba(0,0,0,.16);
}
.global-chat {
    margin-top: 0;
    margin-bottom: 14px;
}
.chat-title {
    padding: 9px 11px;
    border-bottom:
        1px solid rgba(255,255,255,.06);
    font-size: 9px;
    letter-spacing: 1px;
    color: rgba(255,255,255,.4);
}
.chat-scope {
    padding: 5px 10px;
    border-bottom:
        1px solid rgba(255,255,255,.04);
    font-size: 8px;
    color: rgba(255,255,255,.3);
}
.chat-log-wrap {
    position: relative;
}
.chat-log {
    height: 150px;
    overflow-y: auto;
    overflow-x: hidden;
    scroll-behavior: smooth;
    overscroll-behavior-y: contain;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
    padding: 8px 10px;
    font-size: 10px;
    scrollbar-width: none;
}
.chat-log::-webkit-scrollbar {
    display: none;
}

/*
 * TOMBOL SCROLL ATAS/BAWAH
 *
 * Menggantikan scrollbar visual. Diposisikan absolute
 * terhadap ".chat-log-wrap" sehingga tetap "mengambang"
 * di pojok kanan atas area pesan, tidak ikut bergeser
 * saat ".chat-log" di-scroll.
 */

.chat-scroll-controls {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 4;
}
.chat-scroll-btn {
    width: 20px;
    height: 20px;
    border: 0;
    border-radius: 6px;
    background: rgba(255,255,255,.14);
    color: rgba(255,255,255,.8);
    font-size: 9px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    cursor: pointer;
}
.chat-scroll-btn:active {
    background: rgba(255,255,255,.3);
    color: #fff;
}
.chat-message {
    margin-bottom: 6px;
    line-height: 1.4;
    color: rgba(255,255,255,.72);
    white-space: pre-line;
}
.chat-message b {
    color: white;
}

/*
 * MSG ROW
 *
 * Bungkus tiap pesan (chat-message lama tetap dipakai
 * untuk bubble teksnya) supaya ada slot tombol Reply
 * kecil di sampingnya tanpa mengubah tampilan bubble.
 */

.msg-row {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    margin-bottom: 6px;
}
.msg-row .chat-message {
    flex: 1;
    min-width: 0;
    margin-bottom: 0;
}
.msg-reply-btn {
    flex: 0 0 auto;
    margin-top: 1px;
    padding: 2px 5px;
    border: 0;
    border-radius: 6px;
    background: rgba(255,255,255,.06);
    color: rgba(255,255,255,.4);
    font-size: 10px;
    line-height: 1.4;
}
.msg-reply-btn:active {
    background: rgba(255,255,255,.18);
    color: white;
}
.msg-highlight {
    animation: msgHighlightFade 1.2s ease;
    border-radius: 8px;
}
@keyframes msgHighlightFade {
    0% {
        background: rgba(255,255,255,.22);
    }
    100% {
        background: transparent;
    }
}

/*
 * REPLY QUOTE (preview pesan asli di dalam pesan balasan)
 */

.msg-reply-quote {
    margin-bottom: 4px;
    padding: 4px 7px;
    border-left: 2px solid rgba(255,255,255,.35);
    border-radius: 6px;
    background: rgba(255,255,255,.05);
    cursor: pointer;
}
.msg-reply-quote-name {
    font-size: 9px;
    font-weight: 800;
    color: rgba(255,255,255,.65);
}
.msg-reply-quote-text {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 9px;
    color: rgba(255,255,255,.45);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.msg-reply-quote-thumb {
    width: 20px;
    height: 20px;
    flex: 0 0 auto;
    border-radius: 4px;
    object-fit: contain;
    background: rgba(255,255,255,.06);
}

/*
 * JUMP-TO-BOTTOM PILL
 *
 * Elemen ini sengaja diletakkan sebagai child terakhir
 * di dalam chat-log dan dipertahankan tetap terakhir tiap
 * ada pesan baru (lihat keepJumpPillLast()). Dengan
 * position: sticky + bottom: 0, dia otomatis "mengambang"
 * di dasar area yang sedang terlihat selama pemain scroll
 * ke atas, dan menyatu kembali ke alur normal begitu
 * pemain sudah berada di paling bawah.
 */

.chat-jump-wrap {
    position: sticky;
    bottom: 2px;
    display: flex;
    justify-content: center;
    pointer-events: none;
}
.chat-jump {
    display: none;
    pointer-events: auto;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: 0;
    border-radius: 999px;
    background: rgba(255,255,255,.94);
    color: #111;
    font-size: 9px;
    font-weight: 800;
    box-shadow: 0 2px 8px rgba(0,0,0,.4);
}
.chat-jump.show {
    display: inline-flex;
}

/*
 * REPLY COMPOSER BAR (muncul di atas input saat Reply aktif)
 */

.reply-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-top: 1px solid rgba(255,255,255,.06);
    background: rgba(255,255,255,.04);
}
.reply-bar.hidden {
    display: none;
}
.reply-bar-info {
    flex: 1;
    min-width: 0;
}
.reply-bar-label {
    font-size: 9px;
    font-weight: 800;
    color: rgba(255,255,255,.6);
}
.reply-bar-text {
    font-size: 9px;
    color: rgba(255,255,255,.4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.reply-bar-cancel {
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    border: 0;
    border-radius: 50%;
    background: rgba(255,255,255,.1);
    color: white;
    font-size: 10px;
}
.sticker-message {
    margin-top: 2px;
}
.sticker-message img {
    display: block;
    width: 84px;
    height: 84px;
    max-width: 84px;
    max-height: 84px;
    border-radius: 10px;
    object-fit: contain;
    background:
        rgba(255,255,255,.04);
}
.sticker-broken {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 84px;
    height: 84px;
    border-radius: 10px;
    background:
        rgba(255,255,255,.06);
    font-size: 20px;
    color: rgba(255,255,255,.4);
}
.chat-send {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 5px;
    padding: 8px;
    border-top:
        1px solid rgba(255,255,255,.06);
}
.chat-input {
    min-width: 0;
    padding: 9px 10px;
    border: 0;
    border-radius: 9px;
    font-size: 10px;
}
.sticker-toggle,
.send-chat {
    padding: 9px 10px;
    border: 0;
    border-radius: 9px;
    background: white;
    color: #111;
    font-size: 11px;
    font-weight: 800;
}
.sticker-panel {
    display: none;
    flex-direction: column;
    position: absolute;
    right: 8px;
    bottom: 47px;
    z-index: 20;
    width: 240px;
    max-height: 260px;
    border-radius: 14px;
    overflow: hidden;
    background:
        rgba(25,25,30,.97);
    border:
        1px solid rgba(255,255,255,.12);
    box-shadow:
        0 15px 40px rgba(0,0,0,.45);
}
.sticker-panel.show {
    display: flex;
}
.sticker-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 0 0 auto;
    padding: 9px 10px;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1.5px;
    color: rgba(255,255,255,.5);
    border-bottom:
        1px solid rgba(255,255,255,.08);
}
.sticker-panel-close {
    border: 0;
    width: 20px;
    height: 20px;
    border-radius: 6px;
    background:
        rgba(255,255,255,.08);
    color: white;
    font-size: 11px;
    line-height: 1;
    cursor: pointer;
}
.sticker-grid {
    display: grid;
    grid-template-columns:
        repeat(4, 1fr);
    gap: 6px;
    padding: 9px;
    overflow-y: auto;
}
.sticker-grid-empty {
    grid-column: 1 / -1;
    padding: 12px 4px;
    text-align: center;
    font-size: 9px;
    color: rgba(255,255,255,.35);
}
.sticker {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    width: 100%;
    padding: 0;
    border: 0;
    border-radius: 9px;
    background:
        rgba(255,255,255,.06);
    overflow: hidden;
}
.sticker img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}
.sticker.sticker-broken,
.sticker .sticker-broken {
    width: 100%;
    height: 100%;
    border-radius: 9px;
    font-size: 16px;
}
.footer {
    margin-top: 13px;
    text-align: center;
    font-size: 9px;
    line-height: 1.6;
    color:
        rgba(255,255,255,.32);
}
@media (max-width: 350px) {
    .boards {
        grid-template-columns: 1fr;
    }
}
.page {
    display: none;
}
.page.active {
    display: block;
}
.login-page {
    padding: 26px 4px 6px;
    text-align: center;
}
.login-title {
    font-size: 25px;
    font-weight: 900;
}
.login-sub {
    margin-top: 4px;
    margin-bottom: 20px;
    font-size: 11px;
    color: rgba(255,255,255,.42);
}
.login-error {
    min-height: 14px;
    margin-top: 9px;
    font-size: 10.5px;
    color: #ff8f8f;
}
.nav-bottom {
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin-top: 14px;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.1);
}
.nav-bottom button {
    border: 0;
    padding: 16px 10px;
    background: rgba(255,255,255,.06);
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .5px;
    cursor: pointer;
}
.nav-bottom button:active {
    background: rgba(255,255,255,.15);
}
.nav-bottom button + button {
    border-left: 1px solid rgba(255,255,255,.1);
}
.back-btn {
    display: block;
    margin-bottom: 12px;
    padding: 6px 0;
    border: 0;
    background: none;
    color: rgba(255,255,255,.5);
    font-size: 10.5px;
    cursor: pointer;
}
.room-list-empty {
    margin-bottom: 12px;
    padding: 16px 10px;
    border-radius: 12px;
    text-align: center;
    font-size: 10.5px;
    color: rgba(255,255,255,.4);
    background: rgba(255,255,255,.035);
    border: 1px solid rgba(255,255,255,.06);
}
.host-tag {
    margin-top: 7px;
    text-align: center;
    font-size: 9.5px;
    color: rgba(255,255,255,.45);
}
.player-ready-tag {
    margin-top: 3px;
    font-size: 8px;
    letter-spacing: .5px;
    font-weight: 700;
    color: rgba(120,220,150,.9);
}
.player-ready-tag.waiting {
    color: rgba(255,255,255,.32);
}
</style>
<div class="wrap">
<div class="game">
<div id="bsmpToastLayer" class="bsmp-toast-layer"></div>
<div class="glow"></div>
<div class="header">
<div>
<div class="eyebrow">
    HOSHINO AI · MULTIPLAYER
</div>
<div class="title">
    BattleshipMP
</div>
</div>
<div class="connection">
<span
    id="connectionDot"
    class="connection-dot"
></span>
<span id="connectionText">
    OFFLINE
</span>
</div>
</div>
<div id="whoAmI" class="who-am-i hidden"></div>
<div id="pageLogin" class="page active login-page">
<div class="login-title">⚓ BattleshipMP</div>
<div class="login-sub">Multiplayer Battleship realtime</div>
<input
    id="loginNameInput"
    class="name-input"
    maxlength="20"
    placeholder="Masukkan nama pemainmu..."
    autocomplete="off"
>
<button
    id="loginBtn"
    class="btn btn-main"
    style="width:100%"
>
    MASUK
</button>
<div id="loginError" class="login-error"></div>
</div>
<div id="pageHome" class="page">
<div id="globalChat" class="chat global-chat">
<div class="chat-title">
    GLOBAL CHAT
</div>
<div class="chat-scope">
    Semua pemain · Chat publik
</div>
<div class="chat-log-wrap">
<div
    id="globalChatLog"
    class="chat-log"
>
<div id="globalChatJumpWrap" class="chat-jump-wrap">
<button
    id="globalChatJumpBtn"
    type="button"
    class="chat-jump"
>
    ↓ <span id="globalChatJumpCount">0</span> pesan baru
</button>
</div>
</div>
<div class="chat-scroll-controls">
<button
    id="globalChatScrollUpBtn"
    type="button"
    class="chat-scroll-btn"
    aria-label="Scroll ke atas"
>
    ▲
</button>
<button
    id="globalChatScrollDownBtn"
    type="button"
    class="chat-scroll-btn"
    aria-label="Scroll ke bawah"
>
    ▼
</button>
</div>
</div>
<div
    id="globalStickerPanel"
    class="sticker-panel"
>
<div class="sticker-panel-header">
<span>STICKERS</span>
<button
    id="globalStickerPanelClose"
    class="sticker-panel-close"
>
    ✕
</button>
</div>
<div
    id="globalStickerGrid"
    class="sticker-grid"
></div>
</div>
<div id="globalReplyBar" class="reply-bar hidden">
<div class="reply-bar-info">
<div class="reply-bar-label">
    ↩ Membalas <span id="globalReplyName">-</span>
</div>
<div id="globalReplyText" class="reply-bar-text"></div>
</div>
<button
    id="globalReplyCancel"
    type="button"
    class="reply-bar-cancel"
>
    ✕
</button>
</div>
<div class="chat-send">
<input
    id="globalChatInput"
    class="chat-input"
    maxlength="300"
    placeholder="Ketik pesan..."
    autocomplete="off"
>
<button
    id="globalStickerToggle"
    class="sticker-toggle"
>
    😊
</button>
<button
    id="sendGlobalChatBtn"
    class="send-chat"
>
    KIRIM
</button>
</div>
</div>
<div class="nav-bottom">
<button id="navRoomBtn">ROOM</button>
<button id="navJoinBtn">JOIN ROOM</button>
</div>
</div>
<div id="pageRoom" class="page">
<button id="backHomeFromRoom" class="back-btn">‹ KEMBALI KE HOME</button>
<div id="roomListEmpty" class="room-list-empty">
    Kamu belum membuat room. Buat room baru untuk mulai bermain.
</div>
<div id="activeRoomPanel" class="room-panel hidden">
<div class="room-label">
    ROOM AKTIF KAMU
</div>
<div class="room-code">
<strong id="activeRoomCode">------</strong>
</div>
<button
    id="backToActiveRoomBtn"
    class="btn btn-main"
    style="width:100%;margin-top:10px"
>
    ↻ KEMBALI KE ROOM
</button>
</div>
<button
    id="createBtn"
    class="btn btn-main"
    style="width:100%"
>
    ＋ BUAT ROOM
</button>
</div>
<div id="pageJoin" class="page">
<button id="backHomeFromJoin" class="back-btn">‹ KEMBALI KE HOME</button>
<input
    id="roomInput"
    class="room-input"
    maxlength="6"
    placeholder="Kode room..."
    autocomplete="off"
>
<button
    id="joinBtn"
    class="btn btn-main"
    style="width:100%;margin-top:8px"
>
    MASUK ROOM
</button>
<div id="joinError" class="login-error"></div>
</div>
<div id="pageGame" class="page">
<div
    id="roomPanel"
    class="room-panel"
>
<div class="room-label">
    ROOM CODE
</div>
<div class="room-code">
<strong id="roomCode">
    ------
</strong>
<div class="room-code-actions">
<button
    id="copyBtn"
    class="copy-btn"
>
    SALIN
</button>
<button
    id="shareGlobalBtn"
    class="share-btn"
>
    KIRIM KE GLOBAL CHAT
</button>
</div>
</div>
<div id="hostTag" class="host-tag">
    Host: -
</div>
<div class="players">
<div id="playerX" class="player">
<div class="player-symbol">
    ⚓ KAPTEN X
</div>
<div id="nameX" class="player-name">
    Menunggu...
</div>
<div id="readyX" class="player-ready-tag waiting">
    Belum siap
</div>
</div>
<div id="playerO" class="player">
<div class="player-symbol">
    ⚓ KAPTEN O
</div>
<div id="nameO" class="player-name">
    Menunggu...
</div>
<div id="readyO" class="player-ready-tag waiting">
    Belum siap
</div>
</div>
</div>
</div>
<div
    id="spectatorBadge"
    class="spectator-badge"
>
    👁 MODE PENONTON · MELIHAT SELURUH PERTEMPURAN
</div>
<div id="phase" class="phase">
    SETUP
</div>
<div id="status" class="status">
    Buat atau masuk room untuk bermain
</div>
<div
    id="setupPanel"
    class="ships"
>
<div class="ships-title">
    SUSUN ARMADA
</div>
<div
    id="shipList"
    class="ship-list"
></div>
<div
    id="rotateBtn"
    class="btn"
    style="margin-top:8px;text-align:center"
>
    ↻ PUTAR KAPAL
</div>
</div>
<div class="boards">
<div
    id="spectatorWatermark"
    class="spectator-watermark"
    title="Jumlah penonton"
>
<span class="eye">👁</span>
<span id="spectatorCountValue" class="count">0</span>
</div>
<div class="board-wrap" id="myBoardWrap">
<div class="board-title-row">
<div class="board-title" id="myBoardTitle">
    ARMADAMU
</div>
<span id="turnBadge" class="turn-badge">
    ✦ GILIRANMU
</span>
</div>
<div
    id="myBoard"
    class="board"
></div>
</div>
<div class="board-wrap" id="enemyBoardWrap">
<div class="board-title" id="enemyBoardTitle">
    PERAIRAN MUSUH
</div>
<div
    id="enemyBoard"
    class="board"
></div>
</div>
</div>
<div class="legend">
<span>
    <i class="dot"></i>
    Kapal
</span>
<span>
    <i class="dot hit"></i>
    Hit
</span>
<span>
    <i class="dot miss"></i>
    Miss
</span>
</div>
<div class="actions">
<button
    id="undoBtn"
    class="btn"
>
    ↩ UNDO
</button>
<button
    id="readyBtn"
    class="btn btn-main"
>
    ⚓ SIAP
</button>
<button
    id="rematchBtn"
    class="btn"
>
    ↻ REMATCH
</button>
<button
    id="leaveBtn"
    class="btn"
>
    KELUAR ROOM
</button>
</div>
<div id="roomChat" class="chat hidden">
<div class="chat-title">
    ROOM CHAT
</div>
<div
    id="chatScope"
    class="chat-scope"
>
    Chat pemain
</div>
<div class="chat-log-wrap">
<div
    id="chatLog"
    class="chat-log"
>
<div id="chatJumpWrap" class="chat-jump-wrap">
<button
    id="chatJumpBtn"
    type="button"
    class="chat-jump"
>
    ↓ <span id="chatJumpCount">0</span> pesan baru
</button>
</div>
</div>
<div class="chat-scroll-controls">
<button
    id="chatScrollUpBtn"
    type="button"
    class="chat-scroll-btn"
    aria-label="Scroll ke atas"
>
    ▲
</button>
<button
    id="chatScrollDownBtn"
    type="button"
    class="chat-scroll-btn"
    aria-label="Scroll ke bawah"
>
    ▼
</button>
</div>
</div>
<div
    id="stickerPanel"
    class="sticker-panel"
>
<div class="sticker-panel-header">
<span>STICKERS</span>
<button
    id="stickerPanelClose"
    class="sticker-panel-close"
>
    ✕
</button>
</div>
<div
    id="stickerGrid"
    class="sticker-grid"
></div>
</div>
<div id="chatReplyBar" class="reply-bar hidden">
<div class="reply-bar-info">
<div class="reply-bar-label">
    ↩ Membalas <span id="chatReplyName">-</span>
</div>
<div id="chatReplyText" class="reply-bar-text"></div>
</div>
<button
    id="chatReplyCancel"
    type="button"
    class="reply-bar-cancel"
>
    ✕
</button>
</div>
<div class="chat-send">
<input
    id="chatInput"
    class="chat-input"
    maxlength="300"
    placeholder="Ketik pesan..."
    autocomplete="off"
>
<button
    id="stickerToggle"
    class="sticker-toggle"
>
    😊
</button>
<button
    id="sendChat"
    class="send-chat"
>
    KIRIM
</button>
</div>
</div>
</div>
<div class="footer">
BattleshipMP · Realtime Multiplayer<br>
Sink all enemy ships 🚢
</div>
</div>
</div>
<script>
(function () {
'use strict';

/* ========================================================
 * CONFIG
 * ======================================================== */

const WS_URL =
    '${safeWs}';
const SERVER_PLAYER_NAME =
    ${safeIdentity};

/* ========================================================
 * DOM
 * ======================================================== */

const $ =
    id => document.getElementById(id);
const roomInput =
    $('roomInput');
const whoAmI =
    $('whoAmI');
const createBtn =
    $('createBtn');
const joinBtn =
    $('joinBtn');
const roomPanel =
    $('roomPanel');
const hostTag =
    $('hostTag');
const readyX =
    $('readyX');
const readyO =
    $('readyO');

/*
 * PAGES
 */

const pageLogin =
    $('pageLogin');
const pageHome =
    $('pageHome');
const pageRoom =
    $('pageRoom');
const pageJoin =
    $('pageJoin');
const pageGame =
    $('pageGame');
const loginNameInput =
    $('loginNameInput');
const loginBtn =
    $('loginBtn');
const loginError =
    $('loginError');
const joinError =
    $('joinError');
const navRoomBtn =
    $('navRoomBtn');
const navJoinBtn =
    $('navJoinBtn');
const backHomeFromRoom =
    $('backHomeFromRoom');
const backHomeFromJoin =
    $('backHomeFromJoin');
const roomListEmpty =
    $('roomListEmpty');
const activeRoomPanel =
    $('activeRoomPanel');
const activeRoomCode =
    $('activeRoomCode');
const backToActiveRoomBtn =
    $('backToActiveRoomBtn');
const roomCode =
    $('roomCode');
const copyBtn =
    $('copyBtn');
const shareGlobalBtn =
    $('shareGlobalBtn');
const bsmpToastLayer =
    $('bsmpToastLayer');
const phase =
    $('phase');
const statusEl =
    $('status');
const connectionDot =
    $('connectionDot');
const connectionText =
    $('connectionText');
const playerX =
    $('playerX');
const playerO =
    $('playerO');
const nameX =
    $('nameX');
const nameO =
    $('nameO');
const setupPanel =
    $('setupPanel');
const shipList =
    $('shipList');
const rotateBtn =
    $('rotateBtn');
const readyBtn =
    $('readyBtn');
const undoBtn =
    $('undoBtn');
const rematchBtn =
    $('rematchBtn');
const leaveBtn =
    $('leaveBtn');
const myBoard =
    $('myBoard');
const enemyBoard =
    $('enemyBoard');
const myBoardTitle =
    $('myBoardTitle');
const enemyBoardTitle =
    $('enemyBoardTitle');
const myBoardWrap =
    $('myBoardWrap');
const turnBadge =
    $('turnBadge');
const chatInput =
    $('chatInput');
const sendChat =
    $('sendChat');
const stickerToggle =
    $('stickerToggle');
const stickerPanel =
    $('stickerPanel');
const stickerPanelClose =
    $('stickerPanelClose');
const stickerGrid =
    $('stickerGrid');
const chatLog =
    $('chatLog');
const chatScrollUpBtn =
    $('chatScrollUpBtn');
const chatScrollDownBtn =
    $('chatScrollDownBtn');
const chatScope =
    $('chatScope');
const spectatorBadge =
    $('spectatorBadge');
const spectatorCountValue =
    $('spectatorCountValue');
const roomChat =
    $('roomChat');
const globalChatLog =
    $('globalChatLog');
const globalChatScrollUpBtn =
    $('globalChatScrollUpBtn');
const globalChatScrollDownBtn =
    $('globalChatScrollDownBtn');
const globalChatInput =
    $('globalChatInput');
const sendGlobalChatBtn =
    $('sendGlobalChatBtn');
const globalStickerToggle =
    $('globalStickerToggle');
const globalStickerPanel =
    $('globalStickerPanel');
const globalStickerPanelClose =
    $('globalStickerPanelClose');
const globalStickerGrid =
    $('globalStickerGrid');
const chatJumpWrap =
    $('chatJumpWrap');
const chatJumpBtn =
    $('chatJumpBtn');
const chatJumpCount =
    $('chatJumpCount');
const chatReplyBar =
    $('chatReplyBar');
const chatReplyName =
    $('chatReplyName');
const chatReplyText =
    $('chatReplyText');
const chatReplyCancel =
    $('chatReplyCancel');
const globalChatJumpWrap =
    $('globalChatJumpWrap');
const globalChatJumpBtn =
    $('globalChatJumpBtn');
const globalChatJumpCount =
    $('globalChatJumpCount');
const globalReplyBar =
    $('globalReplyBar');
const globalReplyName =
    $('globalReplyName');
const globalReplyText =
    $('globalReplyText');
const globalReplyCancel =
    $('globalReplyCancel');

/* ========================================================
 * PLAYER ID
 * ======================================================== */

let playerId = '';
try {
    playerId =
        localStorage.getItem(
            'battleshipmp_player_id'
        );
} catch {}
if (!playerId) {
    playerId =
        'p_' +
        Math.random()
            .toString(36)
            .slice(2) +
        Date.now()
            .toString(36);
    try {
        localStorage.setItem(
            'battleshipmp_player_id',
            playerId
        );
    } catch {}
}

/* ========================================================
 * MESSAGE ID
 *
 * Dipakai buat identitas unik tiap pesan chat (Global &
 * Room), supaya fitur Reply bisa merujuk ke pesan yang
 * benar tanpa bergantung pada index array (index bisa
 * berubah ketika history berubah).
 * ======================================================== */

function generateMessageId(prefix) {
    return (
        prefix +
        '_' +
        Math.random()
            .toString(36)
            .slice(2) +
        '_' +
        Date.now()
            .toString(36)
    );
}
function truncatePreview(text, max) {
    const clean =
        String(
            text || ''
        ).replace(/\s+/g, ' ')
            .trim();
    if (clean.length <= max) {
        return clean;
    }
    return (
        clean.slice(
            0,
            max
        ) + '…'
    );
}

/*
 * Bentuk field "replyTo" yang dikirim lewat WebSocket dari
 * state Reply yang lagi aktif (activeReply/activeGlobalReply).
 * Untuk reply ke sticker, yang dikirim cuma stickerId --
 * bukan url gambar mentah -- konsisten dengan aturan sticker
 * di seluruh plugin ini.
 */

function buildOutgoingReplyTo(entry) {
    if (!entry) {
        return null;
    }
    if (
        entry.kind ===
        'sticker'
    ) {
        return {
            messageId:
                entry.messageId,
            senderName:
                entry.name,
            kind: 'sticker',
            stickerId:
                entry.stickerId
        };
    }
    return {
        messageId:
            entry.messageId,
        senderName:
            entry.name,
        kind: 'text',
        text:
            entry.text
    };
}

/* ========================================================
 * CHAT MESSAGE STORE & REPLY STATE
 *
 * chatMessageStore / globalChatMessageStore menyimpan
 * elemen DOM tiap pesan yang masih ada di layar, dikunci
 * lewat messageId. Ini dipakai untuk fitur "klik preview
 * reply -> lompat ke pesan asli". Room Chat dan Global
 * Chat sengaja dipisah total (Map beda, tidak pernah
 * dicampur) supaya messageId dari room lain tidak pernah
 * bisa ditemukan/dirujuk dari sini -- itulah bentuk
 * validasi "per chat scope" di arsitektur ini (lihat
 * catatan di validateIncomingReplyTo).
 * ======================================================== */

const chatMessageStore =
    new Map();
const globalChatMessageStore =
    new Map();
let activeReply =
    null;
let activeGlobalReply =
    null;
let chatUnreadCount =
    0;
let globalChatUnreadCount =
    0;

/* ========================================================
 * STATE
 * ======================================================== */

let ws = null;
let globalWs = null;
let globalManualClose = false;
let globalReconnectTimer = null;
let globalReconnectAttempts = 0;
let room = '';
let playerName = '';
let mySymbol = '';
let isHost = false;
let state = null;
let manualLeave = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
let orientation = 'H';
let selectedShip = null;
let localReady = false;

/*
 * Melacak kapal (per simbol + shipId) yang sudah
 * diketahui tenggelam, supaya animasi "baru tenggelam"
 * (X → ☠) hanya diputar sekali saat kapal itu benar-benar
 * baru tenggelam, bukan diputar ulang setiap renderBoards().
 * Direset saat phase kembali ke 'setup' (match baru / rematch).
 */
let knownSunkShipKeys = new Set();

/* ========================================================
 * LOGIN / IDENTITY STATE
 * ======================================================== */

let loggedIn = false;
let myNameKey = '';

/*
 * Registry nama aktif yang diketahui client ini,
 * dibangun dari broadcast presence di Global Chat.
 * key(nama ternormalisasi) -> { playerId, name, ts }
 */
const activeNames = new Map();

/*
 * Klaim nama yang sedang berjalan (menunggu window
 * konfirmasi sebelum dianggap berhasil).
 */
let pendingClaim = null;
const NAME_CLAIM_WINDOW_MS = 900;
const PRESENCE_INTERVAL_MS = 20000;
const PRESENCE_STALE_MS = 65000;
let presenceHeartbeat = null;

/* ========================================================
 * ROOM CODE → GLOBAL CHAT COOLDOWN
 *
 * Sama seperti klaim nama, tidak ada backend custom di
 * arsitektur relay pub/sub ini, jadi cooldown "server-side"
 * didekati secara terdistribusi: setiap client yang pernah
 * melihat broadcast kirim-kode-room milik seorang pemain
 * ikut menyimpan kapan cooldown pemain itu berakhir, dan
 * WAJIB menolak percobaan kirim berikutnya sebelum waktunya
 * -- meniru pola bsmp_name_claim / bsmp_name_reject.
 *
 * Cooldown diikat ke playerId (bukan ke kode room), dan
 * disimpan juga di localStorage supaya reload halaman atau
 * reconnect WebSocket tidak mereset cooldown yang sedang
 * berjalan.
 * ======================================================== */

const ROOM_CODE_COOLDOWN_MS = 30000;
const ROOM_CODE_CLAIM_WINDOW_MS = 700;

/*
 * Registry cooldown yang diketahui client ini, dari
 * broadcast bsmp_roomcode_ack milik semua pemain
 * (termasuk diri sendiri). playerId -> readyAt(ts)
 */
const roomCodeCooldownRegistry = new Map();
let pendingRoomCodeClaim = null;
let roomCodeCooldownTickTimer = null;
function roomCodeCooldownStorageKey() {
    return (
        'battleshipmp_roomcode_cooldown_' +
        playerId
    );
}
function loadRoomCodeCooldownUntil() {
    try {
        const raw =
            localStorage.getItem(
                roomCodeCooldownStorageKey()
            );
        const ts =
            parseInt(raw, 10);
        if (
            Number.isFinite(ts) &&
            ts > Date.now()
        ) {
            return ts;
        }
    } catch {}
    return 0;
}
function saveRoomCodeCooldownUntil(readyAt) {
    try {
        localStorage.setItem(
            roomCodeCooldownStorageKey(),
            String(readyAt)
        );
    } catch {}
}

/*
 * Validasi kode room saat Join Room. Kalau tidak ada
 * balasan 'bsmp_joined' dalam JOIN_TIMEOUT_MS, kode
 * dianggap tidak valid dan halaman Join Room tidak
 * berpindah.
 */

let pendingJoinRoom = '';
let joinTimeoutHandle = null;
const JOIN_TIMEOUT_MS = 6000;

/* ========================================================
 * SHIPS
 * ======================================================== */

const SHIPS = [
    {
        id: 'carrier',
        name: 'Carrier',
        short: 'Carrier',
        size: 5
    },
    {
        id: 'battleship',
        name: 'Battleship',
        short: 'Battle',
        size: 4
    },
    {
        id: 'cruiser',
        name: 'Cruiser',
        short: 'Cruiser',
        size: 3
    },
    {
        id: 'submarine',
        name: 'Submarine',
        short: 'Sub',
        size: 3
    },
    {
        id: 'destroyer',
        name: 'Destroyer',
        short: 'Destroy',
        size: 2
    }
];

/* ========================================================
 * STICKERS
 *
 * Daftar sticker (id + url gambar, sudah berupa data URI
 * base64) dikirim dari sisi bot (server-side fetch) lewat
 * interpolasi ${safeStickers} saat HTML ini dirender --
 * lihat STICKER_SOURCES di source Node.js untuk menambah
 * atau mengganti sticker. STICKERS di sini murni data,
 * bukan tempat mengedit sticker.
 * ======================================================== */

const STICKERS = ${safeStickers};

/*
 * Lookup id → url. Ini yang dijadikan sumber kebenaran
 * saat mengirim maupun menerima sticker -- client lain
 * tidak pernah dipercaya membawa url mentahnya sendiri,
 * hanya stickerId yang dikirim lewat WebSocket lalu
 * di-resolve ulang lewat map terdaftar ini.
 */

const STICKER_MAP = new Map(
    STICKERS.map(
        s => [
            s.id,
            s.url
        ]
    )
);

function getStickerUrl(stickerId) {
    return STICKER_MAP.get(stickerId) || '';
}

/* ========================================================
 * BOARD
 * ======================================================== */

const SIZE = 10;
function emptyBoard() {
    return Array(
        SIZE * SIZE
    ).fill(null);
}

/* ========================================================
 * DEFAULT STATE
 * ======================================================== */

function defaultState() {
    return {
        room,
        hostId: '',
        phase: 'setup',
        turn: 'X',
        winner: null,
        players: [],
        spectators: [],
        boards: {
            X: emptyBoard(),
            O: emptyBoard()
        },
        ships: {
            X: [],
            O: []
        },
        shots: {
            X: [],
            O: []
        },
        ready: {
            X: false,
            O: false
        },
        scores: {
            X: 0,
            O: 0
        }
    };
}

/* ========================================================
 * HELPERS
 * ======================================================== */

function isSpectator() {
    return (
        mySymbol !== 'X' &&
        mySymbol !== 'O'
    );
}
function getSpectatorCount() {
    return (
        state?.spectators?.length ||
        0
    );
}
function getEnemySymbol() {
    return mySymbol === 'X'
        ? 'O'
        : 'X';
}
function getPlayerBySymbol(
    symbol
) {
    return state?.players?.find(
        p =>
            p.symbol === symbol
    );
}
function setConnection(
    type,
    text
) {
    connectionDot.className =
        'connection-dot';
    if (
        type === 'online'
    ) {
        connectionDot.classList.add(
            'online'
        );
    }
    if (
        type === 'error'
    ) {
        connectionDot.classList.add(
            'error'
        );
    }
    connectionText.textContent =
        text;
}
function setStatus(text) {
    statusEl.textContent =
        text;
}

/* ========================================================
 * TOAST
 * ======================================================== */

function showToast(text, kind) {
    if (!bsmpToastLayer) {
        return;
    }
    const node =
        document.createElement(
            'div'
        );
    node.className =
        'bsmp-toast' +
        (
            kind
                ? ' ' + kind
                : ''
        );
    node.textContent =
        text;
    bsmpToastLayer.appendChild(
        node
    );
    setTimeout(
        function () {
            node.remove();
        },
        3200
    );
}
function randomRoom() {
    const chars =
        'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (
        let i = 0;
        i < 6;
        i++
    ) {
        result +=
            chars[
                Math.floor(
                    Math.random() *
                    chars.length
                )
            ];
    }
    return result;
}

/* ========================================================
 * NAME NORMALIZATION / VALIDATION
 *
 * Nama pemain WAJIB diisi sendiri lewat halaman Login.
 * PushName WhatsApp (SERVER_PLAYER_NAME) tidak lagi
 * dipakai sebagai identitas pemain, hanya tersedia
 * sebagai referensi internal bila diperlukan bot.
 * ======================================================== */

function normalizeName(raw) {
    return String(raw || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}
function cleanDisplayName(raw) {
    return String(raw || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 20);
}
function validateNameFormat(raw) {
    const display =
        cleanDisplayName(raw);
    if (!display) {
        return {
            ok: false,
            message:
                'Nama tidak boleh kosong.'
        };
    }
    if (
        !normalizeName(display)
    ) {
        return {
            ok: false,
            message:
                'Nama tidak boleh hanya berisi spasi.'
        };
    }
    return {
        ok: true,
        display
    };
}
function isNameTakenLocally(
    key,
    excludePlayerId
) {
    const entry =
        activeNames.get(key);
    if (!entry) {
        return false;
    }
    if (
        excludePlayerId &&
        entry.playerId ===
        excludePlayerId
    ) {
        return false;
    }
    return true;
}
function send(data) {
    if (
        !ws ||
        ws.readyState !==
        WebSocket.OPEN
    ) {
        return false;
    }
    try {
        ws.send(
            JSON.stringify(data)
        );
        return true;
    } catch {
        return false;
    }
}
function sendGlobal(data) {
    if (
        !globalWs ||
        globalWs.readyState !==
        WebSocket.OPEN
    ) {
        return false;
    }
    try {
        globalWs.send(
            JSON.stringify(data)
        );
        return true;
    } catch {
        return false;
    }
}

/* ========================================================
 * CONNECT
 * ======================================================== */

function connect() {
    if (!room) return;
    manualLeave = false;
    if (ws) {
        try {
            ws.close();
        } catch {}
    }
    setConnection(
        '',
        'CONNECTING'
    );
    try {
        ws =
            new WebSocket(
                WS_URL
            );
        ws.onopen =
            function () {
                reconnectAttempts = 0;
                setConnection(
                    'online',
                    'ONLINE'
                );
                send({
                    type:
                        'bsmp_join',
                    room,
                    playerId,
                    name:
                        playerName,
                    host:
                        isHost
                });
            };
        ws.onmessage =
            function (event) {
                let data;
                try {
                    data =
                        JSON.parse(
                            event.data
                        );
                } catch {
                    return;
                }
                handleMessage(
                    data
                );
            };
        ws.onerror =
            function () {
                setConnection(
                    'error',
                    'ERROR'
                );
            };
        ws.onclose =
            function () {
                setConnection(
                    'error',
                    'CLOSED'
                );
                if (
                    room &&
                    !manualLeave
                ) {
                    setStatus(
                        'Koneksi terputus. Mencoba kembali...'
                    );
                    scheduleReconnect();
                }
            };
    } catch {
        setConnection(
            'error',
            'FAILED'
        );
        scheduleReconnect();
    }
}

/* ========================================================
 * RECONNECT
 * ======================================================== */

function scheduleReconnect() {
    if (reconnectTimer) {
        return;
    }
    const delay =
        Math.min(
            1000 *
            Math.pow(
                2,
                reconnectAttempts
            ),
            10000
        );
    reconnectAttempts++;
    reconnectTimer =
        setTimeout(
            function () {
                reconnectTimer =
                    null;
                connect();
            },
            delay
        );
}

/* ========================================================
 * CONNECT GLOBAL
 *
 * Koneksi terpisah untuk Global Lobby Chat.
 * Terhubung begitu HTML dibuka, tidak butuh room.
 * ======================================================== */

function connectGlobal() {
    globalManualClose = false;
    if (globalWs) {
        try {
            globalWs.close();
        } catch {}
    }
    try {
        globalWs =
            new WebSocket(
                WS_URL
            );
        globalWs.onopen =
            function () {
                globalReconnectAttempts = 0;

                /*
                 * Kalau pemain sudah login,
                 * umumkan ulang kehadiran namanya
                 * (misalnya setelah reconnect).
                 */

                if (
                    loggedIn &&
                    playerName
                ) {
                    sendGlobal({
                        type:
                            'bsmp_global_join',
                        playerId,
                        name:
                            playerName
                    });
                }
            };
        globalWs.onmessage =
            function (event) {
                let data;
                try {
                    data =
                        JSON.parse(
                            event.data
                        );
                } catch {
                    return;
                }
                handleGlobalMessage(
                    data
                );
            };
        globalWs.onerror =
            function () {};
        globalWs.onclose =
            function () {
                if (!globalManualClose) {
                    scheduleGlobalReconnect();
                }
            };
    } catch {
        scheduleGlobalReconnect();
    }
}
function scheduleGlobalReconnect() {
    if (globalReconnectTimer) {
        return;
    }
    const delay =
        Math.min(
            1000 *
            Math.pow(
                2,
                globalReconnectAttempts
            ),
            10000
        );
    globalReconnectAttempts++;
    globalReconnectTimer =
        setTimeout(
            function () {
                globalReconnectTimer =
                    null;
                connectGlobal();
            },
            delay
        );
}

/* ========================================================
 * GLOBAL MESSAGE
 *
 * Menangani hanya pesan Global Lobby.
 * Pesan room (bsmp_join, bsmp_state, dst) yang
 * ikut ter-broadcast di channel yang sama akan
 * diabaikan di sini.
 * ======================================================== */

function handleGlobalMessage(data) {
    if (!data) return;

    /*
     * ── NAME REGISTRY / PRESENCE ──
     *
     * Karena WS_URL adalah channel relay pub/sub
     * (tanpa proses backend custom yang bisa menyimpan
     * state), pengecekan nama unik dilakukan secara
     * terdistribusi: setiap client menyimpan registry
     * nama aktif dari broadcast yang didengarnya, dan
     * setiap klaim nama baru diumumkan lebih dulu supaya
     * client lain yang sudah memakai nama itu bisa
     * menolaknya sebelum dianggap berhasil.
     */

    if (
        data.type ===
        'bsmp_global_join'
    ) {
        if (
            !data.playerId ||
            !data.name
        ) {
            return;
        }
        const key =
            normalizeName(
                data.name
            );
        if (!key) return;
        activeNames.set(
            key,
            {
                playerId:
                    data.playerId,
                name:
                    data.name,
                ts:
                    Date.now()
            }
        );
        return;
    }
    if (
        data.type ===
        'bsmp_global_leave'
    ) {
        if (!data.playerId) return;
        for (
            const [
                key,
                entry
            ] of activeNames
        ) {
            if (
                entry.playerId ===
                data.playerId
            ) {
                activeNames.delete(
                    key
                );
            }
        }
        return;
    }
    if (
        data.type ===
        'bsmp_name_claim'
    ) {
        handleIncomingNameClaim(
            data
        );
        return;
    }
    if (
        data.type ===
        'bsmp_name_reject'
    ) {
        if (
            pendingClaim &&
            data.targetPlayerId ===
            playerId &&
            data.key ===
            pendingClaim.key
        ) {
            pendingClaim.rejected =
                true;
        }
        return;
    }

    /*
     * ── ROOM CODE COOLDOWN (lihat komentar di
     *    deklarasi ROOM_CODE_COOLDOWN_MS) ──
     */

    if (
        data.type ===
        'bsmp_roomcode_claim'
    ) {
        handleIncomingRoomCodeClaim(
            data
        );
        return;
    }
    if (
        data.type ===
        'bsmp_roomcode_reject'
    ) {
        if (
            pendingRoomCodeClaim &&
            data.targetPlayerId ===
            playerId &&
            data.reqId ===
            pendingRoomCodeClaim.reqId
        ) {
            pendingRoomCodeClaim.rejected =
                true;
            pendingRoomCodeClaim.remainingMs =
                data.remainingMs;
        }
        return;
    }
    if (
        data.type ===
        'bsmp_roomcode_ack'
    ) {
        if (
            !data.playerId ||
            !data.readyAt
        ) {
            return;
        }
        const existingReadyAt =
            roomCodeCooldownRegistry.get(
                data.playerId
            ) || 0;
        roomCodeCooldownRegistry.set(
            data.playerId,
            Math.max(
                existingReadyAt,
                data.readyAt
            )
        );
        return;
    }
    if (
        data.type !==
        'bsmp_global_chat'
    ) {
        return;
    }
    const globalReplyTo =
        validateIncomingReplyTo(
            data.replyTo
        );
    const globalIsSelf =
        !!data.playerId &&
        data.playerId ===
        playerId;
    if (
        data.sticker
    ) {
        const url =
            getStickerUrl(
                data.stickerId
            );
        if (!url) {
            addGlobalChat(
                data.name,
                'Sticker tidak tersedia.',
                {
                    replyable: false
                }
            );
            return;
        }
        addGlobalSticker(
            data.name,
            url,
            {
                id:
                    data.messageId ||
                    undefined,
                stickerId:
                    data.stickerId,
                replyTo:
                    globalReplyTo,
                isSelf:
                    globalIsSelf
            }
        );
        return;
    }
    addGlobalChat(
        data.name,
        data.message,
        {
            id:
                data.messageId ||
                undefined,
            replyTo:
                globalReplyTo,
            isSelf:
                globalIsSelf
        }
    );
}

/* ========================================================
 * NAME CLAIM PROTOCOL
 *
 * "Terhubung" pengecekan server-side yang sebenarnya
 * tidak tersedia di arsitektur relay pub/sub ini, jadi
 * setiap client bertindak sebagai penjaga bersama: siapa
 * pun yang sudah aktif memakai sebuah nama WAJIB menolak
 * klaim baru untuk nama yang sama. Tie-break memakai
 * timestamp lalu playerId supaya semua client mengambil
 * keputusan yang sama untuk klaim yang datang hampir
 * bersamaan.
 * ======================================================== */

function claimHasPriority(
    a,
    b
) {

    /*
     * true jika klaim "a" berhak menang
     * dibanding klaim "b".
     */

    if (a.ts !== b.ts) {
        return a.ts < b.ts;
    }
    return (
        String(a.playerId) <
        String(b.playerId)
    );
}
function handleIncomingNameClaim(data) {
    if (
        !data.key ||
        !data.playerId ||
        data.playerId === playerId
    ) {
        return;
    }

    /*
     * 1. Apakah aku sudah aktif
     *    memakai nama ini?
     */

    if (
        loggedIn &&
        myNameKey === data.key
    ) {
        sendGlobal({
            type:
                'bsmp_name_reject',
            key:
                data.key,
            targetPlayerId:
                data.playerId,
            reason:
                'active'
        });
        return;
    }
    const existing =
        activeNames.get(
            data.key
        );
    if (
        existing &&
        existing.playerId !==
        data.playerId
    ) {
        sendGlobal({
            type:
                'bsmp_name_reject',
            key:
                data.key,
            targetPlayerId:
                data.playerId,
            reason:
                'active'
        });
        return;
    }

    /*
     * 2. Apakah aku juga sedang
     *    mengklaim nama yang sama?
     */

    if (
        pendingClaim &&
        pendingClaim.key ===
        data.key
    ) {
        const incoming = {
            ts:
                Number(data.ts) ||
                Date.now(),
            playerId:
                data.playerId
        };
        if (
            claimHasPriority(
                pendingClaim,
                incoming
            )
        ) {

            /*
             * Klaimku lebih berhak menang,
             * tolak klaim yang masuk.
             */

            sendGlobal({
                type:
                    'bsmp_name_reject',
                key:
                    data.key,
                targetPlayerId:
                    data.playerId,
                reason:
                    'race'
            });
        } else {

            /*
             * Klaim yang masuk lebih berhak,
             * batalkan klaimku sendiri.
             */

            pendingClaim.rejected =
                true;
        }
    }
}

/*
 * Peer lain sedang mencoba kirim kode room ke Global
 * Chat. Kalau aku tahu pemain itu masih cooldown (dari
 * bsmp_roomcode_ack sebelumnya), tolak percobaannya.
 */
function handleIncomingRoomCodeClaim(data) {
    if (
        !data.playerId ||
        !data.reqId ||
        data.playerId === playerId
    ) {
        return;
    }
    const readyAt =
        roomCodeCooldownRegistry.get(
            data.playerId
        ) || 0;
    const now =
        Date.now();
    if (readyAt > now) {
        sendGlobal({
            type:
                'bsmp_roomcode_reject',
            reqId:
                data.reqId,
            targetPlayerId:
                data.playerId,
            remainingMs:
                readyAt - now
        });
    }
}
function startPresenceHeartbeat() {
    stopPresenceHeartbeat();
    presenceHeartbeat =
        setInterval(
            function () {
                if (
                    loggedIn &&
                    playerName
                ) {
                    sendGlobal({
                        type:
                            'bsmp_global_join',
                        playerId,
                        name:
                            playerName
                    });
                }
            },
            PRESENCE_INTERVAL_MS
        );
}
function stopPresenceHeartbeat() {
    if (presenceHeartbeat) {
        clearInterval(
            presenceHeartbeat
        );
        presenceHeartbeat =
            null;
    }
}

/* ========================================================
 * LOGIN FLOW
 * ======================================================== */

function attemptNameClaim(
    display,
    key
) {
    return new Promise(
        function (resolve) {
            const claim = {
                key,
                ts:
                    Date.now(),
                playerId,
                rejected:
                    false
            };
            pendingClaim =
                claim;
            sendGlobal({
                type:
                    'bsmp_name_claim',
                key,
                name:
                    display,
                playerId,
                ts:
                    claim.ts
            });
            setTimeout(
                function () {
                    const won =
                        pendingClaim ===
                        claim &&
                        !claim.rejected;
                    if (
                        pendingClaim ===
                        claim
                    ) {
                        pendingClaim =
                            null;
                    }
                    resolve(
                        won
                    );
                },
                NAME_CLAIM_WINDOW_MS
            );
        }
    );
}
async function performLogin() {
    const raw =
        loginNameInput
            ? loginNameInput.value
            : '';
    const validation =
        validateNameFormat(
            raw
        );
    if (!validation.ok) {
        if (loginError) {
            loginError.textContent =
                validation.message;
        }
        return;
    }
    const display =
        validation.display;
    const key =
        normalizeName(
            display
        );
    loginBtn.disabled =
        true;
    loginBtn.textContent =
        'MEMERIKSA NAMA...';
    if (loginError) {
        loginError.textContent = '';
    }

    /*
     * Pastikan koneksi Global sudah aktif
     * sebelum melakukan pengecekan nama,
     * supaya registry nama aktif terisi.
     */

    if (
        !globalWs ||
        globalWs.readyState !==
        WebSocket.OPEN
    ) {
        connectGlobal();
        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    500
                )
        );
    }
    if (
        isNameTakenLocally(
            key,
            playerId
        )
    ) {
        loginBtn.disabled =
            false;
        loginBtn.textContent =
            'MASUK';
        if (loginError) {
            loginError.textContent =
                'Nama tersebut sudah digunakan. Silakan gunakan nama lain.';
        }
        return;
    }
    const won =
        await attemptNameClaim(
            display,
            key
        );
    loginBtn.disabled =
        false;
    loginBtn.textContent =
        'MASUK';
    if (!won) {
        if (loginError) {
            loginError.textContent =
                'Nama tersebut sudah digunakan. Silakan gunakan nama lain.';
        }
        return;
    }

    /*
     * Login berhasil.
     */

    playerName =
        display;
    myNameKey =
        key;
    loggedIn =
        true;
    activeNames.set(
        key,
        {
            playerId,
            name:
                display,
            ts:
                Date.now()
        }
    );
    sendGlobal({
        type:
            'bsmp_global_join',
        playerId,
        name:
            playerName
    });
    startPresenceHeartbeat();
    if (whoAmI) {
        whoAmI.textContent =
            'Kamu bermain sebagai: ' +
            playerName;
        whoAmI.classList.remove(
            'hidden'
        );
    }
    showPage(
        'home'
    );
}

/* ========================================================
 * PAGE ROUTER
 *
 * LOGIN → HOME → ROOM/JOIN ROOM → LOBBY/BATTLESHIP
 *
 * Berpindah halaman TIDAK memutus koneksi WebSocket.
 * Semua koneksi (global & room) dan state game tetap
 * hidup di background terlepas dari halaman yang aktif.
 * ======================================================== */

const PAGES = {
    login:
        pageLogin,
    home:
        pageHome,
    room:
        pageRoom,
    join:
        pageJoin,
    game:
        pageGame
};
function showPage(name) {
    for (
        const key in PAGES
    ) {
        const el =
            PAGES[key];
        if (!el) continue;
        el.classList.toggle(
            'active',
            key === name
        );
    }
}
if (navRoomBtn) {
    navRoomBtn.onclick =
        function () {
            const hasRoom =
                Boolean(room);
            if (roomListEmpty) {
                roomListEmpty.classList.toggle(
                    'hidden',
                    hasRoom
                );
            }
            if (activeRoomPanel) {
                activeRoomPanel.classList.toggle(
                    'hidden',
                    !hasRoom
                );
            }
            if (
                activeRoomCode &&
                hasRoom
            ) {
                activeRoomCode.textContent =
                    room;
            }
            showPage(
                'room'
            );
        };
}
if (backToActiveRoomBtn) {
    backToActiveRoomBtn.onclick =
        function () {
            if (room) {
                showPage(
                    'game'
                );
            }
        };
}
if (navJoinBtn) {
    navJoinBtn.onclick =
        function () {
            if (joinError) {
                joinError.textContent = '';
            }
            showPage(
                'join'
            );
        };
}
if (backHomeFromRoom) {
    backHomeFromRoom.onclick =
        function () {
            showPage(
                'home'
            );
        };
}
if (backHomeFromJoin) {
    backHomeFromJoin.onclick =
        function () {
            showPage(
                'home'
            );
        };
}

/* ========================================================
 * CREATE ROOM
 * ======================================================== */

function createRoom() {
    if (!loggedIn) {
        showPage(
            'login'
        );
        return;
    }
    room =
        randomRoom();
    mySymbol =
        'X';
    isHost =
        true;
    localReady =
        false;
    state =
        defaultState();
    state.hostId =
        playerId;
    state.players.push({
        id:
            playerId,
        name:
            playerName,
        symbol:
            'X',
        connected:
            true
    });
    roomPanel.classList.add(
        'show'
    );
    roomChat.classList.remove(
        'hidden'
    );
    roomCode.textContent =
        room;
    showPage(
        'game'
    );
    render();
    resetRoomChatState();
    addSystem(
        'Room dibuat. Bagikan kode ' +
        room +
        ' ke pemain kedua.'
    );
    connect();
}

/* ========================================================
 * JOIN ROOM
 * ======================================================== */

function joinRoom() {
    if (joinError) {
        joinError.textContent = '';
    }
    if (!loggedIn) {
        showPage(
            'login'
        );
        return;
    }
    const code =
        String(
            roomInput.value || ''
        )
        .trim()
        .toUpperCase()
        .slice(0, 6);
    if (!code) {
        if (joinError) {
            joinError.textContent =
                'Masukkan kode room.';
        }
        return;
    }
    room =
        code;
    mySymbol =
        '';
    isHost =
        false;
    localReady =
        false;
    state =
        null;
    roomPanel.classList.add(
        'show'
    );
    roomChat.classList.remove(
        'hidden'
    );
    roomCode.textContent =
        room;
    resetRoomChatState();

    /*
     * Jangan pindah halaman dulu. Tunggu
     * konfirmasi 'bsmp_joined' dari host,
     * atau timeout jika kode tidak valid.
     */

    pendingJoinRoom =
        room;
    if (joinTimeoutHandle) {
        clearTimeout(
            joinTimeoutHandle
        );
    }
    joinTimeoutHandle =
        setTimeout(
            function () {
                joinTimeoutHandle =
                    null;
                if (
                    pendingJoinRoom !==
                    room
                ) {
                    return;
                }
                pendingJoinRoom =
                    '';
                if (joinError) {
                    joinError.textContent =
                        'Kode room tidak ditemukan atau room sudah tidak aktif. Coba lagi.';
                }
                if (ws) {
                    try {
                        ws.close();
                    } catch {}
                    ws = null;
                }
                room =
                    '';
                state =
                    null;
                setConnection(
                    '',
                    'OFFLINE'
                );
            },
            JOIN_TIMEOUT_MS
        );
    connect();
}

/* ========================================================
 * MESSAGE
 * ======================================================== */

function handleMessage(data) {
    if (!data) return;
    if (
        data.type ===
        'bsmp_join'
    ) {
        if (!isHost) {
            return;
        }
        if (
            data.room !== room
        ) {
            return;
        }
        handleJoin(
            data
        );
        return;
    }
    if (
        data.type ===
        'bsmp_joined'
    ) {
        if (
            data.playerId ===
            playerId
        ) {
            mySymbol =
                data.symbol ||
                '';
            isHost =
                data.hostId ===
                playerId;

            /*
             * Konfirmasi bahwa room valid & kita
             * berhasil masuk. Batalkan timeout
             * validasi Join Room dan pindah ke Lobby.
             */

            if (
                pendingJoinRoom &&
                pendingJoinRoom === room
            ) {
                pendingJoinRoom =
                    '';
                if (joinTimeoutHandle) {
                    clearTimeout(
                        joinTimeoutHandle
                    );
                    joinTimeoutHandle =
                        null;
                }
                showPage(
                    'game'
                );
            }
        }
        if (data.data) {
            state =
                data.data;
            render();
        }
        if (data.message) {
            addSystem(
                data.message
            );
        }
        return;
    }
    if (
        data.type ===
        'bsmp_state'
    ) {
        if (
            data.room !== room
        ) {
            return;
        }
        state =
            data.data;
        if (
            data.hostId
        ) {
            isHost =
                data.hostId ===
                playerId;
        }
        const me =
            state.players?.find(
                p =>
                    p.id === playerId
            );
        if (me) {
            mySymbol =
                me.symbol;
        }
        localReady =
            Boolean(
                state.ready?.[
                    mySymbol
                ]
            );
        render();
        return;
    }
    if (
        data.type ===
        'bsmp_place'
    ) {
        if (
            !isHost ||
            data.room !== room
        ) {
            return;
        }
        processPlace(
            data
        );
        return;
    }
    if (
        data.type ===
        'bsmp_ready'
    ) {
        if (
            !isHost ||
            data.room !== room
        ) {
            return;
        }
        processReady(
            data.playerId
        );
        return;
    }
    if (
        data.type ===
        'bsmp_undo'
    ) {
        if (
            !isHost ||
            data.room !== room
        ) {
            return;
        }
        processUndo(
            data.playerId
        );
        return;
    }
    if (
        data.type ===
        'bsmp_shot'
    ) {
        if (
            !isHost ||
            data.room !== room
        ) {
            return;
        }
        processShot(
            data
        );
        return;
    }
    if (
        data.type ===
        'bsmp_rematch'
    ) {
        if (
            !isHost ||
            data.room !== room
        ) {
            return;
        }
        processRematch(
            data.playerId
        );
        return;
    }

    /*
     * ROOM CHAT (sticker)
     *
     * Client hanya mengirim stickerId, URL gambar
     * di-resolve di sisi penerima lewat STICKER_MAP
     * (bukan url mentah yang dikirim client), jadi
     * pengguna cuma bisa mengirim sticker yang memang
     * terdaftar. Audience players/spectators tetap
     * dipisah seperti chat teks biasa.
     */
    if (
        data.type ===
        'bsmp_sticker'
    ) {
        if (
            data.room !== room
        ) {
            return;
        }
        const audience =
            data.audience;
        if (
            audience !==
            'players' &&
            audience !==
            'spectators'
        ) {
            return;
        }
        if (
            audience ===
            'players' &&
            isSpectator()
        ) {
            return;
        }
        if (
            audience ===
            'spectators' &&
            !isSpectator()
        ) {
            return;
        }
        const url =
            getStickerUrl(
                data.stickerId
            );
        if (!url) {
            addChat(
                data.name,
                'Sticker tidak tersedia.',
                {
                    replyable: false
                }
            );
            return;
        }
        addSticker(
            data.name,
            url,
            {
                id:
                    data.messageId ||
                    undefined,
                stickerId:
                    data.stickerId,
                replyTo:
                    validateIncomingReplyTo(
                        data.replyTo
                    ),
                isSelf:
                    !!data.playerId &&
                    data.playerId ===
                    playerId
            }
        );
        return;
    }

    /*
     * Chat text spectator/player
     */
    if (
        data.type ===
        'bsmp_chat'
    ) {
        if (
            data.room !== room
        ) {
            return;
        }
        if (
            data.audience ===
            'players'
        ) {
            if (!isSpectator()) {
                addChat(
                    data.name,
                    data.message,
                    {
                        id:
                            data.messageId ||
                            undefined,
                        replyTo:
                            validateIncomingReplyTo(
                                data.replyTo
                            ),
                        isSelf:
                            !!data.playerId &&
                            data.playerId ===
                            playerId
                    }
                );
            }
            return;
        }
        if (
            data.audience ===
            'spectators'
        ) {
            if (isSpectator()) {
                addChat(
                    data.name,
                    data.message,
                    {
                        id:
                            data.messageId ||
                            undefined,
                        replyTo:
                            validateIncomingReplyTo(
                                data.replyTo
                            ),
                        isSelf:
                            !!data.playerId &&
                            data.playerId ===
                            playerId
                    }
                );
            }
            return;
        }
    }
    if (
        data.type ===
        'bsmp_leave'
    ) {
        if (
            data.room !== room
        ) {
            return;
        }
        handlePlayerLeave(
            data
        );
        return;
    }
    if (
        data.type ===
        'bsmp_spectator_ping'
    ) {
        if (!isHost) {
            return;
        }
        if (
            data.room !== room
        ) {
            return;
        }
        if (!state) {
            return;
        }
        const spectator =
            state.spectators?.find(
                s =>
                    s.id ===
                    data.playerId
            );
        if (spectator) {
            spectator.lastSeen =
                Date.now();
        }
        return;
    }
}

/* ========================================================
 * JOIN - HOST
 * ======================================================== */

function handleJoin(data) {
    if (!state) {
        state =
            defaultState();
    }
    let existing =
        state.players.find(
            p =>
                p.id ===
                data.playerId
        );
    if (existing) {
        existing.connected =
            true;
        existing.name =
            String(
                data.name ||
                existing.name ||
                'Kapten'
            ).slice(
                0,
                20
            );
    } else {
        if (
            state.players.length >= 2
        ) {

            /*
             * PLAYER 3+
             * menjadi spectator.
             *
             * Host adalah sumber jumlah penonton:
             * dicatat di state.spectators, bukan
             * hanya dihitung di browser masing-
             * masing client.
             */

            if (!state.spectators) {
                state.spectators = [];
            }
            let spectator =
                state.spectators.find(
                    s =>
                        s.id ===
                        data.playerId
                );
            if (spectator) {

                /*
                 * Reconnect spectator yang sama:
                 * jangan tambah dobel.
                 */

                spectator.name =
                    String(
                        data.name ||
                        spectator.name ||
                        'Kapten'
                    ).slice(
                        0,
                        20
                    );
                spectator.lastSeen =
                    Date.now();
            } else {
                spectator = {
                    id:
                        data.playerId,
                    name:
                        String(
                            data.name ||
                            'Kapten'
                        ).slice(
                            0,
                            20
                        ),
                    lastSeen:
                        Date.now()
                };
                state.spectators.push(
                    spectator
                );
            }
            send({
                type:
                    'bsmp_joined',
                room,
                playerId:
                    data.playerId,
                symbol:
                    '',
                hostId:
                    state.hostId,
                data:
                    state,
                message:
                    'Kamu masuk sebagai penonton.'
            });
            broadcastState();
            return;
        }
        const symbol =
            state.players.some(
                p =>
                    p.symbol === 'X'
            )
                ? 'O'
                : 'X';
        existing = {
            id:
                data.playerId,
            name:
                String(
                    data.name ||
                    'Kapten'
                ).slice(
                    0,
                    20
                ),
            symbol,
            connected:
                true
        };
        state.players.push(
            existing
        );
    }
    state.hostId =
        state.hostId ||
        playerId;
    send({
        type:
            'bsmp_joined',
        room,
        playerId:
            data.playerId,
        symbol:
            existing.symbol,
        hostId:
            state.hostId,
        data:
            state,
        message:
            existing.name +
            ' masuk ke room.'
    });
    broadcastState();
}

/* ========================================================
 * BROADCAST
 * ======================================================== */

function broadcastState() {
    if (!state) return;
    state.room =
        room;
    send({
        type:
            'bsmp_state',
        room,
        hostId:
            state.hostId,
        data:
            state,
        sender:
            playerId
    });
    render();
}

/* ========================================================
 * BOARD VALIDATION
 * ======================================================== */

function getCellsForShip(
    row,
    col,
    size,
    direction
) {
    const cells = [];
    for (
        let i = 0;
        i < size;
        i++
    ) {
        const r =
            row +
            (
                direction === 'V'
                    ? i
                    : 0
            );
        const c =
            col +
            (
                direction === 'H'
                    ? i
                    : 0
            );
        if (
            r < 0 ||
            r >= SIZE ||
            c < 0 ||
            c >= SIZE
        ) {
            return null;
        }
        cells.push(
            r * SIZE + c
        );
    }
    return cells;
}
function canPlaceShip(
    board,
    cells
) {
    if (!cells) {
        return false;
    }
    return cells.every(
        index =>
            !board[index]
    );
}

/* ========================================================
 * PLACE SHIP
 * ======================================================== */

function placeShip(
    row,
    col
) {
    if (!state) return;
    if (
        state.phase !==
        'setup'
    ) {
        return;
    }
    if (isSpectator()) {
        setStatus(
            '👁 Kamu hanya menjadi penonton.'
        );
        return;
    }
    if (!selectedShip) {
        setStatus(
            'Pilih kapal terlebih dahulu.'
        );
        return;
    }
    const ship =
        SHIPS.find(
            s =>
                s.id ===
                selectedShip
        );
    if (!ship) return;
    const mine =
        state.ships[
            mySymbol
        ] || [];
    if (
        mine.some(
            s =>
                s.id ===
                ship.id
        )
    ) {
        return;
    }
    const cells =
        getCellsForShip(
            row,
            col,
            ship.size,
            orientation
        );
    if (
        !canPlaceShip(
            state.boards[
                mySymbol
            ],
            cells
        )
    ) {
        setStatus(
            'Posisi kapal tidak valid.'
        );
        return;
    }
    if (isHost) {
        processPlace({
            playerId,
            shipId:
                ship.id,
            row,
            col,
            direction:
                orientation
        });
    } else {
        send({
            type:
                'bsmp_place',
            room,
            playerId,
            shipId:
                ship.id,
            row,
            col,
            direction:
                orientation
        });
    }
}

/* ========================================================
 * PROCESS PLACE - HOST
 * ======================================================== */

function processPlace(data) {
    if (!state) return;
    const player =
        state.players.find(
            p =>
                p.id ===
                data.playerId
        );
    if (!player) return;
    const symbol =
        player.symbol;
    if (
        symbol !== 'X' &&
        symbol !== 'O'
    ) {
        return;
    }
    const ship =
        SHIPS.find(
            s =>
                s.id ===
                data.shipId
        );
    if (!ship) return;
    const ships =
        state.ships[
            symbol
        ];
    if (
        ships.some(
            s =>
                s.id ===
                ship.id
        )
    ) {
        return;
    }
    const row =
        Number(data.row);
    const col =
        Number(data.col);
    const direction =
        data.direction === 'V'
            ? 'V'
            : 'H';
    if (
        !Number.isInteger(row) ||
        !Number.isInteger(col)
    ) {
        return;
    }
    const cells =
        getCellsForShip(
            row,
            col,
            ship.size,
            direction
        );
    if (
        !canPlaceShip(
            state.boards[
                symbol
            ],
            cells
        )
    ) {
        return;
    }
    for (
        const index of cells
    ) {
        state.boards[
            symbol
        ][index] =
            ship.id;
    }
    ships.push({
        id:
            ship.id,
        cells,
        hits: []
    });
    broadcastState();
}

/* ========================================================
 * UNDO PLACEMENT
 *
 * Hanya berlaku saat fase 'setup'. Kapal terakhir yang
 * ditaruh pemain (elemen terakhir state.ships[symbol],
 * yang memang sudah berurutan sesuai urutan penempatan)
 * dibatalkan. Board pribadi pemain lain tidak ikut
 * berubah karena hanya state.boards[mySymbol] miliknya
 * sendiri yang disentuh.
 * ======================================================== */

function undoPlacement() {
    if (!state) return;
    if (
        state.phase !==
        'setup'
    ) {
        return;
    }
    if (isSpectator()) {
        setStatus(
            '👁 Kamu hanya menjadi penonton.'
        );
        return;
    }
    const mine =
        state.ships[
            mySymbol
        ] || [];
    if (!mine.length) {
        showToast(
            'Tidak ada penempatan yang bisa dibatalkan',
            'warn'
        );
        return;
    }
    if (isHost) {
        processUndo(
            playerId
        );
    } else {
        send({
            type:
                'bsmp_undo',
            room,
            playerId
        });
    }
    showToast(
        '↩ Penempatan kapal terakhir dibatalkan',
        'ok'
    );
}

/* ========================================================
 * PROCESS UNDO - HOST
 *
 * Validasi ulang di sisi host (server logis pub/sub ini):
 * pemain harus terdaftar di room, fase masih 'setup'
 * (pertandingan belum mulai), dan punya history
 * penempatan yang bisa dibatalkan. Kalau salah satu
 * syarat tidak terpenuhi, event diabaikan diam-diam
 * supaya client tidak bisa memanipulasi board lewat
 * event Undo susulan setelah game berjalan.
 * ======================================================== */

function processUndo(id) {
    if (!state) return;
    if (
        state.phase !==
        'setup'
    ) {
        return;
    }
    const player =
        state.players.find(
            p =>
                p.id === id
        );
    if (!player) return;
    const symbol =
        player.symbol;
    if (
        symbol !== 'X' &&
        symbol !== 'O'
    ) {
        return;
    }
    const ships =
        state.ships[
            symbol
        ];
    if (
        !ships ||
        !ships.length
    ) {
        return;
    }
    const last =
        ships.pop();
    const board =
        state.boards[
            symbol
        ];
    for (
        const index of last.cells
    ) {
        board[index] =
            null;
    }
    if (
        state.ready[
            symbol
        ]
    ) {
        state.ready[
            symbol
        ] =
            false;
    }
    broadcastState();
}

/* ========================================================
 * READY
 * ======================================================== */

function toggleReady() {
    if (!state) return;
    if (isSpectator()) {
        setStatus(
            '👁 Penonton tidak perlu siap.'
        );
        return;
    }
    const ships =
        state.ships[
            mySymbol
        ] || [];
    if (
        ships.length !==
        SHIPS.length
    ) {
        setStatus(
            'Susun semua kapal terlebih dahulu.'
        );
        return;
    }
    if (isHost) {
        processReady(
            playerId
        );
    } else {
        send({
            type:
                'bsmp_ready',
            room,
            playerId
        });
    }
}

/* ========================================================
 * PROCESS READY
 * ======================================================== */

function processReady(
    id
) {
    const player =
        state.players.find(
            p =>
                p.id === id
        );
    if (!player) return;
    state.ready[
        player.symbol
    ] =
        true;
    if (
        state.ready.X &&
        state.ready.O
    ) {
        state.phase =
            'playing';
        state.turn =
            'X';
        state.winner =
            null;
    }
    broadcastState();
}

/* ========================================================
 * SHOOT
 * ======================================================== */

function shoot(index) {
    if (!state) return;
    if (isSpectator()) {
        return;
    }
    if (
        state.phase !==
        'playing'
    ) {
        return;
    }
    if (
        state.turn !==
        mySymbol
    ) {
        return;
    }
    if (
        state.shots[
            mySymbol
        ].includes(index)
    ) {
        return;
    }
    if (isHost) {
        processShot({
            playerId,
            index
        });
    } else {
        send({
            type:
                'bsmp_shot',
            room,
            playerId,
            index
        });
    }
}

/* ========================================================
 * PROCESS SHOT - HOST
 * ======================================================== */

function processShot(data) {
    if (
        !state ||
        state.phase !==
        'playing'
    ) {
        return;
    }
    const player =
        state.players.find(
            p =>
                p.id ===
                data.playerId
        );
    if (!player) return;
    if (
        player.symbol !==
        state.turn
    ) {
        return;
    }
    const index =
        Number(data.index);
    if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= 100
    ) {
        return;
    }
    const symbol =
        player.symbol;
    if (
        state.shots[
            symbol
        ].includes(index)
    ) {
        return;
    }
    const enemy =
        symbol === 'X'
            ? 'O'
            : 'X';

    /*
     * Simpan tembakan.
     *
     * Ini yang membuat semua client
     * dapat mengetahui kotak mana
     * yang sudah ditembak.
     */

    state.shots[
        symbol
    ].push(index);
    const target =
        state.boards[
            enemy
        ][index];
    let hit = false;
    let sunk = false;
    if (target) {
        hit = true;
        const ship =
            state.ships[
                enemy
            ].find(
                s =>
                    s.id === target
            );
        if (ship) {
            if (
                !ship.hits.includes(
                    index
                )
            ) {
                ship.hits.push(
                    index
                );
            }
            sunk =
                ship.hits.length >=
                ship.cells.length;
        }
    }
    const allSunk =
        state.ships[
            enemy
        ].every(
            s =>
                s.hits.length >=
                s.cells.length
        );
    if (allSunk) {
        state.phase =
            'finished';
        state.winner =
            symbol;
        state.scores[
            symbol
        ] =
            Number(
                state.scores[
                    symbol
                ] || 0
            ) + 1;
    } else if (!hit) {

        /*
         * MISS
         * → pindah giliran
         */

        state.turn =
            enemy;
    } else {

        /*
         * HIT
         * → tetap giliran pemain
         */

        state.turn =
            symbol;
    }
    broadcastState();
    send({
        type:
            'bsmp_result',
        room,
        index,
        hit,
        sunk,
        winner:
            state.winner,
        shooter:
            symbol,
        target:
            enemy,
        nextTurn:
            state.turn
    });
}

/* ========================================================
 * REMATCH
 * ======================================================== */

function rematch() {
    if (!state) return;
    if (
        state.phase !==
        'finished'
    ) {
        return;
    }
    if (isSpectator()) {
        setStatus(
            'Penonton tidak dapat memulai rematch.'
        );
        return;
    }
    if (isHost) {
        processRematch(
            playerId
        );
    } else {
        send({
            type:
                'bsmp_rematch',
            room,
            playerId
        });
    }
}
let rematchVotes =
    new Set();
function processRematch(id) {
    rematchVotes.add(id);
    if (
        rematchVotes.size <
        2
    ) {
        setStatus(
            'Menunggu pemain lain memilih rematch...'
        );
        return;
    }
    rematchVotes.clear();
    state.phase =
        'setup';
    state.turn =
        'X';
    state.winner =
        null;
    state.boards.X =
        emptyBoard();
    state.boards.O =
        emptyBoard();
    state.ships.X =
        [];
    state.ships.O =
        [];
    state.shots.X =
        [];
    state.shots.O =
        [];
    state.ready.X =
        false;
    state.ready.O =
        false;
    broadcastState();
}

/* ========================================================
 * LEAVE
 * ======================================================== */

function leaveRoom() {
    if (room) {
        send({
            type:
                'bsmp_leave',
            room,
            playerId,
            name:
                playerName
        });
    }
    manualLeave =
        true;
    if (reconnectTimer) {
        clearTimeout(
            reconnectTimer
        );
        reconnectTimer =
            null;
    }
    if (ws) {
        try {
            ws.close();
        } catch {}
        ws = null;
    }
    room =
        '';
    mySymbol =
        '';
    isHost =
        false;
    state =
        null;
    localReady =
        false;
    roomPanel.classList.remove(
        'show'
    );
    roomChat.classList.add(
        'hidden'
    );
    resetRoomChatState();
    spectatorBadge.classList.remove(
        'show'
    );
    if (spectatorCountValue) {
        spectatorCountValue.textContent =
            '0';
    }
    renderBoards();
    setConnection(
        '',
        'OFFLINE'
    );
    setStatus(
        'Buat atau masuk room untuk bermain'
    );
    showPage(
        'home'
    );
}

/* ========================================================
 * PLAYER LEAVE
 * ======================================================== */

function handlePlayerLeave(data) {
    if (!state) return;
    const player =
        state.players.find(
            p =>
                p.id ===
                data.playerId
        );
    if (player) {
        player.connected =
            false;
    }

    /*
     * Spectator yang keluar dihapus dari
     * state.spectators supaya jumlah penonton
     * tidak pernah salah (tidak minus, tidak
     * tersangkut).
     */

    let spectatorLeft =
        false;
    if (state.spectators) {
        const idx =
            state.spectators.findIndex(
                s =>
                    s.id ===
                    data.playerId
            );
        if (idx !== -1) {
            state.spectators.splice(
                idx,
                1
            );
            spectatorLeft =
                true;
        }
    }
    addSystem(
        (
            data.name ||
            'Kapten'
        ) +
        ' keluar dari room.'
    );
    if (isHost && spectatorLeft) {
        broadcastState();
        return;
    }
    render();
}

/* ========================================================
 * RENDER SHIPS
 * ======================================================== */

function renderShips() {
    shipList.innerHTML =
        '';
    if (isSpectator()) {
        return;
    }
    const mine =
        state?.ships?.[
            mySymbol
        ] || [];
    for (
        const ship of SHIPS
    ) {
        const button =
            document.createElement(
                'button'
            );
        button.className =
            'ship-btn';
        const placed =
            mine.some(
                s =>
                    s.id ===
                    ship.id
            );
        if (placed) {
            button.classList.add(
                'done'
            );
        }
        if (
            selectedShip ===
            ship.id
        ) {
            button.classList.add(
                'selected'
            );
        }
        button.textContent =
            ship.short +
            ' ' +
            ship.size;
        button.onclick =
            function () {
                if (placed) {
                    return;
                }
                selectedShip =
                    ship.id;
                renderShips();
                setStatus(
                    'Pilih kotak pertama untuk ' +
                    ship.name +
                    '.'
                );
            };
        shipList.appendChild(
            button
        );
    }
}

/* ========================================================
 * RENDER BOARD
 * ======================================================== */

function renderBoard(
    element,
    board,
    shotsAgainst,
    canShoot,
    revealShips,
    setupOwn,
    newlySunkIndices
) {
    const freshSunk =
        newlySunkIndices ||
        new Set();
    element.innerHTML =
        '';
    const shotList =
        shotsAgainst || [];
    for (
        let index = 0;
        index < 100;
        index++
    ) {
        const cell =
            document.createElement(
                'button'
            );
        cell.className =
            'cell';
        const value =
            board[index];

        /*
         * Kapal hanya terlihat:
         *
         * 1. papan sendiri
         * 2. spectator
         */

        if (
            value &&
            (
                setupOwn ||
                revealShips
            )
        ) {
            cell.classList.add(
                'ship'
            );
        }

        /*
         * HASIL TEMBAKAN.
         *
         * Semua orang bisa melihatnya.
         */

        if (
            shotList.includes(index)
        ) {
            if (value) {
                cell.classList.add(
                    'hit'
                );
                cell.textContent =
                    '✕';

                /*
                 * Kapal yang tenggelam
                 * diberi tampilan berbeda.
                 */

                const ship =
                    state?.ships &&
                    Object.values(
                        state.ships
                    )
                    .flat()
                    .find(
                        s =>
                            s.cells.includes(
                                index
                            )
                    );
                if (
                    ship &&
                    ship.hits.length >=
                    ship.cells.length
                ) {
                    cell.classList.remove(
                        'hit'
                    );
                    cell.classList.add(
                        'sunk'
                    );
                    cell.textContent =
                        '☠';
                    if (
                        freshSunk.has(
                            index
                        )
                    ) {
                        cell.classList.add(
                            'sunk-pop'
                        );
                    }
                }
            } else {
                cell.classList.add(
                    'miss'
                );
                cell.textContent =
                    '•';
            }
        }

        /*
         * Hanya pemain aktif yang
         * boleh memilih target.
         */

        if (
            canShoot &&
            state?.phase ===
            'playing' &&
            state.turn ===
            mySymbol &&
            !shotList.includes(index)
        ) {
            cell.classList.add(
                'target'
            );
        }

        /*
         * Setup kapal sendiri.
         */

        if (setupOwn) {
            cell.onclick =
                function () {
                    if (
                        state?.phase ===
                        'setup'
                    ) {
                        const row =
                            Math.floor(
                                index / SIZE
                            );
                        const col =
                            index % SIZE;
                        placeShip(
                            row,
                            col
                        );
                    }
                };

        /*
         * Tembak board musuh.
         */

        } else if (canShoot) {
            cell.onclick =
                function () {
                    shoot(index);
                };
        }
        element.appendChild(
            cell
        );
    }
}

/* ========================================================
 * RENDER BOARDS
 * ======================================================== */

function getFreshlySunkBySymbol() {

    /*
     * Bandingkan kapal yang sunk sekarang dengan
     * knownSunkShipKeys (kapal yang animasinya sudah
     * pernah diputar). Hanya kapal yang BARU sunk yang
     * dikembalikan, supaya animasi tidak diputar ulang
     * tiap kali renderBoards() dipanggil.
     */

    const result = {
        X: new Set(),
        O: new Set()
    };
    if (!state?.ships) {
        return result;
    }
    for (
        const symbol of [
            'X',
            'O'
        ]
    ) {
        const ships =
            state.ships[symbol] ||
            [];
        for (
            const ship of ships
        ) {
            const sunk =
                ship.hits.length >=
                ship.cells.length;
            const key =
                symbol +
                ':' +
                ship.id;
            if (
                sunk &&
                !knownSunkShipKeys.has(
                    key
                )
            ) {
                knownSunkShipKeys.add(
                    key
                );
                for (
                    const cellIndex of ship.cells
                ) {
                    result[
                        symbol
                    ].add(
                        cellIndex
                    );
                }
            }
        }
    }
    return result;
}

function setTurnIndicator(active) {
    if (!myBoardWrap || !turnBadge) {
        return;
    }
    myBoardWrap.classList.toggle(
        'my-turn',
        active
    );
    turnBadge.classList.toggle(
        'show',
        active
    );
}

function renderBoards() {

    /*
     * BELUM ADA STATE
     */

    if (!state) {
        setTurnIndicator(false);
        renderBoard(
            myBoard,
            emptyBoard(),
            [],
            false,
            false,
            false
        );
        renderBoard(
            enemyBoard,
            emptyBoard(),
            [],
            false,
            false,
            false
        );
        return;
    }

    /*
     * Match baru / rematch → phase kembali ke 'setup',
     * reset pelacak kapal sunk supaya animasi bisa
     * diputar lagi untuk pertandingan berikutnya.
     */

    if (
        state.phase ===
        'setup'
    ) {
        knownSunkShipKeys.clear();
    }
    const freshlySunk =
        getFreshlySunkBySymbol();

    /*
     * SPECTATOR
     *
     * Melihat:
     * - semua kapal X
     * - semua kapal O
     * - semua tembakan X
     * - semua tembakan O
     */

    if (isSpectator()) {
        setTurnIndicator(false);
        const px =
            getPlayerBySymbol('X');
        const po =
            getPlayerBySymbol('O');
        myBoardTitle.textContent =
            'ARMADA ' +
            (px?.name || 'KAPTEN X').toUpperCase();
        enemyBoardTitle.textContent =
            'ARMADA ' +
            (po?.name || 'KAPTEN O').toUpperCase();

        /*
         * Board X
         *
         * Tembakan O adalah tembakan
         * terhadap board X.
         */

        renderBoard(
            myBoard,
            state.boards.X,
            state.shots.O,
            false,
            true,
            false,
            freshlySunk.X
        );

        /*
         * Board O
         *
         * Tembakan X adalah tembakan
         * terhadap board O.
         */

        renderBoard(
            enemyBoard,
            state.boards.O,
            state.shots.X,
            false,
            true,
            false,
            freshlySunk.O
        );
        return;
    }

    /*
     * PLAYER
     */

    const enemy =
        getEnemySymbol();

    /*
     * Game sudah selesai → semua kapal, milik sendiri
     * maupun milik musuh, boleh ditampilkan penuh.
     */

    const gameFinished =
        state.phase ===
        'finished';

    /*
     * Indikator giliran "ARMADA-MU" hanya aktif saat
     * fase bertarung berlangsung DAN memang giliran
     * pemain ini (currentTurn === currentPlayer).
     * Sumber kebenarannya tetap state dari server/relay,
     * bukan timer di frontend.
     */

    setTurnIndicator(
        state.phase ===
        'playing' &&
        state.turn ===
        mySymbol
    );

    /*
     * BOARD SENDIRI
     *
     * Tampilkan:
     * - kapal sendiri
     * - tembakan musuh
     */

    myBoardTitle.textContent =
        'ARMADAMU';
    enemyBoardTitle.textContent =
        'PERAIRAN MUSUH';
    renderBoard(
        myBoard,
        state.boards[mySymbol],
        state.shots[enemy],
        false,
        gameFinished,
        true,
        freshlySunk[mySymbol]
    );

    /*
     * BOARD MUSUH
     *
     * Selama pertandingan berjalan:
     * - hasil tembakan sendiri
     * - kapal musuh TIDAK ditampilkan (hidden/private)
     *
     * Setelah game over:
     * - seluruh kapal musuh direveal (revealShips)
     */

    renderBoard(
        enemyBoard,
        state.boards[enemy],
        state.shots[mySymbol],
        true,
        gameFinished,
        false,
        freshlySunk[enemy]
    );
}

/* ========================================================
 * RENDER PLAYERS
 * ======================================================== */

function renderPlayers() {
    const players =
        state?.players || [];
    const px =
        players.find(
            p =>
                p.symbol === 'X'
        );
    const po =
        players.find(
            p =>
                p.symbol === 'O'
        );
    nameX.textContent =
        px
            ? px.name +
                (
                    px.connected
                        ? ''
                        : ' · offline'
                )
            : 'Menunggu...';
    nameO.textContent =
        po
            ? po.name +
                (
                    po.connected
                        ? ''
                        : ' · offline'
                )
            : 'Menunggu...';
    playerX.classList.toggle(
        'active',
        state?.turn === 'X' &&
        state?.phase === 'playing'
    );
    playerO.classList.toggle(
        'active',
        state?.turn === 'O' &&
        state?.phase === 'playing'
    );
    if (readyX) {
        const readyXVal =
            Boolean(
                state?.ready?.X
            );
        readyX.textContent =
            readyXVal
                ? '✓ Siap'
                : 'Belum siap';
        readyX.classList.toggle(
            'waiting',
            !readyXVal
        );
    }
    if (readyO) {
        const readyOVal =
            Boolean(
                state?.ready?.O
            );
        readyO.textContent =
            readyOVal
                ? '✓ Siap'
                : 'Belum siap';
        readyO.classList.toggle(
            'waiting',
            !readyOVal
        );
    }
    if (hostTag) {
        const host =
            players.find(
                p =>
                    p.id ===
                    state?.hostId
            );
        hostTag.textContent =
            'Host: ' +
            (
                host?.name ||
                '-'
            );
    }
}

/* ========================================================
 * RENDER STATUS
 * ======================================================== */

function renderStatus() {
    if (!state) {
        phase.textContent =
            'SETUP';
        setupPanel.style.display =
            'block';
        undoBtn.style.display =
            'none';
        spectatorBadge.classList.remove(
            'show'
        );
        chatScope.textContent =
            'Chat pemain';
        return;
    }

    /*
     * SPECTATOR
     */

    if (isSpectator()) {
        spectatorBadge.classList.add(
            'show'
        );
        setupPanel.style.display =
            'none';
        undoBtn.style.display =
            'none';
        readyBtn.disabled =
            true;
        readyBtn.style.opacity =
            '.4';
        chatScope.textContent =
            'Chat penonton · hanya terlihat sesama penonton';
        if (
            state.phase ===
            'setup'
        ) {
            phase.textContent =
                'SETUP ARMADA';
            setStatus(
                '👁 Menunggu Player 1 dan Player 2 menyusun armada.'
            );
        } else if (
            state.phase ===
            'playing'
        ) {
            phase.textContent =
                'PERTEMPURAN';
            const turnPlayer =
                getPlayerBySymbol(
                    state.turn
                );
            setStatus(
                '👁 Menonton · Giliran ' +
                (
                    turnPlayer?.name ||
                    'Kapten'
                )
            );
        } else {
            phase.textContent =
                'SELESAI';
            const winner =
                getPlayerBySymbol(
                    state.winner
                );
            setStatus(
                '🏆 ' +
                (
                    winner?.name ||
                    'Kapten'
                ) +
                ' memenangkan pertandingan!'
            );
        }
        return;
    }

    /*
     * PLAYER
     */

    spectatorBadge.classList.remove(
        'show'
    );
    readyBtn.disabled =
        false;
    readyBtn.style.opacity =
        '1';
    chatScope.textContent =
        'Chat Player 1 & 2 · hanya terlihat kedua pemain';
    if (
        state.phase ===
        'setup'
    ) {
        phase.textContent =
            'SETUP ARMADA';
        const mine =
            state.ships?.[
                mySymbol
            ] || [];
        if (
            mine.length <
            SHIPS.length
        ) {
            setStatus(
                'Susun semua kapalmu lalu tekan SIAP.'
            );
        } else if (
            !state.ready?.[
                mySymbol
            ]
        ) {
            setStatus(
                'Semua kapal siap. Tekan SIAP.'
            );
        }
        setupPanel.style.display =
            'block';
        undoBtn.style.display =
            'block';
        undoBtn.disabled =
            !mine.length;
        undoBtn.style.opacity =
            mine.length
                ? '1'
                : '.4';
        return;
    }
    setupPanel.style.display =
        'none';
    undoBtn.style.display =
        'none';
    if (
        state.phase ===
        'playing'
    ) {
        phase.textContent =
            'PERTEMPURAN';
        if (
            state.turn ===
            mySymbol
        ) {
            setStatus(
                '🎯 Giliran kamu — tembak target!'
            );
        } else {
            setStatus(
                '⏳ Menunggu tembakan lawan...'
            );
        }
        return;
    }
    if (
        state.phase ===
        'finished'
    ) {
        phase.textContent =
            'SELESAI';
        if (
            state.winner ===
            mySymbol
        ) {
            setStatus(
                '🏆 Armada musuh berhasil dihancurkan!'
            );
        } else {
            setStatus(
                '💥 Armada kamu kalah.'
            );
        }
    }
}

/* ========================================================
 * RENDER SPECTATOR COUNT
 *
 * Watermark 👁 di area tengah, di samping judul
 * "ARMADA ****" pada baris papan.
 * ======================================================== */

function renderSpectatorCount() {
    if (!spectatorCountValue) return;
    const count =
        Math.max(
            0,
            getSpectatorCount()
        );
    spectatorCountValue.textContent =
        String(count);
}

/* ========================================================
 * RENDER
 * ======================================================== */

function render() {
    if (!state) return;
    roomCode.textContent =
        state.room ||
        room;
    renderPlayers();
    renderShips();
    renderBoards();
    renderStatus();
    renderSpectatorCount();
    readyBtn.textContent =
        state.ready?.[
            mySymbol
        ]
            ? '✓ SUDAH SIAP'
            : '⚓ SIAP';
}

/* ========================================================
 * CHAT HELPERS (dipakai bareng oleh Room & Global Chat)
 * ======================================================== */

function isLogAtBottom(logEl) {
    return (
        logEl.scrollHeight -
        logEl.scrollTop -
        logEl.clientHeight
    ) < 30;
}

/*
 * scrollChatLogBy menggeser sebuah chat-log naik/turun
 * sejumlah setengah tinggi kotaknya (minimal 60px), dipakai
 * oleh tombol ▲/▼ pengganti scrollbar. direction: -1 = atas,
 * 1 = bawah.
 */

function scrollChatLogBy(logEl, direction) {
    if (!logEl) return;
    const amount =
        Math.max(
            60,
            Math.round(
                logEl.clientHeight *
                0.6
            )
        );
    logEl.scrollBy({
        top: direction * amount,
        behavior: 'smooth'
    });
}

/*
 * keepJumpPillLast memindahkan pill "jump to bottom" supaya
 * selalu jadi child paling akhir di dalam chat-log. appendChild
 * pada node yang sudah ada di DOM akan MEMINDAHKAN node itu
 * (bukan menduplikasi), jadi pill tetap nempel di bawah tiap
 * ada pesan baru yang masuk setelahnya.
 */

function keepJumpPillLast(logEl, jumpWrapEl) {
    if (jumpWrapEl) {
        logEl.appendChild(
            jumpWrapEl
        );
    }
}

/*
 * Bikin elemen <img> untuk sticker. Kalau gambar gagal
 * dimuat (link mati / bukan gambar), tampilkan placeholder
 * sederhana sebagai gantinya -- tidak membuat chat crash
 * ataupun WebSocket terputus.
 */

function createStickerImg(url) {
    const img =
        document.createElement(
            'img'
        );
    img.src =
        url;
    img.alt =
        'sticker';
    img.loading =
        'lazy';
    img.onerror =
        function () {
            const placeholder =
                document.createElement(
                    'div'
                );
            placeholder.className =
                'sticker-broken';
            placeholder.textContent =
                '🖼';
            img.replaceWith(
                placeholder
            );
        };
    return img;
}

/*
 * Preview pesan yang direply, ditampilkan di dalam bubble
 * pesan balasan. Menekan preview ini akan memanggil jumpFn
 * untuk lompat & highlight ke pesan aslinya (kalau masih
 * ada di layar).
 */

function buildReplyQuote(
    replyTo,
    jumpFn
) {
    const quote =
        document.createElement(
            'div'
        );
    quote.className =
        'msg-reply-quote';
    const qName =
        document.createElement(
            'div'
        );
    qName.className =
        'msg-reply-quote-name';
    qName.textContent =
        replyTo.senderName ||
        'Kapten';
    quote.appendChild(
        qName
    );
    const qBody =
        document.createElement(
            'div'
        );
    qBody.className =
        'msg-reply-quote-text';
    if (
        replyTo.kind ===
        'sticker'
    ) {
        const thumbUrl =
            getStickerUrl(
                replyTo.stickerId
            );
        if (thumbUrl) {
            const thumb =
                document.createElement(
                    'img'
                );
            thumb.className =
                'msg-reply-quote-thumb';
            thumb.src =
                thumbUrl;
            thumb.alt =
                'sticker';
            qBody.appendChild(
                thumb
            );
        }
        qBody.appendChild(
            document.createTextNode(
                '🖼 Sticker'
            )
        );
    } else {
        qBody.appendChild(
            document.createTextNode(
                truncatePreview(
                    replyTo.text,
                    70
                )
            )
        );
    }
    quote.appendChild(
        qBody
    );
    quote.onclick =
        function () {
            jumpFn(
                replyTo.messageId
            );
        };
    return quote;
}

/*
 * validateIncomingReplyTo mem-filter field "replyTo" yang
 * datang dari WebSocket sebelum dipakai/ditampilkan.
 *
 * Catatan arsitektur: WS_URL adalah channel relay pub/sub
 * pihak ketiga (PieSocket) tanpa proses backend custom yang
 * bisa menyimpan/mengesahkan state (lihat komentar di
 * handleGlobalMessage soal NAME REGISTRY). Karena itu tidak
 * ada "server" nyata yang bisa dititipi validasi replyTo.
 * Pola yang dipakai di seluruh plugin ini untuk kasus
 * seperti itu adalah validasi terdistribusi: SETIAP client
 * menjalankan pemeriksaan yang sama secara mandiri terhadap
 * apa pun yang diterimanya, sebelum mempercayainya. Fungsi
 * ini melakukan itu untuk replyTo: field dipaksa ke tipe dan
 * panjang yang aman, dan reply ke sticker hanya diterima
 * kalau stickerId-nya memang terdaftar di STICKER_MAP.
 *
 * Pemisahan Room Chat vs Global Chat (poin "reply tidak
 * boleh lintas room") juga sudah otomatis terjaga tanpa
 * server: chatMessageStore/globalChatMessageStore adalah Map
 * terpisah, dan pesan bsmp_chat sudah difilter duluan lewat
 * pengecekan data.room !== room sebelum sampai ke fungsi ini
 * -- jadi messageId dari room lain tidak pernah masuk ke
 * store client ini sama sekali.
 */

function validateIncomingReplyTo(rawReplyTo) {
    if (
        !rawReplyTo ||
        typeof rawReplyTo !== 'object'
    ) {
        return null;
    }
    const messageId =
        typeof rawReplyTo.messageId === 'string'
            ? rawReplyTo.messageId.slice(0, 120)
            : '';
    if (!messageId) {
        return null;
    }
    const senderName =
        String(
            rawReplyTo.senderName || 'Kapten'
        ).slice(0, 40);
    if (
        rawReplyTo.kind ===
        'sticker'
    ) {
        const stickerId =
            String(
                rawReplyTo.stickerId || ''
            );
        if (!getStickerUrl(stickerId)) {
            return null;
        }
        return {
            messageId,
            senderName,
            kind: 'sticker',
            stickerId
        };
    }
    return {
        messageId,
        senderName,
        kind: 'text',
        text:
            String(
                rawReplyTo.text || ''
            ).slice(0, 300)
    };
}

/* ========================================================
 * ROOM CHAT
 * ======================================================== */

function jumpToChatMessage(messageId) {
    const entry =
        chatMessageStore.get(
            messageId
        );
    if (
        !entry ||
        !entry.element
    ) {
        return;
    }
    entry.element.scrollIntoView({
        block: 'center',
        behavior: 'smooth'
    });
    entry.element.classList.add(
        'msg-highlight'
    );
    setTimeout(
        function () {
            entry.element.classList.remove(
                'msg-highlight'
            );
        },
        1200
    );
}
function setChatReply(entry) {
    activeReply =
        entry;
    chatReplyName.textContent =
        entry.name ||
        'Kapten';
    chatReplyText.textContent =
        entry.kind ===
        'sticker'
            ? '🖼 Sticker'
            : truncatePreview(
                entry.text,
                60
            );
    chatReplyBar.classList.remove(
        'hidden'
    );
    chatInput.focus();
}
function clearChatReply() {
    activeReply =
        null;
    chatReplyBar.classList.add(
        'hidden'
    );
}

/*
 * Dipanggil tiap kali masuk/keluar room (createRoom, joinRoom,
 * leaveRoom) supaya history & messageId Room Chat bener-bener
 * terpisah antar room -- tidak ada messageId room lama yang
 * ketinggalan dan bisa direply dari room baru.
 */

function resetRoomChatState() {
    chatMessageStore.clear();
    chatUnreadCount =
        0;
    clearChatReply();
    chatLog.innerHTML =
        '';
    chatLog.appendChild(
        chatJumpWrap
    );
    chatJumpBtn.classList.remove(
        'show'
    );
}

/*
 * renderChatRow = satu-satunya tempat yang benar-benar
 * menaruh pesan ke DOM #chatLog. Semua pesan Room Chat
 * (teks, sticker, notice lokal) lewat sini supaya scroll,
 * indikator "pesan baru", dan tombol Reply selalu konsisten.
 */

function renderChatRow(entry) {
    const wasAtBottom =
        isLogAtBottom(
            chatLog
        );
    const row =
        document.createElement(
            'div'
        );
    row.className =
        'msg-row';
    row.dataset.messageId =
        entry.id;
    const bubble =
        document.createElement(
            'div'
        );
    bubble.className =
        'chat-message';
    if (entry.replyTo) {
        bubble.appendChild(
            buildReplyQuote(
                entry.replyTo,
                jumpToChatMessage
            )
        );
    }
    const bold =
        document.createElement(
            'b'
        );
    bold.textContent =
        (
            entry.name ||
            'Kapten'
        ) + ': ';
    bubble.appendChild(
        bold
    );
    if (
        entry.kind ===
        'sticker'
    ) {
        const stickerEl =
            document.createElement(
                'div'
            );
        stickerEl.className =
            'sticker-message';
        stickerEl.appendChild(
            createStickerImg(
                entry.stickerUrl
            )
        );
        bubble.appendChild(
            stickerEl
        );
    } else {
        bubble.appendChild(
            document.createTextNode(
                entry.text || ''
            )
        );
    }
    row.appendChild(
        bubble
    );
    if (entry.replyable) {
        const replyBtn =
            document.createElement(
                'button'
            );
        replyBtn.type =
            'button';
        replyBtn.className =
            'msg-reply-btn';
        replyBtn.textContent =
            '↩';
        replyBtn.onclick =
            function () {
                setChatReply({
                    messageId:
                        entry.id,
                    name:
                        entry.name,
                    kind:
                        entry.kind,
                    text:
                        entry.text,
                    stickerId:
                        entry.stickerId
                });
            };
        row.appendChild(
            replyBtn
        );
    }
    chatLog.appendChild(
        row
    );
    keepJumpPillLast(
        chatLog,
        chatJumpWrap
    );
    chatMessageStore.set(
        entry.id,
        {
            element: row
        }
    );
    if (
        entry.isSelf ||
        wasAtBottom
    ) {
        chatLog.scrollTop =
            chatLog.scrollHeight;
        chatUnreadCount =
            0;
        if (chatJumpBtn) {
            chatJumpBtn.classList.remove(
                'show'
            );
        }
    } else {
        chatUnreadCount =
            chatUnreadCount + 1;
        if (chatJumpCount) {
            chatJumpCount.textContent =
                chatUnreadCount;
        }
        if (chatJumpBtn) {
            chatJumpBtn.classList.add(
                'show'
            );
        }
    }
}
function addChat(
    name,
    message,
    options
) {
    options =
        options || {};
    renderChatRow({
        id:
            options.id ||
            generateMessageId('sys'),
        name,
        kind: 'text',
        text: message,
        replyTo:
            options.replyTo ||
            null,
        replyable:
            options.replyable !== false,
        isSelf:
            !!options.isSelf
    });
}
function addSystem(message) {
    addChat(
        'SYSTEM',
        message,
        {
            replyable: false
        }
    );
}
function addSticker(
    name,
    url,
    options
) {
    options =
        options || {};
    renderChatRow({
        id:
            options.id ||
            generateMessageId('sys'),
        name,
        kind: 'sticker',
        stickerUrl: url,
        stickerId:
            options.stickerId ||
            '',
        replyTo:
            options.replyTo ||
            null,
        replyable:
            options.replyable !== false,
        isSelf:
            !!options.isSelf
    });
}

/* ========================================================
 * GLOBAL CHAT LOG
 * ======================================================== */

function jumpToGlobalChatMessage(messageId) {
    const entry =
        globalChatMessageStore.get(
            messageId
        );
    if (
        !entry ||
        !entry.element
    ) {
        return;
    }
    entry.element.scrollIntoView({
        block: 'center',
        behavior: 'smooth'
    });
    entry.element.classList.add(
        'msg-highlight'
    );
    setTimeout(
        function () {
            entry.element.classList.remove(
                'msg-highlight'
            );
        },
        1200
    );
}
function setGlobalChatReply(entry) {
    activeGlobalReply =
        entry;
    globalReplyName.textContent =
        entry.name ||
        'Kapten';
    globalReplyText.textContent =
        entry.kind ===
        'sticker'
            ? '🖼 Sticker'
            : truncatePreview(
                entry.text,
                60
            );
    globalReplyBar.classList.remove(
        'hidden'
    );
    globalChatInput.focus();
}
function clearGlobalChatReply() {
    activeGlobalReply =
        null;
    globalReplyBar.classList.add(
        'hidden'
    );
}
function renderGlobalChatRow(entry) {
    const wasAtBottom =
        isLogAtBottom(
            globalChatLog
        );
    const row =
        document.createElement(
            'div'
        );
    row.className =
        'msg-row';
    row.dataset.messageId =
        entry.id;
    const bubble =
        document.createElement(
            'div'
        );
    bubble.className =
        'chat-message';
    if (entry.replyTo) {
        bubble.appendChild(
            buildReplyQuote(
                entry.replyTo,
                jumpToGlobalChatMessage
            )
        );
    }
    const bold =
        document.createElement(
            'b'
        );
    bold.textContent =
        (
            entry.name ||
            'Kapten'
        ) + ': ';
    bubble.appendChild(
        bold
    );
    if (
        entry.kind ===
        'sticker'
    ) {
        const stickerEl =
            document.createElement(
                'div'
            );
        stickerEl.className =
            'sticker-message';
        stickerEl.appendChild(
            createStickerImg(
                entry.stickerUrl
            )
        );
        bubble.appendChild(
            stickerEl
        );
    } else {
        bubble.appendChild(
            document.createTextNode(
                entry.text || ''
            )
        );
    }
    row.appendChild(
        bubble
    );
    if (entry.replyable) {
        const replyBtn =
            document.createElement(
                'button'
            );
        replyBtn.type =
            'button';
        replyBtn.className =
            'msg-reply-btn';
        replyBtn.textContent =
            '↩';
        replyBtn.onclick =
            function () {
                setGlobalChatReply({
                    messageId:
                        entry.id,
                    name:
                        entry.name,
                    kind:
                        entry.kind,
                    text:
                        entry.text,
                    stickerId:
                        entry.stickerId
                });
            };
        row.appendChild(
            replyBtn
        );
    }
    globalChatLog.appendChild(
        row
    );
    keepJumpPillLast(
        globalChatLog,
        globalChatJumpWrap
    );
    globalChatMessageStore.set(
        entry.id,
        {
            element: row
        }
    );
    if (
        entry.isSelf ||
        wasAtBottom
    ) {
        globalChatLog.scrollTop =
            globalChatLog.scrollHeight;
        globalChatUnreadCount =
            0;
        if (globalChatJumpBtn) {
            globalChatJumpBtn.classList.remove(
                'show'
            );
        }
    } else {
        globalChatUnreadCount =
            globalChatUnreadCount + 1;
        if (globalChatJumpCount) {
            globalChatJumpCount.textContent =
                globalChatUnreadCount;
        }
        if (globalChatJumpBtn) {
            globalChatJumpBtn.classList.add(
                'show'
            );
        }
    }
}
function addGlobalChat(
    name,
    message,
    options
) {
    options =
        options || {};
    renderGlobalChatRow({
        id:
            options.id ||
            generateMessageId('sys'),
        name,
        kind: 'text',
        text: message,
        replyTo:
            options.replyTo ||
            null,
        replyable:
            options.replyable !== false,
        isSelf:
            !!options.isSelf
    });
}
function addGlobalSticker(
    name,
    url,
    options
) {
    options =
        options || {};
    renderGlobalChatRow({
        id:
            options.id ||
            generateMessageId('sys'),
        name,
        kind: 'sticker',
        stickerUrl: url,
        stickerId:
            options.stickerId ||
            '',
        replyTo:
            options.replyTo ||
            null,
        replyable:
            options.replyable !== false,
        isSelf:
            !!options.isSelf
    });
}

/* ========================================================
 * SEND CHAT
 * ======================================================== */

function sendChatMessage() {
    const message =
        String(
            chatInput.value || ''
        ).trim();
    if (!message) {
        return;
    }
    if (!room) {
        setStatus(
            'Masuk room dahulu.'
        );
        return;
    }

    /*
     * Tentukan audience.
     */

    const audience =
        isSpectator()
            ? 'spectators'
            : 'players';
    const messageId =
        generateMessageId(
            'rmsg'
        );
    if (
        send({
            type:
                'bsmp_chat',
            room,
            playerId,
            name:
                playerName,
            audience,
            message:
                message.slice(
                    0,
                    300
                ),
            messageId,
            replyTo:
                buildOutgoingReplyTo(
                    activeReply
                )
        })
    ) {
        chatInput.value =
            '';
        clearChatReply();
    }
}

/* ========================================================
 * SEND STICKER
 * ======================================================== */

function sendSticker(
    stickerId
) {
    if (!room) {
        return;
    }

    /*
     * Validasi id sticker terdaftar sebelum dikirim.
     * Kalau tidak dikenal, batalkan pengiriman -- tidak
     * ada url mentah yang pernah ikut dikirim lewat
     * WebSocket.
     */

    if (!getStickerUrl(stickerId)) {
        return;
    }
    const audience =
        isSpectator()
            ? 'spectators'
            : 'players';
    const messageId =
        generateMessageId(
            'rmsg'
        );
    send({
        type:
            'bsmp_sticker',
        room,
        playerId,
        name:
            playerName,
        audience,
        stickerId,
        messageId,
        replyTo:
            buildOutgoingReplyTo(
                activeReply
            )
    });
    clearChatReply();
    stickerPanel.classList.remove(
        'show'
    );
}

/* ========================================================
 * SEND GLOBAL CHAT
 * ======================================================== */

function sendGlobalChatMessage() {
    const message =
        String(
            globalChatInput.value || ''
        ).trim();
    if (!message) {
        return;
    }
    const messageId =
        generateMessageId(
            'gmsg'
        );
    if (
        sendGlobal({
            type:
                'bsmp_global_chat',
            playerId,
            name:
                playerName,
            message:
                message.slice(
                    0,
                    300
                ),
            sticker:
                false,
            messageId,
            replyTo:
                buildOutgoingReplyTo(
                    activeGlobalReply
                )
        })
    ) {
        globalChatInput.value =
            '';
        clearGlobalChatReply();
    }
}

/* ========================================================
 * SEND GLOBAL STICKER
 * ======================================================== */

function sendGlobalSticker(
    stickerId
) {

    /*
     * Sama seperti sendSticker: hanya stickerId yang
     * dikirim, dan hanya id yang benar-benar terdaftar
     * yang boleh berangkat.
     */

    if (!getStickerUrl(stickerId)) {
        return;
    }
    const messageId =
        generateMessageId(
            'gmsg'
        );
    sendGlobal({
        type:
            'bsmp_global_chat',
        playerId,
        name:
            playerName,
        stickerId,
        sticker:
            true,
        messageId,
        replyTo:
            buildOutgoingReplyTo(
                activeGlobalReply
            )
    });
    clearGlobalChatReply();
    globalStickerPanel.classList.remove(
        'show'
    );
}

/* ========================================================
 * STICKER UI
 *
 * Picker dibangun sekali dari daftar STICKERS -- setiap
 * tombol menampilkan thumbnail gambar (bukan teks/ID/URL)
 * dan mengirim stickerId saat ditekan.
 * ======================================================== */

function renderStickerPicker(
    grid,
    onPick
) {
    if (!STICKERS.length) {
        const empty =
            document.createElement(
                'div'
            );
        empty.className =
            'sticker-grid-empty';
        empty.textContent =
            'Belum ada sticker.';
        grid.appendChild(
            empty
        );
        return;
    }
    for (
        const s of STICKERS
    ) {
        const button =
            document.createElement(
                'button'
            );
        button.className =
            'sticker';
        button.appendChild(
            createStickerImg(
                s.url
            )
        );
        button.onclick =
            function () {
                onPick(
                    s.id
                );
            };
        grid.appendChild(
            button
        );
    }
}
renderStickerPicker(
    stickerGrid,
    sendSticker
);
renderStickerPicker(
    globalStickerGrid,
    sendGlobalSticker
);

/* ========================================================
 * COPY
 * ======================================================== */

async function copyRoom() {
    if (!room) return;
    try {
        await navigator
            .clipboard
            .writeText(room);
        copyBtn.textContent =
            'TERSALIN!';
        setTimeout(
            function () {
                copyBtn.textContent =
                    'SALIN';
            },
            1200
        );
    } catch {
        setStatus(
            'Kode room: ' +
            room
        );
    }
}

/* ========================================================
 * SHARE ROOM CODE TO GLOBAL CHAT
 *
 * Lihat komentar di deklarasi ROOM_CODE_COOLDOWN_MS
 * untuk penjelasan strategi cooldown terdistribusi.
 * ======================================================== */

function currentRoomCodeReadyAt() {
    const local =
        loadRoomCodeCooldownUntil();
    const known =
        roomCodeCooldownRegistry.get(
            playerId
        ) || 0;
    return Math.max(
        local,
        known
    );
}
function attemptRoomCodeClaim(reqId) {
    return new Promise(
        function (resolve) {
            const claim = {
                reqId,
                rejected:
                    false,
                remainingMs:
                    0
            };
            pendingRoomCodeClaim =
                claim;
            sendGlobal({
                type:
                    'bsmp_roomcode_claim',
                reqId,
                playerId,
                ts:
                    Date.now()
            });
            setTimeout(
                function () {
                    if (
                        pendingRoomCodeClaim ===
                        claim
                    ) {
                        pendingRoomCodeClaim =
                            null;
                    }
                    resolve(
                        claim
                    );
                },
                ROOM_CODE_CLAIM_WINDOW_MS
            );
        }
    );
}
async function sendRoomCodeToGlobal() {
    if (!room) {
        return;
    }
    if (
        !loggedIn ||
        !playerName
    ) {
        return;
    }
    const now =
        Date.now();
    const readyAt =
        currentRoomCodeReadyAt();
    if (readyAt > now) {
        showToast(
            'Tunggu ' +
            Math.ceil(
                (readyAt - now) / 1000
            ) +
            ' detik sebelum mengirim kode room lagi.',
            'warn'
        );
        updateShareButtonUI();
        return;
    }
    if (shareGlobalBtn) {
        shareGlobalBtn.disabled =
            true;
    }
    const reqId =
        'rc_' +
        Math.random()
            .toString(36)
            .slice(2) +
        Date.now()
            .toString(36);
    const claim =
        await attemptRoomCodeClaim(
            reqId
        );
    if (claim.rejected) {
        const remaining =
            Math.max(
                1,
                Math.ceil(
                    (
                        Number(
                            claim.remainingMs
                        ) ||
                        ROOM_CODE_COOLDOWN_MS
                    ) / 1000
                )
            );
        showToast(
            'Tunggu ' +
            remaining +
            ' detik sebelum mengirim kode room lagi.',
            'warn'
        );
        updateShareButtonUI();
        return;
    }
    const activeRoom =
        room;
    const message =
        (
            '🎮 ' +
            playerName +
            ' membuat room Battleship!\\n\\n' +
            '🔑 Kode Room: ' +
            activeRoom +
            '\\n\\n' +
            'Klik Join Room dan masukkan kode tersebut untuk bergabung.'
        ).slice(
            0,
            300
        );
    const sent =
        sendGlobal({
            type:
                'bsmp_global_chat',
            playerId,
            name:
                playerName,
            message,
            sticker:
                false,
            messageId:
                generateMessageId(
                    'gmsg'
                )
        });
    if (!sent) {
        showToast(
            'Gagal mengirim kode room.',
            'err'
        );
        updateShareButtonUI();
        return;
    }
    const readyAtNew =
        Date.now() +
        ROOM_CODE_COOLDOWN_MS;
    saveRoomCodeCooldownUntil(
        readyAtNew
    );
    roomCodeCooldownRegistry.set(
        playerId,
        readyAtNew
    );
    sendGlobal({
        type:
            'bsmp_roomcode_ack',
        playerId,
        readyAt:
            readyAtNew
    });
    showToast(
        '✓ Kode room berhasil dikirim ke Global Chat',
        'ok'
    );
    updateShareButtonUI();
}
function updateShareButtonUI() {
    if (!shareGlobalBtn) {
        return;
    }
    const remaining =
        currentRoomCodeReadyAt() -
        Date.now();
    if (remaining > 0) {
        shareGlobalBtn.disabled =
            true;
        shareGlobalBtn.textContent =
            'Kirim lagi dalam ' +
            Math.ceil(
                remaining / 1000
            ) +
            's';
    } else {
        shareGlobalBtn.disabled =
            false;
        shareGlobalBtn.textContent =
            'KIRIM KE GLOBAL CHAT';
    }
}
updateShareButtonUI();
if (!roomCodeCooldownTickTimer) {
    roomCodeCooldownTickTimer =
        setInterval(
            updateShareButtonUI,
            1000
        );
}

/* ========================================================
 * EVENTS
 * ======================================================== */

createBtn.onclick =
    createRoom;
joinBtn.onclick =
    joinRoom;
if (shareGlobalBtn) {
    shareGlobalBtn.onclick =
        sendRoomCodeToGlobal;
}
loginBtn.onclick =
    performLogin;
if (loginNameInput) {
    loginNameInput.onkeydown =
        function (event) {
            if (
                event.key ===
                'Enter'
            ) {
                performLogin();
            }
        };
}
copyBtn.onclick =
    copyRoom;
rotateBtn.onclick =
    function () {
        if (isSpectator()) {
            return;
        }
        orientation =
            orientation === 'H'
                ? 'V'
                : 'H';
        rotateBtn.textContent =
            orientation === 'H'
                ? '↻ PUTAR KAPAL · HORIZONTAL'
                : '↻ PUTAR KAPAL · VERTIKAL';
    };
readyBtn.onclick =
    toggleReady;
undoBtn.onclick =
    undoPlacement;
rematchBtn.onclick =
    rematch;
leaveBtn.onclick =
    leaveRoom;
sendChat.onclick =
    sendChatMessage;
stickerToggle.onclick =
    function () {
        stickerPanel.classList.toggle(
            'show'
        );
    };
stickerPanelClose.onclick =
    function () {
        stickerPanel.classList.remove(
            'show'
        );
    };
chatInput.onkeydown =
    function (event) {
        if (
            event.key ===
            'Enter'
        ) {
            sendChatMessage();
        }
    };
chatReplyCancel.onclick =
    clearChatReply;
chatJumpBtn.onclick =
    function () {
        chatLog.scrollTop =
            chatLog.scrollHeight;
        chatUnreadCount =
            0;
        chatJumpBtn.classList.remove(
            'show'
        );
    };
if (chatScrollUpBtn) {
    chatScrollUpBtn.onclick =
        function () {
            scrollChatLogBy(
                chatLog,
                -1
            );
        };
}
if (chatScrollDownBtn) {
    chatScrollDownBtn.onclick =
        function () {
            scrollChatLogBy(
                chatLog,
                1
            );
        };
}
chatLog.addEventListener(
    'scroll',
    function () {
        if (
            isLogAtBottom(
                chatLog
            )
        ) {
            chatUnreadCount =
                0;
            chatJumpBtn.classList.remove(
                'show'
            );
        }
    }
);
roomInput.oninput =
    function () {
        roomInput.value =
            roomInput.value
                .toUpperCase()
                .replace(
                    /[^A-Z0-9]/g,
                    ''
                )
                .slice(
                    0,
                    6
                );
    };
roomInput.onkeydown =
    function (event) {
        if (
            event.key ===
            'Enter'
        ) {
            joinRoom();
        }
    };
sendGlobalChatBtn.onclick =
    sendGlobalChatMessage;
globalStickerToggle.onclick =
    function () {
        globalStickerPanel.classList.toggle(
            'show'
        );
    };
globalStickerPanelClose.onclick =
    function () {
        globalStickerPanel.classList.remove(
            'show'
        );
    };
globalChatInput.onkeydown =
    function (event) {
        if (
            event.key ===
            'Enter'
        ) {
            sendGlobalChatMessage();
        }
    };
globalReplyCancel.onclick =
    clearGlobalChatReply;
globalChatJumpBtn.onclick =
    function () {
        globalChatLog.scrollTop =
            globalChatLog.scrollHeight;
        globalChatUnreadCount =
            0;
        globalChatJumpBtn.classList.remove(
            'show'
        );
    };
if (globalChatScrollUpBtn) {
    globalChatScrollUpBtn.onclick =
        function () {
            scrollChatLogBy(
                globalChatLog,
                -1
            );
        };
}
if (globalChatScrollDownBtn) {
    globalChatScrollDownBtn.onclick =
        function () {
            scrollChatLogBy(
                globalChatLog,
                1
            );
        };
}
globalChatLog.addEventListener(
    'scroll',
    function () {
        if (
            isLogAtBottom(
                globalChatLog
            )
        ) {
            globalChatUnreadCount =
                0;
            globalChatJumpBtn.classList.remove(
                'show'
            );
        }
    }
);

/* ========================================================
 * PRESENCE CLEANUP
 *
 * Membersihkan nama yang sudah tidak aktif (client
 * yang menutup tab tanpa sempat mengirim leave) dari
 * registry lokal, berdasarkan heartbeat presence.
 * ======================================================== */

function purgeStaleNames() {
    const now =
        Date.now();
    for (
        const [
            key,
            entry
        ] of activeNames
    ) {
        if (
            entry.playerId ===
            playerId
        ) {
            continue;
        }
        if (
            now - entry.ts >
            PRESENCE_STALE_MS
        ) {
            activeNames.delete(
                key
            );
        }
    }
}
setInterval(
    purgeStaleNames,
    PRESENCE_INTERVAL_MS
);

/* ========================================================
 * SPECTATOR PRESENCE
 *
 * Tidak ada backend custom di arsitektur relay pub/sub
 * ini (lihat catatan di bagian ROOM CODE COOLDOWN),
 * jadi "server" untuk jumlah penonton adalah host room
 * yang menyimpan state.spectators. Supaya jumlah tetap
 * benar walau ada client yang disconnect tanpa sempat
 * mengirim bsmp_leave (tab crash / koneksi putus), setiap
 * spectator mengirim heartbeat berkala, dan host
 * membersihkan entri yang sudah tidak mengirim heartbeat
 * lagi -- meniru pola purgeStaleNames di atas.
 * ======================================================== */

function sendSpectatorHeartbeat() {
    if (
        !room ||
        !isSpectator()
    ) {
        return;
    }
    send({
        type:
            'bsmp_spectator_ping',
        room,
        playerId
    });
}
setInterval(
    sendSpectatorHeartbeat,
    PRESENCE_INTERVAL_MS
);

function pruneStaleSpectators() {
    if (
        !isHost ||
        !state?.spectators?.length
    ) {
        return;
    }
    const now =
        Date.now();
    const before =
        state.spectators.length;
    state.spectators =
        state.spectators.filter(
            s =>
                !s.lastSeen ||
                now - s.lastSeen <=
                PRESENCE_STALE_MS
        );
    if (
        state.spectators.length !==
        before
    ) {
        broadcastState();
    }
}
setInterval(
    pruneStaleSpectators,
    PRESENCE_INTERVAL_MS
);
window.addEventListener(
    'beforeunload',
    function () {
        if (
            loggedIn &&
            globalWs &&
            globalWs.readyState ===
            WebSocket.OPEN
        ) {
            try {
                globalWs.send(
                    JSON.stringify({
                        type:
                            'bsmp_global_leave',
                        playerId
                    })
                );
            } catch {}
        }
        if (
            room &&
            ws &&
            ws.readyState ===
            WebSocket.OPEN
        ) {
            try {
                ws.send(
                    JSON.stringify({
                        type:
                            'bsmp_leave',
                        room,
                        playerId,
                        name:
                            playerName
                    })
                );
            } catch {}
        }
    }
);

/* ========================================================
 * START
 *
 * Belum ada nama login → tampilkan halaman Login.
 * Koneksi Global dibuka lebih awal (tanpa join resmi)
 * supaya registry nama aktif sudah terisi begitu
 * pemain menekan MASUK.
 * ======================================================== */

setConnection(
    '',
    'OFFLINE'
);
showPage(
    'login'
);
connectGlobal();
if (loginNameInput) {
    loginNameInput.focus();
}
})();
</script>
`
}

/* =========================================================
 * SEND RICH RESPONSE
 * ========================================================= */

async function sendBattleshipMP(
    sock,
    m,
    html
) {
    const responseId =
        generateMessageIDV2()
    const sources = [
        {
            source_type:
                'THIRD_PARTY',
            source_display_name:
                'BattleshipMP',
            source_subtitle:
                'Realtime Multiplayer',
            source_url:
                WEB_URL
        }
    ]
    const unifiedData =
        Buffer
            .from(
                JSON.stringify({
                    response_id:
                        responseId,
                    sections: [
                        {
                            view_model: {
                                primitive: {
                                    __typename:
                                        'GenAIaeacdsnwHtmlPrimitive',
                                    payload:
                                        html,
                                    trusted_sources:
                                        [
                                            WEB_URL
                                        ]
                                },
                                __typename:
                                    'GenAISingleLayoutViewModel'
                            }
                        }
                    ]
                })
            )
            .toString(
                'base64'
            )
    const isi = {
        messageContextInfo: {
            deviceListMetadata:
                {},
            deviceListMetadataVersion:
                2,
            botMetadata: {
                messageDisclaimerText:
                    'BattleshipMP',
                botResponseId:
                    responseId,
                richResponseSourcesMetadata: {
                    sources
                }
            }
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType:
                        1,
                    submessages: [
                        {
                            messageType:
                                proto
                                    .AIRichResponseSubMessageType
                                    .AI_RICH_RESPONSE_TEXT,
                            messageText:
                                'BattleshipMP'
                        }
                    ],
                    unifiedResponse: {
                        data:
                            unifiedData
                    },
                    contextInfo: {
                        forwardingScore:
                            1,
                        isForwarded:
                            true,
                        forwardedAiBotMessageInfo: {
                            botJid:
                                BOT_JID
                        },
                        forwardOrigin:
                            4
                    }
                }
            }
        }
    }
    const msg =
        generateWAMessageFromContent(
            m.chat,
            isi,
            {
                messageId:
                    generateMessageIDV2()
            }
        )
    await sock.relayMessage(
        m.chat,
        msg.message,
        {
            messageId:
                msg.key.id
        }
    )
}

/* =========================================================
 * HANDLER
 * ========================================================= */

// handler = fungsi utama yang dijalanin tiap kali command ke-trigger.
// m    = objek pesan (m.text, m.sender, m.chat, m.reply(), m.react(), dll)
// sock = instance socket Baileys (buat relay/kirim HTML card custom)
async function handler(m, { sock }) {
    await m.react('🚢')

    try {
        const playerIdentity = getWhatsAppIdentity(m)

        console.log('[battleshipmp][debug identity]', {
            pushName: m?.pushName,
            sender: m?.sender,
            keyParticipant: m?.key?.participant,
            keyRemoteJid: m?.key?.remoteJid,
            chat: m?.chat,
            resolved: playerIdentity
        })

        const stickers = await resolveStickers()

        const html = createGameHTML(playerIdentity, stickers)
        await sendBattleshipMP(sock, m, html)

        await m.react('✅')
    } catch (error) {
        console.error('[battleshipmp] Error:', error)
        await m.react('❌')

        return m.reply(
            `❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ ɴɢɪʀɪᴍ ʙᴀᴛᴛʟᴇsʜɪᴘᴍᴘ*\n\n` +
            `> ${error?.message || 'Unknown error'}\n\n` +
            `> Coba lagi ya, Ai janji next take bakal lebih bagus~ 🚢`
        )
    }
}

// Wajib export { config, handler } biar plugin loader (handler.js) bisa
// baca metadata dan manggil fungsi handler-nya
module.exports = {
    config: pluginConfig,
    handler
}