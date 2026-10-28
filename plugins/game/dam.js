const { createCanvas } = require('@napi-rs/canvas')

const pluginConfig = {
    name: 'dam',
    alias: ['draughts', 'checkers', 'damgame'],
    category: 'game',
    description: 'Game Dam 10x10! Makan semua buah lawan untuk menang.',
    usage: '.dam [@lawan]',
    example: '.dam @user',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

// ─────────────────────────────────────────────
//  KONSTANTA
// ─────────────────────────────────────────────

const BOARD_SIZE = 10
const sessions = new Map()

// AI Config
const BOT_THINK_DEPTH = 7  // Kedalaman pencarian minimax (makin besar makin kuat, tapi lebih lambat)

// ─────────────────────────────────────────────
//  SETUP PAPAN AWAL
// ─────────────────────────────────────────────

function createBoard() {
    const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null))
    for (let r = 0; r < 4; r++)
        for (let c = 0; c < BOARD_SIZE; c++)
            if ((r + c) % 2 === 1) board[r][c] = { color: 'b', king: false }
    for (let r = 6; r < BOARD_SIZE; r++)
        for (let c = 0; c < BOARD_SIZE; c++)
            if ((r + c) % 2 === 1) board[r][c] = { color: 'w', king: false }
    return board
}

function createGame(p1, p2, firstTurn, vsBot = false, botColor = null) {
    return {
        p1, p2,
        board: createBoard(),
        turn: firstTurn,
        moveCount: 0,
        lastBoardKey: null,
        mustContinue: null,
        status: 'playing',
        vsBot,        // true jika lawan bot
        botColor      // warna bot ('w' atau 'b')
    }
}

// ─────────────────────────────────────────────
//  LOGIKA GERAK
// ─────────────────────────────────────────────

function countPieces(board, color) {
    let count = 0
    for (let r = 0; r < BOARD_SIZE; r++)
        for (let c = 0; c < BOARD_SIZE; c++)
            if (board[r][c]?.color === color) count++
    return count
}

function inBounds(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE
}

function getCaptureMoves(board, r, c) {
    const piece = board[r][c]
    if (!piece) return []
    const opp = piece.color === 'w' ? 'b' : 'w'
    const moves = []

    if (piece.king) {
        for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
            let nr = r + dr, nc = c + dc
            let foundEnemy = null
            while (inBounds(nr, nc)) {
                const cell = board[nr][nc]
                if (cell) {
                    if (cell.color === opp && !foundEnemy) {
                        foundEnemy = [nr, nc]
                    } else {
                        break
                    }
                } else if (foundEnemy) {
                    moves.push({ from: [r,c], to: [nr,nc], captured: foundEnemy })
                }
                nr += dr; nc += dc
            }
        }
    } else {
        const dirs = [[-1,-1],[-1,1],[1,-1],[1,1]]
        for (const [dr, dc] of dirs) {
            const er = r + dr, ec = c + dc
            const lr = r + 2*dr, lc = c + 2*dc
            if (inBounds(er, ec) && inBounds(lr, lc)) {
                if (board[er][ec]?.color === opp && !board[lr][lc]) {
                    moves.push({ from: [r,c], to: [lr,lc], captured: [er,ec] })
                }
            }
        }
    }
    return moves
}

function getNormalMoves(board, r, c) {
    const piece = board[r][c]
    if (!piece) return []
    const moves = []

    if (piece.king) {
        for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
            let nr = r + dr, nc = c + dc
            while (inBounds(nr, nc) && !board[nr][nc]) {
                moves.push({ from: [r,c], to: [nr,nc], captured: null })
                nr += dr; nc += dc
            }
        }
    } else {
        const dirs = piece.color === 'w' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]]
        for (const [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc
            if (inBounds(nr, nc) && !board[nr][nc]) {
                moves.push({ from: [r,c], to: [nr,nc], captured: null })
            }
        }
    }
    return moves
}

function getAllCaptures(board, color) {
    const all = []
    for (let r = 0; r < BOARD_SIZE; r++)
        for (let c = 0; c < BOARD_SIZE; c++)
            if (board[r][c]?.color === color)
                all.push(...getCaptureMoves(board, r, c))
    return all
}

