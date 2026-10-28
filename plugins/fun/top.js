const { getDatabase } = require('../../src/lib/database');

const pluginConfig = {
    name: 'top',
    alias: ['top5', 'toplist'],
    category: 'fun',
    description: 'Random top 5 member untuk kategori tertentu',
    usage: '.top <kategori>',
    example: '.top orang pintar',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const db = getDatabase();
    const kategori = m.args.join(' ')?.trim()
    const groupData = db.getGroup(m.chat);
    const topVariant = groupData?.topVariant || 'classic'

    if (!kategori) {
        return m.reply(
`🌸 *Hoshino Ai Mode aktif~* ✨

Kategori nya mana nih~? 💭  
Contoh yaa:

➤ *${m.prefix}top orang pintar*

Ayo cepat~ aku penasaran loh! 💜`
        )
    }

    m.react('🌟')

    try {
        const groupMeta = m.groupMetadata
        const participants = groupMeta.participants || []

        const members = participants
            .map(p => p.jid)
            .filter(id => id && id !== sock.user?.id?.split(':')[0] + '@s.whatsapp.net')

        if (members.length < 5) {
            return m.reply(
`💫 *Eits~ belum cukup!*  

Butuh minimal *5 orang* di grup ini biar bisa aku pilih~

Ajak yang lain dulu yaa~ ✨`
            )
        }

        const shuffled = members.sort(() => Math.random() - 0.5)
        const top5 = shuffled.slice(0, 5)
        const medals = ['🥇', '🥈', '🥉', '🏅', '🎖️']

        const resolveName = (jid) => {
    const participant = participants.find(p => p.jid === jid)
    const name = participant?.notify
        || participant?.name
        || sock.store?.contacts?.[jid]?.pushName
        || sock.store?.contacts?.[jid]?.notify
        || sock.store?.contacts?.[jid]?.name
    if (name) return name
    return jid.split('@')[0]
}

        if (topVariant === 'table') {
            const tableRows = [
                ['Rank', 'Member'],
                ...top5.map((jid, index) => [
                    `${medals[index]} Rank ${index + 1}`,
                    resolveName(jid)
                ])
            ]

            await sock.sendTablehsn(
                m.key.remoteJid,
                `TOP 5 ${kategori.toUpperCase()}`,
                tableRows,
                m,
                {
                    header: '✨ *Hoshino Ai memilih...* ✨\n_"Hehe~ hasilnya random ya, jangan terlalu serius~"_ 🌟',
                    footer: '💜 Semua cuma hiburan yaa~ jangan baper 🤭\n— *Ai is watching~* 👀'
                }
            )
        } else {
            let list = ''
            top5.forEach((jid, index) => {
                list += `${medals[index]} *Rank ${index + 1}*\n👤 @${jid.split('@')[0]}\n\n`
            })

            await m.reply(
`✨ *Hoshino Ai memilih...* ✨

🎤 *TOP 5 ${kategori.toUpperCase()}* 🎤  
_"Hehe~ hasilnya random ya, jangan terlalu serius~"_ 🌟

${list}💜 *Itu dia hasil pilihan hari ini~*  
Semua cuma hiburan yaa~ jangan baper 🤭

— *Ai is watching~* 👀`,
                { mentions: top5 }
            )
        }

        m.react('💜')
    } catch (error) {
        m.react('❌')
        m.reply(
`⚠️ *Aduh... Ai error nih...* 😢

Kayaknya ada yang ganggu performa Ai di panggung... 🎭  
Coba lagi nanti yaa~

> ${error.message}`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}