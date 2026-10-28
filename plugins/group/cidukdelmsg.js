const { getDatabase } = require('../../src/lib/database')
const config = require('../../config')
const axios = require('axios')
const FormData = require('form-data')
const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')

// ─── Cache pesan ──────────────────────────────────────────────────────────────
const msgCache = new Map()

// ─── Cache buffer stiker (url → Buffer) ──────────────────────────────────────
// Download sekali, selanjutnya pakai dari RAM — hilang kalau bot restart
const stikerBufferCache = new Map()

// ─── Path DB stiker custom ────────────────────────────────────────────────────
const STIKER_DB_PATH = path.resolve('./database/other/cidukdelmsg.json')

// ─── Helper: baca / tulis DB stiker ──────────────────────────────────────────
// Struktur JSON:
// {
//   "groups": {
//     "120363xxxx@g.us": ["https://url1", "https://url2"],
//     "120363yyyy@g.us": ["https://url3"]
//   }
// }

function loadStikerDB() {
    try {
        if (!fs.existsSync(STIKER_DB_PATH)) {
            fs.mkdirSync(path.dirname(STIKER_DB_PATH), { recursive: true })
            fs.writeFileSync(STIKER_DB_PATH, JSON.stringify({ groups: {} }, null, 2))
            return { groups: {} }
        }
        const raw = JSON.parse(fs.readFileSync(STIKER_DB_PATH, 'utf8'))
        if (!raw.groups) raw.groups = {}
        return raw
    } catch {
        return { groups: {} }
    }
}

function saveStikerDB(data) {
    fs.mkdirSync(path.dirname(STIKER_DB_PATH), { recursive: true })
    fs.writeFileSync(STIKER_DB_PATH, JSON.stringify(data, null, 2))
}

// ─── Helper: ambil URL stiker random untuk grup tertentu ─────────────────────
// Return null kalau grup belum punya stiker custom
function getRandomStikerUrl(groupId) {
    const db = loadStikerDB()
    const list = db.groups?.[groupId] || []
    if (list.length === 0) return null
    return list[Math.floor(Math.random() * list.length)]
}

// ─── Helper: hapus stiker dari grup tertentu ─────────────────────────────────
// indexes: array of 1-based index (dari user), atau 'all'
function deleteStikerFromGroup(groupId, indexes) {
    const db = loadStikerDB()
    const list = db.groups?.[groupId] || []
    if (list.length === 0) return { ok: false, reason: 'empty' }

    if (indexes === 'all') {
        // Hapus semua buffer cache untuk URL grup ini
        for (const url of list) stikerBufferCache.delete(url)
        db.groups[groupId] = []
        saveStikerDB(db)
        return { ok: true, deleted: list.length, remaining: 0 }
    }

    // Validasi semua index
    const invalid = indexes.filter(i => i < 1 || i > list.length)
    if (invalid.length > 0) return { ok: false, reason: 'invalid', invalid }

    // Hapus dari belakang supaya index tidak geser
    const sorted = [...new Set(indexes)].sort((a, b) => b - a)
    for (const i of sorted) {
        stikerBufferCache.delete(list[i - 1]) // hapus cache URL yang dihapus
        list.splice(i - 1, 1)
    }

    db.groups[groupId] = list
    saveStikerDB(db)
    return { ok: true, deleted: sorted.length, remaining: list.length }
}

// ─── Helper: tambah stiker ke grup tertentu ───────────────────────────────────
function addStikerToGroup(groupId, url) {
    const db = loadStikerDB()
    if (!db.groups[groupId]) db.groups[groupId] = []
    if (db.groups[groupId].includes(url)) return { ok: false, reason: 'duplicate' }
    db.groups[groupId].push(url)
    saveStikerDB(db)
    // Preload buffer baru ke cache (opsional, akan di-fetch otomatis saat dipakai)
    stikerBufferCache.delete(url) // reset kalau pernah gagal sebelumnya
    return { ok: true, total: db.groups[groupId].length }
}

