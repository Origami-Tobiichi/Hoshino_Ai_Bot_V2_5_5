const { getDatabase } = require('../../src/lib/database');
const config = require('../../config');
const { getTodaySchedule, extractPrayerTimes, searchKota } = require('../../src/lib/sholatAPI');

const pluginConfig = {
    name: 'autosholat',
    alias: ['autoadzan'],
    category: 'owner',
    description: 'Toggle pengingat waktu sholat otomatis dengan audio adzan dan tutup grup',
    usage: '.autosholat on/off | on/off all | status | kota <nama> | waktu <sholat> <HH:mm> | waktu reset | test',
    example: '.autosholat on',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
};

const AUDIO_ADZAN = 'https://media.vocaroo.com/mp3/1ofLT2YUJAjQ';

let autoSholatTimer = null

const GambarSuasana = {
    tahajud: 'https://files.catbox.moe/f7tnuw.jpg',
    imsak:   'https://files.catbox.moe/f7tnuw.jpg',
    subuh:   'https://files.catbox.moe/f7tnuw.jpg',
    syuruq:  'https://files.catbox.moe/f7tnuw.jpg',
    dhuha:   'https://files.catbox.moe/f7tnuw.jpg',
    dzuhur:  'https://files.catbox.moe/f7tnuw.jpg',
    ashar:   'https://files.catbox.moe/f7tnuw.jpg',
    maghrib: 'https://files.catbox.moe/f7tnuw.jpg',
    isya:    'https://files.catbox.moe/f7tnuw.jpg'
};

const SHOLAT_LABEL = {
    tahajud: 'Tahajud',
    imsak:   'Imsak',
    subuh:   'Subuh',
    syuruq:  'Syuruq',
    dhuha:   'Dhuha',
    dzuhur:  'Dzuhur',
    ashar:   'Ashar',
    maghrib: 'Maghrib',
    isya:    'Isya'
};

const SHOLAT_QUOTE = {
    tahajud: `Malam masih sunyi, tapi hati yang cinta Allah selalu terjaga~\nBangun sejenak, sujud di keheningan malam ☆`,
    imsak:   `Sebentar lagi fajar tiba~\nAi ingatkan... jangan sampai melewatkan sahur dan persiapan subuh ya ★`,
    subuh:   `Fajar menyingsing, bintang-bintang pun bersembunyi~\nTapi cahaya hati kita tetap menyala karena sholat ☆`,
    syuruq:  `Matahari mulai mengintip di ufuk timur~\nWaktu syuruq tiba, mari isi pagi dengan dzikir dan rasa syukur ★`,
    dhuha:   `Pagi yang cerah, rezeki pun menanti~\nSholat Dhuha adalah kunci pintu rezeki yang Allah janjikan ☆`,
    dzuhur:  `Di tengah hari yang sibuk, jangan lupa berhenti sejenak~\nAllah selalu menunggu kita ★`,
    ashar:   `Sore ini, langit memanggil kita dengan lembut~\nYuk, tunaikan sholat Ashar sebelum waktu berlalu ☆`,
    maghrib: `Matahari pamit, malam mulai tiba~\nAi selalu bilang... jangan sampai melewatkan momen indah ini ★`,
    isya:    `Malam yang tenang, hati yang damai~\nTutup hari ini dengan sholat Isya, yuk~ ☆`
};

function parseTime(str) {
    if (!str || str === '-') return null;
    const [h, m] = str.split(':').map(Number);
    return h * 60 + m;
}

function getCurrentMinutes() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    return now.getHours() * 60 + now.getMinutes();
}

function detectCurrentSholat(times) {
    const order = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
    const minutes = getCurrentMinutes();

    const parsed = {};
    for (const s of order) {
        parsed[s] = parseTime(times[s]);
    }

    // Isya → Subuh (melewati tengah malam)
    const subuh = parsed.subuh;
    const isya = parsed.isya;
    if (subuh !== null && isya !== null) {
        if (minutes >= isya || minutes < subuh) return 'isya';
    }

    // Cek dari isya ke atas
    for (let i = order.length - 1; i >= 0; i--) {
        const curr = parsed[order[i]];
        if (curr !== null && minutes >= curr) return order[i];
    }

    return 'subuh';
}

