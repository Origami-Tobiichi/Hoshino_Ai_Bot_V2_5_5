const hsAsset = require('../../src/lib/assets')
const moment = require('moment-timezone');
const config = require('../../config');
const fs = require('fs');
const { searchKota, getTodaySchedule, extractPrayerTimes } = require('../../src/lib/sholatAPI');

const pluginConfig = {
    name: 'jadwalsholat',
    alias: ['sholat', 'prayertime', 'jadwalsolat', 'waktusolat', 'waktusholat'],
    category: 'religi',
    description: 'Menampilkan jadwal sholat real-time dari myquran.com',
    usage: '.jadwalsholat <kota>',
    example: '.jadwalsholat Jakarta',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
};

async function handler(m, { sock }) {
    const city = m.args.join(' ').trim() || 'Jakarta';

    m.react('🕌');

    try {
        const kota = await searchKota(city);

        if (!kota) {
            m.react('❌');
            return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Kota "${city}" tidak ditemukan\n> Coba nama kabupaten/kota lain`);
        }

        const jadwalData = await getTodaySchedule(kota.id);
        const times = extractPrayerTimes(jadwalData);
        const lokasi = jadwalData.lokasi || kota.lokasi;
        const daerah = jadwalData.daerah || '';
        const today = moment.tz('Asia/Jakarta').format('dddd, DD MMMM YYYY');

        const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06';
        const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI';

        let thumbnail = null;
        hsAsset.tryBuffer('images/hsnai').then(b => { if (b) thumbnail = b }).catch(() => {})

        const caption = `🕌 *ᴊᴀᴅᴡᴀʟ sʜᴏʟᴀᴛ*

╭┈┈⬡「 📍 *${lokasi}* 」
┃ 📅 ${today}
┃ 🗺️ ${daerah}
╰┈┈⬡

╭┈┈⬡「 ⏰ *ᴡᴀᴋᴛᴜ sʜᴏʟᴀᴛ* 」
┃ 🌙 ɪᴍsᴀᴋ: \`${times.imsak}\`
┃ 🌅 sᴜʙᴜʜ: \`${times.subuh}\`
┃ ☀️ ᴛᴇʀʙɪᴛ: \`${times.terbit}\`
┃ 🌤️ ᴅʜᴜʜᴀ: \`${times.dhuha}\`
┃ 🌞 ᴅᴢᴜʜᴜʀ: \`${times.dzuhur}\`
┃ 🌇 ᴀsʜᴀʀ: \`${times.ashar}\`
┃ 🌆 ᴍᴀɢʜʀɪʙ: \`${times.maghrib}\`
┃ 🌃 ɪsʏᴀ: \`${times.isya}\`
╰┈┈⬡

> _Sumber: myquran.com | Jangan lupa sholat ya! 🤲_`;

        const adzanUrl = 'https://files.catbox.moe/z2bj5s.mp3';
        let adzanBuffer;
        try {
            const axios = require('axios');
            const res = await axios.get(adzanUrl, { responseType: 'arraybuffer', timeout: 30000 });
            adzanBuffer = Buffer.from(res.data);
        } catch {
            adzanBuffer = null;
        }

        const contextInfo = {
            forwardingScore: 9999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: saluranId,
                newsletterName: saluranName,
                serverMessageId: 127
            }
        };

        if (adzanBuffer) {
            await sock.sendMessage(m.chat, {
                audio: adzanBuffer,
                mimetype: 'audio/mpeg',
                ptt: false,
                contextInfo
            }, { quoted: m });

            await sock.sendMessage(m.chat, { text: caption }, { quoted: m });
        } else {
            await sock.sendMessage(m.chat, { text: caption, contextInfo }, { quoted: m });
        }

        m.react('✅');

    } catch (error) {
        m.react('❌');
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`);
    }
}

module.exports = {
    config: pluginConfig,
    handler
};