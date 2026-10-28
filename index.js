require('dotenv').config()
require('./src/lib/consoleLog')
require('./src/lib/agent').initializeAgent()

const LOG_NOISE = new Set([
  'Closing', 'prekey', '_chains', 'registrationId',
  'chainKey', 'ephemeralKeyPair', 'rootKey', 'indexInfo',
  'pendingPreKey', 'currentRatchet', 'baseKey', 'privKey'
])
const _log = console.log
console.log = (...args) => {
  const first = typeof args[0] === 'string' ? args[0] : ''
  for (const noise of LOG_NOISE) {
    if (first.includes(noise)) return
  }
  _log.apply(console, args)
}

const path = require("path");
const fs = require("fs");
const config = require("./config");
const { startConnection } = require("./src/connection");
const {
  messageHandler,
  groupHandler,
  messageUpdateHandler,
  groupSettingsHandler,
} = require("./src/handler");
const { loadPlugins, pluginStore } = require("./src/lib/plugins");
const { initDatabase, getDatabase } = require("./src/lib/database");
const {
  initScheduler,
  loadScheduledMessages,
  startGroupScheduleChecker,
  startSewaChecker,
} = require("./src/lib/scheduler");
// Hapus yang lama: const { startAutoBackup } = require("./src/lib/backup");
// Ganti dengan ini:
const { initAutoBackup } = require("./src/lib/autoBackup"); 
const { handleAntiTagSW } = require("./src/lib/groupProtection");
const { initSholatScheduler } = require("./src/lib/sholatScheduler");
const { initAutoJpmScheduler } = require("./src/lib/autojpmScheduler");
const { initBroadcastScheduler } = require("./src/lib/broadcastScheduler");
const { startMemoryMonitor } = require("./src/lib/memoryMonitor");
const { startTempCleaner } = require("./src/lib/tempCleaner");
const { startDailyPruner } = require("./src/lib/dataPruner");
const { startMediafireCleaner } = require("./src/lib/mediafireCleaner");
const { startWebServer } = require("./src/lib/webserver");
try {
  const { startOrderPoller } = require("./src/lib/orderPoller");
} catch {}
// otpPoller excluded
const {
  logger,
  c,
  printBanner,
  printStartup,
  logConnection,
  logErrorBox,
  logPlugin,
  divider,
} = require("./src/lib/colors");

/**
 * Waktu start untuk menghitung boot time
 */
const startTime = Date.now();

/**
 * Watcher untuk auto-reload plugins di dev mode
 */
let pluginWatcher = null;
const reloadDebounce = new Map();

/**
 * Cache untuk file stat (mtimeMs dan size) agar debounce watcher lebih akurat
 */
const fileStatCache = new Map();

/**
 * Memulai file watcher untuk dev mode
 */
function startDevWatcher(pluginsPath) {
  if (pluginWatcher) {
    pluginWatcher.close();
  }

  logger.system("dev", "hot reload plugin aktif");

  pluginWatcher = fs.watch(
    pluginsPath,
    { recursive: true },
    (eventType, filename) => {
      if (!filename || !filename.endsWith(".js")) return;

      const existingTimeout = reloadDebounce.get(filename);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeout = setTimeout(() => {
        reloadDebounce.delete(filename);

        const fullPath = path.join(pluginsPath, filename);

        if (!fs.existsSync(fullPath)) {
          fileStatCache.delete(fullPath);
          const pluginName = path.basename(filename, ".js");
          const { unloadPlugin } = require("./src/lib/plugins");
          const result = unloadPlugin(pluginName);
          if (result.success) {
            logger.warn("plugin", `removed ${filename}`);
          }
          return;
        }

        try {
          const stats = fs.statSync(fullPath);
          const cached = fileStatCache.get(fullPath);
          
          const changed = !cached || cached.mtimeMs !== stats.mtimeMs || cached.size !== stats.size;
          if (!changed) return; // Prevent double trigger from text editor saving
          
          fileStatCache.set(fullPath, {
            mtimeMs: stats.mtimeMs,
            size: stats.size
          });

          const { hotReloadPlugin } = require("./src/lib/plugins");
          const result = hotReloadPlugin(fullPath);
          
          if (result.success) {
            // logger.success("Reloaded", result.name);
          } else {
             logger.error("plugin", `reload failed: ${filename}: ${result.error}`);
          }
        } catch (error) {
          logger.error("plugin", `reload failed: ${filename}: ${error.message}`);
        }
      }, 500);

      reloadDebounce.set(filename, timeout);
    },
  );

  logger.debug("dev", `watching ${pluginsPath}`);
}

/**
 * Watcher untuk src/lib dengan hot reload
 */
let srcWatcher = null;

