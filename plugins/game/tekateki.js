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
const {getGameContextInfo, getGameContextInfoV2 } = require('../../src/lib/contextHelper');

const pluginConfig = {
    name: 'tekateki',
    alias: ['teka', 'riddle'],
    category: 'game',
    description: 'Game teka-teki tradisional',
    usage: '.tekateki',
    example: '.tekateki',
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
        if (session && session.gameType === 'tekateki') {
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
    
    const question = getRandomItem('tekateki.json');
    if (!question) {
        await m.reply('❌ *Ehh~* Data game tidak tersedia~ 🥺');
        return;
    }
    
    let text = `🧩 *TEKA-TEKI*\n\n`;
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
        sentMsg = await sock.sendMessage(chatId, { text, contextInfo: getGameContextInfo('🧩 TEKA-TEKI', 'Jawab teka-teki!') }, { quoted: m });
    }
    
    createSession(chatId, 'tekateki', question, sentMsg.key, 60000);
    
    setSessionTimer(chatId, async () => {
        let timeoutText = `⏱️ *Yah telat, waktu habis!*\n\n`;
        timeoutText += `Jawaban: *${question.jawaban}*\n\n`;
        timeoutText += `_Gak ada yang bisa jawab nih~_`;
        await m.reply(timeoutText);
    });
}

async function answerHandler(m, sock) {
    const chatId = m.chat;
    const session = getSession(chatId);
    
    if (!session || session.gameType !== 'tekateki') return false;
    
    const userAnswer = (m.body || '').trim();
    if (!userAnswer || userAnswer.startsWith('.')) return false;
    
    if (isSurrender(userAnswer)) {
        endSession(chatId);
        let text = `🏳️ *Yahhh nyerah deh...*\n\n`;
        text += `Jawaban: *${session.question.jawaban}*\n\n`;
        text += `_@${m.sender.split('@')[0]} menyerah_`;
        await m.reply(text, { mentions: [m.sender] });
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
        db.updateEnergi(m.sender, reward.limit);
        db.updateKoin(m.sender, reward.koin);
        
        if (!user.rpg) user.rpg = {};
        await addExpWithLevelCheck(sock, m, db, user, reward.exp);
        db.save();
        
        let text = `🌟 *GG WP! Otakmu encer!*\n\n`;
        text += `Jawaban: *${session.question.jawaban}*\n`;
        text += `Pemenang: *@${m.sender.split('@')[0]}*\n`;
        text += `Percobaan: *${session.attempts}x*\n\n`;
        text += `\`\`\`+${reward.limit} Limit ditambahkan!\`\`\``;
        
        await m.reply(text, { mentions: [m.sender] });
        return true;
    }
    
    if (result.status === 'close') {
        const remaining = getRemainingTime(chatId);
        const percent = Math.round(result.similarity * 100);
        await m.react('🔥');
        await m.reply(`🔥 *Hampir!* Jawabanmu *${percent}%* mirip!\n_Sisa waktu: *${formatRemainingTime(remaining)}*_`);
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

module.exports = {
    config: pluginConfig,
    handler,
    answerHandler
};
