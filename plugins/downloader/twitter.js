const axios = require('axios')

const pluginConfig = {
    name: 'twitter',
    alias: ['twit', 'twdl', 'x'],
    category: 'downloader',
    description: '🌸 Hoshino Ai Style - Download Video/Media dari X (Twitter)!',
    usage: '.twitter <link twitter/x>',
    example: '.twitter https://x.com/bear_ff00/status/2041113804495634811',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    isEnabled: true,
    isAdmin: false,
    isBotAdmin: false
}

async function handler(m, { sock }) { // Hapus 'args' di sini karena kita pakai m.args
    try {
        // PERBAIKAN DI SINI: Pakai m.args sesuai struktur bot kamu
        const url = m.args?.[0] 
        
        if (!url) return m.reply('💡 Masukkan link Twitter (X) yang valid ya, Senpai!~\n✨ Contoh: .twitter https://x.com/xxx/status/xxx')

        await m.reply('⌛ Tunggu sebentar ya, Hoshino Ai sedang mengambil videonya... ✨')

        const response = await axios.get(`https://api.nexray.web.id/downloader/twitter?url=${encodeURIComponent(url)}`)
        const data = response.data

        if (!data.status) return m.reply('⚠️ Yahh, videonya nggak ketemu atau link-nya salah... Gomen ne! 😅')

        const res = data.result
        const title = res.title || 'Twitter Video'
        const duration = res.duration || '0:00'
        
        const video = res.download_url.find(v => v.type === 'mp4')

        if (!video) return m.reply('⚠️ Maaf, link download videonya nggak ada nih... 🌸')

        let caption = `✨ **Twitter Downloader** ✨\n\n`
        caption += `📝 **Judul:** ${title}\n`
        caption += `⏱️ **Durasi:** ${duration}\n`
        caption += `🎬 **Kualitas:** ${video.resolusi || 'HD'}\n\n`
        caption += `🌸 *Video berhasil diunduh! Enjoy, Senpai!* 🌸`

        await sock.sendMessage(m.chat, { 
            video: { url: video.url }, 
            caption: caption,
            fileName: `${title}.mp4`
        }, { quoted: m })

    } catch (error) {
        console.error(error)
        await m.reply(`⚠️ Aduh! Terjadi kesalahan saat memproses data 😅\n> ${error.message}\nCoba lagi nanti ya, Senpai! 🌸`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}