/**
✧ Name    : htmltoeksekusi
✧ Category: tools
**/

'use strict'

// require dependency yang dibutuhin plugin ini.
const config = require('../../config')
const { generateMessageIDV2, downloadContentFromMessage } = require('baileys')
const crypto = require('crypto')

/* =========================================================
 * pluginConfig = metadata plugin, dipakai handler.js buat registrasi command
 * ========================================================= */

const pluginConfig = {
    name: 'htmltoeksekusi',
    alias: ['runhtml', 'exechtml', 'htmlrun'],
    category: 'tools',
    description: 'Reply ke kode HTML (teks atau file .html) buat dieksekusi jadi Rich HTML card yang bisa langsung dijalankan di WhatsApp.',
    usage: '.htmltoeksekusi [lebarxtinggi] (reply ke kode/file HTML)',
    example: '.htmltoeksekusi 400x650',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

/* =========================================================
 * CONFIG INTERNAL
 * ========================================================= */

const BOT_JID = '0@bot'
const MAX_HTML_LENGTH = 300000

/* =========================================================
 * EXTRACT HTML DARI QUOTED MESSAGE
 * ========================================================= */

function stripCodeFence(text = '') {
    const trimmed = String(text).trim()
    const fenceMatch = trimmed.match(/^```[a-zA-Z]*\n([\s\S]*?)\n?```$/)
    if (fenceMatch) return fenceMatch[1].trim()
    return trimmed
}

async function downloadQuotedDocument(m, docMsg) {
    if (typeof m.quoted?.download === 'function') {
        const buffer = await m.quoted.download()
        if (buffer) return Buffer.from(buffer)
    }
    const stream = await downloadContentFromMessage(docMsg, 'document')
    const chunks = []
    for await (const chunk of stream) {
        chunks.push(chunk)
    }
    return Buffer.concat(chunks)
}

async function extractHtmlFromQuoted(m) {
    const q = m.quoted
    if (!q) return null

    const docMsg =
        q.message?.documentMessage ||
        q.documentMessage ||
        (q.mtype === 'documentMessage' ? q : null)

    const mimetype = docMsg?.mimetype || q.mimetype || ''
    const fileName = docMsg?.fileName || q.fileName || ''
    const looksLikeHtmlFile =
        /text\/html/i.test(mimetype) ||
        /\.(html?|htm)$/i.test(fileName)

    if (docMsg && looksLikeHtmlFile) {
        const buffer = await downloadQuotedDocument(m, docMsg)
        if (buffer?.length) return buffer.toString('utf8')
    }

    const rawText =
        q.text ||
        q.body ||
        q.message?.conversation ||
        q.message?.extendedTextMessage?.text ||
        ''

    if (rawText && rawText.trim()) {
        return stripCodeFence(rawText)
    }

    return null
}

/* =========================================================
 * SCALE-TO-FIT WRAPPER (buat konten TANPA <video>)
 * ========================================================= */

function scopeInjectedStyles(html, scopeSelector = '#__hsn_content') {
    return html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs, css) => {
        const scoped = css.replace(/(^|\})\s*([^{}]+)\s*\{/g, (m, brace, selectors) => {
            const newSelectors = selectors
                .split(',')
                .map(sel => {
                    const s = sel.trim()
                    if (!s) return s
                    return s.replace(/^(html|body)(?=[\s.:#\[]|$)/i, scopeSelector)
                })
                .join(', ')
            return `${brace} ${newSelectors} {`
        })
        return `<style${attrs}>${scoped}</style>`
    })
}

function stripToBodyFragment(html = '') {
    let out = String(html)
    out = out.replace(/<!DOCTYPE[^>]*>/gi, '')
    out = out.replace(/<\/?html[^>]*>/gi, '')
    out = out.replace(/<head[^>]*>/gi, '')
    out = out.replace(/<\/head>/gi, '')
    out = out.replace(/<\/?body[^>]*>/gi, '')
    out = out.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
    return out.trim()
}

function sniffIntrinsicSize(html = '') {
    const patterns = [
        /width:\s*(\d{2,4})px[^};]*;\s*height:\s*(\d{2,4})px/i,
        /width:\s*(\d{2,4})px[\s\S]{0,120}?height:\s*(\d{2,4})px/i
    ]
    for (const pattern of patterns) {
        const match = html.match(pattern)
        if (match) {
            const width = parseInt(match[1], 10)
            const height = parseInt(match[2], 10)
            if (width >= 100 && width <= 1200 && height >= 100 && height <= 1600) {
                return { width, height }
            }
        }
    }
    return null
}

function parseSizeArg(text = '') {
    const match = String(text).match(/(\d{2,4})\s*[xX]\s*(\d{2,4})/)
    if (!match) return null
    return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) }
}

