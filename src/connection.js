const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} = require("hsnai");
const { Extend } = require("@itsliaaa/starcore");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const NodeCache = require("node-cache");
const config = require("../config");
const colors = require("./lib/colors");
const { extendSocket } = require("./lib/sockHelper");
const { isLid, lidToJid, decodeAndNormalize } = require("./lib/lidHelper");
const { initAutoBackup } = require("./lib/autoBackup");
const { cacheRawContext } = require("./lib/rawContextCache");
const util = require("yt-search");

const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false });
const processedMessages = new NodeCache({ stdTTL: 30, useClones: false });
const msgRetryCounterCache = new NodeCache({ stdTTL: 60, useClones: false });
// Nyimpen versi TERBARU pesan yang diedit (termasuk edit dari bot sendiri, misal
// variant reply V12). Ini dipakai getMessage() supaya kalau ada retry request dari
// WA (device penerima minta pesan dikirim ulang), yang dikirim ulang adalah versi
// terbaru, bukan versi awal/stale yang masih nyangkut di `store`.
const editedMessageCache = new NodeCache({ stdTTL: 300, useClones: false });

let lastMessageReceived = Date.now();
let watchdogTimer = null;
const WATCHDOG_TIMEOUT = 10 * 60 * 1000;
const WATCHDOG_CHECK_INTERVAL = 60 * 1000;

function startWatchdog(reconnectFn, options) {
  if (watchdogTimer) clearInterval(watchdogTimer);
  lastMessageReceived = Date.now();

  watchdogTimer = setInterval(() => {
    const silentMs = Date.now() - lastMessageReceived;
    if (silentMs > WATCHDOG_TIMEOUT && connectionState.isReady) {
      colors.logger.warn('watchdog', `Pesan tidak terdeteksi, maka sistem akan me restart, supaya fresh`);
      connectionState.isReady = false;
      connectionState.isConnected = false;
      try { connectionState.sock?.end(); } catch {}
    }
  }, WATCHDOG_CHECK_INTERVAL);

  if (watchdogTimer.unref) watchdogTimer.unref();
  colors.logger.success('watchdog', `aktif, batas waktu ${WATCHDOG_TIMEOUT / 60000} menit`);
}

function stopWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}

let store = null; // di-init async nanti

/**
 * @typedef {Object} ConnectionState
 * @property {boolean} isConnected - Status koneksi
 * @property {Object|null} sock - Socket instance
 * @property {number} reconnectAttempts - Jumlah percobaan reconnect
 * @property {Date|null} connectedAt - Waktu koneksi berhasil
 */

/**
 * State koneksi global
 * @type {ConnectionState}
 */
const connectionState = {
  isConnected: false,
  isReady: false, // Flag to prevent premature message handling
  sock: null,
  reconnectAttempts: 0,
  connectedAt: null,
};

/**
 * Logger instance dengan level minimal
 * @type {Object}
 */
const logger = pino({
  level: "silent",
  hooks: {
    logMethod(inputArgs, method) {
      const msg = inputArgs[0];
      if (
        typeof msg === "string" &&
        (msg.includes("Closing") ||
          msg.includes("session") ||
          msg.includes("SessionEntry") ||
          msg.includes("prekey"))
      ) {
        return;
      }
      return method.apply(this, inputArgs);
    },
  },
});

/**
 * Interface untuk input terminal
 * @type {readline.Interface|null}
 */
let rl = null;

/**
 * Membuat readline interface
 * @returns {readline.Interface}
 */
function createReadlineInterface() {
  if (rl) {
    rl.close();
  }
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return rl;
}

/**
 * Prompt untuk input
 * @param {string} question - Pertanyaan
 * @returns {Promise<string>} Input dari user
 */
