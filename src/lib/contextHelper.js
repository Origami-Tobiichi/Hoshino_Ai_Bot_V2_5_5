const fs = require('fs')
const path = require('path')
const { join } = require('path')
const config = require('../../config')
const sharp = require('sharp')
const hsAsset = require('./assets')

let gameThumbBuffer = null
let rpgThumbBuffer = null
let winnerThumbBuffer = null

// thumbnail diambil dari URL di config.assets.images (download di background saat modul dimuat)
hsAsset.tryBuffer('images/hsnai-games').then(b => { if (b) gameThumbBuffer = b }).catch(() => {})
hsAsset.tryBuffer('images/hsnai-rpg').then(b => { if (b) rpgThumbBuffer = b }).catch(() => {})
hsAsset.tryBuffer('images/hsnai-winner').then(b => { if (b) winnerThumbBuffer = b }).catch(() => {})

const FAST_ANSWER_PRAISES = [
    '⚡ Kilat banget! Kamu jenius!',
    '🚀 Super cepat! Otak encer!',
    '🔥 Wuih monster! Jawab secepat kilat!',
    '💫 Luar biasa! Kamu the flash!',
    '🎯 Precision tinggi! Langsung tepat!',
    '⭐ Bintang! Refleks dewa!',
    '🏆 Legend! Kecepatan maximal!',
    '💎 Premium player! Gak ada lawan!',
    '🦅 Tajam seperti elang!',
    '🧠 Big brain! IQ tinggi detected!'
]

const FAST_ANSWER_THRESHOLD = 4000
const FAST_ANSWER_BONUS = {
    exp: 50,
    balance: 500,
    limit: 1
}

function getRandomPraise() {
    return FAST_ANSWER_PRAISES[Math.floor(Math.random() * FAST_ANSWER_PRAISES.length)]
}

function getGameContextInfo(title = '🎮 OURIN GAMES', body = 'Have fun playing!') {
    const saluranId = config.saluran?.id || '120363409928671192@newsletter'
    const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'
    
    const contextInfo = {
        forwardingScore: 9999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: saluranId,
            newsletterName: saluranName,
            serverMessageId: 127
        }
    }
    
    return contextInfo
}

function getWinnerContextInfo(title = '🏆 WINNER!', body = 'Selamat kamu menang!') {
    const saluranId = config.saluran?.id || '120363409928671192@newsletter'
    const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'
    
    const contextInfo = {
        forwardingScore: 9999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: saluranId,
            newsletterName: saluranName,
            serverMessageId: 127
        }
    }
    
    return contextInfo
}

function getRpgContextInfo(title = '⚔️ OURIN RPG', body = 'Adventure awaits!') {
    const saluranId = config.saluran?.id || '120363409928671192@newsletter'
    const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'
    
    const contextInfo = {
        forwardingScore: 9999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: saluranId,
            newsletterName: saluranName,
            serverMessageId: 127
        }
    }
    
    return contextInfo
}

function checkFastAnswer(session) {
    if (!session?.startTime) return { isFast: false }
    
    const elapsed = Date.now() - session.startTime
    
    if (elapsed <= FAST_ANSWER_THRESHOLD) {
        return {
            isFast: true,
            elapsed: elapsed,
            praise: getRandomPraise(),
            bonus: FAST_ANSWER_BONUS
        }
    }
    
    return { isFast: false, elapsed: elapsed }
}

function createFakeQuoted(botName = 'Ourin-AI', verified = true) {
    return {
        key: {
            fromMe: false,
            participant: '0@s.whatsapp.net',
            remoteJid: 'status@broadcast'
        },
        message: {
            contactMessage: {
                displayName: verified ? `✅ ${botName}` : botName,
                vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:${verified ? 'Verified Bot' : 'Bot'}\nEND:VCARD`
            }
        }
    }
}

// V2: Mirip v6 di serialize — document + jpegThumbnail + contactMessage quoted
// Pakai gameThumbBuffer (gambar sama dengan v1)
async function getGameContextInfoV2(sock, chat, text, options = {}) {
    const botName = config.bot?.name || 'Ourin-AI'

    const quotedMsg = {
        key: {
            participant: `0@s.whatsapp.net`,
            remoteJid: `status@broadcast`
        },
        message: {
            contactMessage: {
                displayName: `🪸 ${botName}`,
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:XL;ttname,;;;\nFN:ttname\nitem1.TEL;waid=13135550002:+1 (313) 555-0002\nitem1.X-ABLabel:Ponsel\nEND:VCARD`,
                sendEphemeral: true
            }
        }
    }

    let jpegThumbnail = null
    try {
        if (gameThumbBuffer) {
            jpegThumbnail = await sharp(gameThumbBuffer).resize(300, 300).toBuffer()
        }
    } catch (e) {}

    const contextInfo = {
        mentionedJid: options.mentions || [],
        isForwarded: true,
        forwardingScore: 999,
        ...options.contextInfo
    }

    return sock.sendMessage(chat, {
        document: fs.readFileSync(join(process.cwd(), 'package.json')),
        mimetype: 'image/png',
        fileName: botName,
        fileLength: 99999999999999,
        jpegThumbnail,
        caption: text,
        contextInfo,
        ...options
    }, {
        quoted: quotedMsg
    })
}

// V3: Link Preview style — tampil seperti preview link WA asli, thumbnail kecil
async function getGameContextInfoV3(sock, chat, text, options = {}) {
    const botName = config.bot?.name || 'Ourin-AI'
    const botDev = config.bot?.developer || 'WhatsApp Bot'
    const saluranLink = config.info?.website || config.saluran?.link || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'

    let thumbBuf = null
    try {
        if (gameThumbBuffer) {
            thumbBuf = await sharp(gameThumbBuffer).resize(100, 100).jpeg({ quality: 60 }).toBuffer()
        }
    } catch (e) {
        thumbBuf = gameThumbBuffer
    }

    const contextInfo = {
        mentionedJid: options.mentions || [],
        ...options.contextInfo
    }

    const invisible = '\u200B'.repeat(400)
    const msgText = `${saluranLink}${invisible}\n\n${text}`

    return sock.sendMessage(chat, {
        text: msgText,
        mentions: options.mentions || [],
        linkPreview: {
            'matched-text': saluranLink,
            title: botName,
            description: botDev,
            previewType: 0,
            jpegThumbnail: thumbBuf,
            renderLargerThumbnail: false,
            linkPreviewMetadata: {
                linkMediaDuration: 0,
                socialMediaPostType: 4
            }
        },
        contextInfo
    }, {
        quoted: options.quoted
    })
}


module.exports = {
    getGameContextInfo,
    getGameContextInfoV2,
    getGameContextInfoV3,
    getWinnerContextInfo,
    getRpgContextInfo,
    createFakeQuoted,
    checkFastAnswer,
    getRandomPraise,
    gameThumbBuffer,
    rpgThumbBuffer,
    winnerThumbBuffer,
    FAST_ANSWER_THRESHOLD,
    FAST_ANSWER_BONUS,
    FAST_ANSWER_PRAISES
}
