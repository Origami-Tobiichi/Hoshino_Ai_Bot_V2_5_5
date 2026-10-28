const { getDatabase } = require('./database');
const { logger } = require('./colors');
const config = require('../../config');
const { getTodaySchedule, extractPrayerTimes } = require('./sholatAPI');

const SHOLAT_MESSAGES = {
    imsak: '🌙 *WAKTU IMSAK*\n\n> Hai Sahabat, waktu Imsak telah tiba.\n> Segera makan sahur sebelum waktu habis.',
    subuh: '🌅 *WAKTU SUBUH*\n\n> Hai Sahabat, waktu Sholat Subuh telah tiba.\n> Ambilah air wudhu dan segeralah sholat.',
    terbit: '☀️ *WAKTU TERBIT*\n\n> Matahari telah terbit.\n> Selamat beraktivitas hari ini!',
    dhuha: '🌤️ *WAKTU DHUHA*\n\n> Hai Sahabat, waktu Sholat Dhuha telah tiba.\n> Jangan lupa sholat Dhuha 2-8 rakaat.',
    dzuhur: '🌞 *WAKTU DZUHUR*\n\n> Hai Sahabat, waktu Sholat Dzuhur telah tiba.\n> Ambilah air wudhu dan segeralah sholat.',
    ashar: '🌇 *WAKTU ASHAR*\n\n> Hai Sahabat, waktu Sholat Ashar telah tiba.\n> Ambilah air wudhu dan segeralah sholat.',
    maghrib: '🌆 *WAKTU MAGHRIB*\n\n> Hai Sahabat, waktu Sholat Maghrib telah tiba.\n> Ambilah air wudhu dan segeralah sholat.',
    isya: '🌙 *WAKTU ISYA*\n\n> Hai Sahabat, waktu Sholat Isya telah tiba.\n> Ambilah air wudhu dan segeralah sholat.'
};

const GAMBAR_SUASANA = {
    imsak: 'https://cdn.gimita.id/download/images_1769502277606_04d594fe.jfif',
    subuh: 'https://cdn.gimita.id/download/images_1769502277606_04d594fe.jfif',
    terbit: 'https://cdn.gimita.id/download/images_1769502277606_04d594fe.jfif',
    dhuha: 'https://cdn.gimita.id/download/images_1769502277606_04d594fe.jfif',
    dzuhur: 'https://cdn.gimita.id/download/qf2d6868_sheikh-zayed-grand-mosque_625x300_04_March_25_1769502237718_92212561.webp',
    ashar: 'https://cdn.gimita.id/download/18537d69-a2e0-4dc2-a144-57dde0f359b5_1769502389063_5c004902.jpg',
    maghrib: 'https://cdn.gimita.id/download/mosque-5950407_1280_1769502206553_660ae15c.webp',
    isya: 'https://cdn.gimita.id/download/pngtree-nighttime-mosque-illustration-with-realistic-details-celebrating-ramadan-kareem-mubarak-image_3814083_1769502091988_e4cf3326.jpg'
};

const AUDIO_ADZAN = 'https://media.vocaroo.com/mp3/1ofLT2YUJAjQ';

let lastNotifiedTime = '';
let sholatInterval = null;
let sock = null;
let cachedSchedule = null;
let cacheDate = '';

// ── Timezone helper ───────────────────────────────────────────────────────────
function getTimezoneByKota(namaKota = '') {
    const nama = namaKota.toLowerCase()
    const isWITA = ['makassar', 'balikpapan', 'banjarmasin', 'denpasar', 'lombok', 'kupang', 'samarinda', 'pontianak', 'mataram', 'kendari', 'palu']
        .some(k => nama.includes(k))
    const isWIT = ['jayapura', 'ambon', 'ternate', 'sorong', 'manokwari', 'fakfak', 'biak']
        .some(k => nama.includes(k))
    return isWIT ? 'Asia/Jayapura' : isWITA ? 'Asia/Makassar' : 'Asia/Jakarta'
}

