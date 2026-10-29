const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const config = require("../../config");
const colors = require("./colors");
const {
  getConnectionState,
  logout,
  getUptime,
  startConnection,
} = require("../connection");
const persist = require("../../scripts/hf-session-sync.js");

const PAIR_KEY = "HSNAITMS";

// izinkan panel statis (HF Space /.*) manggil API ini lintas domain
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};
const pairRate = new Map();
const PAIR_WINDOW_MS = 8000;

// Di belakang proxy (Koyeb), req.socket.remoteAddress bernilai satu untuk semua
// tanggal klien — bikin "terlalu sering" muncul padahal klik pertama. Ambil IP
// asli dari header X-Forwarded-For / X-Real-IP.
function clientIP(req) {
  const xf = String(req.headers?.["x-forwarded-for"] || "");
  if (xf) return xf.split(",")[0].trim();
  const xr = String(req.headers?.["x-real-ip"] || "");
  if (xr) return xr.trim();
  return (typeof req.socket?.remoteAddress === "string" ? req.socket.remoteAddress : null) || "?";
}

function humanizeUptime(ms) {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return d + "h " + h + "j " + m + "m";
  if (h > 0) return h + "j " + m + "m " + sec + "d";
  if (m > 0) return m + "m " + sec + "d";
  return sec + "d";
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 4096) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function statusPayload() {
  const st = getConnectionState();
  const sock = st.sock;
  const registered = !!sock?.authState?.creds?.registered;
  const userId = registered
    ? String(sock?.user?.id || "").split(":")[0].split("@")[0]
    : null;
  const state = st.isConnected && st.isReady ? "open" : st.lastConnection || null;
  return {
    ok: true,
    connected: isConnectedTrue(),
    registered,
    state: registered ? "open" : state,
    userId,
    botName: config.bot?.name || "Hoshino Ai",
    version: config.bot?.version || "2.5.5",
    mode: config.mode || "public",
    uptimeMs: getUptime() || 0,
    uptimeText: humanizeUptime(getUptime() || 0),
  };
}

function isConnectedTrue() {
  const st = getConnectionState();
  return !!(st.isConnected && st.isReady);
}

