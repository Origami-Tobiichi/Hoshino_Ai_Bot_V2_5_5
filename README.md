<div align="center">
  <img src="https://GANTI-URL-BANNER/hsnai.jpg" alt="Hoshino Ai Bot Banner" width="400" style="border-radius:15px; margin-bottom: 20px;" />
  <br />

  <h1>🌸 HOSHINO AI BOT ✨</h1>
  <p><strong>Bot WhatsApp Multi-Device bertema idol, dengan Sistem Plugin Modular & Integrasi AI yang Pintar~ 💖</strong></p>

  <p align="center">
    <img src="https://img.shields.io/badge/Language-Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
    <img src="https://img.shields.io/badge/Version-v2.5.5-FF69B4?style=for-the-badge&logo=bamboo&logoColor=white" />
    <img src="https://img.shields.io/badge/License-MIT-purple?style=for-the-badge" />
    <img src="https://img.shields.io/badge/Maintained%3F-Yes-green.svg?style=for-the-badge" />
  </p>
</div>

---

Haii, Producer-san! 👋 Selamat datang di repositori **Hoshino Ai Bot V2.5.5**. 🌟

Lagi cari script bot WhatsApp, fiturnya super lengkap, tapi gampang banget dipasang? Kamu udah di tempat yang tepat~ Hoshino Ai Bot terinspirasi dari **Hoshino Ai** di anime *Oshi no Ko*, dan dibuat supaya **cepat, rapi, dan anti-ribet**. Cocok buat belajar, jagain grup, atau sekadar nemenin kamu ngobrol! 💕

> [!TIP]
> Hoshino Ai Bot memakai Baileys fork sendiri bernama **`hsnai`** (ada di folder `./hsnai`), jadi jalannya stabil di WhatsApp Multi-Device (bisa aktif di banyak perangkat sekaligus). ✨

## 🔗 Link Penting

