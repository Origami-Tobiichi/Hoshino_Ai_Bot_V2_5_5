const fs = require('fs')
const path = require('path')
const archiver = require('archiver')
const config = require('../../config')

const pluginConfig = {
    name: 'backupsc',
    alias: ['backup', 'backupscript', 'backupsource'],
    category: 'owner',
    description: 'Backup script bot dalam bentuk zip di root folder',
    usage: '.backupsc',
    example: '.backupsc',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 60,
    energi: 0,
    isEnabled: true
}

const EXCLUDE_DIRS_BASE = [
    'node_modules', '.git', 'storage', 'tmp', 'temp', '.cache',
    'logs', 'sessions', 'auth', '.npm', '.yarn',
    'Marin Kitagawa MD V1.0 (1)'
]

const EXCLUDE_FILES = [
    '.env', '.env.local', 'creds.json', '*.log', '*.zip',
    'package-lock.json', 'yarn.lock'
]

const WARN_SIZE_MB = 100

if (!global.backupPending) global.backupPending = {}

function shouldExclude(filePath, basePath, extraExcludeDirs = []) {
    const relativePath = path.relative(basePath, filePath)
    const parts = relativePath.split(path.sep)
    const excludeDirs = [...EXCLUDE_DIRS_BASE, ...extraExcludeDirs]

    for (const part of parts) {
        if (excludeDirs.includes(part)) return true
    }

    const fileName = path.basename(filePath)
    for (const pattern of EXCLUDE_FILES) {
        if (pattern.includes('*')) {
            if (fileName.endsWith(pattern.replace('*', ''))) return true
        } else {
            if (fileName === pattern) return true
        }
    }
    return false
}

function cleanupFile(filePath) {
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch (e) {
        console.warn('[Backup] Gagal hapus file:', e.message)
    }
}

async function buildZip(zipFilePath, projectRoot, extraExcludeDirs = [], onlyDir = null) {
    await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipFilePath)
        const archive = archiver('zip', { zlib: { level: 9 } })

        output.on('close', resolve)
        archive.on('error', reject)
        archive.pipe(output)

        function addDirectory(dirPath) {
            try {
                const items = fs.readdirSync(dirPath)
                for (const item of items) {
                    const fullPath = path.join(dirPath, item)
                    if (shouldExclude(fullPath, projectRoot, extraExcludeDirs)) continue
                    try {
                        const stat = fs.statSync(fullPath)
                        const relativePath = path.relative(projectRoot, fullPath)
                        if (stat.isDirectory()) {
                            addDirectory(fullPath)
                        } else if (stat.isFile()) {
                            if (stat.size < 20 * 1024 * 1024) {
                                archive.file(fullPath, { name: relativePath })
                            } else {
                                console.log(`[Backup] Skip file besar: ${relativePath} (${(stat.size/1024/1024).toFixed(1)}MB)`)
                            }
                        }
                    } catch (e) {
                        console.log(`[Backup] Skip: ${fullPath}`)
                    }
                }
            } catch (e) {
                console.log(`[Backup] Error reading: ${dirPath}`)
            }
        }

        // Kalau onlyDir, hanya zip folder itu saja
        const startDir = onlyDir ? path.join(projectRoot, onlyDir) : projectRoot
        if (fs.existsSync(startDir)) {
            addDirectory(startDir)
        }

        archive.finalize()
    })
}

