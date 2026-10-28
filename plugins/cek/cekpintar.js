const pluginConfig = {
    name: 'cekpintar',
    alias: ['pintar', 'iq', 'smart'],
    category: 'cek',
    description: 'Cek seberapa pintar kamu',
    usage: '.cekpintar <nama>',
    example: '.cekpintar Budi',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m) {
        const iq = Math.floor(Math.random() * 100) + 70
    
    let desc = ''
    if (iq >= 150) {
        desc = 'JENIUS! Einstein level! 🧠✨'
    } else if (iq >= 130) {
        desc = 'Sangat cerdas! 🎓'
    } else if (iq >= 110) {
        desc = 'Di atas rata-rata! 👍'
    } else if (iq >= 90) {
        desc = 'Normal, rata-rata 😊'
    } else {
        desc = 'Tetap semangat belajar! 📚'
    }
    
    let txt = mentioned === m.sender ? `Hai @${mentioned.split('@')[0]}
    
Tingkat kepintaran kamu *${percent}%*
\`\`\`${desc}\`\`\`` : `Kamu ingin ngecek tingkat kepintaran @${mentioned.split('@')[0]} yak? 
    
Tingkat kepintaran dia sebesar *${percent}%*
\`\`\`${desc}\`\`\``
    
    await m.reply(txt, { mentions: [mentioned] })
}

module.exports = {
    config: pluginConfig,
    handler
}
