const pluginConfig = {
    name: 'stalkch',
    alias: ['stalkchannel', 'infoch', 'infochannel'],
    category: 'stalker',
    description: 'Lihat informasi WhatsApp Channel',
    usage: '.stalkch <link channel>',
    example: '.stalkch https://whatsapp.com/channel/xxx',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const input = m.body?.trim()

    if (!input) {
        return m.reply(
            `『 🌸 *sᴛᴀʟᴋ ᴄʜᴀɴɴᴇʟ* 🌸 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `✨ *Cara pakai:*\n` +
            `\`${m.prefix}stalkch <link channel>\`\n\n` +
            `💫 *Contoh:*\n` +
            `\`${m.prefix}stalkch https://whatsapp.com/channel/xxx\`\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `> 💖 Ai siap cek info channel buat kamu~ 🌸`
        )
    }

    // Parse invite code dari link atau JID langsung
    let jid = null
    const linkMatch = input.match(/whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)/)
    if (linkMatch) {
        const inviteCode = linkMatch[1]
        try {
            const info = await sock.newsletterMetadata('invite', inviteCode)
            jid = info?.id || null
        } catch (e) {
            // fallback ke JID parse
        }
    }

    if (!jid) {
        const jidMatch = input.match(/(\d+@newsletter)/)
        if (jidMatch) jid = jidMatch[1]
    }

    if (!jid) {
        return m.reply(
            `『 💔 *Input Tidak Valid~* 』\n\n` +
            `> Gunakan link channel yang valid ya~ ✨\n` +
            `> Contoh: \`https://whatsapp.com/channel/xxx\`\n\n` +
            `> Ai sayang kamu~ tapi linknya harus bener dulu~ 🌸`
        )
    }

    m.react('⭐')

    try {
        const meta = await sock.newsletterMetadata('jid', jid)

        const createdAt = meta?.creation_time || meta?.thread_metadata?.creation_time
        const createdStr = createdAt
            ? new Date(Number(createdAt) * 1000).toLocaleString('id-ID')
            : '-'

        const name = meta?.name || meta?.thread_metadata?.name?.text || '-'
        const desc = meta?.description || meta?.thread_metadata?.description?.text || 'Tidak ada deskripsi'
        const subscribers = meta?.subscribers_count || meta?.thread_metadata?.subscribers_count
        const verification = meta?.verification || meta?.thread_metadata?.verification || '-'
        const state = meta?.state?.type || meta?.state || '-'
        const invite = meta?.invite || meta?.thread_metadata?.invite || '-'
        const picture = meta?.picture || meta?.thread_metadata?.picture_url || null

        const caption =
            `『 🌟 *ʜᴏsʜɪɴᴏ ᴀɪ* — sᴛᴀʟᴋ ᴄʜᴀɴɴᴇʟ 🌟 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `📢 *ɪɴꜰᴏ ᴄʜᴀɴɴᴇʟ*\n` +
            `┌─────────────────\n` +
            `│ 📛 *Nama:* ${name}\n` +
            `│ 🆔 *JID:* ${jid}\n` +
            `│ 🔗 *Invite:* ${invite}\n` +
            `│ 👥 *Subscriber:* ${subscribers?.toLocaleString('id-ID') || '-'}\n` +
            `│ ✅ *Verifikasi:* ${verification === 'VERIFIED' ? '✅ Terverifikasi' : '❌ Belum'}\n` +
            `│ 📌 *Status:* ${state}\n` +
            `│ ⏱️ *Dibuat:* ${createdStr}\n` +
            `│ 📝 *Deskripsi:*\n│ ${desc}\n` +
            `└─────────────────\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `🌸 *Hoshino Ai Bot* ✨\n` +
            `> 「 *推しの子* 」\n` +
            `> Ai selalu ada buat kamu~ 💖⭐`

        if (picture) {
            await sock.sendMessage(
                m.chat,
                { image: { url: picture }, caption },
                { quoted: m }
            )
        } else {
            await m.reply(caption)
        }

        m.react('✅')

    } catch (err) {
        console.error('[StalkCH] Error:', err)
        m.react('❌')
        m.reply(
            `『 💥 *E R R O R* 』\n\n` +
            `> ${err?.message || err?.toString() || 'Unknown error'}\n\n` +
            `> 💔 Maaf ya~ Ai gagal kali ini...\n` +
            `> Coba lagi nanti ya~ 🌸`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}