// ─── Helper: upload buffer ke catbox (fallback litterbox) ────────────────────
async function uploadStikerToHost(buffer, filename = 'sticker.webp') {
    const mime = require('mime-types')
    const contentType = mime.lookup(filename) || 'image/webp'

    // ── 1. Catbox (permanent) ────────────────────────────────────────────────
    try {
        const form = new FormData()
        form.append('reqtype', 'fileupload')
        form.append('fileToUpload', buffer, { filename, contentType })
        const res = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000
        })
        const url = await res.text()
        if (url.startsWith('http')) return url
    } catch (e) { console.log('[CidukDelMsg] Catbox gagal:', e.message) }

    // ── 2. Litterbox (72h) ───────────────────────────────────────────────────
    try {
        const form = new FormData()
        form.append('reqtype', 'fileupload')
        form.append('time', '72h')
        form.append('fileToUpload', buffer, { filename, contentType })
        const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
            method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000
        })
        const url = await res.text()
        if (url.startsWith('http')) return url
    } catch (e) { console.log('[CidukDelMsg] Litterbox gagal:', e.message) }

    // ── 3. Qu.ax (permanent) ────────────────────────────────────────────────
    try {
        const form = new FormData()
        form.append('files[]', buffer, { filename, contentType })
        const res = await fetch('https://qu.ax/upload.php', {
            method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000
        })
        const data = await res.json()
        if (data?.files?.[0]?.url) return data.files[0].url
    } catch (e) { console.log('[CidukDelMsg] Qu.ax gagal:', e.message) }

    // ── 4. TmpFiles (60 menit) ───────────────────────────────────────────────
    try {
        const form = new FormData()
        form.append('file', buffer, { filename, contentType })
        const res = await fetch('https://tmpfiles.org/api/v1/upload', {
            method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000
        })
        const data = await res.json()
        if (data?.data?.url) {
            const idMatch = data.data.url.match(/\/(\d+)(?:\/|$)/)
            return idMatch
                ? `https://tmpfiles.org/dl/${idMatch[1]}/${filename}`
                : data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
        }
    } catch (e) { console.log('[CidukDelMsg] TmpFiles gagal:', e.message) }

    throw new Error('Semua host upload gagal')
}

// ─── Plugin config ────────────────────────────────────────────────────────────
const pluginConfig = {
    name: 'cidukdelmsg',
    alias: ['ciduk'],
    category: 'group',
    description: 'Ciduk user yang hapus pesan! Bot kirim stiker kalau ada pesan dihapus di grup.',
    usage: '.cidukdelmsg <on/off/add/list>',
    example: '.cidukdelmsg on',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    isAdmin: true,
    cooldown: 3,
    energi: 1,
    isEnabled: true
}

