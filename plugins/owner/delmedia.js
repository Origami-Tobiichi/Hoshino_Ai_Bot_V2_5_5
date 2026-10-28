const hsAsset = require('../../src/lib/assets')

const pluginConfig = {
    name: 'delmedia',
    alias: ['hapusmedia', 'deletemedia', 'delasset'],
    category: 'owner',
    description: 'Hapus override URL aset (balik ke URL di config.js)',
    usage: '.delmedia <grup> <nama-aset>',
    example: '.delmedia images hsnai-newpose',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

const AI = {
    warn: (msg) => `🌸 *Hmm~ Perhatiin dulu ya!*\n\n> ${msg}`,
}

function getGroups() {
    return hsAsset.groups().filter(g => g !== 'shuffle')
}

async function handler(m, { sock }) {
    const groups = getGroups()
    const [groupArg, nameArg] = m.args
    const group = groupArg ? groupArg.toLowerCase() : null

    if (!group) {
        return m.reply(
            `📁 *ᴅᴇʟ ᴍᴇᴅɪᴀ*\n\n` +
            `Format: \`${m.prefix}delmedia <grup> <nama-aset>\`\n\n` +
            `*Grup tersedia:*\n${groups.map(c => `> \`${c}\``).join('\n')}\n\n` +
            `> _Ketik \`${m.prefix}delmedia <grup>\` aja buat liat daftar aset-nya~ 🌸_`
        )
    }

    if (!groups.includes(group)) {
        return m.reply(AI.warn(`Grup \`${group}\` nggak ada nih~\n\nGrup tersedia:\n${groups.map(c => `> \`${c}\``).join('\n')}`))
    }

    const entries = hsAsset.list(group).map(e => ({ name: e.key.slice(group.length + 1), key: e.key, url: e.url }))

    if (!nameArg) {
        if (!entries.length) return m.reply(AI.warn(`Grup \`${group}\` masih kosong nih~`))
        const listText = entries.map(e => `┃ ${e.url ? '✅' : '⬜'} \`${e.name}\``).join('\n')
        return m.reply(
            `📁 *ɪsɪ config.assets.${group}* (${entries.length} key)\n\n` +
            `╭┈┈⬡\n${listText}\n╰┈┈⬡\n\n` +
            `> _Pilih salah satu lalu \`${m.prefix}delmedia ${group} <nama-aset>\` ya~ 🌸_`
        )
    }

    const name = nameArg.replace(/\.[a-zA-Z0-9]{2,5}$/, '')
    const key = `${group}/${name}`
    const overrides = hsAsset.list(group).find(e => e.key === key)
    if (!overrides) {
        return m.reply(AI.warn(`Aset \`${key}\` nggak ketemu~ Cek lagi namanya ya`))
    }

    try {
        const before = overrides.url
        hsAsset.setUrl(key, '')
        const after = hsAsset.url(key)

        m.react('🗑️')
        await m.reply(
            `✅ *ᴏᴠᴇʀʀɪᴅᴇ ᴅɪʜᴀᴘᴜs* 🌸\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 📝 ᴋᴇʏ: \`${key}\`\n` +
            `┃ 🔗 ᴜʀʟ ʟᴀᴍᴀ: ${before || '-'}\n` +
            `┃ 🔗 ᴜʀʟ sᴇᴋᴀʀᴀɴɢ: ${after || '(kosong)'}\n` +
            `╰┈┈⬡\n\n` +
            (after
                ? `> _Balik pakai URL dari config.js ya~ 💕_`
                : `> _Kalau mau dikosongin permanen, hapus juga URL-nya di config.js → assets.${group}~ 💕_`)
        )
    } catch (error) {
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
