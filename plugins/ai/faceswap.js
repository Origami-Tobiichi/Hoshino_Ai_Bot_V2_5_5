const hsAsset = require('../../src/lib/assets')
const axios = require('axios')
const FormData = require('form-data')
const config = require('../../config')
const { downloadMediaMessage } = require('hsnai')
const path = require('path')
const fs = require('fs')
const { f } = require('../../src/lib/undici')

const NEOXR_APIKEY = config.APIkey?.neoxr || 'Milik-Bot-OurinMD'

const pluginConfig = {
    name: 'faceswap',
    alias: ['fs', 'swapface'],
    category: 'ai',
    description: 'Tukar wajah dari 2 gambar',
    usage: '.faceswap (kirim/reply 2 gambar)',
    example: '.faceswap',
    cooldown: 30,
    energi: 2,
    isEnabled: true
}

const faceswapSessions = new Map()

let thumbAI = null
hsAsset.tryBuffer('images/hsnai-ai').then(b => { if (b) thumbAI = b }).catch(() => {})

function getContextInfo(title, body) {
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

async function uploadToTmpFiles(buffer, filename) {
    const form = new FormData()
    form.append('file', buffer, { filename, contentType: 'application/octet-stream' })
    
    const res = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
        headers: form.getHeaders(),
        timeout: 30000
    })
    
    if (!res.data?.data?.url) throw new Error('Upload gagal')
    return res.data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
}

async function handler(m, { sock }) {
    const session = faceswapSessions.get(m.sender)
    
    let imageBuffer = null
    
    if (m.quoted?.message) {
        const quotedType = Object.keys(m.quoted.message)[0]
        if (quotedType === 'imageMessage' || m.quoted.message?.imageMessage) {
            try {
                imageBuffer = await downloadMediaMessage(
                    { key: m.quoted.key, message: m.quoted.message },
                    'buffer',
                    {}
                )
            } catch {}
        }
    }
    
    if (!imageBuffer && m.message) {
        const msgType = Object.keys(m.message)[0]
        if (msgType === 'imageMessage' || m.message?.imageMessage) {
            try {
                imageBuffer = await m.download()
            } catch {}
        }
    }
    
    if (!session) {
        if (!imageBuffer) {
            return m.reply(
                `🔄 *ꜰᴀᴄᴇsᴡᴀᴘ*\n\n` +
                `Kyaa~ Ai bantu tukar wajah dari 2 gambar ya! Ikutin langkah ini~ 🌸\n\n` +
                `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
                `┃ 1. Kirim gambar pertama (wajah sumber)\n` +
                `┃ 2. Kirim gambar kedua (target)\n` +
                `╰┈┈┈┈┈┈┈┈⬡\n\n` +
                `> Kirim gambar pertama + caption \`${m.prefix}faceswap\` ya~ Ai tunggu! 🌸`
            )
        }
        
        await m.react('1️⃣')
        
        const sourceUrl = await uploadToTmpFiles(imageBuffer, 'source.jpg')
        
        faceswapSessions.set(m.sender, {
            sourceUrl,
            timestamp: Date.now()
        })
        
        setTimeout(() => {
            faceswapSessions.delete(m.sender)
        }, 300000)
        
        return m.reply(
            `✅ *ɢᴀᴍʙᴀʀ 1 ᴅɪsɪᴍᴘᴀɴ* 🌸\n\n` +
            `> Yatta~ gambar pertama udah Ai simpan! Sekarang kirim gambar kedua (target)\n` +
            `> dengan caption \`${m.prefix}faceswap\`\n\n` +
            `> ⏱️ Session berlaku 5 menit ya~`
        )
    }
    
    if (!imageBuffer) {
        return m.reply(
            `⚠️ *ᴋɪʀɪᴍ ɢᴀᴍʙᴀʀ ᴋᴇᴅᴜᴀ*\n\n` +
            `> Ehh~ gambar keduanya belum ada nih! Kirim gambar kedua (target) + caption \`${m.prefix}faceswap\` ya~ 🌸`
        )
    }
    
    await m.react('2️⃣')
    
    try {
        const targetUrl = await uploadToTmpFiles(imageBuffer, 'target.jpg')
        
        await m.reply('🔄 *ᴍᴇᴍᴘʀᴏsᴇs...*\n\n> Ai lagi tukar wajahnya~ tunggu sebentar ya! ✨')
        
        const apiUrl = `https://api.neoxr.eu/api/faceswap?source=${encodeURIComponent(session.sourceUrl)}&target=${encodeURIComponent(targetUrl)}&apikey=${NEOXR_APIKEY}`
        
        const data = await f(apiUrl)
        
        faceswapSessions.delete(m.sender)
        
        if (!data?.status || !data?.data?.url) {
            m.react('❌')
            return m.reply('❌ *Gomen ne~* ✦\n\n> API-nya nggak merespon atau error nih...\n\n_Coba lagi nanti ya~ 🌸_')
        }
        
        await sock.sendMedia(m.chat, data.data.url, null, m, {
            type: 'image'
        })
        
        m.react('✅')
        
    } catch (error) {
        faceswapSessions.delete(m.sender)
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}