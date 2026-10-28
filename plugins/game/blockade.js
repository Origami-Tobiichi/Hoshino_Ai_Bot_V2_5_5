const { createCanvas } = require('@napi-rs/canvas')

const pluginConfig = {
    name: 'blockade',
    alias: ['bade', 'gembok'],
    category: 'game',
    description: 'Game mengunci batu lawan! Kunci semua batu lawan untuk menang.',
    usage: '.blockade [@lawan]',
    example: '.blockade @user',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

const CONNECTIONS = {
    0: [1, 3, 4],
    1: [0, 2, 4],
    2: [1, 4, 5],
    3: [0, 4, 6],
    4: [0, 1, 2, 3, 5, 6, 7, 8],
    5: [2, 4, 8],
    6: [3, 4, 7],
    7: [6, 4, 8],
    8: [5, 4, 7]
}

const NODE_POS = [
    [80,  80],
    [240, 80],
    [400, 80],
    [80,  240],
    [240, 240],
    [400, 240],
    [80,  400],
    [240, 400],
    [400, 400],
]

const LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
]

const FORBIDDEN_LINE_P1 = [0, 1, 2]
const FORBIDDEN_LINE_P2 = [6, 7, 8]

function isForbiddenLine(line, turn) {
    const forbidden = turn === 'p1' ? FORBIDDEN_LINE_P1 : FORBIDDEN_LINE_P2
    return line.length === forbidden.length && line.every((n, i) => n === forbidden[i])
}

const sessions = new Map()

function createGame(p1, p2, firstTurn, vsBot = false) {
    return {
        p1, p2,
        stonesP1: [0, 1, 2],
        stonesP2: [6, 7, 8],
        turn: firstTurn,
        selected: null,
        moveCount: 0,
        status: 'playing',
        lastBoardKey: null,
        vsBot
    }
}

function getOccupied(game) {
    return new Set([...game.stonesP1, ...game.stonesP2])
}

function canMove(nodeIdx, occupied) {
    return CONNECTIONS[nodeIdx].some(n => !occupied.has(n))
}

function allBlocked(stones, occupied) {
    return stones.every(n => !canMove(n, occupied))
}

function isLoser(stones, occupied) {
    const blockedCount = stones.filter(n => !canMove(n, occupied)).length
    return blockedCount >= 2
}

function getAlignedLine(stones, turn) {
    const stoneSet = new Set(stones)
    return LINES.find(line =>
        line.every(n => stoneSet.has(n)) && !isForbiddenLine(line, turn)
    ) || null
}

// ─────────────────────────────────────────────
//  BOT AI - MINIMAX
// ─────────────────────────────────────────────

// Evaluasi papan untuk bot (p2 = biru)
function evaluateState(stonesP1, stonesP2) {
    const occupied = new Set([...stonesP1, ...stonesP2])

    // Cek kemenangan langsung
    const p2Line = getAlignedLine(stonesP2, 'p2')
    if (p2Line) return 1000

    const p1Line = getAlignedLine(stonesP1, 'p1')
    if (p1Line) return -1000

    const p2Blocked = stonesP2.filter(n => !canMove(n, occupied)).length
    const p1Blocked = stonesP1.filter(n => !canMove(n, occupied)).length

    if (p1Blocked >= 2) return 900   // bot menang kunci
    if (p2Blocked >= 2) return -900  // bot kalah kunci

    let score = 0

    // Bonus: bot punya batu di tengah (node 4)
    if (stonesP2.includes(4)) score += 30
    if (stonesP1.includes(4)) score -= 30

    // Bonus mobilitas: makin banyak gerak bot makin bagus
    const p2Mobility = stonesP2.reduce((acc, n) => acc + CONNECTIONS[n].filter(x => !occupied.has(x)).length, 0)
    const p1Mobility = stonesP1.reduce((acc, n) => acc + CONNECTIONS[n].filter(x => !occupied.has(x)).length, 0)
    score += (p2Mobility - p1Mobility) * 2

    // Bonus: bot mendekati sejajar
    for (const line of LINES) {
        if (isForbiddenLine(line, 'p2')) continue
        const p2InLine = line.filter(n => stonesP2.includes(n)).length
        const p1InLine = line.filter(n => stonesP1.includes(n)).length
        if (p1InLine === 0) score += p2InLine * 10
        if (p2InLine === 0) score -= p1InLine * 10
    }

    // Bonus: bot mengancam kunci lawan
    score += p1Blocked * 15
    score -= p2Blocked * 15

    return score
}

