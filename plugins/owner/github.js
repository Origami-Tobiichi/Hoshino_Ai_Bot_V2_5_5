const axios = require('axios')
const { fileTypeFromBuffer } = require('file-type')
const config = require('../../config')

const pluginConfig = {
    name: 'github',
    alias: ['gh', 'git', 'ghctl'],
    category: 'owner',
    description: 'Kontrol GitHub langsung dari WhatsApp (repo, file, commit, branch, issue)',
    usage: '.gh <subperintah>',
    example: '.gh ls uploads',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

// ───────────── util ─────────────
class UserError extends Error {}
const fail = (msg) => { throw new UserError(msg) }

const CFG = () => config.github || {}
let override = null // target repo/branch sementara (reset kalau bot restart)

function client() {
    const token = CFG().token
    if (!token || /x{4,}/i.test(token)) fail('Token GitHub belum diisi di `config.github.token` ya~ 🌸')
    return axios.create({
        baseURL: 'https://api.github.com',
        timeout: 30000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'HoshinoAiBot/1.0'
        }
    })
}

function getTarget() {
    const g = CFG()
    return {
        owner: (override && override.owner) || g.owner,
        repo: (override && override.repo) || g.repo,
        branch: (override && override.branch) || g.branch || 'main'
    }
}

const repoUrl = (t) => `/repos/${t.owner}/${t.repo}`
const enc = (p) => p.split('/').map(encodeURIComponent).join('/')

function cleanPath(p = '') {
    const s = String(p).trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    if (s.split('/').some((x) => x === '..')) fail('Path nggak valid ya~ (jangan pakai `..`)')
    return s
}

const box = (title, lines) =>
    `╭┈┈⬡「 ${title} 」\n${lines.map((l) => `┃ ${l}`).join('\n')}\n╰┈┈⬡`

const fmtSize = (n = 0) => {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    return `${(n / 1024 / 1024).toFixed(2)} MB`
}

const firstLine = (s = '') => String(s).split('\n')[0].slice(0, 70)

const withTimeout = (p, ms = 60000) =>
    Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new UserError('Kelamaan nunggu GitHub, coba lagi ya~ ⏳')), ms))])

async function getContent(gh, t, path) {
    try {
        const { data } = await gh.get(`${repoUrl(t)}/contents/${enc(path)}`, { params: { ref: t.branch } })
        return data
    } catch (e) {
        if (e.response && e.response.status === 404) return null
        throw e
    }
}

// verbs = [kata kalau file baru, kata kalau file sudah ada]
async function putFile(gh, t, path, buffer, verbs = ['upload', 'update']) {
    const existing = await getContent(gh, t, path)
    if (Array.isArray(existing)) fail('Itu folder, bukan file ya~ 📁')
    const body = {
        message: `${existing ? verbs[1] : verbs[0]} ${path} via Hoshino Ai`,
        content: buffer.toString('base64'),
        branch: t.branch
    }
    if (existing && existing.sha) body.sha = existing.sha
    const { data } = await gh.put(`${repoUrl(t)}/contents/${enc(path)}`, body)
    return { data, updated: !!existing }
}

function friendly(e) {
    if (e instanceof UserError) return e.message
    const s = e.response && e.response.status
    const msg = e.response && e.response.data && e.response.data.message
    const remain = e.response && e.response.headers && e.response.headers['x-ratelimit-remaining']
    if (s === 401) return 'Token GitHub nggak valid / udah expired~ ganti dulu di config ya 🥺'
    if (s === 403 && remain === '0') return 'Rate limit GitHub habis~ tunggu sebentar ya ⏳'
    if (s === 403) return 'Token-nya nggak punya izin buat itu~ cek scope token-nya ya 🔒'
    if (s === 404) return 'Nggak ketemu~ cek nama repo/branch/path-nya lagi ya 🔍'
    if (s === 409) return 'Konflik~ ada perubahan lain di waktu yang sama, coba ulangi ya~'
    if (s === 422) return `Data ditolak GitHub~ ${msg ? `(${msg})` : ''}`.trim()
    if (s) return `GitHub balas ${s}${msg ? `: ${msg}` : ''}`
    return 'Ai lagi gagal nyambung ke GitHub~ coba lagi nanti ya 🌸'
}

