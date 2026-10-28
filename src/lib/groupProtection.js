

const { downloadMediaMessage } = require("hsnai");
const { isLid, lidToJid } = require("./lidHelper");
const config = require("../../config");

const messageCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000;

function gpMsg(key, replacements = {}) {
  const defaults = {
    antilink: '⚠ *Antilink* — @%user% mengirim link.\nPesan dihapus.',
    antilinkKick: '⚠ *Antilink* — @%user% di-kick karena mengirim link.',
    antilinkGc: '⚠ *Antilink WA* — @%user% mengirim link WA.\nPesan dihapus.',
    antilinkGcKick: '⚠ *Antilink WA* — @%user% di-kick karena mengirim link WA.',
    antilinkAll: '⚠ *Antilink* — @%user% mengirim link.\nPesan dihapus.',
    antilinkAllKick: '⚠ *Antilink* — @%user% di-kick karena mengirim link.',
    antitagsw: '⚠ *AntiTagSW* — Tag status dari @%user% dihapus.',
    antiviewonce: '👁️ *ViewOnce* — Dari @%user%',
    antiremove: '🗑️ *AntiDelete* — @%user% menghapus pesan:',
    antihidetag: '⚠ *AntiHidetag* — Hidetag dari @%user% dihapus.',
    notAdmin: '⚠ Bot bukan admin, tidak bisa menghapus pesan.'
  }
  let text = config.groupProtection?.[key] || defaults[key] || ''
  for (const [k, v] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`%${k}%`, 'g'), v)
  }
  return text
}

function cacheMessage(key, message, content) {
  messageCache.set(key, {
    message,
    content,
    timestamp: Date.now(),
  });

  if (messageCache.size > 1000) {
    const cutoff = Date.now() - CACHE_EXPIRY;
    for (const [k, v] of messageCache) {
      if (v.timestamp < cutoff) messageCache.delete(k);
    }
  }
}

function getCachedMessage(key) {
  const cached = messageCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_EXPIRY) {
    messageCache.delete(key);
    return null;
  }
  return cached;
}

function deleteCachedMessage(key) {
  messageCache.delete(key);
}

const LINK_REGEX =
  /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_\+.~#?&//=]*/gi;
const WA_LINK_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:chat\.whatsapp\.com|wa\.me|api\.whatsapp\.com|whatsapp\.com\/channel|whatsapp\.com\/catalog|call\.whatsapp\.com)\/[A-Za-z0-9+_\-]{4,}/gi;

function isAdminCheck(participants, senderNumber) {
  return participants.some((p) => {
    if (!p.admin) return false;
    const pJid = p.jid || p.id || "";
    const pLid = p.lid || "";
    const pNum = pJid.replace(/[^0-9]/g, "");
    const pLidNum = pLid.replace(/[^0-9]/g, "");
    return pNum === senderNumber || pLidNum === senderNumber || pNum.includes(senderNumber) || senderNumber.includes(pNum);
  });
}

function isBotAdminCheck(participants, botNum) {
  return participants.some((p) => {
    if (!p.admin) return false;
    const pNum = (p.jid || p.id || "").replace(/[^0-9]/g, "");
    return pNum === botNum || pNum.includes(botNum) || botNum.includes(pNum);
  });
}

async function handleAntilink(m, sock, db) {
  if (!m.isGroup) return false;

  const group = db.getGroup(m.chat) || {};
  if (group.antilink !== "on") return false;

  const text = m.body || "";
  LINK_REGEX.lastIndex = 0;
  WA_LINK_REGEX.lastIndex = 0;
  const hasLink = LINK_REGEX.test(text) || (WA_LINK_REGEX.lastIndex = 0, WA_LINK_REGEX.test(text));
  LINK_REGEX.lastIndex = 0;
  WA_LINK_REGEX.lastIndex = 0;
  if (!hasLink) return false;

  const botNumber = sock.user?.id?.split(":")[0] + "@s.whatsapp.net";
  if (m.sender === botNumber) return false;

  try {
    const groupMeta = await sock.groupMetadata(m.chat);
    const senderNum = m.sender?.replace(/[^0-9]/g, "") || "";
    const botNum = botNumber?.replace(/[^0-9]/g, "") || "";
    const senderTag = m.sender.split("@")[0];

    if (isAdminCheck(groupMeta.participants, senderNum)) return false;

    if (!isBotAdminCheck(groupMeta.participants, botNum)) {
      await sock.sendMessage(m.chat, {
        text: gpMsg('notAdmin'),
        mentions: [m.sender],
      });
      return true;
    }

    await sock.sendMessage(m.chat, {
      delete: {
        remoteJid: m.chat,
        fromMe: false,
        id: m.key.id,
        participant: m.sender
      }
    });
    const mode = group.antilinkMode || "remove";

    if (mode === "kick") {
      await sock.groupParticipantsUpdate(m.chat, [m.sender], "remove");
      await sock.sendMessage(m.chat, {
        text: gpMsg('antilinkKick', { user: senderTag }),
        mentions: [m.sender],
      });
    } else {
      await sock.sendMessage(m.chat, {
        text: gpMsg('antilink', { user: senderTag }),
        mentions: [m.sender],
      });
    }

    return true;
  } catch (error) {
    return false;
  }
}

