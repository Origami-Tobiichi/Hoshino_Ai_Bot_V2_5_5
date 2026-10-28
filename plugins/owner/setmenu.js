const config = require('../../config');
const { generateWAMessageFromContent, proto } = require('hsnai');

const pluginConfig = {
    name: 'setmenu',
    alias: ['menuvariant', 'menustyle'],
    category: 'owner',
    description: 'Mengatur variant tampilan menu',
    usage: '.setmenu <v1-v22>',
    example: '.setmenu v22',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
};

const VARIANTS = {
    v1:  { id: 1,  name: 'Simple',                desc: 'Gambar biasa + caption menu, tanpa contextInfo (teks biasa kalau gambar kosong)' },
    v2:  { id: 2,  name: 'Standard',              desc: 'Gambar + caption + full contextInfo + verified quoted (default)' },
    v3:  { id: 3,  name: 'Document',              desc: 'Document gambar + jpegThumbnail 300x300 + caption menu + contextInfo + verified quoted' },
    v4:  { id: 4,  name: 'Video Interactive',     desc: 'Header video (gif) + limited_time_offer + bottom_sheet Lihat Kategori + tombol saluran, kembali ke daftar kategori & menu utama + fake location quoted' },
    v5:  { id: 5,  name: 'Button',                desc: 'Gambar + info bot + single_select kategori + quick_reply Total Semua Fitur & Semua Menu' },
    v6:  { id: 6,  name: 'Document Premium',      desc: 'Document PDF + jpegThumbnail banner + caption menu + full contextInfo + verified quoted' },
    v7:  { id: 7,  name: 'Carousel',              desc: 'Kartu geser per kategori, tiap kartu ada tombol Lihat kategori' },
    v8:  { id: 8,  name: 'Minimalist',            desc: 'Gambar + caption menu simpel, quoted ala ftroli (orderMessage)' },
    v9:  { id: 9,  name: 'NativeFlow',            desc: 'Interactive gambar + limited_time_offer + bottom_sheet + select kategori + tombol Nomor Owner & Tampilkan Semua Menu' },
    v10: { id: 10, name: 'Product Catalog',       desc: 'Header productMessage (katalog) + footer info + quick_reply' },
    v11: { id: 11, name: 'Document Interactive',  desc: 'Document + limited_time_offer + bottom_sheet + select kategori + tombol Kunjungi Saluran, Owner Kami & Lihat Semua Menu' },
    v12: { id: 12, name: 'Document Quick Reply',  desc: 'Document + quick_reply per kategori (huruf mono bold) + select + Lihat Semua Menu' },
    v13: { id: 13, name: 'Canvas Profile Card',   desc: 'Kartu profil canvas 1280x560 tema Hoshino Ai + thumbnail link preview 300x300' },
    v14: { id: 14, name: 'Location Interactive',  desc: 'Header lokasi + quick_reply per kategori (huruf mono bold) + select + Lihat Semua Menu' },
    v15: { id: 15, name: 'Document Ftroli',       desc: 'Document + quoted ftroli (orderMessage) + 2 select + tombol Lihat Semua Menu & Siapa yang bikin aku? + limited_time_offer' },
    v16: { id: 16, name: 'NativeFlow Catalog',    desc: 'Header katalog produk + quoted order katalog + CTA saluran + quick_reply Lihat Semua Menu + select kategori' },
    v17: { id: 17, name: 'Buttons Location',      desc: 'buttonsMessage + header lokasi + tombol Owner, Allmenu & Buka Kategori (select)' },
    v18: { id: 18, name: 'Readmore + Category Tap', desc: 'Readmore trick + header video/gambar + select per kategori (command bisa di-tap) + Lihat Semua Menu + daftar command lengkap' },
    v19: { id: 19, name: 'Sticker + Video Combo', desc: 'Sticker fake-quoted + foto menu + video nempel via messageAssociation (ala status)' },
    v20: { id: 20, name: 'Menu Ai Rich',          desc: 'Kartu AI Rich Response (AIRich): gambar + tabel kategori + saran command + sumber' },
    v21: { id: 21, name: 'Location Button',       desc: 'Header lokasi + fake order quoted + info user + tombol Copy, Saluran & quick_reply per kategori' },
    v22: { id: 22, name: 'Idol Stage Rich HTML',  desc: 'Kartu rich HTML interaktif: avatar cincin, dialog idol, search command, accordion kategori, tap-to-copy' }
};

