const { createCanvas } = require('@napi-rs/canvas')

const pluginConfig = {
    name: 'sos',
    alias: ['sosgame', 'mainsos'],
    category: 'game',
    description: 'Game SOS! Buat kata S-O-S di papan untuk menang. Ukuran papan bisa dipilih (3x3 hingga 10x10).',
    usage: '.sos [@lawan] [tinggi] [lebar]',
    example: '.sos @user 5 7',
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

const sessions = new Map()
const MIN_SIZE = 3
const MAX_SIZE = 10

// ─────────────────────────────────────────────
//  HELPER — normalisasi JID
//  Hilangkan bagian :device sehingga 628xxx:2@s.whatsapp.net → 628xxx@s.whatsapp.net
// ─────────────────────────────────────────────

function normalizeJid(jid) {
    if (!jid) return jid
    return jid.replace(/:\d+@/, '@')
}

// Ambil nomor bersih dari JID untuk caption mention
function jidToNum(jid) {
    if (!jid) return ''
    return jid.replace(/:\d+@/, '@').split('@')[0]
}

// ─────────────────────────────────────────────
//  SETUP GAME
// ─────────────────────────────────────────────

/**
 * Buat papan kosong ukuran rows x cols
 */
function createBoard(rows, cols) {
    return Array.from({ length: rows }, () => Array(cols).fill(null))
}

/**
 * createGame — papan bisa rows x cols (tidak harus persegi)
 */
function createGame(p1, p2, firstTurn, rows, cols, vsBot = false, p1Name = null, p2Name = null) {
    return {
        p1, p2,
        p1Name: p1Name || p1.split('@')[0],
        p2Name: p2Name || (vsBot ? 'Bot' : p2.split('@')[0]),
        board: createBoard(rows, cols),
        rows,
        cols,
        get size() { return this.rows },
        turn: firstTurn,
        moveCount: 0,
        p1Score: 0,
        p2Score: 0,
        sosList: [],
        status: 'playing',
        vsBot,
        lastBoardKey: null
    }
}

// ─────────────────────────────────────────────
//  LOGIKA GAME SOS
// ─────────────────────────────────────────────

/**
 * Cek berapa SOS baru yang terbentuk setelah meletakkan huruf di (row, col)
 * Return array of SOS sequences { cells: [[r,c],[r,c],[r,c]] }
 */
function checkNewSOS(board, row, col) {
    const rows = board.length
    const cols = board[0].length
    const found = []

    const directions = [
        [0, 1],   // horizontal kanan
        [1, 0],   // vertikal bawah
        [1, 1],   // diagonal kanan-bawah
        [1, -1],  // diagonal kiri-bawah
    ]

    function inBounds(r, c) {
        return r >= 0 && r < rows && c >= 0 && c < cols
    }

    for (const [dr, dc] of directions) {
        // Cek apakah (row, col) adalah S awal
        if (board[row][col] === 'S') {
            const mr = row + dr, mc = col + dc
            const er = row + 2 * dr, ec = col + 2 * dc
            if (
                inBounds(mr, mc) && inBounds(er, ec) &&
                board[mr][mc] === 'O' && board[er][ec] === 'S'
            ) {
                found.push({ cells: [[row, col], [mr, mc], [er, ec]] })
            }
        }

        // Cek apakah (row, col) adalah O tengah
        if (board[row][col] === 'O') {
            const sr = row - dr, sc = col - dc
            const er = row + dr, ec = col + dc
            if (
                inBounds(sr, sc) && inBounds(er, ec) &&
                board[sr][sc] === 'S' && board[er][ec] === 'S'
            ) {
                found.push({ cells: [[sr, sc], [row, col], [er, ec]] })
            }
        }

        // Cek apakah (row, col) adalah S akhir
        if (board[row][col] === 'S') {
            const sr = row - 2 * dr, sc = col - 2 * dc
            const mr = row - dr, mc = col - dc
            if (
                inBounds(sr, sc) && inBounds(mr, mc) &&
                board[sr][sc] === 'S' && board[mr][mc] === 'O'
            ) {
                found.push({ cells: [[sr, sc], [mr, mc], [row, col]] })
            }
        }
    }

    return found
}

/**
 * Filter SOS baru yang belum ada di sosList
 */
function filterNewSOS(newSOS, existingSOS) {
    return newSOS.filter(ns => {
        const key = ns.cells.map(c => c.join(',')).join('|')
        return !existingSOS.some(es => {
            const esKey = es.cells.map(c => c.join(',')).join('|')
            return esKey === key
        })
    })
}

/**
 * Cek apakah papan sudah penuh
 */
function isBoardFull(board) {
    return board.every(row => row.every(cell => cell !== null))
}

/**
 * Hitung total sel yang belum diisi
 */
function countEmpty(board) {
    let count = 0
    for (const row of board)
        for (const cell of row)
            if (cell === null) count++
    return count
}

// ─────────────────────────────────────────────
//  AI ENGINE UNTUK BOT
// ─────────────────────────────────────────────

function simulatePlacement(board, row, col, letter, existingSOS) {
    const newBoard = board.map(r => [...r])
    newBoard[row][col] = letter
    const newSOS = checkNewSOS(newBoard, row, col)
    return filterNewSOS(newSOS, existingSOS).length
}

function countOpponentThreats(board, oppLetter, existingSOS) {
    const rows = board.length
    const cols = board[0].length
    let maxThreats = 0
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c] !== null) continue
            const score = simulatePlacement(board, r, c, oppLetter, existingSOS)
            if (score > maxThreats) maxThreats = score
        }
    }
    return maxThreats
}

