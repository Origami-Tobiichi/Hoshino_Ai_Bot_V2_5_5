const fs = require('fs')
const path = require('path')
const { getContentType } = require('hsnai')
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg')
const ffmpeg = require('fluent-ffmpeg')
ffmpeg.setFfmpegPath(ffmpegInstaller.path)

function getTempDir() {
    const tmpDir = path.join(process.cwd(), 'tmp')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
    return tmpDir
}

function getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err)
            const duration = metadata?.format?.duration
            if (!duration) return reject(new Error('Durasi tidak ditemukan'))
            resolve(parseFloat(duration))
        })
    })
}

/**
 * Format detik → HH:MM:SS.mmm
 * misal: 3661.5 → "01:01:01.500"
 */
function formatDuration(seconds) {
    const h   = Math.floor(seconds / 3600)
    const m   = Math.floor((seconds % 3600) / 60)
    const s   = Math.floor(seconds % 60)
    const ms  = Math.round((seconds - Math.floor(seconds)) * 1000)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

/**
 * Parse waktu dari string ke detik (float).
 * Support:
 *   HH:MM:SS.mmm  → jam:menit:detik.milidetik
 *   MM:SS.mmm     → menit:detik.milidetik
 *   SS.mmm        → detik.milidetik
 *   HH.MM.SS.mmm  → titik sebagai separator (jam.menit.detik.milidetik)
 *   MM.SS         → menit.detik (legacy, 2 segmen)
 *   angka bulat   → detik murni
 *
 * Milidetik: .xxx di bagian akhir (max 3 digit, dipad jadi 3)
 */
function parseTime(input) {
    input = String(input).trim()

    // Coba format dengan colon dulu: HH:MM:SS.mmm / MM:SS.mmm / SS.mmm
    if (input.includes(':')) {
        const parts = input.split(':')
        let totalSec = 0

        if (parts.length === 3) {
            // HH:MM:SS.mmm
            const hh = parseFloat(parts[0]) || 0
            const mm = parseFloat(parts[1]) || 0
            const ss = parseFloat(parts[2]) || 0 // sudah termasuk .mmm
            totalSec = hh * 3600 + mm * 60 + ss
        } else if (parts.length === 2) {
            // MM:SS.mmm
            const mm = parseFloat(parts[0]) || 0
            const ss = parseFloat(parts[1]) || 0
            totalSec = mm * 60 + ss
        } else {
            totalSec = parseFloat(parts[parts.length - 1]) || 0
        }

        return isNaN(totalSec) ? NaN : totalSec
    }

    // Format titik: bisa 1, 2, 3, atau 4 segmen
    const dotParts = input.split('.')
    const n = dotParts.length

    // 1 segmen → detik murni
    if (n === 1) return parseFloat(dotParts[0]) || 0

    // 2 segmen → MM.SS (legacy compat)
    if (n === 2) {
        const mm = parseInt(dotParts[0], 10) || 0
        const ss = parseInt(dotParts[1].padEnd(2, '0').slice(0, 2), 10) || 0
        return mm * 60 + ss
    }

    // 3 segmen → MM.SS.mmm
    if (n === 3) {
        const mm  = parseInt(dotParts[0], 10) || 0
        const ss  = parseInt(dotParts[1], 10) || 0
        const ms  = parseInt(dotParts[2].padEnd(3, '0').slice(0, 3), 10) || 0
        return mm * 60 + ss + ms / 1000
    }

    // 4 segmen → HH.MM.SS.mmm
    if (n === 4) {
        const hh  = parseInt(dotParts[0], 10) || 0
        const mm  = parseInt(dotParts[1], 10) || 0
        const ss  = parseInt(dotParts[2], 10) || 0
        const ms  = parseInt(dotParts[3].padEnd(3, '0').slice(0, 3), 10) || 0
        return hh * 3600 + mm * 60 + ss + ms / 1000
    }

    return NaN
}

/**
 * Ukuran file manusia
 */
function humanSize(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const pluginConfig = {
    name: 'potongsound',
    alias: ['cutsound', 'trimaudio', 'trimsound', 'potongvn', 'cutvn'],
    category: 'tools',
    description: 'Potong audio atau voice note sesuai durasi yang diinginkan',
    usage: '.potongsound <awal> <akhir> [fadein|fadeout|fadeall]',
    example: '.potongsound 0:30 1:15\n.potongsound 1:20.500 2:45.250 fadein\n.potongsound 0:30 1:15 fadeout\n.potongsound 0:30 1:15 fadeall',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 2,
    isEnabled: true
}

const HELP_TEXT = (pref, cmd) =>
    `╭━━━━━━━━━━━━━━━╮\n` +
    `✦ ★ *POTONGSOUND* ☆\n` +
    `├━━━━━━━━━━━━━━━┤\n` +
    `✦ Reply audio/VN + ketik:\n` +
    `✦ *${pref}${cmd} <awal> <akhir> [opsi]*\n` +
    `├───────────────┤\n` +
    `✦ *Opsi Fade (opsional):*\n` +
    `✦ \`fadein\`       → fade in di awal (default 500ms)\n` +
    `✦ \`fadeout\`      → fade out di akhir (default 500ms)\n` +
    `✦ \`fadeall\`      → fade in + out (default 500ms)\n` +
    `✦ \`fadein:300\`   → fade in custom 300ms\n` +
    `✦ \`fadeout:1000\` → fade out custom 1000ms\n` +
    `✦ \`fadeall:750\`  → fade in + out custom 750ms\n` +
    `├───────────────┤\n` +
    `✦ *Format waktu yang didukung:*\n` +
    `✦ \`HH:MM:SS.mmm\` → jam lengkap + milidetik\n` +
    `✦ \`MM:SS.mmm\`    → menit:detik.milidetik\n` +
    `✦ \`MM:SS\`        → menit:detik\n` +
    `✦ \`SS.mmm\`       → detik + milidetik\n` +
    `✦ \`MM.SS\`        → menit.detik (legacy)\n` +
    `├───────────────┤\n` +
    `✦ *Contoh:*\n` +
    `✦ \`${pref}${cmd} 0:30 1:15\`\n` +
    `✦ \`${pref}${cmd} 0:30 1:15 fadein\`\n` +
    `✦ \`${pref}${cmd} 0:30 1:15 fadeout:1000\`\n` +
    `✦ \`${pref}${cmd} 0:00:30 1:01:15.500 fadeall:750\`\n` +
    `╰━━━━━━━━━━━━━━━╯\n` +
    `「 ᴀᴋᴜ ᴀᴅᴀʟᴀʜ ɪᴅᴏʟ ᴛᴇʀʙᴇsᴀʀ ᴅɪ ᴅᴜɴɪᴀ 」`

async function handler(m, { sock, usedPrefix, command }) {
    try {
        const text = m.args?.join(' ') || m.text || ''
        const args = text.trim().split(/\s+/).filter(Boolean)

        const pref = usedPrefix || '.'
        const cmd  = command || pluginConfig.name

        // Subcommand: help
        if (args[0] === 'help' || args[0] === 'bantuan') {
            return m.reply(HELP_TEXT(pref, cmd))
        }

        // Cek harus reply audio/vn
        const quoted = m.quoted
        if (!quoted) {
            await m.react('❌')
            return m.reply(
                `╭━━━━━━━━━━━━━━━╮\n` +
                `✦ ★ *POTONGSOUND* ☆\n` +
                `├━━━━━━━━━━━━━━━┤\n` +
                `✦ Reply ke audio atau voice note dulu ya~\n` +
                `✦ Ketik *${pref}${cmd} help* untuk panduan lengkap\n` +
                `╰━━━━━━━━━━━━━━━╯\n` +
                `「 ᴀᴋᴜ ᴀᴅᴀʟᴀʜ ɪᴅᴏʟ ᴛᴇʀʙᴇsᴀʀ ᴅɪ ᴅᴜɴɪᴀ 」`
            )
        }

        const quotedType = quoted.mtype
            || (quoted.message ? getContentType(quoted.message) : null)
            || quoted.type
            || ''

        if (!quotedType?.includes('audio')) {
            await m.react('❌')
            return m.reply(
                `╭━━━━━━━━━━━━━━━╮\n` +
                `✦ ★ *POTONGSOUND* ☆\n` +
                `├━━━━━━━━━━━━━━━┤\n` +
                `✦ Hanya bisa dipakai pada audio atau voice note~\n` +
                `✦ Tipe pesan terdeteksi: \`${quotedType || 'unknown'}\`\n` +
                `╰━━━━━━━━━━━━━━━╯\n` +
                `「 ᴀᴋᴜ ᴀᴅᴀʟᴀʜ ɪᴅᴏʟ ᴛᴇʀʙᴇsᴀʀ ᴅɪ ᴅᴜɴɪᴀ 」`
            )
        }

        const isVoiceNote = !!(quoted.message?.audioMessage?.ptt)

        // Parse subcommand fade — support fadein / fadeout / fadeall / fadein:500 / fadeall:1000
        const FADE_DEFAULT_MS = 500
        const FADE_RE = /^(fadein|fadeout|fadeall)(?::(\d+))?$/i
        const fadeFlagIndex = args.findIndex(a => FADE_RE.test(a))
        let fadeMode     = null
        let fadeMsRaw    = FADE_DEFAULT_MS
        if (fadeFlagIndex !== -1) {
            const match = args[fadeFlagIndex].match(FADE_RE)
            fadeMode    = match[1].toLowerCase()
            fadeMsRaw   = match[2] ? Math.max(50, Math.min(10000, parseInt(match[2], 10))) : FADE_DEFAULT_MS
        }
        const timeArgs     = args.filter((_, i) => i !== fadeFlagIndex)
        const FADE_DUR_USER = fadeMsRaw / 1000  // detik untuk ffmpeg

        const doFadeIn  = fadeMode === 'fadein'  || fadeMode === 'fadeall'
        const doFadeOut = fadeMode === 'fadeout' || fadeMode === 'fadeall'

        if (timeArgs.length < 2) {
            await m.react('❌')
            return m.reply(HELP_TEXT(pref, cmd))
        }

        const startSec = parseTime(timeArgs[0])
        const endSec   = parseTime(timeArgs[1])

        if (isNaN(startSec) || isNaN(endSec)) {
            await m.react('❌')
            return m.reply(
                `╭━━━━━━━━━━━━━━━╮\n` +
                `✦ ★ *POTONGSOUND* ☆\n` +
                `├━━━━━━━━━━━━━━━┤\n` +
                `✦ Format waktu tidak valid~\n` +
                `✦ Input awal : \`${timeArgs[0]}\`\n` +
                `✦ Input akhir: \`${timeArgs[1]}\`\n` +
                `✦ Ketik *${pref}${cmd} help* untuk format yang didukung\n` +
                `╰━━━━━━━━━━━━━━━╯\n` +
                `「 ᴀᴋᴜ ᴀᴅᴀʟᴀʜ ɪᴅᴏʟ ᴛᴇʀʙᴇsᴀʀ ᴅɪ ᴅᴜɴɪᴀ 」`
            )
        }

        if (startSec < 0 || startSec >= endSec) {
            await m.react('❌')
            return m.reply(
                `╭━━━━━━━━━━━━━━━╮\n` +
                `✦ ★ *POTONGSOUND* ☆\n` +
                `├━━━━━━━━━━━━━━━┤\n` +
                `✦ Waktu awal harus lebih kecil dari waktu akhir~\n` +
                `✦ Awal  : \`${formatDuration(startSec)}\` (${startSec.toFixed(3)}s)\n` +
                `✦ Akhir : \`${formatDuration(endSec)}\` (${endSec.toFixed(3)}s)\n` +
                `╰━━━━━━━━━━━━━━━╯\n` +
                `「 ᴀᴋᴜ ᴀᴅᴀʟᴀʜ ɪᴅᴏʟ ᴛᴇʀʙᴇsᴀʀ ᴅɪ ᴅᴜɴɪᴀ 」`
            )
        }

        await m.react('⏳')

        // Download audio
        const tmpDir    = getTempDir()
        const ts        = Date.now()
        const inputPath = path.join(tmpDir, `ps_in_${ts}.ogg`)

        const { buffer: audioBuffer } = await sock.downloadAndSaveMediaMessage(quoted)
        const originalSize = audioBuffer.length
        fs.writeFileSync(inputPath, audioBuffer)

        // Baca durasi asli
        let totalDuration
        try {
            totalDuration = await getAudioDuration(inputPath)
        } catch (e) {
            try { fs.unlinkSync(inputPath) } catch {}
            await m.react('❌')
            return m.reply(
                `╭━━━━━━━━━━━━━━━╮\n` +
                `✦ ★ *POTONGSOUND* ☆\n` +
                `├━━━━━━━━━━━━━━━┤\n` +
                `✦ Gagal membaca durasi audio~\n` +
                `✦ Error: ${e.message}\n` +
                `╰━━━━━━━━━━━━━━━╯\n` +
                `「 ᴀᴋᴜ ᴀᴅᴀʟᴀʜ ɪᴅᴏʟ ᴛᴇʀʙᴇsᴀʀ ᴅɪ ᴅᴜɴɪᴀ 」`
            )
        }

        // Validasi range vs durasi asli
        if (startSec >= totalDuration || endSec > totalDuration) {
            try { fs.unlinkSync(inputPath) } catch {}
            await m.react('❌')
            return m.reply(
                `╭━━━━━━━━━━━━━━━╮\n` +
                `✦ ★ *POTONGSOUND* ☆\n` +
                `├━━━━━━━━━━━━━━━┤\n` +
                `✦ Durasi melebihi panjang audio!\n` +
                `✦ Durasi audio : \`${formatDuration(totalDuration)}\`\n` +
                `✦ Input awal   : \`${formatDuration(startSec)}\`\n` +
                `✦ Input akhir  : \`${formatDuration(endSec)}\`\n` +
                `✦ Pastikan waktu akhir ≤ durasi audio~\n` +
                `╰━━━━━━━━━━━━━━━╯\n` +
                `「 ᴀᴋᴜ ᴀᴅᴀʟᴀʜ ɪᴅᴏʟ ᴛᴇʀʙᴇsᴀʀ ᴅɪ ᴅᴜɴɪᴀ 」`
            )
        }

        const cutDuration = endSec - startSec
        const outExt      = isVoiceNote ? 'ogg' : 'mp3'
        const outMime     = isVoiceNote ? 'audio/ogg; codecs=opus' : 'audio/mpeg'
        const outputPath  = path.join(tmpDir, `ps_out_${ts}.${outExt}`)

        // Fade duration: pakai custom user, tapi clamp max 30% dari cutDuration biar gak overlap
        const FADE_DUR = Math.min(FADE_DUR_USER, cutDuration * 0.30)

        await new Promise((resolve, reject) => {
            const cmd = ffmpeg(inputPath)
                .setStartTime(startSec)
                .setDuration(cutDuration)

            const audioFilters = []
            if (doFadeIn)  audioFilters.push(`afade=t=in:st=0:d=${FADE_DUR.toFixed(4)}`)
            if (doFadeOut) audioFilters.push(`afade=t=out:st=${(cutDuration - FADE_DUR).toFixed(4)}:d=${FADE_DUR.toFixed(4)}`)

            if (isVoiceNote) {
                if (audioFilters.length) cmd.audioFilters(audioFilters)
                cmd.outputOptions(['-c:a', 'libopus', '-b:a', '64k']).toFormat('ogg')
            } else {
                if (audioFilters.length) cmd.audioFilters(audioFilters)
                cmd.outputOptions(['-c:a', 'libmp3lame', '-b:a', '128k']).toFormat('mp3')
            }

            cmd.on('end', resolve).on('error', reject).save(outputPath)
        })

        const resultBuffer = fs.readFileSync(outputPath)
        const resultSize   = resultBuffer.length

        try { fs.unlinkSync(inputPath) } catch {}
        try { fs.unlinkSync(outputPath) } catch {}

        await m.react('✅')

        const fadeDurActualMs = Math.round(FADE_DUR * 1000)
        const fadeLabel = !fadeMode
            ? '❌ Tidak'
            : fadeMode === 'fadein'  ? `✅ Fade In (${fadeDurActualMs}ms)`
            : fadeMode === 'fadeout' ? `✅ Fade Out (${fadeDurActualMs}ms)`
            : `✅ Fade In + Out (${fadeDurActualMs}ms)`
        const percentCut = ((cutDuration / totalDuration) * 100).toFixed(1)
        const caption =
            `╭━━━━━━━━━━━━━━━╮\n` +
            `✦ ★ *POTONGSOUND* ☆\n` +
            `├━━━━━━━━━━━━━━━┤\n` +
            `✦ *Tipe*      : ${isVoiceNote ? '🎙️ Voice Note' : '🎵 Audio'}\n` +
            `✦ *Format*    : ${outExt.toUpperCase()}\n` +
            `✦ *Fade*      : ${fadeLabel}\n` +
            `├───────────────┤\n` +
            `✦ *Durasi Asli*   : \`${formatDuration(totalDuration)}\`\n` +
            `✦ *Awal Potong*   : \`${formatDuration(startSec)}\`\n` +
            `✦ *Akhir Potong*  : \`${formatDuration(endSec)}\`\n` +
            `✦ *Hasil Potongan*: \`${formatDuration(cutDuration)}\` (${percentCut}%)\n` +
            `├───────────────┤\n` +
            `✦ *Ukuran Asli* : ${humanSize(originalSize)}\n` +
            `✦ *Ukuran Hasil*: ${humanSize(resultSize)}\n` +
            `╰━━━━━━━━━━━━━━━╯\n` +
            `「 ᴀᴋᴜ ᴀᴅᴀʟᴀʜ ɪᴅᴏʟ ᴛᴇʀʙᴇsᴀʀ ᴅɪ ᴅᴜɴɪᴀ 」`

        await sock.sendMessage(m.key.remoteJid, {
            audio: resultBuffer,
            mimetype: outMime,
            ptt: isVoiceNote,
            caption
        }, { quoted: m })

    } catch (error) {
        console.error('Potongsound Plugin Error:', error)
        await m.react('❌')
        await m.reply(
            `╭━━━━━━━━━━━━━━━╮\n` +
            `✦ ★ *POTONGSOUND* ☆\n` +
            `├━━━━━━━━━━━━━━━┤\n` +
            `✦ ❌ Terjadi kesalahan!\n` +
            `✦ ${error.message}\n` +
            `╰━━━━━━━━━━━━━━━╯\n` +
            `「 ᴀᴋᴜ ᴀᴅᴀʟᴀʜ ɪᴅᴏʟ ᴛᴇʀʙᴇsᴀʀ ᴅɪ ᴅᴜɴɪᴀ 」`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}