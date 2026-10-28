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
    name: 'tebakkimia',
    alias: ['kimia', 'chemistry', 'unsur'],
    category: 'game',
    description: 'Tebak lambang unsur kimia',
    usage: '.tebakkimia',
    example: '.tebakkimia',
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
        if (session && session.gameType === 'tebakkimia') {
            const remaining = getRemainingTime(chatId);
            let text = `⚠️ *Eh ada game jalan nih, jawab dulu!*\n\n`;
            text += `> 🧪 Unsur: *${session.question.unsur}*\n`;
            text += `💡 Hint: *${getHint(session.question.lambang, 1)}*\n`;
            text += `⏱️ Sisa: *${formatRemainingTime(remaining)}*\n\n`;
            text += `_Jawab langsung atau ketik "nyerah"\nSetiap salah, hint akan bertambah_`;
            await m.reply(text);
            return;
        }
    }
    
    const question = getRandomItem('tebakkimia.json');
    if (!question) {
        await m.reply('❌ *ᴅᴀᴛᴀ ᴛɪᴅᴀᴋ ᴛᴇʀsᴇᴅɪᴀ*\n\n> Ehh~ data game-nya belum tersedia nih... coba lagi nanti ya~ 🥺');
        return;
    }
    
    let text = `🧪 *ᴛᴇʙᴀᴋ ᴋɪᴍɪᴀ*\n\n`;
    text += `> 🔬 Apa lambang unsur *${question.unsur}*?\n`;
    text += `💡 Hint: *${getHint(question.lambang, 1)}*\n`;
    text += `⏱️ Waktu: *45 detik*\n`;
    text += `🎁 Hadiah: *Limit, Koin, EXP (random)*\n\n`;
    text += `_Jawab langsung atau ketik "nyerah"\nSetiap salah, hint akan bertambah_`;
    
    const db = getDatabase();
    const contextVariant = db.setting('contextVariant') || 1;

    let sentMsg;
    if (contextVariant === 2) {
        sentMsg = await getGameContextInfoV2(sock, chatId, text, { quoted: m });
    } else {
        sentMsg = await sock.sendMessage(chatId, { text, contextInfo: getGameContextInfo('🧪 TEBAK KIMIA', 'Tebak unsur!') }, { quoted: m });
    }
    
    createSession(chatId, 'tebakkimia', question, sentMsg.key, 45000);
    
    setSessionTimer(chatId, async () => {
        let timeoutText = `⏱️ *Yah telat, waktu habis!*\n\n`;
        timeoutText += `Jawaban: *${question.lambang}*\n\n`;
        timeoutText += `_Gak ada yang bisa jawab nih~_`;
        await m.reply(timeoutText);
    });
}

async function answerHandler(m, sock) {
    const chatId = m.chat;
    const session = getSession(chatId);
    
    if (!session || session.gameType !== 'tebakkimia') return false;
    
    const userAnswer = (m.body || '').trim();
    if (!userAnswer || userAnswer.startsWith('.')) return false;
    
    if (isSurrender(userAnswer)) {
        endSession(chatId);
        let text = `🏳️ *Yahhh nyerah deh...*\n\n`;
        text += `> Unsur: *${session.question.unsur}*\n`;
        text += `Jawaban: *${session.question.lambang}*\n\n`;
        text += `_@${m.sender.split('@')[0]} menyerah_`;
        await m.reply(text, { mentions: [m.sender] });
        return true;
    }

    if (!isReplyToGame(m, session)) return false;

    session.attempts++;
    
    const result = checkAnswerAdvanced(session.question.lambang, userAnswer);
    
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
        
        let text = `🎯 *BULLSEYE! Tepat sasaran!*\n\n`;
        text += `> Unsur: *${session.question.unsur}*\n`;
        text += `Jawaban: *${session.question.lambang}*\n`;
        text += `Pemenang: *@${m.sender.split('@')[0]}*\n\n`;
        text += `🎁 +${totalLimit} Limit, +${totalBalance} Koin, +${totalExp} EXP`;
        text += bonusText;
        
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
