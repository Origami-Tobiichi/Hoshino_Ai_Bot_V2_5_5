/**
‎✧ Name    : akinator
‎✧ Category: game
**/

'use strict'

const config = require('../../config')
const cheerio = require('cheerio')

let gotScraping

async function loadGotScraping() {
    if (!gotScraping) {
        const mod = await import('got-scraping')
        gotScraping = mod.gotScraping
    }
    return gotScraping
}

const BASE_URL = 'https://id.akinator.com'

const THEMES = {
    characters: 1,
    objects: 2,
    animals: 14
}

const ANSWERS = {
    ya: 0,
    yes: 0,
    tidak: 1,
    no: 1,
    idk: 2,
    'tidak tahu': 2,
    'gak tahu': 2,
    'ga tahu': 2,
    mungkin: 3,
    probably: 3,
    'mungkin tidak': 4,
    'mungkin enggak': 4,
    'mungkin nggak': 4,
    'probably not': 4
}

const sessions = new Map()

const pluginConfig = {
    name: 'akinator',
    alias: ['aki', 'akinatorgame'],
    category: 'game',
    description: 'Main game tebak karakter bersama Akinator',
    usage: '.akinator',
    example: '.aki',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 2,
    energi: 1,
    isEnabled: true
}

function parseCookies(headers, jar) {
    const cookies = headers?.['set-cookie']

    if (!cookies) return

    for (const cookie of cookies) {
        const [kv] = cookie.split(';')
        const index = kv.indexOf('=')

        if (index === -1) continue

        const key = kv.slice(0, index).trim()
        const value = kv.slice(index + 1).trim()

        if (key) {
            jar[key] = value
        }
    }
}

function getCookieString(jar) {
    return Object.entries(jar)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ')
}

async function startGame(theme = 'characters', childMode = false) {
    const got = await loadGotScraping()

    const sid = THEMES[theme] ?? THEMES.characters
    const jar = {}

    const homeRes = await got({
        url: BASE_URL + '/',
        method: 'GET',
        throwHttpErrors: false
    })

    parseCookies(homeRes.headers, jar)

    const res = await got({
        url: BASE_URL + '/game',
        method: 'POST',
        form: {
            sid: String(sid),
            cm: String(childMode)
        },
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            cookie: getCookieString(jar)
        },
        throwHttpErrors: false
    })

    parseCookies(res.headers, jar)

    const $ = cheerio.load(res.body)

    const question = $('#question-label')
        .text()
        .trim()

    const sessionMatch = res.body.match(
        /name="session"[^>]*value="([^"]+)"/
    )

    const signatureMatch = res.body.match(
        /name="signature"[^>]*value="([^"]+)"/
    )

    const session = sessionMatch?.[1] || null
    const signature = signatureMatch?.[1] || null

    let akitude = 'defi.png'

    const akitudeMatch = res.body.match(
        /akitude[^"]*"[^"]*([^/]+\.png)"/
    )

    if (akitudeMatch) {
        akitude = akitudeMatch[1]
    }

    if (!session || !signature) {
        throw new Error(
            'Gagal mendapatkan session/signature Akinator.'
        )
    }

    return {
        session,
        signature,
        question,
        step: 0,
        progression: 0,
        akitude,
        sid,
        theme,
        childMode,
        jar
    }
}

async function answerGame(game, answer) {
    const got = await loadGotScraping()

    const key = String(answer)
        .toLowerCase()
        .trim()

    const answerId = ANSWERS[key]

    if (answerId === undefined) {
        return {
            status: false,
            error:
                'Jawaban tidak valid.\n\n' +
                'Gunakan:\n' +
                '• ya\n' +
                '• tidak\n' +
                '• idk\n' +
                '• mungkin\n' +
                '• mungkin tidak'
        }
    }

    const res = await got({
        url: BASE_URL + '/answer',
        method: 'POST',
        form: {
            step: String(game.step),
            progression: String(game.progression),
            sid: String(game.sid),
            cm: String(game.childMode),
            answer: String(answerId),
            session: game.session,
            signature: game.signature
        },
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            cookie: getCookieString(game.jar)
        },
        throwHttpErrors: false
    })

    parseCookies(res.headers, game.jar)

    let data

    try {
        data = JSON.parse(res.body)
    } catch {
        return {
            status: false,
            error: 'Response dari server Akinator tidak valid.'
        }
    }

    if (data.completion === 'KO') {
        return {
            status: false,
            expired: true,
            error:
                'Session Akinator sudah expired atau tidak valid.'
        }
    }

    if (data.id_proposition) {
        return {
            status: true,
            won: true,
            name: data.name_proposition || 'Tidak diketahui',
            description: data.description_proposition || '',
            photo: data.photo || null,
            pseudo: data.pseudo || null
        }
    }

    return {
        status: true,
        won: false,
        question: data.question || 'Pertanyaan tidak tersedia.',
        step: Number.parseInt(data.step) || 0,
        progression: Number.parseFloat(data.progression) || 0,
        akitude: data.akitude || 'defi.png'
    }
}

