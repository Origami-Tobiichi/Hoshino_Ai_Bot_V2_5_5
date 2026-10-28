const hsAsset = require('../../src/lib/assets')
const config = require('../../config')
const { AIRich } = require('hsnai')
const { getDatabase } = require('../../src/lib/database')
const FormData = require('form-data')
const nfetch = require('node-fetch')

/* ════════════════════════════════════════════════════════════
 *  UPLOAD GAMBAR KE HOST PUBLIK (cara sama seperti manggilhoshinoai.js)
 *  buffer → upload → URL → AIRich.addImage(url)
 *  Urutan: Uguu dulu, Catbox cadangan. Link di-cache 30 menit.
 * ════════════════════════════════════════════════════════════ */

const IMG_CACHE_TTL = 30 * 60 * 1000
let imgCache = { url: null, at: 0 }

async function uploadImage(buffer, filename = 'hoshino-script.jpg') {
    const uploaders = [
        ['Uguu', async () => {
            const f = new FormData()
            f.append('files[]', buffer, { filename, contentType: 'image/jpeg' })
            const r = await nfetch('https://uguu.se/upload.php', { method: 'POST', body: f, headers: f.getHeaders(), timeout: 60000 })
            const d = await r.json()
            if (!d?.files?.[0]?.url) throw new Error('response invalid')
            return d.files[0].url
        }],
        ['Catbox', async () => {
            const f = new FormData()
            f.append('reqtype', 'fileupload')
            f.append('fileToUpload', buffer, { filename, contentType: 'image/jpeg' })
            const r = await nfetch('https://catbox.moe/user/api.php', { method: 'POST', body: f, headers: f.getHeaders(), timeout: 60000 })
            const t = (await r.text()).trim()
            if (!t.startsWith('http')) throw new Error(t.slice(0, 80))
            return t
        }]
    ]

    const gagal = []
    for (const [nama, fn] of uploaders) {
        try {
            const u = await fn()
            console.log('[script] upload via', nama, u)
            return u
        } catch (e) { gagal.push(`${nama}: ${e.message}`) }
    }
    throw new Error('Upload gagal → ' + gagal.join(' | '))
}

async function getScriptImageUrl() {
    if (imgCache.url && Date.now() - imgCache.at < IMG_CACHE_TTL) return imgCache.url
    if (!hsAsset.has('images/hsnai')) return null
    const buf = await hsAsset.buffer('images/hsnai')
    if (!buf || buf.length < 500) return null
    const url = await uploadImage(buf)
    imgCache = { url, at: Date.now() }
    return url
}

const pluginConfig = {
    name: 'script',
    alias: ['sc', 'sourcebot', 'source'],
    category: 'main',
    description: 'Dapatkan source code bot',
    usage: '.script',
    example: '.script',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 0,
    isEnabled: true
}

const DEFAULT_PP = config.assets?.images?.['pp-kosong'] || 'https://cdn.gimita.id/download/pp%20kosong%20wa%20default%20(1)_1769506608569_52b57f5b.jpg'

/* Kartu post owner (addPost) — pola sama seperti owner.js type 4 */
async function buildOwnerPosts(sock, botName) {
    const db = getDatabase()

    const getOwnerName = (cleanNumber) => {
        const names = db.setting('ownerNames') || {}
        if (names[cleanNumber]) return names[cleanNumber]
        const userDb = db.getUser(cleanNumber + '@s.whatsapp.net') || db.getUser(cleanNumber)
        return userDb?.name || config.owner?.name || 'Owner'
    }

    const configOwners = [].concat(config.owner?.number || [])
        .map(n => String(n).replace(/[^0-9]/g, ''))
        .filter(n => n.length >= 10)

    const dbOwners = (Array.isArray(db.data?.owner) ? db.data.owner : [])
        .map(n => String(n).replace(/[^0-9]/g, ''))
        .filter(n => n.length >= 10 && !configOwners.includes(n))

    const owners = [
        ...configOwners.map(num => ({ num, label: '👑 Owner Utama' })),
        ...dbOwners.map((num, idx) => ({ num, label: `⭐ Owner ${idx + 1}` }))
    ]

    const posts = []
    for (const { num, label } of owners) {
        const name = getOwnerName(num)
        let ppUrl = DEFAULT_PP
        try { ppUrl = await sock.profilePictureUrl(num + '@s.whatsapp.net', 'image') } catch {}

        const link = `https://wa.me/${num}?text=Hai%20${encodeURIComponent(name)}~`
        posts.push({
            profile_url: ppUrl,
            username: `~ ${name}`,
            caption: label,
            subtitle: `${label} • ${botName}`,
            thumbnail: ppUrl,
            footer: `Ketuk untuk chat ${name}~ 💖`,
            verified: configOwners.includes(num),
            source: 'SeaPRST',
            orientation: 'LANDSCAPE',
            post_type: 'PHOTO',
            like: 0,
            comment: 0,
            share: 0,
            post_url: link,
            post_deeplink: link
        })
    }
    return posts
}

