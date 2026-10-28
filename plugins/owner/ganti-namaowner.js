const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: 'ganti-namaowner',
    alias: ['setnamaowner', 'setnameowner'],
    category: 'owner',
    description: 'Ganti nama owner di config.js',
    usage: '.ganti-namaowner <nama baru>',
    example: '.ganti-namaowner Sea',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock, config }) {
    const newName = m.args.join(' ')
    
    if (!newName) {
        return m.reply(`👤 *ɢᴀɴᴛɪ ɴᴀᴍᴀ ᴏᴡɴᴇʀ*\n\n> Nama saat ini: *${config.owner?.name || '-'}*\n\n*Penggunaan:*\n\`${m.prefix}ganti-namaowner <nama baru>\``)
    }
    
    try {
        const configPath = path.join(process.cwd(), 'config.js')
        let configContent = fs.readFileSync(configPath, 'utf8')
        
        configContent = configContent.replace(
            /owner:\s*\{[\s\S]*?name:\s*['"]([^'"]*)['"]/,
            (match, oldName) => match.replace(`'${oldName}'`, `'${newName}'`).replace(`"${oldName}"`, `'${newName}'`)
        )
        
        fs.writeFileSync(configPath, configContent)
        
        config.owner.name = newName
        
        m.reply(`✅ *ʙᴇʀʜᴀsɪʟ*\n\n> Nama owner diganti ke: *${newName}*`)
        
    } catch (error) {
        m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
