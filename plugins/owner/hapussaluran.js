const pluginConfig = {
    name: 'hapussaluran',
    alias: ['deletesaluran', 'deletenewsletter'],
    category: 'owner',
    description: 'Hapus saluran/newsletter',
    usage: '.hapussaluran <id_saluran>',
    example: '.hapussaluran 120363xxx@newsletter',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.text?.trim() || ''
    let targetJid = text

    if (!targetJid) {
        return m.reply(
            `🗑️ *ʜᴏsʜɪɴᴏ ᴀɪ ʜᴀᴘᴜs sᴀʟᴜʀᴀɴ*\n\n` +
            `"Saluran mana yang mau dihapus, Sayang~?" 🌟\n\n` +
            `> \`${m.prefix}hapussaluran <id_saluran>\`\n\n` +
            `📝 Contoh:\n` +
            `> \`${m.prefix}hapussaluran 120363xxx@newsletter\`\n\n` +
            `⚠️ Saluran akan dihapus secara permanen!`
        )
    }

    if (!targetJid.endsWith('@newsletter')) {
        targetJid += '@newsletter'
    }

    m.react('⭐')

    try {
        await sock.newsletterDelete(targetJid)
        await m.react('✅')
        return m.reply(
            `🗑️ *sᴀʟᴜʀᴀɴ ᴅɪʜᴀᴘᴜs*\n\n` +
            `"Oke, salurannya udah aku hapus ya~" 💖\n\n` +
            `> ID: ${targetJid}`
        )
    } catch (err) {
        m.react('💔')
        return m.reply(
            `💔 *ᴇʀʀᴏʀ ᴘᴀɴɢɢᴜɴɢ*\n\n` +
            `"Kyaa~ gagal nih~" 🎤\n\n` +
            `> Masalah: ${err.message}`
        )
    }
}

module.exports = { config: pluginConfig, handler }