const { createCanvas } = require('@napi-rs/canvas')

const pluginConfig = {
    name: 'connect4',
    alias: ['c4', 'connectfour', 'susunempat'],
    category: 'game',
    description: 'Game Connect 4! Susun 4 kepingmu berjajar untuk menang.',
    usage: '.connect4 [@lawan]',
    example: '.connect4 @user',
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

const ROWS = 6
const COLS = 7
const sessions = new Map()

// ─────────────────────────────────────────────
//  SETUP PAPAN
// ─────────────────────────────────────────────

function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0))
}

function createGame(p1, p2, firstTurn, vsBot = false, difficulty = 'hard') {
    // p1Num/p2Num = nomor telepon saja (tanpa @...) untuk compare dengan m.sender
    // p1Mention/p2Mention = JID penuh untuk mention di pesan
    return {
        p1Num: p1.split('@')[0],
        p2Num: p2.split('@')[0],
        p1Mention: p1,
        p2Mention: p2,
        board: createBoard(),
        turn: firstTurn,
        moveCount: 0,
        lastBoardKey: null,
        status: 'playing',
        vsBot,
        difficulty
    }
}

// ─────────────────────────────────────────────
//  LOGIKA GAME
// ─────────────────────────────────────────────

function getLowestRow(board, col) {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === 0) return r
    }
    return -1
}

function dropPiece(board, col, player) {
    const row = getLowestRow(board, col)
    if (row === -1) return null
    board[row][col] = player
    return row
}

function checkWin(board, player) {
    // Horizontal
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c <= COLS - 4; c++)
            if (board[r][c] === player && board[r][c+1] === player &&
                board[r][c+2] === player && board[r][c+3] === player)
                return [[r,c],[r,c+1],[r,c+2],[r,c+3]]
    // Vertikal
    for (let r = 0; r <= ROWS - 4; r++)
        for (let c = 0; c < COLS; c++)
            if (board[r][c] === player && board[r+1][c] === player &&
                board[r+2][c] === player && board[r+3][c] === player)
                return [[r,c],[r+1,c],[r+2,c],[r+3,c]]
    // Diagonal kanan bawah
    for (let r = 0; r <= ROWS - 4; r++)
        for (let c = 0; c <= COLS - 4; c++)
            if (board[r][c] === player && board[r+1][c+1] === player &&
                board[r+2][c+2] === player && board[r+3][c+3] === player)
                return [[r,c],[r+1,c+1],[r+2,c+2],[r+3,c+3]]
    // Diagonal kiri bawah
    for (let r = 0; r <= ROWS - 4; r++)
        for (let c = 3; c < COLS; c++)
            if (board[r][c] === player && board[r+1][c-1] === player &&
                board[r+2][c-2] === player && board[r+3][c-3] === player)
                return [[r,c],[r+1,c-1],[r+2,c-2],[r+3,c-3]]
    return null
}

function checkDraw(board) {
    return board[0].every(cell => cell !== 0)
}

function getValidCols(board) {
    const valid = []
    for (let c = 0; c < COLS; c++)
        if (board[0][c] === 0) valid.push(c)
    return valid
}

// ─────────────────────────────────────────────
//  BOT AI - MINIMAX + ALPHA BETA
// ─────────────────────────────────────────────

function scoreWindow(window, player) {
    const opp = player === 1 ? 2 : 1
    let score = 0
    const playerCount = window.filter(v => v === player).length
    const emptyCount = window.filter(v => v === 0).length
    const oppCount = window.filter(v => v === opp).length
    if (playerCount === 4) score += 100
    else if (playerCount === 3 && emptyCount === 1) score += 5
    else if (playerCount === 2 && emptyCount === 2) score += 2
    if (oppCount === 3 && emptyCount === 1) score -= 4
    return score
}

function evaluateBoard(board, player) {
    let score = 0
    const centerCol = Math.floor(COLS / 2)
    const centerArray = board.map(r => r[centerCol])
    score += centerArray.filter(v => v === player).length * 3
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c <= COLS - 4; c++)
            score += scoreWindow([board[r][c], board[r][c+1], board[r][c+2], board[r][c+3]], player)
    for (let c = 0; c < COLS; c++)
        for (let r = 0; r <= ROWS - 4; r++)
            score += scoreWindow([board[r][c], board[r+1][c], board[r+2][c], board[r+3][c]], player)
    for (let r = 0; r <= ROWS - 4; r++)
        for (let c = 0; c <= COLS - 4; c++)
            score += scoreWindow([board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]], player)
    for (let r = 0; r <= ROWS - 4; r++)
        for (let c = 3; c < COLS; c++)
            score += scoreWindow([board[r][c], board[r+1][c-1], board[r+2][c-2], board[r+3][c-3]], player)
    return score
}