async function handleAntiTagSW(rawMsg, sock, db) {
  const key = rawMsg.key;
  if (!key?.remoteJid) return false;

  const chatId = key.remoteJid;
  if (!chatId.endsWith("@g.us")) return false;

  const group = db.getGroup(chatId) || {};
  if (group.antitagsw !== "on") return false;

  const msg = rawMsg.message;
  if (!msg) return false;

  const hasStatusTag = msg.groupStatusMentionMessage || msg.statusMentionMessage || msg.groupMentionedMessage;
  if (!hasStatusTag) return false;

  const sender = key.participant || key.remoteJid;
  const botNumber = sock.user?.id?.split(":")[0] + "@s.whatsapp.net";
  if (sender === botNumber) return false;

  try {
    const groupMeta = await sock.groupMetadata(chatId);
    const senderNum = sender?.replace(/[^0-9]/g, "") || "";
    const botNum = botNumber?.replace(/[^0-9]/g, "") || "";
    const senderTag = sender.split("@")[0];

    if (isAdminCheck(groupMeta.participants, senderNum)) return false;
    if (!isBotAdminCheck(groupMeta.participants, botNum)) {
      await sock.sendMessage(chatId, {
        text: gpMsg('notAdmin'),
        mentions: [sender],
      });
      return true;
    }

    await sock.sendMessage(chatId, {
      delete: {
        remoteJid: chatId,
        fromMe: false,
        id: key.id,
        participant: sender
      }
    });
    await sock.sendMessage(chatId, {
      text: gpMsg('antitagsw', { user: senderTag }),
      mentions: [sender],
    });

    return true;
  } catch (error) {
    return false;
  }
}

async function handleAntiViewOnce(rawMsg, sock, db) {
  const key = rawMsg.key;
  if (!key?.remoteJid) return false;

  const chatId = key.remoteJid;
  if (!chatId.endsWith("@g.us")) return false;

  const group = db.getGroup(chatId) || {};
  if (group.antiviewonce !== "on") return false;

  const msg = rawMsg.message;
  if (!msg) return false;

  let innerMsg = null;
  if (msg.viewOnceMessage?.message) innerMsg = msg.viewOnceMessage.message;
  else if (msg.viewOnceMessageV2?.message) innerMsg = msg.viewOnceMessageV2.message;
  else if (msg.viewOnceMessageV2Extension?.message) innerMsg = msg.viewOnceMessageV2Extension.message;
  if (!innerMsg) return false;

  const sender = key.participant || key.remoteJid;
  const botNumber = sock.user?.id?.split(":")[0] + "@s.whatsapp.net";
  if (sender === botNumber) return false;

  try {
    let mediaType = null;
    let mediaMsg = null;

    if (innerMsg.imageMessage) { mediaType = "image"; mediaMsg = innerMsg.imageMessage; }
    else if (innerMsg.videoMessage) { mediaType = "video"; mediaMsg = innerMsg.videoMessage; }
    else if (innerMsg.audioMessage) { mediaType = "audio"; mediaMsg = innerMsg.audioMessage; }

    if (!mediaType || !mediaMsg) return false;

    const fakeMsg = { key, message: innerMsg };
    const mediaBuffer = await downloadMediaMessage(fakeMsg, "buffer", {});
    if (!mediaBuffer || mediaBuffer.length < 100) return false;

    const caption = mediaMsg.caption || "";
    const senderTag = sender.split("@")[0];
    const headerText = gpMsg('antiviewonce', { user: senderTag });
    const fullCaption = caption ? `${headerText}\n${caption}` : headerText;

    const msgContent = { mentions: [sender] };

    if (mediaType === "image") {
      msgContent.image = mediaBuffer;
      msgContent.caption = fullCaption;
    } else if (mediaType === "video") {
      msgContent.video = mediaBuffer;
      msgContent.caption = fullCaption;
    } else if (mediaType === "audio") {
      msgContent.audio = mediaBuffer;
      msgContent.mimetype = "audio/mpeg";
    }

    await sock.sendMessage(chatId, msgContent);
    return true;
  } catch (error) {
    return false;
  }
}

