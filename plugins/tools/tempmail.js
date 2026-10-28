/**
 * ✦ Hoshino Ai — TempMail
 * ✦ Category: Tools
 */

const {
    createEmail,
    getActiveEmail,
    deleteActiveEmail,
    checkInbox
} = require('../../src/lib/tempMail')

const { delay } = require('hsnai')


const pluginConfig = {
    name: 'tempmail',
    alias: ['tempemail', 'tmail'],
    category: 'tools',
    description: 'Bikin email sementara & cek inbox-nya',
    usage: '.tempmail [new|inbox|delete]',
    example: '.tempmail new | .tempmail inbox | .tempmail delete',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}


// =========================================================
// DMSG2
// =========================================================

async function dmsg2(
    sock,
    chatId,
    stanzaId,
    text
) {

    // =====================================================
    // 1. EDIT PESAN .TEMPMAIL
    // =====================================================

    const editResult =
        await sock.sendMessage(
            chatId,
            {
                text: text || 'Hai',

                edit: {
                    remoteJid: chatId,
                    fromMe: true,
                    id: stanzaId
                }
            }
        )

    const editId =
        editResult?.key?.id


    // =====================================================
    // 2. BUAT GROUP STATUS
    // =====================================================

    const tempMsg =
        await sock.relayMessage(
            chatId,
            {
                groupStatusMessageV2: {
                    message: {
                        extendedTextMessage: {
                            text: 'tes',

                            contextInfo: {
                                isGroupStatus: true
                            }
                        }
                    }
                }
            },
            {}
        )


    const tempKey =
        tempMsg?.key


    const tempId =
        tempKey?.id


    // =====================================================
    // 3. TUNGGU
    // =====================================================

    await delay(200)


    // =====================================================
    // 4. HAPUS GROUP STATUS
    // =====================================================

    if (tempKey) {

        console.log(
            '[TEMPMAIL/DMSG2] DELETE GROUP STATUS:',
            JSON.stringify(
                tempKey,
                null,
                2
            )
        )


        await sock.sendMessage(
            chatId,
            {
                delete: tempKey
            }
        )


        await delay(200)
    }


    // =====================================================
    // 5. TYPE 14
    // =====================================================

    if (tempId) {

        const editedMsg =
            await sock.relayMessage(
                chatId,
                {
                    protocolMessage: {

                        key: {
                            remoteJid: chatId,
                            fromMe: true,
                            id: tempId
                        },

                        type: 14,

                        editedMessage: {
                            extendedTextMessage: {

                                text: '\0',

                                contextInfo: {
                                    isGroupStatus: false
                                }
                            }
                        }
                    }
                },
                {
                    messageId: stanzaId
                }
            )


        console.log(
            '[TEMPMAIL/DMSG2] TYPE 14 RESULT:',
            JSON.stringify(
                editedMsg,
                null,
                2
            )
        )
    }


    // =====================================================
    // 6. HAPUS HASIL EDIT
    // =====================================================

    if (editId) {

        await sock.sendMessage(
            chatId,
            {
                delete: {
                    remoteJid: chatId,
                    id: editId,
                    fromMe: true
                }
            }
        )
    }


    // =====================================================
    // 7. DEBUG
    // =====================================================

    console.log(
        '[TEMPMAIL/DMSG2] SELESAI',
        {
            stanzaId,
            editId,
            tempId,
            tempKey
        }
    )
}


// =========================================================
// HANDLER
// =========================================================

