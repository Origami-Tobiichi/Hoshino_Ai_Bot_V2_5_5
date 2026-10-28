const config = require('../../config')
const ownerPremiumDb = require('../../src/lib/ownerPremiumDb')

const pluginConfig = {
    name: 'addpartner',
    alias: ['delpartner', 'listpartner', 'cekpartner'],
    category: 'owner',
    description: 'Kelola daftar partner bot — partner bypass cooldown & energi',
    usage: '.addpartner <nomor/@tag> [hari]\n.delpartner <nomor/@tag>\n.listpartner\n.cekpartner <nomor/@tag>',
    example: '.addpartner 6281234567890 30',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

function extractNumber(m) {
    if (m.mentionedJid?.length) return m.mentionedJid[0]
    if (m.quoted?.sender) return m.quoted.sender

    const text = m.args?.join(' ')?.trim() || ''
    const match = text.match(/(\d{10,15})/)
    if (match) return `${match[1]}@s.whatsapp.net`

    return null
}

async function handler(m, { sock }) {
    const cmd = m.command?.toLowerCase()

    // ── ADD ──────────────────────────────────────────────────────────────────
    if (cmd === 'addpartner') {
        const target = extractNumber(m)
        if (!target) {
            return m.reply(
                `🤝 *ᴀᴅᴅ ᴘᴀʀᴛɴᴇʀ*\n\n` +
                `> Cara pakai:\n` +
                `> \`${m.prefix}addpartner @tag [hari]\`\n` +
                `> \`${m.prefix}addpartner 6281xxx 30\`\n\n` +
                `> _Partner otomatis bypass cooldown & limit energi~ 🌸_\n` +
                `> Default: 30 hari`
            )
        }

        let targetNumber = target.replace(/@.+/g, '')
        if (targetNumber.startsWith('08')) {
            targetNumber = '62' + targetNumber.slice(1)
        }

        if (config.isOwner(targetNumber)) {
            return m.reply(`⚠️ *Eh eh~* @${targetNumber} sudah menjadi owner~ 🌸`, { mentions: [target] })
        }

        const days = parseInt(m.args?.find(a => /^\d+$/.test(a) && a.length <= 4)) || 30
        const pushName = m.quoted?.pushName || m.pushName || 'Unknown'

        const result = ownerPremiumDb.addPartner(targetNumber, days, pushName)

        const info = ownerPremiumDb.getPartnerInfo(targetNumber)
        const expDate = new Date(info.expiredAt).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric'
        })

        m.react('🤝')
        return m.reply(
            `✅ *ᴘᴀʀᴛɴᴇʀ ᴅɪᴛᴀᴍʙᴀʜᴋᴀɴ* 🌸\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 👤 ᴜsᴇʀ: @${targetNumber}\n` +
            `┃ 🕕 ᴅᴜʀᴀsɪ: *${days} hari*\n` +
            `┃ 📅 ᴇxᴘɪʀᴇᴅ: *${expDate}*\n` +
            `╰┈┈⬡\n\n` +
            `> _${result.message}~ Sekarang bebas cooldown & limit energi! ⚡💖_`,
            { mentions: [target] }
        )
    }

    // ── DEL ──────────────────────────────────────────────────────────────────
    if (cmd === 'delpartner') {
        const target = extractNumber(m)
        if (!target) {
            return m.reply(`⚠️ *Eh eh~* Tag atau reply user yang ingin dihapus dari partner~ 🌸`)
        }

        let targetNumber = target.replace(/@.+/g, '')
        if (targetNumber.startsWith('08')) {
            targetNumber = '62' + targetNumber.slice(1)
        }

        const result = ownerPremiumDb.removePartner(targetNumber)

        if (result.success) {
            m.react('✅')
            return m.reply(
                `✅ *ᴘᴀʀᴛɴᴇʀ ᴅɪʜᴀᴘᴜs* 🌸\n\n` +
                `> @${targetNumber} tidak lagi bypass cooldown & limit~`,
                { mentions: [target] }
            )
        } else {
            return m.reply(`⚠️ *Eh eh~* User tersebut bukan partner~ 🌸`)
        }
    }

    // ── LIST ─────────────────────────────────────────────────────────────────
    if (cmd === 'listpartner') {
        const partners = ownerPremiumDb.getPartnerList()
        if (!partners.length) {
            return m.reply(`🤝 *ᴅᴀꜰᴛᴀʀ ᴘᴀʀᴛɴᴇʀ*\n\n> Belum ada partner.`)
        }

        let txt = `🤝 *ᴅᴀꜰᴛᴀʀ ᴘᴀʀᴛɴᴇʀ*\n\n`
        const mentions = []

        partners.forEach((p, i) => {
            const num = p.number || p.jid
            const name = p.name || 'Unknown'
            const expDate = new Date(p.expiredAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
            const remaining = Math.ceil((new Date(p.expiredAt) - Date.now()) / (1000 * 60 * 60 * 24))

            txt += `${i + 1}. @${num}\n`
            txt += `   > ${name} • ${expDate} (${remaining > 0 ? remaining + ' hari' : 'Expired'})\n`
            mentions.push(`${num}@s.whatsapp.net`)
        })

        txt += `\n> Total: *${partners.length}* partner\n`
        txt += `> _Semua partner bypass cooldown & limit energi~ 🌸_`
        await m.reply(txt, { mentions })
        return
    }

    // ── CEK ──────────────────────────────────────────────────────────────────
    if (cmd === 'cekpartner') {
        const target = extractNumber(m) || `${m.senderNumber}@s.whatsapp.net`
        let targetNumber = target.replace(/@.+/g, '')
        if (targetNumber.startsWith('08')) {
            targetNumber = '62' + targetNumber.slice(1)
        }

        const info = ownerPremiumDb.getPartnerInfo(targetNumber)

        if (!info) {
            return m.reply(`❌ *Ehh~* @${targetNumber} bukan partner~ 🥺`, { mentions: [target] })
        }

        const expDate = new Date(info.expiredAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        const remaining = Math.ceil((new Date(info.expiredAt) - Date.now()) / (1000 * 60 * 60 * 24))
        const addedDate = new Date(info.addedAt).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric'
        })

        await m.reply(
            `🤝 *ɪɴꜰᴏ ᴘᴀʀᴛɴᴇʀ*\n\n` +
            `> 👤 @${targetNumber}\n` +
            `> 📛 Nama: *${info.name}*\n` +
            `> 📅 Ditambahkan: *${addedDate}*\n` +
            `> 🕕 Expired: *${expDate}*\n` +
            `> 🗓️ Sisa: *${remaining > 0 ? remaining + ' hari' : 'Expired'}*\n\n` +
            `> _Bebas cooldown & limit energi selama masih aktif~ ⚡💖_`,
            { mentions: [target] }
        )
        return
    }
}

module.exports = {
    config: pluginConfig,
    handler
}