function getTimezone(kotaNama) {
    const nama = kotaNama?.toUpperCase() || ''
    const wita = [
        'MAKASSAR', 'MANADO', 'PALU', 'KENDARI', 'GORONTALO',
        'MAMUJU', 'PALOPO', 'PARE', 'BULUKUMBA', 'WATAMPONE',
        'MAJENE', 'POLEWALI', 'PINRANG', 'ENREKANG', 'SINJAI',
        'BANTAENG', 'JENEPONTO', 'TAKALAR', 'GOWA', 'MAROS',
        'PANGKEP', 'BARRU', 'SOPPENG', 'WAJO', 'BONE',
        'LUWU', 'TANA TORAJA', 'TORAJA',
        'BALIKPAPAN', 'SAMARINDA', 'TARAKAN', 'BONTANG',
        'BERAU', 'KUTAI', 'PENAJAM', 'TANJUNG REDEB',
        'BANJARMASIN', 'BANJARBARU', 'MARTAPURA', 'KOTABARU',
        'KANDANGAN', 'AMUNTAI', 'PELAIHARI', 'RANTAU',
        'BALI', 'DENPASAR', 'SINGARAJA', 'TABANAN', 'GIANYAR',
        'KLUNGKUNG', 'BANGLI', 'KARANGASEM', 'JEMBRANA', 'BADUNG',
        'MATARAM', 'LOMBOK', 'SUMBAWA', 'BIMA', 'DOMPU',
        'KUPANG', 'ENDE', 'MAUMERE', 'LABUAN BAJO', 'RUTENG',
        'BAJAWA', 'WAINGAPU', 'WAIKABUBAK', 'SOE',
        'PALANGKARAYA', 'PALANGKA RAYA', 'SAMPIT', 'PANGKALAN BUN'
    ]
    const wit = [
        'AMBON', 'TERNATE', 'TIDORE', 'SOFIFI', 'TUAL',
        'MASOHI', 'NAMLEA', 'SAUMLAKI', 'TOBELO',
        'JAYAPURA', 'SORONG', 'MANOKWARI', 'MERAUKE', 'NABIRE',
        'TIMIKA', 'BIAK', 'SERUI', 'WAMENA', 'FAKFAK',
        'KAIMANA', 'SENTANI', 'ABEPURA', 'AGATS'
    ]
    if (wit.some(k => nama.includes(k))) return 'WIT'
    if (wita.some(k => nama.includes(k))) return 'WITA'
    return 'WIB'
}

function convertWaktu(waktu, kotaNama) {
    if (!waktu || waktu === '-') return waktu
    const tz = getTimezone(kotaNama)
    if (tz === 'WIB') return waktu
    const [h, m] = waktu.split(':').map(Number)
    const offset = tz === 'WITA' ? 1 : 2
    const newH = (h + offset) % 24
    return `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function buildCaption(sholat, waktu, kotaNama, closeGroup, duration) {
    const label = SHOLAT_LABEL[sholat] || sholat;
    const quote = SHOLAT_QUOTE[sholat] || '';

    const emoji = {
        tahajud: '🌌',
        imsak:   '⏳',
        subuh:   '🌅',
        syuruq:  '🌄',
        dhuha:   '🌤️',
        dzuhur:  '☀️',
        ashar:   '🌤️',
        maghrib: '🌇',
        isya:    '🌙'
    }[sholat] || '🕌';

    return (
        `${emoji} *ᴀssᴀʟᴀᴍᴜ'ᴀʟᴀɪᴋᴜᴍ ᴡᴀʀᴀʜᴍᴀᴛᴜʟʟᴀʜɪ ᴡᴀʙᴀʀᴀᴋᴀᴛᴜʜ* ${emoji}\n\n` +
        `☆ _${quote}_ ★\n\n` +
        `╭─〔 🕌 *ᴡᴀᴋᴛᴜ sʜᴏʟᴀᴛ ${label.toUpperCase()}* 〕─✧\n` +
        `│ 🕐 *Waktu* : \`${waktu} ${getTimezone(kotaNama)}\`\n` +
        `│ 📍 *Lokasi* : \`${kotaNama}\`\n` +
        `│ 📅 *Tanggal* : \`${new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'long', year: 'numeric' })}\`\n` +
        (closeGroup ? `│ 🔒 *Grup* : \`Ditutup ${duration} menit\`\n` : '') +
        `╰──────────────────────✦\n\n` +
        `🤲 *Mari tunaikan sholat ${label}~*\n` +
        `_Tinggalkan sejenak aktivitasmu, Allah menunggumu ☆_\n\n` +
        `★ _Ai love you, dan Allah lebih mencintaimu~_ ☆`
    );
}

