const axios = require('axios');

const pluginConfig = {
    name: ['translate', 'tr'],
    alias: ['tran', 'ts'],
    category: 'tools',
    description: 'Menerjemahkan teks ke berbagai bahasa (Google Translate)',
    usage: '.tr <kode_bahasa> <teks> atau balas pesan',
    example: '.tr en halo apa kabar',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
};

async function handler(m, context) {
    const { sock } = context;
    const prefix = m.prefix || '.';
    const command = m.command || 'tr';
    
    // Ambil semua teks setelah command
    let textInput = m.text ? m.text.trim() : "";
    let args = textInput.split(' ').filter(v => v !== "");
    
    let lang, textToTranslate;

    try {
        // 1. LOGIKA PINTAR: Cek apakah ada pesan yang di-reply
        if (m.quoted) {
            // Jika reply, kata pertama setelah command dianggap target bahasa
            lang = args[0] || "id"; 
            // Teksnya diambil dari pesan yang di-reply
            textToTranslate = m.quoted.text || m.quoted.caption || m.quoted.description || "";
            
            // Kalau pesan yang di-reply tidak ada teksnya sama sekali
            if (!textToTranslate) throw new Error("Pesan yang kamu balas tidak memiliki teks!");
            
        } else {
            // 2. JIKA TIDAK REPLY (Input Manual)
            if (args.length < 2) {
                return m.reply(`*Format Salah!* ✨\n\n*Contoh:* \`${prefix + command} en halo\`\n*Atau:* Balas pesan dengan \`${prefix + command} en\``);
            }
            lang = args[0];
            textToTranslate = args.slice(1).join(" ");
        }

        m.react('⏳');

        // 3. Cek List Bahasa
        const lister = await langList();
        const availableCodes = Object.keys(lister);
        const targetLang = lang.toLowerCase();

        if (!availableCodes.includes(targetLang)) {
            // Jika bahasa tidak ditemukan, mungkin user lupa masukin kode bahasa (langsung teks)
            // Tapi untuk amannya, kita beri tahu list yang benar
            return m.reply(`*Gomen!* Kode bahasa "${lang}" tidak ada.\n\n*Gunakan:* id, en, ja, ko, ar, zh, fr.\nContoh: \`${prefix + command} en apa kabar\``);
        }

        // 4. Proses Translate
        const res = await translate(textToTranslate.trim(), targetLang);
        
        if (!res || !res[0]) throw new Error("Gagal mendapatkan terjemahan dari Google.");

        let Detect = res[1] ? res[1].toUpperCase() : "AUTO";
        let ToLang = targetLang.toUpperCase();

        let caption = `
╭━━━━━━━〔 🌏 *𝐓𝐑𝐀𝐍𝐒𝐋𝐀𝐓𝐄* 🌏 〕━━━━━━━⬣
┃
┃ 📡 *𝐃𝐞𝐭𝐞𝐜𝐭𝐞𝐝:* ${Detect}
┃ 🎯 *𝐓𝐚𝐫𝐠𝐞𝐭:* ${ToLang}
┃
┃ 📝 *𝐑𝐞𝐬𝐮𝐥𝐭:*
┃ ${res[0].trim()}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣`.trim();

        await sock.sendMessage(m.chat, { 
            text: caption,
            mentions: [m.sender]
        }, { quoted: m });

        m.react('✅');

    } catch (e) {
        console.error(e);
        m.react('❌');
        return m.reply(`*Gomen ne...* 😭\nError: \`${e.message}\``);
    }
}
// --- FUNGSI HELPER (Google Translate API) ---

async function langList() {
    try {
        const { data } = await axios.get("https://translate.google.com/translate_a/l?client=webapp&sl=auto&tl=en&v=1.0&hl=en&pv=1&tk=&source=bh&ssel=0&tsel=0&kc=1&tk=626515.626515&q=");
        return data.tl;
    } catch {
        return { "id": "Indonesian", "en": "English", "ja": "Japanese" }; // Fallback sederhana
    }
}

async function translate(query, lang) {
    if (!query) return "";
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t&tl=${lang}&q=${encodeURIComponent(query)}`;

    try {
        const { data } = await axios.get(url);
        if (data) {
            return [data[0].map((item) => item[0].trim()).join("\n"), data[2]];
        }
        return "";
    } catch (err) {
        throw err;
    }
}

module.exports = {
    config: pluginConfig,
    handler
};