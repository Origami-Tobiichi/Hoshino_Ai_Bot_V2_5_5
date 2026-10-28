const axios = require('axios')

const pluginConfig = {
    name: 'searchgd',
    alias: ['carigd', 'gdsearch', 'searchlevel'],
    category: 'search',
    description: 'Cari level Geometry Dash berdasarkan nama',
    usage: '.searchgd <nama level>',
    example: '.searchgd Bloodbath',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const RESULT_LIMIT = 5
const GDBROWSER_URL = 'https://gdbrowser.com/api/search'
const BOOMLINGS_URL = 'https://www.boomlings.com/database/getGJLevels21.php'
const GD_SECRET = 'Wmfd2893gb7'

function fmtNum(n) {
    return (Number(n) || 0).toLocaleString('id-ID')
}

// ───────── Sumber 1: GDBrowser ─────────
async function searchViaGDBrowser(query) {
    const res = await axios.get(`${GDBROWSER_URL}/${encodeURIComponent(query)}`, {
        params: { count: RESULT_LIMIT },
        timeout: 10000,
        headers: { 'User-Agent': 'HoshinoAiBot/1.0', 'Accept': 'application/json' },
        validateStatus: () => true
    })

    const data = res.data
    if (data === -1 || data === '-1' || (Array.isArray(data) && data.length === 0)) return []
    if (res.status >= 400 || !Array.isArray(data)) {
        throw new Error(`GDBROWSER_${res.status}`)
    }
    return data.slice(0, RESULT_LIMIT)
}

// ───────── Sumber 2: Server resmi GD (boomlings) ─────────
const LENGTHS = ['Tiny', 'Short', 'Medium', 'Long', 'XL', 'Platformer']
const DEMON_DIFF = { 3: 'Easy Demon', 4: 'Medium Demon', 0: 'Hard Demon', 5: 'Insane Demon', 6: 'Extreme Demon' }
const NORMAL_DIFF = { 0: 'Unrated', 10: 'Easy', 20: 'Normal', 30: 'Hard', 40: 'Harder', 50: 'Insane' }

function parseKV(str) {
    const parts = str.split(':')
    const obj = {}
    for (let i = 0; i + 1 < parts.length; i += 2) obj[parts[i]] = parts[i + 1]
    return obj
}

function parseDifficulty(o) {
    if (o['25'] === '1') return 'Auto'
    if (o['17'] === '1') return DEMON_DIFF[Number(o['43'])] || 'Demon'
    const val = Number(o['9'] || 0)
    const den = Number(o['8'] || 10) || 10
    return NORMAL_DIFF[(val / den) * 10] || NORMAL_DIFF[val] || 'Unrated'
}

async function searchViaBoomlings(query) {
    const body = new URLSearchParams({
        str: query,
        type: '0',
        page: '0',
        total: '0',
        secret: GD_SECRET
    }).toString()

    const res = await axios.post(BOOMLINGS_URL, body, {
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
    if (text === '-1' || text === '') return []
    if (res.status >= 400 || text.startsWith('<')) {
        throw new Error(`BOOMLINGS_${res.status}`)
    }

    const [levelsRaw = '', creatorsRaw = '', songsRaw = ''] = text.split('#')

    // playerID:username:accountID | ...
    const creators = {}
    for (const c of creatorsRaw.split('|')) {
        const [playerID, username] = c.split(':')
        if (playerID) creators[playerID] = username
    }

    // 1~|~id~|~2~|~nama~|~... ~:~ ...
    const songs = {}
    for (const s of songsRaw.split('~:~')) {
        const p = s.split('~|~')
        const o = {}
        for (let i = 0; i + 1 < p.length; i += 2) o[p[i]] = p[i + 1]
        if (o['1']) songs[o['1']] = o['2']
    }

    return levelsRaw
        .split('|')
        .filter(Boolean)
        .slice(0, RESULT_LIMIT)
        .map(raw => {
            const o = parseKV(raw)
            const songId = o['35']
            return {
                id: o['1'],
                name: o['2'],
                author: creators[o['6']] || '-',
                difficulty: parseDifficulty(o),
                stars: Number(o['18'] || 0),
                featured: Number(o['19'] || 0) > 0,
                epic: Number(o['42'] || 0) > 0,
                downloads: Number(o['10'] || 0),
                likes: Number(o['14'] || 0),
                length: LENGTHS[Number(o['15'])] || '-',
                songName: songId && songId !== '0'
                    ? (songs[songId] || `Song ID ${songId}`)
                    : `Official Track #${o['12'] ?? '-'}`
            }
        })
}

async function searchLevels(query) {
    try {
        return await searchViaGDBrowser(query)
    } catch (e) {
        console.error('[searchgd] GDBrowser gagal, fallback ke boomlings:', e.message)
    }
    return await searchViaBoomlings(query)
}

function levelLine(idx, lvl) {
    return (
        `┌─ *${idx}. ${lvl.name || 'Tanpa Nama'}*\n` +
        `│ 🆔 ID: ${lvl.id ?? '-'}\n` +
        `│ 👤 Author: ${lvl.author || '-'}\n` +
        `│ 🎯 Difficulty: ${lvl.difficulty || '-'}\n` +
        `│ ⭐ Stars: ${fmtNum(lvl.stars)}${lvl.featured ? ' 🌟 Featured' : ''}${lvl.epic ? ' 💫 Epic' : ''}\n` +
        `│ 📥 Downloads: ${fmtNum(lvl.downloads)}  👍 Likes: ${fmtNum(lvl.likes)}\n` +
        `│ 📏 Length: ${lvl.length || '-'}\n` +
        `│ 🎵 Song: ${lvl.songName || '-'}\n` +
        `└─────────────────\n`
    )
}

async function handler(m, { sock }) {
    const query = m.args.join(' ').trim()

    if (!query) {
        return m.reply(
            `『 🔍 *ᴄᴀʀɪ ʟᴇᴠᴇʟ ɢᴇᴏᴍᴇᴛʀʏ ᴅᴀsʜ* 🔍 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `✨ *Cara pakai:*\n` +
            `\`${m.prefix}searchgd <nama level>\`\n\n` +
            `💫 *Contoh:*\n` +
            `\`${m.prefix}searchgd Bloodbath\`\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `> 💖 Ai bantu cariin level GD-nya~ 🌸`
        )
    }

    m.react('⭐')

    try {
        const results = await searchLevels(query)

        if (!results || results.length === 0) {
            m.react('❌')
            return m.reply(
                `『 💔 *Tidak Ditemukan~* 』\n\n` +
                `> Level dengan kata kunci \`${query}\` gak ketemu nih~\n` +
                `> Coba kata kunci lain ya~ 💕`
            )
        }

        const levelList = results
            .map((lvl, i) => levelLine(i + 1, lvl))
            .join('\n')

        const caption =
            `『 🌟 *ʜᴏsʜɪɴᴏ ᴀɪ* — ʜᴀsɪʟ ᴘᴇɴᴄᴀʀɪᴀɴ 🌟 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `🔍 *Kata kunci:* ${query}\n` +
            `📋 *Menampilkan:* ${results.length} level\n\n` +
            levelList + '\n' +
            `💡 *Tips:* Pakai \`${m.prefix}levelgd <ID>\` buat lihat detail lengkap salah satu level di atas~\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `🌸 *Hoshino Ai Bot* ✨\n` +
            `> 「 *推しの子* 」\n` +
            `> Ai selalu ada buat kamu~ 💖⭐`

        m.react('✅')
        await m.reply(caption)

    } catch (error) {
        console.error('[searchgd] Error:', error.code || '', error.message)
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