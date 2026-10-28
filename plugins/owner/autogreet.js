const hsAsset = require('../../src/lib/assets');
const { getDatabase } = require('../../src/lib/database');
const config = require('../../config');
const fs = require('fs');
const path = require('path');
const { generateWAMessageFromContent, proto, prepareWAMessageMedia } = require('hsnai');

const pluginConfig = {
    name: ['autogreet'],
    alias: ['autopagi', 'automalam', 'greet', 'automsg', 'pagemalam'],
    category: 'owner',
    description: 'Auto kirim ucapan selamat pagi & malam ke Channel',
    usage: '.autogreet on/off/status/test',
    example: '.autogreet test',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
};

// key aset di config.assets (URL diisi di config.js)
const IMAGE = {
    pagi:   'images/hoshinopagi',
    malam:  'images/hoshinomalam',
    thumb:  'images/hsnai',
    thumb2: 'images/hsnai2',
    videoPagi:    'video/greetpagi',
    videoMalam:   'video/greetmalam',
    videoGeneric: 'video/greet'
};

function getCaption(type) {
    const isPagi = type === 'pagi';
    return isPagi
        ? `╭━━━━━━━━━━━━━━━━━━━━━━━⬣\n┃ 🌸✨ 𝐇𝐎𝐒𝐇𝐈𝐍𝐎 𝐀𝐈 ✨🌸\n┃ ── 「 𝐈𝐃𝐎𝐋 𝐌𝐎𝐃𝐄 」 ──\n╰━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n╭━━━〔 🌅 𝐒𝐄𝐋𝐀𝐌𝐀𝐓 𝐏𝐀𝐆𝐈 〕━━━⬣\n┃ Ohayou semuanya ☀️\n┃ Semoga harimu penuh semangat 💖\n╰━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n✨ Keep shining like an idol!`
        : `╭━━━━━━━━━━━━━━━━━━━━━━━⬣\n┃ 🌸✨ 𝐇𝐎𝐒𝐇𝐈𝐍𝐎 𝐀𝐈 ✨🌸\n┃ ── 「 𝐈𝐃𝐎𝐋 𝐌𝐎𝐃𝐄 」 ──\n╰━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n╭━━━〔 🌙 𝐒𝐄𝐋𝐀𝐌𝐀𝐓 𝐌𝐀𝐋𝐀𝐌 〕━━━⬣\n┃ Oyasumi semuanya 🌌\n┃ Istirahat yang cukup ya 😴\n╰━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n💫 Good night, sweet dreams`;
}

async function readImg(key) {
    try { return await hsAsset.tryBuffer(key); }
    catch { return null; }
}

async function sharpResize(buf, w, h) {
    if (!buf) return null;
    try {
        const sharp = require('sharp');
        return await sharp(buf).resize(w, h).toBuffer();
    } catch { return null; }
}

// ─────────────────────────────────────────────
// V1 — Image + caption biasa, tanpa contextInfo
// ─────────────────────────────────────────────
async function sendGreetV1(sock, jid, type) {
    const isPagi = type === 'pagi';
    const imgBuf = await readImg(isPagi ? IMAGE.pagi : IMAGE.malam);
    if (!imgBuf) throw new Error(`Gambar greet ${type} belum diisi di config.assets.images!`);

    await sock.sendMessage(jid, {
        image: imgBuf,
        caption: getCaption(type)
    });
}