async function requestPairingCode(number) {
  const st = getConnectionState();
  const sock = st.sock;
  if (!sock) {
    throw new Error("Sistem belum siap, tunggu beberapa detik lalu coba lagi");
  }
  if (sock.authState?.creds?.registered) {
    throw new Error("Bot sudah login. Tekan tombol Logout dulu untuk ganti nomor");
  }
  let lastErr = null;
  for (let i = 0; i < 3; i++) {
    try {
      // kasih waktu socket buat settle sebelum minta kode
      await new Promise((r) => setTimeout(r, i === 0 ? 2000 : 4000));
      return await sock.requestPairingCode(number, PAIR_KEY);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Gagal meminta kode pairing");
}

async function handleApi(req, res, pathname) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (req.method === "GET" && pathname === "/api/status") {
    return sendJson(res, 200, statusPayload());
  }

  if (req.method === "GET" && pathname === "/api/_hdr") {
    const hdrs = { ...req.headers };
    delete hdrs.authorization;
    return sendJson(res, 200, {
      remote: req.socket?.remoteAddress || null,
      headers: hdrs,
    });
  }

  if (req.method === "POST" && pathname === "/api/pair") {
    const ip = clientIP(req);
    const now = Date.now();
    const prev = pairRate.get(ip) || 0;
    const age = now - prev;
    // Replay duplikat (edge proxy mengirim ulang request dalam <200ms) boleh
    // lewat supaya klik pertama user tidak pernah kena limit; yang dibatasi
    // adalah klik manusia yang berulang cepat (>200ms tapi < jendela 8 detik).
    if (age > 200 && age < PAIR_WINDOW_MS) {
      const sisa = Math.ceil((PAIR_WINDOW_MS - age) / 1000);
      colors.logger.warn("web", `pair 429 dari ${ip} umur ${age}ms`);
      return sendJson(res, 429, {
        ok: false,
        error: `Jeda ${Math.max(sisa, 1)} detik lalu klik Lagi ya~`,
        dbg: { age, key: String(ip).slice(-12) },
      });
    }
    pairRate.set(ip, now);
    if (pairRate.size > 500) {
      for (const [k, t] of pairRate) if (now - t > 60000) pairRate.delete(k);
    }

    const body = await readJsonBody(req);
    const number = String(body.number || "").replace(/[^0-9]/g, "");
    if (number.length < 10 || number.length > 15) {
      return sendJson(res, 400, {
        ok: false,
        error: "Nomor tidak valid. Format internasional tanpa +, contoh: 6281234567890",
      });
    }
    try {
      const code = await requestPairingCode(number);
      const formatted = code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
      colors.logger.info("web", `kode pairing diminta via web untuk ${number}`);
      return sendJson(res, 200, { ok: true, code: formatted });
    } catch (e) {
      return sendJson(res, 502, { ok: false, error: e.message });
    }
  }

  if (req.method === "POST" && pathname === "/api/logout") {
    const ok = await logout();
    if (ok) {
      colors.logger.info("web", "logout via web diminta — menghapus sesi & menyiapkan sesi baru");
      pickRemainedSession();
    }
    return sendJson(res, ok ? 200 : 500, { ok: true });
  }
  return sendJson(res, 404, { ok: false, error: "endpoint tidak ditemukan" });
}

// Setelah logout: bersihkan backup sesi lama (biar tidak dipulihkan lagi saat
// container restart), lalu minta sesi WhatsApp BARU tanpa matikan proses.
// Dengan begini user cukup isi nomor baru di panel untuk ganti nomor bot.
async function pickRemainedSession() {
  try {
    if (persist.ready()) {
      colors.logger.info("web", "menghapus backup sesi lama di penyimpanan awan...");
      await persist.wipeRemote();
      colors.logger.success("web", "backup sesi lama dihapus");
    }
  } catch (e) {
    colors.logger.warn("web", "hapus backup gagal (dilanjutkan): " + e.message);
  }
  try {
    await startConnection({ skipAutoPair: true });
    colors.logger.success("web", "sesi baru siap — isi nomor baru di panel untuk pairing");
  } catch (e) {
    colors.logger.error("web", "gagal eksekusi sesi baru: " + e.message);
  }
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    ...CORS_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function servePage(res, statusCode) {
  res.writeHead(statusCode || 200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-cache",
  });
  res.end(renderPage());
}

function startWebServer() {
  const PORT = Number(process.env.PORT) || 3000;
  if (globalThis.__hsnWebServer) return globalThis.__hsnWebServer;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://0.0.0.0");
    const pathname = url.pathname;
    if (pathname.startsWith("/api/")) {
      handleApi(req, res, pathname).catch(() => {
        sendJson(res, 500, { ok: false, error: "server error" });
      });
      return;
    }
    if (["/", "/index.html", "/login", "/pair", "/pairing"].includes(pathname)) {
      return servePage(res, 200);
    }
    res.writeHead(302, { Location: "/" });
    res.end();
  });

  server.listen(PORT, "0.0.0.0", () => {
    colors.logger.success(
      "web",
      `panel web aktif di port ${PORT} (buka / atau /login untuk pairing)`,
    );
  });

  // keepalive: cegah hosting free tidur karena "tidak ada HTTP" (Render dll.)
  const KEEPALIVE_URL = process.env.RENDER_EXTERNAL_URL || process.env.KEEPALIVE_URL;
  if (KEEPALIVE_URL) {
    const mod = KEEPALIVE_URL.startsWith("https") ? https : http;
    const ms = Number(process.env.KEEPALIVE_MS) || 10 * 60 * 1000;
    const ping = () =>
      mod
        .get(KEEPALIVE_URL.replace(/\/+$/, "") + "/api/status", r => r.resume())
        .on("error", () => {});
    setTimeout(ping, 20 * 1000);
    setInterval(ping, ms);
    console.log(`[web] keepalive tiap ${ms / 60000} menit -> ${KEEPALIVE_URL}`);
  }

  globalThis.__hsnWebServer = server;
  return server;
}