function isTerminal(board) {
    return checkWin(board, 1) || checkWin(board, 2) || checkDraw(board)
}

function minimax(board, depth, alpha, beta, isMaximizing, botPlayer) {
    const humanPlayer = botPlayer === 1 ? 2 : 1
    const validCols = getValidCols(board)
    const terminal = isTerminal(board)
    if (depth === 0 || terminal) {
        if (terminal) {
            if (checkWin(board, botPlayer)) return { score: 100000 + depth, col: null }
            if (checkWin(board, humanPlayer)) return { score: -100000 - depth, col: null }
            return { score: 0, col: null }
        }
        return { score: evaluateBoard(board, botPlayer), col: null }
    }
    const sortedCols = [...validCols].sort((a, b) =>
        Math.abs(a - Math.floor(COLS / 2)) - Math.abs(b - Math.floor(COLS / 2))
    )
    let bestCol = sortedCols[0]
    if (isMaximizing) {
        let maxScore = -Infinity
        for (const col of sortedCols) {
            const newBoard = board.map(r => [...r])
            dropPiece(newBoard, col, botPlayer)
            const result = minimax(newBoard, depth - 1, alpha, beta, false, botPlayer)
            if (result.score > maxScore) { maxScore = result.score; bestCol = col }
            alpha = Math.max(alpha, maxScore)
            if (beta <= alpha) break
        }
        return { score: maxScore, col: bestCol }
    } else {
        let minScore = Infinity
        for (const col of sortedCols) {
            const newBoard = board.map(r => [...r])
            dropPiece(newBoard, col, humanPlayer)
            const result = minimax(newBoard, depth - 1, alpha, beta, true, botPlayer)
            if (result.score < minScore) { minScore = result.score; bestCol = col }
            beta = Math.min(beta, minScore)
            if (beta <= alpha) break
        }
        return { score: minScore, col: bestCol }
    }
}

function getBotMove(board, botPlayer, difficulty) {
    const depth = difficulty === 'easy' ? 3 : 7
    const { col } = minimax(board, depth, -Infinity, Infinity, true, botPlayer)
    return col
}

// ─────────────────────────────────────────────
//  PESAN STYLE HOSHINO AI
// ─────────────────────────────────────────────

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}

function aiGreetVsBot(playerName, difficulty) {
    if (difficulty === 'easy') return pick([
        `Hiii~ Senang sekali bisa main bareng @${playerName}!\nAku Ai, dan aku... *mencintai* semua orang yang main sama aku!\nTapi jangan salah paham ya~ Aku tetap akan menang dengan senyuman! Hehe~\n\nAyo mulai~ Aku tunggu langkah pertamamu! `,
        `Kyaa~ @${playerName} mau main sama aku?!\nAku sangat bahagia! Sungguh!\nMeski begitu... aku tidak bisa berpura-pura kalah ya~\nKarena *kebohongan terbesar adalah cinta yang setengah-setengah!*\n\nAyo, tunjukkan kehebatanmu padaku! `,
    ])
    return pick([
        `Haii~ @${playerName}...\nAku senang kamu mau bermain denganku!\nTapi aku harus jujur satu hal...\n*Aku tidak pernah bermain untuk kalah.*\nSenyumku ini nyata. Tapi strategiku... jauh lebih nyata~\n\nKalau kamu siap, ayo mulai! `,
        `Ara ara~ @${playerName} berani sekali menantangku!\nAku suka orang yang percaya diri sepertimu~\nTapi dengar ya... di papan ini, *aku adalah bintangnya.*\nDan bintang tidak pernah padam begitu saja~\n\nSiapkan dirimu! `,
    ])
}