function helpText(p) {
    return box('ɢɪᴛʜᴜʙ ᴄᴏɴᴛʀᴏʟ', [
        `${p}gh whoami — cek akun & token`,
        `${p}gh repos — daftar repo`,
        `${p}gh use <owner/repo@branch> — pindah target (reset = balik ke config)`,
        `${p}gh info — info repo aktif`,
        `${p}gh ls [path] — lihat isi folder`,
        `${p}gh cat <path> — baca file`,
        `${p}gh up [path] — upload (reply/kirim media/file)`,
        `${p}gh write <path>⏎isi — tulis/update file teks`,
        `${p}gh del <path> yes — hapus file`,
        `${p}gh commits [jumlah] — commit terbaru`,
        `${p}gh branches — daftar branch`,
        `${p}gh newbranch <nama> [dari] — bikin branch`,
        `${p}gh issues [open|closed|all] — daftar issue`,
        `${p}gh newissue <judul> | <isi> — bikin issue`,
        `${p}gh closeissue <no> — tutup issue`,
        `${p}gh newrepo <nama> [public] [deskripsi] — bikin repo (default private)`
    ])
}

// ───────────── subcommands ─────────────
const COMMANDS = {
    async whoami({ gh, t }) {
        const r = await gh.get('/user')
        const u = r.data
        return box('ᴀᴋᴜɴ ɢɪᴛʜᴜʙ', [
            `👤 ${u.login}${u.name ? ` (${u.name})` : ''}`,
            `📦 Repo publik: ${u.public_repos}`,
            `🔑 Scope: ${r.headers['x-oauth-scopes'] || '(fine-grained / -)'}`,
            `⚡ Rate limit sisa: ${r.headers['x-ratelimit-remaining']}/${r.headers['x-ratelimit-limit']}`,
            `🎯 Target: ${t.owner}/${t.repo}@${t.branch}`
        ])
    },

    async repos({ gh }) {
        const { data } = await gh.get('/user/repos', { params: { per_page: 30, sort: 'updated' } })
        if (!data.length) return 'Belum ada repo~'
        return box('ᴅᴀꜰᴛᴀʀ ʀᴇᴘᴏ', data.map((r, i) => `${i + 1}. ${r.full_name} ${r.private ? '🔒' : '🌐'} ★${r.stargazers_count}`))
    },

    async use({ gh, t, arg }) {
        if (!arg) return `🎯 Target sekarang: ${t.owner}/${t.repo}@${t.branch}`
        if (/^reset$/i.test(arg)) {
            override = null
            const n = getTarget()
            return `♻️ Target balik ke config: ${n.owner}/${n.repo}@${n.branch}`
        }
        const [repoPart, br] = arg.split('@')
        let owner = t.owner
        let repo = t.repo
        if (repoPart) {
            if (repoPart.includes('/')) [owner, repo] = repoPart.split('/')
            else repo = repoPart
        }
        const { data } = await gh.get(`/repos/${owner}/${repo}`)
        const branch = br || (repoPart ? data.default_branch : t.branch)
        if (br) await gh.get(`/repos/${owner}/${repo}/branches/${enc(br)}`)
        override = { owner, repo, branch }
        return `✅ Target diganti ke ${owner}/${repo}@${branch}\n(sementara, hilang kalau bot restart)`
    },

    async info({ gh, t }) {
        const { data: r } = await gh.get(repoUrl(t))
        return box('ɪɴꜰᴏ ʀᴇᴘᴏ', [
            `📦 ${r.full_name} ${r.private ? '🔒' : '🌐'}`,
            `📝 ${r.description || '-'}`,
            `🌿 Default: ${r.default_branch} | Aktif: ${t.branch}`,
            `⭐ ${r.stargazers_count} | 🍴 ${r.forks_count} | 🐞 ${r.open_issues_count}`,
            `💾 ${fmtSize(r.size * 1024)}`,
            `🕒 Push terakhir: ${new Date(r.pushed_at).toLocaleString('id-ID')}`,
            `🔗 ${r.html_url}`
        ])
    },

    async ls({ gh, t, arg }) {
        const path = cleanPath(arg)
        const data = await getContent(gh, t, path)
        if (!data) fail('Path-nya nggak ketemu~ 🔍')
        if (!Array.isArray(data)) {
            return box('ꜰɪʟᴇ', [`📄 ${data.path}`, `💾 ${fmtSize(data.size)}`, `🔗 ${data.html_url}`])
        }
        data.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
        const shown = data.slice(0, 50).map((f) => (f.type === 'dir' ? `📁 ${f.name}/` : `📄 ${f.name} (${fmtSize(f.size)})`))
        if (data.length > 50) shown.push(`... +${data.length - 50} lainnya`)
        return box(`/${path} @${t.branch}`, shown.length ? shown : ['(kosong)'])
    },

    async cat({ m, sock, gh, t, arg }) {
        const path = cleanPath(arg)
        if (!path) fail('Path file-nya mana? contoh: `.gh cat package.json`')
        const data = await getContent(gh, t, path)
        if (!data) fail('File-nya nggak ketemu~ 🔍')
        if (Array.isArray(data)) fail('Itu folder~ pakai `.gh ls` ya 📁')

        let buf
        if (data.content && data.encoding === 'base64') {
            buf = Buffer.from(data.content, 'base64')
        } else {
            const r = await gh.get(`${repoUrl(t)}/contents/${enc(path)}`, {
                params: { ref: t.branch },
                headers: { Accept: 'application/vnd.github.raw+json' },
                responseType: 'arraybuffer'
            })
            buf = Buffer.from(r.data)
        }

        const name = path.split('/').pop()
        const isText = !buf.subarray(0, 8000).includes(0)
        if (isText && buf.length <= 3500) {
            return `📄 ${path} @${t.branch}\n\n` + '```\n' + buf.toString('utf8') + '\n```'
        }
        await sock.sendMessage(
            m.chat,
            { document: buf, fileName: name, mimetype: isText ? 'text/plain' : 'application/octet-stream' },
            { quoted: m }
        )
        return `📄 ${path} (${fmtSize(buf.length)}) dikirim sebagai file~ ✨`
    },

    async up({ m, gh, t, arg }) {
        // base bot ini pakai isMedia + download(), bukan mimetype
        let src = null
        if (m.quoted && m.quoted.isMedia) src = m.quoted
        else if (m.isMedia) src = m
        if (!src || typeof src.download !== 'function') {
            fail('Reply file/media atau kirim media dengan caption `.gh up <path>` ya~ 📎')
        }

        const buf = await src.download()
        if (!buf || !buf.length) fail('Gagal ambil file dari pesannya~ 🥺')
        if (buf.length > 25 * 1024 * 1024) fail('File kegedean~ maksimal 25 MB ya 📦')

        const type = await fileTypeFromBuffer(buf).catch(() => null)
        const ext = (type && type.ext) || 'bin'
        const origName = src.fileName || (src.msg && src.msg.fileName) || `${Date.now()}.${ext}`

        let path = arg.trim()
        if (!path) path = `${CFG().folder ? CFG().folder + '/' : ''}${origName}`
        else if (path.endsWith('/')) path += origName
        path = cleanPath(path)

        const { data, updated } = await putFile(gh, t, path, buf, ['upload', 'update'])
        return box(updated ? 'ᴜᴘᴅᴀᴛᴇ ꜰɪʟᴇ' : 'ᴜᴘʟᴏᴀᴅ ꜰɪʟᴇ', [
            `📄 ${path} (${fmtSize(buf.length)})`,
            `🌿 ${t.branch}`,
            `🔗 ${data.content.html_url}`,
            `⚡ https://raw.githubusercontent.com/${t.owner}/${t.repo}/${t.branch}/${enc(path)}`
        ])
    },

    async write({ m, gh, t, arg }) {
        const nl = arg.indexOf('\n')
        const pathRaw = (nl === -1 ? arg : arg.slice(0, nl)).trim()
        let content = nl === -1 ? '' : arg.slice(nl + 1)
        if (!content && m.quoted) content = m.quoted.text || (m.quoted.msg && m.quoted.msg.text) || m.quoted.body || ''
        if (!pathRaw || !content) {
            fail('Formatnya:\n`.gh write path/file.txt`\n(isi file di baris berikutnya, atau reply pesan teks)')
        }
        const path = cleanPath(pathRaw)
        const buf = Buffer.from(content, 'utf8')
        const { data, updated } = await putFile(gh, t, path, buf, ['create', 'update'])
        return box(updated ? 'ꜰɪʟᴇ ᴅɪ-ᴜᴘᴅᴀᴛᴇ' : 'ꜰɪʟᴇ ᴅɪʙᴜᴀᴛ', [
            `📄 ${path} (${fmtSize(buf.length)})`,
            `🌿 ${t.branch}`,
            `🔗 ${data.content.html_url}`
        ])
    },

    async del({ gh, t, arg }) {
        const parts = arg.split(/\s+/).filter(Boolean)
        const confirmed = parts.length > 1 && /^(yes|y|ya|-y)$/i.test(parts[parts.length - 1])
        const path = cleanPath(confirmed ? parts.slice(0, -1).join(' ') : arg)
        if (!path) fail('Path file-nya mana? contoh: `.gh del uploads/a.jpg yes`')

        const data = await getContent(gh, t, path)
        if (!data) fail('File-nya nggak ketemu~ 🔍')
        if (Array.isArray(data)) fail('Cuma bisa hapus file, bukan folder ya~ 📁')

        if (!confirmed) {
            return `⚠️ Yakin hapus \`${path}\` dari ${t.owner}/${t.repo}@${t.branch}?\nUlangi dengan: \`.gh del ${path} yes\``
        }
        await gh.delete(`${repoUrl(t)}/contents/${enc(path)}`, {
            data: { message: `delete ${path} via Hoshino Ai`, sha: data.sha, branch: t.branch }
        })
        return `🗑️ \`${path}\` udah dihapus dari ${t.branch}~`
    },

    async commits({ gh, t, arg }) {
        const n = Math.min(Math.max(parseInt(arg) || 8, 1), 20)
        const { data } = await gh.get(`${repoUrl(t)}/commits`, { params: { sha: t.branch, per_page: n } })
        if (!data.length) return 'Belum ada commit~'
        return box(`ᴄᴏᴍᴍɪᴛ @${t.branch}`, data.map((c) => `${c.sha.slice(0, 7)} ${firstLine(c.commit.message)} — ${(c.commit.author && c.commit.author.name) || '?'}`))
    },

    async branches({ gh, t }) {
        const { data } = await gh.get(`${repoUrl(t)}/branches`, { params: { per_page: 50 } })
        return box('ʙʀᴀɴᴄʜ', data.map((b) => `${b.name === t.branch ? '👉' : '🌿'} ${b.name}${b.protected ? ' 🔒' : ''}`))
    },

    async newbranch({ gh, t, arg }) {
        const [name, from] = arg.split(/\s+/).filter(Boolean)
        if (!name) fail('Nama branch-nya mana? contoh: `.gh newbranch dev main`')
        const base = from || t.branch
        const { data: ref } = await gh.get(`${repoUrl(t)}/git/ref/heads/${enc(base)}`)
        await gh.post(`${repoUrl(t)}/git/refs`, { ref: `refs/heads/${name}`, sha: ref.object.sha })
        return `🌿 Branch \`${name}\` dibuat dari \`${base}\`~ (pakai \`.gh use @${name}\` buat pindah)`
    },

    async issues({ gh, t, arg }) {
        const state = /^(closed|all)$/i.test(arg) ? arg.toLowerCase() : 'open'
        const { data } = await gh.get(`${repoUrl(t)}/issues`, { params: { state, per_page: 20 } })
        const list = data.filter((i) => !i.pull_request).slice(0, 15)
        if (!list.length) return `Nggak ada issue ${state}~ ✨`
        return box(`ɪssᴜᴇ (${state})`, list.map((i) => `#${i.number} ${firstLine(i.title)} ${i.state === 'open' ? '🟢' : '🔴'}`))
    },

    async newissue({ gh, t, arg }) {
        const [title, ...rest] = arg.split('|')
        if (!title || !title.trim()) fail('Formatnya: `.gh newissue judul | isi`')
        const { data } = await gh.post(`${repoUrl(t)}/issues`, { title: title.trim(), body: rest.join('|').trim() || undefined })
        return `🐞 Issue #${data.number} dibuat~\n🔗 ${data.html_url}`
    },

    async closeissue({ gh, t, arg }) {
        const no = parseInt(arg)
        if (!no) fail('Nomor issue-nya mana? contoh: `.gh closeissue 12`')
        await gh.patch(`${repoUrl(t)}/issues/${no}`, { state: 'closed' })
        return `✅ Issue #${no} ditutup~`
    },

    async newrepo({ gh, arg }) {
        const tokens = arg.split(/\s+/).filter(Boolean)
        const name = tokens.shift()
        if (!name) fail('Nama repo-nya mana? contoh: `.gh newrepo proyek-baru public deskripsi`')
        const isPublic = tokens.some((x) => /^public$/i.test(x))
        const description = tokens.filter((x) => !/^(public|private)$/i.test(x)).join(' ')
        const { data } = await gh.post('/user/repos', { name, private: !isPublic, description, auto_init: true })
        return box('ʀᴇᴘᴏ ʙᴀʀᴜ', [`📦 ${data.full_name} ${data.private ? '🔒' : '🌐'}`, `🔗 ${data.html_url}`])
    }
}

