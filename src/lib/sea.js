const axios = require("axios");
const FormData = require("form-data");

async function uploadToCatbox(buffer, filename, contentType) {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("userhash", "");
  form.append("fileToUpload", buffer, {
    filename,
    contentType: contentType || "application/octet-stream",
    knownLength: buffer.length,
  });

  const res = await axios.post("https://catbox.moe/user/api.php", form, {
    headers: { ...form.getHeaders() },
    timeout: 60_000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true,
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Catbox HTTP ${res.status}`);
  }

  const url = typeof res.data === "string" ? res.data.trim() : null;
  if (!url || !url.startsWith("https://")) {
    throw new Error(`Catbox response tidak valid`);
  }

  return { url, directUrl: url };
}

/**
 * Upload buffer ke tmpfiles.org, fallback ke catbox.moe kalau gagal
 * @param {Buffer} buffer - isi file
 * @param {Object} opts
 * @param {string} opts.filename - wajib, mis: "image.jpg" / "video.mp4" / "audio.mp3"
 * @param {string} [opts.contentType] - opsional, mis: "image/jpeg"
 * @param {number} [opts.timeoutMs=60000]
 * @returns {Promise<{url:string,directUrl:string}>}
 */
async function uploadToTmpFiles(buffer, opts) {
  if (!Buffer.isBuffer(buffer)) throw new Error("buffer harus Buffer");
  if (!opts?.filename) throw new Error("opts.filename wajib (contoh: image.jpg)");

  // Coba tmpfiles dulu
  try {
    const form = new FormData();
    form.append("file", buffer, {
      filename: opts.filename,
      contentType: opts.contentType || "application/octet-stream",
      knownLength: buffer.length,
    });

    const res = await axios.post("https://tmpfiles.org/api/v1/upload", form, {
      headers: {
        ...form.getHeaders(),
        Accept: "application/json",
      },
      timeout: opts.timeoutMs ?? 60_000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true,
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Upload gagal (HTTP ${res.status})`);
    }

    const url = res.data?.data?.url;
    if (!url) throw new Error("Response tidak ada data.url");

    const directUrl = url
      .replace("http://tmpfiles.org/", "https://tmpfiles.org/dl/")
      .replace("https://tmpfiles.org/", "https://tmpfiles.org/dl/");

    return { url, directUrl };
  } catch (e) {
    console.warn("[sea] tmpfiles gagal, fallback ke catbox:", e.message);
  }

  // Fallback catbox
  return await uploadToCatbox(buffer, opts.filename, opts.contentType);
}

module.exports = { uploadToTmpFiles };
