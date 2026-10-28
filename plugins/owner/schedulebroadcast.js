const moment = require('moment-timezone')
const {
    addScheduledBroadcast,
    cancelScheduledBroadcast,
    getScheduledBroadcasts,
} = require('../../src/lib/broadcastScheduler')

const pluginConfig = {
    name: 'schedulebroadcast',
    alias: ['scbc', 'bcsched', 'jadwalbc'],
    category: 'owner',
    description: 'Jadwalkan broadcast ke semua grup/user di tanggal & jam tertentu',
    usage: '.schedulebroadcast add <DD/MM HH:MM | HH:MM repeat> <grup/user/all> <pesan>',
    example: '.scbc add 15/06 08:00 grup Selamat pagi semua! Jangan lupa event hari ini~',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

const TZ = 'Asia/Jakarta'

function helpText(prefix) {
    return `📣 *sᴄʜᴇᴅᴜʟᴇ ʙʀᴏᴀᴅᴄᴀsᴛ*\n\n` +
        `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
        `┃ \`${prefix}scbc add <DD/MM HH:MM> <target> <pesan>\`\n` +
        `┃ → Jadwal sekali, di tanggal & jam tertentu\n\n` +
        `┃ \`${prefix}scbc add <HH:MM> repeat <target> <pesan>\`\n` +
        `┃ → Jadwal harian (berulang tiap hari jam segitu)\n\n` +
        `┃ \`${prefix}scbc list\` — lihat semua jadwal\n` +
        `┃ \`${prefix}scbc del <id>\` — hapus jadwal\n` +
        `╰┈┈⬡\n\n` +
        `*ᴛᴀʀɢᴇᴛ:*\n` +
        `> \`grup\` — semua grup\n` +
        `> \`user\` — semua user terdaftar\n` +
        `> \`all\` — grup + user\n\n` +
        `*ᴄᴏɴᴛᴏʜ:*\n` +
        `> \`${prefix}scbc add 15/06 08:00 grup Halo semua! Besok ada event ya~\`\n` +
        `> \`${prefix}scbc add 08:00 repeat all Selamat pagi semua~ 🌸\`\n\n` +
        `> 💡 Reply media (gambar/video/dokumen) + caption command juga bisa~`
}

const handler = async (m) => {
    const sub = (m.args?.[0] || 'help').toLowerCase()
    const prefix = m.prefix

    // ── .scbc list ─────────────────────────────────────────────────────────────
    if (sub === 'list') {
        const tasks = getScheduledBroadcasts()

        if (tasks.length === 0) {
            return m.reply(`📅 *sᴄʜᴇᴅᴜʟᴇ ʙʀᴏᴀᴅᴄᴀsᴛ*\n\n> Belum ada broadcast yang dijadwalkan~`)
        }

        let txt = `📅 *sᴄʜᴇᴅᴜʟᴇ ʙʀᴏᴀᴅᴄᴀsᴛ* (${tasks.length})\n\n`

        for (const task of tasks) {
            const runAt = moment(task.runAt).tz(TZ)
            txt += `╭┈┈⬡「 🆔 \`${task.id}\` 」\n`
            txt += `┃ 🎯 Target: *${task.targetType}*\n`
            if (task.repeat) {
                txt += `┃ 🔁 Repeat: *Harian* jam ${String(task.hour).padStart(2, '0')}:${String(task.minute).padStart(2, '0')}\n`
            } else {
                txt += `┃ ⏰ Waktu: *${runAt.format('DD/MM/YYYY HH:mm')}* WIB\n`
            }
            txt += `┃ ⏳ Berikutnya: *${runAt.format('DD/MM HH:mm')}*\n`
            txt += `┃ 📨 Sudah jalan: *${task.runCount || 0}x*\n`
            const preview = (task.media ? '[media] ' : '') + (task.text || '').substring(0, 40)
            txt += `┃ 📝 Pesan: ${preview}${(task.text || '').length > 40 ? '...' : ''}\n`
            txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`
        }

        return m.reply(txt.trim())
    }

    // ── .scbc del <id> ─────────────────────────────────────────────────────────
    if (sub === 'del' || sub === 'delete' || sub === 'cancel') {
        const id = m.args[1]
        if (!id) return m.reply(`⚠️ Masukin ID jadwal~\n> \`${prefix}scbc del bcsched_xxx\``)

        const ok = cancelScheduledBroadcast(id)
        if (!ok) return m.reply(`❌ ID \`${id}\` nggak ditemukan~`)

        m.react('🗑️')
        return m.reply(`✅ Jadwal \`${id}\` udah dihapus~ 🌸`)
    }

    // ── .scbc add ──────────────────────────────────────────────────────────────
    if (sub === 'add') {
        const args = m.args.slice(1)

        if (args.length < 3) return m.reply(helpText(prefix))

        let runAt = null
        let repeat = false
        let hour = null, minute = null
        let consumed = 0

        // Cek format: "DD/MM HH:MM" (one-time) atau "HH:MM repeat" (daily)
        const dateMatch = args[0]?.match(/^(\d{1,2})\/(\d{1,2})$/)
        const timeMatch1 = args[1]?.match(/^(\d{1,2}):(\d{2})$/)

        const timeOnlyMatch = args[0]?.match(/^(\d{1,2}):(\d{2})$/)
        const isRepeatKeyword = args[1]?.toLowerCase() === 'repeat'

        if (dateMatch && timeMatch1) {
            // Format: DD/MM HH:MM <target> <pesan>
            const day = parseInt(dateMatch[1])
            const month = parseInt(dateMatch[2])
            hour = parseInt(timeMatch1[1])
            minute = parseInt(timeMatch1[2])

            if (hour > 23 || minute > 59) return m.reply('❌ Jam/menit tidak valid~')

            let target = moment.tz(TZ).month(month - 1).date(day).hour(hour).minute(minute).second(0).millisecond(0)
            if (target.isBefore(moment.tz(TZ))) target.add(1, 'year')

            runAt = target.valueOf()
            consumed = 2
        } else if (timeOnlyMatch && isRepeatKeyword) {
            // Format: HH:MM repeat <target> <pesan>
            hour = parseInt(timeOnlyMatch[1])
            minute = parseInt(timeOnlyMatch[2])

            if (hour > 23 || minute > 59) return m.reply('❌ Jam/menit tidak valid~')

            repeat = true
            consumed = 2
        } else {
            return m.reply(
                `❌ *ꜰᴏʀᴍᴀᴛ ᴡᴀᴋᴛᴜ sᴀʟᴀʜ~*\n\n` +
                helpText(prefix)
            )
        }

        const targetType = (args[consumed] || '').toLowerCase()
        if (!['grup', 'user', 'all'].includes(targetType)) {
            return m.reply(`❌ Target harus \`grup\`, \`user\`, atau \`all\`~\n\n` + helpText(prefix))
        }

        const text = args.slice(consumed + 1).join(' ').trim()
        const hasMedia = !!(m.quoted?.isImage || m.quoted?.isVideo || m.quoted?.isDocument)

        if (!text && !hasMedia) {
            return m.reply(`❌ Pesan tidak boleh kosong~ (atau reply media + caption)`)
        }

        // Download media kalau ada
        let media = null
        if (hasMedia) {
            try {
                const buffer = await m.quoted.download()
                media = {
                    data: buffer.toString('base64'),
                    mimetype: m.quoted.mimetype || '',
                    fileName: m.quoted.fileName || 'file',
                }
            } catch (e) {
                return m.reply(`❌ *Gomen ne~* Gagal download media: ${e.message} 🥺`)
            }
        }

        const task = addScheduledBroadcast({
            text,
            targetType,
            repeat,
            hour,
            minute,
            runAt,
            media,
        })

        const runAtMoment = moment(task.runAt).tz(TZ)

        m.react('✅')
        return m.reply(
            `✅ *ʙʀᴏᴀᴅᴄᴀsᴛ ᴅɪᴊᴀᴅᴡᴀʟᴋᴀɴ~* 🌸\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 🆔 ID: \`${task.id}\`\n` +
            `┃ 🎯 Target: *${targetType}*\n` +
            (repeat
                ? `┃ 🔁 Repeat: *Harian* jam ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}\n`
                : `┃ ⏰ Waktu: *${runAtMoment.format('DD/MM/YYYY HH:mm')}* WIB\n`
            ) +
            `┃ 📝 Pesan: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}\n` +
            (media ? `┃ 📎 Media: *terlampir*\n` : '') +
            `╰┈┈⬡\n\n` +
            `> 💡 Cek \`${prefix}scbc list\` atau hapus dengan \`${prefix}scbc del ${task.id}\`~`
        )
    }

    return m.reply(helpText(prefix))
}

module.exports = {
    config: pluginConfig,
    handler,
}