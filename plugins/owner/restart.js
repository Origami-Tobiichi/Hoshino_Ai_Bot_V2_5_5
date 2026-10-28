const { spawn } = require('child_process')
const path = require('path')

const pluginConfig = {
    name: 'restart',
    alias: ['reset', 'reboot', 'restartbot'],
    category: 'owner',
    description: 'Restart bot process (real restart)',
    usage: '.restart',
    example: '.restart',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    try {
        // ============================================================
        // START RESTART
        // ============================================================

        await m.react('💫')

        const startTime = Date.now()

        await sock.sendMessage(
            m.chat,
            {
                text:
                    `🎤 *ʜᴏsʜɪɴᴏ ᴀɪ — ʙᴀᴄᴋsᴛᴀɢᴇ* ✨\n\n` +
                    `╭┈┈⬡「 💫 *ʀᴇsᴛᴀʀᴛ ᴛɪᴍᴇ* 」\n` +
                    `┃\n` +
                    `┃ 🎀 Ai mau istirahat sebentar yaa~\n` +
                    `┃ ✨ Panggung bot akan dimulai ulang.\n` +
                    `┃ 💕 Jangan khawatir, Ai bakal kembali!\n` +
                    `┃\n` +
                    `╰┈┈⬡\n\n` +
                    `╭┈┈⬡「 📊 *ʙᴀᴄᴋsᴛᴀɢᴇ ɪɴғᴏ* 」\n` +
                    `┃ ⏰ Time   : ${new Date().toLocaleTimeString('id-ID')}\n` +
                    `┃ 🔧 Method : Process Spawn\n` +
                    `┃ 📦 PID    : ${process.pid}\n` +
                    `╰┈┈⬡\n\n` +
                    `╭┈┈⬡「 🎀 *ᴘᴇʀsɪᴀᴘᴀɴ* 」\n` +
                    `┃ 💫 Menyiapkan proses baru...\n` +
                    `┃ 🔄 Memindahkan panggung...\n` +
                    `┃ 🎤 Ai akan kembali sebentar lagi~\n` +
                    `╰┈┈⬡\n\n` +
                    `> ✨ Restart dimulai dalam 2 detik...\n` +
                    `> 💕 Proses startup biasanya membutuhkan 10–30 detik.\n\n` +
                    `*「 ʟᴏᴠᴇ ɪs ᴀ ʙᴇᴀᴜᴛɪғᴜʟ ʟɪᴇ 」* 💫`
            },
            { quoted: m }
        )

        console.log('[Restart] Command triggered by:', m.sender)
        console.log('[Restart] Initiating graceful restart...')

        // ============================================================
        // DELAY SEBELUM SPAWN PROCESS BARU
        // ============================================================

        setTimeout(() => {
            const cwd = process.cwd()
            const isWindows = process.platform === 'win32'

            let command
            let args

            // ========================================================
            // WINDOWS
            // ========================================================

            if (isWindows) {
                command = 'cmd.exe'
                args = ['/c', 'start', '/b', 'node', 'index.js']

            // ========================================================
            // LINUX / TERMUX / VPS
            // ========================================================

            } else {
                command = 'node'
                args = ['index.js']
            }

            // ========================================================
            // SPAWN PROCESS BARU
            // ========================================================

            const child = spawn(command, args, {
                cwd: cwd,
                detached: true,
                stdio: 'ignore',
                shell: isWindows,

                env: {
                    ...process.env,
                    RESTARTED: 'true',
                    RESTART_TIME: startTime.toString()
                }
            })

            child.unref()

            console.log(
                '[Restart] New process spawned, exiting current process...'
            )

            // ========================================================
            // EXIT PROCESS LAMA
            // ========================================================

            setTimeout(() => {
                process.exit(0)
            }, 500)

        }, 2000)

    } catch (error) {

        // ============================================================
        // RESTART ERROR
        // ============================================================

        await m.react('💔')

        await m.reply(
            `💔 *ʀᴇsᴛᴀʀᴛ ɢᴀɢᴀʟ~* 🎤\n\n` +
            `╭┈┈⬡「 🎀 *ʙᴀᴄᴋsᴛᴀɢᴇ ᴇʀʀᴏʀ* 」\n` +
            `┃\n` +
            `┃ ❌ Ai belum berhasil kembali ke panggung.\n` +
            `┃\n` +
            `┃ 📝 Error:\n` +
            `┃ > ${error.message}\n` +
            `┃\n` +
            `╰┈┈⬡\n\n` +
            `> 💫 Jangan panik yaa~\n` +
            `> 🎤 Coba jalankan command restart lagi.\n` +
            `> ✨ Ai masih ada di backstage~`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}