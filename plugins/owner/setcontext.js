const config = require('../../config');
const { getDatabase } = require('../../src/lib/database');
const { generateWAMessageFromContent, proto } = require('hsnai');

const pluginConfig = {
    name: 'setcontext',
    alias: ['contextvariant', 'contextstyle'],
    category: 'owner',
    description: 'Mengatur variant context tampilan pesan game/rpg bot',
    usage: '.setcontext <v1/v2/v3>',
    example: '.setcontext v1',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
};

const VARIANTS = {
    v1: { id: 1, name: 'Standard',         desc: 'externalAdReply + newsletter channel (hsnai-games.jpg)', emoji: '🖼️' },
    v2: { id: 2, name: 'Document Premium', desc: 'Document + jpegThumbnail 300x300 + contactMessage quoted (hsnai-games.jpg)', emoji: '📄' },
    v3: { id: 3, name: 'Link Preview',      desc: 'Preview link saluran + thumbnail kecil (renderLargerThumbnail: false)',           emoji: '🔗' },
};

async function handler(m, { sock, db }) {
    const args = m.args || [];
    const variant = args[0]?.toLowerCase();

    if (variant) {
        const selected = VARIANTS[variant];
        if (!selected) {
            await m.reply(`❌ Variant tidak valid!\n\nGunakan: v1, v2, atau v3`);
            return;
        }

        db.setting('contextVariant', selected.id);

        await m.reply(
            `✅ *ᴄᴏɴᴛᴇxᴛ ᴠᴀʀɪᴀɴᴛ ᴅɪᴜʙᴀʜ*\n\n` +
            `> ${selected.emoji} *V${selected.id} — ${selected.name}*\n` +
            `> _${selected.desc}_`
        );
        return;
    }

    const current = db.setting('contextVariant') || config.ui?.contextVariant || 1;

    const rows = Object.entries(VARIANTS).map(([key, val]) => ({
        title: `${val.emoji} ${key.toUpperCase()}${val.id === current ? ' ✓' : ''} — ${val.name}`,
        description: val.desc,
        id: `${m.prefix}setcontext ${key}`
    }));

    const bodyText =
        `🎨 *sᴇᴛ ᴄᴏɴᴛᴇxᴛ ᴠᴀʀɪᴀɴᴛ*\n\n` +
        `> Variant aktif: *V${current}*\n` +
        `> _${VARIANTS[`v${current}`]?.name || 'Unknown'}_\n\n` +
        `> Pilih variant dari daftar di bawah`;

    try {
        const interactiveButtons = [
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: '🎨 ᴘɪʟɪʜ ᴠᴀʀɪᴀɴᴛ',
                    sections: [{
                        title: 'ᴅᴀꜰᴛᴀʀ ᴠᴀʀɪᴀɴᴛ ᴄᴏɴᴛᴇxᴛ',
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
                            text: config.bot?.name || 'Ourin-AI'
                        }),
                        header: proto.Message.InteractiveMessage.Header.fromObject({
                            title: '🎨 Context Variant',
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
                                newsletterJid: config.saluran?.id || '120363409928671192@newsletter',
                                newsletterName: config.saluran?.name || config.bot?.name || 'Ourin-AI',
                                serverMessageId: 127
                            }
                        }
                    })
                }
            }
        }, { userJid: m.sender, quoted: m });

        await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
    } catch {
        let txt = `🎨 *sᴇᴛ ᴄᴏɴᴛᴇxᴛ ᴠᴀʀɪᴀɴᴛ*\n\n`;
        txt += `> Variant saat ini: *V${current}*\n\n`;
        for (const [key, val] of Object.entries(VARIANTS)) {
            const mark = val.id === current ? ' ✓' : '';
            txt += `> ${val.emoji} *${key.toUpperCase()}*${mark} — _${val.desc}_\n`;
        }
        txt += `\n_Gunakan: \`${m.prefix}setcontext v1\` atau \`${m.prefix}setcontext v2\`_`;
        await m.reply(txt);
    }
}

module.exports = {
    config: pluginConfig,
    handler
};