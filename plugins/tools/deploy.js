const axios = require('axios')
const config = require('../../config')

const pluginConfig = {
    name: 'deploy',
    alias: ['vercel'],
    category: 'owner',
    description: 'Deploy HTML ke Vercel (reply code / file)',
    usage: '.deploy <namawebsite>',
    example: '.deploy mysite',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 60,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const name = m.args[0]?.toLowerCase()
    if (!name) {
        return m.reply(
`🚀 *DEPLOY*

> Masukkan nama website
> Reply kode HTML atau file .html

Contoh:
.deploy mysite`
        )
    }

    if (!m.quoted) {
        return m.reply(
`❌ *HTML TIDAK DITEMUKAN*

> Reply pesan berisi HTML
> atau reply file .html`
        )
    }

    const token = config.vercel?.token
    if (!token) {
        return m.reply('❌ *Vercel token belum diset*')
    }

    m.react('🚀')

    let htmlContent

    try {
        const quoted = m.quoted

const text =
    quoted?.text ||
    quoted?.body ||
    quoted?.caption ||
    quoted?.msg?.text ||
    quoted?.msg?.caption

const mimetype =
    quoted?.mimetype ||
    quoted?.msg?.mimetype ||
    quoted?.message?.documentMessage?.mimetype ||
    quoted?.message?.documentWithCaptionMessage?.message?.documentMessage?.mimetype

const filename =
    quoted?.filename ||
    quoted?.msg?.fileName ||
    quoted?.message?.documentMessage?.fileName ||
    quoted?.message?.documentWithCaptionMessage?.message?.documentMessage?.fileName

if (text) {
    htmlContent = text
} else if (
    mimetype === 'text/html' ||
    /\.html?$/i.test(filename || '')
) {
    const buffer = await quoted.download()

    if (!buffer) {
        throw new Error('Gagal mengunduh file HTML')
    }

    htmlContent = buffer.toString('utf-8')
} else {
            m.react('❌')
            return m.reply(
`❌ *FORMAT TIDAK DIDUKUNG*

> Reply teks HTML
> atau file .html`
            )
        }

        if (!/<html|<!doctype html|<head|<body/i.test(htmlContent)) {
            m.react('❌')
            return m.reply(
`❌ *BUKAN HTML VALID*

> Pastikan berisi struktur HTML`
            )
        }

        const payload = {
            name,
            project: name,
            target: 'production',
            files: [
                {
                    file: 'index.html',
                    data: htmlContent
                }
            ],
            projectSettings: {
                framework: null
            }
        }

        await axios.post(
            'https://api.vercel.com/v13/deployments',
            payload,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            }
        )

        let domain = `${name}.vercel.app`

        try {
            const domainsRes = await axios.get(
                `https://api.vercel.com/v9/projects/${name}/domains`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    },
                    timeout: 30000
                }
            )

            const domains = domainsRes.data.domains || []

            domain =
                domains.find(d => !d.name.endsWith('.vercel.app'))?.name ||
                domains.find(d => d.name.endsWith('.vercel.app'))?.name ||
                domain
        } catch {
            // fallback tetap ke default domain
        }

        m.react('✅')

        await m.reply(
`╭──「 *DEPLOY SUCCESS* 」
│
│ 🌐 Nama     : ${name}
│ ☁️ Platform : Vercel
│ 📄 Type     : Static HTML
│ ⚙️ Status   : Building
│
│ 🔗 URL
│ https://${domain}
│
╰────────────────`
        )

    } catch (error) {
        m.react('❌')

        const err =
            error.response?.data?.error?.message ||
            error.response?.data?.message ||
            error.message

        m.reply(
`╭──「 *DEPLOY FAILED* 」
│
│ ❌ ${err}
│
╰────────────────`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}