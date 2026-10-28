/**
 * ✧ lib/underDev.js
 * ✧ Dipanggil dari handler.js pas plugin yang lagi ditandain otak-atik
 *   kena akses dari user biasa (bukan owner).
 *
 * SENGAJA gak nampilin nama file plugin ke user biasa — itu cuma
 * boleh keliatan sama owner lewat command .otakatik. Di sini cukup
 * kasih tau kalau fiturnya lagi digarap Tim HsnAi™.
 */

async function underDev(m) {
    await m.react('🚧')

    return m.reply(
        `🚧 *ғɪᴛᴜʀ ᴍᴀsɪʜ ᴅᴀʟᴀᴍ ᴏᴛᴀᴋ-ᴀᴛɪᴋ* 🎤\n\n` +
        `╭┈┈⬡「 🔧 sᴛᴀᴛᴜs ᴘʟᴜɢɪɴ 」\n` +
        `┃ Fitur ini masih digarap\n` +
        `┃ sama Tim HsnAi™ di\n` +
        `┃ belakang layar~\n` +
        `┃ Belum stabil, jadi untuk\n` +
        `┃ sementara belum bisa dipakai\n` +
        `╰┈┈┈┈┈┈┈┈⬡\n\n` +
        `> Sabar yaa, Tim HsnAi™ lagi\n` +
        `> latihan biar next take\n` +
        `> makin oke~ ⭐`
    )
}

module.exports = underDev