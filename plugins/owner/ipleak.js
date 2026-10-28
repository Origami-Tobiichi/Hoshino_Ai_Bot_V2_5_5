/**
✧ Name    : ipleak
✧ Category: owner
**/

const config = require('../../config')
const { AIRich, Toolkit } = require('hsnai')

const pluginConfig = {
    name: 'ipleak',
    alias: ['myleak'],
    category: 'owner',
    description: 'Tampilkan informasi IP via Nixel',
    usage: '.ipleak | .ipleak ip <IP>',
    example: '.ipleak\n.ipleak ip 8.8.8.8',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    await m.react('🕕')

    try {
        const timestamp = Date.now()
        const args = m.args || []
        const mode = args[0]?.toLowerCase()
        const value = args[1]

        // ============================================================
        // BUILD URL
        // ============================================================
        let imageUrl = 'https://ipleak.nixel.dev/image/ip?timestamp=' + timestamp

        if (mode === 'ip' && value) {
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
            if (!ipRegex.test(value)) {
                await m.react('❌')
                return m.reply(`❌ *IP tidak valid*\n> Contoh: 8.8.8.8`)
            }
            imageUrl = `https://ipleak.nixel.dev/image/ip?ip=${value}&timestamp=` + timestamp
        } else if (mode && mode !== 'ip') {
            await m.react('❌')
            return m.reply(
                `⚠️ *Mode tidak dikenal*\n\n` +
                `> \`.ipleak\` — IP sendiri\n` +
                `> \`.ipleak ip 8.8.8.8\` — IP tertentu`
            )
        }

        // ============================================================
        // BUILD RICH MENGGUNAKAN AIRich
        // ============================================================
        const rich = new AIRich(sock)

        rich.addImage(imageUrl, { status: 'READY' })
        rich.addFooterAction({
            text: 'Join My Channel',
            type: 'OPEN_URL',
            url: 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
        })

        await rich.send(m.chat)
        await m.react('✅')

    } catch (error) {
        console.error('[ipleak] Error:', error)
        await m.react('❌')
        return m.reply(`❌ *Gagal kirim IP leak*\n> ${error.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}