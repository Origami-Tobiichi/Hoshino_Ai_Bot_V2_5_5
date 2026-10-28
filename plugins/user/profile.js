const hsAsset = require('../../src/lib/assets')
const config = require('../../config')
const { getDatabase } = require('../../src/lib/database')
const fs = require('fs')

const pluginConfig = {
    name: 'profile',
    alias: ['me', 'profil', 'myprofile', 'my'],
    category: 'user',
    description: 'Melihat profil user dengan RPG stats',
    usage: '.profile [@user]',
    example: '.profile',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

function getRole(level) {
    if (level >= 100) return 'Mythic'
    if (level >= 80) return 'Legend'
    if (level >= 60) return 'Epic'
    if (level >= 40) return 'Grandmaster'
    if (level >= 20) return 'Master'
    if (level >= 10) return 'Elite'
    return 'Warrior'
}

function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B'
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num
}

function getLevelBar(current, target) {
    const totalBars = 10
    const filledBars = Math.min(Math.floor((current / target) * totalBars), totalBars)
    const emptyBars = totalBars - filledBars
    return '▰'.repeat(filledBars) + '▱'.repeat(emptyBars)
}

function formatDate(ts) {
    if (!ts) return '-'
    try {
        return new Date(ts).toLocaleDateString('id-ID', {
            day: '2-digit', month: 'long', year: 'numeric'
        })
    } catch {
        return '-'
    }
}

function formatDateTime(ts) {
    if (!ts) return '-'
    try {
        return new Date(ts).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        })
    } catch {
        return '-'
    }
}

// Hitung "sudah berapa lama jadi member" dari registeredAt sampai sekarang
function getMemberSince(registeredAt) {
    if (!registeredAt) return '-'
    try {
        const start = new Date(registeredAt).getTime()
        const now = Date.now()
        const diffMs = now - start
        const days = Math.floor(diffMs / 86400000)
        if (days < 1) return 'Hari ini'
        if (days < 30) return `${days} hari`
        const months = Math.floor(days / 30)
        if (months < 12) return `${months} bulan`
        const years = Math.floor(months / 12)
        const remMonths = months % 12
        return remMonths > 0 ? `${years} tahun ${remMonths} bulan` : `${years} tahun`
    } catch {
        return '-'
    }
}

