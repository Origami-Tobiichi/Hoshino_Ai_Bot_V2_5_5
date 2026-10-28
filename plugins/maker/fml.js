const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const pluginConfig = {
    name: ['fml', 'fakeafinitasml'],
    alias: ['afinitasml', 'fakeml', 'aimaker'],
    category: 'maker',
    description: 'Membuat gambar profil Afinitas Mobile Legends palsu dengan sentuhan Idol',
    usage: '.fml (kirim/balas gambar)',
    example: '.fml',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
};

const tmpDir = path.join(process.cwd(), 'temp', 'canvas');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

async function handler(m, { sock }) {
    try {
        let q = m.quoted ? m.quoted : m;
        let mime = (q.msg || q).mimetype || '';
        let input;

        if (/image/.test(mime)) {
            input = await q.download();
        } else {
            try {
                input = await sock.profilePictureUrl(m.sender, 'image');
            } catch (e) {
                input = 'https://files.catbox.moe/8j0v39.jpg'; 
            }
        }

        m.react('🌟');
        
        // Pesan awal ala Hoshino Ai
        const greeting = await m.reply(`*Konnichiwa!* 🌸✨\n\nAi sedang meracik keajaiban untuk afinitasmu... Tunggu sebentar ya, *darling*! 🎤💖`);

        const buffer = await createFakeML(input);

        // Caption yang rapi, menarik, dan unik ala Idol
        const caption = `
╭━━━━━━━〔 🌟 *𝐈𝐃𝐎𝐋 𝐌𝐀𝐊𝐄𝐑* 🌟 〕━━━━━━━⬣
┃
┃ 🌸 *ꜰᴀᴋᴇ ᴀꜰɪɴɪᴛᴀꜱ ᴍʟ ꜱᴜᴄᴄᴇꜱꜱ*
┃ ── 「 𝐇𝐎𝐒𝐇𝐈𝐍𝐎 𝐀𝐈 𝐄𝐃𝐈𝐓𝐈𝐎𝐍 」 ──
┃
┃ ✨ *Request by:* @${m.sender.split('@')[0]}
┃ ✨ *Type:* Affinity Mobile Legends
┃ ✨ *Status:* Sparkling Perfect! 🎤
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣

💖 *Keep shining like a star, superstar!* 💫
> SeaPRST x Hoshino Ai Management`.trim();

        await sock.sendMessage(m.chat, { 
            image: buffer, 
            caption: caption,
            mentions: [m.sender]
        }, { quoted: m });

        m.react('✅');

    } catch (e) {
        console.error(e);
        m.react('❌');
        return m.reply(`*Gomen ne...* 😭💔\n\nTerjadi kesalahan saat Ai mencoba beraksi: \`${e.message}\``);
    }
}

// --- HELPER FUNCTIONS ---

async function getBuffer(url) {
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(res.data);
    } catch (err) {
        throw new Error(`Gagal mengambil data: ${err.message}`);
    }
}

function drawRoundedImg(ctx, img, x, y, size, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + size - radius, y);
    ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
    ctx.lineTo(x + size, y + size - radius);
    ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
    ctx.lineTo(x + radius, y + size);
    ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, x, y, size, size);
    ctx.restore();
}

async function loadAssets() {
    const fontBold = path.join(tmpDir, 'RobotoBold.ttf');
    const fontRegular = path.join(tmpDir, 'RobotoRegular.ttf');

    if (!fs.existsSync(fontBold)) {
        const res = await axios.get('https://uploader.zenzxz.dpdns.org/uploads/1775138842054.ttf', { responseType: 'arraybuffer' });
        fs.writeFileSync(fontBold, Buffer.from(res.data));
    }
    if (!fs.existsSync(fontRegular)) {
        const res = await axios.get('https://uploader.zenzxz.dpdns.org/uploads/1775138866574.ttf', { responseType: 'arraybuffer' });
        fs.writeFileSync(fontRegular, Buffer.from(res.data));
    }

    try {
        GlobalFonts.registerFromPath(fontRegular, 'Roboto');
        GlobalFonts.registerFromPath(fontBold, 'Roboto');
    } catch (e) {}
}

async function createFakeML(input) {
    await loadAssets();

    const background = 'https://uploader.zenzxz.dpdns.org/uploads/1775228325905.jpeg';
    const border = 'https://uploader.zenzxz.dpdns.org/uploads/1775232236060.png';

    const [bgBuf, inBuf, brBuf] = await Promise.all([
        getBuffer(background),
        getBuffer(input),
        getBuffer(border)
    ]);

    const bg = await loadImage(bgBuf);
    const img = await loadImage(inBuf);
    const br = await loadImage(brBuf);

    const canvas = createCanvas(bg.width, bg.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(bg, 0, 0, bg.width, bg.height);
    drawRoundedImg(ctx, img, 235, 500, 236, 40);
    ctx.drawImage(br, 195, 460, 320, 320);

    return canvas.toBuffer('image/png');
}

module.exports = {
    config: pluginConfig,
    handler
};