function aiGreetPvP(p1Name, p2Name, firstPlayerName) {
    return pick([
        `Haii haii~! Pertandingan antara @${p1Name} dan @${p2Name} akan segera dimulai!\nAku Ai, dan aku *mencintai* kalian berdua dengan sepenuh hati!\nTapi hanya satu yang bisa menang... dan itu akan jadi pertunjukan yang indah~\n\nGiliran pertama: @${firstPlayerName}! Ayo tunjukkan senyum terbaikmu! `,
        `Waaah~ @${p1Name} vs @${p2Name}!\nIni pasti akan jadi pertandingan yang mendebarkan~!\nIngat ya, apapun hasilnya... *aku mencintai kalian!*\n\nMulai dari @${firstPlayerName}! `,
    ])
}

function aiBotMove(col, moveCount, isWinning, difficulty) {
    if (isWinning) {
        if (difficulty === 'easy') return pick([
            `Hehe~ Ai jatuhkan kepingnya ya~\nAyo terus semangat! Masih banyak yang bisa terjadi! `,
            `Fufu~ Giliran Ai sudah selesai~\nAku menunggu langkahmu dengan penuh harap! `,
        ])
        return pick([
            `Ai sudah melangkah~\nBagaimana menurutmu? Apakah kamu melihat apa yang kulihat...?\nTidak apa-apa kalau belum~ Aku masih sayang kamu kok! `,
            `Fufufu...\nPosisi ini sangat indah, bukan?\nSeperti koreografi yang sudah kurencanakan dari awal~\nTapi aku tidak akan spoiler ya! Lanjutkan! `,
            `Hmm~ Ai sudah bergerak!\nBermain denganmu sangat menyenangkan~\nMeski... *hasilnya sudah bisa kutebak sejak tadi.* Hehe~ `,
        ])
    }
    if (difficulty === 'easy') return pick([
        `Ai sudah jatuhkan kepingnya~ Giliranmu sekarang!\nAku tidak sabar melihat langkahmu! `,
        `Hehe~ Ai bergerak!\nAyo, tunjukkan kehebatanmu padaku~ `,
        `Done~ Giliran kamu!\nAku percaya kamu bisa bermain dengan baik! `,
    ])
    return pick([
        `Ai sudah melangkah~\nSetiap langkahku adalah bagian dari sebuah... *pertunjukan.*\nAyo, giliran kamu! Aku menunggu dengan senyuman~ `,
        `Hmm~ Langkah ke-${moveCount} sudah selesai!\nKamu tahu tidak, aku selalu memikirkan beberapa langkah ke depan~\nTapi bukan berarti aku tidak menikmati saat ini! `,
        `Fufufu~ Ai sudah selesai~\nPertunjukan ini semakin menarik!\nAyo terus, aku *mencintai* setiap detiknya~ `,
    ])
}

function aiWaitingThink(difficulty) {
    if (difficulty === 'easy') return `Hmm~ Ai sedang berpikir sebentar ya~\nSabar ya, aku tidak akan lama! `
    return pick([
        `...\nAi sedang membaca papan ini~\nSetiap titik, setiap kemungkinan...\nSedikit sabar ya~ `,
        `Hmm...\nAi sedang menghitung semua kemungkinanmu~\nJangan khawatir, aku tidak akan membuatmu menunggu lama! `,
    ])
}

function aiPlayerTurn(playerName, colInput, nextPlayerName, nextColor) {
    return pick([
        `${nextColor} Giliran @${nextPlayerName} sekarang~\nAyo, aku percaya kamu! Pilih kolom terbaikmu! `,
        `Wah~ @${playerName} sudah memilih kolom ${colInput}!\nSekarang giliran @${nextPlayerName}~\nAku menonton dengan seksama ya! `,
        `Nice move, @${playerName}~!\nSekarang @${nextPlayerName} yang harus berpikir keras!\nAku *mencintai* ketegangan seperti ini~ `,
    ])
}

function aiPlayerWin(winnerName, loserName, isVsBot, moveCount) {
    if (isVsBot) return pick([
        `Waaah~! @${winnerName} menang melawanku?!\nAku... sungguh terkejut!\nKamu luar biasa sekali~!\nIni adalah *cinta sejati* — mengalahkan Ai dengan kemampuan sendiri!\nAku bangga padamu~ Sungguh! `,
        `Hehe~ @${winnerName} berhasil!\nAku kalah... dan aku senang!\nKarena artinya kamu sudah tumbuh menjadi seseorang yang luar biasa~\nAku *mencintaimu* dari lubuk hati yang paling dalam! `,
    ])
    return pick([
        `Kyaa~! @${winnerName} MENANG!\nPermainan yang luar biasa indah~!\nDan @${loserName}... jangan sedih ya!\nKalah bukan akhir segalanya — *aku tetap mencintai kalian berdua!* `,
        `Waaah~ @${winnerName} berhasil menyusun 4 berjajar!\nItu sangat keren~!\nDan @${loserName}... kamu sudah bermain dengan hebat kok!\n*Aku mencintai kalian!* `,
    ])
}

