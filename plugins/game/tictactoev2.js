const { getDatabase } = require("../../src/lib/database");
const { parseMention, delay } = require("../../src/lib/functions");

const pluginConfig = {
    name: "tictactoev2",
    alias: ["tttv2", "xov2"],
    category: "game",
    description: "TicTacToe V2 — max 3 bidak per pemain, lalu pindah-pindah!",
    usage: ".tictactoev2 [room name]",
    example: ".tictactoev2",
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true,
};

// Board angka 1-9:
// 1 2 3
// 4 5 6
// 7 8 9

const boardSymbols = {
    X: "❌",
    O: "⭕",
    null: "⬜",
};

const WIN_COMBOS = [
    [0,1,2], [3,4,5], [6,7,8], // rows
    [0,3,6], [1,4,7], [2,5,8], // cols
    [0,4,8], [2,4,6],           // diagonals
]

// Adjacency: tiap cell punya tetangga 8 arah
function getAdjacent(pos) {
    const row = Math.floor(pos / 3)
    const col = pos % 3
    const result = []
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue
            const r = row + dr
            const c = col + dc
            if (r >= 0 && r < 3 && c >= 0 && c < 3) {
                result.push(r * 3 + c)
            }
        }
    }
    return result
}

class TicTacToeV2 {
    constructor(playerX, playerO) {
        this.playerX = playerX
        this.playerO = playerO
        // flat array 9 cell: null | 'X' | 'O'
        this.board = Array(9).fill(null)
        this.currentTurn = 'X'
        this.phase = 1
        this.placedX = 0
        this.placedO = 0
        this.positionHistory = []
        this.turns = 0
    }

    get currentPlayer() {
        return this.currentTurn === 'X' ? this.playerX : this.playerO
    }

    boardSnapshot() {
        return this.board.map(c => c || '.').join('')
    }

    checkWin(sym) {
        return WIN_COMBOS.some(([a,b,c]) =>
            this.board[a] === sym && this.board[b] === sym && this.board[c] === sym
        )
    }

    /**
     * Fase 1: taruh bidak di posisi 1-9 (dikonversi ke 0-8 di handler)
     */
    place(sender, pos) {
        if (this.phase !== 1) return 'phase_error'
        if (sender !== this.currentPlayer) return 'wrong_turn'
        if (pos < 0 || pos > 8) return 'invalid'
        if (this.board[pos] !== null) return 'occupied'

        const sym = this.currentTurn
        this.board[pos] = sym

        if (sym === 'X') this.placedX++
        else this.placedO++

        this.turns++
        this.currentTurn = this.currentTurn === 'X' ? 'O' : 'X'

        if (this.placedX === 3 && this.placedO === 3) this.phase = 2

        return 'ok'
    }

    /**
     * Fase 2: pindah dari pos 1-9 ke pos 1-9 (dikonversi ke 0-8 di handler)
     */
    move(sender, from, to) {
        if (this.phase !== 2) return 'phase_error'
        if (sender !== this.currentPlayer) return 'wrong_turn'
        if (from < 0 || from > 8 || to < 0 || to > 8) return 'invalid'
        if (from === to) return 'invalid'

        const sym = this.currentTurn
        if (this.board[from] !== sym) return 'not_yours'
        if (this.board[to] !== null) return 'occupied'

        this.board[from] = null
        this.board[to] = sym

        this.turns++
        this.currentTurn = this.currentTurn === 'X' ? 'O' : 'X'

        this.positionHistory.push(this.boardSnapshot())
        return 'ok'
    }

    isRepetitionDraw() {
        if (this.positionHistory.length < 5) return false
        const last = this.positionHistory[this.positionHistory.length - 1]
        return this.positionHistory.filter(s => s === last).length >= 5
    }

    get winner() {
        if (this.checkWin('X')) return this.playerX
        if (this.checkWin('O')) return this.playerO
        return null
    }
}

if (!global.tictactoev2Games) global.tictactoev2Games = {}

function isRateLimitError(error) {
    const msg = String(error?.message || '').toLowerCase()
    return msg.includes('rate-overlimit') || msg.includes('rate overlimit') || msg.includes('ratelimit') || msg.includes('rate limit')
}

function normalizeMentions(text, extra = []) {
    const parsed = parseMention(text).map(n => `${n}@s.whatsapp.net`)
    return [...new Set([...parsed, ...(extra || [])].filter(Boolean))]
}

async function sendWithRetry(action) {
    let lastError
    for (let i = 0; i < 3; i++) {
        try { return await action() }
        catch (e) {
            lastError = e
            if (!isRateLimitError(e) || i === 2) throw e
            await delay(1200 * Math.pow(2, i))
        }
    }
    throw lastError
}

async function safeReply(m, text, options = {}) {
    const mentions = normalizeMentions(text, options.mentions || [])
    try { return await sendWithRetry(() => m.reply(text, { ...options, mentions })) }
    catch (e) { if (isRateLimitError(e)) return null; throw e }
}