function getAllMoves(board, color, mustContinue = null) {
    if (mustContinue) {
        return getCaptureMoves(board, mustContinue[0], mustContinue[1])
    }
    const captures = getAllCaptures(board, color)
    if (captures.length > 0) return captures
    const normals = []
    for (let r = 0; r < BOARD_SIZE; r++)
        for (let c = 0; c < BOARD_SIZE; c++)
            if (board[r][c]?.color === color)
                normals.push(...getNormalMoves(board, r, c))
    return normals
}

function applyMove(board, move) {
    const newBoard = board.map(row => row.map(cell => cell ? { ...cell } : null))
    const [fr, fc] = move.from
    const [tr, tc] = move.to
    const piece = { ...newBoard[fr][fc] }

    newBoard[fr][fc] = null
    newBoard[tr][tc] = piece

    if (move.captured) {
        const [er, ec] = move.captured
        newBoard[er][ec] = null
    }

    let promoted = false
    if (!piece.king) {
        if (piece.color === 'w' && tr === 0) { newBoard[tr][tc].king = true; promoted = true }
        if (piece.color === 'b' && tr === BOARD_SIZE - 1) { newBoard[tr][tc].king = true; promoted = true }
    }

    let canContinue = false
    if (move.captured && !promoted) {
        const further = getCaptureMoves(newBoard, tr, tc)
        canContinue = further.length > 0
    }

    return { newBoard, promoted, canContinue }
}

// ─────────────────────────────────────────────
//  AI ENGINE (Minimax + Alpha-Beta Pruning)
// ─────────────────────────────────────────────

/**
 * Evaluasi posisi papan dari sudut pandang 'color'
 * Skor positif = menguntungkan untuk color tersebut
 */
function evaluateBoard(board, color) {
    const opp = color === 'w' ? 'b' : 'w'
    let score = 0

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const p = board[r][c]
            if (!p) continue

            let val = 0
            if (p.king) {
                val = 9  // Dam bernilai tinggi
            } else {
                val = 3  // Buah biasa
                // Bonus maju ke depan (mendekati promosi)
                if (p.color === 'w') val += (BOARD_SIZE - 1 - r) * 0.1
                else val += r * 0.1

                // Bonus posisi tengah (lebih fleksibel)
                const centerDist = Math.abs(c - 4.5)
                val += (4.5 - centerDist) * 0.05

                // Bonus baris belakang terlindungi
                if (p.color === 'w' && r === BOARD_SIZE - 1) val += 0.5
                if (p.color === 'b' && r === 0) val += 0.5
            }

            if (p.color === color) score += val
            else score -= val
        }
    }

    // Bonus mobilitas (langkah yang tersedia)
    const myMoves = getAllMoves(board, color).length
    const oppMoves = getAllMoves(board, opp).length
    score += (myMoves - oppMoves) * 0.1

    return score
}

/**
 * Minimax dengan Alpha-Beta Pruning
 * Mengembalikan skor terbaik
 */
function minimax(board, depth, alpha, beta, isMaximizing, botColor, mustContinue = null) {
    const currentColor = isMaximizing ? botColor : (botColor === 'w' ? 'b' : 'w')
    const moves = getAllMoves(board, currentColor, mustContinue)

    // Terminal node
    if (depth === 0 || moves.length === 0) {
        if (moves.length === 0) {
            // Tidak bisa gerak = kalah
            return isMaximizing ? -10000 : 10000
        }
        return evaluateBoard(board, botColor)
    }

    if (isMaximizing) {
        let maxEval = -Infinity
        for (const move of moves) {
            const { newBoard, canContinue } = applyMove(board, move)
            let evalScore
            if (canContinue) {
                // Giliran masih bot (multi-jump)
                evalScore = minimax(newBoard, depth - 1, alpha, beta, true, botColor, [move.to[0], move.to[1]])
            } else {
                evalScore = minimax(newBoard, depth - 1, alpha, beta, false, botColor, null)
            }
            maxEval = Math.max(maxEval, evalScore)
            alpha = Math.max(alpha, evalScore)
            if (beta <= alpha) break  // Alpha-beta pruning
        }
        return maxEval
    } else {
        let minEval = Infinity
        for (const move of moves) {
            const { newBoard, canContinue } = applyMove(board, move)
            let evalScore
            if (canContinue) {
                // Giliran masih lawan (multi-jump)
                evalScore = minimax(newBoard, depth - 1, alpha, beta, false, botColor, [move.to[0], move.to[1]])
            } else {
                evalScore = minimax(newBoard, depth - 1, alpha, beta, true, botColor, null)
            }
            minEval = Math.min(minEval, evalScore)
            beta = Math.min(beta, evalScore)
            if (beta <= alpha) break  // Alpha-beta pruning
        }
        return minEval
    }
}

