const axios = require('axios')
const fs = require('fs')
const path = require('path')
const { f } = require('../../src/lib/undici')

const pluginConfig = {
    name: 'asupan',
    alias: ['asupanrandom'],
    category: 'asupan',
    description: 'Random video asupan',
    usage: '.asupan',
    example: '.asupan',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

function loadJsonData() {
    const tiktokDir = path.join(process.cwd(), 'src', 'tiktok')
    const files = ['gheayubi.json', 'kayes.json', 'notnot.json', 'panrika.json', 'santuy.json', 'tiktokgirl.json', 'ukhty.json']
    let allUrls = []
    
    for (const file of files) {
        try {
            const filePath = path.join(tiktokDir, file)
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
                allUrls = allUrls.concat(data.map(d => d.url))
            }
        } catch {}
    }
    
    return allUrls
}

async function handler(m, { sock }) {
    m.react('🕕')
    
    try {
        const urls = loadJsonData()
        
        if (urls.length === 0) {
            m.react('❌')
            return m.reply(`❌ *Ehh~* Data asupan tidak tersedia~ 🥺`)
        }
        
        const url = urls[Math.floor(Math.random() * urls.length)]
        
        const res = await f(url, 'arrayBuffer')
        
        m.react('✅')
        
        await sock.sendMedia(m.chat, Buffer.from(res), null, m, {
            type: 'video'
        })
        
    } catch (error) {
        m.react('❌')
        m.reply(`❌ *Gomen ne~* ✦\n\n> Video asupan tidak ditemukan~ 🥺`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
