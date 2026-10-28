const { getDatabase } = require('../../src/lib/database')
const { addExpWithLevelCheck } = require('../../src/lib/levelHelper')
const { getRpgContextInfo } = require('../../src/lib/contextHelper')

// ============================================================
// idol.js — Hoshino Ai Idol Career layer (v2)
// Numpang di sistem RPG yang sudah ada (koin, exp, level, stamina),
// TIDAK bikin currency/level baru. Semua progress idol disimpan
// terpisah di user.rpg.idol supaya tidak bentrok dengan plugin lain.
// Semua fitur baru dipasang sebagai SUBCOMMAND dari .idolku
// (bukan command top-level baru) supaya tidak nambah alias/command
// yang bisa tabrakan dengan 58 file rpg/ dan plugin clan/+game/ lain.
//
// CATATAN PENTING (tolong dicek manual sebelum deploy):
// - Fitur "Idol Group" & "Global Ranking" butuh akses ke SEMUA user
//   di database. Kode ini pakai fallback defensif (getAllUsers()) yang
//   nyoba beberapa pola umum (db.getAllUsers(), db.data.users sebagai
//   object atau array). Kalau db kamu punya method resmi buat list
//   semua user, ganti isi getAllUsers() supaya makai itu langsung —
//   biar gak salah asumsi soal struktur internal db kamu.
// - Data grup disimpan di db.data.idolGroups (dibuat otomatis kalau
//   belum ada). Kalau `db.data` bukan object biasa (misal db kamu gak
//   expose `.data`), bagian group/top perlu disesuaikan.
// ============================================================

