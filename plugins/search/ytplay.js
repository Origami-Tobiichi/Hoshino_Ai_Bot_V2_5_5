/**
‎✧ Name    : ytplay
‎✧ Category: search
‎✧ Note    : sesuaikan path require('../../src/scraper/youtube') sama struktur folder kamu
**/

const { randomUUID } = require('crypto')
const axios = require('axios')
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { searchYoutube, getYoutubeDirectUrl } = require('../../src/scraper/youtube')

// pluginConfig = metadata plugin, dipakai handler.js buat registrasi command
const pluginConfig = {
    name: 'ytplay',
    alias: ['ytp', 'youtubeplay', 'playyt', 'playyoutube'],
    category: 'search',
    description: 'Cari & putar video YouTube langsung dalam bentuk player interaktif',
    usage: '.ytplay <judul/link>',
    example: '.ytplay alan walker faded',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 2,
    isEnabled: true
}

// DISPLAY_WS_HOST = teks yang muncul di panel "WEBSOCKET VIDEO" (kosmetik saja).
// Koneksi WebSocket yang beneran dipakai tetap ke server proxy asli di bawah
// (lihat startVideoStream -> wsUrl), radiant di sini TIDAK pernah dipakai buat
// connect. Catatan: ini cuma menyembunyikan dari tampilan UI, bukan dari
// Network tab DevTools browser -- itu keterbatasan WebSocket, bukan kode ini.
const DISPLAY_WS_HOST = 'radiant-cucurucho-428266.netlify.app'
const MAX_VIDEO_KB = 700

// Server WebSocket mandiri (ws-server.js). Isi lewat env / settings:
//   YTPLAY_WS_BASE   = https://ws.domainlu.com   (harus https/wss, bukan http biasa)
//   YTPLAY_WS_SECRET = sama persis dengan WS_SECRET di ws-server.js
// Kalau kosong / gagal, otomatis fallback ke mode lama (video di-embed base64).
const WS_BASE = ''
const WS_SECRET = process.env.YTPLAY_WS_SECRET || 'passwordlu'

async function registerStream(directUrl) {
    const { data } = await axios.post(
        `${WS_BASE}/register`,
        { url: directUrl },
        { headers: { 'x-secret': WS_SECRET }, timeout: 10000 }
    )
    if (!data?.id) throw new Error('Register WS gagal')
    return `${WS_BASE.replace(/^http/, 'ws')}/ws?id=${data.id}`
}

