const path = require('path')
const hsAsset = require('../../src/lib/assets')

const pluginConfig = {
    name: 'sendasset',
    alias: ['assetbrowser', 'sendassets', 'browseasset'],
    category: 'owner',
    description: 'Asset browser & sender — lihat/kirim aset dari URL di config.assets',
    usage: '.sendasset [grup] [nama-aset] [--url]',
    example: '.sendasset images hsnai',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

// grup yang dipakai key "<grup>/<nama>" (shuffle = array, ditangani terpisah)
function getGroups() {
    return hsAsset.groups().filter(g => g !== 'shuffle')
}

function getEntries(group) {
    return hsAsset.list(group)
        .map(e => ({ name: e.key.slice(group.length + 1), key: e.key, url: e.url }))
        .sort((a, b) => a.name.localeCompare(b.name))
}

function detectMsgType(url, group) {
    let ext = ''
    try { ext = path.extname(new URL(url).pathname).toLowerCase() } catch {}
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return 'image'
    if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext)) return 'video'
    if (['.mp3', '.ogg', '.aac', '.m4a', '.wav'].includes(ext)) return 'audio'
    if (['.ttf', '.otf', '.zip', '.pdf'].includes(ext)) return 'document'
    if (group === 'video') return 'video'
    if (group === 'audio') return 'audio'
    if (group === 'fonts') return 'document'
    return 'image'
}

function getMimeType(url) {
    let ext = ''
    try { ext = path.extname(new URL(url).pathname).toLowerCase() } catch {}
    const map = {
        '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.aac': 'audio/aac', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
        '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.pdf': 'application/pdf', '.zip': 'application/zip',
        '.ttf': 'font/ttf', '.otf': 'font/otf'
    }
    return map[ext] || 'application/octet-stream'
}

async function sendEntry(sock, chat, entry, group, quoted) {
    const buf = await hsAsset.buffer(entry.key)
    const type = detectMsgType(entry.url, group)
    const caption = `🌸 *${entry.name}*\n📁 ${group}`
    if (type === 'image') return sock.sendMessage(chat, { image: buf, caption }, { quoted })
    if (type === 'video') return sock.sendMessage(chat, { video: buf, caption }, { quoted })
    if (type === 'audio') return sock.sendMessage(chat, { audio: buf, mimetype: getMimeType(entry.url) }, { quoted })
    let fileName = entry.name
    try { fileName = path.basename(new URL(entry.url).pathname) || entry.name } catch {}
    return sock.sendMessage(chat, { document: buf, mimetype: getMimeType(entry.url), fileName, caption }, { quoted })
}

async function handler(m, { sock }) {
    const showUrl = m.args.includes('--url')
    const args = m.args.filter(a => a !== '--url' && a !== '--info')
    const groups = getGroups()

    // ── ringkasan ─────────────────────────────────────────────────────────────
    if (args.length === 0) {
        let total = 0, filled = 0
        let lines = ''
        for (const g of groups) {
            const entries = getEntries(g)
            const ok = entries.filter(e => e.url).length
            total += entries.length
            filled += ok
            lines += `┃ 📁 \`${g}\` — *${ok}/${entries.length}* URL terisi\n`
        }
        const shuffleCount = hsAsset.shuffleList().length
        return m.reply(
            `🌸✨ *ᴀssᴇᴛ ʙʀᴏᴡsᴇʀ* ✨🌸\n\n` +
            `╭┈┈⬡「 📊 *ʀɪɴɢᴋᴀsᴀɴ config.assets* 」\n` +
            lines +
            `┃ 🔀 \`shuffle\` — *${shuffleCount}* URL\n` +
            `┃\n┃ 📌 ᴛᴏᴛᴀʟ: *${filled}/${total}* key terisi\n` +
            `╰┈┈⬡\n\n` +
            `> *Cara pakai:*\n` +
            `> \`${m.prefix}sendasset <grup>\` → lihat isi grup\n` +
            `> \`${m.prefix}sendasset images hsnai\` → kirim 1 aset\n` +
            `> \`${m.prefix}sendasset images hsnai --url\` → tampilkan link-nya aja\n\n` +
            `> _URL diisi di config.js → assets, atau lewat command .ganti-*_`
        )
    }

    // ── validasi grup ─────────────────────────────────────────────────────────
    const group = args[0].toLowerCase()
    if (group === 'shuffle') {
        const list = hsAsset.shuffleList()
        return m.reply(
            `📁 *ᴀssᴇᴛs/shuffle* (${list.length} URL)\n\n` +
            (list.length ? list.map((u, i) => `${i + 1}. ${u}`).join('\n') : '> (kosong)') +
            `\n\n> _Lihat gambarnya lewat \`${m.prefix}srt list\`_`
        )
    }
    if (!groups.includes(group)) {
        return m.reply(
            `🌸 *Hmm~ Perhatiin dulu ya!*\n\n` +
            `> Grup \`${group}\` nggak ada nih~\n\n` +
            `*Grup tersedia:*\n${groups.map(c => `> \`${c}\``).join('\n')}`
        )
    }

    const entries = getEntries(group)
    const keyword = (args[1] || '').toLowerCase()

    // ── kirim 1 aset (nama persis, ekstensi boleh ditulis) ────────────────────
    if (keyword) {
        const norm = keyword.replace(/\.[a-z0-9]{2,5}$/i, '')
        const exact = entries.find(e => e.name.toLowerCase() === norm)
        if (exact) {
            if (!exact.url) {
                return m.reply(`🌸 *Hmm~*\n\n> URL untuk \`${exact.key}\` belum diisi di config.assets`)
            }
            if (showUrl) return m.reply(`🌸 *${exact.key}*\n\n${exact.url}`)
            m.react('🕕')
            try {
                await sendEntry(sock, m.chat, exact, group, m)
                m.react('✅')
            } catch (e) {
                m.react('❌')
                m.reply(`❌ *ᴇʀʀᴏʀ*\n\n> ${e.message}`)
            }
            return
        }
    }

    // ── daftar (dengan filter keyword kalau ada) ──────────────────────────────
    const shown = keyword ? entries.filter(e => e.name.toLowerCase().includes(keyword)) : entries
    if (shown.length === 0) {
        return m.reply(`🌸 *Hmm~ Perhatiin dulu ya!*\n\n> Nggak ada aset yang cocok dengan \`${keyword}\` di \`${group}\` nih~`)
    }
    const listText = shown.map((e, i) =>
        `┃ ${(i + 1).toString().padStart(2)}. ${e.url ? '✅' : '⬜'} \`${e.name}\`` + (showUrl && e.url ? `\n┃      ${e.url}` : '')
    ).join('\n')

    return m.reply(
        `📁 *ᴀssᴇᴛs/${group}* (${shown.length} key)\n\n` +
        `╭┈┈⬡\n${listText}\n╰┈┈⬡\n\n` +
        `> ✅ = URL terisi · ⬜ = kosong\n` +
        `> Kirim: \`${m.prefix}sendasset ${group} <nama>\``
    )
}

// dipertahankan supaya src/handler.js tetap kompatibel (tidak ada konfirmasi lagi di versi URL)
async function answerHandler() {
    return false
}

module.exports = {
    config: pluginConfig,
    handler,
    answerHandler
}
