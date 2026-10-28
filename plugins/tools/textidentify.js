const { downloadMediaMessage } = require('hsnai')

const pluginConfig = {
    name: 'textidentify',
    alias: ['scantext', 'identifytext'],
    category: 'tools',
    description: 'Mengambil/membaca teks dari gambar (OCR)',
    usage: '.textidentify (reply/kirim gambar)',
    example: '.textidentify',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 2,
    isEnabled: true
}

async function handler(m, { sock }) {
    try {
        const isImage = m.type === 'imageMessage'
        const isQuotedImage = m.quoted?.type === 'imageMessage'

        if (!isImage && !isQuotedImage) {
            return await m.reply(
                '📸 *TEXT IDENTIFY*\n\n' +
                'Kirim atau reply gambar yang mengandung teks, lalu gunakan perintah ini!\n\n' +
                '> Contoh: Kirim gambar + caption `.textidentify`\n' +
                '> Atau: Reply gambar lalu ketik `.textidentify`'
            )
        }

        await m.reply('🔍 *Sedang membaca teks dari gambar...*\n> Mohon tunggu sebentar~')

        // Download gambar pakai downloadMediaMessage dari hsnai
        const msg = isQuotedImage ? m.quoted : m
        const buffer = await downloadMediaMessage(msg, 'buffer', {})

        if (!buffer || buffer.length === 0) {
            return await m.reply('❌ *Gomen ne~* ✦\n\n> Tidak bisa mengunduh gambar. Coba lagi~ 🥺')
        }

        // Import Tesseract.js v7 (ESM via dynamic import)
        const { createWorker } = await import('tesseract.js')

        const worker = await createWorker('eng+ind')
        const { data: { text, confidence } } = await worker.recognize(buffer)
        await worker.terminate()

        const hasil = text?.trim()

        if (!hasil) {
            return await m.reply(
                '❌ *Tidak ada teks terdeteksi*\n\n' +
                '> Pastikan gambar jelas dan teksnya terbaca!'
            )
        }

        const akurasi = confidence ? `${Math.round(confidence)}%` : 'N/A'

        await m.reply(
            `📝 *TEXT IDENTIFY*\n` +
            `━━━━━━━━━━━━━━━\n` +
            `${hasil}\n` +
            `━━━━━━━━━━━━━━━\n` +
            `> 🎯 Akurasi: ${akurasi}`
        )

    } catch (error) {
        console.error('TextIdentify Plugin Error:', error)
        await m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}