const { createCanvas } = require('@napi-rs/canvas')

const pluginConfig = {
    name: 'chess',
    alias: ['catur'],
    category: 'game',
    description: 'Game catur PvP! Skakmat raja lawan untuk menang.',
    usage: '.chess [@lawan]',
    example: '.chess @user',
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
const BOT_THINK_DEPTH = 4

const UNICODE = {
    wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
    bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟'
}

const PIECE_VALUE = {
    P: 100,
    N: 320,
    B: 330,
    R: 500,
    Q: 900,
    K: 20000
}

const PAWN_TABLE = [
[0,0,0,0,0,0,0,0],
[5,10,10,-20,-20,10,10,5],
[5,-5,-10,0,0,-10,-5,5],
[0,0,0,20,20,0,0,0],
[5,5,10,25,25,10,5,5],
[10,10,20,30,30,20,10,10],
[50,50,50,50,50,50,50,50],
[0,0,0,0,0,0,0,0]
]

const INIT_BOARD = [
    ['bR','bN','bB','bQ','bK','bB','bN','bR'],
    ['bP','bP','bP','bP','bP','bP','bP','bP'],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ['wP','wP','wP','wP','wP','wP','wP','wP'],
    ['wR','wN','wB','wQ','wK','wB','wN','wR']
]

// ─────────────────────────────────────────────
//  HELPER
// ─────────────────────────────────────────────

const clone   = b => b.map(r => [...r])
const inB     = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8
const colorOf = p => p ? p[0] : null
const typeOf  = p => p ? p[1] : null

function parseSq(str) {
    if (!str || str.length < 2) return null
    const c = str.toLowerCase().charCodeAt(0) - 97
    const r = 8 - parseInt(str[1])
    if (isNaN(r) || c < 0 || c > 7 || r < 0 || r > 7) return null
    return [r, c]
}

function sqName(r, c) {
    return String.fromCharCode(97 + c) + (8 - r)
}

function createGame(p1, p2, vsBot = false, botColor = 'b') {
    return {
        p1, p2,               // p1 = putih, p2 = hitam
        board: clone(INIT_BOARD),
        turn: 'p1',           // putih selalu duluan
        moveCount: 0,
        lastBoardKey: null,
        enPassant: null,      // [r, c] target en passant
        castling: {
            wK: true, wRa: true, wRh: true,
            bK: true, bRa: true, bRh: true
        }, 
        vsBot,
        botColor
    }
}

// ─────────────────────────────────────────────
//  VALIDASI GERAK
// ─────────────────────────────────────────────

function pseudoMoves(board, r, c, ep, castling) {
    const p = board[r][c]
    if (!p) return []
    const col = colorOf(p), type = typeOf(p), opp = col === 'w' ? 'b' : 'w'
    const res = []

    const slide = dirs => {
        for (const [dr, dc] of dirs) {
            let nr = r+dr, nc = c+dc
            while (inB(nr, nc)) {
                if (board[nr][nc]) {
                    if (colorOf(board[nr][nc]) !== col) res.push([nr, nc])
                    break
                }
                res.push([nr, nc])
                nr+=dr; nc+=dc
            }
        }
    }

    if (type === 'P') {
        const dir = col === 'w' ? -1 : 1
        const sr  = col === 'w' ? 6 : 1
        if (inB(r+dir,c) && !board[r+dir][c]) {
            res.push([r+dir, c])
            if (r === sr && !board[r+2*dir][c]) res.push([r+2*dir, c])
        }
        for (const dc of [-1,1]) {
            const nr=r+dir, nc=c+dc
            if (!inB(nr,nc)) continue
            if (colorOf(board[nr][nc]) === opp) res.push([nr,nc])
            if (ep && ep[0]===nr && ep[1]===nc) res.push([nr,nc,'ep'])
        }
    } else if (type === 'N') {
        for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])
            if (inB(r+dr,c+dc) && colorOf(board[r+dr][c+dc]) !== col) res.push([r+dr,c+dc])
    } else if (type === 'B') {
        slide([[-1,-1],[-1,1],[1,-1],[1,1]])
    } else if (type === 'R') {
        slide([[-1,0],[1,0],[0,-1],[0,1]])
    } else if (type === 'Q') {
        slide([[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]])
    } else if (type === 'K') {
        for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])
            if (inB(r+dr,c+dc) && colorOf(board[r+dr][c+dc]) !== col) res.push([r+dr,c+dc])
        // Castling
        const kr = col==='w' ? 7 : 0
        if (r===kr && c===4) {
            if (castling[col+'K'] && castling[col+'Rh'] && !board[kr][5] && !board[kr][6] && board[kr][7]===col+'R')
                res.push([kr, 6, 'ck'])
            if (castling[col+'K'] && castling[col+'Ra'] && !board[kr][3] && !board[kr][2] && !board[kr][1] && board[kr][0]===col+'R')
                res.push([kr, 2, 'cq'])
        }
    }
    return res
}

