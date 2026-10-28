const yts = require('yt-search')
const { AIRich } = require('../../src/lib/aiRich')
const { downloadMediaMessage } = require('hsnai')

const pluginConfig = {
    name: 'presetam',
    alias: ['presetAM', 'preset'],
    category: 'search',
    description: 'Cari preset Alight Motion / info dari link AM / parse XML preset',
    usage: '.presetam <keyword/link AM> | reply file XML',
    example: '.presetam preset AM DJ viral',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractLinks(text) {
    if (!text) return []
    return (text.match(/(https?:\/\/[^\s\n]+)/g) || [])
        .filter(l =>
            l.includes('drive.google') || l.includes('mediafire') ||
            l.includes('mega.nz') || l.includes('bit.ly') ||
            l.includes('linktr.ee') || l.includes('lynk.id') ||
            l.includes('s.id') || l.includes('alight.app')
        ).slice(0, 3)
}

function getMeta(html, prop) {
    const m = html.match(new RegExp(`property="${prop}"\\s+content="([^"]+)"`))
    return m ? m[1] : null
}

function getProjectList(html) {
    const m = html.match(/<ul id="project-list">([\s\S]*?)<\/ul>/)
    if (!m) return []
    return [...m[1].matchAll(/<li>(.*?)<\/li>/g)].map(x => x[1].trim())
}

function msToTime(ms) {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
}

const EFFECT_NAMES = {
    'motionblur4': 'Motion Blur',
    'motionblur3': 'Motion Blur',
    'motionblur2': 'Motion Blur',
    'motionblur': 'Motion Blur',
    'tile': 'Tile',
    'oscillate3': 'Oscillate',
    'oscillate2': 'Oscillate',
    'oscillate': 'Oscillate',
    'wavewarp2': 'Wave Warp',
    'wavewarp': 'Wave Warp',
    'lift': 'Lift',
    'exposure': 'Exposure',
    'randomdisplace': 'Random Displace',
    'shake2': 'Shake',
    'shake': 'Shake',
    'circularripple2': 'Circular Ripple',
    'circularripple': 'Circular Ripple',
    'zoomblur3': 'Zoom Blur',
    'zoomblur2': 'Zoom Blur',
    'zoomblur': 'Zoom Blur',
    'gaussianblur': 'Gaussian Blur',
    'swing2': 'Swing',
    'swing': 'Swing',
    'turbulentdisplace3': 'Turbulent Displace',
    'turbulentdisplace2': 'Turbulent Displace',
    'turbulentdisplace': 'Turbulent Displace',
    'satvib': 'Saturation & Vibrance',
    'rgbsep': 'RGB Separation',
    'transform': 'Transform',
    'mirror': 'Mirror',
    'lumakey3': 'Luma Key',
    'lumakey2': 'Luma Key',
    'lumakey': 'Luma Key',
    'dblur': 'Directional Blur',
    'vignette': 'Vignette',
    'wipe2': 'Wipe',
    'wipe': 'Wipe',
    'sharpen': 'Sharpen',
    'hueshift': 'Hue Shift',
    'fractalwarp4': 'Fractal Warp',
    'fractalwarp3': 'Fractal Warp',
    'fractalwarp2': 'Fractal Warp',
    'fractalwarp': 'Fractal Warp',
    'flip3': 'Flip',
    'flip2': 'Flip',
    'flip': 'Flip',
    'displacemap3': 'Displacement Map',
    'displacemap2': 'Displacement Map',
    'displacemap': 'Displacement Map',
    'colorbalance': 'Color Balance',
    'colorcurves': 'Color Curves',
    'colorize': 'Colorize',
    'chromakey': 'Chroma Key',
    'chromakey2': 'Chroma Key',
    'chromakey3': 'Chroma Key',
    'glow': 'Glow',
    'glow2': 'Glow',
    'glow3': 'Glow',
    'bloom': 'Bloom',
    'noise': 'Noise',
    'grain': 'Film Grain',
    'radialblur': 'Radial Blur',
    'linearblur': 'Linear Blur',
    'pixelate': 'Pixelate',
    'mosaic': 'Mosaic',
    'ripple': 'Ripple',
    'spin': 'Spin',
    'strobe': 'Strobe',
    'echo': 'Echo',
    'trails': 'Trails',
    'shadow': 'Drop Shadow',
    'innershadow': 'Inner Shadow',
    'outline': 'Outline',
    'inneroutline': 'Inner Outline',
    'bevel': 'Bevel',
    'emboss': 'Emboss',
    'threshold': 'Threshold',
    'invert': 'Invert',
    'posterize': 'Posterize',
    'duotone': 'Duotone',
    'lut': 'LUT',
    'levels': 'Levels',
    'brightness': 'Brightness & Contrast',
    'temperature': 'Color Temperature',
    'fade': 'Fade'
}

function parseXML(xml) {
    // Scene utama
    const sceneMatch = xml.match(/<scene title="([^"]*)" width="(\d+)" height="(\d+)"[^>]*totalTime="(\d+)"[^>]*fps="(\d+)"[^>]*amver="(\d+)"[^>]*am="([^"]+)"[^>]*amplatform="([^"]+)"/)
    const scene = sceneMatch ? {
        title: sceneMatch[1],
        width: sceneMatch[2],
        height: sceneMatch[3],
        totalTime: parseInt(sceneMatch[4]),
        fps: sceneMatch[5],
        amver: sceneMatch[6],
        am: sceneMatch[7],
        platform: sceneMatch[8]
    } : null

    // Audio
    const audioMatch = xml.match(/<audio[^>]*label="([^"]+)"/)
    const audio = audioMatch ? audioMatch[1] : null

    // Count tags
    const countTag = (tag) => (xml.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length
    const layers = countTag('shape') + countTag('text') + countTag('nullobj') + countTag('embedScene')
    const effects = countTag('effect')
    const bookmarks = countTag('bookmark')
    const texts = countTag('text')
    const scenes = countTag('scene')

    // Fonts
    const fonts = [...new Set([...xml.matchAll(/font="googlefonts\?name=([^&"]+)/g)].map(m => m[1].replace(/\+/g, ' ')))]

    // Text contents
    const contents = [...xml.matchAll(/<content>([\s\S]*?)<\/content>/g)].map(m => m[1].trim()).filter(Boolean).slice(0, 10)

    // Effects — dengan jumlah
    const effectMap = {}
    for (const m of xml.matchAll(/id="com\.alightcreative\.effects\.([^"]+)"/g)) {
        const name = EFFECT_NAMES[m[1]] || m[1]
        effectMap[name] = (effectMap[name] || 0) + 1
    }
    const effectList = Object.entries(effectMap).sort((a, b) => b[1] - a[1])

    return { scene, audio, layers, effects, bookmarks, texts, scenes, fonts, contents, effectList }
}

