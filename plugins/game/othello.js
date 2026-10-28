const { createCanvas } = require('@napi-rs/canvas')

const pluginConfig = {
    name: 'othello',
    alias: ['reversi', 'balikbidak'],
    category: 'game',
    description: 'Game Othello! Kuasai papan dengan membalik bidak lawan.',
    usage: '.othello [@lawan]',
    example: '.othello @user',
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

const SIZE   = 8
const DIRS   = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
const COLS   = ['A','B','C','D','E','F','G','H']
const EMPTY  = 0
const BLACK  = 1
const WHITE  = 2

const sessions = new Map()

// ─────────────────────────────────────────────
//  LOGIKA PAPAN
// ─────────────────────────────────────────────

function createBoard() {
    const aiPapan = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY))
    aiPapan[3][3] = WHITE; aiPapan[4][4] = WHITE
    aiPapan[3][4] = BLACK; aiPapan[4][3] = BLACK
    return aiPapan
}

function inBounds(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE
}

function getFlips(board, r, c, color) {
    if (board[r][c] !== EMPTY) return []
    const lawan = color === BLACK ? WHITE : BLACK
    const balik = []
    for (const [dr, dc] of DIRS) {
        const baris = []
        let nr = r + dr, nc = c + dc
        while (inBounds(nr, nc) && board[nr][nc] === lawan) {
            baris.push([nr, nc])
            nr += dr; nc += dc
        }
        if (baris.length > 0 && inBounds(nr, nc) && board[nr][nc] === color) {
            balik.push(...baris)
        }
    }
    return balik
}

function getValidMoves(board, color) {
    const langkah = []
    for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++)
            if (getFlips(board, r, c, color).length > 0)
                langkah.push([r, c])
    return langkah
}

function applyMove(board, r, c, color) {
    const balik = getFlips(board, r, c, color)
    board[r][c] = color
    for (const [fr, fc] of balik) board[fr][fc] = color
    return balik
}

function countPieces(board) {
    let hitam = 0, putih = 0
    for (const baris of board) for (const sel of baris) {
        if (sel === BLACK) hitam++
        else if (sel === WHITE) putih++
    }
    return { black: hitam, white: putih }
}

function parseCoord(str) {
    if (!str || str.length < 2) return null
    const col = COLS.indexOf(str[0].toUpperCase())
    const row = parseInt(str[1]) - 1
    if (col === -1 || isNaN(row) || row < 0 || row >= SIZE) return null
    return [row, col]
}

function coordName(r, c) { return COLS[c] + (r + 1) }

function cloneBoard(board) { return board.map(r => [...r]) }

function createGame(p1, p2, vsBot = false, p1Name = '', p2Name = '') {
    return {
        p1, p2, vsBot,
        p1Name: p1Name || p1.split('@')[0],
        p2Name: p2Name || p2.split('@')[0],
        board: createBoard(),
        turn: BLACK,
        moveCount: 0,
        skipCount: 0,
        lastBoardKey: null,
        status: 'playing'
    }
}

// ─────────────────────────────────────────────
//  BOT AI — MINIMAX + ALPHA-BETA
// ─────────────────────────────────────────────

const posisiBobot = [
    [120,-20, 20,  5,  5, 20,-20,120],
    [-20,-40, -5, -5, -5, -5,-40,-20],
    [ 20, -5, 15,  3,  3, 15, -5, 20],
    [  5, -5,  3,  3,  3,  3, -5,  5],
    [  5, -5,  3,  3,  3,  3, -5,  5],
    [ 20, -5, 15,  3,  3, 15, -5, 20],
    [-20,-40, -5, -5, -5, -5,-40,-20],
    [120,-20, 20,  5,  5, 20,-20,120],
]

function evaluate(board, botColor) {
    const lawan = botColor === BLACK ? WHITE : BLACK
    let nilai = 0
    for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++) {
            if (board[r][c] === botColor) nilai += posisiBobot[r][c]
            else if (board[r][c] === lawan) nilai -= posisiBobot[r][c]
        }
    const gerakBot  = getValidMoves(board, botColor).length
    const gerakLawn = getValidMoves(board, lawan).length
    nilai += (gerakBot - gerakLawn) * 10
    const pojok = [[0,0],[0,7],[7,0],[7,7]]
    for (const [r,c] of pojok) {
        if (board[r][c] === botColor) nilai += 50
        else if (board[r][c] === lawan) nilai -= 50
    }
    return nilai
}