// estimasi tinggi dari jumlah elemen block-level -- murni JS, gak butuh
// browser eksternal (Puppeteer gak jalan di server ini, lihat histori)
function estimateFallbackHeight(fragment) {
    const blockTags = fragment.match(/<(div|p|section|article|header|footer|li|tr|h[1-6])\b/gi) || []
    const lineBreaks = fragment.match(/<br\s*\/?>/gi) || []

    const estimated = 120 + (blockTags.length * 45) + (lineBreaks.length * 20)

    return Math.min(Math.max(estimated, 200), 1600)
}

// urutan: manual arg > sniff CSS > estimasi dari kompleksitas fragment
function resolveSize(m, html) {
    const manual = parseSizeArg(m.text)
    if (manual) return manual

    const sniffed = sniffIntrinsicSize(html)
    if (sniffed) return sniffed

    const fragment = stripToBodyFragment(scopeInjectedStyles(html))
    return { width: 400, height: estimateFallbackHeight(fragment) }
}

const STORAGE_SHIM = `<script>
(function() {
  function memStorage() {
    const m = {};
    return {
      getItem: k => (k in m ? m[k] : null),
      setItem: (k, v) => { m[k] = String(v); },
      removeItem: k => { delete m[k]; },
      clear: () => { for (const k in m) delete m[k]; }
    };
  }
  try { window.localStorage.getItem; } catch (e) {
    Object.defineProperty(window, 'localStorage', { value: memStorage(), configurable: true });
  }
  try { window.sessionStorage.getItem; } catch (e) {
    Object.defineProperty(window, 'sessionStorage', { value: memStorage(), configurable: true });
  }
})();
</script>`

/* =========================================================
 * EMBED REMOTE MEDIA (img/audio/video) JADI BASE64
 *
 * CATATAN: sebelumnya <video>/<source> sengaja gak di-embed,
 * dengan asumsi URL video eksternal "udah kebukti jalan fine".
 * Asumsi itu keliru -- video via URL eksternal gak play di Rich
 * HTML WebView WA, sedangkan base64 data URI (dites lewat .eval
 * langsung) kebukti PLAY normal. Makanya <video>/<source> sekarang
 * ikut di-embed sama kayak img/audio.
 *
 * Video tetap butuh wrapForDirectExecution() (lihat bawah) --
 * itu nanganin masalah LAIN: <video> pecah kalau dibungkus
 * <svg><foreignObject>, berlaku baik src-nya URL maupun base64.
 * ========================================================= */

const MEDIA_FETCH_TIMEOUT = 10000
const MEDIA_USER_AGENT = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'

const EXT_MIME_MAP = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
    mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', opus: 'audio/opus',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska'
}

function guessMimeFromUrl(url = '') {
    const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase()
    return EXT_MIME_MAP[ext] || 'application/octet-stream'
}

