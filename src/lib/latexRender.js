// latexRender.js — render ekspresi LaTeX jadi PNG (via codecogs.com), upload ke
// server WA, hasilnya dipakai sebagai native inline math lewat AIRich (persis
// fitur "Meta AI" — rumus muncul sebagai gambar kecil nempel di teks).
const axios = require('axios')
const sharp = require('sharp')
const { prepareWAMessageMedia } = require('hsnai')

const LATEX_BG = '1a1a2e'
const LATEX_DPI = 200

async function renderLatexToPng(latex, { bgColor = LATEX_BG, dpi = LATEX_DPI } = {}) {
    // \color{White} WAJIB disertakan — kalau enggak, teksnya default hitam dan
    // gak keliatan di atas background gelap (bug di source Ourin aslinya, LATEX_FG
    // didefinisiin tapi gak pernah dipakai)
    const url = `https://latex.codecogs.com/png.image?\\dpi{${dpi}}\\bg{${bgColor}}\\color{White} ${encodeURIComponent(latex)}`
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 })
    const buffer = Buffer.from(res.data)
    const metadata = await sharp(buffer).metadata()
    return { buffer, width: metadata.width || 200, height: metadata.height || 80 }
}

async function uploadLatexImage(sock, buffer) {
    const media = await prepareWAMessageMedia({ image: buffer }, { upload: sock.waUploadToServer })
    const imgMsg = media?.imageMessage
    return { url: imgMsg?.url || '', directPath: imgMsg?.directPath || '' }
}

// Cari semua $...$ / $$...$$ di teks, render tiap formula jadi PNG, upload, lalu
// ganti jadi tag native AIRich: [formula|width|height]<url>
// Fail-safe per-formula: kalau satu formula gagal render/upload, itu doang yang
// fallback ke teks biasa — formula lain & sisa chat tetap jalan normal.
async function convertLatexToRichTags(sock, text) {
    const regex = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g
    const matches = []
    let match
    while ((match = regex.exec(text)) !== null) {
        matches.push({ full: match[0], formula: (match[1] || match[2] || '').trim(), index: match.index })
    }
    if (matches.length === 0) return text

    let result = ''
    let lastIndex = 0
    for (const m of matches) {
        result += text.slice(lastIndex, m.index)
        try {
            const { buffer, width, height } = await renderLatexToPng(m.formula)
            const { url } = await uploadLatexImage(sock, buffer)
            result += url ? `[${m.formula}|${width}|${height}]<${url}>` : m.formula
        } catch (e) {
            console.log('[AutoAI Latex] Gagal render/upload formula, fallback teks biasa:', e.message)
            result += m.formula
        }
        lastIndex = m.index + m.full.length
    }
    result += text.slice(lastIndex)
    return result
}

module.exports = { renderLatexToPng, uploadLatexImage, convertLatexToRichTags }