/**
 * Pilih langkah terbaik untuk bot
 * Mengembalikan move object terbaik
 */
function getBotMove(board, botColor, mustContinue = null) {
    const moves = getAllMoves(board, botColor, mustContinue)
    if (moves.length === 0) return null
    if (moves.length === 1) return moves[0]  // Hanya 1 pilihan, langsung ambil

    let bestMove = null
    let bestScore = -Infinity

    // Iterative deepening sederhana dengan time limit
    const depth = BOT_THINK_DEPTH

    for (const move of moves) {
        const { newBoard, canContinue } = applyMove(board, move)
        let score
        if (canContinue) {
            score = minimax(newBoard, depth - 1, -Infinity, Infinity, true, botColor, [move.to[0], move.to[1]])
        } else {
            score = minimax(newBoard, depth - 1, -Infinity, Infinity, false, botColor, null)
        }

        if (score > bestScore) {
            bestScore = score
            bestMove = move
        }
    }

    return bestMove
}

// ─────────────────────────────────────────────
//  RENDER PAPAN
// ─────────────────────────────────────────────

async function renderBoard(game, highlightMoves = []) {
    const CELL = 52
    const PAD = 30
    const SIZE = BOARD_SIZE * CELL + PAD * 2
    const canvas = createCanvas(SIZE, SIZE + 40)
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, SIZE, SIZE + 40)

    ctx.fillStyle = '#aaaaaa'
    ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < BOARD_SIZE; i++) {
        ctx.fillText(String.fromCharCode(65 + i), PAD + i * CELL + CELL / 2, 15)
        ctx.fillText((BOARD_SIZE - i).toString(), 15, PAD + i * CELL + CELL / 2)
    }

    const hlSet = new Set(highlightMoves.map(([r,c]) => `${r},${c}`))

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const x = PAD + c * CELL
            const y = PAD + r * CELL
            const isDark = (r + c) % 2 === 1

            if (hlSet.has(`${r},${c}`)) {
                ctx.fillStyle = '#f6f669'
            } else {
                ctx.fillStyle = isDark ? '#769656' : '#eeeed2'
            }
            ctx.fillRect(x, y, CELL, CELL)

            const piece = game.board[r][c]
            if (piece) {
                const cx = x + CELL / 2
                const cy = y + CELL / 2
                const radius = CELL * 0.38

                ctx.beginPath()
                ctx.arc(cx + 2, cy + 2, radius, 0, Math.PI * 2)
                ctx.fillStyle = 'rgba(0,0,0,0.4)'
                ctx.fill()

                ctx.beginPath()
                ctx.arc(cx, cy, radius, 0, Math.PI * 2)
                ctx.fillStyle = piece.color === 'w' ? '#f0d9b5' : '#2d2d2d'
                ctx.fill()
                ctx.strokeStyle = piece.color === 'w' ? '#c8a96e' : '#555555'
                ctx.lineWidth = 2
                ctx.stroke()

                if (piece.king) {
                    ctx.fillStyle = piece.color === 'w' ? '#e6a800' : '#ffd700'
                    ctx.font = `bold ${Math.floor(CELL * 0.38)}px sans-serif`
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    ctx.fillText('♛', cx, cy)
                }
            }
        }
    }

    ctx.strokeStyle = '#4a4a6a'
    ctx.lineWidth = 2
    ctx.strokeRect(PAD, PAD, BOARD_SIZE * CELL, BOARD_SIZE * CELL)

    const wCount = countPieces(game.board, 'w')
    const bCount = countPieces(game.board, 'b')
    const turnColor = game.turn === 'p1' ? 'Putih ⬜' : 'Hitam ⬛'
    const turnName = game.turn === 'p1' ? game.p1.split('@')[0] : game.p2.split('@')[0]

    ctx.fillStyle = '#cccccc'
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    let infoText = `${turnColor} (${turnName}) | ⬜${wCount} vs ⬛${bCount} | Move #${game.moveCount + 1}`
    if (game.vsBot) {
        const botTurn = (game.turn === 'p1' && game.botColor === 'w') || (game.turn === 'p2' && game.botColor === 'b')
        if (botTurn) infoText = `🤖 Bot sedang berpikir... | ⬜${wCount} vs ⬛${bCount}`
    }

    ctx.fillText(infoText, SIZE / 2, SIZE + 20)

    return canvas.toBuffer('image/png')
}

