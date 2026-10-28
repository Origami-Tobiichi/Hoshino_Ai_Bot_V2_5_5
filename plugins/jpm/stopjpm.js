const pluginConfig = {
    name: 'stopjpm',
    alias: ['stopjasher', 'stopjaser'],
    category: 'jpm',
    description: 'Hentikan proses JPM',
    usage: '.stopjpm',
    example: '.stopjpm',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 0,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    if (!global.statusjpm) {
        return m.reply(`❌ *Gomen ne~* ✦\n\n> Tidak ada JPM yang sedang berjalan~ 🥺`)
    }
    
    global.stopjpm = true
    
    m.react('⏹️')
    await m.reply(`⏹️ *sᴛᴏᴘ ᴊᴘᴍ*\nMenghentikan proses JPM...`)
}

module.exports = {
    config: pluginConfig,
    handler
}
