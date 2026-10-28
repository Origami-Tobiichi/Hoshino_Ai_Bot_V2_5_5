const { getDatabase } = require('../../src/lib/database')
const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: 'broadcast',
    alias: ['bc', 'bcgc', 'bcall', 'bcuser', 'bcprem', 'stopbc'],
    category: 'owner',
    description: 'Broadcast pesan ke semua grup / user / premium',
    usage: '.bc <pesan> | .bcgc <pesan> | .bcuser <pesan> | .bcprem <pesan>',
    example: '.bc Halo semua! Bot update ya~',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

// State untuk stop broadcast
const bcState = {
    running: false,
    shouldStop: false,
    progress: 0,
    total: 0,
    type: ''
}

const AI = {
    ok:      (msg) => `✨ *${msg}*\n\n> Ai seneng bisa bantu kamu~ 💖`,
    err:     (msg) => `💔 *Aduh~ Ada yang salah nih!*\n\n> ${msg}\n\n> Jangan nyerah ya, Ai tetap di sini! ✨`,
    warn:    (msg) => `🌸 *Hmm~ Perhatiin dulu ya!*\n\n> ${msg}`,
    loading: (msg) => `⏳ *Sabar ya~*\n\n> ${msg} 💫`,
}

const delay = ms => new Promise(res => setTimeout(res, ms))