function findKing(board, color) {
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) if (board[r][c]===color+'K') return [r,c]
    return null
}

function attacked(board, r, c, byColor) {
    const noCastle = {wK:false,wRa:false,wRh:false,bK:false,bRa:false,bRh:false}
    for (let fr=0;fr<8;fr++) for (let fc=0;fc<8;fc++)
        if (colorOf(board[fr][fc])===byColor)
            if (pseudoMoves(board,fr,fc,null,noCastle).some(([mr,mc])=>mr===r&&mc===c)) return true
    return false
}

function inCheck(board, color) {
    const k = findKing(board, color)
    return k ? attacked(board, k[0], k[1], color==='w'?'b':'w') : true
}

function doMove(board, r, c, tr, tc, flag, ep, castling) {
    const nb = clone(board)
    const p  = nb[r][c], col = colorOf(p), type = typeOf(p)
    const nc2 = { ...castling }

    // En passant
    if (flag === 'ep') {
        nb[col==='w' ? tr+1 : tr-1][tc] = null
    }
    nb[tr][tc] = p
    nb[r][c]   = null

    // Castling rook move
    if (flag === 'ck') { nb[tr][5]=nb[tr][7]; nb[tr][7]=null }
    if (flag === 'cq') { nb[tr][3]=nb[tr][0]; nb[tr][0]=null }

    // Promotion
    if (type==='P' && (tr===0||tr===7)) nb[tr][tc] = col+'Q'

    // Update castling rights
    if (p==='wK') { nc2.wK=false }
    if (p==='bK') { nc2.bK=false }
    if (r===7&&c===0) nc2.wRa=false
    if (r===7&&c===7) nc2.wRh=false
    if (r===0&&c===0) nc2.bRa=false
    if (r===0&&c===7) nc2.bRh=false

    // New en passant
    const nep = (type==='P' && Math.abs(tr-r)===2) ? [(r+tr)/2, c] : null

    return { nb, nep, nc2 }
}

function legalMoves(board, r, c, ep, castling) {
    const p = board[r][c]
    if (!p) return []
    const col = colorOf(p)
    const opp = col==='w'?'b':'w'
    const kr  = col==='w'?7:0
    return pseudoMoves(board, r, c, ep, castling).filter(([tr,tc,flag]) => {
        // Cek castling tidak melewati skak
        if (flag==='ck') {
            if (attacked(board,kr,4,opp)||attacked(board,kr,5,opp)||attacked(board,kr,6,opp)) return false
        }
        if (flag==='cq') {
            if (attacked(board,kr,4,opp)||attacked(board,kr,3,opp)||attacked(board,kr,2,opp)) return false
        }
        const { nb } = doMove(board, r, c, tr, tc, flag||null, ep, castling)
        return !inCheck(nb, col)
    })
}

function anyLegal(board, color, ep, castling) {
    for (let r=0;r<8;r++) for (let c=0;c<8;c++)
        if (colorOf(board[r][c])===color && legalMoves(board,r,c,ep,castling).length>0) return true
    return false
}

function evaluateBoard(board) {
    let score = 0

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {

            const piece = board[r][c]
            if (!piece) continue

            const color = colorOf(piece)
            const type = typeOf(piece)

            let val = PIECE_VALUE[type] || 0

            // positional bonus
            if (type === 'P') {
                val += color === 'w'
                    ? PAWN_TABLE[r][c]
                    : PAWN_TABLE[7-r][c]
            }

            if (color === 'b') score += val
            else score -= val
        }
    }

    return score
}

