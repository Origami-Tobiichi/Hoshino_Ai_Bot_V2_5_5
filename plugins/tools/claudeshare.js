const os = require('os')
const path = require('path')
const fs = require('fs')

const pluginConfig = {
    name: 'claudeshare',
    alias: ['claudeshare', 'sharecl', 'claudetxt', 'cshare'],
    category: 'tools',
    description: 'Salin isi link share claude.ai jadi file txt',
    usage: '.claudeshare <link claude.ai/share/...>',
    example: '.claudeshare https://claude.ai/share/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 20,
    energi: 1,
    isEnabled: true
}

const SHARE_RE = /https?:\/\/claude\.ai\/share\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const apiUrl = (id) => `https://claude.ai/api/chat_snapshots/${id}?rendering_mode=messages&render_all_tools=true`

// Cara 1: fetch langsung (cepat, tanpa browser)
async function fetchDirect(id) {
    const res = await fetch(apiUrl(id), {
        headers: {
            'User-Agent': UA,
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': `https://claude.ai/share/${id}`
        },
        signal: AbortSignal.timeout(20000)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const txt = await res.text()
    return JSON.parse(txt)
}

// Cara 2: lewat headless browser (kalau kena Cloudflare)
async function fetchViaBrowser(id) {
    process.env.TMPDIR = path.join(os.homedir(), 'tmp')
    fs.mkdirSync(process.env.TMPDIR, { recursive: true })

    const puppeteer = require('puppeteer-core')
    const chromium = require('@sparticuz/chromium')

    const browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: 'shell',
        protocolTimeout: 120000
    })
    try {
        const page = await browser.newPage()
        await page.setUserAgent(UA)
        await page.goto(`https://claude.ai/share/${id}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await new Promise(r => setTimeout(r, 6000)) // kasih waktu challenge Cloudflare selesai

        const out = await page.evaluate(async (u) => {
            const r = await fetch(u, { credentials: 'include' })
            return { status: r.status, text: await r.text() }
        }, apiUrl(id))

        if (out.status !== 200) throw new Error(`Browser HTTP ${out.status}`)
        return JSON.parse(out.text)
    } finally {
        await browser.close().catch(() => {})
    }
}

function blockToText(b) {
    if (!b) return ''
    switch (b.type) {
        case 'text':
            return b.text || ''
        case 'thinking':
            return '' // thinking dilewati
        case 'tool_use':
            return `[Tool: ${b.name || 'unknown'}]${b.input ? '\n' + JSON.stringify(b.input, null, 2) : ''}`
        case 'tool_result': {
            const c = Array.isArray(b.content) ? b.content.map(x => x.text || '').join('\n') : (b.content || '')
            return c ? `[Hasil Tool]\n${c}` : ''
        }
        default:
            return b.text || ''
    }
}

function snapshotToText(data, url) {
    const msgs = data.chat_messages || data.messages || []
    const title = data.snapshot_name || data.name || 'Percakapan Claude'
    const lines = []
    lines.push(`Judul : ${title}`)
    lines.push(`Sumber: ${url}`)
    lines.push(`Pesan : ${msgs.length}`)
    lines.push('='.repeat(50), '')

    msgs.forEach((msg, i) => {
        const who = msg.sender === 'human' ? 'USER' : 'CLAUDE'
        let body = ''
        if (Array.isArray(msg.content) && msg.content.length) {
            body = msg.content.map(blockToText).filter(Boolean).join('\n\n')
        }
        if (!body) body = msg.text || ''

        lines.push(`[${i + 1}] ${who}`)
        lines.push('-'.repeat(50))
        lines.push(body.trim())

        // lampiran yang teksnya sudah diekstrak (mis. file yang ditempel)
        for (const a of msg.attachments || []) {
            if (a.extracted_content) {
                lines.push('', `[Lampiran: ${a.file_name || 'tanpa nama'}]`, a.extracted_content)
            }
        }
        lines.push('', '')
    })
    return { title, text: lines.join('\n') }
}

const safeName = (s) => (s || 'claude-chat').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'claude-chat'

async function handler(m, { sock }) {
    const jid = m.chat || m.key?.remoteJid
    const src = `${m.text || m.body || ''} ${m.quoted?.text || ''}`
    const match = src.match(SHARE_RE)

    if (!match) {
        return sock.sendMessage(jid, {
            text: `╭┈┈⬡「 *CLAUDE SHARE* 」\n┃ Kirim link share Claude-nya ya~\n┃ Contoh: ${pluginConfig.example}\n╰┈┈┈┈┈┈┈┈⬡`
        }, { quoted: m })
    }

    const id = match[1]
    const url = match[0]

    await sock.sendMessage(jid, { text: '⭐ Bentar ya, lagi nyalin isi percakapannya...' }, { quoted: m })

    let data
    try {
        data = await fetchDirect(id)
    } catch (e1) {
        try {
            data = await fetchViaBrowser(id)
        } catch (e2) {
            return sock.sendMessage(jid, {
                text: `Gagal ambil percakapan.\n• Direct: ${e1.message}\n• Browser: ${e2.message}\n\nPastikan link masih aktif & bisa dibuka tanpa login.`
            }, { quoted: m })
        }
    }

    const { title, text } = snapshotToText(data, url)
    if (!text.trim()) {
        return sock.sendMessage(jid, { text: 'Percakapan kosong atau formatnya tidak dikenali.' }, { quoted: m })
    }

    await sock.sendMessage(jid, {
        document: Buffer.from(text, 'utf-8'),
        mimetype: 'text/plain',
        fileName: `${safeName(title)}.txt`,
        caption: `╭┈┈⬡「 *CLAUDE SHARE* 」\n┃ Judul: ${title}\n┃ Ukuran: ${(Buffer.byteLength(text) / 1024).toFixed(1)} KB\n╰┈┈┈┈┈┈┈┈⬡`
    }, { quoted: m })
}

module.exports = { config: pluginConfig, handler }