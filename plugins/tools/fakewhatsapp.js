const fs = require('fs')
const path = require('path')

const dbDir = path.join(__dirname, '../../database')
const dbPath = path.join(dbDir, 'fakewa.json')

// ensure folder
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
}

// ensure file
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify([]))
}

const config = {
    name: ['addfakewa', 'delfakewa', 'listfakewa', 'sendfakewa'],
    alias: ['fakewa'],
    category: 'tools',
    description: 'Fake WhatsApp message sender',
    usage: '.addfakewa teks',
    isOwner: true,
    isGroup: false,
    isPrivate: false
}

// ===== DB =====
const getDB = () => {
    try {
        return JSON.parse(fs.readFileSync(dbPath, 'utf-8') || '[]')
    } catch {
        return []
    }
}

const saveDB = (data) => {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2))
}

// ===== HANDLER =====
async function handler(m, { sock }) {
    const command = (m.command || '').toLowerCase()
    const text = (m.args || []).join(' ').trim() // 🔥 FIX UTAMA

    let db = getDB()

    // ===== ADD =====
    if (command === 'addfakewa') {
        if (!text || text.startsWith('.')) {
            return m.reply(
`🌸 *Hoshino Ai Fake WA*

╭┈┈⬡「 ❗ INPUT SALAH 」
┃ Masukkan teks fake!
┃
┃ Contoh:
┃ .addfakewa *⓵ Foto*
╰┈┈⬡`
            )
        }

        db.push(text)
        saveDB(db)

        return m.reply(
`🌸 *Hoshino Ai Fake WA*

╭┈┈⬡「 ✅ BERHASIL 」
┃ Fake berhasil ditambahkan!
┃
┃ 📌 Data:
┃ > ${text}
╰┈┈⬡`
        )
    }

    // ===== DELETE =====
    if (command === 'delfakewa') {
        if (!text) {
            return m.reply(
`🌸 *Hoshino Ai Fake WA*

╭┈┈⬡「 ❗ INPUT KURANG 」
┃ Masukkan index / teks!
┃
┃ Contoh:
┃ .delfakewa 1
╰┈┈⬡`
            )
        }

        let index = parseInt(text) - 1

        if (!isNaN(index)) {
            if (!db[index]) {
                return m.reply('❌ *Ehh~* Index tidak ditemukan~ 🥺')
            }

            const removed = db[index]
            db.splice(index, 1)
            saveDB(db)

            return m.reply(
`🌸 *Hoshino Ai Fake WA*

╭┈┈⬡「 🗑️ DIHAPUS 」
┃ Data berhasil dihapus
┃
┃ > ${removed}
╰┈┈⬡`
            )
        }

        const foundIndex = db.findIndex(v => v === text)
        if (foundIndex === -1) return m.reply('❌ *Ehh~* Teks tidak ditemukan~ 🥺')

        const removed = db[foundIndex]
        db.splice(foundIndex, 1)
        saveDB(db)

        return m.reply(
`🌸 *Hoshino Ai Fake WA*

╭┈┈⬡「 🗑️ DIHAPUS 」
┃ Data berhasil dihapus
┃
┃ > ${removed}
╰┈┈⬡`
        )
    }

    // ===== LIST =====
    if (command === 'listfakewa') {
        if (!db.length) {
            return m.reply(
`🌸 *Hoshino Ai Fake WA*

╭┈┈⬡「 📋 LIST 」
┃ Belum ada data fake WA
╰┈┈⬡`
            )
        }

        const list = db.map((v, i) => `┃ ${i + 1}. ${v}`).join('\n')

        return m.reply(
`🌸 *Hoshino Ai Fake WA*

╭┈┈⬡「 📋 LIST DATA 」
${list}
╰┈┈⬡`
        )
    }

    // ===== SEND =====
    if (command === 'sendfakewa') {
        if (!text) {
            return m.reply(
`🌸 *Hoshino Ai Fake WA*

╭┈┈⬡「 ❗ FORMAT SALAH 」
┃ Format:
┃ .sendfakewa 628xxx|1
╰┈┈⬡`
            )
        }

        const [number, indexRaw] = text.split('|').map(v => v.trim())

        if (!number || !indexRaw) {
            return m.reply('❌ *Ehh~* Format salah~ 🥺')
        }

        const index = parseInt(indexRaw) - 1
        if (isNaN(index) || !db[index]) {
            return m.reply('❌ *Ehh~* Index tidak valid~ 🥺')
        }

        const target = number.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
        const fake = db[index]

        try {
            // 🔥 SESUAI REQUEST: KIRIM PLAIN TEXT (NO STYLE)
            await sock.sendMessage(target, { text: fake })

            return m.reply(
`🌸 *Hoshino Ai Fake WA*

╭┈┈⬡「 ✅ TERKIRIM 」
┃ Berhasil kirim ke:
┃ ${number}
┃
┃ 📌 Isi:
┃ ${fake}
╰┈┈⬡`
            )
        } catch (e) {
            console.error(e)
            return m.reply('❌ *Gomen ne~* Gagal kirim pesan~ 🥺')
        }
    }
}

module.exports = {
    config,
    handler
}