async function sendZip(m, sock, zipFilePath, zipFileName, label = '') {
    const stats = fs.statSync(zipFilePath)
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2)

    const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    const saluranName = config.saluran?.name || config.bot?.name || 'Bot'

    await sock.sendDocumentRaw(m.chat, fs.readFileSync(zipFilePath), {
        fileName: zipFileName,
        mimetype: 'application/zip',
        caption:
            `✅ *ʙᴀᴄᴋᴜᴘ sᴇʟᴇsᴀɪ${label ? ' — ' + label : ''}*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 📝 ɴᴀᴍᴀ: \`${zipFileName}\`\n` +
            `┃ 📊 sɪᴢᴇ: \`${fileSizeMB} MB\`\n` +
            `┃ 📅 ᴛᴀɴɢɢᴀʟ: \`${require('moment-timezone')().tz('Asia/Jakarta').format('DD/MM/YYYY')}\`\n` +
            `╰┈┈⬡`,
        contextInfo: {
            forwardingScore: 9999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: saluranId,
                newsletterName: saluranName,
                serverMessageId: 127
            }
        }
    }, m)
}

async function doBackup(m, sock, mode) {
    const projectRoot = process.cwd()
    const moment = require('moment-timezone')
    const timestamp = moment().tz('Asia/Jakarta').format('YYYY-MM-DD_HH-mm-ss')
    const botName = config.bot?.name?.replace(/[^a-zA-Z0-9]/g, '') || 'Bot'
    const tempDir = path.join(projectRoot, 'temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

    m.react('🕕')

    // aset sekarang berupa URL di config.assets, jadi cukup satu ZIP
    const zipFileName = `${botName}_backup_${timestamp}.zip`
    const zipFilePath = path.join(tempDir, zipFileName)

    try {
        await m.reply(`📦 *ʙᴜɪʟᴅɪɴɢ ᴢɪᴘ...*\n\n> Aset sekarang berupa URL di config.js\n> Mohon tunggu...`)

        await buildZip(zipFilePath, projectRoot, [])

        const stats = fs.statSync(zipFilePath)
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2)

        if (stats.size > WARN_SIZE_MB * 1024 * 1024) {
            global.backupPending[m.sender] = { zipFilePath, zipFileName, stage: 'size' }
            m.react('⚠️')
            await m.reply(
                `⚠️ *ᴜᴋᴜʀᴀɴ ʙᴇsᴀʀ*\n\n` +
                `> ZIP berukuran *${fileSizeMB} MB*, melebihi ${WARN_SIZE_MB} MB.\n` +
                `> Pengiriman mungkin lambat atau gagal.\n\n` +
                `> Ketik *ya* untuk tetap kirim\n` +
                `> Ketik *batal* untuk membatalkan`
            )
            return
        }

        await sendZip(m, sock, zipFilePath, zipFileName)
        m.react('✅')
    } catch (error) {
        m.react('❌')
        await m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    } finally {
        if (!global.backupPending?.[m.sender]) {
            cleanupFile(zipFilePath)
        }
    }
}

async function handler(m, { sock }) {
    // folder assets/ sudah tidak dipakai (aset berupa URL di config.assets), jadi langsung backup tanpa tanya
    await doBackup(m, sock, 'tidak')
}

async function confirmAnswerHandler(m, sock) {
    if (!global.backupPending?.[m.sender]) return false

    const text = m.body?.trim().toLowerCase()
    const pending = global.backupPending[m.sender]

    // Konfirmasi ukuran besar
    if (pending.stage === 'size') {
        if (!['ya', 'batal'].includes(text)) return false

        const { zipFilePath, zipFileName } = pending
        delete global.backupPending[m.sender]

        if (text === 'batal') {
            cleanupFile(zipFilePath)
            await m.reply(`❌ *ʙᴀᴄᴋᴜᴘ ᴅɪʙᴀᴛᴀʟᴋᴀɴ*\n\n> File ZIP sudah dihapus.`)
            return true
        }

        m.react('🕕')
        try {
            await sendZip(m, sock, zipFilePath, zipFileName)
            m.react('✅')
        } catch (e) {
            m.react('❌')
            await m.reply(`❌ *Gomen ne~* ✦\n\n> ${e.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
        } finally {
            cleanupFile(zipFilePath)
        }
        return true
    }

    return false
}

module.exports = {
    config: pluginConfig,
    handler,
    confirmAnswerHandler
}