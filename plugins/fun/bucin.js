const { getRandomItem } = require('../../src/lib/gameData');

const pluginConfig = {
    name: 'bucin',
    alias: ['gombal', 'love', 'romantis'],
    category: 'fun',
    description: 'Random kata-kata bucin/romantis',
    usage: '.bucin',
    example: '.bucin',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
};

async function handler(m) {
    const quote = getRandomItem('bucin.json');
    
    if (!quote) {
        await m.reply('❌ *Ehh~* Data tidak tersedia~ 🥺');
        return;
    }
    
    await m.reply(`\`\`\`"${quote}"\`\`\`\n\n`);
}

module.exports = {
    config: pluginConfig,
    handler
};
