const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: ['tiktokdldoc', 'ttdoc'],
    alias: ['tiktokdoc'],
    category: 'download',
    description: 'Download video TikTok sebagai dokumen',
    usage: '.ttdoc <url>',
    example: '.ttdoc https://vt.tiktok.com/xxx',
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.text?.trim()
    const prefix = m.prefix

    if (!text) {
        m.react('❌')
        return m.reply(`📌 Contoh: *${prefix}ttdoc https://vt.tiktok.com/...*`)
    }

    m.react('🕕')

    try {
        const res = await f(`https://api-faa.my.id/faa/tiktok?url=${encodeURIComponent(text)}`)
        if (!res?.status) return m.reply('❌ *Gomen ne~* Gagal mengambil data~ 🥺')

        const result = res.result

        const videoUrl =
            result?.alternatives?.hd ||
            result?.alternatives?.selected ||
            result?.data

        await sock.sendMessage(m.chat, {
            document: { url: videoUrl },
            fileName: (result.title || 'Tiktok_hsnai') + '.mp4',
            mimetype: 'video/mp4',
            caption: `
🌸✨ *Hoshino Ai Downloader (Doc)* ✨🌸

> 🎬 ${result.title || 'TikTok Video'}
> ⏱ ${result.duration}
> 👤 ${result.author?.nickname || '-'}
            `,
            interactiveButtons: [
                {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: '🎵 Audio (MP3)',
                        id: `${prefix}ttmp3 ${text}`
                    })
                },
                {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: '📥 Download Video',
                        id: `${prefix}tiktok ${text}`
                    })
                }
            ]
        }, { quoted: m })

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