async function fetchAsDataUri(url) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), MEDIA_FETCH_TIMEOUT)

    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': MEDIA_USER_AGENT },
            signal: controller.signal
        })
        if (!res.ok) {
            console.warn(`[embedMedia] fetch gagal (${res.status}):`, url)
            return null
        }

        const buffer = Buffer.from(await res.arrayBuffer())
        if (!buffer.length) {
            console.warn(`[embedMedia] buffer kosong, skip:`, url)
            return null
        }

        const mimetype = res.headers.get('content-type')?.split(';')[0]?.trim() || guessMimeFromUrl(url)
        console.log(`[embedMedia] berhasil embed (${(buffer.length / 1024 / 1024).toFixed(1)}MB):`, url)
        return `data:${mimetype};base64,${buffer.toString('base64')}`
    } catch (e) {
        console.warn(`[embedMedia] error:`, e.message, url)
        return null
    } finally {
        clearTimeout(timeout)
    }
}

function extractRemoteMediaUrls(html) {
    const urls = new Set()
    const patterns = [
        /<img\b[^>]*\bsrc=["']([^"']+)["']/gi,
        /<audio\b[^>]*\bsrc=["']([^"']+)["']/gi,
        /<video\b[^>]*\bsrc=["']([^"']+)["']/gi,
        /<source\b[^>]*\bsrc=["']([^"']+)["']/gi
    ]

    for (const pattern of patterns) {
        let match
        while ((match = pattern.exec(html)) !== null) {
            const url = match[1]
            if (/^https?:\/\//i.test(url)) urls.add(url)
        }
    }

    return [...urls]
}

async function embedRemoteMedia(html) {
    const urls = extractRemoteMediaUrls(html)
    if (!urls.length) return html

    const results = await Promise.all(
        urls.map(async url => ({ url, dataUri: await fetchAsDataUri(url) }))
    )

    let out = html
    for (const { url, dataUri } of results) {
        if (!dataUri) continue
        const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        out = out.replace(new RegExp(escaped, 'g'), dataUri)
    }

    return out
}

function wrapForScaledExecution(rawHtml, size) {
    const scopedHtml = scopeInjectedStyles(rawHtml)
    const fragment = stripToBodyFragment(scopedHtml)
    const baseW = size.width
    const baseH = size.height

    return `
<div id="__hsn_stage" style="width:100%;background:#0a0a0a;">
  <svg viewBox="0 0 ${baseW} ${baseH}" preserveAspectRatio="xMidYMid meet" style="width:100%;display:block;">
    <foreignObject x="0" y="0" width="${baseW}" height="${baseH}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:${baseW}px;height:${baseH}px;overflow:hidden;color:#fff;">
${STORAGE_SHIM}
${fragment}
      </div>
    </foreignObject>
  </svg>
</div>
`
}

/* =========================================================
 * DIRECT EXECUTION (buat konten YANG ADA <video>)
 *
 * <video> di dalam <svg><foreignObject> gak reliable -- decode
 * pipeline-nya gak ke-composite bener di banyak browser engine
 * (termasuk WebView renderer Rich HTML WA). Fix: skip wrapper SVG
 * sama sekali buat konten yang ada video-nya, kirim fragment
 * langsung. Konsekuensinya: kehilangan auto-scale-to-fit, tapi
 * video-nya beneran bisa diputar.
 * ========================================================= */

function hasVideoTag(html) {
    return /<video\b/i.test(html)
}

function wrapForDirectExecution(rawHtml) {
    const scopedHtml = scopeInjectedStyles(rawHtml)
    const fragment = stripToBodyFragment(scopedHtml)

    return `${STORAGE_SHIM}\n${fragment}`
}

/* =========================================================
 * SEND RICH HTML
 * ========================================================= */

async function sendRichHtml(sock, m, html, opts = {}) {
    const title = opts.title || 'HTML Executor'
    const disclaimer = opts.disclaimer || title
    const sourceUrl =
        config.info?.website ||
        config.saluran?.link ||
        'https://hoshino.ai'

    const responseId = generateMessageIDV2()
    const messageSecret = crypto.randomBytes(32).toString('base64')

    const unifiedData = Buffer
        .from(
            JSON.stringify({
                response_id: responseId,
                sections: [
                    {
                        view_model: {
                            primitive: {
                                __typename: 'GenAIaeacdsnwHtmlPrimitive',
                                payload: html,
                                trusted_sources: [sourceUrl]
                            },
                            __typename: 'GenAISingleLayoutViewModel'
                        }
                    }
                ]
            })
        )
        .toString('base64')

    await sock.relayMessage(
        m.chat,
        {
            messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2,
                messageSecret,
                botMetadata: {
                    messageDisclaimerText: disclaimer,
                    botResponseId: responseId
                }
            },
            botForwardedMessage: {
                message: {
                    richResponseMessage: {
                        messageType: 1,
                        submessages: [
                            {
                                messageType: 2,
                                messageText: title
                            }
                        ],
                        unifiedResponse: { data: unifiedData },
                        contextInfo: {
                            mentionedJid: [],
                            groupMentions: [],
                            statusAttributions: [],
                            forwardingScore: 1,
                            isForwarded: true,
                            forwardedAiBotMessageInfo: { botJid: BOT_JID },
                            forwardOrigin: 4
                        }
                    }
                }
            }
        },
        { messageId: responseId }
    )
}

