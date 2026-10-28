# Deploy Permanen (gratis) — peran HF Space & tempat engine

## Fakta (terverifikasi via APIHF, Oktober 2026)
- HF Space SDK **static = gratis selamanya** → dipakai sebagai **panel pairing** (`itsukakotori79/Yorn`).
- HF Space **Docker/Gradio = butuh Pro ($9/bln)** → TIDAK bisa dipakai untuk menjalankan bot secara gratis.
- Jadi: **panel gratis di HF; engine bot perlu komputer lain** — dua pilihan gratis:

## Pilihan A — Tetap Termux (0 rupiah, tanpa GUI)
Engine = HP sendiri. Panel = HF (gratis). Komponen yang sudah terpasang:
| Komponen | Fungsi |
|---|---|
| `start_pair.sh` | nyalakan bot + tunnel dalam 1 perintah |
| `watchdog.sh` | hidupkan otomatis node/cloudflared yang mati |
| `update_tunnel.sh` | upload URL tunnel terbaru ke `tunnel.json` di HF (panel menunjuk ke sana otomatis) |
| `termux-wake-lock` | dilakukan watchdog tiap siklus |

Cara pakai harian: `bash start_pair.sh`. Kalau HP reboot: install aplikasi **Termux:Boot**
lalu buat `~/.termux/boot/boot-hsnai.sh`:
```bash
mkdir -p ~/.termux/boot && cat > ~/.termux/boot/boot-hsnai.sh <<'EOF'
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock
sleep 10
bash /data/data/com.termux/files/home/Hoshino_Ai_Bot_V2_5_5/start_pair.sh
EOF
chmod +x ~/.termux/boot/boot-hsnai.sh
```
Uninstall Termux = bot tetap mati permanen (file sandbox terhapus) — hanya Pilihan B yang solusi.

## Pilihan B — Render.com free (tanpa kartu) ← bot hidup walau HP mati/uninstall Termux
1. Login https://render.com pakai GitHub.
2. **New → Blueprint** → repo `Origami-Tobiichi/Hoshino_Ai_Bot_V2_5_5` (render.yaml sudah dibaca otomatis: Docker, port 8000, health `/api/status`).
3. Isi Environment (dari `env.example`):
   - `GIT_SYNC_URL` — **wajib** agar sesi & database tidak hilang saat rebuild:
     buat repo privat (mis. `hsnai-backup`) + fine-grained PAT (izin `Contents: Read and write`, cukup repo itu) → isi
     `https://x-access-token:<PAT>@github.com/<user>/hsnai-backup.git`
   - AI key bila turun: `GROQ_API_KEY`, `GOOGLE_API_KEY`, `BETABOTZ_API_KEY`, `YOUTUBE_API_KEY`.
4. Apply → Deploy → dapat URL `https://…onrender.com`.
5. Backlink panel HF gratis: `bash update_tunnel.sh https://…onrender.com` (menulis `tunnel.json` di HF) → panel Yorn menunjuk URL baru.
6. Pairing pertama lewat panel (bot makan kode `HSNAITMS`), sesi tersimpan ke repo `hsnai-backup` tiap 10 menit.

## Anti-sleep (dibangun di webserver, aktif otomatis)
`RENDER_EXTERNAL_URL` dideteksi otomatis → GET `/api/status` tiap 10 menit ke diri sendiri,
Render free tidak tidur tanpa alat eksternal. `KEEPALIVE_URL`/`KEEPALIVE_MS` bisa dikustom.

## Persistensi sesi — `scripts/hf-session-sync.js`
- Backend GitHub (`GIT_SYNC_URL`) ATAU Hugging Face Dataset (`HF_TOKEN` + `HF_SESSION_DATASET`).
- Restore saat awal boot + autosave tiap 10 menit + saat SIGTERM.
- Tanpa env tersebut skrip pasif (tanpa efek) — Termux lokal tidak butuh.