// ─────────────────────────────────────────────
// V2 — CTA URL: tombol buka saluran + tombol WA owner
// ─────────────────────────────────────────────
async function sendGreetV2(sock, jid, type) {
    const isPagi      = type === 'pagi';
    const imgBuf      = await readImg(isPagi ? IMAGE.pagi : IMAGE.malam);
    const saluranId   = config.saluran?.id   || '';
    const saluranName = config.saluran?.name || config.bot?.name || 'Hoshino Ai';
    const saluranLink = config.saluran?.link || saluranId;
    const ownerNumber = (config.owner?.number?.[0] || '').replace(/[^0-9]/g, '');
    const ownerName   = config.owner?.name || 'Owner';

    const buttons = [
        {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
                display_text: `📢 Ikuti Channel ${saluranName}`,
                url: saluranLink,
                merchant_url: saluranLink
            })
        },
        {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
                display_text: `💬 WhatsApp ${ownerName}`,
                url: `https://wa.me/${ownerNumber}`,
                merchant_url: `https://wa.me/${ownerNumber}`
            })
        }
    ];

    let headerMedia = null;
    if (imgBuf) {
        try {
            headerMedia = await prepareWAMessageMedia(
                { image: imgBuf },
                { upload: sock.waUploadToServer }
            );
        } catch (e) {}
    }

    const msg = generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2
                },
                interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                    body: proto.Message.InteractiveMessage.Body.fromObject({
                        text: getCaption(type)
                    }),
                    footer: proto.Message.InteractiveMessage.Footer.fromObject({
                        text: `© ${config.bot?.name || 'Hoshino Ai'}`
                    }),
                    header: proto.Message.InteractiveMessage.Header.fromObject({
                        title: config.bot?.name || 'Hoshino Ai',
                        hasMediaAttachment: !!headerMedia,
                        ...(headerMedia || {})
                    }),
                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                        buttons: buttons
                    }),
                    contextInfo: {
                        forwardingScore: 9999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: saluranId,
                            newsletterName: saluranName,
                            serverMessageId: 127
                        }
                    }
                })
            }
        }
    }, { userJid: jid });

    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
}

// ─────────────────────────────────────────────
// V3 — Limited Time Offer header + image + cta_url button
// ─────────────────────────────────────────────
async function sendGreetV3(sock, jid, type) {
    const isPagi      = type === 'pagi';
    const saluranId   = config.saluran?.id   || '';
    const saluranName = config.saluran?.name || config.bot?.name || 'Hoshino Ai';

    const imgKey      = isPagi ? IMAGE.pagi : IMAGE.malam;

    // Upload gambar sebagai header image
    let headerMedia = null;
    try {
        const srcBuf = (await hsAsset.tryBuffer(imgKey)) || (await hsAsset.tryBuffer(IMAGE.thumb));

        if (srcBuf) {
            headerMedia = await prepareWAMessageMedia(
                { image: srcBuf },
                { upload: sock.waUploadToServer }
            );
        }
    } catch (e) {}

    const ownerNumber = (config.owner?.number?.[0] || '').replace(/[^0-9]/g, '');
    const waOwnerUrl  = `https://wa.me/${ownerNumber}?text=Hai+bang+sea`;

    const buttons = [{
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({
            display_text: '💬 Chat Owner',
            url: waOwnerUrl,
            merchant_url: waOwnerUrl
        })
    }];

    const footerText =
        `${isPagi ? '🌅' : '🌙'} *${isPagi ? 'Selamat Pagi' : 'Selamat Malam'}*\n\n` +
        getCaption(type) + `\n\n` +
        `─────────────────────────\n` +
        `Nama  : ${config.bot?.name || 'Hoshino Ai'}\n` +
        `Owner : ${config.owner?.name || 'Owner'}\n` +
        `─────────────────────────`;

    const greetTitle  = isPagi ? '🌅 Selamat Pagi' : '🌙 Selamat Malam';
    const greetDesc   = isPagi ? 'Ohayou semuanya~' : 'Oyasumi semuanya~';
    const greetUrl    = `https://wa.me/${ownerNumber}`;

    const msg = generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2
                },
                interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                    header: proto.Message.InteractiveMessage.Header.fromObject({
                        title: `${config.bot?.name || 'Hoshino Ai'}`,
                        hasMediaAttachment: !!headerMedia,
                        ...(headerMedia || {})
                    }),
                    body: proto.Message.InteractiveMessage.Body.fromObject({
                        text: `*© ${config.bot?.name || 'Hoshino Ai'} ${new Date().getFullYear()}*`
                    }),
                    footer: proto.Message.InteractiveMessage.Footer.fromObject({
                        text: footerText
                    }),
                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                        messageParamsJson: JSON.stringify({
                            limited_time_offer: {
                                text: greetTitle,
                                url: greetUrl,
                                copy_code: greetDesc,
                                expiration_time: Date.now() * 999
                            },
                            bottom_sheet: {
                                in_thread_buttons_energi: 2,
                                divider_indices: [1, 2, 999],
                                list_title: greetTitle,
                                button_title: isPagi ? '🌸 Idol Mode' : '💫 Night Mode'
                            }
                        }),
                        buttons: buttons
                    }),
                    contextInfo: {
                        forwardingScore: 9999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: saluranId,
                            newsletterName: saluranName,
                            serverMessageId: 127
                        }
                    }
                })
            }
        }
    }, { userJid: jid });

    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
}

