/**
‎✧ Name    : mcavatar
‎✧ Category: Stalker
**/

const config = require('../../config')
const axios = require('axios')

const pluginConfig = {
    name: 'mcavatar',
    alias: ['avatarmc', 'mcpfp'],
    category: 'stalker',
    description: 'Generate avatar Minecraft (face/bust/body/head 3D) dari username/gamertag - Java & Bedrock general, via MCCompanion API',
    usage: '.mcavatar <username/gamertag> [face|bust|body|head]',
    example: '.mcavatar Notch body',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

const AXIOS_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

const VALID_STYLES = ['face', 'bust', 'body', 'head']

function toUrlSafeBase64(buffer) {
    return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_')
}

function getJavaRenderSources(uuid, style) {
    switch (style) {
        case 'face':
            return [
                `https://crafatar.com/avatars/${uuid}?size=512&overlay`,
                `https://mc-heads.net/avatar/${uuid}/512`,
                `https://vzge.me/face/512/${uuid}`
            ]
        case 'bust':
            return [
                `https://vzge.me/bust/512/${uuid}`,
                `https://crafatar.com/renders/head/${uuid}?overlay&scale=8`
            ]
        case 'head':
            return [
                `https://mc-heads.net/head/${uuid}/300`,
                `https://crafatar.com/renders/head/${uuid}?overlay&scale=8`
            ]
        case 'body':
        default:
            return [
                `https://crafatar.com/renders/body/${uuid}?overlay&scale=8`,
                `https://vzge.me/full/512/${uuid}`,
                `https://mc-heads.net/body/${uuid}/128`
            ]
    }
}

function getSkinBasedRenderUrl(skinBase64, style) {
    const map = { face: 'face/512', bust: 'bust/512', head: 'head/512', body: 'full/512' }
    const path = map[style] || map.body
    return `https://vzge.me/${path}/${skinBase64}`
}

async function handler(m, { sock, args }) {
    const query = args[0]
    let style = (args[1] || 'body').toLowerCase()

    if (!query) {
        return m.reply(
            `📦 *ᴍᴄᴀᴠᴀᴛᴀʀ* 🎤\n\n` +
            `> Masukin username/gamertag-nya dong~ ✨\n\n` +
            `> ${m.prefix}mcavatar <username/gamertag> [style]\n\n` +
            `*sᴛʏʟᴇ:* face, bust, body (default), head\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> ${m.prefix}mcavatar Notch\n` +
            `> ${m.prefix}mcavatar RazakSmile face`
        )
    }

    if (!VALID_STYLES.includes(style)) style = 'body'

    await m.react('🕕')

    try {
        const { data } = await axios.get(
            `https://api.mccompanion.net/api/lookup/bedrock-java/${encodeURIComponent(query)}`,
            { timeout: 10000, headers: AXIOS_HEADERS, validateStatus: () => true }
        )

        const profile = data?.java || data?.bedrock
        if (!profile) throw new Error('PLAYER_NOT_FOUND')

        const isJava = profile.platform === 'java'
        const name = profile.username || profile.gamertag

        // ===== Java: pakai UUID langsung, banyak renderer publik support (lebih cepat & bagus) =====
        if (isJava) {
            const uuid = profile.uuid
            const caption =
                `🖼️ *ᴀᴠᴀᴛᴀʀ ɢᴇɴᴇʀᴀᴛᴇᴅ~* ✨\n\n` +
                `*Username:* ${name}\n` +
                `*Edition :* Java\n` +
                `*Style   :* ${style}\n\n` +
                `_by mcavatar_`

            const sources = getJavaRenderSources(uuid, style)
            for (const url of sources) {
                try {
                    const { data: imgBuffer } = await axios.get(url, {
                        responseType: 'arraybuffer', timeout: 10000, headers: AXIOS_HEADERS
                    })
                    await m.react('✅')
                    return sock.sendMessage(m.chat, {
                        image: Buffer.from(imgBuffer),
                        caption
                    }, { quoted: m })
                } catch (renderErr) {
                    console.error(`[mcavatar] Render gagal dari ${url}:`, renderErr.message)
                }
            }

            // Fallback terakhir: pakai skinUrl langsung dari MCCompanion via VZGE base64
            try {
                const { data: skinBuffer } = await axios.get(profile.skinUrl, {
                    responseType: 'arraybuffer', timeout: 10000, headers: AXIOS_HEADERS
                })
                const skinBase64 = toUrlSafeBase64(Buffer.from(skinBuffer))
                const renderUrl = getSkinBasedRenderUrl(skinBase64, style)
                const { data: renderBuffer } = await axios.get(renderUrl, {
                    responseType: 'arraybuffer', timeout: 12000, headers: AXIOS_HEADERS
                })
                await m.react('✅')
                return sock.sendMessage(m.chat, {
                    image: Buffer.from(renderBuffer),
                    caption
                }, { quoted: m })
            } catch (fallbackErr) {
                console.error('[mcavatar] Fallback skin render gagal:', fallbackErr.message)
                await m.react('✅')
                return m.reply(caption + `\n\n⚠️ Semua render service lagi down, coba lagi nanti ya~`)
            }
        }

        // ===== Bedrock: pakai skinUrl dari MCCompanion (general, gak terbatas cache Geyser) =====
        const caption =
            `🖼️ *ᴀᴠᴀᴛᴀʀ ɢᴇɴᴇʀᴀᴛᴇᴅ~* ✨\n\n` +
            `*Gamertag  :* ${name}\n` +
            `*Edition   :* Bedrock\n` +
            (profile.gamerscore != null ? `*Gamerscore:* ${profile.gamerscore}\n` : '') +
            (profile.tier ? `*Tier      :* ${profile.tier}\n` : '') +
            `*Style     :* ${style}\n\n` +
            `_by mcavatar (via MCCompanion + VZGE)_`

        try {
            const { data: skinBuffer } = await axios.get(profile.skinUrl, {
                responseType: 'arraybuffer', timeout: 10000, headers: AXIOS_HEADERS
            })

            const skinBase64 = toUrlSafeBase64(Buffer.from(skinBuffer))
            const renderUrl = getSkinBasedRenderUrl(skinBase64, style)

            try {
                const { data: renderBuffer } = await axios.get(renderUrl, {
                    responseType: 'arraybuffer', timeout: 12000, headers: AXIOS_HEADERS
                })
                await m.react('✅')
                return sock.sendMessage(m.chat, {
                    image: Buffer.from(renderBuffer),
                    caption
                }, { quoted: m })
            } catch (renderErr) {
                console.error('[mcavatar] VZGE render gagal (kemungkinan URL terlalu panjang):', renderErr.message)
                await m.react('✅')
                return sock.sendMessage(m.chat, {
                    image: Buffer.from(skinBuffer),
                    caption: caption + `\n\n⚠️ Render 3D gagal, ini raw skin texture-nya aja.`
                }, { quoted: m })
            }
        } catch (skinErr) {
            console.error('[mcavatar] Gagal ambil skin PNG:', skinErr.message)
            await m.react('✅')
            return m.reply(caption + `\n\n⚠️ Gagal ambil gambar skin-nya, coba lagi nanti ya~`)
        }

    } catch (error) {
        console.error('[mcavatar] Error:', error.message)
        await m.react('❌')

        if (error.message === 'PLAYER_NOT_FOUND') {
            return m.reply(
                `❌ *ᴘʟᴀʏᴇʀ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ*\n\n` +
                `> Username/gamertag *${query}* gak ketemu di Java maupun Bedrock.\n` +
                `> Coba cek lagi ejaannya ya~`
            )
        }

        return m.reply(
            `❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ*\n\n` +
            `> Ada gangguan pas ambil data player *${query}*.\n\n` +
            `> Coba lagi beberapa saat ya~`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}