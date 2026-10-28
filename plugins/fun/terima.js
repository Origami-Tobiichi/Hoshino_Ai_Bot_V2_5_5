const hsAsset = require('../../src/lib/assets')
const { getDatabase } = require("../../src/lib/database");
const timeHelper = require("../../src/lib/timeHelper");
const config = require("../../config");
const path = require("path");
const fs = require("fs");

const pluginConfig = {
  name: "terima",
  alias: ["accept", "yes"],
  category: "fun",
  description: "Menerima tembakan dari seseorang",
  usage: ".terima @tag",
  example: ".terima @628xxx",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

let thumbFun = null;
hsAsset.tryBuffer('images/hsnai-games').then(b => { if (b) thumbFun = b }).catch(() => {});

const celebrationQuotes = [
  "Semoga langgeng sampai ke pelaminan! 💍",
  "Dari teman jadi cinta, indahnya! 💕",
  "Love is in the air! 💖",
  "Couple goals detected! 💑",
  "Jangan lupa undang pas nikah ya! 💒",
  "Selamat menempuh hidup berduaan! 🥰",
  "Chemistry-nya kuat banget! 🔥",
  "Match made in heaven! ✨",
];

function getContextInfo(title = "💕 *ᴛᴇʀɪᴍᴀ*", body = "Love accepted!") {
  const saluranId = config.saluran?.id || "https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06";
  const saluranName = config.saluran?.name || config.bot?.name || "Ourin-AI";

  const contextInfo = {
    forwardingScore: 9999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: saluranId,
      newsletterName: saluranName,
      serverMessageId: 127,
    },
  };


  return contextInfo;
}

async function handler(m, { sock }) {
  const db = getDatabase();

  let shooterJid = null;

  if (m.quoted) {
    shooterJid = m.quoted.sender;
  } else if (m.mentionedJid?.[0]) {
    shooterJid = m.mentionedJid[0];
  }

  if (!shooterJid) {
    const sessions = global.tembakSessions || {};
    const mySession = Object.entries(sessions).find(
      ([key, val]) => val.target === m.sender && val.chat === m.chat,
    );

    if (mySession) {
      shooterJid = mySession[1].shooter;
    }
  }

  if (!shooterJid) {
    return m.reply(
      `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
        `> Reply pesan tembakan + \`${m.prefix}terima\`\n` +
        `> Atau \`${m.prefix}terima @tag\``,
    );
  }

  if (shooterJid === m.sender) {
    return m.reply(`❌ *Gomen ne~* ✦\n\n> Tidak bisa menerima diri sendiri~ 🥺`);
  }

  if (shooterJid === m.botNumber) {
    return m.reply(`❌ *Gomen ne~* ✦\n\n> Bot tidak bisa pacaran~ 🥺`);
  }

  let shooterData = db.getUser(shooterJid) || {};
  let myData = db.getUser(m.sender) || {};

  if (!shooterData.fun) shooterData.fun = {};
  if (!myData.fun) myData.fun = {};

  if (shooterData.fun.pasangan !== m.sender && shooterData.fun.tembakTarget !== m.sender) {
    return m.reply(
      `❌ *ᴛɪᴅᴀᴋ ᴍᴇɴᴇᴍʙᴀᴋ*\n\n` +
        `> @${shooterJid.split("@")[0]} tidak sedang menembakmu`,
      { mentions: [shooterJid] },
    );
  }

  shooterData.fun.pasangan = m.sender;
  shooterData.fun.jadiPacar = Date.now();
  delete shooterData.fun.tembakTarget;
  myData.fun.pasangan = shooterJid;
  myData.fun.jadiPacar = Date.now();

  if (!shooterData.fun.terimaCount) shooterData.fun.terimaCount = 0;
  shooterData.fun.terimaCount++;

  db.setUser(shooterJid, shooterData);
  db.setUser(m.sender, myData);

  const sessionKey = `${m.chat}_${m.sender}`;
  if (global.tembakSessions?.[sessionKey]) {
    delete global.tembakSessions[sessionKey];
  }

  const quote =
    celebrationQuotes[Math.floor(Math.random() * celebrationQuotes.length)];
  const dateStr = timeHelper.formatFull("dddd, DD MMMM YYYY");

  await m.react("💕");
  const ctx = getContextInfo("💕 *ᴊᴀᴅɪᴀɴ*", "Selamat!");
  ctx.mentionedJid = [m.sender, shooterJid];

  await m.reply(`💕 *WIDIHHHH, CIE CIE DITERIMA* @${shooterJid.split('@')[0]}\n\n` +
                `@${m.sender.split('@')[0]} dan @${shooterJid.split('@')[0]} resmi pacaran\n\n` +
                `Semoga langgeng dan bahagia 💍`, { mentions: [m.sender, shooterJid] })
}

module.exports = {
  config: pluginConfig,
  handler,
};