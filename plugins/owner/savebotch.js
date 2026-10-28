const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'savebotch',
    alias: ['sbc', 'wlchannel', 'channelwl'],
    category: 'owner',
    description: 'Daftarkan saluran (channel) tertentu supaya bot bisa dipakai di situ walau mode onlygc aktif, plus opsi owner-only per saluran',
    usage: '.savebotch <add/del/list/ownerOnly> [jid/link saluran] [on/off]',
    example: '.savebotch add https://whatsapp.com/channel/0029VaXXXXXXXXXXXXXX',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

const FOOTER =
    `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
    `🌸 savebotch • Hoshino Ai Bot\n` +
    `「 推しの子 」`

function getRegisteredChannels(db) {
    return db.setting('savebotchChannels') || []
}

// dipakai dari luar (handler.js checkMode) buat cek apakah JID saluran ini diizinkan
function isRegisteredChannel(jid) {
    if (!jid) return false
    const db = getDatabase()
    const channels = getRegisteredChannels(db)
    return channels.some(c => c.jid === jid)
}

// dipakai dari luar (handler.js checkMode) buat cek apakah saluran ini di-set owner-only
function isChannelOwnerOnly(jid) {
    if (!jid) return false
    const db = getDatabase()
    const channels = getRegisteredChannels(db)
    const ch = channels.find(c => c.jid === jid)
    return !!(ch && ch.ownerOnly)
}

// terima JID langsung ATAU link whatsapp.com/channel/xxxx / wa.me/channel/xxxx
// pakai fungsi bawaan fork hsnai: sock.cekIDSaluran(url) -> string JSON metadata
async function resolveChannel(input, sock) {
    if (!input) return null

    if (input.endsWith('@newsletter')) {
        return { jid: input, name: null }
    }

    const isLink = input.includes('whatsapp.com/channel/') || input.includes('wa.me/channel/')
    if (isLink) {
        try {
            const raw = await sock.cekIDSaluran(input)
            const meta = JSON.parse(raw)
            if (!meta?.id) return null
            return { jid: meta.id, name: meta.name || null }
        } catch (e) {
            console.warn('[savebotch] gagal resolve link saluran:', e.message)
            return null
        }
    }

    return null
}

// helper: resolve target jid dari argumen (link/jid) atau fallback ke channel saat ini
async function resolveTargetJid(input, m, sock) {
    let targetJid = input
    if (targetJid && !targetJid.endsWith('@newsletter')) {
        const resolved = await resolveChannel(targetJid, sock)
        targetJid = resolved?.jid || targetJid
    }
    if (!targetJid) targetJid = m.isChannel ? m.chat : ''
    return targetJid
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const sub = (m.args[0] || '').toLowerCase()
    const arg = m.args[1] || ''
    let channels = getRegisteredChannels(db)

    if (sub === 'add') {
        let resolved = null

        if (arg) {
            resolved = await resolveChannel(arg, sock)
            if (!resolved) {
                return m.reply(
                    `『 💔 *Gagal Resolve Saluran* 』\n\n` +
                    `> Link/JID nggak valid atau gagal diambil metadatanya.\n` +
                    `> Pastiin link-nya format: \`https://whatsapp.com/channel/xxxxx\`\n` +
                    `> atau JID langsung: \`120363xxxxx@newsletter\`\n\n${FOOTER}`
                )
            }
        } else if (m.isChannel) {
            resolved = { jid: m.chat, name: null }
        } else {
            return m.reply(
                `『 📌 *Cara Pakai* 』\n\n` +
                `Kamu nggak lagi di saluran, dan nggak ngasih link/JID.\n\n` +
                `✨ *Contoh:*\n` +
                `\`${m.prefix}savebotch add https://whatsapp.com/channel/0029VaXXXXXXXXXXXXXX\`\n\n${FOOTER}`
            )
        }

        if (channels.some(c => c.jid === resolved.jid)) {
            return m.reply(`『 ⚠️ *Sudah Terdaftar* 』\n\n> Saluran *${resolved.name || resolved.jid}* udah ada di savebotch.\n\n${FOOTER}`)
        }

        channels.push({ jid: resolved.jid, name: resolved.name, addedAt: new Date().toISOString(), ownerOnly: false })
        db.setting('savebotchChannels', channels)
        m.react('✅')
        return m.reply(
            `『 ✅ *Saluran Terdaftar* 』\n\n` +
            `> 📌 Nama: *${resolved.name || 'Unknown'}*\n` +
            `> 🆔 JID: \`${resolved.jid}\`\n\n` +
            `💖 Bot sekarang bisa dipakai di saluran ini walau mode onlygc aktif~\n\n${FOOTER}`
        )
    }

    if (sub === 'del' || sub === 'remove') {
        let targetJid = arg
        if (targetJid && !targetJid.endsWith('@newsletter')) {
            const resolved = await resolveChannel(targetJid, sock)
            targetJid = resolved?.jid || targetJid
        }
        if (!targetJid) targetJid = m.isChannel ? m.chat : ''

        if (!targetJid) {
            return m.reply(`『 💔 *Kurang Info* 』\n\n> Kasih JID/link saluran yang mau dihapus.\n\n${FOOTER}`)
        }
        const before = channels.length
        channels = channels.filter(c => c.jid !== targetJid)
        if (channels.length === before) {
            return m.reply(`『 ⚠️ *Nggak Ketemu* 』\n\n> Saluran itu nggak ada di daftar savebotch.\n\n${FOOTER}`)
        }
        db.setting('savebotchChannels', channels)
        m.react('✅')
        return m.reply(`『 ✅ *Berhasil Dihapus* 』\n\n> Saluran \`${targetJid}\` udah dihapus dari savebotch.\n\n${FOOTER}`)
    }

    if (sub === 'owneronly') {
        const action = arg.toLowerCase()
        if (action !== 'on' && action !== 'off') {
            return m.reply(
                `『 📌 *Cara Pakai* 』\n\n` +
                `\`${m.prefix}savebotch ownerOnly on/off [jid/link]\`\n\n` +
                `> Kalau dipanggil dari dalam saluran tanpa jid/link, otomatis pakai saluran ini.\n` +
                `> Kalau aktif, cuma owner yang bisa pake bot di saluran itu (member lain nggak bisa).\n\n${FOOTER}`
            )
        }

        const targetInput = m.args[2] || ''
        const targetJid = await resolveTargetJid(targetInput, m, sock)

        if (!targetJid) {
            return m.reply(`『 💔 *Kurang Info* 』\n\n> Kasih JID/link saluran yang mau di-set, atau jalanin command ini dari dalam salurannya.\n\n${FOOTER}`)
        }

        const idx = channels.findIndex(c => c.jid === targetJid)
        if (idx === -1) {
            return m.reply(`『 ⚠️ *Nggak Ketemu* 』\n\n> Saluran itu belum terdaftar di savebotch.\n> Daftarin dulu pake \`${m.prefix}savebotch add\`.\n\n${FOOTER}`)
        }

        channels[idx].ownerOnly = action === 'on'
        db.setting('savebotchChannels', channels)
        m.react('✅')
        return m.reply(
            `『 ✅ *Owner-Only ${action === 'on' ? 'Diaktifkan' : 'Dimatikan'}* 』\n\n` +
            `> 📌 Saluran: *${channels[idx].name || channels[idx].jid}*\n` +
            `> ${action === 'on' ? '🔒 Cuma owner yang bisa pake bot di saluran ini sekarang.' : '🔓 Semua orang bisa pake bot lagi di saluran ini.'}\n\n${FOOTER}`
        )
    }

    if (sub === 'list') {
        if (!channels.length) {
            return m.reply(`『 📋 *Daftar Kosong* 』\n\n> Belum ada saluran yang terdaftar di savebotch.\n\n${FOOTER}`)
        }
        const list = channels
            .map((c, i) => {
                const lockTag = c.ownerOnly ? ' 🔒 _(owner only)_' : ''
                return `${i + 1}. ${c.name ? `*${c.name}*${lockTag}\n   ${c.jid}` : `${c.jid}${lockTag}`}`
            })
            .join('\n')
        return m.reply(`『 📋 *Saluran Terdaftar* 』\n\n${list}\n\n${FOOTER}`)
    }

    return m.reply(
        `『 🌸 *SAVEBOTCH* 🌸 』\n` +
        `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
        `✨ *Cara pakai:*\n` +
        `• \`${m.prefix}savebotch add [link/jid]\` — daftarkan saluran\n` +
        `• \`${m.prefix}savebotch del [link/jid]\` — hapus saluran\n` +
        `• \`${m.prefix}savebotch list\` — lihat semua saluran terdaftar\n` +
        `• \`${m.prefix}savebotch ownerOnly on/off [link/jid]\` — batasi saluran cuma buat owner\n\n` +
        `💫 *Contoh:*\n` +
        `\`${m.prefix}savebotch add https://whatsapp.com/channel/0029VaXXXXXXXXXXXXXX\`\n\n` +
        `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
        `> 💖 Ai siap jagain saluran kamu~ 🌸`
    )
}

module.exports = {
    config: pluginConfig,
    handler,
    isRegisteredChannel,
    isChannelOwnerOnly
}