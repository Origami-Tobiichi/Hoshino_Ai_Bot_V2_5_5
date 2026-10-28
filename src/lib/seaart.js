const axios = require('axios')
const FormData = require('form-data')
const fetch = require('node-fetch')
const mime = require('mime-types')

// ── Uploaders ──────────────────────────────────────────────────────────────

async function uploadToCatbox(buffer, filename) {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('fileToUpload', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000 })
    if (!res.ok) throw new Error('Catbox gagal')
    const url = await res.text()
    if (!url.startsWith('http')) throw new Error('Invalid response')
    return url
}

async function uploadToLitterbox(buffer, filename) {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('time', '72h')
    form.append('fileToUpload', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000 })
    if (!res.ok) throw new Error('Litterbox gagal')
    const url = await res.text()
    if (!url.startsWith('http')) throw new Error('Invalid response')
    return url
}

async function uploadToPone(buffer, filename) {
    const form = new FormData()
    form.append('files[]', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://pone.rs/upload.php', {
        method: 'POST', body: form,
        headers: { ...form.getHeaders(), 'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36', 'accept': '*/*', 'origin': 'https://pone.rs', 'referer': 'https://pone.rs/' },
        timeout: 60000
    })
    if (!res.ok) throw new Error('Pone gagal')
    const data = await res.json()
    const url = data?.files?.[0]?.url?.replaceAll('\\/', '/') || null
    if (!data?.success || !url) throw new Error('Invalid response')
    return url
}

async function uploadToKappa(buffer, filename) {
    const form = new FormData()
    form.append('file', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://kappa.lol/api/upload', {
        method: 'POST', body: form,
        headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36', 'Accept': '*/*', 'Origin': 'https://kappa.lol', 'Referer': 'https://kappa.lol/' },
        timeout: 60000
    })
    if (!res.ok) throw new Error('Kappa gagal')
    const data = JSON.parse(await res.text())
    if (!data?.link) throw new Error('Invalid response')
    return data.link
}

async function uploadToUguu(buffer, filename) {
    const form = new FormData()
    form.append('files[]', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://uguu.se/upload.php', {
        method: 'POST', body: form,
        headers: { ...form.getHeaders(), 'accept': '*/*', 'origin': 'https://uguu.se', 'referer': 'https://uguu.se/', 'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' },
        timeout: 120000
    })
    if (!res.ok) throw new Error('Uguu gagal')
    const data = await res.json()
    const url = data?.files?.[0]?.url || null
    if (!data?.success || !url) throw new Error('Invalid response')
    return url
}

