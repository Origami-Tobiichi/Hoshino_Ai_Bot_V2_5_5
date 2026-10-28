/**
✧ Name    : ffguest
✧ Category: tools
**/

/*
Base   : https://play.google.com/store/apps/details?id=com.dts.freefireth
Author : Geno
Penyesuaian : SeaPRST
Saluran : https://whatsapp.com/channel/0029Vb6hVYK8V0tkiz4bKs0N
Features:
- Auto Buat Akun Guest
*/

const crypto = require('crypto')
const config = require('../../config')

const pluginConfig = {
    name: 'ffguest',
    alias: ['ffakun', 'freefireguest'],
    category: 'tools',
    description: 'Buat akun guest Free Fire otomatis',
    usage: '.ffguest <jumlah>',
    example: '.ffguest 3',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 3,
    isEnabled: true
}

const APP_ID = 100067
const SECRET = '2ee44819e9b4598845141067b281621874d0d5d7af9d8f7e00c1e54715b7d1e3'
const HOST = 'https://100067.connect.garena.com'
const UA = 'GarenaMSDK/4.0.42(NEO G12 ;Android 17;in;ID;app 1.130.1 2019121040;)'

const MAX_COUNT = 5
const MAX_RETRY = 3

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function post(path, body, headers = {}) {
    const res = await fetch(`${HOST}${path}`, {
        method: 'POST',
        headers: {
            'User-Agent': UA,
            'Content-Type': 'application/json; charset=utf-8',
            ...headers
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000)
    })
    const text = await res.text()
    if (text.trim().startsWith('<')) throw new Error('Rate limit, server lagi nahan Ai~')
    return JSON.parse(text)
}

async function createGuest() {
    const password = crypto.randomBytes(32).toString('hex').toUpperCase()
    const regBody = { app_id: APP_ID, client_type: 2, password, source: 2 }
    const sig = crypto.createHmac('sha256', SECRET).update(JSON.stringify(regBody)).digest('hex')

    const reg = await post('/api/v2/oauth/guest:register', regBody, {
        Authorization: `Signature ${sig}`
    })
    if (reg.code !== 0 || !reg.data?.uid) throw new Error(reg.error || 'Register gagal')

    const uid = reg.data.uid
    const grant = await post('/api/v2/oauth/guest/token:grant', {
        client_id: APP_ID,
        client_secret: SECRET,
        client_type: 2,
        password,
        response_type: 'token',
        uid
    })
    if (grant.code !== 0 || !grant.data?.access_token) throw new Error(grant.error || 'Grant token gagal')

    return {
        uid,
        password,
        open_id: grant.data.open_id,
        access_token: grant.data.access_token
    }
}

async function createGuestRetry() {
    let lastErr
    for (let i = 0; i < MAX_RETRY; i++) {
        try {
            return await createGuest()
        } catch (err) {
            lastErr = err
            await sleep(4000)
        }
    }
    throw lastErr
}

async function handler(m, { sock }) {
    const text = m.text?.trim()

    if (!text) {
        return m.reply(
            `📦 *ꜰꜰ ɢᴜᴇsᴛ* 🎤\n\n` +
            `> Bikin akun guest Free Fire otomatis~ ✨\n\n` +
            `> ${m.prefix}ffguest <jumlah>\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> ${m.prefix}ffguest 3\n\n` +
            `> Maksimal ${MAX_COUNT} akun sekali bikin ya~`
        )
    }

    const count = parseInt(text.split(/\s+/)[0])
    if (isNaN(count) || count < 1) {
        return m.reply(
            `❌ *ᴊᴜᴍʟᴀʜ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ*\n\n` +
            `> Isi angka 1-${MAX_COUNT} ya~ contoh: ${m.prefix}ffguest 2`
        )
    }
    const total = Math.min(count, MAX_COUNT)

    await m.react('🕕')

    try {
        const accounts = []
        let failed = 0

        for (let i = 0; i < total; i++) {
            try {
                accounts.push(await createGuestRetry())
            } catch (err) {
                failed++
                console.error('[ffguest] Gagal bikin akun:', err.message)
            }
            if (i < total - 1) await sleep(1500)
        }

        if (accounts.length === 0) {
            throw new Error('Semua percobaan gagal, kemungkinan kena rate limit')
        }

        let out = `✅ *ʙᴇʀʜᴀsɪʟ~* 🎤✨\n\n> Ai udah bikinin ${accounts.length} akun guest!\n`
        if (failed > 0) out += `> (${failed} akun gagal dibuat)\n`
        out += '\n'

        accounts.forEach((acc, i) => {
            out +=
                `╭┈┈⬡「 🎀 ᴀᴋᴜɴ ${i + 1} 」\n` +
                `┃ *UID:* ${acc.uid}\n` +
                `┃ *Password:* ${acc.password}\n` +
                `┃ *Open ID:* ${acc.open_id}\n` +
                `┃ *Access Token:* ${acc.access_token}\n` +
                `╰┈┈┈┈┈┈┈┈⬡\n\n`
        })

        await m.react('✅')
        await m.reply(out.trim())

        await sock.sendMessage(
            m.chat,
            {
                document: Buffer.from(JSON.stringify(accounts, null, 2)),
                mimetype: 'application/json',
                fileName: 'akunguest.json'
            },
            { quoted: m }
        )
    } catch (error) {
        console.error('[ffguest] Error:', error)

        await m.react('❌')

        return m.reply(
            `❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ*\n\n` +
            `> ${error.message}\n\n` +
            `> Coba lagi ya, Ai janji next take bakal lebih bagus~`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}