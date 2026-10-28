/**
 * ✧ Name    : snippet
 * ✧ Category: owner
 **/

const fs = require('fs')
const path = require('path')
const FormData = require('form-data')
const fetch = require('node-fetch')
const { getDatabase } = require('../../src/lib/database')
const { AIRich } = require('hsnai')
const config = require('../../config')

const MEDIA_DIR = path.join(process.cwd(), 'database', 'snippets_media')
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true })

// Upload buffer ke Catbox, dapetin URL publik permanen
async function uploadToCatbox(buffer, filename = 'image.jpg') {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('fileToUpload', buffer, { filename, contentType: 'image/jpeg' })
    const res = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST', body: form, headers: form.getHeaders(), timeout: 60000
    })
    if (!res.ok) throw new Error('Catbox gagal')
    const url = await res.text()
    if (!url.startsWith('http')) throw new Error('Catbox response tidak valid')
    return url.trim()
}

const pluginConfig = {
    name: 'snippet',
    alias: ['addcode', 'showcode', 'listcode', 'delcode', 'codelist', 'savecode', 'delsnippet'],
    category: 'owner',
    description: 'Menyimpan dan mengambil kode/catatan penting, bisa sama gambar (owner only)',
    usage: '.snippet add <nama> | <kode>  (bisa sambil reply gambar)\n.snippet get <nomor|nama>\n.snippet list\n.snippet del <nomor|nama>',
    example: '.snippet add fixSticker | sharp(buf, { animated: true })',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 0,
    energi: 0,
    isEnabled: true
}

function getSnippets(db) {
    return db.setting('snippets') || {}
}

function saveSnippets(db, snippets) {
    db.setting('snippets', snippets)
}

function resolveKey(input, snippets) {
    const trimmed = input.trim()
    const keys = Object.keys(snippets)
    if (/^\d+$/.test(trimmed)) {
        const idx = parseInt(trimmed, 10) - 1
        return keys[idx] ?? null
    }
    return snippets[trimmed] ? trimmed : null
}

