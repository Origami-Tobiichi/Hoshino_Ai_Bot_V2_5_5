const axios = require('axios')

const pluginConfig = {
    name: 'stalkgd',
    alias: ['gdstalk', 'gdprofile'],
    category: 'stalker',
    description: 'Stalk profil player Geometry Dash',
    usage: '.stalkgd <username>',
    example: '.stalkgd Died100',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const GDBROWSER_URL = 'https://gdbrowser.com'
const BOOMLINGS_URL = 'https://www.boomlings.com/database'
const GD_SECRET = 'Wmfd2893gb7'

const MODERATOR_LABEL = { 0: '❌ Bukan Moderator', 1: '🛡️ Moderator', 2: '👑 Elder Moderator' }
const PRIVACY_LABEL = {
    all: '🌐 Publik',
    friends: '👥 Hanya Teman',
    off: '🔒 Nonaktif'
}

function privacyText(value) {
    if (value === 'all' || value === true) return PRIVACY_LABEL.all
    if (value === 'friends') return PRIVACY_LABEL.friends
    return PRIVACY_LABEL.off
}

function iconLine(label, value) {
    return value !== undefined && value !== null ? `│ ${label} ${value}\n` : ''
}

function buildIconUrl(p) {
    const params = new URLSearchParams({
        form: 'cube',
        icon: p.icon ?? 1,
        col1: p.col1 ?? 0,
        col2: p.col2 ?? 3,
        glow: p.glow ? '1' : '0'
    })
    return `${GDBROWSER_URL}/icon/icon.png?${params.toString()}`
}

// Download gambar sebagai buffer, balikin null kalau gagal / bukan gambar (mis. halaman Cloudflare)
async function fetchImageBuffer(url) {
    try {
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 8000,
            headers: { 'User-Agent': 'HoshinoAiBot/1.0' },
            validateStatus: s => s === 200
        })
        const type = String(res.headers['content-type'] || '')
        if (!type.startsWith('image/')) return null
        return Buffer.from(res.data)
    } catch {
        return null
    }
}

// ───────── Helper server resmi GD ─────────
function parseKV(str) {
    const parts = String(str || '').split(':')
    const obj = {}
    for (let i = 0; i + 1 < parts.length; i += 2) obj[parts[i]] = parts[i + 1]
    return obj
}

const num = v => (v === undefined || v === null || v === '' ? undefined : Number(v))