function startSrcWatcher(srcPath) {
  if (srcWatcher) {
    srcWatcher.close();
  }

  logger.system("dev", "hot reload src aktif");

  srcWatcher = fs.watch(srcPath, { recursive: true }, (eventType, filename) => {
    if (!filename || !filename.endsWith(".js")) return;

    const existingTimeout = reloadDebounce.get("src_" + filename);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      reloadDebounce.delete("src_" + filename);

      const fullPath = path.join(srcPath, filename);

      if (!fs.existsSync(fullPath)) {
        logger.warn("dev", `src file removed: ${filename}`);
        return;
      }

      try {
        // Clear cache untuk file tersebut
        delete require.cache[require.resolve(fullPath)];
        logger.success("dev", `src reloaded: ${filename}`);
      } catch (error) {
        logger.error("dev", `src reload failed: ${filename}: ${error.message}`);
      }
    }, 500);

    reloadDebounce.set("src_" + filename, timeout);
  });

  logger.debug("dev", `watching ${srcPath}`);
}

/**
 * Setup anti-crash handlers
 */
function setupAntiCrash() {
  process.on("uncaughtException", (error, origin) => {
    const ignoredErrors = [
      'write EOF',
      'ECONNRESET',
      'EPIPE',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'read ECONNRESET'
    ];
    
    const isIgnored = ignoredErrors.some(msg => 
      error.message?.includes(msg) || error.code === msg
    );
    
    if (isIgnored) {
      return;
    }
    
    logErrorBox("uncaught exception", error.message)
    if (config.dev?.debugLog) {
      console.error(c.gray(error.stack))
    }
    logger.system("sistem", "bot masih berjalan")
  });


  process.on("unhandledRejection", (reason, promise) => {
    logErrorBox("unhandled rejection", String(reason))
    if (config.dev?.debugLog) {
      console.error(c.gray("Promise:"), promise)
    }
    logger.system("sistem", "bot masih berjalan")
  });

  process.on("warning", (warning) => {
    logger.warn("system", `${warning.name}: ${warning.message}`);

    // TAMBAHKAN LOGIKA INI:
    if (warning.message.includes("Possible blocking IO") || warning.message.includes("high CPU")) {
      try {
        const { sendBackupWarning } = require("./src/lib/autoBackup");
        sendBackupWarning(`Dideteksi gangguan jadwal (Cron Missed). Pesan: ${warning.message}`);
      } catch (e) {
        // Abaikan jika gagal panggil fungsi
      }
    }
  });
  
  process.on("SIGINT", () => {
    console.log("");
    logger.system("sistem", "sinyal berhenti diterima")
    logger.info("database", "menyimpan data...")

    try {
      const { getDatabase } = require("./src/lib/database");
      const db = getDatabase();
      db.save();
      logger.success("database", "data tersimpan");
    } catch (error) {
      logger.warn("database", `save failed: ${error.message}`);
    }

    logger.info("sistem", "bot berhenti");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("");
    logger.system("sistem", "sinyal hentikan diterima");
    process.exit(0);
  });

  logger.success("sistem", "anti-crash aktif");
}

/**
 * Fungsi utama untuk memulai bot
 */
