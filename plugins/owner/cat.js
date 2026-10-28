'use strict';

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { AIRich } = require('hsnai');

const pluginConfig = {
    name: 'cat',
    alias: ['readfile', 'catfile'],
    category: 'owner',
    description: 'Membaca isi file teks dan mengirimkannya sebagai teks, code block, atau HsnAi Rich Code.',
    usage: '.cat [-text|-code|-snip|-hsnai] (reply file/teks)',
    example: '.cat -snip',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true,
};

/* =========================================================
 * TEXT FILE SUPPORT
 * ======================================================= */

const TEXT_EXTENSIONS = new Set([
    'txt', 'text',
    'js', 'cjs', 'mjs', 'jsx',
    'ts', 'tsx',
    'json', 'json5', 'jsonc',
    'md', 'markdown', 'mdown', 'mkd',
    'html', 'htm', 'xhtml',
    'css', 'scss', 'sass', 'less',
    'xml', 'svg',
    'csv', 'tsv',
    'yaml', 'yml',
    'ini', 'cfg', 'conf',
    'env', 'log',
    'sh', 'bash', 'zsh',
    'bat', 'cmd', 'ps1',
    'sql',
    'php', 'py', 'rb', 'go', 'java',
    'kt', 'kts',
    'c', 'cpp', 'h', 'hpp',
    'rs', 'swift',
    'vue', 'svelte',
    'graphql', 'gql',
    'properties'
]);

const TEXT_MIMETYPES = new Set([
    'text/plain',
    'text/javascript',
    'application/javascript',
    'application/x-javascript',
    'application/json',
    'application/ld+json',
    'text/markdown',
    'text/html',
    'application/xhtml+xml',
    'text/css',
    'text/xml',
    'application/xml',
    'image/svg+xml',
    'text/csv',
    'text/tab-separated-values',
    'application/x-yaml',
    'text/yaml',
    'application/x-sh',
    'text/x-shellscript',
    'text/x-python',
    'text/x-java-source',
    'text/x-c',
    'text/x-c++src',
    'text/event-stream'
]);

/* =========================================================
 * HELPERS
 * ======================================================= */

function getExtension(fileName = '') {
    const clean = String(fileName)
        .split('?')[0]
        .split('#')[0]
        .trim();

    const index = clean.lastIndexOf('.');

    if (index === -1) return '';

    return clean.slice(index + 1).toLowerCase();
}

function normalizeText(text) {
    if (text == null) return '';

    return String(text)
        .replace(/^\uFEFF/, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
}

function isTextFile(fileName = '', mimetype = '') {
    const ext = getExtension(fileName);

    if (TEXT_EXTENSIONS.has(ext)) {
        return true;
    }

    const mime = String(mimetype || '')
        .toLowerCase()
        .split(';')[0]
        .trim();

    if (TEXT_MIMETYPES.has(mime)) {
        return true;
    }

    if (mime.startsWith('text/')) {
        return true;
    }

    return false;
}

function looksLikeBinary(buffer) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) {
        return false;
    }

    const sampleSize = Math.min(buffer.length, 8192);

    let suspicious = 0;

    for (let i = 0; i < sampleSize; i++) {
        const byte = buffer[i];

        if (byte === 0) {
            return true;
        }

        if (
            byte < 7 ||
            (byte > 14 && byte < 32)
        ) {
            suspicious++;
        }
    }

    return suspicious / sampleSize > 0.05;
}

/* =========================================================
 * DOCUMENT EXTRACTION
 * ======================================================= */

function findDocumentMessage(quoted) {
    if (!quoted) return null;

    return (
        quoted?.message?.documentMessage ||
        quoted?.message?.documentWithCaptionMessage?.message?.documentMessage ||
        quoted?.documentMessage ||
        quoted?.documentWithCaptionMessage?.message?.documentMessage ||
        quoted?.msg?.documentMessage ||
        null
    );
}

