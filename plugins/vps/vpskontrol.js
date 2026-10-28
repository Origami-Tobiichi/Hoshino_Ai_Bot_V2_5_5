const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: ['turnon', 'turnoff', 'restartvps', 'rebootvps'],
    alias: [],
    category: 'vps',
    description: 'Kontrol VPS (on/off/restart)',
    usage: '.turnon <id>',
    example: '.turnon 123456789',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

function hasAccess(sender, isOwner) {
    if (isOwner) return true
    const cleanSender = sender?.split('@')[0]
    if (!cleanSender) return false
    const doConfig = config.digitalocean || {}
    return (doConfig.sellers || []).includes(cleanSender) || 
           (doConfig.ownerPanels || []).includes(cleanSender)
}

async function handler(m, { sock }) {
    const token = config.digitalocean?.token
    
    if (!token) {
        return m.reply(`⚠️ *ᴅɪɢɪᴛᴀʟᴏᴄᴇᴀɴ ʙᴇʟᴜᴍ ᴅɪsᴇᴛᴜᴘ*`)
    }
    
    if (!hasAccess(m.sender, m.isOwner)) {
        return m.reply(`❌ *ᴀᴋsᴇs ᴅɪᴛᴏʟᴀᴋ*\n\n> Nee~ kamu belum punya akses buat ini ya~ 🌸`)
    }
    
    const dropletId = m.text?.trim()
    if (!dropletId) {
        return m.reply(`⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n> \`${m.prefix}${m.command} <droplet_id>\``)
    }
    
    const actions = {
        'turnon': { type: 'power_on', emoji: '🟢', text: 'menghidupkan' },
        'turnoff': { type: 'power_off', emoji: '🔴', text: 'mematikan' },
        'restartvps': { type: 'reboot', emoji: '🔄', text: 'merestart' },
        'rebootvps': { type: 'reboot', emoji: '🔄', text: 'merestart' }
    }
    
    const action = actions[m.command]
    if (!action) {
        return m.reply(`❌ *Ehh~* Aksi tidak dikenali~ 🥺`)
    }
    
    await m.reply(`${action.emoji} *sᴇᴅᴀɴɢ ${action.text.toUpperCase()} ᴠᴘs...*\n\n> ID: \`${dropletId}\``)
    
    try {
        const response = await axios.post(
            `https://api.digitalocean.com/v2/droplets/${dropletId}/actions`,
            { type: action.type },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            }
        )
        
        const actionResult = response.data.action
        
        m.react('✅')
        await m.reply(`✅ *ᴀᴋsɪ ʙᴇʀʜᴀsɪʟ*\n\n> ${action.emoji} VPS sedang di-${action.text}\n> Status: ${actionResult.status}`)
        
    } catch (err) {
        const errMsg = err?.response?.data?.message || err.message
        return m.reply(`❌ *Gomen ne~* ✦\n\n> ${errMsg}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
