/**
✧ Name    : reactevent
✧ Category: owner
**/

const config = require('../../config')
const { getConf, saveConf, getGlobalConf, saveGlobalConf, setAllGroups } = require('../../src/lib/reactevent')

const pluginConfig = {
    name: 'reactevent',
    alias: ['revent'],
    category: 'owner',
    description: 'Atur auto react buat event grup (member masuk/keluar/ganti deskripsi)',
    usage: '.reactevent <on|off|add|del|list> [emoji]',
    example: '.reactevent add 🍒',
    isOwner: true,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const [sub, ...rest] = (m.text?.trim().split(/\s+/) || [])
    const [emoji] = rest
    const jid = m.chat
    const conf = getConf(jid)

    if (!sub) {
        const gconf = getGlobalConf()
        const effectiveOn = gconf.enabled && conf.enabled

        return m.reply(
            `📦 *ʀᴇᴀᴄᴛᴇᴠᴇɴᴛ* 🎤\n\n` +
            `> Status grup: ${conf.enabled ? 'ON ✅' : 'OFF ❌'}\n` +
            `> Master switch global: ${gconf.enabled ? 'ON ✅' : 'OFF ❌'}\n` +
            `> Efektif: ${effectiveOn ? 'ON ✅' : `OFF ❌ ${!gconf.enabled ? '(global lagi mati total)' : '(grup ini di-OFF-in)'}`}\n` +
            `> Emoji: ${conf.emojis.join(' ')}\n\n` +
            `*ᴘᴇʀɪɴᴛᴀʜ:*\n` +
            `> ${m.prefix}reactevent on\n` +
            `> ${m.prefix}reactevent off\n` +
            `> ${m.prefix}reactevent add <emoji>\n` +
            `> ${m.prefix}reactevent del <emoji>\n` +
            `> ${m.prefix}reactevent list\n` +
            `> ${m.prefix}reactevent global <on|off|add|del|list>`
        )
    }

    switch (sub.toLowerCase()) {
        case 'on':
            conf.enabled = true
            saveConf(jid, conf)
            return m.reply('✅ Auto react event dinyalain di grup ini~')

        case 'off':
            conf.enabled = false
            saveConf(jid, conf)
            return m.reply('❌ Auto react event dimatiin di grup ini~')

        case 'add':
            if (!emoji) return m.reply(`> ${m.prefix}reactevent add <emoji>`)
            if (conf.emojis.includes(emoji)) return m.reply('> Emoji itu udah ada di list~')
            conf.emojis.push(emoji)
            saveConf(jid, conf)
            return m.reply(`✅ Emoji ${emoji} ditambahin ke list~`)

        case 'del': {
            if (!emoji) return m.reply(`> ${m.prefix}reactevent del <emoji>`)
            const idx = conf.emojis.indexOf(emoji)
            if (idx === -1) return m.reply('> Emoji itu gak ada di list~')
            if (conf.emojis.length <= 1) return m.reply('> Minimal 1 emoji harus ada, gak bisa dihapus~')
            conf.emojis.splice(idx, 1)
            saveConf(jid, conf)
            return m.reply(`✅ Emoji ${emoji} dihapus dari list~`)
        }

        case 'list':
            return m.reply(`> Emoji list: ${conf.emojis.join(' ')}`)

        default:
            return m.reply(`> Perintah gak dikenal. Pake: on / off / add / del / list`)
        case 'global': {
            const gsub = (rest[0] || '').toLowerCase()
            const gemoji = rest[1]
            const gconf = getGlobalConf()

            switch (gsub) {
                case 'on':
    setAllGroups(true)
    return m.reply('🌐✅ Semua grup di-ON-in~ Mau matiin grup tertentu? `.reactevent off` di grup itu.')

case 'off':
    setAllGroups(false)
    return m.reply('🌐❌ Semua grup di-OFF-in~ Mau nyalain grup tertentu? `.reactevent on` di grup itu.')

                case 'add':
                    if (!gemoji) return m.reply(`> ${m.prefix}reactevent global add <emoji>`)
                    if (gconf.emojis.includes(gemoji)) return m.reply('> Emoji itu udah ada di list global~')
                    gconf.emojis.push(gemoji)
                    saveGlobalConf(gconf)
                    return m.reply(`✅ Emoji ${gemoji} ditambahin ke list global~`)

                case 'del': {
                    if (!gemoji) return m.reply(`> ${m.prefix}reactevent global del <emoji>`)
                    const idx = gconf.emojis.indexOf(gemoji)
                    if (idx === -1) return m.reply('> Emoji itu gak ada di list global~')
                    if (gconf.emojis.length <= 1) return m.reply('> Minimal 1 emoji harus ada, gak bisa dihapus~')
                    gconf.emojis.splice(idx, 1)
                    saveGlobalConf(gconf)
                    return m.reply(`✅ Emoji ${gemoji} dihapus dari list global~`)
                }

                case 'list':
                    return m.reply(
                        `🌐 *ʀᴇᴀᴄᴛᴇᴠᴇɴᴛ ɢʟᴏʙᴀʟ*\n\n` +
                        `> Status: ${gconf.enabled ? 'ON ✅' : 'OFF ❌'}\n` +
                        `> Emoji: ${gconf.emojis.join(' ')}`
                    )

                default:
                    return m.reply(
                        `🌐 *ʀᴇᴀᴄᴛᴇᴠᴇɴᴛ ɢʟᴏʙᴀʟ*\n\n` +
                        `> Status: ${gconf.enabled ? 'ON ✅' : 'OFF ❌'}\n` +
                        `> Emoji: ${gconf.emojis.join(' ')}\n\n` +
                        `*ᴘᴇʀɪɴᴛᴀʜ:*\n` +
                        `> ${m.prefix}reactevent global on\n` +
                        `> ${m.prefix}reactevent global off\n` +
                        `> ${m.prefix}reactevent global add <emoji>\n` +
                        `> ${m.prefix}reactevent global del <emoji>\n` +
                        `> ${m.prefix}reactevent global list`
                    )
            }
        }
    }
}

module.exports = {
    config: pluginConfig,
    handler
}