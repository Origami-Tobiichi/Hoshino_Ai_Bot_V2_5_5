/**
‎✧ Name    : cekusername
‎✧ Category: tools
**/

const config = require('../../config')
const crypto = require('crypto')

const pluginConfig = {
    name: 'cekusername',
    alias: ['checkusername', 'usernamewa'],
    category: 'tools',
    description: 'Cek ketersediaan username WhatsApp',
    usage: '.cekusername <username>',
    example: '.cekusername hoshinoai',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

const USERNAME_QUERY_IDS = {
    CHECK: '26124072630599518'
}

const USERNAME_CHECK_RESULT = {
    SUCCESS: 'SUCCESS'
}

const USERNAME_SOURCE = {
    USER_INPUT: 'USER_INPUT'
}

const wMexQuery = (sock, variables, queryId) => {
    return sock.query({
        tag: 'iq',
        attrs: {
            id: sock.generateMessageTag(),
            type: 'get',
            to: 's.whatsapp.net',
            xmlns: 'w:mex'
        },
        content: [
            {
                tag: 'query',
                attrs: { query_id: queryId },
                content: Buffer.from(JSON.stringify({ variables }), 'utf-8')
            }
        ]
    })
}

const executeWMexQuery = async (sock, variables, queryId, dataPath) => {
    const result = await wMexQuery(sock, variables, queryId)
    const child = result?.content?.[0]
    if (child?.content) {
        const data = JSON.parse(child.content.toString())
        if (data.errors && data.errors.length > 0) {
            throw new Error(data.errors.map(err => err.message).join(', '))
        }
        const response = dataPath ? data?.data?.[dataPath] : data?.data
        if (typeof response !== 'undefined') {
            return response
        }
    }
    throw new Error('Gagal ambil data dari server WhatsApp')
}

const checkUsername = async (sock, username, includeSuggestions = true, sessionId) => {
    const session_id = sessionId || crypto.randomUUID()
    const data = await executeWMexQuery(
        sock,
        {
            username,
            include_suggestions: includeSuggestions,
            session_id,
            source: USERNAME_SOURCE.USER_INPUT
        },
        USERNAME_QUERY_IDS.CHECK,
        'xwa2_username_check'
    )
    if (data?.result === USERNAME_CHECK_RESULT.SUCCESS) {
        return { available: true, username, session_id }
    }
    return {
        available: false,
        username,
        session_id,
        suggestions: data?.suggestions ?? [],
        rejectionReasons: data?.rejection_reasons ?? [],
        suggestionsEligible: data?.suggestions_eligible ?? true
    }
}

async function handler(m, { sock }) {
    const text = m.text?.trim()

    if (!text) {
        return m.reply(
            `╭┈┈⬡「 🔎 ᴄᴇᴋᴜsᴇʀɴᴀᴍᴇ 」\n` +
            `┃ Kasih Ai username yang mau dicek dulu~ ✨\n` +
            `┃\n` +
            `┃ ᴜsᴀɢᴇ:\n` +
            `┃ ${m.prefix}cekusername <username>\n` +
            `┃\n` +
            `┃ ᴄᴏɴᴛᴏʜ:\n` +
            `┃ ${m.prefix}cekusername hoshinoai\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }

    await m.react('🕕')

    try {
        const username = text.replace(/\s+/g, '')
        const result = await checkUsername(sock, username)

        if (result.available) {
            await m.react('✅')
            return m.reply(
                `╭┈┈⬡「 ✅ ᴛᴇʀsᴇᴅɪᴀ! 」\n` +
                `┃ Username *${result.username}* masih available~ 🎤✨\n` +
                `┃\n` +
                `┃ 🆔 Session : ${result.session_id}\n` +
                `╰┈┈┈┈┈┈┈┈⬡`
            )
        }

        const suggestionText = result.suggestions.length
            ? result.suggestions.map(s => `┃ • ${s}`).join('\n')
            : `┃ (gak ada saran nih)`

        const reasonText = result.rejectionReasons.length
            ? result.rejectionReasons.join(', ')
            : 'Sudah dipakai orang lain'

        await m.react('❌')
        return m.reply(
            `╭┈┈⬡「 ❌ ᴛɪᴅᴀᴋ ᴛᴇʀsᴇᴅɪᴀ 」\n` +
            `┃ Username *${result.username}* gak bisa dipakai.\n` +
            `┃ Alasan: ${reasonText}\n` +
            `┃\n` +
            `┃ 💡 sᴀʀᴀɴ ʟᴀɪɴ:\n` +
            `${suggestionText}\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    } catch (error) {
        console.error('[cekusername] Error:', error)
        await m.react('❌')
        return m.reply(
            `╭┈┈⬡「 ❌ ᴀᴅᴜʜ, ɢᴀɢᴀʟ 」\n` +
            `┃ ${error.message}\n` +
            `┃\n` +
            `┃ Coba lagi ya, Ai janji next take bakal lebih bagus~\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}