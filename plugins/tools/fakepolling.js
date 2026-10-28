const fs = require("fs");

const pluginConfig = {
    name: 'fakepoll',
    alias: ['fakepolling'],
    category: 'tools',
    description: '✨ Buat Poll WA palsu ala Hoshino Ai Idol (Maks 10 opsi)',
    usage: '.fakepoll <pertanyaan>\n<opsi1>|<jumlah1>\n<opsi2>|<jumlah2>\n...\n<opsi10>|<jumlah10>',
    example: `🌸 *Contoh Poll Oshi no Ko* 🌸
.fakepoll Siapa karakter favoritmu di Oshi no Ko?
Ai Hoshino|420
Aqua Hoshino|380
Ruby Hoshino|250
Kana Arima|180
Himari Uchida|150
Sarina Tendou|120
Akane Kurokawa|90
Hina Kisaragi|70
Ruka Saeki|60
Aoi Kujou|40`,
    cooldown: 3,
    energi: 0,
    isEnabled: true
};

async function handler(m, { sock }) {
    try {
        // ===== 1️⃣ Input Handling =====
        const fullText = m.message?.conversation || m.message?.extendedTextMessage?.text;
        if (!fullText) return m.reply('❌ *Ups! Tidak ada teks.*\n> Kirim pertanyaan + opsi menggunakan ENTER!');

        if (!fullText.includes('\n')) throw "⚠️ WAJIB pakai ENTER! Jangan semua di 1 baris.";

        const lines = fullText.split('\n').map(l => l.trim()).filter(l => l);
        const usedPrefix = '.';
        const cmdPattern = new RegExp(`^${usedPrefix}(fakepoll|fakepolling)(\\s+(.+))?$`, 'i');
        const match = lines[0].match(cmdPattern);

        if (!match) throw `❌ Perintah salah! Gunakan ${usedPrefix}fakepoll atau ${usedPrefix}fakepolling`;

        let question, pollVotes;
        if (match[3]) {
            // Perintah + pertanyaan di baris yang sama
            question = match[3].trim();
            if (lines.length < 2) throw "⚠️ WAJIB ada minimal 1 opsi!";
            pollVotes = lines.slice(1).map((l,i)=>{
                const split = l.split('|').map(v=>v.trim());
                if(split.length < 2) throw `⚠️ Opsi ke-${i+1} "${l}" salah format! Gunakan opsi|jumlah`;
                return { optionName: split[0], optionVoteCount: split[1].toString() };
            });
        } else {
            // Perintah di baris sendiri
            if(lines.length < 3) throw "⚠️ WAJIB ada pertanyaan + minimal 1 opsi!";
            question = lines[1];
            pollVotes = lines.slice(2).map((l,i)=>{
                const split = l.split('|').map(v=>v.trim());
                if(split.length < 2) throw `⚠️ Opsi ke-${i+1} "${l}" salah format! Gunakan opsi|jumlah`;
                return { optionName: split[0], optionVoteCount: split[1].toString() };
            });
        }

        if(pollVotes.length > 10) throw `⚠️ Maksimal 10 opsi, kamu masukkan ${pollVotes.length} opsi`;

        await m.react('🕒');

        // ===== 2️⃣ Kirim Poll =====
        await sock.relayMessage(m.chat, {
            pollResultSnapshotMessage: {
                name: `${question}`,
                pollVotes: pollVotes,
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterName: "✨ Oshi no Ko Idol Poll ✨",
                        newsletterJid: "https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06"
                    }
                }
            }
        }, { messageId: m.key.id, quoted: m });

        await m.react('✅');
        // ===== 3️⃣ Sukses =====
        return m.reply(`✅ Poll berhasil dibuat dengan *${pollVotes.length} opsi*!\n🌟 Semoga semua fans senang~`);

    } catch (e) {
        console.log('[FAKEPOLL HANDLER]', e);
        await m.react('❌');
        // ===== 3️⃣ Fallback/Error =====
        m.reply(`❌ *Hoshino Ai Error*\n> ${e}\n\n🌸 *Contoh Poll Oshi no Ko* 🌸\n.fakepoll Siapa karakter favoritmu di Oshi no Ko?\nAi Hoshino|420\nAqua Hoshino|380\nRuby Hoshino|250\nKana Arima|180\nHimari Uchida|150\nSarina Tendou|120\nAkane Kurokawa|90\nHina Kisaragi|70\nRuka Saeki|60\nAoi Kujou|40`);
    }
}

module.exports = {
    config: pluginConfig,
    handler
};