// alias biar enak diketik
const ALIASES = {
    me: 'whoami', list: 'repos', repo: 'info', dir: 'ls', read: 'cat', upload: 'up',
    put: 'write', rm: 'del', delete: 'del', log: 'commits', branch: 'branches',
    mkbranch: 'newbranch', issue: 'issues', mkissue: 'newissue', closei: 'closeissue', mkrepo: 'newrepo'
}

// ───────────── handler ─────────────
async function handler(m, { sock }) {
    const p = (config.command && config.command.prefix) || '.'
    const raw = (m.text || '').trim()
    const react = (e) => sock.sendMessage(m.chat, { react: { text: e, key: m.key } }).catch(() => {})

    if (!raw) return m.reply(helpText(p))

    const first = raw.split(/\s+/)[0].toLowerCase()
    const sub = COMMANDS[first] ? first : ALIASES[first]
    const arg = raw.slice(first.length).trim()

    if (!sub) return m.reply(`Hmm~ subperintah \`${first}\` Ai nggak kenal 🥺\n\n${helpText(p)}`)

    await react('🕕')
    try {
        const out = await withTimeout(
            (async () => COMMANDS[sub]({ m, sock, arg, p, gh: client(), t: getTarget() }))()
        )
        await react('✅')
        if (out) await m.reply(out)
    } catch (e) {
        // jangan log objek error axios utuh (isinya header Authorization / token)
        console.error('[github]', sub, e.response ? e.response.status : '', (e.response && e.response.data && e.response.data.message) || e.message)
        await react('❌')
        await m.reply(`Yahh~ ${friendly(e)}`)
    }
}

module.exports = { config: pluginConfig, handler }