// ─── Handler utama ────────────────────────────────────────────────────────────
async function handler(m, { sock }) {
    try {
        const db = getDatabase()
        const groupId = m.chat
        const groupData = db.getGroup(groupId) || {}

        const args = m.body.trim().split(' ')
        const sub  = args[1]?.toLowerCase()
        const sub2 = args[2]?.toLowerCase()

        // ── .cidukdelmsg on/off all → global (owner only) ──────────────────────
        if ((sub === 'on' || sub === 'off') && sub2 === 'all') {
            if (!m.isOwner) {
                return m.reply(config.messages?.ownerOnly || 'Muu~ ini khusus owner aja lho~')
            }

            m.react('🕕')

            try {
                const groups = await sock.groupFetchAllParticipating()
                const groupIds = Object.keys(groups)
                let count = 0

                for (const gid of groupIds) {
                    const gData = db.getGroup(gid) || {}
                    gData.cidukdelmsg = sub === 'on'
                    db.setGroup(gid, gData)
                    count++
                }

                await db.save()
                m.react('✅')

                return m.reply(
                    `😈 *ᴄɪᴅᴜᴋ ᴅᴇʟ ᴍsɢ ɢʟᴏʙᴀʟ ${sub === 'on' ? 'ᴏɴ' : 'ᴏꜰꜰ'}* 💕\n\n` +
                    `> ${sub === 'on' ? '✅ Ai udah aktifkan' : '🌙 Ai udah nonaktifkan'} CidukDelMsg di *${count}* grup!\n` +
                    `> ${sub === 'on' ? 'Nggak ada yang bisa sembunyi-sembunyi hapus pesan sekarang~ 👁️' : 'Ai istirahat dulu dari jaga-jaga ya~ 🌸'}`
                )
            } catch (err) {
                m.react('❌')
                return m.reply(`❌ Ada yang salah nih~ Error: ${err.message}`)
            }
        }

        // ── .cidukdelmsg on → per grup ──────────────────────────────────────────
        if (sub === 'on') {
            if (groupData.cidukdelmsg) {
                return m.reply(
                    `👁️ *ᴄɪᴅᴜᴋ ᴅᴇʟ ᴍsɢ ᴜᴅᴀʜ ᴀᴋᴛɪꜰ~*\n\n` +
                    `> Status: *✅ ON*\n` +
                    `> Ai udah jaga dari tadi lho~\n\n` +
                    `_Gunakan \`${m.prefix}cidukdelmsg off\` kalau mau dimatiin_`
                )
            }

            groupData.cidukdelmsg = true
            db.setGroup(groupId, groupData)
            await db.save()

            return m.reply(
                `✨ *Siap! Aku Ai, sekarang lagi on duty~* ✨\n\n` +
                `Kalau ada yang berani hapus pesan di sini...\n` +
                `aku yang pertama tau, dan aku *nggak akan diem* 😈💕\n\n` +
                `> Semua kebohongan pasti ketauan~ termasuk pesan yang dihapus!`
            )
        }

        // ── .cidukdelmsg off → per grup ─────────────────────────────────────────
        if (sub === 'off') {
            if (!groupData.cidukdelmsg) {
                return m.reply(
                    `👁️ *ᴄɪᴅᴜᴋ ᴅᴇʟ ᴍsɢ ᴜᴅᴀʜ ᴍᴀᴛɪ~*\n\n` +
                    `> Status: *❌ OFF*\n` +
                    `> Ai emang udah istirahat di sini~\n\n` +
                    `_Gunakan \`${m.prefix}cidukdelmsg on\` kalau mau dihidupin lagi_`
                )
            }

            groupData.cidukdelmsg = false
            db.setGroup(groupId, groupData)
            await db.save()

            return m.reply(
                `💤 *Oke oke, aku istirahat dulu ya~*\n\n` +
                `Tapi jangan salah sangka lho...\n` +
                `Ai selalu ingat segalanya~ 🌟\n\n` +
                `> Ketik \`${m.prefix}cidukdelmsg on\` kalau mau aku balik jaga~`
            )
        }

        // ── .cidukdelmsg add ────────────────────────────────────────────────────
        if (sub === 'add') {
            const isAll = sub2 === 'all'

            if (isAll && !m.isOwner) {
                return m.reply('Muu~ `.cidukdelmsg add all` khusus owner aja ya~ 👑')
            }
            if (!m.isOwner && !m.isAdmin) {
                return m.reply('Muu~ ini khusus admin/owner~ 😤')
            }

            m.react('🕕')

            let stikerUrl = null

            // Cek URL di argumen
            const urlArg = args.slice(isAll ? 3 : 2).find(a => a.startsWith('http'))
            if (urlArg) {
                stikerUrl = urlArg
            }

            // Cek reply media
            const quoted = m.quoted
            if (!stikerUrl && quoted) {
                const qType = quoted.type

                if (qType === 'stickerMessage') {
                    try {
                        const buf = await quoted.download()
                        stikerUrl = await uploadStikerToHost(buf, 'sticker.webp')
                    } catch (e) {
                        m.react('❌')
                        return m.reply(`❌ *Gomen ne~* Gagal upload stiker: ${e.message} 🥺`)
                    }

                } else if (qType === 'imageMessage' || qType === 'videoMessage') {
                    try {
                        const buf = await quoted.download()
                        const ext = qType === 'videoMessage' ? 'mp4' : 'jpg'
                        stikerUrl = await uploadStikerToHost(buf, `sticker.${ext}`)
                    } catch (e) {
                        m.react('❌')
                        return m.reply(`❌ *Gomen ne~* Gagal proses media: ${e.message} 🥺`)
                    }

                } else {
                    m.react('❌')
                    return m.reply(
                        `❌ *Format tidak didukung!*\n\n` +
                        `Reply dengan:\n` +
                        `> 🖼️ Gambar / Video → otomatis diupload\n` +
                        `> 💟 Stiker → langsung disimpan\n` +
                        `> 🔗 URL → \`${m.prefix}cidukdelmsg add https://...\``
                    )
                }
            }

            if (!stikerUrl) {
                m.react('❌')
                return m.reply(
                    `❓ *Cara pakai:*\n\n` +
                    `> Reply gambar/video/stiker + \`${m.prefix}cidukdelmsg add\`\n` +
                    `> Atau: \`${m.prefix}cidukdelmsg add https://...\`\n` +
                    `> Owner semua grup: \`${m.prefix}cidukdelmsg add all https://...\``
                )
            }

            // Simpan ke DB
            if (isAll) {
                let addedCount = 0
                let skipCount  = 0

                try {
                    const allGroups = await sock.groupFetchAllParticipating()
                    const allGroupIds = Object.keys(allGroups)

                    for (const gid of allGroupIds) {
                        const result = addStikerToGroup(gid, stikerUrl)
                        if (result.ok) addedCount++
                        else skipCount++
                    }

                    m.react('✅')
                    return m.reply(
                        `✨ *Stiker berhasil ditambah ke semua grup!* 💕\n\n` +
                        `> URL: \`${stikerUrl}\`\n` +
                        `> Berhasil: *${addedCount}* grup\n` +
                        `> Sudah ada: *${skipCount}* grup\n\n` +
                        `Ai bakal pakai stiker ini di semua grup~ 🌟`
                    )
                } catch (err) {
                    m.react('❌')
                    return m.reply(`❌ *Gomen ne~* Gagal fetch grup: ${err.message} 🥺`)
                }

            } else {
                const result = addStikerToGroup(groupId, stikerUrl)

                if (!result.ok) {
                    m.react('❌')
                    return m.reply(`⚠️ URL stiker itu udah ada di grup ini lho~ 👁️\n\n> \`${stikerUrl}\``)
                }

                m.react('✅')
                return m.reply(
                    `✨ *Stiker berhasil ditambah ke grup ini!* 💕\n\n` +
                    `> URL: \`${stikerUrl}\`\n` +
                    `> Total stiker grup ini: *${result.total}*\n\n` +
                    `Ai bakal pakai stiker baru ini di sini~ 🌟`
                )
            }
        }

        // ── .cidukdelmsg del ────────────────────────────────────────────────────
        // Admin  → del index / del 1/2/3 (grup sendiri saja)
        // Owner  → del index / del 1/2/3 (grup sendiri) / del all (grup sendiri)
        if (sub === 'del') {
            if (!m.isOwner && !m.isAdmin) {
                return m.reply('Muu~ ini khusus admin/owner~ 😤')
            }

            const delArg = args[2]?.toLowerCase()

            if (!delArg) {
                m.react('❌')
                return m.reply(
                    `❓ *Cara pakai:*\n\n` +
                    `> \`${m.prefix}cidukdelmsg del 1\` — hapus stiker ke-1\n` +
                    `> \`${m.prefix}cidukdelmsg del 1/2/3\` — hapus beberapa sekaligus\n` +
                    (m.isOwner ? `> \`${m.prefix}cidukdelmsg del all\` — hapus semua (owner)\n` : '') +
                    `\n_Lihat nomor stiker dengan \`${m.prefix}cidukdelmsg list\`_`
                )
            }

            // del all → owner only
            if (delArg === 'all') {
                if (!m.isOwner) {
                    return m.reply('Muu~ \`.cidukdelmsg del all\` khusus owner aja ya~ 👑')
                }

                const result = deleteStikerFromGroup(groupId, 'all')
                if (!result.ok && result.reason === 'empty') {
                    m.react('❌')
                    return m.reply(`⚠️ Grup ini belum punya stiker custom nih~`)
                }

                m.react('✅')
                return m.reply(
                    `🗑️ *Semua stiker grup ini dihapus!*\n\n` +
                    `> *${result.deleted}* stiker berhasil dihapus~\n\n` +
                    `_Tambah lagi dengan \`${m.prefix}cidukdelmsg add\`_`
                )
            }

            // del 1 atau del 1/2/3
            const rawIndexes = delArg.split('/').map(s => parseInt(s.trim()))
            const isValidNumbers = rawIndexes.every(n => !isNaN(n))

            if (!isValidNumbers) {
                m.react('❌')
                return m.reply(`❌ Format salah~ Gunakan angka, contoh: \`${m.prefix}cidukdelmsg del 1\` atau \`del 1/2/3\``)
            }

            const result = deleteStikerFromGroup(groupId, rawIndexes)

            if (!result.ok && result.reason === 'empty') {
                m.react('❌')
                return m.reply(`⚠️ Grup ini belum punya stiker custom nih~`)
            }

            if (!result.ok && result.reason === 'invalid') {
                m.react('❌')
                const stikerDB = loadStikerDB()
                const total = (stikerDB.groups?.[groupId] || []).length
                return m.reply(
                    `❌ *Nomor tidak valid!*\n\n` +
                    `> Nomor yang salah: *${result.invalid.join(', ')}*\n` +
                    `> Range yang tersedia: *1 - ${total}*\n\n` +
                    `_Cek daftar dengan \`${m.prefix}cidukdelmsg list\`_`
                )
            }

            m.react('✅')
            return m.reply(
                `🗑️ *Stiker berhasil dihapus!*\n\n` +
                `> Dihapus: *${result.deleted}* stiker\n` +
                `> Sisa: *${result.remaining}* stiker\n\n` +
                `_Lihat sisa stiker dengan \`${m.prefix}cidukdelmsg list\`_`
            )
        }

        // ── .cidukdelmsg list ────────────────────────────────────────────────────
        if (sub === 'list') {
            const stikerDB = loadStikerDB()

            // list all → owner only, tampilkan semua grup
            if (sub2 === 'all') {
                if (!m.isOwner) {
                    return m.reply('Muu~ `.cidukdelmsg list all` khusus owner aja ya~ 👑')
                }

                const groups = stikerDB.groups || {}
                const groupIds = Object.keys(groups).filter(gid => groups[gid]?.length > 0)

                if (groupIds.length === 0) {
                    return m.reply(
                        `📋 *Daftar Stiker Ciduk — Semua Grup*\n\n` +
                        `> Belum ada grup yang punya stiker custom nih~\n\n` +
                        `_Tambah dengan \`${m.prefix}cidukdelmsg add\`_`
                    )
                }

                let msg = `📋 *Daftar Stiker Ciduk — Semua Grup* (${groupIds.length} grup)\n`
                for (const gid of groupIds) {
                    const gList = groups[gid]
                    msg += `\n┌ *${gid}* (${gList.length})\n`
                    msg += gList.map((url, i) => `│ ${i + 1}. ${url}`).join('\n')
                    msg += `\n└──`
                }

                return m.reply(msg)
            }

            // list → grup ini saja
            const list = stikerDB.groups?.[groupId] || []

            if (list.length === 0) {
                return m.reply(
                    `📋 *Daftar Stiker Ciduk — Grup Ini*\n\n` +
                    `> Belum ada stiker custom nih~\n` +
                    `> Tambah dulu dengan \`${m.prefix}cidukdelmsg add\`\n\n` +
                    `_Reply gambar/video/stiker atau langsung kasih URL~_`
                )
            }

            const listStr = list.map((url, i) => `> ${i + 1}. ${url}`).join('\n')
            return m.reply(
                `📋 *Daftar Stiker Ciduk — Grup Ini* (${list.length})\n\n` +
                `${listStr}\n\n` +
                `_Stiker dipilih acak saat ada yang hapus pesan~_`
            )
        }

        // ── .cidukdelmsg → info ──────────────────────────────────────────────────
        const stikerDB = loadStikerDB()
        const stikerCount = (stikerDB.groups?.[groupId] || []).length

        return m.reply(
            `╭─「 ✨ *CIDUK DEL MSG* ✨ 」\n` +
            `│\n` +
            `│ Haii~ aku Ai, idol dengan kebohongan sejuta watt~ 💫\n` +
            `│ Tapi satu hal yang aku *nggak* suka...\n` +
            `│ orang yang sembunyi-sembunyi hapus pesan! 👁️\n` +
            `│\n` +
            `│ Status : *${groupData.cidukdelmsg ? '✅ Lagi aktif dong~' : '❌ Lagi tidur nih~'}*\n` +
            `│ Stiker : *${stikerCount > 0 ? stikerCount + ' custom' : 'belum ada, tambah dulu~'}*\n` +
            `│\n` +
            `│ *.cidukdelmsg on* — Aktifkan (admin)\n` +
            `│ *.cidukdelmsg off* — Nonaktifkan (admin)\n` +
            `│ *.cidukdelmsg on all* — Global ON (owner)\n` +
            `│ *.cidukdelmsg off all* — Global OFF (owner)\n` +
            `│\n` +
            `│ *.cidukdelmsg add* — Tambah stiker grup ini\n` +
            `│   (reply gambar/video/stiker atau + url)\n` +
            `│ *.cidukdelmsg add all* — Tambah ke semua grup (owner)\n` +
            `│ *.cidukdelmsg del 1* — Hapus stiker ke-1\n` +
            `│ *.cidukdelmsg del 1/2/3* — Hapus beberapa sekaligus\n` +
            `│ *.cidukdelmsg del all* — Hapus semua stiker (owner)\n` +
            `│ *.cidukdelmsg list* — Lihat daftar stiker grup ini\n` +
            `│ *.cidukdelmsg list all* — Lihat stiker semua grup (owner)\n` +
            `╰──────────────────`
        )

    } catch (error) {
        console.error('CidukDelMsg Plugin Error:', error)
        await m.reply(
            `💔 *Aduh, ada yang salah nih~*\n\n` +
            `Bahkan idol pun bisa error, hehe~\n` +
            `> ${error.message}`
        )
    }
}

