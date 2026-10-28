// Persistensi sesi untuk hosting ephemeral (HF Space free dsb.)
// Butuh env: HF_TOKEN (secret) + HF_SESSION_DATASET (contoh: itsukakotori79/hsnai-bot-data)
// Mekanisme: tar storage/session + database -> upload ke HF Dataset (private),
//            saat boot restore kalau sesi belum ada. Pakai CLI `hf`.
const { execFile, execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const DATASET = process.env.HF_SESSION_DATASET || "";
const TOKEN = process.env.HF_TOKEN || "";
const ARCHIVE = path.join(os.tmpdir(), "hsnai-storage.tar.gz");
const DIRS = ["storage/session", "database"];
const SAVE_EVERY_MS = 10 * 60 * 1000; // 10 menit
let uploading = false;

function log(msg) {
  console.log(`[persist] ${msg}`);
}

function ready() {
  return Boolean(TOKEN && DATASET);
}

function trustEnv() {
  if (TOKEN) process.env.HF_TOKEN = TOKEN;
  process.env.HF_HUB_DISABLE_XET = "1";
}

function restore() {
  if (!ready()) {
    log("lewat (HF_TOKEN/HF_SESSION_DATASET belum diset)");
    return false;
  }
  trustEnv();
  if (fs.existsSync(path.join("storage", "session", "creds.json"))) {
    log("sesi lokal sudah ada — restore dibagi lewati");
    return true;
  }
  try {
    execFileSync("hf", ["auth", "whoami"], { stdio: "ignore" });
    execFileSync(
      "hf",
      [
        "download",
        DATASET,
        "storage.tar.gz",
        "--repo-type",
        "dataset",
        "--local-dir",
        os.tmpdir(),
        "--force-download",
      ],
      { stdio: "ignore" },
    );
    execFileSync("tar", ["xzf", ARCHIVE, "-C", "."], { stdio: "ignore" });
    const ok = fs.existsSync(path.join("storage", "session", "creds.json"));
    log(ok ? "restore selesai — sesi lama dipulihkan" : "restore jalan tapi creds.json tak temuan");
    return ok;
  } catch (e) {
    log("restore: belum ada backup lama (normal untuk space baru)");
    return false;
  }
}

function save(reason) {
  if (!ready() || uploading) return;
  uploading = true;
  setImmediate(() => {
    try {
      const lists = [];
      for (const d of DIRS) {
        if (fs.existsSync(d)) lists.push(d);
      }
      if (!lists.length) {
        uploading = false;
        return;
      }
      execFileSync("tar", ["czf", ARCHIVE, ...lists], { stdio: "ignore" });
      execFile(
        "hf",
        [
          "upload",
          DATASET,
          ARCHIVE,
          "storage.tar.gz",
          "--repo-type",
          "dataset",
          "--commit-message",
          `autosave (${reason})`,
        ],
        { env: process.env },
        err => uploading = false,
      );
      log(`backup dikirim (${reason})`);
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
