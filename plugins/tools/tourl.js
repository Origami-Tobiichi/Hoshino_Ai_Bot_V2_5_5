const FormData = require('form-data')
const fetch = require('node-fetch')
const mime = require('mime-types')
const crypto = require('crypto')
const path = require('path')
const { fileTypeFromBuffer } = require('file-type')
const { downloadMediaMessage, getContentType } = require('hsnai')
const config = require('../../config')

const pluginConfig = {
    name: 'tourl',
    alias: ['upload', 'catbox', 'url'],
    category: 'tools',
    description: 'Upload media ke multiple host dan dapatkan URL',
    usage: '.tourl (reply/kirim media)',
    example: '.tourl',
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function detectExt(buffer, fallback = 'bin') {
    try {
        const type = await fileTypeFromBuffer(buffer)
        return type?.ext || fallback
    } catch {
        return fallback
    }
}

function getFileExtension(mimetype) {
    const mimeMap = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
        'video/mp4': 'mp4', 'video/3gpp': '3gp', 'video/quicktime': 'mov',
        'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/mp4': 'm4a',
        'application/pdf': 'pdf', 'application/zip': 'zip'
    }
    return mimeMap[mimetype] || 'bin'
}

// ── UPLOADERS ──────────────────────────────────────────────────────────────

async function uploadToCatbox(buffer, filename) {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('fileToUpload', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 60000 })
    if (!res.ok) throw new Error('Catbox gagal')
    const url = await res.text()
    if (!url.startsWith('http')) throw new Error('Invalid response')
    return { host: 'Catbox', url, expires: 'Permanent' }
}

async function uploadToLitterbox(buffer, filename) {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('time', '72h')
    form.append('fileToUpload', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 60000 })
    if (!res.ok) throw new Error('Litterbox gagal')
    const url = await res.text()
    if (!url.startsWith('http')) throw new Error('Invalid response')
    return { host: 'Litterbox', url, expires: '72 jam' }
}

async function uploadToPone(buffer, filename) {
    const form = new FormData()
    form.append('files[]', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://pone.rs/upload.php', {
        method: 'POST', body: form,
        headers: { ...form.getHeaders(), 'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36', 'accept': '*/*', 'origin': 'https://pone.rs', 'referer': 'https://pone.rs/' },
        timeout: 60000
    })
    if (!res.ok) throw new Error('Pone gagal')
    const data = await res.json()
    const url = data?.files?.[0]?.url?.replaceAll('\\/', '/') || null
    if (!data?.success || !url) throw new Error('Invalid response')
    return { host: 'Pone', url, expires: 'Permanent' }
}

async function uploadToKappa(buffer, filename) {
    const form = new FormData()
    form.append('file', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://kappa.lol/api/upload', {
        method: 'POST', body: form,
        headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36', 'Accept': '*/*', 'Origin': 'https://kappa.lol', 'Referer': 'https://kappa.lol/' },
        timeout: 60000
    })
    if (!res.ok) throw new Error('Kappa gagal')
    const data = JSON.parse(await res.text())
    if (!data?.link) throw new Error('Invalid response')
    return { host: 'Kappa', url: data.link, expires: 'Permanent' }
}

async function uploadToUguu(buffer, filename) {
    const form = new FormData()
    form.append('files[]', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://uguu.se/upload.php', {
        method: 'POST', body: form,
        headers: { ...form.getHeaders(), 'accept': '*/*', 'origin': 'https://uguu.se', 'referer': 'https://uguu.se/', 'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36' },
        timeout: 120000
    })
    if (!res.ok) throw new Error('Uguu gagal')
    const data = await res.json()
    const url = data?.files?.[0]?.url || null
    if (!data?.success || !url) throw new Error('Invalid response')
    return { host: 'Uguu', url, expires: '48 jam' }
}

