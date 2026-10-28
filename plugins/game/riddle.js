const {
    getRandomItem, createSession, getSession, endSession,
    checkAnswerAdvanced, getHint, hasActiveSession, setSessionTimer,
    getRemainingTime, formatRemainingTime, isSurrender, isReplyToGame,
    GAME_REWARD,
    getRandomReward,
    getProgressiveHint
} = require('../../src/lib/gameData');
const { getDatabase } = require('../../src/lib/database');
const { addExpWithLevelCheck } = require('../../src/lib/levelHelper');
const {getGameContextInfo, getWinnerContextInfo, checkFastAnswer, getGameContextInfoV2 } = require('../../src/lib/contextHelper');

const pluginConfig = {
    name: 'riddle',
    alias: ['rd', 'tebaktebak', 'riddles'],
    category: 'game',
    description: 'Pecahkan teka-teki logika yang menantang',
    usage: '.riddle',
    example: '.riddle',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
};

async function handler(m, { sock }) {
    const chatId = m.chat;

    if (hasActiveSession(chatId)) {
        const session = getSession(chatId);
        if (session && session.gameType === 'riddle') {
            const remaining = getRemainingTime(chatId);
            let text = `⚠️ *Eh ada game jalan nih, jawab dulu!*\n\n`;
            text += `\`\`\`${session.question.soal}\`\`\`\n\n`;
            text += `💡 Hint: *${getHint(session.question.jawaban, 2)}*\n`;
            text += `⏱️ Sisa: *${formatRemainingTime(remaining)}*\n\n`;
            text += `_Jawab langsung atau ketik "nyerah"\nSetiap salah, hint akan bertambah_`;
            await m.reply(text);
            return;
        }
    }

    const question = getRandomItem('riddle.json');
    if (!question) {
        await m.reply('❌ *ᴅᴀᴛᴀ ᴛɪᴅᴀᴋ ᴛᴇʀsᴇᴅɪᴀ*\n\n> Ehh~ data game-nya belum tersedia nih... coba lagi nanti ya~ 🥺');
        return;
    }

    let text = `🧩 *ʀɪᴅᴅʟᴇ*\n\n`;
    text += `\`\`\`${question.soal}\`\`\`\n\n`;
    text += `💡 Hint: *${getHint(question.jawaban, 2)}*\n`;
    text += `⏱️ Waktu: *90 detik*\n`;
    text += `🎁 Hadiah: *Limit, Koin, EXP (random)*\n\n`;
    text += `_Jawab langsung atau ketik "nyerah"\nSetiap salah, hint akan bertambah_`;

    const db = getDatabase();
    const contextVariant = db.setting('contextVariant') || 1;

    let sentMsg;
    if (contextVariant === 2) {
        sentMsg = await getGameContextInfoV2(sock, chatId, text, { quoted: m });
    } else {
        sentMsg = await sock.sendMessage(chatId, { text, contextInfo: getGameContextInfo('🧩 RIDDLE', 'Pecahkan teka-teki logika!') }, { quoted: m });
    }
    createSession(chatId, 'riddle', question, sentMsg.key, 90000);

    setSessionTimer(chatId, async () => {
        await sock.sendMessage(chatId, { text: `⏱️ *Yah telat, waktu habis!*\n\nJawaban: *${question.jawaban}*\n\n_Gak ada yang bisa jawab nih~_`, contextInfo: getGameContextInfo() });
    });
}

async function answerHandler(m, sock) {
    const chatId = m.chat;
    const session = getSession(chatId);
    if (!session || session.gameType !== 'riddle') return false;

    const userAnswer = (m.body || '').trim();
    if (!userAnswer || userAnswer.startsWith('.')) return false;

    if (isSurrender(userAnswer)) {
        endSession(chatId);
        await m.reply(`🏳️ *ᴍᴇɴʏᴇʀᴀʜ!*\n\nJawaban: *${session.question.jawaban}*\n\n_@${m.sender.split('@')[0]} menyerah_`, { mentions: [m.sender] });
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

        let text = `🔥 *SABI COY! Jawabanmu tepat!*\n\nJawaban: *${session.question.jawaban}*\nPemenang: *@${m.sender.split('@')[0]}*\nPercobaan: *${session.attempts}x*\n\n`;
        text += `🎁 +${totalLimit} Limit, +${totalBalance} Koin, +${totalExp} EXP`;
        text += bonusText;

        await m.reply(text, { mentions: [m.sender] });
        return true;
    }

    if (result.status === 'close') {
        const remaining = getRemainingTime(chatId);
        await m.react('🔥');
        await m.reply(`🔥 *Hampir!* Jawabanmu *${Math.round(result.similarity * 100)}%* mirip!\n_Sisa waktu: *${formatRemainingTime(remaining)}*_`);
        return false;
    }

    const remaining = getRemainingTime(chatId);
    if (remaining > 0 && session.attempts < 10) {
        await m.react('❌');
        const hint = getProgressiveHint(session.question.jawaban, session.attempts);
        await m.reply(`❌ *Belum bener~!* Ayo coba lagi ya, ini hint dari Ai: *${hint}*\n_Sisa waktu: *${formatRemainingTime(remaining)}*_ 🌸`);
    }
    return false;
}

module.exports = { config: pluginConfig, handler, answerHandler };