// ─────────────────────────────────────────────
// V4 — FakeTroli quoted + image + caption (pakai generateWAMessageFromContent)
// ─────────────────────────────────────────────
async function sendGreetV4(sock, jid, type) {
    const isPagi      = type === 'pagi';
    const imgBuf      = await readImg(isPagi ? IMAGE.pagi : IMAGE.malam);
    const saluranId   = config.saluran?.id   || '';
    const saluranName = config.saluran?.name || config.bot?.name || 'Hoshino Ai';

    const troliThumb = await sharpResize(await readImg(IMAGE.thumb2), 300, 300);

    const troliQuoted = {
        key: {
            fromMe: false,
            participant: '0@s.whatsapp.net',
            remoteJid: 'status@broadcast'
        },
        message: {
            orderMessage: {
                orderId: '1337',
                thumbnail: troliThumb,
                itemCount: `BOT READY`,
                status: 'INQUIRY',
                surface: 'CATALOG',
                message: `${config.bot?.name || 'Hoshino Ai'}`,
                orderTitle: `BOT WhatsApp Multi-Device`,
                sellerJid: config.bot?.number
                    ? `${config.bot.number}@s.whatsapp.net`
                    : `0@s.whatsapp.net`,
                token: 'hsnai-menu-v8',
                totalAmount1000: 0,
                totalCurrencyCode: 'IDR',
                contextInfo: {
                    isForwarded: true,
                    forwardingScore: 9999,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: saluranId,
                        newsletterName: saluranName,
                        serverMessageId: 127
                    }
                }
            }
        }
    };

    // Upload gambar dulu pakai prepareWAMessageMedia
    let uploadedMedia = null;
    if (imgBuf) {
        try {
            uploadedMedia = await prepareWAMessageMedia(
                { image: imgBuf },
                { upload: sock.waUploadToServer }
            );
        } catch (e) {}
    }

    // Bangun message content
    let messageContent;
    if (uploadedMedia?.imageMessage) {
        messageContent = {
            imageMessage: {
                ...uploadedMedia.imageMessage,
                caption: getCaption(type)
            }
        };
    } else {
        messageContent = {
            extendedTextMessage: {
                text: getCaption(type)
            }
        };
    }

    const msg = generateWAMessageFromContent(jid, messageContent, {
        userJid: jid,
        quoted: troliQuoted
    });

    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
}

// v5
// ─────────────────────────────────────────────
// V5 — Video Greet: kirim video/gif singkat + caption (diadaptasi dari Ourin)
// ─────────────────────────────────────────────
async function sendGreetV5(sock, jid, type) {
    const isPagi = type === 'pagi';

    // Coba video spesifik pagi/malam dulu, lalu fallback ke video umum
    let videoBuf = null;
    try {
        videoBuf = (await hsAsset.tryBuffer(isPagi ? IMAGE.videoPagi : IMAGE.videoMalam))
            || (await hsAsset.tryBuffer(IMAGE.videoGeneric));
    } catch { videoBuf = null; }

    if (!videoBuf) {
        throw new Error('File video greet tidak ditemukan! Isi URL video di config.assets.video (greetpagi / greetmalam / greet)');
    }

    await sock.sendMessage(jid, {
        video: videoBuf,
        gifPlayback: true,
        caption: getCaption(type),
        contextInfo: {
            forwardingScore: 9999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: config.saluran?.id || '',
                newsletterName: config.saluran?.name || config.bot?.name || 'Hoshino Ai',
                serverMessageId: 127
            }
        }
    });
}