function getDocumentInfo(quoted, docMsg) {
    return {
        fileName:
            docMsg?.fileName ||
            quoted?.fileName ||
            quoted?.msg?.fileName ||
            '',

        mimetype:
            docMsg?.mimetype ||
            quoted?.mimetype ||
            quoted?.msg?.mimetype ||
            ''
    };
}

async function downloadDocument(docMsg) {
    if (!docMsg) return null;

    const stream = await downloadContentFromMessage(
        docMsg,
        'document'
    );

    const chunks = [];

    for await (const chunk of stream) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}

/* =========================================================
 * TEXT EXTRACTION
 * ======================================================= */

function extractTextContent(msg) {
    if (!msg || typeof msg !== 'object') {
        return null;
    }

    const content =
        msg.message &&
        typeof msg.message === 'object'
            ? msg.message
            : msg;

    if (typeof content.conversation === 'string') {
        return content.conversation;
    }

    if (
        content.extendedTextMessage &&
        typeof content.extendedTextMessage.text === 'string'
    ) {
        return content.extendedTextMessage.text;
    }

    const captionTypes = [
        'imageMessage',
        'videoMessage',
        'documentMessage',
        'documentWithCaptionMessage'
    ];

    for (const type of captionTypes) {
        if (
            content[type] &&
            typeof content[type].caption === 'string'
        ) {
            return content[type].caption;
        }
    }

    if (
        content.buttonsMessage &&
        typeof content.buttonsMessage.contentText === 'string'
    ) {
        return content.buttonsMessage.contentText;
    }

    if (content.templateMessage) {
        const hydrated =
            content.templateMessage.hydratedTemplate ||
            content.templateMessage.hydratedFourRowTemplate;

        if (
            hydrated &&
            typeof hydrated.hydratedContentText === 'string'
        ) {
            return hydrated.hydratedContentText;
        }
    }

    return null;
}

/* =========================================================
 * QUOTED CONTENT
 * ======================================================= */

async function getQuotedContent(quoted) {
    if (!quoted) {
        return null;
    }

    console.log(
        '[cat.js] quoted keys:',
        Object.keys(quoted)
    );

    const docMsg = findDocumentMessage(quoted);

    console.log(
        '[cat.js] document found:',
        !!docMsg
    );

    /* -------------------------
     * DOCUMENT
     * ----------------------- */

    if (docMsg) {
        const info = getDocumentInfo(
            quoted,
            docMsg
        );

        console.log(
            '[cat.js] fileName:',
            info.fileName
        );

        console.log(
            '[cat.js] mimetype:',
            info.mimetype
        );

        try {
            const buffer =
                await downloadDocument(docMsg);

            if (
                !Buffer.isBuffer(buffer) ||
                !buffer.length
            ) {
                return {
                    type: 'empty',
                    fileName: info.fileName,
                    mimetype: info.mimetype
                };
            }

            const declaredText =
                isTextFile(
                    info.fileName,
                    info.mimetype
                );

            const binary =
                looksLikeBinary(buffer);

            if (!declaredText && binary) {
                return {
                    type: 'binary',
                    buffer,
                    fileName: info.fileName,
                    mimetype: info.mimetype
                };
            }

            return {
                type: 'text',
                text: normalizeText(
                    buffer.toString('utf-8')
                ),
                fileName: info.fileName,
                mimetype: info.mimetype
            };

        } catch (err) {
            console.error(
                '[cat.js] gagal download dokumen:',
                err
            );

            return null;
        }
    }

    /* -------------------------
     * QUOTED TEXT
     * ----------------------- */

    const text =
        extractTextContent(quoted);

    if (typeof text === 'string') {
        return {
            type: 'text',
            text: normalizeText(text),
            fileName: '',
            mimetype: 'text/plain'
        };
    }

    /* Jangan fallback ke m.text di sini.
       Supaya command .cat sendiri tidak
       dianggap sebagai isi file. */

    return null;
}

/* =========================================================
 * JSON
 * ======================================================= */

