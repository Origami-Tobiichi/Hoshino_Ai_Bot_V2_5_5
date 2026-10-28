const hsAsset = require('./lib/assets')
const config = require("../config");
const { isSelf } = require("../config");
const { serialize, getCachedThumb } = require("./lib/serialize");
const {
  getPlugin,
  getPluginCount,
  getAllPlugins,
  pluginStore,
  getAllCommandNames,
} = require("./lib/plugins");
const {
  findSimilarCommands,
  formatSuggestionMessage,
} = require("./lib/similarity");
const { getDatabase } = require("./lib/database");
const {
  formatUptime,
  createWaitMessage,
  createErrorMessage,
} = require("./lib/formatter");
const { getUptime } = require("./connection");
const { logger, logMessage, logCommand, c } = require("./lib/colors");
const {
  isLid,
  isLidConverted,
  lidToJid,
  convertLidArray,
  resolveAnyLidToJid,
  cacheParticipantLids,
} = require("./lib/lidHelper");
const { hasActiveSession } = require("./lib/gameData");
const {
  handleAntilink,
  handleAntiRemove,
  cacheMessageForAntiRemove,
  handleAntilinkGc,
  handleAntilinkAll,
  handleAntiHidetag,
} = require("./lib/groupProtection");
const { cacheMessage, handleCidukDelete } = require('../plugins/group/cidukdelmsg')
const { cacheAlbumCandidate } = require('./lib/albumCache')
const { cacheRawContext } = require('./lib/rawContextCache')
const { getGroupMetadata, setGroupMetadata } = require('./lib/groupMetaCache')

const {
  debounceMessage,
  getCachedUser,
  getCachedGroup,
  getCachedSetting,
} = require("./lib/performanceOptimizer");
const {
  isJadibotOwner,
  isJadibotPremium,
  loadJadibotDb,
} = require("./lib/jadibotDatabase");
const { getActiveJadibots } = require("./lib/jadibotManager");
const { handleCommand: handleCaseCommand } = require("../case/hsnai");
const { logError } = require('./lib/errorLog')
const underDevStore = require('./lib/underDevStore')
const sendUnderDev = require('./lib/underDev')
const fs = require("fs");
const timeHelper = require("./lib/timeHelper");
const path = require("path");
const { exec } = require("child_process");
const axios = require("axios");

let checkAfk = null;
let isMuted = null;
let checkSpam = null;
let handleSpamAction = null;
let checkSlowmode = null;
let incrementChatCount = null;
let checkStickerCommand = null;

// Antispam delay tracker - users who were detected spamming get 3s delay
const spamDelayTracker = new Map();

let _smartTriggerThumb = undefined;
function getSmartTriggerThumb() {
  // sync: ambil dari cache memori (kalau belum ada, di-download di background)
  if (_smartTriggerThumb) return _smartTriggerThumb;
  _smartTriggerThumb = hsAsset.peek('images/hsnai2');
  return _smartTriggerThumb;
}

try {
  checkAfk = require("../plugins/group/afk").checkAfk;
} catch (e) {}

try {
  isMuted = require("../plugins/group/mute").isMuted;
} catch (e) {}

try {
  isIgnored = require("../plugins/group/gakpeduli").isIgnored;
} catch (e) {}

let isUserIgnored = null;
try {
  isUserIgnored = require("../plugins/group/warn").isUserIgnored;
} catch (e) {}

let isIgnoredUser = null;
try {
  isIgnoredUser = require("../plugins/owner/gamemode").isIgnoredUser;
} catch (e) {}

let checkRateLimit = null;
try {
  checkRateLimit = require("../plugins/owner/ratelimitlog").checkRateLimit;
} catch (e) {}


try {
  const antispamModule = require("../plugins/group/antispam");
  checkSpam = antispamModule.checkSpam;
  handleSpamAction = antispamModule.handleSpamAction;
} catch (e) {}

try {
  checkSlowmode = require("../plugins/group/slowmode").checkSlowmode;
} catch (e) {}

let isToxic = null;
let handleToxicMessage = null;
try {
  const toxicModule = require("../plugins/group/antitoxic");
  isToxic = toxicModule.isToxic;
  handleToxicMessage = toxicModule.handleToxicMessage;
} catch (e) {}

let isDanaScam = null;
let handleDanaScam = null;
try {
  const antidanaModule = require("../plugins/group/antidana");
  // Kita ambil fungsi deteksi dan eksekusi dari plugin
  isDanaScam = antidanaModule.isDanaScam;
  handleDanaScam = antidanaModule.handleDanaScam;
} catch (e) {}

let handleAutoAI = null;
try {
  handleAutoAI = require("./lib/autoaiHandler").handleAutoAI;
} catch (e) {}

let handleAutoDownload = null;
try {
  handleAutoDownload = require("./lib/autoDownload").handleAutoDownload;
} catch (e) {}
try {
  incrementChatCount = require("../plugins/group/totalchat").incrementChatCount;
} catch (e1) {
  try {
    incrementChatCount = require("../plugins/group/topchat").incrementChatCount;
  } catch (e2) {
    console.error("[ERROR] Gagal load plugin chatstat (totalchat & topchat):", e2.message);
  }
}
try {
  checkStickerCommand = require("./lib/stickerCommand").checkStickerCommand;
} catch (e) {}

let detectBot = null;
try {
  detectBot = require("../plugins/group/antibot").detectBot;
} catch (e) {}

let autoStickerHandler = null;
try {
  autoStickerHandler =
    require("../plugins/group/autosticker").autoStickerHandler;
} catch (e) {}

let autoMediaHandler = null;
try {
  autoMediaHandler = require("../plugins/group/automedia").autoMediaHandler;
} catch (e) {}

let checkAntidocument = null;
try {
  checkAntidocument = require("../plugins/group/antidocument").checkAntidocument;
} catch (e) {}

let checkAntisticker = null;
try {
  checkAntisticker = require("../plugins/group/antisticker").checkAntisticker;
} catch (e) {}

let checkAntimedia = null;
try {
  checkAntimedia = require("../plugins/group/antimedia").checkAntimedia;
} catch (e) {}


/**
 * @typedef {Object} HandlerContext
 * @property {Object} sock - Socket connection
 * @property {Object} m - Serialized message
 * @property {Object} config - Bot configuration
 * @property {Object} db - Database instance
 * @property {number} uptime - Bot uptime
 */

/**
 * Anti-spam map untuk tracking pesan per user
 * @type {Map<string, number>}
 */
const { RateLimiterMemory } = require('rate-limiter-flexible');
const globalRateLimiter = new RateLimiterMemory({
  points: 12,       // dari 5 → 12: lebih longgar untuk usage normal
  duration: 5,      // dari 3 → 5: window lebih lebar
  blockDuration: 3, // dari 5 → 3: kalau kena block, cuma 3 detik bukan 5
});

const gamePlugins = [
  "asahotak",
  "caklontong",
  "kataacak",
  "family100",
  "siapakahaku",
  "susunkata",
  "riddle",
  "suitpvp",
  "tebakbendera",
  "tebakdrakor",
  "tebakepep",
  "tebakfilm",
  "tebakgambar",
  "tebakgd",
  "tebakhewan",
  "tebakjkt48",
  "tebakkalimat",
  "tebakkata",
  "tebakkimia",
  "tebaklagu",
  "tebaklirik",
  "tebakmakanan",
  "tebaknegara",
  "tebakprofesi",
  "tebaktebakan",
  "tekateki",
  "tictactoe",
  "tictactoev2", 
  "ulartangga", 
  "sambungkata",
  "wordle",
  "tebakpikiran", 
  "tebakemoji"
];

const cachedGamePlugins = new Map();
for (const gameName of gamePlugins) {
  try {
    const plugin = require(`../plugins/game/${gameName}`);
    if (plugin.answerHandler) cachedGamePlugins.set(gameName, plugin);
  } catch (e) {}
}

let sulapPlugin = null;
try {
  sulapPlugin = require("../plugins/fun/sulap");
} catch (e) {}

let sendAssetPlugin = null;
try {
  sendAssetPlugin = require("../plugins/owner/sendasset");
} catch (e) {}

async function handleGameAnswer(m, sock) {
  try {
    try {
      const sulapPlugin = require("../plugins/fun/sulap");
      if (sulapPlugin?.answerHandler) {
        const handled = await sulapPlugin.answerHandler(m, sock);
        if (handled) return true;
      }
    } catch (e) {}

    for (const [, gamePlugin] of cachedGamePlugins) {
      const handled = await gamePlugin.answerHandler(m, sock);
      if (handled) return true;
    }
  } catch (error) {}
  return false;
}

