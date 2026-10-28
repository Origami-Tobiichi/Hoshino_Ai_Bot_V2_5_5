const axios = require('axios')
const FormData = require('form-data')
const crypto = require('crypto')
const path = require('path')
const config = require('../../config')

async function uploadToTelegraph(buffer, filename = 'image.jpg') {
    const form = new FormData()
    form.append('file', buffer, { filename })
    
    const response = await axios.post('https://telegra.ph/upload', form, {
        headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0' },
        timeout: 30000
    })
    
    if (response.data?.[0]?.src) {
        return 'https://telegra.ph' + response.data[0].src
    }
    
    throw new Error('Telegraph upload failed')
}

async function uploadTo0x0(buffer, filename = 'image.jpg') {
    const form = new FormData()
    form.append('file', buffer, { filename })
    
    const response = await axios.post('https://0x0.st', form, {
        headers: { ...form.getHeaders(), 'User-Agent': 'hsnai-bot/1.0' },
        timeout: 30000
    })
    
    if (response.data && typeof response.data === 'string' && response.data.startsWith('http')) {
        return response.data.trim()
    }
    
    throw new Error('0x0.st upload failed')
}

async function uploadToTmpfiles(buffer, filename = 'image.jpg') {
    const form = new FormData()
    form.append('file', buffer, { filename })
    
    const response = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
        headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0' },
        timeout: 30000
    })
    
    if (response.data?.status === 'success' && response.data?.data?.url) {
        return response.data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
    }
    
    throw new Error('Tmpfiles upload failed')
}

async function uploadToCatbox(buffer, filename = 'image.jpg') {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('fileToUpload', buffer, { filename })
    
    const response = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0' },
        timeout: 60000
    })
    
    if (response.data && typeof response.data === 'string' && response.data.startsWith('http')) {
        return response.data
    }
    
    throw new Error('Catbox upload failed')
}

async function uploadImage(buffer, filename = 'image.jpg') {
    const uploaders = [
        { name: 'Tmpfiles', fn: uploadToTmpfiles },
        { name: 'Telegraph', fn: uploadToTelegraph },
        { name: '0x0.st', fn: uploadTo0x0 },
        { name: 'Catbox', fn: uploadToCatbox }
    ]
    
    for (const uploader of uploaders) {
        try {
            const url = await uploader.fn(buffer, filename)
            console.log(`Upload success via ${uploader.name}: ${url}`)
            return url
        } catch (err) {
            console.log(`${uploader.name} failed: ${err.message}`)
        }
    }
    
    throw new Error('All uploaders failed')
}

async function uploadToGithub(buffer, filename = 'image.jpg') {
    const gh = config.github || {}
    const { token, owner, repo } = gh
    const branch = gh.branch || 'main'
    const folder = gh.folder || 'uploads'
    if (!token || !owner || !repo) throw new Error('GitHub belum dikonfigurasi')

    const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(filename) || '.jpg'}`
    const filePath = `${folder}/${name}`

    await axios.put(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        { message: `srt: ${name}`, content: buffer.toString('base64'), branch },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'User-Agent': 'hsnai-srt'
            },
            timeout: 60000
        }
    )
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
}

async function uploadVerified(buffer, filename = 'image.jpg') {
    const hosts = [
    { name: 'GitHub', fn: uploadToGithub },
    { name: 'Catbox', fn: uploadToCatbox },
    { name: '0x0.st', fn: uploadTo0x0 }
]
    for (const h of hosts) {
        try {
            const url = await h.fn(buffer, filename)
            const check = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: { 'User-Agent': 'hsnai-bot/1.0' }
            })
            if (check.data.length > 0) {
                console.log(`Upload verified via ${h.name}: ${url} (${check.data.length} bytes)`)
                return url
            }
            console.log(`${h.name} balas file kosong, coba host berikutnya`)
        } catch (err) {
            console.log(`${h.name} failed: ${err.message}`)
        }
    }
    throw new Error('Semua host upload gagal / kosong')
}

module.exports = { uploadImage, uploadVerified, uploadToTelegraph, uploadTo0x0, uploadToTmpfiles, uploadToCatbox, uploadToGithub }