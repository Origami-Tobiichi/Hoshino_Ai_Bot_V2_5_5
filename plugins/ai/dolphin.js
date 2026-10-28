const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: 'dolphin',
    alias: ['dolphinai', 'dphn'],
    category: 'ai',
    description: 'Chat dengan Dolphin AI (24B Model)',
    usage: '.dolphin <pertanyaan> atau .dolphin --<template> <pertanyaan>',
    example: '.dolphin jelaskan tentang AI',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const TEMPLATES = ['logical', 'creative', 'summarize', 'code-beginner', 'code-advanced']

async function dolphinAI(question, template = 'logical') {
    const { data } = await axios.post('https://chat.dphn.ai/api/chat', {
        messages: [{
            role: 'user',
            content: question
        }],
        model: 'dolphinserver:24B',
        template: template
    }, {
        headers: {
            origin: 'https://chat.dphn.ai',
            referer: 'https://chat.dphn.ai/',
            'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
        }
    })
    
    const result = data.split('\n\n')
        .filter(line => line && line.startsWith('data: {'))
        .map(line => JSON.parse(line.substring(6)))
        .map(line => line.choices[0].delta.content)
        .join('')
    
    if (!result) throw new Error('Tidak ada respon dari AI')
    
    return result
}

async function handler(m, { sock }) {
    let text = m.text?.trim()
    
    if (!text) {
        return m.reply(
            `🐬 *ᴅᴏʟᴘʜɪɴ ᴀɪ*\n\n` +
            `Haii~ Ai kenalin Dolphin AI 24B! Pilih template & tulis pertanyaannya ya~ 🌸\n\n` +
            `╭┈┈⬡「 📋 *ᴛᴇᴍᴘʟᴀᴛᴇs* 」\n` +
            `┃ • \`logical\` - Jawaban logis\n` +
            `┃ • \`creative\` - Jawaban kreatif\n` +
            `┃ • \`summarize\` - Ringkasan\n` +
            `┃ • \`code-beginner\` - Kode pemula\n` +
            `┃ • \`code-advanced\` - Kode lanjutan\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> *Contoh:*\n` +
            `> ${m.prefix}dolphin apa itu AI?\n` +
            `> ${m.prefix}dolphin --creative buat puisi`
        )
    }
    
    let template = 'logical'
    
    const templateMatch = text.match(/^--(\S+)\s+/)
    if (templateMatch) {
        const requestedTemplate = templateMatch[1].toLowerCase()
        if (TEMPLATES.includes(requestedTemplate)) {
            template = requestedTemplate
            text = text.replace(templateMatch[0], '').trim()
        }
    }
    
    if (!text) {
        return m.reply(`🐬 *ᴅᴏʟᴘʜɪɴ ᴀɪ*\n\nEhh~ pertanyaannya belum ada nih! Tulis dulu ya~ 🌸`)
    }
    
    await m.react('🕕')
    
    try {
        const result = await dolphinAI(text, template)
        let reply = `🐬 *ᴅᴏʟᴘʜɪɴ ᴀɪ*\n\n`
        reply += `> Template: *${template}*\n\n`
        reply += `${result}`
        
        await m.reply(reply)
        
        await m.react('✅')
        
    } catch (error) {
        await m.react('❌')
        await m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