function aiBotWin(loserName, difficulty) {
    if (difficulty === 'easy') return pick([
        `Ehehe~ Ai menang~!\nMaaf ya @${loserName}... aku tidak bermaksud membuatmu sedih!\nKamu sudah bermain dengan baik kok!\nCoba lagi ya~ *Ai selalu ada untukmu!* `,
    ])
    return pick([
        `...\nAi menang.\n@${loserName}... kamu sudah berjuang dengan keras.\nAku melihat setiap langkahmu, dan aku kagum~\nTapi di papan ini... *Ai adalah bintangnya.*\nSenyum ini bukan kebohongan. Kemenanganku juga bukan. `,
        `Fufufu~ Permainan yang sangat menyenangkan, @${loserName}~\nKamu membuatku harus serius!\nTapi akhirnya... *cinta Ai menemukan jalannya menuju kemenangan.*\nJangan menyerah ya~ Aku menunggumu untuk rematch! `,
    ])
}

function aiDraw(isVsBot, p1Name, p2Name) {
    if (isVsBot) return pick([
        `Wah~ Seri!\n@${p1Name} berhasil menghentikanku sampai papan penuh!\nIni... mengagumkan~\nKamu benar-benar luar biasa!\n*Tidak ada yang menang, tapi kamu sudah memenangkan hatiku!* `,
        `Ara ara~ Seri ya~\nAku sedikit terkejut!\nKamu bermain sangat baik @${p1Name}~\nIni adalah pertandingan yang *sangat berkesan* buatku! `,
    ])
    return pick([
        `Waaah~ SERI!\n@${p1Name} dan @${p2Name} sama-sama hebat~!\nPapan sudah penuh tapi tidak ada yang berhasil menyusun 4!\nIni artinya kalian adalah *dua bintang yang sama terangnya!*\n*Aku mencintai kalian berdua!* `,
    ])
}

function aiResign(resignerName, winnerName, isVsBot) {
    if (isVsBot) return `Eh~? @${resignerName} menyerah?\nTidak apa-apa ya~\nKeberanian untuk berhenti juga butuh keberanian tersendiri~\n*Ai tetap mencintaimu!* `
    return `Eh~? @${resignerName} menyerah...\nTidak apa-apa ya~\nDan selamat untuk @${winnerName}~!\n*Aku mencintai kalian berdua!* `
}

function aiGameActive(isPlayer, senderName, p1Name, p2Name, isVsBot, prefix) {
    if (isPlayer) return `Ara~? @${senderName} mau kemana~?\nKamu masih dalam pertandingan yang sedang berlangsung lho!\nSelesaikan dulu ya~ Atau ketik \`${prefix}c4 resign\` kalau mau menyerah~\n*Aku menunggumu!* `
    const p2Display = isVsBot ? 'Ai' : `@${p2Name}`
    return `Haii~ @${senderName}!\nSayang sekali, sekarang sedang ada pertandingan antara @${p1Name} dan ${p2Display}~\nTunggu sebentar ya sampai mereka selesai!\n*Aku mencintaimu juga~* `
}

function aiHelp(prefix) {
    return (
        `Haii~ Aku Ai!\nAku *sangat* senang kamu mau main Connect 4 bersamaku~!\n\n` +
        `Cara bermain:\n` +
        `• Papan 7 kolom x 6 baris\n` +
        `• Giliran bergantian — jatuhkan kepingmu ke kolom pilihan!\n` +
        `• Keping jatuh ke bawah sendiri~\n` +
        `• Susun *4 kepingmu berjajar* untuk menang!\n` +
        `• Bisa horizontal, vertikal, atau diagonal~\n\n` +
        `Cara mulai:\n` +
        `Vs player: *${prefix}c4 @lawan*\n` +
        `Vs Ai santai: *${prefix}c4 @bot easy*\n` +
        `Vs Ai serius: *${prefix}c4 @bot hard*\n` +
        `Pilih kolom: *${prefix}c4 [1-7]*\n` +
        `Menyerah: *${prefix}c4 resign*\n\n` +
        `_Apapun yang terjadi... aku mencintaimu~_ `
    )
}