function askQuestion(question) {
  return new Promise((resolve) => {
    const interface = createReadlineInterface();
    interface.question(question, (answer) => {
      interface.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Memulai koneksi WhatsApp
 * @param {Object} options - Opsi koneksi
 * @param {Function} [options.onMessage] - Callback untuk pesan baru
 * @param {Function} [options.onConnectionUpdate] - Callback untuk update koneksi
 * @param {Function} [options.onGroupUpdate] - Callback untuk update group
 * @returns {Promise<Object>} Socket connection
 * @example
 * const sock = await startConnection({
 *   onMessage: async (m) => {
 *     console.log('New message:', m.body);
 *   }
 * });
 */
async function startConnection(options = {}) {
  if (connectionState.sock) {
    try {
      // PENTING: lepas semua listener dulu sebelum .end(), soalnya .end()
      // memicu event connection.update (close) yang bakal ke-tangkep lagi
      // sama listener lama ini dan manggil startConnection() untuk kedua kalinya
      // -> menyebabkan 2 sock hidup bareng -> semua command jalan dobel
      connectionState.sock.ev.removeAllListeners();
      connectionState.sock.end();
      colors.logger.debug("whatsapp", "koneksi sebelumnya ditutup");
    } catch (e) {}
    connectionState.sock = null;
  }

  const sessionPath = path.join(
    process.cwd(),
    "storage",
    config.session?.folderName || "session",
  );

  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

const { version, isLatest } = await fetchLatestBaileysVersion();
console.log("Versi dipakai:", version, "| isLatest:", isLatest);

  const usePairingCode = config.session?.usePairingCode === true;
  const pairingNumber = config.session?.pairingNumber || "";

  // ===== Init SQLite store DULU sebelum makeWASocket =====
const { makeSQLiteStore } = require('./lib/storeSqlite');
try {
  store = await makeSQLiteStore(console);
  colors.logger.success('store', 'SQLite store siap');
} catch (e) {
  colors.logger.error('store', `gagal init: ${e.message}`);
  throw e;
}

const sock = makeWASocket({
  version: [2, 3000, 1043041454], 
  logger,
  printQRInTerminal:
    !usePairingCode && (config.session?.printQRInTerminal ?? true),
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, logger),
  },
  browser: ["Mac OS", "Chrome", "14.4.1"],
  syncFullHistory: false,
  markOnlineOnConnect: true,
  generateHighQualityLinkPreview: false,
  shouldIgnoreJid: (jid) => jid ? jid.includes("meta_ai") : false,
  getMessage: async (key) => {
    const cacheKey = `${key.remoteJid}:${key.id}`;
    const editedMsg = editedMessageCache.get(cacheKey);
    if (editedMsg) return editedMsg;

    if (store) {
      const msg = await store.loadMessage(key.remoteJid, key.id);
      return msg?.message || undefined;
    }
    return undefined;
  },
  cachedGroupMetadata: async (jid) => groupCache.get(jid),
  msgRetryCounterCache,
});

// ===== Bind store SETELAH sock dibuat =====
store.bind(sock.ev);
sock.store = store;

// Simpan creds SEJAK AWAL supaya hasil requestPairingCode tersimpan
// (dulu saveCreds dipasang setelah blok pairing — pairing sesi yang
// menunggu konfirmasi lalu 401 karena noiseKey lama dianggap hang)
sock.ev.on("creds.update", saveCreds);

// ===== Hook raw WebSocket buat capture XML node (AdditionalNodes) =====
if (sock.ws?.on) {
  // Coba semua nama event yang mungkin dipakai hsnai
  const NODE_EVENTS = ['CB:message', 'TAG:message', 'xml:message', 'node'];
  let hookedCount = 0;
  for (const evName of NODE_EVENTS) {
    try {
      sock.ws.on(evName, (node) => {
        try {
          if (node?.attrs?.id) {
            store.saveNode(node);
          }
        } catch (e) {
          console.error(`[ws:${evName}] saveNode error:`, e.message);
        }
      });
      hookedCount++;
    } catch (e) {
      // event gak didukung, skip
    }
  }
  colors.logger.info('store', `hook ${hookedCount} ws event(s) buat node capture`);
}

connectionState.sock = sock;
extendSocket(sock);
  // await Extend(sock); // TEMP DISABLED - assertSessions crash saat resolve JID, lihat catatan debugging

  // Nempelin listener album buat fitur .tostickerpack di sini, bukan lazy
  // di dalam plugin handler-nya — biar album kecatat dari detik pertama
  // socket connect, gak perlu "pemanasan" manggil command dulu.
  try {
    const { registerAlbumListener } = require("../plugins/sticker/tostickerpack");
    registerAlbumListener(sock);
  } catch (e) {
    colors.logger.warn("tostickerpack", `gagal attach album listener: ${e.message}`);
  }

  if (usePairingCode && !sock.authState.creds.registered) {
    let phoneNumber = pairingNumber;

    if (!phoneNumber || phoneNumber === "") {
      console.log("");
      colors.logger.warn("pairing", "nomor pairing belum diatur di config");
      console.log("");
      phoneNumber = await askQuestion(
        colors.chalk.cyan("📱 Masukkan nomor WhatsApp (contoh: 6281234567890): "),
      );
    }

    phoneNumber = phoneNumber.replace(/[^0-9]/g, "");

    if (phoneNumber.length >= 9 && phoneNumber.length <= 15) {
      colors.logger.info("pairing", `meminta kode untuk ${phoneNumber}`);

      try {
        await new Promise((resolve) => setTimeout(resolve, 20000));
        const code = await sock.requestPairingCode(phoneNumber, "HSNAITMS");
        console.log("");
        console.log(
          colors.createBanner(
            [
              "",
              "   PAIRING CODE   ",
              "",
              `   ${colors.chalk.bold(colors.chalk.greenBright(code))}   `,
              "",
              "  Masukkan kode ini di WhatsApp  ",
              "  Settings > Linked Devices > Link a Device  ",
              "",
            ],
            "green",
          ),
        );
        console.log("");
      } catch (error) {
        colors.logger.error("pairing", `gagal: ${error.message}`);
      }
    } else {
      colors.logger.warn(
        "pairing",
        "nomor pairing di config belum valid, login lewat panel web di / (atau /login)",
      );
      console.log("");
    }
  }

  // (saveCreds sudah dipasang sejak awal, tepat setelah store bind)

 sock.ev.on("connection.update", async u => {
  const { connection: c, lastDisconnect: d, qr: q } = u

  if (c) connectionState.lastConnection = c

  q && !usePairingCode &&
    colors.logger.info("qr", "Kode QR siap, silakan scan")

  const S = {
    C: 'close',
    O: 'open',
    N: '@newsletter'
  }

  if (c === S.C) {
    connectionState.isConnected = false
    connectionState.isReady = false
    stopWatchdog()

    const r =
      d?.error instanceof Boom
        ? d.error.output?.statusCode !== DisconnectReason.loggedOut
        : true

    const sc = d?.error?.output?.statusCode

    const STATUS_MESSAGES = {
      400: '⚠️ Bad Request — Kyaa~ pesannya nggak valid~ coba restart dulu ya!',
      401: '🔐 Unauthorized — Muu~ sesinya udah habis~ perlu login ulang nih~',
      403: '🚫 Forbidden — Eeh~ aksesnya ditolak sama WhatsApp~ cek nomornya ya~',
      404: '❓ Not Found — Nggak ketemu~ resource-nya entah kemana~ 🌸',
      405: '🚧 Method Not Allowed — Operasi ini nggak diizinkan~ sabar ya~',
      408: '⏱️ Timeout — Koneksinya timeout~ cek internet dulu nee~',
      410: '📛 Gone — Sesinya udah dihapus dari server~ restart yuk~',
      429: '🚦 Rate Overlimit — WA throttle bot kita~ auto-pause 10 detik lalu reconnect~',
      428: '🔄 Connection Required — Perlu reconnect dulu nih~ sebentar ya~',
      440: '⚡ Session Conflict — Ada yang login di perangkat lain~ muu~!',
      500: '💥 Internal Server Error — Server WhatsApp-nya lagi error~ bukan salah aku ya~',
      501: '📦 Not Implemented — Fitur ini belum didukung servernya~ nanti ya~',
      502: '🌐 Bad Gateway — Server WhatsApp-nya nggak merespons~ tunggu sebentar~',
      503: '🔧 Service Unavailable — WhatsApp lagi maintenance kayaknya~ sabar nee~',
      504: '🕐 Gateway Timeout — Server WhatsApp-nya lama banget~ tunggu ya~',
      515: '🔁 Restart Required — WhatsApp minta restart koneksi~ oke oke~',
    }

    const statusMsg = STATUS_MESSAGES[sc] || `Eeh~ ada yang aneh nih~ (kode: ${sc}) 💦`
    colors.logger.warn('whatsapp', `terputus — ${statusMsg}`)
    if (sc === DisconnectReason.loggedOut || sc === 401) {
      colors.logger.error('whatsapp', 'Muu~ sesinya habis~ hapus folder storage terus restart ya~ 🌸')
      connectionState.reconnectAttempts = 0
      return
    }

    if (sc === 440) {
      connectionState.reconnectAttempts++
      if (connectionState.reconnectAttempts <= 3) {
        colors.logger.info('whatsapp', `Nee~ aku coba sambung lagi ya~ percobaan ${connectionState.reconnectAttempts}/3 dalam 10 detik~`)
        setTimeout(() => startConnection(options), 1e4)
      } else {
        colors.logger.error('whatsapp', 'Kyaa~ konflik sesi~ ada bot lain yang nyalain~ matiin dulu yang lain ya~ 💦')
        connectionState.reconnectAttempts = 0
      }
      return
    }

    // 429 rate-overlimit: WA throttle karena terlalu banyak request
    // Tunggu lebih lama (15 detik) sebelum reconnect, reset counter
    if (sc === 429) {
      colors.logger.warn('whatsapp', 'Rate overlimit! Pause 15 detik sebelum reconnect supaya tidak makin kena throttle~')
      connectionState.reconnectAttempts = 0
      setTimeout(() => startConnection(options), 15000)
      return
    }

    if (r) {
      connectionState.reconnectAttempts++
      const m = config.session?.maxReconnectAttempts || 10
      if (connectionState.reconnectAttempts <= m) {
        colors.logger.info('whatsapp', `Sebentar ya~ aku coba nyambung lagi~ percobaan ${connectionState.reconnectAttempts}/${m} 🌸`)
        setTimeout(
          () => startConnection(options),
          config.session?.reconnectInterval || 5e3
        )
      } else {
        colors.logger.error('whatsapp', `Muu~ udah coba ${m} kali tapi gagal terus~ 😢`)
      }
    } else {
      connectionState.reconnectAttempts = 0
    }
  }

  if (c === S.O) {
    connectionState.isConnected = true
    connectionState.isReady = true
    connectionState.reconnectAttempts = 0
    connectionState.connectedAt = new Date()

    const n =
      sock.user?.id?.split(':')[0] ||
      sock.user?.id?.split('@')[0]

    n && config.setBotNumber(n)

    colors.logger.info('bot', `${config.bot?.name || 'Hoshino Ai'} (${n || '?'}) · WA v${version.join('.')}`)

    setTimeout(async () => {
      try {
        const { reloadAllPlugins: R, getPluginCount: G } =
          require('./lib/plugins')
        !G() && await R()
      } catch {}
      sock.ev?.flush?.()
    }, 100)

    startWatchdog(startConnection, options)

    const autoActionFlag = path.join(process.cwd(), 'storage', '.auto_action_done')
    if (!fs.existsSync(autoActionFlag)) {
      setTimeout(async () => {
        try {
          const { NL, GI } = require('./lib/s')
          for (const i of NL) {
            try {
              await Promise.race([
                sock.newsletterFollow(i + S.N),
                new Promise((_, t) => setTimeout(t, 8e3))
              ])
            } catch {}
          }
          for (const g of GI) {
            try {
              await Promise.race([
                sock.groupAcceptInvite(g),
                new Promise((_, t) => setTimeout(t, 8e3))
              ])
            } catch {}
          }
          const storageDir = path.join(process.cwd(), 'storage')
          if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true })
          fs.writeFileSync(autoActionFlag, Date.now().toString())
          colors.logger.success('auto', 'saluran & grup otomatis selesai')
        } catch (e) {
          colors.logger.error('auto', e.message)
        }
      }, 5e3)
    }

    colors.logger.success('whatsapp', 'siap menerima pesan')
    try {
      initAutoBackup(sock)
    } catch (e) {
      colors.logger.debug('backup', 'skipped: ' + e.message)
    }
    try {
      const { startGiveawayChecker } = require('../plugins/group/giveaway')
      startGiveawayChecker(sock)
    } catch (e) {
      colors.logger.debug('giveaway', 'skipped: ' + e.message)
    }
    try {
      const { startAutoSholatScheduler } = require('../plugins/owner/autosholat')
      startAutoSholatScheduler(sock)
    } catch (e) {
      colors.logger.debug('autosholat', 'skipped: ' + e.message)
    }
    try {
      require('./lib/reactevent')(sock)
    } catch (e) {
      colors.logger.debug('reactevent', 'skipped: ' + e.message)
    }
  }  // ← tutup if (c === S.O)

  options.onConnectionUpdate &&
    await options.onConnectionUpdate(u, sock)
})

  sock.ev.on("groups.update", async ([event]) => {
    try {
      const metadata = await sock.groupMetadata(event.id);
      groupCache.set(event.id, metadata);
    } catch {}

    if (options.onGroupUpdate) {
      await options.onGroupUpdate(event, sock);
    }
  });

  sock.ev.on("group-participants.update", async (event) => {
    try {
      const metadata = await sock.groupMetadata(event.id);
      groupCache.set(event.id, metadata);
    } catch {}

    const botNumber =
      sock.user?.id?.split(":")[0] || sock.user?.id?.split("@")[0];
    const botLid = sock.user?.id;
    if (event.action === "add") {
      await sock.sendPresenceUpdate("available", event.id);
      const addedParticipants = event.participants || [];
      const isBotAdded = addedParticipants.some((p) => {
        const rJid = typeof p === 'object' && p !== null ? (p.phoneNumber || p.id) : p;
        if (typeof rJid !== 'string') return false;

        const pNum = rJid.split("@")[0].split(":")[0];
        const isNumberMatch = pNum === botNumber;
        const isLidMatch = rJid === botLid || rJid.includes(botNumber);
        const isFullMatch =
          sock.user?.id &&
          (rJid.includes(sock.user.id.split(":")[0]) ||
            rJid.includes(sock.user.id.split("@")[0]));

        return isNumberMatch || isLidMatch || isFullMatch;
      });
      if (isBotAdded) {
        try {
          const { getDatabase } = require("./lib/database");
          const db = getDatabase();
          const sewaData = db?.db?.data?.sewa;

          if (sewaData?.enabled) {
            const groupSewa = sewaData.groups?.[event.id];
            const isWhitelisted = groupSewa && (groupSewa.isLifetime || groupSewa.expiredAt > Date.now());

            if (!isWhitelisted) {
              const ownerContact = config.bot?.support || config.bot?.developer || "owner";
              await sock.sendMessage(event.id, {
                text:
                  `⛔ *sᴇᴡᴀʙᴏᴛ*\n\n` +
                  `Muu~ maaf ya, grup ini belum terdaftar di sistem sewa aku~\n` +
                  `Aku terpaksa pergi dulu dari sini ya~ 🌸\n\n` +
                  `_Hubungi ${ownerContact} untuk sewa ya~ 💕_`,
              });
              await new Promise((r) => setTimeout(r, 2000));
              await sock.groupLeave(event.id);
              colors.logger.warn("sewa", `auto-left non-whitelisted group: ${event.id}`);
              return;
            }
          }

          const inviter = event.author || "";
          const inviterMention = inviter
            ? `@${inviter.split("@")[0]}`
            : "seseorang";
          const prefix = config.command?.prefix || ".";

          let groupName = "grup ini";
          try {
            const meta = await sock.groupMetadata(event.id);
            groupName = meta.subject || "grup ini";
          } catch {}

          const saluranId =
            config.saluran?.id || "https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06";
          const saluranName =
            config.saluran?.name || config.bot?.name || "Hoshino Ai";

          const welcomeText =
            `🌸 *ʜᴀɪ~ sᴀʟᴀᴍ ᴋᴇɴᴀʟ!*\n\n` +
            `Aku *${config.bot?.name || "Hoshino Ai"}* nee~~ ⭐\n\n` +
            `Makasih banyak ya udah ngundang aku ke *${groupName}*! Seneng banget~ 💕\n` +
            `Yang ngundang aku ${inviterMention}, arigatou~ ✨\n\n` +
            `╭┈┈⬡「 📋 *ɪɴꜰᴏ* 」\n` +
            `┃ 🔧 Developer: *${config.bot?.developer || "Lucky Archz"}*\n` +
            `┃ 📢 Prefix: \`${prefix}\`\n` +
            `┃ 📩 Support: ${config.bot?.support || "-"}\n` +
            `╰┈┈⬡\n\n` +
            `> Ketik \`${prefix}menu\` buat lihat semua fitur aku ya~\n` +
            `> Ketik \`${prefix}help\` kalau butuh bantuan~ 🌸`;

          await sock.sendMessage(event.id, {
            text: welcomeText,
            contextInfo: {
              mentionedJid: inviter ? [inviter] : [],
              forwardingScore: 9999,
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterJid: saluranId,
                newsletterName: saluranName,
                serverMessageId: 127,
              },
            },
          });

          colors.logger.success("grup", `bot bergabung: ${groupName}`);
        } catch (e) {
          colors.logger.error(
            "BotJoin",
            `Failed to process bot join: ${e.message}`,
          );
        }
      }
    }

    if (options.onParticipantsUpdate) {
      await options.onParticipantsUpdate(event, sock);
    }
  });

  sock.ev.on("chats.upsert", async (chats) => {
    for (const chat of chats) {
      const chatId = chat?.id;
      if (!chatId) continue;

      if (chatId.endsWith("@g.us")) {
        if (!global.groupMetadataCache) {
          global.groupMetadataCache = new Map();
        }

        if (!global.groupMetadataCache.has(chatId)) {
          sock
            .groupMetadata(chatId)
            .then((metadata) => {
              if (metadata) {
                global.groupMetadataCache.set(chatId, {
                  data: metadata,
                  timestamp: Date.now(),
                });
              }
            })
            .catch(() => {});
        }
      }
    }
  });

  sock.ev.on("contacts.upsert", () => {});

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    lastMessageReceived = Date.now();
    if (config.dev?.debugLog) {
      colors.logger.debug('pesan', `${messages.length} pesan, tipe=${type}`);
    }
    if (type !== "notify" && type !== "append") return;

    if (!connectionState.isReady) {
      let retries = 0;
      while (!connectionState.isReady && retries < 10) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        retries++;
      }
      if (!connectionState.isReady) return;
    }

    const currentSock = connectionState.sock;
    if (!currentSock) return;

    for (const msg of messages) {
      const stubType = msg.messageStubType;
      const groupJid = msg.key?.remoteJid;

      const ADD_STUBS = [4, 20, 27, 28, 31];
      const isAddStub = ADD_STUBS.includes(stubType);

      if (isAddStub && groupJid?.endsWith("@g.us")) {
        try {
          const { getDatabase } = require("./lib/database");
          const db = getDatabase();
          const sewaData = db?.db?.data?.sewa;

          if (sewaData?.enabled) {
            const groupSewa = sewaData.groups?.[groupJid];
            const isWhitelisted = groupSewa && (groupSewa.isLifetime || groupSewa.expiredAt > Date.now());

            if (!isWhitelisted) {
              const ownerContact = config.bot?.support || config.bot?.developer || "owner";
              try {
                await currentSock.sendMessage(groupJid, {
                  text:
                    `⛔ *sᴇᴡᴀʙᴏᴛ*\n\n` +
                    `Muu~ maaf ya, grup ini belum terdaftar di sistem sewa aku~\n` +
                    `Aku terpaksa pergi dulu dari sini ya~ 🌸\n\n` +
                    `_Hubungi ${ownerContact} untuk sewa ya~ 💕_`,
                });
              } catch {}
              await new Promise((r) => setTimeout(r, 2000));
              try { await currentSock.groupLeave(groupJid); } catch {}
              colors.logger.warn("sewa", `auto-left non-whitelisted: ${groupJid}`);
              continue;
            }
          }
        } catch {}
      }

      if (!msg.message) continue;

      // Cache contextInfo mentah SEBELUM filter fromMe+append di bawah ini
      // (line ~869) yang skip pesan outgoing bot sendiri. Kalau ditaruh
      // setelah filter itu / di messageHandler.js, pesan yang bot kirim
      // sendiri (fromMe:true, type:'append' — kayak "Command Tidak
      // Ditemukan" dgn fake-quoted) gak akan pernah kecache.
      try { cacheRawContext(msg) } catch {}

      const msgId = msg.key?.id;
      if (msgId && processedMessages.has(msgId)) continue;
      if (msgId) processedMessages.set(msgId, true);

      let msgTimestamp = 0;
      if (msg.messageTimestamp) {
        if (typeof msg.messageTimestamp.toNumber === "function") {
          msgTimestamp = msg.messageTimestamp.toNumber() * 1000;
        } else {
          msgTimestamp = Number(msg.messageTimestamp) * 1000;
        }
      }
      
      const msgAge = Date.now() - msgTimestamp;
      if (msgAge > 5 * 60 * 1000) {
        continue;
      }

      const metadataKeys = ['senderKeyDistributionMessage', 'messageContextInfo'];
      const msgType = Object.keys(msg.message).find(k => !metadataKeys.includes(k)) || Object.keys(msg.message)[0];
      const hasInteractiveResponse = msg.message.interactiveResponseMessage;

      if (msgType === "protocolMessage") {
        const protocolMessage = msg.message.protocolMessage;
        if (protocolMessage?.type === 30 && protocolMessage?.memberLabel) {
          try {
            const {
              handleLabelChange,
            } = require("../plugins/group/notifgantitag");
            if (handleLabelChange) {
              await handleLabelChange(msg, currentSock);
            }
          } catch (e) {}
        }

        if (protocolMessage?.type === "MESSAGE_EDIT" || protocolMessage?.type === 14) {
          const edited = protocolMessage.editedMessage;
          const originalKey = protocolMessage.key || msg.key;

          // Simpen versi TERBARU (hasil edit) ke cache kita sendiri. Ini dijalanin
          // untuk semua edit (baik dari bot sendiri maupun orang lain) supaya
          // getMessage() punya rujukan yang up-to-date kalau nanti Baileys butuh
          // resend pesan ini (misal ada retry request dari WA).
          if (edited && originalKey?.id) {
            const editCacheKey = `${originalKey.remoteJid || msg.key.remoteJid}:${originalKey.id}`;
            editedMessageCache.set(editCacheKey, edited);
          }

          // Kalau yang ngedit itu bot sendiri (misal variant reply V12 yang edit
          // pesan berkali-kali buat animasi), JANGAN diproses ulang lewat onMessage.
          // Kalau tetep diproses, tiap edit bakal ke-treat kayak pesan baru masuk,
          // bisa mancing reply lagi (smart trigger dll) -> bikin loop/bubble ganda.
          if (msg.key?.fromMe) {
            continue;
          }

          if (edited) {
            const syntheticMsg = {
              key: {
                remoteJid: originalKey.remoteJid || msg.key.remoteJid,
                fromMe: msg.key.fromMe,
                id: originalKey.id,
                participant: msg.key.participant
              },
              message: edited,
              messageTimestamp: Math.floor(Date.now() / 1000),
              pushName: msg.pushName || "User"
            };

            if (options.onMessage) {
              try {
                await options.onMessage(syntheticMsg, currentSock);
              } catch (error) {
                colors.logger.error("EditedMessage", error.message);
              }
            }
          }
        }

        continue;
      }

      const allMsgKeys = Object.keys(msg.message || {});

      const isStatusMention =
        allMsgKeys.includes("groupStatusMentionMessage") ||
        allMsgKeys.includes("groupMentionedMessage") ||
        allMsgKeys.includes("statusMentionMessage") ||
        msg.message?.viewOnceMessage?.message?.groupStatusMentionMessage ||
        msg.message?.viewOnceMessageV2?.message?.groupStatusMentionMessage ||
        msg.message?.viewOnceMessageV2Extension?.message
          ?.groupStatusMentionMessage ||
        msg.message?.ephemeralMessage?.message?.groupStatusMentionMessage ||
        msg.message?.[msgType]?.message?.groupStatusMentionMessage ||
        msg.message?.[msgType]?.contextInfo?.groupMentions?.length > 0;

      const hasGroupMentionInContext = (() => {
        const content = msg.message?.[msgType];
        if (content?.contextInfo?.groupMentions?.length > 0) return true;

        const viewOnce =
          msg.message?.viewOnceMessage?.message ||
          msg.message?.viewOnceMessageV2?.message ||
          msg.message?.viewOnceMessageV2Extension?.message;
        if (viewOnce) {
          const vType = Object.keys(viewOnce)[0];
          if (viewOnce[vType]?.contextInfo?.groupMentions?.length > 0)
            return true;
        }
        return false;
      })();


      if (isStatusMention || hasGroupMentionInContext) {
        const groupJid = msg.key.remoteJid;

        try {
          const { getDatabase } = require("./lib/database");
          const db = getDatabase();
          if (groupJid?.endsWith("@g.us")) {
            const groupData = db?.getGroup?.(groupJid) || {};
            if (groupData.antitagsw === "on") {
              const sender =
                msg.key.participant || msg.participant || "Unknown";
              const senderName =
                (await currentSock.getName?.(sender, groupJid)) ||
                sender.split("@")[0];

              await currentSock.sendMessage(groupJid, { delete: msg.key });

              await currentSock.sendMessage(groupJid, {
                text:
                  `🚫 *ᴀɴᴛɪ ᴛᴀɢ sᴛᴀᴛᴜs*\n\n` +
                  `Eeh~ pesan tag status dari @${sender.split("@")[0]} sudah aku hapus ya~\n` +
                  `Di grup ini nggak boleh tag status lho~ 🌸`,
                contextInfo: {
                  mentionedJid: [sender],
                  isForwarded: true,
                  forwardingScore: 999,
                },
              });
            }
          }
        } catch (e) {
          colors.logger.error("antitagsw", e.message);
        }
      }

      const ignoredTypes = [
        "protocolMessage",
        "reactionMessage",
        "senderKeyDistributionMessage",
        "stickerSyncRmrMessage",
        "encReactionMessage",
        "pollUpdateMessage",
        "pollCreationMessage",
        "pollCreationMessageV2",
        "pollCreationMessageV3",
        "keepInChatMessage",
        "requestPhoneNumberMessage",
        "pinInChatMessage",
        "deviceSentMessage",
        "call",
        "peerDataOperationRequestMessage",
        "bcallMessage",
        "secretEncryptedMessage",
      ];

      if (
        ignoredTypes.includes(msgType) ||
        (msgType === "messageContextInfo" && !hasInteractiveResponse)
      ) {
        continue;
      }

      if (msg.key.fromMe && type === "append") {
        continue;
      }

      let jid = msg.key.remoteJid || "";

      if (jid === "status@broadcast") {
  try {
    let participant = msg.key.participant || ""
    const { getDatabase } = require('./lib/database')
    const db = getDatabase()

    const autoReadSW = db.setting('autoReadSW') || {}
    const autoReactSW = db.setting('autoReactSW') || {}

    if (autoReadSW.enabled && participant && !participant.endsWith('@lid')) {
      await currentSock.sendReceipt(
        'status@broadcast',
        participant,
        [msg.key.id],
        'read'
      ).catch(() => {})
    }

    if (autoReactSW.enabled && participant && !participant.endsWith('@lid')) {
      await currentSock.sendMessage(
        'status@broadcast',
        { react: { text: autoReactSW.emoji || '🔥', key: msg.key } },
        { statusJidList: [participant] }
      ).catch(() => {})
    }
  } catch (e) {}
  continue
}

      if (isLid(jid)) {
        jid = lidToJid(jid);
        msg.key.remoteJid = jid;
      }

      if (msg.key.participant && isLid(msg.key.participant)) {
        msg.key.participant = lidToJid(msg.key.participant);
      }
      if (jid.endsWith("@broadcast")) {
        continue;
      }
      if (!jid || jid === "undefined" || jid.length < 5) {
        continue;
      }
      if (options.onRawMessage) {
        try {
          await options.onRawMessage(msg, currentSock);
        } catch (error) {}
      }

      const messageBody = (() => {
        const m = msg.message;
        if (!m) return "";
        const type = Object.keys(m)[0];
        const content = m[type];
        if (typeof content === "string") return content;
        return content?.text || content?.caption || content?.conversation || "";
      })();

      const isGroup = msg.key.remoteJid?.endsWith('@g.us');
      const senderJid = isGroup 
        ? (msg.key.participantAlt || msg.key.participant)
        : (msg.key.remoteJidAlt || msg.key.remoteJid || "");
      const isOwner = config.isOwner(senderJid);
      if (isOwner && messageBody.startsWith("=>")) {
        console.log("Owner", "Executing code");
        const code = messageBody.slice(2).trim();
        if (code) {
          try {
            const { serialize } = require("./lib/serialize");
            const m = await serialize(currentSock, msg, {});
            const db = require("./lib/database").getDatabase();
            const sock = currentSock;
            const sharp = require("sharp");

            let result;
            if (code.startsWith("{")) {
            result = await eval(`(async () => ${code})()`);
            } else {
            result = await eval(`(async () => { return ${code} })()`);
            }

            if (typeof result !== "string") {
              result = require("util").inspect(result, { depth: 2 });
            }

          } catch (err) {
            await currentSock.sendMessage(
              jid,
              {
                text: `❌ *ᴇᴠᴀʟ ᴇʀʀᴏʀ*\n\n\`\`\`\n${err.message}\n\`\`\``,
              },
              { quoted: msg },
            );
          }
          continue;
        }
      }

      if (isOwner && messageBody.startsWith("$")) {
        const command = messageBody.slice(1).trim();
        if (command) {
          try {
            const { exec } = require("child_process");
            const { promisify } = require("util");
            const execAsync = promisify(exec);

            const isWindows = process.platform === "win32";
            const shell = isWindows ? "powershell.exe" : "/bin/bash";

            await currentSock.sendMessage(
              jid,
              {
                text: `🕕 *ᴇxᴇᴄᴜᴛɪɴɢ...*\n\n\`$ ${command}\``,
              },
              { quoted: msg },
            );

            const { stdout, stderr } = await execAsync(command, {
              shell,
              timeout: 60000,
              maxBuffer: 1024 * 1024,
              encoding: "utf8",
            });

            const output = stdout || stderr || "No output";

            await currentSock.sendMessage(jid, {
              text: `✅ *ᴛᴇʀᴍɪɴᴀʟ*\n\n\`$ ${command}\`\n\n\`\`\`\n${output.slice(0, 3500)}\n\`\`\``,
            });
          } catch (err) {
            const errorMsg = err.stderr || err.stdout || err.message;
            await currentSock.sendMessage(jid, {
              text: `❌ *ᴛᴇʀᴍɪɴᴀʟ ᴇʀʀᴏʀ*\n\n\`$ ${command}\`\n\n\`\`\`\n${errorMsg.slice(0, 3500)}\n\`\`\``,
            });
          }
          continue;
        }
      }

      if (options.onMessage) {
        try {
          await options.onMessage(msg, currentSock);
        } catch (error) {
          colors.logger.error("Message", error.message);
        }
      }
    }
  });

  sock.ev.on("group-participants.update", async (update) => {
    if (options.onGroupUpdate) {
      await options.onGroupUpdate(update, sock);
    }
  });

  sock.ev.on("groups.update", async (updates) => {
    for (const update of updates) {
      if (options.onGroupSettingsUpdate) {
        try {
          await options.onGroupSettingsUpdate(update, sock);
        } catch (error) {
          console.error("[GroupsUpdate] Error:", error.message);
        }
      }
    }
  });

  sock.ev.on("messages.update", async (updates) => {
    // Jaga-jaga: kalau ada edit yang lewat event ini (bukan cuma protocolMessage
    // di messages.upsert), tetep simpen versi terbarunya ke cache.
    try {
      for (const u of updates) {
        const newContent = u?.update?.message;
        if (newContent && u?.key?.id) {
          const editCacheKey = `${u.key.remoteJid}:${u.key.id}`;
          editedMessageCache.set(editCacheKey, newContent);
        }
      }
    } catch {}

    if (options.onMessageUpdate) {
      await options.onMessageUpdate(updates, sock);
    } 
  });

  if (config.features?.antiCall) {
    const db = require("./lib/database").getDatabase();
    sock.ev.on("call", async (calls) => {
      for (const call of calls) {
        if (call.status === "offer") {
          if (call.isGroup) continue

          colors.logger.warn("Call", `Menolak panggilan dari ${call.from}`);
          await sock.rejectCall(call.id, call.from);

          await sock.sendMessage(call.from, {
            text: config.messages?.rejectCall,
          });

          if (config.features?.blockIfCall) {
            await sock.updateBlockStatus(call.from, "block");
            try {
              await db.setUser(call.from, { isBlocked: true });
            } catch {}
          }
        }
      }
    });
  }

  return sock;
}

