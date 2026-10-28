const axios = require('axios');
const FormData = require('form-data');

const pluginConfig = {
    name: ['fakechannel', 'fakech'],
    alias: ['fch', 'chmaker'],
    category: 'maker',
    description: 'Membuat gambar profil Channel WhatsApp palsu dengan sentuhan Idol',
    usage: '.fakech name|followers|desc|date (balas gambar)',
    example: '.fakech Hoshino Ai|1M|Official Channel|20/06/26',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
};

async function handler(m, context) {
    // context diambil dari handler.js kamu
    const { sock } = context;
    const prefix = m.prefix || '.';
    const command = m.command || 'fakech';
    
    // Di handler.js kamu, teks setelah command biasanya ada di m.text atau m.args
    let bodyText = m.text || ""; 
    
    try {
        // Deteksi Media dari pesan yang di-reply atau pesan itu sendiri
        const q = m.quoted ? m.quoted : m;
        const mime = (q.msg || q).mimetype || '';
        const isImage = /image/.test(mime) || q.type === 'imageMessage';

        let args = bodyText ? bodyText.split('|').map(v => v.trim()) : [];
        let url, name, followers, desc, date;

        // 1. Validasi Teks
        if (args.length < 4) {
            return m.reply(`*Konnichiwa!* ✨ Data belum lengkap, *darling*!\n\n*Format:* \`${prefix + command} name|followers|desc|date\`\n*Contoh:* \`${prefix + command} Ai Hoshino|2.5M|Official|20/06/26\``);
        }

        // 2. Tentukan Sumber Gambar
        if (args.length >= 5 && args[0].startsWith('http')) {
            [url, name, followers, desc, date] = args;
        } else if (isImage) {
            [name, followers, desc, date] = args;
            m.react('⏳');
            
            // Gunakan fungsi download bawaan serialize di bot kamu
            let buffer = await q.download().catch(() => null);
            if (!buffer) throw new Error('Gagal mendownload gambar. Coba kirim ulang gambarnya!');
            
            url = await uploadToUguu(buffer);
            if (!url) throw new Error('Gagal mengunggah gambar ke server.');
        } else {
            return m.reply(`*Gomen!* 🌸 Ai butuh foto untuk channelnya.\n\nSilahkan ketik perintahnya sambil **Balas (Reply)** sebuah gambar ya!`);
        }

        m.react('🌟');
        await m.reply(`*Konnichiwa!* 🌸✨\n\nAi sedang mendesain Channel impianmu... Tunggu sebentar! 🎤💖`);

        // 3. Eksekusi API
        let api = `https://api.zenzxz.my.id/maker/fakechannel?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}&followers=${encodeURIComponent(followers)}&desc=${encodeURIComponent(desc)}&date=${encodeURIComponent(date)}`;
        
        const response = await axios.get(api, { responseType: 'arraybuffer' });
        const resultBuffer = Buffer.from(response.data);

        const caption = `
╭━━━━━━━〔 🌟 *𝐂𝐇𝐀𝐍𝐍𝐄𝐋 𝐌𝐀𝐊𝐄𝐑* 🌟 〕━━━━━━━⬣
┃
┃ 🌸 *ꜰᴀᴋᴇ ᴄʜᴀɴɴᴇʟ ꜱᴜᴄᴄᴇꜱꜱ*
┃ ── 「 𝐇𝐎𝐒𝐇𝐈𝐍𝐎 𝐀𝐈 𝐄𝐃𝐈𝐓𝐈𝐎𝐍 」 ──
┃
┃ ✨ *Channel:* ${name}
┃ ✨ *Followers:* ${followers}
┃ ✨ *Status:* Sparkling Verified! 🎤
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣

💖 *Your channel looks amazing, darling!* 💫
> SeaPRST x Hoshino Ai Management`.trim();

        await sock.sendMessage(m.chat, { 
            image: resultBuffer, 
            caption: caption,
            mentions: [m.sender]
        }, { quoted: m });

        m.react('✅');

    } catch (e) {
        console.error(e);
        m.react('❌');
        return m.reply(`*Gomen ne...* 😭💔\nError: \`${e.message}\``);
    }
}

async function uploadToUguu(buffer) {
    try {
        const form = new FormData();
        form.append("files[]", buffer, "image.jpg");
        const { data } = await axios.post("https://uguu.se/upload", form, { 
            headers: form.getHeaders() 
        });
        return data?.files?.[0]?.url || null;
    } catch {
        return null;
    }
}

module.exports = {
    config: pluginConfig,
    handler
};