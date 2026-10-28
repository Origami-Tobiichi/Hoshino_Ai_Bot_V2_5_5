const pluginConfig = {
    name: ['getppch'],
    alias: ['getppchannel', 'ppch', 'ppchannel'],
    category: 'tools',
    description: 'Get foto profil channel/saluran WhatsApp',
    usage: '.getppch <link/jid channel>',
    example: '.getppch https://whatsapp.com/channel/xxx',
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
            `『 🌸 *ɢᴇᴛ ᴘᴘ ᴄʜᴀɴɴᴇʟ* 🌸 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `✨ *Cara pakai:*\n` +
            `\`${m.prefix}getppch <link/jid>\`\n\n` +
            `💫 *Contoh:*\n` +
            `\`${m.prefix}getppch https://whatsapp.com/channel/xxx\`\n` +
            `\`${m.prefix}getppch 120363xxx@newsletter\`\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `> 💖 Ai siap ambilkan PP channel buat kamu~ 🌸`
        )
    }

    let jid = null
    let wasFollowing = false

    // Cek apakah input adalah link channel
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

    // Cek apakah input adalah JID langsung
    if (!jid) {
        const jidMatch = input.match(/(\d+@newsletter)/)
        if (jidMatch) jid = jidMatch[1]
    }

    if (!jid) {
        return m.reply(
            `『 💔 *Input Tidak Valid~* 』\n\n` +
            `> Gunakan link channel atau JID yang valid ya~ ✨\n` +
            `> Contoh link: \`https://whatsapp.com/channel/xxx\`\n` +
            `> Contoh JID: \`120363xxx@newsletter\`\n\n` +
            `> Ai sayang kamu~ tapi inputnya harus bener dulu~ 🌸`
        )
    }

    m.react('⭐')

    try {
        // Cek apakah sudah follow dari list
        const followedList = await sock.newsletterFetchAllSubscribe()
        wasFollowing = followedList?.some(c => c.id === jid) || false

        // Kalau belum follow, follow dulu
        if (!wasFollowing) await sock.newsletterFollow(jid)

        const meta = await sock.newsletterMetadata('jid', jid)

        // Unfollow lagi kalau sebelumnya belum follow
        if (!wasFollowing) await sock.newsletterUnfollow(jid).catch(() => {})

        if (!meta?.picture) throw new Error('PP channel tidak ditemukan~')

        const caption =
            `『 🌟 *ʜᴏsʜɪɴᴏ ᴀɪ* — ɢᴇᴛ ᴘᴘ ᴄʜᴀɴɴᴇʟ 🌟 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `📋 *ɪɴꜰᴏ ᴄʜᴀɴɴᴇʟ*\n` +
            `┌─────────────────\n` +
            `│ 📛 *Nama:* ${meta.name || '-'}\n` +
            `│ 🆔 *JID:* ${meta.id || jid}\n` +
            `│ 👥 *Subscriber:* ${meta.subscribers?.toLocaleString('id-ID') || '-'}\n` +
            `│ ✅ *Verifikasi:* ${meta.verification === 'VERIFIED' ? '✅ Terverifikasi' : '❌ Belum'}\n` +
            `│ 📊 *Status:* ${meta.state || '-'}\n` +
            `└─────────────────\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `🌸 *Hoshino Ai Bot* ✨\n` +
            `> 「 *推しの子* 」\n` +
            `> Ini PP channel-nya~ 💖⭐`

        await sock.sendMessage(
            m.chat,
            { image: { url: meta.picture }, caption },
            { quoted: m }
        )

        m.react('✅')

    } catch (err) {
        console.error('[GetPPCH] Error:', err)
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