function minimax(board, depth, alpha, beta, isMax, botColor) {
    const giliran = isMax ? botColor : (botColor === BLACK ? WHITE : BLACK)
    const langkah = getValidMoves(board, giliran)
    if (depth === 0 || langkah.length === 0) {
        return { score: evaluate(board, botColor) }
    }
    let terbaik = { score: isMax ? -Infinity : Infinity, move: null }
    for (const [r, c] of langkah) {
        const salinan = cloneBoard(board)
        applyMove(salinan, r, c, giliran)
        const hasil = minimax(salinan, depth - 1, alpha, beta, !isMax, botColor)
        if (isMax ? hasil.score > terbaik.score : hasil.score < terbaik.score) {
            terbaik = { score: hasil.score, move: [r, c] }
        }
        if (isMax) alpha = Math.max(alpha, terbaik.score)
        else       beta  = Math.min(beta, terbaik.score)
        if (beta <= alpha) break
    }
    return terbaik
}

function getBotMove(board, botColor) {
    const { black, white } = countPieces(board)
    const total = black + white
    const kedalaman = total < 48 ? 5 : 7
    const hasil = minimax(board, kedalaman, -Infinity, Infinity, true, botColor)
    return hasil.move
}

function komentarAi(flips, isWinning) {
    if (isWinning) return pick([
        '🌟 Papan ini sudah milikku dari awal~ Makasih ya udah main sama aku!',
        '💫 Setiap langkahku penuh cinta... dan strategi. Kamu terjebak deh~',
        '✨ Aku selalu tahu jawabannya! Itulah Hoshino Ai~',
    ])
    if (flips >= 4) return pick([
        `💥 ${flips} bidakmu sekarang bersinar dengan warnaku~ Hehe!`,
        '🌸 Satu langkah penuh cinta, banyak yang ikut! Keren kan?',
        '⚡ Ini bukan kebetulan~ Semua sudah kurencanakan dengan sepenuh hati!',
    ])
    return pick([
        '🎵 Pikirkan baik-baik ya~ Aku tunggu dengan senyuman!',
        '💕 Pojok itu milikku~ Tapi jangan menyerah dulu dong!',
        '🌟 Aku adalah idola terhebat, tapi kamu juga punya potensi lho~',
        '🎤 Cinta itu bohong... tapi langkahku tidak! Hehe~',
    ])
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// ─────────────────────────────────────────────
//  RENDER CANVAS  (tanpa emoji — plain text)
// ─────────────────────────────────────────────

const CELL   = 50
const BORDER = 4
const LABEL  = 24
const PAD    = 16
const INFO_H = 64
const HEADER = 56

const BOARD_PX = SIZE * CELL + (SIZE + 1) * BORDER
const CANVAS_W = PAD + LABEL + BOARD_PX + PAD
const CANVAS_H = HEADER + PAD + BOARD_PX + PAD + INFO_H

async function renderBoard(game, validMoves = [], winMsg = '') {
    const kanvas = createCanvas(CANVAS_W, CANVAS_H)
    const ctx    = kanvas.getContext('2d')

    // ── Latar belakang ──
    ctx.fillStyle = '#1a0a2e'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    // ── Header — gradient idol pink-ungu ──
    const gradHeader = ctx.createLinearGradient(0, 0, CANVAS_W, 0)
    gradHeader.addColorStop(0,   '#1a0a2e')
    gradHeader.addColorStop(0.5, '#3d1060')
    gradHeader.addColorStop(1,   '#1a0a2e')
    ctx.fillStyle = gradHeader
    ctx.fillRect(0, 0, CANVAS_W, HEADER)

    // Judul plain (tanpa emoji)
    ctx.fillStyle = '#f7c6e0'
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('* HOSHINO AI — OTHELLO *', CANVAS_W / 2, HEADER / 2)

    // ── Papan ──
    const ox = PAD + LABEL
    const oy = HEADER + PAD

    // Label kolom A-H
    ctx.font = 'bold 13px sans-serif'
    ctx.fillStyle = '#d4a0cc'
    ctx.textBaseline = 'middle'
    for (let c = 0; c < SIZE; c++) {
        const cx = ox + BORDER + c * (CELL + BORDER) + CELL / 2
        ctx.textAlign = 'center'
        ctx.fillText(COLS[c], cx, oy - 10)
    }

    // Label baris 1-8
    for (let r = 0; r < SIZE; r++) {
        const cy = oy + BORDER + r * (CELL + BORDER) + CELL / 2
        ctx.textAlign = 'center'
        ctx.fillText((r + 1).toString(), PAD + LABEL / 2, cy)
    }

    // Background papan — ungu gelap
    ctx.fillStyle = '#2d1050'
    ctx.fillRect(ox, oy, BOARD_PX, BOARD_PX)

    const validSet = new Set(validMoves.map(([r,c]) => `${r},${c}`))

    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const cx = ox + BORDER + c * (CELL + BORDER)
            const cy = oy + BORDER + r * (CELL + BORDER)

            // Sel papan
            ctx.fillStyle = '#3a1468'
            ctx.fillRect(cx, cy, CELL, CELL)

            const cx2 = cx + CELL / 2
            const cy2 = cy + CELL / 2
            const sel = game.board[r][c]

            if (sel === BLACK) {
                // Bidak hitam — gelap mengkilap
                const gradBidak = ctx.createRadialGradient(cx2 - 6, cy2 - 6, 2, cx2, cy2, CELL / 2 - 4)
                gradBidak.addColorStop(0, '#4a4a5a')
                gradBidak.addColorStop(1, '#0d0d1a')
                ctx.beginPath()
                ctx.arc(cx2, cy2, CELL / 2 - 4, 0, Math.PI * 2)
                ctx.fillStyle = gradBidak
                ctx.fill()
                ctx.strokeStyle = '#6a6a8a'
                ctx.lineWidth = 1.5
                ctx.stroke()
            } else if (sel === WHITE) {
                // Bidak putih — pink idol
                const gradBidak = ctx.createRadialGradient(cx2 - 6, cy2 - 6, 2, cx2, cy2, CELL / 2 - 4)
                gradBidak.addColorStop(0, '#ffd6f0')
                gradBidak.addColorStop(1, '#d060a0')
                ctx.beginPath()
                ctx.arc(cx2, cy2, CELL / 2 - 4, 0, Math.PI * 2)
                ctx.fillStyle = gradBidak
                ctx.fill()
                ctx.strokeStyle = '#ff9fd4'
                ctx.lineWidth = 1.5
                ctx.stroke()
            } else if (validSet.has(`${r},${c}`)) {
                // Langkah valid — titik pink lembut
                ctx.beginPath()
                ctx.arc(cx2, cy2, 8, 0, Math.PI * 2)
                ctx.fillStyle = 'rgba(255, 150, 210, 0.55)'
                ctx.fill()
            }

            // Grid line
            ctx.strokeStyle = '#1e0840'
            ctx.lineWidth = 0.5
            ctx.strokeRect(cx, cy, CELL, CELL)
        }
    }

    // Titik referensi klasik
    const titikReferensi = [[2,2],[2,5],[5,2],[5,5]]
    for (const [r,c] of titikReferensi) {
        const cx2 = ox + BORDER + c * (CELL + BORDER) + CELL / 2
        const cy2 = oy + BORDER + r * (CELL + BORDER) + CELL / 2
        ctx.beginPath()
        ctx.arc(cx2, cy2, 3, 0, Math.PI * 2)
        ctx.fillStyle = '#1e0840'
        ctx.fill()
    }

    // ── Info bawah ──
    const { black, white } = countPieces(game.board)
    const infoY = oy + BOARD_PX + 8

    ctx.fillStyle = 'rgba(255,200,240,0.06)'
    ctx.fillRect(PAD, infoY, CANVAS_W - PAD * 2, INFO_H - 6)

    if (winMsg) {
        ctx.fillStyle = '#f7c6e0'
        ctx.font = 'bold 15px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(winMsg, CANVAS_W / 2, infoY + INFO_H / 2 - 6)
    } else {
        ctx.font = 'bold 14px sans-serif'
        ctx.textBaseline = 'middle'

        // Hitam — label "[H]" singkatan Hitam
        const namaP1 = game.p1Name
        ctx.fillStyle = game.turn === BLACK ? '#f7c6e0' : '#8a7a90'
        ctx.textAlign = 'left'
        ctx.fillText(`[H] ${namaP1} : ${black}`, PAD + 8, infoY + 18)

        // Putih — label "[P]" singkatan Pink/Putih
        const namaP2 = game.vsBot ? '[AI]' : game.p2Name
        ctx.fillStyle = game.turn === WHITE ? '#f7c6e0' : '#8a7a90'
        ctx.textAlign = 'right'
        ctx.fillText(`${white} : ${namaP2} [P]`, CANVAS_W - PAD - 8, infoY + 18)

        // Giliran
        const labelGiliran = game.turn === BLACK
            ? `Giliran: [H] ${namaP1}`
            : (game.vsBot ? 'Giliran: [AI] Hoshino Ai' : `Giliran: [P] ${namaP2}`)
        ctx.fillStyle = '#c09ab8'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(labelGiliran, CANVAS_W / 2, infoY + INFO_H - 16)
    }

    return kanvas.toBuffer('image/png')
}

