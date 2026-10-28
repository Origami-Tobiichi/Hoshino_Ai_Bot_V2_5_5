const pluginConfig = {
    name: 'fkontak',
    alias: ['fcontact', 'fvc'],
    category: 'tools',
    description: 'Buat fake contact card dengan nama dan nomor custom.',
    usage: '.fkontak <nomor>,<nama>',
    example: '.fkontak 628123456789,Hoshino Ai',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    try {
        const spaceIdx = m.body.trim().indexOf(' ')
        if (spaceIdx === -1) {
            return m.reply(
                `❓ *Cara pakai:*\n\n` +
                `> \`${m.prefix}fkontak <nomor>,<nama>\`\n\n` +
                `*Contoh:*\n` +
                `> \`${m.prefix}fkontak 628123456789,Hoshino Ai\``
            )
        }

        const argStr = m.body.trim().slice(spaceIdx + 1).trim()
        const commaIdx = argStr.indexOf(',')

        if (commaIdx === -1) {
            return m.reply(
                `❌ Format salah!\n\n` +
                `Gunakan: \`${m.prefix}fkontak <nomor>,<nama>\`\n` +
                `Contoh : \`${m.prefix}fkontak 628123456789,Hoshino Ai\``
            )
        }

        let nomor = argStr.slice(0, commaIdx).trim().replace(/[^0-9]/g, '')
        const nama = argStr.slice(commaIdx + 1).trim()

        if (!nomor || !nama) {
            return m.reply(`❌ *Ehh~* Nomor dan nama tidak boleh kosong~ 🥺`)
        }

        // Normalisasi nomor
        if (nomor.startsWith('0')) nomor = '62' + nomor.slice(1)

        const vcard =
            `BEGIN:VCARD\n` +
            `VERSION:3.0\n` +
            `FN:${nama}\n` +
            `ORG:;\n` +
            `TEL;type=CELL;type=VOICE;waid=${nomor}:+${nomor}\n` +
            `END:VCARD`

        await sock.sendMessage(m.chat, {
            contacts: {
                displayName: nama,
                contacts: [{ vcard }]
            }
        }, { quoted: m })

        m.react('✅')

    } catch (error) {
        console.error('fkontak error:', error)
        m.react('❌')
        await m.reply(`❌ Gagal buat kontak!\n\n> ${error.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}