function escapeHtmlJs(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/`/g, '\\`')
        .replace(/\$\{/g, '\\${')
        .replace(/</g, '\\x3C')
}

function compressVideo(inputPath, vb = '200k', maxSec = 60, height = 240) {
    return new Promise((resolve, reject) => {
        const outPath = `${inputPath}_out_${Date.now()}.mp4`
        const cleanup = () => { try { fs.unlinkSync(outPath) } catch {} }

        const ff = spawn('ffmpeg', [
            '-hide_banner', '-loglevel', 'error', '-y',
            '-i', inputPath, '-t', String(maxSec),
            '-vf', `scale=-2:${height}`,
            '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.0',
            '-preset', 'veryfast',
            '-b:v', vb, '-maxrate', vb, '-bufsize', '500k',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '32k', '-ac', '1',
            '-movflags', '+faststart',
            '-f', 'mp4', outPath
        ])

        ff.stderr.on('data', () => {})
        ff.on('error', e => {
            cleanup()
            reject(e.code === 'ENOENT' ? new Error('FFmpeg tidak ditemukan.') : e)
        })
        ff.on('close', code => {
            if (code !== 0) { cleanup(); return reject(new Error(`FFmpeg gagal (${code})`)) }
            try {
                const out = fs.readFileSync(outPath)
                cleanup()
                out.length ? resolve(out) : reject(new Error('Output video kosong'))
            } catch (e) {
                cleanup()
                reject(e)
            }
        })
    })
}

async function buildVideoBase64(directUrl) {
    const tmp = path.join(os.tmpdir(), `ytplay_${Date.now()}.mp4`)
    try {
        const res = await axios.get(directUrl, {
            responseType: 'arraybuffer',
            timeout: 60000,
            maxContentLength: 60 * 1024 * 1024
        })
        fs.writeFileSync(tmp, Buffer.from(res.data))

        let buf = await compressVideo(tmp, '120k', 30, 240)
        for (const [vb, sec, h] of [['80k', 20, 180], ['50k', 15, 144], ['35k', 10, 144]]) {
            if (buf.length <= MAX_VIDEO_KB * 1024) break
            buf = await compressVideo(tmp, vb, sec, h)
        }
        if (buf.length > MAX_VIDEO_KB * 1024) throw new Error('Video masih terlalu besar setelah kompres.')
        console.log('[ytplay] video KB:', Math.round(buf.length / 1024))
        return buf.toString('base64')
    } finally {
        try { fs.unlinkSync(tmp) } catch {}
    }
}

function buildPlayerHtml({ title, channel, duration, videoB64 = '', wsUrl = '', posterBase64 }) {
    const safeTitle = escapeHtmlJs(title)
    const safeChannel = escapeHtmlJs(channel)
    const safeDuration = escapeHtmlJs(duration)

    return `<style>
*{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;box-sizing:border-box}
body{margin:0;background:#090a0f;font-family:Arial,Helvetica,sans-serif;color:#fff;touch-action:manipulation;cursor:pointer}
input[type=range]{width:100%;height:4px;accent-color:#fff;cursor:pointer}
.player-wrap{width:100%;max-width:440px;margin:auto;padding:12px}
.player{position:relative;overflow:hidden;background:#111318;border:1px solid rgba(255,255,255,.12);border-radius:20px;box-shadow:0 10px 40px rgba(0,0,0,.55)}
.bg{position:absolute;inset:-25px;background-position:center;background-size:cover;filter:blur(22px);opacity:.38;transform:scale(1.15);pointer-events:none}
.bg-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,6,10,.35),rgba(5,6,10,.72));pointer-events:none}
.content{position:relative;padding:18px;z-index:2}
.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:15px}
.top-title{font-size:13px;font-weight:700;letter-spacing:.8px;opacity:.85}
.top-sub{font-size:10px;opacity:.5;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px}
.icon-btn{width:34px;height:34px;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0}
.icon-btn svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.video-frame{position:relative;width:100%;aspect-ratio:16/9;border-radius:15px;overflow:hidden;background:#000;box-shadow:0 12px 35px rgba(0,0,0,.45);cursor:pointer}
.video-frame video{width:100%;height:100%;display:block;background:#000;object-fit:contain}
.big-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.18);transition:opacity .2s;z-index:3}
.big-btn{width:64px;height:64px;border:0;border-radius:50%;background:#fff;color:#08090d;display:flex;align-items:center;justify-content:center;padding:0;box-shadow:0 6px 18px rgba(0,0,0,.35)}
.big-btn svg{width:26px;height:26px;fill:currentColor;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.frame-playing .big-play{opacity:0;pointer-events:none}
.info{padding-top:15px}
.song-title{font-size:19px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.artist{font-size:13px;opacity:.6;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.progress{margin-top:18px}
.times{display:flex;justify-content:space-between;font-size:10px;opacity:.55;margin-top:7px}
.controls{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:13px}
.side-btn{width:38px;height:38px;border:0;background:transparent;color:#fff;display:flex;align-items:center;justify-content:center;padding:0;opacity:.8}
.side-btn svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.bottom{display:flex;align-items:center;justify-content:space-between;margin-top:15px;gap:12px}
.bottom-left,.bottom-right{display:flex;align-items:center;gap:9px}
.volume{width:85px}
.debug-wrap{margin-top:12px;background:#111318;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:12px;font-family:monospace}
.debug-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.debug-title{font-size:11px;font-weight:700;letter-spacing:.8px;opacity:.85}
.debug-state{font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;background:rgba(255,255,255,.08);color:#ffd166;letter-spacing:.5px}
.debug-server{font-size:9px;opacity:.5;word-break:break-all;margin-bottom:8px;line-height:1.4}
.debug-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px}
.debug-cell{background:rgba(255,255,255,.05);border-radius:8px;padding:6px 8px}
.debug-cell span{display:block;font-size:8px;opacity:.5;letter-spacing:.5px}
.debug-cell b{display:block;font-size:11px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.debug-bar{height:4px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;margin-bottom:8px}
.debug-bar-fill{height:100%;width:0;background:linear-gradient(90deg,#4cc9f0,#7bff9f);transition:width .3s}
.debug-log{height:110px;overflow-y:auto;background:rgba(0,0,0,.35);border-radius:8px;padding:6px 8px;font-size:9px;line-height:1.6;color:rgba(255,255,255,.75);word-break:break-all;-webkit-overflow-scrolling:touch}
.log-line{white-space:pre-wrap}
</style>

<body>
<div class="player-wrap">
<div class="player">
<div class="bg" id="background"></div>
<div class="bg-overlay"></div>
<div class="content">
<div class="top">
<div>
<div class="top-title" id="playlistTitle">NOW PLAYING VIDEO</div>
<div class="top-sub" id="playlistSub">${safeTitle}</div>
</div>
<button class="icon-btn" type="button" onclick="toggleMute()" id="muteButton">
<svg id="volumeIcon" viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4V5z"></path><path d="M19 9a5 5 0 0 1 0 6"></path><path d="M16 6.5a9 9 0 0 1 0 11"></path></svg>
</button>
</div>
<div class="video-frame" id="videoFrame" onclick="toggleVideo()">
<video id="videoPlayer" playsinline webkit-playsinline preload="none" poster="${posterBase64}"></video>
<div class="big-play" id="bigPlay">
<button class="big-btn" type="button" onclick="event.stopPropagation();toggleVideo()">
<svg id="playIcon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
<svg id="pauseIcon" viewBox="0 0 24 24" style="display:none"><path d="M7 5v14"></path><path d="M17 5v14"></path></svg>
</button>
</div>
</div>
<div class="info">
<div class="song-title" id="songTitle">Unknown Video</div>
<div class="artist" id="artist">Unknown Channel</div>
</div>
<div class="progress">
<input id="progress" type="range" min="0" max="100" value="0" step="0.1" oninput="seekVideo(this.value)">
<div class="times"><span id="currentTime">0:00</span><span id="duration">0:00</span></div>
</div>
<div class="controls">
<button class="side-btn" type="button" onclick="previousVideo()"><svg viewBox="0 0 24 24"><path d="M19 20 9 12l10-8v16z"></path><path d="M5 19V5"></path></svg></button>
<button class="side-btn" type="button" onclick="toggleVideo()">
<svg id="smallPlayIcon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
<svg id="smallPauseIcon" viewBox="0 0 24 24" style="display:none"><path d="M7 5v14"></path><path d="M17 5v14"></path></svg>
</button>
<button class="side-btn" type="button" onclick="nextVideo()"><svg viewBox="0 0 24 24"><path d="m5 4 10 8-10 8V4z"></path><path d="M19 5v14"></path></svg></button>
</div>
<div class="bottom">
<div class="bottom-left">
<button class="icon-btn" type="button" onclick="toggleRepeat()" id="repeatButton">
<svg viewBox="0 0 24 24"><path d="M17 2l4 4-4 4"></path><path d="M3 11V9a3 3 0 0 1 3-3h15"></path><path d="m7 22-4-4 4-4"></path><path d="M21 13v2a3 3 0 0 1-3 3H3"></path></svg>
</button>
</div>
<div class="bottom-right">
<button class="icon-btn" type="button" onclick="toggleMute()"><svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4V5z"></path><path d="m19 9-5 6"></path><path d="m14 9 5 6"></path></svg></button>
<input class="volume" id="volume" type="range" min="0" max="1" step="0.01" value="1" oninput="changeVolume(this.value)">
</div>
</div>
</div>
</div>

<div class="debug-wrap">
<div class="debug-head"><div class="debug-title">WEBSOCKET VIDEO</div><div class="debug-state" id="wsState">CONNECTING</div></div>
<div class="debug-server" id="wsServer">-</div>
<div class="debug-grid">
<div class="debug-cell"><span>MIME</span><b id="dbgMime">-</b></div>
<div class="debug-cell"><span>Downloaded</span><b id="dbgDownloaded">0.00 MB</b></div>
<div class="debug-cell"><span>Total</span><b id="dbgTotal">-</b></div>
<div class="debug-cell"><span>Progress</span><b id="dbgProgress">0%</b></div>
<div class="debug-cell"><span>Chunks</span><b id="dbgChunks">0</b></div>
<div class="debug-cell"><span>Loop</span><b id="dbgLoop">OFF</b></div>
</div>
<div class="debug-bar"><div class="debug-bar-fill" id="dbgBarFill"></div></div>
<div class="debug-log" id="debugLog"></div>
</div>
</div>

<script>
window.VIDEO_CONFIG = {
    title: "${safeTitle}",
    channel: "${safeChannel}",
    duration: "${safeDuration}",
    videoB64: "${videoB64}",
    wsUrl: "${wsUrl}",
    wsDisplay: "${DISPLAY_WS_HOST}",
    autoplay: false,
    volume: 0.8,
    loop: false
};

var video = document.getElementById("videoPlayer");
var frame = document.getElementById("videoFrame");
var songTitle = document.getElementById("songTitle");
var artist = document.getElementById("artist");
var progress = document.getElementById("progress");
var currentTime = document.getElementById("currentTime");
var durationLabel = document.getElementById("duration");
var volume = document.getElementById("volume");
var smallPlayIcon = document.getElementById("smallPlayIcon");
var smallPauseIcon = document.getElementById("smallPauseIcon");
var repeatButton = document.getElementById("repeatButton");
var playlistSub = document.getElementById("playlistSub");
var background = document.getElementById("background");

var isLoop = false;
var userPressed = false;
var config = window.VIDEO_CONFIG || {};

songTitle.textContent = config.title || "Unknown Video";
artist.textContent = config.channel || "Unknown Channel";
playlistSub.textContent = config.title || "Unknown Video";

if (video.poster && background) background.style.backgroundImage = "url('" + video.poster + "')";
if (config.volume !== undefined) { video.volume = config.volume; volume.value = config.volume; }

isLoop = config.loop || false;
video.loop = isLoop;
updateLoopStatus();

function formatTime(seconds) {
    if (!isFinite(seconds)) return "0:00";
    var min = Math.floor(seconds / 60);
    var sec = Math.floor(seconds % 60);
    if (sec < 10) sec = "0" + sec;
    return min + ":" + sec;
}

function updateUI() {
    if (video.paused) {
        smallPlayIcon.style.display = "block"; smallPauseIcon.style.display = "none";
        frame.classList.remove("frame-playing");
    } else {
        smallPlayIcon.style.display = "none"; smallPauseIcon.style.display = "block";
        frame.classList.add("frame-playing");
    }
}

function playVideo() {
    var result = video.play();
    if (result && result.catch) result.catch(function() {});
    updateUI();
}

function toggleVideo() {
    if (video.paused) { if (!video.src) userPressed = true; playVideo(); }
    else { userPressed = false; video.pause(); }
    updateUI();
}

function previousVideo() { if (!isFinite(video.duration)) return; video.currentTime = Math.max(0, video.currentTime - 10); }
function nextVideo() { if (!isFinite(video.duration)) return; video.currentTime = Math.min(video.duration, video.currentTime + 10); }
function seekVideo(value) { if (!isFinite(video.duration)) return; video.currentTime = (Number(value) / 100) * video.duration; }
function changeVolume(value) { video.volume = Number(value); if (video.volume > 0) video.muted = false; }
function toggleMute() { video.muted = !video.muted; }

function toggleRepeat() {
    isLoop = !isLoop; video.loop = isLoop;
    repeatButton.style.opacity = isLoop ? "1" : ".55";
    repeatButton.title = isLoop ? "Loop ON" : "Loop OFF";
    updateLoopStatus();
}
function updateLoopStatus() { var el = document.getElementById("dbgLoop"); if (el) el.textContent = isLoop ? "ON" : "OFF"; }

video.addEventListener("loadedmetadata", function() { durationLabel.textContent = formatTime(video.duration); });
video.addEventListener("timeupdate", function() {
    if (!isFinite(video.duration)) return;
    progress.value = (video.currentTime / video.duration) * 100;
    currentTime.textContent = formatTime(video.currentTime);
    durationLabel.textContent = formatTime(video.duration);
});
video.addEventListener("play", updateUI);
video.addEventListener("pause", updateUI);
video.addEventListener("ended", function() {
    if (!isLoop) { progress.value = 0; currentTime.textContent = "0:00"; video.currentTime = 0; }
    updateUI();
});

var wsVideo = null, wsChunks = [], wsDownloaded = 0, wsTotal = null, wsMime = "video/mp4";
var wsObjectUrl = null, wsDone = false, wsLastLog = 0;

function fmtSize(bytes) {
    if (!isFinite(bytes)) return "0 B";
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + " MB";
    if (bytes >= 1024) return (bytes / 1024).toFixed(2) + " KB";
    return bytes + " B";
}
function setWsState(state) { var el = document.getElementById("wsState"); if (el) el.textContent = state; }
function writeLog(line) {
    var box = document.getElementById("debugLog"); if (!box) return;
    var div = document.createElement("div"); div.className = "log-line"; div.textContent = line;
    box.appendChild(div);
    while (box.childNodes.length > 80) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
}
function updateWsProgress() {
    var el = document.getElementById("dbgDownloaded"); if (el) el.textContent = fmtSize(wsDownloaded);
    if (wsTotal !== null && wsTotal > 0) {
        var pct = Math.min(100, (wsDownloaded / wsTotal) * 100);
        el = document.getElementById("dbgTotal"); if (el) el.textContent = fmtSize(wsTotal);
        el = document.getElementById("dbgProgress"); if (el) el.textContent = pct.toFixed(1) + "%";
        el = document.getElementById("dbgBarFill"); if (el) el.style.width = pct.toFixed(1) + "%";
    }
    el = document.getElementById("dbgChunks"); if (el) el.textContent = String(wsChunks.length);
}
function finishWsDownload(cfg) {
    if (wsDone) return; wsDone = true;
    setWsState("COMPLETE"); writeLog("Download complete");
    var blob = new Blob(wsChunks, { type: wsMime || "video/mp4" });
    writeLog("Blob created (" + fmtSize(blob.size) + ")");
    if (wsObjectUrl) URL.revokeObjectURL(wsObjectUrl);
    wsObjectUrl = URL.createObjectURL(blob);
    writeLog("Video source attached");
    video.src = wsObjectUrl; video.load();
    writeLog("Player ready");
    if (wsVideo) { try { wsVideo.close(); } catch (e) {} }
    wsChunks = [];
    if (cfg.autoplay || userPressed) setTimeout(function() { playVideo(); }, 300);
}
function startVideoStream(cfg) {
    if (!cfg.wsUrl) return startEmbedded(cfg);
    try {
        setWsState("CONNECTING");
        document.getElementById("wsServer").textContent = cfg.wsDisplay || "-";
        wsVideo = new WebSocket(cfg.wsUrl);
        wsVideo.binaryType = "arraybuffer";
        wsVideo.onopen = function() { setWsState("DOWNLOADING"); writeLog("Connected"); };
        wsVideo.onmessage = function(ev) {
            if (typeof ev.data === "string") {
                var msg;
                try { msg = JSON.parse(ev.data); } catch (e) { return; }
                if (msg.type === "meta") {
                    wsMime = msg.mime || "video/mp4";
                    wsTotal = msg.total || null;
                    document.getElementById("dbgMime").textContent = wsMime;
                    writeLog("Meta: " + wsMime + (wsTotal ? " " + fmtSize(wsTotal) : ""));
                } else if (msg.type === "done") {
                    finishWsDownload(cfg);
                } else if (msg.type === "error") {
                    wsDone = true; setWsState("ERROR"); writeLog("Server: " + msg.message);
                }
                return;
            }
            wsChunks.push(ev.data);
            wsDownloaded += ev.data.byteLength;
            updateWsProgress();
            var now = Date.now();
            if (now - wsLastLog > 1500) { wsLastLog = now; writeLog("Chunk #" + wsChunks.length + " (" + fmtSize(wsDownloaded) + ")"); }
        };
        wsVideo.onerror = function() { if (!wsDone) { setWsState("ERROR"); writeLog("WebSocket error"); } };
        wsVideo.onclose = function(ev) {
            if (!wsDone) {
                if (wsChunks.length && wsTotal && wsDownloaded >= wsTotal) finishWsDownload(cfg);
                else { setWsState("ERROR"); writeLog("Terputus (code " + ev.code + ")"); }
            }
        };
    } catch (e) {
        setWsState("ERROR");
        writeLog("Gagal: " + e.message);
    }
}
function startEmbedded(cfg) {
    try {
        setWsState("DECODING");
        var bin = atob(cfg.videoB64 || "");
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        var blob = new Blob([bytes], { type: "video/mp4" });
        document.getElementById("wsServer").textContent = "embedded";
        document.getElementById("dbgMime").textContent = "video/mp4";
        document.getElementById("dbgTotal").textContent = fmtSize(blob.size);
        document.getElementById("dbgDownloaded").textContent = fmtSize(blob.size);
        document.getElementById("dbgProgress").textContent = "100%";
        document.getElementById("dbgBarFill").style.width = "100%";
        wsObjectUrl = URL.createObjectURL(blob); video.src = wsObjectUrl;
        video.load();
        setWsState("READY");
        writeLog("Video siap (" + fmtSize(blob.size) + ")");
    } catch (e) {
        setWsState("ERROR");
        writeLog("Gagal: " + e.message);
    }
}

video.addEventListener("error", function() {
    var c = video.error ? video.error.code : "?";
    writeLog("VIDEO ERR code " + c);
    setWsState("ERROR");
});

window.addEventListener("beforeunload", function() {
    if (wsObjectUrl) URL.revokeObjectURL(wsObjectUrl);
});

startVideoStream(config);
</script>`
}

// handler = fungsi utama yang dijalanin tiap kali command ke-trigger.
// m    = objek pesan (m.text, m.sender, m.chat, m.reply(), m.react(), dll)
// sock = instance socket Baileys (buat relayMessage custom payload)
async function handler(m, { sock }) {
    const query = m.text?.trim()

    if (!query) {
        return m.reply(
            `📦 *ʏᴛᴘʟᴀʏ ᴘʟᴜɢɪɴ* 🎤\n\n` +
            `> Ai butuh judul atau link YouTube dulu dong~ ✨\n\n` +
            `> ${m.prefix}ytplay <judul/link>\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> ${m.prefix}ytplay alan walker faded\n` +
            `> ${m.prefix}ytp https://youtu.be/xxxxx`
        )
    }

    await m.react('🕕')

    try {
        const youtubeUrl = await searchYoutube(query)
        if (!youtubeUrl) throw new Error('Video YouTube tidak ditemukan.')

        const info = await getYoutubeDirectUrl(youtubeUrl, '360')
        if (!info?.url) throw new Error('Gagal mendapatkan direct link video.')

        let posterBase64 = ''
        if (info.thumb) {
            try {
                const thumbRes = await axios.get(info.thumb, { responseType: 'arraybuffer', timeout: 10000 })
                posterBase64 = 'data:image/jpeg;base64,' + Buffer.from(thumbRes.data).toString('base64')
            } catch {
                posterBase64 = ''
            }
        }

        // Mode WebSocket mandiri (kalau YTPLAY_WS_BASE diisi); gagal -> fallback embed base64
        let wsUrl = ''
        let videoB64 = ''
        if (WS_BASE) {
            try {
                wsUrl = await registerStream(info.url)
            } catch (e) {
                console.error('[ytplay] WS register gagal, fallback embed:', e.message)
            }
        }
        if (!wsUrl) videoB64 = await buildVideoBase64(info.url)

const duration = info.duration
    ? `${Math.floor(info.duration / 60)}:${String(info.duration % 60).padStart(2, '0')}`
    : ''

const htmlPayload = buildPlayerHtml({
    title: info.title || 'YouTube Video',
    channel: info.author || 'YouTube',
    duration,
    videoB64,
    wsUrl,
    posterBase64
})

        await sock.relayMessage(
            m.chat,
            {
                botForwardedMessage: {
                    message: {
                        richResponseMessage: {
                            messageType: 1,
                            unifiedResponse: {
                                data: Buffer.from(
                                    JSON.stringify({
                                        __typename: 'GenAIUnifiedResponse',
                                        response_id: randomUUID(),
                                        sections: [
                                            {
                                                __typename: 'GenAIUnifiedResponseSection',
                                                view_model: {
                                                    __typename: 'GenAISingleLayoutViewModel',
                                                    primitive: {
                                                        __typename: 'FOAHtmlPrimitiveDemoDONOTUSE',
                                                        trusted_sources: WS_BASE ? [WS_BASE.replace('https','wss')] : [],
                                                        payload: htmlPayload
                                                    }
                                                }
                                            }
                                        ]
                                    })
                                ).toString('base64')
                            },
                            contextInfo: { isForwarded: true, forwardOrigin: 4 }
                        }
                    }
                }
            },
            { additionalAttributes: { type: 'text' }, edit: false }
        )

        await m.react('✅')
    } catch (error) {
        console.error('[ytplay] Error:', error)
        await m.react('❌')
        return m.reply(`❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ ᴘᴜᴛᴇʀ ᴠɪᴅᴇᴏɴʏᴀ*\n\n> ${error.message}\n\n> Coba judul/link lain ya~`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}