// ─── Cache pesan masuk ────────────────────────────────────────────────────────
function cacheMessage(m) {
    try {
        if (!m?.key?.id || !m?.chat) return
        const groupId = m.chat
        if (!groupId.endsWith('@g.us')) return

        if (!msgCache.has(groupId)) {
            msgCache.set(groupId, new Map())
        }

        const groupCache = msgCache.get(groupId)
        groupCache.set(m.key.id, {
            sender:    m.key.participant || m.sender || '',
            pushName:  m.pushName || 'User',
            body:      m.body || '',
            type:      m.type || '',
            key:       m.key,
            message:   m.message || null,
            timestamp: Date.now()
        })

        if (groupCache.size > 100) {
            const firstKey = groupCache.keys().next().value
            groupCache.delete(firstKey)
        }
    } catch {}
}

// ─── Handler deteksi pesan dihapus ───────────────────────────────────────────
async function handleCidukDelete(update, sock, db) {
    try {
        const key = update.key || update.update?.key
        if (!key?.remoteJid) return
        if (!key.remoteJid.endsWith('@g.us')) return

        const stubType = update.update?.messageStubType ?? update.messageStubType
        const isRevoke = stubType === 1 || stubType === 'REVOKE'
        if (!isRevoke) return

        const groupId   = key.remoteJid
        const freshDb   = db || getDatabase()
        const groupData = freshDb.getGroup(groupId) || {}
        if (!groupData.cidukdelmsg) return

        const groupCache = msgCache.get(groupId)
        const cachedMsg  = groupCache?.get(key.id)

        // Ambil stiker random milik grup ini
        const stikerUrl = getRandomStikerUrl(groupId)

        // Belum ada stiker custom → kirim pesan teks saja
        if (!stikerUrl) {
            await sock.sendMessage(groupId, {
                text: `👁️ *Ada yang hapus pesan nih~*\n\n> Tapi Ai belum punya stiker buat ngeciduk di grup ini!\n> Admin, tambahin dulu yuk~ \`.cidukdelmsg add\``
            }, {
                quoted: cachedMsg?.key ? {
                    key: cachedMsg.key,
                    message: cachedMsg.message || { conversation: cachedMsg.body || '📩 Pesan' }
                } : undefined
            })
            groupCache?.delete(key.id)
            return
        }

        // Download buffer stiker (pakai cache kalau sudah pernah didownload)
        let stikerBuffer = stikerBufferCache.get(stikerUrl)
        if (!stikerBuffer) {
            const stikerResp = await axios.get(stikerUrl, {
                responseType: 'arraybuffer',
                timeout: 10000
            })
            stikerBuffer = Buffer.from(stikerResp.data)
            stikerBufferCache.set(stikerUrl, stikerBuffer)
        }

        // Kirim stiker reply ke pesan yang dihapus
        if (cachedMsg?.key) {
            await sock.sendMessage(groupId, { sticker: stikerBuffer }, {
                quoted: {
                    key: cachedMsg.key,
                    message: cachedMsg.message || { conversation: cachedMsg.body || '📩 Pesan' }
                }
            })
        } else {
            await sock.sendMessage(groupId, { sticker: stikerBuffer })
        }

        groupCache?.delete(key.id)

    } catch (error) {
        console.error('CidukDelMsg handleCidukDelete Error:', error.message)
    }
}

module.exports = {
    config: pluginConfig,
    handler,
    cacheMessage,
    handleCidukDelete
}