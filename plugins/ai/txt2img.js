const config = require('../../config')
const { f } = require('./../../src/lib/undici')

const pluginConfig = {
    name: 'txt2img',
    alias: ['texttoimage', 't2i', 'imagine'],
    category: 'ai',
    description: 'Generate gambar dari teks dengan AI',
    usage: '.txt2img <prompt> | <style>',
    example: '.txt2img beautiful sunset | anime',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 1,
    isEnabled: true
}

const STYLES = ['photorealistic', 'digital-art', 'impressionist', 'anime', 'fantasy', 'sci-fi', 'vintage']

function extractUrl(res) {
    return res?.data?.url || res?.url || res?.result?.url || res?.image || res?.data?.image || null
}

async function handler(m, { sock }) {
    const input = m.args.join(' ')
    if (!input) {
        return m.reply(
            `🎨 *ᴛᴇxᴛ ᴛᴏ ɪᴍᴀɢᴇ*\n\n` +
            `Kyaa~ Ai bakal gambarin apa aja yang kamu bayangin! Tulis deskripsinya dulu ya~ 🌸\n\n` +
            `\`Contoh: ${m.prefix}txt2img beautiful sunset | anime\`\n\n` +
            `🎭 *sᴛʏʟᴇs*\n` +
            `> \`${STYLES.join(', ')}\``
        )
    }

    const [prompt, styleInput] = input.split('|').map(s => s.trim())
    const style = STYLES.includes(styleInput) ? styleInput : 'anime'

    m.react('🕕')

    try {
        let url = null

        // ── API 1: neoxr ──
        try {
            const res = await f(`https://api.neoxr.eu/api/stablediff?prompt=${encodeURIComponent(prompt)}&model=default&orientation=potrait&apikey=${config.APIkey.neoxr}`)
            url = extractUrl(res)
            if (!url) throw new Error('no url')
        } catch (e) {
            console.log('[txt2img] neoxr gagal, fallback ke faa:', e.message)
        }

        // ── API 2: faa fallback — pakai fetch native, ambil sebagai buffer ──
        if (!url) {
            const faaUrl = `https://api-faa.my.id/faa/ai-text2img-pro?prompt=${encodeURIComponent(prompt)}`
            const resp = await fetch(faaUrl)

            console.log('[txt2img] faa status:', resp.status, '| content-type:', resp.headers.get('content-type'))

            const contentType = resp.headers.get('content-type') || ''

            if (contentType.includes('image/')) {
                // API langsung return gambar sebagai binary
                const buffer = Buffer.from(await resp.arrayBuffer())
                await sock.sendMessage(m.chat, {
                    image: buffer,
                    mimetype: contentType
                }, { quoted: m })
                m.react('✅')
                return
            } else {
                // Coba parse JSON
                const json = await resp.json().catch(() => null)
                console.log('[txt2img] faa json:', JSON.stringify(json))
                url = extractUrl(json)
                if (!url) {
                    const errMsg = json?.message || json?.error || json?.msg || 'Kedua API gagal'
                    throw new Error(errMsg)
                }
            }
        }

        await sock.sendMedia(m.chat, url, null, m, { type: 'image' })
        m.react('✅')

    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}