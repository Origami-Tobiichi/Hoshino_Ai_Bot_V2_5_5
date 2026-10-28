const hsAsset = require('../../src/lib/assets')
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const { uploadToTmpFiles } = require("../../src/lib/sea");

const pluginConfig = {
  name: "fakeml",
  alias: ["mlbbfake", "mlcard", "mlfake"],
  category: "canvas",
  description: "Membuat fake ML profile card",
  usage: ".fakeml <nama> (reply/kirim foto)",
  example: ".fakeml Misaki",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

let fontRegistered = false;

console.log('INI COMMAND')

async function handler(m, { sock }) {
  const name = m.text?.trim();

  if (!name) {
    return m.reply(
      `🎮 *ꜰᴀᴋᴇ ᴍʟ ᴘʀᴏꜰɪʟᴇ*\n\n` +
        `> Masukkan nama untuk profile\n\n` +
        `*ᴄᴀʀᴀ ᴘᴀᴋᴀɪ:*\n` +
        `> 1. Kirim foto + caption \`${m.prefix}fakeml <nama>\`\n` +
        `> 2. Reply foto dengan \`${m.prefix}fakeml <nama>\``,
    );
  }

  let buffer = null;

  if (
    m.quoted &&
    (m.quoted.type === "imageMessage" || m.quoted.mtype === "imageMessage")
  ) {
    try {
      buffer = await m.quoted.download();
    } catch (e) {
      return m.reply(`❌ *Gomen ne~* Gagal download gambar: ${e.message} 🥺`);
    }
  } else if (m.isMedia && m.type === "imageMessage") {
    try {
      buffer = await m.download();
    } catch (e) {
      return m.reply(`❌ *Gomen ne~* Gagal download gambar: ${e.message} 🥺`);
    }
  } else {
    try {
      let te = await sock.profilePictureUrl(m.sender, "image")
      buffer = Buffer.from((await axios.get(te, { responseType: "arraybuffer" })).data)
    } catch (error) {
      buffer = (await hsAsset.buffer('images/pp-kosong'))
    }
  }

  if (!buffer) {
    return m.reply(`❌ *Ehh~* Kirim/reply gambar untuk dijadikan avatar~ 🥺`);
  }

  m.react("🕕");

  try {
    const gmbr = await uploadToTmpFiles(buffer, {
      filename: "image.jpg",
      contentType: "image/jpeg",
    });

    await sock.sendMedia(m.chat, `https://api.nexray.web.id/maker/fakelobyml?avatar=${encodeURIComponent(gmbr.directUrl)}&nickname=${encodeURIComponent(name)}`, null, m, {
      type: 'image',
    });

    m.react("✅");
  } catch (error) {
    m.react("❌");
    m.reply(`Coba lagi`);
  }
}

module.exports = {
  config: pluginConfig,
  handler,
};
