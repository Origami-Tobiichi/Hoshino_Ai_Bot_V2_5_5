/**
 * ╭━━━🌸〔 𝐇𝐎𝐒𝐇𝐈𝐍𝐎 𝐀𝐈 〕━━━⬣
 * ┃ Fitur: Edit Message ✨
 * ┃ Status: Active & Sparkling! 🎤
 * ╰━━━━━━━━━━━━━━━━━⬣
 */

const pluginConfig = {
    name: 'edit',
    alias: ['ubah', 'editmsg', 'magic'],
    category: 'tools',
    description: 'Mengubah kata-kata lama menjadi baru dengan keajaiban idol! ✨',
    usage: '.edit <teks baru> (balas pesan bot)',
    example: '.edit Ai sayang Senpai~',
    cooldown: 2, 
    isAdmin: true, 
    isEnabled: true
}

async function handler(m, { sock }) {
    try {
        // ✨ Mengambil teks baru dari panggung (chat)
        let teksBaru = m.body.split(' ').slice(1).join(' ')
        
        // ❌ Ups, teksnya ketinggalan di belakang panggung!
        if (!teksBaru) {
            return m.reply(
`╭━━━🌸〔 𝐈𝐃𝐎𝐋 𝐇𝐈𝐍𝐓 〕━━━⬣
┃ 🎤 *Senpai, mau Ai ubah jadi apa?*
┃ 📌 Caranya: Balas pesan Ai, lalu ketik:
┃ ✨ .edit <teks baru kamu>
╰━━━━━━━━━━━━━━━━━⬣`
            )
        }

        // ❌ Senpai belum pilih pesan yang mau disulap!
        if (!m.quoted) {
            return m.reply(`✨ *Hoshino Ai Magic*\n\n> Pilih (reply) pesan yang mau Ai ubah dulu ya, Senpai~ 🎤`)
        }

        // 🪄 PROSES KEAJAIBAN TERJADI!
        await sock.sendMessage(m.chat, {
            edit: m.quoted.key, // ID Pesan yang akan disulap ✨
            text: teksBaru      // Kata-kata baru yang indah 🎤
        })

    } catch (err) {
        console.error('[IDOL ERROR]', err)
        m.react('❌')
        m.reply(`❌ *Hoshino Ai Error*\n\n> Duh, panggungnya goyang! ⚠️\n> ${err.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}