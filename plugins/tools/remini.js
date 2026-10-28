const config = require('../../config')
const axios = require('axios')
const FormData = require('form-data')
const fetch = require('node-fetch')
const mime = require('mime-types')
const crypto = require('crypto')
const { fileTypeFromBuffer } = require('file-type')
const { CookieJar } = require('tough-cookie')
const { wrapper } = require('axios-cookiejar-support')

const pluginConfig = {
    name: 'remini',
    alias: ['hd', 'enhance', 'upscale'],
    category: 'tools',
    description: 'Enhance/upscale gambar menjadi HD',
    usage: '.remini (reply gambar)',
    example: '.remini',
    cooldown: 15,
    energi: 1,
    isEnabled: true
}

async function detectMimetype(buffer) {
    try {
        const type = await fileTypeFromBuffer(buffer)
        if (type?.mime) return type.mime
    } catch {}
    return 'image/jpeg'
}

// ══════════════════════════════════════════════════════════════════════════
// ── GITHUB UPLOADER (dengan auto cleanup/hapus otomatis) ─────────────────
// ══════════════════════════════════════════════════════════════════════════

async function uploadToGitHub(buffer, filename) {
    const { token, owner, repo, branch, folder } = config.github
    if (!token || !owner || !repo) throw new Error('Konfigurasi GitHub belum lengkap')

    const cleanFolder = folder ? folder.replace(/^\/+|\/+$/g, '') + '/' : ''
    const uniqueFilename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${filename}`
    const path = `${cleanFolder}${uniqueFilename}`
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`

    const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'WhatsApp-Bot'
        },
        body: JSON.stringify({
            message: `Upload temp ${uniqueFilename}`,
            content: buffer.toString('base64'),
            branch: branch || 'main'
        }),
        timeout: 30000
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'GitHub upload gagal')

    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch || 'main'}/${path}`
    return {
        host: 'GitHub',
        url: rawUrl,
        sha: data.content?.sha,
        path: path
    }
}

async function deleteFromGitHub(path, sha) {
    const { token, owner, repo, branch } = config.github
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`

    try {
        await fetch(apiUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'WhatsApp-Bot'
            },
            body: JSON.stringify({
                message: `Auto delete temp ${path}`,
                sha: sha,
                branch: branch || 'main'
            }),
            timeout: 15000
        })
        console.log(`[Remini] File GitHub berhasil dihapus: ${path}`)
    } catch (e) {
        console.log(`[Remini] Gagal menghapus file GitHub: ${e.message}`)
    }
}

