/**
✧ Name    : battleship
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
    name: 'battleship',
    alias: ['bs', 'battleship'],
    category: 'game',
    description: 'Battleship 2 pemain dalam 1 perangkat.',
    usage: '.battleship',
    example: '.battleship',
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
const BOT_JID =
    '0@bot'

/* =========================================================
 * CREATE HTML
 *
 * Game 100% lokal (tanpa WebSocket / sticker / server),
 * jadi tidak ada data dinamis yang perlu di-inject.
 * Catatan: semua backslash di dalam template literal ini
 * wajib ditulis dobel (\\s, \\.) supaya regex-nya selamat.
 * ========================================================= */

function createGameHTML() {
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
}
button,
input {
    font-family: inherit;
}
button {
    user-select: none;
}
.wrap {
    --ink: #eadfc4;
    --mut: rgba(234,223,196,.55);
    --line: rgba(234,223,196,.13);
    --red: #ef4b3f;
    --brass: #d9a441;
    --steel: #8fa3b8;
    --ok: #6fd6a0;
    --st: 'Saira Stencil One', 'Stencil', 'Impact', 'Arial Narrow', sans-serif;
    --bd: 'Barlow Condensed', 'Arial Narrow', Roboto, 'Segoe UI', Arial, sans-serif;
    width: 100%;
    max-width: 460px;
    margin: auto;
    padding: 8px;
    color: var(--ink);
    font-family: var(--bd);
    font-size: 15px;
}
.game {
    position: relative;
    overflow: hidden;
    padding: 16px;
    border-radius: 18px;
    background: linear-gradient(160deg, rgba(18,48,74,.88), rgba(10,23,38,.94));
    border: 1px solid var(--line);
    box-shadow: 0 24px 60px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06);
}
.hidden { display: none !important; }
.page { display: none; }
.page.active { display: block; }
.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding-bottom: 12px;
    border-bottom: 1px dashed var(--line);
}
.eyebrow { font-size: 13px; color: var(--mut); font-weight: 600; }
.title { font: 400 26px/1 var(--st); margin-top: 2px; letter-spacing: 1px; }
.connection { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--mut); }
.connection-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 8px var(--ok); }
.name-input {
    width: 100%;
    outline: none;
    border: 1px solid var(--line);
    background: rgba(0,0,0,.25);
    color: var(--ink);
    padding: 12px 14px;
    border-radius: 10px;
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 10px;
}
.name-input::placeholder { color: rgba(234,223,196,.3); }
.name-input:focus { border-color: var(--brass); box-shadow: 0 0 0 3px rgba(217,164,65,.18); }
.input-label { margin: 6px 0 5px; text-align: left; font-size: 14px; color: var(--mut); font-weight: 600; }
.btn {
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 12px;
    color: var(--ink);
    background: rgba(234,223,196,.07);
    font-size: 17px;
    font-weight: 700;
    cursor: pointer;
}
.btn:active { transform: scale(.97); }
.btn-main {
    background: linear-gradient(180deg, #e8b84f, #c08a28);
    color: #1b1304;
    border-color: #f0c868;
    box-shadow: 0 4px 14px rgba(217,164,65,.28), inset 0 1px 0 rgba(255,255,255,.4);
}
.btn.wide { grid-column: 1 / -1; }
.bs-toast-layer {
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
.bs-toast {
    padding: 10px 14px;
    border-radius: 10px;
    text-align: center;
    background: #0d1d2e;
    border: 1px solid var(--line);
    border-left: 4px solid var(--steel);
    box-shadow: 0 10px 30px rgba(0,0,0,.5);
    font-size: 17px;
    font-weight: 700;
    animation: bsToastIn .18s ease-out;
}
.bs-toast.ok { border-left-color: var(--ok); }
.bs-toast.warn { border-left-color: var(--brass); }
.bs-toast.err { border-left-color: var(--red); }
@keyframes bsToastIn {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: none; }
}
.players { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
.player {
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(0,0,0,.22);
    border: 1px solid var(--line);
    border-top: 3px solid transparent;
}
#bsPlayerX.active { border-top-color: var(--brass); background: rgba(217,164,65,.1); }
#bsPlayerO.active { border-top-color: var(--steel); background: rgba(143,163,184,.12); }
.player-symbol { font: 400 15px var(--st); color: var(--mut); }
.player-name {
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 19px;
    font-weight: 700;
}
.player-ready-tag { margin-top: 1px; font-size: 14px; font-weight: 600; color: var(--ok); }
.player-ready-tag.waiting { color: var(--mut); }
.phase { margin-top: 14px; text-align: center; font-size: 14px; font-weight: 600; color: var(--mut); }
.status {
    margin-top: 6px;
    padding: 11px;
    border-radius: 10px;
    text-align: center;
    background: rgba(0,0,0,.25);
    border: 1px solid var(--line);
    font-size: 18px;
    font-weight: 700;
    line-height: 1.25;
}
.status.win { border-color: var(--brass); color: var(--brass); animation: bsWin 1.6s ease-in-out infinite; }
@keyframes bsWin { 50% { box-shadow: 0 0 22px rgba(217,164,65,.45); } }
.boards { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
.boards.playing #bsEnemyBoardWrap { order: -1; }
.boards.playing #bsMyBoardWrap .board { max-width: 300px; margin: 0 auto; }
.board-wrap { min-width: 0; padding: 8px; border-radius: 14px; border: 1px solid transparent; }
.board-wrap.my-turn {
    border-color: rgba(239,75,63,.55);
    background: rgba(239,75,63,.05);
    animation: bsGlow 1.8s ease-in-out infinite;
}
@keyframes bsGlow { 50% { box-shadow: 0 0 24px rgba(239,75,63,.35); } }
.board-title-row { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px; margin-bottom: 7px; }
.board-title { font: 400 15px var(--st); letter-spacing: .5px; }
.turn-badge {
    display: none;
    font-size: 14px;
    font-weight: 700;
    padding: 1px 9px;
    border-radius: 20px;
    color: #2b0a07;
    background: var(--red);
}
.turn-badge.show { display: inline-flex; animation: bsPulse 1.4s ease-in-out infinite; }
@keyframes bsPulse { 50% { opacity: .7; transform: scale(1.06); } }
.board {
    display: grid;
    grid-template-columns: 16px repeat(10, 1fr);
    width: 100%;
    padding: 6px;
    border-radius: 10px;
    position: relative;
    overflow: hidden;
    background: linear-gradient(180deg, #143a5a, #0c2338);
    border: 1px solid rgba(234,223,196,.2);
    box-shadow: inset 0 0 30px rgba(0,0,0,.45);
}
.board::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,.05) 50%, transparent 60%);
    background-size: 250% 100%;
    animation: bsSheen 7s linear infinite;
}
@keyframes bsSheen { from { background-position: 150% 0; } to { background-position: -100% 0; } }
.lbl { display: flex; align-items: center; justify-content: center; min-height: 14px; font: 600 11px var(--bd); color: var(--mut); }
.cell {
    position: relative;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: inset 0 0 0 .5px rgba(234,223,196,.12);
    color: var(--ink);
    font-size: 13px;
    font-weight: 800;
    cursor: default;
}
.boards.playing #bsEnemyBoard .cell, .boards:not(.playing) .cell { font-size: 19px; }
.cell::before { content: ""; position: absolute; inset: 3px; border-radius: 5px; opacity: 0; z-index: 0; }
.cell.ship::before {
    opacity: 1;
    background: linear-gradient(160deg, #b7c6d6, #6d8399 60%, #52667a);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.4), 0 2px 3px rgba(0,0,0,.45);
}
.cell.sh::before { inset: 4px 0; }
.cell.sh.b::before { inset: 4px 0 4px 3px; border-radius: 14px 3px 3px 14px; }
.cell.sh.e::before { inset: 4px 3px 4px 0; border-radius: 3px 6px 6px 3px; }
.cell.sv::before { inset: 0 4px; }
.cell.sv.b::before { inset: 3px 4px 0; border-radius: 14px 14px 3px 3px; }
.cell.sv.e::before { inset: 0 4px 3px; border-radius: 3px 3px 6px 6px; }
.cell.ship.sh.b.e::before, .cell.ship.sv.b.e::before { inset: 4px; }
.cell.ship.sunk::before { background: linear-gradient(160deg, #7d2a2a, #3b1212); box-shadow: inset 0 1px 0 rgba(255,150,130,.3); }
.cell.hit {
    background: radial-gradient(circle, #ff7a6a 0, #e23a2e 55%, #a81f18 100%);
    box-shadow: inset 0 0 0 1.5px #ffd2cc, 0 0 10px rgba(255,80,60,.75);
    color: #fff;
    text-shadow: 0 1px 2px #000;
    animation: bsFire .9s ease-in-out infinite alternate;
}
.cell.hit.ship::before { background: linear-gradient(160deg, #ff7a6a, #b3261e); }
.cell.sunk { color: #ffe3de; text-shadow: 0 1px 2px #000; }
@keyframes bsFire { from { filter: brightness(.9); } to { filter: brightness(1.35); } }
.cell.hit, .cell.sunk, .cell.miss { z-index: 1; }
.cell.miss { background: rgba(5,14,25,.6); }
.cell.miss::before {
    opacity: 1;
    inset: 16%;
    border-radius: 50%;
    border: 1.5px solid rgba(234,223,196,.6);
    animation: bsRip 2s ease-out infinite;
}
.cell.miss::after {
    content: "";
    position: absolute;
    width: 34%;
    height: 34%;
    border-radius: 50%;
    background: #eadfc4;
    box-shadow: 0 0 0 3px rgba(234,223,196,.28);
}
@keyframes bsRip { from { transform: scale(.5); opacity: 1; } to { transform: scale(1.7); opacity: 0; } }
.cell.sunk-pop { animation: bsPop .5s ease; }
@keyframes bsPop { 35% { transform: scale(1.3); } 60% { transform: scale(.92); } }
.cell.target { cursor: crosshair; }
.cell.target:hover { background: rgba(234,223,196,.16); box-shadow: inset 0 0 0 1.5px var(--brass); }
.cell.setup { cursor: pointer; }
.cell.preview::before { opacity: 1; background: rgba(111,214,160,.6); }
.cell.preview-bad::before { opacity: 1; background: rgba(239,75,63,.6); }
.cell:active { transform: scale(.92); }
.legend { display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; margin-top: 8px; font-size: 14px; color: var(--mut); }
.legend span { display: flex; align-items: center; gap: 5px; }
.dot { width: 10px; height: 10px; border-radius: 3px; background: var(--steel); }
.dot.hit { background: var(--red); }
.dot.miss { background: var(--ink); border-radius: 50%; }
.ships { margin-top: 13px; padding: 10px; border-radius: 12px; background: rgba(0,0,0,.22); border: 1px solid var(--line); }
.ships-title { font: 400 15px var(--st); color: var(--mut); }
.ship-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.ship-btn {
    display: flex;
    align-items: center;
    gap: 7px;
    border: 1px solid var(--line);
    padding: 6px 10px;
    border-radius: 8px;
    background: rgba(234,223,196,.06);
    color: var(--ink);
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
}
.ship-btn i { display: flex; gap: 1px; }
.ship-btn i b { width: 7px; height: 10px; background: var(--steel); border-radius: 2px; }
.ship-btn.selected { background: var(--brass); color: #1b1304; border-color: #f0c868; }
.ship-btn.selected i b { background: #1b1304; }
.ship-btn.done { opacity: .35; cursor: default; text-decoration: line-through; }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
.footer { margin-top: 14px; text-align: center; font-size: 14px; line-height: 1.5; color: var(--mut); }
.start { padding: 16px 2px 4px; text-align: center; }
.rose { width: 92px; height: 92px; margin: 0 auto 6px; animation: bsSway 6s ease-in-out infinite; }
@keyframes bsSway { 50% { transform: rotate(14deg); } }
.login-title { font: 400 34px/1.05 var(--st); letter-spacing: 1px; }
.login-sub { margin: 6px 0 18px; font-size: 17px; color: var(--mut); font-weight: 600; }
.login-rules { margin-top: 14px; font-size: 15px; line-height: 1.5; color: var(--mut); }
.cover-page { padding: 26px 4px 6px; text-align: center; }
.ping { position: relative; width: 120px; height: 120px; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 38px; }
.ping::before, .ping::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid var(--brass);
    animation: bsPing 2.4s ease-out infinite;
}
.ping::after { animation-delay: 1.2s; }
@keyframes bsPing { from { transform: scale(.35); opacity: .9; } to { transform: scale(1.15); opacity: 0; } }
.cover-label { margin-top: 12px; font-size: 15px; color: var(--mut); font-weight: 600; }
.cover-symbol { margin-top: 12px; font: 400 17px var(--st); color: var(--brass); }
.cover-name { margin-top: 4px; font: 400 32px/1.1 var(--st); word-break: break-word; }
.cover-reason { margin: 14px 0 22px; font-size: 17px; line-height: 1.45; color: var(--mut); }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
</style>
<div class="wrap">
<div class="game">
<div id="bsToastLayer" class="bs-toast-layer"></div>
<div class="header">
<div>
<div class="eyebrow">Hoshino AI · 1 perangkat</div>
<div class="title">Battleship</div>
</div>
<div class="connection"><span class="connection-dot"></span><span>Lokal</span></div>
</div>

<div id="bsPageStart" class="page active start">
<svg class="rose" viewBox="0 0 100 100" fill="none" stroke="#d9a441" stroke-width="1.5"><circle cx="50" cy="50" r="44"/><circle cx="50" cy="50" r="30" stroke-dasharray="2 4" opacity=".6"/><path d="M50 4l7 39 39 7-39 7-7 39-7-39-39-7 39-7z" fill="rgba(217,164,65,.2)"/><path d="M50 4l7 39-7 7-7-7z" fill="#ef4b3f" stroke="none"/></svg>
<div class="login-title">Perang kapal</div>
<div class="login-sub">2 pemain · 1 perangkat</div>
<div class="input-label">Kapten X (main duluan)</div>
<input id="bsNameXInput" class="name-input" maxlength="16" placeholder="Kapten X" autocomplete="off">
<div class="input-label">Kapten O</div>
<input id="bsNameOInput" class="name-input" maxlength="16" placeholder="Kapten O" autocomplete="off">
<button id="bsStartBtn" class="btn btn-main" style="width:100%;margin-top:6px;padding:14px;font-size:20px">⚓ Mulai game</button>
<div class="login-rules">Kapal disusun bergantian, layar dikunci tiap oper perangkat.<br>Hit = tembak lagi · Miss = giliran lawan.</div>
</div>

<div id="bsPageCover" class="page cover-page">
<div class="ping">🔒</div>
<div class="cover-label">Layar dikunci · oper perangkat ke</div>
<div id="bsCoverSymbol" class="cover-symbol">KAPTEN X</div>
<div id="bsCoverName" class="cover-name">-</div>
<div id="bsCoverReason" class="cover-reason"></div>
<button id="bsCoverBtn" class="btn btn-main" style="width:100%;padding:14px;font-size:20px">Saya siap</button>
</div>

<div id="bsPageGame" class="page">
<div class="players">
<div id="bsPlayerX" class="player"><div class="player-symbol">KAPTEN X</div><div id="bsNameX" class="player-name">-</div><div id="bsReadyX" class="player-ready-tag waiting">Belum siap</div></div>
<div id="bsPlayerO" class="player"><div class="player-symbol">KAPTEN O</div><div id="bsNameO" class="player-name">-</div><div id="bsReadyO" class="player-ready-tag waiting">Belum siap</div></div>
</div>
<div id="bsPhase" class="phase">Setup</div>
<div id="bsStatus" class="status">-</div>
<div id="bsSetupPanel" class="ships">
<div class="ships-title">Susun armada</div>
<div id="bsShipList" class="ship-list"></div>
<button id="bsRotateBtn" type="button" class="btn" style="width:100%;margin-top:8px">↻ Putar kapal</button>
</div>
<div id="bsBoards" class="boards">
<div class="board-wrap" id="bsMyBoardWrap">
<div class="board-title-row"><div class="board-title" id="bsMyBoardTitle">Armadamu</div><span id="bsTurnBadge" class="turn-badge">✦ Giliranmu</span></div>
<div id="bsMyBoard" class="board"></div>
</div>
<div class="board-wrap" id="bsEnemyBoardWrap">
<div class="board-title-row"><div class="board-title" id="bsEnemyBoardTitle">Perairan musuh</div></div>
<div id="bsEnemyBoard" class="board"></div>
</div>
</div>
<div class="legend"><span><i class="dot"></i>Kapal</span><span><i class="dot hit"></i>Hit</span><span><i class="dot miss"></i>Miss</span></div>
<div class="actions">
<button id="bsUndoBtn" type="button" class="btn">↩ Undo</button>
<button id="bsRandomBtn" type="button" class="btn">🎲 Acak</button>
<button id="bsReadyBtn" type="button" class="btn btn-main wide">⚓ Siap</button>
<button id="bsHandoverBtn" type="button" class="btn btn-main wide">▶ Oper perangkat</button>
<button id="bsRematchBtn" type="button" class="btn">↻ Rematch</button>
<button id="bsLeaveBtn" type="button" class="btn wide">Keluar</button>
</div>
</div>

<div class="footer">Battleship · 1 Device<br>Tenggelamkan semua kapal musuh 🚢</div>
</div>
</div>
<script>
(function () {
'use strict';

const SIZE = 10;
const SHIPS = [
    { id: 'carrier',    name: 'Carrier',    short: 'Carrier', size: 5 },
    { id: 'battleship', name: 'Battleship', short: 'Battle',  size: 4 },
    { id: 'cruiser',    name: 'Cruiser',    short: 'Cruiser', size: 3 },
    { id: 'submarine',  name: 'Submarine',  short: 'Sub',     size: 3 },
    { id: 'destroyer',  name: 'Destroyer',  short: 'Destroy', size: 2 }
];
const $ = id => document.getElementById(id);
const names = ['ToastLayer','PageStart','PageCover','PageGame','NameXInput','NameOInput','StartBtn','CoverSymbol','CoverName','CoverReason','CoverBtn','Phase','Status','SetupPanel','ShipList','RotateBtn','Boards','MyBoardWrap','MyBoardTitle','MyBoard','EnemyBoardWrap','EnemyBoardTitle','EnemyBoard','TurnBadge','UndoBtn','RandomBtn','ReadyBtn','HandoverBtn','RematchBtn','LeaveBtn'];
const el = {};
names.forEach(function (n) {
    el[n.charAt(0).toLowerCase() + n.slice(1)] = $('bs' + n);
});

const players = { X: 'Kapten X', O: 'Kapten O' };
const scores = { X: 0, O: 0 };
let state = null, orientation = 'H', selectedShip = null, viewer = 'X';
let locked = false, lastMsg = '', freshSunk = null, hoverIndex = -1;
let coverNext = null, leaveArmed = false, leaveTimer = null;

const other = s => (s === 'X' ? 'O' : 'X');
const emptyBoard = () => Array(SIZE * SIZE).fill(null);
const newState = () => ({
    phase: 'setup', turn: 'X', winner: null,
    boards: { X: emptyBoard(), O: emptyBoard() },
    ships: { X: [], O: [] }, shots: { X: [], O: [] },
    ready: { X: false, O: false }
});
const shipById = id => SHIPS.find(s => s.id === id);
const isSunk = ship => ship.hits.length >= ship.cells.length;
const aliveCount = s => state.ships[s].filter(x => !isSunk(x)).length;
function firstUnplaced(symbol) {
    const placed = state.ships[symbol];
    const next = SHIPS.find(s => !placed.some(p => p.id === s.id));
    return next ? next.id : null;
}
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }

function showPage(name) {
    el.pageStart.classList.toggle('active', name === 'Start');
    el.pageCover.classList.toggle('active', name === 'Cover');
    el.pageGame.classList.toggle('active', name === 'Game');
}
const setStatus = t => { el.status.textContent = t; };
function showToast(text, kind) {
    const t = document.createElement('div');
    t.className = 'bs-toast ' + (kind || '');
    t.textContent = text;
    el.toastLayer.appendChild(t);
    while (el.toastLayer.children.length > 3) el.toastLayer.firstChild.remove();
    setTimeout(function () { t.remove(); }, 1800);
}
const cleanName = raw => String(raw || '').replace(/\\s+/g, ' ').trim().slice(0, 16);

function getCellsForShip(row, col, size, dir) {
    const cells = [];
    for (let i = 0; i < size; i++) {
        const r = row + (dir === 'V' ? i : 0);
        const c = col + (dir === 'H' ? i : 0);
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null;
        cells.push(r * SIZE + c);
    }
    return cells;
}
const canPlaceShip = (board, cells) => !!cells && cells.every(i => !board[i]);

/* ---------- FLOW ---------- */
function startGame() {
    players.X = cleanName(el.nameXInput.value) || 'Kapten X';
    players.O = cleanName(el.nameOInput.value) || 'Kapten O';
    scores.X = 0; scores.O = 0;
    newMatch();
}
function newMatch() {
    state = newState();
    locked = false; lastMsg = ''; freshSunk = null; orientation = 'H';
    beginSetup('X');
}
function beginSetup(symbol) {
    viewer = symbol;
    selectedShip = firstUnplaced(symbol);
    hoverIndex = -1;
    showPage('Game');
    render();
}
function beginTurn(symbol) {
    viewer = symbol; state.turn = symbol;
    locked = false; lastMsg = '';
    showPage('Game');
    render();
}
function showCover(symbol, reason, next) {
    el.myBoard.innerHTML = '';
    el.enemyBoard.innerHTML = '';
    el.coverSymbol.textContent = 'KAPTEN ' + symbol;
    el.coverName.textContent = players[symbol];
    el.coverReason.textContent = reason;
    coverNext = next;
    showPage('Cover');
}
function continueFromCover() {
    if (!coverNext) return;
    const fn = coverNext;
    coverNext = null;
    fn();
}
function goToMenu() {
    state = null; coverNext = null; leaveArmed = false;
    clearTimeout(leaveTimer);
    el.myBoard.innerHTML = '';
    el.enemyBoard.innerHTML = '';
    showPage('Start');
}

/* ---------- PLACE SHIP ---------- */
function placeShip(row, col) {
    if (!state || state.phase !== 'setup') return;
    if (!selectedShip) { setStatus('Pilih kapal terlebih dahulu.'); return; }
    const ship = shipById(selectedShip);
    if (!ship) return;
    const mine = state.ships[viewer];
    if (mine.some(s => s.id === ship.id)) return;
    const cells = getCellsForShip(row, col, ship.size, orientation);
    if (!canPlaceShip(state.boards[viewer], cells)) {
        setStatus('Posisi kapal tidak valid.');
        showToast('Posisi kapal tidak valid', 'err');
        return;
    }
    for (const i of cells) state.boards[viewer][i] = ship.id;
    mine.push({ id: ship.id, cells: cells, hits: [] });
    selectedShip = firstUnplaced(viewer);
    hoverIndex = -1;
    render();
}
function undoPlacement() {
    if (!state || state.phase !== 'setup') return;
    const mine = state.ships[viewer];
    if (!mine.length) { showToast('Tidak ada penempatan yang bisa dibatalkan', 'warn'); return; }
    const last = mine.pop();
    for (const i of last.cells) state.boards[viewer][i] = null;
    selectedShip = last.id;
    showToast('↩ Penempatan kapal terakhir dibatalkan', 'ok');
    render();
}
function randomizeFleet() {
    if (!state || state.phase !== 'setup') return;
    state.boards[viewer] = emptyBoard();
    state.ships[viewer] = [];
    for (const ship of SHIPS) {
        let placed = false, guard = 0;
        while (!placed && guard++ < 1000) {
            const dir = Math.random() < 0.5 ? 'H' : 'V';
            const row = Math.floor(Math.random() * SIZE);
            const col = Math.floor(Math.random() * SIZE);
            const cells = getCellsForShip(row, col, ship.size, dir);
            if (canPlaceShip(state.boards[viewer], cells)) {
                for (const i of cells) state.boards[viewer][i] = ship.id;
                state.ships[viewer].push({ id: ship.id, cells: cells, hits: [] });
                placed = true;
            }
        }
    }
    selectedShip = null; hoverIndex = -1;
    render();
}
function rotateShip() {
    orientation = orientation === 'H' ? 'V' : 'H';
    updateRotateLabel();
    showPreview(hoverIndex);
}
function updateRotateLabel() {
    el.rotateBtn.textContent = '↻ Putar kapal (' + (orientation === 'H' ? 'mendatar' : 'menurun') + ')';
}

/* ---------- PREVIEW ---------- */
function clearPreview() {
    el.myBoard.querySelectorAll('.preview, .preview-bad')
        .forEach(function (c) { c.classList.remove('preview', 'preview-bad'); });
}
function showPreview(index) {
    clearPreview();
    if (!state || state.phase !== 'setup' || !selectedShip || index < 0) return;
    const ship = shipById(selectedShip);
    if (!ship) return;
    const row = Math.floor(index / SIZE), col = index % SIZE;
    const raw = [];
    let inBounds = true;
    for (let i = 0; i < ship.size; i++) {
        const r = row + (orientation === 'V' ? i : 0);
        const c = col + (orientation === 'H' ? i : 0);
        if (r >= SIZE || c >= SIZE) inBounds = false; else raw.push(r * SIZE + c);
    }
    const board = state.boards[viewer];
    const ok = inBounds && raw.every(i => !board[i]);
    const cells = el.myBoard.querySelectorAll('.cell');
    for (const i of raw) if (cells[i]) cells[i].classList.add(ok ? 'preview' : 'preview-bad');
}

/* ---------- READY ---------- */
function confirmReady() {
    if (!state || state.phase !== 'setup') return;
    if (state.ships[viewer].length !== SHIPS.length) {
        setStatus('Susun semua kapal terlebih dahulu.');
        showToast('Susun semua kapal dulu', 'warn');
        return;
    }
    state.ready[viewer] = true;
    if (viewer === 'X') {
        showCover('O', 'Giliran menyusun armada. Kapten X, jangan ngintip layar ya!', function () { beginSetup('O'); });
    } else {
        state.phase = 'playing'; state.turn = 'X'; state.winner = null;
        showCover('X', 'Pertempuran dimulai! Kapten O, jangan ngintip layar ya!', function () { beginTurn('X'); });
    }
}

/* ---------- SHOOT ---------- */
function shoot(index) {
    if (!state || state.phase !== 'playing' || locked) return;
    const symbol = state.turn, enemy = other(symbol);
    if (state.shots[symbol].includes(index)) return;
    state.shots[symbol].push(index);
    const target = state.boards[enemy][index];
    let hit = false, sunkShip = null;
    if (target) {
        hit = true;
        const ship = state.ships[enemy].find(s => s.id === target);
        if (ship) {
            if (!ship.hits.includes(index)) ship.hits.push(index);
            if (isSunk(ship)) sunkShip = ship;
        }
    }
    if (sunkShip) freshSunk = { owner: enemy, cells: new Set(sunkShip.cells) };
    const allSunk = state.ships[enemy].every(isSunk);
    if (allSunk) {
        state.phase = 'finished'; state.winner = symbol;
        scores[symbol] += 1;
        showToast('🏆 ' + players[symbol] + ' MENANG!', 'ok');
        buzz([80, 60, 80, 60, 200]);
    } else if (!hit) {
        locked = true;
        lastMsg = '💦 Miss! Oper perangkat ke ' + players[enemy] + '.';
        showToast('💦 Miss', 'warn');
    } else if (sunkShip) {
        lastMsg = '☠ ' + shipById(sunkShip.id).name + ' ' + players[enemy] + ' tenggelam! Tembak lagi.';
        showToast('☠ Kapal tenggelam!', 'ok');
        buzz([60, 40, 140]);
    } else {
        lastMsg = '💥 Hit! Tembak lagi.';
        showToast('💥 Hit!', 'ok');
        buzz(50);
    }
    render();
    freshSunk = null;
}
function handover() {
    if (!state || state.phase !== 'playing' || !locked) return;
    const next = other(state.turn);
    showCover(next, 'Giliranmu menembak! ' + players[state.turn] + ', jangan ngintip layar ya!', function () { beginTurn(next); });
}

/* ---------- REMATCH / KELUAR ---------- */
function rematch() {
    if (!state || state.phase !== 'finished') return;
    newMatch();
}
function leave() {
    if (!state) return;
    if (state.phase === 'finished') { goToMenu(); return; }
    if (!leaveArmed) {
        leaveArmed = true;
        showToast('Tekan Keluar sekali lagi untuk batal main', 'warn');
        clearTimeout(leaveTimer);
        leaveTimer = setTimeout(function () { leaveArmed = false; }, 2500);
        return;
    }
    goToMenu();
}

/* ---------- RENDER ---------- */
function renderShips() {
    el.shipList.innerHTML = '';
    if (!state || state.phase !== 'setup') return;
    const mine = state.ships[viewer];
    for (const ship of SHIPS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ship-btn';
        const placed = mine.some(s => s.id === ship.id);
        if (placed) b.classList.add('done');
        if (selectedShip === ship.id) b.classList.add('selected');
        b.innerHTML = '<i>' + '<b></b>'.repeat(ship.size) + '</i>';
        b.appendChild(document.createTextNode(ship.short));
        b.onclick = function () {
            if (placed) return;
            selectedShip = ship.id;
            renderShips();
            setStatus('Pilih kotak pertama untuk ' + ship.name + '.');
        };
        el.shipList.appendChild(b);
    }
}

function renderBoard(boardEl, owner, opt) {
    boardEl.innerHTML = '';
    const board = state.boards[owner];
    const shotSet = new Set(state.shots[other(owner)]);
    const fresh = freshSunk && freshSunk.owner === owner ? freshSunk.cells : null;
    const addLbl = function (t) {
        const d = document.createElement('div');
        d.className = 'lbl';
        d.textContent = t;
        boardEl.appendChild(d);
    };
    addLbl('');
    for (let c = 0; c < SIZE; c++) addLbl('ABCDEFGHIJ'[c]);
    for (let index = 0; index < SIZE * SIZE; index++) {
        if (index % SIZE === 0) addLbl(String(index / SIZE + 1));
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        cell.dataset.i = String(index);
        const value = board[index];
        const shot = shotSet.has(index);
        const ship = value ? state.ships[owner].find(s => s.cells.includes(index)) : null;
        const sunk = !!(ship && isSunk(ship));
        if (ship && (opt.reveal || (shot && sunk))) {
            const vert = ship.cells.length > 1 && ship.cells[1] - ship.cells[0] === SIZE;
            const p = ship.cells.indexOf(index);
            cell.classList.add('ship', vert ? 'sv' : 'sh');
            if (p === 0) cell.classList.add('b');
            if (p === ship.cells.length - 1) cell.classList.add('e');
        }
        if (shot) {
            if (value) {
                cell.classList.add(sunk ? 'sunk' : 'hit');
                cell.textContent = sunk ? '☠' : '✕';
                if (sunk && fresh && fresh.has(index)) cell.classList.add('sunk-pop');
            } else {
                cell.classList.add('miss');
            }
        } else if (opt.shootable) {
            cell.classList.add('target');
            cell.onclick = function () { shoot(index); };
        } else if (opt.setup) {
            cell.classList.add('setup');
            cell.onclick = function () { placeShip(Math.floor(index / SIZE), index % SIZE); };
        }
        boardEl.appendChild(cell);
    }
}

function renderBoards() {
    const ph = state.phase;
    el.boards.classList.toggle('playing', ph === 'playing');
    el.enemyBoardWrap.classList.toggle('hidden', ph === 'setup');
    el.myBoardWrap.classList.remove('my-turn');
    el.enemyBoardWrap.classList.remove('my-turn');
    el.turnBadge.classList.remove('show');
    if (ph === 'setup') {
        el.myBoardTitle.textContent = 'Armada ' + players[viewer];
        renderBoard(el.myBoard, viewer, { reveal: true, setup: true });
        return;
    }
    if (ph === 'playing') {
        const enemy = other(viewer);
        el.myBoardTitle.textContent = 'Armadamu';
        el.enemyBoardTitle.textContent = 'Perairan ' + players[enemy];
        renderBoard(el.myBoard, viewer, { reveal: true });
        renderBoard(el.enemyBoard, enemy, { reveal: false, shootable: !locked });
        if (!locked) {
            el.enemyBoardWrap.classList.add('my-turn');
            el.enemyBoardWrap.querySelector('.board-title-row').appendChild(el.turnBadge);
            el.turnBadge.classList.add('show');
        }
        return;
    }
    el.myBoardTitle.textContent = (state.winner === 'X' ? '🏆 ' : '') + 'Armada ' + players.X;
    el.enemyBoardTitle.textContent = (state.winner === 'O' ? '🏆 ' : '') + 'Armada ' + players.O;
    renderBoard(el.myBoard, 'X', { reveal: true });
    renderBoard(el.enemyBoard, 'O', { reveal: true });
}

function renderPlayers() {
    for (const symbol of ['X', 'O']) {
        $('bsName' + symbol).textContent = players[symbol];
        const card = $('bsPlayer' + symbol), tag = $('bsReady' + symbol);
        let active = false;
        if (state.phase === 'setup') {
            active = symbol === viewer;
            tag.textContent = state.ready[symbol] ? '✓ Siap' : (active ? 'Menyusun armada...' : 'Belum siap');
            tag.classList.toggle('waiting', !state.ready[symbol]);
        } else {
            active = state.phase === 'finished' ? symbol === state.winner : symbol === state.turn;
            tag.textContent = 'Kapal ' + aliveCount(symbol) + '/' + SHIPS.length + ' · 🏆 ' + scores[symbol];
            tag.classList.remove('waiting');
        }
        card.classList.toggle('active', active);
    }
}
function renderPhase() {
    el.phase.textContent =
        state.phase === 'setup' ? 'Setup · Kapten ' + viewer :
        state.phase === 'playing' ? 'Pertempuran · giliran Kapten ' + state.turn : 'Selesai';
}
function renderStatus() {
    el.status.classList.toggle('win', state.phase === 'finished');
    if (state.phase === 'setup') {
        if (state.ships[viewer].length === SHIPS.length) setStatus(players[viewer] + ': armada lengkap. Tekan Siap.');
        else if (selectedShip) setStatus('Pilih kotak pertama untuk ' + shipById(selectedShip).name + '.');
        else setStatus('Pilih kapal terlebih dahulu.');
    } else if (state.phase === 'playing') {
        setStatus(lastMsg || 'Giliran ' + players[state.turn] + ' — tembak perairan musuh!');
    } else {
        setStatus('🏆 ' + players[state.winner] + ' MENANG! ' + (lastMsg ? lastMsg.replace(/ Tembak lagi\\./, '') : ''));
    }
}
function renderActions() {
    const ph = state.phase, setup = ph === 'setup', finished = ph === 'finished';
    el.setupPanel.classList.toggle('hidden', !setup);
    el.undoBtn.classList.toggle('hidden', !setup);
    el.randomBtn.classList.toggle('hidden', !setup);
    el.readyBtn.classList.toggle('hidden', !setup);
    el.handoverBtn.classList.toggle('hidden', !(ph === 'playing' && locked));
    el.rematchBtn.classList.toggle('hidden', !finished);
    el.leaveBtn.textContent = finished ? 'Menu utama' : 'Keluar';
    el.leaveBtn.classList.toggle('wide', !finished);
    updateRotateLabel();
}
function render() {
    if (!state) return;
    renderPlayers(); renderPhase(); renderShips();
    renderBoards(); renderStatus(); renderActions();
}

/* ---------- EVENTS ---------- */
el.startBtn.onclick = startGame;
[el.nameXInput, el.nameOInput].forEach(function (input) {
    input.onkeydown = function (e) { if (e.key === 'Enter') startGame(); };
});
el.coverBtn.onclick = continueFromCover;
el.rotateBtn.onclick = rotateShip;
el.undoBtn.onclick = undoPlacement;
el.randomBtn.onclick = randomizeFleet;
el.readyBtn.onclick = confirmReady;
el.handoverBtn.onclick = handover;
el.rematchBtn.onclick = rematch;
el.leaveBtn.onclick = leave;
el.myBoard.addEventListener('mouseover', function (e) {
    const cell = e.target.closest('.cell');
    if (!cell || !state || state.phase !== 'setup') return;
    hoverIndex = Number(cell.dataset.i);
    showPreview(hoverIndex);
});
el.myBoard.addEventListener('mouseleave', function () { hoverIndex = -1; clearPreview(); });

showPage('Start');
})();
</script>
`
}

/* =========================================================
 * SEND RICH RESPONSE
 * ========================================================= */

async function sendBattleship(
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
                'Battleship',
            source_subtitle:
                '2 Pemain · 1 Perangkat',
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
                    'Battleship',
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
                                'Battleship'
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
        const html = createGameHTML()
        await sendBattleship(sock, m, html)

        await m.react('✅')
    } catch (error) {
        console.error('[battleship] Error:', error)
        await m.react('❌')

        return m.reply(
            `❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ ɴɢɪʀɪᴍ ʙᴀᴛᴛʟᴇsʜɪᴘ*\n\n` +
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