/* =========================================================
 * HANDLER
 * ========================================================= */

async function handler(m, { sock }) {
    await m.react('🧩')

    try {
        if (!m.quoted) {
            await m.react('❌')
            return m.reply(
                `❌ *ʀᴇᴘʟʏ ᴅᴜʟᴜ ᴅᴏɴɢ~*\n\n` +
                `> Reply ke pesan yang isinya kode HTML (teks atau file .html), baru ketik *.${pluginConfig.name}*`
            )
        }

        const html = await extractHtmlFromQuoted(m)

        if (!html) {
            await m.react('❌')
            return m.reply(
                `❌ *ᴀɪ ɢᴀᴋ ɴᴇᴍᴜ ᴋᴏᴅᴇ ʜᴛᴍʟ-ɴʏᴀ~*\n\n` +
                `> Pastiin pesan yang di-reply berisi kode HTML (teks langsung atau file .html), lalu coba lagi.`
            )
        }

        if (!/<[a-z][\s\S]*>/i.test(html)) {
            await m.react('❌')
            return m.reply(
                `❌ *ɪɴɪ ʙᴜᴋᴀɴ ᴋᴏᴅᴇ ʜᴛᴍʟ~*\n\n` +
                `> Pesan yang di-reply nggak ngandung tag HTML sama sekali. Kirim kode HTML beneran ya~`
            )
        }

        if (html.length > MAX_HTML_LENGTH) {
            await m.react('❌')
            return m.reply(
                `❌ *ᴋᴏᴅᴇɴʏᴀ ᴋᴇᴘᴀɴᴊᴀɴɢᴀɴ, sᴀʏ~*\n\n` +
                `> Maksimal sekitar ${MAX_HTML_LENGTH.toLocaleString('id-ID')} karakter, punya kamu ${html.length.toLocaleString('id-ID')} karakter.`
            )
        }

        const embeddedHtml = await embedRemoteMedia(html)

        const wrappedHtml = hasVideoTag(embeddedHtml)
            ? wrapForDirectExecution(embeddedHtml)
            : wrapForScaledExecution(embeddedHtml, resolveSize(m, embeddedHtml))

        await sendRichHtml(sock, m, wrappedHtml, {
            title: 'HTML Executor',
            disclaimer: 'HTML Executor'
        })

        await m.react('✅')
    } catch (error) {
        console.error('[htmltoeksekusi] Error:', error)
        await m.react('❌')

        return m.reply(
            `❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ ɴɢᴇᴋsᴇᴋᴜsɪ ʜᴛᴍʟ-ɴʏᴀ*\n\n` +
            `> ${error?.message || 'Unknown error'}\n\n` +
            `> Cek lagi kodenya ya, siapa tau ada tag yang belum ketutup~ 💫`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}