function tryPrettyJson(text) {
    if (
        !text ||
        typeof text !== 'string'
    ) {
        return null;
    }

    const trimmed = text.trim();

    const fenced =
        trimmed.match(
            /^```(?:json|jsonc|json5)?\s*([\s\S]*?)\s*```$/i
        );

    const candidate =
        fenced
            ? fenced[1].trim()
            : trimmed;

    try {
        return JSON.stringify(
            JSON.parse(candidate),
            null,
            2
        );
    } catch {
        return null;
    }
}

/* =========================================================
 * LANGUAGE DETECTION
 * ======================================================= */

function detectLanguage(
    fileName = '',
    mimetype = ''
) {
    const ext = getExtension(fileName);

    const languages = {
        txt: 'text',
        text: 'text',

        js: 'javascript',
        cjs: 'javascript',
        mjs: 'javascript',
        jsx: 'javascript',

        ts: 'typescript',
        tsx: 'typescript',

        py: 'python',

        html: 'html',
        htm: 'html',
        xhtml: 'html',

        css: 'css',
        scss: 'scss',
        sass: 'sass',
        less: 'less',

        json: 'json',
        json5: 'json',
        jsonc: 'json',

        xml: 'xml',
        svg: 'xml',

        md: 'markdown',
        markdown: 'markdown',
        mdown: 'markdown',
        mkd: 'markdown',

        sh: 'bash',
        bash: 'bash',
        zsh: 'bash',

        bat: 'batch',
        cmd: 'batch',

        ps1: 'powershell',

        sql: 'sql',

        php: 'php',

        rb: 'ruby',

        java: 'java',

        kt: 'kotlin',
        kts: 'kotlin',

        c: 'c',
        h: 'c',

        cpp: 'cpp',
        hpp: 'cpp',

        rs: 'rust',

        go: 'go',

        swift: 'swift',

        vue: 'vue',

        svelte: 'svelte',

        graphql: 'graphql',
        gql: 'graphql',

        yaml: 'yaml',
        yml: 'yaml',

        ini: 'ini',
        cfg: 'ini',
        conf: 'ini',

        csv: 'csv',
        tsv: 'tsv',

        properties: 'properties',

        env: 'bash',
        log: 'text'
    };

    if (languages[ext]) {
        return languages[ext];
    }

    const mime =
        String(mimetype || '')
            .toLowerCase();

    if (mime.includes('javascript')) {
        return 'javascript';
    }

    if (mime.includes('json')) {
        return 'json';
    }

    if (mime.includes('html')) {
        return 'html';
    }

    if (mime.includes('css')) {
        return 'css';
    }

    if (mime.includes('xml')) {
        return 'xml';
    }

    if (mime.includes('python')) {
        return 'python';
    }

    if (mime.includes('yaml')) {
        return 'yaml';
    }

    if (mime.includes('markdown')) {
        return 'markdown';
    }

    if (mime.startsWith('text/')) {
        return 'text';
    }

    return 'text';
}

/* =========================================================
 * COMMAND PARSER
 * ======================================================= */

function parseCatCommand(text = '') {
    const args =
        String(text)
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    /*
     * args[0] biasanya .cat
     */

    let mode = 'text';

    for (const arg of args) {
        const value =
            arg.toLowerCase();

        if (
            value === '-snip' ||
            value === '--snip' ||
            value === '-hsnai' ||
            value === '--hsnai'
        ) {
            mode = 'hsnai';
            continue;
        }

        if (
            value === '-code' ||
            value === '--code'
        ) {
            mode = 'code';
            continue;
        }

        if (
            value === '-text' ||
            value === '--text'
        ) {
            mode = 'text';
        }
    }

    return {
        mode
    };
}

/* =========================================================
 * LABEL
 * ======================================================= */

function getFileLabel(
    fileName = '',
    mimetype = ''
) {
    const ext =
        getExtension(fileName);

    if (ext) {
        return ext.toUpperCase();
    }

    if (mimetype) {
        return mimetype;
    }

    return 'TEXT';
}

/* =========================================================
 * MARKDOWN CODE
 * ======================================================= */

