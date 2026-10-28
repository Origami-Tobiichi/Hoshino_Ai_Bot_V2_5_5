const fs = require('fs')
const path = require('path')
const axios = require('axios')
const FormData = require('form-data')

// ===== CONFIG =====
const pluginConfig = {
    name: 'fakektp',
    alias: ['ktp', 'fektp', 'idcard'],
    category: 'maker',
    description: 'Membuat identitas KTP virtual dengan desain premium',
    usage: '.fakektp provinsi|kota|nik|nama|ttl|jk|goldar|alamat|rt/rw|desa|kec|agama|status|kerja|kewarganegaraan|berlaku|dibuat',
    example: '.fakektp Tokyo Prefecture|Tokyo|0000000000000000|Hoshino Ai|Tokyo, 17-04-2003|Perempuan|A|Apartemen Pribadi (Dirahasiakan)|000/000|Shibuya Area|Shibuya|-|Belum Kawin|Idol/Entertainer|Jepang|Seumur Hidup|Tokyo',
    cooldown: 10,
    energi: 3,
    isGroup: false,
    isOwner: false,
    isEnabled: true
}

// ===== HANDLER =====
async function handler(m, { sock }) {
    try {
        // 🔧 DETEKSI GAMBAR (SAMA KAYA CONTOH REMINI)
        const isImage = m.isImage || (m.quoted && m.quoted.type === 'imageMessage')

        if (!m.text && !m.quoted) {
            return m.reply(`🪪 *ғᴀᴋᴇ ᴋᴛᴘ ɢᴇɴᴇʀᴀᴛᴏʀ*\n\n` +
                `╭───〔 📝 *ɪɴsᴛʀᴜᴋsɪ* 〕───⬡\n` +
                `┃ Silakan isi data dengan format:\n` +
                `┃ *${m.prefix}fakektp* provinsi|kota|nik|nama|ttl|jk|goldar|alamat|rt/rw|desa|kec|agama|status|kerja|kewarganegaraan|berlaku|dibuat\n` +
                `┃ *${m.prefix}fakektp* Tokyo Prefecture|Tokyo|0000000000000000|Hoshino Ai|Tokyo, 17-04-2003|Perempuan|A|Apartemen Pribadi (Dirahasiakan)|000/000|Shibuya Area|Shibuya|-|Belum Kawin|Idol/Entertainer|Jepang|Seumur Hidup|Tokyo\n` +
                `┃\n` +
                `┃ *Format Lengkap:*\n` +
                `┃ 🏛️ Provinsi\n` +
                `┃ 🏙️ Kota\n` +
                `┃ 🔢 NIK\n` +
                `┃ 👤 Nama Lengkap\n` +
                `┃ 📅 TTL (YYYY-MM-DD)\n` +
                `┃ ⚧️ Jenis Kelamin\n` +
                `┃ 🩸 Golongan Darah\n` +
                `┃ 🏠 Alamat\n` +
                `┃ 📍 RT/RW\n` +
                `┃ 🏡 Kelurahan/Desa\n` +
                `┃ 🏢 Kecamatan\n` +
                `┕──────────────────────────────⬡\n\n` +
                `✨ *Tips:* Reply gambar foto untuk foto profil KTP.`)
        }

        await m.react('✨')

        const args = m.text.split('|').map(v => v?.trim());
        let [provinsi, kota, nik, nama, ttl, jenis_kelamin, golongan_darah, alamat, rt_rw, kel_desa, kecamatan, agama, status, pekerjaan, kewarganegaraan, masa_berlaku, terbuat, url] = args;

        // Validasi
        if (!provinsi || !kota || !nik || !nama || !ttl || !jenis_kelamin || !golongan_darah || !alamat || !rt_rw || !kel_desa || !kecamatan || !agama || !status || !pekerjaan || !kewarganegaraan || !masa_berlaku || !terbuat) {
            return m.reply(`❌ *ғᴏʀᴍᴀᴛ ᴛɪᴅᴀᴋ ᴋᴏᴍᴘʟᴇᴛ!*\n\nPastikan semua kolom terisi ya Idol-chan! 🥺✨`)
        }

        // Upload Foto
        if (!url) {
            if (!isImage) return m.reply('⚠️ *Oɪɪɪ!* Reply gambar dulu dong buat foto profilnya~ 📸');
            
            // 🔧 DOWNLOAD BUFFER (SAMA KAYA CONTOH REMINI)
            let buffer
            if (m.quoted && m.quoted.isMedia) {
                buffer = await m.quoted.download()
            } else if (m.isMedia) {
                buffer = await m.download()
            }

            if (!buffer) throw 'Gagal download gambar desu~'
            
            // UPLOAD KE UGUU.SE
            const form = new FormData()
            form.append('files[]', buffer, 'image.jpg')
            
            const upload = await axios.post('https://uguu.se/upload.php', form, {
                headers: form.getHeaders()
            })
            
            if (!upload.data.files || !upload.data.files[0]?.url) throw 'Gagal mengunggah gambar desu~'
            url = upload.data.files[0].url
        }

        await m.react('⚔️')

        // Proses ke API
        const params = new URLSearchParams({ provinsi, kota, nik, nama, ttl, jenis_kelamin, golongan_darah, alamat, rt_rw, kel_desa, kecamatan, agama, status, pekerjaan, kewarganegaraan, masa_berlaku, terbuat, url });
        const res = await axios.get(`https://api.zenzxz.my.id/maker/fakektp?${params}`, {
            responseType: 'arraybuffer' // 🔥 PENTING: Biar dapet buffer bener
        });
        
        if (!res.data) throw 'Server sedang bermasalah desu...'

        // 🔥 KIRIM HASIL (PASTI JADI GAMBAR)
        await sock.sendMessage(m.chat, { 
            image: res.data, // Langsung kirim buffer
            caption: `🪪 *ᴋᴀʀᴛᴜ ᴛᴀɴᴅᴀ ᴋᴇᴘᴇɴᴅᴜᴅᴜᴋᴀɴ*\n\n` +
                `╭───〔 ⚜️ *ɪᴅᴇɴᴛɪᴛᴀs* 〕───⬡\n` +
                `┃ 🏛️ Provinsi: *${provinsi}*\n` +
                `┃ 🏙️ Kota: *${kota}*\n` +
                `┃ 👤 Nama: *${nama}*\n` +
                `┃ 🔢 NIK: \`${nik}\`\n` +
                `┃ 📅 Berlaku Hingga: *${masa_berlaku}*\n` +
                `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬡\n\n` +
                `💫 *sᴜᴄᴄᴇssғᴜʟʟʏ ɢᴇɴᴇʀᴀᴛᴇᴅ ʙʏ*\n` +
                `✨ *H O S H I N O  A I  I D O L* ✨`
        }, { quoted: m });

        await m.react('✅')

    } catch (e) {
        console.error('[FAKEKTP ERROR]', e)
        await m.react('❌')
        return m.reply(`💥 *sʏsᴛᴇᴍ ᴇʀʀᴏʀ*\n\n> ${e}`)
    }
}

// ===== EXPORT =====
module.exports = {
    config: pluginConfig,
    handler
}