async function handler(m, { sock }) {
    const db = getDatabase()
    const cmd = m.command.toLowerCase()

    // ── STOP BROADCAST ───────────────────────────────────────────────────────
    if (cmd === 'stopbc') {
        if (!bcState.running) {
            return m.reply(AI.warn('Tidak ada broadcast yang sedang berjalan~'))
        }
        bcState.shouldStop = true
        m.react('🛑')
        return m.reply(
            `🛑 *ʙʀᴏᴀᴅᴄᴀsᴛ ᴅɪsᴛᴏᴘ*\n\n` +
            `> Progress: *${bcState.progress}/${bcState.total}* terkirim\n` +
            `> Type: *${bcState.type}*\n\n` +
            `> Ai udah hentiin broadcast-nya ya~ 🌸`
        )
    }

    // ── GUARD: jangan jalankan 2 BC sekaligus ────────────────────────────────
    if (bcState.running) {
        return m.reply(
            AI.warn(
                `Broadcast sedang berjalan nih~\n\n` +
                `> Progress: *${bcState.progress}/${bcState.total}*\n` +
                `> Type: *${bcState.type}*\n\n` +
                `> Gunakan \`${m.prefix}stopbc\` untuk menghentikan`
            )
        )
    }

    // ── PARSE TARGET ─────────────────────────────────────────────────────────
    // bcgc  → hanya grup
    // bcuser → hanya user (private/terdaftar di db)
    // bcprem → hanya premium
    // bc / bcall → semua grup + user
    const isGcOnly   = cmd === 'bcgc'
    const isUserOnly = cmd === 'bcuser'
    const isPremOnly = cmd === 'bcprem'
    const isAll      = ['bc', 'bcall'].includes(cmd)

    // ── AMBIL ISI PESAN ──────────────────────────────────────────────────────
    const text = m.text?.trim() || ''
    const hasMedia = !!(m.quoted?.isImage || m.quoted?.isVideo || m.quoted?.isDocument)
    const hasCaption = !!text

    if (!text && !hasMedia) {
        return m.reply(
            `📣 *ʙʀᴏᴀᴅᴄᴀsᴛ ᴍᴇɴᴜ*\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
            `┃ ◦ \`${m.prefix}bc <pesan>\` — Semua (GC+User)\n` +
            `┃ ◦ \`${m.prefix}bcgc <pesan>\` — Hanya Grup\n` +
            `┃ ◦ \`${m.prefix}bcuser <pesan>\` — Hanya User\n` +
            `┃ ◦ \`${m.prefix}bcprem <pesan>\` — Hanya Premium\n` +
            `┃ ◦ Reply media + caption juga bisa~\n` +
            `╰┈┈⬡\n\n` +
            `╭┈┈⬡「 ⚙️ *ᴋᴏɴᴛʀᴏʟ* 」\n` +
            `┃ ◦ \`${m.prefix}stopbc\` — Stop broadcast aktif\n` +
            `╰┈┈⬡\n\n` +
            `> _Delay antar pesan: 2 detik biar aman ya~ 🌸_`
        )
    }

    // ── KUMPULKAN TARGET JIDS ─────────────────────────────────────────────────
    let targets = []

    try {
        if (isGcOnly || isAll) {
            // Ambil semua grup dari sock
            const chats = await sock.groupFetchAllParticipating()
            const gcJids = Object.keys(chats || {})
            targets.push(...gcJids.map(jid => ({ jid, label: 'grup' })))
        }

        if (isUserOnly || isAll) {
            const users = db.data.users || {}
            const userJids = Object.keys(users).filter(j => j.endsWith('@s.whatsapp.net'))
            targets.push(...userJids.map(jid => ({ jid, label: 'user' })))
        }

        if (isPremOnly) {
            const prems = db.data.premium || []
            for (const p of prems) {
                const num = typeof p === 'string' ? p : p.id
                if (num) targets.push({ jid: num + '@s.whatsapp.net', label: 'premium' })
            }
        }
    } catch (e) {
        return m.reply(AI.err(`Gagal kumpulkan target: ${e.message}`))
    }

    // Deduplicate
    const seen = new Set()
    targets = targets.filter(t => {
        if (seen.has(t.jid)) return false
        seen.add(t.jid)
        return true
    })

    if (targets.length === 0) {
        return m.reply(AI.warn(`Tidak ada target ditemukan untuk tipe *${cmd}* nih~`))
    }

    // ── KONFIRMASI AWAL ───────────────────────────────────────────────────────
    m.react('📣')
    await m.reply(
        `📣 *ᴍᴜʟᴀɪ ʙʀᴏᴀᴅᴄᴀsᴛ~* 🌸\n\n` +
        `╭┈┈⬡「 📋 *ɪɴꜰᴏ* 」\n` +
        `┃ 🎯 ᴛᴀʀɢᴇᴛ: *${targets.length}* tujuan\n` +
        `┃ 📝 ᴛɪᴘᴇ: *${cmd.toUpperCase()}*\n` +
        `┃ ⏱️ ᴅᴇʟᴀʏ: *2 detik/pesan*\n` +
        `┃ ⏳ ᴇsᴛ: *~${Math.ceil(targets.length * 2 / 60)} menit*\n` +
        `╰┈┈⬡\n\n` +
        `> _Ketik \`${m.prefix}stopbc\` untuk berhenti ya~ 💖_`
    )

    // ── BUILD PESAN ───────────────────────────────────────────────────────────
    const footer = `\n\n_— 🌸 Hoshino Ai Bot_`
    const fullText = text + footer

    // Download media kalau ada
    let mediaBuffer = null
    let mediaMimetype = null
    if (hasMedia) {
        try {
            mediaBuffer = await m.quoted.download()
            mediaMimetype = m.quoted.mimetype || ''
        } catch {}
    }

    // ── LOOP BROADCAST ────────────────────────────────────────────────────────
    bcState.running    = true
    bcState.shouldStop = false
    bcState.progress   = 0
    bcState.total      = targets.length
    bcState.type       = cmd

    let successCount = 0
    let failCount    = 0

    for (const { jid, label } of targets) {
        if (bcState.shouldStop) break

        try {
            if (mediaBuffer) {
                const isVideo = mediaMimetype.startsWith('video/')
                const isDoc   = mediaMimetype.startsWith('application/')

                if (isVideo) {
                    await sock.sendMessage(jid, {
                        video: mediaBuffer,
                        caption: hasCaption ? fullText : footer.trim(),
                        mimetype: mediaMimetype
                    })
                } else if (isDoc) {
                    await sock.sendMessage(jid, {
                        document: mediaBuffer,
                        caption: hasCaption ? fullText : footer.trim(),
                        mimetype: mediaMimetype,
                        fileName: m.quoted.fileName || 'file'
                    })
                } else {
                    // default image
                    await sock.sendMessage(jid, {
                        image: mediaBuffer,
                        caption: hasCaption ? fullText : footer.trim()
                    })
                }
            } else {
                await sock.sendMessage(jid, { text: fullText })
            }
            successCount++
        } catch {
            failCount++
        }

        bcState.progress++

        // Progress update setiap 10 pesan
        if (bcState.progress % 10 === 0) {
            await m.reply(
                `📊 *ᴘʀᴏɢʀᴇss ʙᴄ*\n\n` +
                `> ✅ Terkirim: *${successCount}*\n` +
                `> ❌ Gagal: *${failCount}*\n` +
                `> 📦 Total: *${bcState.progress}/${bcState.total}*\n\n` +
                `> _Sabar ya~ Ai lagi kerja keras! 💪✨_`
            )
        }

        await delay(2000)
    }

    // ── SELESAI ───────────────────────────────────────────────────────────────
    bcState.running    = false
    bcState.shouldStop = false

    const stopped = bcState.shouldStop
    m.react('✅')

    return m.reply(
        `${stopped ? '🛑' : '✅'} *ʙʀᴏᴀᴅᴄᴀsᴛ ${stopped ? 'ᴅɪsᴛᴏᴘ' : 'sᴇʟᴇsᴀɪ'}~* 🌸\n\n` +
        `╭┈┈⬡「 📊 *ʀᴇᴋᴀᴘ* 」\n` +
        `┃ ✅ ᴛᴇʀᴋɪʀɪᴍ: *${successCount}*\n` +
        `┃ ❌ ɢᴀɢᴀʟ: *${failCount}*\n` +
        `┃ 📦 ᴛᴏᴛᴀʟ: *${bcState.progress}/${targets.length}*\n` +
        `┃ 📝 ᴛɪᴘᴇ: *${cmd.toUpperCase()}*\n` +
        `╰┈┈⬡\n\n` +
        `> _Ai udah broadcast semuanya ya senpai~ 💖_`
    )
}

module.exports = {
    config: pluginConfig,
    handler
}