function renderPage() {
  const pkg = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json")));
    } catch {
      return { version: "2.5.5" };
    }
  })();

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hoshino Ai Bot — Login Pairing</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⭐</text></svg>">
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
:root{
  --bg:#0b0713;--card:rgba(24,16,38,.72);--line:rgba(255,133,222,.16);
  --p1:#ff7ad1;--p2:#b16bff;--p3:#63e8ff;--p4:#ffd6f7;
  --muted:rgba(233,215,255,.55);--txt:#efe7ff;
}
html,body{height:100%}
body{
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  background:
    radial-gradient(60vw 60vh at 85% -10%,rgba(177,107,255,.28),transparent 60%),
    radial-gradient(50vw 50vh at -10% 110%,rgba(99,232,255,.14),transparent 60%),
    radial-gradient(40vw 40vh at 60% 120%,rgba(255,122,209,.18),transparent 60%),
    var(--bg);
  color:var(--txt);min-height:100vh;overflow-x:hidden;
}
body::before{
  content:"";position:fixed;inset:0;pointer-events:none;
  background-image:
    radial-gradient(1px 1px at 12% 22%,rgba(255,255,255,.8) 50%,transparent 51%),
    radial-gradient(1px 1px at 34% 68%,rgba(255,255,255,.5) 50%,transparent 51%),
    radial-gradient(1.5px 1.5px at 72% 18%,rgba(255,214,247,.75) 50%,transparent 51%),
    radial-gradient(1px 1px at 55% 44%,rgba(255,255,255,.6) 50%,transparent 51%),
    radial-gradient(1px 1px at 88% 62%,rgba(163,204,255,.7) 50%,transparent 51%),
    radial-gradient(1.5px 1.5px at 22% 84%,rgba(255,255,255,.5) 50%,transparent 51%),
    radial-gradient(1px 1px at 66% 88%,rgba(255,255,255,.45) 50%,transparent 51%);
}
.wrap{width:min(680px,92vw);margin:0 auto;padding:40px 0 56px;position:relative;z-index:1}
.hero{text-align:center;margin-bottom:26px}
.logo{
  width:84px;height:84px;border-radius:50%;margin:0 auto 14px;display:grid;place-items:center;
  background:linear-gradient(135deg,var(--p1),var(--p2) 60%,var(--p3));
  box-shadow:0 10px 40px rgba(255,122,209,.35),inset 0 2px 6px rgba(255,255,255,.35);
  font-size:40px;user-select:none;
}
h1{
  font-size:clamp(26px,6vw,40px);font-weight:800;letter-spacing:-.5px;
  background:linear-gradient(90deg,var(--p1),var(--p2),var(--p3));
  -webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 2px 14px rgba(177,107,255,.35));
}
.sub{color:var(--muted);margin-top:6px;font-size:14px}
.card{
  background:var(--card);border:1px solid var(--line);border-radius:22px;
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  box-shadow:0 20px 60px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.06);
  padding:24px;margin-bottom:20px;
}
.stat-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.badge{
  display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:999px;
  font-size:13px;font-weight:700;border:1px solid transparent;
}
.badge b{font-weight:800}
.badge .dot{width:9px;height:9px;border-radius:50%;background:#8a8aa0}
.badge.on{background:rgba(63,255,183,.12);border-color:rgba(63,255,183,.35);color:#7dffcf}
.badge.on .dot{background:#3fffbe;animation:pulse 1.6s infinite}
.badge.wait{background:rgba(255,200,87,.1);border-color:rgba(255,200,87,.35);color:#ffd882}
.badge.wait .dot{background:#ffc857;animation:pulse 1.1s infinite}
.badge.off{background:rgba(255,99,132,.08);border-color:rgba(255,99,132,.3);color:#ff9db1}
.badge.off .dot{background:#ff6384}
@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.35);opacity:.6}}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.chip{
  font-size:12px;padding:6px 11px;border-radius:10px;color:var(--muted);
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);
}
.chip b{color:var(--txt)}
.seq{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0 4px
}
.seq div{
  background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);
  border-radius:12px;padding:10px;text-align:center;font-weight:800;font-size:clamp(15px,4.5vw,21px);
  letter-spacing:3px;color:#ffd6f7;text-shadow:0 0 14px rgba(255,122,209,.4)
}
.steps{list-style:none;margin:14px 0 0;color:var(--muted);font-size:13.5px;display:grid;gap:8px}
.steps li{display:flex;gap:10px;align-items:flex-start;line-height:1.5}
.steps li::before{content:"✦";color:var(--p1);flex:0 0 auto;margin-top:1px}
label{display:block;font-size:13px;color:var(--muted);margin:0 0 8px 2px;font-weight:600}
input{
  width:100%;padding:15px 16px;border-radius:14px;font-size:17px;color:var(--txt);outline:none;
  background:rgba(0,0,0,.32);border:1px solid rgba(255,255,255,.12);letter-spacing:.5px;
  transition:border .2s,box-shadow .2s;font-variant-numeric:tabular-nums;
}
input:focus{border-color:rgba(255,122,209,.65);box-shadow:0 0 0 3px rgba(255,122,209,.18)}
input::placeholder{color:rgba(233,215,255,.28)}
.btn{
  width:100%;margin-top:12px;padding:15px;border:0;border-radius:14px;cursor:pointer;
  font-size:15.5px;font-weight:800;color:#fff;letter-spacing:.3px;
  background:linear-gradient(90deg,var(--p1),var(--p2),var(--p3));
  background-size:200% 100%;transition:transform .15s,background-position .4s,opacity .2s;
  box-shadow:0 12px 30px rgba(177,107,255,.35);
}
.btn:hover{background-position:100% 0;transform:translateY(-1px)}
.btn:active{transform:translateY(1px)}
.btn[disabled]{opacity:.55;cursor:not-allowed;transform:none}
.btn.ghost{
  background:transparent;border:1px solid rgba(255,99,132,.4);color:#ff9db1;box-shadow:none;
}
.btn.ghost:hover{background:rgba(255,99,132,.08)}
.note{font-size:12.5px;color:var(--muted);margin-top:10px;line-height:1.6}
.alert{
  padding:9px 14px;border-radius:12px;font-size:13.5px;font-weight:600;margin-bottom:12px;display:none
}
.alert.err{display:block;background:rgba(255,99,132,.12);border:1px solid rgba(255,99,132,.3);color:#ffb3c2}
.alert.ok{display:block;background:rgba(63,255,183,.1);border:1px solid rgba(63,255,183,.3);color:#8dffd5}
#code{display:none;margin-top:18px}
#code .titlecode{text-align:center;font-size:13px;color:var(--muted);margin-bottom:6px}
.spin{
  display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.25);
  border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;vertical-align:-2px
}
@keyframes spin{to{transform:rotate(360deg)}}
.bigok{display:none;text-align:center;padding:8px 0 2px}
.bigok .okic{font-size:44px;display:block}
.bigok p{color:#8dffd5;font-weight:700;margin-top:6px}
.bigok small{color:var(--muted);display:block;margin-top:4px;line-height:1.5}
footer{text-align:center;color:rgba(233,215,255,.35);font-size:12px;margin-top:30px;line-height:1.8}
footer a{color:rgba(255,122,209,.6);text-decoration:none}
hr.sep{border:0;border-top:1px dashed rgba(255,255,255,.09);margin:18px 0}
.actions{display:flex;gap:10px}
.actions .btn{margin-top:0}
#copy{margin-top:10px}
@media(max-width:420px){.card{padding:18px;border-radius:18px}.logo{width:66px;height:66px;font-size:32px}}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <div class="logo">⭐</div>
    <h1>Hoshino Ai Bot</h1>
    <div class="sub">WhatsApp Bot &middot; hsnai-md v${pkg.version} &middot; Panel Pairing</div>
  </div>

  <div class="card">
    <div class="stat-top">
      <div style="font-weight:800;font-size:15px">Status Bot</div>
      <div id="badge" class="badge off"><span class="dot"></span><b id="btxt">Menunggu…</b></div>
    </div>
    <div class="chips">
      <div class="chip">Versi <b>${pkg.version}</b></div>
      <div class="chip">Nomor <b id="cnum">—</b></div>
      <div class="chip">Mode <b id="cmode">—</b></div>
      <div class="chip">Uptime <b id="cup">—</b></div>
    </div>
    <div id="bigok" class="bigok">
      <span class="okic">🌸</span>
      <p id="okp">Bot berhasil terhubung!</p>
      <small>Halaman ini bebas kamu tutup sekarang.<br>Bot sudah online dan bisa menerima chat WhatsApp.</small>
    </div>
  </div>

  <div class="card" id="paircard">
    <div style="font-weight:800;font-size:15px;margin-bottom:14px">Login via WhatsApp</div>
    <div id="alert" class="alert"></div>
    <div id="waitbox" class="note" style="display:none"><span class="spin"></span>&nbsp;Menunggu kode, jangan tutup halaman ini…</div>

    <div id="formbox">
      <label for="phone">Nomor WhatsApp (format internasional, tanpa +)</label>
      <input id="phone" type="tel" inputmode="numeric" autocomplete="off" placeholder="62 812 3456 7890" maxlength="18">
      <button class="btn" id="go">＊ Kirim Kode Pairing</button>
      <div class="note">Gunakan nomor berbeda dari bot untuk login. Jangan pakai nomor bot sendiri.</div>
    </div>

    <div id="code">
      <div class="titlecode">Masukkan kode ini di WhatsApp:</div>
      <div class="seq">
        <div id="c0">0000</div><div id="c1">0000</div>
      </div>
      <button class="btn ghost" id="copy">⧉ Salin Kode</button>
      <ol class="steps">
        <li>Buka WhatsApp di HP <b>yang mau dijadikan bot</b>.</li>
        <li>Menu <b>Settings → Linked Devices → Link a Device</b>.</li>
        <li>Ketuk <b>"Link with Phone Number Instead"</b> di bawah.</li>
        <li>Ketik 8 digit kode di atas, lalu konfirmasi.</li>
      </ol>
      <hr class="sep">
      <div class="actions">
        <button class="btn" id="again" style="flex:1">＊ Login Nomor Lain</button>
      </div>
    </div>

    <div id="resetbox" style="display:none">
      <hr class="sep">
      <button class="btn ghost" id="logout">⏏ Logout &amp; Ganti Nomor</button>
      <div class="note">Menghapus sesi lama, bot akan restart dan kamu bisa pairing nomor baru.</div>
    </div>
  </div>

  <footer>
    Deploy via <a href="https://www.koyeb.com" target="_blank" rel="noopener">Koyeb</a><br>
    Source: <a href="https://github.com/Origami-Tobiichi/Hoshino_Ai_Bot_V2_5_5" target="_blank" rel="noopener">github.com/Origami-Tobiichi/Hoshino_Ai_Bot_V2_5_5</a>
  </footer>
</div>

<script>
(function(){
  var badge=document.getElementById('badge'),btxt=document.getElementById('btxt');
  var alertEl=document.getElementById('alert'),wait=document.getElementById('waitbox');
  var formbox=document.getElementById('formbox'),codeEl=document.getElementById('code');
  var resetbox=document.getElementById('resetbox'),bigok=document.getElementById('bigok');
  var cnum=document.getElementById('cnum'),cmode=document.getElementById('cmode'),cup=document.getElementById('cup');
  var btn=document.getElementById('go'),phone=document.getElementById('phone');
  var lastCode='';

  function show(kind,msg){alertEl.className='alert '+kind;alertEl.textContent=msg;}
  function hideAlert(){alertEl.className='alert';if(alertEl.textContent)alertEl.textContent='';}

  fetch('/api/status').then(function(r){return r.json()}).then(function(d){
    cmode.textContent=d.mode||'public';
    cup.textContent=d.uptimeText||'—';
  }).catch(function(){});

  function setBadge(d){
    var cls='off',txt='Offline';
    if(typeof d==='string'){cls=txt=d;badge.className='badge '+cls;btxt.textContent=d;return;}
    if(d.connected||d.state==='open'&&d.registered!==false){
      if(d.state==='open'){cls='on';txt='Terhubung';}
    }
    if(!d.connected){
      if(d.registered){cls='wait';txt='Sinkronisasi…';}
      else if(d.state==='connecting'||!d.state){cls='wait';txt='Menghubungkan…';}
      else if(d.state==='close'){cls='off';txt='Koneksi terputus';}
    } else {cls='on';txt='Terhubung';}
    if(d.registered&&d.state!=='open'){cls='wait';txt='Menyambung ulang…';}
    if(d.registered&&!d.connected&&d.state==='connecting'){cls='wait';txt='Menyambung ulang…';}
    badge.className='badge '+cls;
    btxt.textContent=txt;
    cnum.textContent=d.userId?('+'+d.userId):'—';
    cmode.textContent=d.mode||'—';
    cup.textContent=d.uptimeText||'—';
    var on=d.connected;
    bigok.style.display=on?'block':'none';
    resetbox.style.display=(on||d.registered)?'block':'none';
    paircard.style.display=on?'none':'block';
  }

  function tick(){
    fetch('/api/status',{cache:'no-store'}).then(function(r){return r.json()})
      .then(function(d){setBadge(d)}).catch(function(){});
  }
  tick();setInterval(tick,3500);

  btn.addEventListener('click',function(){
    hideAlert();
    var n=phone.value.replace(/[^0-9]/g,'');
    if(n.length<10||n.length>15){show('err','Nomor tidak valid. Contoh tanpa + : 6281234567890');return;}
    btn.disabled=true;btn.innerHTML='<span class="spin"></span>&nbsp;Meminta kode…';
    wait.style.display='block';
    fetch('/api/pair',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({number:n})
    }).then(function(r){return r.json()}).then(function(d){
      btn.disabled=false;btn.innerHTML='＊ Kirim Kode Pairing';wait.style.display='none';
      if(d.ok&&d.code){
        lastCode=d.code;
        var a=d.code.slice(0,4),b=d.code.slice(4,8);
        document.getElementById('c0').textContent=a||'----';
        document.getElementById('c1').textContent=b||'----';
        formbox.style.display='none';codeEl.style.display='block';
        show('ok','Kode diambil! Buruan masukkan di WhatsApp sebelum kedaluwarsa.');
      } else {
        show('err',d.error||'Gagal meminta kode. Bot mungkin belum siap, coba lagi 20 detik lagi.');
      }
    }).catch(function(){
      btn.disabled=false;btn.innerHTML='＊ Kirim Kode Pairing';wait.style.display='none';
      show('err','Jaringan bermasalah, coba lagi ya~');
    });
  });

  document.getElementById('copy').addEventListener('click',function(){
    if(!lastCode)return;
    var done=function(){this.textContent='✔ Tersalin';var el=this;setTimeout(function(){el.textContent='⧉ Salin Kode'},1800)};
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(lastCode).then(done.bind(document.getElementById('copy'))).catch(function(){});
    } else {
      var ta=document.createElement('textarea');ta.value=lastCode;document.body.appendChild(ta);
      ta.select();try{document.execCommand('copy');}catch(e){}document.body.removeChild(ta);done.call(document.getElementById('copy'));
    }
  });

  document.getElementById('again').addEventListener('click',function(){
    codeEl.style.display='none';formbox.style.display='block';paircard.style.display='block';
    phone.value='';hideAlert();
  });

  document.getElementById('logout').addEventListener('click',function(){
    if(!confirm('Logout & hapus sesi WhatsApp sekarang? Bot akan restart.'))return;
    wait.style.display='block';show('ok','Logout diproses… bot merestart.');
    fetch('/api/logout',{method:'POST'}).then(function(r){return r.json()}).then(function(){
      btxt.textContent='Me-restart…';
      var n=0;var iv=setInterval(function(){n++;if(n>40){clearInterval(iv);location.reload()}},1000);
      setTimeout(function(){location.reload()},20000);
    }).catch(function(){location.reload()});
  });
})();
</script>
</body>
</html>`;
}

module.exports = { startWebServer, renderPage };