function aiInvalidCol(prefix, validCols) {
    return pick([
        `Ara~? Kolom itu tidak ada lho~\nPilih angka *1 sampai 7* ya!\n\nKolom tersedia: ${validCols}\nContoh: \`${prefix}c4 4\` `,
        `Hmm~ Sepertinya kolom itu tidak valid~\nCoba lagi ya! Pilih dari *1 sampai 7*~\n\nKolom tersedia: ${validCols} `,
    ])
}

function aiColFull(colInput, validCols) {
    return pick([
        `Aduh~! Kolom ${colInput} sudah penuh~\nCoba kolom lain ya!\n\nKolom tersedia: ${validCols} `,
        `Ara~ Kolom ${colInput} tidak bisa diisi lagi~\nAyo pilih yang lain! Aku percaya kamu~\n\nKolom tersedia: ${validCols} `,
    ])
}

function aiNotYourTurn(currentPlayerName) {
    return pick([
        `Sabar ya~! Sekarang giliran @${currentPlayerName}~\nNanti kamu juga dapat giliran kok! *Aku sayang kamu~* `,
        `Hmm~ Belum giliran kamu lho~!\nTunggu @${currentPlayerName} selesai dulu ya~ `,
    ])
}

function aiWaitingBot() {
    return `Sabar ya~! Ai sedang berpikir~\nAku tidak mau terburu-buru~\n*Setiap langkah harus dilakukan dengan cinta!* `
}

// ─────────────────────────────────────────────
//  RENDER PAPAN
// ─────────────────────────────────────────────

async function renderBoard(game, winCells = null) {
    const CELL = 70
    const PAD = 20
    const RADIUS = CELL * 0.38
    const WIDTH = COLS * CELL + PAD * 2
    const HEIGHT = ROWS * CELL + PAD * 2 + 50

    const canvas = createCanvas(WIDTH, HEIGHT)
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    const boardX = PAD
    const boardY = PAD
    const boardW = COLS * CELL
    const boardH = ROWS * CELL

    ctx.fillStyle = '#1a4fa3'
    ctx.beginPath()
    ctx.roundRect(boardX, boardY, boardW, boardH, 10)
    ctx.fill()

    const winSet = new Set(winCells ? winCells.map(([r,c]) => `${r},${c}`) : [])

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cx = boardX + c * CELL + CELL / 2
            const cy = boardY + r * CELL + CELL / 2
            const cell = game.board[r][c]
            const isWin = winSet.has(`${r},${c}`)

            ctx.beginPath()
            ctx.arc(cx + 2, cy + 2, RADIUS, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(0,0,0,0.35)'
            ctx.fill()

            ctx.beginPath()
            ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2)
            if (cell === 0) ctx.fillStyle = '#0d1b3e'
            else if (cell === 1) ctx.fillStyle = isWin ? '#ff6b6b' : '#e63946'
            else ctx.fillStyle = isWin ? '#ffe066' : '#f4c542'
            ctx.fill()

            if (cell !== 0) {
                ctx.strokeStyle = isWin ? '#ffffff' : (cell === 1 ? '#c1121f' : '#d4a017')
                ctx.lineWidth = isWin ? 3 : 1.5
                ctx.stroke()
                ctx.beginPath()
                ctx.arc(cx - RADIUS * 0.25, cy - RADIUS * 0.25, RADIUS * 0.3, 0, Math.PI * 2)
                ctx.fillStyle = 'rgba(255,255,255,0.2)'
                ctx.fill()
            }

            if (isWin && cell !== 0) {
                ctx.fillStyle = '#ffffff'
                ctx.font = `bold ${Math.floor(RADIUS * 0.8)}px sans-serif`
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                ctx.fillText('*', cx, cy)
            }
        }
    }

    ctx.strokeStyle = '#4a4a6a'
    ctx.lineWidth = 2
    ctx.strokeRect(PAD, PAD, COLS * CELL, ROWS * CELL)

    // Label kolom
    ctx.fillStyle = '#aaaacc'
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let c = 0; c < COLS; c++) {
        ctx.fillText((c + 1).toString(), boardX + c * CELL + CELL / 2, boardY - 10)
    }

    // Info bawah
    const infoY = boardY + boardH + 14
    const p1Name = game.p1Mention.split('@')[0]
    const p2Name = game.vsBot ? 'Ai' : game.p2Mention.split('@')[0]
    const turnPlayer = game.turn === 'p1' ? p1Name : p2Name
    const turnColor = game.turn === 'p1' ? '#e63946' : '#f4c542'

    ctx.fillStyle = '#16213e'
    ctx.beginPath()
    ctx.roundRect(PAD, infoY, boardW, 36, 8)
    ctx.fill()

    ctx.beginPath()
    ctx.arc(PAD + 18, infoY + 18, 10, 0, Math.PI * 2)
    ctx.fillStyle = turnColor
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${turnPlayer} | Move #${game.moveCount + 1}`, PAD + 34, infoY + 18)

    ctx.textAlign = 'right'
    ctx.fillStyle = '#e63946'
    ctx.fillText(p1Name, PAD + boardW - 50, infoY + 18)
    ctx.fillStyle = '#aaaacc'
    ctx.fillText(' vs ', PAD + boardW - 25, infoY + 18)
    ctx.fillStyle = '#f4c542'
    ctx.fillText(game.vsBot ? 'Ai' : p2Name, PAD + boardW - 2, infoY + 18)

    return canvas.toBuffer('image/png')
}