| Apa | Keterangan | Akses |
|-----|-----------|-------|
| 🌐 Website | Halaman resmi Hoshino Ai | [Klik](https://radiant-cucurucho-428266.netlify.app) |
| 💬 Grup WhatsApp | Gabung, tanya-tanya, dan ngobrol bareng | [Klik](https://chat.whatsapp.com/KFwyFjYluqnCg3o62MjCWZ?s=cl&p=a&mlu=4&ilr=4) |

---

## 🌟 Kenapa Pilih Hoshino Ai Bot?

| Fitur | Penjelasan |
| :--- | :--- |
| **🤖 AI Pintar & Berkarakter** | Terhubung ke berbagai AI (chat, vision, gambar, video, dan lainnya) plus fitur AutoAI yang bikin Ai ngobrol dengan gaya karakternya sendiri. Rasanya kayak ngobrol sama idol beneran! |
| **🧩 Sistem Plugin Modular** | Nggak perlu pusing sama kodingan panjang. Fitur dibagi per file di *folder plugins*. Gampang ditambah, gampang dihapus. |
| **🎮 RPG & Ekosistem Game** | Bikin grup WhatsApp-mu makin hidup dengan Leveling, Kuis, Energi, Koin, sampai sistem Clan/Guild dan mode Idol. |
| **☁️ Dukungan Pterodactyl & VPS** | Terintegrasi dengan panel Pterodactyl. Punya server VPS? Bisa di-manage langsung lewat WA. |

<details>
<summary><b>👀 Lihat Fitur Tambahan Lainnya (Klik untuk Membuka)</b></summary>
Ai juga nyiapin banyak fitur seru, walaupun mungkin kamu cuma pakai sesekali~
<ul>
  <li><b>Canvas Image Editor:</b> Bikin meme dan gambar keren langsung dari bot.</li>
  <li><b>Fitur Islami & Religi:</b> Pengingat sholat, tafsir, dan bacaan Al-Qur'an.</li>
  <li><b>Sticker & Maker:</b> Bikin stiker, ubah foto jadi gaya anime, dan efek keren lainnya.</li>
  <li><b>Anti-Spam & Keamanan Grup:</b> Bot otomatis kick member yang kirim link terlarang, dan sebagainya.</li>
  <li><b>Push Kontak (Marketing):</b> Khusus promosi bisnis dengan sistem <i>broadcast</i> massal yang aman.</li>
</ul>
</details>

---

## ⚙️ Persyaratan Sistem

Sebelum mulai, pastikan komputer/server kamu udah memenuhi syarat ini ya~

- **Node.js** (Wajib versi >= 22.0.0, **rekomendasi Node.js 24.x.x LTS**). [Download di sini](https://nodejs.org/).
- **FFmpeg** (Wajib biar bot bisa bikin stiker & olah video). [Panduan Install FFmpeg](https://ffmpeg.org/download.html).
- **Git** (Dibutuhkan kalau kamu install lewat Termux). [Download Git](https://git-scm.com/downloads) | Pengguna Termux: `pkg install git`

> [!WARNING]
> Kalau `FFmpeg` belum terinstall, fitur pembuat stiker gambar bergerak/video **nggak akan berfungsi**. Pastikan udah terpasang dengan benar ya!

---

## 🚀 Panduan Instalasi (Langkah Demi Langkah)

Tenang, konfigurasinya gampang banget walau kamu baru belajar! Hoshino Ai Bot bisa jalan di Windows, Panel Pterodactyl, Docker, sampai Termux~ 🌸

### 1. Ambil Source Code
Download script `HoshinoAi_Free_Share.zip`, lalu extract ke folder pilihanmu. Buka terminal (Command Prompt/Git Bash/Termux) dan masuk ke folder hasil extract tadi.

---

### 🐧 Khusus Pengguna Termux / Linux
Ai sediain script otomatis biar kamu nggak pusing install modul tambahan (soalnya fitur canvas/sharp butuh dependensi C++). Cukup jalankan:
```bash
bash install.sh
```

---

### 🐳 Menggunakan Docker (Tinggal Pakai)
Buat kamu yang pakai VPS dan nggak mau ribet, cara ini paling direkomendasikan karena udah dibundle dengan environment terbaik (Node 22 Bookworm):
```bash
docker build -t hoshino-ai .
docker run -d --name hoshino-ai-bot hoshino-ai
```

---

### ⚙️ Instalasi Manual (Windows / Lainnya)
Kalau kamu nggak pakai Termux atau Docker, ikuti tahap instalasi standar ini:

### 2. Instal Dependensi (Module)
Sekarang kita install dulu semua alat tempurnya:

```bash
npm install
```
*(Prosesnya bisa beberapa menit tergantung koneksi internetmu~)*

### 3. Konfigurasi `config.js`
> [!IMPORTANT]
> Jangan lupa atur file `config.js` ya. File ini adalah "jantung" bot kamu.
Buka `config.js` pakai teks editor favoritmu, lalu sesuaikan nomor WhatsApp kamu (sebagai Owner), nama bot, versi bot, dan lainnya.

> [!IMPORTANT]
> Jangan lupa isi **Pairing Number** di `config.js` dengan nomor WhatsApp bot kamu! Awali dengan 62, kalau nomor Indonesia jangan pakai 0.

```javascript
    session: {
        pairingNumber: '62xxxxxxxxx',   // jangan lupa diisi ya, pakai nomor bot kamu
        usePairingCode: true // true = pakai Pairing Code, false = pakai QR Code
    },
```

### 4. Nyalakan Bot-nya!
Kalau semuanya udah ter-install, jalankan perintah ini:

```bash
npm start
```
Bot bakal otomatis jalan. Kalau kamu diminta pairing, kode pairing-nya adalah **HSNAITMS** ✨

### 5. Menghubungkan WhatsApp
Saat pertama kali dijalankan, bot bakal minta kamu pairing. Bot akan mengirimkan **Pairing Code** (`HSNAITMS`). Cukup masukkan kode ini di aplikasi WhatsApp kamu `(Perangkat Tertaut -> Tautkan dengan Nomor Telepon)`, lalu tempel kodenya di 8 kolom itu. Selesai deh~ 💖

---

## 💡 Info & Tips Menarik

> [!NOTE]
> Mau bot jalan 24 jam nonstop?
Kamu bisa pakai layanan **Panel Pterodactyl** atau VPS. Ai juga jalan dengan baik di sana~ 🌸

## 🤝 Kontribusi

Hoshino Ai Bot bersifat `Open Source`. Kalau nemu *bug* (celah error) atau mau nambahin *plugin* seru karya kamu sendiri:
1. `Fork` repo ini.
2. Lakukan perubahan kamu.
3. Kirim `Pull Request`. Ai dengan senang hati nyambut karya terbaikmu! 💕

---

## 🙏 Credits & Asal Script

Hoshino Ai Bot dibangun di atas script **OURIN MD** (versi gratis, tanpa enkripsi) buatan **Zann & OURIN MD Team**. Tanpa kerja keras mereka, bot ini nggak akan ada. Terima kasih banyak! 💖

- 📦 Repo asli: [LuckyArch/OurinMD](https://github.com/LuckyArch/OurinMD)
- 🔧 Base Baileys `hsnai` berasal dari `LuckyArch/OurinGlitch-Baileys`
- 📜 Lisensi: MIT, Copyright (c) 2026 Zann & OURIN MD Team dan SeaPRST (Hoshino Ai Bot) (lihat file [`LICENSE`](./LICENSE))

**Daftar credit OURIN MD:**

- Spesial thanks to **Kak Liaa** (Owner Starfall)
- **HyuuSATAN** (Lead Staff)
- **Senz Offc** (Assistant Developer)
- **Mobbc** (Staff)
- **Lyoraa** (Owner)
- **Danzzz** (Owner)
- **Sanxz**, **Kaziee**, **Rakaa**, **Dinzz** (Tangan Kanan)
- **Muzan** (Owner)
- Semua penyedia API/Scraper
- Zanspiw, para content creator yang udah ngeshare script ini, dan kalian semua yang udah download ✨

**Sumber plugin & inspirasi (V2.5.5):**

- `addmetaai` -> base dari `imxxzz/asta`
- `crm4` dan `ipleak` -> port / layanan dari **Nixel**
- `fakeff` -> package npm `fake-ff`

Selengkapnya ada di file [`CREDITS`](./CREDITS).

> [!IMPORTANT]
> Script ini **gratis** dan **jangan diperjualbelikan**. Tolong jangan hapus atau ganti credit ya. Kalau mau ngembangin, tinggal tambahin nama kamu di atasnya~ 🌸

---

<div align="center">
  <b>Dibuat dengan ❤️ oleh SeaPRST, didukung oleh Ai ✨</b>
  <br />
  <sub>Base script: OURIN MD oleh Zann & OURIN MD Team</sub>
  <p>Jangan lupa kasih ⭐ (Star) pada repo ini kalau kamu merasa terbantu, ya~ 💖</p>
</div>