// ─────────────────────────────────────────────
// V6 — Carousel Greet: kartu bisa di-swipe, tiap kartu punya gambar & tombol sendiri
// ─────────────────────────────────────────────
async function sendGreetV6(sock, jid, type) {
    const isPagi      = type === 'pagi';
    const saluranId   = config.saluran?.id   || '';
    const saluranName = config.saluran?.name || config.bot?.name || 'Hoshino Ai';
    const ownerNumber = (config.owner?.number?.[0] || '').replace(/[^0-9]/g, '');
    const waOwnerUrl  = `https://wa.me/${ownerNumber}`;

    const mainBuf  = await readImg(isPagi ? IMAGE.pagi : IMAGE.malam);
    const thumbBuf = await readImg(IMAGE.thumb);

    let mainMedia = null, thumbMedia = null;
    try {
        if (mainBuf)  mainMedia  = await prepareWAMessageMedia({ image: mainBuf },  { upload: sock.waUploadToServer });
        if (thumbBuf) thumbMedia = await prepareWAMessageMedia({ image: thumbBuf }, { upload: sock.waUploadToServer });
    } catch (e) {}

    // Kartu 1 — greet utama
    const card1 = proto.Message.InteractiveMessage.fromObject({
        header: proto.Message.InteractiveMessage.Header.fromObject({
            title: isPagi ? '🌅 Selamat Pagi' : '🌙 Selamat Malam',
            hasMediaAttachment: !!mainMedia,
            ...(mainMedia || {})
        }),
        body: proto.Message.InteractiveMessage.Body.fromObject({
            text: getCaption(type)
        }),
        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
            buttons: [{
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                    display_text: `📢 Ikuti ${saluranName}`,
                    url: config.saluran?.link || saluranId,
                    merchant_url: config.saluran?.link || saluranId
                })
            }]
        })
    });

    // Kartu 2 — info bot + chat owner
    const card2 = proto.Message.InteractiveMessage.fromObject({
        header: proto.Message.InteractiveMessage.Header.fromObject({
            title: config.bot?.name || 'Hoshino Ai',
            hasMediaAttachment: !!thumbMedia,
            ...(thumbMedia || {})
        }),
        body: proto.Message.InteractiveMessage.Body.fromObject({
            text: `🌸 Owner: ${config.owner?.name || 'Owner'}\nSelalu siap bantu kapan saja~`
        }),
        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
            buttons: [{
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                    display_text: '💬 Chat Owner',
                    url: waOwnerUrl,
                    merchant_url: waOwnerUrl
                })
            }]
        })
    });

    const msg = generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2
                },
                interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                    body: proto.Message.InteractiveMessage.Body.fromObject({
                        text: isPagi ? '🌅 Ohayou~ Swipe kartu di bawah ya!' : '🌙 Oyasumi~ Swipe kartu di bawah ya!'
                    }),
                    footer: proto.Message.InteractiveMessage.Footer.fromObject({
                        text: `© ${config.bot?.name || 'Hoshino Ai'}`
                    }),
                    carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
                        cards: [card1, card2]
                    }),
                    contextInfo: {
                        forwardingScore: 9999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: saluranId,
                            newsletterName: saluranName,
                            serverMessageId: 127
                        }
                    }
                })
            }
        }
    }, { userJid: jid });

    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
}