function initSholatScheduler(socketInstance) {
    sock = socketInstance;
    if (sholatInterval) clearInterval(sholatInterval);
    sholatInterval = setInterval(checkSholatTime, 30000);
    logger.info('SholatScheduler', 'Prayer time scheduler started (real-time API)');
}

function getCurrentTimeWIB() {
    const db = getDatabase()
    const kotaSetting = db.setting('autoSholatKota') || { nama: 'KOTA JAKARTA' }
    const tz = getTimezoneByKota(kotaSetting.nama)
    const timeHelper = require('./timeHelper')
    return timeHelper.getCurrentTimeStringByTZ(tz)
}

function getTodayDateString() {
    const db = getDatabase()
    const kotaSetting = db.setting('autoSholatKota') || { nama: 'KOTA JAKARTA' }
    const tz = getTimezoneByKota(kotaSetting.nama)
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
}

async function loadTodaySchedule() {
    const todayStr = getTodayDateString()
    if (cachedSchedule && cacheDate === todayStr) return cachedSchedule

    const db = getDatabase()
    const kotaSetting = db.setting('autoSholatKota') || { id: '1301', nama: 'KOTA JAKARTA' }
    const tz = getTimezoneByKota(kotaSetting.nama)

    try {
        const jadwalData = await getTodaySchedule(kotaSetting.id, tz)
        cachedSchedule = extractPrayerTimes(jadwalData)
        cacheDate = todayStr
        return cachedSchedule
    } catch (e) {
        logger.error('SholatScheduler', `Gagal fetch jadwal: ${e.message}`)
        return null
    }
}

function isTimeMatch(current, target) {
    if (current === target) return true;
    const [ch, cm] = current.split(':').map(Number);
    const [th, tm] = target.split(':').map(Number);
    const diff = Math.abs((ch * 60 + cm) - (th * 60 + tm));
    return diff === 0;
}

async function checkSholatTime() {
    if (!sock) return;

    const db = getDatabase();
    const globalEnabled = db.setting('autoSholat');
    if (!globalEnabled) return;

    const currentTime = getCurrentTimeWIB();
    if (currentTime === lastNotifiedTime) return;

    const schedule = await loadTodaySchedule();
    if (!schedule) return;

    for (const [sholat, waktu] of Object.entries(schedule)) {
        if (waktu === '-') continue;
        if (isTimeMatch(currentTime, waktu)) {
            lastNotifiedTime = currentTime;
            await sendSholatNotifications(sholat, waktu);
            setTimeout(() => { lastNotifiedTime = ''; }, 120000);
            break;
        }
    }
}