async function handleAntiRemove(messageUpdate, sock, db) {
  try {
    const { key, update } = messageUpdate;
    if (!key?.remoteJid) return false;

    const chatId = key.remoteJid;
    if (!chatId.endsWith("@g.us")) return false;

    const group = db.getGroup(chatId) || {};
    if (group.antiremove !== "on") return false;

    const messageStubType = update?.messageStubType;
    if (messageStubType !== 1 && messageStubType !== 68) return false;

    const deletedMsgId = key.id;
    const cached = getCachedMessage(deletedMsgId);
    if (!cached) return false;

    const originalSender = key.participant || ((key && key.fromMe) ? sock.user?.id : chatId);
    const senderTag = originalSender?.split("@")[0] || "Unknown";

    const headerText = gpMsg('antiremove', { user: senderTag });

    const headerMsg = await sock.sendMessage(chatId, {
      text: headerText,
      mentions: [originalSender],
    });

    try {
      await sock.sendMessage(chatId, {
        forward: cached.message,
      }, { quoted: headerMsg });
    } catch {}

    deleteCachedMessage(deletedMsgId);
    return true;
  } catch (error) {
    return false;
  }
}

async function cacheMessageForAntiRemove(m, sock, db) {
  if (!m.isGroup) return;

  const group = db.getGroup(m.chat) || {};
  if (group.antiremove !== "on") return;

  try {
    const msgType = m.type;
    if (!msgType) return;
    if (
      msgType.includes("protocolMessage") ||
      msgType.includes("senderKeyDistribution") ||
      msgType.includes("reactionMessage")
    )
      return;

    const msgId = m.key?.id;
    if (!msgId) return;

    const rawMsg = {
      key: m.key,
      message: m.message,
      messageTimestamp: m.messageTimestamp,
      pushName: m.pushName,
    };

    cacheMessage(msgId, rawMsg, null);
  } catch {}
}

const WA_SPECIFIC_PATTERNS = [
  /chat\.whatsapp\.com\/[A-Za-z0-9]+/gi,
  /wa\.me\/[0-9+]+/gi,
  /whatsapp\.com\/channel\/[A-Za-z0-9]+/gi,
  /whatsapp\.com\/c\/[A-Za-z0-9]+/gi,
  /api\.whatsapp\.com\/send/gi,
];