function getAllMoves(game, color) {

    const all = []

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {

            if (colorOf(game.board[r][c]) !== color)
                continue

            const legal = legalMoves(
                game.board,
                r,
                c,
                game.enPassant,
                game.castling
            )

            for (const mv of legal) {

                all.push({
                    from: [r,c],
                    to: [mv[0], mv[1]],
                    flag: mv[2] || null
                })

            }
        }
    }

    return all
}

function minimax(
    game,
    depth,
    alpha,
    beta,
    maximizing
) {

    if (depth === 0) {
        return evaluateBoard(game.board)
    }

    const color = maximizing ? 'b' : 'w'

    const moves = getAllMoves(game, color)

    if (!moves.length) {

        const isCheck = inCheck(
            game.board,
            color
        )

        if (isCheck) {
            return maximizing
                ? -999999
                : 999999
        }

        return 0
    }

    if (maximizing) {

        let maxEval = -Infinity

        for (const move of moves) {

            const cloneGame = {
                ...game,
                board: clone(game.board),
                castling: { ...game.castling },
                enPassant: game.enPassant
                    ? [...game.enPassant]
                    : null
            }

            const result = doMove(
                cloneGame.board,
                move.from[0],
                move.from[1],
                move.to[0],
                move.to[1],
                move.flag,
                cloneGame.enPassant,
                cloneGame.castling
            )

            cloneGame.board = result.nb
            cloneGame.enPassant = result.nep
            cloneGame.castling = result.nc2

            const evalScore = minimax(
                cloneGame,
                depth - 1,
                alpha,
                beta,
                false
            )

            maxEval = Math.max(maxEval, evalScore)

            alpha = Math.max(alpha, evalScore)

            if (beta <= alpha)
                break
        }

        return maxEval

    } else {

        let minEval = Infinity

        for (const move of moves) {

            const cloneGame = {
                ...game,
                board: clone(game.board),
                castling: { ...game.castling },
                enPassant: game.enPassant
                    ? [...game.enPassant]
                    : null
            }

            const result = doMove(
                cloneGame.board,
                move.from[0],
                move.from[1],
                move.to[0],
                move.to[1],
                move.flag,
                cloneGame.enPassant,
                cloneGame.castling
            )

            cloneGame.board = result.nb
            cloneGame.enPassant = result.nep
            cloneGame.castling = result.nc2

            const evalScore = minimax(
                cloneGame,
                depth - 1,
                alpha,
                beta,
                true
            )

            minEval = Math.min(minEval, evalScore)

            beta = Math.min(beta, evalScore)

            if (beta <= alpha)
                break
        }

        return minEval
    }
}

function getBotMove(game) {
    const botColor = game.botColor || 'b'
    const moves = getAllMoves(game, botColor)

    if (!moves.length) return null

    let bestMove = null
    let bestScore = botColor === 'b' ? -Infinity : Infinity

    for (const move of moves) {
        const cloneGame = {
            ...game,
            board: clone(game.board),
            castling: { ...game.castling },
            enPassant: game.enPassant ? [...game.enPassant] : null
        }

        const result = doMove(
            cloneGame.board,
            move.from[0], move.from[1],
            move.to[0], move.to[1],
            move.flag,
            cloneGame.enPassant,
            cloneGame.castling
        )

        cloneGame.board = result.nb
        cloneGame.enPassant = result.nep
        cloneGame.castling = result.nc2

        // Bot hitam → maximizing, bot putih → minimizing
        const score = minimax(cloneGame, BOT_THINK_DEPTH, -Infinity, Infinity, botColor === 'w')

        if (botColor === 'b' ? score > bestScore : score < bestScore) {
            bestScore = score
            bestMove = move
        }
    }

    return bestMove
}

// ─────────────────────────────────────────────
//  RENDER PAPAN
// ─────────────────────────────────────────────

