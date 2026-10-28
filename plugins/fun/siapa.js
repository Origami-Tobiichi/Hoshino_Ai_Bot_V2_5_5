const pluginConfig = {
    name: [
        'bego', 'goblok', 'janda', 'perawan', 'babi', 'tolol', 'pekok', 
        'jancok', 'pinter', 'pintar', 'asu', 'bodoh', 'lesby',
        'bajingan', 'anjing', 'anjg', 'anjj', 'anj', 'ngentod', 'ngentot',
        'monyet', 'mastah', 'newbie', 'bangsat', 'bangke', 'sange', 'sangean',
        'dakjal', 'horny', 'wibu', 'puki', 'puqi', 'peak', 'pantex', 'pantek',
        'setan', 'iblis', 'cacat', 'yatim', 'piatu', 'ganteng', 'cantik',
        'jelek', 'keren', 'cupu', 'noob', 'pro', 'sultan', 'miskin', 'kaya', 'siapa'
    ],
    alias: [],
    category: 'fun',
    description: 'Random pilih member untuk kategori tertentu',
    usage: '.<kategori>',
    example: '.ganteng',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const command = m.command?.toLowerCase()
    m.react('🕕')
    try {
        const groupMeta = m.groupMetadata
        const participants = groupMeta.participants || []
        const members = participants
            .map(p => p.jid)
            .filter(id => id && id !== sock.user?.id?.split(':')[0] + '@s.whatsapp.net')
        if (members.length === 0) {
            return m.reply(`❌ *Ehh~* Tidak ada member di grup~ 🥺`)
        }
        const randomMember = members[Math.floor(Math.random() * members.length)]
        const positiveWords = ['ganteng', 'cantik', 'keren', 'pro', 'sultan', 'kaya', 'pinter', 'pintar', 'mastah']
        const isPositive = positiveWords.includes(command)
        const emoji = isPositive ? '✨' : '😏'
        const label = isPositive ? 'Yang paling' : 'Anak'
        await m.reply(`*${label} ${command} di sini adalah* @${randomMember.split('@')[0]}`, { mentions: [randomMember] })
        m.react('✅')
    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}