const pluginConfig = {
    name: 'cektinggi',
    alias: ['tinggi', 'tall'],
    category: 'cek',
    description: 'Cek tinggi badan random',
    usage: '.cektinggi <nama>',
    example: '.cektinggi Budi',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m) {
        const tinggi = Math.floor(Math.random() * 50) + 150
    
    let desc = ''
    if (tinggi >= 190) {
        desc = 'TINGGI BANGET! Model basketball! 🏀'
    } else if (tinggi >= 175) {
        desc = 'Tinggi ideal! 😎'
    } else if (tinggi >= 165) {
        desc = 'Lumayan tinggi 👍'
    } else if (tinggi >= 155) {
        desc = 'Standard kok 🙂'
    } else {
        desc = 'Imut dan mungil! 🥺'
    }
    
    let txt = mentioned === m.sender ? `Hai @${mentioned.split('@')[0]}
    
Tingkat ketinggian kamu *${percent}%*
\`\`\`${desc}\`\`\`` : `Kamu ingin ngecek tingkat ketinggian @${mentioned.split('@')[0]} yak? 
    
Tingkat ketinggian dia sebesar *${percent}%*
\`\`\`${desc}\`\`\``
    
    await m.reply(txt, { mentions: [mentioned] })
}

module.exports = {
    config: pluginConfig,
    handler
}