// Dapatkan semua langkah valid untuk satu set batu
function getValidMoves(stones, occupied) {
    const moves = []
    for (let si = 0; si < stones.length; si++) {
        const from = stones[si]
        for (const to of CONNECTIONS[from]) {
            if (!occupied.has(to)) {
                moves.push({ si, from, to })
            }
        }
    }
    return moves
}

function minimaxBot(stonesP1, stonesP2, depth, alpha, beta, isMaximizing) {
    const occupied = new Set([...stonesP1, ...stonesP2])

    // Terminal checks
    if (getAlignedLine(stonesP2, 'p2')) return { score: 1000 + depth }
    if (getAlignedLine(stonesP1, 'p1')) return { score: -1000 - depth }
    if (stonesP1.filter(n => !canMove(n, occupied)).length >= 2) return { score: 900 + depth }
    if (stonesP2.filter(n => !canMove(n, occupied)).length >= 2) return { score: -900 - depth }

    if (depth === 0) return { score: evaluateState(stonesP1, stonesP2) }

    if (isMaximizing) {
        // Bot giliran (p2)
        const moves = getValidMoves(stonesP2, occupied)
        if (moves.length === 0) return { score: -900 }

        let best = { score: -Infinity, move: null }
        for (const mv of moves) {
            const newP2 = [...stonesP2]
            newP2[mv.si] = mv.to
            const result = minimaxBot(stonesP1, newP2, depth - 1, alpha, beta, false)
            if (result.score > best.score) {
                best = { score: result.score, move: mv }
            }
            alpha = Math.max(alpha, best.score)
            if (beta <= alpha) break
        }
        return best
    } else {
        // Player giliran (p1)
        const moves = getValidMoves(stonesP1, occupied)
        if (moves.length === 0) return { score: 900 }

        let best = { score: Infinity, move: null }
        for (const mv of moves) {
            const newP1 = [...stonesP1]
            newP1[mv.si] = mv.to
            const result = minimaxBot(newP1, stonesP2, depth - 1, alpha, beta, true)
            if (result.score < best.score) {
                best = { score: result.score, move: mv }
            }
            beta = Math.min(beta, best.score)
            if (beta <= alpha) break
        }
        return best
    }
}

function getBotMove(game) {
    const depth = 6
    const result = minimaxBot(
        [...game.stonesP1],
        [...game.stonesP2],
        depth,
        -Infinity,
        Infinity,
        true
    )
    return result.move || null
}

// Komentar bot setelah bergerak
function getBotComment(won, isWinning, moveCount) {
    if (won) return pick([
        '😏 Sudah kuprediksi dari awal.',
        '🧠 Setiap langkahmu sudah aku kalkulasi.',
        '🤖 Ini hasil dari strategi yang matang.',
    ])
    if (isWinning) return pick([
        '😌 Posisimu semakin terjepit.',
        '📊 Secara matematis, kamu sudah hampir kalah.',
        '🎯 Satu langkah lagi...',
    ])
    return pick([
        '🤔 Pikirkan baik-baik langkah berikutnya.',
        '⏱️ Aku tunggu. Tapi hasilnya sudah bisa kutebak.',
        '📐 Setiap langkahku sudah diperhitungkan.',
        '🎲 Keberuntunganmu tidak akan cukup melawanku.',
    ])
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}

// ─────────────────────────────────────────────
//  RENDER PAPAN
// ─────────────────────────────────────────────

