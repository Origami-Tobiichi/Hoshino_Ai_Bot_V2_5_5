/**
✧ Name    : quoridormp
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
    name: 'quoridormp',
    alias: ['qmp', 'quoridor', 'mazeracemp'],
    category: 'game',
    description: 'QuoridorMP - game strategi maze race 10x10, multiplayer realtime antar perangkat, lengkap dengan home, global chat, room chat, spectator, dan rematch.',
    usage: '.quoridormp',
    example: '.quoridormp',
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
 *
 * WEB_URL/WS_URL sengaja dipertahankan sama persis seperti
 * "battleshipmp.js" (relay pub/sub yang sama), supaya tidak
 * perlu bikin backend baru. Isolasi antar game dijamin lewat
 * prefix tipe pesan ('qmp_*' vs 'bsmp_*'), jadi aman dipakai
 * bareng di channel yang sama.
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
 * Sama seperti battleshipmp.js: sticker WAJIB gambar asli,
 * bukan emoji. HTML rich-response card tidak mengizinkan
 * <img> memuat gambar dari domain sembarang secara langsung,
 * jadi tiap sticker di-fetch di sisi bot lalu dikonversi ke
 * data URI base64 sebelum ditanam ke HTML.
 * ========================================================= */

const STICKER_SOURCES = [
    { id: 'sticker1', url: 'https://files.catbox.moe/85mhje.webp' },
    { id: 'sticker2', url: 'https://files.catbox.moe/zh3paj.webp' },
    { id: 'sticker3', url: 'https://files.catbox.moe/8hcyes.webp' },
    { id: 'sticker4', url: 'https://files.catbox.moe/g1htjc.webp' },
    { id: 'sticker5', url: 'https://files.catbox.moe/e12mj3.webp' },
    { id: 'sticker6', url: 'https://files.catbox.moe/fyub9m.webp' },
    { id: 'sticker7', url: 'https://files.catbox.moe/v13gj7.webp' }
]

const STICKER_CACHE_TTL_MS = 10 * 60 * 1000
const stickerDataUriCache = new Map()

function guessImageMime(url = '') {
    const clean = String(url).split('?')[0].split('#')[0].toLowerCase()
    if (clean.endsWith('.webp')) return 'image/webp'
    if (clean.endsWith('.png')) return 'image/png'
    if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg'
    if (clean.endsWith('.gif')) return 'image/gif'
    return ''
}

async function fetchStickerDataUri(source) {
    const cached = stickerDataUriCache.get(source.url)
    if (cached && Date.now() - cached.ts < STICKER_CACHE_TTL_MS) {
        return { id: source.id, url: cached.dataUri }
    }
    try {
        const response = await fetch(source.url)
        if (!response.ok) {
            console.error('[quoridormp][sticker] fetch gagal', source.id, response.status)
            return null
        }
        const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim()
        const mime = contentType.startsWith('image/') ? contentType : (guessImageMime(source.url) || 'image/webp')
        const buffer = Buffer.from(await response.arrayBuffer())
        const dataUri = 'data:' + mime + ';base64,' + buffer.toString('base64')
        stickerDataUriCache.set(source.url, { dataUri, ts: Date.now() })
        return { id: source.id, url: dataUri }
    } catch (error) {
        console.error('[quoridormp][sticker] error', source.id, error?.message)
        return null
    }
}

async function resolveStickers() {
    const settled = await Promise.all(STICKER_SOURCES.map(source => fetchStickerDataUri(source)))
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
    const raw = String(jid || '').split('@')[0].split(':')[0]
    const digits = raw.replace(/\D/g, '')
    if (!digits) return ''
    return '+' + digits
}
function getWhatsAppIdentity(m) {
    const pushName = String(m?.pushName || m?.pushname || m?.notifyName || '').trim()
    if (pushName) return pushName.slice(0, 20)
    const jid = m?.sender || m?.key?.participant || m?.key?.remoteJid || m?.chat || ''
    const phone = jidToPhoneNumber(jid)
    if (phone) return phone
    return 'Player'
}

/* =========================================================
 * CREATE HTML
 *
 * Semua logic game (board, giliran, pathfinding validasi
 * tembok, RPS, room system, home, global chat, room chat,
 * sticker, spectator, reconnect, rematch) jalan di sisi
 * client, sinkron lewat WebSocket relay yang sama seperti
 * battleshipmp.js. Host room = authoritative source of truth.
 * ========================================================= */

