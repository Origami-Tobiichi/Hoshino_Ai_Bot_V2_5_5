const axios = require('axios')

const pluginConfig = {
    name: ['caribug'],
    alias: ['debug', 'findbug', 'cekbug'],
    category: 'tools',
    description: 'Cari bug di kode pemrograman',
    usage: '.caribug <kode> atau reply kode',
    example: '.caribug function test() {}',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 20,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const code = m.quoted?.text || m.quoted?.body || m.args.join(' ').trim()

    if (!code) {
        m.react('❌')
        return m.reply(
            `『 🐛 *ᴄᴀʀɪ ʙᴜɢ* 🐛 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `✨ *Cara pakai:*\n` +
            `\`${m.prefix}caribug <kode>\`\n\n` +
            `💫 *Atau reply pesan kode lalu:*\n` +
            `\`${m.prefix}caribug\`\n\n` +
            `📝 *Contoh:*\n` +
            `\`${m.prefix}caribug function test() {}\`\n\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `> 💖 Ai siap bantu cari bug di kode kamu~ 🌸`
        )
    }

    m.react('⭐')

    try {
        const res = await axios.get('https://api.cuki.biz.id/api/aicode/caribug', {
            params: {
                apikey: 'cuki-x',
                code,
                language: 'auto'
            },
            timeout: 60000
        })

        const data = res.data
        if (!data.success || !data.data) throw new Error('Gagal menganalisa kode dari server')

        const info = data.data
        const meta = info.metadata
        const bugInfo = info.bugsFound

        const severityEmoji = {
            'Rendah': '🟢',
            'Sedang': '🟡',
            'Tinggi': '🔴',
            'Kritis': '💀'
        }
        const sevEmoji = severityEmoji[meta.severityInfo?.level] || meta.severityInfo?.icon || '⚪'

        let text =
            `『 🌟 *ʜᴏsʜɪɴᴏ ᴀɪ* — ᴄᴀʀɪ ʙᴜɢ 🌟 』\n` +
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n\n` +
            `📋 *ʜᴀsɪʟ ᴀɴᴀʟɪsᴀ*\n` +
            `┌─────────────────\n` +
            `│ 💻 *Bahasa:* ${meta.detectedLanguage || '-'}\n` +
            `│ ⚠️ *Tingkat:* ${meta.severityInfo?.level || '-'} ${sevEmoji}\n` +
            `│ 🐛 *Bug Ditemukan:* ${bugInfo.total || 0}\n` +
            `└─────────────────\n\n`

        if (bugInfo.summary) {
            text += `📝 *ʀɪɴɢᴋᴀsᴀɴ*\n`
            text += `┌─────────────────\n`
            text += `│ ${bugInfo.summary.replace(/\n/g, '\n│ ')}\n`
            text += `└─────────────────\n\n`
        }

        if (bugInfo.details && bugInfo.details.length > 0) {
            text += `📌 *ᴅᴇᴛᴀɪʟ ʙᴜɢ*\n`
            text += `┌─────────────────\n`
            bugInfo.details.forEach((d, i) => {
                text += `│ ${i + 1}. ${d.type || d.description || '-'}\n`
            })
            text += `└─────────────────\n\n`
        }

        if (info.codeAnalysis?.fixed?.code) {
            text += `✨ *ᴋᴏᴅᴇ ᴘᴇʀʙᴀɪᴋᴀɴ*\n`
            text += `\`\`\`${meta.detectedLanguage || ''}\n${info.codeAnalysis.fixed.code}\n\`\`\`\n\n`
        }

        text +=
            `✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n` +
            `🌸 *Hoshino Ai Bot* ✨\n` +
            `> 「 *推しの子* 」\n` +
            `> Semoga bugnya ketemu dan kodenya makin keren~ 💖⭐`

        m.react('✅')
        await m.reply(text)

    } catch (err) {
        console.error('[CariBug] Error:', err.message)
        m.react('❌')
        m.reply(
            `『 💥 *E R R O R* 』\n\n` +
            `> ${err?.message || err?.toString() || 'Unknown error'}\n\n` +
            `> 💔 Maaf ya~ Ai gagal analisa kodenya...\n` +
            `> Coba lagi nanti ya~ 🌸`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}