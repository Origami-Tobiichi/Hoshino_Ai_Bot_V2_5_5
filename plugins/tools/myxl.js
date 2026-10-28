const hsAsset = require('../../src/lib/assets')
const config = require('../../config')
const path = require('path')
const fs = require('fs')
const { requestOTP, verifyOTP, getQuota, getProfile, getBalance, normalizePhone } = require('../../src/scraper/myxl')

const pluginConfig = {
    name: 'myxl',
    alias: ['cekxl', 'kuotaxl', 'xlcek'],
    category: 'tools',
    description: 'Cek kuota, pulsa, dan info nomor XL via myXL',
    usage: '.myxl <nomor_xl>',
    example: '.myxl 08123456789',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 2,
    isEnabled: true
}

let thumbTools = null
hsAsset.tryBuffer('images/hsnai-games').then(b => { if (b) thumbTools = b }).catch(() => {})

const sessions = new Map()

function getContextInfo(title = '📡 *ᴍʏxʟ*', body = 'Info Kuota XL') {
    const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    const saluranName = config.saluran?.name || config.bot?.name || 'Hoshino Ai'
    const ctx = {
        forwardingScore: 9999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: saluranId,
            newsletterName: saluranName,
            serverMessageId: 127
        }
    }
    return ctx
}

function buildQuotaText(packages) {
    if (!packages || packages.length === 0) return '> Tidak ada data kuota aktif'
    let text = ''
    for (const pkg of packages) {
        text += `╭┈┈⬡「 📦 *${pkg.name}* 」\n`
        if (pkg.expiry && pkg.expiry !== '-') {
            text += `┃ 📅 Expired: ${pkg.expiry}\n`
        }
        for (const c of pkg.components) {
            const icon = c.type === 'VOICE' ? '📞' : c.type === 'SMS' ? '💬' : '📶'
            text += `┃ ${icon} ${c.label}\n`
            text += `┃    Total: ${c.quota} | Sisa: *${c.remaining}*\n`
        }
        text += `╰┈┈┈┈┈┈┈┈⬡\n\n`
    }
    return text.trim()
}

async function handler(m, { sock }) {
    const senderKey = m.sender
    const args = m.args || []
    const text = args.join(' ').trim()

    const session = sessions.get(senderKey)

    if (session?.step === 'otp') {
        const otp = text.replace(/\D/g, '')
        if (text.toLowerCase() === 'batal') {
            sessions.delete(senderKey)
            return m.reply(`✅ *Yatta~* Dibatalkan~ ✨`)
        }
        if (!otp || otp.length < 4) {
            return m.reply(`❌ *ᴏᴛᴘ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ*\n\n> Kirim 4-6 digit OTP yang diterima via SMS\n> Atau ketik 'batal' untuk membatalkan`)
        }

        await m.react('🕕')
        try {
            const { token, phone } = await verifyOTP(session.phone, otp)
            sessions.set(senderKey, { step: 'done', token, phone })

            await m.react('✅')

            const [packages, profile, balanceData] = await Promise.allSettled([
                getQuota(token, phone),
                getProfile(token, phone),
                getBalance(token, phone)
            ])

            const nama = profile.value?.name || profile.value?.customerName || 'Pelanggan XL'
            const pulsa = balanceData.value?.balance || balanceData.value?.credit || '-'
            const masaAktif = profile.value?.expiredDate || profile.value?.expDate || '-'

            const quotaText = packages.status === 'fulfilled'
                ? buildQuotaText(packages.value)
                : '> Gagal mengambil data kuota'

            const replyText =
                `📡 *ɪɴꜰᴏ ɴᴏᴍᴏʀ xʟ*\n\n` +
                `╭┈┈⬡「 👤 *ᴘʀᴏꜰɪʟ* 」\n` +
                `┃ 📱 Nomor: +${phone}\n` +
                `┃ 🏷️ Nama: ${nama}\n` +
                `┃ 💰 Pulsa: Rp ${Number(pulsa).toLocaleString('id-ID')}\n` +
                `┃ 📅 Masa Aktif: ${masaAktif}\n` +
                `╰┈┈┈┈┈┈┈┈⬡\n\n` +
                `*📶 ᴋᴜᴏᴛᴀ ᴀᴋᴛɪꜰ:*\n\n` +
                quotaText

            await sock.sendMessage(m.chat, {
                text: replyText,
                contextInfo: getContextInfo('📡 myXL Kuota', `+${phone}`)
            }, { quoted: m })

            sessions.delete(senderKey)
        } catch (e) {
            await m.react('❌')
            sessions.delete(senderKey)
            await m.reply(`❌ *Gomen ne~* ✦\n\n> ${e.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
        }
        return
    }

    if (!text) {
        return m.reply(
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> \`${m.prefix}myxl <nomor_xl>\`\n\n` +
            `> Contoh:\n` +
            `> \`${m.prefix}myxl 08123456789\`\n\n` +
            `> *Catatan:* OTP akan dikirim ke nomor XL tersebut`
        )
    }

    const phone = text.replace(/\D/g, '')
    if (phone.length < 9) {
        return m.reply(`❌ *ɴᴏᴍᴏʀ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ*\n\n> Masukkan nomor XL yang valid`)
    }

    await m.react('🕕')
    await m.reply(`🕕 *Mengirim OTP...*`)

    try {
        const result = await requestOTP(phone)
        sessions.set(senderKey, { step: 'otp', phone: result.phone, ts: Date.now() })

        setTimeout(() => {
            if (sessions.get(senderKey)?.step === 'otp') {
                sessions.delete(senderKey)
            }
        }, 5 * 60 * 1000)

        await m.react('📨')
        await sock.sendMessage(m.chat, {
            text:
                `📨 *ᴏᴛᴘ ᴛᴇʟᴀʜ ᴅɪᴋɪʀɪᴍ*\n\n` +
                `> OTP telah dikirim ke *+${result.phone}*\n` +
                `> Balas dengan kode OTP yang diterima via SMS\n\n` +
                `> ⏱️ Berlaku 5 menit\n` +
                `> Ketik \`batal\` untuk membatalkan`,
            contextInfo: getContextInfo('📡 myXL Login', `+${result.phone}`)
        }, { quoted: m })
    } catch (e) {
        await m.react('❌')
        sessions.delete(senderKey)
        await m.reply(`❌ *Gomen ne~* ✦\n\n> ${e.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}