async function sendSholatNotif(sock, jid, sholat, waktu, kotaSetting, closeGroup, duration, isTest = false) {
    const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06';
    const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI';

    const caption = buildCaption(sholat, waktu, kotaSetting.nama, closeGroup && !isTest, duration);
    const imageUrl = GambarSuasana[sholat];

    const contextInfo = {
        forwardingScore: 9999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: saluranId,
            newsletterName: saluranName,
            serverMessageId: 127
        }
    };

    // Kirim gambar suasana + caption
    await sock.sendMessage(jid, {
        image: { url: imageUrl },
        caption,
        contextInfo
    });

    // Kirim audio adzan
    await sock.sendMessage(jid, {
        audio: { url: AUDIO_ADZAN },
        mimetype: 'audio/mpeg',
        ptt: false,
        contextInfo
    });
}

async function handler(m, { sock, db }) {
    const args = m.args[0]?.toLowerCase();
    const database = getDatabase();

    // ── ON ALL / OFF ALL (owner, GLOBAL — semua grup sekaligus) ────────────
    if ((args === 'on' || args === 'off') && m.args[1]?.toLowerCase() === 'all') {
        if (!m.isOwner) {
            return m.reply(`❌ Nee, fitur ini khusus buat owner aja ya~ ☆`);
        }

        m.react('🕕');
        try {
            const groups = await sock.groupFetchAllParticipating();
            const groupIds = Object.keys(groups);
            let count = 0;

            for (const groupId of groupIds) {
                database.setGroup(groupId, { notifSholat: args === 'on' });
                count++;
            }
            await database.save();

            m.react('✅');
            return m.reply(
                args === 'on'
                    ? `🕌 *ɴᴏᴛɪꜰ sʜᴏʟᴀᴛ ɢʟᴏʙᴀʟ ᴏɴ* ☆\n\n> ✅ Aktifkan notif sholat di *${count}* grup! ★\n> Semua grup akan menerima adzan~ 🌸`
                    : `🔕 *ɴᴏᴛɪꜰ sʜᴏʟᴀᴛ ɢʟᴏʙᴀʟ ᴏꜰꜰ* ☆\n\n> ❌ Nonaktifkan notif sholat di *${count}* grup~\n> Tapi jangan lupa sholat ya minna 🤍`
            );
        } catch (err) {
            m.react('❌');
            return m.reply(`❌ Aduh, ada yang salah nih~ Error: ${err.message}`);
        }
    }

    // ── ON / OFF polos (admin grup, PER GRUP — cuma grup ini yang kena) ────
    if (args === 'on' || args === 'off') {
        if (!m.isGroup) {
            return m.reply(
                `❌ Nee, command ini harus dipakai di dalam grup ya~ ☆\n\n` +
                `> Mau atur semua grup sekaligus? Pakai:\n` +
                `> \`${m.prefix}autosholat ${args} all\` _(khusus owner)_`
            );
        }
        if (!m.isAdmin && !m.isOwner) {
            return m.reply(`❌ Nee, hanya admin grup yang bisa mengatur ini~ ☆`);
        }

        const isOn = args === 'on';
        database.setGroup(m.chat, { notifSholat: isOn });
        await database.save();

        m.react(isOn ? '🕌' : '🔕');
        return m.reply(
            isOn
                ? `🕌 *ɴᴏᴛɪꜰ sʜᴏʟᴀᴛ ᴀᴋᴛɪꜰ* ☆\n\n` +
                  `> ✅ Grup ini akan menerima pengingat waktu sholat~\n` +
                  `> Audio adzan & gambar suasana akan dikirim ★`
                : `🔕 *ɴᴏᴛɪꜰ sʜᴏʟᴀᴛ ɴᴏɴᴀᴋᴛɪꜰ* ☆\n\n` +
                  `> ❌ Grup ini tidak akan menerima pengingat sholat~\n` +
                  `> Gunakan \`${m.prefix}autosholat on\` untuk mengaktifkan kembali ★`
        );
    }

    // ── TEST (owner/admin grup) ──
    if (args === 'test') {
        if (!m.isOwner && !m.isAdmin) {
            return m.reply(`❌ Nee, hanya owner atau admin grup yang bisa test~ ☆`);
        }
        if (!m.isGroup) {
            return m.reply(`❌ Command test hanya bisa digunakan di dalam grup ya~ ☆`);
        }

        m.react('🔍');

        const kotaSetting = database.setting('autoSholatKota') || { id: '1301', nama: 'KOTA JAKARTA' };
        let times;
        try {
            const jadwalData = await getTodaySchedule(kotaSetting.id);
            times = extractPrayerTimes(jadwalData);
        } catch (e) {
            return m.reply(`❌ Gagal ambil jadwal sholat~ Error: ${e.message}`);
        }

        const sholatNow = detectCurrentSholat(times);
        const waktuNow = times[sholatNow];

        try {
            await sendSholatNotif(sock, m.chat, sholatNow, waktuNow, kotaSetting, false, 0, true);
            m.react('✅');
        } catch (e) {
            m.react('❌');
            return m.reply(`❌ Gagal kirim test~ Error: ${e.message}`);
        }
        return;
    }

    // Pastikan command owner-only di bawah ini (status, close, duration, kota)
    if (!m.isOwner) {
        return m.reply(`❌ Nee, fitur ini khusus buat owner aja ya~ ☆`);
    }

    if (!args || args === 'status') {
        const closeGroup = database.setting('autoSholatCloseGroup') ? '✅ Ya' : '❌ Tidak';
        const duration = database.setting('autoSholatDuration') || 5;
        const kotaSetting = database.setting('autoSholatKota') || { id: '1301', nama: 'KOTA JAKARTA' };

        let statusLine;
        if (m.isGroup) {
            const groupData = database.getGroup(m.chat) || {};
            statusLine = `│ 🔔 ɢʀᴜᴘ ɪɴɪ     : ${groupData.notifSholat === true ? '✅ Aktif' : '❌ Nonaktif'}\n`;
        } else {
            try {
                const groups = await sock.groupFetchAllParticipating();
                const groupIds = Object.keys(groups);
                const activeCount = groupIds.filter(id => database.getGroup(id)?.notifSholat === true).length;
                statusLine = `│ 🔔 ᴀᴋᴛɪꜰ ᴅɪ     : \`${activeCount}/${groupIds.length}\` grup\n`;
            } catch {
                statusLine = `│ 🔔 sᴛᴀᴛᴜs       : _per-grup, cek di dalam grup_\n`;
            }
        }

        let jadwalText = '';
        try {
            const jadwalData = await getTodaySchedule(kotaSetting.id);
            const times = extractPrayerTimes(jadwalData);
            const overrideStatus = database.setting('autoSholatOverride') || {} // tambah ini

            const jadwalOrder = [
                ['tahajud', overrideStatus['tahajud'] || '02:00'],
                ['imsak',   overrideStatus['imsak']   || times.imsak],
                ['subuh',   overrideStatus['subuh']   || times.subuh],
                ['syuruq',  overrideStatus['syuruq']  || times.syuruq],
                ['dhuha',   overrideStatus['dhuha']   || times.dhuha],
                ['dzuhur',  overrideStatus['dzuhur']  || times.dzuhur],
                ['ashar',   overrideStatus['ashar']   || times.ashar],
                ['maghrib', overrideStatus['maghrib'] || times.maghrib],
                ['isya',    overrideStatus['isya']    || times.isya]
            ];
            const emojiJadwal = { tahajud:'🌌', imsak:'⏳', subuh:'🌅', syuruq:'🌄', dhuha:'🌤️', dzuhur:'☀️', ashar:'🌤️', maghrib:'🌇', isya:'🌙' };
            for (const [nama, waktu] of jadwalOrder) {
                if (!waktu || waktu === '-') continue;
                const isOverride = !!overrideStatus[nama]
                jadwalText += `│ ${emojiJadwal[nama] || '🕌'} ${SHOLAT_LABEL[nama] || nama}: \`${waktu}\`${isOverride ? ' ✏️' : ''}\n`
            }
        } catch {
            jadwalText = '│ _Gagal memuat jadwal_\n';
        }

        return m.reply(
            `🕌 *ᴀᴜᴛᴏ sʜᴏʟᴀᴛ* ☆\n\n` +
            `╭─〔 📋 *sᴛᴀᴛᴜs* 〕─✧\n` +
            statusLine +
            `│ 🔒 ᴛᴜᴛᴜᴘ ɢʀᴜᴘ  : ${closeGroup}\n` +
            `│ ⏱️ ᴅᴜʀᴀsɪ      : \`${duration}\` menit\n` +
            `│ 📍 ᴋᴏᴛᴀ        : \`${kotaSetting.nama}\`\n` +
            `╰──────────────────────✦\n\n` +
            `╭─〔 🕐 *ᴊᴀᴅᴡᴀʟ ʜᴀʀɪ ɪɴɪ* 〕─✧\n` +
            jadwalText +
            `╰──────────────────────✦\n\n` +
            `> *Penggunaan:*\n` +
            `> \`${m.prefix}autosholat on\` — Aktifkan _(di grup ini)_\n` +
            `> \`${m.prefix}autosholat off\` — Nonaktifkan _(di grup ini)_\n` +
            `> \`${m.prefix}autosholat on all\` — Global ON semua grup _(owner)_\n` +
            `> \`${m.prefix}autosholat off all\` — Global OFF semua grup _(owner)_\n` +
            `> \`${m.prefix}autosholat close on/off\` — Toggle tutup grup\n` +
            `> \`${m.prefix}autosholat duration <menit>\` — Set durasi tutup\n` +
            `> \`${m.prefix}autosholat kota <nama>\` — Set lokasi\n` +
            `> \`${m.prefix}autosholat test\` — Test kirim notif\n` +
            `> \`${m.prefix}autosholat waktu <sholat> <HH:mm>\` — Set waktu manual\n` +
            `> \`${m.prefix}autosholat waktu reset\` — Reset ke jadwal API\n` +
            `> \`${m.prefix}autosholat waktu\` — Lihat override aktif\n\n` +
            `> _Sumber: myquran.com (real-time)_`
        );
    }

    if (args === 'close') {
        const subArg = m.args[1]?.toLowerCase();
        if (subArg === 'on') {
            database.setting('autoSholatCloseGroup', true);
            await database.save();
            m.react('🔒');
            return m.reply(`🔒 *ᴛᴜᴛᴜᴘ ɢʀᴜᴘ ᴅɪᴀᴋᴛɪꜰᴋᴀɴ* ☆\n\n> Grup akan ditutup saat waktu sholat tiba~`);
        }
        if (subArg === 'off') {
            database.setting('autoSholatCloseGroup', false);
            await database.save();
            m.react('🔓');
            return m.reply(`🔓 *ᴛᴜᴛᴜᴘ ɢʀᴜᴘ ᴅɪɴᴏɴᴀᴋᴛɪꜰᴋᴀɴ* ☆\n\n> Grup tidak akan ditutup saat waktu sholat~`);
        }
        return m.reply(`❌ *Ehh~* Gunakan: \`${m.prefix}autosholat close on/off\``);
    }

    if (args === 'duration') {
        const duration = parseInt(m.args[1]);
        if (isNaN(duration) || duration < 1 || duration > 60) {
            return m.reply(`❌ *ɢᴀɢᴀʟ* ☆\n\n> Durasi harus antara 1-60 menit~`);
        }
        database.setting('autoSholatDuration', duration);
        await database.save();
        m.react('⏱️');
        return m.reply(`⏱️ *ᴅᴜʀᴀsɪ ᴅɪsᴇᴛ* ☆\n\n> Grup akan ditutup \`${duration}\` menit saat waktu sholat~ ★`);
    }

    if (args === 'kota') {
        const kotaName = m.args.slice(1).join(' ').trim();
        if (!kotaName) {
            return m.reply(`❌ *Ehh~* Gunakan: \`${m.prefix}autosholat kota Jakarta\``);
        }

        m.react('🔍');
        try {
            const result = await searchKota(kotaName);
            if (!result) {
                return m.reply(`❌ Kota "${kotaName}" tidak ditemukan~`);
            }

            database.setting('autoSholatKota', {
                id: result.id,
                nama: result.lokasi
            });
            await database.save();

            m.react('📍');
            return m.reply(
                `📍 *ʟᴏᴋᴀsɪ ᴅɪsᴇᴛ* ☆\n\n` +
                `> 🏙️ Kota: *${result.lokasi}*\n` +
                `> Jadwal sholat akan mengikuti lokasi ini~ ★`
            );
        } catch (e) {
            return m.reply(`❌ *ɢᴀɢᴀʟ* ☆\n\n> ${e.message}`);
        }
    }
    
    if (args === 'waktu') {
    const subArg = m.args[1]?.toLowerCase()
    
    // Reset semua override
    if (subArg === 'reset') {
        database.setting('autoSholatOverride', null)
        await database.save()
        m.react('🔄')
        return m.reply(`🔄 *ᴡᴀᴋᴛᴜ sʜᴏʟᴀᴛ ᴅɪʀᴇsᴇᴛ* ☆\n\n> Waktu sholat kembali mengikuti jadwal dari API~`)
    }

    const sholatName = subArg
    const waktuInput = m.args[2]

    const validSholat = ['tahajud', 'imsak', 'subuh', 'syuruq', 'dhuha', 'dzuhur', 'ashar', 'maghrib', 'isya']

    if (!sholatName || !validSholat.includes(sholatName)) {
        const override = database.setting('autoSholatOverride') || {}
        const kotaSetting = database.setting('autoSholatKota') || { nama: 'KOTA JAKARTA' }
        const tz = getTimezone(kotaSetting.nama)

        let overrideText = ''
        for (const s of validSholat) {
            if (override[s]) overrideText += `│ ${SHOLAT_LABEL[s]}: \`${override[s]}\` _(manual)_\n`
        }

        return m.reply(
            `🕐 *sᴇᴛ ᴡᴀᴋᴛᴜ sʜᴏʟᴀᴛ* ☆\n\n` +
            `╭─〔 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 〕─✧\n` +
            `│ Set manual:\n` +
            `│ \`${m.prefix}autosholat waktu <sholat> <HH:mm>\`\n` +
            `│\n` +
            `│ Contoh:\n` +
            `│ \`${m.prefix}autosholat waktu maghrib 18:30\`\n` +
            `│ \`${m.prefix}autosholat waktu subuh 04:45\`\n` +
            `│\n` +
            `│ Reset ke API:\n` +
            `│ \`${m.prefix}autosholat waktu reset\`\n` +
            `╰──────────────────────✦\n\n` +
            (overrideText
                ? `╭─〔 ✏️ *ᴏᴠᴇʀʀɪᴅᴇ ᴀᴋᴛɪꜰ* 〕─✧\n${overrideText}╰──────────────────────✦\n\n`
                : `> _Belum ada waktu yang di-override~_\n\n`) +
            `> Sholat yang bisa diset: ${validSholat.join(', ')}\n` +
            `> Timezone aktif: *${tz}*`
        )
    }

    if (!waktuInput || !/^\d{1,2}:\d{2}$/.test(waktuInput)) {
        return m.reply(`❌ Format waktu salah~\n\nGunakan format \`HH:mm\`, contoh: \`18:30\``)
    }

    // Validasi jam & menit
    const [h, min] = waktuInput.split(':').map(Number)
    if (h > 23 || min > 59) {
        return m.reply(`❌ Waktu tidak valid~ Jam 0-23, menit 0-59`)
    }

    const waktuFormatted = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
    const override = database.setting('autoSholatOverride') || {}
    override[sholatName] = waktuFormatted
    database.setting('autoSholatOverride', override)
    await database.save()

    m.react('✅')
    return m.reply(
        `✅ *ᴡᴀᴋᴛᴜ sʜᴏʟᴀᴛ ᴅɪsᴇᴛ* ☆\n\n` +
        `> 🕌 Sholat: *${SHOLAT_LABEL[sholatName]}*\n` +
        `> 🕐 Waktu: *${waktuFormatted}*\n` +
        `> ⚠️ _Ini override manual, tidak mengikuti API_\n\n` +
        `> Gunakan \`${m.prefix}autosholat waktu reset\` untuk kembali ke jadwal API~`
    )
}

    return m.reply(`❌ *ᴀᴄᴛɪᴏɴ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ* ☆\n\n> Gunakan: \`on\`, \`off\`, \`on/off all\`, \`close on/off\`, \`duration <menit>\`, \`kota <nama>\`, \`test\``);
}

