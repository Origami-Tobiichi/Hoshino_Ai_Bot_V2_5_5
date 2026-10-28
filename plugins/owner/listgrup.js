const { generateWAMessageFromContent, proto } = require('hsnai');
const { getParticipantJid } = require('../../src/lib/lidHelper');

const pluginConfig = {
    name: 'listgrup',
    alias: ['listgc'],
    category: 'owner',
    description: 'Menampilkan semua grup bot (ultimate clean)',
    usage: '.listgc',
    example: '.listgc',
    isOwner: true,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    isEnabled: true
}

function formatDate(ts) {
    if (!ts) return '-'
    const d = new Date(ts * 1000)
    return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    })
}

async function handler(m, { sock, config: botConfig }) {
    try {
        const prefix = m.prefix || botConfig.command?.prefix || '.'
        const saluranId = botConfig.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
        const saluranName = botConfig.saluran?.name || botConfig.bot?.name || 'Hoshino Ai-Bot'

        const groups = await sock.groupFetchAllParticipating()
        const groupIds = Object.keys(groups)

        if (!groupIds.length) {
            return m.reply(`🌸 *Hoshino Ai Notice*

╭━━━〔 📭 EMPTY 〕━━━⬣
┃ Bot belum join grup manapun...
╰━━━━━━━━━━━━━━━━⬣`)
        }

        global.gcMap = {}
        global.gcList = []

        let totalMember = 0
        let totalAdmin = 0
        let allMentions = []
        let largest = { name: '-', size: 0 }
        let smallest = { name: '-', size: Infinity }
        let groupList = []

        for (let id of groupIds) {
            let g = groups[id]
            let members = g.participants || []
            let admins = members.filter(p => p.admin)
            let memberCount = members.length
            let adminCount = admins.length
            totalMember += memberCount
            totalAdmin += adminCount
            if (memberCount > largest.size) largest = { name: g.subject, size: memberCount }
            if (memberCount < smallest.size) smallest = { name: g.subject, size: memberCount }
            groupList.push({ id, ...g, memberCount })
        }

        groupList.sort((a, b) => b.memberCount - a.memberCount)

        let teks = `🌸 *Hoshino Ai Ultimate Group Manager* ✨\n`
        teks += `╭━━━〔 📊 GLOBAL STATS 〕━━━⬣\n`
        teks += `┃ 📋 Total Grup   : ${groupIds.length}\n`
        teks += `┃ 👥 Total Member : ${totalMember}\n`
        teks += `┃ 👑 Total Admin  : ${totalAdmin}\n`
        teks += `┃ 🏆 Terbesar     : ${largest.name} (${largest.size})\n`
        teks += `┃ 🧊 Terkecil     : ${smallest.name} (${smallest.size})\n`
        teks += `╰━━━━━━━━━━━━━━━━⬣\n\n`

        let no = 1

        for (let g of groupList) {
            let members = g.participants || []
            let admins = members.filter(p => p.admin)
            let botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net'
            let botData = members.find(p => p.id === botNumber)
            let botAdmin = botData?.admin ? true : false

            let adminList = admins.slice(0, 5).map(a => {
                let jid = getParticipantJid(a)
                allMentions.push(jid)
                return '@' + jid.split('@')[0]
            }).join(', ') || '-'

            let desc = g.desc ? g.desc.slice(0, 60) + '...' : '-'
            let status = g.announce ? '🔒 Tertutup' : '🔓 Terbuka'
            let created = formatDate(g.creation)
            let ephemeral = g.ephemeralDuration ? `${g.ephemeralDuration}s` : 'Off'

            teks += `╭━━━〔 ${no} 〕━━━⬣\n`
            teks += `┃ 🏷️ Nama     : ${g.subject}\n`
            teks += `┃ 🆔 ID       : ${g.id}\n`
            teks += `┃ 👑 Owner    : ${g.owner || '-'}\n`
            teks += `┃ 👥 Member   : ${members.length}\n`
            teks += `┃ 🛡️ Admin    : ${admins.length}\n`
            teks += `┃ 📢 Status   : ${status}\n`
            teks += `┃ 🤖 Bot      : ${botAdmin ? 'Admin ✅' : 'Member ❌'}\n`
            teks += `┃ ⏳ Ephemeral: ${ephemeral}\n`
            teks += `┃ 🕒 Dibuat   : ${created}\n`
            teks += `┃ 🧾 Desk     : ${desc}\n`
            teks += `┃ 👑 Admin    : ${adminList}\n`
            teks += `╰━━━━━━━━━━━━━━━━⬣\n\n`

            global.gcMap[no] = g.id
            global.gcList.push({ no, id: g.id, name: g.subject, count: members.length })
            no++
        }

        teks += `🌸 *Control Center* 🎛️\n`
        teks += `╭━━━〔 🎯 CTRLGC 〕━━━⬣\n`
        teks += `┃ #open / #close\n`
        teks += `┃ #leave\n`
        teks += `┃ #setname (reply teks)\n`
        teks += `┃ #setdesk (reply teks)\n`
        teks += `┃ #setpp (reply gambar)\n`
        teks += `┃ kirim teks bebas\n`
        teks += `╰━━━━━━━━━━━━━━━━⬣\n\n`
        teks += `✨ *Idol juga kenal semua adminnya~* ✨`

        const gcRows = (aksi) => global.gcList.map(g => ({
            title: `[${g.no}] ${g.name.slice(0, 24)}`,
            description: `👥 ${g.count} member`,
            id: `${prefix}ctrlgc ${g.no} ${aksi}`
        }))

        const buttons = [
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: '🔓 Open Grup',
                    sections: [{ title: '🔓 PILIH GRUP — OPEN', rows: gcRows('#open') }],
                    has_multiple_buttons: true
                })
            },
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: '🔒 Close Grup',
                    sections: [{ title: '🔒 PILIH GRUP — CLOSE', rows: gcRows('#close') }],
                    has_multiple_buttons: true
                })
            },
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: '👋 Leave Grup',
                    sections: [{ title: '👋 PILIH GRUP — LEAVE', rows: gcRows('#leave') }],
                    has_multiple_buttons: true
                })
            },
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: '🔕 Ignore Toggle',
                    sections: [{ title: '🔕 PILIH GRUP — IGNORE', rows: gcRows('#ignore') }],
                    has_multiple_buttons: true
                })
            },
        ]

        const msg = generateWAMessageFromContent(m.chat, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                    interactiveMessage: proto.Message.InteractiveMessage.create({
                        contextInfo: {
                            mentionedJid: allMentions.length ? allMentions : [m.sender],
                            forwardingScore: 19,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: saluranId,
                                newsletterName: saluranName,
                                serverMessageId: 127
                            }
                        },
                        header: proto.Message.InteractiveMessage.Header.create({
                            title: `🌸 Group Manager`,
                            hasMediaAttachment: false
                        }),
                        body: proto.Message.InteractiveMessage.Body.create({ text: teks }),
                        footer: proto.Message.InteractiveMessage.Footer.create({
                            text: `© ${botConfig.bot?.name || 'Hoshino Ai-Bot'} • ${groupIds.length} Grup`
                        }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                            buttons,
                            messageParamsJson: JSON.stringify({
                                bottom_sheet: {
                                    in_thread_buttons_limit: 2,
                                    divider_indices: [1, 2, 3, 4],
                                    list_title: '🌸 Group Control Center',
                                    button_title: '⚙️ Kontrol Grup'
                                }
                            })
                        })
                    })
                }
            }
        }, { userJid: sock.user?.id, quoted: m })

        await sock.relayMessage(msg.key.remoteJid, msg.message, { messageId: msg.key.id })

    } catch (err) {
        console.error('[LISTGC ERROR]', err)
        m.reply(`🌸 *Hoshino Ai Error*

╭━━━〔 ⚠️ ERROR 〕━━━⬣
┃ ${err.message}
╰━━━━━━━━━━━━━━━━⬣`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}