const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const pluginConfig = {
    name: 'bratvidgojo',
    alias: ['bratvgojo', 'gojovbrat', 'vidbratgojo', 'bratvideogojo'],
    category: 'sticker',
    description: 'Hoshino Ai membuat video stiker Gojo style Brat dengan teks custom ✨',
    usage: '.bratvidgojo <teks>',
    example: '.bratvidgojo Nah, I\'d win',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 2,
    isEnabled: true
}

// Konfigurasi
const BRAT_IMAGE_URL = "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Brat/Gojo.jpeg";
const BRAT_FONT_URL = "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Brat/Poppins.ttf";

const CANVAS = {
    width: 512,
    height: 512
};

const TEXT_AREA = {
    x: 0.20,
    y: 0.52,
    w: 0.60,
    h: 0.38
};

const TEXT_STYLE = {
    fontFamily: "Poppins",
    maxFontSize: 42,
    minFontSize: 16,
    lineHeight: 1.2,
    color: "#111111",
    align: "center"
};

const VIDEO_CONFIG = {
    fps: 20,
    width: 512,
    height: 512,
    quality: 80,
    lyric: {
        maxWordPerLayer: 4,
        frameDuration: 0.5,
        lastFrameDuration: 1.2
    }
};

let fontRegistered = false

async function downloadBuffer(url) {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Gagal download: ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
}

function normalizeText(text) {
    return String(text || "")
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function tokenize(text) {
    return normalizeText(text)
        .replace(/[,，]/g, " ")
        .split(/\s+/)
        .map((v) => v.trim())
        .filter(Boolean);
}

function splitIntoLayers(tokens, maxWordPerLayer) {
    if (!Number.isFinite(maxWordPerLayer) || maxWordPerLayer <= 0) {
        return [tokens];
    }
    const layers = [];
    for (let i = 0; i < tokens.length; i += maxWordPerLayer) {
        layers.push(tokens.slice(i, i + maxWordPerLayer));
    }
    return layers;
}

function resolveDurations(frames, lyric) {
    return frames.map((frame) => {
        return frame.isLastInLayer
            ? Math.max(0.3, lyric.lastFrameDuration)
            : Math.max(0.3, lyric.frameDuration);
    });
}

function buildRevealFrames(text, config) {
    const tokens = tokenize(text);
    const layers = splitIntoLayers(tokens, config.lyric.maxWordPerLayer);
    const frames = [];

    for (const layer of layers) {
        let current = "";
        for (let i = 0; i < layer.length; i++) {
            current += (current ? " " : "") + layer[i];
            frames.push({
                text: current,
                isLastInLayer: i === layer.length - 1
            });
        }
    }

    const durations = resolveDurations(frames, config.lyric);
    return frames.map((frame, index) => ({
        ...frame,
        duration: durations[index]
    }));
}

function getTextRect() {
    return {
        x: CANVAS.width * TEXT_AREA.x,
        y: CANVAS.height * TEXT_AREA.y,
        w: CANVAS.width * TEXT_AREA.w,
        h: CANVAS.height * TEXT_AREA.h,
        centerX: CANVAS.width * (TEXT_AREA.x + TEXT_AREA.w / 2),
        centerY: CANVAS.height * (TEXT_AREA.y + TEXT_AREA.h / 2)
    };
}

function setFont(ctx, size) {
    ctx.font = `${size}px ${TEXT_STYLE.fontFamily}`;
}

function splitLongWord(ctx, word, maxWidth) {
    const chars = [...word];
    const parts = [];
    let current = "";
    for (const char of chars) {
        const test = current + char;
        if (ctx.measureText(test).width <= maxWidth || !current) {
            current = test;
        } else {
            parts.push(current);
            current = char;
        }
    }
    if (current) parts.push(current);
    return parts;
}

function wrapParagraph(ctx, paragraph, maxWidth) {
    const words = paragraph.split(" ").filter(Boolean);
    const lines = [];
    let current = "";
    for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width <= maxWidth) {
            current = test;
            continue;
        }
        if (current) {
            lines.push(current);
            current = "";
        }
        if (ctx.measureText(word).width <= maxWidth) {
            current = word;
        } else {
            const parts = splitLongWord(ctx, word, maxWidth);
            lines.push(...parts.slice(0, -1));
            current = parts.at(-1) || "";
        }
    }
    if (current) lines.push(current);
    return lines;
}

function wrapText(ctx, text, maxWidth) {
    return text
        .split("\n")
        .flatMap((paragraph) => {
            const clean = paragraph.trim();
            return clean ? wrapParagraph(ctx, clean, maxWidth) : [""];
        });
}

function fitText(ctx, text, rect) {
    for (let size = TEXT_STYLE.maxFontSize; size >= TEXT_STYLE.minFontSize; size--) {
        setFont(ctx, size);
        const lineHeight = Math.ceil(size * TEXT_STYLE.lineHeight);
        const lines = wrapText(ctx, text, rect.w);
        const totalHeight = lines.length * lineHeight;
        if (totalHeight <= rect.h) {
            return { size, lines, lineHeight, totalHeight };
        }
    }
    const size = TEXT_STYLE.minFontSize;
    setFont(ctx, size);
    const lineHeight = Math.ceil(size * TEXT_STYLE.lineHeight);
    const lines = wrapText(ctx, text, rect.w);
    const maxLines = Math.max(1, Math.floor(rect.h / lineHeight));
    const clipped = lines.slice(0, maxLines);
    if (lines.length > maxLines && clipped.length) {
        let last = clipped[clipped.length - 1];
        while (last.length > 0 && ctx.measureText(`${last}...`).width > rect.w) {
            last = last.slice(0, -1);
        }
        clipped[clipped.length - 1] = `${last}...`;
    }
    return {
        size,
        lines: clipped,
        lineHeight,
        totalHeight: clipped.length * lineHeight
    };
}

