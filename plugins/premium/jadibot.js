const hsAsset = require('../../src/lib/assets')
const { startJadibot, isJadibotActive } = require('../../src/lib/jadibotManager')
const config = require('../../config')
const fs = require('fs')

const pluginConfig = {
    name: 'jadibot',
    alias: ['jbot', 'rentbot'],
    category: 'premium',
    description: 'Jadikan nomor kamu sebagai bot sementara',
    usage: '.jadibot',
    example: '.jadibot',
    isOwner: false,
    isPremium: true,
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const userJid = m.sender

    if (isJadibotActive(userJid)) {
        return sock.sendMessage(m.chat, {
            text: `⚠️ *ᴊᴀᴅɪʙᴏᴛ sᴜᴅᴀʜ ᴀᴋᴛɪꜰ*\n\n` +
                `Bot kamu sudah berjalan.\n\n` +
                `> Ketik \`${m.prefix}stopjadibot\` untuk menghentikan`,
            interactiveButtons: [
                {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: '🛑 Stop Jadibot',
                        id: `${m.prefix}stopjadibot`
                    })
                }
            ]
        }, { quoted: m })
    }

    let thumbnail = null
    hsAsset.tryBuffer('images/hsnai2').then(b => { if (b) thumbnail = b }).catch(() => {})

    await sock.sendMessage(m.chat, {
        text: `🤖 *ᴊᴀᴅɪʙᴏᴛ*\n\n` +
            `Mempersiapkan pairing code...\n\n` +
            `> 🕕 Tunggu beberapa detik\n` +
            `> 📱 Kode akan muncul untuk di-link ke WhatsApp kamu\n\n` +
            `⚠️ *ᴘᴇʀɪɴɢᴀᴛᴀɴ:*\n` +
            `> Bot sementara akan expired jika bot utama restart\n` +
            `> Jangan share pairing code ke siapapun`,
        contextInfo: {
        }
    }, { quoted: m })

    m.react('🕕')

    try {
        const result = await startJadibot(sock, m, userJid, true)
        if (result.pairingCode) {
            m.react('✅')
        }
    } catch (error) {
        m.react('❌')
        await m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}