async function safeReact(m, emoji) {
    try { await sendWithRetry(() => m.react(emoji)) } catch {}
}

const NUM_EMOJI = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣']

function renderBoard(board) {
    const cells = board.map((cell, i) => {
        if (cell === 'X') return '❌'
        if (cell === 'O') return '⭕'
        return NUM_EMOJI[i]
    })
    return (
        `┌─────────────┐\n` +
        `│ ${cells[0]} ${cells[1]} ${cells[2]} │\n` +
        `│ ${cells[3]} ${cells[4]} ${cells[5]} │\n` +
        `│ ${cells[6]} ${cells[7]} ${cells[8]} │\n` +
        `└─────────────┘`
    )
}

function phaseLabel(phase, placedX, placedO) {
    if (phase === 1) {
        return `📍 *Fase Taruh* — ❌ ${placedX}/3  ⭕ ${placedO}/3`
    }
    return `🔀 *Fase Pindah* — gerakkan bidakmu!`
}

// ── Handler ────────────────────────────────────────────────────────────────
async function handler(m, { sock }) {
    const args = m.args || []
    const roomName = args.join(' ').trim()

    const existingRoom = Object.values(global.tictactoev2Games).find(r =>
        r.state === 'PLAYING' &&
        [r.game.playerX, r.game.playerO].includes(m.sender)
    )

    if (existingRoom) {
        return safeReply(m,
            `Muu~ kamu masih dalam game nih~ 🌸\n\n` +
            `> Selesaikan dulu atau ketik *nyerah* untuk menyerah ya~`
        )
    }

    let room = Object.values(global.tictactoev2Games).find(r =>
        r.state === 'WAITING' &&
        r.chat === m.chat &&
        (roomName ? r.name === roomName : true)
    )

    if (room) {
        room.game.playerO = m.sender
        room.state = 'PLAYING'

        const board = renderBoard(room.game.board)

        await safeReact(m, '🎮')
        await safeReply(m,
            `☆ *ᴛɪᴄ ᴛᴀᴄ ᴛᴏᴇ ᴠ2* ★\n\n` +
            `Yeay~ partner ditemukan! Ayo mulai~ ⭐\n\n` +
            `❌ @${room.game.playerX.split('@')[0]}\n` +
            `⭕ @${room.game.playerO.split('@')[0]}\n\n` +
            `${board}\n\n` +
            `${phaseLabel(1, 0, 0)}\n` +
            `> Giliran: @${room.game.currentPlayer.split('@')[0]}\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴍᴀɪɴ* 」\n` +
            `┃ Fase taruh: ketik angka *1-9*\n` +
            `┃ Fase pindah: ketik *dari to* (misal: *1 9*)\n` +
            `┃ Ketik *nyerah* untuk menyerah\n` +
            `╰┈┈┈┈┈┈┈┈⬡`,
            { mentions: [room.game.playerX, room.game.playerO] }
        )
    } else {
        const roomId = 'tttv2_' + Date.now()

        global.tictactoev2Games[roomId] = {
            id: roomId,
            chat: m.chat,
            name: roomName || null,
            game: new TicTacToeV2(m.sender, null),
            state: 'WAITING',
            createdAt: Date.now()
        }

        await safeReact(m, '🕕')
        await safeReply(m,
            `☆ *ᴛɪᴄ ᴛᴀᴄ ᴛᴏᴇ ᴠ2* ★\n\n` +
            `Room dibuat~ Menunggu partner~ 💕\n\n` +
            `> Ketik \`.tictactoev2${roomName ? ' ' + roomName : ''}\` untuk join\n` +
            `> Room expired dalam 5 menit ya~\n\n` +
            `_"Nee~ siapa yang mau main sama aku~"_ 🌸`
        )

        setTimeout(() => {
            if (global.tictactoev2Games[roomId]?.state === 'WAITING') {
                delete global.tictactoev2Games[roomId]
            }
        }, 300000)
    }
}