// ─────────────────────────────────────────────
//  PARSE NOTASI
// ─────────────────────────────────────────────

function parseNotation(str) {
    if (!str || str.length < 2) return null
    const col = str[0].toUpperCase().charCodeAt(0) - 65
    const row = BOARD_SIZE - parseInt(str.slice(1))
    if (isNaN(row) || col < 0 || col >= BOARD_SIZE || row < 0 || row >= BOARD_SIZE) return null
    return [row, col]
}

function toNotation(r, c) {
    return String.fromCharCode(65 + c) + (BOARD_SIZE - r)
}

// ─────────────────────────────────────────────
//  BOT HANDLER — eksekusi giliran bot & kirim pesan
// ─────────────────────────────────────────────

async function executeBotTurn(chatId, game, sock, m, prefix) {
    const botColor = game.botColor
    const humanId = game.p1 === sock.user?.id.replace(/:\d+/, '') + '@s.whatsapp.net'
        ? game.p1 : (game.p2 === sock.user?.id.replace(/:\d+/, '') + '@s.whatsapp.net' ? game.p2 : null)
    // Cari siapa human player
    const humanPlayer = botColor === 'w' ? game.p2 : game.p1
    const humanColor = botColor === 'w' ? 'b' : 'w'

    // Kirim pesan "berpikir" sementara render
    const thinkImg = await renderBoard(game)
    if (game.lastBoardKey) {
        try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
    }
    const thinkMsg = await sock.sendMessage(chatId, {
        image: thinkImg,
        caption: `🤖 *Bot sedang berpikir...*\n_Analisis posisi dengan kedalaman ${BOT_THINK_DEPTH}..._`,
        mentions: [humanPlayer]
    }, { quoted: m })
    game.lastBoardKey = thinkMsg?.key || null

    // Jalankan AI (async agar tidak blocking)
    await new Promise(resolve => setImmediate(resolve))

    let currentMustContinue = game.mustContinue

    // Loop multi-jump bot
    while (true) {
        const botMove = getBotMove(game.board, botColor, currentMustContinue)

        if (!botMove) {
            // Bot tidak bisa gerak = bot kalah
            const img = await renderBoard(game)
            if (game.lastBoardKey) {
                try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
            }
            sessions.delete(chatId)
            await sock.sendMessage(chatId, {
                image: img,
                caption:
                    `🏆 *GAME SELESAI!*\n\n` +
                    `🎉 @${humanPlayer.split('@')[0]} *MENANG melawan BOT!*\n` +
                    `🤖 Bot tidak bisa bergerak!\n\n` +
                    `_Total ${game.moveCount} gerakan_`,
                mentions: [humanPlayer]
            }, { quoted: m })
            return false
        }

        const [fr, fc] = botMove.from
        const [tr, tc] = botMove.to
        const { newBoard, promoted, canContinue } = applyMove(game.board, botMove)
        game.board = newBoard
        game.moveCount++

        // Cek menang bot
        const oppCount = countPieces(game.board, humanColor)
        if (oppCount === 0) {
            const img = await renderBoard(game)
            if (game.lastBoardKey) {
                try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
            }
            sessions.delete(chatId)
            await sock.sendMessage(chatId, {
                image: img,
                caption:
                    `🏆 *GAME SELESAI!*\n\n` +
                    `🤖 *BOT MENANG!*\n` +
                    `😔 @${humanPlayer.split('@')[0]} semua buahnya habis!\n\n` +
                    `_Total ${game.moveCount} gerakan_`,
                mentions: [humanPlayer]
            }, { quoted: m })
            return false
        }

        if (canContinue) {
            currentMustContinue = [tr, tc]
            game.mustContinue = [tr, tc]
            // Lanjut loop multi-jump
            continue
        }

        // Selesai, ganti giliran ke human
        game.mustContinue = null
        game.turn = game.turn === 'p1' ? 'p2' : 'p1'

        // Cek human tidak bisa gerak
        const humanMoves = getAllMoves(game.board, humanColor)
        if (humanMoves.length === 0) {
            const img = await renderBoard(game)
            if (game.lastBoardKey) {
                try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
            }
            sessions.delete(chatId)
            await sock.sendMessage(chatId, {
                image: img,
                caption:
                    `🏆 *GAME SELESAI!*\n\n` +
                    `🤖 *BOT MENANG!*\n` +
                    `😔 @${humanPlayer.split('@')[0]} tidak bisa bergerak!\n\n` +
                    `_Total ${game.moveCount} gerakan_`,
                mentions: [humanPlayer]
            }, { quoted: m })
            return false
        }

        // Kirim papan setelah bot gerak
        const isNextCapture = humanMoves[0]?.captured !== null
        const img = await renderBoard(game)
        if (game.lastBoardKey) {
            try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        }
        const sentMsg = await sock.sendMessage(chatId, {
            image: img,
            caption:
                `🤖 *Bot bergerak: ${toNotation(fr,fc)} → ${toNotation(tr,tc)}*${botMove.captured ? ' ⚔️' : ''}\n` +
                `${promoted ? '♛ Bot punya DAM baru!\n' : ''}` +
                `\n⬜ ${countPieces(game.board,'w')} buah  |  ⬛ ${countPieces(game.board,'b')} buah\n\n` +
                `${isNextCapture ? '⚔️ *Wajib makan!*\n' : ''}` +
                `🟡 Giliran: @${humanPlayer.split('@')[0]}\n\n` +
                `_Gerak: \`${prefix}dam [dari] [ke]\`_`,
            mentions: [humanPlayer]
        }, { quoted: m })
        game.lastBoardKey = sentMsg?.key || null
        return true  // sukses, giliran kembali ke human
    }
}

