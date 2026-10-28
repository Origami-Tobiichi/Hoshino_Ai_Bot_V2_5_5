const axios = require('axios')

const pluginConfig = {
    name: 'levelgd',
    alias: ['detailgd', 'gdlevel', 'infolevel'],
    category: 'stalker',
    description: 'Lihat detail lengkap sebuah level Geometry Dash',
    usage: '.levelgd <ID atau nama level>',
    example: '.levelgd Bloodbath',
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

function fmtNum(n) {
    return (n ?? 0).toLocaleString('id-ID')
}

// Untuk data yang gak tersedia dari server resmi GD (orbs, diamonds, CP)
function fmtOpt(n) {
    return n === undefined || n === null ? '-' : fmtNum(n)
}

function isLevelId(query) {
    return /^\d+$/.test(query) || query.toLowerCase() === 'daily' || query.toLowerCase() === 'weekly'
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

// ───────── Sumber 1: GDBrowser ─────────
async function fetchViaGDBrowser(query) {
    const byId = isLevelId(query)
    const url = byId
        ? `${GDBROWSER_URL}/api/level/${encodeURIComponent(query)}`
        : `${GDBROWSER_URL}/api/search/${encodeURIComponent(query)}`

    const res = await axios.get(url, {
        params: byId ? undefined : { count: 1 },
        timeout: 10000,
        headers: { 'User-Agent': 'HoshinoAiBot/1.0', 'Accept': 'application/json' },
        validateStatus: () => true
    })

    const data = res.data
    if (data === -1 || data === '-1') return null
    if (res.status >= 400) throw new Error(`GDBROWSER_${res.status}`)

    if (byId) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('GDBROWSER_INVALID')
        return data
    }

    if (!Array.isArray(data)) throw new Error('GDBROWSER_INVALID')
    return data[0] || null
}

// ───────── Helper server resmi GD (boomlings) ─────────
const LENGTHS = ['Tiny', 'Short', 'Medium', 'Long', 'XL', 'Platformer']
const DEMON_DIFF = { 3: 'Easy Demon', 4: 'Medium Demon', 0: 'Hard Demon', 5: 'Insane Demon', 6: 'Extreme Demon' }
const DEMON_FACE = { 3: 'demon-easy', 4: 'demon-medium', 0: 'demon-hard', 5: 'demon-insane', 6: 'demon-extreme' }
const NORMAL_DIFF = { 0: 'Unrated', 10: 'Easy', 20: 'Normal', 30: 'Hard', 40: 'Harder', 50: 'Insane' }
const NORMAL_FACE = { 0: 'na', 10: 'easy', 20: 'normal', 30: 'hard', 40: 'harder', 50: 'insane' }
const OFFICIAL_SONGS = [
    'Stereo Madness', 'Back on Track', 'Polargeist', 'Dry Out', 'Base After Base', "Can't Let Go",
    'Jumper', 'Time Machine', 'Cycles', 'xStep', 'Clutterfunk', 'Theory of Everything',
    'Electroman Adventures', 'Clubstep', 'Electrodynamix', 'Hexagon Force', 'Blast Processing',
    'Theory of Everything 2', 'Geometrical Dominator', 'Deadlocked', 'Fingerdash', 'Dash'
]

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

function parseDifficulty(o) {
    let text, face
    if (o['25'] === '1') {
        text = 'Auto'
        face = 'auto'
    } else if (o['17'] === '1') {
        const d = Number(o['43'] || 0)
        text = DEMON_DIFF[d] || 'Demon'
        face = DEMON_FACE[d] || 'demon-hard'
    } else {
        const val = Number(o['9'] || 0)
        const den = Number(o['8'] || 10) || 10
        const key = (val / den) * 10
        text = NORMAL_DIFF[key] || 'Unrated'
        face = NORMAL_FACE[key] || 'na'
    }
    return { text, face }
}

function fmtGameVersion(v) {
    const n = Number(v)
    if (!n) return '-'
    if (n >= 20) return (n / 10).toFixed(1)
    if (n === 10) return '1.9'
    if (n < 10) return `1.${n - 1}`
    return String(n)
}

// Password: base64 -> XOR key 26364. "0" = private, "1" = free copy, selain itu: 1 digit prefix + password
function decodePassword(raw) {
    if (!raw || raw === '0') return 0
    if (raw === '1') return 1
    try {
        const buf = Buffer.from(raw, 'base64')
        const key = '26364'
        let out = ''
        for (let i = 0; i < buf.length; i++) {
            out += String.fromCharCode(buf[i] ^ key.charCodeAt(i % key.length))
        }
        if (out === '1') return 1
        if (out.length > 1) return out.slice(1)
        return 0
    } catch {
        return 0
    }
}

// Response getGJLevels21: levels # creators # songs # pageInfo # hash
function parseSearchResponse(text) {
    const [levelsRaw = '', creatorsRaw = '', songsRaw = ''] = text.split('#')

    const creators = {}
    for (const c of creatorsRaw.split('|')) {
        const [playerID, name, accountID] = c.split(':')
        if (playerID) creators[playerID] = { name, accountID }
    }

    const songs = {}
    for (const s of songsRaw.split('~:~')) {
        const p = s.split('~|~')
        const so = {}
        for (let i = 0; i + 1 < p.length; i += 2) so[p[i]] = p[i + 1]
        if (so['1']) songs[so['1']] = so
    }

    return levelsRaw
        .split('|')
        .filter(Boolean)
        .map(raw => {
            const o = parseKV(raw)
            return { o, creator: creators[o['6']], song: songs[o['35']] }
        })
}

// Gabungin data hasil search + download, lalu ubah ke bentuk yang sama kayak GDBrowser
function normalizeLevel(searchEntry, dlO = {}) {
    const o = { ...(searchEntry?.o || {}) }
    for (const [k, v] of Object.entries(dlO)) {
        if (v !== '' && v !== undefined) o[k] = v
    }

    const diff = parseDifficulty(o)
    const featured = Number(o['19'] || 0) > 0
    const epic = Number(o['42'] || 0) > 0
    const likes = Number(o['14'] || 0)
    const objects = num(o['45'])
    const songId = o['35'] && o['35'] !== '0' ? o['35'] : null
    const song = songId ? searchEntry?.song : null

    let songName
    if (songId) {
        songName = song?.['2'] || `Song ID ${songId}`
    } else {
        const idx = Number(o['12'] || 0)
        songName = OFFICIAL_SONGS[idx] || `Official Track #${idx}`
    }

    let description = ''
    try {
        description = o['3'] ? Buffer.from(o['3'], 'base64').toString('utf8') : ''
    } catch { /* abaikan */ }

    return {
        id: num(o['1']),
        name: o['2'],
        author: searchEntry?.creator?.name || '-',
        authorID: num(searchEntry?.creator?.accountID),
        difficulty: diff.text,
        difficultyFace: diff.face + (epic ? '-epic' : featured ? '-featured' : ''),
        length: LENGTHS[Number(o['15'])] || '-',
        gameVersion: fmtGameVersion(o['13']),
        version: num(o['5']),
        stars: Number(o['18'] || 0),
        downloads: Number(o['10'] || 0),
        likes,
        disliked: likes < 0,
        coins: num(o['37']),
        verifiedCoins: o['38'] === '1',
        objects,
        large: (objects || 0) > 40000,
        featured,
        epic,
        twoPlayer: o['31'] === '1',
        password: decodePassword(o['27']),
        copiedID: num(o['30']),
        customSong: songId ? Number(songId) : 0,
        songName,
        songAuthor: song?.['4'],
        songSize: song?.['5'],
        description,
        uploaded: o['28'],
        updated: o['29']
        // orbs, diamonds, cp, demonList: gak tersedia dari server resmi GD
    }
}

// ───────── Sumber 2: Server resmi GD (boomlings) ─────────
async function fetchViaBoomlings(query) {
    const q = query.toLowerCase()
    let levelId = null
    let base = null
    let dlO = null

    if (q === 'daily' || q === 'weekly') {
        const dl = await gdPost('downloadGJLevel22.php', { levelID: q === 'daily' ? '-1' : '-2' })
        if (!dl || dl === '-1') return null
        dlO = parseKV(dl.split('#')[0])
        levelId = dlO['1']
    } else if (/^\d+$/.test(query)) {
        levelId = query
    } else {
        const res = await gdPost('getGJLevels21.php', { str: query, type: '0', page: '0', total: '0' })
        if (!res || res === '-1') return null
        base = parseSearchResponse(res)[0]
        if (!base) return null
        levelId = base.o['1']
    }

    // Data creator + lagu didapat dari search (cari pakai ID)
    if (!base && levelId) {
        try {
            const res = await gdPost('getGJLevels21.php', { str: levelId, type: '0', page: '0', total: '0' })
            if (res && res !== '-1') base = parseSearchResponse(res)[0]
        } catch (e) {
            console.error('[levelgd] search by ID gagal:', e.message)
        }
    }

    // Detail tambahan (password, tanggal upload/update, dll) didapat dari download
    if (!dlO && levelId) {
        try {
            const dl = await gdPost('downloadGJLevel22.php', { levelID: levelId })
            if (dl && dl !== '-1') dlO = parseKV(dl.split('#')[0])
        } catch (e) {
            console.error('[levelgd] download level gagal:', e.message)
        }
    }

    if (!base && !dlO) return null
    return normalizeLevel(base, dlO || {})
}

async function fetchLevel(query) {
    try {
        return await fetchViaGDBrowser(query)
    } catch (e) {
        console.error('[levelgd] GDBrowser gagal, fallback ke boomlings:', e.message)
    }
    return await fetchViaBoomlings(query)
}

async function handler(m, { sock }) {
    const query = m.args.join(' ').trim()

    if (!query) {
        return m.reply(
            `『 📄 *ᴅᴇᴛᴀɪʟ ʟᴇᴠᴇʟ ɢᴇᴏᴍᴇᴛʀʏ ᴅᴀsʜ* 📄 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `✨ *Cara pakai:*\n` +
            `\`${m.prefix}levelgd <ID atau nama level>\`\n\n` +
            `💫 *Contoh:*\n` +
            `\`${m.prefix}levelgd Bloodbath\`\n` +
            `\`${m.prefix}levelgd 10565740\`\n` +
            `\`${m.prefix}levelgd daily\`\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `> 💖 Ai bongkar detail levelnya~ 🌸`
        )
    }

    m.react('⭐')

    try {
        const lvl = await fetchLevel(query)

        if (!lvl || lvl === '-1') {
            m.react('❌')
            return m.reply(
                `『 💔 *Tidak Ditemukan~* 』\n\n` +
                `> Level \`${query}\` gak ketemu nih~\n` +
                `> Cek lagi ID atau nama levelnya ya~ 💕`
            )
        }

        const songInfo = lvl.customSong && lvl.customSong !== 0
            ? `${lvl.songName || '-'} — ${lvl.songAuthor || '-'} (${lvl.songSize ? lvl.songSize + ' MB' : 'Custom'})`
            : `${lvl.songName || '-'} (Official Song)`

        const caption =
            `『 🌟 *ʜᴏsʜɪɴᴏ ᴀɪ* — ᴅᴇᴛᴀɪʟ ʟᴇᴠᴇʟ 🌟 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `🎮 *ɪɴꜰᴏ ᴜᴛᴀᴍᴀ*\n` +
            `┌─────────────────\n` +
            `│ 📛 *Nama:*       ${lvl.name || '-'}\n` +
            `│ 🆔 *ID:*         ${lvl.id ?? '-'}\n` +
            `│ 👤 *Author:*     ${lvl.author || '-'}\n` +
            `│ 🔑 *Author ID:*  ${lvl.authorID ?? '-'}\n` +
            `│ 🎯 *Difficulty:* ${lvl.difficulty || '-'}\n` +
            `│ 📏 *Length:*     ${lvl.length || '-'}\n` +
            `│ 🏷️ *Versi GD:*   ${lvl.gameVersion || '-'}\n` +
            `│ 🔄 *Update ke-:* ${lvl.version ?? '-'}\n` +
            `└─────────────────\n\n` +
            `📊 *sᴛᴀᴛɪsᴛɪᴋ*\n` +
            `┌─────────────────\n` +
            `│ ⭐ *Stars:*      ${fmtNum(lvl.stars)}\n` +
            `│ 🔮 *Orbs:*       ${fmtOpt(lvl.orbs)}\n` +
            `│ 💎 *Diamonds:*   ${fmtOpt(lvl.diamonds)}\n` +
            `│ 🪙 *User Coins:* ${fmtNum(lvl.coins)} ${lvl.verifiedCoins ? '✅ Verified' : ''}\n` +
            `│ 📥 *Downloads:*  ${fmtNum(lvl.downloads)}\n` +
            `│ 👍 *Likes:*      ${fmtNum(lvl.disliked ? '-' + fmtNum(Math.abs(lvl.likes)) : lvl.likes)}\n` +
            `│ 🧩 *Objects:*    ${fmtNum(lvl.objects)}${lvl.large ? ' (Large Level)' : ''}\n` +
            `│ 🎨 *Creator Pts:* ${fmtOpt(lvl.cp)}\n` +
            `└─────────────────\n\n` +
            `🏅 *sᴛᴀᴛᴜs*\n` +
            `┌─────────────────\n` +
            `│ 🌟 *Featured:*    ${lvl.featured ? '✅ Ya' : '❌ Tidak'}\n` +
            `│ 💫 *Epic:*        ${lvl.epic ? '✅ Ya' : '❌ Tidak'}\n` +
            `│ ⭐ *Rated:*       ${lvl.stars > 0 ? '✅ Ya' : '❌ Belum'}\n` +
            `│ 👥 *Two Player:*  ${lvl.twoPlayer ? '✅ Ya' : '❌ Tidak'}\n` +
            `│ 🔓 *Password:*    ${lvl.password === 0 ? '🔒 Private' : lvl.password === 1 ? '🌐 Free Copy' : `🔑 ${lvl.password}`}\n` +
            (lvl.demonList ? `│ 💀 *Demon List:*  #${lvl.demonList} (Pointercrate)\n` : '') +
            (lvl.copiedID && lvl.copiedID !== 0 ? `│ 📋 *Copy dari ID:* ${lvl.copiedID}\n` : '') +
            `└─────────────────\n\n` +
            `🎵 *ʟᴀɢᴜ*\n` +
            `┌─────────────────\n` +
            `│ ${songInfo}\n` +
            `└─────────────────\n\n` +
            `📝 *ᴅᴇsᴋʀɪᴘsɪ*\n` +
            `> ${lvl.description ? lvl.description.slice(0, 200) : 'Tidak ada deskripsi~'}\n\n` +
            `🕐 *Diupload:* ${lvl.uploaded || '-'} lalu\n` +
            `🕑 *Diupdate:* ${lvl.updated || '-'} lalu\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `🌸 *Hoshino Ai Bot* ✨\n` +
            `> 「 *推しの子* 」\n` +
            `> Ai selalu ada buat kamu~ 💖⭐`

        // Gambar wajah difficulty dari GDBrowser; kalau gagal/diblok, kirim teksnya aja
        if (lvl.difficultyFace) {
            const faceBuffer = await fetchImageBuffer(`${GDBROWSER_URL}/difficulty/${lvl.difficultyFace}.png`)
            if (faceBuffer) {
                try {
                    await sock.sendMessage(
                        m.chat,
                        { image: faceBuffer, caption },
                        { quoted: m }
                    )
                    m.react('✅')
                    return
                } catch (e) {
                    console.error('[levelgd] Gagal kirim gambar difficulty:', e.message)
                }
            }
        }

        await m.reply(caption)
        m.react('✅')

    } catch (error) {
        console.error('[levelgd] Error:', error.code || '', error.message)
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