async function renderBoard(game, lastMove=null, hlSquares=[]) {
    const CELL=64, PAD=28, SIZE=8*CELL+PAD*2
    const canvas = createCanvas(SIZE, SIZE+36)
    const ctx    = canvas.getContext('2d')

    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, SIZE, SIZE+36)

    // Label
    ctx.fillStyle='#888'; ctx.font='bold 13px sans-serif'
    ctx.textAlign='center'; ctx.textBaseline='middle'
    for (let i=0;i<8;i++) {
        ctx.fillText(String.fromCharCode(97+i), PAD+i*CELL+CELL/2, 14)
        ctx.fillText((8-i).toString(), 14, PAD+i*CELL+CELL/2)
    }

    const hlSet = new Set(hlSquares.map(([r,c])=>`${r},${c}`))
    const lmSet = lastMove
        ? new Set([`${lastMove[0]},${lastMove[1]}`,`${lastMove[2]},${lastMove[3]}`])
        : new Set()

    for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
        const x=PAD+c*CELL, y=PAD+r*CELL
        const light=(r+c)%2===0
        if (hlSet.has(`${r},${c}`))       ctx.fillStyle='rgba(20,200,20,0.55)'
        else if (lmSet.has(`${r},${c}`))  ctx.fillStyle=light?'#f6f669':'#baca2b'
        else                               ctx.fillStyle=light?'#f0d9b5':'#b58863'
        ctx.fillRect(x, y, CELL, CELL)

        const piece=game.board[r][c]
        if (piece) {
            const em=UNICODE[piece]
            ctx.font=`${Math.floor(CELL*0.7)}px serif`
            ctx.textAlign='center'; ctx.textBaseline='middle'
            ctx.fillStyle='rgba(0,0,0,0.22)'
            ctx.fillText(em, x+CELL/2+2, y+CELL/2+2)
            ctx.fillStyle=colorOf(piece)==='w'?'#fff':'#111'
            ctx.fillText(em, x+CELL/2, y+CELL/2)
        }
    }

    ctx.strokeStyle='#4a4a6a'; ctx.lineWidth=2
    ctx.strokeRect(PAD, PAD, 8*CELL, 8*CELL)

    const tn = game.turn==='p1'?game.p1.split('@')[0]:game.p2.split('@')[0]
    const tl = game.turn==='p1'?'⬜ Putih':'⬛ Hitam'
    ctx.fillStyle='#ccc'; ctx.font='bold 14px sans-serif'
    ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.fillText(`${tl} (${tn}) | Move #${game.moveCount+1}`, SIZE/2, SIZE+18)

    return canvas.toBuffer('image/png')
}

// ─────────────────────────────────────────────
//  HANDLER
// ─────────────────────────────────────────────

