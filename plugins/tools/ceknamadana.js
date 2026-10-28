const config = require('../../config')

const pluginConfig = {
    name: 'ceknamadana',
    alias: ['cekdana'],
    category: 'tools',
    description: 'Cek Nama Pengguna Dana',
    usage: '.cekdana',
    example: '.cekdana',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 1,
    isEnabled: true
}

function isNumeric(str) {
  return !isNaN(str) && !isNaN(parseFloat(str));
}

async function handler(m, { sock }) {
    const text = m.text
    if(!text) return m.reply(`🌲 *NOTE*\n\n\`\`\`Parameter wajib diisi\`\`\`\n\n> Contoh: *${m.prefix}ceknamadana 08xxxx*`)
    if(!isNumeric(text)) return m.reply("🌿 *Hei Sobat, Hanya nomor yang di perbolehkan*")
    const Sea = text?.replace?.("62", "08")
    try {
        const axios = require("axios")
        let { data } = await axios.get('https://api.pitucode.com/cek-name-e-wallet-id-v2?bank=DANA&accountNumber='+Sea, {
      headers: {
  "x-api-key": "7C0dEefbfc1"
}
  })
        await m.reply(`🌿 *BERHASIL*\n\n- Nama dana dari nomor \`${Sea}\` adalah *${data.data.customer_name}*`)
    } catch (error) {
        console.error('Example Plugin Error:', error)
        await m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}