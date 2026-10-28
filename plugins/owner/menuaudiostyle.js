const pluginConfig = {
    name: 'menuaudiostyle',
    alias: ['gayaaudiomenu', 'audiostylemenu', 'setgayaaudio'],
    category: 'owner',
    description: 'Mengatur gaya pengiriman audio untuk .menu',
    usage: '.menuaudiostyle <1-5>',
    example: '.menuaudiostyle 1',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 0,
    energi: 0,
    isEnabled: true
};

const STYLES = {
    1: 'PTT Voice Note (Opus HQ) + reply ke pesan asli',
    2: 'PTT Voice Note (Opus HQ) + reply fake polling',
    3: 'Audio musik biasa (MP3) + reply fake chat teks',
    4: 'PTT Voice Note (Opus HQ) + reply fake dari channel/saluran',
    5: 'Audio musik biasa (MP3) + reply fake troli/order'
};

async function handler(m, { db }) {
    const args = m.text?.trim();
    const current = db.setting('menuAudioStyle') || 1;

    if (!args) {
        let txt = `⚠️ *PENGATURAN GAYA AUDIO MENU*\n\n`;
        txt += `Ini ngatur *cara kirim* audio pas \`.menu\` dipanggil (beda sama tombol aktif/nonaktif audio).\n\n`;
        txt += `*PENGGUNAAN:*\n`;
        for (const [num, desc] of Object.entries(STYLES)) {
            txt += `• *${m.prefix}menuaudiostyle ${num}* — ${desc}\n`;
        }
        txt += `\n*PENJELASAN:*\n`;
        txt += `- *Varian 1, 2, 4* otomatis convert MP3 → Opus pakai ffmpeg, biar kedengeran kayak rekaman suara asli (butuh ffmpeg ke-install di server).\n`;
        txt += `- *Varian 3 & 5* kirim MP3 mentah tanpa konversi, tapi pakai *Fake Quoted* yang tetep kelihatan rapi di layar chat.\n\n`;
        txt += `Saat ini gaya audio menu: *Varian ${current}* — _${STYLES[current]}_`;
        return m.reply(txt);
    }

    const newStyle = parseInt(args);
    if (isNaN(newStyle) || newStyle < 1 || newStyle > 5) {
        return m.reply(`❌ *GAGAL*\n\nPilihan gaya audio harus angka 1 sampai 5.\nContoh: *${m.prefix}menuaudiostyle 3*`);
    }

    db.setting('menuAudioStyle', newStyle);
    await db.save();
    await m.reply(`✅ *BERHASIL*\n\nGaya audio menu diubah jadi *Varian ${newStyle}* — _${STYLES[newStyle]}_.\n\nTes dengan ketik *${m.prefix}menu*.`);
}

module.exports = { config: pluginConfig, handler };