async function handler(
    m,
    { sock }
) {

    const sub = (
        m.args?.[0] || 'new'
    ).toLowerCase()


    // =====================================================
    // .TEMPMAIL NEW
    // =====================================================

    if (sub === 'new') {

        await m.react('🕕')


        try {

            // =================================================
            // AMBIL PESAN YANG MENGETIK .TEMPMAIL
            // =================================================

            const stanzaId =
                m.key?.id


            if (!stanzaId) {

                throw new Error(
                    'stanzaId pesan .tempmail tidak ditemukan.'
                )
            }


            console.log(
                '[TEMPMAIL] TARGET STANZA:',
                stanzaId
            )


            // =================================================
            // BUAT EMAIL
            // =================================================

            const {
                email,
                token
            } =
                await createEmail(
                    m.sender
                )


            if (!email || !token) {

                throw new Error(
                    'Email atau token tidak diterima dari API.'
                )
            }


            console.log(
                '[TEMPMAIL] EMAIL:',
                email
            )


            console.log(
                '[TEMPMAIL] TOKEN:',
                token
            )


            // =================================================
            // HASIL TEMPMAIL
            // =================================================

            const text =
                `📧 *ᴛᴇᴍᴘ ᴇᴍᴀɪʟ ʙᴇʀʜᴀꜱɪʟ ᴅɪʙᴜᴀᴛ~* ✨\n\n` +

                `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +

                `┃ 📧 Email: ${email}\n` +

                `┃ 🔑 Token: \`${token}\`\n` +

                `╰┈┈┈┈┈┈┈┈⬡\n\n` +

                `> Cek pesan masuk pakai ` +
                `\`${m.prefix}tempmail inbox\` ya~ 💗`


            // =================================================
            // DMSG2
            //
            // TIDAK ADA sock.sendMessage HASIL DI SINI.
            //
            // DMSG2 langsung mengedit pesan .tempmail.
            // =================================================

            await dmsg2(
                sock,
                m.chat,
                stanzaId,
                text
            )


            await m.react('✅')


        } catch (error) {

            console.error(
                '[tempmail new]',
                error
            )


            await m.react('❌')


            return m.reply(
                `❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ ʙᴜᴀᴛ ᴇᴍᴀɪʟ*\n\n` +
                `> ${error?.message || error}`
            )
        }


        return
    }


    // =====================================================
    // .TEMPMAIL INBOX
    // =====================================================

    if (
        sub === 'inbox' ||
        sub === 'cek' ||
        sub === 'check'
    ) {

        const active =
            await getActiveEmail(
                m.sender
            )


        if (!active) {

            return m.reply(
                `📭 *ʙᴇʟᴜᴍ ᴀᴅᴀ ᴇᴍᴀɪʟ ᴀᴋᴛɪꜰ~*\n\n` +
                `> Bikin dulu pakai ` +
                `\`${m.prefix}tempmail new\``
            )
        }


        await m.react('🕕')


        try {

            const result =
                await checkInbox(
                    active.email,
                    active.token
                )


            if (!result.success) {

                await m.react('❌')


                return m.reply(
                    `❌ *ɢᴀɢᴀʟ ᴀᴍʙɪʟ ɪɴʙᴏx*\n\n` +
                    `> ${result.error}`
                )
            }


            if (
                !result.inbox_data ||
                !result.inbox_data.length
            ) {

                await m.react('✅')


                return m.reply(
                    `📭 *ɪɴʙᴏx ᴍᴀꜱɪʜ ᴋᴏꜱᴏɴɢ~*\n\n` +
                    `┃ 📧 Email: ${active.email}\n` +
                    `> Belum ada pesan masuk, coba cek lagi nanti ya~`
                )
            }


            const latest =
                result.inbox_data[0]


            let txt =
                `📬 *ᴘᴇꜱᴀɴ ᴛᴇʀʙᴀʀᴜ ᴍᴀꜱᴜᴋ~* ✨\n\n`


            txt +=
                `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n`


            txt +=
                `┃ 📧 Dari: ${
                    latest.from?.address ||
                    latest.from ||
                    '-'
                }\n`


            txt +=
                `┃ 📝 Subjek: ${
                    latest.subject ||
                    '-'
                }\n`


            txt +=
                `╰┈┈┈┈┈┈┈┈⬡`


            if (
                result.extractedLinks &&
                result.extractedLinks.length
            ) {

                txt +=
                    `\n\n╭┈┈⬡「 🔗 *ʟɪɴᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ* 」\n`


                for (
                    const link of
                    result.extractedLinks.slice(
                        0,
                        5
                    )
                ) {

                    txt +=
                        `┃ ${link}\n`
                }


                txt +=
                    `╰┈┈┈┈┈┈┈┈⬡`
            }


            await m.react('✅')


            return m.reply(txt)


        } catch (error) {

            console.error(
                '[tempmail inbox]',
                error
            )


            await m.react('❌')


            return m.reply(
                `❌ *ᴀᴅᴜʜ, ɢᴀɢᴀʟ ᴄᴇᴋ ɪɴʙᴏx*\n\n` +
                `> ${error?.message || error}`
            )
        }
    }


    // =====================================================
    // .TEMPMAIL DELETE
    // =====================================================

    if (
        sub === 'delete' ||
        sub === 'hapus'
    ) {

        const removed =
            await deleteActiveEmail(
                m.sender
            )


        await m.react(
            removed
                ? '✅'
                : '❌'
        )


        return m.reply(
            removed
                ? `🗑️ *ᴇᴍᴀɪʟ ꜱᴇᴍᴇɴᴛᴀʀᴀ ʙᴇʀʜᴀꜱɪʟ ᴅɪʜᴀᴘᴜꜱ~*`
                : `📭 *ɢᴀᴋ ᴀᴅᴀ ᴇᴍᴀɪʟ ᴀᴋᴛɪꜰ ʙᴜᴀᴛ ᴅɪʜᴀᴘᴜꜱ~*`
        )
    }


    // =====================================================
    // HELP
    // =====================================================

    return m.reply(
        `📦 *ᴛᴇᴍᴘ ᴍᴀɪʟ ᴘʟᴜɢɪɴ* 📧\n\n` +

        `> Subcommand gak dikenal~ ✨\n\n` +

        `> ${m.prefix}tempmail new\n` +
        `> ${m.prefix}tempmail inbox\n` +
        `> ${m.prefix}tempmail delete`
    )
}


module.exports = {
    config: pluginConfig,
    handler
}