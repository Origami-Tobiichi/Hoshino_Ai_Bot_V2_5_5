const hsAsset = require('./assets')
function levenshteinDistance(str1, str2) {
    const m = str1.length
    const n = str2.length
    
    if (m === 0) return n
    if (n === 0) return m
    
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))
    
    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j
    
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            )
        }
    }
    
    return dp[m][n]
}

function damerauLevenshteinDistance(str1, str2) {
    const m = str1.length
    const n = str2.length
    
    if (m === 0) return n
    if (n === 0) return m
    
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))
    
    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j
    
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            )
            
            if (i > 1 && j > 1 && str1[i - 1] === str2[j - 2] && str1[i - 2] === str2[j - 1]) {
                dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost)
            }
        }
    }
    
    return dp[m][n]
}

function jaroWinklerSimilarity(str1, str2) {
    if (str1 === str2) return 1.0
    
    const len1 = str1.length
    const len2 = str2.length
    
    if (len1 === 0 || len2 === 0) return 0.0
    
    const matchWindow = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0)
    
    const matches1 = new Array(len1).fill(false)
    const matches2 = new Array(len2).fill(false)
    
    let matches = 0
    let transpositions = 0
    
    for (let i = 0; i < len1; i++) {
        const start = Math.max(0, i - matchWindow)
        const end = Math.min(i + matchWindow + 1, len2)
        
        for (let j = start; j < end; j++) {
            if (matches2[j] || str1[i] !== str2[j]) continue
            matches1[i] = true
            matches2[j] = true
            matches++
            break
        }
    }
    
    if (matches === 0) return 0.0
    
    let k = 0
    for (let i = 0; i < len1; i++) {
        if (!matches1[i]) continue
        while (!matches2[k]) k++
        if (str1[i] !== str2[k]) transpositions++
        k++
    }
    
    const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3
    
    let prefix = 0
    for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
        if (str1[i] === str2[i]) prefix++
        else break
    }
    
    return jaro + prefix * 0.1 * (1 - jaro)
}

function nGramSimilarity(str1, str2, n = 2) {
    if (!str1 || !str2) return 0
    if (str1 === str2) return 1
    
    const getNGrams = (str, n) => {
        const grams = new Set()
        const padded = ' '.repeat(n - 1) + str + ' '.repeat(n - 1)
        for (let i = 0; i < padded.length - n + 1; i++) {
            grams.add(padded.substring(i, i + n))
        }
        return grams
    }
    
    const grams1 = getNGrams(str1, n)
    const grams2 = getNGrams(str2, n)
    
    let intersection = 0
    for (const gram of grams1) {
        if (grams2.has(gram)) intersection++
    }
    
    const union = grams1.size + grams2.size - intersection
    return union === 0 ? 0 : intersection / union
}

function tokenSortRatio(str1, str2) {
    const sorted1 = str1.toLowerCase().split(/\s+/).sort().join(' ')
    const sorted2 = str2.toLowerCase().split(/\s+/).sort().join(' ')
    return getSimilarity(sorted1, sorted2)
}

function getSimilarity(str1, str2) {
    const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase())
    const maxLen = Math.max(str1.length, str2.length)
    if (maxLen === 0) return 1
    return 1 - distance / maxLen
}

function getAdvancedSimilarity(str1, str2) {
    const s1 = str1.toLowerCase()
    const s2 = str2.toLowerCase()
    
    const levenshtein = getSimilarity(s1, s2)
    const jaroWinkler = jaroWinklerSimilarity(s1, s2)
    const ngram2 = nGramSimilarity(s1, s2, 2)
    const ngram3 = nGramSimilarity(s1, s2, 3)
    
    const combined = (levenshtein * 0.3) + (jaroWinkler * 0.35) + (ngram2 * 0.2) + (ngram3 * 0.15)
    
    return Math.min(1, combined)
}

