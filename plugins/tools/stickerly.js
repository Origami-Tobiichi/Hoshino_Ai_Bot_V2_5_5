const axios = require('axios')
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')
const sly = require(path.join(process.cwd(), 'src/scraper/stickerly'))

const pluginConfig = {
    name: 'stickerly',
    alias: ['stikerly', 'sly'],
    category: 'tools',
    description: 'Search & send full Sticker.ly pack',
    usage: '.stickerly <query/link>',
    example: '.stickerly ai hoshino',
    cooldown: 5,
    isEnabled: true
}

const HOSHINO_STAGE = path.join(process.cwd(), 'temp', 'sly_sessions')
if (!fs.existsSync(HOSHINO_STAGE)) fs.mkdirSync(HOSHINO_STAGE, { recursive: true })

// =======================
// 🌸 Utilities
// =======================
const Hoshino = {
    async toWebp(buffer) {
        const SAFE_SINGLE_BYTES = 500 * 1024

        const meta = await sharp(buffer, { animated: true }).metadata()
        const isMulti = (meta.pages || 1) > 1

        const encode = async (quality, resize) => sharp(buffer, { animated: true })
            .resize(resize, resize, { fit: 'inside' })
            .webp({ quality })
            .toBuffer()

        let webp = await encode(isMulti ? 55 : 100, 512)
        let isAnimated = isMulti

        if (isMulti && webp.length > SAFE_SINGLE_BYTES) {
            webp = await encode(35, 400)
        }

        if (isMulti && webp.length > SAFE_SINGLE_BYTES) {
            webp = await sharp(buffer, { animated: false })
                .resize(512, 512, { fit: 'inside' })
                .webp({ quality: 90 })
                .toBuffer()
            isAnimated = false
        }

        return { webp, isAnimated }
    },

    async fetchBuffer(url) {
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 25000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        return Buffer.from(res.data)
    }
}

// NOTE 2026-07-12: raw pack upload (zip → media_conn → relayMessage) sekarang
// dipusatkan di sock.sendStickerPackRaw (sockHelper/extendSocket.js), jangan
// duplikat logic upload di sini lagi. Plugin ini cuma manggil method itu.

// =======================
// 🌸 Core Performance
// =======================
async function performStickerPack(url, m, sock) {
    await m.react('⏳')

    try {
        const data = await sly.detail(url)

        if (!data?.stickers?.length) {
            await m.react('❌')
            return m.reply("❌ *Gomen ne~* Gagal mengambil data stiker~ 🥺")
        }

        await m.reply(`📦 *${data.name}*\n✨ ${data.stickerCount} stiker\n\n> Menyiapkan panggung...`)

        const stage = []
        const spotlight = data.stickers

        for (const s of spotlight) {
            try {
                const raw = await Hoshino.fetchBuffer(s.url)
                const { webp, isAnimated } = await Hoshino.toWebp(raw)

                stage.push({ sticker: webp, emojis: ['✨'], isAnimated })

                await new Promise(r => setTimeout(r, 200))
            } catch {
                continue
            }
        }

        if (!stage.length) {
            await m.react('❌')
            return m.reply("❌ *Gomen ne~* Semua stiker gagal diproses~ 🥺")
        }

        let sent = false

        // =======================
        // 🌸 Try Pack Mode (via sock.sendStickerPackRaw dari sockHelper)
        // =======================
        try {
            await sock.sendStickerPackRaw(
                m.chat,
                stage.map(s => ({
                    buffer: s.sticker,
                    isAnimated: s.isAnimated,
                    emojis: s.emojis || ['✨']
                })),
                m,
                {
                    name: data.name,
                    publisher: 'SeaPRST',
                    description: 'Hoshino Ai Bot'
                }
            )
            sent = true
        } catch (err) {
            console.log('❌ Pack gagal:', err.message)
            console.log(err.stack)
            const trace = err.stack?.split('\n').slice(0, 6).join('\n') || 'no stack'
            await m.reply(`⚠️ Debug pack error: ${err.message}\n📦 Total: ${stage.length} stiker\n\n\`\`\`${trace}\`\`\``)
        }

        // =======================
        // 🌸 Fallback Mode
        // =======================
        if (!sent) {
            await m.reply("⚠️ *Eh eh~* Pack gagal, mengirim satu per satu..~ 🌸")

            let ok = 0
            for (let i = 0; i < stage.length; i++) {
                try {
                    await sock.sendMessage(m.chat, {
                        sticker: stage[i].sticker
                    })
                    ok++

                    if ((i + 1) % 5 === 0) {
                        await m.reply(`✨ Mengirim... ${i + 1}/${stage.length}`)
                    }

                    await new Promise(r => setTimeout(r, 150))
                } catch {
                    continue
                }
            }

            if (!ok) {
                await m.react('❌')
                return m.reply("❌ *Gomen ne~* Gagal mengirim semua stiker~ 🥺")
            }
        }

        await m.react('🌸')

    } catch (e) {
        await m.react('❌')
        m.reply(`⚠️ *Eh eh~* Gagal: ${e.message} 🌸`)
    }
}