function createGameHTML(playerIdentity = '', stickers = []) {
    const safeWs = escapeForScript(WS_URL)
    const safeIdentity = escapeForScript(playerIdentity)
    const safeStickers = escapeJsonForScript(JSON.stringify(stickers))
    return `
<style>
* { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
html,body { margin:0; padding:0; background:transparent; color:#eef6ff;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; }
button,input { font-family:inherit; }
button { user-select:none; cursor:pointer; }
.wrap { width:100%; max-width:460px; margin:auto; padding:8px; }
.hidden { display:none !important; }
.card { position:relative; overflow:hidden; padding:16px; border-radius:20px;
  background:linear-gradient(150deg,rgba(30,20,55,.9),rgba(10,14,26,.92));
  border:1px solid rgba(157,120,255,.22); box-shadow:0 18px 50px rgba(0,0,0,.5); }
.glow { position:absolute; width:180px; height:180px; top:-90px; right:-60px; border-radius:50%;
  background:rgba(124,247,255,.14); filter:blur(60px); pointer-events:none; }
h1 { margin:0 0 2px; font-size:21px; letter-spacing:3px; text-align:center; font-weight:900;
  background:linear-gradient(90deg,#7cf7ff,#c9a8ff,#ffcf5c); -webkit-background-clip:text;
  background-clip:text; color:transparent; }
.subtitle { text-align:center; font-size:10px; letter-spacing:3px; color:#8fa3c9; margin:0 0 14px; }
.hdrRow { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.connWrap { display:flex; align-items:center; gap:5px; font-size:9px; letter-spacing:1px; color:#8fa3c9; }
.dot { width:7px; height:7px; border-radius:50%; background:#ff5c5c; flex:0 0 auto; }
.dot.online { background:#4be08a; }
.dot.error { background:#ff5c5c; }
input[type=text],input:not([type]) { width:100%; padding:12px 13px; border-radius:12px;
  border:1px solid rgba(157,120,255,.28); background:rgba(0,0,0,.28); color:#fff; font-size:14px;
  margin-bottom:9px; outline:none; }
input::placeholder { color:#6f7fa0; }
.who { text-align:center; font-size:11px; color:#8fa3c9; margin-bottom:8px; }
.btnPrimary { width:100%; padding:13px; border:none; border-radius:12px; font-weight:800; font-size:13px;
  letter-spacing:1px; color:#0c0620; background:linear-gradient(90deg,#7cf7ff,#c9a8ff); margin-bottom:8px; }
.btnPrimary:disabled { opacity:.4; }
.btnGhost { width:100%; padding:11px; border-radius:12px; font-weight:700; font-size:12px;
  color:#cfe0ff; background:rgba(157,120,255,.1); border:1px solid rgba(157,120,255,.25); margin-bottom:8px; }
.row2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.divider { text-align:center; color:#5c6a88; font-size:11px; margin:8px 0; }
.error { color:#ff8a8a; font-size:11px; min-height:14px; margin:-2px 0 6px; }
.navRow { display:flex; gap:6px; margin-bottom:10px; }
.navBtn { flex:1; padding:9px; border-radius:10px; font-size:10.5px; font-weight:800; letter-spacing:.5px;
  background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); color:#a9bcdd; }
.navBtn.active { background:linear-gradient(90deg,#7cf7ff,#c9a8ff); color:#0c0620; }
.roomRow { display:flex; align-items:center; justify-content:space-between; gap:6px;
  padding:9px 11px; border-radius:12px; background:rgba(255,255,255,.045);
  border:1px solid rgba(255,255,255,.08); margin-bottom:8px; }
.roomLabel { font-size:9px; letter-spacing:1.5px; color:#8fa3c9; }
.roomCode { font-size:20px; letter-spacing:4px; font-weight:900; color:#7cf7ff; }
.roomBtns { display:flex; gap:5px; }
.miniBtn { padding:7px 9px; border:none; border-radius:8px; background:rgba(157,120,255,.18);
  color:#cfe0ff; font-size:9.5px; font-weight:800; }
.hostInfo { text-align:center; font-size:10px; color:#8fa3c9; margin-bottom:4px; }
.specCount { text-align:center; font-size:10px; color:#a8b8d8; margin-bottom:6px; }
.spectatorTag { text-align:center; font-size:10.5px; color:#ffcf5c; margin-bottom:6px; font-weight:700; }
.playersRow { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-bottom:8px; }
.playerCard { padding:9px 8px; border-radius:12px; background:rgba(255,255,255,.045);
  border:1px solid rgba(255,255,255,.08); text-align:center; position:relative; }
.playerCard.turn { border-color:#7cf7ff; }
.playerCard.p1.turn { animation:auraPulseP1 1.3s ease-in-out infinite; }
.playerCard.p2.turn { animation:auraPulseP2 1.3s ease-in-out infinite; }
@keyframes auraPulseP1 {
  0%,100% { transform:scale(1); box-shadow:0 0 0 1px rgba(124,196,255,.9) inset, 0 0 12px 2px rgba(124,196,255,.4), 0 0 22px 6px rgba(124,196,255,.18); }
  50% { transform:scale(1.025); box-shadow:0 0 0 1.5px rgba(124,196,255,1) inset, 0 0 26px 7px rgba(124,196,255,.85), 0 0 48px 18px rgba(124,196,255,.45); }
}
@keyframes auraPulseP2 {
  0%,100% { transform:scale(1); box-shadow:0 0 0 1px rgba(255,110,110,.9) inset, 0 0 12px 2px rgba(255,110,110,.4), 0 0 22px 6px rgba(255,110,110,.18); }
  50% { transform:scale(1.025); box-shadow:0 0 0 1.5px rgba(255,110,110,1) inset, 0 0 26px 7px rgba(255,110,110,.85), 0 0 48px 18px rgba(255,110,110,.45); }
}
.playerCard.p1 .sym { color:#7cc4ff; }
.playerCard.p2 .sym { color:#ff9d9d; }
.sym { font-size:15px; font-weight:900; }
.pname { margin-top:2px; font-size:10.5px; color:#dbe6f8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pmeta { margin-top:3px; font-size:9px; color:#8fa3c9; }
.readyDot { display:inline-block; width:6px; height:6px; border-radius:50%; background:#556; margin-right:3px; }
.readyDot.on { background:#4be08a; }
.turnPill { display:none; margin-top:4px; font-size:8px; font-weight:800; letter-spacing:.5px;
  padding:2px 6px; border-radius:20px; background:#4be08a; color:#04260f; }
.turnPill.show { display:inline-block; }
.statusText { text-align:center; font-size:12px; color:#dbe6f8; min-height:16px; margin-bottom:8px; font-weight:600; }
.boardWrap { display:flex; justify-content:center; margin:6px 0 10px; position:relative; }
.boardGrid { display:grid; background:rgba(0,0,0,.35); padding:6px; border-radius:12px;
  border:1px solid rgba(157,120,255,.18); }
.cell { background:rgba(255,255,255,.045); border-radius:4px; position:relative;
  display:flex; align-items:center; justify-content:center; font-size:14px; }
.cell.goalRow { background:rgba(255,207,92,.16); }
.cell.startRow { background:rgba(124,247,255,.08); }
.wallSlotH,.wallSlotV { background:rgba(255,255,255,.045); border-radius:3px; border:none; padding:0; }
.wallSlotH.on,.wallSlotV.on { background:linear-gradient(90deg,#c9a8ff,#ffcf5c); }
.wallSlotH.preview,.wallSlotV.preview { background:rgba(255,207,92,.65); z-index:2; animation:wallAura .9s ease-in-out infinite; }
@keyframes wallAura {
  0%,100% { box-shadow:0 0 8px 2px rgba(255,207,92,.7), 0 0 16px 5px rgba(255,207,92,.35); }
  50% { box-shadow:0 0 14px 5px rgba(255,207,92,1), 0 0 28px 10px rgba(255,207,92,.6); }
}
.wallSlotH.clickable,.wallSlotV.clickable { background:rgba(124,247,255,.18); }
.corner { background:transparent; }
.controls { margin-top:6px; }
.wallCount { text-align:center; font-size:11px; color:#c7d8e6; margin-bottom:8px; }
.modeButtons { display:flex; gap:8px; margin-bottom:10px; }
.modeBtn { flex:1; padding:10px; border-radius:10px; font-size:12px; font-weight:800;
  background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.13); color:#cfe0ff; }
.modeBtn.active { background:linear-gradient(90deg,#7cf7ff,#c9a8ff); color:#0c0620; }
.modeBtn:disabled { opacity:.35; }
.dpad { display:grid; grid-template-columns:54px 54px 54px; grid-template-rows:54px 54px;
  justify-content:center; gap:6px; margin-bottom:6px; }
.dirBtn { font-size:19px; border-radius:12px; border:1px solid rgba(255,255,255,.15);
  background:rgba(255,255,255,.06); color:#fff; }
.dirBtn.up { grid-column:2; grid-row:1; }
.dirBtn.left { grid-column:1; grid-row:2; }
.dirBtn.right { grid-column:3; grid-row:2; }
.dirBtn.down { grid-column:2; grid-row:2; }
.dirBtn:disabled { opacity:.25; }
.wallHint { text-align:center; font-size:11px; color:#8fa3c9; margin-bottom:6px; }
.wallPreviewBox { display:none; gap:8px; margin-bottom:8px; }
.wallPreviewBox.show { display:flex; }
.wallPreviewBox button { flex:1; padding:9px; border-radius:10px; font-size:11.5px; font-weight:800; border:none; }
.btnConfirmWall { background:linear-gradient(90deg,#4be08a,#37c477); color:#04260f; }
.btnCancelWall { background:rgba(255,255,255,.1); color:#fff; }
.readyBtn { width:100%; padding:12px; border:none; border-radius:12px; font-weight:900; font-size:12.5px;
  background:linear-gradient(90deg,#4be08a,#37c477); color:#04260f; margin-top:2px; margin-bottom:8px; }
.overlay { position:absolute; inset:0; background:rgba(6,4,16,.9); backdrop-filter:blur(2px);
  display:flex; align-items:center; justify-content:center; z-index:6; border-radius:20px; }
.overlayCard { text-align:center; padding:18px; width:88%; }
.rpsChoices { display:flex; gap:10px; justify-content:center; margin:14px 0; }
.rpsBtn { font-size:25px; width:62px; height:62px; border-radius:16px; border:1px solid rgba(255,255,255,.16);
  background:rgba(255,255,255,.07); }
.rpsBtn.picked { background:linear-gradient(90deg,#7cf7ff,#c9a8ff); }
.rpsBtn:disabled { opacity:.4; }
.winTitle { font-size:19px; font-weight:900; margin-bottom:4px; }
.winSub { font-size:12px; color:#c7d8e6; margin-bottom:16px; }
.overlayRow { display:flex; gap:8px; }
.overlayRow button { flex:1; padding:11px; border-radius:10px; font-weight:800; font-size:12px; border:none; }
.btnRematch { background:linear-gradient(90deg,#4be08a,#37c477); color:#04260f; }
.btnExit { background:rgba(255,255,255,.1); color:#fff; }

/* ---- END-GAME FX (aura kemenangan/kekalahan) ---- */
#fxOverlay { z-index:7; overflow:hidden; background:rgba(4,3,10,0); backdrop-filter:none;
  transition:background .4s ease; pointer-events:none; }
#fxOverlay.show { background:rgba(4,3,10,.66); }
.fxFlash { position:absolute; inset:0; opacity:0; background:#fff; }
#fxOverlay.win .fxFlash { animation:fxFlashWin .55s ease-out forwards; }
#fxOverlay.lose .fxFlash { background:#3a0505; animation:fxFlashLose .5s ease-out forwards; }
#fxOverlay.neutral .fxFlash { background:#0e1626; animation:fxFlashLose .4s ease-out forwards; }
@keyframes fxFlashWin { 0% { opacity:1; } 100% { opacity:0; } }
@keyframes fxFlashLose { 0% { opacity:.8; } 100% { opacity:0; } }

/* vignette pulse: menekan tepi layar biar fokus tertarik ke tengah */
.fxVignette { position:absolute; inset:0; opacity:0; pointer-events:none; }
#fxOverlay.win .fxVignette,#fxOverlay.lose .fxVignette { animation:fxVignetteIn .6s ease .05s forwards, fxVignettePulse 1.6s ease-in-out 1s infinite; }
#fxOverlay.win .fxVignette { background:radial-gradient(ellipse at center,transparent 38%,rgba(255,207,92,.18) 78%,rgba(255,207,92,.32) 100%); }
#fxOverlay.lose .fxVignette { background:radial-gradient(ellipse at center,transparent 40%,rgba(150,20,20,.28) 78%,rgba(120,10,10,.5) 100%); }
@keyframes fxVignetteIn { from { opacity:0; } to { opacity:1; } }
@keyframes fxVignettePulse { 0%,100% { opacity:.7; } 50% { opacity:1; } }

/* expanding shockwave rings that emanate from the icon on impact */
.fxRingLayer { position:absolute; left:50%; top:44%; width:1px; height:1px; pointer-events:none; }
.fxRing { position:absolute; left:50%; top:50%; border-radius:50%; transform:translate(-50%,-50%) scale(0);
  border:2px solid rgba(255,214,107,.85); opacity:0; }
#fxOverlay.win .fxRing { animation:fxRingExpand 1.5s cubic-bezier(.15,.75,.35,1) forwards; }
#fxOverlay.lose .fxRing { border-color:rgba(255,92,92,.75); animation:fxRingExpandLose .9s cubic-bezier(.3,.6,.4,1) forwards; }
.fxRing.r1 { animation-delay:.05s; }
.fxRing.r2 { animation-delay:.22s; }
.fxRing.r3 { animation-delay:.4s; }
@keyframes fxRingExpand { 0% { width:10px; height:10px; opacity:.95; border-width:3px; }
  100% { width:520px; height:520px; opacity:0; border-width:.5px; } }
@keyframes fxRingExpandLose { 0% { width:10px; height:10px; opacity:.8; border-width:3px; }
  100% { width:340px; height:340px; opacity:0; border-width:.5px; } }

.fxRays { position:absolute; inset:-45%; opacity:0; }
#fxOverlay.win .fxRays { background:repeating-conic-gradient(from 0deg,rgba(255,207,92,.35) 0deg 4deg,transparent 4deg 18deg);
  animation:fxRaysSpin 2.6s linear forwards, fxRaysFade 2.6s ease forwards; }
#fxOverlay.lose .fxRays { background:repeating-conic-gradient(from 0deg,rgba(255,80,80,.22) 0deg 3deg,transparent 3deg 20deg);
  animation:fxRaysSpinRev 2.4s linear forwards, fxRaysFade 2.4s ease forwards; }
@keyframes fxRaysSpin { from { transform:rotate(0deg) scale(1); } to { transform:rotate(130deg) scale(1.12); } }
@keyframes fxRaysSpinRev { from { transform:rotate(0deg); } to { transform:rotate(-100deg); } }
@keyframes fxRaysFade { 0% { opacity:0; } 15% { opacity:.9; } 78% { opacity:.45; } 100% { opacity:0; } }

/* secondary inner starburst flare, layered above the rays for extra depth */
.fxFlare { position:absolute; left:50%; top:44%; width:2px; height:2px; opacity:0; pointer-events:none; }
#fxOverlay.win .fxFlare { animation:fxFlareBloom 1.1s cubic-bezier(.2,1,.35,1) .12s forwards; }
.fxFlare::before,.fxFlare::after { content:''; position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  background:radial-gradient(circle,#fff 0%,rgba(255,224,138,.9) 30%,transparent 72%); border-radius:50%; }
.fxFlare::before { width:340px; height:70px; }
.fxFlare::after { width:70px; height:340px; }
@keyframes fxFlareBloom { 0% { opacity:0; transform:translate(-50%,-50%) scale(.1) rotate(0deg); }
  35% { opacity:.9; } 100% { opacity:0; transform:translate(-50%,-50%) scale(1.15) rotate(45deg); } }

.fxParticles { position:absolute; inset:0; }
.fxParticle { position:absolute; top:-8%; opacity:0; }
.fxParticle.dot { border-radius:50%; }
.fxParticle.strip { border-radius:2px; }
.fxParticle.shard { border-radius:1px; }
#fxOverlay.win .fxParticle.dot { background:linear-gradient(135deg,#ffe08a,#ffb84d); box-shadow:0 0 6px 1px rgba(255,207,92,.8);
  animation:fxFall linear forwards; }
#fxOverlay.win .fxParticle.strip { animation:fxConfettiFall linear forwards; }
#fxOverlay.lose .fxParticle.dot { background:#6a6a76; box-shadow:0 0 4px rgba(0,0,0,.6); animation:fxFall linear forwards; }
#fxOverlay.lose .fxParticle.shard { background:linear-gradient(160deg,#8a2b2b,#3a0a0a); box-shadow:0 0 5px rgba(120,10,10,.7);
  animation:fxDebrisFall linear forwards; }
@keyframes fxFall { 0% { transform:translateY(0) rotate(0deg); opacity:0; } 8% { opacity:1; }
  100% { transform:translateY(480px) rotate(360deg); opacity:0; } }
@keyframes fxConfettiFall {
  0% { transform:translateY(0) translateX(0) rotate3d(1,1,0,0deg); opacity:0; }
  8% { opacity:1; }
  40% { transform:translateY(190px) translateX(18px) rotate3d(1,1,0,180deg); }
  70% { transform:translateY(340px) translateX(-14px) rotate3d(1,1,0,360deg); }
  100% { transform:translateY(500px) translateX(10px) rotate3d(1,1,0,540deg); opacity:0; }
}
@keyframes fxDebrisFall {
  0% { transform:translateY(0) translateX(0) rotate(0deg); opacity:0; }
  10% { opacity:1; }
  55% { transform:translateY(220px) translateX(-24px) rotate(220deg); }
  100% { transform:translateY(420px) translateX(-10px) rotate(400deg); opacity:0; }
}

/* embers that drift and flicker upward behind a loss, giving a smoldering feel */
.fxEmbers { position:absolute; inset:0; opacity:0; }
#fxOverlay.lose .fxEmbers { animation:fxEmbersIn .4s ease .1s forwards; }
.fxEmber { position:absolute; bottom:-6%; border-radius:50%; background:radial-gradient(circle,#ff9d5c,#7a1f1f 70%);
  box-shadow:0 0 6px 1px rgba(255,120,60,.6); opacity:0; animation:fxEmberRise linear forwards; }
@keyframes fxEmbersIn { to { opacity:1; } }
@keyframes fxEmberRise {
  0% { transform:translateY(0) translateX(0) scale(.6); opacity:0; }
  12% { opacity:.9; }
  60% { transform:translateY(-220px) translateX(14px) scale(1); }
  100% { transform:translateY(-420px) translateX(-8px) scale(.3); opacity:0; }
}

.fxCenter { position:relative; text-align:center; z-index:2; }
.fxTrophyGlow { position:absolute; left:50%; top:6px; width:96px; height:96px; transform:translateX(-50%);
  border-radius:50%; opacity:0; pointer-events:none;
  background:radial-gradient(circle,rgba(255,224,138,.85) 0%,rgba(255,207,92,.35) 45%,transparent 72%); }
#fxOverlay.win .fxTrophyGlow { animation:fxGlowPulse 1.3s ease-in-out .5s infinite; }
@keyframes fxGlowPulse { 0%,100% { opacity:.55; transform:translateX(-50%) scale(1); }
  50% { opacity:1; transform:translateX(-50%) scale(1.25); } }
.fxIcon { position:relative; font-size:54px; opacity:0; transform:scale(.2) rotate(-25deg); z-index:1; }
#fxOverlay.win .fxIcon { animation:fxIconPop .7s cubic-bezier(.17,1.4,.4,1) .15s forwards, fxIconBounce 1s ease-in-out 1s infinite; }
#fxOverlay.lose .fxIcon,#fxOverlay.neutral .fxIcon { animation:fxIconDrop .7s cubic-bezier(.6,-.3,.4,1) .15s forwards; }
@keyframes fxIconPop { 0% { opacity:0; transform:scale(.2) rotate(-25deg); } 60% { opacity:1; transform:scale(1.3) rotate(8deg); }
  80% { transform:scale(.94) rotate(-3deg); } 100% { opacity:1; transform:scale(1) rotate(0deg); } }
@keyframes fxIconBounce { 0%,100% { transform:translateY(0) rotate(0deg); } 50% { transform:translateY(-7px) rotate(-4deg); } }
@keyframes fxIconDrop { 0% { opacity:0; transform:scale(.4) translateY(-40px) rotate(-15deg); }
  60% { opacity:1; transform:scale(1.1) translateY(4px) rotate(4deg); } 100% { opacity:1; transform:scale(1) translateY(0) rotate(0deg); } }
.fxText { position:relative; margin-top:8px; font-size:28px; font-weight:900; letter-spacing:2px; opacity:0; overflow:hidden; }
#fxOverlay.win .fxText { color:#ffd66b; animation:fxTextIn .55s cubic-bezier(.2,1.3,.3,1) .35s forwards, fxTextGlow 1.1s ease-in-out .9s infinite; }
#fxOverlay.lose .fxText { color:#ff5c5c; animation:fxTextIn .55s cubic-bezier(.2,1.3,.3,1) .35s forwards, fxTextShake .5s ease .9s 2; }
#fxOverlay.neutral .fxText { color:#cfe0ff; font-size:22px; animation:fxTextIn .5s cubic-bezier(.2,1.3,.3,1) .2s forwards; }
@keyframes fxTextIn { 0% { opacity:0; transform:scale(2.2) translateY(10px); letter-spacing:10px; }
  100% { opacity:1; transform:scale(1) translateY(0); letter-spacing:2px; } }
@keyframes fxTextGlow { 0%,100% { text-shadow:0 0 14px rgba(255,214,107,.7); } 50% { text-shadow:0 0 30px rgba(255,214,107,1),0 0 50px rgba(255,207,92,.6); } }
@keyframes fxTextShake { 0%,100% { transform:translateX(0); } 25% { transform:translateX(-6px); } 75% { transform:translateX(6px); } }
/* diagonal shine sweep across the win text, like a light catching foil */
.fxText::after { content:''; position:absolute; top:0; left:-60%; width:40%; height:100%;
  background:linear-gradient(115deg,transparent 0%,rgba(255,255,255,.85) 50%,transparent 100%);
  transform:skewX(-20deg); opacity:0; }
#fxOverlay.win .fxText::after { animation:fxShineSweep 1.4s ease 1.15s 2; }
@keyframes fxShineSweep { 0% { left:-60%; opacity:0; } 8% { opacity:.9; } 45% { opacity:.9; } 60% { left:130%; opacity:0; } 100% { left:130%; opacity:0; } }
.fxSub { margin-top:8px; font-size:11.5px; color:#dbe6f8; opacity:0; animation:fxSubIn .5s ease .75s forwards; }
@keyframes fxSubIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
#fxOverlay.lose { animation:fxShakeScreen .35s ease .05s 3; }
@keyframes fxShakeScreen { 0%,100% { transform:translateX(0) translateY(0); } 15% { transform:translateX(-6px) translateY(1px); }
  30% { transform:translateX(6px) translateY(-1px); } 45% { transform:translateX(-4px); } 60% { transform:translateX(4px) translateY(1px); }
  75% { transform:translateX(-2px); } 90% { transform:translateX(2px); } }

/* floating idol-style celebratory sparkle chips around the fx text for wins */
.fxSparkle { position:absolute; font-size:14px; opacity:0; pointer-events:none; }
#fxOverlay.win .fxSparkle { animation:fxSparkleTwinkle 1.4s ease-in-out infinite; }
@keyframes fxSparkleTwinkle { 0%,100% { opacity:0; transform:scale(.4) rotate(0deg); }
  50% { opacity:1; transform:scale(1.05) rotate(18deg); } }

.chatToggleRow { display:flex; gap:8px; margin-top:10px; }
.chatToggleRow button { flex:1; padding:9px; border-radius:10px; font-size:11px; font-weight:800;
  background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.13); color:#cfe0ff; position:relative; }
.badge { display:inline-block; margin-left:6px; background:#ff5c5c; color:#fff; font-size:9.5px;
  border-radius:9px; padding:1px 6px; }
.chatPanel { margin-top:8px; border-radius:12px; background:rgba(0,0,0,.25);
  border:1px solid rgba(255,255,255,.06); position:relative; }
.chatTitle { padding:8px 10px; font-size:9px; letter-spacing:1.5px; color:#8fa3c9;
  border-bottom:1px solid rgba(255,255,255,.06); }
.chatMessages { max-height:170px; overflow-y:auto; display:flex; flex-direction:column; gap:6px; padding:8px; }
.msgRow { display:flex; align-items:flex-start; gap:4px; }
.chatMsg { flex:1; min-width:0; background:rgba(255,255,255,.05); border-radius:9px; padding:6px 8px; font-size:11.5px; }
.chatMsg .who { font-size:10px; color:#7cf7ff; font-weight:800; margin-bottom:2px; }
.chatMsg .quote { font-size:10px; color:#8fa3c9; border-left:2px solid #4a3f74; padding-left:6px; margin-bottom:3px; }
.chatMsg .txt { color:#eaf3fa; word-break:break-word; }
.joinRoomBtn { display:block; margin-top:6px; padding:8px 10px; border:none; border-radius:8px;
  background:linear-gradient(90deg,#7cf7ff,#9d78ff); color:#04121a; font-weight:800; font-size:11.5px; letter-spacing:.5px; }
.replyMini { flex:0 0 auto; margin-top:1px; padding:2px 5px; border:none; border-radius:6px;
  background:rgba(255,255,255,.07); color:#8fa3c9; font-size:9px; }
.stickerImg { width:76px; height:76px; object-fit:contain; border-radius:8px; background:rgba(255,255,255,.05); }
.replyBar { display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,.06);
  border-radius:8px; padding:5px 8px; font-size:10.5px; margin:0 8px 6px; color:#cfe0ff; }
.replyBar.hidden { display:none; }
.replyBar button { background:none; border:none; color:#ff8a8a; font-size:13px; }
.chatInputRow { display:grid; grid-template-columns:1fr auto auto; gap:6px; padding:8px;
  border-top:1px solid rgba(255,255,255,.06); }
.chatInputRow input { margin-bottom:0; }
.chatInputRow button { padding:0 12px; border-radius:10px; border:none; font-weight:800; font-size:12px; }
.btnSticker { background:rgba(157,120,255,.2); color:#cfe0ff; }
.btnSend { background:linear-gradient(90deg,#7cf7ff,#c9a8ff); color:#0c0620; }
.stickerPanel { display:none; position:absolute; right:8px; bottom:50px; z-index:20; width:220px;
  max-height:230px; overflow-y:auto; border-radius:14px; background:rgba(18,12,32,.98);
  border:1px solid rgba(157,120,255,.25); box-shadow:0 14px 40px rgba(0,0,0,.5); padding:8px;
  grid-template-columns:1fr 1fr 1fr; gap:6px; }
.stickerPanel.show { display:grid; }
.stickerPanel img { width:100%; aspect-ratio:1; object-fit:contain; border-radius:8px;
  background:rgba(255,255,255,.05); }
.toastLayer { position:fixed; left:0; right:0; bottom:16px; display:flex; flex-direction:column;
  align-items:center; gap:6px; z-index:60; pointer-events:none; }
.toast { background:rgba(18,12,32,.96); color:#fff; padding:9px 14px; border-radius:10px; font-size:12px;
  border:1px solid rgba(255,255,255,.15); max-width:80%; text-align:center; }
.toast.error { border-color:#ff5c5c; color:#ffb3b3; }
.toast.success { border-color:#4be08a; color:#bdf5d6; }
</style>

<div class="wrap">

  <div class="card" id="pageLogin">
    <div class="glow"></div>
    <h1>QUORIDORMP</h1>
    <div class="subtitle">MAZE RACE · REALTIME MULTIPLAYER</div>
    <input id="nameInput" placeholder="Masukkan nama kamu" maxlength="20">
    <div class="error" id="loginError"></div>
    <button class="btnPrimary" id="btnLogin">MASUK</button>
  </div>

  <div class="card hidden" id="pageHome">
    <div class="glow"></div>
    <div class="hdrRow">
      <h1 style="text-align:left;margin:0;">QUORIDORMP</h1>
      <div class="connWrap"><span class="dot" id="connDotG"></span><span id="connTextG">OFFLINE</span></div>
    </div>
    <div class="who" id="whoAmI">-</div>
    <button class="btnPrimary" id="btnCreate">🧩 BUAT ROOM</button>
    <div class="divider">— atau —</div>
    <input id="joinInput" placeholder="Kode room (6 karakter)" maxlength="6" style="text-transform:uppercase">
    <button class="btnGhost" id="btnJoin">GABUNG ROOM</button>
    <div class="error" id="joinError"></div>
    <div class="divider">GLOBAL CHAT</div>
    <div class="chatPanel" id="globalChatPanel" style="margin-top:0;">
      <div class="chatMessages" id="globalChatMessages"></div>
      <div class="replyBar hidden" id="globalReplyBar"></div>
      <div class="chatInputRow">
        <input id="globalChatInput" placeholder="Tulis di global chat..." maxlength="300">
        <button class="btnSticker" id="btnGlobalSticker">🖼</button>
        <button class="btnSend" id="btnGlobalSend">Kirim</button>
      </div>
      <div class="stickerPanel" id="globalStickerPanel"></div>
    </div>
  </div>

  <div class="card hidden" id="pageRoom" style="position:relative;">
    <div class="glow"></div>
    <div class="hdrRow">
      <h1 style="text-align:left;margin:0;">QUORIDORMP</h1>
      <div class="connWrap"><span class="dot" id="connDot"></span><span id="connText">OFFLINE</span></div>
    </div>
    <div class="roomRow">
      <div>
        <div class="roomLabel">ROOM CODE</div>
        <div class="roomCode" id="roomCodeText">-</div>
      </div>
      <div class="roomBtns">
        <button class="miniBtn" id="btnCopyCode">SALIN</button>
        <button class="miniBtn" id="btnShareCode">KIRIM KE GLOBAL</button>
      </div>
    </div>
    <div class="hostInfo" id="hostInfo">Host: -</div>
    <div class="specCount hidden" id="specCount">👁 0 penonton</div>
    <div class="spectatorTag hidden" id="spectatorTag">👁 MODE PENONTON</div>

    <div class="playersRow">
      <div class="playerCard p1" id="cardP1">
        <div class="sym">🔵 P1</div>
        <div class="pname" id="nameP1">-</div>
        <div class="pmeta"><span class="readyDot" id="readyDotP1"></span><span id="metaP1">menunggu</span></div>
        <div class="pmeta">🧱 terpasang: <span id="wallsP1">0</span></div>
        <div class="turnPill" id="turnPillP1">✦ GILIRANMU</div>
      </div>
      <div class="playerCard p2" id="cardP2">
        <div class="sym">🔴 P2</div>
        <div class="pname" id="nameP2">-</div>
        <div class="pmeta"><span class="readyDot" id="readyDotP2"></span><span id="metaP2">menunggu</span></div>
        <div class="pmeta">🧱 terpasang: <span id="wallsP2">0</span></div>
        <div class="turnPill" id="turnPillP2">✦ GILIRANMU</div>
      </div>
    </div>

    <div class="statusText" id="statusText">Memuat...</div>

    <div class="boardWrap"><div class="boardGrid" id="boardGrid"></div></div>

    <button class="readyBtn hidden" id="btnReady">✅ SIAP</button>

    <div class="controls hidden" id="controls">
      <div class="wallCount">🧱 Tembok TIDAK TERBATAS &nbsp;·&nbsp; Terpasang - Kamu: <b id="myWalls">0</b> &nbsp;|&nbsp; Lawan: <b id="oppWalls">0</b></div>
      <div class="modeButtons">
        <button class="modeBtn active" id="btnModeMove">🚶 LANGKAH</button>
        <button class="modeBtn" id="btnModeWall">🧱 TEMBOK</button>
      </div>
      <div class="dpad" id="dpad">
        <button class="dirBtn up" id="dirUp">⬆️</button>
        <button class="dirBtn left" id="dirLeft">⬅️</button>
        <button class="dirBtn right" id="dirRight">➡️</button>
        <button class="dirBtn down" id="dirDown">⬇️</button>
      </div>
      <div class="wallHint hidden" id="wallHint">🧱 Ketuk garis pada papan untuk memilih posisi tembok</div>
      <div class="wallPreviewBox" id="wallPreviewBox">
        <button class="btnConfirmWall" id="btnConfirmWall">PASANG TEMBOK</button>
        <button class="btnCancelWall" id="btnCancelWall">BATAL</button>
      </div>
    </div>

    <div class="overlay hidden" id="rpsOverlay">
      <div class="overlayCard">
        <div class="winTitle">BATU GUNTING KERTAS</div>
        <div class="winSub" id="rpsSub">Menentukan pemain pertama...</div>
        <div class="rpsChoices">
          <button class="rpsBtn" id="rpsRock">✊</button>
          <button class="rpsBtn" id="rpsPaper">🖐</button>
          <button class="rpsBtn" id="rpsScissors">✌️</button>
        </div>
      </div>
    </div>

    <div class="overlay hidden" id="fxOverlay">
      <div class="fxFlash"></div>
      <div class="fxVignette"></div>
      <div class="fxRays"></div>
      <div class="fxFlare"></div>
      <div class="fxRingLayer" id="fxRingLayer">
        <div class="fxRing r1"></div>
        <div class="fxRing r2"></div>
        <div class="fxRing r3"></div>
      </div>
      <div class="fxEmbers" id="fxEmbers"></div>
      <div class="fxParticles" id="fxParticles"></div>
      <div class="fxCenter">
        <div class="fxTrophyGlow"></div>
        <div class="fxIcon" id="fxIcon">🏆</div>
        <div class="fxText" id="fxText">MENANG!</div>
        <div class="fxSub" id="fxSub"></div>
        <div class="fxSparkleLayer" id="fxSparkleLayer"></div>
      </div>
    </div>

    <div class="overlay hidden" id="winOverlay">
      <div class="overlayCard">
        <div class="winTitle" id="winTitle">🏆 Menang!</div>
        <div class="winSub" id="winSub"></div>
        <div class="overlayRow">
          <button class="btnRematch" id="btnRematch">↻ REMATCH</button>
          <button class="btnExit" id="btnExitRoom">KELUAR ROOM</button>
        </div>
      </div>
    </div>

    <div class="overlay hidden" id="confirmLeaveOverlay">
      <div class="overlayCard">
        <div class="winTitle" id="confirmLeaveTitle">Keluar dari Room?</div>
        <div class="winSub" id="confirmLeaveMsg">Yakin ingin keluar dari room ini?</div>
        <div class="overlayRow">
          <button class="btnExit" id="btnConfirmLeaveYes">YA, KELUAR</button>
          <button class="btnRematch" id="btnConfirmLeaveNo">BATAL</button>
        </div>
      </div>
    </div>

    <div class="chatToggleRow">
      <button id="btnToggleChat">💬 Room Chat <span class="badge hidden" id="chatUnread">0</span></button>
      <button id="btnBackHome">🏠 Home</button>
      <button id="btnLeaveRoom">🚪 Keluar</button>
    </div>
    <div class="chatPanel hidden" id="chatPanel">
      <div class="chatTitle">ROOM CHAT</div>
      <div class="chatMessages" id="chatMessages"></div>
      <div class="replyBar hidden" id="replyBar"></div>
      <div class="chatInputRow">
        <input id="chatInput" placeholder="Ketik pesan..." maxlength="300">
        <button class="btnSticker" id="btnRoomSticker">🖼</button>
        <button class="btnSend" id="btnSendChat">Kirim</button>
      </div>
      <div class="stickerPanel" id="roomStickerPanel"></div>
    </div>
  </div>

</div>
<div class="toastLayer" id="toastLayer"></div>

<script>
(function () {
'use strict';

/* WS_URL harus dideklarasikan di sisi CLIENT (browser), bukan cuma di
   Node.js server -- kalau tidak, new WebSocket(WS_URL) di bawah akan
   selalu gagal dengan "WS_URL is not defined". */
var WS_URL = ${safeWs};

function $(id) { return document.getElementById(id); }

/* ========================================================
 * DOM REFS
 * ======================================================== */
var pageLogin = $('pageLogin'), pageHome = $('pageHome'), pageRoom = $('pageRoom');
var nameInput = $('nameInput'), btnLogin = $('btnLogin'), loginError = $('loginError');
var connDotG = $('connDotG'), connTextG = $('connTextG'), whoAmI = $('whoAmI');
var btnCreate = $('btnCreate'), joinInput = $('joinInput'), btnJoin = $('btnJoin'), joinError = $('joinError');
var globalChatMessages = $('globalChatMessages'), globalReplyBar = $('globalReplyBar');
var globalChatInput = $('globalChatInput'), btnGlobalSticker = $('btnGlobalSticker');
var btnGlobalSend = $('btnGlobalSend'), globalStickerPanel = $('globalStickerPanel');

var connDot = $('connDot'), connText = $('connText');
var roomCodeText = $('roomCodeText'), btnCopyCode = $('btnCopyCode'), btnShareCode = $('btnShareCode');
var confirmLeaveOverlay = $('confirmLeaveOverlay'), confirmLeaveTitle = $('confirmLeaveTitle'), confirmLeaveMsg = $('confirmLeaveMsg');
var btnConfirmLeaveYes = $('btnConfirmLeaveYes'), btnConfirmLeaveNo = $('btnConfirmLeaveNo');
var hostInfo = $('hostInfo'), spectatorTag = $('spectatorTag'), specCount = $('specCount');
var cardP1 = $('cardP1'), cardP2 = $('cardP2');
var nameP1 = $('nameP1'), nameP2 = $('nameP2'), metaP1 = $('metaP1'), metaP2 = $('metaP2');
var readyDotP1 = $('readyDotP1'), readyDotP2 = $('readyDotP2');
var wallsP1 = $('wallsP1'), wallsP2 = $('wallsP2');
var turnPillP1 = $('turnPillP1'), turnPillP2 = $('turnPillP2');
var statusText = $('statusText'), boardGrid = $('boardGrid');
var btnReady = $('btnReady'), controls = $('controls');
var myWallsEl = $('myWalls'), oppWallsEl = $('oppWalls');
var btnModeMove = $('btnModeMove'), btnModeWall = $('btnModeWall');
var dirUp = $('dirUp'), dirDown = $('dirDown'), dirLeft = $('dirLeft'), dirRight = $('dirRight');
var wallHint = $('wallHint'), wallPreviewBox = $('wallPreviewBox');
var btnConfirmWall = $('btnConfirmWall'), btnCancelWall = $('btnCancelWall');
var rpsOverlay = $('rpsOverlay'), rpsSub = $('rpsSub');
var rpsRock = $('rpsRock'), rpsPaper = $('rpsPaper'), rpsScissors = $('rpsScissors');
var winOverlay = $('winOverlay'), winTitleEl = $('winTitle'), winSubEl = $('winSub');
var fxOverlay = $('fxOverlay'), fxIcon = $('fxIcon'), fxText = $('fxText'), fxSub = $('fxSub'), fxParticlesEl = $('fxParticles');
var fxEmbersEl = $('fxEmbers'), fxSparkleLayerEl = $('fxSparkleLayer');
var endFxState = { played: false, revealed: false };
var lastRematchVotes = { P1: false, P2: false };
var REMATCH_COOLDOWN_MS = 10000;
var rematchCooldownUntil = 0, rematchCooldownHandle = null;
var btnRematch = $('btnRematch'), btnExitRoom = $('btnExitRoom');
var btnToggleChat = $('btnToggleChat'), chatUnread = $('chatUnread');
var btnBackHome = $('btnBackHome'), btnLeaveRoom = $('btnLeaveRoom');
var chatPanel = $('chatPanel'), chatMessages = $('chatMessages'), replyBar = $('replyBar');
var chatInput = $('chatInput'), btnRoomSticker = $('btnRoomSticker'), btnSendChat = $('btnSendChat');
var roomStickerPanel = $('roomStickerPanel');
var toastLayer = $('toastLayer');

/* ========================================================
 * IDENTITY / STICKERS
 * ======================================================== */
var playerId = '';
try { playerId = localStorage.getItem('quoridormp_player_id'); } catch (e) {}
if (!playerId) {
  playerId = 'q_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { localStorage.setItem('quoridormp_player_id', playerId); } catch (e) {}
}
var SERVER_NAME = ${safeIdentity};
var STICKERS = ${safeStickers};
function getStickerUrl(id) {
  var found = STICKERS.find(function (s) { return s.id === id; });
  return found ? found.url : '';
}

/* ========================================================
 * BOARD CONSTANTS
 *
 * P1 dan P2 mulai BERDAMPINGAN di baris bawah (sesuai
 * spesifikasi). Karena keduanya start di baris yang sama,
 * "sisi papan yang berlawanan dari posisi awal" untuk
 * kedua pemain adalah baris paling atas -> ini adalah
 * mode MAZE RACE: keduanya balapan menuju baris yang sama
 * (baris 0), saling menghalangi lewat tembok. Cocok dengan
 * alias 'mazeracemp'.
 * ======================================================== */
var SIZE = 10;
var CELL_PX = 27;
var WALL_PX = 11;
var P1_START = { r: SIZE - 1, c: 4 };
var P2_START = { r: SIZE - 1, c: 5 };
var GOAL_ROW = 0;
var START_ROW = SIZE - 1;

function defaultPositions() {
  return { P1: { r: P1_START.r, c: P1_START.c }, P2: { r: P2_START.r, c: P2_START.c } };
}
function defaultState() {
  return {
    room: room,
    hostId: isHost ? playerId : (state ? state.hostId : ''),
    phase: 'lobby',
    currentTurn: 'P1',
    players: [],
    spectators: [],
    positions: defaultPositions(),
    walls: [],
    ready: { P1: false, P2: false },
    rps: { choices: { P1: null, P2: null }, round: 1, resultText: '' },
    winner: null,
    endReason: null,
    rematchVotes: { P1: false, P2: false }
  };
}

/* ========================================================
 * PATHFINDING / WALL LOGIC (host-authoritative, client preview)
 * ======================================================== */
function wallsPlacedBy(symbol, st) {
  return (st.walls || []).filter(function (w) { return w.by === symbol; }).length;
}
function buildWallSet(wallsArr) {
  var set = new Set();
  (wallsArr || []).forEach(function (w) { set.add((w.orient === 'H' ? 'h' : 'v') + w.r + '_' + w.c); });
  return set;
}
function inBounds(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
function isEdgeBlocked(wallSet, r, c, dir) {
  if (dir === 'up') return wallSet.has('h' + (r - 1) + '_' + c);
  if (dir === 'down') return wallSet.has('h' + r + '_' + c);
  if (dir === 'left') return wallSet.has('v' + r + '_' + (c - 1));
  if (dir === 'right') return wallSet.has('v' + r + '_' + c);
  return true;
}
function stepTarget(r, c, dir) {
  if (dir === 'up') return { r: r - 1, c: c };
  if (dir === 'down') return { r: r + 1, c: c };
  if (dir === 'left') return { r: r, c: c - 1 };
  if (dir === 'right') return { r: r, c: c + 1 };
  return null;
}
function bfsHasPath(startR, startC, targetRow, wallSet) {
  var visited = new Set([startR + '_' + startC]);
  var queue = [{ r: startR, c: startC }];
  var dirs = ['up', 'down', 'left', 'right'];
  while (queue.length) {
    var cur = queue.shift();
    if (cur.r === targetRow) return true;
    for (var i = 0; i < dirs.length; i++) {
      if (isEdgeBlocked(wallSet, cur.r, cur.c, dirs[i])) continue;
      var t = stepTarget(cur.r, cur.c, dirs[i]);
      if (!inBounds(t.r, t.c)) continue;
      var key = t.r + '_' + t.c;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push(t);
    }
  }
  return false;
}
function legalDirsFor(symbol, st) {
  var wallSet = buildWallSet(st.walls);
  var pos = st.positions[symbol];
  var opp = st.positions[symbol === 'P1' ? 'P2' : 'P1'];
  var out = {};
  ['up', 'down', 'left', 'right'].forEach(function (dir) {
    if (isEdgeBlocked(wallSet, pos.r, pos.c, dir)) { out[dir] = false; return; }
    var t = stepTarget(pos.r, pos.c, dir);
    if (!inBounds(t.r, t.c)) { out[dir] = false; return; }
    if (opp && opp.r === t.r && opp.c === t.c) { out[dir] = false; return; }
    out[dir] = true;
  });
  return out;
}
function edgeInRange(orient, r, c) {
  if (orient === 'H') return r >= 0 && r <= SIZE - 2 && c >= 0 && c <= SIZE - 1;
  if (orient === 'V') return r >= 0 && r <= SIZE - 1 && c >= 0 && c <= SIZE - 2;
  return false;
}
function wallWouldBlockPaths(st, orient, r, c) {
  var trial = buildWallSet(st.walls);
  trial.add((orient === 'H' ? 'h' : 'v') + r + '_' + c);
  var p1ok = bfsHasPath(st.positions.P1.r, st.positions.P1.c, GOAL_ROW, trial);
  var p2ok = bfsHasPath(st.positions.P2.r, st.positions.P2.c, GOAL_ROW, trial);
  return !(p1ok && p2ok);
}

/* ========================================================
 * HOST-SIDE ACTION PROCESSING (authoritative)
 * ======================================================== */
function symbolOf(pid) {
  var p = state.players.find(function (x) { return x.id === pid; });
  return p ? p.symbol : '';
}
function tryMove(symbol, dir) {
  if (state.phase !== 'playing') return { ok: false, reason: 'Bukan fase bermain.' };
  if (state.currentTurn !== symbol) return { ok: false, reason: 'Bukan giliranmu.' };
  if (['up', 'down', 'left', 'right'].indexOf(dir) === -1) return { ok: false, reason: 'Arah tidak valid.' };
  var wallSet = buildWallSet(state.walls);
  var pos = state.positions[symbol];
  if (isEdgeBlocked(wallSet, pos.r, pos.c, dir)) return { ok: false, reason: 'Jalan tertutup tembok.' };
  var t = stepTarget(pos.r, pos.c, dir);
  if (!inBounds(t.r, t.c)) return { ok: false, reason: 'Di luar papan.' };
  var oppSym = symbol === 'P1' ? 'P2' : 'P1';
  var opp = state.positions[oppSym];
  if (opp && opp.r === t.r && opp.c === t.c) return { ok: false, reason: 'Kotak diisi lawan.' };
  state.positions[symbol] = t;
  if (t.r === GOAL_ROW) { state.winner = symbol; state.phase = 'ended'; }
  else { state.currentTurn = oppSym; }
  return { ok: true };
}
function tryPlaceWall(symbol, orient, r, c) {
  if (state.phase !== 'playing') return { ok: false, reason: 'Bukan fase bermain.' };
  if (state.currentTurn !== symbol) return { ok: false, reason: 'Bukan giliranmu.' };
  if (orient !== 'H' && orient !== 'V') return { ok: false, reason: 'Posisi tembok tidak valid.' };
  if (!edgeInRange(orient, r, c)) return { ok: false, reason: 'Posisi tembok di luar papan.' };
  var wallSet = buildWallSet(state.walls);
  var key = (orient === 'H' ? 'h' : 'v') + r + '_' + c;
  if (wallSet.has(key)) return { ok: false, reason: 'Sudah ada tembok di posisi itu.' };
  if (wallWouldBlockPaths(state, orient, r, c)) return { ok: false, reason: '❌ Posisi tembok tidak valid. Jalur menuju finish harus tetap tersedia.' };
  state.walls.push({ orient: orient, r: r, c: c, by: symbol });
  state.currentTurn = symbol === 'P1' ? 'P2' : 'P1';
  return { ok: true };
}
function tryReady(symbol) {
  if (state.phase !== 'lobby') return { ok: false, reason: 'Tidak sedang menunggu kesiapan.' };
  if (state.players.length < 2) return { ok: false, reason: 'Menunggu pemain kedua.' };
  state.ready[symbol] = true;
  if (state.ready.P1 && state.ready.P2) {
    state.phase = 'rps';
    state.rps = { choices: { P1: null, P2: null }, round: 1, resultText: '' };
  }
  return { ok: true };
}
function tryRps(symbol, choice) {
  if (state.phase !== 'rps') return { ok: false, reason: 'Bukan fase RPS.' };
  if (['rock', 'paper', 'scissors'].indexOf(choice) === -1) return { ok: false, reason: 'Pilihan tidak valid.' };
  state.rps.choices[symbol] = choice;
  var c1 = state.rps.choices.P1, c2 = state.rps.choices.P2;
  if (c1 && c2) {
    if (c1 === c2) {
      state.rps.resultText = 'Seri! RPS diulang.';
      state.rps.choices = { P1: null, P2: null };
      state.rps.round++;
    } else {
      var beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
      var winnerSym = beats[c1] === c2 ? 'P1' : 'P2';
      state.currentTurn = winnerSym;
      state.phase = 'playing';
      state.rps.resultText = (winnerSym === 'P1' ? 'Player 1' : 'Player 2') + ' menang RPS, dapat giliran pertama!';
    }
  }
  return { ok: true };
}
function tryRematch(symbol) {
  if (state.phase !== 'ended') return { ok: false, reason: 'Game belum selesai.' };
  state.rematchVotes[symbol] = true;
  if (state.rematchVotes.P1 && state.rematchVotes.P2) {
    var keepPlayers = state.players, keepSpectators = state.spectators, hostId = state.hostId;
    state = defaultState();
    state.hostId = hostId;
    state.players = keepPlayers;
    state.spectators = keepSpectators;
    state.phase = 'rps';
    state.rps = { choices: { P1: null, P2: null }, round: 1, resultText: '' };
  }
  return { ok: true };
}
function processAction(symbol, action) {
  if (!action || !symbol) return { ok: false, reason: 'Aksi tidak valid.' };
  switch (action.type) {
    case 'MOVE': return tryMove(symbol, action.dir);
    case 'PLACE_WALL': return tryPlaceWall(symbol, action.orient, action.r, action.c);
    case 'READY': return tryReady(symbol);
    case 'RPS_CHOICE': return tryRps(symbol, action.choice);
    case 'REMATCH': return tryRematch(symbol);
    default: return { ok: false, reason: 'Aksi tidak dikenal.' };
  }
}

/* ========================================================
 * STATE / CONNECTION
 *
 * PENTING: hanya SATU koneksi WebSocket untuk seluruh app
 * (room + global chat + presence + name-claim berbagi soket
 * yang sama). Sebelumnya ada dua soket terpisah (room &
 * global) yang dibuka bersamaan -> boros kuota koneksi
 * concurrent di relay pub/sub gratis, jadi sering muncul
 * status "FAILED" dan akibatnya join room / chat jadi tidak
 * sinkron. Satu soket persisten yang dibuka sejak halaman
 * dimuat jauh lebih stabil.
 * ======================================================== */
var ws = null;
var room = '', playerName = '', mySymbol = '', isHost = false, state = null;
var manualLeave = false, reconnectTimer = null, reconnectAttempts = 0;
var uiMode = 'move', pendingWallEdge = null, loggedIn = false;
var pendingJoinRoom = '', joinTimeoutHandle = null, JOIN_TIMEOUT_MS = 9000;
var chatList = [], activeReply = null, chatPanelOpen = false, lastTurnSeen = '';
var globalChatList = [], globalActiveReply = null;
var PRESENCE_INTERVAL_MS = 12000, PRESENCE_STALE_MS = 32000;
var outbox = [];
var activeNames = new Map();
var pendingClaim = null;

function send(data) {
  var raw;
  try { raw = JSON.stringify(data); } catch (e) { return false; }
  if (!ws || ws.readyState !== WebSocket.OPEN) { outbox.push(raw); return false; }
  try { ws.send(raw); return true; } catch (e) { outbox.push(raw); return false; }
}
function flushOutbox() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  while (outbox.length) {
    var raw = outbox.shift();
    try { ws.send(raw); } catch (e) { outbox.unshift(raw); break; }
  }
}
function showToast(text, kind) {
  var node = document.createElement('div');
  node.className = 'toast' + (kind ? ' ' + kind : '');
  node.textContent = text;
  toastLayer.appendChild(node);
  setTimeout(function () { node.remove(); }, 3000);
}

/* ========================================================
 * END-GAME FX
 *
 * kind: 'win' | 'lose' | 'neutral'. Muter animasi dulu di
 * atas segalanya, baru setelah selesai memanggil cb() yang
 * membuka winOverlay statis (lihat render()).
 * ======================================================== */
var CONFETTI_COLORS_WIN = ['#ffe08a', '#ffb84d', '#7cf7ff', '#c9a8ff', '#ff9dd6', '#9dffb8'];
var SPARKLE_GLYPHS = ['✦', '✧', '⋆', '✨', '🌸', '💫'];

function spawnFxParticles(kind) {
  fxParticlesEl.innerHTML = '';
  fxEmbersEl.innerHTML = '';
  fxSparkleLayerEl.innerHTML = '';
  if (kind === 'neutral') return;

  if (kind === 'win') {
    /* round confetti dots, falling straight-ish with a gentle rotation */
    var nDots = 20;
    for (var i = 0; i < nDots; i++) {
      var p = document.createElement('div');
      p.className = 'fxParticle dot';
      var size = 4 + Math.random() * 6;
      p.style.width = size + 'px'; p.style.height = size + 'px';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDuration = (1.3 + Math.random() * 1.3) + 's';
      p.style.animationDelay = (Math.random() * 0.6) + 's';
      fxParticlesEl.appendChild(p);
    }
    /* rectangular confetti strips that tumble in 3D-ish arcs for more life */
    var nStrips = 22;
    for (var j = 0; j < nStrips; j++) {
      var s = document.createElement('div');
      s.className = 'fxParticle strip';
      var w = 5 + Math.random() * 4, h = 9 + Math.random() * 7;
      s.style.width = w + 'px'; s.style.height = h + 'px';
      s.style.left = Math.random() * 100 + '%';
      s.style.background = CONFETTI_COLORS_WIN[j % CONFETTI_COLORS_WIN.length];
      s.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
      s.style.animationDelay = (Math.random() * 0.7) + 's';
      fxParticlesEl.appendChild(s);
    }
    /* twinkling sparkle glyphs orbiting the win text */
    var nSpark = 10;
    for (var k = 0; k < nSpark; k++) {
      var sp = document.createElement('div');
      sp.className = 'fxSparkle';
      sp.textContent = SPARKLE_GLYPHS[k % SPARKLE_GLYPHS.length];
      var ang = (k / nSpark) * Math.PI * 2;
      var radius = 70 + Math.random() * 40;
      sp.style.left = 'calc(50% + ' + (Math.cos(ang) * radius) + 'px)';
      sp.style.top = (70 + Math.sin(ang) * radius * 0.6) + 'px';
      sp.style.animationDelay = (Math.random() * 1.3) + 's';
      fxSparkleLayerEl.appendChild(sp);
    }
  } else {
    /* muted falling dots (ash) */
    var nAsh = 12;
    for (var a = 0; a < nAsh; a++) {
      var pa = document.createElement('div');
      pa.className = 'fxParticle dot';
      var sizeA = 3 + Math.random() * 5;
      pa.style.width = sizeA + 'px'; pa.style.height = sizeA + 'px';
      pa.style.left = Math.random() * 100 + '%';
      pa.style.animationDuration = (1.3 + Math.random() * 1.3) + 's';
      pa.style.animationDelay = (Math.random() * 0.6) + 's';
      fxParticlesEl.appendChild(pa);
    }
    /* jagged debris shards drifting sideways as they fall */
    var nShard = 10;
    for (var d = 0; d < nShard; d++) {
      var sh = document.createElement('div');
      sh.className = 'fxParticle shard';
      var sw = 5 + Math.random() * 6, shh = 5 + Math.random() * 6;
      sh.style.width = sw + 'px'; sh.style.height = shh + 'px';
      sh.style.left = Math.random() * 100 + '%';
      sh.style.animationDuration = (1.1 + Math.random() * 1.1) + 's';
      sh.style.animationDelay = (Math.random() * 0.5) + 's';
      fxParticlesEl.appendChild(sh);
    }
    /* rising embers for a smoldering, defeated atmosphere */
    var nEmber = 16;
    for (var e = 0; e < nEmber; e++) {
      var em = document.createElement('div');
      em.className = 'fxEmber';
      var esize = 3 + Math.random() * 4;
      em.style.width = esize + 'px'; em.style.height = esize + 'px';
      em.style.left = (10 + Math.random() * 80) + '%';
      em.style.animationDuration = (1.6 + Math.random() * 1.2) + 's';
      em.style.animationDelay = (Math.random() * 0.8) + 's';
      fxEmbersEl.appendChild(em);
    }
  }
}

function playEndGameFx(kind, winnerName, cb) {
  fxOverlay.className = 'overlay ' + kind;
  fxIcon.textContent = kind === 'win' ? '🏆' : (kind === 'lose' ? '💥' : '🏁');
  fxText.textContent = kind === 'win' ? 'MENANG!' : (kind === 'lose' ? 'KALAH...' : 'PERMAINAN SELESAI');
  fxSub.textContent = kind === 'win' ? 'Kerja bagus! ⭐' : (kind === 'lose' ? (winnerName || 'Lawan') + ' berhasil mencapai FINISH lebih dulu.' : '');
  spawnFxParticles(kind);
  requestAnimationFrame(function () { fxOverlay.classList.add('show'); });
  var duration = kind === 'neutral' ? 900 : 2600;
  setTimeout(function () {
    fxOverlay.classList.remove('show');
    setTimeout(function () {
      fxOverlay.className = 'overlay hidden';
      fxParticlesEl.innerHTML = '';
      fxEmbersEl.innerHTML = '';
      fxSparkleLayerEl.innerHTML = '';
      if (cb) cb();
    }, 400);
  }, duration);
}
function setConnection(type, text) {
  connDot.className = 'dot' + (type ? ' ' + type : '');
  connText.textContent = text;
  connDotG.className = 'dot' + (type ? ' ' + type : '');
  connTextG.textContent = text;
}
function randomRoom() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '';
  for (var i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function escapeHtmlClient(t) {
  return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---- unified connection, dibuka sejak awal dan tetap hidup ---- */
var lastDiagToastAt = 0;
function diagToast(text) {
  var now = Date.now();
  if (now - lastDiagToastAt < 20000) return;
  lastDiagToastAt = now;
  showToast(text, 'error');
}
function connect() {
  if (ws) { try { ws.close(); } catch (e) {} }
  setConnection('', 'CONNECTING');
  try {
    ws = new WebSocket(WS_URL);
    ws.onopen = function () {
      reconnectAttempts = 0;
      setConnection('online', 'ONLINE');
      flushOutbox();
      if (loggedIn) sendNamePresence();
      if (room) {
        send({ type: 'qmp_join', room: room, playerId: playerId, name: playerName, host: isHost });
        if (isHost && state) broadcastState();
      }
    };
    ws.onmessage = function (event) {
      var data;
      try { data = JSON.parse(event.data); } catch (e) { return; }
      handleMessage(data);
    };
    ws.onerror = function () { setConnection('error', 'ERROR'); };
    ws.onclose = function (ev) {
      var code = ev && typeof ev.code === 'number' ? ev.code : 0;
      setConnection('error', code ? ('CLOSED ' + code) : 'CLOSED');
      if (!manualLeave) {
        if (room) statusText.textContent = 'Koneksi terputus. Mencoba menyambung ulang...';
        diagToast('Server realtime menutup koneksi' + (code ? ' (kode ' + code + ')' : '') + '. Cek kuota/API key WS_URL kalau ini terus berulang.');
        scheduleReconnect();
      }
    };
  } catch (e) {
    setConnection('error', 'FAILED');
    diagToast('WebSocket gagal dibuat: ' + (e && e.message ? e.message : 'penyebab tidak diketahui'));
    scheduleReconnect();
  }
}
function scheduleReconnect() {
  if (reconnectTimer) return;
  var delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
  reconnectAttempts++;
  reconnectTimer = setTimeout(function () { reconnectTimer = null; connect(); }, delay);
}

/* ========================================================
 * MESSAGE HANDLING
 * ======================================================== */
function handleMessage(data) {
  if (!data || !data.type) return;
  if (data.type === 'qmp_presence') { handlePresence(data); return; }
  if (data.type === 'qmp_name_claim') { handleNameClaim(data); return; }
  if (data.type === 'qmp_global_chat' || data.type === 'qmp_global_sticker') { handleGlobalChat(data); return; }
  if (!room || data.room !== room) return;
  switch (data.type) {
    case 'qmp_join': if (isHost) handleJoin(data); break;
    case 'qmp_joined': if (data.targetPlayerId === playerId) handleJoinedAck(data); break;
    case 'qmp_state': setState(data.state); break;
    case 'qmp_action': if (isHost) handleAction(data); break;
    case 'qmp_reject': if (data.targetPlayerId === playerId) showToast(data.reason || 'Aksi ditolak.', 'error'); break;
    case 'qmp_chat': handleChat(data); break;
    case 'qmp_sticker': handleChat(data); break;
    case 'qmp_ping': if (isHost) handlePing(data); break;
    case 'qmp_leave': if (isHost) handleLeaveMsg(data); break;
    case 'qmp_rematch_ping': handleRematchPing(data); break;
  }
}
function handleJoin(data) {
  var existing = state.players.find(function (p) { return p.id === data.playerId; });
  if (existing) {
    existing.connected = true; existing.lastSeen = Date.now();
    existing.name = data.name || existing.name;
    sendJoinedAck(data.playerId, existing.symbol);
    broadcastState();
    return;
  }
  var existingSpec = state.spectators.find(function (s) { return s.id === data.playerId; });
  if (existingSpec) {
    existingSpec.connected = true; existingSpec.lastSeen = Date.now();
    sendJoinedAck(data.playerId, '');
    broadcastState();
    return;
  }
  if (state.players.length < 2) {
    var symbol = state.players.some(function (p) { return p.symbol === 'P1'; }) ? 'P2' : 'P1';
    state.players.push({ id: data.playerId, name: data.name || 'Player', symbol: symbol, connected: true, lastSeen: Date.now() });
    sendJoinedAck(data.playerId, symbol);
  } else {
    state.spectators.push({ id: data.playerId, name: data.name || 'Penonton', connected: true, lastSeen: Date.now() });
    sendJoinedAck(data.playerId, '');
  }
  broadcastState();
}
function sendJoinedAck(targetPlayerId, symbol) {
  send({ type: 'qmp_joined', room: room, targetPlayerId: targetPlayerId, symbol: symbol });
}
function handleJoinedAck(data) {
  mySymbol = data.symbol || '';
  pendingJoinRoom = '';
  if (joinTimeoutHandle) { clearTimeout(joinTimeoutHandle); joinTimeoutHandle = null; }
  if (joinError) joinError.textContent = '';
  showPage('room');
}
function handleAction(data) {
  var symbol = symbolOf(data.playerId);
  if (!symbol) { send({ type: 'qmp_reject', room: room, targetPlayerId: data.playerId, reason: 'Kamu penonton, tidak bisa beraksi.' }); return; }
  var p = state.players.find(function (x) { return x.id === data.playerId; });
  if (p) { p.connected = true; p.lastSeen = Date.now(); }
  var result = processAction(symbol, data.action);
  if (!result.ok) { send({ type: 'qmp_reject', room: room, targetPlayerId: data.playerId, reason: result.reason }); return; }
  broadcastState();
}
function handlePing(data) {
  var p = state.players.find(function (x) { return x.id === data.playerId; });
  if (p) { p.connected = true; p.lastSeen = Date.now(); return; }
  var s = state.spectators.find(function (x) { return x.id === data.playerId; });
  if (s) { s.connected = true; s.lastSeen = Date.now(); }
}
function handleLeaveMsg(data) {
  var beforeP = state.players.length, beforeS = state.spectators.length;
  var leavingPlayer = state.players.find(function (p) { return p.id === data.playerId; });
  state.players = state.players.filter(function (p) { return p.id !== data.playerId; });
  state.spectators = state.spectators.filter(function (s) { return s.id !== data.playerId; });
  /* fallback: kalau pemain keluar mendadak (mis. tutup tab lewat
   * beforeunload) tanpa sempat broadcast 'ended' sendiri, host yang
   * masih ada di sini yang otomatis mengakhiri game supaya lawan
   * tidak menunggu terus */
  if (leavingPlayer && state.phase !== 'ended' && (state.phase === 'playing' || state.phase === 'rps') && state.players.length === 1) {
    state.phase = 'ended';
    state.winner = state.players[0].symbol;
    state.endReason = 'opponent_left';
  }
  if (state.players.length !== beforeP || state.spectators.length !== beforeS || state.phase === 'ended') broadcastState();
}
function broadcastState() { send({ type: 'qmp_state', room: room, state: state }); }
function setState(newState) { state = newState; render(); }

/* qmp_rematch_ping: pesan ringan terpisah dari qmp_state, dikirim TIAP
 * kali tombol REMATCH ditekan (termasuk pengingat berulang setelah
 * cooldown) supaya lawan selalu dapat notifikasi baru, bukan cuma
 * sekali di vote pertama. Tidak host-only karena semua client yang
 * ada di room yang sama boleh langsung menampilkan toast-nya. */
function handleRematchPing(data) {
  if (!data || data.playerId === playerId) return;
  if (!mySymbol || state && state.phase !== 'ended') return;
  showToast('🔄 ' + (data.name || 'Lawan') + ' ingin kamu untuk REMATCH!', 'success');
}

/* presence: heartbeat + host-side prune (room) */
function sendPresenceHeartbeat() {
  if (!room) return;
  send({ type: 'qmp_ping', room: room, playerId: playerId });
}
setInterval(sendPresenceHeartbeat, PRESENCE_INTERVAL_MS);
function prunePresence() {
  if (!isHost || !state) return;
  var now = Date.now(), changed = false;
  state.players.forEach(function (p) {
    var stale = p.lastSeen && (now - p.lastSeen > PRESENCE_STALE_MS);
    if (stale && p.connected) { p.connected = false; changed = true; }
  });
  var beforeS = state.spectators.length;
  state.spectators = state.spectators.filter(function (s) { return !s.lastSeen || now - s.lastSeen <= PRESENCE_STALE_MS; });
  if (state.spectators.length !== beforeS) changed = true;
  if (changed) broadcastState();
}
setInterval(prunePresence, PRESENCE_INTERVAL_MS);

/* ========================================================
 * NAME PRESENCE / NAME CLAIM (anti nama-kembar)
 *
 * Karena tidak ada backend terpusat, "siapa pakai nama apa"
 * dicek secara terdistribusi: tiap client yang sudah login
 * broadcast qmp_presence berkala, dan semua client (termasuk
 * yang belum login) mendengarkan itu sejak awal buat mengisi
 * tabel nama aktif. Saat MASUK ditekan, kita cek tabel lokal
 * dulu, lalu broadcast qmp_name_claim dan tunggu sebentar
 * untuk menangani race (dua orang menekan MASUK nyaris
 * bersamaan) dengan tie-break timestamp+nonce.
 * ======================================================== */
function nameKey(name) { return String(name || '').trim().toLowerCase(); }
function handlePresence(data) {
  if (!data.playerId || !data.name) return;
  var key = nameKey(data.name);
  var cur = activeNames.get(key);
  if (!cur || cur.playerId === data.playerId || (data.ts || 0) >= cur.ts) {
    activeNames.set(key, { playerId: data.playerId, name: data.name, ts: data.ts || Date.now() });
  }
}
function purgeStaleNames() {
  var now = Date.now();
  activeNames.forEach(function (v, k) { if (v.playerId !== playerId && now - v.ts > PRESENCE_STALE_MS) activeNames.delete(k); });
}
setInterval(purgeStaleNames, PRESENCE_INTERVAL_MS);
function sendNamePresence() {
  if (!loggedIn) return;
  send({ type: 'qmp_presence', playerId: playerId, name: playerName, ts: Date.now() });
}
setInterval(sendNamePresence, PRESENCE_INTERVAL_MS);
function handleNameClaim(data) {
  if (!data.name || !data.playerId || data.playerId === playerId) return;
  var key = nameKey(data.name);
  if (!activeNames.has(key)) activeNames.set(key, { playerId: data.playerId, name: data.name, ts: data.ts || Date.now() });
  if (pendingClaim && pendingClaim.key === key) {
    var theirTs = data.ts || 0, theirNonce = data.nonce || '';
    var mineWins = pendingClaim.ts < theirTs || (pendingClaim.ts === theirTs && pendingClaim.nonce < theirNonce);
    if (!mineWins) pendingClaim.wonBy = data.playerId;
  }
  /* PERTAHANAN AKTIF: kalau nama yang baru diklaim itu adalah nama yang
     SUDAH kupakai (aku sudah login duluan), langsung balas klaim dengan
     ts=0 supaya selalu menang tie-break -- gak perlu nunggu heartbeat
     periodik 12 detik buat nolak nama kembar. Ini nutup celah dimana
     orang kedua login lebih cepat dari siklus presence orang pertama. */
  if (loggedIn && nameKey(playerName) === key) {
    send({ type: 'qmp_name_claim', playerId: playerId, name: playerName, ts: 0, nonce: '' });
  }
}

/* ========================================================
 * LOGIN / NAVIGATION
 * ======================================================== */
function performLogin() {
  var v = String(nameInput.value || '').trim().slice(0, 20);
  loginError.textContent = '';
  if (!v) { loginError.textContent = 'Masukkan nama kamu.'; nameInput.focus(); return; }
  if (v.length < 2) { loginError.textContent = 'Nama minimal 2 karakter.'; return; }
  purgeStaleNames();
  var key = nameKey(v);
  var existing = activeNames.get(key);
  if (existing && existing.playerId !== playerId) {
    loginError.textContent = 'Nama "' + v + '" sedang dipakai pemain lain. Pilih nama lain.';
    return;
  }
  btnLogin.disabled = true;
  btnLogin.textContent = 'MEMERIKSA NAMA...';
  var myTs = Date.now();
  var myNonce = Math.random().toString(36).slice(2);
  pendingClaim = { key: key, ts: myTs, nonce: myNonce, wonBy: null };
  send({ type: 'qmp_name_claim', playerId: playerId, name: v, ts: myTs, nonce: myNonce });
  setTimeout(function () {
    var claim = pendingClaim;
    pendingClaim = null;
    btnLogin.disabled = false;
    btnLogin.textContent = 'MASUK';
    if (claim && claim.wonBy && claim.wonBy !== playerId) {
      loginError.textContent = 'Nama "' + v + '" baru saja dipakai pemain lain. Pilih nama lain.';
      return;
    }
    finishLogin(v);
  }, 900);
}
function finishLogin(v) {
  playerName = v;
  loggedIn = true;
  activeNames.set(nameKey(v), { playerId: playerId, name: v, ts: Date.now() });
  whoAmI.textContent = 'Masuk sebagai: ' + v;
  showPage('home');
  sendNamePresence();
}
btnLogin.onclick = function () { performLogin(); };
nameInput.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') performLogin(); });

function showPage(name) {
  pageLogin.classList.add('hidden');
  pageHome.classList.add('hidden');
  pageRoom.classList.add('hidden');
  if (name === 'login') pageLogin.classList.remove('hidden');
  if (name === 'home') pageHome.classList.remove('hidden');
  if (name === 'room') pageRoom.classList.remove('hidden');
}

btnBackHome.onclick = function () {
  send({ type: 'qmp_leave', room: room, playerId: playerId });
  room = ''; state = null; mySymbol = ''; isHost = false;
  showPage('home');
};

/* ========================================================
 * ROOM CREATE / JOIN
 *
 * Soket sudah tersambung sejak awal (lihat START), jadi di
 * sini kita TIDAK membuka koneksi baru -- cukup kirim
 * qmp_join lewat soket yang ada. Kalau soket kebetulan lagi
 * reconnect, send() otomatis menampung pesan di outbox dan
 * mengirim ulang begitu ONLINE lagi.
 * ======================================================== */
btnCreate.onclick = function () {
  room = randomRoom();
  mySymbol = 'P1'; isHost = true; uiMode = 'move';
  state = defaultState();
  state.hostId = playerId;
  state.players.push({ id: playerId, name: playerName, symbol: 'P1', connected: true, lastSeen: Date.now() });
  roomCodeText.textContent = room;
  showPage('room');
  chatList = [];
  render();
  send({ type: 'qmp_join', room: room, playerId: playerId, name: playerName, host: true });
  broadcastState();
};

function doJoinRoom(code) {
  joinError.textContent = '';
  code = String(code || '').trim().toUpperCase().slice(0, 6);
  if (!code) { joinError.textContent = 'Masukkan kode room.'; return; }
  if (room) { showToast('Kamu sedang di dalam room lain.', 'error'); return; }
  room = code; mySymbol = ''; isHost = false; state = null; uiMode = 'move'; chatList = [];
  roomCodeText.textContent = room;
  pendingJoinRoom = room;
  if (joinTimeoutHandle) clearTimeout(joinTimeoutHandle);
  joinTimeoutHandle = setTimeout(function () {
    joinTimeoutHandle = null;
    if (pendingJoinRoom !== room) return;
    pendingJoinRoom = '';
    joinError.textContent = 'Kode room tidak ditemukan, room sudah tidak aktif, atau host sedang offline. Coba lagi.';
    room = ''; state = null;
  }, JOIN_TIMEOUT_MS);
  send({ type: 'qmp_join', room: room, playerId: playerId, name: playerName, host: false });
}
btnJoin.onclick = function () { doJoinRoom(joinInput.value); };

function legacyCopyText(text) {
  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    ta.setSelectionRange(0, text.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}
function copyToClipboard(text) {
  return new Promise(function (resolve, reject) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(resolve).catch(function () {
        legacyCopyText(text) ? resolve() : reject();
      });
    } else {
      legacyCopyText(text) ? resolve() : reject();
    }
  });
}
btnCopyCode.onclick = function () {
  copyToClipboard(room).then(function () {
    showToast('Kode room disalin!', 'success');
  }).catch(function () {
    showToast('Gagal menyalin otomatis. Kode room: ' + room, 'error');
  });
};
var SHARE_COOLDOWN_MS = 15000;
var lastShareCodeAt = 0, shareCooldownHandle = null;
btnShareCode.onclick = function () {
  if (!room) return;
  var remain = SHARE_COOLDOWN_MS - (Date.now() - lastShareCodeAt);
  if (remain > 0) {
    showToast('Tunggu ' + Math.ceil(remain / 1000) + ' detik lagi sebelum kirim ulang.', 'error');
    return;
  }
  var msg = {
    type: 'qmp_global_chat', id: 'g_' + Math.random().toString(36).slice(2),
    playerId: playerId, name: playerName || 'Player',
    text: 'Yuk main QuoridorMP bareng aku! Kode room: ' + room, replyTo: null, ts: Date.now(),
    roomCode: room
  };
  send(msg);
  showToast('Kode room dikirim ke Global Chat!', 'success');
  lastShareCodeAt = Date.now();
  startShareCooldownUI();
};
function startShareCooldownUI() {
  btnShareCode.disabled = true;
  if (shareCooldownHandle) clearInterval(shareCooldownHandle);
  shareCooldownHandle = setInterval(function () {
    var left = Math.ceil((SHARE_COOLDOWN_MS - (Date.now() - lastShareCodeAt)) / 1000);
    if (left <= 0) {
      clearInterval(shareCooldownHandle);
      shareCooldownHandle = null;
      btnShareCode.disabled = false;
      btnShareCode.textContent = 'KIRIM KE GLOBAL';
      return;
    }
    btnShareCode.textContent = 'TUNGGU ' + left + 'S';
  }, 250);
}

/* ========================================================
 * KELUAR ROOM (Home & Keluar tombolnya sama-sama lewat sini)
 *
 * Kalau game masih berlangsung (phase 'playing'/'rps') saat
 * pemain keluar, kita langsung broadcast state 'ended' DI SINI
 * -- bukan cuma kirim qmp_leave lalu berharap host lain yang
 * proses -- karena kalau yang keluar itu justru si host, tidak
 * ada lagi yang memproses qmp_leave (host-only) setelah local
 * state di-reset, jadi lawan bisa nunggu tanpa batas. Broadcast
 * langsung ini aman dipakai baik oleh host maupun non-host.
 * ======================================================== */
function doLeaveRoom() {
  if (room && state && mySymbol && (state.phase === 'playing' || state.phase === 'rps')) {
    var oppSymbol = mySymbol === 'P1' ? 'P2' : 'P1';
    var stillHasOpponent = state.players.some(function (p) { return p.symbol === oppSymbol; });
    if (stillHasOpponent) {
      state.players = state.players.filter(function (p) { return p.id !== playerId; });
      state.phase = 'ended';
      state.winner = oppSymbol;
      state.endReason = 'opponent_left';
      broadcastState();
    }
  }
  send({ type: 'qmp_leave', room: room, playerId: playerId });
  room = ''; state = null; mySymbol = ''; isHost = false;
  showPage('home');
}
function askLeaveRoom() {
  var inGame = state && mySymbol && (state.phase === 'playing' || state.phase === 'rps');
  confirmLeaveTitle.textContent = inGame ? 'Permainan Masih Berlangsung' : 'Keluar dari Room?';
  confirmLeaveMsg.textContent = inGame
    ? 'Permainan akan otomatis diakhiri dan lawan kamu dinyatakan menang kalau kamu keluar sekarang. Yakin ingin keluar?'
    : 'Yakin ingin keluar dari room ini?';
  confirmLeaveOverlay.classList.remove('hidden');
}
btnConfirmLeaveYes.onclick = function () {
  confirmLeaveOverlay.classList.add('hidden');
  doLeaveRoom();
};
btnConfirmLeaveNo.onclick = function () {
  confirmLeaveOverlay.classList.add('hidden');
};

btnBackHome.onclick = askLeaveRoom;
btnLeaveRoom.onclick = askLeaveRoom;
btnExitRoom.onclick = function () { doLeaveRoom(); };

/* ========================================================
 * READY / MODE / MOVE / WALL / RPS / REMATCH
 * ======================================================== */
btnReady.onclick = function () { send({ type: 'qmp_action', room: room, playerId: playerId, action: { type: 'READY' } }); };
btnModeMove.onclick = function () { uiMode = 'move'; pendingWallEdge = null; render(); };
btnModeWall.onclick = function () {
  if (!mySymbol || !state) return;
  uiMode = 'wall'; pendingWallEdge = null; render();
};
function sendMove(dir) { send({ type: 'qmp_action', room: room, playerId: playerId, action: { type: 'MOVE', dir: dir } }); }
dirUp.onclick = function () { sendMove('up'); };
dirDown.onclick = function () { sendMove('down'); };
dirLeft.onclick = function () { sendMove('left'); };
dirRight.onclick = function () { sendMove('right'); };
btnConfirmWall.onclick = function () {
  if (!pendingWallEdge) return;
  send({ type: 'qmp_action', room: room, playerId: playerId, action: { type: 'PLACE_WALL', orient: pendingWallEdge.orient, r: pendingWallEdge.r, c: pendingWallEdge.c } });
  pendingWallEdge = null; render();
};
btnCancelWall.onclick = function () { pendingWallEdge = null; render(); };
rpsRock.onclick = function () { sendRps('rock'); };
rpsPaper.onclick = function () { sendRps('paper'); };
rpsScissors.onclick = function () { sendRps('scissors'); };
function sendRps(choice) { send({ type: 'qmp_action', room: room, playerId: playerId, action: { type: 'RPS_CHOICE', choice: choice } }); }
btnRematch.onclick = function () {
  if (btnRematch.disabled) return;
  send({ type: 'qmp_action', room: room, playerId: playerId, action: { type: 'REMATCH' } });
  send({ type: 'qmp_rematch_ping', room: room, playerId: playerId, name: playerName || 'Player', ts: Date.now() });
  rematchCooldownUntil = Date.now() + REMATCH_COOLDOWN_MS;
  if (rematchCooldownHandle) clearInterval(rematchCooldownHandle);
  rematchCooldownHandle = setInterval(function () {
    if (Date.now() >= rematchCooldownUntil) {
      clearInterval(rematchCooldownHandle);
      rematchCooldownHandle = null;
    }
    render();
  }, 250);
  render();
};

/* ========================================================
 * ROOM CHAT
 * ======================================================== */
btnToggleChat.onclick = function () {
  chatPanelOpen = !chatPanelOpen;
  chatPanel.classList.toggle('hidden', !chatPanelOpen);
  if (chatPanelOpen) { chatUnread.classList.add('hidden'); chatUnread.textContent = '0'; scrollChatBottom(chatMessages); }
};
function handleChat(data) {
  chatList.push(data);
  if (chatList.length > 200) chatList.shift();
  renderChat();
  if (!chatPanelOpen && data.playerId !== playerId) {
    var n = (parseInt(chatUnread.textContent, 10) || 0) + 1;
    chatUnread.textContent = String(n);
    chatUnread.classList.remove('hidden');
  }
}
btnSendChat.onclick = function () { doSendChat(); };
chatInput.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') doSendChat(); });
function doSendChat() {
  var text = String(chatInput.value || '').trim();
  if (!text || !room) return;
  var msg = { type: 'qmp_chat', room: room, playerId: playerId, name: playerName || 'Player',
    id: 'm_' + Math.random().toString(36).slice(2), text: text.slice(0, 300), replyTo: activeReply, ts: Date.now() };
  send(msg);
  chatInput.value = ''; activeReply = null; renderReplyBar();
}
function setActiveReply(msg) {
  var preview = msg.stickerId ? '[Sticker]' : String(msg.text || '').slice(0, 60);
  activeReply = { name: msg.name, text: preview };
  renderReplyBar();
}
function renderReplyBar() {
  if (!activeReply) { replyBar.classList.add('hidden'); replyBar.innerHTML = ''; return; }
  replyBar.classList.remove('hidden');
  replyBar.innerHTML = '<span>Balas ' + escapeHtmlClient(activeReply.name) + ': ' + escapeHtmlClient(activeReply.text) + '</span><button id="btnCancelReply">✕</button>';
  $('btnCancelReply').onclick = function () { activeReply = null; renderReplyBar(); };
}
function renderChat() {
  var html = '';
  chatList.forEach(function (m) {
    html += '<div class="msgRow"><div class="chatMsg" data-id="' + m.id + '">';
    if (m.replyTo) html += '<div class="quote">' + escapeHtmlClient(m.replyTo.name) + ': ' + escapeHtmlClient(m.replyTo.text) + '</div>';
    html += '<div class="who">' + escapeHtmlClient(m.name) + '</div>';
    if (m.type === 'qmp_sticker') {
      var url = getStickerUrl(m.stickerId);
      html += url ? '<img class="stickerImg" src="' + url + '">' : '<div class="txt">[Sticker]</div>';
    } else {
      html += '<div class="txt">' + escapeHtmlClient(m.text) + '</div>';
    }
    html += '</div><button class="replyMini" data-id="' + m.id + '">↩</button></div>';
  });
  chatMessages.innerHTML = html;
  chatMessages.querySelectorAll('.replyMini').forEach(function (btn) {
    btn.onclick = function () {
      var found = chatList.find(function (x) { return x.id === btn.getAttribute('data-id'); });
      if (found) setActiveReply(found);
    };
  });
  scrollChatBottom(chatMessages);
}
function scrollChatBottom(el) { el.scrollTop = el.scrollHeight; }

/* room sticker panel */
btnRoomSticker.onclick = function () { roomStickerPanel.classList.toggle('show'); };
function buildStickerPanel(panelEl, sendFn) {
  var html = '';
  STICKERS.forEach(function (s) { html += '<img data-id="' + s.id + '" src="' + s.url + '">'; });
  panelEl.innerHTML = html;
  panelEl.querySelectorAll('img').forEach(function (img) {
    img.onclick = function () { sendFn(img.getAttribute('data-id')); panelEl.classList.remove('show'); };
  });
}
buildStickerPanel(roomStickerPanel, function (stickerId) {
  if (!room) return;
  var msg = { type: 'qmp_sticker', room: room, playerId: playerId, name: playerName || 'Player',
    id: 'm_' + Math.random().toString(36).slice(2), stickerId: stickerId, replyTo: activeReply, ts: Date.now() };
  send(msg);
  activeReply = null; renderReplyBar();
});

/* ========================================================
 * GLOBAL CHAT
 * ======================================================== */
function handleGlobalChat(data) {
  globalChatList.push(data);
  if (globalChatList.length > 200) globalChatList.shift();
  renderGlobalChat();
}
btnGlobalSend.onclick = function () { doSendGlobalChat(); };
globalChatInput.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') doSendGlobalChat(); });
function doSendGlobalChat() {
  var text = String(globalChatInput.value || '').trim();
  if (!text) return;
  var msg = { type: 'qmp_global_chat', id: 'g_' + Math.random().toString(36).slice(2),
    playerId: playerId, name: playerName || 'Player', text: text.slice(0, 300), replyTo: globalActiveReply, ts: Date.now() };
  send(msg);
  globalChatInput.value = ''; globalActiveReply = null; renderGlobalReplyBar();
}
function setGlobalActiveReply(msg) {
  var preview = msg.stickerId ? '[Sticker]' : String(msg.text || '').slice(0, 60);
  globalActiveReply = { name: msg.name, text: preview };
  renderGlobalReplyBar();
}
function renderGlobalReplyBar() {
  if (!globalActiveReply) { globalReplyBar.classList.add('hidden'); globalReplyBar.innerHTML = ''; return; }
  globalReplyBar.classList.remove('hidden');
  globalReplyBar.innerHTML = '<span>Balas ' + escapeHtmlClient(globalActiveReply.name) + ': ' + escapeHtmlClient(globalActiveReply.text) + '</span><button id="btnCancelGReply">✕</button>';
  $('btnCancelGReply').onclick = function () { globalActiveReply = null; renderGlobalReplyBar(); };
}
function renderGlobalChat() {
  var html = '';
  globalChatList.forEach(function (m) {
    html += '<div class="msgRow"><div class="chatMsg" data-id="' + m.id + '">';
    if (m.replyTo) html += '<div class="quote">' + escapeHtmlClient(m.replyTo.name) + ': ' + escapeHtmlClient(m.replyTo.text) + '</div>';
    html += '<div class="who">' + escapeHtmlClient(m.name) + '</div>';
    if (m.type === 'qmp_global_sticker') {
      var url = getStickerUrl(m.stickerId);
      html += url ? '<img class="stickerImg" src="' + url + '">' : '<div class="txt">[Sticker]</div>';
    } else {
      html += '<div class="txt">' + escapeHtmlClient(m.text) + '</div>';
    }
    if (m.roomCode) {
      html += '<button class="joinRoomBtn" data-room="' + escapeHtmlClient(m.roomCode) + '">🎮 JOIN ROOM ' + escapeHtmlClient(m.roomCode) + '</button>';
    }
    html += '</div><button class="replyMini" data-id="' + m.id + '">↩</button></div>';
  });
  globalChatMessages.innerHTML = html;
  globalChatMessages.querySelectorAll('.replyMini').forEach(function (btn) {
    btn.onclick = function () {
      var found = globalChatList.find(function (x) { return x.id === btn.getAttribute('data-id'); });
      if (found) setGlobalActiveReply(found);
    };
  });
  globalChatMessages.querySelectorAll('.joinRoomBtn').forEach(function (btn) {
    btn.onclick = function () { doJoinRoom(btn.getAttribute('data-room')); };
  });
  scrollChatBottom(globalChatMessages);
}
btnGlobalSticker.onclick = function () { globalStickerPanel.classList.toggle('show'); };
buildStickerPanel(globalStickerPanel, function (stickerId) {
  var msg = { type: 'qmp_global_sticker', id: 'g_' + Math.random().toString(36).slice(2),
    playerId: playerId, name: playerName || 'Player', stickerId: stickerId, replyTo: globalActiveReply, ts: Date.now() };
  send(msg);
  globalActiveReply = null; renderGlobalReplyBar();
});

/* ========================================================
 * RENDER: BOARD
 * ======================================================== */
function trackList() {
  var tracks = [];
  for (var i = 0; i < SIZE; i++) { tracks.push(CELL_PX + 'px'); if (i < SIZE - 1) tracks.push(WALL_PX + 'px'); }
  return tracks.join(' ');
}
function renderBoard() {
  if (!state) { boardGrid.innerHTML = ''; return; }
  boardGrid.style.gridTemplateColumns = trackList();
  boardGrid.style.gridTemplateRows = trackList();
  var wallSet = buildWallSet(state.walls);
  var canAct = mySymbol && state.phase === 'playing' && state.currentTurn === mySymbol;
  var html = '';
  var tracks = SIZE * 2 - 1;
  for (var i = 0; i < tracks; i++) {
    for (var j = 0; j < tracks; j++) {
      if (i % 2 === 0 && j % 2 === 0) {
        var r = i / 2, c = j / 2;
        var cls = 'cell';
        if (r === GOAL_ROW) cls += ' goalRow';
        if (r === START_ROW) cls += ' startRow';
        var token = '';
        if (state.positions.P1.r === r && state.positions.P1.c === c) token = '🔵';
        if (state.positions.P2.r === r && state.positions.P2.c === c) token = token ? token : '🔴';
        html += '<div class="' + cls + '" style="grid-column:' + (j + 1) + ';grid-row:' + (i + 1) + '">' + token + '</div>';
      } else if (i % 2 === 1 && j % 2 === 0) {
        var er = (i - 1) / 2, ec = j / 2;
        var on = wallSet.has('h' + er + '_' + ec);
        var isPreview = pendingWallEdge && pendingWallEdge.orient === 'H' && pendingWallEdge.r === er && pendingWallEdge.c === ec;
        var clickable = uiMode === 'wall' && canAct;
        var wcls = 'wallSlotH' + (on ? ' on' : '') + (isPreview ? ' preview' : '') + (clickable && !on ? ' clickable' : '');
        html += '<div class="' + wcls + '" data-orient="H" data-r="' + er + '" data-c="' + ec + '" style="grid-column:' + (j + 1) + ';grid-row:' + (i + 1) + '"></div>';
      } else if (i % 2 === 0 && j % 2 === 1) {
        var er2 = i / 2, ec2 = (j - 1) / 2;
        var on2 = wallSet.has('v' + er2 + '_' + ec2);
        var isPreview2 = pendingWallEdge && pendingWallEdge.orient === 'V' && pendingWallEdge.r === er2 && pendingWallEdge.c === ec2;
        var clickable2 = uiMode === 'wall' && canAct;
        var vcls = 'wallSlotV' + (on2 ? ' on' : '') + (isPreview2 ? ' preview' : '') + (clickable2 && !on2 ? ' clickable' : '');
        html += '<div class="' + vcls + '" data-orient="V" data-r="' + er2 + '" data-c="' + ec2 + '" style="grid-column:' + (j + 1) + ';grid-row:' + (i + 1) + '"></div>';
      } else {
        html += '<div class="corner" style="grid-column:' + (j + 1) + ';grid-row:' + (i + 1) + '"></div>';
      }
    }
  }
  boardGrid.innerHTML = html;
  if (uiMode === 'wall' && canAct) {
    boardGrid.querySelectorAll('.wallSlotH.clickable, .wallSlotV.clickable').forEach(function (slot) {
      slot.onclick = function () {
        pendingWallEdge = { orient: this.getAttribute('data-orient'), r: parseInt(this.getAttribute('data-r'), 10), c: parseInt(this.getAttribute('data-c'), 10) };
        render();
      };
    });
  }
}

/* ========================================================
 * RENDER: ROOT
 * ======================================================== */
function render() {
  if (!state) return;
  roomCodeText.textContent = room;
  var p1 = state.players.find(function (p) { return p.symbol === 'P1'; });
  var p2 = state.players.find(function (p) { return p.symbol === 'P2'; });
  var hostP = state.players.find(function (p) { return p.id === state.hostId; });
  hostInfo.textContent = 'Host: ' + (hostP ? hostP.name : '-');
  var specN = state.spectators.length;
  specCount.classList.toggle('hidden', specN === 0);
  specCount.textContent = '👁 ' + specN + ' penonton menonton';

  nameP1.textContent = (p1 ? p1.name : '-') + (p1 && !p1.connected ? ' (offline)' : '');
  nameP2.textContent = (p2 ? p2.name : '-') + (p2 && !p2.connected ? ' (offline)' : '');
  readyDotP1.classList.toggle('on', !!state.ready.P1);
  readyDotP2.classList.toggle('on', !!state.ready.P2);
  metaP1.textContent = state.phase === 'lobby' ? (state.ready.P1 ? 'siap' : 'menunggu') : (p1 ? 'online' : '-');
  metaP2.textContent = state.phase === 'lobby' ? (state.ready.P2 ? 'siap' : 'menunggu') : (p2 ? 'online' : '-');
  wallsP1.textContent = wallsPlacedBy('P1', state);
  wallsP2.textContent = wallsPlacedBy('P2', state);
  cardP1.classList.toggle('turn', state.phase === 'playing' && state.currentTurn === 'P1');
  cardP2.classList.toggle('turn', state.phase === 'playing' && state.currentTurn === 'P2');
  turnPillP1.classList.toggle('show', state.phase === 'playing' && state.currentTurn === 'P1');
  turnPillP2.classList.toggle('show', state.phase === 'playing' && state.currentTurn === 'P2');

  var isSpectator = !mySymbol;
  spectatorTag.classList.toggle('hidden', !isSpectator);
  if (isSpectator) spectatorTag.textContent = '👁 MODE PENONTON';

  if (state.phase === 'lobby') {
    statusText.textContent = state.players.length < 2 ? 'Menunggu pemain kedua bergabung...' : 'Kedua pemain sudah masuk. Tekan SIAP untuk mulai!';
  } else if (state.phase === 'rps') {
    statusText.textContent = 'Batu Gunting Kertas untuk menentukan giliran pertama.';
  } else if (state.phase === 'playing') {
    statusText.textContent = (state.currentTurn === mySymbol) ? 'Giliranmu bergerak!' :
      'Menunggu ' + (state.currentTurn === 'P1' ? (p1 ? p1.name : 'Player 1') : (p2 ? p2.name : 'Player 2')) + '...';
  } else if (state.phase === 'ended') {
    var winnerName = state.winner === 'P1' ? (p1 ? p1.name : 'Player 1') : (p2 ? p2.name : 'Player 2');
    statusText.textContent = winnerName + ' menang!';
  }

  btnReady.classList.toggle('hidden', !(mySymbol && state.phase === 'lobby' && state.players.length === 2 && !state.ready[mySymbol]));

  var canPlay = mySymbol && state.phase === 'playing';
  controls.classList.toggle('hidden', !canPlay);
  if (canPlay) {
    myWallsEl.textContent = wallsPlacedBy(mySymbol, state);
    var oppSym = mySymbol === 'P1' ? 'P2' : 'P1';
    oppWallsEl.textContent = wallsPlacedBy(oppSym, state);
    var myTurn = state.currentTurn === mySymbol;
    btnModeMove.classList.toggle('active', uiMode === 'move');
    btnModeWall.classList.toggle('active', uiMode === 'wall');
    btnModeWall.disabled = !myTurn;
    var legal = myTurn ? legalDirsFor(mySymbol, state) : { up: false, down: false, left: false, right: false };
    dirUp.disabled = !myTurn || !legal.up;
    dirDown.disabled = !myTurn || !legal.down;
    dirLeft.disabled = !myTurn || !legal.left;
    dirRight.disabled = !myTurn || !legal.right;
    dirUp.textContent = legal.up ? '⬆️' : '⬆️❌';
    dirDown.textContent = legal.down ? '⬇️' : '⬇️❌';
    dirLeft.textContent = legal.left ? '⬅️' : '⬅️❌';
    dirRight.textContent = legal.right ? '➡️' : '➡️❌';
    wallHint.classList.toggle('hidden', !(uiMode === 'wall' && myTurn));
    wallPreviewBox.classList.toggle('show', !!(pendingWallEdge && uiMode === 'wall' && myTurn));
    if (pendingWallEdge && myTurn) {
      var blocked = wallWouldBlockPaths(state, pendingWallEdge.orient, pendingWallEdge.r, pendingWallEdge.c);
      btnConfirmWall.disabled = blocked;
      btnConfirmWall.textContent = blocked ? 'POSISI TIDAK VALID' : 'PASANG TEMBOK';
    }
    if (state.currentTurn !== lastTurnSeen) {
      lastTurnSeen = state.currentTurn;
      if (myTurn) { uiMode = 'move'; pendingWallEdge = null; }
    }
  }

  rpsOverlay.classList.toggle('hidden', state.phase !== 'rps' || !mySymbol);
  if (state.phase === 'rps' && mySymbol) {
    rpsSub.textContent = state.rps.resultText || 'Pilih salah satu!';
    var picked = state.rps.choices[mySymbol];
    rpsRock.classList.toggle('picked', picked === 'rock');
    rpsPaper.classList.toggle('picked', picked === 'paper');
    rpsScissors.classList.toggle('picked', picked === 'scissors');
    var lock = !!picked;
    rpsRock.disabled = lock; rpsPaper.disabled = lock; rpsScissors.disabled = lock;
  }

  winOverlay.classList.toggle('hidden', !(state.phase === 'ended' && endFxState.revealed));
  if (state.phase === 'ended') {
    var wName = state.winner === 'P1' ? (p1 ? p1.name : 'Player 1') : (p2 ? p2.name : 'Player 2');
    if (!endFxState.played) {
      endFxState.played = true;
      var fxKind = 'neutral';
      if (state.endReason !== 'opponent_left' && mySymbol) {
        fxKind = (mySymbol === state.winner) ? 'win' : 'lose';
      }
      playEndGameFx(fxKind, wName, function () {
        endFxState.revealed = true;
        render();
      });
    }
    if (state.endReason === 'opponent_left') {
      winTitleEl.textContent = '🚪 Lawan Keluar Room';
      winSubEl.textContent = mySymbol
        ? 'Lawan kamu keluar dari room, permainan otomatis diakhiri. Kamu menang WO!'
        : 'Salah satu pemain keluar dari room, permainan otomatis diakhiri.';
      btnRematch.classList.add('hidden');
    } else if (!mySymbol) {
      winTitleEl.textContent = '🏆 ' + wName + ' Menang!';
      winSubEl.textContent = 'Kamu menonton sebagai spectator. Berhasil mencapai FINISH!';
      btnRematch.classList.add('hidden');
    } else {
      var oppSymFx = mySymbol === 'P1' ? 'P2' : 'P1';
      var oppStillHere = state.players.some(function (pl) { return pl.symbol === oppSymFx; });
      winTitleEl.textContent = '🏆 ' + wName + ' Menang!';
      winSubEl.textContent = oppStillHere
        ? 'Berhasil mencapai FINISH! Kedua pemain harus setuju untuk rematch.'
        : 'Lawan kamu sudah keluar dari room, rematch tidak tersedia lagi.';
      btnRematch.classList.remove('hidden');
      var voted = state.rematchVotes[mySymbol];
      var nowTs = Date.now();
      var inCooldown = rematchCooldownUntil > nowTs;
      if (!oppStillHere) {
        btnRematch.disabled = true;
        btnRematch.textContent = 'LAWAN KELUAR ROOM';
        if (rematchCooldownHandle) { clearInterval(rematchCooldownHandle); rematchCooldownHandle = null; }
        rematchCooldownUntil = 0;
      } else if (inCooldown) {
        btnRematch.disabled = true;
        btnRematch.textContent = 'TUNGGU ' + Math.ceil((rematchCooldownUntil - nowTs) / 1000) + 'S';
      } else {
        /* setelah cooldown habis, tombol tetap BISA ditekan lagi biar
         * pemain bisa kirim pengingat rematch berulang ke lawan --
         * bukan langsung terkunci permanen cuma karena sudah vote
         * sekali. Label berubah supaya jelas ini "ingatkan lagi". */
        btnRematch.disabled = false;
        btnRematch.textContent = voted ? '🔔 INGATKAN LAGI' : '↻ REMATCH';
      }
    }
  } else {
    endFxState.played = false; endFxState.revealed = false;
    btnRematch.disabled = false; btnRematch.textContent = '↻ REMATCH';
    if (rematchCooldownHandle) { clearInterval(rematchCooldownHandle); rematchCooldownHandle = null; }
    rematchCooldownUntil = 0;
  }


  renderBoard();
}

/* ========================================================
 * BEFOREUNLOAD
 * ======================================================== */
window.addEventListener('beforeunload', function () {
  if (room && ws && ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify({ type: 'qmp_leave', room: room, playerId: playerId })); } catch (e) {}
  }
});

/* ========================================================
 * START
 * ======================================================== */
setConnection('', 'OFFLINE');
showPage('login');
connect();
if (nameInput) nameInput.focus();
})();
</script>
`
}