async function handleSmartTriggers(m, sock, db) {
  if (!m.body) return false;

  const text = m.body.trim().toLowerCase();
  
  const firstWord = text.split(" ")[0];
  if (/^[\.\/\!\#\-]?(autoreply|ar|smarttrigger|smarttriggers)$/.test(firstWord)) {
    return false;
  }

  // ── Trigger list grup (contoh: ketik "war" -> bot kirim list war) ──
  try {
    const listWar = require("./lib/listWar");
    if (await listWar.handleTrigger(m, sock)) return true;
  } catch (e) {
    console.error("[Handler] ListWar trigger error:", e.message);
  }

  if (text === "done") {
    const sessions = db.setting("transactionSessions") || {};
    if (sessions[m.sender]) {
      try {
        const { handleBuyerDone } = require("../plugins/store/done");
        const session = sessions[m.sender];
        await handleBuyerDone(m, sock, session);
        delete sessions[m.sender];
        db.setting("transactionSessions", sessions);
        await db.save();
        return true;
      } catch (e) {
        console.error("[Handler] Done trigger error:", e.message);
      }
    }
  }
  
// ── Konfirmasi danger ganticode ───────────────────────────────────────────
  try {
    const { confirmAnswerHandler } = require('../plugins/owner/ganticode')
    const handled = await confirmAnswerHandler(m, sock)
    if (handled) return true
  } catch (e) {
    console.error('[Handler] confirmAnswerHandler ganticode error:', e.stack || e.message)
  }

  // ── Konfirmasi danger addplugin ───────────────────────────────────────────  ← TAMBAH INI
  try {
    const { confirmAnswerHandler } = require('../plugins/owner/addplugin')
    const handled = await confirmAnswerHandler(m, sock)
    if (handled) return true
  } catch (e) {
    console.error('[Handler] confirmAnswerHandler addplugin error:', e.stack || e.message)
  }

  // ── Konfirmasi size gantifile ─────────────────────────────────────────────
  try {
    const { confirmAnswerHandler } = require('../plugins/owner/gantifile')
    const handled = await confirmAnswerHandler(m, sock)
    if (handled) return true
  } catch (e) {
    console.error('[Handler] confirmAnswerHandler gantifile error:', e.stack || e.message)
  }
  
  // ── Konfirmasi kode getfile (file sensitif) ───────────────────────────────
try {
  const { confirmAnswerHandler } = require('../plugins/owner/getfile')
  const handled = await confirmAnswerHandler(m, sock)
  if (handled) return true
} catch (e) {
  console.error('[Handler] confirmAnswerHandler getfile error:', e.stack || e.message)
}
  
  // ── Konfirmasi size backupsc ──────────────────────────────────────────────
try {
    const { confirmAnswerHandler } = require('../plugins/owner/backupsc')
    const handled = await confirmAnswerHandler(m, sock)
    if (handled) return true
} catch (e) {
    console.error('[Handler] confirmAnswerHandler backupsc error:', e.stack || e.message)
}


  // ── Sesi capture SRT (shuffle reply thumb) ────────────────────────────────
  try {
    const { srtAnswerHandler } = require('../plugins/owner/srt')
    const handled = await srtAnswerHandler(m, sock)
    if (handled) return true
  } catch (e) {}

try {
    const { answerHandler } = require('../plugins/download/komikindo')
    const handled = await answerHandler(m, sock)
    if (handled) return true
} catch {}


try {
    const { confirmAnswerHandler } = require('../plugins/owner/rename')
    const handled = await confirmAnswerHandler(m, sock)
    if (handled) return true
} catch (e) {
    console.error('[Handler] confirmAnswerHandler rename error:', e.stack || e.message)
}

try {
    const { confirmAnswerHandler } = require('../plugins/owner/rename')
    const handled = await confirmAnswerHandler(m, sock)
    if (handled) return true
} catch (e) {
    console.error('[Handler] confirmAnswerHandler rename error:', e.stack || e.message)
}

  // ── Konfirmasi size/danger addfile ────────────────────────────────────────
  try {
    const { confirmAnswerHandler } = require('../plugins/owner/addfile')
    const handled = await confirmAnswerHandler(m, sock)
    if (handled) return true
  } catch (e) {
    console.error('[Handler] confirmAnswerHandler addfile error:', e.stack || e.message)
  }

  // ── Konfirmasi hapus delfile ──────────────────────────────────────────────
  try {
    const { confirmAnswerHandler } = require('../plugins/owner/delfile')
    const handled = await confirmAnswerHandler(m, sock)
    if (handled) return true
  } catch (e) {
    console.error('[Handler] confirmAnswerHandler delfile error:', e.stack || e.message)
  }

  // ── Konfirmasi sendasset (ya/batal) ───────────────────────────────────────
  if (global.sendAssetPending?.[m.sender] && sendAssetPlugin?.answerHandler) {
    try {
      const handled = await sendAssetPlugin.answerHandler(m, sock)
      if (handled) return true
    } catch (e) {}
  }
  
  if (global.registrationSessions?.[m.sender]) {
    try {
      const { registrationAnswerHandler } = require("../plugins/user/daftar");
      const handled = await registrationAnswerHandler(m, sock);
      if (handled) return true;
    } catch (e) {
      console.error("[Handler] Registration answer error:", e.message);
    }
  }
  
  const globalSmartTriggers =
    db.setting("smartTriggers") ?? config.features?.smartTriggers ?? false;

  try {
    const saluranId = config.saluran?.id || "https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o";
    const saluranName = config.saluran?.name || config.bot?.name || "Ourin-AI";
    const botName = config.bot?.name || "Ourin-AI";

    let isAutoreplyEnabled = globalSmartTriggers;

    const processCustomReply = async (replyItem) => {
      let replyText = (replyItem.reply || '')
        .replace(/{name}/g, m.pushName || "User")
        .replace(/{tag}/g, `@${m.sender.split("@")[0]}`)
        .replace(/{sender}/g, m.sender.split("@")[0])
        .replace(/{botname}/g, config.bot?.name || "Bot")
        .replace(/{time}/g, timeHelper.formatTime("HH:mm:ss"))
        .replace(/{date}/g, timeHelper.formatDate("DD MMMM YYYY"));

      const mentions = replyText.includes(`@${m.sender.split("@")[0]}`)
        ? [m.sender]
        : [];

      if (replyItem.image && fs.existsSync(replyItem.image)) {
        const imageBuffer = fs.readFileSync(replyItem.image);
        await sock.sendMedia(m.chat, imageBuffer, replyText, m, {
          mentions: mentions,
          type: 'image'
        })
      } else {
        await m.reply(replyText, { mentions: mentions })
      }
      return true;
    };

    if (m.isGroup) {
      const groupData = db.getGroup(m.chat) || {};
      isAutoreplyEnabled = groupData.autoreply ?? globalSmartTriggers;

      if (isAutoreplyEnabled) {
        let customReplies = groupData.customReplies || [];
        if (!Array.isArray(customReplies)) {
          customReplies = [];
          db.setGroup(m.chat, { customReplies });
        }
        for (const replyItem of customReplies) {
          if (!replyItem?.trigger) continue;
          if (text === replyItem.trigger || text.includes(replyItem.trigger)) {
            return await processCustomReply(replyItem);
          }
        }
        
        const globalCustomReplies = db.setting("globalCustomReplies") || [];
        for (const replyItem of globalCustomReplies) {
          if (!replyItem?.trigger) continue;
          if (text === replyItem.trigger || text.includes(replyItem.trigger)) {
            return await processCustomReply(replyItem);
          }
        }
      }
    } else {
      const privateAutoreply = db.setting("autoreplyPrivate") ?? false;
      if (!privateAutoreply && !globalSmartTriggers) return false;
      isAutoreplyEnabled = privateAutoreply || globalSmartTriggers;

      if (isAutoreplyEnabled) {
        const globalCustomReplies = db.setting("globalCustomReplies") || [];
        for (const replyItem of globalCustomReplies) {
          if (!replyItem?.trigger) continue;
          if (text === replyItem.trigger || text.includes(replyItem.trigger)) {
            return await processCustomReply(replyItem);
          }
        }
      }
    }

    if (!isAutoreplyEnabled) return false;

    const botJid = sock.user?.id;
    const isMentioned = m.mentionedJid?.some(
      (jid) => jid === botJid || jid?.includes(sock.user?.id?.split(":")[0]),
    );

    const thumbBuffer = getSmartTriggerThumb();

    const contextInfos = {
      forwardingScore: 9999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: saluranId,
        newsletterName: saluranName,
        serverMessageId: 127,
      },
    };

    if (thumbBuffer) {
      contextInfos.externalAdReply = {
        title: botName,
        body: config.bot?.version ? `v${config.bot.version}` : null,
        thumbnail: thumbBuffer,
        mediaType: 1,
        sourceUrl: config.saluran?.link || "https://wa.me/6281234567890",
        renderLargerThumbnail: false,
      };
    }

    if (isMentioned) {
      await m.reply(`Eeh~? Ada yang manggil ${botName}? 🌟\n\nNee nee, @${m.sender.split("@")[0]}~ ada apa? Aku selalu di sini kok, jangan sungkan ya~ 💕`, {mentions: [m.sender]})
      return true;
    }

    if (text?.toLowerCase() === "p") {
      await m.reply(`Muu~ @${m.sender.split("@")[0]}, salam dulu dong sebelum chat~ Itu lebih manis kan? ✨`, {mentions: [m.sender]})
      return true;
    }

    if (
      text?.toLowerCase() === "bot"
    ) {
      await m.reply(`Haii~ @${m.sender.split("@")[0]}! ${botName} aktif dan siap menemanimu~ ⭐ Aku di sini lho! 💕`, {mentions: [m.sender]})
      return true;
    }

    if (text?.toLowerCase()?.includes("assalamualaikum")) {
      await m.reply(`Wa'alaikumsalam~ @${m.sender.split("@")[0]}! Seneng banget ada yang nyapa dengan salam~ 🌸`, {mentions: [m.sender]})
      return true;
    }

    if (text?.toLowerCase()?.includes("hallo")) {
      await m.reply(`Haii haii~ @${m.sender.split("@")[0]}! Wah ada yang nyapa aku, senengnya~ ✨💕`, {mentions: [m.sender]})
      return true;
    }
  } catch (error) {
    console.error("[SmartTriggers] Error:", error.message);
  }

  return false;
}

/**
 * Cek apakah user sedang spam
 * @param {string} jid - JID user
 * @returns {boolean} True jika sedang spam
 */
async function isSpamming(jid) {
  if (!config.features?.antiSpam) return false;

  try {
    await globalRateLimiter.consume(jid);
    return false;
  } catch {
    return true;
  }
}

function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Cek permission untuk menjalankan command
 * @param {Object} m - Serialized message
 * @param {Object} pluginConfig - Konfigurasi plugin
 * @returns {{allowed: boolean, reason: string}} Object dengan status dan alasan
 */
