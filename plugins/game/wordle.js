/**
 * wordle.js — Wordle Indonesia
 * ~ Hoshino Ai Special Edition ~
 * Solo + Room Multiplayer (max 5 orang, giliran, 1 menit/giliran)
 */

const fs   = require('fs')
const path = require('path')
const { getDatabase }          = require('../../src/lib/database')
const { addExpWithLevelCheck } = require('../../src/lib/levelHelper')

const pluginConfig = {
    name: 'wordle',
    alias: ['wrdl', 'tebakkata5', 'wordlesolo'],
    category: 'game',
    description: 'Game tebak kata 5 huruf ala Wordle — Solo atau Room multiplayer!',
    usage: '.wordle | .wordle solo | .wordle buat | .wordle join | .wordle start | .wordle stop',
    example: '.wordle buat',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 1,
    isEnabled: true
}

// ── Load KBBI ─────────────────────────────────────────────────────────────────
let WORD_LIST = []
try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/data/kbbi.json'), 'utf-8'))
    WORD_LIST  = raw.filter(w => w.length === 5 && /^[a-z]+$/.test(w) && (w.match(/[aiueo]/g) || []).length >= 2)
} catch (e) {
    console.error('[Wordle] Gagal load KBBI:', e.message)
}

// ── Session stores ────────────────────────────────────────────────────────────
if (!global.wordleSessions) global.wordleSessions = new Map() // solo: key=sender
if (!global.wordleRooms)    global.wordleRooms    = new Map() // room: key=chatJid

const MAX_ATTEMPTS   = 6
const TIME_LIMIT_MS  = 10 * 60 * 1000  // solo: 10 menit
const TURN_LIMIT_MS  = 60 * 1000       // room: 1 menit/giliran
const MAX_PLAYERS    = 5

// ── Keyboard rows ─────────────────────────────────────────────────────────────
const KB_ROWS = [
    ['q','w','e','r','t','y','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l'],
    ['z','x','c','v','b','n','m']
]

// ── Evaluasi tebakan ──────────────────────────────────────────────────────────
function evaluate(guess, answer) {
    const result = Array(5).fill('❌')
    const ansArr = answer.split('')
    const used   = Array(5).fill(false)

    for (let i = 0; i < 5; i++) {
        if (guess[i] === ansArr[i]) {
            result[i] = '✅'
            used[i]   = true
        }
    }
    for (let i = 0; i < 5; i++) {
        if (result[i] === '✅') continue
        for (let j = 0; j < 5; j++) {
            if (!used[j] && guess[i] === ansArr[j]) {
                result[i] = '🟨'
                used[j]   = true
                break
            }
        }
    }
    return result
}

function updateKeyboard(keyStatus, guess, result) {
    for (let i = 0; i < 5; i++) {
        const ch  = guess[i]
        const cur = keyStatus[ch]
        if (cur === '✅') continue
        if (result[i] === '✅') { keyStatus[ch] = '✅'; continue }
        if (cur === '🟨') continue
        keyStatus[ch] = result[i]
    }
}

function renderKeyboard(keyStatus) {
    return KB_ROWS.map(row =>
        row.map(ch => {
            const s = keyStatus[ch]
            if (s === '✅') return `[${ch.toUpperCase()}✅]`
            if (s === '🟨') return `[${ch.toUpperCase()}🟨]`
            if (s === '❌') return `[${ch}]`
            return `[${ch}]`
        }).join('')
    ).join('\n')
}

function renderBoard(guesses) {
    if (!guesses.length) return '_Belum ada tebakan~_'
    return guesses.map((g, i) => {
        const letters = g.guess.split('').map((c, j) => `${g.result[j]}${c.toUpperCase()}`).join(' ')
        return `${i + 1}. ${letters}`
    }).join('\n')
}

// ── Nama pendek user ──────────────────────────────────────────────────────────
function shortName(jid) {
    return jid.split('@')[0].slice(-4)
}