/* =========================================================
 * SEND RICH RESPONSE
 * ========================================================= */

async function sendQuoridorMP(sock, m, html) {
    const responseId = generateMessageIDV2()
    const sources = [
        {
            source_type: 'THIRD_PARTY',
            source_display_name: 'QuoridorMP',
            source_subtitle: 'Realtime Multiplayer',
            source_url: WEB_URL
        }
    ]
    const unifiedData = Buffer.from(
        JSON.stringify({
            response_id: responseId,
            sections: [
                {
                    view_model: {
                        primitive: {
                            __typename: 'GenAIaeacdsnwHtmlPrimitive',
                            payload: html,
                            trusted_sources: [WEB_URL]
                        },
                        __typename: 'GenAISingleLayoutViewModel'
                    }
                }
            ]
        })
    ).toString('base64')
    const isi = {
        messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            botMetadata: {
                messageDisclaimerText: 'QuoridorMP',
                botResponseId: responseId,
                richResponseSourcesMetadata: { sources }
            }
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages: [
                        {
                            messageType: proto.AIRichResponseSubMessageType.AI_RICH_RESPONSE_TEXT,
                            messageText: 'QuoridorMP'
                        }
                    ],
                    unifiedResponse: { data: unifiedData },
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedAiBotMessageInfo: { botJid: BOT_JID },
                        forwardOrigin: 4
                    }
                }
            }
        }
    }
    const msg = generateWAMessageFromContent(m.chat, isi, { messageId: generateMessageIDV2() })
    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}

/* =========================================================
 * HANDLER
 * ========================================================= */

// handler = fungsi utama yang dijalanin tiap kali command ke-trigger.
// m    = objek pesan (m.text, m.sender, m.chat, m.reply(), m.react(), dll)
// sock = instance socket Baileys (buat relay/kirim HTML card custom)
async function handler(m, { sock }) {
    await m.react('🧩')

    try {
        const playerIdentity = getWhatsAppIdentity(m)
        const stickers = await resolveStickers()
        const html = createGameHTML(playerIdentity, stickers)
        await sendQuoridorMP(sock, m, html)

        await m.react('✅')
    } catch (error) {
        console.error('[quoridormp] Error:', error)
        await m.react('❌')

        return m.reply(
            `❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ ɴɢɪʀɪᴍ ǫᴜᴏʀɪᴅᴏʀᴍᴘ*\n\n` +
            `> ${error?.message || 'Unknown error'}\n\n` +
            `> Coba lagi ya, Ai janji next take bakal lebih bagus~ 🧩`
        )
    }
}

// Wajib export { config, handler } biar plugin loader (handler.js) bisa
// baca metadata dan manggil fungsi handler-nya
module.exports = {
    config: pluginConfig,
    handler
}
