// ✦━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━✦
// 🌟 Hoshino Ai - Top Chat Leaderboard
// ✦━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━✦

const { getDatabase } = require('../../src/lib/database')
const { createCanvas, loadImage } = require('@napi-rs/canvas')

const pluginConfig = {
    name: 'topchat',
    alias: ['chatstat', 'chatstats', 'totalchat', 'leaderboard'],
    category: 'group',
    description: 'Lihat statistik chat member di grup ala idol ✨',
    usage: '.topchat',
    example: '.topchat',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const group = db.getGroup(m.chat) || {}
    const chatStats = group.chatStats || {}

    const sorted = Object.entries(chatStats)
        .map(([jid, data]) => ({
            jid,
            count: data.count || 0,
            lastChat: data.lastChat || 0
        }))
        .sort((a, b) => b.count - a.count)

    if (sorted.length === 0) {
        return m.reply(`📊 *ᴄʜᴀᴛ sᴛᴀᴛɪsᴛɪᴄs*\n\n> Belum ada data chat.`)
    }

    const metadata = await sock.groupMetadata(m.chat)

    // =========================
    // 🔥 CANVAS ULTRA++ IDOL STAGE
    // =========================
    const topCanvas = sorted.slice(0, 3)

    const width = 900
    const height = 520
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')

    // 🌌 Background (Galaxy Idol Stage)
    const bg = ctx.createLinearGradient(0, 0, width, height)
    bg.addColorStop(0, '#0f0c29')
    bg.addColorStop(0.5, '#302b63')
    bg.addColorStop(1, '#ff4da6')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)

    // ✨ Stars
    for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random()})`
        ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2)
    }

    // 🎤 Stage Light Glow
    const spotlight = ctx.createRadialGradient(width/2, 180, 50, width/2, 180, 300)
    spotlight.addColorStop(0, 'rgba(255,255,255,0.25)')
    spotlight.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = spotlight
    ctx.fillRect(0, 0, width, height)

    ctx.textAlign = 'center'

    // Title
    ctx.font = 'bold 50px Sans'
    ctx.fillStyle = '#ffffff'
    ctx.fillText('✨ TOP IDOL CHAT ✨', width / 2, 70)

    const positions = [
        { x: width / 2, y: 210, size: 95 },
        { x: width / 2 - 240, y: 290, size: 75 },
        { x: width / 2 + 240, y: 290, size: 75 }
    ]

    for (let i = 0; i < topCanvas.length; i++) {
        const user = topCanvas[i]

        // ✅ Nama untuk canvas → pushName fallback ala PTV
        let name = m.pushName || user.jid.split('@')[0]
        try {
            const tmpName = await sock.getName(user.jid)
            if (tmpName && tmpName !== 'Unknown') name = tmpName
            else {
                const participant = metadata.participants.find(p => p.id === user.jid)
                if (participant?.name) name = participant.name
                else if (participant?.notify) name = participant.notify
            }
        } catch {
            // tetap pushName fallback
        }

        const pos = positions[i]

        let pp
        try { pp = await sock.profilePictureUrl(user.jid, 'image') } 
        catch { pp = 'https://i.ibb.co/2Wz4w0C/avatar.png' }

        let img
        try { img = await loadImage(pp) } 
        catch { img = null }

        // 🌟 Aura Glow (rank 1 lebih kuat)
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, pos.size + (i === 0 ? 25 : 15), 0, Math.PI * 2)
        ctx.fillStyle = i === 0 ? 'rgba(255,215,0,0.25)' : 'rgba(255,255,255,0.15)'
        ctx.fill()

        // 🔵 Neon Ring
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, pos.size + 5, 0, Math.PI * 2)
        ctx.strokeStyle = i === 0 ? '#ffd700' : '#00eaff'
        ctx.lineWidth = 4
        ctx.stroke()

        // 🖼️ Circle Clip
        ctx.save()
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, pos.size, 0, Math.PI * 2)
        ctx.closePath()
        ctx.clip()
        if (img) ctx.drawImage(img, pos.x - pos.size, pos.y - pos.size, pos.size * 2, pos.size * 2)
        ctx.restore()

        // 👑 Crown rank 1
        if (i === 0) { ctx.font = '42px Sans'; ctx.fillText('👑', pos.x, pos.y - pos.size - 20) }

        // Nama di canvas
        ctx.font = 'bold 26px Sans'
        ctx.fillStyle = '#ffffff'
        ctx.fillText(name.slice(0, 12), pos.x, pos.y + pos.size + 35)

        // Count
        ctx.font = '22px Sans'
        ctx.fillStyle = '#ffe066'
        ctx.fillText(`${user.count} msg`, pos.x, pos.y + pos.size + 65)
    }

    const buffer = canvas.toBuffer('image/png')

    // =========================
    // 🌸 CAPTION HOSHINO AI STYLE (tetap tag)
    // =========================
    let txt = `✨ *Hoshino Ai Idol Chat Ranking* ✨

💫 "Semua orang di sini bersinar... tapi hanya beberapa yang jadi bintang utama~"

┏━〔 🌟 *TOP MEMBER* 🌟 〕━┓
`

    for (let i = 0; i < sorted.length; i++) {
        const { jid, count } = sorted[i]
        const medal = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '✨'
        txt += `┃ ${medal} @${jid.split('@')[0]}\n┃    💬 ${count.toLocaleString('id-ID')} pesan\n`
    }

    txt += `┗━━━━━━━━━━━━━━━━━━━┛

🎤 *Total Interaksi:* ${sorted.reduce((a, b) => a + b.count, 0).toLocaleString('id-ID')} pesan

💖 Teruslah bersinar seperti idol favoritmu~
🌙 Sampai jumpa di puncak berikutnya! ✨
`

    const mentions = sorted.map(u => u.jid)

    // 🔥 MESSAGE 1 (Canvas + caption)
    await sock.sendMessage(m.chat, { image: buffer, caption: txt, mentions }, { quoted: m })

    // =========================
    // 🔥 POLL (pushName fallback ala PTV)
    // =========================
    let topFive = sorted.slice(0, 5)
    if (topFive.length === 1) topFive.push({ jid: "0@s.whatsapp.net", count: 0 })

    const pollVotes = await Promise.all(topFive.map(async (u) => {
        let name = m.pushName || u.jid.split('@')[0]
        try {
            const tmpName = await sock.getName(u.jid)
            if (tmpName && tmpName !== 'Unknown') name = tmpName
            else {
                const participant = metadata.participants.find(p => p.id === u.jid)
                if (participant?.name) name = participant.name
                else if (participant?.notify) name = participant.notify
            }
        } catch {}
        return { optionName: name, optionVoteCount: u.count.toString() }
    }))

    await sock.relayMessage(m.chat, {
        pollResultSnapshotMessage: {
            name: "TOP CHAT MEMBER",
            pollVotes,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterName: "TOP CHAT MEMBER",
                    newsletterJid: "https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06"
                }
            },
        }
    }, { messageId: m.key.id, quoted: m })
}

// =========================
// AUTO COUNT (ASLI)
// =========================
function incrementChatCount(chatId, senderJid, db) {
    if (!chatId || !senderJid) return
    const group = db.getGroup(chatId) || {}
    if (!group.chatStats) group.chatStats = {}
    if (!group.chatStats[senderJid]) group.chatStats[senderJid] = { count: 0, lastChat: 0 }
    group.chatStats[senderJid].count++
    group.chatStats[senderJid].lastChat = Date.now()
    db.setGroup(chatId, group)
}

module.exports = {
    config: pluginConfig,
    handler,
    incrementChatCount
}