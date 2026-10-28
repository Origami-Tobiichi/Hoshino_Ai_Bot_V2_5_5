const {
    collectStats,
    formatReport,
    sendReport,
    startAutoHealthCheck,
    stopAutoHealthCheck,
    getHealthStatus,
    parseInterval,
} = require('../../src/lib/healthCheck')

const pluginConfig = {
    name: 'healthcheck',
    alias: ['health', 'hc', 'cekhealth', 'autohc', 'stophc', 'hcstatus'],
    category: 'owner',
    description: 'Cek kesehatan bot dan atur auto report ke owner',
    usage: '.healthcheck [auto <interval>|stop|status]',
    example: '.healthcheck | .healthcheck auto 1h | .healthcheck stop',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const sub = (m.args?.[0] || 'now').toLowerCase()

    // ── .healthcheck / .healthcheck now ──────────────────────────────────────
    if (sub === 'now' || sub === 'cek' || sub === 'check') {
        m.react('🏥')
        const stats  = collectStats()
        const report = formatReport(stats)
        m.react('✅')
        return m.reply(report)
    }

    // ── .healthcheck auto <interval> ──────────────────────────────────────────
    if (sub === 'auto' || m.command === 'autohc') {
        const intervalStr = m.args?.[1] || m.args?.[0]

        if (!intervalStr || intervalStr === 'auto') {
            return m.reply(
                `⚠️ *ɪɴᴛᴇʀᴠᴀʟ ᴅɪʙᴜᴛᴜʜᴋᴀɴ~*\n\n` +
                `> \`.healthcheck auto <interval>\`\n\n` +
                `*ᴄᴏɴᴛᴏʜ:*\n` +
                `> \`.healthcheck auto 30m\` — tiap 30 menit\n` +
                `> \`.healthcheck auto 1h\`  — tiap 1 jam\n` +
                `> \`.healthcheck auto 6h\`  — tiap 6 jam\n` +
                `> \`.healthcheck auto 1d\`  — tiap 1 hari`
            )
        }

        const result = startAutoHealthCheck(intervalStr, sock)

        if (!result.success) {
            return m.reply(
                `❌ *ɢᴀɢᴀʟ~*\n\n> ${result.error}\n\n` +
                `> Format valid: \`30m\`, \`1h\`, \`6h\`, \`1d\``
            )
        }

        m.react('✅')
        return m.reply(
            `✅ *ᴀᴜᴛᴏ ʜᴇᴀʟᴛʜ ᴄʜᴇᴄᴋ ᴀᴋᴛɪꜰ~*\n\n` +
            `╭┈┈⬡「 ⚙️ *sᴇᴛᴛɪɴɢ* 」\n` +
            `┃ ⏱️ Interval: *${result.intervalStr}*\n` +
            `┃ 📤 Report dikirim ke: owner\n` +
            `┃ 📋 Isi report: CPU, RAM, Disk, Uptime, Plugin, Error\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> Report pertama akan dikirim dalam *${result.intervalStr}*~ 💖`
        )
    }

    // ── .healthcheck stop ─────────────────────────────────────────────────────
    if (sub === 'stop' || m.command === 'stophc') {
        const status = getHealthStatus()

        if (!status.enabled) {
            return m.reply(
                `❌ *Auto health check belum aktif~*\n\n` +
                `> Aktifkan dulu dengan \`.healthcheck auto <interval>\``
            )
        }

        stopAutoHealthCheck()
        m.react('✅')
        return m.reply(
            `✅ *ᴀᴜᴛᴏ ʜᴇᴀʟᴛʜ ᴄʜᴇᴄᴋ ᴅɪʜᴇɴᴛɪᴋᴀɴ~*\n\n` +
            `> Total report terkirim: *${status.reportCount}x*\n` +
            `> Gunakan \`.healthcheck auto <interval>\` untuk aktifkan lagi~`
        )
    }

    // ── .healthcheck status ───────────────────────────────────────────────────
    if (sub === 'status' || sub === 'info' || m.command === 'hcstatus') {
        const status = getHealthStatus()
        const stats  = collectStats()

        let txt = `📊 *sᴛᴀᴛᴜs ʜᴇᴀʟᴛʜ ᴄʜᴇᴄᴋ*\n\n`

        txt += `╭┈┈⬡「 🔧 *ᴀᴜᴛᴏ ʀᴇᴘᴏʀᴛ* 」\n`
        txt += `┃ 🔘 Status: ${status.enabled ? '✅ *ON*' : '❌ *OFF*'}\n`
        txt += `┃ ⏱️ Interval: *${status.intervalStr || '-'}*\n`
        txt += `┃ 📨 Total terkirim: *${status.reportCount}x*\n`
        if (status.startedAt) {
            const elapsed = Math.floor((Date.now() - status.startedAt) / 1000)
            const h = Math.floor(elapsed / 3600)
            const mn = Math.floor((elapsed % 3600) / 60)
            txt += `┃ 🕐 Berjalan sejak: *${h}j ${mn}m lalu*\n`
        }
        txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`

        txt += `╭┈┈⬡「 🖥️ *sɴᴀᴘsʜᴏᴛ sᴇᴋᴀʀᴀɴɢ* 」\n`
        txt += `┃ CPU: *${stats.cpu}%*\n`
        txt += `┃ RAM: *${stats.ram.pct}%*\n`
        if (stats.disk) txt += `┃ Disk: *${stats.disk.pct}%*\n`
        txt += `┃ Uptime Bot: *${Math.floor(stats.uptime.process / 3600)}j ${Math.floor((stats.uptime.process % 3600) / 60)}m*\n`
        txt += `┃ Error (24j): *${stats.errorCount}*\n`
        txt += `╰┈┈┈┈┈┈┈┈⬡`

        return m.reply(txt)
    }

    // ── .healthcheck send (kirim manual ke owner sekarang) ────────────────────
    if (sub === 'send' || sub === 'kirim') {
        m.react('📤')
        await sendReport(sock, { isAuto: false })
        m.react('✅')
        return m.reply(
            `✅ *Report berhasil dikirim ke owner~*\n\n` +
            `> Cek pesan masuk di nomor owner~ 💖`
        )
    }

    // ── Help ──────────────────────────────────────────────────────────────────
    return m.reply(
        `🏥 *ʜᴇᴀʟᴛʜ ᴄʜᴇᴄᴋ ʙᴏᴛ*\n\n` +
        `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
        `┃ \`.healthcheck\`          — cek sekarang\n` +
        `┃ \`.healthcheck auto 1h\`  — auto report tiap 1 jam\n` +
        `┃ \`.healthcheck stop\`     — hentikan auto report\n` +
        `┃ \`.healthcheck status\`   — lihat status & snapshot\n` +
        `┃ \`.healthcheck send\`     — kirim report ke owner\n` +
        `╰┈┈┈┈┈┈┈┈⬡\n\n` +
        `*ꜰᴏʀᴍᴀᴛ ɪɴᴛᴇʀᴠᴀʟ:*\n` +
        `> \`30m\` • \`1h\` • \`6h\` • \`12h\` • \`1d\`\n\n` +
        `*ɪsɪ ʀᴇᴘᴏʀᴛ:*\n` +
        `> CPU load, RAM, Disk, Uptime Bot & VPS,\n` +
        `> Node.js Heap, jumlah plugin, error 24 jam`
    )
}

module.exports = {
    config: pluginConfig,
    handler
}