const MAX_VARIANT = Object.keys(VARIANTS).length;

async function handler(m, { sock, db }) {
    const args = m.args || [];
    const variant = args[0]?.toLowerCase();

    if (variant) {
        const selected = VARIANTS[variant];
        if (!selected) {
            await m.reply(
                `✦ *Kon-Ai~* ✦\n\n` +
                `Eeh~ \`${variant}\` bukan variant yang Ai kenal deh~ 🌸\n` +
                `Gunakan: \`v1\` s/d \`v${MAX_VARIANT}\` ya Kak~`
            );
            return;
        }

        db.setting('menuVariant', selected.id);
        await db.save();

        await m.reply(
            `✦ *ᴍᴇɴᴜ ᴅɪᴘᴇʀʙᴀʀᴜɪ~* ✦\n\n` +
            `Yay~ Ai sudah ganti tampilan menu-nya! ⭐\n\n` +
            `> 🎨 *V${selected.id} — ${selected.name}*\n` +
            `> _${selected.desc}_\n\n` +
            `_Semoga menunya makin cantik ya Kak~ 💕_`
        );
        return;
    }

    const current = db.setting('menuVariant') || config.ui?.menuVariant || 2;

    const rows = Object.entries(VARIANTS).map(([key, val]) => ({
        title: `${key.toUpperCase()}${val.id === current ? ' ✓' : ''} — ${val.name}`,
        description: val.desc,
        id: `${m.prefix}setmenu ${key}`
    }));

    const bodyText =
        `✦ *sᴇᴛ ᴍᴇɴᴜ ᴠᴀʀɪᴀɴᴛ* ✦\n\n` +
        `Kon-Ai~ Kak *${m.pushName}*! 🌟\n` +
        `Di sini Ai bisa atur tampilan menu bot-nya~\n\n` +
        `> Variant aktif: *V${current}*\n` +
        `> _${VARIANTS[`v${current}`]?.name || 'Unknown'}_\n\n` +
        `> Pilih variant dari daftar di bawah ya~ 💕`;

    try {
        const interactiveButtons = [
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: '🎨 ᴘɪʟɪʜ ᴠᴀʀɪᴀɴᴛ',
                    sections: [{
                        title: 'ᴅᴀꜰᴛᴀʀ ᴠᴀʀɪᴀɴᴛ ᴍᴇɴᴜ',
                        rows
                    }]
                })
            }
        ];

        const msg = generateWAMessageFromContent(m.chat, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2
                    },
                    interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                        body: proto.Message.InteractiveMessage.Body.fromObject({
                            text: bodyText
                        }),
                        footer: proto.Message.InteractiveMessage.Footer.fromObject({
                            text: config.bot?.name || 'Hoshino Ai'
                        }),
                        header: proto.Message.InteractiveMessage.Header.fromObject({
                            title: '🎨 Menu Variant',
                            subtitle: `${MAX_VARIANT} variant tersedia`,
                            hasMediaAttachment: false
                        }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                            buttons: interactiveButtons
                        }),
                        contextInfo: {
                            mentionedJid: [m.sender],
                            forwardingScore: 9999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: config.saluran?.id || '120363409928671192@newsletter',
                                newsletterName: config.saluran?.name || config.bot?.name || 'Hoshino Ai',
                                serverMessageId: 127
                            }
                        }
                    })
                }
            }
        }, { userJid: m.sender, quoted: m });

        await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
    } catch {
        let txt = `✦ *sᴇᴛ ᴍᴇɴᴜ ᴠᴀʀɪᴀɴᴛ* ✦\n\n`;
        txt += `Kon-Ai~! 🌟 Variant aktif: *V${current}*\n\n`;
        for (const [key, val] of Object.entries(VARIANTS)) {
            const mark = val.id === current ? ' ✓' : '';
            txt += `> *${key.toUpperCase()}*${mark} — _${val.desc}_\n`;
        }
        txt += `\n_Gunakan: \`.setmenu v1\` dst._`;
        await m.reply(txt);
    }
}

module.exports = {
    config: pluginConfig,
    handler
};