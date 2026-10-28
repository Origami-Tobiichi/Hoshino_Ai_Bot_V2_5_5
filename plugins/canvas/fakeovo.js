const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const pluginConfig = {
    name: 'fakeovo',
    alias: ['fovo', 'ovofake'],
    category: 'fun',
    description: 'Fake OVO receipt (stable version)',
    usage: '.ovo 10000',
    example: '.ovo 50000',
    cooldown: 3,
    isEnabled: true
};

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp");

const IMAGE_URL =
  "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Image/file_0000000078bc71fa87da5cf26dc6c008.jpeg";

const WIDTH = 841;
const HEIGHT = 1870;

const FONT_PATHS = [
  path.join(
    ROOT,
    "node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff2"
  )
];

const FIXED_RP = {
  text: "Rp",
  x: 61,
  y: 368,
  size: 20,
  weight: 800,
};

const AMOUNT_STYLE = {
  x: 94,
  y: 371,
  size: 28,
  weight: 800,
  color: "#FFFFFF",
};

function formatAmount(input) {
  const digits = String(input).replace(/[^\d]/g, "") || "0";
  const normalized = digits.replace(/^0+(?=\d)/, "");
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function registerFont() {
  for (const fontPath of FONT_PATHS) {
    if (fs.existsSync(fontPath)) {
      GlobalFonts.registerFromPath(fontPath, "Plus Jakarta Sans");
      return;
    }
  }
}

async function loadImageFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal download image: HTTP ${res.status}`);

  const buffer = await res.arrayBuffer();
  return loadImage(Buffer.from(buffer));
}

async function handler(m, { sock }) {
    try {

        // 🔥 SAME STYLE AS FAKEDANA (ANTI ERROR PARSING)
        const body =
            m.body ||
            m.text ||
            m.message?.conversation ||
            ''

        const input = body.trim().split(' ').slice(1).join(' ')

        if (!input) {
            return m.reply(
                `╭━━━━━━━━━━━━━━╮\n` +
                `  💸 *ꜰᴀᴋᴇ ᴏᴠᴏ* 💸\n` +
                `╰━━━━━━━━━━━━━━╯\n\n` +
                `✦ Usage : ${pluginConfig.usage}\n` +
                `✦ Contoh: ${pluginConfig.example}\n\n` +
                `> Masukkan nominal ya~ 🌸`
            )
        }

        const clean = input.replace(/[^0-9]/g, '')

        if (!clean) {
            return m.reply(
                `❌ Nominal harus angka ya~`
            )
        }

        const amount = Number(clean).toLocaleString('id-ID')

        fs.mkdirSync(OUTPUT_DIR, { recursive: true })

        registerFont()

        const bg = await loadImageFromUrl(IMAGE_URL)

        const canvas = createCanvas(WIDTH, HEIGHT)
        const ctx = canvas.getContext("2d")

        ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT)

        ctx.fillStyle = AMOUNT_STYLE.color
        ctx.textAlign = "left"

        ctx.font = `${FIXED_RP.weight} ${FIXED_RP.size}px "Plus Jakarta Sans"`
        ctx.fillText(FIXED_RP.text, FIXED_RP.x, FIXED_RP.y)

        ctx.font = `${AMOUNT_STYLE.weight} ${AMOUNT_STYLE.size}px "Plus Jakarta Sans"`
        ctx.fillText(amount, AMOUNT_STYLE.x, AMOUNT_STYLE.y)

        const file = path.join(OUTPUT_DIR, `ovo-${Date.now()}.png`)
        const out = await canvas.encode("png")

        await fsp.writeFile(file, out)

        await sock.sendMessage(m.chat, {
            image: fs.readFileSync(file),
            caption:
                `💸 *FAKE OVO*\n\n` +
                `💰 Saldo: Rp ${amount}\n` +
                `👤 Req by: @${m.sender.split('@')[0]}\n\n` +
                `✨ _“Bohong kecil itu kadang terasa nyata~”_`,
            mentions: [m.sender]
        }, { quoted: m })

        await m.react('💸')

    } catch (err) {
        console.error(err)
        await m.reply("❌ error: " + err.message)
    }
}

module.exports = {
    config: pluginConfig,
    handler
};