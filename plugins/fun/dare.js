const { getRandomItem } = require('../../src/lib/gameData');

const pluginConfig = {
    name: 'dare',
    alias: ['dareq', 'tantang'],
    category: 'fun',
    description: 'Random tantangan dare',
    usage: '.dare',
    example: '.dare',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
};

async function handler(m) {
    const challenge = getRandomItem('dare.json');
    
    if (!challenge) {
        await m.reply('❌ *Ehh~* Data tidak tersedia~ 🥺');
        return;
    }
    
    await m.reply(`\`\`\`${challenge}\`\`\``);
}

module.exports = {
    config: pluginConfig,
    handler
};
