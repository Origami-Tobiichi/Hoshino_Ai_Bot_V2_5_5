const pluginConfig = {
    name: 'star',
    alias: ['bintang'],
    category: 'owner',
    description: 'Beri/hapus bintang pada pesan',
    usage: '.star (reply pesan) atau .star hapus (reply pesan)',
    example: '.star',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    if (!m.quoted) {
        return m.reply(
            `⭐ *ʜᴏsʜɪɴᴏ ᴀɪ sᴛᴀʀ*\n\n` +
            `"Mau tandain pesan mana, Sayang~?" 🌟\n\n` +
            `> \`${m.prefix}star\` (reply pesan) — Beri bintang\n` +
            `> \`${m.prefix}star hapus\` (reply pesan) — Hapus bintang`
        )
    }

    const unstar = m.args[0]?.toLowerCase() === 'hapus' || m.args[0]?.toLowerCase() === 'unstar'
    const key = m.quoted.key

    m.react('⭐')

    try {
        await sock.chatModify({
            star: {
                messages: [{ id: key.id, fromMe: key.fromMe }],
                star: !unstar
            }
        }, m.chat)

        await m.react('✅')
        return m.reply(
            unstar
                ? `❌ *ʙɪɴᴛᴀɴɢ ᴅɪʜᴀᴘᴜs*\n\n"Oke, bintangnya aku hapus ya~" 😴`
                : `⭐ *ᴘᴇsᴀɴ ᴅɪᴛᴀɴᴅᴀɪ ʙɪɴᴛᴀɴɢ*\n\n"Yeay! Pesannya aku bintangin~ 💖"`
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