function checkPermission(m, pluginConfig) {
  const db = getDatabase();
  const user = db.getUser(m.sender) || {};
  let hasAccess = false;
  if (user.access && m.command) {
    const accessFound = user.access.find(
      (a) => a.cmd === m.command.toLowerCase(),
    );
    if (accessFound) {
      if (accessFound.expired === null || accessFound.expired > Date.now()) {
        hasAccess = true;
        console.log("[DEBUG Access] Access Granted!");
      } else {
        user.access = user.access.filter(
          (a) => a.cmd !== m.command.toLowerCase(),
        );
        db.setUser(m.sender, user);
      }
    }
  }

  // --- SAVEBOTCH: flip nilai isOwner, TAPI cuma buat plugin kategori "owner"
  // ownerOnly OFF di channel -> plugin category owner (isOwner:true) dianggap isOwner:false
  // ownerOnly ON di channel  -> plugin category owner (isOwner:false) dianggap isOwner:true
  // Plugin kategori LAIN (group, fun, tools, dll) sama sekali nggak kesentuh
  let effectiveIsOwner = pluginConfig.isOwner;
  if (m.isChannel && pluginConfig.category === 'owner') {
    try {
      const { isRegisteredChannel, isChannelOwnerOnly } = require('../plugins/owner/savebotch');
      if (isRegisteredChannel(m.chat)) {
        effectiveIsOwner = isChannelOwnerOnly(m.chat);
      }
    } catch {}
  }

  if (effectiveIsOwner && !m.isOwner && !hasAccess) {
    return {
      allowed: false,
      reason: config.messages?.ownerOnly || "Muu~ ini khusus buat owner aja lho~ Aku nggak bisa kasih akses sembarangan ya~ 🌸",
    };
  }

  if (pluginConfig.isPartner && !m.isPartner && !m.isOwner && !hasAccess) {
    return {
      allowed: false,
      reason: "Eeh~ fitur ini khusus partner aja nee~ Jadi partner dulu yuk! 💕",
    };
  }

  if (pluginConfig.isPremium && !m.isPremium && !m.isOwner && !m.isPartner && !hasAccess) {
    return {
      allowed: false,
      reason: config.messages?.premiumOnly || "Hehe~ ini khusus member premium lho! Upgrade dulu ya~ ⭐💎",
    };
  }

  if (pluginConfig.isGroup && !m.isGroup) {
    return {
      allowed: false,
      reason: config.messages?.groupOnly || "Nee~ command ini cuma bisa dipakai di grup aja ya~ Masuk grup dulu dong! 👥✨",
    };
  }

  if (pluginConfig.isPrivate && m.isGroup) {
    return {
      allowed: false,
      reason: config.messages?.privateOnly || "Psst~ command ini khusus di private chat aja lho~ Chat aku langsung ya! 📱💕",
    };
  }

  if (
    pluginConfig.isAdmin &&
    m.isGroup &&
    !m.isAdmin &&
    !m.isOwner &&
    !hasAccess
  ) {
    return {
      allowed: false,
      reason: config.messages?.adminOnly || "Muu~ ini khusus admin grup aja nee~ Kamu bukan admin kan? 👮‍♀️🌸",
    };
  }

  if (pluginConfig.isBotAdmin && m.isGroup && !m.isBotAdmin) {
    return {
      allowed: false,
      reason:
        config.messages?.botAdminOnly || "Eeh~ aku perlu jadi admin grup dulu nih baru bisa bantu~ Jadiin aku admin ya! 🤖💕",
    };
  }

  return { allowed: true, reason: "" };
}

/**
 * Cek mode bot dengan validasi kuat
 * @param {Object} m - Serialized message
 * @returns {boolean} True jika boleh diproses
 */
function checkMode(m) {
  const db = getDatabase();
  const realConfig = require("../config");
  const dbMode = db.setting("botMode");
  const mode = dbMode || realConfig.config.mode || "public";
  
  const onlyGc = db.setting("onlyGc");
  const onlyPc = db.setting("onlyPc");
  const selfAdmin = db.setting("selfAdmin");
  const publicAdmin = db.setting("publicAdmin");
  const botAfk = db.setting("botAfk");

  if (botAfk && botAfk.active) {
    if (m.fromMe || m.isOwner) {
      return { allowed: true };
    }
    const duration = formatAfkDuration(Date.now() - botAfk.since);
    return {
      allowed: false,
      isAfk: true,
      afkMessage:
        `💤 *ʙᴏᴛ sᴇᴅᴀɴɢ ᴀꜰᴋ*\n\n` +
        `╭┈┈⬡「 📋 *ɪɴꜰᴏ* 」\n` +
        `┃ 📝 ᴀʟᴀsᴀɴ: \`${botAfk.reason || "AFK"}\`\n` +
        `┃ ⏱️ sᴇᴊᴀᴋ: \`${duration}\` yang lalu\n` +
        `╰┈┈⬡\n\n` +
        `> Bot tidak bisa menerima perintah saat ini\n` +
        `> Mohon tunggu sampai owner mengaktifkan kembali`,
    };
  }

  // --- SAVEBOTCH: izinkan saluran yang sudah didaftarkan lewat .savebotch add ---
  let isAllowedChannel = false;
  if (m.isChannel) {
    try {
      const { isRegisteredChannel } = require('../plugins/owner/savebotch');
      isAllowedChannel = isRegisteredChannel(m.chat);
    } catch {}
  }

  if (onlyGc && !m.isGroup && !m.isOwner && !isAllowedChannel) {
    return { allowed: false };
  }

  if (onlyPc && m.isGroup && !m.isOwner) {
    return { allowed: false };
  }

  const onlyThisGroup = db.setting("onlyThisGroup");
  if (onlyThisGroup && m.isGroup && m.chat !== onlyThisGroup && !m.isOwner) {
    return { allowed: false };
  }

  // --- WHITELIST GROUP MODE ---
  try {
    const { isWhitelistModeActive, isGroupWhitelisted } = require('../plugins/owner/whitelistgc')
    if (isWhitelistModeActive(db) && m.isGroup && !m.isOwner) {
      if (!isGroupWhitelisted(m.chat, db)) {
        return { allowed: false };
      }
    }
  } catch {}

  if (mode === "self") {
    if (m.fromMe) return { allowed: true };
    if (m.isOwner) return { allowed: true };

    const activeJadibots = getActiveJadibots();
    if (activeJadibots.length > 0) {
      let jadibotList = "";
      activeJadibots.forEach((jb, i) => {
        jadibotList += `┃ ${i + 1}. @${jb.id}\n`;
      });

      const mentions = activeJadibots.map((jb) => jb.id + "@s.whatsapp.net");

      return {
        allowed: false,
        hasJadibots: true,
        jadibotMessage:
          `🤖 *ᴍᴏᴅᴇ ᴘʀɪᴠᴀᴛᴇ*\n\n` +
          `Eeh~ aku lagi dalam mode private nih~\n` +
          `Tapi jangan khawatir! Kamu bisa chat sama adik-adikku di sini~ 💕\n\n` +
          `╭┈┈⬡「 📱 *ʙᴏᴛ ᴛᴇʀsᴇᴅɪᴀ* 」\n` +
          `${jadibotList}` +
          `╰┈┈⬡\n\n` +
          `> Pilih salah satu ya~ mereka pasti mau bantu! ⭐`,
        jadibotMentions: mentions,
      };
    }

    return { allowed: false };
  }

  if (mode === "public") {
    const onlyAdmin = db.setting('onlyAdmin')

    if (onlyAdmin) {
      if (m.fromMe || m.isOwner) return { allowed: true };
      if (!m.isGroup) return { allowed: true };
      if (m.isGroup && m.isAdmin) return { allowed: true };
      return { allowed: false };
    }

    if (selfAdmin) {
      if (m.fromMe || m.isOwner) return { allowed: true };
      if (m.isGroup && m.isAdmin) return { allowed: true };
      return { allowed: false };
    }

    if (publicAdmin) {
      if (m.fromMe || m.isOwner) return { allowed: true };
      if (!m.isGroup) return { allowed: true };
      if (m.isGroup && m.isAdmin) return { allowed: true };
      return { allowed: false };
    }

    return { allowed: true };
  }

  return { allowed: true };
}

function formatAfkDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} hari ${hours % 24} jam`;
  if (hours > 0) return `${hours} jam ${minutes % 60} menit`;
  if (minutes > 0) return `${minutes} menit`;
  return `${seconds} detik`;
}

/**
 * Handler utama untuk memproses pesan
 * @param {Object} msg - Raw message dari Baileys
 * @param {Object} sock - Socket connection
 * @returns {Promise<void>}
 * @example
 * sock.ev.on('messages.upsert', async ({ messages }) => {
 *   await messageHandler(messages[0], sock);
 * });
 */
async function messageHandler(msg, sock, options = {}) {
  const isJadibot = options.isJadibot || false;
  let m;
  try {
    m = await serialize(sock, msg);

    if (!m) return;
    if (!m.message) return;
    
    // Cache pesan untuk cidukdelmsg
    cacheMessage(m)

    // Cache kandidat album (raw msg, sebelum serialize) untuk img2sp
    try { cacheAlbumCandidate(msg) } catch {}

    // Cache contextInfo mentah (raw msg, sebelum serialize) untuk crm.js
    // fallback ketika store.loadMessage gagal & m.quoted udah "dibersihin"
    try { cacheRawContext(msg) } catch {}

    if (m.message?.stickerPackMessage && sock.saveStickerPack) {
      try {
        const packMsg = m.message.stickerPackMessage;
        const packId = packMsg.stickerPackId || m.id;
        const packName = packMsg.name || "Unknown Pack";
        sock.saveStickerPack(packId, { stickerPackMessage: packMsg }, packName);
      } catch (e) {}
    }
    // --- 1. SETUP DATABASE ---
    const db = getDatabase();
    if (!db?.ready) return; // Jika DB belum siap, stop di sini.

    // --- 2. JADIBOT CONTEXT — set isOwner/isPremium SEBELUM semua check ---
    const jadibotId = options.jadibotId || null;
    if (isJadibot && jadibotId) {
      m.isOwner =
        isJadibotOwner(jadibotId, m.sender) ||
        m.sender === sock.user?.id?.split(":")[0] + "@s.whatsapp.net";
      m.isPremium = isJadibotPremium(jadibotId, m.sender) || m.isOwner;
    }

    // --- 3. ANTIDANA ---
    if (m.isGroup && isDanaScam && handleDanaScam) {
      const groupData = db.getGroup(m.chat) || {};
      if (groupData.antidana && !m.isAdmin && !m.isOwner) {
        const textToCheck = m.body || m.text || "";
        if (isDanaScam(textToCheck)) {
          console.log(`[ANTIDANA] Scam detected from ${m.sender}`);
          await handleDanaScam(m, sock, db);
          return;
        }
      }
    }

    if (m.isGroup && isMuted && !m.isAdmin && !m.isOwner && !m.isPartner) {
      try {
        if (isMuted(m.chat, db)) {
          if (m.isBotAdmin) await sock.sendMessage(m.chat, { delete: m.key });
          return;
        }
      } catch (e) {}
    }

    if (config.features?.logMessage) {
      let groupName = "PRIVATE";
      if (m.isGroup) {
        const groupData = db.getGroup(m.chat);
        groupName = groupData?.name || "Unknown Group";
        if (groupName === "Unknown Group" || groupName === "Unknown") {
          sock
            .groupMetadata(m.chat)
            .then((meta) => {
              if (meta?.subject) db.setGroup(m.chat, { name: meta.subject });
            })
            .catch(() => {});
        }
      }

      if (!isJadibot) {
        logMessage({
          chatType: m.isGroup ? "group" : "private",
          groupName: groupName,
          pushName: m.pushName,
          sender: m.sender,
          message: m.body,
          messageType: m.type,
          isForwarded: m.message?.[m.type]?.contextInfo?.isForwarded || false,
          isNewsletter: !!m.message?.[m.type]?.contextInfo?.forwardedNewsletterMessageInfo,
        });
      }
    }


    if (checkAfk) {
checkAfk(m, sock).catch((e) => console.error('[checkAfk ERROR]', e));
    }

    if (m.isGroup && !isJadibot) {
      cacheMessageForAntiRemove(m, sock, db);
      const antilinkTriggered = await handleAntilink(m, sock, db);

      if (antilinkTriggered) return;

      const antilinkGcTriggered = await handleAntilinkGc(m, sock, db);
      if (antilinkGcTriggered) return;

      const antilinkAllTriggered = await handleAntilinkAll(m, sock, db);
      if (antilinkAllTriggered) return;

      const antiHidetagTriggered = await handleAntiHidetag(m, sock, db);
      if (antiHidetagTriggered) return;
      
      // --- ANTI STORY GRUP (antiswgc) ---
      {
        const rawMsg = m.message || {};
        const isGroupStatus = !!(
          rawMsg.groupStatusMessageV2 ||
          rawMsg.groupStatusMessage ||
          m.type === "groupStatusMessageV2"
        );
        if (isGroupStatus && !m.fromMe) {
          const grp = db.getGroup(m.chat) || {};
          if (grp.antiswgc === "on" && m.isBotAdmin && !m.isAdmin && !m.isOwner) {
            let deleted = false;
            try {
              await sock.sendMessage(m.chat, { delete: m.key });
              deleted = true;
            } catch (e) {
              console.error("[antiswgc] gagal hapus:", e.message);
            }
if (deleted) {
  const tag = `@${m.sender.split("@")[0]}`;
  try {
    if (grp.antiswgcWarn !== "on") {
      await sock.sendMessage(m.chat, {
        text:
          `🚫 *ᴀɴᴛɪsᴡɢᴄ*\n\n` +
          `> ${tag} dilarang posting story grup di sini~\n` +
          `> Story kamu sudah Ai hapus ya ✦\n\n` +
          `_Hanya admin yang boleh posting story grup~ 🌸_`,
        mentions: [m.sender],
      });
    } else {
      const fresh = db.getGroup(m.chat) || {};
      const LIMIT = fresh.antiswgcLimit || 3;
      const warns = { ...(fresh.antiswgcWarns || {}) };
      const count = (warns[m.sender] || 0) + 1;

      if (count >= LIMIT) {
        delete warns[m.sender];
        db.setGroup(m.chat, { ...fresh, antiswgcWarns: warns });
        await sock.sendMessage(m.chat, {
          text:
            `🚫 *ᴀɴᴛɪsᴡɢᴄ*\n\n` +
            `> ${tag} sudah ${LIMIT}x posting story grup~\n` +
            `> Ai keluarkan dari grup ya ✦`,
          mentions: [m.sender],
        });
        await sock.groupParticipantsUpdate(m.chat, [m.sender], "remove");
      } else {
        warns[m.sender] = count;
        db.setGroup(m.chat, { ...fresh, antiswgcWarns: warns });
        await sock.sendMessage(m.chat, {
          text:
            `🚫 *ᴀɴᴛɪsᴡɢᴄ*\n\n` +
            `> ${tag} dilarang posting story grup di sini~\n` +
            `> Warn: *${count}/${LIMIT}*\n\n` +
            `_Story kamu sudah Ai hapus ya~ 🌸_`,
          mentions: [m.sender],
        });
      }
    }
  } catch (e) {
    console.error("[antiswgc] gagal warn/kick:", e.message);
  }
}
            return;
          }
        }
      }

      if (checkAntidocument) {
          const isAntidocument = await checkAntidocument(m, sock, db);
          if (isAntidocument) return;
      }
      
      if (detectBot && !m.isOwner && !m.isAdmin) {
        try {
          const botDetected = await detectBot(m, sock);
          if (botDetected) return;
        } catch (e) {}
      }
      
      if (isMuted && !m.isAdmin && !m.isOwner) {
        try {
          if (isMuted(m.chat, db)) {
            if (m.isBotAdmin) await sock.sendMessage(m.chat, { delete: m.key });
            return;
          }
        } catch (e) {}
      }

      if (checkSpam && handleSpamAction && !m.isAdmin) {
        try {
          const isSpam = await checkSpam(m, sock, db);
          if (isSpam) {
            const delayKey = `${m.chat}_${m.sender}`;
            spamDelayTracker.set(delayKey, Date.now());
            await handleSpamAction(m, sock, db);
          }
        } catch (e) {}
      }

      if (checkSlowmode && !m.isAdmin && !m.isOwner) {
        try {
          const slowResult = checkSlowmode(m, sock, db);
          if (slowResult) {
            if (slowResult.mode === 'onlycommand') {
              if (m.isCommand) return;
            } else {
              await sock.sendMessage(m.chat, { delete: m.key });
              return;
            }
          }
        } catch (e) {}
      }
      
      if (isToxic && handleToxicMessage) {
        try {
          const groupData = db.getGroup(m.chat) || {};
          if (groupData.antitoxic && !m.isAdmin && !m.isOwner) {
            const toxicWords = groupData.toxicWords || [];
            const result = isToxic(m.body, toxicWords);
            if (result.toxic) {
              await handleToxicMessage(m, sock, db, result.word);
              return;
            }
          }
        } catch (e) {}
      }
    }

    const modeCheck = isJadibot ? { allowed: true } : checkMode(m);
    if (!modeCheck.allowed) {
      if (modeCheck.isAfk && m.isCommand) {
        await m.reply(modeCheck.afkMessage);
      } else if (modeCheck.hasJadibots && m.isCommand && !isJadibot) {
        await sock.sendMessage(
          m.chat,
          {
            text: modeCheck.jadibotMessage,
            contextInfo: {
              mentionedJid: modeCheck.jadibotMentions,
              externalAdReply: {
                title: `A C C E S  D E N I E D`,
                body: null,
                thumbnailUrl:
                  "https://cdn.gimita.id/download/unnamed%20(8)_1769331052275_d19c28da.jpg",
                sourceUrl: null,
                mediaType: 1,
                renderLargerThumbnail: true,
              },
            },
          },
          { quoted: m },
        );
      }
      return;
    }
    // --- FITUR BARU: ONLY OWNER PER GRUP ---
    if (m.isGroup) {
        const groupData = db.getGroup(m.chat) || {};
        if (groupData.onlyCmd) {
            // Logika: Hanya Owner bot atau User yang di-add manual yang bisa pakai
            const isAllowed = m.isOwner || m.isPartner || (groupData.allowedUsers && groupData.allowedUsers.includes(m.sender));
            
            // Jika tidak punya akses, bot langsung diam (return)
            if (!isAllowed) return; 
        }
    }
    if (m.isGroup) {
    const groupDataAdmin = db.getGroup(m.chat) || {}  // ✅ deklarasi baru
    if (groupDataAdmin.groupAdmin) {
        if (!m.isAdmin && !m.isOwner && m.isCommand) {
            return m.reply('Eeh~? Kamu minta aku buat lakuin itu? 🌟\n\nMaaf ya~ aku punya "aturan" di sini nee...\nHanya admin grup yang boleh pakai aku~ Bukan karena aku nggak mau, tapi karena aku sayang sama semua orang di sini 💕\n\n> Jadi admin dulu atau guna in di grup khusus bot ya, baru aku mau nurut~ ✨')
        }
     }
  }
        // --- FITUR GAK PEDULI ---
    if (m.isGroup && isIgnored) {
        if (isIgnored(m.chat, db)) {
            // Jika bukan Owner atau Partner, bot langsung "mati" (return)
            if (!m.isOwner && !m.isPartner) return; 
        }
    }

    // --- IGNORE PER-USER (dari .warn action ignore) ---
    if (m.isGroup && isUserIgnored) {
        if (isUserIgnored(m.chat, m.sender)) {
            if (!m.isOwner && !m.isPartner) return;
        }
    }

    // ---------------------------------------
    if (m.isBanned) {
      logger.warn("Banned user", m.sender);
      return;
    }
    
    // --- MAINTENANCE MODE ---
    try {
      const { isMaintenanceActive, getMaintenanceMsg } = require('../plugins/owner/maintenance')
      if (isMaintenanceActive(db) && !m.isOwner) {
        // Skip status WA, newsletter, dan broadcast — jangan dibalas
        const isStatusMsg = m.chat === 'status@broadcast' || m.chat?.endsWith('@newsletter') || m.chat?.endsWith('@broadcast')
        if (!isStatusMsg && m.isCommand) {
          await sock.sendMessage(m.chat, { text: getMaintenanceMsg(db) }, { quoted: m.raw })
        }
        return
      }
    } catch {}

    // --- SPECTATOR MODE ---
    if (isIgnoredUser && !m.isOwner) {
      const senderNum = m.sender?.replace(/[^0-9]/g, '')
      if (isIgnoredUser(senderNum, db)) return;
    }

    if (m.isGroup && m.isCommand && !m.isOwner) {
      const groupData = db.getGroup(m.chat) || {};
      if (groupData.isBanned) {
        // kalau mau nambih text juga boleh bang, pake m.reply atau sendMessage
        return null;
      }
    }

    const botId = sock.user?.id?.split(":")[0] || "unknown";
    const msgKey = `${botId}_${m.chat}_${m.sender}_${m.id}`;
    if (debounceMessage(msgKey)) {
      return;
    }

    if (config.features?.autoRead) {
      sock.readMessages([m.key]).catch(() => {});
    }
    if (!m.pushName || m.pushName === "Unknown" || m.pushName.trim() === "") {
  const _hasTebakSession = global.tebakPikiranSessions?.has(m.sender) || false
  const _hasWordleSession = global.wordleSessions?.has(m.sender) || global.wordleRooms?.has(m.chat) || false
  const _hasGameSession = hasActiveSession(m.chat) || _hasTebakSession || _hasWordleSession
  if (!m.isCommand && !m.isBot && !m.fromMe && !isJadibot && !_hasGameSession) {
    return;
  }
  m.pushName = m.sender?.split("@")[0] || "User";
}

    if (m.isCommand) {
      db.setUser(m.sender, {
        name: m.pushName,
        lastSeen: new Date().toISOString(),
      });
    }

    if (m.isGroup && incrementChatCount) {
      try {
        incrementChatCount(m.chat, m.sender, db);     
      } catch (e) {}
    }

    // Catat waktu terakhir owner nge-chat di grup (untuk cooldown autosambutowner)
    // Sesudah (BENAR - sambut dulu, baru update timestamp):
if (m.isGroup && m.isOwner) {
  try {
    const autoSambutMod = require('../plugins/group/autosambutowner');
    // Kirim sambutan jika owner sudah lama tidak chat
    const groupMeta = await getGroupMetadata(sock, m.chat);
    await autoSambutMod.handleAutoSambutOwner(sock, m.chat, m.sender, groupMeta, db);
    // Update timestamp SETELAH sambutan (agar cooldown dihitung dari sekarang)
    autoSambutMod.trackOwnerLastChat(m.chat, m.sender, db);
  } catch (e) {}
}

    const cmdVnEnabled = db.setting('cmdVn') || false;
    if (
      cmdVnEnabled &&
      m.type === 'audioMessage' &&
      !m.isCommand &&
      config.APIkey?.groq
    ) {
      try {
        const audioMsg = m.message?.audioMessage;
        const maxSize = 500 * 1024;
        if (audioMsg && (!audioMsg.fileLength || audioMsg.fileLength <= maxSize)) {
          const FormData = require('form-data');

          const buffer = await m.download();
          if (buffer && buffer.length > 1000) {
            const tmpDir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

            const inputFile = path.join(tmpDir, `vncmd_${Date.now()}.ogg`);
            const wavFile = path.join(tmpDir, `vncmd_${Date.now()}.wav`);

            fs.writeFileSync(inputFile, buffer);

            await new Promise((resolve, reject) => {
              exec(
                `ffmpeg -y -i "${inputFile}" -ar 16000 -ac 1 -f wav "${wavFile}"`,
                { timeout: 15000 },
                (err) => err ? reject(err) : resolve()
              );
            });

            const wavBuffer = fs.readFileSync(wavFile);
            const form = new FormData();
            form.append('file', wavBuffer, { filename: 'audio.wav', contentType: 'audio/wav' });
            form.append('model', 'whisper-large-v3');
            form.append('language', 'id');
            form.append('response_format', 'json');

            const { data } = await axios.post(
              'https://api.groq.com/openai/v1/audio/transcriptions',
              form,
              {
                headers: {
                  ...form.getHeaders(),
                  'Authorization': `Bearer ${config.APIkey.groq}`
                },
                timeout: 30000,
                maxContentLength: Infinity
              }
            );

            [inputFile, wavFile].forEach(f => { try { fs.unlinkSync(f); } catch {} });

            const transcript = (data.text || '').trim().toLowerCase()
              .replace(/[.,!?;:'"]/g, '').trim();

            if (transcript) {
              const words = transcript.split(/\s+/);
              const rawWord = words[0];
              const prefix = config.command?.prefix || '.';

              const allPlugins = getAllPlugins();
              const allNames = [];
              for (const p of allPlugins) {
                if (p.config?.name && typeof p.config.name === 'string') allNames.push(p.config.name.toLowerCase());
                if (Array.isArray(p.config?.alias)) {
                  for (const a of p.config.alias) {
                    if (a && typeof a === 'string') allNames.push(a.toLowerCase());
                  }
                }
              }

              let bestMatch = null;
              let bestScore = Infinity;

              for (const cmd of allNames) {
                if (cmd === rawWord) { bestMatch = cmd; bestScore = 0; break; }
                if (rawWord.startsWith(cmd) && cmd.length >= 3) {
                  const score = rawWord.length - cmd.length;
                  if (score < bestScore) { bestScore = score; bestMatch = cmd; }
                }
                const dist = levenshtein(rawWord, cmd);
                if (dist <= 3 && dist < bestScore) {
                  bestScore = dist;
                  bestMatch = cmd;
                }
              }

              if (bestMatch) {
                const commandArgs = words.slice(1).join(' ');
                m.body = `${prefix}${bestMatch}${commandArgs ? ' ' + commandArgs : ''}`;
                const { parseCommand } = require('./lib/serialize');
                const parsed = parseCommand(m.body, prefix);
                m.isCommand = parsed.isCommand;
                m.command = parsed.command;
                m.args = parsed.args;
                m.prefix = parsed.prefix;
                m.isVnCommand = true;
              }
            }
          }
        }
      } catch (e) {
        console.error('[CMD VN] Error:', e.message);
      }
    }



    if (m.body) {
      try {
        const userObj = db.getUser(m.sender) || db.setUser(m.sender);
        const levelHelper = require("./lib/levelHelper");
        if (levelHelper && levelHelper.addExpWithLevelCheck) {
            await levelHelper.addExpWithLevelCheck(sock, m, db, userObj, 5);
        }
      } catch (e) {
          console.error('[Level System] Error:', e.message);
      }
    }

    if (m.isGroup && isToxic && handleToxicMessage) {
      try {
        const groupData = db.getGroup(m.chat) || {};
        if (groupData.antitoxic && !m.isAdmin && !m.isOwner) {
          const toxicWords = groupData.toxicWords || [];
          const result = isToxic(m.body, toxicWords);
          if (result.toxic) {
            await handleToxicMessage(m, sock, db, result.word);
            return;
          }
        }
      } catch (e) {}
    }

    if (handleAutoAI && m.isGroup) {
      try {
        const aiHandled = await handleAutoAI(m, sock);
        if (aiHandled) return;
      } catch (e) {}
    }

    if (handleAutoDownload && m.body) {
      try {
        handleAutoDownload(m, sock, m.body);
      } catch (e) {}
    }

    try {
      const smartHandled = await handleSmartTriggers(m, sock, db);
      if (smartHandled) return;
    } catch (e) {}

    if (m.body?.startsWith(">>") && m.isOwner) {
      const code = m.body.slice(2).trim();
      if (!code) return;
      
      try {
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        
        const execCode = new AsyncFunction(
          "m", "sock", "db", "config", "require", "console",
          `
          const axios = require('axios');
          const fs = require('fs');
          const path = require('path');
          const os = require('os');
          const { promisify } = require('util');
          const exec = promisify(require('child_process').exec);
          
          ${code}
          `
        );
        
        const result = await execCode(m, sock, db, config, require, console);
        
        if (result !== undefined && result !== null) {
          const output = typeof result === 'object' 
            ? JSON.stringify(result, null, 2) 
            : String(result);
          
          if (output.length > 0) {
            await m.reply(`✅ *ᴇxᴇᴄ ʀᴇsᴜʟᴛ*\n\n\`\`\`\n${output.substring(0, 4000)}\n\`\`\``);
          }
        }
      } catch (execError) {
        await m.reply(`❌ *ᴇxᴇᴄ ᴇʀʀᴏʀ*\n\n\`\`\`\n${execError.message}\n\nStack:\n${execError.stack?.substring(0, 1000) || 'N/A'}\n\`\`\``);
      }
      return;
    }

    const hasSuitGame = global.suitGames && Object.values(global.suitGames).some(
      r => (r.chat === m.chat || !m.isGroup) && [r.p, r.p2].includes(m.sender)
    );

    const hasTTTGame = global.tictactoeGames && Object.values(global.tictactoeGames).some(
      r => r.state === 'PLAYING' && r.chat === m.chat &&
        [r.game.playerX, r.game.playerO].filter(Boolean).includes(m.sender)
    );
    
    const hasTTTv2Game = global.tictactoev2Games && Object.values(global.tictactoev2Games).some(
  r => r.state === 'PLAYING' && r.chat === m.chat &&
    [r.game.playerX, r.game.playerO].filter(Boolean).includes(m.sender)
);

    const hasUTGame = global.ulartanggaGames?.[m.chat]?.status === 'PLAYING';

    // +1 baris baru
    const hasSKGame = global.aiPanggung?.get(m.chat)?.aiStatusPanggung === 'aiTampil';