// ── Answer Handler ─────────────────────────────────────────────────────────
async function answerHandler(m, sock) {
    if (!m.body) return false

    const text = m.body.trim().toLowerCase()

    const room = Object.values(global.tictactoev2Games).find(r =>
        r.state === 'PLAYING' &&
        r.chat === m.chat &&
        [r.game.playerX, r.game.playerO].includes(m.sender)
    )

    if (!room) return false

    const db = getDatabase()

    // ── Nyerah ────────────────────────────────────────────────────────────
    if (['nyerah', 'surrender', 'give up'].includes(text)) {
        const winner = m.sender === room.game.playerX ? room.game.playerO : room.game.playerX
        const loser = m.sender

        const winnerData = db.getUser(winner) || {}
        winnerData.koin = (winnerData.koin || 0) + 500
        db.setUser(winner, winnerData)

        await safeReact(m, '🏳️')
        await safeReply(m,
            `🏳️ *MENYERAH!*\n\n` +
            `@${loser.split('@')[0]} menyerah~ 😔\n` +
            `@${winner.split('@')[0]} menang! +500 koin ⭐`,
            { mentions: [winner, loser] }
        )

        delete global.tictactoev2Games[room.id]
        return true
    }

    const parts = text.trim().split(/\s+/).map(Number)
    const validNumbers = parts.every(n => !isNaN(n) && n >= 1 && n <= 9)

    // ── Fase 1: taruh bidak — 1 angka ─────────────────────────────────────
    if (room.game.phase === 1 && parts.length === 1 && validNumbers) {
        const pos = parts[0] - 1
        const result = room.game.place(m.sender, pos)

        if (result === 'wrong_turn') {
            await safeReply(m, `Eeh~ bukan giliranmu nih~ Sabar ya~ 💕`)
            return true
        }
        if (result === 'occupied') {
            await safeReply(m, `Muu~ posisi itu sudah ada bidaknya~ Pilih yang lain ya~ 🌸`)
            return true
        }
        if (result === 'invalid') {
            await safeReply(m, `Nee~ angkanya harus 1-9 ya~ ✨`)
            return true
        }

        const board = renderBoard(room.game.board)
        const winner = room.game.winner
        if (winner) return await handleWin(m, room, winner, board, db)

        const isPhase2 = room.game.phase === 2

        await safeReply(m,
            `☆ *ᴛɪᴄ ᴛᴀᴄ ᴛᴏᴇ ᴠ2* ★\n\n` +
            `${board}\n\n` +
            `${phaseLabel(room.game.phase, room.game.placedX, room.game.placedO)}\n` +
            (isPhase2 ? `> 🔀 Fase pindah dimulai! Ketik *dari to* (misal: *1 5*)\n` : '') +
            `> Giliran: @${room.game.currentPlayer.split('@')[0]}`,
            { mentions: [room.game.currentPlayer] }
        )
        return true
    }

    // ── Fase 2: pindah bidak — 2 angka ────────────────────────────────────
    if (room.game.phase === 2 && parts.length === 2 && validNumbers) {
        const [from, to] = [parts[0] - 1, parts[1] - 1]
        const result = room.game.move(m.sender, from, to)

        if (result === 'wrong_turn') {
            await safeReply(m, `Eeh~ bukan giliranmu nih~ Sabar ya~ 💕`)
            return true
        }
        if (result === 'not_yours') {
            await safeReply(m, `Muu~ itu bukan bidakmu~ Pilih bidakmu sendiri ya~ 🌸`)
            return true
        }
        if (result === 'occupied') {
            await safeReply(m, `Muu~ posisi tujuan sudah ada bidaknya~ Cari yang kosong ya~ 🌸`)
            return true
        }
        if (result === 'invalid') {
            await safeReply(m, `Nee~ angkanya harus 1-9 ya~ ✨`)
            return true
        }

        const board = renderBoard(room.game.board)
        const winner = room.game.winner
        if (winner) return await handleWin(m, room, winner, board, db)

        if (room.game.isRepetitionDraw()) {
            await safeReact(m, '🤝')
            await safeReply(m,
                `🤝 *SERI!*\n\n` +
                `${board}\n\n` +
                `Wah~ posisinya berulang terus sampai 5x~ Seri aja deh! 😅💕`,
                { mentions: [room.game.playerX, room.game.playerO] }
            )
            delete global.tictactoev2Games[room.id]
            return true
        }

        await safeReply(m,
            `☆ *ᴛɪᴄ ᴛᴀᴄ ᴛᴏᴇ ᴠ2* ★\n\n` +
            `${board}\n\n` +
            `${phaseLabel(2, 3, 3)}\n` +
            `> Giliran: @${room.game.currentPlayer.split('@')[0]}`,
            { mentions: [room.game.currentPlayer] }
        )
        return true
    }

    return false
}

async function handleWin(m, room, winner, board, db) {
    const loser = winner === room.game.playerX ? room.game.playerO : room.game.playerX

    const winnerData = db.getUser(winner) || {}
    winnerData.koin = (winnerData.koin || 0) + 1000
    db.setUser(winner, winnerData)

    await safeReact(m, '🎉')
    await safeReply(m,
        `🎉 *GAME OVER!*\n\n` +
        `${board}\n\n` +
        `⭐ @${winner.split('@')[0]} menang! +1.000 koin~ Hebat banget! 💕\n` +
        `😔 @${loser.split('@')[0]} kalah~ Semangat lagi ya~`,
        { mentions: [winner, loser] }
    )

    delete global.tictactoev2Games[room.id]
    return true
}

module.exports = {
    config: pluginConfig,
    handler,
    answerHandler,
}