async function runAutoSholat(sock) {
    const db = getDatabase();

    // Catatan: tidak ada lagi "master switch" global. Pengiriman notif
    // sepenuhnya dikontrol per-grup lewat flag notifSholat (lihat di bawah).
    // ".autosholat on/off" → toggle grup ini saja
    // ".autosholat on/off all" → toggle semua grup sekaligus (owner)

    const kotaSetting = db.setting('autoSholatKota') || { id: '1301', nama: 'KOTA JAKARTA' };

    let times;
    try {
        const jadwalData = await getTodaySchedule(kotaSetting.id);
        times = extractPrayerTimes(jadwalData);
    } catch {
        return;
    }

    const JADWAL = {
        tahajud: '02:00',
        imsak:   times.imsak,
        subuh:   times.subuh,
        syuruq:  times.syuruq,
        dhuha:   times.dhuha,
        dzuhur:  times.dzuhur,
        ashar:   times.ashar,
        maghrib: times.maghrib,
        isya:    times.isya
    };
    
// Konversi jadwal API ke timezone lokal dulu
const JADWAL_LOCAL = {}
for (const [sholat, waktu] of Object.entries(JADWAL)) {
    JADWAL_LOCAL[sholat] = convertWaktu(waktu, kotaSetting.nama)
}

// Override manual langsung masuk JADWAL_LOCAL (sudah dalam timezone lokal user)
const override = db.setting('autoSholatOverride') || {}
for (const [sholat, waktu] of Object.entries(override)) {
    if (waktu) JADWAL_LOCAL[sholat] = waktu
}
    const timeHelper = require('../../src/lib/timeHelper');
    const tzMap = { WIB: 'Asia/Jakarta', WITA: 'Asia/Makassar', WIT: 'Asia/Jayapura' }
    const tz = getTimezone(kotaSetting.nama)
    const timeNow = timeHelper.getCurrentTimeStringByTZ(tzMap[tz])

    if (!global.autoSholatLock) global.autoSholatLock = {};

    for (const [sholat, waktu] of Object.entries(JADWAL_LOCAL)) {
        if (waktu === '-') continue;
        if (timeNow !== waktu) continue;
        if (global.autoSholatLock[sholat]) continue;

        global.autoSholatLock[sholat] = true;

        try {
            global.isFetchingGroups = true;
            const groupsObj = await sock.groupFetchAllParticipating();
            global.isFetchingGroups = false;
            const groupList = Object.keys(groupsObj);

            const closeGroup = db.setting('autoSholatCloseGroup') || false;
            const duration = db.setting('autoSholatDuration') || 5;

            for (const jid of groupList) {
                const groupData = db.data?.groups?.[jid] || {};
                if (groupData.notifSholat !== true) continue;

                try {
                    await sendSholatNotif(sock, jid, sholat, waktu, kotaSetting, closeGroup, duration);

                    if (closeGroup) {
                        await sock.groupSettingUpdate(jid, 'announcement');
                    }

                    await new Promise(res => setTimeout(res, 5000));
                } catch (e) {
                    console.log(`[AutoSholat] Gagal kirim ke ${jid}:`, e.message);
                }
            }

            if (closeGroup) {
                const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06';
                const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI';
                const contextInfo = {
                    forwardingScore: 9999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: saluranId,
                        newsletterName: saluranName,
                        serverMessageId: 127
                    }
                };

                setTimeout(async () => {
                    for (const jid of groupList) {
                        const groupData = db.data?.groups?.[jid] || {};
                        if (groupData.notifSholat !== true) continue;
                        try {
                            await sock.groupSettingUpdate(jid, 'not_announcement');
                            await sock.sendMessage(jid, {
                                text: `✅ *ɢʀᴜᴘ ᴅɪʙᴜᴋᴀ ᴋᴇᴍʙᴀʟɪ* ☆\n\n> Waktu sholat ${SHOLAT_LABEL[sholat]} telah selesai~\n> Yuk kembali beraktivitas dengan semangat! ★`,
                                contextInfo
                            });
                            await new Promise(res => setTimeout(res, 600));
                        } catch (e) {
                            console.log(`[AutoSholat] Gagal buka grup ${jid}:`, e.message);
                        }
                    }
                    console.log(`[AutoSholat] Semua grup dibuka kembali`);
                }, duration * 60 * 1000);
            }

            const activeGroups = groupList.filter(jid => db.data?.groups?.[jid]?.notifSholat === true)
console.log(`[AutoSholat] Pengingat ${sholat} terkirim ke ${activeGroups.length} grup (dari ${groupList.length} total)`)

        } catch (error) {
            global.isFetchingGroups = false;
            console.error('[AutoSholat] Error:', error.message);
        }

        setTimeout(() => {
            delete global.autoSholatLock[sholat];
        }, 2 * 60 * 1000);
    }
}

function startAutoSholatScheduler(sockInstance) {
    if (autoSholatTimer) clearInterval(autoSholatTimer)
    
    // Jalankan sekali langsung saat start
    runAutoSholat(sockInstance).catch(e => console.error('[AutoSholat] Error:', e.message))
    
    // Lalu tiap 60 detik
    autoSholatTimer = setInterval(() => {
        runAutoSholat(sockInstance).catch(e => console.error('[AutoSholat] Error:', e.message))
    }, 60000)
    
    console.log('[AutoSholat] Scheduler started')
}

function stopAutoSholatScheduler() {
    if (autoSholatTimer) {
        clearInterval(autoSholatTimer)
        autoSholatTimer = null
        console.log('[AutoSholat] Scheduler stopped')
    }
}

module.exports = {
    config: pluginConfig,
    handler,
    runAutoSholat,
    startAutoSholatScheduler,
    stopAutoSholatScheduler,
    AUDIO_ADZAN
}