async function sendSholatNotifications(sholat, waktu) {
    try {
        const db = getDatabase();
        const closeGroup = db.setting('autoSholatCloseGroup') || false;
        const duration = db.setting('autoSholatDuration') || 5;
        const sendAudio = db.setting('autoSholatAudio') !== false;
        const kotaSetting = db.setting('autoSholatKota') || { nama: 'KOTA JAKARTA' }
        const tz = getTimezoneByKota(kotaSetting.nama)
        const tzLabel = tz === 'Asia/Jayapura' ? 'WIT' : tz === 'Asia/Makassar' ? 'WITA' : 'WIB'

        const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06';
        const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI';

        let groupList = [];
        try {
            const groupsObj = await sock.groupFetchAllParticipating();
            groupList = Object.keys(groupsObj);
        } catch (e) {
            logger.error('SholatScheduler', `Failed to fetch groups: ${e.message}`);
            return;
        }

        if (groupList.length === 0) return;

        let sentCount = 0;
        const closedGroups = [];
        const isSholatTime = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'].includes(sholat);

        let message = `${SHOLAT_MESSAGES[sholat] || `🕌 *WAKTU ${sholat.toUpperCase()}*`}\n\n⏰ *${waktu} ${tzLabel}*\n📍 *${kotaSetting.nama}*`;

        if (closeGroup && isSholatTime) {
            message += `\n\n> 🔒 _Grup ditutup ${duration} menit untuk sholat_`;
        }

        for (const groupId of groupList) {
            const groupData = db.data?.groups?.[groupId] || {};
            if (groupData.notifSholat === false) continue;

            try {
                if (sendAudio && isSholatTime) {
                    await sock.sendMessage(groupId, {
                        audio: { url: AUDIO_ADZAN },
                        mimetype: 'audio/mpeg',
                        ptt: false,
                        contextInfo: {
                            externalAdReply: {
                                title: `🕌 Waktu ${sholat.charAt(0).toUpperCase() + sholat.slice(1)}, Telah tiba`,
                                body: `${kotaSetting.nama} | Sumber: myquran.com`,
                                thumbnailUrl: GAMBAR_SUASANA[sholat],
                                sourceUrl: 'https://waktunya.ibadah',
                                mediaType: 1,
                                renderLargerThumbnail: true
                            },
                            forwardingScore: 9999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: saluranId,
                                newsletterName: saluranName,
                                serverMessageId: 127
                            }
                        }
                    });
                } else {
                    await sock.sendMessage(groupId, {
                        text: message,
                        contextInfo: {
                            externalAdReply: {
                                title: `🕌 Waktu ${sholat.charAt(0).toUpperCase() + sholat.slice(1)}`,
                                body: `${waktu} ${tzLabel} | ${kotaSetting.nama}`,
                                thumbnailUrl: GAMBAR_SUASANA[sholat],
                                sourceUrl: config.saluran?.link || 'https://waktunya.ibadah',
                                mediaType: 1,
                                renderLargerThumbnail: true
                            },
                            forwardingScore: 9999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: saluranId,
                                newsletterName: saluranName,
                                serverMessageId: 127
                            }
                        }
                    });
                }

                if (closeGroup && isSholatTime) {
                    try {
                        await sock.groupSettingUpdate(groupId, 'announcement');
                        closedGroups.push(groupId);
                    } catch (e) {
                        logger.error('SholatScheduler', `Failed to close ${groupId}: ${e.message}`);
                    }
                }

                sentCount++;
                await new Promise(r => setTimeout(r, 5000));
            } catch (err) {
                logger.error('SholatScheduler', `Failed to send to ${groupId}: ${err.message}`);
            }
        }

        if (closeGroup && closedGroups.length > 0) {
            setTimeout(async () => {
                for (const groupId of closedGroups) {
                    try {
                        await sock.groupSettingUpdate(groupId, 'not_announcement');
                        await sock.sendMessage(groupId, {
                            text: `✅ Grup dibuka kembali setelah sholat ${sholat}.\n\n> Semoga sholat kita diterima. Aamiin 🤲`,
                            contextInfo: {
                                forwardingScore: 9999,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: saluranId,
                                    newsletterName: saluranName,
                                    serverMessageId: 127
                                }
                            }
                        });
                        await new Promise(r => setTimeout(r, 600));
                    } catch (e) {
                        logger.error('SholatScheduler', `Failed to open ${groupId}: ${e.message}`);
                    }
                }
                logger.info('SholatScheduler', `Opened ${closedGroups.length} groups after ${sholat}`);
            }, duration * 60 * 1000);
        }

        const activeGroups = groupList.filter(jid => db.data?.groups?.[jid]?.notifSholat !== false)
        logger.info('SholatScheduler', `Sent ${sholat} notification to ${sentCount} groups (dari ${groupList.length} total)` + (closedGroups.length > 0 ? ` (${closedGroups.length} closed)` : ''));

    } catch (error) {
        logger.error('SholatScheduler', `Error: ${error.message}`);
    }
}

function stopSholatScheduler() {
    if (sholatInterval) {
        clearInterval(sholatInterval);
        sholatInterval = null;
        logger.info('SholatScheduler', 'Prayer time scheduler stopped');
    }
}

module.exports = {
    initSholatScheduler,
    stopSholatScheduler,
    SHOLAT_MESSAGES,
    GAMBAR_SUASANA,
    AUDIO_ADZAN
};