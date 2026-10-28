const fs = require('fs');
const path = require('path');
const {
    getRandomItem, createSession, getSession, endSession,
    checkAnswerAdvanced, getHint, hasActiveSession, setSessionTimer,
    getRemainingTime, formatRemainingTime, isSurrender, isReplyToGame,
    getRandomReward,
    getProgressiveHint, clearCache
} = require('../../src/lib/gameData');
const { getDatabase } = require('../../src/lib/database');
const { addExpWithLevelCheck } = require('../../src/lib/levelHelper');
const { getGameContextInfo, getWinnerContextInfo, checkFastAnswer, getGameContextInfoV2 } = require('../../src/lib/contextHelper');

const pluginConfig = {
    name: 'tebakgd',
    alias: ['tgd', 'gdquiz', 'guessgd'],
    category: 'game',
    description: 'Tebak istilah, level, dan karakter dari Geometry Dash',
    usage: '.tebakgd [add/del/edit/total/cek] ...',
    example: '.tebakgd add SOAL BARU|JAWABAN BARU',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
};

const DATA_PATH = path.join(__dirname, '../../src/data/tebakgd.json');
const MANAGEMENT_SUBS = ['add', 'tambah', 'del', 'hapus', 'delete', 'edit', 'ganti', 'total', 'cek', 'scan', 'help', 'bantuan', 'list'];
const READMORE = String.fromCharCode(8206).repeat(4001);

function loadQuestions() {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

function saveQuestions(list) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(list, null, 2), 'utf8');
    clearCache('tebakgd.json');
}

