const config = require('../../config');
const { generateWAMessageFromContent, proto } = require('hsnai');
const { getDatabase } = require('../../src/lib/database');

const pluginConfig = {
    name: 'settop',
    alias: ['topvariant', 'topstyle'],
    category: 'group',
    description: 'Mengatur variant tampilan top 5',
    usage: '.settop <classic|table>',
    example: '.settop table',
    isOwner: true,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    isAdmin: true,
    isBotAdmin: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
};

const TOP_VARIANTS = {
    classic: { id: 'classic', name: 'Classic', desc: 'Teks biasa + mention member' },
    table:   { id: 'table',   name: 'Table',   desc: 'sendTablehsn + nama member' }
};

async function handler(m, { sock }) {
    const db = getDatabase();
    const args = m.args || [];
    const variant = args[0]?.toLowerCase();

    if (variant) {
        const selected = TOP_VARIANTS[variant];
        if (!selected) {
            await m.reply(
                `✦ *Kon-Ai~* ✦\n\n` +
                `Eeh~ \`${variant}\` bukan variant yang Ai kenal deh~ 🌸\n` +
                `Gunakan: \`classic\` atau \`table\` ya Kak~`
            );
            return;
        }

        db.setGroup(m.chat, { topVariant: selected.id });
        db.save();

        await m.reply(
            `✦ *ᴛᴏᴘ ᴅɪᴘᴇʀʙᴀʀᴜɪ~* ✦\n\n` +
            `Yay~ Ai sudah ganti tampilan top-nya! ⭐\n\n` +
            `> 🎨 *${selected.name}*\n` +
            `> _${selected.desc}_\n\n` +
            `_Semoga tampilannya makin cantik ya Kak~ 💕_`
        );
        return;
    }

    const groupData = db.getGroup(m.chat);
    const current = groupData?.topVariant || 'classic';

    const rows = Object.entries(TOP_VARIANTS).map(([key, val]) => ({
        title: `${key.toUpperCase()}${val.id === current ? ' ✓' : ''} — ${val.name}`,
        description: val.desc,
        id: `${m.prefix}settop ${key}`
    }));

    const bodyText =
        `✦ *sᴇᴛ ᴛᴏᴘ ᴠᴀʀɪᴀɴᴛ* ✦\n\n` +
        `Kon-Ai~ Kak *${m.pushName}*! 🌟\n` +
        `Di sini Ai bisa atur tampilan top 5-nya~\n\n` +
        `> Variant aktif: *${current.toUpperCase()}*\n` +
        `> _${TOP_VARIANTS[current]?.desc || '-'}_\n\n` +
        `> Pilih variant dari daftar di bawah ya~ 💕`;

    try {
        const interactiveButtons = [
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: '🎨 ᴘɪʟɪʜ ᴠᴀʀɪᴀɴᴛ',
                    sections: [{
                        title: 'ᴅᴀꜰᴛᴀʀ ᴠᴀʀɪᴀɴᴛ ᴛᴏᴘ',
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
                            title: '🎨 Top Variant',
                            subtitle: `${Object.keys(TOP_VARIANTS).length} variant tersedia`,
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
        let txt = `✦ *sᴇᴛ ᴛᴏᴘ ᴠᴀʀɪᴀɴᴛ* ✦\n\n`;
        txt += `Kon-Ai~! 🌟 Variant aktif: *${current.toUpperCase()}*\n\n`;
        for (const [key, val] of Object.entries(TOP_VARIANTS)) {
            const mark = val.id === current ? ' ✓' : '';
            txt += `> *${key.toUpperCase()}*${mark} — _${val.desc}_\n`;
        }
        txt += `\n_Gunakan: \`.settop classic\` atau \`.settop table\`_`;
        await m.reply(txt);
    }
}

module.exports = {
    config: pluginConfig,
    handler
};