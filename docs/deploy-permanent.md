# Deploy Permanen — bot hidup meski HP/Termux mati

## Kenapa mesti ke cloud?
Termux = sandbox Android. Force-kill mematikan proses; **uninstall Termux menghapus semua datanya**
(bot, sesi, tunnel — tidak ada yang bisa bertahan di HP kalau app-nya dihapus).
Solusi: jadikan HP hanya klien, dan jalankan **engine bot di hosting cloud**. Panel pairing di HF Space
(`https://itsukakotori79-yorn.static.hf.space`) sudah otomatis baca URL API via `tunnel.json`
— cukup ganti isi file itu ke URL hosting baru, selesai.

## Pilihan A: Render.com (free, tanpa kartu) ← disarankan
1. Daftar/login https://render.com pakai akun GitHub.
2. New → **Blueprint** → pilih repo `Origami-Tobiichi/Hoshino_Ai_Bot_V2_5_5`.
3. Render membaca `render.yaml` di root repo (sudah diset: Docker, port 8000, health `/api/status`).
4. Isi Env Vars yang diminta (lihat tabel bawah) — klik **Apply** → **Deploy**.
5. Tunggu build ±5-10 menit → dapat URL `https://hoshino-ai-bot-xxxx.onrender.com`.
6. Buka panel HF → tombol `⚙ Set URL Bot` → tempel URL Render (atau update `tunnel.json` di HF).
7. Pairing pertama: panel → masukkan nomor bot → pasang kode `HSNAITMS` di WhatsApp.
8. Selesai. HP mati/uninstall Termux pun bot tetap jalan (sesi tersimpan di server Render).

> Free tier Render: web service tidur kalau 15 menit tanpa trafik HTTP —
> WhatsApp WS + `tic` Telegram/keepalive menghangatkan tanpa perlu monitor
> eksternal; kalau suatu saat tidur, request apa pun ke URL membangunkan ±30 s.

## Pilihan B: Koyeb (free, perlu authorize)
1. https://app.koyeb.com → Create Service → GitHub → origamibot
   → **Authorize** akses repo `Origami-Tobiichi/Hoshino_Ai_Bot_V2_5_5`.
2. Builder = **Dockerfile**, Port = `8000`.
3. Tambahkan Env Vars (tabel bawah) → Deploy → dapat URL `*.koyeb.app`.
4. Set URL-nya ke panel HF (langkah 6 di atas).

## Env Vars (nama persis, isi dari kunci milikmu)
| Nama variabel    | Untuk                      |
|------------------|----------------------------|
| `GROQ_API_KEY`   | AI (groq)                  |
| `GOOGLE_API_KEY` | AI Gemini / gemini-flash   |
| `BETABOTZ_API_KEY`| fitur API betabotz        |
| `YOUTUBE_API_KEY`| `ytnotify-core` pencarian  |
| `PORT`           | (sudah diset otomatis)     |

Kunci tidak disimpan di repo (dotenv); isi sendiri di dashboard hosting.

## Sisa perawatan lokal (opisional, biar HP pun tahan-kill)
- `termux-wake-lock` sudah otomatis dipanggil `watchdog.sh`.
- Android Settings → Apps → Termux → Battery → **Unrestricted**.
- Aplikasi **Termux:Boot**: boot script men-start `bash start_pair.sh` saat HP rejut.