// ─────────────────────────────────────────────
// V7 — Interactive Quoted: fake percakapan quoted + interactiveMessage + tombol quick_reply
// ─────────────────────────────────────────────
async function sendGreetV7(sock, jid, type) {
    const isPagi      = type === 'pagi';
    const imgBuf      = await readImg(isPagi ? IMAGE.pagi : IMAGE.malam);
    const saluranId   = config.saluran?.id   || '';
    const saluranName = config.saluran?.name || config.bot?.name || 'Hoshino Ai';

    if (!imgBuf) throw new Error(`File gambar ${type} tidak ditemukan!`);

    const qFake = {
        key: {
            fromMe: false,
            participant: '0@s.whatsapp.net',
            remoteJid: jid
        },
        message: {
            conversation: isPagi ? 'Ohayou~ udah pagi ya! 🌅' : 'Oyasumi~ udah malam nih 🌙'
        }
    };

    let media = null;
    try {
        media = await prepareWAMessageMedia({ image: imgBuf }, { upload: sock.waUploadToServer });
    } catch (e) {}

    const msg = generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {},
                interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                    header: proto.Message.InteractiveMessage.Header.fromObject({
                        title: '',
                        subtitle: '',
                        hasMediaAttachment: !!media,
                        ...(media || {})
                    }),
                    body: proto.Message.InteractiveMessage.Body.fromObject({
                        text: getCaption(type)
                    }),
                    footer: proto.Message.InteractiveMessage.Footer.fromObject({
                        text: config.bot?.name || 'Hoshino Ai'
                    }),
                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
    buttons: [{
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({
            display_text: `📢 Ikuti ${saluranName}`,
            url: config.saluran?.link || saluranId,
            merchant_url: config.saluran?.link || saluranId
        })
    }]
}),
                    contextInfo: {
                        forwardingScore: 9999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: saluranId,
                            newsletterName: saluranName,
                            serverMessageId: 127
                        }
                    }
                })
            }
        }
    }, { quoted: qFake, userJid: jid });

    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
}

// ─────────────────────────────────────────────
// Dispatcher — baca greetType dari getDatabase()
// ─────────────────────────────────────────────
async function sendGreet(sock, jid, type) {
    const db        = getDatabase();
    const greetType = db.setting('greetType') || 1;

    const senders = {
    1: sendGreetV1,
    2: sendGreetV2,
    3: sendGreetV3,
    4: sendGreetV4,
    5: sendGreetV5,
    6: sendGreetV6,
    7: sendGreetV7
};

    const fn = senders[greetType] || sendGreetV1;
    await fn(sock, jid, type);
}

