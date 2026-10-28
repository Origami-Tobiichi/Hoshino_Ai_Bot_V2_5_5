#!/data/data/com.termux/files/usr/bin/bash
# Jalankan bot Hoshino di proot Ubuntu + tunnel cloudflared
# Pemakaian: bash start_pair.sh   (dari folder proyek)
set -u
cd "$(dirname "$0")"
NODEBIN=/root/nodepkg/node-v22.21.1-linux-arm64/bin
export PORT=${PORT:-8000}

get_tunnel_url() {
  grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' cfd.log 2>/dev/null | tail -1
}

echo "[1/3] matikan proses lama..."
pkill -f "node index.js" 2>/dev/null
pkill -f "cloudflared tunnel" 2>/dev/null
sleep 2

# sesi lama yang gagal pairing (unauthorized) harus dibuang agar
# noiseKey yang diblokir server tidak dipakai lagi
if grep -q "Unauthorized" bot.log 2>/dev/null && ! grep -q "isConnected" bot.log; then
  echo "  bersihkan storage/session (sesi lama invalid)..."
  rm -rf storage/session
fi

echo "[2/3] start bot (proot ubuntu, port $PORT, log: bot.log)..."
(proot-distro login ubuntu -- bash -lc "export PATH=$NODEBIN:\$PATH; cd /data/data/com.termux/files/home/Hoshino_Ai_Bot_V2_5_5 && PORT=$PORT exec node index.js > bot.log 2>&1" >/dev/null 2>&1 &)

echo "[3/3] start cloudflared (log: cfd.log)..."
rm -f cfd.log
(proot-distro login ubuntu -- bash -lc "exec /root/cloudflared tunnel --url http://127.0.0.1:$PORT --no-autoupdate > /data/data/com.termux/files/home/Hoshino_Ai_Bot_V2_5_5/cfd.log 2>&1" >/dev/null 2>&1 &)

echo "  menunggu kedua service..."
for i in $(seq 1 24); do
  sleep 5
  TU=$(get_tunnel_url)
  ST=$(curl -s -m 4 "http://127.0.0.1:$PORT/api/status" 2>/dev/null | head -c 40)
  if [ -n "$TU" ] && echo "$ST" | grep -q '"ok":true'; then
    echo "  BOT  OK  : http://127.0.0.1:$PORT"
    echo "  TUNNEL   : $TU"
    echo "  halaman HF: https://itsukakotori79-yorn.static.hf.space"
    exit 0
  fi
done
echo "  belum up — cek bot.log / cfd.log"
exit 1
