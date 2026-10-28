const generateFF = require('fake-ff')
const fs = require('fs')

const pluginConfig = {
    name: 'fakeff',
    alias: ['fakefreefire'],
    category: 'canvas',
    description: 'Membuat gambar ff',
    usage: '.fakeff <text>',
    example: '.fakeff Hai cantik',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const nama = m.text
    if (!nama) {
        return m.reply(`*FAKE FF*\n\n> Contoh: ${m.prefix}fakeff nama1`)
    }

    // buang karakter path & batasi panjang
    const username = nama
        .replace(/[\\/:*?"<>|\x00-\x1f]/g, '')
        .replace(/\.+/g, '.')
        .trim()
        .slice(0, 20)

    if (!username) return m.reply('❌ Nama tidak valid')

    m.react('🕕')

    let filePath = null
    try {
        // lobby dikosongkan = random
        const res = await generateFF({ username })
        filePath = res?.result

        if (res?.status !== 'success' || !filePath || !fs.existsSync(filePath)) {
            throw new Error('Gagal membuat gambar')
        }

        await sock.sendMedia(m.chat, fs.readFileSync(filePath), null, m, {
            type: 'image',
        })

        m.react('✅')

    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    } finally {
        // hapus file supaya penyimpanan panel tidak penuh
        if (filePath) fs.unlink(filePath, () => {})
    }
}

module.exports = {
    config: pluginConfig,
    handler
}