function getInfo() {
    const botName = config.bot?.name || 'Hoshino Ai'
    return {
        botName,
        footer: config.settings?.footer || `© ${botName} 2026`,
        groupUrl: config.info?.grupwa || 'https://chat.whatsapp.com/KFwyFjYluqnCg3o62MjCWZ',
        price: config.script?.price || 0,
        saluranUrl: config.saluran?.link || config.saluran?.url || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    }
}

async function handler(m, { sock }) {
    const i = getInfo()
    const harga = i.price ? `Rp ${Number(i.price).toLocaleString('id-ID')}` : 'GRATIS'

    try {
        if (!AIRich) throw new Error('AIRich tidak diexport oleh hsnai')

        let imgUrl = null
        try {
            imgUrl = await getScriptImageUrl()
        } catch (e) {
            console.error('[Script] gambar dilewati:', e.message)
        }

        const rich = new AIRich(sock).setTitle(`⭐ ${i.botName} ⭐`)

        if (imgUrl) rich.addImage(imgUrl, { width: 1280, height: 720 })

        rich
            .addText(
                `╭─❖ ⭐ *sᴏᴜʀᴄᴇ ᴄᴏᴅᴇ* ⭐ ❖─╮\n\n` +
                `🌸 _"Hai hai~ mau script Hoshino ya? Tenang, semuanya Hoshino siapin!"_ 💖\n\n` +
                `👑 *Nama:* ${i.botName}\n` +
                `💫 *Harga:* ${harga}\n\n` +
                `╰────────────────╯`
            )
            .addTable([
                ['✨ ꜰɪᴛᴜʀ', '🎀 ᴋᴇᴛᴇʀᴀɴɢᴀɴ'],
                ['Multi-device', 'Support banyak perangkat'],
                ['500+ Command', 'Plugin lengkap & rapi'],
                ['Anti-spam & Anti-link', 'Grup lebih aman'],
                ['Game & RPG', 'Banyak game seru'],
                ['Panel Management', 'Kelola bot gampang'],
                ['Auto-update', 'Selalu versi terbaru']
            ])
            .addText(`💖 _"Jangan lupa mampir ke [saluran Hoshino](${i.saluranUrl}) juga ya~"_ 🌸`)
            .addFooterAction([
                { text: '👥 Gabung Grup Hoshino', type: 'OPEN_URL', url: i.groupUrl },
                { text: '🌸 Saluran Hoshino', type: 'OPEN_URL', url: i.saluranUrl }
            ])

        const ownerPosts = await buildOwnerPosts(sock, i.botName)
        if (ownerPosts.length) rich.addPost(ownerPosts)

        rich
            .addSuggest(['👑 Hubungi Owner', '⭐ Menu Utama'])
            .addMetadata(i.footer)

        await rich.send(m.chat, { quoted: m })
    } catch (error) {
        console.error('[Script] Error:', error.message)

        await m.reply(
            `╭─❖ 📦 *${i.botName} sᴄʀɪᴘᴛ* ❖─╮\n` +
            `┃\n` +
            `┃ 💫 *Harga:* ${harga}\n` +
            `┃ 👥 *Grup:* ${i.groupUrl}\n` +
            `┃ 🌸 *Saluran:* ${i.saluranUrl}\n` +
            `┃\n` +
            `┃ 🎀 _"Hubungi owner untuk info_\n` +
            `┃ _lebih lanjut ya~"_ 💖\n` +
            `╰────────────────╯`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}