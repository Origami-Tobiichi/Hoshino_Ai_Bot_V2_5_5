const pluginConfig = {
    name: ['todoc'],
    alias: ['doc'],
    category: 'tools',
    description: 'Convert media ke document (custom filename)',
    usage: '.todoc (reply media)',
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const prefix = m.prefix

    // ===== PARSE ARGS (ANTI GAGAL) =====
    let args = []
    if (m.args && Array.isArray(m.args)) {
        args = m.args
    } else if (m.text) {
        args = m.text
            .replace(new RegExp(`^\\${prefix}\\w+`), '')
            .trim()
            .split(/\s+/)
            .filter(v => v)
    }

    // ===== VALIDASI MEDIA =====
    const isQuoted = m.quoted && m.quoted.isMedia
    const isSelfMedia = m.isMedia

    if (!isQuoted && !isSelfMedia) {
        return m.reply(`📌 Reply media ya\nContoh: *${prefix}todoc soundSEA*`)
    }

    m.react('🕕')

    try {
        let buffer, mime, type, originalName

        // ===== AMBIL MEDIA =====
        if (isQuoted) {
            buffer = await m.quoted.download()
            mime = m.quoted.mimetype || ''
            type = m.quoted.type || ''
            originalName = m.quoted.fileName || ''
        } else {
            buffer = await m.download()
            mime = m.mimetype || ''
            type = m.type || ''
            originalName = m.fileName || ''
        }

        if (!buffer) throw new Error('Gagal download')

        // ===== DETEKSI EXT =====
        let ext = 'bin'

        if (/image/.test(mime) || /image/i.test(type)) ext = 'jpg'
        else if (/video/.test(mime) || /video/i.test(type)) ext = 'mp4'
        else if (/audio/.test(mime) || /audio/i.test(type)) ext = 'mp3'
        else if (/sticker/.test(type) || /webp/.test(mime)) ext = 'webp'
        else if (/pdf/.test(mime)) ext = 'pdf'

        // ===== DETEKSI HEADER BUFFER =====
        const head = buffer.toString('hex', 0, 4)

        if (head.startsWith('ffd8')) ext = 'jpg'
        else if (head.startsWith('89504e47')) ext = 'png'
        else if (head.startsWith('47494638')) ext = 'gif'
        else if (head.startsWith('52494646')) ext = 'webp'
        else if (head.includes('66747970')) ext = 'mp4'
        else if (head.startsWith('494433')) ext = 'mp3'

        // ===== NAMA FILE (FIX UTAMA) =====
        let fileName

        if (args.length > 0) {
            // 🔥 PRIORITAS: NAMA DARI USER
            let custom = args.join(' ').replace(/[^\w\s-]/g, '')

            // kalau user nulis ext manual → pakai itu
            if (custom.includes('.')) {
                fileName = custom
            } else {
                fileName = `${custom}.${ext}`
            }

        } else if (originalName) {
            // fallback ke nama asli
            fileName = originalName

        } else {
            // fallback terakhir
            fileName = `HoshinoAi_${Date.now()}.${ext}`
        }

        // ===== KIRIM =====
        await sock.sendMessage(m.chat, {
            document: buffer,
            mimetype: mime || `application/${ext}`,
            fileName
        }, { quoted: m })

        m.react('✅')

    } catch (e) {
        console.error(e)
        m.react('❌')
        m.reply(`❌ Gagal convert\n> ${e.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}