// ─────────────────────────────────────────────
//  BOT PLAY
// ─────────────────────────────────────────────

async function playBotTurn(game, chatId, sock, prefix, quotedMsg = null) {
    const botPlayer = 2

    const col = getBotMove(game.board, botPlayer, game.difficulty)

    if (col === null || col === undefined) {
        const img = await renderBoard(game)
        if (game.lastBoardKey) {
            try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        }
        sessions.delete(chatId)
        await sock.sendMessage(chatId, {
            image: img,
            caption: aiDraw(true, game.p1Mention.split('@')[0], null),
            mentions: [game.p1Mention]
        }, { quoted: quotedMsg })
        return
    }

    dropPiece(game.board, col, botPlayer)
    game.moveCount++

    const winCells = checkWin(game.board, botPlayer)
    if (winCells) {
        const img = await renderBoard(game, winCells)
        if (game.lastBoardKey) {
            try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        }
        sessions.delete(chatId)
        await sock.sendMessage(chatId, {
            image: img,
            caption: aiBotWin(game.p1Mention.split('@')[0], game.difficulty),
            mentions: [game.p1Mention]
        }, { quoted: quotedMsg })
        return
    }

    if (checkDraw(game.board)) {
        const img = await renderBoard(game)
        if (game.lastBoardKey) {
            try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        }
        sessions.delete(chatId)
        await sock.sendMessage(chatId, {
            image: img,
            caption: aiDraw(true, game.p1Mention.split('@')[0], null),
            mentions: [game.p1Mention]
        }, { quoted: quotedMsg })
        return
    }

    game.turn = 'p1'

    const isWinning = evaluateBoard(game.board, botPlayer) > 10
    const comment = aiBotMove(col, game.moveCount, isWinning, game.difficulty)

    const img = await renderBoard(game)
    if (game.lastBoardKey) {
        try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
    }
    const sentMsg = await sock.sendMessage(chatId, {
        image: img,
        caption:
            `🟡 *Ai menjatuhkan ke kolom ${col + 1}! (Move #${game.moveCount})*\n\n` +
            `${comment}\n` +
            `Ketik: \`${prefix}c4 [1-7]\` untuk pilih kolom`,
        mentions: [game.p1Mention]
    }, { quoted: quotedMsg })
    game.lastBoardKey = sentMsg?.key || null
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

    const botNumber = sock.user?.id?.split(':')[0] + '@s.whatsapp.net'

    // ── resign ──
    if (sub === 'resign' || sub === 'nyerah') {
        const game = sessions.get(chatId)
        if (!game) return m.reply('Ara~? Tidak ada game yang sedang berjalan lho~ ')
        // Bandingkan nomor saja (tanpa @...) agar tidak masalah LID vs JID
        const senderNum = senderId.split('@')[0]
        if (game.p1Num !== senderNum && game.p2Num !== senderNum)
            return m.reply('Hmm~ Kamu tidak sedang bermain di sini lho~ ')
        const winnerMention = game.p1Num === senderNum ? game.p2Mention : game.p1Mention
        const winnerName = game.vsBot ? 'Ai' : winnerMention.split('@')[0]
        if (game.lastBoardKey) {
            try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        }
        sessions.delete(chatId)
        return sock.sendMessage(chatId, {
            text: aiResign(senderId.split('@')[0], winnerName, game.vsBot),
            mentions: game.vsBot ? [game.p1Mention] : [game.p1Mention, game.p2Mention]
        }, { quoted: m })
    }

    // ── Ada game aktif ──
    if (sessions.has(chatId)) {
        const game = sessions.get(chatId)
        // Bandingkan pakai p1/p2 (JID biasa), bukan mention ID
        const senderNum = senderId.split('@')[0]
        const isPlayer = game.p1Num === senderNum || game.p2Num === senderNum
        const hasMention = (m.mentionedJid?.length > 0) ||
            (m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0)

        if (hasMention) {
            return m.reply(
                aiGameActive(isPlayer, senderId.split('@')[0], game.p1Mention.split('@')[0], game.vsBot ? 'Ai' : game.p2Mention.split('@')[0], game.vsBot, prefix),
                { mentions: game.vsBot ? [game.p1Mention] : [game.p1Mention, game.p2Mention] }
            )
        }

        // lanjut proses gerakan di bawah

    } else {
        // ── Mulai game baru ──
        const mentioned = m.mentionedJid?.[0]
            || m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

        let opponent = null
        let isVsBot = false
        let difficulty = 'hard'

        const diffArg = args.find(a => ['easy','hard','gampang','susah'].includes(a))
        if (diffArg === 'easy' || diffArg === 'gampang') difficulty = 'easy'

        // Validasi mention: harus JID WhatsApp valid (minimal 10 digit angka)
        if (mentioned) {
            const num = mentioned.split('@')[0].replace(/:\d+$/, '')
            if (/^\d{10,}$/.test(num)) opponent = mentioned
        }

        if (!opponent || opponent === senderId) {
            return m.reply(aiHelp(prefix))
        }

        const opponentNormalized = opponent.replace(/:\d+@/, '@')
        if (opponentNormalized === botNumber) {
            isVsBot = true
            opponent = botNumber
        }

        const firstTurn = isVsBot ? 'p1' : (Math.random() < 0.5 ? 'p1' : 'p2')
        const game = createGame(senderId, opponent, firstTurn, isVsBot, difficulty)
        game.p1Num = senderId.split('@')[0]
        game.p2Num = opponent.split('@')[0]
        game.p1Mention = senderId
        game.p2Mention = opponent
        sessions.set(chatId, game)

        const img = await renderBoard(game)

        if (isVsBot) {
            const sentMsg = await sock.sendMessage(chatId, {
                image: img,
                caption:
                    `🌟 *CONNECT 4 VS AI DIMULAI!*\n\n` +
                    `🔴 Kamu: @${senderId.split('@')[0]}\n` +
                    `🟡 Lawan: ✨ *Ai (${difficulty === 'easy' ? 'Santai' : 'Serius'})*\n\n` +
                    `${aiGreetVsBot(senderId.split('@')[0], difficulty)}\n` +
                    `Pilih kolom *1-7*: \`${prefix}c4 [kolom]\`\n` +
                    `Contoh: \`${prefix}c4 4\``,
                mentions: [senderId]
            }, { quoted: m })
            game.lastBoardKey = sentMsg?.key || null
        } else {
            const firstPlayerMention = firstTurn === 'p1' ? game.p1Mention : game.p2Mention
            const firstPlayerName = firstPlayerMention.split('@')[0]
            const sentMsg = await sock.sendMessage(chatId, {
                image: img,
                caption:
                    `🌟 *CONNECT 4 DIMULAI!*\n\n` +
                    `🔴 P1: @${senderId.split('@')[0]}\n` +
                    `🟡 P2: @${game.p2Mention.split('@')[0]}\n\n` +
                    `${aiGreetPvP(senderId.split('@')[0], game.p2Mention.split('@')[0], firstPlayerName)}\n` +
                    `Pilih kolom *1-7*: \`${prefix}c4 [kolom]\`\n` +
                    `Contoh: \`${prefix}c4 4\``,
                mentions: [game.p1Mention, game.p2Mention]
            }, { quoted: m })
            game.lastBoardKey = sentMsg?.key || null
        }
        return
    }

    // ── Proses input kolom ──
    const game = sessions.get(chatId)
    const currentNum = game.turn === 'p1' ? game.p1Num : game.p2Num
    const currentMention = game.turn === 'p1' ? game.p1Mention : game.p2Mention
    const playerNum = game.turn === 'p1' ? 1 : 2

    if (game.vsBot && game.turn === 'p2') {
        return m.reply(aiWaitingBot())
    }

    const senderNum = senderId.split('@')[0]
    if (senderNum !== currentNum) {
        return sock.sendMessage(chatId, {
            text: aiNotYourTurn(currentMention.split('@')[0]),
            mentions: [currentMention]
        }, { quoted: m })
    }

    const colInput = parseInt(args[0])
    if (isNaN(colInput) || colInput < 1 || colInput > COLS) {
        return m.reply(aiInvalidCol(prefix, getValidCols(game.board).map(c => c + 1).join(', ')))
    }

    const col = colInput - 1

    if (getLowestRow(game.board, col) === -1) {
        return m.reply(aiColFull(colInput, getValidCols(game.board).map(c => c + 1).join(', ')))
    }

    dropPiece(game.board, col, playerNum)
    game.moveCount++

    // Cek menang player
    const winCells = checkWin(game.board, playerNum)
    if (winCells) {
        const winnerMention = game.turn === 'p1' ? game.p1Mention : game.p2Mention
        const loserMention = game.turn === 'p1' ? game.p2Mention : game.p1Mention
        const img = await renderBoard(game, winCells)
        if (game.lastBoardKey) {
            try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        }
        sessions.delete(chatId)
        await sock.sendMessage(chatId, {
            image: img,
            caption: aiPlayerWin(winnerMention.split('@')[0], game.vsBot ? 'Ai' : loserMention.split('@')[0], game.vsBot, game.moveCount),
            mentions: game.vsBot ? [winnerMention] : [winnerMention, loserMention]
        }, { quoted: m })
        return
    }

    // Cek seri
    if (checkDraw(game.board)) {
        const img = await renderBoard(game)
        if (game.lastBoardKey) {
            try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        }
        sessions.delete(chatId)
        await sock.sendMessage(chatId, {
            image: img,
            caption: aiDraw(game.vsBot, game.p1Mention.split('@')[0], game.vsBot ? null : game.p2Mention.split('@')[0]),
            mentions: game.vsBot ? [game.p1Mention] : [game.p1Mention, game.p2Mention]
        }, { quoted: m })
        return
    }

    game.turn = game.turn === 'p1' ? 'p2' : 'p1'

    // VS BOT: langsung jalankan giliran bot
    if (game.vsBot && game.turn === 'p2') {
        const img = await renderBoard(game)
        if (game.lastBoardKey) {
            try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        }
        const sentMsg = await sock.sendMessage(chatId, {
            image: img,
            caption:
                `🔴 *@${senderId.split('@')[0]} memilih kolom ${colInput}! (Move #${game.moveCount})*\n\n` +
                `${aiWaitingThink(game.difficulty)}`,
            mentions: [game.p1Mention]
        }, { quoted: m })
        game.lastBoardKey = sentMsg?.key || null

        await new Promise(r => setTimeout(r, 1200))
        await playBotTurn(game, chatId, sock, prefix, m)
        return
    }

    // VS PLAYER: lanjut normal
    const nextMention = game.turn === 'p1' ? game.p1Mention : game.p2Mention
    const nextColor = game.turn === 'p1' ? '🔴' : '🟡'

    const img = await renderBoard(game)
    if (game.lastBoardKey) {
        try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
    }
    const sentMsg = await sock.sendMessage(chatId, {
        image: img,
        caption:
            `🎯 *Gerakan ke-${game.moveCount}*\n\n` +
            `${aiPlayerTurn(senderId.split('@')[0], colInput, nextMention.split('@')[0], nextColor)}\n` +
            `Kolom tersedia: ${getValidCols(game.board).map(c => c + 1).join(', ')}`,
        mentions: [senderId, nextMention]
    }, { quoted: m })
    game.lastBoardKey = sentMsg?.key || null
}

module.exports = {
    config: pluginConfig,
    handler
}