async function backGame(game) {
    const got = await loadGotScraping()

    const res = await got({
        url: BASE_URL + '/cancel_answer',
        method: 'POST',
        form: {
            step: String(game.step),
            progression: String(game.progression),
            sid: String(game.sid),
            cm: String(game.childMode),
            session: game.session,
            signature: game.signature
        },
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            cookie: getCookieString(game.jar)
        },
        throwHttpErrors: false
    })

    parseCookies(res.headers, game.jar)

    let data

    try {
        data = JSON.parse(res.body)
    } catch {
        return {
            status: false,
            error: 'Gagal membaca response back Akinator.'
        }
    }

    if (!data.question) {
        return {
            status: false,
            error:
                'Akinator tidak mengembalikan pertanyaan sebelumnya.'
        }
    }

    return {
        status: true,
        question: data.question,
        step: Number.parseInt(data.step) || 0,
        progression: Number.parseFloat(data.progression) || 0,
        akitude: data.akitude || 'defi.png'
    }
}

async function excludeGame(game) {
    const got = await loadGotScraping()

    const res = await got({
        url: BASE_URL + '/exclude',
        method: 'POST',
        form: {
            step: String(game.step),
            progression: String(game.progression),
            sid: String(game.sid),
            cm: String(game.childMode),
            session: game.session,
            signature: game.signature,
            step_last_proposition: String(game.step)
        },
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            cookie: getCookieString(game.jar)
        },
        throwHttpErrors: false,
        followRedirect: true
    })

    parseCookies(res.headers, game.jar)

    try {
        const data = JSON.parse(res.body)

        if (!data.question) {
            return {
                status: false,
                error:
                    'Akinator tidak mengembalikan pertanyaan baru.'
            }
        }

        return {
            status: true,
            question: data.question,
            step: Number.parseInt(data.step) || 0,
            progression: Number.parseFloat(data.progression) || 0,
            akitude: data.akitude || 'defi.png'
        }
    } catch {}

    const $ = cheerio.load(res.body)

    const question = $('#question-label')
        .text()
        .trim()

    if (!question) {
        return {
            status: false,
            error:
                'Akinator menolak exclude. Session mungkin sudah expired.'
        }
    }

    const newSession = res.body.match(
        /name="session"[^>]*value="([^"]+)"/
    )

    const newSignature = res.body.match(
        /name="signature"[^>]*value="([^"]+)"/
    )

    return {
        status: true,
        question,
        step: 0,
        progression: 0,
        akitude: 'defi.png',
        session: newSession?.[1] || game.session,
        signature: newSignature?.[1] || game.signature
    }
}

function questionMessage(game) {
    return (
        `🧞‍♂️ *ᴀᴋɪɴᴀᴛᴏʀ*\n\n` +
        `❓ *${game.question}*\n\n` +
        `╭┈┈⬡「 *ᴊᴀᴡᴀʙᴀɴ* 」\n` +
        `┃ 🟢 *ya*\n` +
        `┃ 🔴 *tidak*\n` +
        `┃ ⚪ *idk*\n` +
        `┃ 🟡 *mungkin*\n` +
        `┃ 🟠 *mungkin tidak*\n` +
        `╰┈┈┈┈┈┈┈┈⬡\n\n` +
        `> Contoh: *${game.prefix}aki ya*`
    )
}

