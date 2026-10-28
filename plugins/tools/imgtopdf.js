/**
 * ✧ Name    : imgtopdf
 * ✧ Category: tools
 * ✧ Deskripsi: Mengubah gambar biasa atau album menjadi PDF
 */

const pluginConfig = {
    name: 'imgtopdf',
    alias: [
        'topdf',
        'imagepdf',
        'jpgpdf',
        'pngpdf',
        'webppdf',
        'mediapdf'
    ],
    category: 'tools',
    description: 'Mengubah berbagai format gambar menjadi PDF',
    usage: '.imgtopdf dengan reply gambar',
    example: '.imgtopdf',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    isEnabled: true
};

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
    unwrapAssociatedChild,
    findAlbumChildren
} = require('../../src/lib/albumCache');

const {
    downloadContentFromMessage
} = require('hsnai');

let PDFDocument = null;
let sharp = null;

/* ============================================================
 * MODULE
 * ========================================================== */

try {
    const pdfLib = require('pdf-lib');

    PDFDocument = pdfLib.PDFDocument;

} catch (error) {

    console.error(
        '[IMGTOPDF] pdf-lib tidak ditemukan:',
        error.message
    );
}

try {

    sharp = require('sharp');

} catch (error) {

    console.error(
        '[IMGTOPDF] sharp tidak ditemukan:',
        error.message
    );
}

/* ============================================================
 * CONFIG
 * ========================================================== */

const TEMP_DIR = path.join(
    os.tmpdir(),
    'kenzie-imgtopdf'
);

const MAX_SIZE =
    50 * 1024 * 1024;

/* ============================================================
 * TEMP
 * ========================================================== */

function ensureTempDir() {

    if (!fs.existsSync(TEMP_DIR)) {

        fs.mkdirSync(
            TEMP_DIR,
            {
                recursive: true
            }
        );
    }
}

/* ============================================================
 * FILE NAME
 * ========================================================== */

function generateFileName() {

    const now = new Date();

    const tanggal =
        now.getFullYear() +
        String(now.getMonth() + 1)
            .padStart(2, '0') +
        String(now.getDate())
            .padStart(2, '0');

    const waktu =
        String(now.getHours())
            .padStart(2, '0') +
        String(now.getMinutes())
            .padStart(2, '0') +
        String(now.getSeconds())
            .padStart(2, '0');

    const random =
        Math.random()
            .toString(36)
            .substring(2, 8);

    return `IMG_${tanggal}_${waktu}_${random}`;
}

/* ============================================================
 * MEDIA
 * ========================================================== */

function getMediaFromMessage(m) {

    if (
        m.quoted &&
        m.quoted.isMedia
    ) {

        return {
            source: m.quoted,
            type: m.quoted.type,
            mimetype:
                m.quoted.message?.mimetype || ''
        };
    }

    if (m.isMedia) {

        return {
            source: m,
            type: m.type,
            mimetype: m.mimetype || ''
        };
    }

    return null;
}

/* ============================================================
 * SUPPORTED IMAGE
 * ========================================================== */

function isSupportedImage(media) {

    if (!media) return false;

    const type =
        media.type || '';

    const mimetype =
        String(
            media.mimetype || ''
        ).toLowerCase();

    if (
        type === 'imageMessage'
    ) {
        return true;
    }

    const supportedMime = [

        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/bmp',
        'image/tiff',
        'image/x-tiff',
        'image/avif',
        'image/heic',
        'image/heif'

    ];

    return supportedMime.some(
        mime =>
            mimetype.startsWith(mime)
    );
}

/* ============================================================
 * DOWNLOAD NORMAL MEDIA
 * ========================================================== */

async function downloadMedia(media) {

    if (
        !media ||
        !media.source
    ) {

        throw new Error(
            'Media tidak ditemukan.'
        );
    }

    const source =
        media.source;

    if (
        typeof source.download ===
        'function'
    ) {

        const result =
            await source.download();

        if (!result) {

            throw new Error(
                'Gambar gagal didownload.'
            );
        }

        if (
            Buffer.isBuffer(result)
        ) {

            return result;
        }

        if (
            result instanceof Uint8Array
        ) {

            return Buffer.from(
                result
            );
        }
    }

    if (
        typeof source.downloadMedia ===
        'function'
    ) {

        const result =
            await source.downloadMedia();

        if (
            Buffer.isBuffer(result)
        ) {

            return result;
        }

        if (
            result instanceof Uint8Array
        ) {

            return Buffer.from(
                result
            );
        }
    }

    throw new Error(
        'SC tidak menyediakan fungsi download media.'
    );
}