async function handler(m, { sock }) {
    const db = getDatabase()

    const raw = m.text?.trim() || ''
    const usedAlias = m.command

    const aliasMap = {
        addcode: 'add', savecode: 'add',
        showcode: 'get',
        listcode: 'list', codelist: 'list',
        delcode: 'del', delsnippet: 'del',
    }

    let sub, rest
    if (aliasMap[usedAlias]) {
        sub = aliasMap[usedAlias]
        rest = raw
    } else {
        const parts = raw.split(' ')
        sub = (parts.shift() || '').toLowerCase()
        rest = parts.join(' ')
    }

    if (!sub || !['add', 'get', 'list', 'del'].includes(sub)) {
        return m.reply(
            `📦 *sɴɪᴘᴘᴇᴛ ᴘʟᴜɢɪɴ* 🎤\n\n` +
            `> ${m.prefix}snippet add <nama> | <kode>  (bisa sambil reply gambar)\n` +
            `> ${m.prefix}snippet get <nomor|nama>\n` +
            `> ${m.prefix}snippet list\n` +
            `> ${m.prefix}snippet del <nomor|nama>`
        )
    }

    await m.react('🕕')

    try {
        const snippets = getSnippets(db)

        if (sub === 'add') {
            const [name, ...contentParts] = rest.split('|')
            const key = (name || '').trim()
            const content = contentParts.join('|').trim()

            if (!key || !content) {
                await m.react('❌')
                return m.reply(`❌ Format salah.\n\nContoh:\n${m.prefix}snippet add fixSticker | const x = sharp(buf, { animated: true });`)
            }

            let mediaPath = snippets[key]?.media && fs.existsSync(snippets[key].media) ? snippets[key].media : null

            if (m.quoted && m.quoted.type === 'imageMessage' && m.quoted.isMedia) {
                try {
                    const buffer = await m.quoted.download()
                    const fileName = `${key.replace(/[^a-z0-9_-]/gi, '_')}_${Date.now()}.jpg`
                    const filePath = path.join(MEDIA_DIR, fileName)
                    fs.writeFileSync(filePath, buffer)
                    if (mediaPath && mediaPath !== filePath) {
                        try { fs.unlinkSync(mediaPath) } catch {}
                    }
                    mediaPath = filePath
                } catch (mediaErr) {
                    console.error('[snippet] Gagal download media:', mediaErr)
                }
            }

            snippets[key] = {
                content,
                media: mediaPath,
                savedAt: new Date().toISOString(),
                savedBy: m.sender,
            }
            saveSnippets(db, snippets)
            await m.react('✅')
            return m.reply(`✅ *Yatta~* Snippet "*${key}*" tersimpan.${mediaPath ? ' 🖼️ (dengan gambar)' : ''} ✨`)
        }

        if (sub === 'get') {
            const key = resolveKey(rest, snippets)
            if (!key) {
                await m.react('❌')
                return m.reply(`❌ *Ehh~* Snippet "*${rest.trim()}*" tidak ditemukan~ 🥺`)
            }
            const snip = snippets[key]
            const idx = Object.keys(snippets).indexOf(key) + 1

            // 1️⃣ PROSES dulu gambarnya: upload buffer ke Catbox, tunggu sampai dapet URL publik
            let imageUrl = null
            if (snip.media && fs.existsSync(snip.media)) {
                try {
                    imageUrl = await uploadToCatbox(fs.readFileSync(snip.media), `${key}.jpg`)
                } catch (uploadErr) {
                    console.error('[snippet] Gagal upload media ke Catbox:', uploadErr)
                }
            }

            await m.react('✅')

            // 2️⃣ Baru setelah URL siap, rakit & kirim pesan gabungan title + table + image + code
            const rich = new AIRich(sock)
                .addText(`📌 *${key}*`)
                .addTable([
                    ['Field', 'Value'],
                    ['Nomor', String(idx)],
                    ['Nama', key],
                    ['Disimpan', new Date(snip.savedAt).toLocaleString('id-ID')],
                    ['Media', snip.media ? 'Ada 🖼️' : 'Tidak ada'],
                ])

            if (imageUrl) {
                rich.addImage(imageUrl)
            }

            rich.addCode('javascript', snip.content)

            return rich.send(m.chat, { quoted: m })
        }

        if (sub === 'list') {
            const keys = Object.keys(snippets)
            await m.react('✅')
            if (!keys.length) return m.reply('📭 Belum ada snippet tersimpan.')

            const rows = [
                ['No', 'Nama', 'Media', 'Disimpan', 'Panjang Kode'],
                ...keys.map((k, i) => [
                    String(i + 1),
                    k,
                    snippets[k].media ? '🖼️' : '-',
                    new Date(snippets[k].savedAt).toLocaleDateString('id-ID'),
                    `${snippets[k].content.length} char`,
                ]),
            ]

            return new AIRich(sock)
                .addText(`📋 *Daftar Snippet* (${keys.length})`)
                .addTable(rows)
                .addTip(`Gunakan ${m.prefix}snippet get <nomor|nama> untuk lihat isinya`)
                .send(m.chat, { quoted: m })
        }

        if (sub === 'del') {
            const key = resolveKey(rest, snippets)
            if (!key) {
                await m.react('❌')
                return m.reply(`❌ *Ehh~* Snippet "*${rest.trim()}*" tidak ditemukan~ 🥺`)
            }
            if (snippets[key].media) {
                try { fs.unlinkSync(snippets[key].media) } catch {}
            }
            delete snippets[key]
            saveSnippets(db, snippets)
            await m.react('✅')
            return m.reply(`🗑️ Snippet "*${key}*" dihapus.`)
        }
    } catch (error) {
        console.error('[snippet] Error:', error)
        await m.react('❌')
        return m.reply(`❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ*\n\n> ${error.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}