async function handler(m, { sock }) {
    const input = (m.text || '')
        .trim()
        .toLowerCase()

    const sender = m.sender

    try {
        if (
            input === 'stop' ||
            input === 'berhenti' ||
            input === 'cancel'
        ) {
            if (!sessions.has(sender)) {
                return m.reply(
                    `🧞‍♂️ *ᴀᴋɪɴᴀᴛᴏʀ*\n\n` +
                    `> Kamu tidak sedang bermain.`
                )
            }

            sessions.delete(sender)

            await m.react('✅')

            return m.reply(
                `🛑 *ɢᴀᴍᴇ ᴅɪʙᴇʀʜᴇɴᴛɪᴋᴀɴ*\n\n` +
                `> Sesi Akinator kamu sudah dihapus.`
            )
        }

        if (
            input === '' ||
            input === 'start' ||
            input === 'mulai'
        ) {
            if (sessions.has(sender)) {
                return m.reply(
                    `🎩 *ᴀᴋɪɴᴀᴛᴏʀ*\n\n` +
                    `> Kamu masih punya game yang sedang berjalan~ 🧞‍♂️\n\n` +
                    `> Jawab pertanyaan sebelumnya dulu.\n` +
                    `> Atau gunakan *${m.prefix}aki stop*`
                )
            }

            await m.react('🕕')

            await m.reply(
                `🧞‍♂️ *ᴍᴇᴍᴜʟᴀɪᴋᴀɴ ᴀᴋɪɴᴀᴛᴏʀ...*\n\n` +
                `> Tunggu sebentar ya~ ✨`
            )

            const game =
                await startGame('characters')

            game.prefix = m.prefix

            sessions.set(sender, game)

            await m.react('✅')

            return m.reply(
                `🎩 *ᴀᴋɪɴᴀᴛᴏʀ ᴅɪᴍᴜʟᴀɪᴋᴀɴ!* 🧞‍♂️\n\n` +
                `> Pikirkan satu karakter di kepala kamu.\n` +
                `> Jangan kasih tahu Ai siapa orangnya~ 👀\n\n` +
                `❓ *${game.question}*\n\n` +
                `╭┈┈⬡「 *ᴊᴀᴡᴀʙᴀɴ* 」\n` +
                `┃ 🟢 *ya*\n` +
                `┃ 🔴 *tidak*\n` +
                `┃ ⚪ *idk*\n` +
                `┃ 🟡 *mungkin*\n` +
                `┃ 🟠 *mungkin tidak*\n` +
                `╰┈┈┈┈┈┈┈┈⬡\n\n` +
                `> Contoh: *${m.prefix}aki ya*`
            )
        }

        const game = sessions.get(sender)

        if (!game) {
            return m.reply(
                `🎩 *ᴀᴋɪɴᴀᴛᴏʀ*\n\n` +
                `> Belum ada game yang aktif.\n\n` +
                `> Mulai dengan:\n` +
                `> *${m.prefix}aki*`
            )
        }

        if (
            input === 'back' ||
            input === 'kembali'
        ) {
            await m.react('🕕')

            const result =
                await backGame(game)

            if (!result.status) {
                await m.react('❌')

                return m.reply(
                    `❌ *ɢᴀɢᴀʟ*\n\n` +
                    `> ${result.error}`
                )
            }

            game.question = result.question
            game.step = result.step
            game.progression = result.progression
            game.akitude = result.akitude

            await m.react('✅')

            return m.reply(
                questionMessage(game)
            )
        }

        if (
            input === 'exclude' ||
            input === 'skip'
        ) {
            await m.react('🕕')

            const result =
                await excludeGame(game)

            if (!result.status) {
                await m.react('❌')

                return m.reply(
                    `❌ *ɢᴀɢᴀʟ*\n\n` +
                    `> ${result.error}`
                )
            }

            if (result.session) {
                game.session = result.session
            }

            if (result.signature) {
                game.signature = result.signature
            }

            game.question = result.question
            game.step = result.step
            game.progression = result.progression
            game.akitude = result.akitude

            await m.react('✅')

            return m.reply(
                `⏭️ *ᴘᴇʀᴛᴀɴʏᴀᴀɴ ᴅɪ-sᴋɪᴘ*\n\n` +
                questionMessage(game)
            )
        }

        const validAnswer =
            Object.prototype.hasOwnProperty.call(
                ANSWERS,
                input
            )

        if (!validAnswer) {
            return m.reply(
                `❓ *ᴊᴀᴡᴀʙᴀɴ ᴀᴋɪɴᴀᴛᴏʀ*\n\n` +
                `> ${game.question}\n\n` +
                `Gunakan salah satu:\n` +
                `> *${m.prefix}aki ya*\n` +
                `> *${m.prefix}aki tidak*\n` +
                `> *${m.prefix}aki idk*\n` +
                `> *${m.prefix}aki mungkin*\n` +
                `> *${m.prefix}aki mungkin tidak*`
            )
        }

        await m.react('🕕')

        const result =
            await answerGame(
                game,
                input
            )

        if (!result.status) {
            if (result.expired) {
                sessions.delete(sender)
            }

            await m.react('❌')

            return m.reply(
                `❌ *ᴀᴋɪɴᴀᴛᴏʀ*\n\n` +
                `> ${result.error}\n\n` +
                (
                    result.expired
                        ? `> Mulai game baru dengan *${m.prefix}aki*`
                        : ''
                )
            )
        }

        if (result.won) {
            sessions.delete(sender)

            await m.react('🎯')

            let caption =
                `🎯 *ᴀᴋɪɴᴀᴛᴏʀ ᴍᴇɴᴇʙᴀᴋ!* 🧞‍♂️\n\n` +
                `👤 *${result.name}*\n\n`

            if (result.description) {
                caption +=
                    `📝 ${result.description}\n\n`
            }

            if (result.pseudo) {
                caption +=
                    `👑 *Pseudo:* ${result.pseudo}\n\n`
            }

            caption +=
                `> Apakah tebakan Ai benar? 👀`

            if (result.photo) {
                try {
                    return await sock.sendMessage(
                        m.chat,
                        {
                            image: {
                                url: result.photo
                            },
                            caption
                        },
                        {
                            quoted: m
                        }
                    )
                } catch (error) {
                    console.error(
                        '[akinator] Gagal kirim foto:',
                        error
                    )

                    return m.reply(caption)
                }
            }

            return m.reply(caption)
        }

        game.question = result.question
        game.step = result.step
        game.progression = result.progression
        game.akitude = result.akitude

        await m.react('🧞‍♂️')

        return m.reply(
            questionMessage(game)
        )

    } catch (error) {
        console.error(
            '[akinator] Error:',
            error
        )

        await m.react('❌')

        return m.reply(
            `❌ *ᴀᴅᴜʜ, ᴀᴋɪɴᴀᴛᴏʀ ɢᴀɢᴀʟ*\n\n` +
            `> ${error.message}\n\n` +
            `> Coba mulai lagi dengan *${m.prefix}aki*`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}