async function uploadToQuax(buffer, filename) {
    const form = new FormData()
    form.append('files[]', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://qu.ax/upload.php', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 60000 })
    if (!res.ok) throw new Error('Qu.ax gagal')
    const data = await res.json()
    if (!data?.success || !data?.files?.[0]?.url) throw new Error('Invalid response')
    return { host: 'Qu.ax', url: data.files[0].url, expires: 'Permanent' }
}

async function uploadToTmpFiles(buffer, filename) {
    const form = new FormData()
    form.append('file', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    form.append('expire', '21600')
    const res = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST', body: form,
        headers: { ...form.getHeaders(), 'accept': 'application/json', 'user-agent': 'Mozilla/5.0' },
        timeout: 120000
    })
    if (!res.ok) throw new Error('TmpFiles gagal')
    const data = await res.json()
    if (data?.status !== 'success' || !data?.data?.url) throw new Error('Invalid response')
    const idMatch = data.data.url.match(/\/(\d+)(?:\/|$)/)
    const url = idMatch
        ? `https://tmpfiles.org/dl/${idMatch[1]}/${filename}`
        : data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
    return { host: 'TmpFiles', url, expires: '6 jam' }
}

async function uploadToNekohime(buffer, filename) {
    const form = new FormData()
    form.append('file', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://cdn.nekohime.site/upload', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 120000 })
    if (!res.ok) throw new Error('Nekohime gagal')
    const data = await res.json()
    const url = data?.files?.[0]?.url || data?.files?.url || (Array.isArray(data?.files) ? data?.files[0] : data?.files)
    if (!url) throw new Error('Nekohime gagal')
    return { host: 'Nekohime', url, expires: 'Permanent' }
}

async function uploadToFaddlaninco(buffer, filename) {
    const form = new FormData()
    form.append('file', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://cdn.faddlaninco.dev/api/upload', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 120000 })
    if (!res.ok) throw new Error('Faddlaninco gagal')
    const data = await res.json()
    if (!data.success || !data.url) throw new Error(data.error || 'Faddlaninco gagal')
    return { host: 'Faddlaninco', url: data.url, expires: 'Permanent' }
}

// ── GitHub ──────────────────────────────────────────────────────────────
const githubConfig = {
    token: config.github?.token,
    owner: config.github?.owner,
    repo: config.github?.repo,
    branch: config.github?.branch || 'main',
    folder: config.github?.folder || 'uploads'
}

async function uploadToGithub(buffer, filename) {
    const { token, owner, repo, branch, folder } = githubConfig
    if (!token || !owner || !repo) throw new Error('GitHub belum dikonfigurasi (token/owner/repo kosong)')

    const ext = path.extname(filename) || `.${await detectExt(buffer, 'bin')}`
    const safeName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`
    const filePath = `${folder}/${safeName}`

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': 'hsnai-tourl'
        },
        body: JSON.stringify({
            message: `upload: ${safeName}`,
            content: buffer.toString('base64'),
            branch
        }),
        timeout: 60000
    })

    if (!res.ok) {
        const err = await res.text().catch(() => '')
        throw new Error(`GitHub gagal (${res.status}): ${err.slice(0, 200)}`)
    }

    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
    return { host: 'GitHub', url, expires: 'Permanent' }
}

const termaiKey = 'AIzaBj7z2z3xBjsk'
const termaiDomain = 'https://c.termai.cc'

async function uploadToTermai(buffer) {
    const ext = await detectExt(buffer, 'bin')
    const form = new FormData()
    form.append('file', buffer, { filename: `file.${ext}` })
    const res = await fetch(`${termaiDomain}/api/upload?key=${termaiKey}`, { method: 'POST', body: form, headers: form.getHeaders(), timeout: 120000 })
    if (!res.ok) throw new Error('Termai gagal')
    const data = await res.json()
    if (!data?.status || !data?.path) throw new Error('Invalid response')
    return { host: 'Termai', url: data.path, expires: 'Unknown' }
}

async function uploadToTop4top(buffer, filename) {
    const initRes = await fetch('https://top4top.io/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36' },
        timeout: 30000
    })
    const initHtml = await initRes.text()
    const sidMatch = initHtml.match(/name=["']sid["'][^>]*value=["']([^"']+)["']/i)
    const sid = sidMatch?.[1] || ''

    const form = new FormData()
    if (sid) form.append('sid', sid)
    form.append('file_0_', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    for (let i = 1; i <= 9; i++) form.append(`file_${i}_`, '')
    form.append('submitr', '[ رفع الملفات ]')

    const res = await fetch('https://top4top.io/index.php', {
        method: 'POST', body: form,
        headers: { ...form.getHeaders(), 'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'origin': 'https://top4top.io', 'referer': 'https://top4top.io/', 'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36' },
        timeout: 120000
    })
    const html = await res.text()
    const inputMatch = html.match(/value=["'](https:\/\/[^'"]*\/p_[^'"]*)['"]/)
    const urlMatch = html.match(/https:\/\/[^'"<>\s]*\/p_[^'"<>\s]*/)
    const url = inputMatch?.[1] || urlMatch?.[0] || null
    if (!url) throw new Error('Top4top gagal')
    return { host: 'Top4top', url, expires: 'Permanent' }
}

async function uploadToLeopard(buffer, filename) {
    const uploadPage = 'https://leopard.hosting.pecon.us/upload.php'
    await fetch(uploadPage, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36' },
        timeout: 30000
    })
    const form = new FormData()
    form.append('uploadContent', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    form.append('password', '')
    form.append('showname', 'yes')
    const res = await fetch(uploadPage, {
        method: 'POST', body: form,
        headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36', 'Origin': 'https://leopard.hosting.pecon.us', 'Referer': uploadPage },
        timeout: 120000
    })
    const html = await res.text()
    const match = html.match(/Download link:\s*<a href=([^>\s]+)>/i)
    const url = match?.[1] || null
    if (!url) throw new Error('Leopard gagal')
    return { host: 'Leopard', url, expires: 'Permanent' }
}

async function uploadToUploadEe(buffer, filename) {
    const ext = (filename.match(/\.([^.]+)$/) || [])[1] || 'bin'
    const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'avif']
    const isImage = imageExts.includes(ext.toLowerCase())
    const category = isImage ? 'cat_picture' : 'cat_file'

    const rnd = Date.now()
    const idRes = await fetch(`https://www.upload.ee/ubr_link_upload.php?rnd_id=${rnd}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36', 'Referer': 'https://www.upload.ee/?' },
        timeout: 30000
    })
    const idBody = await idRes.text()
    const idMatch = idBody.match(/startUpload\("([^"]+)"/)
    if (!idMatch) throw new Error('Upload ID tidak ditemukan')
    const uploadId = idMatch[1]

    const form = new FormData()
    form.append('upfile_0', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    form.append('link', '')
    form.append('email', '')
    form.append('category', category)
    form.append('big_resize', 'none')
    form.append('small_resize', '120x90')

    const uploadUrl = `https://www.upload.ee/cgi-bin/ubr_upload.pl?X-Progress-ID=${uploadId}&upload_id=${uploadId}`
    await fetch(uploadUrl, {
        method: 'POST', body: form,
        headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36', 'Origin': 'https://www.upload.ee', 'Referer': 'https://www.upload.ee/?' },
        timeout: 120000
    })

    const finishedRes = await fetch(`https://www.upload.ee/?page=finished&upload_id=${uploadId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36', 'Referer': uploadUrl },
        timeout: 30000
    })
    const html = await finishedRes.text()
    const srcMatch = html.match(/id=["']file_src["'][^>]*value=["']([^"']+)["']/i)
    const viewMatch = html.match(/View file:\s*<br\s*\/?>\s*<a href=["']?([^"'>\s]+)["']?/i)
    const rawUrl = srcMatch?.[1] || viewMatch?.[1] || null
    if (!rawUrl) throw new Error('Upload.ee gagal')

    let resultUrl = rawUrl.replaceAll('&amp;', '&').replaceAll('&quot;', '"')
    if (isImage) resultUrl = resultUrl.replace('/files/', '/image/').replace(/\.html$/, '')
    return { host: 'Upload.ee', url: resultUrl, expires: 'Permanent' }
}

async function uploadTo8upload(buffer, filename) {
    await fetch('https://8upload.com/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36' },
        timeout: 30000
    })
    const form = new FormData()
    form.append('images[]', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://8upload.com/upload/mt/', {
        method: 'POST', body: form,
        headers: { ...form.getHeaders(), 'accept': 'application/json, text/javascript, */*; q=0.01', 'origin': 'https://8upload.com', 'referer': 'https://8upload.com/', 'x-requested-with': 'XMLHttpRequest', 'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36' },
        timeout: 120000
    })
    let html = await res.text()
    const uploadPath = (typeof html === 'string' && html.trim().startsWith('/uploads/'))
        ? html.trim()
        : (html.match(/\/uploads\/[a-zA-Z0-9]+/) || [])[0] || null
    if (uploadPath) {
        const previewRes = await fetch(`https://8upload.com${uploadPath}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36', 'Referer': 'https://8upload.com/' },
            timeout: 30000
        })
        html = await previewRes.text()
    }
    const urlMatch = (html || '').match(/https:\/\/i\.8upload\.com\/image\/[^'"<>\s]+/)
    const url = urlMatch?.[0] || null
    if (!url) throw new Error('8upload gagal')
    return { host: '8upload', url, expires: 'Permanent' }
}

// ── ImgDrop (dengan AES challenge solver) ─────────────────────────────────

function _solveJsChallenge(html) {
    const match = html.match(/var a=toNumbers\("([^"]+)"\),b=toNumbers\("([^"]+)"\),c=toNumbers\("([^"]+)"\)/)
    if (!match) return ''
    const key = Buffer.from(match[1], 'hex')
    const iv = Buffer.from(match[2], 'hex')
    const encrypted = Buffer.from(match[3], 'hex')
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv)
    decipher.setAutoPadding(false)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return `__test=${decrypted.toString('hex').toLowerCase()}`
}