// ── Render papan room ─────────────────────────────────────────────────────────
function renderRoomBoard(room) {
    const currentPlayer = room.players[room.currentTurn]
    let txt = `🔤 *ᴡᴏʀᴅʟᴇ ʀᴏᴏᴍ* — Ronde ${room.round}\n\n`

    txt += `╭┈┈⬡「 👥 *ᴘᴇᴍᴀɪɴ* 」\n`
    room.players.forEach((jid, i) => {
        const isActive = i === room.currentTurn
        const pData    = room.playerData[jid]
        const status   = pData.eliminated ? '💀' : pData.won ? '🏆' : isActive ? '🎯' : '⏳'
        txt += `┃ ${status} *...${shortName(jid)}* — ${pData.attempts}/${MAX_ATTEMPTS} giliran\n`
    })
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`

    txt += `╭┈┈⬡「 📋 *ᴘᴀᴘᴀɴ* 」\n`
    const board = renderBoard(room.sharedGuesses)
    txt += board.split('\n').map(l => `┃ ${l}`).join('\n') + '\n'
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`

    txt += `╭┈┈⬡「 ⌨️ *ᴋᴇʏʙᴏᴀʀᴅ* 」\n`
    txt += renderKeyboard(room.keyStatus).split('\n').map(l => `┃ ${l}`).join('\n') + '\n'
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`

    txt += `> 🎯 Giliran: @${currentPlayer.split('@')[0]}\n`
    txt += `> ⏱️ Waktu: *1 menit*\n\n`
    txt += `> ✅ Benar & posisi tepat | 🟨 Ada tapi salah posisi | ❌ Tidak ada`

    return { txt, mentions: room.players }
}

// ── Advance giliran ke pemain berikutnya yang belum selesai ───────────────────
function nextTurn(room) {
    const total = room.players.length
    let checked = 0
    do {
        room.currentTurn = (room.currentTurn + 1) % total
        checked++
        if (checked > total) return false // semua sudah selesai
    } while (room.playerData[room.players[room.currentTurn]].eliminated ||
             room.playerData[room.players[room.currentTurn]].won)
    return true
}

// ── Cek apakah semua pemain sudah selesai ────────────────────────────────────
function allDone(room) {
    return room.players.every(jid => room.playerData[jid].eliminated || room.playerData[jid].won)
}

// ── Timer giliran ─────────────────────────────────────────────────────────────
async function startTurnTimer(chatJid, sock) {
    const room = global.wordleRooms.get(chatJid)
    if (!room) return

    if (room.turnTimer) clearTimeout(room.turnTimer)

    room.turnTimer = setTimeout(async () => {
        const room2 = global.wordleRooms.get(chatJid)
        if (!room2) return

        const skippedJid  = room2.players[room2.currentTurn]
        const pData       = room2.playerData[skippedJid]
        pData.attempts++

        // Kalau sudah habis kesempatan → eliminate
        if (pData.attempts >= MAX_ATTEMPTS) {
            pData.eliminated = true
        }

        try {
            await sock.sendMessage(chatJid, {
                text: `⏱️ *Waktu habis!*\n\n> @${skippedJid.split('@')[0]} skip giliran~ 💨`,
                mentions: [skippedJid]
            })
        } catch {}

        if (allDone(room2)) {
            await endRoom(chatJid, sock, false)
            return
        }

        const hasNext = nextTurn(room2)
        if (!hasNext) {
            await endRoom(chatJid, sock, false)
            return
        }

        const { txt, mentions } = renderRoomBoard(room2)
        try {
            await sock.sendMessage(chatJid, { text: txt, mentions })
        } catch {}

        await startTurnTimer(chatJid, sock)
    }, TURN_LIMIT_MS)
}

// ── End room ──────────────────────────────────────────────────────────────────
async function endRoom(chatJid, sock, hasWinner) {
    const room = global.wordleRooms.get(chatJid)
    if (!room) return

    if (room.turnTimer) clearTimeout(room.turnTimer)
    global.wordleRooms.delete(chatJid)

    const db = getDatabase()
    const winners = room.players.filter(jid => room.playerData[jid].won)

    let txt = hasWinner
        ? `🎉 *ɢᴀᴍᴇ sᴇʟᴇsᴀɪ~* 🎉\n\n`
        : `💔 *ɢᴀᴍᴇ ᴏᴠᴇʀ~*\n\n`

    txt += `> Kata: *${room.word.toUpperCase()}*\n\n`
    txt += `╭┈┈⬡「 🏆 *ʜᴀsɪʟ* 」\n`

    const mentions = [...room.players]

    room.players.forEach(jid => {
        const pData = room.playerData[jid]
        const icon  = pData.won ? '🏆' : pData.eliminated ? '💀' : '😢'
        txt += `┃ ${icon} @${jid.split('@')[0]} — ${pData.attempts}/${MAX_ATTEMPTS} giliran\n`
    })
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`

    if (winners.length > 0) {
        for (const jid of winners) {
            const pData  = room.playerData[jid]
            const expGain = Math.max(10, 60 - pData.attempts * 8)
            try {
                await addExpWithLevelCheck(jid, expGain, sock, chatJid, db)
            } catch {}
            txt += `> 🌟 @${jid.split('@')[0]} +${expGain} EXP\n`
        }
    } else {
        txt += `> Tidak ada yang berhasil menebak~ Semangat lagi! 💕\n`
    }

    txt += `\n> Main lagi dengan \`.wordle buat\`~`

    try {
        await sock.sendMessage(chatJid, { text: txt, mentions })
    } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER UTAMA
// ─────────────────────────────────────────────────────────────────────────────
async function handler(m, { sock }) {
    if (!WORD_LIST.length) {
        return m.reply(`❌ *Gagal load kamus~*\n\n> File KBBI tidak ditemukan`)
    }

    const db      = getDatabase()
    const sub     = m.args?.[0]?.toLowerCase()
    const chatJid = m.chat
    const sender  = m.sender

    const soloSession = global.wordleSessions.get(sender)
    const room        = global.wordleRooms.get(chatJid)

    // ── .wordle stop ──────────────────────────────────────────────────────────
    if (sub === 'stop' || sub === 'berhenti') {
        // Solo
        if (soloSession) {
            clearTimeout(soloSession.timer)
            global.wordleSessions.delete(sender)
            return m.reply(
                `🏳️ *ɢᴀᴍᴇ ᴅɪʜᴇɴᴛɪᴋᴀɴ~*\n\n` +
                `> Kata yang benar: *${soloSession.word.toUpperCase()}*\n\n` +
                `> Semangat lagi ya~ 💕`
            )
        }
        // Room — hanya host atau owner
        if (room) {
            if (sender !== room.host && !m.isOwner) {
                return m.reply(`❌ *Hanya host yang bisa stop room~*`)
            }
            if (room.turnTimer) clearTimeout(room.turnTimer)
            global.wordleRooms.delete(chatJid)
            return m.reply(
                `🏳️ *ʀᴏᴏᴍ ᴅɪʙᴜʙᴀʀᴋᴀɴ~*\n\n` +
                `> Kata yang benar: *${room.word?.toUpperCase() || '(belum mulai)'}*\n\n` +
                `> Semangat lagi ya~ 💕`
            )
        }
        return m.reply(`❌ *Tidak ada game yang berjalan~*`)
    }

    // ── .wordle buat — buat room ──────────────────────────────────────────────
    if (sub === 'buat' || sub === 'create') {
        if (soloSession) {
            return m.reply(`❌ *Kamu masih ada game solo yang berjalan~*\n\n> Ketik \`.wordle stop\` dulu ya!`)
        }
        if (room) {
            return m.reply(`❌ *Sudah ada room di chat ini~*\n\n> Tunggu game selesai atau host stop room`)
        }

        const newRoom = {
            host:        sender,
            players:     [sender],
            status:      'WAITING', // WAITING → PLAYING
            word:        null,
            sharedGuesses: [],
            keyStatus:   {},
            currentTurn: 0,
            round:       0,
            turnTimer:   null,
            playerData:  {
                [sender]: { attempts: 0, won: false, eliminated: false }
            }
        }
        global.wordleRooms.set(chatJid, newRoom)

        return m.reply(
            `🎮 *ʀᴏᴏᴍ ᴅɪʙᴜᴀᴛ~* 🌸\n\n` +
            `╭┈┈⬡「 📋 *ɪɴꜰᴏ* 」\n` +
            `┃ 👑 ʜᴏsᴛ: @${sender.split('@')[0]}\n` +
            `┃ 👥 ᴘᴇᴍᴀɪɴ: *1/${MAX_PLAYERS}*\n` +
            `┃ ⏱️ ɢɪʟɪʀᴀɴ: *1 menit/orang*\n` +
            `┃ 🎯 ᴍᴀx: *${MAX_ATTEMPTS}x* percobaan/orang\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> Teman-teman ketik \`.wordle join\` untuk bergabung~\n` +
            `> Host ketik \`.wordle start\` jika sudah siap! 💖`,
            { mentions: [sender] }
        )
    }

    // ── .wordle join ──────────────────────────────────────────────────────────
    if (sub === 'join' || sub === 'gabung') {
        if (!room) {
            return m.reply(`❌ *Tidak ada room di chat ini~*\n\n> Buat room dengan \`.wordle buat\``)
        }
        if (room.status !== 'WAITING') {
            return m.reply(`❌ *Game sudah berjalan~*\n\n> Tunggu sampai selesai ya!`)
        }
        if (room.players.includes(sender)) {
            return m.reply(`❌ *Kamu sudah ada di room ini~*`)
        }
        if (room.players.length >= MAX_PLAYERS) {
            return m.reply(`❌ *Room penuh! Max ${MAX_PLAYERS} orang~*`)
        }
        if (soloSession) {
            return m.reply(`❌ *Kamu masih ada game solo~*\n\n> Ketik \`.wordle stop\` dulu ya!`)
        }

        room.players.push(sender)
        room.playerData[sender] = { attempts: 0, won: false, eliminated: false }

        return m.reply(
            `✅ *@${sender.split('@')[0]} bergabung!* 🌸\n\n` +
            `╭┈┈⬡「 👥 *ᴘᴇᴍᴀɪɴ* 」\n` +
            room.players.map((jid, i) => `┃ ${i + 1}. @${jid.split('@')[0]}${jid === room.host ? ' 👑' : ''}`).join('\n') + '\n' +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> *${room.players.length}/${MAX_PLAYERS}* pemain\n` +
            `> Host ketik \`.wordle start\` jika sudah siap~ 💖`,
            { mentions: room.players }
        )
    }

    // ── .wordle start ─────────────────────────────────────────────────────────
    if (sub === 'start' || sub === 'mulai') {
        if (!room) {
            return m.reply(`❌ *Tidak ada room~*\n\n> Buat dulu dengan \`.wordle buat\``)
        }
        if (sender !== room.host && !m.isOwner) {
            return m.reply(`❌ *Hanya host yang bisa start~*`)
        }
        if (room.status === 'PLAYING') {
            return m.reply(`❌ *Game sudah berjalan~*`)
        }
        if (room.players.length < 2) {
            return m.reply(`❌ *Minimal 2 pemain untuk room~*\n\n> Atau main solo langsung dengan \`.wordle\``)
        }

        room.word   = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)]
        room.status = 'PLAYING'
        room.round  = 1
        room.currentTurn = 0

        const firstPlayer = room.players[0]
        let txt = `🔤 *ɢᴀᴍᴇ ᴍᴜʟᴀɪ~* 🌸\n\n`
        txt += `╭┈┈⬡「 👥 *ᴘᴇᴍᴀɪɴ* 」\n`
        room.players.forEach((jid, i) => {
            txt += `┃ ${i + 1}. @${jid.split('@')[0]}${jid === room.host ? ' 👑' : ''}\n`
        })
        txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`
        txt += `> Kata rahasia sudah Ai pilihkan~ ✨\n`
        txt += `> Giliran pertama: @${firstPlayer.split('@')[0]}\n`
        txt += `> Setiap orang punya *1 menit* per giliran\n\n`
        txt += `> ✅ Benar & posisi tepat | 🟨 Ada tapi salah posisi | ❌ Tidak ada`

        await m.reply(txt, { mentions: room.players })
        await startTurnTimer(chatJid, sock)
        return
    }

    // ── .wordle (tanpa argumen) — solo ───────────────────────────────────────
    // ── .wordle (tanpa argumen) — tampil menu ────────────────────────────────
    if (!sub) {
        if (room && room.status === 'PLAYING') {
            return m.reply(`❌ *Ada room yang sedang berjalan di sini~*\n\n> Ketik tebakan langsung jika giliran kamu!`)
        }
        if (soloSession) {
            return m.reply(
                `⚠️ *Kamu masih ada game solo yang berjalan~*\n\n` +
                `> Ketik tebakan 5 hurufmu langsung ya!\n` +
                `> Atau \`.wordle stop\` untuk berhenti`
            )
        }

        return m.reply(
            `🔤 *ᴡᴏʀᴅʟᴇ ɪɴᴅᴏɴᴇsɪᴀ*\n\n` +
            `╭┈┈⬡「 🎮 *ᴍᴏᴅᴇ* 」\n` +
            `┃ ◦ \`.wordle solo\` — Main sendiri (10 menit)\n` +
            `┃ ◦ \`.wordle buat\` — Buat room multiplayer (max ${MAX_PLAYERS} orang)\n` +
            `┃ ◦ \`.wordle join\` — Gabung room yang ada\n` +
            `┃ ◦ \`.wordle start\` — Mulai room (host)\n` +
            `┃ ◦ \`.wordle stop\` — Hentikan game\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> _Tebak kata 5 huruf bahasa Indonesia~ 🌸_\n` +
            `> ✅ Benar & posisi tepat | 🟨 Ada tapi salah posisi | ❌ Tidak ada`
        )
    }

    // ── .wordle solo — mulai solo ─────────────────────────────────────────────
    if (sub === 'solo') {
        if (room && room.status === 'PLAYING') {
            return m.reply(`❌ *Ada room yang sedang berjalan di sini~*\n\n> Ketik tebakan langsung jika giliran kamu!`)
        }
        if (soloSession) {
            return m.reply(
                `⚠️ *Kamu masih ada game solo yang berjalan~*\n\n` +
                `> Ketik tebakan 5 hurufmu langsung ya!\n` +
                `> Atau \`.wordle stop\` untuk berhenti`
            )
        }

        const word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)]
        const newSession = {
            word,
            attempts:  0,
            guesses:   [],
            keyStatus: {},
            timer:     null,
            startedAt: Date.now()
        }

        newSession.timer = setTimeout(async () => {
            global.wordleSessions.delete(sender)
            try {
                await sock.sendMessage(chatJid, {
                    text:
                        `⏱️ *ᴡᴀᴋᴛᴜ ʜᴀʙɪs~*\n\n` +
                        `> Kata yang benar: *${word.toUpperCase()}*\n\n` +
                        `> Jangan nyerah ya, main lagi~ 💕`
                }, { quoted: m })
            } catch {}
        }, TIME_LIMIT_MS)

        global.wordleSessions.set(sender, newSession)

        return m.reply(
            `🔤 *ᴡᴏʀᴅʟᴇ ɪɴᴅᴏɴᴇsɪᴀ — sᴏʟᴏ*\n\n` +
            `Haii~! Ai udah pilihkan kata rahasia buat kamu~ ✨\n\n` +
            `╭┈┈⬡「 📋 *ᴀᴛᴜʀᴀɴ* 」\n` +
            `┃ 🔤 Tebak kata *5 huruf* bahasa Indonesia\n` +
            `┃ 🎯 *${MAX_ATTEMPTS}x* kesempatan\n` +
            `┃ ⏱️ Waktu: *10 menit*\n` +
            `┃ ✅ = Huruf benar & posisi tepat\n` +
            `┃ 🟨 = Huruf ada, posisi salah\n` +
            `┃ ❌ = Huruf tidak ada\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> Ketik tebakan pertama kamu~! 💖\n` +
            `> Ketik *"nyerah"* untuk menyerah`
        )
    }

}

