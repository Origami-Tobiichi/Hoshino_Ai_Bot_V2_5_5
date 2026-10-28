/**
✧ Name    : addmetaai
✧ Category: owner
✧ Base    : imxxzz/asta
✧ Penyesuaian : SeaPRST
**/

const pluginConfig = {
    name: 'addmetaai',
    alias: ['addai', 'metaai'],
    category: 'owner',
    description: 'Tambah Meta AI ke grup',
    usage: '.addmetaai',
    example: '.addmetaai',
    isOwner: true,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

const WM = '\n\n> ᴘᴇɴʏᴇsᴜᴀɪᴀɴ: sᴇᴀᴘʀsᴛ • ʙᴀsᴇ: ɪᴍxxᴢᴢ/ᴀsᴛᴀ'

const META_AI_JIDS = [
    '867051314767696@bot',
    '13135550002@s.whatsapp.net'
]

const STATUS_TEXT = {
    200: 'Berhasil',
    401: 'Nomor memblokir bot',
    403: 'Tidak bisa ditambahkan langsung (privasi / butuh undangan)',
    408: 'Baru saja keluar dari grup, tunggu beberapa saat',
    409: 'Sudah ada di grup',
    500: 'Error server WhatsApp'
}

const normalize = (jid = '') => String(jid).replace(/:\d+(?=@)/, '')

async function handler(m, { sock }) {
    const reply = (text) => m.reply(text + WM)

    if (!m.isGroup) {
        return reply('❌ *ᴄᴏᴍᴍᴀɴᴅ ɢʀᴜᴘ*\n\n> Command ini hanya untuk grup ya~')
    }

    await m.react('🕕')

    try {
        const meta = await sock.groupMetadata(m.chat)

        const botJid = normalize(sock.user?.id || sock.user?.jid || '')
        const botLid = normalize(sock.user?.lid || '')

        const botData = meta.participants.find((p) => {
            const pid = normalize(p.id || p.jid || '')
            const plid = normalize(p.lid || '')
            return (
                pid === botJid || pid === botLid ||
                (plid && (plid === botLid || plid === botJid))
            )
        })

        if (!botData) {
            await m.react('❌')
            const list = meta.participants
                .slice(0, 10)
                .map((p) => `• \`${p.id}\` | lid: \`${p.lid || '-'}\``)
                .join('\n')
            return reply(
                '❌ *ʙᴏᴛ ᴛɪᴅᴀᴋ ᴛᴇʀᴅᴇᴛᴇᴋsɪ*\n\n' +
                `> user.id: \`${sock.user?.id}\`\n` +
                `> user.lid: \`${sock.user?.lid}\`\n\n` +
                `*ᴘᴀʀᴛɪᴄɪᴘᴀɴᴛs (10 ᴘᴇʀᴛᴀᴍᴀ):*\n${list}`
            )
        }

        if (!botData.admin && !botData.isAdmin) {
            await m.react('❌')
            return reply(
                '❌ *ʙᴏᴛ ʙᴜᴋᴀɴ ᴀᴅᴍɪɴ*\n\n' +
                '> Jadiin Ai admin dulu dong~ ✨'
            )
        }

        const hasil = []
        let success = false

        for (const jid of META_AI_JIDS) {
            const inGroup = meta.participants.some(
                (p) => normalize(p.id || p.jid) === normalize(jid)
            )
            if (inGroup) {
                hasil.push(`• \`${jid}\`\n  409: ${STATUS_TEXT[409]}`)
                continue
            }

            try {
                const res = await sock.groupParticipantsUpdate(m.chat, [jid], 'add')
                const status = String(res?.[0]?.status)

                hasil.push(`• \`${jid}\`\n  ${status}: ${STATUS_TEXT[status] || 'Tidak diketahui'}`)

                if (status === '200') {
                    success = true
                    break
                }
            } catch (err) {
                hasil.push(`• \`${jid}\`\n  error: ${err?.message || err}`)
            }
        }

        if (success) {
            await m.react('✅')
            return reply(
                '✅ *ʙᴇʀʜᴀsɪʟ ᴀᴅᴅ ᴍᴇᴛᴀ ᴀɪ~* 🎤✨\n\n' +
                hasil.join('\n')
            )
        }

        await m.react('❌')
        return reply(
            '❌ *ɢᴀɢᴀʟ ᴀᴅᴅ ᴍᴇᴛᴀ ᴀɪ*\n\n' +
            hasil.join('\n') +
            '\n\n> Kalau 403, Meta AI memang tidak bisa di-add via API.'
        )
    } catch (error) {
        console.error('[addmetaai] Error:', error)
        await m.react('❌')
        return reply(
            '❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ*\n\n' +
            `> ${error.message}\n\n` +
            '> Coba lagi ya, Ai janji next take bakal lebih bagus~'
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}