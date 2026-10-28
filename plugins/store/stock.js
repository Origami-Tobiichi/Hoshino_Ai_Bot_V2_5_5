const hsAsset = require('../../src/lib/assets')
const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'stock',
    alias: ['addstock', 'importstock', 'liststock', 'delstock', 'clearstock', 'stockinfo'],
    category: 'store',
    description: 'Kelola stock items produk',
    usage: '.addstock <no>|<detail> | .importstock <no> (reply file) | .liststock <no>',
    example: '.addstock 1|Email: user@mail.com;;Password: pass123',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    isAdmin: true,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const groupData = db.getGroup(m.chat) || {}
    const cmd = m.command?.toLowerCase()
    
    if (groupData.botMode !== 'store') {
        return m.reply(`❌ *Nee~* Fitur ini hanya tersedia di mode *STORE*~ 🥺`)
    }
    
    const products = groupData.storeConfig?.products || []
    
    if (products.length === 0) {
        return m.reply(`❌ Belum ada produk!\n\n> Tambah dulu: \`${m.prefix}addproduct\``)
    }
    
    if (cmd === 'stock' || cmd === 'stockinfo') {
        const path = require('path')
        const fs = require('fs')

        let txt = `📦 *sᴛᴏᴄᴋ ɪɴꜰᴏ*\n\n`
        
        products.forEach((p, i) => {
            const stockItems = p.stockItems || []
            const hasItems = stockItems.length > 0
            const icon = hasItems ? '✅' : '⚠️'
            txt += `${icon} *${i + 1}.* ${p.name}\n`
            txt += `   📦 Items: ${stockItems.length}\n`
            txt += `   💰 Rp ${p.price.toLocaleString('id-ID')}\n\n`
        })
        
        txt += `━━━━━━━━━━━━━━━\n`
        txt += `> Pilih aksi di bawah`
        
        const stockRows = products.map((p, i) => ({
            title: `${i + 1}. ${p.name}`,
            description: `${p.stockItems?.length || 0} items tersedia`,
            id: `${m.prefix}liststock ${i + 1}`
        }))
        
        const interactiveButtons = [
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: '📋 ʟɪʜᴀᴛ sᴛᴏᴄᴋ',
                    sections: [{
                        title: 'ᴘɪʟɪʜ ᴘʀᴏᴅᴜᴋ',
                        rows: stockRows
                    }]
                })
            },
            {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: '🛒 ᴅᴀꜰᴛᴀʀ ᴘʀᴏᴅᴜᴋ',
                    id: `${m.prefix}products`
                })
            }
        ]
        
        let thumbnail = null
        if (hsAsset.has('images/hsnai-store')) {
            thumbnail = (await hsAsset.buffer('images/hsnai-store'))
        }
        
        return sock.sendMessage(m.chat, {
            text: txt,
            contextInfo: thumbnail ? {
            } : undefined,
            interactiveButtons
        }, { quoted: m })
    }
    
    if (cmd === 'addstock') {
        const text = m.text?.trim() || ''
        const parts = text.split('|')
        
        if (parts.length < 2) {
            return m.reply(
                `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
                `> \`${m.prefix}addstock <no_produk>|<detail>\`\n\n` +
                `*ᴄᴏɴᴛᴏʜ:*\n` +
                `> \`${m.prefix}addstock 1|Email: user@mail.com;;Password: pass123\`\n\n` +
                `> Gunakan ;; untuk baris baru`
            )
        }
        
        const productNo = parseInt(parts[0].trim()) - 1
        const detail = parts.slice(1).join('|').trim().replace(/;;/g, '\n')
        
        if (isNaN(productNo) || productNo < 0 || productNo >= products.length) {
            return m.reply(`❌ *Ehh~* Nomor produk tidak valid! (1-${products.length})~ 🥺`)
        }
        
        if (!detail || detail.length < 3) {
            return m.reply(`❌ *Ehh~* Detail minimal 3 karakter~ 🥺`)
        }
        
        const product = products[productNo]
        
        if (!product.stockItems) {
            product.stockItems = []
        }
        
        const isDuplicate = product.stockItems.some(item => item.detail === detail)
        if (isDuplicate) {
            return m.reply(`❌ *Ehh~* Detail sudah ada di stock~ 🥺`)
        }
        
        product.stockItems.push({
            id: Date.now(),
            detail,
            addedAt: new Date().toISOString()
        })
        
        product.stock = product.stockItems.length
        
        db.setGroup(m.chat, groupData)
        db.save()
        
        m.react('✅')
        return m.reply(
            `✅ *sᴛᴏᴄᴋ ᴅɪᴛᴀᴍʙᴀʜ*\n\n` +
            `> Produk: *${product.name}*\n` +
            `> Total Stock: *${product.stockItems.length}* items`
        )
    }
    
    if (cmd === 'importstock') {
        const productNo = parseInt(m.text?.trim()) - 1
        
        if (isNaN(productNo) || productNo < 0 || productNo >= products.length) {
            return m.reply(
                `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
                `> \`${m.prefix}importstock <no_produk>\`\n` +
                `> Reply file .txt dengan format:\n\n` +
                `\`\`\`\n` +
                `Email: user1@mail.com;;Password: pass1\n` +
                `Email: user2@mail.com;;Password: pass2\n` +
                `...\n` +
                `\`\`\`\n\n` +
                `> Setiap baris = 1 stock item\n` +
                `> Gunakan ;; untuk newline dalam item`
            )
        }
        
        if (!m.quoted) {
            return m.reply(`❌ *Ehh~* Reply file .txt yang berisi stock items~ 🥺`)
        }
        
        const quotedType = m.quoted.type || m.quoted.mtype
        const isDocument = quotedType === 'documentMessage' || quotedType === 'documentWithCaptionMessage'
        
        if (!isDocument) {
            return m.reply(`❌ Reply file .txt!\n\n> Kirim file sebagai dokumen, bukan gambar/video`)
        }
        
        const fileName = m.quoted.fileName || m.quoted.message?.documentMessage?.fileName || ''
        if (!fileName.toLowerCase().endsWith('.txt')) {
            return m.reply(`❌ File harus berformat .txt!\n\n> File kamu: ${fileName || 'unknown'}`)
        }
        
        await m.reply(`🕕 *ᴍᴇᴍᴘʀᴏsᴇs ꜰɪʟᴇ...*`)
        
        let fileBuffer
        try {
            fileBuffer = await m.quoted.download()
        } catch (e) {
            return m.reply(`❌ *Gomen ne~* Gagal download file: ${e.message} 🥺`)
        }
        
        if (!fileBuffer || fileBuffer.length === 0) {
            return m.reply(`❌ *Gomen ne~* File kosong atau gagal dibaca~ 🥺`)
        }
        
        const fileContent = fileBuffer.toString('utf-8')
        const lines = fileContent.split('\n').map(l => l.trim()).filter(l => l.length > 0)
        
        if (lines.length === 0) {
            return m.reply(`❌ *Ehh~* File tidak berisi data yang valid~ 🥺`)
        }
        
        if (lines.length > 1000) {
            return m.reply(`❌ Maksimal 1000 items per import!\n\n> File kamu: ${lines.length} baris`)
        }
        
        const product = products[productNo]
        
        if (!product.stockItems) {
            product.stockItems = []
        }
        
        const existingDetails = new Set(product.stockItems.map(item => item.detail))
        
        let added = 0
        let skipped = 0
        let invalid = 0
        const errors = []
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            
            if (line.length < 3) {
                invalid++
                if (errors.length < 5) errors.push(`Baris ${i + 1}: terlalu pendek`)
                continue
            }
            
            const detail = line.replace(/;;/g, '\n')
            
            if (existingDetails.has(detail)) {
                skipped++
                continue
            }
            
            product.stockItems.push({
                id: Date.now() + i,
                detail,
                addedAt: new Date().toISOString()
            })
            
            existingDetails.add(detail)
            added++
        }
        
        product.stock = product.stockItems.length
        
        db.setGroup(m.chat, groupData)
        db.save()
        
        let resultTxt = `✅ *ɪᴍᴘᴏʀᴛ sᴇʟᴇsᴀɪ*\n\n`
        resultTxt += `> Produk: *${product.name}*\n`
        resultTxt += `> ✅ Ditambahkan: *${added}* items\n`
        if (skipped > 0) resultTxt += `> ⏭️ Dilewati (duplikat): *${skipped}*\n`
        if (invalid > 0) resultTxt += `> ❌ Invalid: *${invalid}*\n`
        resultTxt += `\n> Total Stock: *${product.stockItems.length}* items`
        
        if (errors.length > 0) {
            resultTxt += `\n\n*ᴇʀʀᴏʀs:*\n`
            errors.forEach(e => resultTxt += `> ${e}\n`)
        }
        
        m.react('✅')
        return m.reply(resultTxt)
    }
    
    if (cmd === 'liststock') {
        const productNo = parseInt(m.text?.trim()) - 1
        
        if (isNaN(productNo) || productNo < 0 || productNo >= products.length) {
            return m.reply(`❌ Nomor produk tidak valid!\n\n> Lihat: \`${m.prefix}stock\``)
        }
        
        const product = products[productNo]
        const stockItems = product.stockItems || []
        
        if (stockItems.length === 0) {
            return m.reply(
                `📦 *sᴛᴏᴄᴋ: ${product.name}*\n\n` +
                `> Belum ada stock items!\n\n` +
                `> Tambah: \`${m.prefix}addstock ${productNo + 1}|detail\`\n` +
                `> Import: \`${m.prefix}importstock ${productNo + 1}\` (reply .txt)`
            )
        }
        
        let txt = `📦 *sᴛᴏᴄᴋ: ${product.name}*\n\n`
        txt += `> Total: *${stockItems.length}* items\n`
        txt += `━━━━━━━━━━━━━━━\n\n`
        
        const showItems = stockItems.slice(0, 25)
        showItems.forEach((item, i) => {
            const preview = item.detail.replace(/\n/g, ' ').substring(0, 35)
            txt += `*${i + 1}.* ${preview}${item.detail.length > 35 ? '...' : ''}\n`
        })
        
        if (stockItems.length > 25) {
            txt += `\n> ... dan ${stockItems.length - 25} items lainnya`
        }
        
        txt += `\n\n━━━━━━━━━━━━━━━\n`
        txt += `> \`${m.prefix}delstock ${productNo + 1} <no>\` untuk hapus`
        
        return m.reply(txt)
    }
    
    if (cmd === 'delstock') {
        const args = m.text?.trim().split(/\s+/) || []
        const productNo = parseInt(args[0]) - 1
        const itemNo = parseInt(args[1]) - 1
        
        if (args.length < 2 || isNaN(productNo) || isNaN(itemNo)) {
            return m.reply(
                `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
                `> \`${m.prefix}delstock <no_produk> <no_item>\`\n\n` +
                `*ᴄᴏɴᴛᴏʜ:*\n` +
                `> \`${m.prefix}delstock 1 5\` (hapus item ke-5 dari produk 1)`
            )
        }
        
        if (productNo < 0 || productNo >= products.length) {
            return m.reply(`❌ *Ehh~* Nomor produk tidak valid~ 🥺`)
        }
        
        const product = products[productNo]
        const stockItems = product.stockItems || []
        
        if (itemNo < 0 || itemNo >= stockItems.length) {
            return m.reply(`❌ *Ehh~* Nomor item tidak valid! (1-${stockItems.length})~ 🥺`)
        }
        
        const deleted = stockItems.splice(itemNo, 1)[0]
        product.stock = stockItems.length
        
        db.setGroup(m.chat, groupData)
        db.save()
        
        m.react('✅')
        return m.reply(
            `🗑️ *sᴛᴏᴄᴋ ᴅɪʜᴀᴘᴜs*\n\n` +
            `> Produk: *${product.name}*\n` +
            `> Detail: ${deleted.detail.replace(/\n/g, ' ').substring(0, 50)}...\n` +
            `> Sisa Stock: *${stockItems.length}* items`
        )
    }
    
    if (cmd === 'clearstock') {
        const productNo = parseInt(m.text?.trim()) - 1
        
        if (isNaN(productNo) || productNo < 0 || productNo >= products.length) {
            return m.reply(`❌ *Ehh~* Nomor produk tidak valid~ 🥺`)
        }
        
        const product = products[productNo]
        const oldCount = product.stockItems?.length || 0
        
        product.stockItems = []
        product.stock = 0
        
        db.setGroup(m.chat, groupData)
        db.save()
        
        m.react('✅')
        return m.reply(
            `🗑️ *sᴛᴏᴄᴋ ᴅɪᴋᴏsᴏɴɢᴋᴀɴ*\n\n` +
            `> Produk: *${product.name}*\n` +
            `> Dihapus: *${oldCount}* items`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}