function _parseSetCookie(headers) {
    const cookies = []
    if (typeof headers.getSetCookie === 'function') {
        for (const cookie of headers.getSetCookie()) cookies.push(cookie.split(';')[0])
    } else {
        const raw = headers.get('set-cookie')
        if (raw) cookies.push(raw.split(';')[0])
    }
    return cookies.join('; ')
}

function _mergeCookies(...cookieStrings) {
    const map = new Map()
    for (const cs of cookieStrings) {
        if (!cs) continue
        for (const item of cs.split('; ')) {
            const [name] = item.split('=')
            if (name) map.set(name, item)
        }
    }
    return [...map.values()].join('; ')
}

async function _imgdropGetSession() {
    const REFERER = 'https://imgdrop.web.id/?i=1'
    const res = await fetch(REFERER, {
        method: 'GET', redirect: 'manual',
        headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36', 'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
    })
    const headerCookie = _parseSetCookie(res.headers)
    const text = await res.text()
    const challengeCookie = _solveJsChallenge(text)
    return _mergeCookies(headerCookie, challengeCookie)
}

async function _imgdropRequest(fileBuffer, filename, cookie) {
    const BASE_URL = 'https://imgdrop.web.id'
    const UPLOAD_URL = `${BASE_URL}/upload.php`
    const REFERER = `${BASE_URL}/?i=1`
    const mimeType = mime.lookup(filename) || 'application/octet-stream'
    const rand = crypto.randomBytes(12).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)
    const boundary = `----WebKitFormBoundary${rand}`
    const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`, 'utf8')
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
    const body = Buffer.concat([head, fileBuffer, tail])

    const headers = {
        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36',
        'accept': '*/*', 'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': String(body.length), 'origin': BASE_URL, 'referer': REFERER
    }
    if (cookie) headers.cookie = cookie

    const res = await fetch(UPLOAD_URL, { method: 'POST', redirect: 'manual', headers, body })
    const responseText = await res.text()
    return { res, responseText, cookie }
}

async function uploadToImgDrop(buffer, filename) {
    let cookie = await _imgdropGetSession()
    let result = await _imgdropRequest(buffer, filename, cookie)
    if (result.responseText.includes('slowAES.decrypt') || result.responseText.includes('__test=')) {
        const challengeCookie = _solveJsChallenge(result.responseText)
        if (challengeCookie) {
            cookie = _mergeCookies(cookie, challengeCookie)
            result = await _imgdropRequest(buffer, filename, cookie)
        }
    }
    let json = null
    try { json = JSON.parse(result.responseText) } catch { json = null }
    const ok = result.res.ok && Boolean(json?.success)
    if (!ok || !json?.url) throw new Error('ImgDrop gagal')
    return { host: 'ImgDrop', url: json.url, expires: 'Unknown' }
}

// ── UPLOADERS LIST ─────────────────────────────────────────────────────────

const UPLOADERS = [
    { name: 'ImgDrop',     fn: uploadToImgDrop },
    { name: 'Catbox',      fn: uploadToCatbox },
    { name: 'Litterbox',   fn: uploadToLitterbox },
    { name: 'Pone',        fn: uploadToPone },
    { name: 'Kappa',       fn: uploadToKappa },
    { name: 'Uguu',        fn: uploadToUguu },
    { name: 'TmpFiles',    fn: uploadToTmpFiles },
    { name: 'Upload.ee',   fn: uploadToUploadEe },
    { name: '8upload',     fn: uploadTo8upload },
    { name: 'Top4top',     fn: uploadToTop4top },
    { name: 'Leopard',     fn: uploadToLeopard },
    { name: 'Qu.ax',       fn: uploadToQuax },
    { name: 'Termai',      fn: uploadToTermai },
    { name: 'Nekohime',    fn: uploadToNekohime },
    { name: 'Faddlaninco', fn: uploadToFaddlaninco },
    { name: 'GitHub',      fn: uploadToGithub },
]

// ── HANDLER ────────────────────────────────────────────────────────────────

async function handler(m, { sock }) {
    let media = null
    let mimetype = null
    let filename = 'file'

    if (m.quoted?.message) {
        const type = getContentType(m.quoted.message)
        if (!type || type === 'conversation' || type === 'extendedTextMessage') {
            return m.reply('⚠️ *Eh eh~* Reply media (gambar/video/audio/file)~ 🌸')
        }
        try {
            media = await downloadMediaMessage({ key: m.quoted.key, message: m.quoted.message }, 'buffer', {})
            const content = m.quoted.message[type]
            mimetype = content?.mimetype || 'application/octet-stream'
            filename = content?.fileName || `file.${getFileExtension(mimetype)}`
        } catch (e) {
            return m.reply(`❌ *Gomen ne~* Gagal download: ${e.message} 🥺`)
        }
    } else if (m.message) {
        const type = getContentType(m.message)
        if (!type || type === 'conversation' || type === 'extendedTextMessage') {
            return m.reply(
                `📤 *MEDIA UPLOADER* 📤\n\n` +
                `*Cara Pakai:*\n` +
                `👉 Kirim media dengan caption \`${m.prefix}tourl\`\n` +
                `👉 Atau reply media yang udah ada dengan \`${m.prefix}tourl\``
            )
        }
        try {
            media = await downloadMediaMessage({ key: m.key, message: m.message }, 'buffer', {})
            const content = m.message[type]
            mimetype = content?.mimetype || 'application/octet-stream'
            filename = content?.fileName || `file.${getFileExtension(mimetype)}`
        } catch (e) {
            return m.reply(`❌ *Gomen ne~* Gagal download: ${e.message} 🥺`)
        }
    }

    if (!media || media.length === 0) return m.reply('⚠️ *Eh eh~* Media tidak ditemukan~ 🌸')

    m.react('🕕')

    const results = []
    const failed = []

    for (const uploader of UPLOADERS) {
        try {
            const result = await uploader.fn(media, filename)
            results.push(result)
            console.log('[tourl] OK ' + uploader.name + ': ' + result.url)
        } catch (e) {
            failed.push(uploader.name)
            console.log('[tourl] GAGAL ' + uploader.name + ': ' + e.message)
        }
    }

    if (results.length === 0) {
        m.react('❌')
        return m.reply(`❌ Semua upload gagal!\n\n> Gagal: ${failed.join(', ')}`)
    }

    const linkOptions = results.map((r) => ({
        url: r.url,
        title: `${r.host} — ${r.expires === 'Permanent' ? '∞ Permanen' : r.expires}`
    }))

    let text = `🚀 *UPLOAD BERHASIL!* 🚀\n\n`
    text += `Yeay! Media kamu udah berhasil di-upload ke server awan~ ✨`
    if (failed.length > 0) text += `\n⚠️ _Gagal: ${failed.join(', ')}_`

    await m.reply(text, { link: linkOptions })
    m.react('✅')
}

module.exports = {
    config: pluginConfig,
    handler
}