/* ============================================================
 * DOWNLOAD ALBUM IMAGE
 * ========================================================== */

async function downloadAlbumMedia(
    mediaMessage
) {

    const unwrapped =
        unwrapAssociatedChild(
            mediaMessage
        );

    const imageMessage =
        unwrapped
            ?.message
            ?.imageMessage;

    if (!imageMessage) {

        return null;
    }

    const hydrated = {
        ...imageMessage
    };

    const fields = [
        'mediaKey',
        'fileEncSha256',
        'fileSha256'
    ];

    for (
        const field of fields
    ) {

        if (
            typeof hydrated[field] ===
            'string'
        ) {

            hydrated[field] =
                Buffer.from(
                    hydrated[field],
                    'base64'
                );
        }
    }

    const stream =
        await downloadContentFromMessage(
            hydrated,
            'image'
        );

    const chunks = [];

    for await (
        const chunk of stream
    ) {

        chunks.push(chunk);
    }

    return Buffer.concat(
        chunks
    );
}

/* ============================================================
 * CONVERT TO PNG
 * ========================================================== */

async function convertToPng(
    buffer
) {

    if (!sharp) {

        throw new Error(
            'Module sharp tidak tersedia.'
        );
    }

    return await sharp(
        buffer,
        {
            animated: false
        }
    )
        .rotate()
        .png({
            compressionLevel: 9
        })
        .toBuffer();
}

/* ============================================================
 * CREATE MULTI PAGE PDF
 * ========================================================== */

async function createPdf(
    imageBuffers,
    outputPath
) {

    if (!PDFDocument) {

        throw new Error(
            'pdf-lib belum terinstall.'
        );
    }

    if (!sharp) {

        throw new Error(
            'sharp belum tersedia.'
        );
    }

    if (
        !Array.isArray(imageBuffers) ||
        !imageBuffers.length
    ) {

        throw new Error(
            'Tidak ada gambar untuk dibuat menjadi PDF.'
        );
    }

    const pdf =
        await PDFDocument.create();

    const A4_WIDTH =
        595.28;

    const A4_HEIGHT =
        841.89;

    const MARGIN =
        20;

    const maxWidth =
        A4_WIDTH -
        (MARGIN * 2);

    const maxHeight =
        A4_HEIGHT -
        (MARGIN * 2);

    for (
        const imageBuffer
        of imageBuffers
    ) {

        const pngBuffer =
            await convertToPng(
                imageBuffer
            );

        const metadata =
            await sharp(
                pngBuffer
            ).metadata();

        const imageWidth =
            metadata.width || 1;

        const imageHeight =
            metadata.height || 1;

        const image =
            await pdf.embedPng(
                pngBuffer
            );

        const scale =
            Math.min(
                maxWidth / imageWidth,
                maxHeight / imageHeight
            );

        const width =
            imageWidth * scale;

        const height =
            imageHeight * scale;

        const page =
            pdf.addPage([
                A4_WIDTH,
                A4_HEIGHT
            ]);

        const x =
            (A4_WIDTH - width) / 2;

        const y =
            (A4_HEIGHT - height) / 2;

        page.drawImage(
            image,
            {
                x,
                y,
                width,
                height
            }
        );
    }

    const pdfBytes =
        await pdf.save();

    fs.writeFileSync(
        outputPath,
        pdfBytes
    );

    return outputPath;
}

/* ============================================================
 * HELP
 * ========================================================== */

function sendHelp(m) {

    return m.reply(
`🎤✨ *HOSHINO AI → IMAGE TO PDF* ✨🎤

Haiii~ mau aku ubah gambar menjadi PDF? 💕

━━━━━━━━━━━━━━━━━━━━

📌 *CARA PAKAI*

Reply sebuah gambar lalu ketik:

*.imgtopdf*

Atau reply salah satu foto dari album:

*.imgtopdf*

━━━━━━━━━━━━━━━━━━━━

📸 *GAMBAR BIASA*

1 gambar
↓
1 halaman PDF

📚 *ALBUM*

Semua foto album
↓
1 file PDF
↓
1 foto = 1 halaman

━━━━━━━━━━━━━━━━━━━━

📂 *FORMAT*

✅ JPG
✅ JPEG
✅ PNG
✅ WEBP
✅ GIF
✅ BMP
✅ TIFF
✅ AVIF
✅ HEIC / HEIF*

━━━━━━━━━━━━━━━━━━━━

📄 *OUTPUT*

• PDF
• Ukuran A4
• Gambar otomatis disesuaikan
• Tidak terpotong
• Posisi di tengah

━━━━━━━━━━━━━━━━━━━━

💖 *ALIAS*

• .imgtopdf
• .topdf
• .imagepdf
• .jpgpdf
• .pngpdf
• .webppdf
• .mediapdf

━━━━━━━━━━━━━━━━━━━━

🎀 Reply fotonya dulu yaa~

*Hoshino Ai siap membantu~!* ✨

\* HEIC/HEIF tergantung dukungan Sharp.`
    );
}