function getMatchType(inputLower, cmdLower) {
    if (cmdLower === inputLower) return { type: 'exact', score: 1.0, emoji: '✅', label: 'Sama persis' }
    const isShortCmd = cmdLower.length < 3
    const isLongInput = inputLower.length > 3
    if (cmdLower.startsWith(inputLower)) return { type: 'prefix', score: 0.95, emoji: '🎯', label: 'Awalan cocok' }
    if (inputLower.startsWith(cmdLower)) {
        if (isShortCmd && isLongInput) return null 
        return { type: 'contains', score: 0.9, emoji: '📌', label: 'Command lebih pendek' }
    }
    if (cmdLower.includes(inputLower)) return { type: 'substring', score: 0.85, emoji: '🔗', label: 'Bagian dari command' }
    if (inputLower.includes(cmdLower)) {
        if (isShortCmd && isLongInput) return null
        return { type: 'reverse-substring', score: 0.8, emoji: '📎', label: 'Command ada di input' }
    }
    return null
}

function findSimilarCommands(input, commands, options = {}) {
    const {
        maxResults = 5,
        minSimilarity = 0.2,
        maxDistance = 6,
        useAdvanced = true
    } = options
    
    const inputLower = (input && typeof input === 'string') ? input.toLowerCase() : ''
    const results = []
    
    for (const cmd of commands) {
        if (!cmd || typeof cmd !== 'string') continue
        const cmdLower = cmd.toLowerCase()
        
        const directMatch = getMatchType(inputLower, cmdLower)
        if (directMatch) {
            results.push({
                command: cmd,
                similarity: directMatch.score,
                distance: Math.abs(cmd.length - input.length),
                type: directMatch.type,
                emoji: directMatch.emoji,
                reason: directMatch.label
            })
            continue
        }
        
        const distance = damerauLevenshteinDistance(inputLower, cmdLower)
        const similarity = useAdvanced ? getAdvancedSimilarity(inputLower, cmdLower) : getSimilarity(inputLower, cmdLower)
        
        let bonus = 0
        if (cmdLower[0] === inputLower[0]) bonus += 0.12
        if (cmdLower.slice(0, 2) === inputLower.slice(0, 2)) bonus += 0.08
        if (cmdLower.slice(0, 3) === inputLower.slice(0, 3)) bonus += 0.05
        
        if (cmdLower.includes(inputLower.slice(0, Math.ceil(inputLower.length / 2)))) {
            bonus += 0.1
        }
        
        const consonants1 = cmdLower.replace(/[aeiou]/g, '')
        const consonants2 = inputLower.replace(/[aeiou]/g, '')
        if (consonants1 === consonants2) bonus += 0.15
        
        const finalSimilarity = Math.min(1, similarity + bonus)
        
        if (distance <= maxDistance || finalSimilarity >= minSimilarity) {
            let reason = 'Mirip'
            let emoji = '🔍'
            
            if (distance === 1) {
                const transposed = inputLower.length === cmdLower.length && 
                    levenshteinDistance(inputLower, cmdLower) === 2 &&
                    damerauLevenshteinDistance(inputLower, cmdLower) === 1
                if (transposed) {
                    reason = 'Huruf tertukar'
                    emoji = '🔄'
                } else {
                    reason = 'Salah ketik 1 huruf'
                    emoji = '✏️'
                }
            } else if (distance === 2) {
                reason = 'Salah ketik 2 huruf'
                emoji = '📝'
            } else if (finalSimilarity >= 0.85) {
                reason = 'Sangat mirip'
                emoji = '⭐'
            } else if (finalSimilarity >= 0.7) {
                reason = 'Cukup mirip'
                emoji = '💫'
            } else if (finalSimilarity >= 0.5) {
                reason = 'Agak mirip'
                emoji = '🌟'
            } else if (finalSimilarity >= 0.3) {
                reason = 'Sedikit mirip'
                emoji = '✨'
            }
            
            results.push({
                command: cmd,
                similarity: finalSimilarity,
                distance,
                type: 'similar',
                emoji,
                reason
            })
        }
    }
    
    results.sort((a, b) => {
        if (Math.abs(b.similarity - a.similarity) > 0.05) return b.similarity - a.similarity
        if (b.type !== a.type) {
            const typePriority = { exact: 0, prefix: 1, contains: 2, substring: 3, 'reverse-substring': 4, similar: 5 }
            return typePriority[a.type] - typePriority[b.type]
        }
        return a.distance - b.distance
    })
    
    return results.slice(0, maxResults)
}