function makeCodeBlock(
    language,
    text
) {
    const lang =
        language &&
        language !== 'text'
            ? language
            : '';

    return (
        '```' +
        lang +
        '\n' +
        text +
        '\n```'
    );
}

/* =========================================================
 * AIRICH
 * ======================================================= */

async function sendAIRich(
    m,
    sock,
    {
        text,
        fileName,
        mimetype
    }
) {
    const language =
        detectLanguage(
            fileName,
            mimetype
        );

    console.log(
        '[cat.js] AIRich language:',
        language
    );

    const rich =
        new AIRich(sock);

    rich.setTitle(
        fileName
            ? `CAT — ${fileName}`
            : 'CAT'
    );

    rich.setSubtitle(
        `Language: ${language}`
    );

    /*
     * AIRich mempunyai GenAICodeUXPrimitive
     * khusus untuk code.
     *
     * Untuk file yang punya bahasa,
     * gunakan addCode().
     */

    if (
        language &&
        language !== 'text'
    ) {
        rich.addCode(
            language,
            text
        );
    } else {
        /*
         * TXT / plain text
         */
        rich.addText(text);
    }

    const payload =
        await rich.build({
            forwarded: false,
            notification: false,
            includesUnifiedResponse: true,
            includesSubmessages: true
        });

    console.log(
        '[cat.js] AIRich payload:',
        JSON.stringify(
            payload,
            (key, value) => {
                if (Buffer.isBuffer(value)) {
                    return `[Buffer ${value.length} bytes]`;
                }

                return value;
            },
            2
        ).slice(0, 5000)
    );

    return await rich.send(
        m.chat,
        {
            forwarded: false,
            notification: false,
            includesUnifiedResponse: true,
            includesSubmessages: true
        }
    );
}

/* =========================================================
 * OUTPUT
 * ======================================================= */

async function sendCatOutput(
    m,
    sock,
    {
        mode,
        text,
        fileName,
        mimetype
    }
) {
    const language =
        detectLanguage(
            fileName,
            mimetype
        );

    /* TEXT */

    if (mode === 'text') {
        return await sock.sendMessage(
            m.chat,
            {
                text
            }
        );
    }

    /* NORMAL CODE BLOCK */

    if (mode === 'code') {
        return await sock.sendMessage(
            m.chat,
            {
                text: makeCodeBlock(
                    language,
                    text
                )
            }
        );
    }

    /* AIRICH */

    if (mode === 'hsnai') {
        return await sendAIRich(
            m,
            sock,
            {
                text,
                fileName,
                mimetype
            }
        );
    }

    return await sock.sendMessage(
        m.chat,
        {
            text
        }
    );
}

/* =========================================================
 * HANDLER
 * ======================================================= */

