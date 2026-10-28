const { findParticipantByNumber } = require('../../src/lib/lidHelper')

const pluginConfig = {
    name: 'mampir',
    alias: ['dateng', 'sayhi'],
    category: 'group',
    description: '🌸 Hoshino Ai Style - Ajak semua anggota mampir ke VT baru! (Admin Only, tag admin pengirim)',
    usage: '.mampir <link VT TikTok>',
    example: '.mampir https://vt.tiktok.com/ZSHPuRJLD/',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    isEnabled: true,
    isAdmin: true,      // ✅ Hanya admin yang bisa pakai
    isBotAdmin: true    // ✅ Bot harus admin untuk mention semua
}

async function handler(m, { sock }) {
    try {
        if (!m.isGroup) return

        // Gunakan pengecekan dari hasil serialize Handler.js
        if (!m.isBotAdmin) return m.reply('⚠️ *Eh eh~* Bot harus jadi admin untuk bisa mention semua 😝~ 🌸')
        
        // Pengecekan admin pengirim
        if (!m.isAdmin && !m.isOwner) return m.reply('⚠️ Hehe~ cuma admin yang boleh pakai ini 😘')

        const link = m.args?.[0]
        if (!link || !link.includes('vt.tiktok.com')) {
            return m.reply('💡 Gunakan link VT TikTok yang valid ya~\n✨ Contoh: .mampir https://vt.tiktok.com/ZSHPuRJLD/')
        }

        const groupMeta = await sock.groupMetadata(m.chat)
        const mentions = groupMeta.participants.map(u => u.id)
                // Tag admin pengirim
        const adminTag = `@${m.sender.split('@')[0]}`

        // 20+ pesan random Hoshino Ai style
        const messages = [
            `🌸 Hehe~ Senpai & teman-teman! Yuk mampir lihat VT baru ini 😘\n${link}\n💌 dari admin ${adminTag}`,
            `🎀 Oho~ semua! Ada VT fresh nih, jangan sampai ketinggalan 💖\n${link}\n💌 dari admin ${adminTag}`,
            `💫 Hai semuanya~ Hoshino Ai ngajak mampir VT baru nih 🌟\n${link}\n💌 dari admin ${adminTag}`,
            `🌟 UwU~ VT baru sudah siap! Yuk mampir dan senyum bareng 😝\n${link}\n💌 dari admin ${adminTag}`,
            `💖 Halo halo~ Jangan sampai kelewatan VT seru ini! Hehe 🌸\n${link}\n💌 dari admin ${adminTag}`,
            `✨ Wahai senpai & teman-teman! VT baru sudah tayang, mampir yuk 💕\n${link}\n💌 dari admin ${adminTag}`,
            `🌈 Hehe~ Ada VT baru yang lucu banget nih, jangan sampai kelewatan! 😘\n${link}\n💌 dari admin ${adminTag}`,
            `🎀 Omo~ VT fresh dari admin, siap-siap gemes ya! 🌸\n${link}\n💌 dari admin ${adminTag}`,
            `💫 Yuk semua~ Hoshino Ai ngajak mampir VT baru! 🌟\n${link}\n💌 dari admin ${adminTag}`,
            `🌟 UwU~ Jangan sampai kelewatan VT baru yang imut ini 💖\n${link}\n💌 dari admin ${adminTag}`,
            `💖 Hai semuanya~ Ada kejutan VT baru nih! Senyum dulu deh 😝\n${link}\n💌 dari admin ${adminTag}`,
            `🌸 Hehe~ Senpai, VT baru sudah hadir! Yuk mampir 💕\n${link}\n💌 dari admin ${adminTag}`,
            `🎀 Oho~ VT baru siap membuat hari kalian lebih ceria! 😘\n${link}\n💌 dari admin ${adminTag}`,
            `💫 Halo semua~ Jangan sampai VT ini terlewat ya 🌟\n${link}\n💌 dari admin ${adminTag}`,
            `🌟 UwU~ Hoshino Ai ngajak semua mampir VT baru 💖\n${link}\n💌 dari admin ${adminTag}`,
            `💖 Hai senpai & teman-teman~ Ada VT lucu baru nih! Hehe 🌸\n${link}\n💌 dari admin ${adminTag}`,
            `✨ Yuk mampir! VT baru siap bikin senyum kalian lebar 😝\n${link}\n💌 dari admin ${adminTag}`,
            `🌈 Oho~ Jangan lupa mampir lihat VT terbaru! Hehe 💕\n${link}\n💌 dari admin ${adminTag}`,
            `🎀 Hehe~ VT fresh dari admin sudah online! Yuk cek bareng 🌟\n${link}\n💌 dari admin ${adminTag}`,
            `💫 Halo semua! Hoshino Ai ngajak mampir VT baru yang gemesin 😘\n${link}\n💌 dari admin ${adminTag}`,
            `🌟 UwU~ Senpai jangan sampai ketinggalan VT lucu ini 💖\n${link}\n💌 dari admin ${adminTag}`,
            `💖 Hehe~ Yuk mampir, ada VT baru yang super imut nih! 🌸\n${link}\n💌 dari admin ${adminTag}`,
            `✨ Hai semua~ Jangan lewatkan VT baru yang seru banget 😝\n${link}\n💌 dari admin ${adminTag}`
        ]

        const randMsg = messages[Math.floor(Math.random() * messages.length)]

         // Tambahkan pengirim ke dalam daftar mention agar tag-nya biru/aktif
        if (!mentions.includes(m.sender)) {
            mentions.push(m.sender)
        }

        // Kirim pesan dengan mentions yang sudah digabung (semua member + pengirim)
        await sock.sendMessage(m.chat, { 
            text: randMsg, 
            mentions: mentions 
        }, { quoted: m })

    } catch (error) {
        await m.reply(`⚠️ Aduh! Error deh 😅\n> ${error.message}\n💡 Cek koneksi & coba lagi ya~ 🌸`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}