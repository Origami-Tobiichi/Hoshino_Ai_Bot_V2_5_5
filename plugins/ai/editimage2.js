/**
 * EditImage2 (NanoBanana ibbo.ai)
 * Scraper credit: HaidarApis ( https://api.haidarxd.my.id )
 * base: https://ibbo.ai
 * Diadaptasi untuk Hoshino Ai Bot (hsnai)
 */

const https = require('https')

let SocksProxyAgent = null
try {
  ;({ SocksProxyAgent } = require('socks-proxy-agent'))
} catch {
  SocksProxyAgent = null // tanpa modul ini plugin tetap jalan lewat koneksi langsung
}

const PROXY_API =
  'https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=text&protocol=socks5&timeout=5000'
const BANANA_HOST = 'ibbo.ai'
const BANANA_PATH = '/api/nano-banana-lite-image-to-image'
const MAX_ATTEMPTS = 6
const PROXY_TTL = 10 * 60 * 1000

const HEADERS = {
  Accept: '*/*',
  Origin: 'https://banana-nano.ai',
  Referer: 'https://banana-nano.ai/ai-image-editor',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let proxyCache = { list: [], at: 0 }

function fetchProxies() {
  return new Promise((resolve) => {
    if (proxyCache.list.length && Date.now() - proxyCache.at < PROXY_TTL) {
      return resolve(proxyCache.list)
    }
    const req = https.get(PROXY_API, { timeout: 10000 }, (res) => {
      const chunks = []
      res.on('data', (d) => chunks.push(d))
      res.on('end', () => {
        const list = Buffer.concat(chunks)
          .toString()
          .split('\n')
          .map((l) => {
            const mt = l.trim().match(/([\d.]+):(\d+)/)
            return mt ? `socks5://${mt[1]}:${mt[2]}` : null
          })
          .filter(Boolean)
        proxyCache = { list, at: Date.now() }
        resolve(list)
      })
    })
    req.on('error', () => resolve([]))
    req.on('timeout', () => {
      req.destroy()
      resolve([])
    })
  })
}

function buildBody(imageBuf, prompt) {
  const boundary = '----Boundary' + Date.now() + Math.random().toString(16).slice(2)
  const field = (name, value) =>
    Buffer.from(
      `\r\n--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}`
    )
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`
    ),
    imageBuf,
    field('prompt', prompt),
    field('output_format', 'jpg'),
    field('generator_slug', 'ai-image-editor'),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])
  return { boundary, body }
}

function postBanana(body, boundary, agent) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: BANANA_HOST,
      port: 443,
      path: BANANA_PATH,
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      timeout: 60000,
    }
    if (agent) opts.agent = agent

    const req = https.request(opts, (res) => {
      const chunks = []
      res.on('data', (d) => chunks.push(d))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString()
        try {
          resolve(JSON.parse(raw))
        } catch {
          resolve({ _raw: raw.substring(0, 300), _status: res.statusCode })
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy(new Error('timeout'))
    })
    req.write(body)
    req.end()
  })
}

function downloadBuffer(url, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 4) return reject(new Error('terlalu banyak redirect'))
    const u = new URL(url)
    https
      .get(
        {
          hostname: u.hostname,
          path: u.pathname + u.search,
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 30000,
        },
        (res) => {
          if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
            res.resume()
            return downloadBuffer(new URL(res.headers.location, url).href, depth + 1)
              .then(resolve)
              .catch(reject)
          }
          const chunks = []
          res.on('data', (d) => chunks.push(d))
          res.on('end', () => resolve(Buffer.concat(chunks)))
          res.on('error', reject)
        }
      )
      .on('error', reject)
  })
}

async function editImage(imageBuf, prompt) {
  const proxies = SocksProxyAgent ? await fetchProxies() : []
  let lastErr = 'unknown'

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const { boundary, body } = buildBody(imageBuf, prompt)
    let result = null

    // percobaan lewat proxy (kecuali percobaan terakhir = direct)
    if (proxies.length && i < MAX_ATTEMPTS - 1) {
      const proxy = proxies[Math.floor(Math.random() * proxies.length)]
      try {
        result = await postBanana(body, boundary, new SocksProxyAgent(proxy))
      } catch (e) {
        lastErr = `proxy: ${e.message}`
      }
    }

    // fallback direct
    if (!result || result._raw) {
      try {
        result = await postBanana(body, boundary)
      } catch (e) {
        lastErr = `direct: ${e.message}`
      }
    }

    if (result?.success && result.data?.image_url) {
      const buffer = await downloadBuffer(result.data.image_url)
      if (buffer.length > 0) {
        return {
          buffer,
          model: result.data.model,
          remaining: result.data.free_usage?.remaining,
        }
      }
      lastErr = 'hasil gambar kosong'
    } else if (result) {
      lastErr = result._raw || JSON.stringify(result).substring(0, 150)
    }

    if (i < MAX_ATTEMPTS - 1) await sleep(1500)
  }

  throw new Error(lastErr)
}

const pluginConfig = {
  name: 'editimage2',
  alias: ['editimg2', 'nanobanana2', 'editfoto2'],
  category: 'ai',
  description: 'Edit gambar dengan AI (NanoBanana) lewat prompt',
  usage: '.editimage2 <prompt> (kirim/reply gambar)',
  example: '.editimage2 tambahkan kacamata keren',
  cooldown: 15,
  limit: 1,
  isEnabled: true,
}

async function handler(m, { sock }) {
  const prompt = (m.text || (m.args || []).join(' ') || '').trim()

  const quoted = m.quoted
  const isImg = (x) => x && /image/i.test(x.mimetype || x.msg?.mimetype || x.mtype || '')
  const target = isImg(m) ? m : isImg(quoted) ? quoted : null

  if (!target || !prompt) {
    return m.reply(
      `╭─❖ ⭐ *ᴇᴅɪᴛ ɪᴍᴀɢᴇ ᴀɪ* ⭐ ❖─╮
┃
┃ 🎀 Kirim atau reply gambar
┃     lalu tulis prompt-nya ya~
┃
┃ ✨ *Contoh:*
┃ ${m.prefix || '.'}editimage2 tambahkan kacamata keren
┃
┃ 🌸 _"Serahkan sama Hoshino, nanti_
┃ _fotonya Hoshino percantik!"_ 💖
╰────────────────╯`
    )
  }

  await m.react('⏳')

  try {
    const imageBuf = await target.download()
    if (!imageBuf || !imageBuf.length) throw new Error('gagal mengunduh gambar')

    const { buffer, remaining } = await editImage(imageBuf, prompt)

    const caption = `╭─❖ 💫 *ᴇᴅɪᴛ ɪᴍᴀɢᴇ ᴀɪ* 💫 ❖─╮
┃
┃ 🌸 *Prompt:* ${prompt}${
      remaining !== undefined ? `\n┃ ⭐ *Sisa kuota:* ${remaining}` : ''
    }
┃
┃ 🎀 _"Tadaa~ sudah selesai!_
┃ _Gimana, suka nggak? Hehe~"_ 💖
╰────────────────╯`

    await sock.sendMessage(m.chat, { image: buffer, caption }, { quoted: m })
    await m.react('✅')
  } catch (err) {
    await m.react('❌')
    return m.reply(
      `╭─❖ 🌸 *ɢᴀɢᴀʟ* 🌸 ❖─╮
┃
┃ 💫 _"Uuu... Hoshino gagal_
┃ _mengedit gambarnya..."_
┃
┃ ⭐ *Alasan:* ${String(err.message || err).substring(0, 150)}
┃
┃ 🎀 Coba lagi sebentar ya~
╰────────────────╯`
    )
  }
}

module.exports = { config: pluginConfig, handler }