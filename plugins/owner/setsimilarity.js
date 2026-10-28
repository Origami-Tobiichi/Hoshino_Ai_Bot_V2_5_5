const config = require('../../config');
const { getDatabase } = require('../../src/lib/database');
const { generateWAMessageFromContent, proto } = require('hsnai');

const pluginConfig = {
    name: 'setsimilarity',
    alias: ['simvariant', 'simstyle'],
    category: 'owner',
    description: 'Mengatur variant tampilan similarity (command not found)',
    usage: '.setsimilarity <v1-v6>',
    example: '.setsimilarity v6',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
};

const SIM_VARIANTS = {
    v1: { id: 1, name: 'Pesan Biasa',           desc: 'Teks idol message biasa tanpa media atau tombol', emoji: '🌟' },
    v2: { id: 2, name: 'Document Premium',       desc: 'Document + newsletter contextInfo tanpa externalAdReply', emoji: '📄' },
    v3: { id: 3, name: 'Business Card Order',    desc: 'sendBusinessCard + fake order item persen akurasi + tombol Lihat detail', emoji: '🛒' },
    v4: { id: 4, name: 'Document Reply',         desc: 'Document mimetype image/png + contactMessage quoted (seperti reply serialize v6)', emoji: '📎' },
    v5: { id: 5, name: 'Interactive Location',   desc: 'InteractiveMessage + locationMessage header + resize gambar ikut aspect ratio', emoji: '📍' },
    v6: { id: 6, name: 'Video/GIF Interactive',  desc: 'Video/GIF header + locationMessage quoted + limited_time_offer + quick_reply buttons (seperti menu v4)', emoji: '🎬' }
};

async function handler(m, { sock, db }) {
    const args = m.args || [];
    const variant = args[0]?.toLowerCase();

    if (variant) {
        const selected = SIM_VARIANTS[variant];
        if (!selected) {
            await m.reply(
                `✦ *Kon-Ai~* ✦\n\n` +
                `Eeh~ \`${variant}\` bukan variant yang Ai kenal deh~ 🌸\n` +
                `Gunakan: \`v1\` s/d \`v6\` ya Kak~`
            );
            return;
        }

        db.setting('simVariant', selected.id);
        await db.save();

        await m.reply(
            `✦ *sɪᴍɪʟᴀʀɪᴛʏ ᴅɪᴘᴇʀʙᴀʀᴜɪ~* ✦\n\n` +
            `Yay~ Ai sudah ganti tampilan similarity-nya! ⭐\n\n` +
            `> ${selected.emoji} *V${selected.id} — ${selected.name}*\n` +
            `> _${selected.desc}_\n\n` +
            `_Semoga penampilannya makin idol ya Kak~ 💕_`
        );
        return;
    }

    const current = db.setting('simVariant') || 1;
    const currentVariant = SIM_VARIANTS[`v${current}`];

    const rows = Object.entries(SIM_VARIANTS).map(([key, val]) => ({
        title: `${val.emoji} ${key.toUpperCase()}${val.id === current ? ' ✓' : ''} — ${val.name}`,
        description: val.desc,
        id: `${m.prefix}setsimilarity ${key}`
    }));

    const bodyText =
        `✦ *sᴇᴛ sɪᴍɪʟᴀʀɪᴛʏ ᴠᴀʀɪᴀɴᴛ* ✦\n\n` +
        `Kon-Ai~ Kak *${m.pushName}*! 🌟\n` +
        `Di sini Ai bisa atur tampilan pesan "Command Tidak Ditemukan"~\n\n` +
        `> Variant aktif: *V${current}*\n` +
        `> ${currentVariant?.emoji || '🌟'} _${currentVariant?.name || 'Unknown'}_\n\n` +
        `> Pilih variant dari daftar di bawah ya~ 💕`;

    try {
        const interactiveButtons = [
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: '🌟 ᴘɪʟɪʜ ᴠᴀʀɪᴀɴᴛ',
                    sections: [{
                        title: 'ᴅᴀꜰᴛᴀʀ ᴠᴀʀɪᴀɴᴛ sɪᴍɪʟᴀʀɪᴛʏ',
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
                            title: '🌟 Similarity Variant',
                            subtitle: `${Object.keys(SIM_VARIANTS).length} variant tersedia`,
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
        let txt = `✦ *sᴇᴛ sɪᴍɪʟᴀʀɪᴛʏ ᴠᴀʀɪᴀɴᴛ* ✦\n\n`;
        txt += `Kon-Ai~! 🌟 Variant aktif: *V${current}*\n\n`;
        for (const [key, val] of Object.entries(SIM_VARIANTS)) {
            const mark = val.id === current ? ' ✓' : '';
            txt += `> ${val.emoji} *${key.toUpperCase()}*${mark} — _${val.desc}_\n`;
        }
        txt += `\n_Gunakan: \`.setsimilarity v1\` s/d \`.setsimilarity v6\`_`;
        await m.reply(txt);
    }
}

module.exports = {
    config: pluginConfig,
    handler
};