// ─────────────────────────────────────────────
//  BOT PLAY
// ─────────────────────────────────────────────

async function playBotTurn(game, chatId, sock, prefix, quotedMsg = null) {
    const warnaBot = WHITE
    const gerak = getBotMove(game.board, warnaBot)

    if (!gerak) {
        game.turn = BLACK
        const langkahValid = getValidMoves(game.board, BLACK)
        if (langkahValid.length === 0) {
            await finishGame(game, chatId, sock, quotedMsg)
            return
        }
        const img = await renderBoard(game, langkahValid)
        if (game.lastBoardKey) try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        const sentMsg = await sock.sendMessage(chatId, {
            image: img,
            caption:
                `╭┈┈⬡ ᴏᴛʜᴇʟʟᴏ — ʜᴏsʜɪɴᴏ ᴀɪ\n` +
                `┆\n` +
                `┆ 🎭 Hm~ aku tidak punya langkah kali ini!\n` +
                `┆ Giliran kamu lagi ya~ 🌸\n` +
                `┆\n` +
                `┆ 🟡 Giliran: @${game.p1.split('@')[0]}\n` +
                `┆\n` +
                `┆ _Langkah: \`${prefix}othello [koordinat]\`_\n` +
                `╰┈┈⬡`,
            mentions: [game.p1]
        }, { quoted: quotedMsg })
        game.lastBoardKey = sentMsg?.key || null
        return
    }

    const [r, c] = gerak
    const balik = applyMove(game.board, r, c, warnaBot)
    game.moveCount++
    game.skipCount = 0

    const { black, white } = countPieces(game.board)
    const aiUnggul = white > black

    const langkahHitam = getValidMoves(game.board, BLACK)
    const langkahPutih = getValidMoves(game.board, WHITE)

    if (langkahHitam.length === 0 && langkahPutih.length === 0) {
        const img = await renderBoard(game, [], '')
        if (game.lastBoardKey) try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        sessions.delete(chatId)
        const { black: bAkhir, white: wAkhir } = countPieces(game.board)
        const pemenang = bAkhir > wAkhir ? 'black' : (wAkhir > bAkhir ? 'white' : 'draw')
        const komentar = komentarAi(balik.length, true)
        await sock.sendMessage(chatId, {
            image: img,
            caption:
                `╭┈┈⬡ ᴏᴛʜᴇʟʟᴏ — ʜᴏsʜɪɴᴏ ᴀɪ\n` +
                `┆\n` +
                `┆ 🤖 Aku jalan ke *${coordName(r,c)}*!\n` +
                `┆ (membalik ${balik.length} bidak)\n` +
                `┆\n` +
                `┆ _${komentar}_\n` +
                `┆\n` +
                (pemenang === 'white'
                    ? `┆ 🏆 Hoshino Ai *MENANG*! 🌟\n` +
                      `┆ Makasih sudah main sama aku~\n` +
                      `┆ @${game.p1.split('@')[0]} kerja keras lho!\n` +
                      `┆ Bidak: ${bAkhir} vs ${wAkhir}`
                    : pemenang === 'draw'
                    ? `┆ 🤝 *SERI*! Kita sama kuat~\n` +
                      `┆ Bidak: ${bAkhir} vs ${wAkhir}`
                    : `┆ 🏆 @${game.p1.split('@')[0]} *MENANG*! 🌟\n` +
                      `┆ Sugoi!! Kamu mengalahkan aku~\n` +
                      `┆ Bidak: ${bAkhir} vs ${wAkhir}`) +
                `\n╰┈┈⬡`,
            mentions: [game.p1]
        }, { quoted: quotedMsg })
        return
    }

    game.turn = BLACK
    const komentar = komentarAi(balik.length, aiUnggul)

    if (langkahHitam.length === 0) {
        game.turn = WHITE
        const img = await renderBoard(game, [])
        if (game.lastBoardKey) try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        const sentMsg = await sock.sendMessage(chatId, {
            image: img,
            caption:
                `╭┈┈⬡ ᴏᴛʜᴇʟʟᴏ — ʜᴏsʜɪɴᴏ ᴀɪ\n` +
                `┆\n` +
                `┆ 🤖 Aku jalan ke *${coordName(r,c)}*!\n` +
                `┆ (membalik ${balik.length} bidak)\n` +
                `┆\n` +
                `┆ _${komentar}_\n` +
                `┆\n` +
                `┆ ⏭️ @${game.p1.split('@')[0]} tidak punya langkah~\n` +
                `┆ Aku lanjut berpikir ya! 🌸\n` +
                `╰┈┈⬡`,
            mentions: [game.p1]
        }, { quoted: quotedMsg })
        game.lastBoardKey = sentMsg?.key || null
        await new Promise(r => setTimeout(r, 10000))
        await playBotTurn(game, chatId, sock, prefix, quotedMsg)
        return
    }

    const img = await renderBoard(game, langkahHitam)
    if (game.lastBoardKey) try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
    const sentMsg = await sock.sendMessage(chatId, {
        image: img,
        caption:
            `╭┈┈⬡ ᴏᴛʜᴇʟʟᴏ — ʜᴏsʜɪɴᴏ ᴀɪ\n` +
            `┆\n` +
            `┆ 🤖 Aku jalan ke *${coordName(r,c)}*!\n` +
            `┆ (membalik ${balik.length} bidak)\n` +
            `┆\n` +
            `┆ _${komentar}_\n` +
            `┆\n` +
            `┆ ⚫ ${black} — ${white} 🌸\n` +
            `┆\n` +
            `┆ 🟡 Giliran: @${game.p1.split('@')[0]} ✨\n` +
            `┆\n` +
            `┆ _Langkah: \`${prefix}othello [koordinat]\`_\n` +
            `╰┈┈⬡`,
        mentions: [game.p1]
    }, { quoted: quotedMsg })
    game.lastBoardKey = sentMsg?.key || null
}