function getBotMove(game) {
    const rows = game.rows
    const cols = game.cols
    const board = game.board
    const existingSOS = game.sosList

    let bestScore = -Infinity
    let bestMoves = []

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c] !== null) continue

            for (const letter of ['S', 'O']) {
                const botSOS = simulatePlacement(board, r, c, letter, existingSOS)

                const tempBoard = board.map(row => [...row])
                tempBoard[r][c] = letter
                const threatS = countOpponentThreats(tempBoard, 'S', existingSOS)
                const threatO = countOpponentThreats(tempBoard, 'O', existingSOS)
                const oppThreat = Math.max(threatS, threatO)

                let score = botSOS * 10 - oppThreat * 5

                // Bonus posisi tengah
                const centerR = (rows - 1) / 2
                const centerC = (cols - 1) / 2
                const distCenter = Math.abs(r - centerR) + Math.abs(c - centerC)
                score += (Math.max(rows, cols) - distCenter) * 0.1

                score += Math.random() * 0.5

                if (score > bestScore) {
                    bestScore = score
                    bestMoves = [{ r, c, letter }]
                } else if (Math.abs(score - bestScore) < 0.3) {
                    bestMoves.push({ r, c, letter })
                }
            }
        }
    }

    if (bestMoves.length === 0) return null
    return bestMoves[Math.floor(Math.random() * bestMoves.length)]
}

// ─────────────────────────────────────────────
//  RENDER PAPAN (mendukung TxL)
// ─────────────────────────────────────────────

