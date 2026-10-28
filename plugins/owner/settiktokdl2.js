const config = require('../../config');
const { generateWAMessageFromContent, proto } = require('hsnai');

const pluginConfig = {
    name: 'settiktokdl2',
    alias: ['settt2', 'tt2variant'],
    category: 'owner',
    description: 'Mengatur variant tampilan hasil download tiktok2',
    usage: '.settiktokdl2 <v1-v2>',
    example: '.settiktokdl2 v1',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
};

const VARIANTS = {
    v1: { id: 1, name: 'Album',   desc: 'Kirim sebagai album message, gaya .pins',        emoji: '🖼️' },
    v2: { id: 2, name: 'AIRich',  desc: 'Kirim dengan tabel info lengkap (default)',       emoji: '🎀' }
};

async function handler(m, { sock, db }) {
    const args = m.args || [];
    const variant = args[0]?.toLowerCase();

    if (variant) {
        const selected = VARIANTS[variant];
        if (!selected) {
            await m.reply(
                `✦ *Kon-Ai~* ✦\n\n` +
                `Eeh~ \`${variant}\` bukan variant yang Ai kenal deh~ 🌸\n` +
                `Gunakan: \`v1\` atau \`v2\` ya Kak~`
            );
            return;
        }

        db.setting('tt2Variant', variant);

        await m.reply(
            `✦ *ᴛᴛ2 ᴠᴀʀɪᴀɴᴛ ᴅɪᴘᴇʀʙᴀʀᴜɪ~* ✦\n\n` +
            `Yay~ Ai sudah ganti gaya kirim tiktok2! ⭐\n\n` +
            `> ${selected.emoji} *${variant.toUpperCase()} — ${selected.name}*\n` +
            `> _${selected.desc}_\n\n` +
            `_Semoga makin enak dipakai ya Kak~ 💕_`
        );
        return;
    }

    const current = db.setting('tt2Variant') || 'v2';
    const currentInfo = VARIANTS[current] || VARIANTS.v2;

    const rows = Object.entries(VARIANTS).map(([key, val]) => ({
        title: `${val.emoji} ${key.toUpperCase()}${key === current ? ' ✓' : ''} — ${val.name}`,
        description: val.desc,
        id: `${m.prefix}settiktokdl2 ${key}`
    }));

    const bodyText =
        `✦ *sᴇᴛ ᴛᴛ2 ᴠᴀʀɪᴀɴᴛ* ✦\n\n` +
        `Kon-Ai~ Kak *${m.pushName}*! 🌟\n` +
        `Di sini Ai bisa atur gaya kirim hasil download tiktok2~\n\n` +
        `> Variant aktif: *${current.toUpperCase()}*\n` +
        `> ${currentInfo.emoji} _${currentInfo.name}_\n\n` +
        `> Pilih variant dari daftar di bawah ya~ 💕`;

    try {
        const interactiveButtons = [
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: '💬 ᴘɪʟɪʜ ᴠᴀʀɪᴀɴᴛ',
                    sections: [{
                        title: 'ᴅᴀꜰᴛᴀʀ ᴠᴀʀɪᴀɴᴛ ᴛᴛ2',
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
                            title: '💬 TT2 Variant',
                            subtitle: `${Object.keys(VARIANTS).length} variant tersedia`,
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
                                newsletterJid: config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06',
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
        let txt = `✦ *sᴇᴛ ᴛᴛ2 ᴠᴀʀɪᴀɴᴛ* ✦\n\n`;
        txt += `Kon-Ai~! 🌟 Variant aktif: *${current.toUpperCase()}*\n\n`;
        for (const [key, val] of Object.entries(VARIANTS)) {
            const mark = key === current ? ' ✓' : '';
            txt += `> ${val.emoji} *${key.toUpperCase()}*${mark} — _${val.desc}_\n`;
        }
        txt += `\n_Gunakan: \`.settiktokdl2 v1\` atau \`.settiktokdl2 v2\`_`;
        await m.reply(txt);
    }
}

module.exports = {
    config: pluginConfig,
    handler
};