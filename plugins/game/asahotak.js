const { 
    getRandomItem, createSession, getSession, endSession, 
    checkAnswerAdvanced, getHint, hasActiveSession, setSessionTimer,
    getRemainingTime, formatRemainingTime, isSurrender, isReplyToGame,
    GAME_REWARD
} = require('../../src/lib/gameData');
const { getDatabase } = require('../../src/lib/database');
const { addExpWithLevelCheck } = require('../../src/lib/levelHelper');
const {getGameContextInfo, getGameContextInfoV2 } = require('../../src/lib/contextHelper');

const pluginConfig = {
    name: 'asahotak',
    alias: ['asah', 'quiz'],
    category: 'game',
    description: 'Game asah otak - tebak jawaban dari pertanyaan',
    usage: '.asahotak',
    example: '.asahotak',
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
        if (session && session.gameType === 'asahotak') {
            const remaining = getRemainingTime(chatId);
            let text = `⚠️ *Masih ada game berjalan!*\n\n`;
            text += `\`\`\`${session.question.soal}\`\`\`\n\n`;
            text += `> 💡 Hint: *${getHint(session.question.jawaban, 2)}*\n`;
            text += `> ⏱️ Sisa: *${formatRemainingTime(remaining)}*\n\n`;
            text += `_Reply pesan soal sebelumnya untuk menjawab atau ketik "nyerah"_`;
            await m.reply(text);
            return;
        }
    }
    
    const question = getRandomItem('asahotak.json');
    if (!question) {
        await m.reply('❌ *Ehh~* Data game tidak tersedia~ 🥺');
        return;
    }
    
    let text = `🧠 *ASAH OTAK*\n\n`;
    text += `\`\`\`${question.soal}\`\`\`\n\n`;
    text += `> 💡 Hint: *${getHint(question.jawaban, 2)}*\n`;
    text += `> ⏱️ Waktu: *60 detik*\n`;
    text += `> 🎁 Hadiah: *+${GAME_REWARD.limit} Limit, +${GAME_REWARD.koin} Bal, +${GAME_REWARD.exp} EXP*\n\n`;
    text += `_Reply pesan ini dengan jawabanmu atau ketik "nyerah"_`;
    
    const db = getDatabase();
    const contextVariant = db.setting('contextVariant') || 1;

    let sentMsg;
    if (contextVariant === 2) {
        sentMsg = await getGameContextInfoV2(sock, chatId, text, { quoted: m });
    } else {
        sentMsg = await sock.sendMessage(chatId, { text, contextInfo: getGameContextInfo('🧠 ASAH OTAK', 'Jawab pertanyaan!') }, { quoted: m });
    }
    
    createSession(chatId, 'asahotak', question, sentMsg.key, 60000);
    
    setSessionTimer(chatId, async () => {
        let timeoutText = `⏱️ *WAKTU HABIS!*\n\n`;
        timeoutText += `> Jawaban: *${question.jawaban}*\n\n`;
        timeoutText += `_Tidak ada yang berhasil menjawab_`;
        await sock.sendMessage(chatId, { text: timeoutText, contextInfo: getGameContextInfo() });
    });
}

async function answerHandler(m, sock) {
    const chatId = m.chat;
    const session = getSession(chatId);
    
    if (!session || session.gameType !== 'asahotak') return false;
    
    const userAnswer = m.text || m.body || '';
    if (!userAnswer || userAnswer.startsWith('.')) return false;
    
    if (isSurrender(userAnswer)) {
        endSession(chatId);
        let text = `🏳️ *MENYERAH!*\n\n`;
        text += `> Jawaban: *${session.question.jawaban}*\n\n`;
        text += `_@${m.sender.split('@')[0]} menyerah_`;
        await m.reply(text, { mentions: [m.sender] });
        return true;
    }
    
    if (!isReplyToGame(m, session)) {
        return false;
    }
    
    session.attempts++;
    
    const result = checkAnswerAdvanced(session.question.jawaban, userAnswer);
    
    if (result.status === 'correct') {
        endSession(chatId);
        
        const db = getDatabase();
        const user = db.getUser(m.sender);
        
        db.updateEnergi(m.sender, GAME_REWARD.limit);
        db.updateKoin(m.sender, GAME_REWARD.koin);
        
        if (!user.rpg) user.rpg = {};
        await addExpWithLevelCheck(sock, m, db, user, GAME_REWARD.exp);
        db.save();
        
        let text = `🎉 *BENAR!*\n\n`;
        text += `> Jawaban: *${session.question.jawaban}*\n`;
        text += `> Pemenang: *@${m.sender.split('@')[0]}*\n`;
        text += `> Percobaan: *${session.attempts}x*\n\n`;
        text += `╭┈┈⬡「 🎁 *ʜᴀᴅɪᴀʜ* 」\n`;
        text += `┃ 📊 +${GAME_REWARD.limit} Limit\n`;
        text += `┃ 💰 +${GAME_REWARD.koin} Balance\n`;
        text += `┃ ⭐ +${GAME_REWARD.exp} EXP\n`;
        text += `╰┈┈┈┈┈┈┈┈⬡`;
        
        await m.reply(text, { mentions: [m.sender] });
        return true;
    }
    
    if (result.status === 'close') {
        const remaining = getRemainingTime(chatId);
        const percent = Math.round(result.similarity * 100);
        await m.reply(`🔥 *Hampir!* Jawabanmu *${percent}%* mirip!\n> _Sisa waktu: *${formatRemainingTime(remaining)}*_`);
        return false;
    }
    
    const remaining = getRemainingTime(chatId);
    if (remaining > 0 && session.attempts < 10) {
        await m.reply(`❌ *Salah!* _Sisa waktu: *${formatRemainingTime(remaining)}*_`);
    }
    
    return false;
}

module.exports = {
    config: pluginConfig,
    handler,
    answerHandler
};
