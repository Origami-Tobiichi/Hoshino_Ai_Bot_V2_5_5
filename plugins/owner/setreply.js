const config = require('../../config');
const { getDatabase } = require('../../src/lib/database');
const { generateWAMessageFromContent, proto } = require('hsnai');

const pluginConfig = {
    name: 'setreply',
    alias: ['replyvariant', 'replystyle'],
    category: 'owner',
    description: 'Mengatur variant tampilan reply',
    usage: '.setreply <v1-v16>',
    example: '.setreply v10',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
};

const VARIANTS = {
    v1:  { id: 1,  name: 'Simple',          desc: 'Reply text biasa tanpa styling (default)',                          emoji: '📝' },
    v2:  { id: 2,  name: 'Image',           desc: 'Gambar hsnai.jpg sebagai header + forwarded newsletter saluran',    emoji: '🖼️' },
    v3:  { id: 3,  name: 'Link Preview',    desc: 'Link preview dengan thumbnail + forwarded newsletter saluran',      emoji: '🔗' },
    v4:  { id: 4,  name: 'GIF + Kontak',    desc: 'GIF playback + fake contact user sebagai quoted',                   emoji: '🎞️' },
    v5:  { id: 5,  name: 'FakeTroli',       desc: 'Text biasa dengan fake order (troli) sebagai quoted',               emoji: '🛒' },
    v6:  { id: 6,  name: 'Document',        desc: 'Document (fake image) + fake contact sebagai quoted',               emoji: '📄' },
    v7:  { id: 7,  name: 'Doc + Ori',       desc: 'Document (fake image) + quoted pesan asli (tanpa fake contact)',    emoji: '🌟' },
    v8:  { id: 8,  name: 'Location',        desc: 'Interactive message dengan location header',                        emoji: '📍' },
    v9:  { id: 9,  name: 'Buttons',         desc: 'Buttons message + location header + tombol Owner & Allmenu',        emoji: '🔘' },
    v10: { id: 10, name: 'Business Card',   desc: 'Business card + fake order (troli) sebagai quoted',                 emoji: '💼' },
    v11: { id: 11, name: 'Tagihan',         desc: 'Native payment request bubble (tampilan tagihan)',                  emoji: '💳' },
    v12: { id: 12, name: 'Nama Animasi',    desc: 'Link preview dengan judul animasi nama bot (loop via edit pesan)',  emoji: '🌀' },
    v13: { id: 13, name: 'Fake Katalog',    desc: 'Order message sebagai isi pesan utama, tampil seperti katalog',     emoji: '🍙' },
    v14: { id: 14, name: 'Ai Rich',         desc: 'AI Rich response dari hsnai (message_builder)',                     emoji: '⭐' },
    v15: { id: 15, name: 'Link Preview V2', desc: 'Link preview + favicon (faviconMMSMetadata) + fake contact quoted', emoji: '🌐' },
    v16: { id: 16, name: 'Product Card',    desc: 'Bot forwarded rich response + kartu produk, gambar dari SRT',       emoji: '🛍️' }
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

        db.setting('replyVariant', selected.id);

        let warningMsg = '';
        if (selected.id === 12) {
            warningMsg = `\n\n⚠ _Peringatan khusus V12: variant animasi ini kirim edit pesan berulang kali, ada kemungkinan bikin nomor bot ter-banned, kinerja panel melambat, dan spam di console._`;
        }

        // Catatan: konfirmasi ini dikirim lewat m.reply, jadi sudah ikut ter-render
        // pakai variant baru yang barusan dipilih.
        await m.reply(
            `✦ *ʀᴇᴘʟʏ ᴅɪᴘᴇʀʙᴀʀᴜɪ~* ✦\n\n` +
            `Yay~ Ai sudah ganti tampilan reply-nya! ⭐\n\n` +
            `> ${selected.emoji} *V${selected.id} — ${selected.name}*\n` +
            `> _${selected.desc}_\n\n` +
            `_Semoga balasannya makin idol ya Kak~ 💕_${warningMsg}`
        );
        return;
    }

    const current = db.setting('replyVariant') || config.ui?.replyVariant || 1;

    const rows = Object.entries(VARIANTS).map(([key, val]) => ({
        title: `${val.emoji} ${key.toUpperCase()}${val.id === current ? ' ✓' : ''} — ${val.name}`,
        description: val.desc,
        id: `${m.prefix}setreply ${key}`
    }));

    const bodyText =
        `✦ *sᴇᴛ ʀᴇᴘʟʏ ᴠᴀʀɪᴀɴᴛ* ✦\n\n` +
        `Kon-Ai~ Kak *${m.pushName}*! 🌟\n` +
        `Di sini Ai bisa atur gaya balasan pesan bot-nya~\n\n` +
        `> Variant aktif: *V${current}*\n` +
        `> ${VARIANTS[`v${current}`]?.emoji || '📝'} _${VARIANTS[`v${current}`]?.name || 'Unknown'}_\n\n` +
        `> Pilih variant dari daftar di bawah ya~ 💕`;

    try {
        const interactiveButtons = [
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: '💬 ᴘɪʟɪʜ ᴠᴀʀɪᴀɴᴛ',
                    sections: [{
                        title: 'ᴅᴀꜰᴛᴀʀ ᴠᴀʀɪᴀɴᴛ ʀᴇᴘʟʏ',
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
                            title: '💬 Reply Variant',
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
                                newsletterJid: config.saluran?.id || 'https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o',
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
        let txt = `✦ *sᴇᴛ ʀᴇᴘʟʏ ᴠᴀʀɪᴀɴᴛ* ✦\n\n`;
        txt += `Kon-Ai~! 🌟 Variant aktif: *V${current}*\n\n`;
        for (const [key, val] of Object.entries(VARIANTS)) {
            const mark = val.id === current ? ' ✓' : '';
            txt += `> ${val.emoji} *${key.toUpperCase()}*${mark} — _${val.desc}_\n`;
        }
        txt += `\n_Gunakan: \`.setreply v1\` s/d \`.setreply v${MAX_VARIANT}\`_`;
        await m.reply(txt);
    }
}

module.exports = {
    config: pluginConfig,
    handler
};