async function renderBoard(game) {
    const rows = game.rows
    const cols = game.cols
    // Sesuaikan ukuran cell agar papan tidak terlalu besar/kecil
    const maxDim = Math.max(rows, cols)
    const CELL = Math.max(40, Math.min(60, Math.floor(480 / maxDim)))
    const PAD = 32
    const LABEL_PAD = 22
    const BOARD_W = cols * CELL
    const BOARD_H = rows * CELL
    const W = BOARD_W + PAD * 2 + LABEL_PAD
    const H = BOARD_H + PAD * 2 + LABEL_PAD + 50

    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')

    // Background
    ctx.fillStyle = '#0f0f1a'
    ctx.fillRect(0, 0, W, H)

    // Kumpulan sel yang termasuk SOS
    const sosHighlight = new Map()
    const sosColors = [
        '#ff4d4d', '#4dff91', '#4da6ff', '#ffdd4d',
        '#ff4dff', '#4dffff', '#ff944d', '#a64dff'
    ]
    game.sosList.forEach((sos, idx) => {
        const color = sosColors[idx % sosColors.length]
        sos.cells.forEach(([r, c]) => {
            sosHighlight.set(`${r},${c}`, color)
        })
    })

    // Label kolom (A, B, C, ...)
    ctx.fillStyle = '#888899'
    ctx.font = `bold ${Math.floor(CELL * 0.28)}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let c = 0; c < cols; c++) {
        const x = PAD + LABEL_PAD + c * CELL + CELL / 2
        ctx.fillText(String.fromCharCode(65 + c), x, PAD + 10)
    }

    // Label baris (1, 2, 3, ...)
    for (let r = 0; r < rows; r++) {
        const y = PAD + LABEL_PAD + r * CELL + CELL / 2
        ctx.fillText((r + 1).toString(), PAD + 10, y)
    }

    // Gambar sel papan
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = PAD + LABEL_PAD + c * CELL
            const y = PAD + LABEL_PAD + r * CELL
            const key = `${r},${c}`

            let bg
            if (sosHighlight.has(key)) {
                bg = sosHighlight.get(key) + '33'
            } else {
                bg = (r + c) % 2 === 0 ? '#1e1e35' : '#252540'
            }
            ctx.fillStyle = bg
            ctx.fillRect(x, y, CELL, CELL)

            ctx.strokeStyle = '#3a3a5c'
            ctx.lineWidth = 1
            ctx.strokeRect(x, y, CELL, CELL)

            if (sosHighlight.has(key)) {
                ctx.strokeStyle = sosHighlight.get(key)
                ctx.lineWidth = 2.5
                ctx.strokeRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3)
            }

            const letter = game.board[r][c]
            if (letter) {
                const fontSize = Math.floor(CELL * 0.52)
                ctx.font = `bold ${fontSize}px monospace`
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'

                ctx.fillStyle = 'rgba(0,0,0,0.5)'
                ctx.fillText(letter, x + CELL / 2 + 1.5, y + CELL / 2 + 1.5)

                if (sosHighlight.has(key)) {
                    ctx.fillStyle = sosHighlight.get(key)
                } else if (letter === 'S') {
                    ctx.fillStyle = '#7ec8ff'
                } else {
                    ctx.fillStyle = '#ffcc66'
                }
                ctx.fillText(letter, x + CELL / 2, y + CELL / 2)
            }
        }
    }

    // Border papan
    ctx.strokeStyle = '#5555aa'
    ctx.lineWidth = 2.5
    ctx.strokeRect(PAD + LABEL_PAD, PAD + LABEL_PAD, BOARD_W, BOARD_H)

    // ── Info bar bawah ──
    const infoY = PAD + LABEL_PAD + BOARD_H + 14
    ctx.font = `bold ${Math.floor(CELL * 0.28)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const p1Name = game.p1Name
    const p2Name = game.p2Name
    const turnName = game.turn === 'p1' ? p1Name : p2Name

    ctx.fillStyle = '#cccccc'
    ctx.fillText(
        `${p1Name}: ${game.p1Score}  vs  ${p2Name}: ${game.p2Score}  |  Giliran: ${turnName}  Move#${game.moveCount + 1}`,
        W / 2, infoY + 10
    )

    return canvas.toBuffer('image/png')
}

// ─────────────────────────────────────────────
//  PARSE NOTASI PAPAN
// ─────────────────────────────────────────────

/**
 * Parse "A1" → [0, 0], "C5" → [4, 2]
 * Sekarang validasi menggunakan rows & cols secara terpisah
 */
function parseNotation(str, rows, cols) {
    if (!str || str.length < 2) return null
    const col = str[0].toUpperCase().charCodeAt(0) - 65
    const row = parseInt(str.slice(1)) - 1
    if (isNaN(row) || col < 0 || col >= cols || row < 0 || row >= rows) return null
    return [row, col]
}

function toNotation(r, c) {
    return String.fromCharCode(65 + c) + (r + 1)
}

// ─────────────────────────────────────────────
//  BOT HANDLER — eksekusi giliran bot
// ─────────────────────────────────────────────

async function executeBotTurn(chatId, game, sock, m, prefix) {
    const humanPlayer = game.p1

    const thinkImg = await renderBoard(game)
    if (game.lastBoardKey) {
        try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
    }
    const thinkMsg = await sock.sendMessage(chatId, {
        image: thinkImg,
        caption: `🤖 *Bot sedang berpikir...*\n_Menganalisis papan ${game.rows}x${game.cols}..._`,
        mentions: [humanPlayer]
    }, { quoted: m })
    game.lastBoardKey = thinkMsg?.key || null

    await new Promise(resolve => setTimeout(resolve, 8000))

    const move = getBotMove(game)

    if (!move) return

    const { r, c, letter: botLetter } = move
    game.board[r][c] = botLetter
    game.moveCount++

    const rawNew = checkNewSOS(game.board, r, c)
    const newSOS = filterNewSOS(rawNew, game.sosList)

    let scored = false
    if (newSOS.length > 0) {
        newSOS.forEach(s => {
            s.by = 'p2'
            game.sosList.push(s)
        })
        game.p2Score += newSOS.length
        scored = true
    }

    const full = isBoardFull(game.board)

    if (full) {
        const img = await renderBoard(game)
        if (game.lastBoardKey) {
            try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        }
        sessions.delete(chatId)

        let resultText
        if (game.p1Score > game.p2Score) {
            resultText =
                `🏆 *GAME SELESAI!*\n\n` +
                `🎉 @${jidToNum(game.p1)} *MENANG melawan BOT!*\n` +
                `📊 Skor: @${jidToNum(game.p1)} *${game.p1Score}* vs Bot *${game.p2Score}*\n\n` +
                `_Total ${game.moveCount} gerakan_`
        } else if (game.p2Score > game.p1Score) {
            resultText =
                `🏆 *GAME SELESAI!*\n\n` +
                `🤖 *BOT MENANG!*\n` +
                `📊 Skor: Bot *${game.p2Score}* vs @${jidToNum(game.p1)} *${game.p1Score}*\n\n` +
                `_Total ${game.moveCount} gerakan_`
        } else {
            resultText =
                `🏆 *GAME SELESAI!*\n\n` +
                `🤝 *SERI!*\n` +
                `📊 Skor: @${jidToNum(game.p1)} *${game.p1Score}* vs Bot *${game.p2Score}*\n\n` +
                `_Total ${game.moveCount} gerakan_`
        }

        await sock.sendMessage(chatId, {
            image: img,
            caption: resultText,
            mentions: [humanPlayer]
        }, { quoted: m })
        return
    }

    if (scored) {
        const img = await renderBoard(game)
        if (game.lastBoardKey) {
            try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        }
        const sentMsg = await sock.sendMessage(chatId, {
            image: img,
            caption:
                `🤖 *Bot taruh [${botLetter}] di ${toNotation(r, c)}*\n` +
                `✨ *Bot dapat +${newSOS.length} SOS!* (total: ${game.p2Score})\n` +
                `🔄 *Bot main lagi karena buat SOS!*\n\n` +
                `📊 Skor: @${jidToNum(game.p1)} *${game.p1Score}* vs Bot *${game.p2Score}*`,
            mentions: [humanPlayer]
        }, { quoted: m })
        game.lastBoardKey = sentMsg?.key || null

        await new Promise(resolve => setTimeout(resolve, 8000))
        await executeBotTurn(chatId, game, sock, m, prefix)
        return
    }

    game.turn = 'p1'

    const img = await renderBoard(game)
    if (game.lastBoardKey) {
        try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
    }
    const sentMsg = await sock.sendMessage(chatId, {
        image: img,
        caption:
            `🤖 *Bot taruh [${botLetter}] di ${toNotation(r, c)}*\n\n` +
            `📊 Skor: @${jidToNum(game.p1)} *${game.p1Score}* vs Bot *${game.p2Score}*\n` +
            `🟡 Giliranmu, @${jidToNum(game.p1)}!\n` +
            `_Gerak: \`${prefix}sos [posisi] S/O\` contoh: \`${prefix}sos B3 S\`_`,
        mentions: [humanPlayer]
    }, { quoted: m })
    game.lastBoardKey = sentMsg?.key || null
}

// ─────────────────────────────────────────────
//  HANDLER UTAMA
// ─────────────────────────────────────────────

async function handler(m, { sock, config: botConfig, db }) {
    const chatId = m.chat
    // Normalize senderId agar tidak ada :device suffix
    const senderId = m.sender
    const prefix = botConfig.command?.prefix || '.'
    const rawBody = (m.body || '').trim()
    const args = rawBody.split(/\s+/).slice(1)
    const sub = args[0]?.toLowerCase()

    // Nomor bot (normalize)
    const botNumber = normalizeJid(sock.user?.id || '')
    const isMentioningBot = (m.mentionedJid || []).some(jid =>
        normalizeJid(jid) === botNumber
    )

    // ── .sos resign ──
    if (sub === 'resign' || sub === 'nyerah' || sub === 'stop') {
        const game = sessions.get(chatId)
        if (!game) return m.reply('❌ *Ehh~* Tidak ada game SOS yang sedang berjalan di sini~ 🥺')
        if (game.p1 !== senderId && game.p2 !== senderId)
            return m.reply('❌ *Ehh~* Kamu tidak sedang main di sini~ 🥺')

        const winner = game.p1 === senderId ? game.p2 : game.p1
        const img = await renderBoard(game)
        if (game.lastBoardKey) {
            try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        }
        sessions.delete(chatId)

        if (game.vsBot && winner === botNumber) {
            return sock.sendMessage(chatId, {
                image: img,
                caption:
                    `🏳️ @${jidToNum(senderId)} menyerah!\n` +
                    `🤖 *BOT MENANG!* Hahaha 😏\n\n` +
                    `📊 Skor akhir: @${jidToNum(senderId)} *${game.p1Score}* vs Bot *${game.p2Score}*`,
                mentions: [senderId]
            }, { quoted: m })
        }

        return sock.sendMessage(chatId, {
            image: img,
            caption:
                `🏳️ @${jidToNum(senderId)} menyerah!\n` +
                `🏆 @${(winner === game.p1 ? jidToNum(game.p1) : jidToNum(game.p2))} *MENANG!*\n\n` +
                `📊 Skor akhir: ${game.p1Score} vs ${game.p2Score}`,
            mentions: [senderId, winner]
        }, { quoted: m })
    }

    // ── Belum ada game → mulai ──
    if (!sessions.has(chatId)) {
        const mentioned = m.mentionedJid?.[0]
            || m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

        let opponent = null
        if (mentioned) {
            const num = mentioned.replace(/:\d+@/, '@').split('@')[0]
            if (/^\d{10,}$/.test(num)) opponent = mentioned  // simpan as-is untuk mention
        }

        if (!opponent || opponent === senderId) {
            return m.reply(
                `🔤 *GAME SOS*\n\n` +
                `Aturan:\n` +
                `• Tiap giliran bebas pilih mau taruh *S* atau *O*\n` +
                `• Bentuk kata *S-O-S* di papan (horizontal, vertikal, diagonal)\n` +
                `• Setiap SOS yang kamu buat = +1 poin & giliran ekstra!\n` +
                `• Papan penuh → yang poin terbanyak *MENANG!*\n\n` +
                `Mulai vs pemain: *${prefix}sos @lawan [ukuran]*\n` +
                `Atau papan persegi panjang: *${prefix}sos @lawan [tinggi] [lebar]*\n` +
                `Mulai vs bot: *${prefix}sos @bot [ukuran]*\n` +
                `Ukuran: 3–10 (default 5), contoh: \`${prefix}sos @user 4 6\` = papan 4 baris 6 kolom\n\n` +
                `Gerak: *${prefix}sos [posisi] [S/O]*\n` +
                `Contoh: \`${prefix}sos B3 S\` atau \`${prefix}sos B3 O\`\n\n` +
                `Nyerah: *${prefix}sos resign*`
            )
        }

        // Ambil ukuran papan dari args
        // Filter mention (@xxx) dulu, lalu parse angka
        // Support: "5" | "3 6" | "3x6" | "3X6" | "3×6"
        const sizeArgs = args.filter(a => !a.startsWith('@') && !/^\d{10,}$/.test(a))
        const nums = []
        for (const arg of sizeArgs) {
            const splitMatch = arg.match(/^(\d+)[xX×*](\d+)$/)
            if (splitMatch) {
                const a = parseInt(splitMatch[1])
                const b = parseInt(splitMatch[2])
                if (a >= MIN_SIZE && a <= MAX_SIZE) nums.push(a)
                if (b >= MIN_SIZE && b <= MAX_SIZE) nums.push(b)
                break
            }
            const n = parseInt(arg)
            if (!isNaN(n) && n >= MIN_SIZE && n <= MAX_SIZE) nums.push(n)
        }

        let boardRows = 5
        let boardCols = 5

        if (nums.length >= 2) {
            boardRows = nums[0]
            boardCols = nums[1]
        } else if (nums.length === 1) {
            boardRows = nums[0]
            boardCols = nums[0]
        }

        const isVsBot = opponent === botNumber || isMentioningBot

        const firstTurn = Math.random() < 0.5 ? 'p1' : 'p2'
        const firstPlayer = firstTurn === 'p1' ? senderId : opponent

        const sizeLabel = boardRows === boardCols
            ? `${boardRows}x${boardCols}`
            : `${boardRows} baris x ${boardCols} kolom`

        if (isVsBot) {
            const game = createGame(senderId, botNumber, firstTurn, boardRows, boardCols, true, m.pushName || null, 'Bot')
            sessions.set(chatId, game)

            const img = await renderBoard(game)
            const sentMsg = await sock.sendMessage(chatId, {
                image: img,
                caption:
                    `🔤 *GAME SOS vs BOT DIMULAI!*\n\n` +
                    `📏 Ukuran papan: *${sizeLabel}*\n` +
                    `🎲 Giliran pertama: ${firstTurn === 'p1' ? `@${jidToNum(senderId)}` : '🤖 Bot'}\n\n` +
                    `*Cara main:* \`${prefix}sos [posisi] [S/O]\`\n` +
                    `Contoh: \`${prefix}sos B3 S\` atau \`${prefix}sos B3 O\`\n\n` +
                    `_Tiap giliran bebas pilih mau taruh S atau O!_\n` +
                    `_Buat kata SOS → dapat poin & giliran ekstra!_\n` +
                    `_Poin terbanyak saat papan penuh = MENANG!_ 🏆`,
                mentions: [senderId]
            }, { quoted: m })
            game.lastBoardKey = sentMsg?.key || null

            if (firstTurn === 'p2') {
                await executeBotTurn(chatId, game, sock, m, prefix)
            }
            return
        }

        // ── VS HUMAN MODE ──
        const game = createGame(senderId, opponent, firstTurn, boardRows, boardCols, false, m.pushName || null, null)
        sessions.set(chatId, game)

        const img = await renderBoard(game)
        const sentMsg = await sock.sendMessage(chatId, {
            image: img,
            caption:
                `🔤 *GAME SOS DIMULAI!*\n\n` +
                `📏 Ukuran papan: *${sizeLabel}*\n` +
                `🎲 Giliran pertama: @${(firstTurn === 'p1' ? jidToNum(game.p1) : jidToNum(game.p2))}\n\n` +
                `*Cara main:* \`${prefix}sos [posisi] [S/O]\`\n` +
                `Contoh: \`${prefix}sos B3 S\` atau \`${prefix}sos B3 O\`\n\n` +
                `_Tiap giliran bebas pilih mau taruh S atau O!_\n` +
                `_Buat kata SOS → dapat poin & giliran ekstra!_\n` +
                `_Poin terbanyak saat papan penuh = MENANG!_ 🏆`,
            mentions: [senderId, opponent]
        }, { quoted: m })
        game.lastBoardKey = sentMsg?.key || null
        return
    }

    // ── Game berjalan → proses gerakan ──
    const game = sessions.get(chatId)
    const currentPlayer = game.turn === 'p1' ? game.p1 : game.p2

    if (senderId !== currentPlayer) {
        const isBot = currentPlayer === botNumber
        return m.reply(
            `⏳ Bukan giliranmu! Tunggu ${isBot ? '🤖 Bot' : `@${(currentPlayer === game.p1 ? jidToNum(game.p1) : jidToNum(game.p2))}`} dulu.`,
            { mentions: isBot ? [] : [currentPlayer] }
        )
    }

    // Update nama WA pemain setiap kali mereka kirim pesan (supaya nama terbaru tersimpan)
    if (m.pushName) {
        if (senderId === game.p1) game.p1Name = m.pushName
        else if (senderId === game.p2) game.p2Name = m.pushName
    }

    // Kalau tidak ada arg → tampilkan info
    if (!args[0] || args[0].toLowerCase() === 'info') {
        const empty = countEmpty(game.board)
        const sizeLabel = game.rows === game.cols
            ? `${game.rows}x${game.cols}`
            : `${game.rows}x${game.cols}`
        return m.reply(
            `🔤 *INFO GAME SOS*\n\n` +
            `📏 Papan: ${sizeLabel} | Sisa sel: ${empty}\n` +
            `📊 Skor: @${jidToNum(game.p1)} *${game.p1Score}* vs ${game.vsBot ? '🤖Bot' : `@${jidToNum(game.p2)}`} *${game.p2Score}*\n\n` +
            `_Gerak: \`${prefix}sos [posisi] [S/O]\` contoh: \`${prefix}sos B3 S\`_`
        )
    }

    // Parse posisi dan huruf dari args
    const pos = parseNotation(args[0], game.rows, game.cols)
    if (!pos) {
        return m.reply(
            `❌ Posisi tidak valid! Gunakan format seperti *A1*, *C5*, dsb.\n` +
            `Kolom: A–${String.fromCharCode(64 + game.cols)}, Baris: 1–${game.rows}`
        )
    }

    const letterArg = args[1]?.toUpperCase()
    if (!letterArg || (letterArg !== 'S' && letterArg !== 'O')) {
        return m.reply(
            `❌ Huruf tidak valid! Tulis *S* atau *O* setelah posisi.\n` +
            `Contoh: \`${prefix}sos B3 S\` atau \`${prefix}sos B3 O\``
        )
    }
    const myLetter = letterArg

    const [row, col] = pos
    if (game.board[row][col] !== null) {
        return m.reply(`❌ *Ehh~* Sel *${toNotation(row, col)}* sudah terisi! Pilih sel lain~ 🥺`)
    }

    // ── Lakukan gerakan ──
    game.board[row][col] = myLetter
    game.moveCount++

    const rawNew = checkNewSOS(game.board, row, col)
    const newSOS = filterNewSOS(rawNew, game.sosList)

    let scored = false
    if (newSOS.length > 0) {
        newSOS.forEach(s => {
            s.by = game.turn
            game.sosList.push(s)
        })
        if (game.turn === 'p1') game.p1Score += newSOS.length
        else game.p2Score += newSOS.length
        scored = true
    }

    // Cek papan penuh
    const full = isBoardFull(game.board)
    if (full) {
        const img = await renderBoard(game)
        if (game.lastBoardKey) {
            try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        }
        sessions.delete(chatId)

        const p1Name = jidToNum(game.p1)
        const p2Name = jidToNum(game.p2)
        const mentions = game.vsBot ? [game.p1] : [game.p1, game.p2]

        let resultCaption
        if (game.p1Score > game.p2Score) {
            resultCaption =
                `🏆 *GAME SOS SELESAI!*\n\n` +
                `🎉 @${p1Name} *MENANG!*\n` +
                `📊 Skor: @${p1Name} *${game.p1Score}* vs ${game.vsBot ? '🤖Bot' : `@${p2Name}`} *${game.p2Score}*\n\n` +
                `_Total ${game.moveCount} gerakan_`
        } else if (game.p2Score > game.p1Score) {
            resultCaption =
                `🏆 *GAME SOS SELESAI!*\n\n` +
                (game.vsBot
                    ? `🤖 *BOT MENANG!*\n😔 @${p1Name} kalah dari bot!\n`
                    : `🎉 @${p2Name} *MENANG!*\n`) +
                `📊 Skor: ${game.vsBot ? `🤖Bot *${game.p2Score}*` : `@${p2Name} *${game.p2Score}*`} vs @${p1Name} *${game.p1Score}*\n\n` +
                `_Total ${game.moveCount} gerakan_`
        } else {
            resultCaption =
                `🏆 *GAME SOS SELESAI!*\n\n` +
                `🤝 *SERI!* Kedua pemain sama kuat!\n` +
                `📊 Skor: @${p1Name} *${game.p1Score}* vs ${game.vsBot ? '🤖Bot' : `@${p2Name}`} *${game.p2Score}*\n\n` +
                `_Total ${game.moveCount} gerakan_`
        }

        await sock.sendMessage(chatId, {
            image: img,
            caption: resultCaption,
            mentions
        }, { quoted: m })
        return
    }

    // Jika dapat SOS → main lagi (giliran ekstra)
    if (scored) {
        const img = await renderBoard(game)
        if (game.lastBoardKey) {
            try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        }

        const myScore = game.turn === 'p1' ? game.p1Score : game.p2Score

        const sentMsg = await sock.sendMessage(chatId, {
            image: img,
            caption:
                `🎉 *@${jidToNum(senderId)} taruh [${myLetter}] di ${toNotation(row, col)}*\n` +
                `✨ *+${newSOS.length} SOS terbentuk!* (total: ${myScore})\n` +
                `🔄 *Giliran ekstra! Main lagi karena buat SOS!*\n\n` +
                `📊 Skor: @${jidToNum(game.p1)} *${game.p1Score}* vs ${game.vsBot ? '🤖Bot' : `@${jidToNum(game.p2)}`} *${game.p2Score}*\n\n` +
                `_Gerak: \`${prefix}sos [posisi] S/O\` contoh: \`${prefix}sos B3 S\`_`,
            mentions: [senderId, game.p1, game.p2].filter((v, i, a) => v && a.indexOf(v) === i)
        }, { quoted: m })
        game.lastBoardKey = sentMsg?.key || null
        return
    }

    // ── Ganti giliran ──
    game.turn = game.turn === 'p1' ? 'p2' : 'p1'
    const nextPlayer = game.turn === 'p1' ? game.p1 : game.p2
    const isNextBot = game.vsBot && nextPlayer === botNumber

    if (isNextBot) {
        const img = await renderBoard(game)
        if (game.lastBoardKey) {
            try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        }
        const sentMsg = await sock.sendMessage(chatId, {
            image: img,
            caption:
                `✅ *@${jidToNum(senderId)} taruh [${myLetter}] di ${toNotation(row, col)}*\n\n` +
                `📊 Skor: @${jidToNum(game.p1)} *${game.p1Score}* vs 🤖Bot *${game.p2Score}*\n\n` +
                `🤖 *Bot sedang berpikir...*`,
            mentions: [senderId]
        }, { quoted: m })
        game.lastBoardKey = sentMsg?.key || null

        await executeBotTurn(chatId, game, sock, m, prefix)
        return
    }

    // ── Lanjut vs human ──
    const img = await renderBoard(game)
    if (game.lastBoardKey) {
        try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
    }

    const sentMsg = await sock.sendMessage(chatId, {
        image: img,
        caption:
            `✅ *@${jidToNum(senderId)} taruh [${myLetter}] di ${toNotation(row, col)}*\n\n` +
            `📊 Skor: @${jidToNum(game.p1)} *${game.p1Score}* vs @${jidToNum(game.p2)} *${game.p2Score}*\n\n` +
            `🟡 Giliran: @${(nextPlayer === game.p1 ? jidToNum(game.p1) : jidToNum(game.p2))}\n` +
            `_Gerak: \`${prefix}sos [posisi] S/O\` contoh: \`${prefix}sos B3 S\`_`,
        mentions: [senderId, game.p1, game.p2, nextPlayer].filter((v, i, a) => v && a.indexOf(v) === i)
    }, { quoted: m })
    game.lastBoardKey = sentMsg?.key || null
}

module.exports = {
    config: pluginConfig,
    handler
}