async function uploadToQuax(buffer, filename) {
    const form = new FormData()
    form.append('files[]', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://qu.ax/upload.php', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 60000 })
    if (!res.ok) throw new Error('Qu.ax gagal')
    const data = await res.json()
    if (!data?.success || !data?.files?.[0]?.url) throw new Error('Invalid response')
    return data.files[0].url
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
    return data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
}

async function uploadToNekohime(buffer, filename) {
    const form = new FormData()
    form.append('file', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://cdn.nekohime.site/upload', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 120000 })
    if (!res.ok) throw new Error('Nekohime gagal')
    const data = await res.json()
    const url = data?.files?.[0]?.url || data?.files?.url || (Array.isArray(data?.files) ? data?.files[0] : data?.files)
    if (!url) throw new Error('Nekohime gagal')
    return url
}

async function uploadToFaddlaninco(buffer, filename) {
    const form = new FormData()
    form.append('file', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://cdn.faddlaninco.dev/api/upload', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 120000 })
    if (!res.ok) throw new Error('Faddlaninco gagal')
    const data = await res.json()
    if (!data.success || !data.url) throw new Error(data.error || 'Faddlaninco gagal')
    return data.url
}

async function uploadToYpnk(buffer, filename) {
    const form = new FormData()
    form.append('files', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://cdn.ypnk.biz.id/upload', {
        method: 'POST', body: form,
        headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' },
        timeout: 120000
    })
    if (!res.ok) throw new Error('YPNK gagal')
    const data = await res.json()
    if (!data?.success || !data?.files?.[0]?.url) throw new Error('Invalid response')
    return `https://cdn.ypnk.biz.id${data.files[0].url}`
}

async function uploadToPutIcu(buffer, filename) {
    const res = await fetch('https://put.icu/upload/', {
        method: 'PUT', body: buffer,
        headers: { 'Accept': 'application/json', 'Content-Type': mime.lookup(filename) || 'application/octet-stream' },
        timeout: 120000
    })
    if (!res.ok) throw new Error('Put.icu gagal')
    const data = await res.json()
    const url = data?.direct_url || data?.url || null
    if (!url) throw new Error('Invalid response')
    return url
}

const termaiKey = 'AIzaBj7z2z3xBjsk'
const termaiDomain = 'https://c.termai.cc'

async function uploadToTermai(buffer) {
    const form = new FormData()
    form.append('file', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' })
    const res = await fetch(`${termaiDomain}/api/upload?key=${termaiKey}`, { method: 'POST', body: form, headers: form.getHeaders(), timeout: 120000 })
    if (!res.ok) throw new Error('Termai gagal')
    const data = await res.json()
    if (!data?.status || !data?.path) throw new Error('Invalid response')
    return data.path
}

// Chain uploader — return URL pertama yang berhasil
async function uploadImage(buffer, filename = 'image.jpg') {
    const uploaders = [
        { name: 'Catbox',       fn: () => uploadToCatbox(buffer, filename) },
        { name: 'Litterbox',    fn: () => uploadToLitterbox(buffer, filename) },
        { name: 'Pone',         fn: () => uploadToPone(buffer, filename) },
        { name: 'Kappa',        fn: () => uploadToKappa(buffer, filename) },
        { name: 'Uguu',         fn: () => uploadToUguu(buffer, filename) },
        { name: 'Nekohime',     fn: () => uploadToNekohime(buffer, filename) },
        { name: 'Faddlaninco',  fn: () => uploadToFaddlaninco(buffer, filename) },
        { name: 'Qu.ax',        fn: () => uploadToQuax(buffer, filename) },
        { name: 'TmpFiles',     fn: () => uploadToTmpFiles(buffer, filename) },
        { name: 'YPNK',         fn: () => uploadToYpnk(buffer, filename) },
        { name: 'Put.icu',      fn: () => uploadToPutIcu(buffer, filename) },
        { name: 'Termai',       fn: () => uploadToTermai(buffer) },
    ]

    for (const u of uploaders) {
        try {
            const url = await u.fn()
            console.log(`[seaart] Upload OK via ${u.name}: ${url}`)
            return url
        } catch (e) {
            console.log(`[seaart] Upload gagal via ${u.name}:`, e.message)
        }
    }

    throw new Error('Semua uploader gagal')
}

// ── live3d ─────────────────────────────────────────────────────────────────

async function live3d(img, prompt) {
    console.log('[live3d] Start — prompt:', prompt)

    const imageUrl = await uploadImage(img)
    console.log('[live3d] Image URL:', imageUrl)

    const apiRes = await axios.get(
        `https://api-faa.my.id/faa/nano-banana?url=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(prompt)}`,
        { responseType: 'arraybuffer', timeout: 120000 }
    )

    const contentType = apiRes.headers['content-type'] || ''
    if (!contentType.includes('image')) {
        const errText = Buffer.from(apiRes.data).toString('utf-8')
        console.log('[live3d] API bukan gambar:', errText)
        throw new Error(`API tidak mengembalikan gambar: ${errText.slice(0, 200)}`)
    }

    const image = Buffer.from(apiRes.data)
    if (image.length < 100) throw new Error('Hasil edit kosong atau rusak')

    console.log('[live3d] Done — size:', image.length)
    return { image }
}

module.exports = { live3d, uploadImage }