function createProgressBar(percent, length = 10) {
    const filled = Math.round(percent / (100 / length))
    const empty = length - filled
    
    const gradientFill = ['█', '▓', '▒']
    const fillChar = percent >= 75 ? gradientFill[0] : percent >= 50 ? gradientFill[1] : gradientFill[2]
    
    return fillChar.repeat(filled) + '░'.repeat(empty)
}

// ─────────────────────────────────────────
//  formatSuggestionMessage — MULTI VARIANT
// ─────────────────────────────────────────

/**
 * Format pesan similarity dengan berbagai tampilan.
 *
 * @param {string}   inputCommand  - Command yang diketik user
 * @param {Array}    suggestions   - Hasil findSimilarCommands
 * @param {string}   prefix        - Prefix bot (misal '.')
 * @param {Object}   m             - Serialized message object
 * @param {Object}   [opts]        - Opsi tambahan
 * @param {Object}   [opts.sock]   - Socket Baileys (dibutuhkan V2, V4, V5)
 * @param {Object}   [opts.botConfig] - Config bot (dibutuhkan V2, V4, V5)
 * @param {Object}   [opts.db]     - Database instance (dibutuhkan baca variant)
 * @returns {Object|null}          - { message, interactiveButtons } atau null
 */
async function formatSuggestionMessage(inputCommand, suggestions, prefix = '.', m, opts = {}) {
    if (suggestions.length === 0) return null

    const { sock, botConfig, db } = opts

    // Baca variant dari db atau config, default V1
    let simVariant = 1
    if (db && typeof db.setting === 'function') {
        simVariant = db.setting('simVariant') || 1
    }

    const topMatch    = suggestions[0]
    const topPercent  = Math.round(topMatch.similarity * 100)
    const botName     = (botConfig?.bot) ? botConfig.bot.name  : (typeof config !== 'undefined' && config.bot ? config.bot.name : 'Hoshino Ai')
    const botVersion  = (botConfig?.bot) ? botConfig.bot.version : (typeof config !== 'undefined' && config.bot ? config.bot.version : '2.2.5')

    const getConfidenceLevel = (percent) => {
        if (percent >= 85) return { text: 'Sangat Tinggi', emoji: '🟢' }
        if (percent >= 70) return { text: 'Tinggi',        emoji: '🟡' }
        if (percent >= 50) return { text: 'Sedang',        emoji: '🟠' }
        return                     { text: 'Rendah',        emoji: '🔴' }
    }
    const confidence = getConfidenceLevel(topPercent)

    // ─── V1: Pesan Biasa ────────────────────────────────────────────────────
    if (simVariant === 1) {
        if (!sock) return null

        let msg = `🌟 *ＩＤＯＬ  ＭＥＳＳＡＧＥ* 🌟\n\n`
        msg += `Kon-Ai! Kak *${m.pushName}*~ ✨\n`
        msg += `Tadi Ai dengar kamu panggil \`${prefix}${inputCommand}\` ya? 🎤\n\n`
        msg += `Sayangnya di panggung *${botName}* v${botVersion}, naskah itu nggak ada. Tapi insting idol Ai mendeteksi sesuatu...\n\n`
        msg += `╭┈┈┈⬡「 🎯 *ɪɴsᴛɪɴɢ ɪᴅᴏʟ* 」\n`
        msg += `┆ 💎 *Saran:* \`${prefix}${topMatch.command}\`\n`
        msg += `┆ ${confidence.emoji} *Akurasi:* ${topPercent}% (${confidence.text})\n`
        msg += `╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈⬡\n\n`
        msg += `_Apa mungkin kakaknya lagi nggak fokus terus typo?_ 😉✨`

        await sock.sendMessage(m.chat, { text: msg }, { quoted: m })

        return { sent: true }
    }

    // ─── V2: Document Premium (seperti menu v6) ─────────────────────────────
    if (simVariant === 2) {
        if (!sock || !botConfig) return null

        const fs   = require('fs')
        const path = require('path')
        const sharp = require('sharp')



        let thumbBuffer  = hsAsset.has('images/hsnai3') ? (await hsAsset.buffer('images/hsnai3'))
                         : hsAsset.has('images/hsnai2')  ? (await hsAsset.buffer('images/hsnai2')) : null

        let bannerThumb = null
        if (thumbBuffer) {
            try {
                bannerThumb = await sharp(thumbBuffer)
                    .resize(200, 200, { fit: 'inside' })
                    .jpeg({ quality: 90 })
                    .toBuffer()
            } catch (_) {
                bannerThumb = thumbBuffer
            }
        }

        const saluranId   = botConfig.saluran?.id   || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
        const saluranName = botConfig.saluran?.name || botName
        const saluranLink = botConfig.saluran?.link || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'


        const imgBuffer = hsAsset.has('images/hsnai') ? (await hsAsset.buffer('images/hsnai')) : null

        const contextInfoV2 = {
            mentionedJid: [m.sender],
            forwardingScore: 9999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: saluranId,
                newsletterName: saluranName,
                serverMessageId: 127
            }
        }

        let caption = `❌ *COMMAND TIDAK DITEMUKAN*\n\n`
        caption += `Kak *${m.pushName}*, command \`${prefix}${inputCommand}\` tidak ada.\n\n`
        caption += `╭┈┈⬡「 💡 *Maksud kamu?* 」\n`
        caption += `┆ 🎯 *Saran:* \`${prefix}${topMatch.command}\`\n`
        caption += `┆ ${confidence.emoji} *Akurasi:* ${topPercent}% (${confidence.text})\n`
        if (suggestions.length > 1) {
            caption += `┆\n`
            suggestions.slice(1, 4).forEach((s, i) => {
                const pct = Math.round(s.similarity * 100)
                const medal = i === 0 ? '🥈' : i === 1 ? '🥉' : `  ${i + 2}.`
                caption += `┆ ${medal} \`${prefix}${s.command}\` — ${pct}%\n`
            })
        }
        caption += `╰┈┈┈┈┈┈┈┈┈┈⬡\n\n`
        caption += `_Ketik \`${prefix}menu\` untuk daftar lengkap_`

        const getVerifiedQuoted = () => ({
            key: { participant: `0@s.whatsapp.net`, remoteJid: `status@broadcast` },
            message: {
                contactMessage: {
                    displayName: `🪸 ${botName}`,
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nN:XL;ttname,;;;\nFN:ttname\nitem1.TEL;waid=13135550002:+1 (313) 555-0002\nitem1.X-ABLabel:Ponsel\nEND:VCARD`,
                    sendEphemeral: true
                }
            }
        })

        try {
            await sock.sendMessage(m.chat, {
                document: imgBuffer || Buffer.from(''),
                mimetype: 'application/pdf',
                fileName: `ɴᴏ ᴘᴀɪɴ ɴᴏ ɢᴀɪɴ`,
                fileLength: 9999999999,
                caption,
                jpegThumbnail: bannerThumb,
                contextInfo: contextInfoV2
            }, { quoted: getVerifiedQuoted() })
        } catch (e) {
            console.error('[Similarity V2] Error:', e.message)
            await sock.sendMessage(m.chat, {
                text: caption,
                contextInfo: contextInfoV2
            }, { quoted: getVerifiedQuoted() })
        }

        return { sent: true }
    }

// ─── V3: sendBusinessCard + fake orderMessage quoted (ikuti replyVariant 10) ──
if (simVariant === 3) {
    if (!sock || !botConfig) return null

    const fs   = require('fs')
    const path = require('path')
    const sharp = require('sharp')

    const saluranId   = botConfig.saluran?.id   || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    const saluranName = botConfig.saluran?.name || botName


let thumbBuf = null
if (hsAsset.has('images/hsnai2')) {
    try {
        thumbBuf = await sharp((await hsAsset.buffer('images/hsnai2')))
            .resize(300, 300)
            .toBuffer()
    } catch (_) {}
}

    const fakeQuotedV3 = {
        key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast' },
        message: {
            orderMessage: {
                orderId: '1337',
                thumbnail: thumbBuf,
                itemCount: Math.round(topMatch.similarity * 100),
                status: 'INQUIRY',
                surface: 'CATALOG',
                message: topMatch.command,
                orderTitle: 'BOT WhatsApp Multi-Device',
                sellerJid: botConfig.bot?.number
                    ? `${botConfig.bot.number}@s.whatsapp.net`
                    : m.sender,
                token: 'hsnai-menu-v8',
                totalAmount1000: 0,
                totalCurrencyCode: 'IDR',
                contextInfo: {
                    isForwarded: true,
                    forwardingScore: 9999,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: saluranId,
                        newsletterName: saluranName,
                        serverMessageId: 127
                    }
                }
            }
        }
    }

    let bodyText = `❌ *Command Tidak Ditemukan*\n\n`
    bodyText += `Kak *${m.pushName}*, command \`${prefix}${inputCommand}\` tidak ada.\n\n`
    bodyText += `╭┈┈⬡「 🔍 *Saran Command* 」\n`
    suggestions.slice(0, 3).forEach((s, i) => {
        const pct   = Math.round(s.similarity * 100)
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
        bodyText += `┆ ${medal} \`${prefix}${s.command}\` — ${pct}%\n`
    })
    bodyText += `╰┈┈┈┈┈┈┈┈┈┈⬡\n\n`
    bodyText += `_Ketik \`${prefix}menu\` untuk daftar lengkap_`

    await sock.sendBusinessCard(m.chat, {
        title: m.pushName || 'User',
        body: bodyText,
        footer: botConfig.info?.website || botConfig.saluran?.link || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06',
        quoted: fakeQuotedV3
    })

    return { sent: true }
}

    // ─── V4: Document Reply (seperti serialize reply v6) ────────────────────
    if (simVariant === 4) {
        if (!sock || !botConfig) return null

        const fs    = require('fs')
        const path  = require('path')
        const sharp = require('sharp')

        const pkgPath  = path.join(process.cwd(), 'package.json')

        const thumbBuf = hsAsset.has('images/hsnai2') ? (await hsAsset.buffer('images/hsnai2')) : null

        let jpegThumb = null
        if (thumbBuf) {
            try { jpegThumb = await sharp(thumbBuf).resize(300, 300).toBuffer() }
            catch (_) { jpegThumb = thumbBuf }
        }

        const saluranId   = botConfig.saluran?.id   || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
        const saluranName = botConfig.saluran?.name || botName

        // contactMessage quoted (V6 serialize style)
        const userNumber = m.sender?.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '') || '0'
        const quotedMsg  = {
            key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast' },
            message: {
                contactMessage: {
                    displayName: botConfig.bot?.name || 'Bot',
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;${m.pushName || 'User'};;;\nFN:${m.pushName || 'User'}\nTEL;type=CELL;type=VOICE;waid=${userNumber}:${userNumber}\nEND:VCARD`
                }
            }
        }

        let caption = `❌ *Command Tidak Ditemukan*\n\n`
        caption += `\`${prefix}${inputCommand}\` tidak ada dalam daftar.\n\n`
        caption += `╭┈┈⬡「 💡 *Maksud kamu?* 」\n`
        caption += `┆ 🎯 \`${prefix}${topMatch.command}\` — *${topPercent}%*\n`
        caption += `┆ ${confidence.emoji} ${confidence.text}\n`
        if (suggestions.length > 1) {
            caption += `┆\n`
            suggestions.slice(1, 3).forEach((s, i) => {
                caption += `┆ ${i === 0 ? '🥈' : '🥉'} \`${prefix}${s.command}\` — ${Math.round(s.similarity * 100)}%\n`
            })
        }
        caption += `╰┈┈┈┈┈┈┈┈┈┈⬡`

        const contextInfoV4 = {
            mentionedJid: [m.sender],
            isForwarded: true,
            forwardingScore: 999,
            forwardedNewsletterMessageInfo: {
                newsletterName: saluranName,
                newsletterJid: saluranId
            }
        }

        try {
            await sock.sendMessage(m.chat, {
                document: fs.existsSync(pkgPath) ? fs.readFileSync(pkgPath) : Buffer.from(''),
                mimetype: 'image/png',
                fileName: botName,
                fileLength: 99999999999999,
                jpegThumbnail: jpegThumb,
                caption,
                contextInfo: contextInfoV4
            }, { quoted: quotedMsg })
        } catch (e) {
            console.error('[Similarity V4] Error:', e.message)
            await sock.sendMessage(m.chat, {
                text: caption,
                contextInfo: contextInfoV4
            }, { quoted: quotedMsg })
        }

        return { sent: true }
    }

    // ─── V5: Interactive Location (seperti menu v14) ─────────────────────────
    if (simVariant === 5) {
        if (!sock || !botConfig) return null

        const fs    = require('fs')
        const path  = require('path')
        const sharp = require('sharp')

        let { generateWAMessageFromContent, proto } = require('hsnai')

        const saluranId   = botConfig.saluran?.id   || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
        const saluranName = botConfig.saluran?.name || botName

        const thumb14 = await hsAsset.tryFile('images/hsnai-v11')
        const thumbFall = await hsAsset.tryFile('images/hsnai2')
        let docuThumb   = null
        const usePath   = hsAsset.has('images/hsnai-v11') ? thumb14 : (hsAsset.has('images/hsnai2') ? thumbFall : null)
        if (usePath) {
            try {
                const rawBuf = fs.readFileSync(usePath)
                const meta   = await sharp(rawBuf).metadata()
                const w      = meta.width  || 300
                const h      = meta.height || 300
                const targetW = 300
                const targetH = Math.round((h / w) * targetW)
                docuThumb = await sharp(rawBuf).resize(targetW, targetH).jpeg({ quality: 85 }).toBuffer()
            } catch (_) {}
        }


        const imgBuf  = hsAsset.has('images/hsnai') ? (await hsAsset.buffer('images/hsnai')) : null

        // Buttons: quick_reply per saran (maks 3) + cta ke owner
        const ownerNumber = (Array.isArray(botConfig.owner?.number) ? botConfig.owner.number[0] : botConfig.owner?.number) || ''
        const zanton = [
            { name: 'single_select',          buttonParamsJson: JSON.stringify({ has_multiple_buttons: true }) },
            { name: 'call_permission_request', buttonParamsJson: JSON.stringify({ has_multiple_buttons: true }) },
        ]
        suggestions.slice(0, 3).forEach((s, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
            zanton.push({
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: `${medal} Coba: ${prefix}${s.command}`,
                    id: `${prefix}${s.command}`
                })
            })
        })
        if (ownerNumber) {
            const wa = `https://wa.me/${ownerNumber.replace(/[^0-9]/g, '')}`
            zanton.push({
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                    display_text: '🛠️ Lapor Owner',
                    url: wa,
                    merchant_url: wa
                })
            })
        }

        const bodyText = `Hai *@${m.sender.split('@')[0]}*, command \`${prefix}${inputCommand}\` tidak ditemukan.`

        const footerText =
            `❌ *Command Tidak Ditemukan* — \`${prefix}${inputCommand}\`\n\n` +
            `╭─ 🔍 *Saran Terbaik*\n` +
            suggestions.slice(0, 3).map((s, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
                return `│ ${medal} \`${prefix}${s.command}\` — ${Math.round(s.similarity * 100)}% (${s.reason})`
            }).join('\n') + '\n' +
            `╰─────\n\n` +
            `Pilih salah satu tombol di bawah untuk mencoba, atau lapor owner jika ingin fitur ini ditambahkan.`

        try {
            const msg = generateWAMessageFromContent(m.chat, {
                viewOnceMessage: {
                    message: {
                        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                        interactiveMessage: proto.Message.InteractiveMessage.create({
                            contextInfo: {
                                mentionedJid: [m.sender],
                                forwardingScore: 19,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: saluranId,
                                    newsletterName: `- ${saluranName}`,
                                    serverMessageId: -1
                                }
                            },
                            header: proto.Message.InteractiveMessage.Header.create({
                                title: null,
                                locationMessage: {
                                    degreesLatitude: 0,
                                    degreesLongitude: 0,
                                    name: `꫶ᥫ᭡꫶ ${m.pushName || 'User'}`,
                                    url: `https://ss.ss`,
                                    address: `Command \`${prefix}${inputCommand}\` tidak ditemukan`,
                                    jpegThumbnail: docuThumb
                                },
                                subtitle: '',
                                hasMediaAttachment: false
                            }),
                            body: proto.Message.InteractiveMessage.Body.create({ text: bodyText }),
                            footer: proto.Message.InteractiveMessage.Footer.create({ text: footerText }),
                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                                buttons: zanton,
                                messageParamsJson: JSON.stringify({
                                    bottom_sheet: {
                                        in_thread_buttons_limit: 1,
                                        divider_indices: [1],
                                        list_title: 'Maksud kamu?',
                                        button_title: '🔍 Pilih Saran'
                                    }
                                })
                            })
                        })
                    }
                }
            }, { quoted: m, userJid: sock.user?.id })

            await sock.relayMessage(msg.key.remoteJid, msg.message, { messageId: msg.key.id, quoted: m })
        } catch (e) {
            console.error('[Similarity V5] Error:', e.message)

            // fallback text
            let fallback = `❌ *Command Tidak Ditemukan*\n\n`
            fallback += `\`${prefix}${inputCommand}\` tidak ada.\n\n`
            fallback += `💡 *Saran:*\n`
            suggestions.slice(0, 3).forEach((s, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
                fallback += `${medal} \`${prefix}${s.command}\` — ${Math.round(s.similarity * 100)}%\n`
            })

            await sock.sendMessage(m.chat, { text: fallback }, { quoted: m })
        }

        return { sent: true }
    }

