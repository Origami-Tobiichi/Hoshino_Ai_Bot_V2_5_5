// ============================================================
// PLUGIN: templateplugin
// Fungsi: generate boilerplate/template buat bikin plugin baru
// Owner only, cukup ketik .templateplugin buat dapetin template-nya
// ============================================================

const config = require('../../config')
const { extendSocket } = require('../../src/lib/sockHelper.js')

const pluginConfig = {
    name: 'templateplugin',
    alias: ['tplplugin', 'plugin-template', 'tpp'],
    category: 'owner',
    description: 'Generate plugin template (Owner Only)',
    usage: '.templateplugin',
    example: '.templateplugin',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 0,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    // Gate paling awal: hanya owner yang boleh menggunakan command
    if (!config.isOwner(m.sender)) {
        return m.reply(
            `🎤 *ʙᴀᴄᴋsᴛᴀɢᴇ ᴏɴʟʏ~*\n\n` +
            `> Maaf yaa, ruang ganti ini khusus staff Ai doang~ 🎀\n` +
            `> Bukan buat penonton~ ✨`
        )
    }

    // Pastikan sendCodehsn tersedia
    if (typeof sock.sendCodehsn !== 'function') {
        extendSocket(sock)
    }

    // ============================================================
    // TEMPLATE PLUGIN
    // ============================================================
    const template = `/**
✧ Name    : example
✧ Category: general
**/

// require dependency yang dibutuhin plugin ini.
// config wajib di-require kalau butuh akses ke isOwner(), prefix, dll
const config = require('../../config')

// pluginConfig = metadata plugin, dipakai handler.js buat registrasi command
const pluginConfig = {
    name: 'example',           // nama internal plugin (unik)
    alias: ['ex'],             // alias/command tambahan
    category: 'general',       // kategori menu/help
    description: 'Example plugin',
    usage: '.example <args>',  // format penggunaan
    example: '.example halo',  // contoh penggunaan
    isOwner: false,            // true kalau hanya owner
    isPremium: false,          // true kalau butuh premium
    isGroup: false,            // true kalau hanya grup
    isPrivate: false,          // true kalau hanya private
    cooldown: 3,               // cooldown dalam detik
    energi: 1,                 // biaya energi
    isEnabled: true             // status plugin
}

// handler = fungsi utama plugin
// m     = objek pesan
// sock  = instance socket Baileys
async function handler(m, { sock }) {
    // Ambil teks argumen setelah command
    const text = m.text?.trim()

    // Kalau tidak ada argumen
    if (!text) {
        return m.reply(
            '📦 *ᴇxᴀᴍᴘʟᴇ ᴘʟᴜɢɪɴ* 🎤\\\\n\\\\n' +
            '> Ai butuh input dulu dong~ ✨\\\\n\\\\n' +
            '> \${m.prefix}example <args>\\\\n\\\\n' +
            '*ᴄᴏɴᴛᴏʜ:*\\\\n' +
            '> \${m.prefix}example halo'
        )
    }

    // Reaksi processing
    await m.react('🕕')

    try {
        // ============================
        // TARUH LOGIC UTAMA DI SINI
        // ============================

        await m.react('✅')

        return m.reply(
            '✅ *ʙᴇʀʜᴀsɪʟ~* 🎤✨\\\\n\\\\n' +
            '> Nih, Ai udah proses: \${text}'
        )
    } catch (error) {
        // Log error untuk debugging
        console.error('[example] Error:', error)

        await m.react('❌')

        return m.reply(
            '❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ*\\\\n\\\\n' +
            '> \${error.message}\\\\n\\\\n' +
            '> Coba lagi ya, Ai janji next take bakal lebih bagus~'
        )
    }
}

// Wajib export config dan handler
module.exports = {
    config: pluginConfig,
    handler
}
`

    // ============================================================
    // KIRIM TEMPLATE DENGAN sendCodehsn
    // ============================================================
    return sock.sendCodehsn(
        m.chat,
        template,
        'javascript',
        m,
        {
            header: '📦 ᴘʟᴜɢɪɴ ᴛᴇᴍᴘʟᴀᴛᴇ 🎤',
            footer:
                `🎀 ᴘᴇsᴀɴ ᴅᴀʀɪ ᴀɪ\n\n` +
                `> Copy-paste terus rename sesuai kebutuhan\n` +
                `> Jangan lupa ganti name, alias, category ya\n` +
                `> Ganbatte bikin plugin barunya! ⭐`
        }
    )
}

module.exports = {
    config: pluginConfig,
    handler
}