async function renderBoard(game, highlightNode = null, winLine = null) {
    const SIZE = 500
    const canvas = createCanvas(SIZE, SIZE)
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, SIZE, SIZE)

    ctx.fillStyle = '#e0e0e0'
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('♟ BLOCKADE GAME ♟', SIZE / 2, 35)

    if (winLine) {
        for (const nodeIdx of winLine) {
            const [x, y] = NODE_POS[nodeIdx]
            ctx.beginPath()
            ctx.arc(x, y, 32, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(255, 215, 0, 0.25)'
            ctx.fill()
        }
        const [n0, n1, n2] = winLine
        ctx.beginPath()
        ctx.moveTo(NODE_POS[n0][0], NODE_POS[n0][1])
        ctx.lineTo(NODE_POS[n1][0], NODE_POS[n1][1])
        ctx.lineTo(NODE_POS[n2][0], NODE_POS[n2][1])
        ctx.strokeStyle = '#ffd700'
        ctx.lineWidth = 6
        ctx.stroke()
    }

    ctx.strokeStyle = '#4a90d9'
    ctx.lineWidth = 3
    const drawn = new Set()
    for (let i = 0; i < 9; i++) {
        for (const j of CONNECTIONS[i]) {
            const key = [Math.min(i,j), Math.max(i,j)].join('-')
            if (drawn.has(key)) continue
            drawn.add(key)
            const [x1, y1] = NODE_POS[i]
            const [x2, y2] = NODE_POS[j]
            ctx.beginPath()
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y2)
            ctx.stroke()
        }
    }

    const occupied = getOccupied(game)

    for (let i = 0; i < 9; i++) {
        const [x, y] = NODE_POS[i]
        if (occupied.has(i)) continue
        ctx.beginPath()
        ctx.arc(x, y, 14, 0, Math.PI * 2)
        ctx.fillStyle = highlightNode === i ? '#f6f669' : '#2d3561'
        ctx.fill()
        ctx.strokeStyle = '#4a90d9'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = '#aaaaaa'
        ctx.font = 'bold 14px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText((i + 1).toString(), x, y)
    }

    for (let idx = 0; idx < game.stonesP1.length; idx++) {
        const node = game.stonesP1[idx]
        const [x, y] = NODE_POS[node]
        const isSelected = game.selected !== null && game.turn === 'p1' && game.selected === idx
        const blocked = !canMove(node, occupied)
        const onWinLine = winLine && winLine.includes(node)

        ctx.beginPath()
        ctx.arc(x, y, 22, 0, Math.PI * 2)
        ctx.fillStyle = blocked ? '#7a1a1a' : (isSelected ? '#ff6b6b' : '#e63946')
        ctx.fill()
        ctx.strokeStyle = onWinLine ? '#ffd700' : (isSelected ? '#ffff00' : '#ff9999')
        ctx.lineWidth = onWinLine ? 5 : (isSelected ? 4 : 2)
        ctx.stroke()
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 18px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(blocked ? 'X' : 'O', x, y)
    }

    for (let idx = 0; idx < game.stonesP2.length; idx++) {
        const node = game.stonesP2[idx]
        const [x, y] = NODE_POS[node]
        const isSelected = game.selected !== null && game.turn === 'p2' && game.selected === idx
        const blocked = !canMove(node, occupied)
        const onWinLine = winLine && winLine.includes(node)

        ctx.beginPath()
        ctx.arc(x, y, 22, 0, Math.PI * 2)
        ctx.fillStyle = blocked ? '#1a1a7a' : (isSelected ? '#6bc5ff' : '#4a90d9')
        ctx.fill()
        ctx.strokeStyle = onWinLine ? '#ffd700' : (isSelected ? '#ffff00' : '#99ccff')
        ctx.lineWidth = onWinLine ? 5 : (isSelected ? 4 : 2)
        ctx.stroke()
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 18px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(blocked ? 'X' : 'O', x, y)
    }

    const labels = ['1','2','3','4','5','6','7','8','9']
    for (let i = 0; i < 9; i++) {
        if (!occupied.has(i)) continue
        const [x, y] = NODE_POS[i]
        ctx.fillStyle = '#dddddd'
        ctx.font = 'bold 12px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(labels[i], x + 18, y - 18)
    }

    const turnName = game.turn === 'p1'
        ? `🔴 ${game.p1.split('@')[0]}`
        : (game.vsBot ? '🔵 BOT' : `🔵 ${game.p2.split('@')[0]}`)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`Giliran: ${turnName}  |  Move #${game.moveCount + 1}`, SIZE / 2, SIZE - 20)

    return canvas.toBuffer('image/png')
}

function boardStatus(game) {
    const occupied = getOccupied(game)
    const p1stones = game.stonesP1.map((n, i) => {
        const bl = !canMove(n, occupied)
        return `${bl ? '🔒' : '🔴'} Batu${i+1} → node ${n+1}`
    }).join('\n')
    const p2stones = game.stonesP2.map((n, i) => {
        const bl = !canMove(n, occupied)
        return `${bl ? '🔒' : '🔵'} Batu${i+1} → node ${n+1}`
    }).join('\n')
    return `🔴 P1:\n${p1stones}\n\n🔵 ${game.vsBot ? 'BOT' : 'P2'}:\n${p2stones}`
}