// ─────────────────────────────────────────────
//  HANDLER UTAMA
// ─────────────────────────────────────────────

async function handler(m, { sock, config: botConfig, db }) {
    const chatId = m.chat
    const senderId = m.sender
    const prefix = botConfig.command?.prefix || '.'
    const args = (m.body || '').trim().split(/\s+/).slice(1)
    const sub = args[0]?.toLowerCase()

    // Nomor bot (berbagai format WhatsApp)
    const botNumber = sock.user?.id?.replace(/:\d+@/, '@') || ''
    const isMentioningBot = (m.mentionedJid || []).some(jid =>
        jid.replace(/:\d+@/, '@') === botNumber
    )

    // ── .dam resign ──
    if (sub === 'resign' || sub === 'nyerah') {
        const game = sessions.get(chatId)
        if (!game) return m.reply('❌ *Ehh~* Tidak ada game dam yang sedang berjalan~ 🥺')
        if (game.p1 !== senderId && game.p2 !== senderId)
            return m.reply('❌ *Ehh~* Kamu tidak sedang main di sini~ 🥺')
        const winner = game.p1 === senderId ? game.p2 : game.p1
        if (game.lastBoardKey) {
            try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        }
        sessions.delete(chatId)

        if (game.vsBot && winner === botNumber) {
            return sock.sendMessage(chatId, {
                text: `🏳️ @${senderId.split('@')[0]} menyerah dari bot!\n🤖 *BOT MENANG!* Kapan main lagi? 😏`,
                mentions: [senderId]
            }, { quoted: m })
        }

        return sock.sendMessage(chatId, {
            text: `🏳️ @${senderId.split('@')[0]} menyerah!\n🏆 @${winner.split('@')[0]} *MENANG!*`,
            mentions: [senderId, winner]
        }, { quoted: m })
    }

    // ── Belum ada game → mulai ──
    if (!sessions.has(chatId)) {
        // Cek apakah tag bot
        const mentioned = m.mentionedJid?.[0]
        || m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

    // Validasi: harus berupa JID WhatsApp valid (minimal 10 digit angka)
    let opponent = null
    if (mentioned) {
        const num = mentioned.split('@')[0].replace(/:\d+$/, '')
        if (/^\d{10,}$/.test(num)) opponent = mentioned
    }

    // Jangan fallback ke args teks — hapus blok args[0] lama
    if (!opponent || opponent === senderId) {
        return m.reply(
            `❌ Tag pemain tidak valid! Mention pemain yang terdaftar.\n\n` +
            `Mulai vs pemain: *${prefix}dam @lawan*\n` +
            `Mulai vs bot: *${prefix}dam @bot*`
        )
    }

        if (!opponent || opponent === senderId) {
            return m.reply(
                `♟ *GAME DAM 10x10*\n\n` +
                `Aturan:\n` +
                `• Buah bergerak diagonal ke depan\n` +
                `• Makan buah lawan dengan melompatinya\n` +
                `• *Wajib makan* jika ada kesempatan!\n` +
                `• Sampai baris terakhir lawan → jadi *Dam* ♛\n` +
                `• Dam bisa gerak & makan jarak jauh diagonal\n` +
                `• Semua buah lawan habis = *MENANG!*\n\n` +
                `Mulai vs pemain: *${prefix}dam @lawan*\n` +
                `Mulai vs bot: *${prefix}dam @bot* (tag nomor bot)\n` +
                `Gerak: *${prefix}dam [dari] [ke]* (contoh: \`${prefix}dam e6 d5\`)\n` +
                `Nyerah: *${prefix}dam resign*`
            )
        }

        const opponentNormalized = opponent.replace(/:\d+@/, '@')
        const isVsBot = opponentNormalized === botNumber || isMentioningBot

        const firstTurn = Math.random() < 0.5 ? 'p1' : 'p2'
        const firstPlayer = firstTurn === 'p1' ? senderId : opponent

        if (isVsBot) {
            // ── VS BOT MODE ──
            // Bot pakai warna lawan dari penantang
            const botColor = firstTurn === 'p1' ? 'b' : 'w'  // kalau manusia p1 (putih), bot = hitam
            // Sesuaikan: p1 = putih, p2 = hitam. Human = penantang (senderId)
            // Kita assign human ke p1 (putih), bot ke p2 (hitam) — tapi bisa jadi random first
            // Biar simple: human = p1 (w), bot = p2 (b). Giliran pertama random.
            const game = createGame(senderId, botNumber, firstTurn, true, 'b')
            // p1 = human (putih), p2 = bot (hitam)
            sessions.set(chatId, game)

            const img = await renderBoard(game)
            const sentMsg = await sock.sendMessage(chatId, {
                image: img,
                caption:
                    `♟ *GAME DAM vs BOT DIMULAI!*\n\n` +
                    `⬜ Putih (P1): @${senderId.split('@')[0]}\n` +
                    `⬛ Hitam (P2): 🤖 *Bot* (mode PRO, depth ${BOT_THINK_DEPTH})\n\n` +
                    `🎲 Giliran pertama: ${firstTurn === 'p1' ? `@${senderId.split('@')[0]} (Putih)` : '🤖 Bot (Hitam)'}\n\n` +
                    `*Notasi:* Kolom A-J, Baris 1-10\n` +
                    `*Cara gerak:* \`${prefix}dam [dari] [ke]\`\n` +
                    `Contoh: \`${prefix}dam E6 D5\`\n\n` +
                    `_Wajib makan jika bisa!_ ⚔️\n` +
                    `_Bot bermain di level PRO 🤖_`,
                mentions: [senderId]
            }, { quoted: m })
            game.lastBoardKey = sentMsg?.key || null

            // Kalau bot jalan duluan
            if (firstTurn === 'p2') {
                await executeBotTurn(chatId, game, sock, m, prefix)
            }
            return
        }

        // ── VS HUMAN MODE (original) ──
        const game = createGame(senderId, opponent, firstTurn)
        sessions.set(chatId, game)

        const img = await renderBoard(game)
        const sentMsg = await sock.sendMessage(chatId, {
            image: img,
            caption:
                `♟ *GAME DAM DIMULAI!*\n\n` +
                `⬜ Putih: @${senderId.split('@')[0]}\n` +
                `⬛ Hitam: @${opponent.split('@')[0]}\n\n` +
                `🎲 Giliran pertama: @${firstPlayer.split('@')[0]}\n\n` +
                `*Notasi papan:* Kolom A-J, Baris 1-10\n` +
                `*Cara gerak:* \`${prefix}dam [dari] [ke]\`\n` +
                `Contoh: \`${prefix}dam E6 D5\`\n\n` +
                `_Wajib makan jika bisa!_ ⚔️`,
            mentions: [senderId, opponent]
        }, { quoted: m })

        game.lastBoardKey = sentMsg?.key || null
        return
    }

    // ── Game berjalan → proses gerakan ──
    const game = sessions.get(chatId)
    const currentPlayer = game.turn === 'p1' ? game.p1 : game.p2
    const myColor = game.turn === 'p1' ? 'w' : 'b'

    if (senderId !== currentPlayer) {
        const cp = currentPlayer.split('@')[0]
        return m.reply(
            `⏳ Bukan giliran kamu! Tunggu @${cp} bergerak dulu.`,
            { mentions: [currentPlayer] }
        )
    }

    if (!args[0] || !args[1]) {
        const available = getAllMoves(game.board, myColor, game.mustContinue)
        if (available.length === 0) {
            const winner = game.turn === 'p1' ? game.p2 : game.p1
            if (game.lastBoardKey) {
                try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
            }
            sessions.delete(chatId)
            return sock.sendMessage(chatId, {
                text: `🏆 @${winner.split('@')[0]} *MENANG!*\n@${senderId.split('@')[0]} tidak bisa bergerak!`,
                mentions: [winner, senderId]
            }, { quoted: m })
        }
        const moveList = [...new Set(available.map(mv => `${toNotation(...mv.from)}→${toNotation(...mv.to)}`))]
            .slice(0, 15).join(', ')
        const isCapture = available[0].captured !== null
        return m.reply(
            `${isCapture ? '⚔️ *Wajib makan!*' : '♟ Langkah tersedia:'}\n\n` +
            `${moveList}${available.length > 15 ? ` ...+${available.length-15} lagi` : ''}\n\n` +
            `Contoh: \`${prefix}dam ${available[0] ? toNotation(...available[0].from) : 'E6'} ${available[0] ? toNotation(...available[0].to) : 'D5'}\``
        )
    }

    const fromPos = parseNotation(args[0])
    const toPos = parseNotation(args[1])

    if (!fromPos || !toPos) {
        return m.reply(`❌ Notasi tidak valid!\nContoh: \`${prefix}dam E6 D5\`\nKolom: A-J, Baris: 1-10`)
    }

    const [fr, fc] = fromPos
    const [tr, tc] = toPos

    if (!game.board[fr][fc] || game.board[fr][fc].color !== myColor) {
        return m.reply(`❌ *Ehh~* Tidak ada buah milikmu di ${toNotation(fr, fc)}~ 🥺`)
    }

    if (game.mustContinue && (fr !== game.mustContinue[0] || fc !== game.mustContinue[1])) {
        return m.reply(`⚔️ Kamu harus melanjutkan makan dengan buah di *${toNotation(...game.mustContinue)}*!`)
    }

    const available = getAllMoves(game.board, myColor, game.mustContinue)
    const chosen = available.find(mv =>
        mv.from[0] === fr && mv.from[1] === fc && mv.to[0] === tr && mv.to[1] === tc
    )

    if (!chosen) {
        const captures = getAllCaptures(game.board, myColor)
        if (captures.length > 0) {
            const capList = [...new Set(captures.map(mv => `${toNotation(...mv.from)}→${toNotation(...mv.to)}`))]
                .slice(0, 8).join(', ')
            return m.reply(`⚔️ *Wajib makan!* Kamu harus makan buah lawan.\n\nLangkah makan: ${capList}`)
        }
        return m.reply(`❌ Langkah tidak valid!\nCoba: \`${prefix}dam ${toNotation(fr,fc)}\` untuk lihat opsi.`)
    }

    const { newBoard, promoted, canContinue } = applyMove(game.board, chosen)
    game.board = newBoard
    game.moveCount++

    const oppColor = myColor === 'w' ? 'b' : 'w'
    const oppCount = countPieces(game.board, oppColor)

    if (oppCount === 0) {
        const winner = game.turn === 'p1' ? game.p1 : game.p2
        const loser = game.turn === 'p1' ? game.p2 : game.p1
        const img = await renderBoard(game)
        if (game.lastBoardKey) {
            try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        }
        sessions.delete(chatId)
        await sock.sendMessage(chatId, {
            image: img,
            caption:
                `🏆 *GAME SELESAI!*\n\n` +
                `🎉 @${winner.split('@')[0]} *MENANG!*\n` +
                `😔 @${loser.split('@')[0]} semua buahnya habis!\n\n` +
                `_Total ${game.moveCount} gerakan_`,
            mentions: [winner, loser]
        }, { quoted: m })
        return
    }

    if (canContinue) {
        game.mustContinue = [tr, tc]
        const further = getCaptureMoves(game.board, tr, tc)
        const img = await renderBoard(game, further.map(mv => mv.to))
        if (game.lastBoardKey) {
            try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        }
        const sentMsg = await sock.sendMessage(chatId, {
            image: img,
            caption:
                `⚔️ *Gerakan ke-${game.moveCount}*\n` +
                `📍 ${toNotation(fr,fc)} → ${toNotation(tr,tc)}${chosen.captured ? ' (makan!)' : ''}\n` +
                `${promoted ? '♛ *Buah jadi DAM!*\n' : ''}` +
                `\n⚔️ *Lanjutkan makan!* Buah di *${toNotation(tr,tc)}* masih bisa makan.\n` +
                `Opsi: ${further.map(mv => toNotation(...mv.to)).join(', ')}\n\n` +
                `_Giliran masih milikmu, @${senderId.split('@')[0]}_`,
            mentions: [senderId]
        }, { quoted: m })
        game.lastBoardKey = sentMsg?.key || null
        return
    }

    game.mustContinue = null
    game.turn = game.turn === 'p1' ? 'p2' : 'p1'
    const nextColor = game.turn === 'p1' ? 'w' : 'b'
    const nextMoves = getAllMoves(game.board, nextColor)

    if (nextMoves.length === 0) {
        const winner = game.turn === 'p1' ? game.p2 : game.p1
        const loser = game.turn === 'p1' ? game.p1 : game.p2
        const img = await renderBoard(game)
        if (game.lastBoardKey) {
            try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        }
        sessions.delete(chatId)
        await sock.sendMessage(chatId, {
            image: img,
            caption:
                `🏆 *GAME SELESAI!*\n\n` +
                `🎉 @${winner.split('@')[0]} *MENANG!*\n` +
                `😔 @${loser.split('@')[0]} tidak bisa bergerak!\n\n` +
                `_Total ${game.moveCount} gerakan_`,
            mentions: [winner, loser]
        }, { quoted: m })
        return
    }

    // ── Kalau vsBot dan giliran sekarang bot ──
    if (game.vsBot) {
        const isBotTurn = (game.turn === 'p1' && game.botColor === 'w') || (game.turn === 'p2' && game.botColor === 'b')
        if (isBotTurn) {
            // Kirim dulu konfirmasi gerak manusia
            const img = await renderBoard(game)
            if (game.lastBoardKey) {
                try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
            }
            const sentMsg = await sock.sendMessage(chatId, {
                image: img,
                caption:
                    `♟ *Gerakan ke-${game.moveCount}*\n` +
                    `📍 ${toNotation(fr,fc)} → ${toNotation(tr,tc)}${chosen.captured ? ' ⚔️' : ''}\n` +
                    `${promoted ? '♛ *Buah jadi DAM!*\n' : ''}` +
                    `\n🤖 *Bot sedang berpikir...*`,
                mentions: [senderId]
            }, { quoted: m })
            game.lastBoardKey = sentMsg?.key || null

            // Jalankan bot
            await executeBotTurn(chatId, game, sock, m, prefix)
            return
        }
    }

    // ── Lanjut normal (vs human) ──
    const nextPlayer = game.turn === 'p1' ? game.p1 : game.p2
    const isNextCapture = nextMoves[0]?.captured !== null

    let caption =
        `♟ *Gerakan ke-${game.moveCount}*\n` +
        `📍 ${toNotation(fr,fc)} → ${toNotation(tr,tc)}${chosen.captured ? ' ⚔️' : ''}\n` +
        `${promoted ? '♛ *Buah jadi DAM!*\n' : ''}` +
        `\n⬜ ${countPieces(game.board,'w')} buah  |  ⬛ ${countPieces(game.board,'b')} buah\n\n` +
        `${isNextCapture ? '⚔️ *Wajib makan!*\n' : ''}` +
        `🟡 Giliran: ${game.turn === 'p1' ? '⬜' : '⬛'} @${nextPlayer.split('@')[0]}\n\n` +
        `_Gerak: \`${prefix}dam [dari] [ke]\`_`

    const img = await renderBoard(game)
    if (game.lastBoardKey) {
        try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
    }
    const sentMsg = await sock.sendMessage(chatId, {
        image: img,
        caption,
        mentions: [nextPlayer]
    }, { quoted: m })
    game.lastBoardKey = sentMsg?.key || null
}

module.exports = {
    config: pluginConfig,
    handler
}