/**
✧ Name    : web
✧ Category: tools
**/

const config = require('../../config')
const { AIRich } = require('hsnai')

const pluginConfig = {
    name: 'web',
    alias: ['page', 'ui', 'interactive'],
    category: 'tools',
    description: 'Tampilkan halaman interaktif di WhatsApp (AIRich)',
    usage: '.web',
    example: '.web',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (days > 0) return `${days}d ${hours}h ${mins}m`
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`
    if (mins > 0) return `${mins}m ${secs}s`
    return `${secs}s`
}

async function getLocation(ip) {
    try {
        const res = await fetch(`http://ip-api.com/json/${ip}`)
        const data = await res.json()
        if (data.status === 'success') {
            return `${data.city}, ${data.regionName}, ${data.country}`
        }
        return null
    } catch {
        return null
    }
}

// ============================================================
// HANDLER
// ============================================================
async function handler(m, { sock }) {
    const args = m.args || []
    const mode = args[0]?.toLowerCase()
    
    // ============================================================
    // MENU UTAMA
    // ============================================================
    if (!mode) {
        const rich = new AIRich(sock)
        
        rich.addText('# 🌐 HOSHINO AI WEB', { variant: 'h1' })
        rich.addText('✨ Interactive Page', { variant: 'caption' })
        rich.addText('\nPilih menu interaktif di bawah ini:\n', { variant: 'body' })
        rich.addText('📊 • Info Bot\n📡 • Cek IP\n📱 • QR Code\n❓ • Bantuan\n', { variant: 'body' })
        rich.addText('\nKetik `.web info` atau `.web ip` dll.', { variant: 'body' })
        rich.addText('• Hoshino Ai • 2026', { variant: 'caption' })
        
        await rich.send(m.chat)
        return
    }
    
    // ============================================================
    // SUB MENU: INFO BOT
    // ============================================================
    if (mode === 'info' || mode === 'web_info') {
        const rich = new AIRich(sock)
        
        rich.addText('# 📊 INFO BOT', { variant: 'h1' })
        rich.addText('✨ Detail Bot', { variant: 'caption' })
        rich.addText(
            `\n🤖 Nama: ${config.bot?.name || 'Hoshino Ai'}\n` +
            `📦 Versi: ${config.bot?.version || '2.3.0'}\n` +
            `👨‍💻 Developer: ${config.bot?.developer || 'SeaPRST'}\n` +
            `📱 Mode: ${config.mode || 'public'}\n` +
            `⏱️ Uptime: ${formatUptime(process.uptime())}\n`,
            { variant: 'body' }
        )
        rich.addText('\nKetik `.web back` untuk kembali.', { variant: 'body' })
        rich.addText('• Hoshino Ai • 2026', { variant: 'caption' })
        
        await rich.send(m.chat)
        return
    }
    
    // ============================================================
    // SUB MENU: CEK IP
    // ============================================================
    if (mode === 'ip' || mode === 'web_ip') {
        const ip = await fetch('https://api.ipify.org?format=json')
            .then(r => r.json())
            .then(d => d.ip)
            .catch(() => 'Tidak diketahui')
        
        const location = await getLocation(ip)
        
        const rich = new AIRich(sock)
        
        rich.addText('# 📡 CEK IP', { variant: 'h1' })
        rich.addText('✨ IP Tracker', { variant: 'caption' })
        rich.addText(
            `\n🌐 *IP Publik Anda:*\n` +
            `\`${ip}\`\n\n` +
            `📍 *Lokasi:*\n` +
            `> ${location || 'Tidak diketahui'}\n`,
            { variant: 'body' }
        )
        rich.addText('\nKetik `.web back` untuk kembali.', { variant: 'body' })
        rich.addText('• Hoshino Ai • 2026', { variant: 'caption' })
        
        await rich.send(m.chat)
        return
    }
    
    // ============================================================
    // SUB MENU: QR CODE
    // ============================================================
    if (mode === 'qr' || mode === 'web_qr') {
        const qrText = args[1] || 'https://github.com/SeaPRST'
        
        const rich = new AIRich(sock)
        
        rich.addText('# 📱 QR CODE', { variant: 'h1' })
        rich.addText('✨ QR Generator', { variant: 'caption' })
        rich.addText(
            `\n🔗 *${qrText}*\n\n` +
            `> Scan QR code untuk membuka link.\n` +
            `> Gunakan kamera HP untuk scan.\n`,
            { variant: 'body' }
        )
        rich.addText('\nKetik `.web back` untuk kembali.', { variant: 'body' })
        rich.addText('• Hoshino Ai • 2026', { variant: 'caption' })
        
        await rich.send(m.chat)
        return
    }
    
    // ============================================================
    // SUB MENU: BANTUAN
    // ============================================================
    if (mode === 'help' || mode === 'web_help') {
        const rich = new AIRich(sock)
        
        rich.addText('# ❓ BANTUAN', { variant: 'h1' })
        rich.addText('✨ Cara Pakai', { variant: 'caption' })
        rich.addText(
            `\n📋 *Cara Pakai Web Interaktif:*\n\n` +
            `1️⃣ Ketik \`.web\` untuk menu utama\n` +
            `2️⃣ Pilih menu dengan \`.web <menu>\`\n\n` +
            `📌 *Menu Tersedia:*\n` +
            `> \`web info\` - Info Bot\n` +
            `> \`web ip\` - Cek IP\n` +
            `> \`web qr <link>\` - QR Code\n` +
            `> \`web help\` - Bantuan\n`,
            { variant: 'body' }
        )
        rich.addText('\nKetik `.web back` untuk kembali.', { variant: 'body' })
        rich.addText('• Hoshino Ai • 2026', { variant: 'caption' })
        
        await rich.send(m.chat)
        return
    }
    
    // ============================================================
    // KEMBALI KE MENU UTAMA
    // ============================================================
    if (mode === 'back' || mode === 'web_back') {
        const rich = new AIRich(sock)
        
        rich.addText('# 🌐 HOSHINO AI WEB', { variant: 'h1' })
        rich.addText('✨ Kembali ke menu utama', { variant: 'caption' })
        rich.addText(
            `\nPilih menu interaktif di bawah ini:\n\n` +
            `📊 • Info Bot\n` +
            `📡 • Cek IP\n` +
            `📱 • QR Code\n` +
            `❓ • Bantuan\n`,
            { variant: 'body' }
        )
        rich.addText('\nKetik `.web info` atau `.web ip` dll.', { variant: 'body' })
        rich.addText('• Hoshino Ai • 2026', { variant: 'caption' })
        
        await rich.send(m.chat)
        return
    }
    
    // ============================================================
    // FALLBACK
    // ============================================================
    await m.reply(
        `❌ *Menu tidak ditemukan*\n\n` +
        `Gunakan: \`.web info\`, \`.web ip\`, \`.web qr <link>\`, \`.web help\``
    )
}

module.exports = {
    config: pluginConfig,
    handler
}