async function finishGame(game, chatId, sock, quotedMsg) {
    const { black, white } = countPieces(game.board)
    const img = await renderBoard(game, [], '')
    if (game.lastBoardKey) try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
    sessions.delete(chatId)

    const namaP1  = game.p1.split('@')[0]
    const labelP2 = game.vsBot ? 'Hoshino Ai' : `@${game.p2.split('@')[0]}`

    let caption =
        `╭┈┈⬡ ᴏᴛʜᴇʟʟᴏ — ʜᴏsʜɪɴᴏ ᴀɪ\n` +
        `┆\n` +
        `┆ 🏁 *GAME SELESAI!* 🌟\n` +
        `┆\n` +
        `┆ ⚫ @${namaP1}: ${black}\n` +
        `┆ 🌸 ${labelP2}: ${white}\n` +
        `┆\n`

    if (black > white) {
        caption +=
            `┆ 🏆 @${namaP1} *MENANG*! ✨\n` +
            (game.vsBot
                ? `┆ Sugoi!! Kamu mengalahkan Hoshino Ai~ 🎉\n`
                : `┆ ${labelP2} kerja keras lho! 💪\n`)
    } else if (white > black) {
        caption += game.vsBot
            ? `┆ 🏆 Hoshino Ai *MENANG*! 🌟\n` +
              `┆ Makasih sudah main sama aku~ @${namaP1}! 💕\n`
            : `┆ 🏆 ${labelP2} *MENANG*! ✨\n` +
              `┆ @${namaP1} kerja keras lho! 💪\n`
    } else {
        caption += `┆ 🤝 *SERI*! Kita sama kuat~ 💫\n`
    }

    caption +=
        `┆\n` +
        `┆ 📊 Total ${game.moveCount} gerakan\n` +
        `╰┈┈⬡`

    const mentions = game.vsBot ? [game.p1] : [game.p1, game.p2]
    await sock.sendMessage(chatId, { image: img, caption, mentions }, { quoted: quotedMsg })
}