// ─── V6: Interactive (ikuti menu.js case 4) ──────────────────────────────────
if (simVariant === 6) {
    if (!sock || !botConfig) return null

    const fs   = require('fs')
    const path = require('path')
    const sharp = require('sharp')
    const { prepareWAMessageMedia, generateWAMessageFromContent, proto } = require('hsnai')

    const saluranId   = botConfig.saluran?.id   || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    const saluranName = botConfig.saluran?.name || botName


    let mediaV6 = null
    if (hsAsset.has('video/hsnai')) {
        try {
            mediaV6 = await prepareWAMessageMedia(
                { video: (await hsAsset.buffer('video/hsnai')), gifPlayback: true },
                { upload: sock.waUploadToServer }
            )
        } catch (e) {
            console.error('[Similarity V6] Media upload error:', e.message)
        }
    }



    const rawBuf    = hsAsset.has('images/hsnai2') ? (await hsAsset.buffer('images/hsnai2'))
                    : hsAsset.has('images/hsnai')   ? (await hsAsset.buffer('images/hsnai')) : null
    let locThumb = null
    if (rawBuf) {
        try { locThumb = await sharp(rawBuf).resize(300, 300).toBuffer() }
        catch (_) { locThumb = rawBuf }
    }

    // Quoted: locationMessage persis seperti menu.js case 4
    const qLocV6 = {
        key: { fromMe: false, participant: m.sender, remoteJid: m.chat },
        message: {
            locationMessage: {
                degreesLatitude: 0,
                degreesLongitude: 0,
                name: `❌ Command Tidak Ditemukan`,
                jpegThumbnail: locThumb
            }
        }
    }

    const bodyText = `Hai *@${m.sender.split('@')[0]}*, command \`${prefix}${inputCommand}\` tidak ditemukan.`

    const footerText =
        `❌ *Command Tidak Ditemukan* — \`${prefix}${inputCommand}\`\n\n` +
        `╭─ 🔍 *Saran Terbaik*\n` +
        suggestions.slice(0, 3).map((s, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
            return `│ ${medal} \`${prefix}${s.command}\` — ${Math.round(s.similarity * 100)}% (${s.reason})`
        }).join('\n') + '\n' +
        `╰─────\n\n` +
        `Pilih salah satu tombol di bawah untuk mencoba.`

    try {
        const msgV6 = generateWAMessageFromContent(m.chat, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: {},
                    interactiveMessage: {
                        header: {
                            title: '',
                            subtitle: '',
                            hasMediaAttachment: !!mediaV6,
                            ...(mediaV6?.videoMessage ? { videoMessage: mediaV6.videoMessage } : {})
                        },
                        body: { text: bodyText },
                        footer: { text: footerText },
                        contextInfo: {
                            mentionedJid: [m.sender],
                            isForwarded: true,
                            forwardingScore: 9,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: saluranId,
                                newsletterName: saluranName,
                                serverMessageId: 127
                            }
                        },
                        nativeFlowMessage: {
                            messageParamsJson: JSON.stringify({
                                limited_time_offer: {
                                    text: `Command Not Found`,
                                    url: 'Hai',
                                    expiration_time: Date.now() + 10000
                                },
                                bottom_sheet: {
                                    in_thread_buttons_limit: 2,
                                    divider_indices: [1, 2, 3, 4, 5, 999],
                                    list_title: 'Maksud kamu?',
                                    button_title: '🔍 Pilih Saran'
                                },
                                tap_target_configuration: {
                                    title: ' X ',
                                    description: 'bomboclard',
                                    canonical_url: 'https://hoshino-ai.my.id',
                                    domain: 'hoshino-ai.my.id',
                                    button_index: 0
                                }
                            }),
                            buttons: [
                                {
                                    name: 'cta_url',
                                    buttonParamsJson: JSON.stringify({
                                        display_text: `✨ Ikuti Saluran ${botConfig.saluran?.name || 'Hoshino Ai'}~`,
                                        url: botConfig.saluran?.link || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06',
                                        merchant_url: botConfig.saluran?.link || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
                                    })
                                },
                                ...suggestions.slice(0, 2).map(s => ({
                                    name: 'quick_reply',
                                    buttonParamsJson: JSON.stringify({
                                        display_text: `Coba: ${prefix}${s.command}`,
                                        id: `${prefix}${s.command}`
                                    })
                                }))
                            ]
                        }
                    }
                }
            }
        }, { quoted: qLocV6, userJid: sock.user?.jid || sock.user?.id })

        await sock.relayMessage(m.chat, msgV6.message, { messageId: msgV6.key.id })
    } catch (e) {
        console.error('[Similarity V6] Error:', e.message)
        let fallback = `👋 Halo kak *${m.pushName}*!\n\n`
        fallback += `Mohon maaf, command \`${inputCommand}\` belum tersedia. 🥺\n`
        fallback += `Mungkin maksud kamu:\n`
        suggestions.slice(0, 2).forEach(s => {
            fallback += `▸ \`${prefix}${s.command}\`\n`
        })
        await sock.sendMessage(m.chat, { text: fallback }, { quoted: m })
    }

    return { sent: true }
}

    // Fallback ke V1 kalau variant tidak dikenal
    return null
}

