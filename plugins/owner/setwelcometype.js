const hsAsset = require('../../src/lib/assets')
const config = require('../../config')
const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'setwelcometype',
    alias: ['welcometype', 'welcomevariant', 'welcomestyle'],
    category: 'owner',
    description: 'Mengatur variant tampilan welcome message',
    usage: '.setwelcometype',
    example: '.setwelcometype',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

const VARIANTS = {
    1: { name: 'Plain Text', desc: 'Teks welcome biasa dengan mention, tanpa gambar' },
    2: { name: 'Carousel Cards', desc: 'Kartu interaktif custom dengan tombol' },
    3: { name: 'Link Preview', desc: 'Preview link grup ala WhatsApp + fake reply kontak member baru' },
    4: { name: 'GIF + Kontak', desc: 'Video GIF welcome + fake reply kontak member baru' },
    5: { name: 'Location Card', desc: 'Pesan interaktif dengan header lokasi & foto profil member' },
    6: { name: 'Interactive Button', desc: 'Pesan interaktif dengan tombol + limited offer card' },
    7: { name: 'Canvas Image', desc: 'Gambar canvas dengan foto profil & info member baru' }
}

async function handler(m, { sock, db }) {
    const args = m.args || []
    const variant = args[0]?.toLowerCase()
    const current = db.setting('welcomeType') || 1
    
    if (variant && /^v?[1-7]$/.test(variant)) {
        const id = parseInt(variant.replace('v', ''))
        db.setting('welcomeType', id)
        await db.save()
        
        await m.reply(
            `✅ Welcome type diubah ke *V${id}*\n` +
            `*${VARIANTS[id].name}*\n` +
            `_${VARIANTS[id].desc}_`
        )
        return
    }
    
    const buttons = []
    for (const [id, val] of Object.entries(VARIANTS)) {
        const mark = parseInt(id) === current ? ' ✓' : ''
        buttons.push({
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
                display_text: `V${id}${mark} - ${val.name}`,
                id: `${m.prefix}setwelcometype v${id}`
            })
        })
    }
    const fs = require('fs')
    await sock.sendButton(m.chat, (await hsAsset.buffer('images/hsnai')), `🥗 *TIPE WELCOME*\n\nTipe saat ini adalah versi *${current}*\n_${VARIANTS[current].name}_\n\nSilahkan pilih variant welcome:`, m, { buttons })
}

module.exports = {
    config: pluginConfig,
    handler
}