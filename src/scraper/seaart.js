const axios = require('axios')
const FormData = require('form-data')
const fetch = require('node-fetch')

// ── Uploaders ──────────────────────────────────────────────────────────────

const termaiKey = 'AIzaBj7z2z3xBjsk'
const termaiDomain = 'https://c.termai.cc'

async function uploadToTermai(buffer) {
    const form = new FormData()
    form.append('file', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' })
    const res = await fetch(`${termaiDomain}/api/upload?key=${termaiKey}`, {
        method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000
    })
    if (!res.ok) throw new Error('Termai gagal')
    const data = await res.json()
    if (!data?.status || !data?.path) throw new Error('Termai invalid response')
    return data.path
}

async function uploadToYpnk(buffer) {
    const form = new FormData()
    form.append('files', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' })
    const res = await fetch('https://cdn.ypnk.biz.id/upload', {
        method: 'POST',
        body: form,
        headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0' },
        timeout: 30000
    })
    if (!res.ok) throw new Error('YPNK gagal')
    const data = await res.json()
    if (!data?.success || !data?.files?.[0]?.url) throw new Error('YPNK invalid response')
    return `https://cdn.ypnk.biz.id${data.files[0].url}`
}

async function uploadToQuax(buffer) {
    const form = new FormData()
    form.append('files[]', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' })
    const res = await fetch('https://qu.ax/upload.php', {
        method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000
    })
    if (!res.ok) throw new Error('Qu.ax gagal')
    const data = await res.json()
    if (!data?.success || !data?.files?.[0]?.url) throw new Error('Qu.ax invalid response')
    return data.files[0].url
}

async function uploadToTmpFiles(buffer) {
    const form = new FormData()
    form.append('file', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' })
    const res = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000
    })
    if (!res.ok) throw new Error('TmpFiles gagal')
    const data = await res.json()
    if (!data?.data?.url) throw new Error('TmpFiles invalid response')
    return data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
}

async function uploadImage(buffer) {
    const uploaders = [
        { name: 'Termai',   fn: () => uploadToTermai(buffer) },
        { name: 'YPNK',     fn: () => uploadToYpnk(buffer) },
        { name: 'Qu.ax',    fn: () => uploadToQuax(buffer) },
        { name: 'TmpFiles', fn: () => uploadToTmpFiles(buffer) },
    ]

    for (const u of uploaders) {
        try {
            const url = await u.fn()
            console.log(`[live3d] Upload OK via ${u.name}: ${url}`)
            return url
        } catch (e) {
            console.log(`[live3d] Upload gagal via ${u.name}:`, e.message)
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

module.exports = { live3d }