// ─────────────────────────────────────────────
//  HANDLER UTAMA
// ─────────────────────────────────────────────

async function handler(m, { sock, config: botConfig }) {
    const chatId    = m.chat
    const senderId  = m.sender
    const prefix    = botConfig.command?.prefix || '.'
    const args      = (m.body || '').trim().split(/\s+/).slice(1)
    const sub       = args[0]?.toLowerCase()
    const botNumber = sock.user?.id?.split(':')[0] + '@s.whatsapp.net'

    // ── Resign ──
    if (sub === 'resign' || sub === 'nyerah') {
        const game = sessions.get(chatId)
        if (!game) return m.reply('❌ *Ehh~* Tidak ada game Othello yang sedang berjalan~ 🥺')
        if (game.p1 !== senderId && game.p2 !== senderId)
            return m.reply('❌ *Ehh~* Kamu tidak sedang main di sini~ 🥺')
        const pemenang = game.p1 === senderId ? game.p2 : game.p1
        const namaPemenang = game.vsBot && pemenang === botNumber
            ? 'Hoshino Ai'
            : `@${pemenang.split('@')[0]}`
        if (game.lastBoardKey) try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        sessions.delete(chatId)
        return sock.sendMessage(chatId, {
            text:
                `╭┈┈⬡ ᴏᴛʜᴇʟʟᴏ — ʜᴏsʜɪɴᴏ ᴀɪ\n` +
                `┆\n` +
                `┆ 🏳️ @${senderId.split('@')[0]} menyerah~\n` +
                `┆ Makasih sudah main ya! 💕\n` +
                `┆\n` +
                `┆ 🏆 ${namaPemenang} *MENANG*!\n` +
                `╰┈┈⬡`,
            mentions: game.vsBot ? [senderId] : [senderId, pemenang]
        }, { quoted: m })
    }

    // ── Belum ada game → mulai atau tampilkan panduan ──
    if (!sessions.has(chatId)) {
        const disebutkan =
            m.mentionedJid?.[0] ||
            m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

        let lawan = null
        if (disebutkan) {
            const num = disebutkan.split('@')[0].replace(/:\d+$/, '')
            if (/^\d{10,}$/.test(num)) lawan = disebutkan
        }

        if (!lawan || lawan === senderId) {
            return m.reply(
                `╭┈┈⬡ ᴏᴛʜᴇʟʟᴏ — ʜᴏsʜɪɴᴏ ᴀɪ\n` +
                `┆\n` +
                `┆ 👋 Hai hai~! Aku Hoshino Ai, idola terhebat!\n` +
                `┆ Yuk main Othello sama aku~ 🌟\n` +
                `┆\n` +
                `┆ ᴄᴀʀᴀ ᴍᴀɪɴ\n` +
                `┆ > Papan 8x8, mulai 4 bidak di tengah\n` +
                `┆ > ⚫ Hitam selalu jalan pertama\n` +
                `┆ > Taruh bidak agar menjepit bidak lawan\n` +
                `┆ > Bidak terjepit berubah jadi warnamu\n` +
                `┆ > Penjepitan bisa 8 arah\n` +
                `┆\n` +
                `┆ ʟᴀɴɢᴋᴀʜ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ\n` +
                `┆ > Harus menjepit min. 1 bidak lawan\n` +
                `┆ > Tidak ada langkah = giliran dilewati\n` +
                `┆\n` +
                `┆ ᴍᴇɴᴀɴɢ\n` +
                `┆ > Papan penuh atau keduanya tidak bisa jalan\n` +
                `┆ > Paling banyak bidak = menang!\n` +
                `┆\n` +
                `┆ 🌸 Titik pink = langkah valid ya~\n` +
                `┆\n` +
                `┆ ᴍᴜʟᴀɪ ɢᴀᴍᴇ\n` +
                `┆ > Vs pemain: \`${prefix}othello @lawan\`\n` +
                `┆ > Vs aku: \`${prefix}othello @bot\` 🤖\n` +
                `┆\n` +
                `┆ ᴄᴀʀᴀ ᴊᴀʟᴀɴ\n` +
                `┆ > \`${prefix}othello D3\`\n` +
                `┆\n` +
                `┆ 🏳️ Menyerah: \`${prefix}othello resign\`\n` +
                `╰┈┈⬡`
            )
        }

        const numDisebutkan = lawan.split('@')[0]
        const numBot = botNumber.split('@')[0]
        const vsBot = numDisebutkan === numBot ||
            (m.mentionedJid || []).some(j => j.replace(/:\d+@/, '@') === botNumber)

        const namaPengirim = m.pushName || senderId.split('@')[0]
        const namaLawan    = vsBot ? 'Hoshino Ai' : (m.mentionedPushName || lawan.split('@')[0])
        const game = createGame(senderId, vsBot ? botNumber : lawan, vsBot, namaPengirim, namaLawan)
        sessions.set(chatId, game)

        const langkahValid = getValidMoves(game.board, BLACK)
        const img = await renderBoard(game, langkahValid)

        if (vsBot) {
            const sentMsg = await sock.sendMessage(chatId, {
                image: img,
                caption:
                    `╭┈┈⬡ ᴏᴛʜᴇʟʟᴏ — ʜᴏsʜɪɴᴏ ᴀɪ\n` +
                    `┆\n` +
                    `┆ 🎉 Kyaa~ aku excited main sama kamu! 🌟\n` +
                    `┆\n` +
                    `┆ ⚫ Kamu: @${senderId.split('@')[0]}\n` +
                    `┆ 🌸 Lawan: Hoshino Ai (Mode Pro~)\n` +
                    `┆\n` +
                    `┆ _"Aku sudah menghafal seluruh papan ini~\n` +
                    `┆   Tapi aku janji main sepenuh hati ya!"_\n` +
                    `┆\n` +
                    `┆ ⚫ Hitam jalan duluan!\n` +
                    `┆ 🌸 Titik pink = langkah valid~\n` +
                    `┆\n` +
                    `┆ _Cara jalan: \`${prefix}othello [koordinat]\`_\n` +
                    `┆ _Contoh: \`${prefix}othello D3\`_\n` +
                    `┆ _🏳️ Menyerah: \`${prefix}othello resign\`_\n` +
                    `╰┈┈⬡`,
                mentions: [senderId]
            }, { quoted: m })
            game.lastBoardKey = sentMsg?.key || null
        } else {
            const sentMsg = await sock.sendMessage(chatId, {
                image: img,
                caption:
                    `╭┈┈⬡ ᴏᴛʜᴇʟʟᴏ — ʜᴏsʜɪɴᴏ ᴀɪ\n` +
                    `┆\n` +
                    `┆ 🎤 Hoshino Ai hadir sebagai wasit~ 🌟\n` +
                    `┆\n` +
                    `┆ ⚫ Player 1: @${senderId.split('@')[0]}\n` +
                    `┆ 🌸 Player 2: @${lawan.split('@')[0]}\n` +
                    `┆\n` +
                    `┆ ⚫ Hitam (@${senderId.split('@')[0]}) jalan duluan!\n` +
                    `┆ 🌸 Titik pink = langkah valid~\n` +
                    `┆\n` +
                    `┆ _Cara jalan: \`${prefix}othello [koordinat]\`_\n` +
                    `┆ _Contoh: \`${prefix}othello D3\`_\n` +
                    `┆ _🏳️ Menyerah: \`${prefix}othello resign\`_\n` +
                    `╰┈┈⬡`,
                mentions: [senderId, lawan]
            }, { quoted: m })
            game.lastBoardKey = sentMsg?.key || null
        }
        return
    }

    // ── Ada game aktif ──
    const game = sessions.get(chatId)

    const adaMention = (m.mentionedJid?.length > 0) ||
        (m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0)
    if (adaMention && sub !== 'resign' && sub !== 'nyerah') {
        const pemain = game.p1 === senderId || game.p2 === senderId
        const namaP1 = game.p1.split('@')[0]
        const namaP2 = game.vsBot ? 'Hoshino Ai' : game.p2.split('@')[0]
        if (pemain) {
            return m.reply(
                `❌ Kamu masih dalam game yang sedang berjalan~\n` +
                `Ketik \`${prefix}othello resign\` untuk menyerah dulu ya!`
            )
        } else {
            return sock.sendMessage(chatId, {
                text:
                    `❌ Sudah ada game yang berjalan nih~\n\n` +
                    `[H] @${namaP1} vs [P] ${game.vsBot ? namaP2 : `@${namaP2}`}\n\n` +
                    `Tunggu selesai dulu ya!`,
                mentions: game.vsBot ? [game.p1] : [game.p1, game.p2]
            }, { quoted: m })
        }
    }

    if (game.vsBot && game.turn === WHITE) {
        return m.reply(
            `╭┈┈⬡ ᴏᴛʜᴇʟʟᴏ — ʜᴏsʜɪɴᴏ ᴀɪ\n` +
            `┆\n` +
            `┆ 🤔 Sabar ya~ aku sedang berpikir! 🌸\n` +
            `╰┈┈⬡`
        )
    }

    const pemainSekarang = game.turn === BLACK ? game.p1 : game.p2
    if (senderId !== pemainSekarang) {
        return m.reply(
            `╭┈┈⬡ ᴏᴛʜᴇʟʟᴏ — ʜᴏsʜɪɴᴏ ᴀɪ\n` +
            `┆\n` +
            `┆ ⏳ Bukan giliran kamu~\n` +
            `┆ Tunggu @${pemainSekarang.split('@')[0]} jalan dulu ya!\n` +
            `╰┈┈⬡`,
            { mentions: [pemainSekarang] }
        )
    }

    const coordStr = args[0]?.toUpperCase()
    if (!coordStr || coordStr === 'RESIGN') {
        return m.reply(
            `╭┈┈⬡ ᴏᴛʜᴇʟʟᴏ — ʜᴏsʜɪɴᴏ ᴀɪ\n` +
            `┆\n` +
            `┆ 📝 Masukkan koordinat ya~\n` +
            `┆ Contoh: \`${prefix}othello D3\`\n` +
            `╰┈┈⬡`
        )
    }

    const coord = parseCoord(coordStr)
    if (!coord) return m.reply('❌ Koordinat tidak valid~ Gunakan A1–H8 ya!')

    const [r, c] = coord
    const warnaKu = game.turn
    const balik = getFlips(game.board, r, c, warnaKu)

    if (balik.length === 0) {
        return m.reply(
            `╭┈┈⬡ ᴏᴛʜᴇʟʟᴏ — ʜᴏsʜɪɴᴏ ᴀɪ\n` +
            `┆\n` +
            `┆ ❌ Aduh~ langkah ${coordStr} tidak valid!\n` +
            `┆ Tidak ada bidak lawan yang bisa dibalik di sana.\n` +
            `╰┈┈⬡`
        )
    }

    applyMove(game.board, r, c, warnaKu)
    game.moveCount++
    game.skipCount = 0

    const warnaLawan = warnaKu === BLACK ? WHITE : BLACK
    const langkahLawan = getValidMoves(game.board, warnaLawan)
    const langkahKu    = getValidMoves(game.board, warnaKu)
    const { black, white } = countPieces(game.board)

    if (langkahLawan.length === 0 && langkahKu.length === 0) {
        await finishGame(game, chatId, sock, m)
        return
    }

    let kosong = 0
    for (const baris of game.board) for (const sel of baris) if (sel === EMPTY) kosong++
    if (kosong === 0) {
        await finishGame(game, chatId, sock, m)
        return
    }

    if (langkahLawan.length === 0) {
        game.turn = warnaKu
        const img = await renderBoard(game, langkahKu)
        if (game.lastBoardKey) try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        const labelLawan = game.vsBot ? 'Hoshino Ai' : `@${(warnaKu === BLACK ? game.p2 : game.p1).split('@')[0]}`
        const sentMsg = await sock.sendMessage(chatId, {
            image: img,
            caption:
                `╭┈┈⬡ ᴏᴛʜᴇʟʟᴏ — ʜᴏsʜɪɴᴏ ᴀɪ\n` +
                `┆\n` +
                `┆ ✨ *${coordName(r,c)}* — membalik ${balik.length} bidak! 🌸\n` +
                `┆\n` +
                `┆ ⚫ ${black} — ${white} 🌸\n` +
                `┆\n` +
                `┆ ⏭️ ${labelLawan} tidak punya langkah~\n` +
                `┆ Giliran dilewati! Kamu jalan lagi ya 🎯\n` +
                `┆\n` +
                `┆ _Langkah: \`${prefix}othello [koordinat]\`_\n` +
                `╰┈┈⬡`,
            mentions: [senderId]
        }, { quoted: m })
        game.lastBoardKey = sentMsg?.key || null
        return
    }

    game.turn = warnaLawan

    if (game.vsBot && game.turn === WHITE) {
        const img = await renderBoard(game, [])
        if (game.lastBoardKey) try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
        const sentMsg = await sock.sendMessage(chatId, {
            image: img,
            caption:
                `╭┈┈⬡ ᴏᴛʜᴇʟʟᴏ — ʜᴏsʜɪɴᴏ ᴀɪ\n` +
                `┆\n` +
                `┆ ✨ *${coordName(r,c)}* — membalik ${balik.length} bidak! 🌸\n` +
                `┆\n` +
                `┆ ⚫ ${black} — ${white} 🌸\n` +
                `┆\n` +
                `┆ 🤔 Aku sedang berpikir~ Tunggu ya! 💫\n` +
                `╰┈┈⬡`,
            mentions: [senderId]
        }, { quoted: m })
        game.lastBoardKey = sentMsg?.key || null
        await new Promise(resolve => setTimeout(resolve, 10000))
        await playBotTurn(game, chatId, sock, prefix, m)
        return
    }

    const pemainBerikut = game.turn === BLACK ? game.p1 : game.p2
    const img = await renderBoard(game, langkahLawan)
    if (game.lastBoardKey) try { await sock.sendMessage(chatId, { delete: game.lastBoardKey }) } catch(e) {}
    const sentMsg = await sock.sendMessage(chatId, {
        image: img,
        caption:
            `╭┈┈⬡ ᴏᴛʜᴇʟʟᴏ — ʜᴏsʜɪɴᴏ ᴀɪ\n` +
            `┆\n` +
            `┆ ✨ *${coordName(r,c)}* — membalik ${balik.length} bidak! 🌸\n` +
            `┆\n` +
            `┆ ⚫ ${black} — ${white} 🌸\n` +
            `┆\n` +
            `┆ 🟡 Giliran: @${pemainBerikut.split('@')[0]}\n` +
            `┆\n` +
            `┆ _Langkah: \`${prefix}othello [koordinat]\`_\n` +
            `╰┈┈⬡`,
        mentions: [pemainBerikut]
    }, { quoted: m })
    game.lastBoardKey = sentMsg?.key || null
}

module.exports = { config: pluginConfig, handler }