async function uploadToGitHubWithCleanup(buffer, filename) {
    const ghData = await uploadToGitHub(buffer, filename)
    return {
        host: 'GitHub',
        url: ghData.url,
        cleanup: async () => {
            if (ghData.path && ghData.sha) {
                await deleteFromGitHub(ghData.path, ghData.sha)
            }
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════
// ── ENHANCER #1: WINK.AI (Meitu) — kualitas terbaik, upload langsung ke Qiniu
// ══════════════════════════════════════════════════════════════════════════

const WINK_BASE_URL = 'https://wink.ai'
const WINK_STRATEGY_URL = 'https://strategy.app.meitudata.com'
const WINK_CLIENT_ID = '1189857605'
const WINK_VERSION = '5.1.2'
const WINK_COUNTRY_CODE = 'ID'
const WINK_CLIENT_LANGUAGE = 'en_US'
const WINK_CLIENT_TIMEZONE = 'Asia/Jakarta'
const WINK_TASK_TYPE = '12'
const WINK_CONTENT_TYPE = '1'
const WINK_EXT_VALUE = '2'
const WINK_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36'

function winkSleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function winkExtFromMime(mimetype) {
    if (mimetype === 'image/png') return '.png'
    if (mimetype === 'image/webp') return '.webp'
    return '.jpg'
}

function winkMakeTrace() {
    return `${crypto.randomBytes(16).toString('hex')}-${crypto.randomBytes(8).toString('hex')}-1`
}

function winkTraceHeaders(transaction = 'GET%20%2F%5Blocale%5D%2Fimage-enhancer%2Fupload') {
    const trace = winkMakeTrace()
    return {
        'sentry-trace': trace,
        baggage: [
            'sentry-environment=release',
            'sentry-release=5.1.2%20(b60d25c477f43c6dfac4107810f26d442320f4f1)',
            'sentry-public_key=e1bf914f3448d9bc8a10c7e499d17d54',
            `sentry-trace_id=${trace.split('-')[0]}`,
            `sentry-transaction=${transaction}`,
            'sentry-sampled=true',
            'sentry-sample_rate=0.75'
        ].join(',')
    }
}

function winkBaseParams(gnum, extra = {}) {
    return new URLSearchParams({
        client_id: WINK_CLIENT_ID,
        version: WINK_VERSION,
        country_code: WINK_COUNTRY_CODE,
        gnum,
        client_language: WINK_CLIENT_LANGUAGE,
        client_channel_id: '',
        client_timezone: WINK_CLIENT_TIMEZONE,
        ...extra
    })
}

function winkCreateClient(gnum, jar) {
    return wrapper(axios.create({
        baseURL: WINK_BASE_URL,
        jar,
        withCredentials: true,
        validateStatus: () => true,
        headers: {
            accept: '*/*',
            origin: WINK_BASE_URL,
            referer: `${WINK_BASE_URL}/image-enhancer/upload`,
            'user-agent': WINK_UA,
            'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
            'sec-ch-ua-mobile': '?1',
            'sec-ch-ua-platform': '"Android"',
            ab_info: JSON.stringify({ ab_codes: [], version: '1.4.4' })
        }
    }))
}

async function winkGetMaatSign(api, gnum, suffix) {
    const params = winkBaseParams(gnum, { suffix, type: 'temp', count: '1' })
    const res = await api.get(`/api/file/get_maat_sign.json?${params.toString()}`, { headers: winkTraceHeaders() })
    if (res.status >= 400 || res.data?.code !== 0) throw new Error(`get_maat_sign gagal: ${JSON.stringify(res.data)}`)
    return res.data.data
}

async function winkGetUploadPolicy(sign) {
    const params = new URLSearchParams({
        app: sign.app, count: String(sign.count), sig: sign.sig,
        sigTime: sign.sig_time, sigVersion: sign.sig_version,
        suffix: sign.suffix, type: sign.type
    })
    const res = await axios.get(`${WINK_STRATEGY_URL}/upload/policy?${params.toString()}`, {
        headers: {
            accept: '*/*', origin: WINK_BASE_URL, referer: `${WINK_BASE_URL}/`,
            'user-agent': WINK_UA,
            'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
            'sec-ch-ua-mobile': '?1', 'sec-ch-ua-platform': '"Android"'
        },
        validateStatus: () => true
    })
    if (res.status >= 400 || !Array.isArray(res.data) || !res.data[0]?.qiniu) {
        throw new Error(`upload policy gagal: ${JSON.stringify(res.data)}`)
    }
    return res.data[0].qiniu
}

async function winkUploadToQiniu(policy, buffer, filename, mimetype) {
    const form = new FormData()
    form.append('file', buffer, { filename, contentType: mimetype })
    form.append('token', policy.token)
    form.append('key', policy.key)
    form.append('fname', filename)

    const res = await axios.post(policy.url, form, {
        headers: form.getHeaders({ origin: WINK_BASE_URL, referer: `${WINK_BASE_URL}/`, 'user-agent': WINK_UA, accept: '*/*' }),
        maxBodyLength: Infinity, maxContentLength: Infinity, validateStatus: () => true
    })
    if (res.status >= 400) throw new Error(`upload qiniu gagal HTTP ${res.status}`)
    if (!res.data?.url && !res.data?.data) throw new Error(`upload qiniu response tidak valid: ${JSON.stringify(res.data)}`)

    return { file_key: policy.key, source_url: res.data.url || res.data.data || policy.data }
}

async function winkGetMetaInfo(api, gnum, fileKey) {
    const body = winkBaseParams(gnum, { file_key: fileKey })
    const res = await api.post('/api/file/meta_info.json', body.toString(), {
        headers: { ...winkTraceHeaders(), 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' }
    })
    if (res.status >= 400 || res.data?.code !== 0) throw new Error(`meta info gagal: ${JSON.stringify(res.data)}`)
    return res.data.data
}

async function winkCalcNeedBeans(api, gnum) {
    const typeParams = JSON.stringify({ is_mirror: 0, orientation_tag: 1, j_420_trans: '1', return_ext: '2' })
    const rightDetail = JSON.stringify({ source: '1', touch_type: '4', function_id: '630', material_id: '63011', url: 'https://wink.ai/image-enhancer/upload' })
    const itemList = JSON.stringify([{
        type: Number(WINK_TASK_TYPE), ext_value: WINK_EXT_VALUE, content_type: Number(WINK_CONTENT_TYPE),
        duration: 0, type_params: typeParams, right_detail: rightDetail
    }])
    const body = winkBaseParams(gnum, { item_list: itemList })
    const res = await api.post('/api/subscribe/batch_calc_need_beans.json', body.toString(), {
        headers: { ...winkTraceHeaders(), 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' }
    })
    if (res.status >= 400 || res.data?.code !== 0) throw new Error(`calc beans gagal: ${JSON.stringify(res.data)}`)
    return res.data.data
}

async function winkDelivery(api, gnum, sourceUrl, taskName) {
    const body = winkBaseParams(gnum, {
        type: WINK_TASK_TYPE, content_type: WINK_CONTENT_TYPE, source_url: sourceUrl,
        type_params: JSON.stringify({ is_mirror: 0, orientation_tag: 1, j_420_trans: '1', return_ext: '2' }),
        right_detail: JSON.stringify({ source: '1', touch_type: '4', function_id: '630', material_id: '63011', url: 'https://wink.ai/image-enhancer/upload' }),
        ext_params: JSON.stringify({ task_name: taskName, records: WINK_TASK_TYPE }),
        with_prepare: '1'
    })
    const res = await api.post('/api/meitu_ai/delivery.json', body.toString(), {
        headers: { ...winkTraceHeaders(), 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' }
    })
    if (res.status >= 400 || res.data?.code !== 0) throw new Error(`delivery gagal: ${JSON.stringify(res.data)}`)
    const data = res.data.data || {}
    return { msg_id: data.msg_id || '', prepare_msg_id: data.prepare_msg_id || '', raw: data }
}

async function winkQueryBatch(api, gnum, msgId, referer = `${WINK_BASE_URL}/image-enhancer/upload`) {
    const params = winkBaseParams(gnum, { msg_ids: msgId })
    const res = await api.get(`/api/meitu_ai/query_batch.json?${params.toString()}`, {
        headers: { ...winkTraceHeaders('%2F%3Alocale%2Feditor%2Frecent-task'), referer }
    })
    if (res.status >= 400 || res.data?.code !== 0) throw new Error(`query batch gagal: ${JSON.stringify(res.data)}`)
    return res.data.data
}

function winkExtractResultUrl(data) {
    const item = data?.item_list?.[0]
    const media = item?.result?.media_info_list?.[0]
    return media?.media_data || ''
}

function winkExtractNextMsgId(data, currentMsgId) {
    const item = data?.item_list?.[0]
    const resultValue = item?.result?.result || ''
    const realMsgId = item?.result?.msg_id || item?.msg_id || ''
    if (resultValue && resultValue !== currentMsgId && !resultValue.startsWith('http')) return resultValue
    if (realMsgId && realMsgId !== currentMsgId && !realMsgId.startsWith('wpr_')) return realMsgId
    return ''
}

async function winkWaitResult(api, gnum, firstMsgId, maxTry = 40, delayMs = 3000) {
    let msgId = firstMsgId
    let last = null

    for (let i = 1; i <= maxTry; i++) {
        const data = await winkQueryBatch(api, gnum, msgId)
        last = data

        const nextMsgId = winkExtractNextMsgId(data, msgId)
        if (nextMsgId) {
            msgId = nextMsgId
            await winkSleep(1000)
            continue
        }

        const url = winkExtractResultUrl(data)
        const errorCode = data?.item_list?.[0]?.result?.error_code
        const errorMsg = data?.item_list?.[0]?.result?.error_msg

        if (url && url.startsWith('http') && errorCode === 0) return url
        if (errorCode && errorCode !== 29901 && errorCode !== 0) throw new Error(`task gagal: ${errorCode} ${errorMsg || ''}`)

        await winkSleep(delayMs)
    }

    throw new Error(`result belum selesai setelah ${maxTry}x polling`)
}

async function enhanceWithWink(buffer, mimetype) {
    const gnum = crypto.randomUUID()
    const jar = new CookieJar()

    await jar.setCookie(
        `_sm=${gnum}; Path=/; Domain=wink.ai`,
        WINK_BASE_URL
    )

    await jar.setCookie(
        `meitustat=${encodeURIComponent(JSON.stringify({ wgid: gnum }))}; Path=/; Domain=wink.ai`,
        WINK_BASE_URL
    )

    const api = winkCreateClient(gnum, jar)
    const suffix = winkExtFromMime(mimetype)
    const filename = `image${suffix}`
    const taskName = `Enhancer-Ultra HD-${Date.now()}`

    const sign = await winkGetMaatSign(api, gnum, suffix)
    const policy = await winkGetUploadPolicy(sign)

    const uploaded = await winkUploadToQiniu(
        policy,
        buffer,
        filename,
        mimetype
    )

    await winkGetMetaInfo(api, gnum, uploaded.file_key)
    await winkCalcNeedBeans(api, gnum)

    const task = await winkDelivery(
        api,
        gnum,
        uploaded.source_url,
        taskName
    )

    const firstMsgId = task.msg_id || task.prepare_msg_id

    if (!firstMsgId) {
        throw new Error('delivery tidak mengembalikan msg_id')
    }

    const result = await winkWaitResult(
        api,
        gnum,
        firstMsgId
    )

    return result
}

// ══════════════════════════════════════════════════════════════════════════
// ── UPLOADERS (fallback chain untuk enhancer berbasis URL) ───────────────
// ══════════════════════════════════════════════════════════════════════════

async function uploadToCatbox(buffer, filename) {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('fileToUpload', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 60000 })
    if (!res.ok) throw new Error('Catbox gagal')
    const url = await res.text()
    if (!url.startsWith('http')) throw new Error('Invalid response')
    return { host: 'Catbox', url }
}

async function uploadToLitterbox(buffer, filename) {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('time', '1h')
    form.append('fileToUpload', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 60000 })
    if (!res.ok) throw new Error('Litterbox gagal')
    const url = await res.text()
    if (!url.startsWith('http')) throw new Error('Invalid response')
    return { host: 'Litterbox', url }
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
    return { host: 'Pone', url }
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
    return { host: 'Kappa', url: data.link }
}

async function uploadToUguu(buffer, filename) {
    const form = new FormData()
    form.append('files[]', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://uguu.se/upload.php', {
        method: 'POST', body: form,
        headers: { ...form.getHeaders(), 'accept': '*/*', 'origin': 'https://uguu.se', 'referer': 'https://uguu.se/', 'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36' },
        timeout: 30000
    })
    if (!res.ok) throw new Error('Uguu gagal')
    const data = await res.json()
    const url = data?.files?.[0]?.url || null
    if (!data?.success || !url) throw new Error('Invalid response')
    return { host: 'Uguu', url }
}

async function uploadToQuax(buffer, filename) {
    const form = new FormData()
    form.append('files[]', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://qu.ax/upload.php', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 60000 })
    if (!res.ok) throw new Error('Qu.ax gagal')
    const data = await res.json()
    if (!data?.success || !data?.files?.[0]?.url) throw new Error('Invalid response')
    return { host: 'Qu.ax', url: data.files[0].url }
}

async function uploadToTmpFiles(buffer, filename) {
    const form = new FormData()
    form.append('file', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    form.append('expire', '21600')
    const res = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST', body: form,
        headers: { ...form.getHeaders(), 'accept': 'application/json', 'user-agent': 'Mozilla/5.0' },
        timeout: 30000
    })
    if (!res.ok) throw new Error('TmpFiles gagal')
    const data = await res.json()
    if (data?.status !== 'success' || !data?.data?.url) throw new Error('Invalid response')
    const idMatch = data.data.url.match(/\/(\d+)(?:\/|$)/)
    const url = idMatch
        ? `https://tmpfiles.org/dl/${idMatch[1]}/${filename}`
        : data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
    return { host: 'TmpFiles', url }
}

async function uploadToNekohime(buffer, filename) {
    const form = new FormData()
    form.append('file', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://cdn.nekohime.site/upload', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000 })
    if (!res.ok) throw new Error('Nekohime gagal')
    const data = await res.json()
    const url = data?.files?.[0]?.url || data?.files?.url || (Array.isArray(data?.files) ? data?.files[0] : data?.files)
    if (!url) throw new Error('Nekohime gagal')
    return { host: 'Nekohime', url }
}

async function uploadToFaddlaninco(buffer, filename) {
    const form = new FormData()
    form.append('file', buffer, { filename, contentType: mime.lookup(filename) || 'application/octet-stream' })
    const res = await fetch('https://cdn.faddlaninco.dev/api/upload', { method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000 })
    if (!res.ok) throw new Error('Faddlaninco gagal')
    const data = await res.json()
    if (!data.success || !data.url) throw new Error(data.error || 'Faddlaninco gagal')
    return { host: 'Faddlaninco', url: data.url }
}

const termaiKey = 'AIzaBj7z2z3xBjsk'
const termaiDomain = 'https://c.termai.cc'

async function uploadToTermai(buffer) {
    const type = await fileTypeFromBuffer(buffer).catch(() => null)
    const ext = type?.ext || 'bin'
    const form = new FormData()
    form.append('file', buffer, { filename: `file.${ext}` })
    const res = await fetch(`${termaiDomain}/api/upload?key=${termaiKey}`, { method: 'POST', body: form, headers: form.getHeaders(), timeout: 30000 })
    if (!res.ok) throw new Error('Termai gagal')
    const data = await res.json()
    if (!data?.status || !data?.path) throw new Error('Invalid response')
    return { host: 'Termai', url: data.path }
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
        timeout: 30000
    })
    const html = await res.text()
    const inputMatch = html.match(/value=["'](https:\/\/[^'"]*\/p_[^'"]*)['"]/)
    const urlMatch = html.match(/https:\/\/[^'"<>\s]*\/p_[^'"<>\s]*/)
    const url = inputMatch?.[1] || urlMatch?.[0] || null
    if (!url) throw new Error('Top4top gagal')
    return { host: 'Top4top', url }
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
        timeout: 30000
    })
    const html = await res.text()
    const match = html.match(/Download link:\s*<a href=([^>\s]+)>/i)
    const url = match?.[1] || null
    if (!url) throw new Error('Leopard gagal')
    return { host: 'Leopard', url }
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
        timeout: 30000
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
    return { host: 'Upload.ee', url: resultUrl }
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
        timeout: 30000
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
    return { host: '8upload', url }
}

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
    return { host: 'ImgDrop', url: json.url }
}

const UPLOADERS = [
    { name: 'GitHub',      fn: uploadToGitHubWithCleanup },
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
]

// ══════════════════════════════════════════════════════════════════════════
// ── DAFTAR ENHANCER (fallback chain, urut dari kualitas terbaik) ───────────
// ══════════════════════════════════════════════════════════════════════════

const ENHANCERS = [
    {
        name: 'Nexray',
        needsUpload: true,
        run: async (buffer, mimetype, imageUrl) => {
            const res = await fetch(
                `https://api.nexray.web.id/tools/remini?url=${encodeURIComponent(imageUrl)}`,
                { timeout: 120000 } // 2 menit
            )

            if (!res.ok) throw new Error('Nexray status: ' + res.status)

            const outBuffer = await res.buffer()

            if (!outBuffer || outBuffer.length === 0) {
                throw new Error('Buffer kosong')
            }

            return { type: 'buffer', data: outBuffer }
        }
    },

    {
        name: 'FAA',
        needsUpload: true,
        run: async (buffer, mimetype, imageUrl) => {
            const res = await axios.get(
                `https://api-faa.my.id/faa/superhd?url=${encodeURIComponent(imageUrl)}`,
                { timeout: 120000 } // 2 menit
            )

            const url =
                res.data?.result?.image ||
                res.data?.result?.url ||
                res.data?.url

            if (!url) throw new Error('Invalid response')

            return { type: 'url', data: url }
        }
    },

    {
        name: 'Wink.ai',
        needsUpload: false,
        run: async (buffer, mimetype) => {
            const url = await enhanceWithWink(buffer, mimetype)
            return { type: 'url', data: url }
        }
    }
]

// ══════════════════════════════════════════════════════════════════════════
// ── HANDLER ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

async function handler(m, { sock }) {
    const isImage =
        m.isImage ||
        (m.quoted && m.quoted.type === 'imageMessage')

    if (!isImage) {
        return m.reply(
            `✨ *ᴇɴʜᴀɴᴄᴇ ʜᴅ*\n\n` +
            `> \`${m.prefix}remini\` (reply gambar)\n\n` +
            `╭┈┈⬡「 💡 ɪɴꜰᴏ 」\n` +
            `┃ Reply foto yang mau di-HD-in dulu ya~\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }

    // Helper agar react tidak membuat error. Hanya dipakai 3x total
    // (proses/berhasil/gagal) supaya tidak kena rate limit react di panel.
    const react = async emoji => {
        try {
            await m.react(emoji)
        } catch (e) {
            console.log('[Remini] React gagal:', e.message)
        }
    }

    await react('🕕') // Proses

    try {
        // ─────────────────────────────────────────
        // TAHAP 1: DOWNLOAD
        // ─────────────────────────────────────────

        let buffer

        if (m.quoted?.isMedia) {
            buffer = await m.quoted.download()
        } else if (m.isMedia) {
            buffer = await m.download()
        }

        if (!buffer) {
            throw new Error('Gagal download gambar')
        }

        // ─────────────────────────────────────────
        // TAHAP 2: DETEKSI FORMAT
        // ─────────────────────────────────────────

        const mimetype = await detectMimetype(buffer)

        console.log(
            `[Remini] Gambar berhasil didownload | MIME: ${mimetype} | Size: ${buffer.length}`
        )

        // ─────────────────────────────────────────
        // TAHAP 3: DIRECT ENHANCER
        // ─────────────────────────────────────────

        const directEnhancers = ENHANCERS.filter(
            enhancer => !enhancer.needsUpload
        )

        for (const enhancer of directEnhancers) {
            try {
                console.log(
                    `[Remini] Mencoba direct enhancer: ${enhancer.name}`
                )

                const result = await enhancer.run(buffer, mimetype, null)

                if (!result) {
                    throw new Error('Enhancer tidak mengembalikan hasil')
                }

                console.log(
                    `[Remini] Direct enhancer berhasil: ${enhancer.name}`
                )

                // ─────────────────────────────────
                // TAHAP HASIL
                // ─────────────────────────────────

                let sent

                if (result.type === 'buffer') {
                    sent = await sock.sendMessage(
                        m.chat,
                        {
                            image: result.data,
                            caption:
                                `✨ *ᴇɴʜᴀɴᴄᴇ ʙᴇʀʜᴀsɪʟ*\n\n` +
                                `> 🤖 Engine: ${enhancer.name}`
                        },
                        { quoted: m }
                    )
                } else {
                    sent = await sock.sendMessage(
                        m.chat,
                        {
                            image: { url: result.data },
                            caption:
                                `✨ *ᴇɴʜᴀɴᴄᴇ ʙᴇʀʜᴀsɪʟ*\n\n` +
                                `> 🤖 Engine: ${enhancer.name}`
                        },
                        { quoted: m }
                    )
                }

                await react('✅')

                return sent

            } catch (e) {
                console.log(
                    `[Remini] Direct enhancer gagal via ${enhancer.name}:`,
                    e.message
                )
                // Pindah ke metode berikutnya, tanpa react
            }
        }

        // ─────────────────────────────────────────
        // TAHAP 4: FALLBACK UPLOADER + ENHANCER
        // ─────────────────────────────────────────

        const urlEnhancers = ENHANCERS.filter(
            enhancer => enhancer.needsUpload
        )

        let successPayload = null
        let successEnhancerName = ''
        let lastError = null

        uploaderLoop:
        for (const uploader of UPLOADERS) {
            let uploadResult = null

            try {
                console.log(
                    `[Remini] Mencoba uploader: ${uploader.name}`
                )

                uploadResult = await uploader.fn(
                    buffer,
                    'image.jpg'
                )

                if (!uploadResult?.url) {
                    throw new Error(
                        `${uploader.name} tidak mengembalikan URL`
                    )
                }

                console.log(
                    `[Remini] Upload OK via ${uploader.name}: ${uploadResult.url}`
                )

                for (const enhancer of urlEnhancers) {
                    try {
                        console.log(
                            `[Remini] Memproses API ${enhancer.name} (Host: ${uploader.name})`
                        )

                        const result = await enhancer.run(
                            buffer,
                            mimetype,
                            uploadResult.url
                        )

                        if (result) {
                            successPayload = result

                            successEnhancerName =
                                `${enhancer.name} - ${uploader.name}`

                            console.log(
                                `[Remini] Berhasil via ${successEnhancerName}`
                            )

                            break uploaderLoop
                        }

                    } catch (apiErr) {
                        lastError = apiErr

                        console.log(
                            `[Remini] API ${enhancer.name} gagal (Host: ${uploader.name}):`,
                            apiErr.message
                        )
                        // API gagal, mencoba API/host berikutnya, tanpa react
                    }
                }

            } catch (upErr) {
                lastError = upErr

                console.log(
                    `[Remini] Upload gagal via ${uploader.name}:`,
                    upErr.message
                )
                // Uploader gagal, pindah ke uploader berikutnya, tanpa react

            } finally {

                // ─────────────────────────────────
                // CLEANUP FILE TEMPORARY
                // ─────────────────────────────────

                if (uploadResult?.cleanup) {
                    try {
                        console.log(
                            `[Remini] Cleanup temporary file ${uploader.name}`
                        )

                        await uploadResult.cleanup()

                    } catch (cleanupErr) {
                        console.log(
                            `[Remini] Cleanup gagal:`,
                            cleanupErr.message
                        )
                    }
                }
            }
        }

        // ─────────────────────────────────────────
        // TAHAP 5: KIRIM HASIL FALLBACK
        // ─────────────────────────────────────────

        if (successPayload) {
            console.log(
                `[Remini] Final result berhasil: ${successEnhancerName}`
            )

            let sent

            if (successPayload.type === 'buffer') {
                sent = await sock.sendMessage(
                    m.chat,
                    {
                        image: successPayload.data,
                        caption:
                            `✨ *ᴇɴʜᴀɴᴄᴇ ʙᴇʀʜᴀsɪʟ*\n\n` +
                            `> 🤖 Engine: ${successEnhancerName}`
                    },
                    { quoted: m }
                )
            } else {
                sent = await sock.sendMessage(
                    m.chat,
                    {
                        image: {
                            url: successPayload.data
                        },
                        caption:
                            `✨ *ᴇɴʜᴀɴᴄᴇ ʙᴇʀʜᴀsɪʟ*\n\n` +
                            `> 🤖 Engine: ${successEnhancerName}`
                    },
                    { quoted: m }
                )
            }

            await react('✅')

            return sent
        }

        throw new Error(
            lastError?.message ||
            'Semua kombinasi Uploader & API Remini gagal'
        )

    } catch (error) {
        console.log(
            '[Remini] Error Final:',
            error.message
        )

        await react('❌')

        return m.reply(
            `❌ *ɢᴀɢᴀʟ*\n\n` +
            `> ${error.message}`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}