function normalize(str) {
    return (str || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

async function handleManagement(m, sub, rest) {
    if (!m.isOwner) {
        await m.reply('❌ *Fitur ini khusus owner!*');
        return;
    }

    const list = loadQuestions();

    switch (sub) {
        case 'add':
        case 'tambah': {
            const [soalRaw, jawabanRaw] = rest.split('|').map(s => s && s.trim());
            if (!soalRaw || !jawabanRaw) {
                await m.reply('❌ *Format salah!*\n\nGunakan:\n`.tebakgd add <soal>|<jawaban>`');
                return;
            }
            const normSoal = normalize(soalRaw);
            const dup = list.find(q => normalize(q.soal) === normSoal);
            if (dup) {
                await m.reply(`❌ *Soal sudah ada, gak ditambahin!*\n\n\`\`\`${dup.soal}\`\`\`\n_Jawaban: ${dup.jawaban}_`);
                return;
            }
            list.push({ soal: soalRaw.toUpperCase(), jawaban: jawabanRaw.toUpperCase() });
            saveQuestions(list);
            await m.reply(`✅ *Soal berhasil ditambahkan!*\n\n\`\`\`${soalRaw.toUpperCase()}\`\`\`\n📊 Total soal sekarang: *${list.length}*`);
            return;
        }
        case 'del':
        case 'hapus':
        case 'delete': {
            const num = parseInt(rest, 10);
            if (!num || num < 1 || num > list.length) {
                await m.reply(`❌ *Nomor gak valid!*\n\nGunakan:\n\`.tebakgd del <nomor>\`\n_Total soal: ${list.length}_`);
                return;
            }
            const removed = list.splice(num - 1, 1)[0];
            saveQuestions(list);
            await m.reply(`🗑️ *Soal #${num} dihapus!*\n\n\`\`\`${removed.soal}\`\`\`\n\n📊 Sisa soal: *${list.length}*`);
            return;
        }
        case 'edit':
        case 'ganti': {
            const parts = rest.split('|').map(s => s && s.trim());
            const num = parseInt(parts[0], 10);
            const soalBaru = parts[1];
            const jawabanBaru = parts[2];
            if (!num || num < 1 || num > list.length || !soalBaru || !jawabanBaru) {
                await m.reply('❌ *Format salah!*\n\nGunakan:\n`.tebakgd edit <nomor>|<soal baru>|<jawaban baru>`');
                return;
            }
            const normSoal = normalize(soalBaru);
            const dup = list.find((q, i) => i !== num - 1 && normalize(q.soal) === normSoal);
            if (dup) {
                await m.reply(`❌ *Soal baru itu udah dipakai di nomor lain!*\n\n\`\`\`${dup.soal}\`\`\``);
                return;
            }
            const old = list[num - 1];
            list[num - 1] = { soal: soalBaru.toUpperCase(), jawaban: jawabanBaru.toUpperCase() };
            saveQuestions(list);
            await m.reply(`✏️ *Soal #${num} diperbarui!*\n\nSebelum:\n\`\`\`${old.soal}\`\`\`\n\nSesudah:\n\`\`\`${soalBaru.toUpperCase()}\`\`\``);
            return;
        }
        case 'list': {
            if (list.length === 0) {
                await m.reply('📭 *Belum ada soal sama sekali.*');
                return;
            }
            const lines = list.map((q, i) => `*${i + 1}.* Soal: ${q.soal}\n   Jawaban: ${q.jawaban}`);
            const header = `📋 *Daftar Soal Tebak GD (${list.length})*\n\n`;
            const l = header + lines[0];
            const r = lines.length > 1 ? '\n\n' + lines.slice(1).join('\n\n') : '';
            await m.reply(l + READMORE + r);
            return;
        }
        case 'total': {
            await m.reply(`📊 *Total soal Tebak GD: ${list.length}*`);
            return;
        }
        case 'help':
        case 'bantuan': {
            let text = `🛠️ *ᴛᴇʙᴀᴋɢᴅ ᴍᴀɴᴀɢᴇᴍᴇɴᴛ (ᴏᴡɴᴇʀ ᴏɴʟʏ)*\n\n`;
            text += `\`.tebakgd add <soal>|<jawaban>\`\n_Tambah soal baru, ditolak kalau soal udah ada_\n\n`;
            text += `\`.tebakgd del <nomor>\`\n_Hapus soal berdasarkan nomor_\n\n`;
            text += `\`.tebakgd edit <nomor>|<soal baru>|<jawaban baru>\`\n_Ganti soal & jawaban di nomor tertentu_\n\n`;
            text += `\`.tebakgd list\`\n_Lihat semua soal & jawaban (readmore)_\n\n`;
            text += `\`.tebakgd total\`\n_Lihat total soal yang ada_\n\n`;
            text += `\`.tebakgd cek\` / \`.tebakgd scan\`\n_Scan seluruh soal, cari yang duplikat_\n\n`;
            text += `\`.tebakgd help\`\n_Nampilin pesan ini_`;
            await m.reply(text);
            return;
        }
        case 'cek':
        case 'scan': {
            const seen = new Map();
            list.forEach((q, i) => {
                const key = normalize(q.soal);
                if (!seen.has(key)) seen.set(key, []);
                seen.get(key).push(i + 1);
            });
            const dupGroups = [...seen.values()].filter(idxs => idxs.length > 1);
            if (dupGroups.length === 0) {
                await m.reply(`✅ *Gak ada soal duplikat!*\n\n📊 Total soal: *${list.length}*`);
                return;
            }
            let text = `⚠️ *Ditemukan ${dupGroups.length} grup soal duplikat:*\n\n`;
            dupGroups.forEach(idxs => {
                text += `\`\`\`${list[idxs[0] - 1].soal}\`\`\`\n📍 Nomor: ${idxs.join(', ')}\n\n`;
            });
            await m.reply(text.trim());
            return;
        }
    }
}

async function handler(m, { sock }) {
    const chatId = m.chat;
    const body = (m.body || '').trim();
    const bodyParts = body.split(/\s+/);
    const sub = (bodyParts[1] || '').toLowerCase();

    if (MANAGEMENT_SUBS.includes(sub)) {
        const rest = bodyParts.slice(2).join(' ');
        await handleManagement(m, sub, rest);
        return;
    }

    if (hasActiveSession(chatId)) {
        const session = getSession(chatId);
        if (session && session.gameType === 'tebakgd') {
            const remaining = getRemainingTime(chatId);
            let text = `⚠️ *Masih ada GD Quiz yang belum dijawab!*\n\n`;
            text += `\`\`\`${session.question.soal}\`\`\`\n\n`;
            text += `💡 Hint: *${getHint(session.question.jawaban, 2)}*\n`;
            text += `⏱️ Sisa: *${formatRemainingTime(remaining)}*\n\n`;
            text += `_Jawab langsung atau ketik "nyerah"\nSetiap salah, hint akan bertambah_`;
            await m.reply(text);
            return;
        }
    }

    const question = getRandomItem('tebakgd.json');
    if (!question) {
        await m.reply('❌ *ᴅᴀᴛᴀ ᴛɪᴅᴀᴋ ᴛᴇʀsᴇᴅɪᴀ*\n\n> Ehh~ data game-nya belum tersedia nih... coba lagi nanti ya~ 🥺');
        return;
    }

    let text = `🔥 *ᴛᴇʙᴀᴋ ɢᴇᴏᴍᴇᴛʀʏ ᴅᴀsʜ*\n\n`;
    text += `\`\`\`${question.soal}\`\`\`\n\n`;
    text += `💡 Hint: *${getHint(question.jawaban, 2)}*\n`;
    text += `⏱️ Waktu: *60 detik*\n`;
    text += `🎁 Hadiah: *Limit, Koin, EXP (random)*\n\n`;
    text += `_Jawab langsung atau ketik "nyerah"\nSetiap salah, hint akan bertambah_`;

    const db = getDatabase();
    const contextVariant = db.setting('contextVariant') || 1;

    let sentMsg;
    if (contextVariant === 2) {
        sentMsg = await getGameContextInfoV2(sock, chatId, text, { quoted: m });
    } else {
        sentMsg = await sock.sendMessage(chatId, {
            text,
            contextInfo: getGameContextInfo('🔥 TEBAK GEOMETRY DASH', 'Seberapa GD-mu kamu?')
        }, { quoted: m });
    }

    createSession(chatId, 'tebakgd', question, sentMsg.key, 60000);

    setSessionTimer(chatId, async () => {
        let timeoutText = `⏱️ *Waktu habis! Gak ada yang tau nih~*\n\n`;
        timeoutText += `🎮 Jawaban: *${question.jawaban}*\n\n`;
        timeoutText += `_Coba lagi dengan .tebakgd_`;
        await m.reply(timeoutText);
    });
}

async function answerHandler(m, sock) {
    const chatId = m.chat;
    const session = getSession(chatId);
    if (!session || session.gameType !== 'tebakgd') return false;

    const userAnswer = (m.body || '').trim();
    if (!userAnswer || userAnswer.startsWith('.')) return false;

    if (isSurrender(userAnswer)) {
        endSession(chatId);
        await m.reply(
            `🏳️ *ᴍᴇɴʏᴇʀᴀʜ!*\n\n🎮 Jawaban: *${session.question.jawaban}*\n\n_@${m.sender.split('@')[0]} nyerah, belajar GD dulu sana!_`,
            { mentions: [m.sender] }
        );
        return true;
    }

    if (!isReplyToGame(m, session)) return false;

    session.attempts++;

    const result = checkAnswerAdvanced(session.question.jawaban, userAnswer);

    if (result.status === 'correct') {
        endSession(chatId);
        const db = getDatabase();
        const user = db.getUser(m.sender);

        const reward = getRandomReward();
        let totalLimit = reward.limit;
        let totalBalance = reward.koin;
        let totalExp = reward.exp;
        let bonusText = '';

        const fastResult = checkFastAnswer(session);
        if (fastResult.isFast) {
            totalLimit += fastResult.bonus.limit;
            totalBalance += fastResult.bonus.koin;
            totalExp += fastResult.bonus.exp;
            bonusText = `\n\n${fastResult.praise}\n⚡ *BONUS KILAT:* +${fastResult.bonus.limit} Limit, +${fastResult.bonus.koin} Koin\n⏱️ Waktu: *${(fastResult.elapsed / 1000).toFixed(1)}s*`;
        }

        db.updateEnergi(m.sender, totalLimit);
        db.updateKoin(m.sender, totalBalance);
        if (!user.rpg) user.rpg = {};
        await addExpWithLevelCheck(sock, m, db, user, totalExp);
        db.save();

        let text = `🎉 *GG EZ! Lu emang GD player sejati!*\n\n`;
        text += `🎮 Jawaban: *${session.question.jawaban}*\n`;
        text += `👑 Pemenang: *@${m.sender.split('@')[0]}*\n`;
        text += `📊 Percobaan: *${session.attempts}x*\n\n`;
        text += `🎁 +${totalLimit} Limit, +${totalBalance} Koin, +${totalExp} EXP`;
        text += bonusText;

        await m.reply(text, { mentions: [m.sender] });
        return true;
    }

    if (result.status === 'close') {
        const remaining = getRemainingTime(chatId);
        await m.react('🔥');
        await m.reply(
            `🔥 *Hampir!* Jawabanmu *${Math.round(result.similarity * 100)}%* mirip!\n_Sisa waktu: *${formatRemainingTime(remaining)}*_`
        );
        return false;
    }

    const remaining = getRemainingTime(chatId);
    if (remaining > 0 && session.attempts < 10) {
        await m.react('❌');
        const hint = getProgressiveHint(session.question.jawaban, session.attempts);
        await m.reply(`❌ Salah! Hint: *${hint}*\n_Sisa: *${formatRemainingTime(remaining)}*_`);
    }
    return false;
}

module.exports = { config: pluginConfig, handler, answerHandler };