const ALL_LINK_PATTERN = /(?:https?:\/\/)[^\s<>"{}|\\^`[\]]+/gi;

function containsWaSpecificLink(text) {
  if (!text) return { hasLink: false, link: null };
  for (const pattern of WA_SPECIFIC_PATTERNS) {
    pattern.lastIndex = 0;
    const match = text.match(pattern);
    if (match) return { hasLink: true, link: match[0] };
  }
  return { hasLink: false, link: null };
}

function containsAnyLink(text) {
  if (!text) return { hasLink: false, link: null };
  ALL_LINK_PATTERN.lastIndex = 0;
  const match = text.match(ALL_LINK_PATTERN);
  if (match) return { hasLink: true, link: match[0] };
  return { hasLink: false, link: null };
}

async function handleAntilinkGc(m, sock, db) {
  if (!m.isGroup) return false;

  const group = db.getGroup(m.chat) || {};
  if (group.antilinkgc !== "on") return false;

  const text = m.body || "";
  const { hasLink, link } = containsWaSpecificLink(text);
  if (!hasLink) return false;

  const botNumber = sock.user?.id?.split(":")[0] + "@s.whatsapp.net";
  const selfMode = db.setting("selfMode") === true;
  if (!selfMode && m.sender === botNumber) return false;

  try {
    const groupMeta = await sock.groupMetadata(m.chat);
    const senderNum = m.sender?.replace(/[^0-9]/g, "") || "";
    const botNum = botNumber?.replace(/[^0-9]/g, "") || "";
    const senderTag = m.sender.split("@")[0];

    if (isAdminCheck(groupMeta.participants, senderNum)) return false;
    if (!isBotAdminCheck(groupMeta.participants, botNum)) return false;

    await sock.sendMessage(m.chat, {
      delete: {
        remoteJid: m.chat,
        fromMe: false,
        id: m.key.id || m.id,
        participant: m.sender
      }
    });
    const mode = group.antilinkgcMode || "remove";

    if (mode === "kick") {
      try {
        await sock.groupParticipantsUpdate(m.chat, [m.sender], "remove");
        await sock.sendMessage(m.chat, {
          text: gpMsg('antilinkGcKick', { user: senderTag }),
          mentions: [m.sender],
        });
      } catch (kickErr) {
        await sock.sendMessage(m.chat, {
          text: gpMsg('antilinkGc', { user: senderTag }),
          mentions: [m.sender],
        });
      }
    } else {
      await sock.sendMessage(m.chat, {
        text: gpMsg('antilinkGc', { user: senderTag }),
        mentions: [m.sender],
      });
    }

    return true;
  } catch (error) {
    console.error(`[ANTILINK GC ERROR] Failed to perform action: ${error.message}`);
    return false;
  }
}

async function handleAntilinkAll(m, sock, db) {
  if (!m.isGroup) return false;

  const group = db.getGroup(m.chat) || {};
  if (group.antilinkall !== "on") return false;

  const text = m.body || "";
  const { hasLink, link } = containsAnyLink(text);
  if (!hasLink) return false;

  const botNumber = sock.user?.id?.split(":")[0] + "@s.whatsapp.net";
  const selfMode = db.setting("selfMode") === true;
  if (!selfMode && m.sender === botNumber) return false;

  try {
    const groupMeta = await sock.groupMetadata(m.chat);
    const senderNum = m.sender?.replace(/[^0-9]/g, "") || "";
    const botNum = botNumber?.replace(/[^0-9]/g, "") || "";
    const senderTag = m.sender.split("@")[0];

    if (isAdminCheck(groupMeta.participants, senderNum)) return false;
    if (!isBotAdminCheck(groupMeta.participants, botNum)) return false;

    await sock.sendMessage(m.chat, {
      delete: {
        remoteJid: m.chat,
        fromMe: false,
        id: m.key.id || m.id,
        participant: m.sender
      }
    });
    const mode = group.antilinkallMode || "remove";

    if (mode === "kick") {
      try {
        await sock.groupParticipantsUpdate(m.chat, [m.sender], "remove");
        await sock.sendMessage(m.chat, {
          text: gpMsg('antilinkAllKick', { user: senderTag }),
          mentions: [m.sender],
        });
      } catch (kickErr) {
        await sock.sendMessage(m.chat, {
          text: gpMsg('antilinkAll', { user: senderTag }),
          mentions: [m.sender],
        });
      }
    } else {
      await sock.sendMessage(m.chat, {
        text: gpMsg('antilinkAll', { user: senderTag }),
        mentions: [m.sender],
      });
    }

    return true;
  } catch (error) {
    console.error(`[ANTILINK ALL ERROR] Failed to perform action: ${error.message}`);
    return false;
  }
}

async function handleAntiHidetag(m, sock, db) {
  if (!m.isGroup) return false;

  const group = db.getGroup(m.chat) || {};
  if (group.antihidetag !== "on") return false;

  if (!m.mentionedJid || m.mentionedJid.length === 0) return false;

  try {
    const groupMetadata = await sock.groupMetadata(m.chat);
    const participants = groupMetadata.participants || [];

    if (m.mentionedJid.length < participants.length) return false;
    if (m.isAdmin || m.isOwner || m.fromMe) return false;
    if (!m.isBotAdmin) return false;

    await sock.sendMessage(m.chat, {
      delete: {
        remoteJid: m.chat,
        fromMe: false,
        id: m.key.id,
        participant: m.sender
      }
    });

    const senderTag = m.sender.split("@")[0];
    await sock.sendMessage(m.chat, {
      text: gpMsg('antihidetag', { user: senderTag }),
      mentions: [m.sender],
    });

    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  handleAntilink,
  handleAntiTagSW,
  handleAntiViewOnce,
  handleAntiRemove,
  cacheMessageForAntiRemove,
  handleAntilinkGc,
  handleAntilinkAll,
  handleAntiHidetag,
};
