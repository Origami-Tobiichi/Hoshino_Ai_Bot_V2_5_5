const { getDatabase } = require("../../src/lib/database");
const timeHelper = require("../../src/lib/timeHelper");
const { getActiveWarnings } = require("./warn");

const pluginConfig = {
  name: "listwarn",
  alias: ["warnings", "cekwarn", "warnlist"],
  category: "group",
  description: "Melihat daftar warning member",
  usage: ".listwarn atau .listwarn @user",
  example: ".listwarn @user",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  isAdmin: true,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const db = getDatabase();
  let groupData = db.getGroup(m.chat) || {};
  let warnings = groupData.warnings || {};
  const maxWarns = groupData.maxWarnings || 3;

  let targetUser = null;
  if (m.quoted) {
    targetUser = m.quoted.sender;
  } else if (m.mentionedJid && m.mentionedJid.length > 0) {
    targetUser = m.mentionedJid[0];
  }
  if (targetUser) {
    const userWarnings = getActiveWarnings(warnings[targetUser]);
    const targetName = targetUser.split("@")[0];

    if (userWarnings.length === 0) {
      await m.reply(`✅ *Yatta~* @${targetName} tidak memiliki warning~ ✨`, {
        mentions: [targetUser],
      });
      return;
    }

    let txt = `⚠️ *ᴡᴀʀɴɪɴɢ @${targetName}*\n\n`;
    txt += `> Total: *${userWarnings.length}/${maxWarns}*\n\n`;

    userWarnings.forEach((w, i) => {
      const date = timeHelper.fromTimestamp(w.time, "DD/MM/YYYY");
      txt += `*${i + 1}.* ${w.reason}\n`;
      txt += `   └ _${date}_\n`;
      if (w.evidence) txt += `   └ 💬 _"${w.evidence}"_\n`;
    });

    await m.reply(txt, { mentions: [targetUser] });
  } else {
    const usersWithWarnings = Object.keys(warnings)
      .map((u) => ({ jid: u, active: getActiveWarnings(warnings[u]) }))
      .filter((u) => u.active.length > 0);

    if (usersWithWarnings.length === 0) {
      await m.reply(`✅ *Yatta~* Tidak ada member dengan warning di grup ini~ ✨`);
      return;
    }

    let txt = `⚠️ *ᴅᴀꜰᴛᴀʀ ᴡᴀʀɴɪɴɢ*\n\n`;

    usersWithWarnings.forEach(({ jid, active }, i) => {
      const name = jid.split("@")[0];
      txt += `*${i + 1}.* @${name} - *${active.length}/${maxWarns}* warning\n`;
    });

    txt += `\n> Ketik \`${m.prefix}listwarn @user\` untuk detail`;

    await m.reply(txt, { mentions: usersWithWarnings.map((u) => u.jid) });
  }
}

module.exports = {
  config: pluginConfig,
  handler,
};