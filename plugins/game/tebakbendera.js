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
const { fetchBuffer } = require('../../src/lib/functions');

const pluginConfig = {
    name: 'tebakbendera',
    alias: ['tbendera', 'flag'],
    category: 'game',
    description: 'Tebak nama negara dari bendera',
    usage: '.tebakbendera',
    example: '.tebakbendera',
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
        if (session && session.gameType === 'tebakbendera') {
            const remaining = getRemainingTime(chatId);
            let text = `⚠️ *Eh ada game jalan nih, jawab dulu!*\n\n`;
            text += `> 🏳️ Tebak bendera negara apa ini?\n`;
            text += `💡 Hint: *${getHint(session.question.name, 2)}*\n`;
            text += `⏱️ Sisa: *${formatRemainingTime(remaining)}*\n\n`;
            text += `_Jawab langsung atau ketik "nyerah"\nSetiap salah, hint akan bertambah_`;
            await m.reply(text);
            return;
        }
    }
    
    const question = getRandomItem('tebakbendera2.json');
    if (!question) {
        await m.reply('❌ *ᴅᴀᴛᴀ ᴛɪᴅᴀᴋ ᴛᴇʀsᴇᴅɪᴀ*\n\n> Ehh~ data game-nya belum tersedia nih... coba lagi nanti ya~ 🥺');
        return;
    }
    
    let imageBuffer;
    try {
        imageBuffer = await fetchBuffer(question.img);
    } catch (e) {
        await m.reply('❌ *ɢᴀɢᴀʟ ᴍᴇᴍᴜᴀᴛ ɢᴀᴍʙᴀʀ*\n\n> Coba lagi nanti!');
        return;
    }
    
    let text = `🏳️ *ᴛᴇʙᴀᴋ ʙᴇɴᴅᴇʀᴀ*\n\n`;
    text += `> 🌍 Bendera negara apa ini?\n`;
    text += `💡 Hint: *${getHint(question.name, 2)}*\n`;
    text += `⏱️ Waktu: *60 detik*\n`;
    text += `🎁 Hadiah: *Limit, Koin, EXP (random)*\n\n`;
    text += `_Jawab langsung atau ketik "nyerah"\nSetiap salah, hint akan bertambah_`;
    
    // NOTE: Soal berupa gambar asli (imageBuffer) — SENGAJA selalu pakai V1 (getGameContextInfo)
    // apapun setting contextVariant. getGameContextInfoV2 pakai fake document/vcard trick yang
    // TIDAK bisa menampilkan gambar soal asli, jadi tidak boleh di-branch ke V2.
    const sentMsg = await sock.sendMessage(chatId, {
        image: imageBuffer,
        caption: text,
        contextInfo: getGameContextInfo('🏳️ TEBAK BENDERA', 'Tebak negara!')
    }, { quoted: m });
    
    createSession(chatId, 'tebakbendera', question, sentMsg.key, 60000);
    
    setSessionTimer(chatId, async () => {
        let timeoutText = `⏱️ *Yah telat, waktu habis!*\n\n`;
        timeoutText += `Jawaban: *${question.name}*\n\n`;
        timeoutText += `_Gak ada yang bisa jawab nih~_`;
        await m.reply(timeoutText);
    });
}

async function answerHandler(m, sock) {
    const chatId = m.chat;
    const session = getSession(chatId);
    
    if (!session || session.gameType !== 'tebakbendera') return false;
    
    const userAnswer = (m.body || '').trim();
    if (!userAnswer || userAnswer.startsWith('.')) return false;
    
    if (isSurrender(userAnswer)) {
        endSession(chatId);
        let text = `🏳️ *Yahhh nyerah deh...*\n\n`;
        text += `Jawaban: *${session.question.name}*\n\n`;
        text += `_@${m.sender.split('@')[0]} menyerah_`;
        await m.reply(text, { mentions: [m.sender] });
        return true;
    }

    if (!isReplyToGame(m, session)) return false;

    session.attempts++;
    
    const result = checkAnswerAdvanced(session.question.name, userAnswer);
    
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
        
        let text = `🌟 *GG WP! Otakmu encer!*\n\n`;
        text += `Jawaban: *${session.question.name}*\n`;
        text += `Pemenang: *@${m.sender.split('@')[0]}*\n`;
        text += `Percobaan: *${session.attempts}x*\n\n`;
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