function formatSuggestionButtons(inputCommand, suggestions, prefix = '.') {
    if (suggestions.length === 0) return []
    
    return suggestions.slice(0, 10).map((s, i) => {
        const matchPercent = Math.round(s.similarity * 100)
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`
        
        return {
            header: `${medal} ${prefix}${s.command}`,
            title: `${s.emoji} ${s.reason} • ${matchPercent}% cocok`,
            description: `Klik command untuk mencoba`,
            id: `${prefix}${s.command}`
        }
    })
}

function createSuggestionResponse(inputCommand, suggestions, prefix = '.') {
    const message = formatSuggestionMessage(inputCommand, suggestions, prefix)
    const buttons = formatSuggestionButtons(inputCommand, suggestions, prefix)
    
    return {
        message,
        buttons,
        hasSuggestions: suggestions.length > 0,
        topSuggestion: suggestions[0] || null,
        confidence: suggestions[0] ? Math.round(suggestions[0].similarity * 100) : 0
    }
}

function fuzzyMatch(input, commands, threshold = 0.3) {
    return findSimilarCommands(input, commands, { minSimilarity: threshold, useAdvanced: true })
        .filter(r => r.similarity >= threshold)
}

module.exports = {
    levenshteinDistance,
    damerauLevenshteinDistance,
    jaroWinklerSimilarity,
    nGramSimilarity,
    tokenSortRatio,
    getSimilarity,
    getAdvancedSimilarity,
    findSimilarCommands,
    formatSuggestionMessage,
    formatSuggestionButtons,
    createSuggestionResponse,
    createProgressBar,
    fuzzyMatch
}