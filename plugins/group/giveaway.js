const hsAsset = require('../../src/lib/assets')
const { getDatabase } = require('../../src/lib/database')
const config = require('../../config')
const timeHelper = require('../../src/lib/timeHelper')
const cron = require('node-cron')
const path = require('path')
const fs = require('fs')

const pluginConfig = {
    name: 'giveaway',
    alias: ['ga', 'gaway'],
    category: 'group',
    description: 'Sistem giveaway untuk grup',
    usage: '.giveaway <start/end/join/list/delete/reroll/notifadmin>',
    example: '.giveaway start',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    isAdmin: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

const CLEANUP_DELAY = 3 * 24 * 60 * 60 * 1000
const pendingGiveaway = new Map()

// Cache gambar giveaway sekali di memory — hindari readFileSync berulang
let cachedGiveawayImage = null
let imageLoaded = false

function loadGiveawayImageOnce() {
    if (cachedGiveawayImage) return cachedGiveawayImage
    // sync: ambil dari cache memori (kalau belum ada, di-download di background)
    cachedGiveawayImage = hsAsset.peek('images/giveaway') || hsAsset.peek('images/hsnai') || null
    return cachedGiveawayImage
}

function generateGiveawayId() {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `GA-${random}`
}

function parseTime(timeStr) {
    const regex = /(\d+)([smhd])/g
    let totalMs = 0
    let match
    
    while ((match = regex.exec(timeStr)) !== null) {
        const value = parseInt(match[1])
        const unit = match[2]
        
        if (unit === 's') totalMs += value * 1000
        if (unit === 'm') totalMs += value * 60 * 1000
        if (unit === 'h') totalMs += value * 60 * 60 * 1000
        if (unit === 'd') totalMs += value * 24 * 60 * 60 * 1000
    }
    
    return totalMs
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `${days} hari ${hours % 24} jam`
    if (hours > 0) return `${hours} jam ${minutes % 60} menit`
    if (minutes > 0) return `${minutes} menit`
    return `${seconds} detik`
}

function getGiveawayImage() {
    return loadGiveawayImageOnce()
}

function extractAdminJid(input, mentionedJid) {
    if (mentionedJid && mentionedJid.length > 0) {
        return mentionedJid[0]
    }
    const match = input?.match(/@(\d+)/)
    if (match) {
        return `${match[1]}@s.whatsapp.net`
    }
    const numberMatch = input?.match(/(\d{10,15})/)
    if (numberMatch) {
        return `${numberMatch[1]}@s.whatsapp.net`
    }
    return null
}

function buildGiveawayMessage(giveaway, participantCount = 0, prefix = '.') {
    const endTimeFormatted = timeHelper.fromTimestamp(giveaway.endTime, 'DD/MM/YYYY HH:mm')
    const remaining = giveaway.endTime - Date.now()
    const remainingText = remaining > 0 ? formatDuration(remaining) : 'Berakhir'
    const adminTag = giveaway.adminJid ? `@${giveaway.adminJid.split('@')[0]}` : 'Creator'
    
    return `🎉 *ɢɪᴠᴇᴀᴡᴀʏ*

╭┈┈⬡「 🎁 *${giveaway.title}* 」
┃ 🏆 ʜᴀᴅɪᴀʜ: *${giveaway.prizeName || 'Hadiah Spesial'}*
┃ 📝 ᴅᴇsᴋ: _${giveaway.description}_
╰┈┈⬡

╭┈┈⬡「 📋 *ɪɴꜰᴏ* 」
┃ 👥 ᴘᴇᴍᴇɴᴀɴɢ: \`${giveaway.winners} orang\`
┃ 👤 ᴘᴇsᴇʀᴛᴀ: \`${participantCount} orang\`
┃ ⏰ ʙᴇʀᴀᴋʜɪʀ: \`${endTimeFormatted}\`
┃ 🕕 sɪsᴀ: \`${remainingText}\`
┃ 👮 ᴀᴅᴍɪɴ: ${adminTag}
┃ 🆔 ɪᴅ: \`${giveaway.giveawayId}\`
╰┈┈⬡

> *Cara Ikut:*
> Ketik \`${prefix}giveaway join ${giveaway.giveawayId}\`

> _Good luck! 🍀_`
}

function buildWinnerMessage(giveaway, winners) {
    let winnerList = ''
    winners.forEach((w, i) => {
        winnerList += `┃ ${i + 1}. @${w.split('@')[0]}\n`
    })
    const adminTag = giveaway.adminJid ? `@${giveaway.adminJid.split('@')[0]}` : 'Creator'
    
    return `🎊 *ɢɪᴠᴇᴀᴡᴀʏ sᴇʟᴇsᴀɪ!*

╭┈┈⬡「 🎁 *${giveaway.title}* 」
┃ 🏆 ʜᴀᴅɪᴀʜ: *${giveaway.prizeName || 'Hadiah Spesial'}*
┃ 👮 ᴀᴅᴍɪɴ: ${adminTag}
╰┈┈⬡

╭┈┈⬡「 🏅 *ᴘᴇᴍᴇɴᴀɴɢ* 」
${winnerList}╰┈┈⬡

> 🎉 Selamat kepada pemenang!
> Cek DM untuk detail hadiah.

> _ID: ${giveaway.giveawayId}_`
}

async function selectWinners(giveaway) {
    const participants = giveaway.participants || []
    const numWinners = Math.min(giveaway.winners, participants.length)
    const shuffled = [...participants].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, numWinners)
}

