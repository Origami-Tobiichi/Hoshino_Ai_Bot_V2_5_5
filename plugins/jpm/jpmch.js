const hsAsset = require('../../src/lib/assets')
const { getDatabase } = require('../../src/lib/database')
const { getGroupMode } = require('../group/botmodegc')
const config = require('../../config')
const { getBinaryNodeChild } = require('hsnai')

const fs = require('fs')

let cachedThumb = null
hsAsset.tryBuffer('images/hsnai').then(b => { if (b) cachedThumb = b }).catch(() => {})
const pluginConfig = {
    name: 'jpmch',
    alias: ['jpmchannel'],
    category: 'jpm',
    description: 'Kirim pesan ke semua channel WhatsApp',
    usage: '.jpmch <pesan>',
    example: '.jpmch Halo semuanya!',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 0,
    isEnabled: true
}

/**
 * Fetch semua channel yang di-subscribe (dari inibaileysnya)
 * @param {Object} sock - Socket Baileys
 * @returns {Promise<Object>} Daftar channel
 */
async function fetchAllSubscribedChannels(sock) {
    const data = {}
    const encoder = new TextEncoder()
    const queryIds = ['6388546374527196']
    
    for (const queryId of queryIds) {
        try {
            const result = await sock.query({
                tag: 'iq',
                attrs: {
                    id: sock.generateMessageTag(),
                    type: 'get',
                    xmlns: 'w:mex',
                    to: '@s.whatsapp.net',
                },
                content: [
                    {
                        tag: 'query',
                        attrs: { 'query_id': queryId },
                        content: encoder.encode(JSON.stringify({
                            variables: {}
                        }))
                    }
                ]
            })
            const child = getBinaryNodeChild(result, 'result')
            if (!child?.content) continue
            const parsed = JSON.parse(child.content.toString())
            const newsletters = parsed?.data?.['xwa2_newsletter_subscribed'] 
                || parsed?.data?.['newsletter_subscribed']
                || parsed?.data?.['subscribed']
                || []
            
            if (newsletters.length > 0) {

                for (const ch of newsletters) {
                    if (ch.id) {
                        data[ch.id] = {
                            id: ch.id,
                            name: ch.thread_metadata?.name?.text || ch.name || 'Unknown',
                            subscribers: ch.thread_metadata?.subscribers_count || 0
                        }
                    }
                }
                break
            }
        } catch (e) {

            continue
        }
    }
    
    return data
}

async function handler(m, { sock }) {
    const db = getDatabase()
    
    if (m.isGroup) {
        const groupMode = getGroupMode(m.chat, db)
        if (groupMode !== 'md') {
            return m.reply(`❌ *ᴍᴏᴅᴇ ᴛɪᴅᴀᴋ sᴇsᴜᴀɪ*\n\n> JPM hanya tersedia di mode MD\n\n\`${m.prefix}botmode md\``)
        }
    }
    
    const text = m.fullArgs?.trim() || m.text?.trim()
    if (!text) {
        return m.reply(
            `📢 *JPM CHANNEL (JASA PESAN MASSAL)*\n\n` +
            `Sistem broadcast otomatis ke seluruh channel WhatsApp yang mensubscribe bot ini.\n\n` +
            `*PENGGUNAAN:*\n` +
            `• *${m.prefix}jpmch <pesan>* — Mengirim JPM teks ke channel\n` +
            `• *${m.prefix}jpmch (reply foto/video)* — Mengirim JPM media ke channel\n\n` +
            `*CONTOH:*\n` +
            `> \`${m.prefix}jpmch Halo semua, ikuti update terbaru kami!\``
        )
    }
    
    if (global.statusjpm) {
        return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> JPM sedang berjalan. Ketik \`${m.prefix}stopjpm\` untuk menghentikan.`)
    }
    
    m.react('📢')
    
    try {
        let mediaBuffer = null
        let mediaType = null
        const qmsg = m.quoted || m
        
        if (qmsg.isImage) {
            try {
                mediaBuffer = await qmsg.download()
                mediaType = 'image'
            } catch (e) {}
        } else if (qmsg.isVideo) {
            try {
                mediaBuffer = await qmsg.download()
                mediaType = 'video'
            } catch (e) {}
        }
        
        let channels = {}
        try {
            channels = await fetchAllSubscribedChannels(sock)
        } catch (e) {
            m.react('❌')
            return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Tidak dapat mengambil daftar channel.\n> Error: ${e.message}`)
        }
        
        const channelIds = Object.keys(channels)
        
        if (channelIds.length === 0) {
            m.react('❌')
            return m.reply(`❌ *Gomen ne~* ✦\n\n> Tidak ada channel yang ditemukan atau bot belum subscribe channel apapun~ 🥺`)
        }

        const jedaJpm = db.setting('jedaJpm') || 5000
        
        await m.reply(
            `📢 *ᴊᴘᴍ ᴄʜᴀɴɴᴇʟ*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 📝 ᴘᴇsᴀɴ: \`${text.substring(0, 50)}${text.length > 50 ? '...' : ''}\`\n` +
            `┃ 📷 ᴍᴇᴅɪᴀ: \`${mediaBuffer ? mediaType : 'Tidak'}\`\n` +
            `┃ 📺 ᴛᴀʀɢᴇᴛ: \`${channelIds.length}\` channel\n` +
            `┃ ⏱️ ᴊᴇᴅᴀ: \`${jedaJpm}ms\`\n` +
            `╰┈┈⬡\n\n` +
            `> Memulai JPM ke semua channel...`
        )
        
        global.statusjpm = true
        let successCount = 0
        let failedCount = 0
        
        for (const chId of channelIds) {
            const chName = channels[chId]?.name || chId

            if (global.stopjpm) {
                delete global.stopjpm
                delete global.statusjpm
                
                await m.reply(
                    `⏹️ *ᴊᴘᴍ ᴅɪʜᴇɴᴛɪᴋᴀɴ*\n\n` +
                    `> ✅ Berhasil: \`${successCount}\`\n` +
                    `> ❌ Gagal: \`${failedCount}\``
                )
                return
            }

            let contextInfo = {}
            try {
                contextInfo = {
                    isForwarded: true,
                    forwardingScore: 99,
                    forwardedNewsletterMessageInfo: {
                        newsletterName: config.saluran?.name || config.bot?.name,
                        newsletterJid: config.saluran?.id || '',
                    }
                }
                
            } catch (e) {}
            
            try {
                if (mediaBuffer) {
                    await sock.sendMessage(chId, {
                        [mediaType]: mediaBuffer,
                        caption: text,
                        contextInfo
                    })
                } else {
                    await sock.sendMessage(chId, { text: text, contextInfo })
                }

                successCount++
            } catch (err) {

                failedCount++
            }
            
            await new Promise(resolve => setTimeout(resolve, jedaJpm))
        }
        
        delete global.statusjpm
        
        m.react('✅')
        await m.reply(
            `✅ *ᴊᴘᴍ ᴄʜᴀɴɴᴇʟ sᴇʟᴇsᴀɪ*\n\n` +
            `╭┈┈⬡「 📊 *ʜᴀsɪʟ* 」\n` +
            `┃ ✅ ʙᴇʀʜᴀsɪʟ: \`${successCount}\`\n` +
            `┃ ❌ ɢᴀɢᴀʟ: \`${failedCount}\`\n` +
            `┃ 📊 ᴛᴏᴛᴀʟ: \`${channelIds.length}\`\n` +
            `╰┈┈⬡`
        )
        
    } catch (error) {
        delete global.statusjpm
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}