/**
 * 🌟 Hoshino Ai Bot - Manga AI Transformer 🌟
 * * Credits: 
 * - Base: SeaPRST || Died100
 * - Author: Kanoo
 * - API: Nexray Web ID
 */

const axios = require('axios');
const FormData = require('form-data');

const pluginConfig = {
    name: 'jadikomik',
    alias: ['tomanga', 'mangaai', 'komik'],
    category: 'ai',
    description: 'Ubah fotomu menjadi panel manga estetik!',
    usage: '.jadikomik <reply/kirim foto>',
    example: '.jadikomik',
    isEnabled: true,
    cooldown: 10,
    energi: 2
}

async function handler(m, { sock }) {
    // Menyamakan logika deteksi gambar dengan plugin HD (Remini)
    const isImage = m.isImage || (m.quoted && m.quoted.type === 'imageMessage');

    if (!isImage) {
        return m.reply(`🎤 *Konnichiwa!* Mohon kirim atau reply gambar yang ingin diubah menjadi manga ya, Producer-san! ✨\n\nContoh: \`.jadikomik\``);
    }

    await m.react('🪄');

    try {
        // Download media (Logika yang sama dengan plugin HD)
        let buffer;
        if (m.quoted && m.quoted.isMedia) {
            buffer = await m.quoted.download();
        } else if (m.isMedia) {
            buffer = await m.download();
        }

        if (!buffer) throw new Error('Gagal download gambar');

        await m.reply('✨ *Ai sedang beraksi!* Mohon tunggu sebentar ya, panel mangamu sedang digambar... 🎨💖');

        // Siapkan form data untuk API
        const form = new FormData();
        // Pakai buffer hasil download tadi
        form.append('image', buffer, 'image.jpg');
        form.append('param', 'buat gambar ini menjadi panel manga, buat beberapa panel dan ubah karakternya menjadi anime tanpa bubble text');

        // Request ke API Nano Banana
        const response = await axios.post('https://api-faa.my.id/faa/nanobanana', form, {
            headers: {
                ...form.getHeaders()
            },
            responseType: 'arraybuffer'
        });

        if (!response.data || response.data.byteLength < 500) throw new Error('Response API tidak valid.');

        const outBuffer = Buffer.from(response.data);

        const caption = `🌟 *𝐌𝐀𝐍𝐆𝐀 𝐓𝐑𝐀𝐍𝐒𝐅𝐎𝐑𝐌* 🌟\n\n` +
                        `✨ *Result for:* ${m.pushName}\n` +
                        `🎨 *Style:* Manga Panel\n\n` +
                        `> "Kebohongan adalah cinta yang paling tulus!"\n` +
                        `> *– Hoshino Ai Bot*`;

        // Kirim hasil akhir
        await sock.sendMessage(m.chat, {
            image: outBuffer,
            caption: caption,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: "https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06",
                    newsletterName: "Hoshino Ai | SeaPRST",
                    serverMessageId: 143
                }
            }
        }, { quoted: m });

        await m.react('⭐');

    } catch (e) {
        console.error('ERROR JADI KOMIK:', e);
        await m.react('❌');
        m.reply(`⚠️ *Gomen, Producer-san!* Terjadi kesalahan.\n\nDetail: _${e.message}_`);
    }
}

module.exports = { config: pluginConfig, handler };