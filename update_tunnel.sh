#!/data/data/com.termux/files/usr/bin/bash
# Perbarui tunnel.json di HF Space dengan URL trycloudflare terkini
#   bash update_tunnel.sh [URL]   (tanpa argumen: ambil dari cfd.log)
set -u
cd "$(dirname "$0")"
HF_REPO=${HF_REPO:-itsukakotori79/Yorn}
[ -f .hf_token ] && export HF_TOKEN=$(tr -d ' \n' < .hf_token)
if [ -z "${HF_TOKEN:-}" ] && ! grep -q token ~/.cache/huggingface/token 2>/dev/null; then
  echo "belum login hf — ketik: hf auth login  (atau isi file .hf_token)"
fi
URL=${1:-}
if [ -z "$URL" ] && [ -f cfd.log ]; then
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' cfd.log | tail -1)
fi
[ -n "$URL" ] || { echo "URL tunnel tidak ketemu — isi argumennya"; exit 1; }
printf '{\n  "api": "%s"\n}\n' "$URL" > tunnel.json
export HF_HUB_DISABLE_XET=1
for i in 1 2 3 4 5; do
  R=$(hf upload "$HF_REPO" tunnel.json tunnel.json --repo-type space --commit-message "tunnel aktif" 2>&1 | grep -oE 'commit/[a-f0-9]{8}' | head -1)
  if [ -n "$R" ]; then echo "OK tunnel.json=$URL -> commit/$R"; exit 0; fi
  sleep 8
done
echo GAGAL_UPLOAD
exit 1
