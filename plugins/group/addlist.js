const { getDatabase } = require('../../src/lib/database')
const GL = require('../../src/lib/listWar')
const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: 'addlist',
    alias: ['tambahlist', 'newlist'],
    category: 'group',
    description: 'Tambah list/command store baru (support gambar)',
    usage: '.addlist <nama> (reply pesan/gambar)',
    example: '.addlist freefire',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

const STORE_IMAGES_DIR = './data/store-images'

async function groupAdd(m) {
    if (!m.isAdmin && !m.isOwner) {
        return m.reply(`❌ Hanya *admin* yang dapat menambah / menghapus list`)
    }
    const raw = (m.body || '').replace(/^\S+\s*/, '')
    let name, content
    if (raw.includes('|')) {
        const i = raw.indexOf('|')
        name = GL.norm(raw.slice(0, i))
        content = raw.slice(i + 1).trim()
    } else if (m.quoted && raw.trim()) {
        name = GL.norm(raw)
        content = (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()
    }
    if (!name || !content) {
        return m.reply(
            `📋 *ᴀᴅᴅ ʟɪsᴛ ɢʀᴜᴘ*\n\n` +
            `> Format: \`${m.prefix}addlist <nama> | <isi list>\`\n` +
            `> Atau reply teks list lalu \`${m.prefix}addlist <nama>\`\n\n` +
            `Contoh:\n` +
            `${m.prefix}addlist war m1 | 〔list war m1〕\n` +
            `s1 :\ns2 :\ns3 :\ns4 :\n\n` +
            `> Nanti kalau ada yang ketik *war*, bot langsung kirim listnya`
        )
    }
    if (name.length > 40) return m.reply(`❌ Nama list maksimal 40 karakter`)
    const lists = GL.getLists(m.chat)
    if (!lists[name] && Object.keys(lists).length >= GL.MAX_LISTS) {
        return m.reply(`❌ Maksimal ${GL.MAX_LISTS} list per grup`)
    }
    lists[name] = {
        name,
        content,
        createdBy: m.sender,
        createdAt: lists[name]?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }
    await GL.saveLists(m.chat, lists)
    m.react('✅')
    return m.reply(
        `${name} sudah ditambahkan ke daftar list\n\nKetik *list* untuk melihat daftar list.` +
        (GL.isEnabled(m.chat) ? '' : `\n\n> Trigger list belum aktif, ketik *${m.prefix}listwar on* biar bot bales tanpa prefix`)
    )
}

async function handler(m, { sock }) {
    if (m.isGroup) return groupAdd(m)
    if (!m.isOwner) return m.reply(`❌ Fitur ini khusus owner di private chat~ 🥺`)
    const db = getDatabase()
    const listName = m.args[0]?.toLowerCase().trim()
    
    if (!listName) {
        return m.reply(
            `📦 *ᴀᴅᴅ ʟɪsᴛ sᴛᴏʀᴇ*\n\n` +
            `> Reply pesan teks atau gambar+caption\n` +
            `> Lalu ketik: \`${m.prefix}addlist <nama>\`\n\n` +
            `\`Contoh: ${m.prefix}addlist freefire\`\n\n` +
            `> 📷 Support gambar! Reply gambar dengan caption untuk pricelist`
        )
    }
    
    if (!/^[a-z0-9]+$/.test(listName)) {
        return m.reply(`❌ *Nee~* Nama list hanya boleh huruf dan angka tanpa spasi~ 🥺`)
    }
    
    if (listName.length < 2 || listName.length > 20) {
        return m.reply(`❌ *Ehh~* Nama list minimal 2 karakter, maksimal 20 karakter~ 🥺`)
    }
    
    const quoted = m.quoted
    if (!quoted) {
        return m.reply(`❌ Reply pesan yang berisi deskripsi/pricelist!\n\n> Bisa reply teks atau gambar+caption`)
    }
    
    let content = quoted.text || quoted.body || quoted.caption || ''
    let imageBuffer = null
    let imagePath = null
    
    const isQuotedImage = quoted.isImage || (quoted.message?.imageMessage)
    
    if (isQuotedImage && quoted.download) {
        try {
            imageBuffer = await quoted.download()
            
            if (!fs.existsSync(STORE_IMAGES_DIR)) {
                fs.mkdirSync(STORE_IMAGES_DIR, { recursive: true })
            }
            
            imagePath = path.join(STORE_IMAGES_DIR, `${listName}.jpg`)
            fs.writeFileSync(imagePath, imageBuffer)
            
            if (quoted.message?.imageMessage?.caption) {
                content = quoted.message.imageMessage.caption
            }
        } catch (e) {
            console.error('[AddList] Error downloading image:', e.message)
        }
    }
    
    if (!content || content.length < 5) {
        if (!imageBuffer) {
            return m.reply(`❌ Konten list terlalu pendek atau tidak ada!\n\n> Minimal 5 karakter untuk teks\n> Atau reply gambar dengan caption`)
        }
        content = `Lihat gambar untuk detail pricelist ${listName.toUpperCase()}`
    }
    
    const storeData = db.setting('storeList') || {}
    
    if (storeData[listName]) {
        if (storeData[listName].imagePath && fs.existsSync(storeData[listName].imagePath)) {
            fs.unlinkSync(storeData[listName].imagePath)
        }
    }
    
    storeData[listName] = {
        content: content,
        imagePath: imagePath,
        hasImage: !!imageBuffer,
        createdBy: m.sender,
        createdByName: m.pushName || 'Owner',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        views: storeData[listName]?.views || 0
    }
    
    db.setting('storeList', storeData)
    
    m.react('✅')
    
    let replyText = `✅ *ʟɪsᴛ ᴅɪᴛᴀᴍʙᴀʜᴋᴀɴ*\n\n` +
        `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
        `┃ 🏷️ ɴᴀᴍᴀ: \`${listName}\`\n` +
        `┃ 📝 ᴄᴏᴍᴍᴀɴᴅ: \`${m.prefix}${listName}\`\n` +
        `┃ 📷 ɢᴀᴍʙᴀʀ: \`${imageBuffer ? 'Ya ✅' : 'Tidak'}\`\n` +
        `╰┈┈⬡\n\n` +
        `> User bisa akses dengan \`${m.prefix}${listName}\``
    
    if (imageBuffer) {
        await sock.sendMessage(m.chat, {
            image: imageBuffer,
            caption: replyText
        }, { quoted: m })
    } else {
        await m.reply(replyText)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