async function endGiveaway(giveawayId, sock, db) {
    const giveaways = db.setting('giveaways') || {}
    const giveaway = giveaways[giveawayId]
    
    if (!giveaway || giveaway.ended) return
    
    const participants = giveaway.participants || []
    const notifAdmin = db.setting('giveawayNotifAdmin') ?? true
    const imageBuffer = getGiveawayImage()
    
    if (participants.length === 0) {
        await sock.sendMessage(giveaway.chatId, {
            text: `❌ *ɢɪᴠᴇᴀᴡᴀʏ ʙᴇʀᴀᴋʜɪʀ*\n\n` +
                `> ID: \`${giveawayId}\`\n` +
                `> Status: Tidak ada peserta\n\n` +
                `> _Giveaway dibatalkan._`
        })
        
        if (notifAdmin && giveaway.adminJid) {
            try {
                await sock.sendMessage(giveaway.adminJid, {
                    text: `❌ *ɢɪᴠᴇᴀᴡᴀʏ ʙᴇʀᴀᴋʜɪʀ*\n\n` +
                        `> ID: \`${giveawayId}\`\n` +
                        `> Title: ${giveaway.title}\n` +
                        `> Status: Tidak ada peserta\n\n` +
                        `> _Giveaway dibatalkan._`
                })
            } catch (e) {}
        }
        
        giveaway.ended = true
        giveaway.endedAt = Date.now()
        db.setting('giveaways', giveaways)
        return
    }
    
    const winners = await selectWinners(giveaway)
    const winnerMsg = buildWinnerMessage(giveaway, winners)
    const mentions = giveaway.adminJid ? [...winners, giveaway.adminJid] : winners
    
    if (imageBuffer) {
        await sock.sendMessage(giveaway.chatId, {
            image: imageBuffer,
            caption: winnerMsg,
            mentions
        })
    } else {
        await sock.sendMessage(giveaway.chatId, {
            text: winnerMsg,
            mentions
        })
    }
    
    for (const winner of winners) {
        try {
            await sock.sendMessage(winner, {
                text: `🎉 *sᴇʟᴀᴍᴀᴛ!*\n\n` +
                    `> Kamu memenangkan giveaway!\n\n` +
                    `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
                    `┃ 🎁 ᴛɪᴛʟᴇ: \`${giveaway.title}\`\n` +
                    `┃ 🏆 ʜᴀᴅɪᴀʜ: *${giveaway.prizeName}*\n` +
                    `┃ 🆔 ɪᴅ: \`${giveawayId}\`\n` +
                    `╰┈┈⬡\n\n` +
                    `╭┈┈⬡「 🎁 *ᴅᴇᴛᴀɪʟ ʜᴀᴅɪᴀʜ* 」\n` +
                    `${giveaway.prizeDetails || 'Hubungi admin untuk detail'}\n` +
                    `╰┈┈⬡\n\n` +
                    `> _Ini informasi resmi dari bot._`
            })
        } catch (e) {}
    }
    
    if (notifAdmin && giveaway.adminJid) {
        try {
            let winnerListText = ''
            winners.forEach((w, i) => {
                winnerListText += `${i + 1}. @${w.split('@')[0]}\n`
            })
            
            await sock.sendMessage(giveaway.adminJid, {
                text: `🎊 *ɴᴏᴛɪꜰ ɢɪᴠᴇᴀᴡᴀʏ*\n\n` +
                    `> Giveaway telah berakhir!\n\n` +
                    `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
                    `┃ 🎁 ᴛɪᴛʟᴇ: \`${giveaway.title}\`\n` +
                    `┃ 🏆 ʜᴀᴅɪᴀʜ: \`${giveaway.prize}\`\n` +
                    `┃ 👥 ᴘᴇsᴇʀᴛᴀ: \`${participants.length}\`\n` +
                    `┃ 🆔 ɪᴅ: \`${giveawayId}\`\n` +
                    `╰┈┈⬡\n\n` +
                    `╭┈┈⬡「 🏅 *ᴘᴇᴍᴇɴᴀɴɢ* 」\n` +
                    `${winnerListText}╰┈┈⬡\n\n` +
                    `> _Ini notifikasi resmi dari bot._`,
                mentions: winners
            })
        } catch (e) {}
    }
    
    giveaway.ended = true
    giveaway.endedAt = Date.now()
    giveaway.winnerList = winners
    db.setting('giveaways', giveaways)
}

