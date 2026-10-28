const axios = require('axios')

const pluginConfig = {
    name: 'tiktokstalk',
    alias: ['ttstalk', 'stalktt'],
    category: 'stalker',
    description: 'Stalk akun TikTok',
    usage: '.tiktokstalk <username>',
    example: '.tiktokstalk mrbeast',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

function shortNum(num) {
    if (!num) return '0'
    num = parseInt(num)
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1).replace('.0', '') + 'B'
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace('.0', '') + 'M'
    if (num >= 1_000) return (num / 1_000).toFixed(1).replace('.0', '') + 'K'
    return num.toString()
}

async function fetchStalk(username) {
    // Primary: api.baguss.xyz
    try {
        const { data } = await axios.get(
            `https://api.baguss.xyz/api/stalker/tiktok?username=${encodeURIComponent(username)}`,
            { timeout: 30000 }
        )
        if (data?.status && data?.user?.user) {
            const u = data.user.user
            const s = data.user.stats
            return {
                uniqueId:      u.uniqueId,
                nickname:      u.nickname,
                verified:      u.verified,
                privateAccount: u.privateAccount,
                signature:     u.signature,
                avatar:        u.avatarLarger || u.avatarMedium,
                followers:     s.followerCount,
                following:     s.followingCount,
                likes:         s.heartCount,
                videos:        s.videoCount,
            }
        }
    } catch (e) {
        console.log('[tiktokstalk] baguss gagal:', e.message)
    }

    // Fallback: api-faa.my.id
    try {
        const { data } = await axios.get(
            `https://api-faa.my.id/faa/tiktokstalk?username=${encodeURIComponent(username)}`,
            { timeout: 30000 }
        )
        // Normalize response faa
        const r = data?.result || data?.data || data?.user || null
        if (data?.status && r) {
            const u = r.user || r
            const s = r.stats || r
            return {
                uniqueId:       u.uniqueId || u.username || username,
                nickname:       u.nickname || u.name || username,
                verified:       u.verified ?? false,
                privateAccount: u.privateAccount ?? u.private ?? false,
                signature:      u.signature || u.bio || '',
                avatar:         u.avatarLarger || u.avatarMedium || u.avatar || null,
                followers:      s.followerCount || s.followers || 0,
                following:      s.followingCount || s.following || 0,
                likes:          s.heartCount || s.likes || s.heart || 0,
                videos:         s.videoCount || s.videos || 0,
            }
        }
    } catch (e) {
        console.log('[tiktokstalk] faa gagal:', e.message)
    }

    return null
}

async function handler(m, { sock }) {
    const username = m.args[0]?.replace('@', '')

    if (!username) {
        return m.reply(`🎵 *ᴛɪᴋᴛᴏᴋ sᴛᴀʟᴋ*\n\n> Masukkan username TikTok\n\n\`Contoh: ${m.prefix}tiktokstalk mrbeast\``)
    }

    m.react('🔍')

    try {
        const user = await fetchStalk(username)

        if (!user) {
            m.react('❌')
            return m.reply(`❌ *Ehh~* Username *@${username}* tidak ditemukan~ 🥺`)
        }

        const caption =
            `🎵 *ᴛɪᴋᴛᴏᴋ sᴛᴀʟᴋ*\n\n` +
            `👤 *Username:* @${user.uniqueId}\n` +
            `📛 *Nama:* ${user.nickname}\n` +
            `✅ *Verified:* ${user.verified ? 'Ya' : 'Tidak'}\n` +
            `🔒 *Private:* ${user.privateAccount ? 'Ya' : 'Tidak'}\n\n` +
            `👥 *Followers:* ${shortNum(user.followers)}\n` +
            `👤 *Following:* ${shortNum(user.following)}\n` +
            `❤️ *Likes:* ${shortNum(user.likes)}\n` +
            `🎬 *Videos:* ${shortNum(user.videos)}\n\n` +
            `📝 *Bio:*\n${user.signature || '-'}\n\n` +
            `🔗 https://tiktok.com/@${user.uniqueId}`

        m.react('✅')

        if (user.avatar) {
            await sock.sendMessage(m.chat, {
                image:   { url: user.avatar },
                caption
            }, { quoted: m })
        } else {
            await m.reply(caption)
        }

    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = { config: pluginConfig, handler }