// ─────────────────────────────────────────────
// Handler command .autogreet
// ─────────────────────────────────────────────
async function handler(m, { sock }) {
    const args     = m.args[0]?.toLowerCase();
    const database = getDatabase();
    const testChId = database.setting('testChannelId');
    const targetCh = testChId || config.saluran?.id;

    if (args === 'test') {
        m.react('🔍');
        await m.reply(`🔍 *T E S T I N G...*\n> Mengirim preview ke Channel...`);
        try {
            await sendGreet(sock, targetCh, 'pagi');
            await new Promise(res => setTimeout(res, 2000));
            await sendGreet(sock, targetCh, 'malam');
            const targetName =
    database.setting('testChannelName') ||
    config.saluran?.name ||
    'Channel';

return m.reply(
    `✅ *TEST SUCCESS*\n` +
    `> Preview berhasil dikirim ke *${targetName}*.`
);
        } catch (err) {
            return m.reply(`❌ *G A G A L*\n> Alasan: ${err.message}`);
        }
    }

    if (args === 'setpagi' || args === 'setmalam') {
        const time = m.args[1];
        if (!time || !/^\d{2}:\d{2}$/.test(time)) return m.reply(`❌ *Ehh~* Format salah! Contoh: 06:00~ 🥺`);
        const key = args === 'setpagi' ? 'autoGreetPagi' : 'autoGreetMalam';
        database.setting(key, time);
        await database.save();
        return m.reply(`✅ *Yatta~* Jam ${args.replace('set', '')} diatur ke *${time}*~ ✨`);
    }

    if (args === 'on') {
        database.setting('autoGreet', true);
        await database.save();
        m.react('✅');
        return m.reply(`✅ *A U T O  G R E E T I N G  A K T I F*`);
    }

    if (args === 'off') {
        database.setting('autoGreet', false);
        await database.save();
        m.react('❌');
        return m.reply(`❌ *A U T O  G R E E T I N G  D I N O N A K T I F K A N*`);
    }

    const status    = database.setting('autoGreet') ? '✅ Aktif' : '❌ Nonaktif';
    const pagi      = database.setting('autoGreetPagi')  || '05:00';
    const malam     = database.setting('autoGreetMalam') || '22:00';
    const greetType = database.setting('greetType') || 1;

    const VARIANT_NAMES = {
    1: 'Image + Caption biasa',
    2: 'CTA URL (Saluran + WA Owner)',
    3: 'Limited Time Offer',
    4: 'FakeTroli Quoted', 
    5: 'Video Greet',
    6: 'Carousel Greet',
    7: 'Interactive Quoted'
};

    return m.reply(
        `🌅 *A U T O  G R E E T I N G*\n\n` +
        `╭┈┈⬡「 📋 *sᴛᴀᴛᴜs* 」\n` +
        `┃ 🔔 sᴛᴀᴛᴜs: ${status}\n` +
        `┃ 🌅 ᴘᴀɢɪ: ${pagi}\n` +
        `┃ 🌙 ᴍᴀʟᴀᴍ: ${malam}\n` +
        `┃ 🕐 ᴢᴏɴᴀ: Asia/Makassar ✅\n` +
        `┃ 🎨 ᴛɪᴘᴇ: V${greetType} — ${VARIANT_NAMES[greetType] || 'Unknown'}\n` +
        `╰┈┈⬡\n\n` +
        `> \`${m.prefix}autogreet on/off\`\n` +
        `> \`${m.prefix}autogreet setpagi 06:00\`\n` +
        `> \`${m.prefix}autogreet test\`\n` +
        `> \`${m.prefix}setgreettype v1~v5\` — ganti tampilan`
    );
}

// ─────────────────────────────────────────────
// Loop Otomatis (dipanggil dari index.js)
// ─────────────────────────────────────────────
async function runAutoGreet(sock) {
    const db = getDatabase();
    if (!db.setting('autoGreet')) return;

    const now      = new Date();
    const makassar = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
    const currentHour   = makassar.getHours();
    const currentMinute = makassar.getMinutes();

    const saluranId = config.saluran?.id;
    if (!saluranId) return;

    if (!global.autoGreetLock) global.autoGreetLock = { pagi: -1, malam: -1 };

    const pagiTime  = db.setting('autoGreetPagi')  || '05:00';
    const malamTime = db.setting('autoGreetMalam') || '22:00';

    const [pagiHour,  pagiMinute]  = pagiTime.split(':').map(Number);
    const [malamHour, malamMinute] = malamTime.split(':').map(Number);

    if (currentHour === pagiHour && currentMinute === pagiMinute) {
        if (global.autoGreetLock.pagi !== currentHour) {
            global.autoGreetLock.pagi = currentHour;
            try {
                await sendGreet(sock, saluranId, 'pagi');
                console.log(`[AutoGreet] ✅ Pagi terkirim ke Channel`);
            } catch (e) {
                global.autoGreetLock.pagi = -1;
                console.log('❌ Error AutoGreet Pagi:', e.message);
            }
        }
    } else {
        global.autoGreetLock.pagi = -1;
    }

    if (currentHour === malamHour && currentMinute === malamMinute) {
        if (global.autoGreetLock.malam !== currentHour) {
            global.autoGreetLock.malam = currentHour;
            try {
                await sendGreet(sock, saluranId, 'malam');
                console.log(`[AutoGreet] ✅ Malam terkirim ke Channel`);
            } catch (e) {
                global.autoGreetLock.malam = -1;
                console.log('❌ Error AutoGreet Malam:', e.message);
            }
        }
    } else {
        global.autoGreetLock.malam = -1;
    }
}

module.exports = {
    config: pluginConfig,
    handler,
    runAutoGreet
};