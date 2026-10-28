const config = require("../../config");
const timeHelper = require("../../src/lib/timeHelper");
const { generateWAMessageFromContent, proto } = require("hsnai");

const pluginConfig = {
  name: "cekidgc",
  alias: ["idgc", "idgrup", "groupid"],
  category: "group",
  description: "Cek ID grup dari link atau grup saat ini",
  usage: ".cekidgc [link grup]",
  example: ".cekidgc https://chat.whatsapp.com/xxxxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  await m.react("📋");

  try {
    const input = m.text?.trim();
    let groupJid = null;
    let groupMeta = null;

    if (input && input.includes("chat.whatsapp.com/")) {
      const inviteCode = input
        .split("chat.whatsapp.com/")[1]
        ?.split(/[\s?]/)[0];

      if (!inviteCode) {
        m.react("❌");
        return m.reply(`❌ *Gomen ne~* ✦\n\n> Link grup tidak valid~ 🥺`);
      }

      try {
        groupMeta = await sock.groupGetInviteInfo(inviteCode);
        groupJid = groupMeta?.id;
      } catch (e) {
        m.react("❌");
        return m.reply(
          `❌ *Gomen ne~* ✦\n\n> Link grup tidak valid atau sudah expired~ 🥺`,
        );
      }
    } else if (input && input.endsWith("@g.us")) {
      groupJid = input;
      try {
        groupMeta = await sock.groupMetadata(groupJid);
      } catch (e) {
        m.react("❌");
        return m.reply(`❌ *Gomen ne~* ✦\n\n> Tidak bisa mengakses grup tersebut~ 🥺`);
      }
    } else if (m.isGroup) {
      groupJid = m.chat;
      groupMeta = await sock.groupMetadata(groupJid);
    } else {
      return m.reply(
        `📋 *ᴄᴇᴋ ɪᴅ ɢʀᴜᴘ*\n\n` +
          `> Gunakan di grup atau masukkan link grup\n\n` +
          `Contoh:\n` +
          `\`${m.prefix}cekidgc\` - di dalam grup\n` +
          `\`${m.prefix}cekidgc https://chat.whatsapp.com/xxx\``,
      );
    }

    if (!groupMeta || !groupJid) {
      m.react("❌");
      return m.reply(`❌ *Gomen ne~* ✦\n\n> Tidak dapat menemukan info grup~ 🥺`);
    }

    const groupName = groupMeta?.subject || "Unknown";
    const memberCount = groupMeta?.participants?.length || groupMeta?.size || 0;
    const createdAt = groupMeta?.creation
      ? timeHelper.fromTimestamp(groupMeta.creation * 1000, "D MMMM YYYY")
      : "-";
    const groupOwner = groupMeta?.owner || groupMeta?.subjectOwner || "-";

    const saluranId = config.saluran?.id || "https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06";
    const saluranName = config.saluran?.name || config.bot?.name || "Ourin-AI";

    const text =
      `📋 *ɢʀᴏᴜᴘ ɪɴꜰᴏ*\n\n` +
      `╭┈┈⬡「 🏠 *ᴅᴇᴛᴀɪʟ* 」\n` +
      `┃ 📛 Nama: *${groupName}*\n` +
      `┃ 🆔 ID: \`${groupJid}\`\n` +
      `┃ 👥 Member: *${memberCount}*\n` +
      `┃ 📅 Dibuat: *${createdAt}*\n` +
      `╰┈┈┈┈┈┈┈┈⬡`;

    const buttons = [
      {
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "📋 Copy ID Grup",
          copy_code: groupJid,
        }),
      },
    ];

    const msg = generateWAMessageFromContent(
      m.chat,
      {
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2,
            },
            interactiveMessage: proto.Message.InteractiveMessage.fromObject({
              body: proto.Message.InteractiveMessage.Body.fromObject({
                text: text,
              }),
              footer: proto.Message.InteractiveMessage.Footer.fromObject({
                text: `© ${config.bot?.name || "Ourin-AI"}`,
              }),
              nativeFlowMessage:
                proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                  buttons: buttons,
                }),
              contextInfo: {
                mentionedJid: [m.sender],
                forwardingScore: 9999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                  newsletterJid: saluranId,
                  newsletterName: saluranName,
                  serverMessageId: 127,
                },
              },
            }),
          },
        },
      },
      { userJid: m.sender, quoted: m },
    );

    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
    await m.react("✅");
  } catch (error) {
    await m.react("❌");
    await m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`);
  }
}

module.exports = {
  config: pluginConfig,
  handler,
};