async function main() {
  printBanner();
  printStartup({
    name: config.bot?.name || "Ourin-AI",
    version: config.bot?.version || "1.0.0",
    developer: config.bot?.developer || "Developer",
    mode: config.mode || "public",
  });
  setupAntiCrash();

  try {
    startWebServer();
  } catch (webErr) {
    console.error("webserver gagal start:", webErr.message);
  }

  const dbPath = path.join(
    process.cwd(),
    config.database?.path || "./database/main",
  );
  await initDatabase(dbPath);
  const db = getDatabase();

  const savedMode = db.setting("botMode");
  if (savedMode && (savedMode === "self" || savedMode === "public")) {
    config.mode = savedMode;
  }
  const savedPremium = db.setting("premiumUsers");
  if (Array.isArray(savedPremium)) config.premiumUsers = savedPremium;
  const savedBanned = db.setting("bannedUsers");
  if (Array.isArray(savedBanned)) config.bannedUsers = savedBanned;
  // if (config.backup?.enabled !== false) startAutoBackup(dbPath);

  const pCount = (Array.isArray(savedPremium) ? savedPremium.length : 0);
  const bCount = (Array.isArray(savedBanned) ? savedBanned.length : 0);
  logger.success("database", `siap · mode: ${config.mode}, premium: ${pCount}, banned: ${bCount}`);

  const pluginsPath = path.join(process.cwd(), "plugins");
  const pluginCount = loadPlugins(pluginsPath);
  logger.success("plugin", `${pluginCount} plugin dimuat`);

  // Aset (gambar/thumbnail) diambil dari URL di config.assets, download di awal biar thumbnail langsung siap
  try {
    const hsAsset = require("./src/lib/assets");
    const total = await Promise.race([
      hsAsset.preload(),
      new Promise((resolve) => setTimeout(() => resolve(-1), 25000)),
    ]);
    if (total === -1) logger.warn?.("assets", "preload belum selesai (lanjut di background)");
    else logger.success("assets", `${total} gambar dari config.assets siap`);
  } catch (e) {
    console.error("[assets] preload gagal:", e.message);
  }

  if (config.dev?.enabled && config.dev?.watchPlugins) {
    startDevWatcher(pluginsPath);
  }
  if (config.dev?.enabled && config.dev?.watchSrc) {
    const srcPath = path.join(process.cwd(), "src");
    startSrcWatcher(srcPath);
  }

  initScheduler(config);

  const bootTime = Date.now() - startTime;
  logger.success("boot", `siap dalam ${bootTime}ms`);
  divider();
  logger.info("whatsapp", "menghubungkan...");
  console.log("");

  await startConnection({
    onRawMessage: async (msg, sock) => {
  try {
    const db = getDatabase();
    await handleAntiTagSW(msg, sock, db);

    // ── Auto Read Story ──
    if (msg.key?.remoteJid === 'status@broadcast') {
      const readSetting = db.setting('autoReadSW')
      if (readSetting?.enabled) {
        await sock.readMessages([msg.key]).catch(() => {})
      }

      // ── Auto React Story ──
      const reactSetting = db.setting('autoReactSW')
      if (reactSetting?.enabled) {
        await sock.sendMessage('status@broadcast', {
          react: {
            text: reactSetting.emoji || '🔥',
            key: msg.key
          }
        }).catch(() => {})
      }
    }

  } catch (error) {}
},

onMessage: async (msg, sock) => {
  try {
    const handlerPromise = messageHandler(msg, sock);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Handler timeout")), 60000),
        );
        await Promise.race([handlerPromise, timeoutPromise]);
      } catch (error) {
        if (error.message !== "Handler timeout") {
          logger.error("HANDLER", error.message);
          if (config.dev?.debugLog) {
            console.error(c.gray(error.stack));
          }
        }
      }
    },

    onGroupUpdate: async (update, sock) => {
      try {
        await groupHandler(update, sock);
      } catch (error) {
        logger.error("GROUP", error.message);
      }
    },

    onMessageUpdate: async (updates, sock) => {
      try {
        await messageUpdateHandler(updates, sock);
      } catch (error) {
        logger.error("MSG", error.message);
      }
    },

    onGroupSettingsUpdate: async (update, sock) => {
      try {
        await groupSettingsHandler(update, sock);
      } catch (error) {
        logger.error("GROUP", error.message);
      }
    },

    onConnectionUpdate: async (update, sock) => {
      if (update.connection === "open") {
        logConnection("connected", sock.user?.name || "Bot");
        // --- TAMBAHKAN INI ---
        initAutoBackup(sock); 
        // ---------------------
        loadScheduledMessages(sock);
        startGroupScheduleChecker(sock);
        startSewaChecker(sock);
        initScheduler(config, sock);
        initAutoJpmScheduler(sock);
        initBroadcastScheduler(sock);
        initSholatScheduler(sock);
        try {
          const { initSahurCron } = require('./plugins/religi/autosahur');
          initSahurCron(sock);
        } catch {}
        try { if (startOrderPoller) startOrderPoller(sock); } catch {}
        // otpPoller excluded

        try {
            const { getAllJadibotSessions, restartJadibotSession } = require('./src/lib/jadibotManager');
            const sessions = getAllJadibotSessions();
            if (sessions.length > 0) {
                logger.info('JADIBOT', `Restoring ${sessions.length} session(s)`);
                for (const session of sessions) {
                    await restartJadibotSession(sock, session.id);
                }
            }
        } catch (e) {
            logger.error('JADIBOT', `Gagal memulihkan: ${e.message}`);
        }

        try {
          const { initAutoStart: initYtNotifyStart } = require('./src/lib/ytnotify-core.js');
          initYtNotifyStart(sock);
        } catch (e) {
          logger.error('YTNOTIFY', `Gagal restore: ${e.message}`);
        }

                const devLabel = config.dev?.enabled ? ` ${c.yellow('• dev')}` : '';
        startMemoryMonitor()
        startTempCleaner()
        startDailyPruner()
        startMediafireCleaner()
        logger.success('siap', `semua sistem aktif${devLabel}`);
                // Auto Greet Sistem
        setTimeout(() => {
    setInterval(async () => {
        try {
            const { runAutoGreet } = require('./plugins/owner/autogreet');
            await runAutoGreet(sock);
        } catch (e) {
            console.log('[AUTO GREET ERROR]', e.message);
        }
    }, 15000);
}, 10000);
// Seles sini
        divider();
      }
    },
  });
}

main().catch((error) => {
  logErrorBox("Fatal Error", error.message);
  console.error(c.gray(error.stack));
  process.exit(1);
});