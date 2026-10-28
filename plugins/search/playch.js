const axios = require('axios')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')
const config = require('../../config')

const execAsync = promisify(exec)

const pluginConfig = {
    name: 'playch',
    alias: ['pch'],
    category: 'search',
    description: 'Putar musik dari YouTube (Hoshino Ai Stage)',
    usage: '.playch <query>',
    example: '.playch idol yoasobi',
    cooldown: 20,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const query = m.text?.trim()

    if (!query) {
        return m.reply(`
╭━━━〔 🌸 𝑯𝑶𝑺𝑯𝑰𝑵𝑶 𝑨𝑰 𝑺𝑻𝑨𝑮𝑬 🌸 〕━━━⬣
┃ 🎤 Masukkan judul lagu ya~
┃
┃ ✨ Contoh:
┃ \`${m.prefix}playch idol yoasobi\`
╰━━━━━━━━━━━━━━━━━━⬣
        `.trim())
    }

    m.react('🎧')

    let tempMp3, output

    try {
        const api = `https://api.nexray.web.id/downloader/ytplay?q=${encodeURIComponent(query)}`
        const { data } = await axios.get(api)

        if (!data.status || !data.result) {
            throw "Lagu tidak ditemukan"
        }

        const res = data.result

        const dl = await axios.get(res.download_url, { responseType: 'arraybuffer' })

        const tempDir = path.join(process.cwd(), 'temp')
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir)

        tempMp3 = path.join(tempDir, `play_${Date.now()}.mp3`)
        output = path.join(tempDir, `out_${Date.now()}.ogg`)

        fs.writeFileSync(tempMp3, Buffer.from(dl.data))

        await execAsync(`ffmpeg -y -i "${tempMp3}" -c:a libopus -b:a 64k "${output}"`)

        const ogg = fs.readFileSync(output)

        // 🌟 CAPTION HOSHINO AI STYLE
        const caption = `
╭━━━〔 🌟 𝑯𝑶𝑺𝑯𝑰𝑵𝑶 𝑨𝑰 𝑳𝑰𝑽𝑬 🌟 〕━━━⬣
┃ 🎤 𝑵𝒐𝒘 𝑷𝒆𝒓𝒇𝒐𝒓𝒎𝒊𝒏𝒈…
┃
┃ 🎶 𝑻𝒊𝒕𝒍𝒆 : ${res.title}
┃ 📺 𝑪𝒉𝒂𝒏𝒏𝒆𝒍 : ${res.channel}
┃ 👁 𝑽𝒊𝒆𝒘𝒔 : ${res.views}
┃ ⏱ 𝑫𝒖𝒓𝒂𝒕𝒊𝒐𝒏 : ${res.duration}
┃
┃ 💫 「最高のアイドルステージへ！」
┃ 🌸 Feel the idol energy ~
╰━━━〔 💖 𝑩-𝑲𝑶𝑴𝑨𝑪𝑯𝑰 💖 〕━━━⬣
        `.trim()

        await sock.sendMessage(config?.saluran?.id, {
            audio: ogg,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterName: config?.saluran?.name || "🌟 Hoshino Ai Stage",
                    newsletterId: config?.saluran?.id
                },
            }
        })

        // 🌸 Feedback ke user
        await m.reply(`
╭━━━〔 ✨ 𝑺𝑻𝑨𝑮𝑬 𝑺𝑼𝑪𝑪𝑬𝑺𝑺 ✨ 〕━━━⬣
┃ 🎶 Lagu berhasil dikirim!
┃
┃ 💿 ${res.title}
┃ 📡 Ke saluran:
┃ ${config?.saluran?.id}
┃
┃ 💖 Enjoy ya, idol vibes!
╰━━━━━━━━━━━━━━━━━━⬣
        `.trim())

        m.react('✨')

        // cleanup
        setTimeout(() => {
            try { fs.unlinkSync(tempMp3) } catch {}
            try { fs.unlinkSync(output) } catch {}
        }, 30000)

    } catch (e) {
        console.error('[PlayCH Hoshino]', e)

        m.react('❌')

        m.reply(`
╭━━━〔 ❌ 𝑬𝑹𝑹𝑶𝑹 𝑺𝑻𝑨𝑮𝑬 〕━━━⬣
┃ 💔 Aduh... lagunya gak ketemu...
┃
┃ 🔍 Coba pakai kata lain ya!
╰━━━━━━━━━━━━━━━━━━⬣
        `.trim())
    }
}

module.exports = {
    config: pluginConfig,
    handler
}