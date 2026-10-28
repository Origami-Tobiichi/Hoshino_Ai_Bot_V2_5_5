// ✦━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━✦
// 🌟 Hoshino Ai - Circle Video Sender (PTV)
// ✦━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━✦

const pluginConfig = {
    name: 'ptv',
    alias: ['pvideo', 'circlevideo'],
    category: 'tools',
    description: 'Kirim video menjadi Circle Video (PTV) ala idol ✨',
    usage: '.ptv (reply video)',
    example: '.ptv',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

// ✦━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━✦
// 🎤 Handler - Hoshino Ai Style
// ✦━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━✦

async function handler(m, { sock }) {
    let video = null

    // 🎬 Ambil video dari reply / direct
    if (m.quoted && m.quoted.isVideo) {
        try {
            video = await m.quoted.download()
        } catch (e) {
            return m.reply(
                `❌ *Upss... gagal ya~*\n` +
                `> Video dari reply nggak bisa diambil 😢`
            )
        }
    } else if (m.isVideo) {
        try {
            video = await m.download()
        } catch (e) {
            return m.reply(
                `❌ *Yahh... error nih~*\n` +
                `> Video kamu gagal diproses 😣`
            )
        }
    }

    // ⚠️ Jika tidak ada video
    if (!video) {
        return m.reply(
            `🌸 *Hai hai~ ${m.pushName || 'kamu'}!* ✨\n\n` +
            `Aku belum lihat videonya nih... 🫣\n\n` +
            `💡 *Cara pakai:*\n` +
            `> Kirim atau reply video lalu ketik:\n` +
            `> \`${m.prefix}ptv\`\n\n` +
            `🎀 *Ayo kita bikin circle video bareng~!*`
        )
    }

    // ⏳ Loading ala idol
    await m.reply(
        `🎤 *Neee~ tunggu sebentar ya!* ✨\n` +
        `> Lagi aku ubah jadi *circle video lucu* 💖`
    )

    try {
        // ⚡ BAGIAN INI TETAP SESUAI REQUEST (tidak diubah)
        await sock.sendMessage(m.chat, {
            video: video,
            mimetype: 'video/mp4',
            gifPlayback: true,
            ptv: true
        }, { quoted: m })

        // 💖 React sukses
        m.react('✨')

    } catch (err) {
        return m.reply(
            `❌ *Ehh gagal...* 😭\n\n` +
            `> ${err.message}`
        )
    }
}

// ✦━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━✦
// 📦 Export
// ✦━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━✦

module.exports = {
    config: pluginConfig,
    handler
}