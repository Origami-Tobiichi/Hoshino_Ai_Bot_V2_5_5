const crypto = require('crypto')
const https = require('https')

const pluginConfig = {
    name: 'speedtest',
    alias: ['spt', 'testspeed'],
    category: 'owner',
    description: 'Test kecepatan upload egress server (tanpa lewat WA)',
    usage: '.speedtest',
    example: '.speedtest',
    isOwner: true,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    isEnabled: true
}

function uploadTest(sizeMB) {
    return new Promise((resolve, reject) => {
        const data = crypto.randomBytes(sizeMB * 1024 * 1024)
        const t0 = Date.now()

        const req = https.request({
            hostname: 'speed.cloudflare.com',
            path: '/__up',
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Length': data.length
            },
            timeout: 90000
        }, (res) => {
            res.on('data', () => {})
            res.on('end', () => {
                const elapsed = Date.now() - t0
                const speedMBps = (sizeMB / (elapsed / 1000)).toFixed(2)
                resolve({ elapsed, speedMBps, statusCode: res.statusCode })
            })
        })

        req.on('error', reject)
        req.on('timeout', () => {
            req.destroy()
            reject(new Error('Timeout'))
        })

        req.write(data)
        req.end()
    })
}

async function handler(m, { sock }) {
    await m.reply('🚀 *ᴛᴇsᴛ ᴋᴇᴄᴇᴘᴀᴛᴀɴ ᴜᴘʟᴏᴀᴅ*\n\n> Menguji upload 100MB ke Cloudflare (tanpa lewat WA)...')

    try {
        const result = await uploadTest(100)

        await m.reply(
            `✅ *ʜᴀsɪʟ ᴛᴇsᴛ*\n\n` +
            `> 📊 Ukuran: 100 MB\n` +
            `> ⏱️ Waktu: ${result.elapsed}ms\n` +
            `> 🚀 Kecepatan: ${result.speedMBps} MB/s (~${(result.speedMBps * 8).toFixed(1)} Mbps)\n` +
            `> 📡 Status: ${result.statusCode}\n\n` +
            `_Bandingkan ini sama upload 100MB ke WA (1.6 MB/s, gagal)._`
        )

        console.log(`[SpeedTest] ${result.speedMBps} MB/s, ${result.elapsed}ms, status ${result.statusCode}`)

    } catch (err) {
        console.log('[SpeedTest] Error:', err.message)
        await m.reply(`❌ *Gomen ne~* Test gagal: ${err.message} 🥺`)
    }
}

module.exports = { config: pluginConfig, handler }