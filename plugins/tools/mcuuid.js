const axios = require('axios')

const pluginConfig = {
    name: 'mcuuid',
    alias: ['mcprofile', 'mcskin'],
    category: 'tools',
    description: 'Cari profil Minecraft berdasarkan username',
    usage: '.mcuuid <username>',
    example: '.mcuuid Notch',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

const MOJANG_PROFILE_API = 'https://api.mojang.com/users/profiles/minecraft/'
const MOJANG_SESSION_API = 'https://sessionserver.mojang.com/session/minecraft/profile/'

async function getMinecraftProfile(username) {
    const uuidRes = await axios.get(`${MOJANG_PROFILE_API}${username}`)
    const uuidData = uuidRes.data

    if (!uuidData || !uuidData.id) return null

    const uuid = uuidData.id
    const trimmedUUID = uuid.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')

    let skin = null

    try {
        const profileRes = await axios.get(`${MOJANG_SESSION_API}${uuid}`)
        const profileData = profileRes.data

        if (profileData.properties) {
            for (const prop of profileData.properties) {
                if (prop.name === 'textures') {
                    const textures = JSON.parse(Buffer.from(prop.value, 'base64').toString())
                    if (textures.textures.SKIN) skin = textures.textures.SKIN.url
                }
            }
        }
    } catch (_) {}

    return {
        username: uuidData.name,
        uuid,
        trimmedUUID,
        skin,
        avatar: `https://mc-heads.net/avatar/${uuid}/100`,
        body: `https://mc-heads.net/body/${uuid}/200`,
        head: `https://mc-heads.net/head/${uuid}`,
        skinDownload: `https://mc-heads.net/download/${uuid}`,
        profileUrl: `https://minecraftuuid.com/player/${uuidData.name}`
    }
}

async function handler(m, { sock }) {
    const username = m.args.join(' ').trim()
    if (!username) {
        return m.reply(
            `🎮 *ᴍᴄᴜᴜɪᴅ*\n\n` +
            `> Masukkan username Minecraft yang ingin dicari~\n\n` +
            `\`Contoh: ${m.prefix}mcuuid Notch\``
        )
    }

    m.react('🕕')

    try {
        const data = await getMinecraftProfile(username)

        if (!data) {
            m.react('❌')
            return m.reply(`❌ *ᴘʟᴀʏᴇʀ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ*\n\n> Player *${username}* tidak ditemukan~`)
        }

        const caption =
            `🎮 *ᴍɪɴᴇᴄʀᴀꜰᴛ ᴘʀᴏꜰɪʟᴇ*\n\n` +
            `╭┈┈⬡「 👤 *ᴘʀᴏꜰɪʟᴇ* 」\n` +
            `┃ 🏷 ᴜsᴇʀɴᴀᴍᴇ : \`${data.username}\`\n` +
            `┃ 🔑 ᴜᴜɪᴅ      : \`${data.uuid}\`\n` +
            `┃ ✂️ ᴛʀɪᴍᴍᴇᴅ   : \`${data.trimmedUUID}\`\n` +
            `┃ 🎨 sᴋɪɴ      : \`${data.skin ? 'Custom' : 'Default (Steve/Alex)'}\`\n` +
            `╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈⬡\n\n` +
            `╭┈┈⬡「 🔗 *ʟɪɴᴋs* 」\n` +
            `┃ 🖼 ᴀᴠᴀᴛᴀʀ  : ${data.avatar}\n` +
            `┃ 👤 ʜᴇᴀᴅ    : ${data.head}\n` +
            `┃ 🧍 ʙᴏᴅʏ    : ${data.body}\n` +
            `┃ 💾 ᴅᴏᴡɴʟᴏᴀᴅ: ${data.skinDownload}\n` +
            (data.skin ? `┃ 🎨 sᴋɪɴ ꜰɪʟᴇ: ${data.skin}\n` : '') +
            `╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈⬡`

        await sock.sendMessage(m.chat, {
            image: { url: data.body },
            caption
        }, { quoted: m })

        m.react('✅')
    } catch (error) {
        m.react('❌')
        await m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}