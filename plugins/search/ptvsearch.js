const axios = require("axios");
const crypto = require("crypto");
const {
  generateWAMessage,
  generateWAMessageFromContent,
  jidNormalizedUser,
} = require("hsnai");
const config = require("../../config");

const pluginConfig = {
  name: "ptvsearch",
  alias: ["ptvs"],
  category: "search",
  description: "Cari video TikTok",
  usage: ".ptvsearch <query>",
  example: ".ptvsearch jj epep",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 15,
  energi: 1,
  isEnabled: true,
};

async function tiktokSearchVideo(query) {
  try {
    const res = await axios.get(
      `https://labs.shannzx.xyz/api/v1/tiktok?query=${encodeURIComponent(query)}`,
      {
        timeout: 30000,
      },
    );

    if (!res.data?.status || !res.data?.result) {
      return null;
    }

    return res.data.result;
  } catch (e) {
    return null;
  }
}

async function handler(m, { sock }) {
  const query = m.args.join(" ")?.trim();

  if (!query) {
    return m.reply(
      `╭┈┈⬡「 🎵 *ᴛɪᴋᴛᴏᴋ sᴇᴀʀᴄʜ* 」
┃
┃ ㊗ ᴜsᴀɢᴇ: \`${m.prefix}ttsearch <query>\`
┃
╰┈┈⬡

> \`Contoh: ${m.prefix}ttsearch anime\``,
    );
  }

  m.react("🔍");

  try {
    const videos = await tiktokSearchVideo(query);

    if (!videos || videos.length === 0) {
      m.react("❌");
      return m.reply(`❌ *Ehh~* Tidak ditemukan video untuk: ${query} 🥺`);
    }

    const saluranId = config.saluran?.id || "https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06";
    const saluranName = config.saluran?.name || config.bot?.name || "Ourin-AI";

    const formatDuration = (sec) => {
      const min = Math.floor(sec / 60);
      const s = sec % 60;
      return `${min}:${s.toString().padStart(2, "0")}`;
    };

    await sock.sendMessage(m.chat, {
      video: { url: videos[Math.floor(Math.random() * videos.length)].video },
      mimetype: "video/mp4",
      ptv: true,
    });

    m.react("✅");
  } catch (error) {
    m.react("❌");
    m.reply(`❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`);
  }
}

module.exports = {
  config: pluginConfig,
  handler,
  tiktokSearchVideo,
};
