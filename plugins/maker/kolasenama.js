const sharp = require('sharp');

const pluginConfig = {
    name: 'kolasenama',
    alias: ['knama', 'vcollagename', 'vcn'],
    category: 'maker',
    description: 'Buat kolase vertikal 1:2 dengan teks di tengah',
    usage: '.kolasenama <teks/[none]> (reply gambar)',
    example: '.kolasenama HOSHINO AI',
    cooldown: 10,
    energi: 2,
    isEnabled: true
}

async function handler(m, { sock }) {
    // 1. Cek Media
    const isImage = m.isImage || (m.quoted && m.quoted.type === 'imageMessage')
    if (!isImage) return m.reply(`✨ *Hoshino Ai Collage*\n\n> Reply atau kirim gambar dulu ya! 🎤`)

    // 2. Cek Args (Wajib Isi)
    const input = m.args.join(' ')
    if (!input) {
        return m.reply(
            `✨ *Hoshino Ai Collage*\n\n` +
            `╭───〔 📝 *ɪɴsᴛʀᴜᴋsɪ* 〕───⬡\n` +
            `┃ Gunakan format: *${m.prefix}${m.command}* [teks]\n` +
            `┃\n` +
            `┃ 💡 *Tips:* \n` +
            `┃ • Ketik *[none]* jika ingin tanpa teks\n` +
            `┃ • Maksimal 20 karakter agar rapi\n` +
            `┃\n` +
            `┃ Contoh: *${m.prefix}${m.command} HOSHINO*\n` +
            `╰────────────────────────⬡`
        );
    }
    
    // 3. Logika [none] vs Teks Biasa
    const text = (input === '[none]') ? '' : input
    
    if (text.length > 20) return m.reply('❌ *Ehh~* Teks kepanjangan! Maksimal 20 karakter ya~ 🥺')

    m.react('🕕')

    try {
        let buffer = m.quoted ? await m.quoted.download() : await m.download()
        if (!buffer) throw new Error('Gagal download gambar')

        const metadata = await sharp(buffer).metadata()
        const width = metadata.width
        const height = metadata.height
        const canvasHeight = height * 2
        
        let layers = [
            { input: buffer, top: 0, left: 0 },
            { input: buffer, top: height, left: 0 }
        ]

        // Tambahkan overlay teks hanya jika bukan [none]
        if (text !== '') {
            const fontSize = Math.round(width * 0.1)
            const svgText = `
            <svg width="${width}" height="${canvasHeight}">
                <style>
                    .title { fill: #fff; font-size: ${fontSize}px; font-family: sans-serif; font-weight: bold; text-anchor: middle; }
                    .shadow { fill: rgba(0,0,0,0.6); font-size: ${fontSize}px; font-family: sans-serif; font-weight: bold; text-anchor: middle; filter: blur(3px); }
                </style>
                <text x="${width / 2}" y="${canvasHeight / 2 + (fontSize / 3)}" class="shadow">${text}</text>
                <text x="${width / 2}" y="${canvasHeight / 2 + (fontSize / 3)}" class="title">${text}</text>
            </svg>`
            layers.push({ input: Buffer.from(svgText), top: 0, left: 0 })
        }

        const outBuffer = await sharp({
            create: {
                width: width,
                height: canvasHeight,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            }
        })
        .composite(layers)
        .jpeg()
        .toBuffer()

        m.react('✨')
        
        return sock.sendMessage(m.chat, {
            image: outBuffer,
            caption: `✨ *Hoshino Ai Collage*\n\n> Kolase vertikal berhasil dibuat! 🎤`
        }, { quoted: m })

    } catch (error) {
        console.log(error.message)
        m.react('❌')
        m.reply(`❌ *Hoshino Ai Error*\n\n> ${error.message}`)
    }
}

module.exports = { config: pluginConfig, handler }