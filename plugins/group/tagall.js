const { getParticipantJid, getParticipantJids } = require('../../src/lib/lidHelper')

const pluginConfig = {
    name: 'tagall',
    alias: ['all', 'everyone'],
    category: 'group',
    description: 'Tag semua member grup kecuali bot & pengirim, dengan info pengumuman (pengirim di-mention, style Hoshino Ai)',
    usage: '.tagall <pesan>',
    example: '.tagall Halo semua!',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 30,
    energi: 0,
    isEnabled: true,
    isAdmin: true,
    isBotAdmin: true
}

async function handler(m, { sock }) {
    const text = m.text || 'Halo semua!'
    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net'
    const senderId = m.sender

    try {
        const groupMeta = m.groupMetadata
        const participants = groupMeta.participants || []

        if (!participants.length) {
            return await m.reply(`❌ *Gomen ne~* ✦\n\n> Tidak ada member di grup ini~ 🥺`)
        }

        // Filter member: hapus bot & pengirim
        const memberMentions = getParticipantJids(participants)
            .filter(jid => jid !== botId && jid !== senderId)

        const memberList = participants
            .filter(p => {
                const jid = getParticipantJid(p)
                return jid !== botId && jid !== senderId
            })
            .map(p => `> @${getParticipantJid(p).split('@')[0]}`)
            .join('\n')
            .trim()

        // Nama pengirim
        const senderObj = participants.find(p => getParticipantJid(p) === senderId)
        const senderName = senderObj?.name || `@${senderId.split('@')[0]}`

        // Gabungkan mentions (pengirim + member)
        const allMentions = [senderId, ...memberMentions]

        // Border & style Hoshino Ai Idol (lebih rapi)
        const topBorder = '╔═══════════════════╗'
        const midBorder = '╠═══════════════════╣'
        const bottomBorder = '╚═══════════════════╝'

        const message = `${topBorder}\n` +
                        `*_--📢 Pengumuman oleh @${senderId.split('@')[0]} --_*\n` +
                        `${midBorder}\n\n` +
                        `${text}\n\n` +
                        `\`\`\`━━━ ${memberMentions.length} MEMBER ━━━\`\`\`\n` +
                        `${memberList}\n` +
                        `${bottomBorder}`

        await m.reply(message, { mentions: allMentions })

    } catch (err) {
        await m.reply(`❌ *Gomen ne~* ✦\n\n> ${err.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}