async function handler(
    m,
    { sock }
) {
    try {
        const { mode } =
            parseCatCommand(
                m.text || ''
            );

        const quoted =
            m.quoted;

        /*
         * WAJIB reply sesuatu.
         *
         * Tidak ada fallback m.text.
         */
        const content =
            await getQuotedContent(
                quoted
            );

        if (!content) {
            return m.reply(
                `╭┈┈⬡「 ᴄᴀᴛ 」\n` +
                `│ Reply file atau teks yang\n` +
                `│ mau dibaca dulu ya~\n` +
                `│\n` +
                `│ Mode:\n` +
                `│ • .cat -text\n` +
                `│ • .cat -code\n` +
                `│ • .cat -snip\n` +
                `│ • .cat -hsnai\n` +
                `│\n` +
                `│ Support:\n` +
                `│ • JS / CJS / MJS / JSX\n` +
                `│ • TS / TSX\n` +
                `│ • TXT / MD\n` +
                `│ • JSON / JSON5 / JSONC\n` +
                `│ • HTML / CSS / XML / SVG\n` +
                `│ • YAML / YML\n` +
                `│ • CSV / TSV\n` +
                `│ • PY / PHP / JAVA / KOTLIN\n` +
                `│ • C / C++ / RUST / GO / SWIFT\n` +
                `│ • SH / SQL / VUE / SVELTE\n` +
                `╰┈┈⬡`
            );
        }

        /* BINARY */

        if (content.type === 'binary') {
            await m.react('⚠️');

            return m.reply(
                `╭┈┈⬡「 ᴄᴀᴛ 」\n` +
                `│ File ini bukan file teks 😣\n` +
                `│\n` +
                `│ Nama: ${content.fileName || '-'}\n` +
                `│ Tipe: ${content.mimetype || 'unknown'}\n` +
                `│\n` +
                `│ CAT hanya membaca file\n` +
                `│ berbasis teks.\n` +
                `╰┈┈⬡`
            );
        }

        /* EMPTY */

        if (content.type === 'empty') {
            await m.react('⚠️');

            return m.reply(
                `╭┈┈⬡「 ᴄᴀᴛ 」\n` +
                `│ File-nya kosong 😣\n` +
                `╰┈┈⬡`
            );
        }

        await m.react('🕕');

        let textContent =
            normalizeText(
                content.text || ''
            );

        if (!textContent) {
            await m.react('⚠️');

            return m.reply(
                `╭┈┈⬡「 ᴄᴀᴛ 」\n` +
                `│ File atau teks-nya kosong 😣\n` +
                `╰┈┈⬡`
            );
        }

        /* JSON PRETTY PRINT */

        const ext =
            getExtension(
                content.fileName
            );

        const mime =
            String(
                content.mimetype || ''
            ).toLowerCase();

        if (
            ext === 'json' ||
            ext === 'json5' ||
            ext === 'jsonc' ||
            mime === 'application/json'
        ) {
            const pretty =
                tryPrettyJson(
                    textContent
                );

            if (pretty) {
                textContent = pretty;
            }
        }

        /* SIZE */

        const MAX_BYTES =
            65000;

        const byteLength =
            Buffer.byteLength(
                textContent,
                'utf-8'
            );

        const fileLabel =
            getFileLabel(
                content.fileName,
                content.mimetype
            );

        /*
         * File terlalu besar.
         *
         * Jangan kirim AIRich karena payload
         * rich code juga bisa terlalu besar.
         */
        if (
            byteLength > MAX_BYTES
        ) {
            const outputName =
                content.fileName ||
                `cat_${Date.now()}.${ext || 'txt'}`;

            await sock.sendMessage(
                m.chat,
                {
                    document:
                        Buffer.from(
                            textContent,
                            'utf-8'
                        ),

                    mimetype:
                        content.mimetype ||
                        'text/plain',

                    fileName:
                        outputName,

                    caption:
                        `╭┈┈⬡「 ᴄᴀᴛ 」\n` +
                        `│ File: ${outputName}\n` +
                        `│ Type: ${fileLabel}\n` +
                        `│ Size: ${byteLength} byte\n` +
                        `│ Mode: ${mode}\n` +
                        `│\n` +
                        `│ Isinya terlalu panjang untuk\n` +
                        `│ dikirim dalam satu pesan.\n` +
                        `│ Ai kirim ulang sebagai file ya~ ✨\n` +
                        `╰┈┈⬡`
                }
            );

            await m.react('✅');

            return;
        }

        /* SEND */

        await sendCatOutput(
            m,
            sock,
            {
                mode,
                text: textContent,
                fileName:
                    content.fileName,
                mimetype:
                    content.mimetype
            }
        );

        await m.react('✅');

    } catch (err) {
        console.error(
            '[cat.js]',
            err
        );

        try {
            await m.react('❌');
        } catch {}

        return m.reply(
            `╭┈┈⬡「 ᴄᴀᴛ 」\n` +
            `│ Gagal membaca file/teksnya 😖\n` +
            `│\n` +
            `│ Error: ${err?.message || 'Unknown error'}\n` +
            `╰┈┈⬡`
        );
    }
}

/* =========================================================
 * EXPORT
 * ======================================================= */

module.exports = {
    config: pluginConfig,
    handler
};