function getGenderEmoji(gender) {
    if (!gender) return ''
    const g = gender.toLowerCase()
    if (g === 'male' || g === 'l' || g === 'laki-laki' || g === 'pria') return '♂️'
    if (g === 'female' || g === 'p' || g === 'perempuan' || g === 'wanita') return '♀️'
    return ''
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const target = m.mentionedJid?.[0] || m.quoted?.sender || m.sender

    const user = db.getUser(target) || db.setUser(target)

    if (!user.rpg) user.rpg = {}
    const userExp = user.exp || 0
    const userLevel = Math.floor(userExp / 20000) + 1
    user.rpg.level = userLevel
    user.rpg.health = user.rpg.health || 100
    user.rpg.maxHealth = 100 + (userLevel - 1) * 10
    user.rpg.mana = user.rpg.mana || 100
    user.rpg.maxMana = 100 + (userLevel - 1) * 5
    user.rpg.stamina = user.rpg.stamina || 100
    user.rpg.maxStamina = 100 + (userLevel - 1) * 5

    const levelUpExp = userLevel * 20000
    const role = getRole(userLevel)
    const isOwner = config.isOwner(target)
    const isPremium = config.isPremium(target)

    let ppMedia = null
    try {
        const ppUrl = await sock.profilePictureUrl(target, 'image')
        if (ppUrl) {
            ppMedia = { url: ppUrl }
        } else {
            throw new Error('No PP')
        }
    } catch {

        if (hsAsset.has('images/pp-kosong')) {
            ppMedia = (await hsAsset.buffer('images/pp-kosong'))
        } else {
            ppMedia = { url: 'https://i.imgur.com/TuItj4L.png' }
        }
    }

    // About/bio dari WA
    let aboutText = '-'
    try {
        const statusResult = await sock.fetchStatus(target)
        if (statusResult?.status) aboutText = statusResult.status
    } catch {
        // private/gagal, biarin default '-'
    }

    const inventoryCount = user.inventory ? Object.keys(user.inventory).length : 0
    const unlockedCount = Array.isArray(user.unlockedFeatures) ? user.unlockedFeatures.length : 0
    const accessCount = Array.isArray(user.access) ? user.access.length : 0

    let caption = `╭━━━━━━━━━━━━━━━━━╮\n`
    caption += `┃ 👤 *ᴜsᴇʀ ᴘʀᴏꜰɪʟᴇ*\n`
    caption += `╰━━━━━━━━━━━━━━━━━╯\n\n`
    caption += `🏷️ Name: *${user.name || m.pushName || 'User'}*\n`
    caption += `🆔 Tag: @${target.split('@')[0]}\n`
    caption += `📱 Nomor: *${user.number || target.split('@')[0]}*\n`
    caption += `💬 About: _${aboutText}_\n`
    caption += `👑 Status: *${isOwner ? 'Owner' : isPremium ? 'Premium' : 'Free'}*\n`
    caption += `🚫 Banned: *${user.isBanned ? 'Ya ⚠️' : 'Tidak'}*\n\n`

    // ===== DATA REGISTRASI =====
    caption += `╭┈┈⬡「 📝 *ᴅᴀᴛᴀ ʀᴇɢɪsᴛʀᴀsɪ* 」\n`
    caption += `┃ ✅ Terdaftar: *${user.isRegistered ? 'Ya' : 'Belum'}*\n`
    if (user.isRegistered) {
        caption += `┃ 🏷️ Nama Reg: *${user.regName || '-'}*\n`
        caption += `┃ 🎂 Umur: *${user.regAge || '-'} tahun*\n`
        caption += `┃ ⚧ Gender: *${user.regGender || '-'} ${getGenderEmoji(user.regGender)}*\n`
    } else {
        caption += `┃ _Belum daftar, ketik .daftar ya~_\n`
    }
    caption += `╰┈┈┈┈┈┈┈┈⬡\n\n`

    // ===== RPG STATS =====
    caption += `╭┈┈⬡「 ⚔️ *ʀᴘɢ sᴛᴀᴛs* 」\n`
    caption += `┃ 🛡️ Role: *${role}*\n`
    caption += `┃ 📊 Level: *${user.rpg.level}*\n`
    caption += `┃ 🚄 Exp: *${formatNumber(userExp)} / ${formatNumber(levelUpExp)}*\n`
    caption += `┃ ${getLevelBar(userExp, levelUpExp)}\n`
    caption += `┃\n`
    caption += `┃ ❤️ Health: *${user.rpg.health} / ${user.rpg.maxHealth}*\n`
    caption += `┃ 💧 Mana: *${user.rpg.mana} / ${user.rpg.maxMana}*\n`
    caption += `┃ ⚡ Stamina: *${user.rpg.stamina} / ${user.rpg.maxStamina}*\n`
    caption += `╰┈┈┈┈┈┈┈┈⬡\n\n`

    // ===== ASSETS =====
    caption += `╭┈┈⬡「 💰 *ᴀssᴇᴛs* 」\n`
    caption += `┃ 🪙 Koin: *Rp ${user.koin?.toLocaleString('id-ID') || 0}*\n`
    caption += `┃ 🏦 Bank: *Rp ${user.rpg.bank?.toLocaleString('id-ID') || 0}*\n`
    caption += `┃ ⚡ Energi: *${isOwner || isPremium || user.energi === -1 ? '∞ Unlimited' : user.energi}*\n`
    caption += `┃ 🎒 Item di Inventory: *${inventoryCount}*\n`
    if (user.rpg.spouse) {
        caption += `┃ 💑 Spouse: @${user.rpg.spouse.split('@')[0]}\n`
    }
    caption += `╰┈┈┈┈┈┈┈┈⬡\n\n`

    // ===== GUILD =====
caption += `╭┈┈⬡「 🏯 *ɢᴜɪʟᴅ* 」\n`
if (user.rpg?.guildId) {
    const myGuild = db.db?.data?.guilds?.[user.rpg.guildId]
    if (myGuild) {
        caption += `┃ 🏰 Nama: *${myGuild.name}*\n`
    } else {
        // guildId nyantol tapi guild-nya udah gak ada di DB
        caption += `┃ ⚠️ Guild tidak ditemukan (data stale)\n`
    }
} else {
    caption += `┃ _Belum gabung guild manapun_\n`
}
caption += `╰┈┈┈┈┈┈┈┈⬡\n\n`

    // ===== FITUR & AKSES =====
    caption += `╭┈┈⬡「 🔓 *ꜰɪᴛᴜʀ & ᴀᴋsᴇs* 」\n`
    caption += `┃ 🎁 Unlocked Features: *${unlockedCount}*\n`
    if (unlockedCount > 0) {
        caption += `┃ ${user.unlockedFeatures.slice(0, 5).join(', ')}${unlockedCount > 5 ? ', ...' : ''}\n`
    }
    caption += `┃ 🔑 Special Access: *${accessCount}*\n`
    if (accessCount > 0) {
        caption += `┃ ${user.access.slice(0, 5).join(', ')}${accessCount > 5 ? ', ...' : ''}\n`
    }
    caption += `╰┈┈┈┈┈┈┈┈⬡\n\n`

    // ===== AKTIVITAS =====
    caption += `╭┈┈⬡「 🕒 *ᴀᴋᴛɪᴠɪᴛᴀs* 」\n`
    caption += `┃ 📅 Bergabung: *${formatDate(user.registeredAt)}*\n`
    caption += `┃ ⏳ Member Sejak: *${getMemberSince(user.registeredAt)} yang lalu*\n`
    caption += `┃ 👁️ Terakhir aktif: *${formatDateTime(user.lastSeen)}*\n`
    caption += `╰┈┈┈┈┈┈┈┈⬡`

    const mentions = [target]
    if (user.rpg.spouse) mentions.push(user.rpg.spouse)

    const msgOptions = { caption, mentions }
    if (ppMedia) {
        msgOptions.image = ppMedia
    }

    await sock.sendMessage(m.chat, msgOptions, { quoted: m })
}

module.exports = {
    config: pluginConfig,
    handler
}