// Persistensi sesi untuk hosting ephemeral (HF Space / Render free dll.)
// Backend A (Hugging Face): env HF_TOKEN + HF_SESSION_DATASET
// Backend B (GitHub, disarankan Render): env GIT_SYNC_URL = full clone URL ber-token
//   contoh: https://x-access-token:<PAT>@github.com/<user>/<repo-privat>.git
// Mekanisme: tar storage/session + database -> upload; saat boot restore.
const { execFile, execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const DATASET = process.env.HF_SESSION_DATASET || "";
const TOKEN = process.env.HF_TOKEN || "";
const GIT_SYNC_URL = process.env.GIT_SYNC_URL || "";
const ARCHIVE = path.join(os.tmpdir(), "hsnai-storage.tar.gz");
const GIT_DIR = path.join(os.tmpdir(), "hsnai-sync-repo");
const DIRS = ["storage/session", "database"];
const SAVE_EVERY_MS = 10 * 60 * 1000; // 10 menit
let uploading = false;

function log(msg) {
  console.log(`[persist] ${msg}`);
}

function ready() {
  return Boolean((TOKEN && DATASET) || GIT_SYNC_URL);
}

function trustEnv() {
  if (TOKEN) process.env.HF_TOKEN = TOKEN;
  process.env.HF_HUB_DISABLE_XET = "1";
}

function restore() {
  if (!ready()) {
    log("lewat (env sync belum diset)");
    return false;
  }
  trustEnv();
  if (fs.existsSync(path.join("storage", "session", "creds.json"))) {
    log("sesi lokal sudah ada — restore dilewati");
    return true;
  }

  // --- backend GitHub ---
  if (GIT_SYNC_URL) {
    try {
      fs.rmSync(GIT_DIR, { recursive: true, force: true });
      execFileSync(
        "git",
        ["clone", "--depth", "1", GIT_SYNC_URL, GIT_DIR],
        { stdio: "ignore" },
      );
      if (fs.existsSync(path.join(GIT_DIR, "storage.tar.gz"))) {
        execFileSync("tar", ["xzf", path.join(GIT_DIR, "storage.tar.gz"), "-C", "."], {
          stdio: "ignore",
        });
      }
      const ok = fs.existsSync(path.join("storage", "session", "creds.json"));
      log(ok ? "restore GitHub selesai — sesi dipulihkan" : "GitHub: belum ada backup lama");
      return ok;
    } catch (e) {
      log("restore GitHub gagal: " + (e && e.message ? e.message : e));
    }
  }

  // --- backend Hugging Face ---
  if (TOKEN && DATASET) {
    try {
      execFileSync("hf", ["auth", "whoami"], { stdio: "ignore" });
      execFileSync(
        "hf",
        ["download", DATASET, "storage.tar.gz", "--repo-type", "dataset", "--local-dir", os.tmpdir(), "--force-download"],
        { stdio: "ignore" },
      );
      execFileSync("tar", ["xzf", ARCHIVE, "-C", "."], { stdio: "ignore" });
      const ok = fs.existsSync(path.join("storage", "session", "creds.json"));
      log(ok ? "restore HF selesai — sesi lama dipulihkan" : "restore jalan tapi creds.json tak ketemu");
      return ok;
    } catch (e) {
      log("restore HF: belum ada backup lama (normal untuk space baru)");
    }
  }
  return false;
}

function save(reason) {
  if (!ready() || uploading) return;
  const lists = [];
  for (const d of DIRS) if (fs.existsSync(d)) lists.push(d);
  if (!lists.length) return;
  uploading = true;
  setImmediate(() => {
    try {
      execFileSync("tar", ["czf", ARCHIVE, ...lists], { stdio: "ignore" });

      if (GIT_SYNC_URL) {
        execFileSync("git", ["clone", "--depth", "1", GIT_SYNC_URL, GIT_DIR], { stdio: "ignore" });
        fs.copyFileSync(ARCHIVE, path.join(GIT_DIR, "storage.tar.gz"));
        spawnSync("git", ["-C", GIT_DIR, "add", "storage.tar.gz"], { stdio: "ignore" });
        spawnSync("git", ["-C", GIT_DIR, "-c", "user.name=persist", "-c", "user.email=persist@bot", "commit", "--allow-empty", "-m", `backup ${reason}`], { stdio: "ignore" });
        const r = spawnSync("git", ["-C", GIT_DIR, "push", "-f", "origin", "HEAD"], { stdio: "pipe", encoding: "utf8" });
        if (r.status === 0) log(`backup GitHub dikirim (${reason})`);
        else log("push GitHub gagal: " + ((r.stderr || "").trim().slice(-120)));
        uploading = false;
        return;
      }

      if (TOKEN && DATASET) {
        execFile(
          "hf",
          ["upload", DATASET, ARCHIVE, "storage.tar.gz", "--repo-type", "dataset", "--commit-message", `autosave (${reason})`],
          { env: process.env },
          () => (uploading = false),
        );
        log(`backup dikirim (${reason})`);
        return;
      }
      uploading = false;
    } catch (e) {
      uploading = false;
      log("backup gagal: " + (e && e.message ? e.message : e));
    }
  });
}

function start(reason) {
  if (!ready()) return false;
  restore();
  reason = reason || "periodik";
  setTimeout(() => save("awal"), 90 * 1000);
  setInterval(() => save(reason), SAVE_EVERY_MS);
  process.on("SIGTERM", () => save("shutdown"));
  return true;
}

module.exports = { ready, restore, save, start };

if (require.main === module) {
  start("cli");
}