const pluginConfig = {
    name: 'idolku',
    alias: ['oshi', 'panggung', 'karirai'],
    category: 'rpg',
    description: 'Karir idol ala Hoshino Ai — stage, rank, showdown, dan lainnya',
    usage: '.idolku <profile/stage/rank/showdown/help>',
    example: '.idolku stage school',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

// ============================================================
// MASTER DATA
// ============================================================

const TIERS = [
    { name: 'Trainee', min: 0, emoji: '🌱' },
    { name: 'Rookie Idol', min: 500, emoji: '🎤' },
    { name: 'Rising Star', min: 2000, emoji: '✨' },
    { name: 'Top Idol', min: 10000, emoji: '👑' },
    { name: 'Living Legend', min: 50000, emoji: '🌟' }
]

// Concert Tour — beragam lokasi manggung, syarat tier & hadiah beda-beda
const STAGES = {
    school: {
        label: 'School Festival', emoji: '🏫', tierMin: 'Trainee', stamina: 15,
        fans: [30, 90], koin: [100, 300], exp: [20, 50], rareChance: 0.05
    },
    mall: {
        label: 'Mall Event', emoji: '🏢', tierMin: 'Rookie Idol', stamina: 25,
        fans: [80, 180], koin: [250, 550], exp: [40, 80], rareChance: 0.08
    },
    city: {
        label: 'City Festival', emoji: '🎪', tierMin: 'Rising Star', stamina: 35,
        fans: [180, 380], koin: [500, 1000], exp: [70, 130], rareChance: 0.12
    },
    dome: {
        label: 'Dome Concert', emoji: '🏟', tierMin: 'Top Idol', stamina: 50,
        fans: [400, 800], koin: [1200, 2400], exp: [150, 260], rareChance: 0.16
    },
    worldtour: {
        label: 'World Tour', emoji: '🌍', tierMin: 'Living Legend', stamina: 70,
        fans: [900, 1800], koin: [2800, 5200], exp: [300, 500], rareChance: 0.22
    }
}
const STAGE_ORDER = ['school', 'mall', 'city', 'dome', 'worldtour']

// Random Event — dirol setelah stage/audition/tv/photo selesai
const RANDOM_EVENTS = [
    {
        id: 'viral', label: '🎉 Viral', weight: 8,
        text: 'Konsermu viral di internet!',
        apply: (r) => { r.fansGain = Math.round(r.fansGain * 2.2) + 800 }
    },
    {
        id: 'sponsor', label: '💰 Sponsor', weight: 8,
        text: 'Sebuah perusahaan ingin bekerja sama.',
        apply: (r) => { r.koinGain += 3000 }
    },
    {
        id: 'sakit', label: '😷 Sakit', weight: 10,
        text: 'Suaramu sedang kurang fit.',
        apply: (r) => { r.fansGain = Math.round(r.fansGain * 0.8) }
    },
    {
        id: 'hujan', label: '🌧 Hujan', weight: 10,
        text: 'Penonton pulang lebih cepat.',
        apply: (r) => { r.fansGain = Math.round(r.fansGain * 0.6); r.koinGain = Math.round(r.koinGain * 0.6) }
    },
    {
        id: 'fanproject', label: '💖 Fan Project', weight: 8,
        text: 'Fans membuat project kejutan buat kamu!',
        apply: (r, user) => { r.fansGain += 500; user.rpg.stamina = Math.min(100, user.rpg.stamina + 10) }
    },
    {
        id: 'none', label: null, weight: 56,
        text: null,
        apply: () => {}
    }
]

// Song Collection
const SONGS = {
    starlight: { name: 'Star Light', bonusPerStar: 4 },
    ainomelody: { name: 'Ai no Melody', bonusPerStar: 4 },
    dreamsky: { name: 'Dream Sky', bonusPerStar: 4 }
}

// Costume / Idol Shop
const COSTUMES = {
    school_uniform: { name: '🌸 School Uniform', price: 2000, bonusType: 'fans', bonusPercent: 10 },
    princess_dress: { name: '👑 Princess Dress', price: 8000, bonusType: 'performance', bonusPercent: 15 },
    galaxy_idol: { name: '✨ Galaxy Idol', price: 25000, bonusType: 'all', bonusPercent: 10 }
}

// Oshi System — buff kecil, dipilih sekali (bisa ganti kapan saja)
const OSHI_LIST = {
    ai: { name: 'Ai', buff: 'fans', percent: 8 },
    ruby: { name: 'Ruby', buff: 'exp', percent: 8 },
    kana: { name: 'Kana', buff: 'performance', percent: 8 },
    akane: { name: 'Akane', buff: 'showdown', percent: 8 }
}

// Gacha
const GACHA_COST = 5000
const GACHA_POOL = [
    { rarity: 'Common', chance: 45, reward: () => ({ type: 'koin', amount: 800, label: '800 Koin' }) },
    { rarity: 'Rare', chance: 30, reward: () => ({ type: 'costume', id: 'school_uniform', label: COSTUMES.school_uniform.name }) },
    { rarity: 'Epic', chance: 17, reward: () => ({ type: 'costume', id: 'princess_dress', label: COSTUMES.princess_dress.name }) },
    { rarity: 'Legendary', chance: 6, reward: () => ({ type: 'costume', id: 'galaxy_idol', label: COSTUMES.galaxy_idol.name }) },
    { rarity: 'Mythic', chance: 2, reward: () => ({ type: 'title', label: 'Legendary Performer (title)' }) }
]

// Achievements
const ACHIEVEMENTS = [
    { id: 'first_stage', label: '🎖 First Stage', desc: 'Main konser pertama.', cond: (u) => u.rpg.idol.totalStages >= 1, fans: 50, koin: 500 },
    { id: 'rising_idol', label: '🎖 Rising Idol', desc: '5.000 Fans.', cond: (u) => u.rpg.idol.fans >= 5000, fans: 200, koin: 1000 },
    { id: 'super_idol', label: '🎖 Super Idol', desc: '50.000 Fans.', cond: (u) => u.rpg.idol.fans >= 50000, fans: 1000, koin: 5000 },
    { id: 'performer', label: '🎖 Performer', desc: '100 kali konser.', cond: (u) => u.rpg.idol.totalStages >= 100, fans: 500, koin: 3000 },
    { id: 'champion', label: '🎖 Champion', desc: 'Menang showdown 50 kali.', cond: (u) => u.rpg.idol.showdownWins >= 50, fans: 800, koin: 4000 }
]

// Daily Mission pool
const DAILY_MISSION_POOL = [
    { id: 'stage3', label: 'Manggung 3 kali', type: 'stage', target: 3, rewardText: '500 Fans', apply: (u) => { u.rpg.idol.fans += 500 } },
    { id: 'showdown_win1', label: 'Menang showdown', type: 'showdown_win', target: 1, rewardText: '3000 Koin', apply: (u, db, jid) => { db.updateKoin(jid, 3000) } },
    { id: 'audition2', label: 'Audisi 2 kali', type: 'audition', target: 2, rewardText: '100 EXP', apply: null } // exp diberikan lewat addExpWithLevelCheck di caller
]

// ============================================================
// HELPERS
// ============================================================

function getTier(fans) {
    let current = TIERS[0]
    for (const t of TIERS) if (fans >= t.min) current = t
    return current
}
function getTierIndex(tierName) { return TIERS.findIndex(t => t.name === tierName) }
function getNextTier(fans) { return TIERS.find(t => t.min > fans) || null }

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function todayStr() {
    const d = new Date()
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function ensureIdol(user) {
    if (!user.rpg) user.rpg = {}
    if (user.rpg.stamina === undefined) user.rpg.stamina = 100
    if (!user.rpg.idol) user.rpg.idol = {}
    const idol = user.rpg.idol
    if (idol.fans === undefined) idol.fans = 0
    if (idol.loyalty === undefined) idol.loyalty = 50
    if (!idol.songsOwned) idol.songsOwned = {}       // { starlight: { stars: 1 } }
    if (!idol.costumesOwned) idol.costumesOwned = [] // ids
    if (idol.costumeWorn === undefined) idol.costumeWorn = null
    if (idol.oshi === undefined) idol.oshi = null
    if (!idol.stats) idol.stats = { vocal: 0, dance: 0, performance: 0, charm: 0 }
    if (!idol.achievements) idol.achievements = []
    if (idol.totalStages === undefined) idol.totalStages = 0
    if (idol.showdownWins === undefined) idol.showdownWins = 0
    if (idol.showdownLosses === undefined) idol.showdownLosses = 0
    if (!idol.dailyMission) idol.dailyMission = null
    if (idol.groupName === undefined) idol.groupName = null
    return user
}

function getAllUsers(db) {
    try {
        let raw = null
        if (typeof db.getAllUsers === 'function') raw = db.getAllUsers()
        else if (db.data && db.data.users) raw = db.data.users
        if (!raw) return null
        return Array.isArray(raw) ? raw : Object.values(raw)
    } catch (e) { /* fall through */ }
    return null // null = tidak bisa diakses
}

// Data grup disimpan lewat db.setting() (persisted ke settings.json, sudah
// otomatis kena markDirty tiap kali di-set ulang) supaya beneran tersimpan
// dan gak hilang pas bot restart.
function getGroupStore(db) {
    if (typeof db.setting !== 'function') return null
    let store = db.setting('idolGroups')
    if (!store || typeof store !== 'object') {
        store = {}
        db.setting('idolGroups', store)
    }
    return store
}
function persistGroupStore(db, store) {
    db.setting('idolGroups', store)
}

// Bonus fans dari lagu ter-favorit (paling banyak dipakai) yang dimiliki
function songBonusPercent(idol) {
    let best = 0
    for (const id in idol.songsOwned) {
        const stars = idol.songsOwned[id].stars || 1
        const bonus = stars * (SONGS[id]?.bonusPerStar || 0)
        if (bonus > best) best = bonus
    }
    return best
}

function costumeBonus(idol, type) {
    if (!idol.costumeWorn) return 0
    const c = COSTUMES[idol.costumeWorn]
    if (!c) return 0
    if (c.bonusType === 'all' || c.bonusType === type) return c.bonusPercent
    return 0
}

function oshiBonus(idol, type) {
    if (!idol.oshi) return 0
    const o = OSHI_LIST[idol.oshi]
    if (!o) return 0
    return o.buff === type ? o.percent : 0
}

function applyLoyaltyMultiplier(value, loyalty) {
    // loyalty 0-100, 50 = netral. tiap 10 poin di atas 50 = +2% reward, di bawah = -2%
    const diff = (loyalty - 50) / 10
    return Math.round(value * (1 + diff * 0.02))
}

function rollRandomEvent() {
    const total = RANDOM_EVENTS.reduce((s, e) => s + e.weight, 0)
    let r = Math.random() * total
    for (const ev of RANDOM_EVENTS) {
        if (r < ev.weight) return ev
        r -= ev.weight
    }
    return RANDOM_EVENTS[RANDOM_EVENTS.length - 1]
}

// Terapkan semua bonus (song, costume, oshi, loyalty) ke hasil mentah
function finalizeReward(user, rawFans, rawKoin, rawExp, activityType) {
    const idol = user.rpg.idol
    let fansGain = rawFans
    let koinGain = rawKoin
    let expGain = rawExp

    const bonusPct = songBonusPercent(idol) + costumeBonus(idol, 'fans') + oshiBonus(idol, 'fans')
    fansGain = Math.round(fansGain * (1 + bonusPct / 100))

    const expBonusPct = oshiBonus(idol, 'exp')
    expGain = Math.round(expGain * (1 + expBonusPct / 100))

    fansGain = applyLoyaltyMultiplier(fansGain, idol.loyalty)
    koinGain = applyLoyaltyMultiplier(koinGain, idol.loyalty)

    const result = { fansGain, koinGain, expGain, eventText: null }

    const ev = rollRandomEvent()
    if (ev.id !== 'none') {
        ev.apply(result, user)
        result.eventText = `${ev.label}\n${ev.text}`
    }

    // stat naik dikit sesuai aktivitas
    if (activityType === 'stage') idol.stats.performance += 1
    if (activityType === 'audition') idol.stats.vocal += 1
    if (activityType === 'tv') idol.stats.charm += 1
    if (activityType === 'photo') idol.stats.dance += 1

    return result
}

function checkAchievements(user) {
    const idol = user.rpg.idol
    const unlocked = []
    for (const ach of ACHIEVEMENTS) {
        if (!idol.achievements.includes(ach.id) && ach.cond(user)) {
            idol.achievements.push(ach.id)
            idol.fans += ach.fans
            unlocked.push(ach)
        }
    }
    return unlocked
}

function adjustLoyalty(idol, delta) {
    idol.loyalty = Math.max(0, Math.min(100, idol.loyalty + delta))
}

function ensureDailyMission(user) {
    const idol = user.rpg.idol
    const today = todayStr()
    if (!idol.dailyMission || idol.dailyMission.date !== today) {
        const pick = DAILY_MISSION_POOL[rand(0, DAILY_MISSION_POOL.length - 1)]
        idol.dailyMission = { date: today, id: pick.id, progress: 0, claimed: false }
    }
    return idol.dailyMission
}

function bumpMissionProgress(user, type) {
    const idol = user.rpg.idol
    const dm = ensureDailyMission(user)
    const def = DAILY_MISSION_POOL.find(m => m.id === dm.id)
    if (def && def.type === type && !dm.claimed) {
        dm.progress += 1
    }
}

function achievementText(list) {
    if (!list.length) return ''
    return `\n\n🏅 *ᴀᴄʜɪᴇᴠᴇᴍᴇɴᴛ ᴜɴʟᴏᴄᴋ!*\n` + list.map(a => `${a.label} — ${a.desc} (+${a.fans} fans, +${a.koin} koin)`).join('\n')
}

// ============================================================
// HANDLER
// ============================================================

async function handler(m, { sock }) {
    const db = getDatabase()
    let user = db.getUser(m.sender) || db.setUser(m.sender)
    user = ensureIdol(user)
    const idol = user.rpg.idol

    const args = m.args || []
    const sub = (args[0] || 'profile').toLowerCase()

    switch (sub) {
        case 'profile':
        case 'p': {
            const tier = getTier(idol.fans)
            const next = getNextTier(idol.fans)
            let txt = `🎙️ *ʜᴏsʜɪɴᴏ ᴀɪ ⋆ ɪᴅᴏʟ ᴘʀᴏғɪʟᴇ*\n\n`
            txt += `╭┈┈⬡「 ${tier.emoji} *${tier.name.toUpperCase()}* 」\n`
            txt += `┃ 👤 ${user.name || m.pushName || 'Unknown'}\n`
            txt += `┃ 💫 Fans: *${idol.fans.toLocaleString()}*\n`
            txt += `┃ 💖 Loyalty: *${idol.loyalty}%*\n`
            txt += `┃ 📈 Level: *${user.rpg.level || 1}*\n`
            txt += `┃ ⚡ Stamina: *${user.rpg.stamina}/100*\n`
            txt += `┃ 💰 Koin: *${(user.koin || 0).toLocaleString()}*\n`
            txt += `┃ 👗 Costume: *${idol.costumeWorn ? COSTUMES[idol.costumeWorn].name : '-'}*\n`
            txt += `┃ ⭐ Oshi: *${idol.oshi ? OSHI_LIST[idol.oshi].name : '-'}*\n`
            txt += `┃ 👥 Grup: *${idol.groupName || '-'}*\n`
            txt += `┃ 🎤 Vocal ${idol.stats.vocal} 💃 Dance ${idol.stats.dance} ✨ Perf ${idol.stats.performance} 😊 Charm ${idol.stats.charm}\n`
            if (next) {
                txt += `┃ 🎯 Menuju ${next.emoji} ${next.name}: *${(next.min - idol.fans).toLocaleString()}* fans lagi\n`
            } else {
                txt += `┃ 🏆 Tier tertinggi tercapai!\n`
            }
            txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`
            txt += `> Ketik \`${m.prefix}idolku help\` buat lihat semua command!`
            return m.reply(txt, { contextInfo: getRpgContextInfo('🎤 Hoshino Ai Idol', 'Career profile') })
        }

        case 'stage':
        case 'manggung': {
            const stageKey = (args[1] || 'school').toLowerCase()
            const stage = STAGES[stageKey]
            if (!stage) {
                return m.reply(`❌ Lokasi gak ketemu. Pilihan: ${STAGE_ORDER.join(', ')}\n> Contoh: ${m.prefix}idolku stage mall`)
            }
            const myTierIdx = getTierIndex(getTier(idol.fans).name)
            const reqTierIdx = getTierIndex(stage.tierMin)
            if (myTierIdx < reqTierIdx) {
                return m.reply(`🔒 *ᴛɪᴇʀ ʙᴇʟᴜᴍ ᴄᴜᴋᴜᴘ*\n\n> ${stage.emoji} ${stage.label} butuh tier minimal *${stage.tierMin}*.\n> Tier kamu sekarang: *${getTier(idol.fans).name}*`)
            }
            if (user.rpg.stamina < stage.stamina) {
                return m.reply(`⚡ *sᴛᴀᴍɪɴᴀ ʜᴀʙɪs*\n\n> Butuh ${stage.stamina} stamina buat manggung di ${stage.label}.\n> Stamina kamu: ${user.rpg.stamina}\n> Istirahat dulu ya~ (\`.meditation\`)`)
            }

            user.rpg.stamina -= stage.stamina
            await m.reply(`🎤 *sᴇᴅᴀɴɢ ᴍᴀɴɢɢᴜɴɢ ᴅɪ ${stage.label.toUpperCase()}...*`)
            await new Promise(r => setTimeout(r, 2000))

            const rawFans = rand(...stage.fans)
            const rawKoin = rand(...stage.koin)
            const rawExp = rand(...stage.exp)
            const result = finalizeReward(user, rawFans, rawKoin, rawExp, 'stage')

            idol.fans += result.fansGain
            idol.totalStages += 1
            if (result.fansGain > 0) adjustLoyalty(idol, 1)
            if (result.koinGain > 0) db.updateKoin(m.sender, result.koinGain)
            await addExpWithLevelCheck(sock, m, db, user, result.expGain)
            bumpMissionProgress(user, 'stage')
            const unlocked = checkAchievements(user)

            db.setUser(m.sender, { rpg: user.rpg })
            db.save()

            const lines = [
                'Wah, penonton hari ini rame banget! Terima kasih udah semangat~ ✨',
                'Panggung hari ini terasa spesial. Kalian yang bikin ini semua berarti!',
                'Fyuh, capek tapi puas! Ini semua berkat dukungan kalian~',
                'Sedikit demi sedikit, kita naik panggung yang lebih besar ya!'
            ]
            const quote = lines[rand(0, lines.length - 1)]

            let txt = `${stage.emoji} *${stage.label.toUpperCase()} ꜱᴇʟᴇꜱᴀɪ*\n\n`
            txt += `╭┈┈⬡「 💫 *ʜᴀsɪʟ* 」\n`
            txt += `┃ 💫 Fans: *+${result.fansGain}*\n`
            txt += `┃ 💰 Koin: *+${result.koinGain}*\n`
            txt += `┃ 🚄 Exp: *+${result.expGain}*\n`
            txt += `┃ ⚡ Stamina: *-${stage.stamina}*\n`
            txt += `╰┈┈┈┈┈┈┈┈⬡`
            if (result.eventText) txt += `\n\n📰 *ɪᴅᴏʟ ɴᴇᴡs*\n${result.eventText}`
            txt += `\n\n💬 _"${quote}"_\n> — Hoshino Ai`
            txt += achievementText(unlocked)
            return m.reply(txt, { contextInfo: getRpgContextInfo('🎤 Hoshino Ai Idol', 'Stage result') })
        }

        case 'audition':
        case 'audisi': {
            const staminaCost = 40
            if (user.rpg.stamina < staminaCost) {
                return m.reply(`⚡ *sᴛᴀᴍɪɴᴀ ʜᴀʙɪs*\n\n> Butuh ${staminaCost} stamina buat audisi.\n> Stamina kamu: ${user.rpg.stamina}\n> Istirahat dulu ya~ (\`.meditation\`)`)
            }
            user.rpg.stamina -= staminaCost
            await m.reply('🎬 *sᴇᴅᴀɴɢ ᴀᴜᴅɪsɪ...*')
            await new Promise(r => setTimeout(r, 2000))

            const roll = Math.random() * 100
            let tag, rawFans, rawKoin, rawExp
            if (roll <= 10) { tag = 'jackpot'; rawFans = rand(300, 700); rawKoin = rand(1000, 2500); rawExp = rand(100, 250) }
            else if (roll <= 60) { tag = 'pass'; rawFans = rand(100, 250); rawKoin = rand(300, 900); rawExp = rand(50, 130) }
            else { tag = 'fail'; rawFans = rand(0, 20); rawKoin = 0; rawExp = rand(10, 30) }

            const result = finalizeReward(user, rawFans, rawKoin, rawExp, 'audition')
            idol.fans += result.fansGain
            if (result.koinGain > 0) db.updateKoin(m.sender, result.koinGain)
            await addExpWithLevelCheck(sock, m, db, user, result.expGain)
            bumpMissionProgress(user, 'audition')
            const unlocked = checkAchievements(user)

            db.setUser(m.sender, { rpg: user.rpg })
            db.save()

            const messages = {
                jackpot: '🌟 *TALENT SCOUT TERKESAN!* Ini kesempatan besar buat kamu!',
                pass: '✅ *LOLOS AUDISI!* Kerja bagus, terus berkembang ya~',
                fail: '😢 Belum rezeki kali ini... tapi jangan menyerah, coba lagi lain waktu!'
            }

            let txt = `🎬 *ᴀᴜᴅɪsɪ sᴇʟᴇsᴀɪ*\n\n${messages[tag]}\n\n`
            txt += `╭┈┈⬡「 💫 *ʜᴀsɪʟ* 」\n`
            txt += `┃ 💫 Fans: *+${result.fansGain}*\n`
            txt += `┃ 💰 Koin: *+${result.koinGain}*\n`
            txt += `┃ 🚄 Exp: *+${result.expGain}*\n`
            txt += `┃ ⚡ Stamina: *-${staminaCost}*\n`
            txt += `╰┈┈┈┈┈┈┈┈⬡`
            if (result.eventText) txt += `\n\n📰 *ɪᴅᴏʟ ɴᴇᴡs*\n${result.eventText}`
            txt += achievementText(unlocked)
            return m.reply(txt, { contextInfo: getRpgContextInfo('🎬 Idol Audition', 'Audition result') })
        }

        case 'tv': {
            const staminaCost = 20
            if (user.rpg.stamina < staminaCost) {
                return m.reply(`⚡ Butuh ${staminaCost} stamina buat syuting TV. Stamina kamu: ${user.rpg.stamina}`)
            }
            user.rpg.stamina -= staminaCost
            const shows = ['Talk Show', 'Variety Show', 'Music Show', 'Radio']
            const show = shows[rand(0, shows.length - 1)]
            const rawFans = rand(60, 250)
            const rawKoin = rand(150, 500)
            const rawExp = rand(30, 70)
            const result = finalizeReward(user, rawFans, rawKoin, rawExp, 'tv')
            idol.fans += result.fansGain
            if (result.koinGain > 0) db.updateKoin(m.sender, result.koinGain)
            await addExpWithLevelCheck(sock, m, db, user, result.expGain)
            const unlocked = checkAchievements(user)
            db.setUser(m.sender, { rpg: user.rpg })
            db.save()

            let txt = `📺 *ᴛᴀᴍᴘɪʟ ᴅɪ ${show.toUpperCase()}*\n\n`
            txt += `┃ 💫 Fans: *+${result.fansGain}*\n┃ 💰 Koin: *+${result.koinGain}*\n┃ 🚄 Exp: *+${result.expGain}*\n┃ ⚡ Stamina: *-${staminaCost}*`
            if (result.eventText) txt += `\n\n📰 *ɪᴅᴏʟ ɴᴇᴡs*\n${result.eventText}`
            txt += achievementText(unlocked)
            return m.reply(txt, { contextInfo: getRpgContextInfo('📺 Idol TV Show', show) })
        }

        case 'photo':
        case 'photoshoot': {
            const staminaCost = 15
            if (user.rpg.stamina < staminaCost) {
                return m.reply(`⚡ Butuh ${staminaCost} stamina buat photoshoot. Stamina kamu: ${user.rpg.stamina}`)
            }
            user.rpg.stamina -= staminaCost
            const roll = Math.random() * 100
            let rawFans, tag
            if (roll <= 15) { tag = 'trending'; rawFans = rand(300, 500) }
            else if (roll <= 75) { tag = 'normal'; rawFans = rand(50, 110) }
            else { tag = 'gagal'; rawFans = 0 }
            const result = finalizeReward(user, rawFans, 0, 0, 'photo')
            idol.fans += result.fansGain
            const unlocked = checkAchievements(user)
            db.setUser(m.sender, { rpg: user.rpg })
            db.save()

            const msgs = {
                trending: '📸 *TRENDING!* Foto kamu rame dibagikan!',
                normal: '😊 Hasil fotonya bagus, fans suka~',
                gagal: '😅 Hasilnya kurang oke kali ini... tenang, gapapa!'
            }
            let txt = `📷 *ᴘʜᴏᴛᴏsʜᴏᴏᴛ*\n\n${msgs[tag]}\n\n┃ 💫 Fans: *+${result.fansGain}*\n┃ ⚡ Stamina: *-${staminaCost}*`
            if (result.eventText) txt += `\n\n📰 *ɪᴅᴏʟ ɴᴇᴡs*\n${result.eventText}`
            txt += achievementText(unlocked)
            return m.reply(txt, { contextInfo: getRpgContextInfo('📷 Idol Photoshoot', tag) })
        }

        case 'rank':
        case 'tier': {
            let txt = `🏆 *ᴛɪᴇʀ ɪᴅᴏʟ ʜᴏsʜɪɴᴏ ᴀɪ*\n\n`
            const myFans = idol.fans
            for (const t of TIERS) {
                const mark = getTier(myFans).name === t.name ? '👉' : '  '
                txt += `${mark} ${t.emoji} *${t.name}* — min ${t.min.toLocaleString()} fans\n`
            }
            txt += `\n🎪 *ʟᴏᴋᴀsɪ ᴄᴏɴᴄᴇʀᴛ*\n`
            for (const key of STAGE_ORDER) {
                const s = STAGES[key]
                txt += `${s.emoji} ${s.label} — min tier ${s.tierMin}, ${s.stamina} stamina (\`${m.prefix}idolku stage ${key}\`)\n`
            }
            return m.reply(txt)
        }

        case 'showdown':
        case 'battle': {
            const target = m.mentionedJid?.[0] || m.quoted?.sender
            if (!target) return m.reply(`❌ Tag/reply idol lain buat showdown!\n> Contoh: ${m.prefix}idolku showdown @user`)
            if (target === m.sender) return m.reply('❌ Gak bisa showdown lawan diri sendiri~')

            let rival = db.getUser(target) || db.setUser(target)
            rival = ensureIdol(rival)
            const rIdol = rival.rpg.idol

            const myScore = idol.fans + (user.rpg.level || 1) * 50 +
                (idol.stats.vocal + idol.stats.dance + idol.stats.performance + idol.stats.charm) * 15 +
                idol.fans * (oshiBonus(idol, 'showdown') / 100) +
                Math.random() * 200
            const rivalScore = rIdol.fans + (rival.rpg.level || 1) * 50 +
                (rIdol.stats.vocal + rIdol.stats.dance + rIdol.stats.performance + rIdol.stats.charm) * 15 +
                rIdol.fans * (oshiBonus(rIdol, 'showdown') / 100) +
                Math.random() * 200

            const won = myScore > rivalScore
            const bonusFans = won ? rand(30, 90) : rand(0, 15)
            idol.fans += bonusFans
            if (won) { idol.showdownWins += 1; adjustLoyalty(idol, 2) } else { idol.showdownLosses += 1; adjustLoyalty(idol, -3) }
            bumpMissionProgress(user, won ? 'showdown_win' : 'showdown_loss')
            const unlocked = checkAchievements(user)

            db.setUser(m.sender, { rpg: user.rpg })
            db.save()

            let txt = `🎭 *ɪᴅᴏʟ sʜᴏᴡᴅᴏᴡɴ*\n\n`
            txt += `${user.name || 'Kamu'} 🎤 ${idol.stats.vocal}/💃${idol.stats.dance}/✨${idol.stats.performance}/😊${idol.stats.charm}\n`
            txt += `vs\n`
            txt += `${rival.name || 'Rival'} 🎤 ${rIdol.stats.vocal}/💃${rIdol.stats.dance}/✨${rIdol.stats.performance}/😊${rIdol.stats.charm}\n\n`
            txt += won
                ? `🎉 *KAMU MENANG!* Penonton lebih memilih kamu malam ini.\n💫 Fans: *+${bonusFans}*\n💖 Loyalty +2`
                : `😢 Rival lebih memukau kali ini.\n💫 Fans: *+${bonusFans}* (partisipasi)\n💔 Loyalty -3`
            txt += achievementText(unlocked)
            return m.reply(txt, { contextInfo: getRpgContextInfo('🎭 Idol Showdown', 'Rival battle') })
        }

        case 'song': {
            const action = (args[1] || 'list').toLowerCase()
            if (action === 'list') {
                let txt = `🎵 *ᴋᴏʟᴇᴋsɪ ʟᴀɢᴜ*\n\n`
                for (const id in SONGS) {
                    const owned = idol.songsOwned[id]
                    const stars = owned ? '★'.repeat(owned.stars) + '☆'.repeat(5 - owned.stars) : 'belum dimiliki'
                    txt += `• *${SONGS[id].name}* — ${owned ? `${stars} (bonus +${owned.stars * SONGS[id].bonusPerStar}% fans)` : stars}\n`
                }
                txt += `\n> ${m.prefix}idolku song learn <nama> — pelajari lagu baru (gratis, 1x)\n> ${m.prefix}idolku song practice <nama> — naikkan popularitas (butuh 10 stamina)`
                return m.reply(txt)
            }
            if (action === 'learn' || action === 'practice') {
                const nameArg = (args.slice(2).join(' ') || args[2] || '').toLowerCase().replace(/\s+/g, '')
                const songId = Object.keys(SONGS).find(id => id === nameArg || SONGS[id].name.toLowerCase().replace(/\s+/g, '') === nameArg)
                if (!songId) return m.reply(`❌ *Ehh~* Lagu gak ketemu. Pilihan: ${Object.values(SONGS).map(s => s.name).join(', ')} 🥺`)
                if (action === 'learn') {
                    if (idol.songsOwned[songId]) return m.reply('❌ *Ehh~* Lagu ini udah kamu pelajari~ 🥺')
                    idol.songsOwned[songId] = { stars: 1 }
                    db.setUser(m.sender, { rpg: user.rpg }); db.save()
                    return m.reply(`✅ *Yatta~* Kamu mempelajari *${SONGS[songId].name}*! (★☆☆☆☆)~ ✨`)
                } else {
                    if (!idol.songsOwned[songId]) return m.reply('❌ *Ehh~* Kamu belum mempelajari lagu ini. Pakai `song learn` dulu~ 🥺')
                    if (user.rpg.stamina < 10) return m.reply('⚡ Stamina gak cukup buat latihan (butuh 10).')
                    if (idol.songsOwned[songId].stars >= 5) return m.reply('✨ Popularitas lagu ini udah maksimal!')
                    user.rpg.stamina -= 10
                    idol.songsOwned[songId].stars += 1
                    db.setUser(m.sender, { rpg: user.rpg }); db.save()
                    return m.reply(`🎶 Popularitas *${SONGS[songId].name}* naik jadi ★${idol.songsOwned[songId].stars}☆${5 - idol.songsOwned[songId].stars}!`)
                }
            }
            return m.reply(`> ${m.prefix}idolku song list/learn/practice`)
        }

        case 'shop':
        case 'idolshop': {
            let txt = `🛍 *ɪᴅᴏʟ sʜᴏᴘ*\n\n`
            for (const id in COSTUMES) {
                const c = COSTUMES[id]
                const owned = idol.costumesOwned.includes(id) ? ' ✅ dimiliki' : ''
                txt += `${c.name} — ${c.price.toLocaleString()} koin (bonus ${c.bonusType} +${c.bonusPercent}%)${owned}\n`
            }
            txt += `\n> ${m.prefix}idolku buy <nama> — beli kostum\n> ${m.prefix}idolku wear <nama> — pakai kostum`
            return m.reply(txt)
        }

        case 'buy': {
            const nameArg = (args.slice(1).join(' ') || '').toLowerCase().replace(/\s+/g, '')
            const costumeId = Object.keys(COSTUMES).find(id => id === nameArg || COSTUMES[id].name.toLowerCase().replace(/[^a-z]/g, '').includes(nameArg.replace(/[^a-z]/g, '')))
            if (!costumeId) return m.reply(`❌ *Ehh~* Kostum gak ketemu. Cek \`${m.prefix}idolku shop\``)
            if (idol.costumesOwned.includes(costumeId)) return m.reply('❌ *Ehh~* Kostum ini udah kamu punya~ 🥺')
            const c = COSTUMES[costumeId]
            if ((user.koin || 0) < c.price) return m.reply(`❌ *Ehh~* Koin kurang. Butuh ${c.price.toLocaleString()}, kamu punya ${(user.koin || 0).toLocaleString()}~ 🥺`)
            db.updateKoin(m.sender, -c.price)
            idol.costumesOwned.push(costumeId)
            db.setUser(m.sender, { rpg: user.rpg }); db.save()
            return m.reply(`✅ *Yatta~* Berhasil beli *${c.name}*! Pakai dengan \`${m.prefix}idolku wear ${costumeId}\``)
        }

        case 'wear': {
            const nameArg = (args.slice(1).join(' ') || '').toLowerCase().replace(/\s+/g, '')
            if (!nameArg) return m.reply(`> ${m.prefix}idolku wear <nama kostum>`)
            const costumeId = Object.keys(COSTUMES).find(id => id === nameArg || COSTUMES[id].name.toLowerCase().replace(/[^a-z]/g, '').includes(nameArg.replace(/[^a-z]/g, '')))
            if (!costumeId || !idol.costumesOwned.includes(costumeId)) return m.reply('❌ *Ehh~* Kamu belum punya kostum itu~ 🥺')
            idol.costumeWorn = costumeId
            db.setUser(m.sender, { rpg: user.rpg }); db.save()
            return m.reply(`👗 Sekarang kamu memakai *${COSTUMES[costumeId].name}*!`)
        }

        case 'oshi': {
            const nameArg = (args[1] || '').toLowerCase()
            if (!nameArg) {
                let txt = `⭐ *ᴏsʜɪ sʏsᴛᴇᴍ*\n\n`
                for (const id in OSHI_LIST) {
                    const o = OSHI_LIST[id]
                    txt += `${idol.oshi === id ? '👉' : '  '} *${o.name}* — bonus ${o.buff} +${o.percent}%\n`
                }
                txt += `\n> ${m.prefix}idolku oshi <nama> — pilih oshi`
                return m.reply(txt)
            }
            if (!OSHI_LIST[nameArg]) return m.reply(`❌ *Ehh~* Oshi gak ketemu. Pilihan: ${Object.keys(OSHI_LIST).join(', ')} 🥺`)
            idol.oshi = nameArg
            db.setUser(m.sender, { rpg: user.rpg }); db.save()
            return m.reply(`⭐ Oshi kamu sekarang: *${OSHI_LIST[nameArg].name}* (bonus ${OSHI_LIST[nameArg].buff} +${OSHI_LIST[nameArg].percent}%)`)
        }

        case 'gacha': {
            if ((user.koin || 0) < GACHA_COST) return m.reply(`❌ *Ehh~* Koin kurang. Gacha butuh ${GACHA_COST.toLocaleString()} koin~ 🥺`)
            db.updateKoin(m.sender, -GACHA_COST)
            const roll = Math.random() * 100
            let acc = 0, picked = GACHA_POOL[0]
            for (const p of GACHA_POOL) { acc += p.chance; if (roll <= acc) { picked = p; break } }
            const reward = picked.reward()
            let rewardText = ''
            if (reward.type === 'koin') { db.updateKoin(m.sender, reward.amount); rewardText = `+${reward.amount} koin` }
            else if (reward.type === 'costume') {
                if (!idol.costumesOwned.includes(reward.id)) idol.costumesOwned.push(reward.id)
                rewardText = reward.label
            } else { rewardText = reward.label }
            db.setUser(m.sender, { rpg: user.rpg }); db.save()
            const stars = { Common: '⭐', Rare: '⭐⭐', Epic: '⭐⭐⭐', Legendary: '⭐⭐⭐⭐', Mythic: '⭐⭐⭐⭐⭐' }[picked.rarity]
            return m.reply(`🎰 *ɪᴅᴏʟ ɢᴀᴄʜᴀ*\n\n${stars} *${picked.rarity}*\n🎁 ${rewardText}`)
        }

        case 'mission': {
            const dm = ensureDailyMission(user)
            const def = DAILY_MISSION_POOL.find(m2 => m2.id === dm.id)
            if (args[1] === 'claim') {
                if (dm.claimed) return m.reply('❌ *Ehh~* Misi hari ini udah diklaim~ 🥺')
                if (dm.progress < def.target) return m.reply(`❌ *Ehh~* Belum selesai (${dm.progress}/${def.target})~ 🥺`)
                if (def.apply) def.apply(user, db, m.sender)
                if (def.id === 'audition2') await addExpWithLevelCheck(sock, m, db, user, 100)
                dm.claimed = true
                db.setUser(m.sender, { rpg: user.rpg }); db.save()
                return m.reply(`🎉 Misi selesai! Reward: ${def.rewardText}`)
            }
            let txt = `📅 *ᴅᴀɪʟʏ ᴍɪssɪᴏɴ*\n\n🎯 ${def.label}\n📊 Progress: ${dm.progress}/${def.target}\n🎁 Reward: ${def.rewardText}\n`
            txt += dm.claimed ? '\n✅ Sudah diklaim.' : `\n> Ketik \`${m.prefix}idolku mission claim\` kalau udah selesai.`
            return m.reply(txt)
        }

        case 'achievement':
        case 'achv': {
            let txt = `🏅 *ᴀᴄʜɪᴇᴠᴇᴍᴇɴᴛ*\n\n`
            for (const a of ACHIEVEMENTS) {
                const done = idol.achievements.includes(a.id)
                txt += `${done ? '✅' : '⬜'} *${a.label}* — ${a.desc}\n`
            }
            return m.reply(txt)
        }

        case 'group': {
            const groupAction = (args[1] || '').toLowerCase()
            const store = getGroupStore(db)
            if (!store) return m.reply('❌ *Nee~* Fitur grup belum bisa dipakai (database belum support penyimpanan bersama). Hubungi owner bot~ 🥺')

            if (groupAction === 'create') {
                const groupName = args.slice(2).join(' ')
                if (!groupName) return m.reply(`> ${m.prefix}idolku group create <nama grup>`)
                if (idol.groupName) return m.reply('❌ *Ehh~* Kamu udah tergabung di grup lain. Keluar dulu~ 🥺')
                if (store[groupName]) return m.reply('❌ *Ehh~* Nama grup udah dipakai~ 🥺')
                store[groupName] = { leader: m.sender, members: [m.sender], createdAt: Date.now() }
                idol.groupName = groupName
                persistGroupStore(db, store)
                db.setUser(m.sender, { rpg: user.rpg }); db.save()
                return m.reply(`✅ *Yatta~* Grup *${groupName}* berhasil dibuat! Kamu jadi leader~ ✨`)
            }
            if (groupAction === 'invite') {
                const target = m.mentionedJid?.[0]
                if (!target) return m.reply(`> ${m.prefix}idolku group invite @user`)
                if (!idol.groupName || !store[idol.groupName]) return m.reply('❌ *Ehh~* Kamu belum punya grup~ 🥺')
                const g = store[idol.groupName]
                if (g.leader !== m.sender) return m.reply('❌ *Ehh~* Cuma leader yang bisa invite~ 🥺')
                if (g.members.length >= 4) return m.reply('❌ *Ehh~* Grup udah penuh (maks 4 orang)~ 🥺')
                if (g.members.includes(target)) return m.reply('❌ *Ehh~* Orang ini udah jadi member~ 🥺')
                let targetUser = db.getUser(target) || db.setUser(target)
                targetUser = ensureIdol(targetUser)
                if (targetUser.rpg.idol.groupName) return m.reply('❌ *Ehh~* Orang ini udah punya grup lain~ 🥺')
                g.members.push(target)
                targetUser.rpg.idol.groupName = idol.groupName
                persistGroupStore(db, store)
                db.setUser(target, { rpg: targetUser.rpg })
                db.save()
                return m.reply(`✅ *Yatta~* Berhasil invite ke grup *${idol.groupName}*~ ✨`)
            }
            if (groupAction === 'leave') {
                if (!idol.groupName || !store[idol.groupName]) return m.reply('❌ *Ehh~* Kamu gak tergabung di grup manapun~ 🥺')
                const g = store[idol.groupName]
                g.members = g.members.filter(id => id !== m.sender)
                if (g.leader === m.sender) {
                    if (g.members.length > 0) g.leader = g.members[0]
                    else delete store[idol.groupName]
                }
                idol.groupName = null
                persistGroupStore(db, store)
                db.setUser(m.sender, { rpg: user.rpg }); db.save()
                return m.reply('✅ *Yatta~* Kamu keluar dari grup~ ✨')
            }
            // default: info
            if (!idol.groupName || !store[idol.groupName]) {
                return m.reply(`👥 Kamu belum punya grup.\n\n> ${m.prefix}idolku group create <nama>\n> ${m.prefix}idolku group invite @user\n> ${m.prefix}idolku group leave`)
            }
            const g = store[idol.groupName]
            let totalFans = 0
            for (const memberId of g.members) {
                const mu = ensureIdol(db.getUser(memberId) || db.setUser(memberId))
                totalFans += mu.rpg.idol.fans
            }
            let txt = `👥 *ɢʀᴜᴘ: ${idol.groupName}*\n\n`
            txt += `👑 Leader: @${g.leader.split('@')[0]}\n`
            txt += `👤 Member (${g.members.length}/4): ${g.members.map(id => '@' + id.split('@')[0]).join(', ')}\n`
            txt += `💫 Total Fans Grup: *${totalFans.toLocaleString()}*`
            return m.reply(txt, { mentions: [g.leader, ...g.members] })
        }

        case 'top':
        case 'idoltop': {
            const allUsers = getAllUsers(db)
            if (!allUsers) return m.reply('❌ *Ehh~* Ranking global belum bisa ditampilkan (database belum expose daftar semua user)~ 🥺')
            const ranked = allUsers
                .filter(u => u.rpg?.idol?.fans)
                .sort((a, b) => b.rpg.idol.fans - a.rpg.idol.fans)
                .slice(0, 10)
            if (!ranked.length) return m.reply('Belum ada data ranking.')
            let txt = `🏆 *ᴛᴏᴘ ɪᴅᴏʟ*\n\n`
            ranked.forEach((u, i) => {
                txt += `${i + 1}. ${u.name || 'Unknown'} — ${u.rpg.idol.fans.toLocaleString()} fans\n`
            })
            return m.reply(txt)
        }

        case 'help':
        default: {
            let txt = `🎤 *ʜᴏsʜɪɴᴏ ᴀɪ ⋆ ɪᴅᴏʟ ʀᴘɢ*\n\n`
            txt += `╭┈┈⬡「 📋 *ᴄᴏᴍᴍᴀɴᴅ* 」\n`
            txt += `┃ ${m.prefix}idolku profile — cek profil idol\n`
            txt += `┃ ${m.prefix}idolku stage <lokasi> — manggung (school/mall/city/dome/worldtour)\n`
            txt += `┃ ${m.prefix}idolku audition — audisi high risk high reward\n`
            txt += `┃ ${m.prefix}idolku tv — syuting acara TV\n`
            txt += `┃ ${m.prefix}idolku photo — photoshoot\n`
            txt += `┃ ${m.prefix}idolku rank — lihat tier & lokasi concert\n`
            txt += `┃ ${m.prefix}idolku showdown @user — battle rival idol\n`
            txt += `┃ ${m.prefix}idolku song list/learn/practice — koleksi lagu\n`
            txt += `┃ ${m.prefix}idolku shop — lihat toko kostum\n`
            txt += `┃ ${m.prefix}idolku buy/wear <kostum> — beli/pakai kostum\n`
            txt += `┃ ${m.prefix}idolku oshi <nama> — pilih oshi favorit\n`
            txt += `┃ ${m.prefix}idolku gacha — gacha item (5000 koin)\n`
            txt += `┃ ${m.prefix}idolku mission — daily mission\n`
            txt += `┃ ${m.prefix}idolku achievement — daftar achievement\n`
            txt += `┃ ${m.prefix}idolku group create/invite/leave — idol group\n`
            txt += `┃ ${m.prefix}idolku top — ranking global\n`
            txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`
            txt += `> Fitur ini numpang di sistem exp/koin/stamina RPG kamu yang lama, gak bikin resource baru.`
            return m.reply(txt)
        }
    }
}

module.exports = {
    config: pluginConfig,
    handler,
    // Diekspor supaya plugin lain (misal autoaiHandler.js) bisa baca info tier
    // idol tanpa duplikasi logic. Menambah export baru, TIDAK mengubah export
    // yang sudah ada (config/handler).
    getTier,
    TIERS
}