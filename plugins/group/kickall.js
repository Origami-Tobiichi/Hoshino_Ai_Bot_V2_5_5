/**
 * 🌟 Hoshino Ai Bot - Group Cleaner (Instant Mode) 🌟
 * * Purge all non-admin members in one single request.
 */

const pluginConfig = {
    name: ['kickall', 'kickall_confirm', 'kickall_cancel'],
    alias: ['removeall'],
    category: 'group',
    description: 'Kick semua member sekaligus (Instan)',
    usage: '.kickall',
    example: '.kickall',
    isOwner: true, 
    isGroup: true,
    isAdmin: true,
    isBotAdmin: true,
    isEnabled: true,
    cooldown: 60
}

const session = {}

async function handler(m, { sock }) {
    const id = m.chat
    const sender = m.sender
    const command = m.command

    // 1. Logika Pembatalan
    if (command === 'kickall_cancel') {
        if (!session[id]) return m.reply('❌ *Ehh~* Tidak ada sesi yang aktif~ 🥺')
        delete session[id]
        return m.reply('✅ *Kickall dibatalkan.*')
    }

    // 2. Logika Eksekusi (INSTAN)
    if (command === 'kickall_confirm') {
        if (!session[id]) return m.reply('❌ *Ehh~* Sesi kadaluwarsa~ 🥺')
        if (session[id].user !== sender) return m.reply('❌ *Ehh~* Bukan kamu yang memulai~ 🥺')

        const groupMeta = await sock.groupMetadata(id)
        const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net'
        
        // Ambil semua JID member non-admin
        const targets = groupMeta.participants
            .filter(p => !p.admin && p.id !== botNumber)
            .map(p => p.id)

        if (targets.length === 0) {
            delete session[id]
            return m.reply('🎤 Tidak ada member non-admin untuk dikick.')
        }

        await m.reply(`🚀 *Hoshino Ai: INSTANT PURGE!*\n\n> 👥 Mengeksekusi ${targets.length} member...`);

        try {
            // MENGIRIM ARRAY TARGET SEKALIGUS (BUKAN PER USER)
            await sock.groupParticipantsUpdate(id, targets, 'remove')
            
            m.reply(`✨ *KICK ALL BERHASIL* ✨\n───────────────\n> ✅ Total: ${targets.length} member telah dikeluarkan.\n───────────────\n🌟 *Grup bersih seketika!*`)
        } catch (e) {
            console.error(e)
            m.reply(`⚠️ *Gagal mengeksekusi massal.*\nDetail: _${e.message}_`)
        }

        delete session[id]
        return
    }

    // 3. Logika Mulai
    if (command === 'kickall') {
        session[id] = { user: sender }

        const text = `🌟 *𝗞𝗜𝗖𝗞 𝗔𝗟𝗟 𝗜𝗡𝗦𝗧𝗔𝗡* 🌟\n` +
                     `───────────────\n` +
                     `⚠️ *PERINGATAN KERAS!*\n` +
                     `Bot akan mengeluarkan SEMUA member sekaligus tanpa jeda.\n\n` +
                     `> ❓ Yakin Producer-san?`;

        return sock.sendMessage(id, {
            text: text,
            buttons: [
                { buttonId: `.kickall_confirm`, buttonText: { displayText: '✅ Eksekusi Sekarang!' }, type: 1 },
                { buttonId: `.kickall_cancel`, buttonText: { displayText: '❌ Batal' }, type: 1 }
            ],
            viewOnce: true
        }, { quoted: m })
    }
}

module.exports = { config: pluginConfig, handler };