function drawCenteredText(ctx, text) {
    const rect = getTextRect();
    const fitted = fitText(ctx, text, rect);
    const startY = rect.y + (rect.h - fitted.totalHeight) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();

    setFont(ctx, fitted.size);
    ctx.fillStyle = TEXT_STYLE.color;
    ctx.textAlign = TEXT_STYLE.align;
    ctx.textBaseline = "top";

    for (let i = 0; i < fitted.lines.length; i++) {
        ctx.fillText(fitted.lines[i], rect.centerX, startY + i * fitted.lineHeight);
    }
    ctx.restore();
}

async function createFrame(image, text, filePath) {
    const canvas = createCanvas(CANVAS.width, CANVAS.height);
    const ctx = canvas.getContext("2d");
    
    ctx.drawImage(image, 0, 0, CANVAS.width, CANVAS.height);
    drawCenteredText(ctx, text);
    
    fs.writeFileSync(filePath, await canvas.encode("png"));
}

function escapeConcatPath(filePath) {
    return filePath.replace(/'/g, "'\\''");
}

function buildManifest(frames, framePaths) {
    const lines = [];
    for (let i = 0; i < frames.length; i++) {
        lines.push(`file '${escapeConcatPath(framePaths[i])}'`);
        lines.push(`duration ${frames[i].duration}`);
    }
    lines.push(`file '${escapeConcatPath(framePaths[framePaths.length - 1])}'`);
    return lines.join("\n");
}

async function encodeToWebpSticker(concatPath, outputPath, config) {
    const args = [
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concatPath,
        "-vf", `fps=${config.fps},scale=${config.width}:${config.height}:flags=lanczos`,
        "-c:v", "libwebp",
        "-quality", String(config.quality),
        "-preset", "default",
        "-loop", "0",
        "-an",
        "-vsync", "0",
        outputPath
    ];
    
    await execFileAsync("ffmpeg", args, { maxBuffer: 1024 * 1024 * 50 });
}

async function createBratSticker(text, outputPath, config) {
    const frames = buildRevealFrames(text, config);
    if (!frames.length) throw new Error("Teks kosong");

    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "bratstick-"));
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    try {
        const [imageBuffer, fontBuffer] = await Promise.all([
            downloadBuffer(BRAT_IMAGE_URL),
            downloadBuffer(BRAT_FONT_URL)
        ]);

        if (!fontRegistered) {
            GlobalFonts.register(fontBuffer, TEXT_STYLE.fontFamily);
            fontRegistered = true;
        }

        const image = await loadImage(imageBuffer);
        const framePaths = frames.map((_, index) => {
            return path.join(tmpDir, `frame-${String(index + 1).padStart(4, "0")}.png`);
        });

        for (let i = 0; i < frames.length; i++) {
            await createFrame(image, frames[i].text, framePaths[i]);
        }

        const concatPath = path.join(tmpDir, "concat.txt");
        fs.writeFileSync(concatPath, buildManifest(frames, framePaths));
        await encodeToWebpSticker(concatPath, outputPath, config);

        return outputPath;
    } finally {
        await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
}

async function handler(m, { sock }) {
    let text = m.args?.join(' ') || m.text?.trim() || ''
    
    text = text.replace(/^\.bratvidgojo\s*/i, '').replace(/^\.bratgojo\s*/i, '').trim()
    
    if (!text) {
    await m.reply(
        `🌟🎤 *HOSHINO AI - BRAT GOJO STICKER* 🎤🌟\n\n` +
        `💖 *Cara pakai:*\n` +
        `.bratvidgojo <teks>\n\n` +
        `💖 *Contoh:*\n` +
        `.bratvidgojo Nah, I'd win\n` +
        `.bratvidgojo Throughout heaven and earth\n\n` +
        `✨ Yahhoo~!\n` +
        `Ai akan membuat stiker spesial untukmu~ ⭐\n\n` +
        `🎤 Saa~ mau menulis apa hari ini?`
    )
    return
}
    
    if (text.length > 150) {
        await m.reply(
    `🥺 Ehh~ teksnya terlalu panjang nih...\n\n` +
    `📏 Maksimal *150 karakter* yaa~\n\n` +
    `✨ Biar hasilnya tetap kawaii dan sugoi~ 💖`
)
        return
    }
    
    await m.react('🎤')
    
    try {
        const outputPath = path.join(os.tmpdir(), `gojobrat-${Date.now()}.webp`)
        
        await createBratSticker(text, outputPath, VIDEO_CONFIG)
        
        const stickerBuffer = fs.readFileSync(outputPath)
        
        // KIRIM STIKER AJA! GAK ADA CAPTION, GAK ADA APAPUN
        await sock.sendMessage(m.chat, {
        sticker: stickerBuffer,
        packname: 'Hoshino Ai Bot',
        author: 'Team Hoshino Ai Bot',
        mimetype: 'image/webp'
    }, { quoted: m })
        
        // Hapus file temporary
        try {
    fs.unlinkSync(outputPath)
} catch {}
        
        await m.react('⭐')
        
    } catch (err) {
        console.error('[BratGojo] Error:', err)
        await m.react('❌')
        await m.reply(
    `😭 Gomen ne...\n\n` +
    `Ai mengalami sedikit masalah saat membuat stikernya.\n\n` +
    `📌 Error:\n${err.message}\n\n` +
    `💻 Pastikan FFmpeg sudah terinstall yaa~\n` +
    `✨ Setelah itu coba lagi, Ai akan ganbatte! ⭐`
)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}