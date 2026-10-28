const axios = require('axios')

const pluginConfig = {
    name: 'sonu3',
    alias: ['aimusic', 'aivoice'],
    category: 'ai',
    description: 'Hoshino Ai AI Music Generator',
    usage: '.sonu3 <prompt>',
    example: '.sonu3 idol girl singing under the stars',
    cooldown: 5,
    energi: 2,
    isEnabled: true
}

async function handler(m, { sock }) {
    const prefix = m.prefix

    // =========================================
    // PARSE TEXT
    // =========================================

    let text = ''

    if (m.args && Array.isArray(m.args)) {
        text = m.args.join(' ').trim()
    } else if (m.text) {
        text = m.text
            .replace(new RegExp(`^\\${prefix}\\w+`), '')
            .trim()
    }

    if (!text) {
        return m.reply(
            `🎤✨ *Ai siap tampil...*\n\n` +
            `> "Kasih aku ide lagu dulu ya~ 💫"\n\n` +
            `📌 Contoh:\n` +
            `${prefix}sonu3 sad anime girl singing in the rain`
        )
    }

    // =========================================
    // LOADING MESSAGE
    // =========================================

    await m.reply(
        `🎶 *Ai sedang bernyanyi...*\n\n` +
        `> "Tunggu sebentar ya... aku lagi bikin lagu spesial untukmu~ 💖"\n\n` +
        `⏳ Proses pembuatan lagu bisa memerlukan beberapa menit.`
    )

    try {

        // =========================================
        // API URL
        // =========================================

        const apiUrl =
            `https://omegatech-api.dixonomega.tech/api/ai/sonu3` +
            `?action=full&prompt=${encodeURIComponent(text)}`

        console.log('\n========================================')
        console.log('[sonu3] START')
        console.log('[sonu3] PROMPT:', text)
        console.log('[sonu3] REQUEST:', apiUrl)
        console.log('========================================')

        const startTime = Date.now()

        // =========================================
        // API REQUEST
        // =========================================

        const response = await axios.get(apiUrl, {
            timeout: 300000, // 5 menit
            maxRedirects: 5,
            validateStatus: () => true,

            // API mengembalikan JSON
            responseType: 'json',

            headers: {
                'User-Agent': 'Ourin-Bot/2.0',
                'Accept': 'application/json'
            }
        })

        const elapsed = Date.now() - startTime

        console.log(
            '[sonu3] HTTP:',
            response.status,
            response.statusText,
            `(${elapsed}ms)`
        )

        console.log(
            '[sonu3] RESPONSE:',
            response.data
        )

        // =========================================
        // RESPONSE JSON
        // =========================================

        const json = response.data

        // =========================================
        // CHECK HTTP STATUS
        // =========================================

        if (
            response.status < 200 ||
            response.status >= 300
        ) {
            throw new Error(
                `HTTP ${response.status}: ` +
                `${json?.error || json?.message || 'Unknown API error'}`
            )
        }

        // =========================================
        // CHECK API SUCCESS
        // =========================================

        if (!json || json.success !== true) {
            throw new Error(
                json?.error ||
                json?.message ||
                'API mengembalikan success=false'
            )
        }

        // =========================================
        // GET DATA
        // =========================================

        const {
            title,
            tags,
            duration,
            thumbnail,
            url,
            lyrics,
            source,
            attribution
        } = json

        console.log(
            '[sonu3] SUCCESS:',
            {
                title,
                duration,
                hasThumbnail: !!thumbnail,
                hasAudio: !!url,
                lyricsLength: String(lyrics || '').length
            }
        )

        // =========================================
        // VALIDATE AUDIO URL
        // =========================================

        if (!url) {
            throw new Error(
                'URL audio tidak ditemukan dari API'
            )
        }

        // =========================================
        // FULL LYRICS
        // =========================================

        const fullLyrics = String(
            lyrics || '-'
        )

        // =========================================
        // CAPTION
        // =========================================

        const caption =
            `🌟 *Hoshino Ai – AI Music Stage* 🌟\n\n` +
            `🎼 *Title:* ${title || '-'}\n` +
            `🏷️ *Tags:* ${tags || '-'}\n` +
            `⏱️ *Duration:* ${duration || '-'} sec\n` +
            `🌐 *Source:* ${source || '-'}\n` +
            `✨ *Attribution:* ${attribution || '-'}\n\n` +
            `🎤 *Lyrics:* dikirim dalam codeblock di bawah~\n\n` +
            `💫 "Lagu ini... hanya untukmu~"`
        
        // =========================================
        // SEND THUMBNAIL + CAPTION
        // =========================================

        if (thumbnail) {

            try {

                await sock.sendMessage(
                    m.chat,
                    {
                        image: {
                            url: thumbnail
                        },
                        caption
                    },
                    {
                        quoted: m
                    }
                )

            } catch (imageError) {

                console.error(
                    '[sonu3] THUMBNAIL ERROR:',
                    imageError
                )

                // Kalau thumbnail gagal,
                // tetap kirim caption
                await m.reply(caption)
            }

        } else {

            await m.reply(caption)

        }

        // =========================================
        // SEND LYRICS
        // =========================================

        if (lyrics) {

            try {

                if (
                    typeof sock.sendCodeBlockhsn2 === 'function'
                ) {

                    await sock.sendCodeBlockhsn2(
                        m.chat,
                        fullLyrics,
                        m,
                        {
                            language: 'text',
                            text: '🎤 Lyrics'
                        }
                    )

                } else {

                    await m.reply(
                        `🎤 *Lyrics:*\n\n` +
                        '```text\n' +
                        fullLyrics +
                        '\n```'
                    )

                }

            } catch (lyricsError) {

                console.error(
                    '[sonu3] LYRICS ERROR:',
                    lyricsError
                )

                await m.reply(
                    `🎤 *Lyrics:*\n\n` +
                    '```text\n' +
                    fullLyrics +
                    '\n```'
                )
            }
        }

        // =========================================
        // SEND AUDIO
        // =========================================

        console.log(
            '[sonu3] SENDING AUDIO:',
            url
        )

        await sock.sendMessage(
            m.chat,
            {
                audio: {
                    url
                },
                mimetype: 'audio/mpeg',
                fileName:
                    `${title || 'Hoshino-Ai'}.mp3`
            },
            {
                quoted: m
            }
        )

        // =========================================
        // DONE
        // =========================================

        console.log(
            '[sonu3] FINISHED:',
            `${Date.now() - startTime}ms`
        )

    } catch (e) {

        // =========================================
        // ERROR HANDLER
        // =========================================

        console.error('\n========================================')
        console.error('[sonu3] ERROR')
        console.error(e)
        console.error('========================================\n')

        let errorMessage =
            e?.message ||
            String(e)

        // Axios timeout
        if (
            e?.code === 'ECONNABORTED' ||
            e?.code === 'ETIMEDOUT'
        ) {

            errorMessage =
                'API terlalu lama memberikan response ' +
                '(timeout 5 menit). Kemungkinan server generator sedang sibuk atau bermasalah.'

        }

        // Network error
        if (
            e?.code === 'ENOTFOUND'
        ) {

            errorMessage =
                'Domain API tidak dapat ditemukan. ' +
                'Periksa koneksi atau alamat API.'

        }

        if (
            e?.code === 'ECONNRESET'
        ) {

            errorMessage =
                'Koneksi ke API terputus sebelum proses selesai.'

        }

        await m.reply(
            `💔 *Ai gagal tampil...*\n\n` +
            `> "Sepertinya panggungnya bermasalah... coba lagi ya nanti 😢"\n\n` +
            `📝 *Error:*\n` +
            `\`${errorMessage}\``
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}