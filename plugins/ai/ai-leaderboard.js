const axios = require('axios')
const cheerio = require('cheerio')
const config = require('../../config')

const pluginConfig = {
    name: 'ai-leaderboard',
    alias: ['aileaderboard', 'aiboard', 'ailb', 'lmarena'],
    category: 'ai',
    description: 'Lihat leaderboard AI model terbaik dari LMArena',
    usage: '.ai-leaderboard [category]',
    example: '.ai-leaderboard text',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function getAILeaderboard() {
    const { data: html } = await axios.get('https://lmarena.ai/id/leaderboard', {
        headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' 
        }
    })
    
    const $ = cheerio.load(html)
    
    const leaderboards = {}

    $('div.my-7 > div.w-full').each((_, element) => {
        const categoryTitle = $(element).find('h2.font-heading').text().trim()
        if (!categoryTitle) return

        const models = []
        $(element).find('table tbody tr').each((_, row) => {
            const rank = $(row).find('td:nth-of-type(1)').text().trim()
            const modelName = $(row).find('td:nth-of-type(2) a > span').text().trim()
            const scoreText = $(row).find('td:nth-of-type(3) > span').first().text().trim()
            const votesText = $(row).find('td:nth-of-type(4)').text().trim()

            if (rank && modelName && scoreText && votesText) {
                models.push({
                    rank: parseInt(rank, 10),
                    model: modelName,
                    score: parseInt(scoreText.replace(/,/g, ''), 10),
                    votes: parseInt(votesText.replace(/,/g, ''), 10)
                })
            }
        })
        
        if (models.length > 0) {
            leaderboards[categoryTitle] = models
        }
    })

    return leaderboards
}

async function handler(m, { sock }) {
    const category = m.text?.trim()?.toLowerCase()
    
    await m.react('🕕')
    
    try {
        const leaderboards = await getAILeaderboard()
        const categories = Object.keys(leaderboards)
        
        if (categories.length === 0) {
            await m.react('❌')
            return m.reply('❌ *Ara ara~*\n\n> Ai gagal ngambil data leaderboard-nya nih... coba lagi nanti ya~ 🥺')
        }
        
        const saluranId = config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
        const saluranName = config.saluran?.name || config.bot?.name || 'Hoshino Ai'
        
        if (!category) {
            let text = `🤖 *ᴀɪ ʟᴇᴀᴅᴇʀʙᴏᴀʀᴅ*\n\n`
            text += `> Ai udah rangkumin datanya dari LMArena.ai~ 🌸\n\n`
            
            for (const cat of categories) {
                const topModels = leaderboards[cat].slice(0, 3)
                const emoji = cat.includes('Text') ? '📝' : 
                              cat.includes('Vision') ? '👁️' : 
                              cat.includes('Image') ? '🖼️' :
                              cat.includes('Video') ? '🎬' :
                              cat.includes('Search') ? '🔍' :
                              cat.includes('Web') ? '🌐' : '🤖'
                
                text += `╭┈┈⬡「 ${emoji} *${cat.toUpperCase()}* 」\n`
                for (const m of topModels) {
                    const medal = m.rank === 1 ? '🥇' : m.rank === 2 ? '🥈' : '🥉'
                    text += `┃ ${medal} ${m.model}\n`
                    text += `┃    Score: ${m.score.toLocaleString()} | Votes: ${m.votes.toLocaleString()}\n`
                }
                text += `╰┈┈┈┈┈┈┈┈⬡\n\n`
            }
            
            text += `> *Lihat kategori spesifik:*\n`
            text += `> ${m.prefix}ai-leaderboard <category>\n\n`
            text += `> *Kategori:* ${categories.join(', ')}`
            
            await sock.sendMessage(m.chat, {
                text,
                contextInfo: {
                    forwardingScore: 9999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: saluranId,
                        newsletterName: saluranName,
                        serverMessageId: 127
                    }
                }
            }, { quoted: m })
            
        } else {
            const matchedCat = categories.find(c => c.toLowerCase().includes(category))
            
            if (!matchedCat) {
                await m.react('❌')
                return m.reply(`❌ *Ehh~ kategorinya nggak ketemu!*\n\n> *Kategori tersedia:*\n> ${categories.join(', ')}\n\n_Pilih salah satu di atas ya~ 🌸_`)
            }
            
            const models = leaderboards[matchedCat].slice(0, 10)
            
            let text = `🤖 *ᴀɪ ʟᴇᴀᴅᴇʀʙᴏᴀʀᴅ - ${matchedCat.toUpperCase()}*\n\n`
            text += `> Top 10 AI Models pilihan Ai~ ⭐\n\n`
            
            text += `╭┈┈⬡「 📊 *ʀᴀɴᴋɪɴɢ* 」\n`
            for (const m of models) {
                const medal = m.rank === 1 ? '🥇' : m.rank === 2 ? '🥈' : m.rank === 3 ? '🥉' : `#${m.rank}`
                text += `┃\n`
                text += `┃ ${medal} \`${m.model}\`\n`
                text += `┃ ├ Score: *${m.score.toLocaleString()}*\n`
                text += `┃ └ Votes: *${m.votes.toLocaleString()}*\n`
            }
            text += `╰┈┈┈┈┈┈┈┈⬡\n\n`
            
            await m.reply(text)
        }
        
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