// || hasSKGame ditambah di ujung kondisi yang sudah ada
        if ((hasActiveSession(m.chat) && m.quoted) || hasSuitGame || hasTTTGame || hasTTTv2Game || hasUTGame || hasSKGame) {
      const gameHandled = await handleGameAnswer(m, sock);
      if (gameHandled) return;
    }

    // COUNT TOP AKTIF - WAJIB JALAN SEMUA PESAN
    if (m.isGroup && m.sender) {
      try {
        const fs = require('fs');
        const path = require('path');
        const DB_PATH = path.join(__dirname, '../database/other/topaktif.json');
        const T = global.__topaktif || (global.__topaktif = { db: null, timer: null });

        // Load sekali ke memori (aman kalau file kosong/rusak)
        if (!T.db) {
          T.db = {};
          try {
            if (fs.existsSync(DB_PATH)) {
              const raw = fs.readFileSync(DB_PATH, 'utf8').trim();
              if (raw) T.db = JSON.parse(raw);
            }
          } catch (e) {
            console.error('[TOPAKTIF] File rusak, mulai dari kosong:', e.message);
            try { fs.copyFileSync(DB_PATH, DB_PATH + '.corrupt'); } catch {}
            T.db = {};
          }
        }

        if (!T.db[m.chat]) T.db[m.chat] = {};
        T.db[m.chat][m.sender] = (T.db[m.chat][m.sender] || 0) + 1;

        // Simpan tiap 3 detik, atomic (tulis .tmp lalu rename)
        if (!T.timer) {
          T.timer = setTimeout(() => {
            T.timer = null;
            try {
              fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
              const tmp = DB_PATH + '.tmp';
              fs.writeFileSync(tmp, JSON.stringify(T.db));
              fs.renameSync(tmp, DB_PATH);
            } catch (e) {
              console.error('[TOPAKTIF] Gagal simpan:', e.message);
            }
          }, 3000);
        }
      } catch (e) {
        console.error('[TOPAKTIF] Error:', e.message);
      }

      try {
        require('./lib/groupActivity').recordMessage(m.chat, m.sender);
      } catch (e) {}
    }

    // ===== 🔥 FIX SIDER: UPDATE DATA REAL TIME & CEK WAKTU =====
    if (m.isGroup && m.sender && !m.fromMe && !m.isBot) {
        const pesanValid = [
            'conversation', 'extendedTextMessage', 
            'imageMessage', 'videoMessage', 
            'audioMessage', 'documentMessage',
            'stickerMessage', 'locationMessage'
        ].includes(m.type);

        if (pesanValid) {
            try {
                const SIDER_DB_PATH = path.join(__dirname, '../database/other/sider.json');
                let db = {};
                
                // Baca database jika ada
                if (fs.existsSync(SIDER_DB_PATH)) {
                    db = JSON.parse(fs.readFileSync(SIDER_DB_PATH, 'utf8'));
                }
                
                // Pastikan data grup ada & ada waktu mulai
                if (db[m.chat] && db[m.chat].startDate) {
                    const waktuMulai = new Date(db[m.chat].startDate).getTime();
                    const waktuSekarang = Date.now();
                    
                    // 🔑 KUNCI FIX: Hanya catat aktif kalau chatnya SETELAH waktu reset
                    if (waktuSekarang >= waktuMulai) {
                        if (!db[m.chat].activeUsers.includes(m.sender)) {
                            db[m.chat].activeUsers.push(m.sender);
                            fs.writeFileSync(SIDER_DB_PATH, JSON.stringify(db, null, 2));
                            console.log(`[SIDER ✅] ${m.sender.split('@')[0]} tercatat aktif`);
                        }
                    } else {
                        // Chat sebelum waktu reset, TIDAK DICATAT
                        console.log(`[SIDER ⏱️] ${m.sender.split('@')[0]} chat sebelum timer, skip.`);
                    }
                }

            } catch (e) {
                console.error('[SIDER DB UPDATE ERROR]', e.message);
            }
        }
    }
    // ============================================================



    if (!m.isCommand) {
      if (checkStickerCommand && m.message?.stickerMessage) {
        try {
          const stickerCmd = checkStickerCommand(m);
          if (stickerCmd) {
            m.isCommand = true;
            m.command = stickerCmd;
            m.prefix = ".";
            m.text = stickerCmd;
            m.args = [];
          }
        } catch (e) {}
      }

      if (!m.isCommand) {
        const hasWordleSession = global.wordleSessions?.has(m.sender) || global.wordleRooms?.has(m.chat)
        const hasTebakPikiranSession = global.tebakPikiranSessions?.has(m.sender) || false
        if (hasActiveSession(m.chat) || hasWordleSession || hasTebakPikiranSession) {
          const gameHandled = await handleGameAnswer(m, sock);
          if (gameHandled) return;
        }

        const smartHandled = await handleSmartTriggers(m, sock, db);
        if (smartHandled) return;
          if (m.body?.startsWith('__audio__') || m.body?.startsWith('__doc__')) {
    try {
        const ytmp3Plugin = require("../plugins/download/ytmp3");
        if (ytmp3Plugin.handleReply) {
            const handled = await ytmp3Plugin.handleReply(m, { sock });
            if (handled) return;
        }
    } catch (e) {}
}
        if (m.quoted?.id && global.ytdlSessions?.has(m.quoted.id)) {
          try {
            const ytmp4Plugin = require("../plugins/download/ytmp4");
            if (ytmp4Plugin.handleReply) {
              const handled = await ytmp4Plugin.handleReply(m, { sock });
              if (handled) return;
            }
          } catch (e) {}
        }

        if (m.quoted?.id && global.confessData?.has(m.quoted.id)) {
          try {
            const confessPlugin = require("../plugins/fun/confess");
            if (confessPlugin.replyHandler) {
              const handled = await confessPlugin.replyHandler(m, { sock });
              if (handled) return;
            }
          } catch (e) {}
        }

        if (m.quoted?.id && global.sulapSessions?.has(m.quoted.id)) {
          try {
            const sulapPlugin = require("../plugins/fun/sulap");
            if (sulapPlugin.replyHandler) {
              const handled = await sulapPlugin.replyHandler(m, sock);
              if (handled) return;
            }
          } catch (e) {}
        }

        // ── Lapor Bug: owner reply pesan laporan → forward ke user/GC asal ──
        if (m.isOwner && m.quoted?.id) {
          try {
            const laporPlugin = require("../plugins/tools/lapor");
            if (laporPlugin.replyHandler) {
              const handled = await laporPlugin.replyHandler(m, { sock });
              if (handled) return;
            }
          } catch (e) {}
        }



        if (autoStickerHandler && m.isGroup) {
          autoStickerHandler(m, sock).catch(() => {});
        }

        if (autoMediaHandler && m.isGroup) {
          autoMediaHandler(m, sock).catch(() => {});
        }

        if (checkAntisticker && m.isGroup) {
            const stickerHandled = await checkAntisticker(m, sock, db);
         if (stickerHandled) return;
        }

        if (checkAntimedia && m.isGroup) {
          const mediaHandled = await checkAntimedia(m, sock, db);
          if (mediaHandled) return;
        }
        
        return;
      }
    }

    const delayKey = `${m.chat}_${m.sender}`;
    if (!m.isOwner && !m.isPartner) {
      const lastSpamDetect = spamDelayTracker.get(delayKey);
      if (lastSpamDetect) {
        const elapsed = Date.now() - lastSpamDetect;
        if (elapsed < 15000) {
          // Turun dari 3000ms → 1000ms dan window dari 60s → 15s
          await new Promise((r) => setTimeout(r, 1000));
        } else {
          spamDelayTracker.delete(delayKey);
        }
      }
    }

    const spamKey = `${botId}_${m.sender}`;
    // Owner & partner tidak kena rate limit global supaya cmd beruntun tidak terblokir
    if (!m.isOwner && !m.isPartner && await isSpamming(spamKey)) {
      return;
    }

    const storeData = db.setting("storeList") || {};
    const storeCommand = storeData[m.command.toLowerCase()];

    if (m.isGroup) {
      const groupData = db.getGroup(m.chat) || {};
      const botMode = groupData.botMode || "md";

      if (botMode === "store" && storeCommand) {
        storeData[m.command.toLowerCase()].views =
          (storeCommand.views || 0) + 1;
        db.setting("storeList", storeData);

        const caption =
          `📦 *${m.command.toUpperCase()}*\n\n` +
          `${storeCommand.content}\n\n` +
          `───────────────\n` +
          `> 👁️ Views: ${storeData[m.command.toLowerCase()].views}\n` +
          `> 💳 Ketik \`${m.prefix}payment\` untuk bayar`;

        if (storeCommand.hasImage && storeCommand.imagePath) {
          const fs = require("fs");
          if (fs.existsSync(storeCommand.imagePath)) {
            const imageBuffer = getCachedThumb(storeCommand.imagePath);
            await sock.sendMessage(
              m.chat,
              {
                image: imageBuffer,
                caption: caption,
              },
              { quoted: m },
            );
            return;
          }
        }

        await m.reply(caption);
        return;
      }
    }

    try {
      const caseResult = await handleCaseCommand(m, sock, m.command);
      if (caseResult && caseResult.handled) {
        if (config.dev?.debugLog) {
          logger.success('Case', `Handled: ${m.command}`);
        }
        return;
      }
    } catch (caseError) {
  logger.error('Case System', caseError.message);
  console.error("[Case Stack]", caseError.stack);   // ← tambahin ini
  if (config.dev?.debugLog) {
    console.error('[CaseSystem] Stack:', caseError.stack);
  }
}

    let plugin = getPlugin(m.command);

    if (!plugin) {
      if (storeCommand) {
        storeData[m.command.toLowerCase()].views =
          (storeCommand.views || 0) + 1;
        db.setting("storeList", storeData);

        const caption =
          `📦 *${m.command.toUpperCase()}*\n\n` +
          `${storeCommand.content}\n\n` +
          `───────────────\n` +
          `> 👁️ Views: ${storeData[m.command.toLowerCase()].views}\n` +
          `> 💳 Ketik \`${m.prefix}payment\` untuk bayar`;

        if (storeCommand.hasImage && storeCommand.imagePath) {
          const fs = require("fs");
          if (fs.existsSync(storeCommand.imagePath)) {
            const imageBuffer = getCachedThumb(storeCommand.imagePath);
            await sock.sendMessage(
              m.chat,
              {
                image: imageBuffer,
                caption: caption,
              },
              { quoted: m },
            );
            return;
          }
        }

        await m.reply(caption);
        return;
      }

      const storeCommands = Object.keys(storeData);
      const allCommands = [...getAllCommandNames(), ...storeCommands];
      
      const similarityEnabled = db.setting('similarity') !== false
      
      if (similarityEnabled) {
          const suggestions = findSimilarCommands(m.command, allCommands, {
            maxResults: 1,
            minSimilarity: 0.6,
            maxDistance: 3,
          });
    
          if (suggestions.length > 0) {
            const result = await formatSuggestionMessage(
              m.command,
              suggestions,
              m.prefix,
              m,
              { sock, botConfig: config, db }
            );
            if (result && !result.sent) {
              await sock.sendMessage(
                m.chat,
                { text: result.message },
                { quoted: m }
              );
            }
          }
      }

      return;
    }

    if (!plugin.config.isEnabled) {
      return;
    }

    // --- OTAK-ATIK CHECK ---
    // plugin.config.name di sini udah dijamin primary name yang bener
    // (getPlugin() di atas udah resolve alias -> plugin aslinya),
    // jadi gak akan ketuker sama plugin lain yang kebetulan mirip alias.
    if (underDevStore.isMarked(plugin.config.name) && !m.isOwner) {
      await sendUnderDev(m);
      return;
    }

    if (m.isGroup) {
      const groupData = db.getGroup(m.chat) || {};
      let botMode = groupData.botMode || "md";
      const pluginCategory = plugin.config.category?.toLowerCase();
      const baseAllowed = ["main", "group", "sticker", "owner"];

      if (isJadibot) {
        botMode = "md";

        const jadibotBlockedCategories = [
          "owner",
          "sewa",
          "panel",
          "store",
          "pushkontak",
        ];
        const jadibotBlockedCommands = [
          "sewa",
          "sewabot",
          "sewalist",
          "listsewa",
          "addsewa",
          "delsewa",
          "extendsewa",
          "checksewa",
          "sewainfo",
          "sewagroup",
          "stopsewa",
          "jadibot",
          "stopjadibot",
          "listjadibot",
          "addowner",
          "delowner",
          "ownerlist",
          "listowner",
          "self",
          "public",
          "botmode",
          "restart",
          "shutdown",
        ];

        if (
          jadibotBlockedCategories.includes(pluginCategory) ||
          jadibotBlockedCommands.includes(m.command.toLowerCase())
        ) {
          return m.reply(
            `⚠️ *ᴀᴋsᴇs ᴛᴇʀʙᴀᴛᴀs*\n\n` +
              `Eeh~ maaf ya, fitur ini cuma ada di bot utama~ aku nggak bisa bantu dari sini~ 🌸\n` +
              `Hubungi owner bot utama ya untuk info lebih lanjut~ 💕`,
          );
        }
      }

      const modeConfig = {
        md: {
          allowed: null,
          excluded: ["pushkontak", "store", "panel", "otp"],
          name: "Multi Device",
        },
        cpanel: { allowed: [...baseAllowed, "tools", "panel"], name: "CPanel" },
        pushkontak: {
          allowed: [...baseAllowed, "pushkontak"],
          name: "Push Kontak",
        },
        store: { allowed: [...baseAllowed, "store"], name: "Store" },
        otp: { allowed: [...baseAllowed, "otp"], name: "OTP" },
      };

      const categoryModeMap = {
        download: "md",
        search: "md",
        ai: "md",
        fun: "md",
        game: "md",
        media: "md",
        utility: "md",
        tools: "md",
        ephoto: "md",
        religi: "md",
        info: "md",
        panel: "cpanel",
        pushkontak: "pushkontak",
        store: "store",
        otp: "otp",
        jpm: "md",
      };

      const currentConfig = modeConfig[botMode] || modeConfig.md;

      if (
        m.command !== "botmode" &&
        m.command !== "menu" &&
        m.command !== "menuhsn"
      ) {
        let isBlocked = false;

        if (
          currentConfig.allowed &&
          !currentConfig.allowed.includes(pluginCategory)
        ) {
          isBlocked = true;
        }
        if (
          currentConfig.excluded &&
          currentConfig.excluded.includes(pluginCategory)
        ) {
          isBlocked = true;
        }

        if (isBlocked) {
          const suggestedMode = categoryModeMap[pluginCategory] || "md";
          const suggestedModeName =
            modeConfig[suggestedMode]?.name || "Multi Device";

          await m.reply(
            `🔒 *ᴄᴏᴍᴍᴀɴᴅ ᴛɪᴅᴀᴋ ᴛᴇʀsᴇᴅɪᴀ*\n\n` +
              `Muu~ aku lagi dalam mode *${currentConfig.name}* nih~\n` +
              `Command \`${m.prefix}${m.command}\` cuma tersedia di mode *${suggestedModeName}*~ 🌸\n\n` +
              `💡 Minta admin grup ganti mode dulu ya~:\n` +
              `\`${m.prefix}botmode ${suggestedMode}\``,
          );
          return;
        }
      }
    }

    const permission = checkPermission(m, plugin.config);
    if (!permission.allowed) {
      await m.reply(permission.reason);
      return;
    }

    // ── Ban Kategori check ────────────────────────────────────────────────────
    try {
      const { isCategoryBanned } = require('../plugins/owner/bankategori')
      const pluginCategory = plugin.config.category?.toLowerCase()
      if (isCategoryBanned(pluginCategory, m, db)) {
        return m.reply(
          `🚫 *ᴋᴀᴛᴇɢᴏʀɪ ᴅɪʙʟᴏᴋɪʀ*\n\n` +
          `> Kategori \`${pluginCategory}\` tidak bisa dipakai di sini~\n` +
          `> Hubungi owner jika ada pertanyaan~ 🌸`
        )
      }
    } catch {}
    
    const registrationRequired =
      db.setting("registrationRequired") ??
      config.registration?.enabled ??
      false;
    if (registrationRequired && !plugin.config.skipRegistration) {
      const user = db.getUser(m.sender);
      if (!m.isOwner && !m.isPartner && !m.isPremium && !user?.isRegistered) {
        await m.reply(
          `📝 *ᴡᴀᴊɪʙ ᴅᴀꜰᴛᴀʀ*\n\n` +
            `Eeh~ kamu belum daftar lho! Daftar dulu dong biar aku bisa bantu~ 🌸\n\n` +
            `> Ketik: \`${m.prefix}daftar <nama>\`\n\n` +
            `*Contoh:* \`${m.prefix}daftar ${m.pushName || "NamaKamu"}\``,
        );
        return;
      }
    }

    const user = db.getUser(m.sender);

    if (!m.isOwner && !m.isPartner && plugin.config.cooldown > 0) {
      const cooldownRemaining = db.checkCooldown(
        m.sender,
        m.command,
        plugin.config.cooldown,
      );
      if (cooldownRemaining) {
        m.react('⏱️').catch(() => {})
        const menit = Math.floor(cooldownRemaining / 60)
        const detik = cooldownRemaining % 60
        const waktu = menit > 0
          ? `${menit} menit ${detik} detik`
          : `${detik} detik`
        await m.reply(
          `⏱️ *Sabar dulu ya~!*\n\n` +
          `Command \`.${m.command}\` masih dalam cooldown~\n` +
          `╭┈┈⬡「 🕐 *ᴄᴏᴏʟᴅᴏᴡɴ* 」\n` +
          `┃ ✦ Sisa waktu : *${waktu}*\n` +
          `┃ ✦ Command    : *${m.prefix}${m.command}*\n` +
          `╰┈┈┈┈┈┈┈┈⬡\n\n` +
          `_Tunggu sebentar ya, aku juga butuh istirahat~ 💕_`
        ).catch(() => {})
        return;
      }
    }

    const energiEnabled = db.setting('energi') !== undefined ? db.setting('energi') : (config.energi?.enabled !== false)
    if (energiEnabled && plugin.config.energi > 0) {
      const ownerEnergi = config.energi?.owner ?? -1;
      const premiumEnergi = config.energi?.premium ?? -1;

      if ((m.isOwner || m.isPartner) && ownerEnergi === -1) {
      } else if ((m.isOwner || m.isPartner)) {
        const currentEnergi = user?.energi || ownerEnergi;
        if (currentEnergi < plugin.config.energi) {
          await m.reply(config.messages?.energiExceeded || "Muu~ energinya habis nih~ Tunggu dulu ya biar aku isi ulang! ⚡💕");
          return;
        }
        db.updateEnergi(m.sender, -plugin.config.energi);
      } else if (m.isPremium && (premiumEnergi === -1 || user?.energi === -1)) {
      } else if (m.isPremium) {
        const currentEnergi = user?.energi || premiumEnergi;
        if (currentEnergi < plugin.config.energi) {
          await m.reply(config.messages?.energiExceeded || "Muu~ energinya habis nih~ Tunggu dulu ya biar aku isi ulang! ⚡💕");
          return;
        }
        db.updateEnergi(m.sender, -plugin.config.energi);
      } else {
        // -1 = unlimited, skip cek dan deduct
        if (user?.energi === -1) {
          // unlimited, langsung lanjut
        } else {
          const currentEnergi = user?.energi || 0;
          if (currentEnergi < plugin.config.energi) {
            await m.reply(config.messages?.energiExceeded || "Muu~ energinya habis nih~ Tunggu dulu ya biar aku isi ulang! ⚡💕");
            return;
          }
          db.updateEnergi(m.sender, -plugin.config.energi);
        }
      }
    }

    if (checkRateLimit) {
      const blocked = await checkRateLimit(m, sock, db).catch(() => false);
      if (blocked) return;
    }

    if (config.features?.autoTyping) {
      await sock.sendPresenceUpdate("composing", m.chat);
    }

    const context = {
  sock,
  m,
  config,
  db,
  uptime: getUptime(),
  plugins: {
    count: getPluginCount(),
  },
  jadibotId: jadibotId,
  isJadibot: isJadibot,
  args: m.args || [],
  command: m.command || null,
};

    // Log command execution with box style
    const chatType = m.isGroup ? "group" : "private";
    if (!isJadibot) {
      logCommand(`${m.prefix}${m.command}`, m.pushName, chatType);
    }

    if (m.isGroup && m.sender) {
      try {
        require('./lib/groupActivity').recordCommand(m.chat, m.sender, m.command);
      } catch (e) {}
    }

    // ── Auto-buffer wrapper: download media URL sebelum kirim ke WA ─────────
    const _origSendMessage = sock.sendMessage.bind(sock)
    sock.sendMessage = async (jid, content, opts) => {
      const mediaKeys = ['video', 'image', 'audio', 'sticker']
      for (const key of mediaKeys) {
        if (content?.[key]?.url && typeof content[key].url === 'string') {
          try {
            const axios = require('axios')
            const res = await axios.get(content[key].url, {
              responseType: 'arraybuffer',
              timeout: 60000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.tiktok.com/'
              }
            })
            content[key] = Buffer.from(res.data)
          } catch (e) {
            // gagal download buffer, biarkan URL langsung
          }
        }
      }
      return _origSendMessage(jid, content, opts)
    }

    let pluginSuccess = false;
    try {
      await plugin.handler(m, context);
      pluginSuccess = true;
    } catch (pluginError) {
      throw pluginError;
    }

    if (pluginSuccess && !m.isOwner && !m.isPartner && plugin.config.cooldown > 0) {
      db.setCooldown(m.sender, m.command, plugin.config.cooldown);
    }

    db.incrementStat("commandsExecuted");
    db.incrementStat(`command_${m.command}`);
    
    // Track per-group feature usage (exclude owner-only commands)
    if (m.isGroup && !plugin.config.isOwner) {
      try {
        const grp = db.getGroup(m.chat) || {}
        if (!grp.featureStats) grp.featureStats = {}
        const cmdKey = m.command.toLowerCase()
        grp.featureStats[cmdKey] = (grp.featureStats[cmdKey] || 0) + 1
        db.setGroup(m.chat, grp)
      } catch {}
    }

    if (config.features?.autoTyping) {
      await sock.sendPresenceUpdate("paused", m.chat);
    }
  } catch (error) {
    // rate-overlimit = WA server throttle kita karena kirim terlalu cepat
    // Jangan balas user, cukup log dan tunggu sebentar
    if (
      error.message?.includes('rate-overlimit') ||
      error.message?.includes('rate_overlimit') ||
      error.message?.includes('429') ||
      error?.output?.statusCode === 429
    ) {
      logger.warn("Handler", `rate-overlimit terdeteksi, pause 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
      return;
    }

    logError(error, {
      command: m?.command || null,
      sender:  m?.sender  || null,
      chat:    m?.chat    || null,
      args:    m?.args    || null,
  })
  logger.error("Handler", error.message);
  console.error("[Handler Stack]", error.stack);   // ← tambahin ini

    try {
      if (m) {
        await m.reply(
          createErrorMessage("Kyaa~ ada yang salah nih waktu aku proses~ Maaf ya, coba lagi nanti~ 🙏💕"),
        );
      }
    } catch {
      logger.error("Failed to send error message");
    }
  }
}

/**
 * Handler untuk update group participants
 * @param {Object} update - Update data
 * @param {Object} sock - Socket connection
 * @returns {Promise<void>}
 */
async function groupHandler(update, sock) {
  try {
    if (global.sewaLeaving) return;

    const { id: groupJid, participants, action } = update;

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return;
    }

    const db = getDatabase();

    let groupData = db.getGroup(groupJid);
    if (!groupData) {
      db.setGroup(groupJid, {
        welcome: config.welcome?.defaultEnabled ?? true,
        goodbye: config.goodbye?.defaultEnabled ?? true,
        leave: config.goodbye?.defaultEnabled ?? true,
      });
      groupData = db.getGroup(groupJid);
    }

    let groupMeta;
    try {
      groupMeta = await sock.groupMetadata(groupJid);
      setGroupMetadata(groupJid, groupMeta);

      if (groupMeta?.participants) {
        cacheParticipantLids(groupMeta.participants);
      }
    } catch (e) {
      if (
        e.message?.includes("forbidden") ||
        e.message?.includes("401") ||
        e.message?.includes("403")
      ) {
        return;
      }
      throw e;
    }

    let sendWelcomeMessage, sendGoodbyeMessage;
    try {
      sendWelcomeMessage =
        require("../plugins/group/welcome").sendWelcomeMessage;
      sendGoodbyeMessage =
        require("../plugins/group/goodbye").sendGoodbyeMessage;
    } catch (e) {}

    let handleAutoSambutOwner = null;
    let trackOwnerLastChat = null;
    try {
      const autoSambutMod = require("../plugins/group/autosambutowner");
      handleAutoSambutOwner = autoSambutMod.handleAutoSambutOwner;
      trackOwnerLastChat = autoSambutMod.trackOwnerLastChat;
    } catch (e) {}

    for (let participant of participants) {
      let participantJid;
      
      if (typeof participant === 'object' && participant !== null) {
        participantJid = participant.jid || participant.id || participant.lid || '';
      } else {
        participantJid = participant;
      }
      
      if (!participantJid || typeof participantJid !== 'string') continue;
      
      if (isLid(participantJid) || isLidConverted(participantJid)) {
        const found = groupMeta.participants?.find(
          (p) =>
            p.id === participantJid ||
            p.lid === participantJid ||
            p.lid === participantJid.replace("@s.whatsapp.net", "@lid"),
        );
        if (found) {
          participantJid =
            found.jid &&
            !found.jid.endsWith("@lid") &&
            !isLidConverted(found.jid)
              ? found.jid
              : found.id &&
                  !found.id.endsWith("@lid") &&
                  !isLidConverted(found.id)
                ? found.id
                : lidToJid(participantJid);
        } else {
          participantJid = lidToJid(participantJid);
        }
      }
      
      participant = participantJid;

      if (action === "add" && sendWelcomeMessage) {
        await sendWelcomeMessage(sock, groupJid, participant, groupMeta);
      }

      // --- AUTO SAMBUT OWNER ---
      if (action === "add" && handleAutoSambutOwner) {
        await handleAutoSambutOwner(sock, groupJid, participant, groupMeta, db);
      }

      if (action === "remove" && sendGoodbyeMessage) {
        await sendGoodbyeMessage(sock, groupJid, participant, groupMeta);
      }

      const saluranId = config.saluran?.id || "https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o";
      const saluranName =
        config.saluran?.name || config.bot?.name || "Ourin-AI";

      let groupPpUrl = await sock.profilePictureUrl(groupJid, "image")

      if (action === "promote" && groupData.notifPromote === true) {
        const author = update.author || null;
        let promotedBy = "";
        if (author) {
          try {
            const authorName = await sock.getName(author);
            promotedBy = authorName || author.split("@")[0];
          } catch {
            promotedBy = author.split("@")[0];
          }
        }
          await sock.sendMedia(groupJid, (await hsAsset.buffer('images/hsnai-promote')), `🌟 Wah selamat ya @${participant.split("@")[0]}~ kamu jadi admin baru! Semangat ya~ 💕\nPromoted by: @${author.split("@")[0]}`, null, {
          type: 'image',
          mentions: author ? [participant, author] : [participant],
          contextInfo: {
            mentionedJid: author ? [participant, author] : [participant],
            forwardingScore: 7,
            isForwarded: true,
            externalAdReply: {
              title: "🎉 PROMOTE",
              body: `Notifikasi Group`,
              thumbnailUrl: groupPpUrl,
              mediaType: 1,
              renderLargerThumbnail: false,
              sourceUrl: "",
            },
          },
        })
      }

      if (action === "demote" && groupData.notifDemote === true) {
        const author = update.author || null;
        await sock.sendMedia(groupJid, (await hsAsset.buffer('images/hsnai-demote')), `Muu~ @${participant.split("@")[0]} udah nggak jadi admin lagi nih~\nDemoted by: @${author.split("@")[0]}`, null, {
          type: 'image',
          mentions: author ? [participant, author] : [participant],
          contextInfo: {
            mentionedJid: author ? [participant, author] : [participant],
            forwardingScore: 7,
            isForwarded: true,
            externalAdReply: {
              title: "📉 DEMOTE",
              body: `Notifikasi Group`,
              thumbnailUrl: groupPpUrl,
              mediaType: 1,
              renderLargerThumbnail: false,
              sourceUrl: "",
            },
          },
        })
      }
    }
  } catch (error) {
    console.error("[GroupHandler] Error:", error.message);
  }
}

async function messageUpdateHandler(updates, sock) {
  const db = getDatabase();

  for (const update of updates) {
    try {
      await handleAntiRemove(update, sock, db)
    } catch (error) {}  // ← jangan continue, biarkan lanjut

    try {
      await handleCidukDelete(update, sock, db)
    } catch (error) {}  // ← sama

    try {
      const editedMsg = update.update?.message?.editedMessage?.message;
      const regularMsg = update.update?.message;

      const resolvedMessage = editedMsg || (regularMsg && !regularMsg.protocolMessage ? regularMsg : null);

      if (!resolvedMessage) continue;

      const newMsg = {
        key: update.key,
        message: editedMsg ? { ...resolvedMessage } : regularMsg,
        messageTimestamp: update.messageTimestamp || Math.floor(Date.now() / 1000),
        pushName: update.pushName || "User",
      };

      await messageHandler(newMsg, sock);
    } catch (error) {
      console.error("[MsgUpdate] Error:", error.message);
    }
  }
}

/**
 * Cache untuk menyimpan state terakhir grup
 * Format: { groupId: { announce: boolean, restrict: boolean, lastUpdate: timestamp } }
 */
const groupSettingsCache = new Map();

/**
 * Debounce cooldown untuk mencegah spam (dalam ms)
 */
const GROUP_SETTINGS_COOLDOWN = 1000;

async function groupSettingsHandler(update, sock) {
  try {
    if (global.sewaLeaving) return;
    if (global.isFetchingGroups) return;

    const groupId = update.id;
    if (!groupId || !groupId.endsWith("@g.us")) return;

    if (update.announce === undefined && update.restrict === undefined) {
      return;
    }

    const cached = groupSettingsCache.get(groupId) || {};
    const now = Date.now();

    if (
      cached.lastUpdate &&
      now - cached.lastUpdate < GROUP_SETTINGS_COOLDOWN
    ) {
      return;
    }

    let hasRealChange = false;
    if (update.announce !== undefined) {
      if (cached.announce === undefined) {
        cached.announce = update.announce;
      } else if (cached.announce !== update.announce) {
        hasRealChange = true;

        const db = getDatabase();
        const groupData = db.getGroup(groupId) || {};

        const saluranId = config.saluran?.id || "https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o";
        const saluranName =
          config.saluran?.name || config.bot?.name || "Ourin-AI";
        const freshGroupMeta = await sock.groupMetadata(groupId);
        setGroupMetadata(groupId, freshGroupMeta);
        const groupName = freshGroupMeta.subject
        const groupPpUrl = await sock.profilePictureUrl(groupId, "image")
        const zannContext = {
         contextInfo: {
           forwardingScore: 9,
          isForwarded: true,
          externalAdReply: {
            showAdAttribution: false,
            title: "GRUP NOTIFIKASI",
            body: config.bot?.name,
            thumbnailUrl: groupPpUrl,
            mediaType: 1,
            renderLargerThumbnail: false,
            sourceUrl: "",
          },
         }
        }
        if (update.announce === true && groupData.notifCloseGroup === true) {
          await sock.sendText(groupId, `Nee~ Grup *${groupName}* ditutup sama admin~ Sabar ya~ 🌸`, null, zannContext)
        }

        if (update.announce === false && groupData.notifOpenGroup === true) {
          await sock.sendText(groupId, `Yay~ Grup *${groupName}* dibuka lagi sama admin! Ayo ngobrol~ ✨💕`, null, zannContext)
        }

        cached.announce = update.announce;
      }
    }

    if (update.restrict !== undefined) {
      if (cached.restrict === undefined) {
        cached.restrict = update.restrict;
      } else if (cached.restrict !== update.restrict) {
        hasRealChange = true;
        const saluranIdR =
          config.saluran?.id || "https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o";
        const saluranNameR =
          config.saluran?.name || config.bot?.name || "Ourin-AI";

        if (update.restrict === true) {
          await sock.sendText(groupId, `Muu~ Info Grup *${groupName}* lagi dibatasi~\nCuma admin yang bisa edit grup sekarang ya~ 🌸`, null, zannContext)
        } else {
          await sock.sendText(groupId, `Yay~ Info Grup *${groupName}* udah terbuka lagi!\nSemua member bisa edit grup sekarang~ ✨💕`, null, zannContext)
        }
        cached.restrict = update.restrict;
      }
    }
    if (hasRealChange) {
      cached.lastUpdate = now;
    }
    if (cached.announce !== undefined || cached.restrict !== undefined) {
      groupSettingsCache.set(groupId, cached);
    }
  } catch (error) {
    console.error("[GroupSettings] Error:", error.message);
  }
}

module.exports = {
  messageHandler,
  groupHandler,
  messageUpdateHandler,
  groupSettingsHandler,
  checkPermission,
  checkMode,
  isSpamming,
};