// =======================
// 🌸 Handler
// =======================
async function handler(m, { sock }) {
    const prefix = m.prefix || '.'
    const cmd = (m.command || '').toLowerCase()
    const body = (m.body || m.text || '').trim()

    const args = m.args || []
    const text = m.text || ''

    const qArgs = args.length
        ? args
        : text
        ? text.trim().split(/\s+/)
        : body.includes(' ')
        ? body.split(/\s+/).slice(1)
        : []

    const sessionFile = path.join(
        HOSHINO_STAGE,
        `${m.chat.replace(/[^a-zA-Z0-9]/g, '')}.json`
    )

    // =========================
    // 🌸 Selection
    // =========================
    if (qArgs[0] === '--get' && qArgs[1]) {
        if (!fs.existsSync(sessionFile)) {
            return m.reply("❌ *Ehh~* Sesi telah berakhir~ 🥺")
        }

        const session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'))
        const index = parseInt(qArgs[1]) - 1

        if (!session[index]) {
            return m.reply("❌ *Ehh~* Pilihan tidak tersedia~ 🥺")
        }

        await performStickerPack(session[index].url, m, sock)
        return
    }

    // =========================
    // 🌸 Direct Link
    // =========================
    const link = body.match(/https:\/\/sticker\.ly\/s\/[^\s]+/)
    if (link) return performStickerPack(link[0], m, sock)

    // =========================
    // 🌸 Command Check
    // =========================
    const isCmd = ['stickerly', 'stikerly', 'sly'].includes(cmd)
    if (!isCmd) return

    if (qArgs[0] === '--get') return

    // =========================
    // 🌸 Query
    // =========================
    let query = ''

    if (text && !text.startsWith('--get')) query = text
    else if (qArgs.length) query = qArgs.join(' ')
    else if (body.includes(' ')) query = body.split(/\s+/).slice(1).join(' ')

    if (!query || query.length < 2) {
        return m.reply(`🔍 Cari pack stiker\n\nContoh:\n${prefix}${cmd} ai hoshino`)
    }

    await m.react('🔍')

    try {
        const results = await sly.search(query)

        if (!results?.length) {
            return m.reply(`❌ *Ehh~* Tidak ditemukan: *${query}*~ 🥺`)
        }

        fs.writeFileSync(sessionFile, JSON.stringify(results))

        setTimeout(() => {
            if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile)
        }, 600000)

        const rows = results.slice(0, 15).map((v, i) => ({
            title: v.name,
            description: `👤 ${v.author} (${v.stickerCount})`,
            id: `${prefix}stickerly --get ${i + 1}`
        }))

        await sock.sendMessage(m.chat, {
            text: `🌸 *Hoshino Sticker Stage*\n\nKeyword: *${query}*\n\n_Pilih penampilan:_`,
            footer: 'Hoshino Ai ✨',
            interactiveButtons: [{
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: '🎭 Pilih Pack',
                    sections: [{ title: 'Result', rows }]
                })
            }]
        }, { quoted: m })

        await m.react('✨')

    } catch (e) {
        await m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${e.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = { config: pluginConfig, handler }