// ─────────────────────────────────────────────
//  BOT PLAY - eksekusi giliran bot
// ─────────────────────────────────────────────

async function playBotTurn(game, chatId, sock, prefix, quotedMsg = null) {
    const move = getBotMove(game)

    if (!move) {
        // Bot tidak bisa gerak = player menang
        const img = await renderBoard(game)
        if (game.lastBoardKey) try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        sessions.delete(chatId)
        await sock.sendMessage(chatId, {
            image: img,
            caption:
                `🏆 *GAME SELESAI!*\n\n` +
                `🎉 @${game.p1.split('@')[0]} *MENANG!*\n` +
                `🤖 Bot tidak bisa bergerak!\n\n` +
                `_Total ${game.moveCount} gerakan_`,
            mentions: [game.p1]
        }, { quoted: quotedMsg })
        return
    }

    const fromNode = move.from
    const toNode = move.to
    game.stonesP2[move.si] = toNode
    game.moveCount++

    const newOccupied = getOccupied(game)

    // Cek bot menang sejajar
    const alignedLine = getAlignedLine(game.stonesP2, 'p2')
    if (alignedLine) {
        const img = await renderBoard(game, null, alignedLine)
        if (game.lastBoardKey) try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        sessions.delete(chatId)
        const comment = getBotComment(true, false, game.moveCount)
        await sock.sendMessage(chatId, {
            image: img,
            caption:
                `✨ *SEJAJAR! BOT MENANG!*\n\n` +
                `🤖 Bot menyusun 3 batu sejajar!\n` +
                `Node: ${alignedLine.map(n => n+1).join(' → ')}\n\n` +
                `🏆 *BOT MENANG!*\n` +
                `😔 @${game.p1.split('@')[0]} kalah!\n\n` +
                `_"${comment}"_\n\n` +
                `_Total ${game.moveCount} gerakan_`,
            mentions: [game.p1]
        }, { quoted: quotedMsg })
        return
    }

    // Cek bot menang kunci
    const p1Blocked = game.stonesP1.filter(n => !canMove(n, newOccupied)).length
    if (isLoser(game.stonesP1, newOccupied) || allBlocked(game.stonesP1, newOccupied)) {
        const img = await renderBoard(game)
        if (game.lastBoardKey) try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        sessions.delete(chatId)
        const comment = getBotComment(true, false, game.moveCount)
        await sock.sendMessage(chatId, {
            image: img,
            caption:
                `🔒 *TERKUNCI! BOT MENANG!*\n\n` +
                `🔒 ${p1Blocked} batu @${game.p1.split('@')[0]} terkunci!\n\n` +
                `🏆 *BOT MENANG!*\n` +
                `😔 @${game.p1.split('@')[0]} kalah!\n\n` +
                `_"${comment}"_\n\n` +
                `_Total ${game.moveCount} gerakan_`,
            mentions: [game.p1]
        }, { quoted: quotedMsg })
        return
    }

    // Cek player bisa gerak tidak
    if (allBlocked(game.stonesP1, newOccupied)) {
        const img = await renderBoard(game)
        if (game.lastBoardKey) try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        sessions.delete(chatId)
        await sock.sendMessage(chatId, {
            image: img,
            caption:
                `🔒 *BOT MENANG!*\n\n` +
                `😔 @${game.p1.split('@')[0]} semua batu terkunci!\n\n` +
                `_Total ${game.moveCount} gerakan_`,
            mentions: [game.p1]
        }, { quoted: quotedMsg })
        return
    }

    // Lanjut giliran player
    game.turn = 'p1'
    const p1BlockedNow = game.stonesP1.filter(n => !canMove(n, newOccupied)).length
    const isWinning = evaluateState(game.stonesP1, game.stonesP2) > 50
    const comment = getBotComment(false, isWinning, game.moveCount)

    const img = await renderBoard(game)
    if (game.lastBoardKey) try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
    const sentMsg = await sock.sendMessage(chatId, {
        image: img,
        caption:
            `🤖 *Bot bergerak! (Move #${game.moveCount})*\n` +
            `📍 Node ${fromNode + 1} → ${toNode + 1}\n\n` +
            `_"${comment}"_\n\n` +
            `${p1BlockedNow > 0 ? `⚠️ ${p1BlockedNow} batumu terkunci!\n\n` : ''}` +
            `🟡 Giliran: 🔴 @${game.p1.split('@')[0]}\n\n` +
            `_Gerak: \`${prefix}blockade [dari] [ke]\`_`,
        mentions: [game.p1]
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
        if (!game) return m.reply('❌ *Ehh~* Tidak ada game yang sedang berjalan~ 🥺')
        if (game.p1 !== senderId && game.p2 !== senderId)
            return m.reply('❌ *Ehh~* Kamu tidak sedang main di sini~ 🥺')
        const winner = game.p1 === senderId ? game.p2 : game.p1
        const winnerName = game.vsBot && winner === botNumber ? '🤖 Bot' : `@${winner.split('@')[0]}`
        if (game.lastBoardKey) try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        sessions.delete(chatId)
        return sock.sendMessage(chatId, {
            text: `🏳️ @${senderId.split('@')[0]} menyerah!\n🏆 ${winnerName} *MENANG!*`,
            mentions: game.vsBot ? [senderId] : [senderId, winner]
        }, { quoted: m })
    }

    // ── Belum ada game → mulai ──
    if (!sessions.has(chatId)) {
        const mentioned = m.mentionedJid?.[0]
            || m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
        let opponent = mentioned
        if (!opponent && args[0]) {
            const num = args[0].replace(/[^0-9]/g, '')
            if (num) opponent = num + '@s.whatsapp.net'
        }

        if (!opponent || opponent === senderId) {
            return m.reply(
                `🎮 *BLOCKADE GAME*\n\n` +
                `Cara menang:\n` +
                `• 🔒 Kunci 2 batu lawan (tidak bisa gerak)\n` +
                `• ✨ Susun 3 batumu *sejajar* (baris/kolom/diagonal)\n\n` +
                `Aturan:\n` +
                `• Masing-masing punya 3 batu\n` +
                `• Gerak lewat garis yang terhubung\n` +
                `• Tidak boleh menempati node yang sudah ada batu\n\n` +
                `Mulai vs player: *${prefix}blockade @lawan*\n` +
                `Mulai vs bot: *${prefix}blockade @bot* 🤖\n` +
                `Gerak: *${prefix}blockade [dari] [ke]*\n` +
                `Nyerah: *${prefix}blockade resign*`
            )
        }

        // Cek apakah mention ke bot sendiri
        const mentionedNum = opponent.split('@')[0]
        const botNum = botNumber.split('@')[0]
        const isVsBot = mentionedNum === botNum

        // Cek game aktif
        // (tidak ada session → lanjut buat game baru)

        const firstTurn = isVsBot ? 'p1' : (Math.random() < 0.5 ? 'p1' : 'p2')
        const game = createGame(senderId, isVsBot ? botNumber : opponent, firstTurn, isVsBot)
        sessions.set(chatId, game)

        const firstPlayer = firstTurn === 'p1' ? senderId : opponent
        const img = await renderBoard(game)

        if (isVsBot) {
            const sentMsg = await sock.sendMessage(chatId, {
                image: img,
                caption:
                    `🎮 *BLOCKADE VS BOT DIMULAI!*\n\n` +
                    `🔴 Kamu: @${senderId.split('@')[0]} (node 1,2,3)\n` +
                    `🔵 Lawan: 🤖 *BOT (Mode Serius)*\n\n` +
                    `_"Aku sudah siapkan strategi terbaikku. Jangan harap menang dengan mudah."_\n\n` +
                    `🎲 Kamu mulai duluan!\n\n` +
                    `*Cara menang:*\n` +
                    `• 🔒 Kunci 2 batu lawan\n` +
                    `• ✨ Susun 3 batumu sejajar\n\n` +
                    `*Cara gerak:* \`${prefix}blockade [dari] [ke]\`\n` +
                    `Contoh: \`${prefix}blockade 1 5\`\n` +
                    `_Nyerah: \`${prefix}blockade resign\`_`,
                mentions: [senderId]
            }, { quoted: m })
            game.lastBoardKey = sentMsg?.key || null
        } else {
            const sentMsg = await sock.sendMessage(chatId, {
                image: img,
                caption:
                    `🎮 *BLOCKADE GAME DIMULAI!*\n\n` +
                    `🔴 Player 1: @${senderId.split('@')[0]} (node 1,2,3)\n` +
                    `🔵 Player 2: @${opponent.split('@')[0]} (node 7,8,9)\n\n` +
                    `🎲 Giliran pertama: @${firstPlayer.split('@')[0]}\n\n` +
                    `*Cara menang:*\n` +
                    `• 🔒 Kunci 2 batu lawan\n` +
                    `• ✨ Susun 3 batumu sejajar (baris/kolom/diagonal)\n\n` +
                    `*Cara gerak:* \`${prefix}blockade [dari] [ke]\`\n` +
                    `Contoh: \`${prefix}blockade 1 5\`\n` +
                    `_Nyerah: \`${prefix}blockade resign\`_`,
                mentions: [senderId, opponent]
            }, { quoted: m })
            game.lastBoardKey = sentMsg?.key || null
        }
        return
    }

    // ── Ada game aktif ──
    const game = sessions.get(chatId)

    // Block mulai game baru kalau ada yang aktif
    const hasMention = (m.mentionedJid?.length > 0) ||
        (m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0)
    if (hasMention && sub !== 'resign' && sub !== 'nyerah') {
        const isPlayer = game.p1 === senderId || game.p2 === senderId
        const p1Name = game.p1.split('@')[0]
        const p2Name = game.vsBot ? '🤖 Bot' : game.p2.split('@')[0]
        if (isPlayer) {
            return m.reply(
                `❌ Kamu masih dalam game yang sedang berjalan!\n` +
                `Ketik \`${prefix}blockade resign\` untuk menyerah dulu.`
            )
        } else {
            return m.reply(
                `❌ Sudah ada game yang sedang berjalan!\n\n` +
                `🔴 @${p1Name} vs 🔵 ${game.vsBot ? p2Name : `@${p2Name}`}\n\n` +
                `Tunggu selesai atau ketik \`${prefix}blockade resign\``,
                { mentions: game.vsBot ? [game.p1] : [game.p1, game.p2] }
            )
        }
    }

    const currentPlayer = game.turn === 'p1' ? game.p1 : game.p2

    // Kalau vs bot dan giliran bot
    if (game.vsBot && game.turn === 'p2') {
        return m.reply('⏳ Tunggu bot berpikir...')
    }

    if (senderId !== currentPlayer) {
        return m.reply(`⏳ Bukan giliran kamu!\nTunggu @${currentPlayer.split('@')[0]} bergerak dulu.`, { mentions: [currentPlayer] })
    }

    const fromNum = parseInt(args[0])
    const toNum = parseInt(args[1])

    if (!fromNum || !toNum || fromNum < 1 || fromNum > 9 || toNum < 1 || toNum > 9) {
        return m.reply(
            `❌ Format salah!\n` +
            `Gunakan: \`${prefix}blockade [dari] [ke]\`\n` +
            `Contoh: \`${prefix}blockade 2 5\`\n\n` +
            boardStatus(game)
        )
    }

    const fromIdx = fromNum - 1
    const toIdx = toNum - 1
    const myStones = game.turn === 'p1' ? game.stonesP1 : game.stonesP2
    const occupied = getOccupied(game)

    const stoneIdx = myStones.indexOf(fromIdx)
    if (stoneIdx === -1)
        return m.reply(`❌ Kamu tidak punya batu di node ${fromNum}!\n\n${boardStatus(game)}`)

    if (occupied.has(toIdx))
        return m.reply(`❌ Node ${toNum} sudah ada batu!\n\n${boardStatus(game)}`)

    if (!CONNECTIONS[fromIdx].includes(toIdx)) {
        const validMoves = CONNECTIONS[fromIdx].filter(n => !occupied.has(n)).map(n => n + 1)
        return m.reply(
            `❌ Tidak ada jalur dari node ${fromNum} ke ${toNum}!\n` +
            `Node ${fromNum} bisa ke: ${validMoves.length > 0 ? validMoves.join(', ') : '(semua terkunci!)'}`
        )
    }

    // Eksekusi gerakan player
    if (game.turn === 'p1') {
        game.stonesP1[stoneIdx] = toIdx
    } else {
        game.stonesP2[stoneIdx] = toIdx
    }
    game.moveCount++

    const myNewStones = game.turn === 'p1' ? game.stonesP1 : game.stonesP2
    const nextTurn = game.turn === 'p1' ? 'p2' : 'p1'
    const nextStones = nextTurn === 'p1' ? game.stonesP1 : game.stonesP2
    const newOccupied = getOccupied(game)

    // Cek sejajar player
    const alignedLine = getAlignedLine(myNewStones, game.turn)
    if (alignedLine) {
        const winner = game.turn === 'p1' ? game.p1 : game.p2
        const loser  = game.turn === 'p1' ? game.p2 : game.p1
        const loserName = game.vsBot ? '🤖 Bot' : `@${loser.split('@')[0]}`
        const img = await renderBoard(game, null, alignedLine)
        if (game.lastBoardKey) try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        sessions.delete(chatId)
        await sock.sendMessage(chatId, {
            image: img,
            caption:
                `✨ *SEJAJAR! MENANG!*\n\n` +
                `🎉 @${winner.split('@')[0]} menyusun 3 batu sejajar!\n` +
                `Node: ${alignedLine.map(n => n+1).join(' → ')}\n\n` +
                `🏆 @${winner.split('@')[0]} *MENANG!*\n` +
                `😔 ${loserName} *KALAH!*\n\n` +
                `${game.vsBot ? '_🏅 Luar biasa! Kamu mengalahkan Bot!_\n' : ''}` +
                `_Total ${game.moveCount} gerakan_`,
            mentions: game.vsBot ? [winner] : [winner, loser]
        }, { quoted: m })
        return
    }

    // Cek kunci lawan
    const loserCheck = isLoser(nextStones, newOccupied)
    const allBlockedCheck = allBlocked(nextStones, newOccupied)

    if (loserCheck || allBlockedCheck) {
        const winner = game.turn === 'p1' ? game.p1 : game.p2
        const loser  = game.turn === 'p1' ? game.p2 : game.p1
        const blockedCount = nextStones.filter(n => !canMove(n, newOccupied)).length
        const loserName = game.vsBot ? '🤖 Bot' : `@${loser.split('@')[0]}`
        const img = await renderBoard(game)
        if (game.lastBoardKey) try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        sessions.delete(chatId)
        await sock.sendMessage(chatId, {
            image: img,
            caption:
                `🔒 *TERKUNCI! MENANG!*\n\n` +
                `🔒 ${blockedCount} batu ${loserName} terkunci!\n\n` +
                `🏆 @${winner.split('@')[0]} *MENANG!*\n` +
                `😔 ${loserName} *KALAH!*\n\n` +
                `${game.vsBot ? '_🏅 Luar biasa! Kamu mengalahkan Bot!_\n' : ''}` +
                `_Total ${game.moveCount} gerakan_`,
            mentions: game.vsBot ? [winner] : [winner, loser]
        }, { quoted: m })
        return
    }

    // Pindah giliran
    game.turn = nextTurn

    // VS BOT: langsung jalankan giliran bot
    if (game.vsBot && game.turn === 'p2') {
        const nextBlocked = game.stonesP2.filter(n => !canMove(n, newOccupied)).length
        const img = await renderBoard(game)
        if (game.lastBoardKey) try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        const sentMsg = await sock.sendMessage(chatId, {
            image: img,
            caption:
                `♟ *Gerakan ke-${game.moveCount}*\n` +
                `📍 Node ${fromNum} → ${toNum}\n\n` +
                `🤖 _Bot sedang berpikir..._`,
            mentions: [senderId]
        }, { quoted: m })
        game.lastBoardKey = sentMsg?.key || null

        await new Promise(r => setTimeout(r, 10000))
        await playBotTurn(game, chatId, sock, prefix, m)
        return
    }

    // VS PLAYER: lanjut normal
    const nextPlayer = nextTurn === 'p1' ? game.p1 : game.p2
    const nextBlocked = nextStones.filter(n => !canMove(n, newOccupied)).length
    const img = await renderBoard(game)

    let caption = `♟ *Gerakan ke-${game.moveCount}*\n📍 Node ${fromNum} → ${toNum}\n\n`
    if (nextBlocked > 0) caption += `⚠️ ${nextBlocked} batu @${nextPlayer.split('@')[0]} terkunci!\n\n`
    caption +=
        `🟡 Giliran: ${nextTurn === 'p1' ? '🔴' : '🔵'} @${nextPlayer.split('@')[0]}\n\n` +
        `_Gerak: \`${prefix}blockade [dari] [ke]\`_`

    if (game.lastBoardKey) try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
    const newMsg = await sock.sendMessage(chatId, {
        image: img,
        caption,
        mentions: [nextPlayer]
    }, { quoted: m })
    game.lastBoardKey = newMsg?.key || null
}

module.exports = { config: pluginConfig, handler }