async function handler(m, { sock, args: rawArgs }) {
    const db = getDatabase()
    const args = rawArgs || m.args || []
    const action = args[0]?.toLowerCase() || ''
    const prefix = m.prefix || '.'
    const botConfig = config
    
    let giveaways = db.setting('giveaways') || {}
    
    if (action === '--confirm' && args[1]) {
        const targetGroupId = args[1]
        const pendingData = pendingGiveaway.get(m.sender)
        
        if (!pendingData) {
            return m.reply(`⚠️ *Tidak ada data pending. Silakan buat giveaway ulang.*`)
        }
        
        try {
            let groupName = 'Grup'
            try {
                const meta = await sock.groupMetadata(targetGroupId)
                groupName = meta.subject
            } catch (e) {}
            
            await m.reply(`🕕 *Memposting giveaway ke ${groupName}...*`)
            
            const giveawayId = generateGiveawayId()
            const endTime = Date.now() + pendingData.duration
            
            const giveaway = {
                giveawayId,
                chatId: targetGroupId,
                title: pendingData.title,
                prizeName: pendingData.prizeName,
                prizeDetails: pendingData.prizeDetails,
                description: pendingData.description,
                winners: pendingData.winners,
                endTime,
                creatorId: m.sender,
                adminJid: pendingData.adminJid || m.sender,
                participants: [],
                ended: false,
                createdAt: Date.now()
            }
            
            giveaways[giveawayId] = giveaway
            db.setting('giveaways', giveaways)
            
            const giveawayText = buildGiveawayMessage(giveaway, 0, prefix)
            const imageBuffer = getGiveawayImage()
            
            const saluranId = botConfig.saluran?.id || 'https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o'
            const saluranName = botConfig.saluran?.name || botConfig.bot?.name || 'Ourin-AI'
            
            const contextInfo = {
                mentionedJid: [m.sender, giveaway.adminJid],
                forwardingScore: 9999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: saluranId,
                    newsletterName: saluranName,
                    serverMessageId: 127
                }
            }
            
            if (imageBuffer) {
                await sock.sendMessage(targetGroupId, {
                    image: imageBuffer,
                    caption: giveawayText,
                    contextInfo
                })
            } else {
                await sock.sendMessage(targetGroupId, {
                    text: giveawayText,
                    contextInfo
                })
            }
            

            
            const successMsg = `✅ *ɢɪᴠᴇᴀᴡᴀʏ ᴅɪᴘᴏsᴛ*

╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」
┃ 🆔 ɪᴅ: \`${giveawayId}\`
┃ 🏠 ɢʀᴜᴘ: *${groupName}*
┃ 🎁 ᴛɪᴛʟᴇ: \`${pendingData.title}\`
┃ 🏆 ʜᴀᴅɪᴀʜ: *${pendingData.prizeName}*
┃ ⏱️ ᴅᴜʀᴀsɪ: \`${formatDuration(pendingData.duration)}\`
╰┈┈⬡

> _Giveaway berhasil diposting!_
> _Detail hadiah hanya akan dikirim ke pemenang._`
            
            await m.reply(successMsg)
            pendingGiveaway.delete(m.sender)
            m.react('🎉')
            
        } catch (error) {
            await m.reply(
                `❌ *ᴇʀʀᴏʀ*\n\n` +
                `> Gagal memposting giveaway.\n` +
                `> _${error.message}_`
            )
        }
        return
    }
    
    if (!action) {
        return m.reply(
            `🎉 *ɢɪᴠᴇᴀᴡᴀʏ sʏsᴛᴇᴍ*\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴏᴍᴍᴀɴᴅs* 」\n` +
            `┃ 🎁 \`${prefix}giveaway start\`\n` +
            `┃    _Buat giveaway (private only)_\n` +
            `┃\n` +
            `┃ 🎫 \`${prefix}giveaway join <id>\`\n` +
            `┃    _Ikut giveaway_\n` +
            `┃\n` +
            `┃ 📋 \`${prefix}giveaway list\`\n` +
            `┃    _Lihat giveaway aktif_\n` +
            `┃\n` +
            `┃ 🏁 \`${prefix}giveaway end <id>\`\n` +
            `┃    _Akhiri giveaway_\n` +
            `┃\n` +
            `┃ 🎲 \`${prefix}giveaway reroll <id>\`\n` +
            `┃    _Pilih ulang pemenang_\n` +
            `┃\n` +
            `┃ 🗑️ \`${prefix}giveaway delete <id>\`\n` +
            `┃    _Hapus giveaway_\n` +
            `┃\n` +
            `┃ 🔔 \`${prefix}giveaway notifadmin\`\n` +
            `┃    _Toggle notifikasi admin_\n` +
            `╰┈┈⬡\n\n` +
            `> _Contoh: ${prefix}giveaway start_`
        )
    }
    
    if (action === 'notifadmin') {
        if (!m.isAdmin && !m.isOwner) {
            return m.reply(`⚠️ *ᴀᴋsᴇs ᴅɪᴛᴏʟᴀᴋ*\n\n> Hanya admin yang bisa mengatur notifikasi.`)
        }
        
        const subAction = args[1]?.toLowerCase()
        const current = db.setting('giveawayNotifAdmin') ?? true
        
        if (subAction === 'on') {
            db.setting('giveawayNotifAdmin', true)
            m.react('✅')
            return m.reply(`✅ *ɴᴏᴛɪꜰ ᴀᴅᴍɪɴ ᴀᴋᴛɪꜰ*\n\n> Admin akan menerima DM pemenang giveaway.`)
        }
        
        if (subAction === 'off') {
            db.setting('giveawayNotifAdmin', false)
            m.react('❌')
            return m.reply(`❌ *ɴᴏᴛɪꜰ ᴀᴅᴍɪɴ ɴᴏɴᴀᴋᴛɪꜰ*\n\n> Admin tidak akan menerima DM pemenang.`)
        }
        
        return m.reply(
            `🔔 *ɴᴏᴛɪꜰ ᴀᴅᴍɪɴ ɢɪᴠᴇᴀᴡᴀʏ*\n\n` +
            `> Status: \`${current ? 'ON ✅' : 'OFF ❌'}\`\n\n` +
            `> \`${prefix}giveaway notifadmin on\` - Aktifkan\n` +
            `> \`${prefix}giveaway notifadmin off\` - Nonaktifkan\n\n` +
            `> _Jika aktif, admin giveaway akan\n> menerima DM daftar pemenang._`
        )
    }
    
    if (action === 'start' || action === 'create' || action === 'new') {
        if (m.isGroup) {
            return m.reply(
                `⚠️ *ᴘʀɪᴠᴀᴛᴇ ᴏɴʟʏ*\n\n` +
                `> Command ini hanya bisa digunakan di private chat.\n` +
                `> Silakan chat bot secara langsung.`
            )
        }
        
        if (!m.isAdmin && !m.isOwner) {
            return m.reply(`⚠️ *ᴀᴋsᴇs ᴅɪᴛᴏʟᴀᴋ*\n\n> Hanya admin/owner yang bisa membuat giveaway.`)
        }
        
        const fullText = m.text || args.slice(1).join(' ')
        const firstPipe = fullText.indexOf('|')
        const input = firstPipe > -1 ? fullText : args.slice(1).join(' ')
        
        if (!input || !input.includes('|')) {
            return m.reply(
                `🎉 *ʙᴜᴀᴛ ɢɪᴠᴇᴀᴡᴀʏ*\n\n` +
                `> *Format:*\n` +
                `> \`${prefix}giveaway start <title>|<desk>|<pemenang>|<durasi>|<nama_hadiah>|<detail_hadiah>\`\n\n` +
                `> *Contoh:*\n` +
                `> \`${prefix}giveaway start Event FF|Spesial merdeka|1|1d|Akun Free Fire|Email: xxx@mail.com\nPassword: 123456\`\n\n` +
                `> *Format Durasi:*\n` +
                `> \`1m\` = 1 menit, \`1h\` = 1 jam, \`1d\` = 1 hari\n\n` +
                `> *Note:*\n` +
                `> - nama_hadiah: tampil di grup (publik)\n` +
                `> - detail_hadiah: hanya dikirim ke pemenang (rahasia)`
            )
        }
        
        const parts = input.split('|')
        
        if (parts.length < 6) {
            return m.reply(
                `⚠️ *ᴠᴀʟɪᴅᴀsɪ ɢᴀɢᴀʟ*\n\n` +
                `> Format tidak lengkap!\n` +
                `> Butuh 6 parameter:\n` +
                `> \`title|desk|pemenang|durasi|nama_hadiah|detail_hadiah\`\n\n` +
                `> - nama_hadiah: tampil di grup\n` +
                `> - detail_hadiah: rahasia untuk pemenang`
            )
        }
        
        const title = parts[0].trim()
        const description = parts[1].trim()
        const winnersStr = parts[2].trim()
        const timeStr = parts[3].trim()
        const prizeName = parts[4].trim()
        
        const firstFiveParts = parts.slice(0, 5).join('|')
        const prizeDetailsRaw = input.substring(firstFiveParts.length + 1)
        const prizeDetails = prizeDetailsRaw.trim() || 'Hubungi admin untuk detail'
        
        const winners = parseInt(winnersStr)
        const duration = parseTime(timeStr)
        
        if (isNaN(winners) || winners < 1) {
            return m.reply(
                `⚠️ *ᴠᴀʟɪᴅᴀsɪ ɢᴀɢᴀʟ*\n\n` +
                `> Jumlah pemenang harus angka minimal 1!`
            )
        }
        
        if (duration <= 0) {
            return m.reply(
                `⚠️ *ᴠᴀʟɪᴅᴀsɪ ɢᴀɢᴀʟ*\n\n` +
                `> Format durasi salah!\n` +
                `> Gunakan: \`1m\`, \`1h\`, atau \`1d\``
            )
        }
        
        pendingGiveaway.set(m.sender, {
            title,
            prizeName,
            prizeDetails,
            description,
            winners,
            duration,
            adminJid: m.sender,
            timestamp: Date.now()
        })
        
        try {
            global.isFetchingGroups = true
            const groups = await sock.groupFetchAllParticipating()
            global.isFetchingGroups = false
            const groupList = Object.entries(groups)
            
            if (groupList.length === 0) {
                pendingGiveaway.delete(m.sender)
                return m.reply(`⚠️ *Bot tidak berada di grup manapun.*`)
            }
            
            const groupRows = groupList.map(([id, meta]) => ({
                title: meta.subject || 'Unknown Group',
                description: `${meta.participants?.length || 0} members`,
                id: `${prefix}giveaway --confirm ${id}`
            }))
            
            const thumbnail = loadGiveawayImageOnce()

await sock.sendButton(
    m.chat,
    thumbnail,
    `🎉 *ᴘɪʟɪʜ ɢʀᴜᴘ ᴜɴᴛᴜᴋ ɢɪᴠᴇᴀᴡᴀʏ*\n\n` +
    `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
    `┃ 🎁 ᴛɪᴛʟᴇ: \`${title}\`\n` +
    `┃ 🏆 ʜᴀᴅɪᴀʜ: *${prizeName}*\n` +
    `┃ 👥 ᴘᴇᴍᴇɴᴀɴɢ: \`${winners} orang\`\n` +
    `┃ ⏱️ ᴅᴜʀᴀsɪ: \`${formatDuration(duration)}\`\n` +
    `╰┈┈⬡\n\n` +
    `> Total Grup: *${groupList.length}*\n` +
    `> _Pilih grup dari daftar di bawah:_`,
    m,
    {
        type: 'image',
        contextInfo: {
            isForwarded: true,
            forwardingScore: 999,
            forwardedNewsletterMessageInfo: {
                newsletterJid: botConfig.saluran?.id,
                newsletterName: botConfig.saluran?.name
            }
        },
        footer: botConfig.bot?.name || 'Hoshino Ai',
        buttons: [
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: '🏠 Pilih Grup Target',
                    sections: [{
                        title: 'Daftar Grup',
                        rows: groupRows
                    }]
                })
            },
            {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: '❌ Batal',
                    id: `${prefix}cancelga`
                })
            }
        ]
    }
)
            
        } catch (error) {
            pendingGiveaway.delete(m.sender)
            await m.reply(
                `❌ *ᴇʀʀᴏʀ*\n\n` +
                `> Gagal mengambil daftar grup.\n` +
                `> _${error.message}_`
            )
        }
        return
    }
    
    if (action === 'join' || action === 'ikut') {
        if (!m.isGroup) {
            return m.reply(`⚠️ *ɢʀᴜᴘ ᴏɴʟʏ*\n\n> Command ini hanya bisa di grup.`)
        }
        
        const giveawayId = args[1]?.toUpperCase()
        
        if (!giveawayId) {
            const activeGiveaways = Object.values(giveaways).filter(g => 
                g.chatId === m.chat && !g.ended && g.endTime > Date.now()
            )
            
            if (activeGiveaways.length === 0) {
                return m.reply(
                    `⚠️ *ᴛɪᴅᴀᴋ ᴀᴅᴀ ɢɪᴠᴇᴀᴡᴀʏ*\n\n` +
                    `> Tidak ada giveaway aktif di grup ini.`
                )
            }
            
            if (activeGiveaways.length === 1) {
                const ga = activeGiveaways[0]
                
                if (ga.participants.includes(m.sender)) {
                    return m.reply(
                        `⚠️ *sᴜᴅᴀʜ ᴛᴇʀᴅᴀꜰᴛᴀʀ*\n\n` +
                        `> Kamu sudah ikut giveaway ini!`
                    )
                }
                
                ga.participants.push(m.sender)
                db.setting('giveaways', giveaways)
                
                m.react('✅')
                return m.reply(
                    `✅ *ʙᴇʀʜᴀsɪʟ ɪᴋᴜᴛ!*\n\n` +
                    `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
                    `┃ 🎁 ᴛɪᴛʟᴇ: \`${ga.title}\`\n` +
                    `┃ 🏆 ʜᴀᴅɪᴀʜ: \`${ga.prize}\`\n` +
                    `┃ 👤 ᴘᴇsᴇʀᴛᴀ ᴋᴇ: \`${ga.participants.length}\`\n` +
                    `╰┈┈⬡\n\n` +
                    `> _Good luck! 🍀_`
                )
            }
            
            return m.reply(
                `⚠️ *ᴘɪʟɪʜ ɢɪᴠᴇᴀᴡᴀʏ*\n\n` +
                `> Ada ${activeGiveaways.length} giveaway aktif.\n` +
                `> Gunakan: \`${prefix}giveaway join <id>\``
            )
        }
        
        const giveaway = giveaways[giveawayId]
        
        if (!giveaway) {
            return m.reply(
                `⚠️ *ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ*\n\n` +
                `> Giveaway dengan ID \`${giveawayId}\` tidak ditemukan.`
            )
        }
        
        if (giveaway.chatId !== m.chat) {
            return m.reply(
                `⚠️ *ɢɪᴠᴇᴀᴡᴀʏ ʙᴜᴋᴀɴ ᴅɪ ɢʀᴜᴘ ɪɴɪ*\n\n` +
                `> Giveaway ini dari grup lain.`
            )
        }
        
        if (giveaway.ended) {
            return m.reply(
                `⚠️ *ɢɪᴠᴇᴀᴡᴀʏ ʙᴇʀᴀᴋʜɪʀ*\n\n` +
                `> Giveaway ini sudah berakhir.`
            )
        }
        
        if (giveaway.endTime < Date.now()) {
            return m.reply(
                `⚠️ *ᴡᴀᴋᴛᴜ ʜᴀʙɪs*\n\n` +
                `> Waktu giveaway sudah habis.`
            )
        }
        
        if (giveaway.participants.includes(m.sender)) {
            return m.reply(
                `⚠️ *sᴜᴅᴀʜ ᴛᴇʀᴅᴀꜰᴛᴀʀ*\n\n` +
                `> Kamu sudah ikut giveaway ini!`
            )
        }
        
        giveaway.participants.push(m.sender)
        db.setting('giveaways', giveaways)
        
        m.react('✅')
        return m.reply(
            `✅ *ʙᴇʀʜᴀsɪʟ ɪᴋᴜᴛ!*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 🎁 ᴛɪᴛʟᴇ: \`${giveaway.title}\`\n` +
            `┃ 🏆 ʜᴀᴅɪᴀʜ: \`${giveaway.prize}\`\n` +
            `┃ 👤 ᴘᴇsᴇʀᴛᴀ ᴋᴇ: \`${giveaway.participants.length}\`\n` +
            `╰┈┈⬡\n\n` +
            `> _Good luck! 🍀_`
        )
    }
    
    if (action === 'list' || action === 'cek') {
        if (!m.isGroup) {
            return m.reply(`⚠️ *ɢʀᴜᴘ ᴏɴʟʏ*\n\n> Command ini hanya bisa di grup.`)
        }
        
        const activeGiveaways = Object.values(giveaways).filter(g => 
            g.chatId === m.chat && !g.ended && g.endTime > Date.now()
        )
        
        if (activeGiveaways.length === 0) {
            return m.reply(
                `📋 *ᴅᴀꜰᴛᴀʀ ɢɪᴠᴇᴀᴡᴀʏ*\n\n` +
                `> Tidak ada giveaway aktif di grup ini.\n\n` +
                `> Buat baru: \`${prefix}giveaway start\` (di private)`
            )
        }
        
        let text = `📋 *ᴅᴀꜰᴛᴀʀ ɢɪᴠᴇᴀᴡᴀʏ ᴀᴋᴛɪꜰ*\n\n`
        
        activeGiveaways.forEach((g, i) => {
            const remaining = formatDuration(g.endTime - Date.now())
            text += `╭┈┈⬡「 ${i + 1}. *${g.title}* 」\n`
            text += `┃ 🆔 ɪᴅ: \`${g.giveawayId}\`\n`
            text += `┃ 🏆 ʜᴀᴅɪᴀʜ: \`${g.prize}\`\n`
            text += `┃ 👥 ᴘᴇsᴇʀᴛᴀ: \`${g.participants.length}\`\n`
            text += `┃ 🕕 sɪsᴀ: \`${remaining}\`\n`
            text += `╰┈┈⬡\n\n`
        })
        
        text += `> Join: \`${prefix}giveaway join <id>\``
        
        return m.reply(text)
    }
    
    if (action === 'end' || action === 'stop') {
        const giveawayId = args[1]?.toUpperCase()
        
        if (!giveawayId) {
            return m.reply(
                `⚠️ *ᴠᴀʟɪᴅᴀsɪ ɢᴀɢᴀʟ*\n\n` +
                `> Gunakan: \`${prefix}giveaway end <id>\``
            )
        }
        
        const giveaway = giveaways[giveawayId]
        
        if (!giveaway) {
            return m.reply(`⚠️ *ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ*\n\n> ID \`${giveawayId}\` tidak ditemukan.`)
        }
        
        if (giveaway.creatorId !== m.sender && !m.isOwner) {
            return m.reply(`⚠️ *ʙᴜᴋᴀɴ ᴘᴇᴍʙᴜᴀᴛ*\n\n> Hanya pembuat giveaway atau owner yang bisa mengakhiri.`)
        }
        
        if (giveaway.ended) {
            return m.reply(`⚠️ *sᴜᴅᴀʜ ʙᴇʀᴀᴋʜɪʀ*\n\n> Giveaway ini sudah berakhir.`)
        }
        
        await m.reply(`🕕 Mengakhiri giveaway dan memilih pemenang...`)
        await endGiveaway(giveawayId, sock, db)
        
        m.react('✅')
        return
    }
    
    if (action === 'reroll') {
        const giveawayId = args[1]?.toUpperCase()
        
        if (!giveawayId) {
            return m.reply(
                `⚠️ *ᴠᴀʟɪᴅᴀsɪ ɢᴀɢᴀʟ*\n\n` +
                `> Gunakan: \`${prefix}giveaway reroll <id>\``
            )
        }
        
        const giveaway = giveaways[giveawayId]
        
        if (!giveaway) {
            return m.reply(`⚠️ *ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ*\n\n> ID \`${giveawayId}\` tidak ditemukan.`)
        }
        
        if (giveaway.creatorId !== m.sender && !m.isOwner) {
            return m.reply(`⚠️ *ʙᴜᴋᴀɴ ᴘᴇᴍʙᴜᴀᴛ*\n\n> Hanya pembuat atau owner yang bisa reroll.`)
        }
        
        if (!giveaway.ended) {
            return m.reply(`⚠️ *ʙᴇʟᴜᴍ ʙᴇʀᴀᴋʜɪʀ*\n\n> Giveaway ini belum berakhir.`)
        }
        
        if (giveaway.participants.length === 0) {
            return m.reply(`⚠️ *ᴛɪᴅᴀᴋ ᴀᴅᴀ ᴘᴇsᴇʀᴛᴀ*\n\n> Tidak ada peserta untuk di-reroll.`)
        }
        
        await m.reply(`🎲 Memilih ulang pemenang...`)
        
        const winners = await selectWinners(giveaway)
        const winnerMsg = buildWinnerMessage(giveaway, winners)
        const mentions = giveaway.adminJid ? [...winners, giveaway.adminJid] : winners
        
        await sock.sendMessage(giveaway.chatId, {
            text: `🎲 *ʀᴇʀᴏʟʟ ᴘᴇᴍᴇɴᴀɴɢ*\n\n` + winnerMsg,
            mentions
        })
        
        const notifAdmin = db.setting('giveawayNotifAdmin') ?? true
        if (notifAdmin && giveaway.adminJid) {
            try {
                let winnerListText = ''
                winners.forEach((w, i) => {
                    winnerListText += `${i + 1}. @${w.split('@')[0]}\n`
                })
                
                await sock.sendMessage(giveaway.adminJid, {
                    text: `🎲 *ʀᴇʀᴏʟʟ ɢɪᴠᴇᴀᴡᴀʏ*\n\n` +
                        `> Pemenang telah di-reroll!\n\n` +
                        `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
                        `┃ 🎁 ᴛɪᴛʟᴇ: \`${giveaway.title}\`\n` +
                        `┃ 🆔 ɪᴅ: \`${giveawayId}\`\n` +
                        `╰┈┈⬡\n\n` +
                        `╭┈┈⬡「 🏅 *ᴘᴇᴍᴇɴᴀɴɢ ʙᴀʀᴜ* 」\n` +
                        `${winnerListText}╰┈┈⬡`,
                    mentions: winners
                })
            } catch (e) {}
        }
        
        giveaway.winnerList = winners
        db.setting('giveaways', giveaways)
        
        m.react('🎲')
        return
    }
    
    if (action === 'delete' || action === 'hapus') {
        const giveawayId = args[1]?.toUpperCase()
        
        if (!giveawayId) {
            return m.reply(
                `⚠️ *ᴠᴀʟɪᴅᴀsɪ ɢᴀɢᴀʟ*\n\n` +
                `> Gunakan: \`${prefix}giveaway delete <id>\``
            )
        }
        
        const giveaway = giveaways[giveawayId]
        
        if (!giveaway) {
            return m.reply(`⚠️ *ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ*\n\n> ID \`${giveawayId}\` tidak ditemukan.`)
        }
        
        if (giveaway.creatorId !== m.sender && !m.isOwner) {
            return m.reply(`⚠️ *ʙᴜᴋᴀɴ ᴘᴇᴍʙᴜᴀᴛ*\n\n> Hanya pembuat atau owner yang bisa menghapus.`)
        }
        
        delete giveaways[giveawayId]
        db.setting('giveaways', giveaways)
        
        m.react('🗑️')
        return m.reply(
            `🗑️ *ɢɪᴠᴇᴀᴡᴀʏ ᴅɪʜᴀᴘᴜs*\n\n` +
            `> ID: \`${giveawayId}\`\n` +
            `> Status: Berhasil dihapus`
        )
    }
    
    return m.reply(
        `⚠️ *ᴀᴋsɪ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ*\n\n` +
        `> Gunakan: \`${prefix}giveaway\` untuk melihat daftar command.`
    )
}

let giveawayCheckerStarted = false

function startGiveawayChecker(sock) {
    if (giveawayCheckerStarted) return
    giveawayCheckerStarted = true

    cron.schedule('*/60 * * * * *', async () => {
        try {
            const db = getDatabase()
            const giveaways = db.setting('giveaways') || {}

            for (const [id, ga] of Object.entries(giveaways)) {
                if (ga.ended) continue
                if (ga.endTime && ga.endTime <= Date.now()) {
                    await endGiveaway(id, sock, db)
                }
            }
        } catch (e) {}
    })
}

module.exports = {
    config: pluginConfig,
    handler,
    startGiveawayChecker
}