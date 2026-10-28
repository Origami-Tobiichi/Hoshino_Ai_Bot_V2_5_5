#!/data/data/com.termux/files/usr/bin/bash
# Watchdog: pastikan bot hidup, cloudflared hidup, dan tunnel.json di HF selalu paling baru
set -u
cd "$(dirname "$0")"
NODEBIN=/root/nodepkg/node-v22.21.1-linux-arm64/bin
PORT=8000
LASTURL=''

while true; do
  termux-wake-lock >/dev/null 2>&1 || true

  # --- bot node ---
  S=$(curl -s -m 6 "http://127.0.0.1:$PORT/api/status" 2>/dev/null)
  if ! echo "$S" | grep -q '"ok":true'; then
    echo "$(date '+%d %H:%M') node mati -> restart" >> watchdog.log
    pkill -f "node index.js" 2>/dev/null
    (proot-distro login ubuntu -- bash -lc "export PATH=$NODEBIN:\$PATH; cd /data/data/com.termux/files/home/Hoshino_Ai_Bot_V2_5_5 && PORT=$PORT exec node index.js > bot.log 2>&1" >/dev/null 2>&1 &)
    sleep 25
  fi

  # --- cloudflared ---
  if ! pgrep -f "cloudflared tunnel" >/dev/null 2>&1; then
    echo "$(date '+%d %H:%M') cloudflared mati -> start" >> watchdog.log
    rm -f cfd.log
    (proot-distro login ubuntu -- bash -lc "exec /root/cloudflared tunnel --url http://127.0.0.1:$PORT --no-autoupdate > /data/data/com.termux/files/home/Hoshino_Ai_Bot_V2_5_5/cfd.log 2>&1" >/dev/null 2>&1 &)
    sleep 14
  fi

  # --- update tunnel.json kalau URL baru ---
  TU=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' cfd.log 2>/dev/null | tail -1)
  if [ -n "$TU" ] && [ "$TU" != "$LASTURL" ]; then
    if curl -s -m 8 "$TU/api/status" 2>/dev/null | grep -q '"ok":true'; then
      echo "$(date '+%d %H:%M') tunnel baru: $TU -> update HF" >> watchdog.log
      bash update_tunnel.sh >> watchdog.log 2>&1 || true
      LASTURL=$TU
    fi
  fi

  sleep 55
done
