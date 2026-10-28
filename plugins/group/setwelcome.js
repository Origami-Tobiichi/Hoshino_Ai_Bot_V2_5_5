const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'setwelcome',
    alias: ['customwelcome'],
    category: 'group',
    description: 'Set custom welcome message',
    usage: '.setwelcome <pesan>',
    example: '.setwelcome Halo {user}, selamat datang di {group}!',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    isAdmin: true,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const text = m.fullArgs?.trim() || m.args.join(' ')
    
    if (!text) {
        return m.reply(
            `📝 *sᴇᴛ ᴡᴇʟᴄᴏᴍᴇ*\n\n` +
            `╭┈┈⬡「 📋 *ᴘʟᴀᴄᴇʜᴏʟᴅᴇʀ* 」\n` +
            `┃ ◦ \`{user}\` - Nama member\n` +
            `┃ ◦ \`{group}\` - Nama grup\n` +
            `┃ ◦ \`{desc}\` - Deskripsi grup\n` +
            `┃ ◦ \`{count}\` - Jumlah member\n` +
            `╰┈┈⬡\n\n` +
            `\`Contoh:\`\n` +
            `\`${m.prefix}setwelcome Halo {user}! 👋\`\n` +
            `\`Selamat datang di {group}\``
        )
    }
    
    db.setGroup(m.chat, { welcomeMsg: text, welcome: true })
    db.save()
    
    m.react('✅')
    
    await m.reply(
        `✅ Welcome berhasil di set menjadi *${text}*\nMau reset? ketik ${m.prefix}resetwelcome`
    )
}

module.exports = {
    config: pluginConfig,
    handler
}
