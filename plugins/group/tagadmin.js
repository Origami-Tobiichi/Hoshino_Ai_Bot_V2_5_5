const { getParticipantJid } = require('../../src/lib/lidHelper')

const pluginConfig = {
    name: 'tagadmin',
    alias: ['admin', 'admins', 'panggiladmin'],
    category: 'group',
    description: 'Memanggil seluruh admin grup kecuali bot & pengirim',
    usage: '.tagadmin <pesan>',
    example: '.tagadmin Tolong tertibkan member ini!',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true,
    isAdmin: true, 
    isBotAdmin: false
}

async function handler(m, { sock }) {
    const text = m.text || 'Panggilan darurat untuk rekan Admin!'
    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net'
    const senderId = m.sender

    try {
        const groupMetadata = await sock.groupMetadata(m.chat)
        const participants = groupMetadata.participants || []

        // FILTER: 1. Harus Admin, 2. Bukan Bot, 3. Bukan Pengirim
        const admins = participants.filter(p => {
            const jid = getParticipantJid(p)
            const isAdmin = p.admin === 'admin' || p.admin === 'superadmin'
            return isAdmin && jid !== botId && jid !== senderId
        })
        
        if (admins.length === 0) {
            return await m.reply(`❌ *INFO*\n\n> Tidak ada admin lain yang bisa dipanggil.`)
        }

        // Ambil JID untuk mentions (biru)
        const adminMentions = admins.map(p => getParticipantJid(p))
        
        // Buat daftar teks
        const adminList = admins
            .map((p, i) => {
                const jid = getParticipantJid(p)
                const role = p.admin === 'superadmin' ? ' [Founder]' : ''
                return `│ ${i + 1}. @${jid.split('@')[0]}${role}`
            })
            .join('\n')

        // Style Hoshino Ai Idol
        const message = `╭──  🌟 *ADMINISTRATOR CALL* ──\n` +
                        `│\n` +
                        `│ 📢 *Pesan:* ${text}\n` +
                        `│ 👤 *Oleh:* @${senderId.split('@')[0]}\n` +
                        `│\n` +
                        `├───────  『 *LIST ADMIN* 』\n` +
                        `${adminList}\n` +
                        `│\n` +
                        `╰──────────────────\n\n` +
                        `> 🌟 "Hanya bintang terpilih yang bisa memanggil sesamanya!"`

        // Kirim dengan mentions (admin lain + pengirim agar header berwarna biru)
        await sock.sendMessage(m.chat, { 
            text: message, 
            mentions: [...adminMentions, senderId] 
        }, { quoted: m })

    } catch (err) {
        console.error("ERROR TAGADMIN:", err)
        await m.reply(`❌ *Gomen ne~* ✦\n\n> Terjadi kesalahan: ${err.message} 🥺`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}