async function handler(m, { sock, config: botConfig }) {
    const chatId   = m.chat
    const senderId = m.sender
    const prefix   = botConfig.command?.prefix || '.'
    const args     = (m.body||'').trim().split(/\s+/).slice(1)
    const sub      = args[0]?.toLowerCase()
    const botNumber = sock.user?.id?.replace(/:\d+@/, '@') || ''
    const isMentioningBot = (m.mentionedJid || []).some(jid =>
    jid.replace(/:\d+@/, '@') === botNumber
)

    // ── resign ──
    if (sub==='resign'||sub==='nyerah') {
        const game=sessions.get(chatId)
        if (!game) return m.reply('❌ *Ehh~* Tidak ada game catur yang sedang berjalan~ 🥺')
        if (game.p1!==senderId&&game.p2!==senderId) return m.reply('❌ *Ehh~* Kamu tidak sedang main di sini~ 🥺')
        const winner=game.p1===senderId?game.p2:game.p1
        if (game.lastBoardKey) try { await sock.sendMessage(chatId,{delete:game.lastBoardKey}) } catch(e){}
        sessions.delete(chatId)

        if (game.vsBot && winner === botNumber) {
            return sock.sendMessage(chatId, {
                text: `🏳️ @${senderId.split('@')[0]} menyerah dari bot!\n🤖 *BOT MENANG!* Kapan main lagi? 😏`,
                mentions: [senderId]
            }, { quoted: m })
        }

        return sock.sendMessage(chatId,{
            text:`🏳️ @${senderId.split('@')[0]} menyerah!\n🏆 @${winner.split('@')[0]} *MENANG!*`,
            mentions:[senderId,winner]
        },{quoted:m})
    }

    // ── Mulai game baru ──
    if (!sessions.has(chatId)) {
        const mentioned =
            m.mentionedJid?.[0] ||
            m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

        // Validasi: harus berupa JID WhatsApp valid (minimal 10 digit angka) — ikuti cara dam
        let opponent = null
        if (mentioned) {
            const num = mentioned.split('@')[0].replace(/:\d+$/, '')
            if (/^\d{10,}$/.test(num)) opponent = mentioned
        }

        if (!opponent || opponent === senderId) {
            return m.reply(
                `♟ *_GAME CATUR_*\n\n` +
                `📖 *Tutorial Singkat*\n` +
                `> • Setiap pemain bergantian jalan\n` +
                `> • Putih selalu mulai duluan\n` +
                `> • Tujuan game: skakmat raja lawan\n` +
                `> • Ketik posisi asal lalu tujuan\n\n` +

                `📝 *Contoh Gerakan*\n` +
                `> • \`${prefix}chess e2 e4\`\n` +
                `>   Artinya buah dari e2 ke e4\n\n` +

                `🤖 *Mode Permainan*\n` +
                `> • Lawan pemain lain\n` +
                `> • Lawan bot AI\n\n` +

                `✨ *Fitur*\n` +
                `> • Rokade aktif\n` +
                `> • En passant aktif\n` +
                `> • Promosi pion otomatis\n` +
                `> • AI minimax chess bot\n\n` +

                `🎮 *Mulai Game*\n` +
                `• Vs pemain:\n` +
                `>   \`${prefix}chess @lawan\`\n\n` +

                `• Vs bot:\n` +
                `>   \`${prefix}chess @bot\`\n\n` +

                `🏳️ *Menyerah*\n` +
                `> • \`${prefix}chess resign\``
            )
        }

        const opponentNormalized = opponent.replace(/:\d+@/, '@')
        const isVsBot = opponentNormalized === botNumber || isMentioningBot

        // Random siapa dapat putih — putih selalu jalan duluan
        const senderIsWhite = Math.random() < 0.5
        const whitePlayer = senderIsWhite ? senderId : (isVsBot ? botNumber : opponent)
        const blackPlayer = senderIsWhite ? (isVsBot ? botNumber : opponent) : senderId

        const game = isVsBot
            ? createGame(
                whitePlayer,
                blackPlayer,
                true,
                blackPlayer === botNumber ? 'b' : 'w'
            )
            : createGame(
                whitePlayer,
                blackPlayer
            )
        sessions.set(chatId, game)
        const img = await renderBoard(game)

        // Fix caption giliran pertama
        const firstPlayerLabel = game.p1 === botNumber
            ? '🤖 Bot'
            : `@${game.p1.split('@')[0]}`
        const firstColorLabel = '⬜ Putih'

        const sentMsg = await sock.sendMessage(chatId,{
            image: img,
            caption:
                `♟ *GAME CATUR DIMULAI!*\n\n`+
                `⬜ Putih: ${
                    game.p1 === botNumber
                        ? '🤖 Bot'
                        : '@' + game.p1.split('@')[0]}\n`+
                `⬛ Hitam: ${
                    game.p2 === botNumber
                        ? '🤖 Bot'
                        : '@' + game.p2.split('@')[0]}\n\n`+
                `🟡 Giliran pertama: ${firstColorLabel} ${firstPlayerLabel}\n\n`+
                `_Cara gerak: \`${prefix}chess e2 e4\`_\n`+
                `_Nyerah: \`${prefix}chess resign\`_`,
            mentions: isVsBot
                ? [senderId]
                : [game.p1, game.p2]
        },{quoted:m})
        game.lastBoardKey=sentMsg?.key||null

        // Kalau bot dapat putih (p1), langsung jalankan giliran bot
        if (isVsBot && game.p1 === botNumber) {
            await new Promise(r => setTimeout(r, 8000))

            const botMove = getBotMove(game)
            if (!botMove) {
                sessions.delete(chatId)
                return sock.sendMessage(chatId, {
                    text: `🏆 @${senderId.split('@')[0]} MENANG!\n🤖 Bot tidak bisa bergerak!`,
                    mentions: [senderId]
                }, { quoted: m })
            }

            const [bfr, bfc] = botMove.from
            const [btr, btc] = botMove.to
            const botResult = doMove(game.board, bfr, bfc, btr, btc, botMove.flag, game.enPassant, game.castling)
            game.board = botResult.nb
            game.enPassant = botResult.nep
            game.castling = botResult.nc2
            game.moveCount++
            game.turn = 'p2'  // sekarang giliran human (hitam)

            const botImg = await renderBoard(game, [bfr,bfc,btr,btc])
            if (game.lastBoardKey) try { await sock.sendMessage(chatId,{delete:game.lastBoardKey}) } catch(e){}
            const sentBot = await sock.sendMessage(chatId, {
                image: botImg,
                caption:
                    `🤖 *Bot bergerak duluan!*\n\n`+
                    `📍 ${sqName(bfr,bfc)} → ${sqName(btr,btc)}\n\n`+
                    `🟡 Giliranmu sekarang @${senderId.split('@')[0]}\n\n`+
                    `_Gerak: \`${prefix}chess [dari] [ke]\`_`,
                mentions: [senderId]
            }, { quoted: m })
            game.lastBoardKey = sentBot?.key || null
        }

        return
    }

    // ── Proses gerakan ──
    const game=sessions.get(chatId)

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
                `Ketik \`${prefix}chess resign\` untuk menyerah dulu.`
            )
        } else {
            return m.reply(
                `❌ Sudah ada game yang sedang berjalan!\n\n` +
                `⬜ @${p1Name} vs ⬛ ${game.vsBot ? p2Name : `@${p2Name}`}\n\n` +
                `Tunggu selesai atau ketik \`${prefix}chess resign\``,
                { mentions: game.vsBot ? [game.p1] : [game.p1, game.p2] }
            )
        }
    }

    const curPlayer=game.turn==='p1'?game.p1:game.p2
    const myColor=game.turn==='p1'?'w':'b'

    // Kalau vs bot dan giliran bot, jangan terima input player
    const botTurn = game.vsBot && (
        (game.p1 === botNumber && game.turn === 'p1') ||
        (game.p2 === botNumber && game.turn === 'p2')
    )
    if (botTurn) {
        return m.reply('⏳ Tunggu bot berpikir...')
    }

    if (senderId !== curPlayer) {
        return m.reply(
            `⏳ Bukan giliran kamu! Tunggu @${curPlayer.split('@')[0]} bergerak dulu.`,
            { mentions: [curPlayer] }
        )
    }

    if (!args[0]||!args[1]) return m.reply(
        `♟ Cara gerak: \`${prefix}chess [dari] [ke]\`\n`+
        `Contoh: \`${prefix}chess e2 e4\`\n`+
        `Nyerah: \`${prefix}chess resign\``
    )

    const from=parseSq(args[0]), to=parseSq(args[1])
    if (!from||!to) return m.reply(`❌ *Ehh~* Notasi tidak valid! Contoh: \`${prefix}chess e2 e4\``)

    const [fr,fc]=from, [tr,tc]=to

    if (colorOf(game.board[fr][fc])!==myColor)
        return m.reply(`❌ *Ehh~* Tidak ada buah milikmu di *${sqName(fr,fc)}*~ 🥺`)

    const legal=legalMoves(game.board,fr,fc,game.enPassant,game.castling)
    const chosen=legal.find(([r,c])=>r===tr&&c===tc)

    if (!chosen) {
        const opts=legal.map(([r,c])=>sqName(r,c)).join(', ')
        return m.reply(
            `❌ Langkah tidak valid!\n\n`+
            `Buah di *${sqName(fr,fc)}* bisa ke: ${opts||'_(tidak bisa bergerak)_'}`
        )
    }

    const flag=chosen[2]||null
    const {nb, nep, nc2}=doMove(game.board,fr,fc,tr,tc,flag,game.enPassant,game.castling)
    game.board=nb; game.enPassant=nep; game.castling=nc2; game.moveCount++

    const nextTurn=game.turn==='p1'?'p2':'p1'
    game.turn=nextTurn

    const isBotNextTurn = game.vsBot && (
        (game.p1 === botNumber && game.turn === 'p1') ||
        (game.p2 === botNumber && game.turn === 'p2')
    )

    if (isBotNextTurn) {
    
    await new Promise(r => setTimeout(r, 8000))

    const botMove = getBotMove(game)

    if (!botMove) {
        sessions.delete(chatId)

        return sock.sendMessage(chatId, {
            text:
                `🏆 @${senderId.split('@')[0]} MENANG!\n` +
                `🤖 Bot tidak bisa bergerak!`,
            mentions: [senderId]
        }, { quoted: m })
    }

    const [bfr, bfc] = botMove.from
    const [btr, btc] = botMove.to

    const botResult = doMove(
        game.board,
        bfr,
        bfc,
        btr,
        btc,
        botMove.flag,
        game.enPassant,
        game.castling
    )

    game.board = botResult.nb
    game.enPassant = botResult.nep
    game.castling = botResult.nc2
    game.moveCount++

    game.turn = game.p1 === botNumber ? 'p2' : 'p1'  // kembalikan ke giliran human
    
    const humanColor = game.p1 === botNumber ? 'b' : 'w'

    const humanCheck = inCheck(
        game.board,
        humanColor
    )

    const humanMate =
        humanCheck &&
        !anyLegal(
            game.board,
            humanColor,
            game.enPassant,
            game.castling
        )

    const humanStale =
        !humanCheck &&
        !anyLegal(
            game.board,
            humanColor,
            game.enPassant,
            game.castling
        )

    if (humanMate || humanStale) {

        const endImg = await renderBoard(
            game,
            [bfr,bfc,btr,btc]
        )

        if (game.lastBoardKey) {
            try {
                await sock.sendMessage(chatId,{
                    delete: game.lastBoardKey
                })
            } catch {}
        }

        sessions.delete(chatId)

        await sock.sendMessage(chatId,{
            image:endImg,
            caption: humanMate
                ? `♟ *SKAKMAT!*\n\n🤖 Bot menang!\n😔 @${senderId.split('@')[0]} kalah!`
                : `♟ *REMIS!*\n\n🤝 Stalemate.`,
            mentions:[senderId]
        },{quoted:m})

        return
    }

    const botImg = await renderBoard(game, [bfr,bfc,btr,btc])

    if (game.lastBoardKey) {
        try {
            await sock.sendMessage(chatId, {
                delete: game.lastBoardKey
            })
        } catch {}
    }

    const sentBot = await sock.sendMessage(chatId,{
        image: botImg,
        caption:
            `🤖 *Bot bergerak!*\n\n` +
            `📍 ${sqName(bfr,bfc)} → ${sqName(btr,btc)}\n\n` +
            `🟡 Giliranmu sekarang @${senderId.split('@')[0]}`,
        mentions:[senderId]
    },{quoted:m})

    game.lastBoardKey = sentBot?.key || null

    return
    }
    const nextPlayer=game.turn==='p1'?game.p1:game.p2
    const nextColor=game.turn==='p1'?'w':'b'
    const moveStr=`${sqName(fr,fc)} → ${sqName(tr,tc)}`

    const chk  = inCheck(game.board, nextColor)
    const mat  = chk  && !anyLegal(game.board, nextColor, game.enPassant, game.castling)
    const stal = !chk && !anyLegal(game.board, nextColor, game.enPassant, game.castling)

    const img=await renderBoard(game,[fr,fc,tr,tc])
    if (game.lastBoardKey) try { await sock.sendMessage(chatId,{delete:game.lastBoardKey}) } catch(e){}

    if (mat||stal) {
        sessions.delete(chatId)
        await sock.sendMessage(chatId,{
            image:img,
            caption: mat
                ? `♟ *SKAKMAT!* 👑\n\n📍 ${moveStr}\n\n🎉 @${curPlayer.split('@')[0]} *MENANG!*\n😔 @${nextPlayer.split('@')[0]} rajanya terkena skakmat!\n\n_Total ${game.moveCount} gerakan_`
                : `♟ *REMIS (Stalemate)*\n\n📍 ${moveStr}\n\n🤝 Tidak ada pemenang!\n_Total ${game.moveCount} gerakan_`,
            mentions:[curPlayer,nextPlayer]
        },{quoted:m})
        return
    }

    let flagStr=''
    if (flag==='ck') flagStr=' _(Rokade Pendek)_'
    if (flag==='cq') flagStr=' _(Rokade Panjang)_'
    if (flag==='ep') flagStr=' _(En Passant)_'

    let caption=
        `♟ *Gerakan ke-${game.moveCount}*\n`+
        `📍 ${moveStr}${flagStr}\n`
    if (chk) caption+=`\n⚠️ *SKAK!* Raja @${nextPlayer.split('@')[0]} dalam bahaya!\n`
    caption+=
        `\n🟡 Giliran: ${nextTurn==='p1'?'⬜':'⬛'} @${nextPlayer.split('@')[0]}\n\n`+
        `_Gerak: \`${prefix}chess [dari] [ke]\`_`

    const sentMsg=await sock.sendMessage(chatId,{
        image:img, caption, mentions:[nextPlayer]
    },{quoted:m})
    game.lastBoardKey=sentMsg?.key||null
}

module.exports = { config: pluginConfig, handler }