async function gdPost(endpoint, params) {
    const body = new URLSearchParams({ ...params, secret: GD_SECRET }).toString()
    const res = await axios.post(`${BOOMLINGS_URL}/${endpoint}`, body, {
        timeout: 15000,
        headers: {
            'User-Agent': '', // server GD nolak request yang bawa User-Agent
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        responseType: 'text',
        transformResponse: [d => d],
        validateStatus: () => true
    })
    const text = String(res.data || '').trim()
    if (res.status >= 400 || text.startsWith('<')) {
        throw new Error(`BOOMLINGS_${res.status}`)
    }
    return text // '-1' = gak ketemu
}

// Ubah data mentah GD jadi bentuk yang sama kayak response GDBrowser
function normalizeProfile(o) {
    const privacy = v => ({ '0': 'all', '1': 'friends', '2': 'off' }[v] ?? 'off')
    return {
        username: o['1'],
        playerID: num(o['2']),
        accountID: num(o['16']),
        rank: num(o['30']) || 0,
        moderator: num(o['49']) || 0,
        stars: num(o['3']),
        diamonds: num(o['46']),
        moons: num(o['52']),
        demons: num(o['4']),
        coins: num(o['13']),
        userCoins: num(o['17']),
        cp: num(o['8']),
        icon: num(o['21'] ?? o['9']),
        ship: num(o['22']),
        ball: num(o['23']),
        ufo: num(o['24']),
        wave: num(o['25']),
        robot: num(o['26']),
        spider: num(o['43']),
        col1: num(o['10']),
        col2: num(o['11']),
        glow: o['28'] === '1',
        deathEffect: num(o['48']),
        messages: privacy(o['18']),
        commentHistory: privacy(o['50']),
        friendRequests: o['19'] === '0' ? 'all' : 'off',
        youtube: o['20'] || '',
        twitter: o['44'] || '',
        twitch: o['45'] || ''
    }
}

// ───────── Sumber 1: GDBrowser ─────────
async function fetchViaGDBrowser(username) {
    const res = await axios.get(
        `${GDBROWSER_URL}/api/profile/${encodeURIComponent(username)}`,
        {
            timeout: 10000,
            headers: { 'User-Agent': 'HoshinoAiBot/1.0', 'Accept': 'application/json' },
            validateStatus: () => true
        }
    )
    const data = res.data
    if (data === -1 || data === '-1') return null
    if (res.status >= 400 || !data || typeof data !== 'object') {
        throw new Error(`GDBROWSER_${res.status}`)
    }
    return data
}

// ───────── Sumber 2: Server resmi GD (boomlings) ─────────
async function fetchViaBoomlings(username) {
    const list = await gdPost('getGJUsers20.php', { str: username, total: '0', page: '0' })
    if (!list || list === '-1') return null

    const users = list.split('#')[0].split('|').filter(Boolean).map(parseKV)
    if (users.length === 0) return null

    const target =
        users.find(u => (u['1'] || '').toLowerCase() === username.toLowerCase()) || users[0]

    let merged = target
    if (target['16'] && target['16'] !== '0') {
        try {
            const info = await gdPost('getGJUserInfo20.php', { targetAccountID: target['16'] })
            if (info && info !== '-1') {
                merged = { ...target, ...parseKV(info.split('#')[0]) }
            }
        } catch (e) {
            console.error('[stalkgd] getGJUserInfo20 gagal, pakai data dasar:', e.message)
        }
    }

    return normalizeProfile(merged)
}

async function fetchProfile(username) {
    try {
        return await fetchViaGDBrowser(username)
    } catch (e) {
        console.error('[stalkgd] GDBrowser gagal, fallback ke boomlings:', e.message)
    }
    return await fetchViaBoomlings(username)
}

async function handler(m, { sock }) {
    const username = m.args[0]

    if (!username) {
        return m.reply(
            `『 🎮 *sᴛᴀʟᴋ ɢᴇᴏᴍᴇᴛʀʏ ᴅᴀsʜ* 🎮 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `✨ *Cara pakai:*\n` +
            `\`${m.prefix}stalkgd <username>\`\n\n` +
            `💫 *Contoh:*\n` +
            `\`${m.prefix}stalkgd Died100\`\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `> 💖 Ai siap cek profil GD kamu~ 🌸`
        )
    }

    m.react('⭐')

    try {
        const p = await fetchProfile(username)

        if (!p) {
            m.react('❌')
            return m.reply(
                `『 💔 *Tidak Ditemukan~* 』\n\n` +
                `> Player \`${username}\` tidak ditemukan nih~\n` +
                `> Cek lagi username-nya ya~ 💕`
            )
        }

        const iconGamemodes =
            iconLine('🧊 *Cube:*', p.icon) +
            iconLine('🚀 *Ship:*', p.ship) +
            iconLine('⚽ *Ball:*', p.ball) +
            iconLine('🛸 *UFO:*', p.ufo) +
            iconLine('🌊 *Wave:*', p.wave) +
            iconLine('🤖 *Robot:*', p.robot) +
            iconLine('🕷️ *Spider:*', p.spider)

        const caption =
            `『 🌟 *ʜᴏsʜɪɴᴏ ᴀɪ* — ɢᴇᴏᴍᴇᴛʀʏ ᴅᴀsʜ 🌟 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `🎮 *ᴘʀᴏꜰɪʟ ᴘʟᴀʏᴇʀ*\n` +
            `┌─────────────────\n` +
            `│ 👤 *Username:*   ${p.username || '-'}\n` +
            `│ 🆔 *Player ID:*  ${p.playerID || '-'}\n` +
            `│ 🔑 *Account ID:* ${p.accountID || '-'}\n` +
            `│ 🏆 *Global Rank:* ${p.rank ? '#' + p.rank.toLocaleString('id-ID') : 'Unranked'}\n` +
            `│ 🛡️ *Status:*     ${MODERATOR_LABEL[p.moderator] || MODERATOR_LABEL[0]}\n` +
            `└─────────────────\n\n` +
            `📊 *sᴛᴀᴛɪsᴛɪᴋ*\n` +
            `┌─────────────────\n` +
            `│ ⭐ *Stars:*      ${p.stars?.toLocaleString('id-ID') || '0'}\n` +
            `│ 💎 *Diamonds:*   ${p.diamonds?.toLocaleString('id-ID') || '0'}\n` +
            `│ 🌙 *Moons:*      ${p.moons?.toLocaleString('id-ID') || '0'}\n` +
            `│ 😈 *Demons:*     ${p.demons?.toLocaleString('id-ID') || '0'}\n` +
            `│ 🪙 *Coins:*      ${p.coins?.toLocaleString('id-ID') || '0'}\n` +
            `│ 🔮 *User Coins:* ${p.userCoins?.toLocaleString('id-ID') || '0'}\n` +
            `│ 🎨 *Creator Points:* ${p.cp?.toLocaleString('id-ID') || '0'}\n` +
            `└─────────────────\n\n` +
            `🕹️ *ɪᴄᴏɴ sᴇᴛɪᴀᴘ ɢᴀᴍᴇᴍᴏᴅᴇ*\n` +
            `┌─────────────────\n` +
            iconGamemodes +
            `│ 🟣 *Color 1:*  ${p.col1 ?? '-'}\n` +
            `│ 🟡 *Color 2:*  ${p.col2 ?? '-'}\n` +
            `│ ✨ *Glow:*     ${p.glow ? '✅ Ya' : '❌ Tidak'}\n` +
            `│ 💀 *Death FX:* ${p.deathEffect ?? '-'}\n` +
            `└─────────────────\n\n` +
            `🔐 *ᴘᴇɴɢᴀᴛᴜʀᴀɴ ᴘʀɪᴠᴀsɪ*\n` +
            `┌─────────────────\n` +
            `│ 💬 *Pesan (DM):*      ${privacyText(p.messages)}\n` +
            `│ 📜 *Riwayat Komentar:* ${privacyText(p.commentHistory)}\n` +
            `│ 🤝 *Permintaan Teman:* ${privacyText(p.friendRequests)}\n` +
            `└─────────────────\n\n` +
            (p.youtube || p.twitter || p.twitch ? (
                `🔗 *sᴏsɪᴀʟ ᴍᴇᴅɪᴀ*\n` +
                `┌─────────────────\n` +
                (p.youtube ? `│ 📺 *YouTube:* https://youtube.com/channel/${p.youtube}\n` : '') +
                (p.twitter ? `│ 🐦 *Twitter:* https://twitter.com/${p.twitter}\n` : '') +
                (p.twitch  ? `│ 🟣 *Twitch:*  https://twitch.tv/${p.twitch}\n` : '') +
                `└─────────────────\n\n`
            ) : '') +
            `🌐 *Profil Lengkap:*\n` +
            `${GDBROWSER_URL}/u/${encodeURIComponent(p.username || username)}\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `🌸 *Hoshino Ai Bot* ✨\n` +
            `> 「 *推しの子* 」\n` +
            `> Ai selalu ada buat kamu~ 💖⭐`

        m.react('✅')

        // Render icon dari GDBrowser; kalau gagal/diblok, kirim teksnya aja
        const iconBuffer = await fetchImageBuffer(buildIconUrl(p))
        if (iconBuffer) {
            try {
                await sock.sendMessage(
                    m.chat,
                    { image: iconBuffer, caption },
                    { quoted: m }
                )
                return
            } catch (imgErr) {
                console.error('[stalkgd] Gagal kirim gambar icon:', imgErr.message)
            }
        }

        await m.reply(caption)

    } catch (error) {
        console.error('[stalkgd] Error:', error.code || '', error.message)
        m.react('❌')
        m.reply(
            `『 💥 *E R R O R* 』\n\n` +
            `> Server Geometry Dash lagi gak bisa diakses~\n\n` +
            `> 💔 Maaf ya~ Ai gagal kali ini...\n` +
            `> Coba lagi nanti ya~ 🌸`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}