/* ============================================================
 * HANDLER
 * ========================================================== */

async function handler(
    m,
    { sock }
) {

    let pdfPath = null;

    try {

        /* ====================================================
         * CHECK MODULE
         * ================================================== */

        if (!PDFDocument) {

            return m.reply(
`💫 *EHH?! PDF-LIB BELUM ADA~* 😭

Aku belum bisa membuat PDF
karena module *pdf-lib* belum terpasang.

📦 Jalankan:

npm install pdf-lib

Setelah itu restart bot yaa~ ✨

🎤 *Hoshino Ai siap membantu lagi!* 💕`
            );
        }

        if (!sharp) {

            return m.reply(
`💫 *Aduhh~ Sharp belum tersedia!* 🥺

Aku membutuhkan Sharp untuk membaca
dan mengolah gambar.

🔧 Coba cek instalasi Sharp
di SC kamu yaa~

✨ Setelah selesai, panggil aku lagi!`
            );
        }

        /* ====================================================
         * HARUS REPLY
         * ================================================== */

        if (!m.quoted) {

            return sendHelp(m);
        }

        /* ====================================================
         * REACTION
         * ================================================== */

        await sock.sendMessage(
            m.chat,
            {
                react: {
                    text: '⏳',
                    key: m.key
                }
            }
        ).catch(() => {});

        /* ====================================================
         * IDENTITAS QUOTED
         * ================================================== */

        const quoted =
            m.quoted;

        const chatId =
            quoted.key?.remoteJid ||
            m.chat;

        const parentId =
            quoted.id;

        const parentSender =
            quoted.key?.fromMe
                ? 'me'
                : (
                    quoted.key?.participant ||
                    quoted.sender ||
                    null
                );

        console.log(
            '[imgtopdf] DEBUG album:',
            {
                chatId,
                parentId,
                parentSender
            }
        );

        /* ====================================================
         * CARI ALBUM
         * ================================================== */

        const albumChildren =
            findAlbumChildren(
                chatId,
                parentId,
                parentSender
            );

        let imageBuffers = [];

        /* ====================================================
         * ALBUM
         * ================================================== */

        if (
            albumChildren.length
        ) {

            await m.reply(
`🎤 *YATTAAA~! ALBUM KETEMU!* ✨

Aku menemukan *${albumChildren.length} foto*
di album ini! 📸💕

Tunggu sebentar yaa~
Aku sedang menggabungkannya
menjadi satu PDF~ 📄✨`
            );

            for (
                const child
                of albumChildren
            ) {

                try {

                    const unwrapped =
                        unwrapAssociatedChild(
                            child
                        );

                    const imageMessage =
                        unwrapped
                            ?.message
                            ?.imageMessage;

                    if (!imageMessage) {

                        continue;
                    }

                    const buffer =
                        await downloadAlbumMedia(
                            unwrapped
                        );

                    if (
                        !buffer ||
                        !Buffer.isBuffer(buffer) ||
                        !buffer.length
                    ) {

                        continue;
                    }

                    if (
                        buffer.length >
                        MAX_SIZE
                    ) {

                        console.log(
                            '[imgtopdf] Skip gambar > 50 MB'
                        );

                        continue;
                    }

                    imageBuffers.push(
                        buffer
                    );

                } catch (error) {

                    console.error(
                        '[imgtopdf] Gagal proses album item:',
                        error.message
                    );
                }
            }

        } else {

            /* =================================================
             * GAMBAR BIASA
             * =============================================== */

            const media =
                getMediaFromMessage(
                    m
                );

            if (!media) {

                return m.reply(
`🥺 *EHHH~? FOTONYA NGGAK TERBACA!*

Aku belum menemukan gambar
yang kamu reply.

Coba begini yaa:

1️⃣ Reply fotonya 📸
2️⃣ Ketik *.imgtopdf*

Kalau itu album, reply salah satu
fotonya yaa~ 💕`
                );
            }

            if (
                !isSupportedImage(
                    media
                )
            ) {

                return m.reply(
`💫 *Hmm~ itu bukan gambar yang bisa aku proses.*

Aku hanya bisa mengubah gambar
menjadi PDF yaa~ 📄

📸 *Format yang didukung:*

• JPG / JPEG
• PNG
• WEBP
• GIF
• BMP
• TIFF
• AVIF
• HEIC / HEIF*

Coba reply gambarnya lagi yaa~ 💕`
                );
            }

            const buffer =
                await downloadMedia(
                    media
                );

            if (
                !buffer ||
                !Buffer.isBuffer(buffer) ||
                !buffer.length
            ) {

                throw new Error(
                    'Buffer gambar kosong.'
                );
            }

            if (
                buffer.length >
                MAX_SIZE
            ) {

                throw new Error(
                    'Ukuran gambar terlalu besar. Maksimal 50 MB.'
                );
            }

            imageBuffers.push(
                buffer
            );
        }

        /* ====================================================
         * VALIDASI
         * ================================================== */

        if (
            !imageBuffers.length
        ) {

            throw new Error(
                'Tidak ada gambar yang berhasil diproses.'
            );
        }

        /* ====================================================
         * PROGRESS
         * ================================================== */

        await m.reply(
`🎀 *SEDIKIT LAGI~!* ✨

Aku sedang menyusun:

📸 *${imageBuffers.length} gambar*
📄 *${imageBuffers.length} halaman*

Tunggu sebentar yaa~ 💕
Aku mau bikin hasilnya rapi~ 🎤✨`
        );

        /* ====================================================
         * TEMP
         * ================================================== */

        ensureTempDir();

        const fileName =
            generateFileName();

        pdfPath =
            path.join(
                TEMP_DIR,
                `${fileName}.pdf`
            );

        /* ====================================================
         * CREATE PDF
         * ================================================== */

        await createPdf(
            imageBuffers,
            pdfPath
        );

        if (
            !fs.existsSync(
                pdfPath
            )
        ) {

            throw new Error(
                'File PDF tidak berhasil dibuat.'
            );
        }

        const pdfBuffer =
            fs.readFileSync(
                pdfPath
            );

        if (
            !pdfBuffer.length
        ) {

            throw new Error(
                'File PDF kosong.'
            );
        }

        /* ====================================================
         * SEND PDF
         * ================================================== */

        await sock.sendMessage(
            m.chat,
            {
                document: pdfBuffer,
                mimetype:
                    'application/pdf',
                fileName:
                    `${fileName}.pdf`,
                caption:
`🎤✨ *YATTAAA~! PDF SELESAI!* ✨🎤

━━━━━━━━━━━━━━━━━━━━

📸 *Jumlah gambar*
${imageBuffers.length} gambar

📄 *Jumlah halaman*
${imageBuffers.length} halaman

📐 *Ukuran halaman*
A4

📦 *Ukuran file*
${(
    pdfBuffer.length / 1024
).toFixed(2)} KB

📝 *Nama file*
${fileName}.pdf

━━━━━━━━━━━━━━━━━━━━

💖 Semua fotonya sudah aku rapikan
dan masukkan ke dalam PDF~

Jangan lupa disimpan yaa! ✨

🎀 *Hoshino Ai siap membantu lagi~!*`
            },
            {
                quoted: m
            }
        );

        /* ====================================================
         * SUCCESS REACTION
         * ================================================== */

        await sock.sendMessage(
            m.chat,
            {
                react: {
                    text: '💖',
                    key: m.key
                }
            }
        ).catch(() => {});

    } catch (error) {

        /* ====================================================
         * ERROR
         * ================================================== */

        console.error(
            '[IMGTOPDF ERROR]',
            error
        );

        await sock.sendMessage(
            m.chat,
            {
                react: {
                    text: '🥺',
                    key: m.key
                }
            }
        ).catch(() => {});

        return m.reply(
`🥺 *ADUHH~ AKU GAGAL MEMBUAT PDF...*

━━━━━━━━━━━━━━━━━━━━

⚠️ *Alasan:*

${error.message ||
    'Terjadi kesalahan yang tidak diketahui.'}

━━━━━━━━━━━━━━━━━━━━

💡 *Coba lagi yaa:*

📸 Reply gambar atau album
⌨️ Ketik *.imgtopdf*

Kalau masih gagal, kirim error
Terminal-nya ke aku.

Kita cari masalahnya bareng-bareng! 💕

🎤 *Hoshino Ai tidak akan menyerah~!* ✨`
        );

    } finally {

        /* ====================================================
         * CLEANUP
         * ================================================== */

        try {

            if (
                pdfPath &&
                fs.existsSync(
                    pdfPath
                )
            ) {

                fs.unlinkSync(
                    pdfPath
                );
            }

        } catch (error) {

            console.error(
                '[IMGTOPDF CLEANUP]',
                error.message
            );
        }
    }
}

/* ============================================================
 * EXPORT
 * ========================================================== */

module.exports = {
    config: pluginConfig,
    handler
};