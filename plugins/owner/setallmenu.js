// ============================================================
// setallmenu.js — + V6 & V7
// ============================================================

const config = require('../../config')
const { getDatabase } = require('../../src/lib/database')
const { generateWAMessageFromContent, proto } = require('hsnai')

const pluginConfig = {
    name: 'setallmenu',
    alias: ['allmenuvariant', 'allmenustyle', 'setam'],
    category: 'owner',
    description: 'Mengatur variant tampilan allmenu',
    usage: '.setallmenu <v1-v7>',
    example: '.setallmenu v2',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

const VARIANTS = {
    v1: { id: 1, name: 'Simple Text',        desc: 'Teks biasa tanpa gambar, cocok untuk perangkat low-end' },
    v2: { id: 2, name: 'Image + Interactive', desc: 'viewOnce header gambar + limited_time_offer + tombol Kembali Ke Menu Utama' },
    v3: { id: 3, name: 'Video + Cuaca Quoted', desc: 'Header video (gif) + quoted lokasi cuaca real-time + limited_time_offer + bottom_sheet + tombol Kembali Ke Daftar Kategori & Menu Utama' },
    v4: { id: 4, name: 'Carousel Kategori',  desc: 'Setiap kategori jadi card carousel sendiri dengan gambar + maksimal 15 command + tombol Lihat kategori' },
    v5: { id: 5, name: 'Location + Order Quoted', desc: 'viewOnce header location (thumbnail proporsional) + fake order quoted + limited_time_offer + tombol Channel Kami, Menu Utama & Hubungi Owner' },
    v6: { id: 6, name: 'Location + Cuaca Real-time', desc: 'Header location langsung (bukan quoted) dengan cuaca real-time di address, tanpa tombol — paling minimalis' },
    v7: { id: 7, name: 'Footer sebagai isi',  desc: 'Header gambar + sapaan singkat di body, daftar command lengkap dipindah ke footer biar keliatan ringkas + tombol Kembali Ke Menu Utama' }
}

async function handler(m, { sock, db }) {
    const args = m.args || []
    const variant = args[0]?.toLowerCase()

    if (variant) {
        const selected = VARIANTS[variant]
        if (!selected) {
            await m.reply(
                `✦ *Kon-Ai~* ✦\n\n` +
                `Eeh~ \`${variant}\` bukan variant yang Ai kenal deh~ 🌸\n` +
                `Gunakan: \`v1\` s/d \`v${Object.keys(VARIANTS).length}\` ya Kak~`
            )
            return
        }

        db.setting('allMenuVariant', selected.id)
        await db.save()

        await m.reply(
            `✦ *ᴀʟʟᴍᴇɴᴜ ᴅɪᴘᴇʀʙᴀʀᴜɪ~* ✦\n\n` +
            `Yay~ Ai sudah ganti tampilan allmenu-nya! ⭐\n\n` +
            `> 📋 *V${selected.id} — ${selected.name}*\n` +
            `> _${selected.desc}_\n\n` +
            `_Semoga daftarnya makin rapi ya Kak~ 💕_`
        )
        return
    }

    const current = db.setting('allMenuVariant') || config.ui?.allMenuVariant || 2

    const rows = Object.entries(VARIANTS).map(([key, val]) => ({
        title: `${key.toUpperCase()}${val.id === current ? ' ✓' : ''} — ${val.name}`,
        description: val.desc,
        id: `${m.prefix}setallmenu ${key}`
    }))

    const bodyText =
        `✦ *sᴇᴛ ᴀʟʟᴍᴇɴᴜ ᴠᴀʀɪᴀɴᴛ* ✦\n\n` +
        `Kon-Ai~ Kak *${m.pushName}*! 🌟\n` +
        `Di sini Ai bisa atur tampilan daftar semua menu~\n\n` +
        `> Variant aktif: *V${current}*\n` +
        `> _${VARIANTS[`v${current}`]?.name || 'Unknown'}_\n\n` +
        `> Pilih variant dari daftar di bawah ya~ 💕`

    try {
        const msg = generateWAMessageFromContent(m.chat, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                    interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                        body: proto.Message.InteractiveMessage.Body.fromObject({ text: bodyText }),
                        footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: config.bot?.name || 'Hoshino Ai' }),
                        header: proto.Message.InteractiveMessage.Header.fromObject({
                            title: '📋 AllMenu Variant',
                            subtitle: `${Object.keys(VARIANTS).length} variant tersedia`,
                            hasMediaAttachment: false
                        }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                            buttons: [{
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({
                                    title: '📋 ᴘɪʟɪʜ ᴠᴀʀɪᴀɴᴛ',
                                    sections: [{ title: 'ᴅᴀꜰᴛᴀʀ ᴠᴀʀɪᴀɴᴛ ᴀʟʟᴍᴇɴᴜ', rows }]
                                })
                            }]
                        }),
                        contextInfo: {
                            mentionedJid: [m.sender],
                            forwardingScore: 9999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06',
                                newsletterName: config.saluran?.name || config.bot?.name || 'Hoshino Ai',
                                serverMessageId: 127
                            }
                        }
                    })
                }
            }
        }, { userJid: m.sender, quoted: m })

        await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    } catch {
        let txt = `✦ *sᴇᴛ ᴀʟʟᴍᴇɴᴜ ᴠᴀʀɪᴀɴᴛ* ✦\n\nKon-Ai~! 🌟 Variant aktif: *V${current}*\n\n`
        for (const [key, val] of Object.entries(VARIANTS)) {
            const mark = val.id === current ? ' ✓' : ''
            txt += `> *${key.toUpperCase()}*${mark} — _${val.desc}_\n`
        }
        txt += `\n_Gunakan: \`.setallmenu v1\` dst._`
        await m.reply(txt)
    }
}

module.exports = { config: pluginConfig, handler }