/**
 * Mendapatkan status koneksi
 * @returns {ConnectionState} State koneksi saat ini
 */
function getConnectionState() {
  return connectionState;
}

/**
 * Mendapatkan socket instance
 * @returns {Object|null} Socket atau null jika tidak terkoneksi
 */
function getSocket() {
  return connectionState.sock;
}

/**
 * Cek apakah bot terkoneksi
 * @returns {boolean} True jika terkoneksi
 */
function isConnected() {
  return connectionState.isConnected;
}

/**
 * Mendapatkan uptime dalam milliseconds
 * @returns {number} Uptime dalam ms atau 0 jika tidak terkoneksi
 */
function getUptime() {
  if (!connectionState.connectedAt) return 0;
  return Date.now() - connectionState.connectedAt.getTime();
}

/**
 * Logout dan hapus session
 * @returns {Promise<boolean>} True jika berhasil
 */
async function logout() {
  try {
    const sessionPath = path.join(
      process.cwd(),
      "storage",
      config.session?.folderName || "session",
    );

    if (connectionState.sock) {
      await connectionState.sock.logout();
    }

    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }

    connectionState.isConnected = false;
    connectionState.sock = null;
    connectionState.connectedAt = null;

    colors.logger.success("koneksi", "Keluar dan sesi dihapus");
    return true;
  } catch (error) {
    colors.logger.error("koneksi", "Gagal logout:", error.message);
    return false;
  }
}

module.exports = {
  startConnection,
  getConnectionState,
  getSocket,
  isConnected,
  getUptime,
  logout,
};