// ─────────────────────────────────────────────────────────────────────────────
// ANSWER HANDLER — proses tebakan (dipanggil dari handler.js)
// ─────────────────────────────────────────────────────────────────────────────
async function answerHandler(m, sock) {
    const sender  = m.sender
    const chatJid = m.chat
    const input   = (m.body || m.text || '').trim().toLowerCase()
    if (!input) return false

    // ── ROOM mode ─────────────────────────────────────────────────────────────
    const room = global.wordleRooms.get(chatJid)
    if (room && room.status === 'PLAYING') {
        const currentPlayer = room.players[room.currentTurn]

        // Bukan giliran kamu
        if (sender !== currentPlayer) return false

        // Nyerah → skip giliran
        if (input === 'nyerah') {
            const pData = room.playerData[sender]
            pData.attempts++
            if (pData.attempts >= MAX_ATTEMPTS) pData.eliminated = true

            if (room.turnTimer) clearTimeout(room.turnTimer)

            await m.reply(`🏳️ *@${sender.split('@')[0]} menyerah di giliran ini~*`, { mentions: [sender] })

            if (allDone(room)) {
                await endRoom(chatJid, sock, false)
                return true
            }

            nextTurn(room)
            const { txt, mentions } = renderRoomBoard(room)
            await sock.sendMessage(chatJid, { text: txt, mentions })
            await startTurnTimer(chatJid, sock)
            return true
        }

        // Validasi 5 huruf
        if (!/^[a-zA-Z]{5}$/.test(input)) return false

        const guess = input.toLowerCase()

        if (!WORD_LIST.includes(guess)) {
            await m.reply(`❌ *"${guess.toUpperCase()}" tidak ada di kamus~*\n\n> Coba kata lain ya~ 💕`)
            return true
        }

        // Evaluasi
        const result = evaluate(guess, room.word)
        updateKeyboard(room.keyStatus, guess, result)
        room.sharedGuesses.push({ guess, result, by: sender })

        const pData = room.playerData[sender]
        pData.attempts++

        const isWin = result.every(r => r === '✅')

        if (isWin) {
            pData.won = true
            if (room.turnTimer) clearTimeout(room.turnTimer)

            // Cek apakah masih ada yang belum selesai
            const stillPlaying = room.players.filter(jid =>
                !room.playerData[jid].won && !room.playerData[jid].eliminated
            )

            if (stillPlaying.length === 0 || room.players.filter(p => !room.playerData[p].won).length === room.players.length - 1) {
                // Semua sudah selesai atau tinggal yang menang
                await endRoom(chatJid, sock, true)
                return true
            }

            // Masih ada yang lanjut main
            await m.reply(
                `🎉 *@${sender.split('@')[0]} berhasil menebak!* 🌸\n\n` +
                `> Kata: *${room.word.toUpperCase()}*\n` +
                `> Percobaan: *${pData.attempts}/${MAX_ATTEMPTS}*\n\n` +
                `> Game masih lanjut untuk pemain lain~`,
                { mentions: [sender] }
            )

            if (allDone(room)) {
                await endRoom(chatJid, sock, true)
                return true
            }

            nextTurn(room)
            const { txt, mentions } = renderRoomBoard(room)
            await sock.sendMessage(chatJid, { text: txt, mentions })
            await startTurnTimer(chatJid, sock)
            return true
        }

        // Habis kesempatan → eliminate
        if (pData.attempts >= MAX_ATTEMPTS) {
            pData.eliminated = true
            if (room.turnTimer) clearTimeout(room.turnTimer)

            await m.reply(
                `💀 *@${sender.split('@')[0]} kehabisan kesempatan~*\n\n` +
                `> ${MAX_ATTEMPTS}/${MAX_ATTEMPTS} sudah dipakai`,
                { mentions: [sender] }
            )

            if (allDone(room)) {
                await endRoom(chatJid, sock, false)
                return true
            }

            nextTurn(room)
            const { txt, mentions } = renderRoomBoard(room)
            await sock.sendMessage(chatJid, { text: txt, mentions })
            await startTurnTimer(chatJid, sock)
            return true
        }

        // Lanjut — tampil board update
        if (room.turnTimer) clearTimeout(room.turnTimer)
        const extra = `> Tebakan @${sender.split('@')[0]}: *${guess.toUpperCase()}* — ${result.join(' ')}`
        const { txt, mentions } = renderRoomBoard(room)
        await sock.sendMessage(chatJid, {
            text: txt + `\n\n${extra}`,
            mentions: [...mentions, sender]
        })
        await startTurnTimer(chatJid, sock)
        return true
    }

    // ── SOLO mode ─────────────────────────────────────────────────────────────
    const session = global.wordleSessions.get(sender)
    if (!session) return false

    // Nyerah
    if (input === 'nyerah') {
        clearTimeout(session.timer)
        global.wordleSessions.delete(sender)
        await m.reply(
            `🏳️ *ɴʏᴇʀᴀʜ~*\n\n` +
            `> Kata yang benar: *${session.word.toUpperCase()}*\n\n` +
            `> Jangan menyerah lain kali ya~ 💕`
        )
        return true
    }

    if (!/^[a-zA-Z]{5}$/.test(input)) return false

    const guess = input.toLowerCase()

    if (!WORD_LIST.includes(guess)) {
        await m.reply(`❌ *"${guess.toUpperCase()}" tidak ada di kamus~*\n\n> Coba kata lain ya~ 💕`)
        return true
    }

    const result = evaluate(guess, session.word)
    updateKeyboard(session.keyStatus, guess, result)
    session.guesses.push({ guess, result })
    session.attempts++

    const isWin  = result.every(r => r === '✅')
    const isLose = session.attempts >= MAX_ATTEMPTS

    if (isWin) {
        clearTimeout(session.timer)
        global.wordleSessions.delete(sender)

        const db = getDatabase()
        const expGain = Math.max(10, 60 - session.attempts * 8)
        await addExpWithLevelCheck(sender, expGain, sock, chatJid, db)

        const stars = ['🌟🌟🌟🌟🌟🌟', '🌟🌟🌟🌟🌟', '🌟🌟🌟🌟', '🌟🌟🌟', '🌟🌟', '🌟'][session.attempts - 1]
        const board = renderBoard(session.guesses)

        await m.reply(
            `🎉 *ʏᴀᴛᴛᴀ~! ʙᴇɴᴀʀ!* 🎉\n\n` +
            `> Kata: *${session.word.toUpperCase()}*\n` +
            `> Percobaan: *${session.attempts}/${MAX_ATTEMPTS}*\n` +
            `> Rating: ${stars}\n\n` +
            `╭┈┈⬡「 📋 *ʜᴀsɪʟ* 」\n` +
            board.split('\n').map(l => `┃ ${l}`).join('\n') + '\n' +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> +${expGain} EXP didapat~ 💖✨\n` +
            `> Main lagi dengan \`.wordle\`~`
        )
        return true
    }

    if (isLose) {
        clearTimeout(session.timer)
        global.wordleSessions.delete(sender)

        const board = renderBoard(session.guesses)
        await m.reply(
            `💔 *ɢᴀᴍᴇ ᴏᴠᴇʀ~*\n\n` +
            `> Kata yang benar: *${session.word.toUpperCase()}*\n\n` +
            `╭┈┈⬡「 📋 *ʜᴀsɪʟ* 」\n` +
            board.split('\n').map(l => `┃ ${l}`).join('\n') + '\n' +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> Semangat lagi ya~ 💕 Main lagi dengan \`.wordle\``
        )
        return true
    }

    // Lanjut main
    const sisa  = MAX_ATTEMPTS - session.attempts
    const board = renderBoard(session.guesses)
    let txt = `🔤 *ᴡᴏʀᴅʟᴇ sᴏʟᴏ*\n\n`
    txt += `╭┈┈⬡「 📋 *ᴘᴀᴘᴀɴ* 」\n`
    txt += board.split('\n').map(l => `┃ ${l}`).join('\n') + '\n'
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`
    txt += `╭┈┈⬡「 ⌨️ *ᴋᴇʏʙᴏᴀʀᴅ* 」\n`
    txt += renderKeyboard(session.keyStatus).split('\n').map(l => `┃ ${l}`).join('\n') + '\n'
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`
    txt += `┃ 🎯 Kesempatan tersisa: *${sisa}/${MAX_ATTEMPTS}*\n\n`
    txt += `> Tebakan ke-${session.attempts}: *${guess.toUpperCase()}* — ${result.join(' ')}\n\n`
    txt += `> Ketik tebakan selanjutnya~\n`
    txt += `> Ketik *"nyerah"* untuk menyerah\n\n`
    txt += `> ✅ Benar & posisi tepat | 🟨 Ada tapi salah posisi | ❌ Tidak ada`

    await m.reply(txt)
    return true
}

module.exports = {
    config: pluginConfig,
    handler,
    answerHandler
}