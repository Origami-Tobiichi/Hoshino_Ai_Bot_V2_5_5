const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: ['tiktokdldoc', 'ttdoc'],
    alias: ['tiktokdoc'],
    category: 'download',
    description: 'Download video atau music TikTok sebagai dokumen',
    usage: '.ttdoc <url> atau .ttdoc music <url>',
    example: '.ttdoc https://vt.tiktok.com/xxx',
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const args = m.text?.trim().split(/\s+/) || []
    const prefix = m.prefix

    if (args.length === 0) {
        m.react('❌')
        return m.reply(`📌 Contoh:\nVideo Doc: *${prefix}ttdoc <url>*\nMusic Doc: *${prefix}ttdoc music <url>*`)
    }

    // Cek apakah argumen pertama adalah "music"
    const isMusic = args[0].toLowerCase() === 'music'
    const url = isMusic ? args[1] : args[0]

    if (!url) return m.reply('❌ *Ehh~* Mana URL TikTok-nya?')

    m.react('🕕')

    try {
        const res = await f(`https://api-faa.my.id/faa/tiktok?url=${encodeURIComponent(url)}`)
        if (!res?.status) return m.reply('❌ *Gomen ne~* Gagal mengambil data~ 🥺')

        const result = res.result
        const author = result.author?.nickname || 'TikTok User'
        const title = result.title || 'TikTok_hsnai'

        if (isMusic) {
            // ===== KASUS: DOKUMEN AUDIO (MP3) =====
            const audioUrl = result.music_info?.url || result.data
            await sock.sendMessage(m.chat, {
                document: { url: audioUrl },
                fileName: `${title}.mp3`,
                mimetype: 'audio/mpeg',
                caption: `🌸✨ *Hoshino Ai Music Doc* ✨🌸\n\n> 🎵 Title: ${title}\n> 👤 Author: ${author}`,
            }, { quoted: m })
        } else {
            // ===== KASUS: DOKUMEN VIDEO (MP4) =====
            const videoUrl = result?.alternatives?.hd || result?.alternatives?.selected || result?.data
            await sock.sendMessage(m.chat, {
                document: { url: videoUrl },
                fileName: `${title}.mp4`,
                mimetype: 'video/mp4',
                caption: `🌸✨ *Hoshino Ai Video Doc* ✨🌸\n\n> 🎬 Title: ${title}\n> 👤 Author: ${author}`,
            }, { quoted: m })
        }

        m.react('✅')

    } catch (e) {
        console.error(e)
        m.react('❌')
        m.reply('Coba lagi nanti atau pakai ' + prefix + 'tt2')
    }
}

module.exports = {
    config: pluginConfig,
    handler
}