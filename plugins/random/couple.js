const config = require('../../config');
const { downloadMediaMessage } = require('hsnai');
const fs = require('fs');
const { default: axios } = require('axios');

const pluginConfig = {
    name: 'ppcouple',
    alias: ['cp'],
    category: 'random',
    description: 'Menjodohkan dua member grup secara random',
    usage: '.ppcouple',
    isGroup: true,
    isBotAdmin: false,
    isAdmin: false,
    cooldown: 10,
    energi: 2,
    isEnabled: true
};

async function handler(m, { sock }) {
   try {
        const res = await axios.get(`https://api.deline.web.id/random/ppcouple`)
        const data = res.data.result
        const cowo = data.cowo
        const cewe = data.cewe
        await sock.sendMessage(m.chat, {
            albumMessage: [
                {
                    image: { url: cowo },
                },
                {
                    image: { url: cewe },
                }
            ]
        }, { quoted: m })
   } catch (error) {
    m.reply(`❌ *ᴇʀʀᴏʀ*

> ${error.message}`)
   }
}

module.exports = {
    config: pluginConfig,
    handler
};
