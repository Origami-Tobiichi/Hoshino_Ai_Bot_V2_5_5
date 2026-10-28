const pluginConfig = {
  name: "arsip",
  alias: ["archive"],
  category: "owner",
  description: "Arsipkan/buka arsip chat",
  usage: ".arsip <nomor/reply> atau .arsip buka <nomor>",
  example: ".arsip 628xxx",
  isOwner: true,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  try {
    const action = m.args[0]?.toLowerCase();
    let targetJid = null;
    let archive = true;

    if (action === "buka" || action === "unarchive") {
      archive = false;
      const num = (m.args[1] || "").replace(/[^0-9]/g, "");
      if (num) {
        targetJid = num + "@s.whatsapp.net";
      } else if (m.quoted) {
        targetJid = m.quoted.sender || m.quoted.participant;
      } else if (!m.isGroup) {
        targetJid = m.chat;
      }
    } else if (action === "semua") {
      await m.react("🕕");
      global.isFetchingGroups = true;
      const groups = await sock.groupFetchAllParticipating();
      global.isFetchingGroups = false;
      const groupIds = Object.keys(groups);
      let count = 0;
      for (const jid of groupIds) {
        try {
          await sock.chatModify({ archive: true, lastMessages: [] }, jid);
          count++;
        } catch {}
      }
      await m.react("✅");
      return m.reply(
        `📁 *${count} chat berhasil Ai simpan~* ★\n\n> Ne, private chat nggak bisa diarsipkan sekaligus ya... maaf~`
      );
    } else {
      if (m.mentionedJid?.length > 0) {
        targetJid = m.mentionedJid[0];
      } else if (m.quoted) {
        targetJid = m.quoted.sender || m.quoted.participant;
      } else if (m.args[0]) {
        const num = m.args[0].replace(/[^0-9]/g, "");
        if (num) targetJid = num + "@s.whatsapp.net";
      } else if (!m.isGroup) {
        targetJid = m.chat;
      }
    }

    if (!targetJid) {
      return m.reply(
        "★ *ᴀʀsɪᴘ ᴄʜᴀᴛ* ★\n\n" +
          "Ne ne~ mau arsipkan chat siapa? Ai bisa bantu lho~\n\n" +
          "> `.arsip 628xxx` — Simpan chat ke arsip\n" +
          "> `.arsip` (di private chat) — Arsipkan chat ini\n" +
          "> `.arsip` (reply pesan) — Arsipkan chat pengirim\n" +
          "> `.arsip buka 628xxx` — Keluarkan dari arsip\n" +
          "> `.arsip semua` — Arsipkan semua grup sekaligus\n\n" +
          "> *Dengan cinta, Ai akan menjaganya baik-baik~ ✨*"
      );
    }

    await sock.chatModify({ archive, lastMessages: [] }, targetJid);
    await m.react("✅");
    const target = targetJid.split("@")[0];
    return m.reply(
      archive
        ? `📁 *ᴄʜᴀᴛ ᴅɪsɪᴍᴘᴀɴ ★*\n\n> Target: ${target}\n> Ai simpan dengan penuh cinta ya~\n> Gunakan \`.arsip buka ${target}\` kalau mau dibuka lagi!`
        : `📂 *ᴀʀsɪᴘ ᴅɪʙᴜᴋᴀ ★*\n\n> Target: ${target}\n> Yosh! Ai sudah keluarkan dari arsip~ ✨`
    );
  } catch (error) {
    console.error("Arsip Plugin Error:", error);
    await m.reply(`❌ *Mou~ ada yang salah...*\n\n> ${error.message}\n\n> Tapi Ai tidak menyerah! Coba lagi ya~ ★`);
  }
}

module.exports = {
  config: pluginConfig,
  handler,
};