// ─── Scrapers ────────────────────────────────────────────────────────────────

async function scrapeAlightLink(url) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const html = await res.text()
    return {
        title: getMeta(html, 'og:title'),
        image: getMeta(html, 'og:image'),
        description: getMeta(html, 'og:description'),
        projects: getProjectList(html),
        url
    }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

async function handler(m, { sock }) {
    const query = m.text?.trim()
    const quoted = m.quoted

    // Mode 3: Reply file XML atau link Drive XML
    const driveMatch = query?.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
    const isXmlDoc = quoted?.message?.documentMessage || m.message?.documentMessage

    if (isXmlDoc || driveMatch) {
        m.react('🔍')
        let xml = null

        if (driveMatch) {
            // Download dari Google Drive
            try {
                const fileId = driveMatch[1]
                const dlUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`
                const res = await fetch(dlUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    redirect: 'follow'
                })
                const text = await res.text()
                if (text.includes('<scene') || text.includes('<?xml')) {
                    xml = text
                } else if (text.includes('confirm')) {
                    // Virus scan warning — ambil confirm + uuid
                    const confirmMatch = text.match(/name="confirm" value="([^"]+)"/)
                    const uuidMatch = text.match(/name="uuid" value="([^"]+)"/)
                    if (confirmMatch) {
                        const confirm = confirmMatch[1]
                        const uuid = uuidMatch ? uuidMatch[1] : ''
                        const res2 = await fetch(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${confirm}&uuid=${uuid}`, {
                            headers: { 'User-Agent': 'Mozilla/5.0' },
                            redirect: 'follow'
                        })
                        const text2 = await res2.text()
                        if (text2.includes('<scene') || text2.includes('<?xml')) {
                            xml = text2
                        } else {
                            m.react('❌')
                            return m.reply('❌ *Gomen ne~* Gagal download dari Google Drive. Pastikan file bisa diakses publik~ 🥺')
                        }
                    } else {
                        m.react('❌')
                        return m.reply('❌ *Gomen ne~* Gagal download dari Google Drive. Pastikan file bisa diakses publik~ 🥺')
                    }
                } else {
                    m.react('❌')
                    return m.reply('❌ *Gomen ne~* Gagal download dari Google Drive. Pastikan file XML dan bisa diakses publik~ 🥺')
                }
            } catch (err) {
                m.react('❌')
                return m.reply(`❌ *ɢᴀɢᴀʟ*

> ${err.message}`)
            }
        } else {
            const docMsg = quoted?.message?.documentMessage || m.message?.documentMessage
            if (!docMsg?.fileName?.endsWith('.xml') && docMsg?.mimetype !== 'application/xml' && docMsg?.mimetype !== 'text/xml') {
                return m.reply('❌ *Ehh~* File harus berformat `.xml` dari Alight Motion~ 🥺')
            }
            try {
                const buffer = await downloadMediaMessage(quoted?.message ? quoted : m, 'buffer', {}, { logger: console })
                xml = buffer.toString('utf-8')
            } catch (err) {
                m.react('❌')
                return m.reply(`❌ *ɢᴀɢᴀʟ*

> ${err.message}`)
            }
        }

        try {
            const data = parseXML(xml)

            // Cek apakah ada link alightcreative di caption atau quoted text
            const allText = [m.text, m.quoted?.text, m.quoted?.caption].filter(Boolean).join(' ')
            const amLinkMatch = allText.match(/(https?:\/\/alightcreative\.com\/[^\s]+)/)
            let thumbnail = null
            if (amLinkMatch) {
                try {
                    const amData = await scrapeAlightLink(amLinkMatch[1])
                    thumbnail = amData.image
                } catch {}
            }

            if (!data.scene) {
                m.react('❌')
                return m.reply('❌ *Gomen ne~* Gagal parse XML — pastikan file XML dari Alight Motion~ 🥺')
            }

            const s = data.scene
            const duration = msToTime(s.totalTime)
            const resolution = `${s.width}x${s.height}`
            const amVersion = s.am?.split('/')?.[1] || s.amver

            let text = `*${s.title || 'Preset Alight Motion'}*\n\n`
            text += `📐 *Resolusi:* ${resolution}\n`
            text += `⏱️ *Durasi:* ${duration}\n`
            text += `🎬 *FPS:* ${s.fps}\n`
            text += `📱 *Platform:* ${s.platform}\n`
            text += `🔢 *Versi AM:* ${amVersion}\n`
            text += `\n`
            text += `🎵 *Audio:* ${data.audio || 'N/A'}\n`
            text += `\n`
            text += `📊 *Statistik Layer:*\n`
            text += `┃ 🎞️ Total Layer: ${data.layers}\n`
            text += `┃ ✨ Efek: ${data.effects}\n`
            text += `┃ 🔤 Teks: ${data.texts}\n`
            text += `┃ 📌 Bookmark: ${data.bookmarks}\n`
            text += `┃ 🗂️ Sub-scene: ${data.scenes - 1}\n`

            if (data.fonts.length) {
                text += `\n🖋️ *Font:*\n${data.fonts.map(f => `┃ ${f}`).join('\n')}\n`
            }

            if (data.effectList.length) {
                text += `\n✨ *Efek Digunakan (${data.effectList.length} jenis):*\n`
                text += data.effectList.map(([name, count]) => `┃ ${name}: ${count}x`).join('\n') + '\n'
            }

            if (data.contents.length) {
                text += `\n💬 *Teks di Preset:*\n${data.contents.map(c => `┃ "${c}"`).join('\n')}\n`
            }

            const rich = new AIRich(sock)
            if (thumbnail) rich.addImage(thumbnail)
            await rich
                .addText(text)
                .addTable([
                    ['Info', 'Value'],
                    ['Resolusi', resolution],
                    ['Durasi', duration],
                    ['FPS', s.fps],
                    ['Layer', String(data.layers)],
                    ['Efek', String(data.effects)],
                    ['Teks', String(data.texts)],
                    ['Bookmark', String(data.bookmarks)]
                ])
                .addSuggest(['Alight Motion', 'Preset AM', s.title || 'Project', `${s.width}x${s.height}`])
                .setFooter('#Sea')
                .send(m.chat, { quoted: m.raw })

            m.react('✅')

        } catch (err) {
            m.react('❌')
            return m.reply(`❌ *Gomen ne~* ✦\n\n> ${err.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
        }
        return
    }

    if (!query) {
        return m.reply(
            `🎬 *ᴘʀᴇsᴇᴛ ᴀʟɪɢʜᴛ ᴍᴏᴛɪᴏɴ*\n\n` +
            `> 1️⃣ Kirim keyword: \`${m.prefix}presetam preset AM DJ viral\`\n` +
            `> 2️⃣ Kirim link AM: \`${m.prefix}presetam https://alightcreative.com/...\`\n` +
            `> 3️⃣ Reply file XML dengan \`${m.prefix}presetam\``
        )
    }

    // Mode 2: Scrape link alightcreative
    if (query.includes('alightcreative.com')) {
        m.react('🔍')
        try {
            const data = await scrapeAlightLink(query)
            if (!data.title) {
                m.react('❌')
                return m.reply('❌ *Gomen ne~* Gagal mengambil info dari link tersebut~ 🥺')
            }

            const sizeMatch = data.description?.match(/total ([\d.]+ \w+)/)
            const projCountMatch = data.description?.match(/contains (\d+) project/)
            const size = sizeMatch ? sizeMatch[1] : 'N/A'
            const projCount = projCountMatch ? projCountMatch[1] : '1'
            const projectList = data.projects.length
                ? data.projects.map((p, i) => `${i + 1}. ${p}`).join('\n')
                : 'N/A'

            const text =
                `*${data.title}*\n\n` +
                `📦 *Total Project:* ${projCount}\n` +
                `💾 *Ukuran:* ${size}\n\n` +
                `📋 *Daftar Project:*\n${projectList}\n\n` +
                `🔗 *Link Import:*\n${data.url}\n\n` +
                `_Kirim file XML untuk info lebih detail_`

            await new AIRich(sock)
                .addImage(data.image)
                .addText(text)
                .addSuggest(['Alight Motion', 'Preset AM', 'Download', 'Import'])
                .setFooter('#Sea')
                .send(m.chat, { quoted: m.raw })

            m.react('✅')

        } catch (err) {
            m.react('❌')
            return m.reply(`❌ *Gomen ne~* ✦\n\n> ${err.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
        }
        return
    }

    // Mode 1: Search YouTube
    m.react('🔍')
    try {
        const results = await yts(`${query} preset alight motion`)
        const videos = results.videos?.slice(0, 5) || []

        if (!videos.length) {
            m.react('❌')
            return m.reply(`❌ *Ehh~* Tidak ditemukan hasil untuk: *${query}*~ 🥺`)
        }

        const presetList = []
        for (const v of videos) {
            try {
                const detail = await yts({ videoId: v.videoId })
                const amLinks = (detail.description?.match(/(https?:\/\/alightcreative\.com\/[^\s\n]+)/g) || []).slice(0, 2)
                const dlLinks = extractLinks(detail.description)
                presetList.push({
                    title: v.title,
                    channel: v.author?.name || 'Unknown',
                    views: v.views?.toLocaleString('id-ID') || '0',
                    duration: v.timestamp || 'N/A',
                    url: `https://youtu.be/${v.videoId}`,
                    thumbnail: v.thumbnail,
                    links: [...amLinks, ...dlLinks]
                })
            } catch {
                presetList.push({
                    title: v.title,
                    channel: v.author?.name || 'Unknown',
                    views: v.views?.toLocaleString('id-ID') || '0',
                    duration: v.timestamp || 'N/A',
                    url: `https://youtu.be/${v.videoId}`,
                    thumbnail: v.thumbnail,
                    links: []
                })
            }
        }

        let text = `🎬 *Hasil Pencarian Preset AM*\n`
        text += `🔍 Query: *${query}*\n`
        text += `📊 Ditemukan: *${presetList.length}* video\n\n`

        for (const [i, p] of presetList.entries()) {
            text += `*${i + 1}. ${p.title}*\n`
            text += `👤 ${p.channel} • ⏱️ ${p.duration} • 👁️ ${p.views} views\n`
            text += `▶️ ${p.url}\n`
            text += p.links.length
                ? `🔗 ${p.links.join('\n🔗 ')}\n`
                : `🔗 Cek deskripsi video\n`
            text += `\n`
        }

        const tableRows = presetList.map((p, i) => [
            `${i + 1}. ${p.title.slice(0, 28)}${p.title.length > 28 ? '...' : ''}`,
            p.links.length ? '✅ Ada' : '❌ Tidak'
        ])

        const productCards = presetList.map((p, i) => ({
            title: `${i + 1}. ${p.title.slice(0, 50)}`,
            brand: p.channel,
            price: `⏱️ ${p.duration} • 👁️ ${p.views}`,
            url: p.url,
            image: p.thumbnail,
            icon: p.thumbnail
        }))

        await new AIRich(sock)
            .addProduct(productCards)
            .addText(text)
            .addTable([
                ['Judul', 'Link DL'],
                ...tableRows
            ])
            .addSuggest(['Preset AM', 'Alight Motion', 'Download', query])
            .setFooter('#Sea')
            .send(m.chat, { quoted: m.raw })

        m.react('✅')

    } catch (err) {
        m.react('❌')
        return m.reply(`❌ *Gomen ne~* ✦\n\n> ${err.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}