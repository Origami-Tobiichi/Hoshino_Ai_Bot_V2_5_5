const config = require('../../config')
const fs = require('fs')
const os = require('os')
const path = require('path')
const ffmpeg = require('fluent-ffmpeg')

const {
    prepareWAMessageMedia,
    generateWAMessageFromContent
} = require('hsnai')

const pluginConfig = {
    name: 'fotolive',
    alias: ['livephoto', 'livepic'],
    category: 'tools',
    description: 'Membuat tampilan Foto Live di WhatsApp dari video',
    usage: '.fotolive (balas video)',
    example: '.fotolive',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 5,
    isEnabled: true
}

async function handler(m, { sock }) {
    const videoFile = path.join(
        os.tmpdir(),
        `fotolive_${Date.now()}.mp4`
    )

    const thumbFile = path.join(
        os.tmpdir(),
        `fotolive_${Date.now()}.jpg`
    )

    try {
        const client = sock

        if (!client) {
            throw new Error('Client WhatsApp tidak ditemukan.')
        }

        const q = m.quoted || m
        const raw = q.message || q.msg || q

        const videoMessage =
            raw?.videoMessage ||
            (q.mimetype?.includes('video') ? q : null)

        const mime =
            q.mimetype ||
            raw?.mimetype ||
            videoMessage?.mimetype ||
            ''

        if (!videoMessage && !mime.includes('video')) {
            return await m.reply(
                '❌ *Ehh~* Balas/reply sebuah video terlebih dahulu~ 🥺'
            )
        }

        if (m.react) {
            await m.react('⏳')
        }

        let videoBuffer

        if (typeof q.download === 'function') {
            videoBuffer = await q.download()
        } else if (typeof m.download === 'function') {
            videoBuffer = await m.download()
        } else if (
            typeof client.downloadMediaMessage === 'function'
        ) {
            videoBuffer =
                await client.downloadMediaMessage(q)
        }

        if (!videoBuffer || !videoBuffer.length) {
            throw new Error('Gagal mendownload video.')
        }

        fs.writeFileSync(videoFile, videoBuffer)

        await new Promise((resolve, reject) => {
            ffmpeg(videoFile)
                .outputOptions([
                    '-vframes 1',
                    '-q:v 2'
                ])
                .output(thumbFile)
                .on('end', resolve)
                .on('error', reject)
                .run()
        })

        if (!fs.existsSync(thumbFile)) {
            throw new Error(
                'Gagal membuat thumbnail video.'
            )
        }

        const upload =
            typeof client.waUploadToServer === 'function'
                ? client.waUploadToServer.bind(client)
                : typeof client.uploader === 'function'
                    ? client.uploader.bind(client)
                    : null

        if (!upload) {
            throw new Error(
                'Fungsi upload server tidak ditemukan.'
            )
        }

        const imageMedia =
            await prepareWAMessageMedia(
                {
                    image: fs.readFileSync(thumbFile)
                },
                {
                    upload
                }
            )

        const videoMedia =
            await prepareWAMessageMedia(
                {
                    video: videoBuffer
                },
                {
                    upload
                }
            )

        const photoMessage =
            generateWAMessageFromContent(
                m.chat,
                {
                    imageMessage: {
                        ...imageMedia.imageMessage,
                        contextInfo: {
                            pairedMediaType: 5,
                            statusSourceType: 0
                        }
                    }
                },
                {
                    quoted: m
                }
            )

        await client.relayMessage(
            m.chat,
            photoMessage.message,
            {
                messageId: photoMessage.key.id
            }
        )

        await client.relayMessage(
            m.chat,
            {
                videoMessage: {
                    ...videoMedia.videoMessage,
                    contextInfo: {
                        pairedMediaType: 6,
                        statusSourceType: 0
                    }
                },
                messageContextInfo: {
                    messageAssociation: {
                        associationType: 12,
                        parentMessageKey: photoMessage.key
                    }
                }
            },
            {}
        )

        if (m.react) {
            await m.react('✅')
        }

    } catch (error) {
        console.error(
            'Fotolive Plugin Error:',
            error
        )

        if (m.react) {
            await m.react('❌')
        }

        await m.reply(
            `❌ *Gomen ne~* ✦\n\n> ${error.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`
        )

    } finally {
        try {
            if (fs.existsSync(videoFile)) {
                fs.unlinkSync(videoFile)
            }
        } catch (error) {}

        try {
            if (fs.existsSync(thumbFile)) {
                fs.unlinkSync(thumbFile)
            }
        } catch (error) {}
    }
}

module.exports = {
    config: pluginConfig,
    handler
}