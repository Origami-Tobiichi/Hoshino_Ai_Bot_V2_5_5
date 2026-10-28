const pluginConfig = {
    name: 'onlycmd',
    alias: ['lockbot', 'privatemode'],
    category: 'owner',
    description: 'Kunci akses bot di grup ini (Hanya Owner & User Terpilih)',
    usage: '.onlycmd on/off/add/remove',
    example: '.onlycmd on',
    isOwner: true, // Wajib Owner yang eksekusi
    isGroup: true,
    isEnabled: true
}

async function handler(m, { db }) {
    const command = m.args[0]?.toLowerCase()
    const groupData = db.getGroup(m.chat) || {}
    
    // Ambil target (dari tag, reply, atau ketik nomor)
    const target = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : m.args[1] ? m.args[1].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)

    // Pastikan array allowedUsers ada di database grup
    if (!groupData.allowedUsers) groupData.allowedUsers = []

    switch (command) {
        case 'on':
            db.setGroup(m.chat, { onlyCmd: true })
            m.reply('🔒 *ɢʀᴏᴜᴘ ʟᴏᴄᴋᴇᴅ*\n\n> Bot di grup ini sekarang hanya merespons Owner dan User yang diizinkan saja.')
            break

        case 'off':
            db.setGroup(m.chat, { onlyCmd: false })
            m.reply('🔓 *ɢʀᴏᴜᴘ ᴜɴʟᴏᴄᴋᴇᴅ*\n\n> Bot sekarang kembali bisa digunakan oleh semua member di grup ini.')
            break

        case 'add':
            if (!target) return m.reply('⚠️ *Eh eh~* Tag atau reply user yang ingin diizinkan~ 🌸')
            if (groupData.allowedUsers.includes(target)) return m.reply('✨ User tersebut sudah ada di daftar izin.')
            groupData.allowedUsers.push(target)
            db.setGroup(m.chat, { allowedUsers: groupData.allowedUsers })
            m.reply(`✅ *Yatta~* @${target.split('@')[0]} berhasil diizinkan di grup ini~ ✨`, { mentions: [target] })
            break

        case 'remove':
            if (!target) return m.reply('⚠️ *Eh eh~* Tag atau reply user yang ingin dihapus~ 🌸')
            groupData.allowedUsers = groupData.allowedUsers.filter(jid => jid !== target)
            db.setGroup(m.chat, { allowedUsers: groupData.allowedUsers })
            m.reply(`🗑️ Izin untuk @${target.split('@')[0]} telah dicabut.`, { mentions: [target] })
            break

        default:
            const status = groupData.onlyCmd ? 'AKTIF (Terkunci) 🔒' : 'NONAKTIF (Bebas) 🔓'
            m.reply(
                `✨ *ᴏɴʟʏ ᴄᴍᴅ ɢʀᴏᴜᴘ ᴍᴇɴᴜ*\n\n` +
                `> *.onlycmd on* — Kunci grup (Only Owner)\n` +
                `> *.onlycmd off* — Buka grup (Public)\n` +
                `> *.onlycmd add @tag* — Tambah pengecualian user\n` +
                `> *.onlycmd remove @tag* — Hapus pengecualian user\n\n` +
                `📊 Status di grup ini: *${status}*`
            )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}