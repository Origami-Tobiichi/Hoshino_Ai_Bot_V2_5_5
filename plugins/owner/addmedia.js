const hsAsset = require('../../src/lib/assets')
const { uploadToCatbox } = require('../../src/lib/uploader')

const pluginConfig = {
    name: 'addmedia',
    alias: ['tambahmedia', 'uploadmedia', 'addasset'],
    category: 'owner',
    description: 'Tambah/ganti aset (URL) di config.assets lewat reply/kirim media atau link',
    usage: '.addmedia <grup> <nama-aset> [url]',
    example: '.addmedia images hsnai-newpose',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

const AI = {
    warn: (msg) => `🌸 *Hmm~ Perhatiin dulu ya!*\n\n> ${msg}`,
}

function getGroups() {
    return hsAsset.groups().filter(g => g !== 'shuffle')
}

// nama aset = nama key di config (tanpa ekstensi); cuma huruf/angka/_/-
function sanitizeName(name) {
    const clean = String(name || '').trim().replace(/\.[a-zA-Z0-9]{2,5}$/, '')
    if (!/^[a-zA-Z0-9_\-]+$/.test(clean)) return null
    return clean
}

function detectMedia(m) {
    const src = m.quoted?.isMedia ? m.quoted : (m.isMedia ? m : null)
    if (!src) return null
    if (src.isImage) return { emoji: '🖼️', source: src }
    if (src.isVideo) return { emoji: '🎬', source: src }
    if (src.isAudio) return { emoji: '🎵', source: src }
    if (src.isSticker) return { emoji: '🌟', source: src }
    if (src.isDocument) return { emoji: '📄', source: src }
    return null
}

async function handler(m, { sock }) {
    const groups = getGroups()
    const [groupArg, nameArg, urlArg] = m.args
    const media = detectMedia(m)
    const hasUrl = /^https?:\/\//i.test(urlArg || '')

    if (!groupArg || !nameArg || (!media && !hasUrl)) {
        return m.reply(
            `🌸 *ᴀᴅᴅ ᴍᴇᴅɪᴀ*\n\n` +
            `Reply/kirim media, atau sertakan link, lalu:\n` +
            `\`${m.prefix}addmedia <grup> <nama-aset>\`\n` +
            `\`${m.prefix}addmedia <grup> <nama-aset> https://...\`\n\n` +
            `*Contoh:*\n> \`${m.prefix}addmedia images hsnai-newpose\`\n\n` +
            `*Grup tersedia:*\n${groups.map(c => `> \`${c}\``).join('\n')}\n\n` +
            `> _Media di-upload ke hosting, yang disimpan cuma URL-nya (database/main/assetUrls.json)~ 💖_`
        )
    }

    const group = groupArg.toLowerCase()
    if (!groups.includes(group)) {
        return m.reply(AI.warn(`Grup \`${group}\` nggak ada nih~\n\nGrup tersedia:\n${groups.map(c => `> \`${c}\``).join('\n')}`))
    }

    const name = sanitizeName(nameArg)
    if (!name) {
        return m.reply(AI.warn('Nama aset-nya kurang valid~ Pakai huruf/angka/_/- aja ya (tanpa spasi)'))
    }

    const key = `${group}/${name}`
    try {
        let finalUrl = hasUrl ? urlArg : null
        if (!finalUrl) {
            const buffer = await media.source.download()
            if (!buffer || !buffer.length) {
                return m.reply(AI.warn('Gagal download media-nya, coba kirim ulang ya~'))
            }
            finalUrl = await uploadToCatbox(buffer, name)
        }

        const isOverwrite = hsAsset.has(key)
        hsAsset.setUrl(key, finalUrl)

        m.react(media?.emoji || '🔗')
        await m.reply(
            `✅ *ᴀsᴇᴛ ᴅɪsɪᴍᴘᴀɴ* 🌸\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 📁 ɢʀᴜᴘ: \`${group}\`\n` +
            `┃ 📝 ᴋᴇʏ: \`${key}\`\n` +
            `┃ 🔗 ᴜʀʟ: ${finalUrl}\n` +
            `┃ 🗂️ sᴛᴀᴛᴜs: *${isOverwrite ? 'Menimpa URL lama' : 'URL baru'}*\n` +
            `╰┈┈⬡\n\n` +
            `> _Udah Ai upload ya~ 💖_\n> ${url}`
        )
    } catch (error) {
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
