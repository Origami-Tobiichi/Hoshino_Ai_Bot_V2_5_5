const { 
    downloadContentFromMessage, 
    getContentType, 
    jidDecode,
    proto,
    generateWAMessageFromContent,
    generateWAMessage,
    areJidsSameUser,
    normalizeMessageContent  // FIX: Handle all 20+ message wrapper types
} = require('hsnai');
const { writeFileSync, mkdirSync, existsSync, unlinkSync } = require('fs');
const { join } = require('path');
const config = require('../../config');
const { isLid, isLidConverted, lidToJid, convertLidArray, decodeAndNormalize, resolveLidFromParticipants, resolveAnyLidToJid } = require('./lidHelper');
const fs = require('node-webpmux/io');
const fsc = require("fs");
const sharp = require('sharp');
const hsAsset = require('./assets');

// Thumbnail diambil dari URL di config.assets (lihat src/lib/assets.js), bukan dari folder assets/
function getCachedThumb(key) {
    return hsAsset.peek(key);
}

let _sharpThumbCache = {};
async function getCachedSharpThumb(key, w, h) {
    const ck = `${key}_${w}x${h}`;
    if (_sharpThumbCache[ck]) return _sharpThumbCache[ck];
    try {
        const raw = hsAsset.peek(key) || await hsAsset.tryBuffer(key);
        if (raw) {
            _sharpThumbCache[ck] = await sharp(raw).resize(w, h).toBuffer();
            return _sharpThumbCache[ck];
        }
    } catch {}
    return null;
}

const _ppCache = new Map();
const PP_CACHE_TTL = 5 * 60 * 1000;

/**
 * @typedef {Object} ContextInfo
 * @property {string} stanzaId - ID pesan yang di-quote
 * @property {string} participant - JID participant yang di-quote
 * @property {Object} quotedMessage - Pesan yang di-quote
 * @property {string[]} mentionedJid - Array JID yang di-mention
 * @property {boolean} isForwarded - Apakah pesan forwarded
 * @property {number} forwardingScore - Skor forwarding
 * @property {Object} externalAdReply - External ad reply (thumbnail)
 */

/**
 * @typedef {Object} SerializedMessage
 * @property {string} id - ID unik pesan
 * @property {string} chat - JID chat/group
 * @property {string} sender - JID pengirim
 * @property {string} senderNumber - Nomor pengirim tanpa @s.whatsapp.net
 * @property {string} pushName - Nama display pengirim
 * @property {boolean} fromMe - Apakah pesan dari bot sendiri
 * @property {boolean} isGroup - Apakah pesan dari group
 * @property {boolean} isOwner - Apakah pengirim adalah owner
 * @property {boolean} isPremium - Apakah pengirim adalah premium user
 * @property {boolean} isBanned - Apakah pengirim dibanned
 * @property {boolean} isBot - Apakah pengirim adalah bot
 * @property {string} type - Tipe pesan
 * @property {string} body - Isi pesan text
 * @property {string} command - Command tanpa prefix
 * @property {string} prefix - Prefix yang digunakan
 * @property {string[]} args - Array argumen
 * @property {string} text - Text setelah command
 * @property {boolean} isCommand - Apakah pesan adalah command
 * @property {boolean} isMedia - Apakah ada media
 * @property {boolean} isImage - Apakah gambar
 * @property {boolean} isVideo - Apakah video
 * @property {boolean} isAudio - Apakah audio
 * @property {boolean} isSticker - Apakah sticker
 * @property {boolean} isDocument - Apakah dokumen
 * @property {boolean} isContact - Apakah kontak
 * @property {boolean} isLocation - Apakah lokasi
 * @property {boolean} isQuoted - Apakah ada pesan yang di-quote
 * @property {Object} quoted - Objek pesan yang di-quote
 * @property {string[]} mentionedJid - Array JID yang di-mention
 * @property {Object} groupMetadata - Metadata group (jika di group)
 * @property {boolean} isAdmin - Apakah pengirim admin group
 * @property {boolean} isBotAdmin - Apakah bot adalah admin
 * @property {Function} reply - Fungsi reply text
 * @property {Function} replyWithMentions - Fungsi reply dengan mentions
 * @property {Function} replyImage - Fungsi reply gambar
 * @property {Function} replyVideo - Fungsi reply video
 * @property {Function} replyAudio - Fungsi reply audio
 * @property {Function} replySticker - Fungsi reply sticker
 * @property {Function} replyDocument - Fungsi reply dokumen
 * @property {Function} replyContact - Fungsi reply kontak
 * @property {Function} replyLocation - Fungsi reply lokasi
 * @property {Function} replyWithQuote - Fungsi reply dengan fake quote
 * @property {Function} react - Fungsi react emoji
 * @property {Function} download - Fungsi download media
 * @property {Function} delete - Fungsi delete pesan
 * @property {Function} forward - Fungsi forward pesan
 */

/**
 * Decode JID menjadi format yang lebih bersih
 * @param {string} jid - JID yang akan di-decode
 * @returns {string|null} JID yang sudah di-decode atau null
 */
function decodeJid(jid) {
    if (!jid) return null;
    if (/:\d+@/gi.test(jid)) {
        const decoded = jidDecode(jid) || {};
        return (decoded.user && decoded.server && decoded.user + '@' + decoded.server) || jid;
    }
    return jid;
}


function getMessageType(message) {
    if (!message) return null;
    const contentType = getContentType(message);
    if (contentType === 'messageContextInfo' && message.interactiveResponseMessage) {
        return 'interactiveResponseMessage';
    }
    return contentType;
}

/**
 * Mendapatkan text/body dari berbagai tipe pesan
 * @param {Object} message - Objek pesan WhatsApp
 * @param {string} type - Tipe pesan
 * @returns {string} Text/body pesan
 */
function getMessageBody(message, type) {
    if (!message || !type) return '';
    
    const messageContent = message[type];
    if (!messageContent) return '';
    
    switch (type) {
        case 'conversation':
            return message.conversation || '';
        case 'extendedTextMessage':
            return messageContent.text || '';
        case 'imageMessage':
        case 'videoMessage':
        case 'documentMessage':
            return messageContent.caption || '';
        case 'buttonsResponseMessage':
            return messageContent.selectedButtonId || '';
        case 'listResponseMessage':
            return messageContent.singleSelectReply?.selectedRowId || '';
        case 'templateButtonReplyMessage':
            return messageContent.selectedId || '';
        case 'interactiveResponseMessage':
            try {
                const paramsJson = messageContent.nativeFlowResponseMessage?.paramsJson || '{}';
                const parsed = JSON.parse(paramsJson);
                if (parsed.id) return parsed.id;
                if (parsed.response_json) {
                    const nested = JSON.parse(parsed.response_json);
                    if (nested.id) return nested.id;
                    if (nested.selectedRowId) return nested.selectedRowId;
                }
                if (parsed.selectedRowId) return parsed.selectedRowId;
                if (parsed.selected_row_id) return parsed.selected_row_id;
                return '';
            } catch {
                return '';
            }
        case 'pollCreationMessage':
            return messageContent.name || '';
        default:
            return '';
    }
}

/**
 * Parse command dan argumen dari body pesan
 * @param {string} body - Body pesan
 * @param {string} prefix - Prefix command
 * @returns {Object} Command info
 */
function parseCommand(body, prefix) {
    const result = {
        isCommand: false,
        command: '',
        prefix: '',
        args: [],
        text: '',
        fullArgs: ''
    };
    
    if (!body) return result;
    
    let prefixList = [];
    
    try {
        const prefixDbPath = join(process.cwd(), 'database', 'prefix.json');
        if (existsSync(prefixDbPath)) {
            const prefixData = JSON.parse(require('fs').readFileSync(prefixDbPath, 'utf8'));
            prefixList = prefixData.prefixes || [];
        }
    } catch {}
    
    const configPrefix = config.command?.prefix || '.';
    prefixList = [configPrefix, ...prefixList];
    prefixList = [...new Set(prefixList)];
    
    const allKnownPrefixes = [];
    
    for (const p of prefixList) {
        if (body.startsWith(p)) {
            result.isCommand = true;
            result.prefix = p;
            
            const withoutPrefix = body.slice(p.length).trim();
            const parts = withoutPrefix.split(/\s+/);
            
            result.command = config.command?.caseSensitive 
                ? parts[0] 
                : parts[0].toLowerCase();
            result.args = parts.slice(1);
            result.text = withoutPrefix.slice(result.command.length).trim();
            result.fullArgs = withoutPrefix.slice(result.command.length).trim();
            
            break;
        }
    }
    
    if (!result.isCommand) {
        for (const knownPrefix of allKnownPrefixes) {
            if (prefixList.includes(knownPrefix)) continue;
            
            if (body.startsWith(knownPrefix)) {
                const withoutPrefix = body.slice(knownPrefix.length).trim();
                const parts = withoutPrefix.split(/\s+/);
                const potentialCommand = config.command?.caseSensitive ? parts[0] : parts[0].toLowerCase();
                
                if (potentialCommand && /^[a-z0-9_-]+$/i.test(potentialCommand)) {
                    result.isCommand = true;
                    result.prefix = prefixList[0] || prefix;
                    result.command = potentialCommand;
                    result.args = parts.slice(1);
                    result.text = result.args.join(' ');
                    result.fullArgs = withoutPrefix.slice(potentialCommand.length).trim();
                    break;
                }
            }
        }
    }
    
    if (!result.isCommand) {
        let isNoPrefix = false;
        try {
            const prefixDbPath = join(process.cwd(), 'database', 'prefix.json');
            if (existsSync(prefixDbPath)) {
                const prefixData = JSON.parse(require('fs').readFileSync(prefixDbPath, 'utf8'));
                isNoPrefix = prefixData.noprefix === true;
            }
        } catch {}
        
        if (isNoPrefix) {
            const parts = body.trim().split(/\s+/);
            const potentialCommand = config.command?.caseSensitive ? parts[0] : parts[0].toLowerCase();
            
            if (potentialCommand && /^[a-z0-9_-]+$/i.test(potentialCommand) && potentialCommand.length <= 20) {
                result.isCommand = true;
                result.prefix = '';
                result.command = potentialCommand;
                result.args = parts.slice(1);
                result.text = result.args.join(' ');
                result.fullArgs = body.slice(potentialCommand.length).trim();
            }
        }
    }
    
    return result;
}

/**
 * Serialize quoted message dengan full context
 * @param {Object} message - Objek pesan utama
 * @param {string} type - Tipe pesan
 * @param {Object} sock - Socket connection
 * @param {Object[]} participants - Group participants for LID resolution
 * @param {Object} originalMsgKey - Original message key containing participantAlt
 * @returns {Promise<Object|null>} Quoted message object
 */
async function serializeQuotedMessage(message, type, sock, participants = [], originalMsgKey = {}) {
    if (!message || !type) return null;
    
    const messageContent = message[type];
    if (!messageContent) return null;
    
    const contextInfo = messageContent.contextInfo;
    if (!contextInfo || !contextInfo.quotedMessage) return null;
    
    // Buka bungkus associatedChildMessage kalau ada (foto/video anak album).
    // WhatsApp kadang merekonstruksi contextInfo.quotedMessage dengan wrapper
    // ini utuh, jadi getMessageType() salah baca tipenya (jadi
    // 'associatedChildMessage' alih-alih 'imageMessage'/'videoMessage'),
    // yang bikin isMedia jadi false padahal yang di-quote itu gambar/video asli.
    let quotedMessage = contextInfo.quotedMessage;
    const associatedInner = quotedMessage?.associatedChildMessage?.message;
    if (associatedInner) {
        quotedMessage = associatedInner;
    }
    
    const quotedType = getMessageType(quotedMessage);
    
    const { getCachedJid } = require('./lidHelper');
    
    let quotedParticipant = contextInfo.participant || '';
    
    if (isLid(quotedParticipant) || isLidConverted(quotedParticipant)) {
        const cached = getCachedJid(quotedParticipant);
        if (cached && !isLidConverted(cached)) {
            quotedParticipant = cached;
        } else if (participants && participants.length > 0) {
            quotedParticipant = resolveAnyLidToJid(quotedParticipant, participants);
        } else {
            quotedParticipant = lidToJid(quotedParticipant);
        }
    }
    
    quotedParticipant = decodeJid(quotedParticipant);
    
    const quoted = {
        key: {
            remoteJid: message.key?.remoteJid || '',
            fromMe: quotedParticipant === decodeJid(sock?.user?.id),
            id: contextInfo.stanzaId || '',
            participant: quotedParticipant
        },
        id: contextInfo.stanzaId || '',
        sender: quotedParticipant,
        senderNumber: (quotedParticipant || '').replace(/@.+/g, ''),
        type: quotedType,
        body: getMessageBody(quotedMessage, quotedType),
        message: quotedMessage,
        mentionedJid: convertLidArray(contextInfo.mentionedJid || [], participants),
        isMedia: ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'].includes(quotedType),
        isImage: quotedType === 'imageMessage',
        isVideo: quotedType === 'videoMessage',
        isAudio: quotedType === 'audioMessage',
        isSticker: quotedType === 'stickerMessage',
        isDocument: quotedType === 'documentMessage'
    };
    
    quoted.download = async (filename = null) => {
        if (!quoted.isMedia) return null;
        
        const stream = await downloadContentFromMessage(
            quotedMessage[quotedType],
            quotedType.replace('Message', '')
        );
        
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        
        if (filename) {
            const tempDir = join(process.cwd(), 'storage', 'temp');
            if (!existsSync(tempDir)) {
                mkdirSync(tempDir, { recursive: true });
            }
            const filepath = join(tempDir, filename);
            writeFileSync(filepath, buffer);
            return filepath;
        }
        
        return buffer;
    };
    
    return quoted;
}

/**
 * Membuat context info untuk fake reply
 * @param {string} jid - JID pengirim palsu
 * @param {string} text - Text pesan palsu
 * @param {string} [title] - Title/judul
 * @param {string} [body] - Body tambahan
 * @param {Buffer} [thumbnail] - Thumbnail gambar
 * @returns {Object} Context info object
 */
function createContextInfo(jid, text, title = '', body = '', thumbnail = null) {
    const contextInfo = {
        mentionedJid: [],
        forwardingScore: 999,
        isForwarded: true
    };
    
    if (jid && text) {
        contextInfo.quotedMessage = {
            conversation: text
        };
        contextInfo.participant = jid;
        contextInfo.stanzaId = 'OURINAI' + Date.now();
    }
    
    if (title || body || thumbnail) {
        contextInfo.externalAdReply = {
            showAdAttribution: true,
            title: title || config.bot?.name || 'Ourin-AI',
            body: body || '',
            mediaType: 1,
            renderLargerThumbnail: true,
            thumbnail: thumbnail,
            sourceUrl: ''
        };
    }
    
    return contextInfo;
}

/**
 * Serialize pesan WhatsApp menjadi objek lengkap dengan full fitur
 * @param {Object} sock - Socket connection Baileys
 * @param {Object} msg - Raw message dari Baileys event
 * @param {Object} [store] - Store untuk simpan data
 * @returns {Promise<SerializedMessage>} Objek pesan yang sudah di-serialize
 */
async function serialize(sock, msg, store = {}) {
    if (!msg) return null;
    if (!msg.message) return null;
    if (!msg.key) return null;
    
    const m = {};
    
    m.key = msg.key;
    m.id = msg.key?.id || '';
    m.chat = decodeJid(msg.key?.remoteJid || '');
    m.fromMe = (msg.key && msg.key.fromMe) || false;
    m.isGroup = m.chat?.endsWith('@g.us') || false;
    m.isChannel = m.chat?.endsWith('@newsletter') || false;
    m.isNewsletter = m.isChannel;
    
    let senderJid;
    if (m.isGroup) {
        senderJid = msg.key.participant;
    } else if (m.isChannel) {
        senderJid = msg.key.participant || m.chat;
    } else {
        senderJid = m.fromMe 
            ? sock.user.id 
            : msg.key.remoteJid;
    }
    senderJid = decodeAndNormalize(senderJid);
    
    if (!senderJid || isLid(senderJid) || isLidConverted(senderJid)) {
        const fallback = m.isGroup ? (msg.key.participant) : m.chat;
        senderJid = resolveAnyLidToJid(senderJid || fallback, []);
    }
    m.sender = senderJid;
    m.senderNumber = m.sender ? m.sender.replace(/@.+/g, '') : '';
    if (m.isGroup && m.sender) {
        m.key.participant = m.sender;
    }
    m.pushName = msg.pushName || 'Unknown';
    m.isOwner = config.isOwner(m.sender);
    m.isPartner = config.isPartner(m.sender);
    m.isPremium = config.isPremium(m.sender);
    m.isBanned = config.isBanned(m.sender);
    m.isBot = m.fromMe;
    let messageData = normalizeMessageContent(msg.message);
    m.isViewOnce = !!(
        msg.message?.viewOnceMessage || 
        msg.message?.viewOnceMessageV2 ||
        msg.message?.viewOnceMessageV2Extension
    );
    m.type = getMessageType(messageData);
    m.message = messageData;
    m.body = getMessageBody(messageData, m.type);
    const parsed = parseCommand(m.body, config.command?.prefix || '.');
    m.isCommand = parsed.isCommand;
    m.command = parsed.command;
    m.prefix = parsed.prefix;
    m.args = parsed.args;
    m.text = parsed.text;
    m.fullArgs = parsed.fullArgs;
    
    m.isQuoted = false;
    m.quoted = null;
    m._pendingQuotedMessage = { messageData, type: m.type, sock };
    
    const messageContent = messageData[m.type];
    m.mentionedJid = convertLidArray(messageContent?.contextInfo?.mentionedJid || []);
    
    m.isMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'].includes(m.type);
    m.isImage = m.type === 'imageMessage';
    m.isVideo = m.type === 'videoMessage';
    m.isAudio = m.type === 'audioMessage';
    m.isSticker = m.type === 'stickerMessage';
    m.isDocument = m.type === 'documentMessage';
    m.isContact = m.type === 'contactMessage' || m.type === 'contactsArrayMessage';
    m.isLocation = m.type === 'locationMessage' || m.type === 'liveLocationMessage';
    m.isPoll = m.type === 'pollCreationMessage';
    
    m.groupMetadata = null;
    m.isAdmin = false;
    m.isBotAdmin = false;
    m.groupName = '';
    m.groupDesc = '';
    m.groupMembers = [];
    m.groupAdmins = [];
    
    if (m.isGroup) {
        try {
            m.groupMetadata = store.groupMetadata?.[m.chat] || await sock.groupMetadata(m.chat);
            m.groupName = m.groupMetadata?.subject || '';
            m.groupDesc = m.groupMetadata?.desc || '';
            m.groupMembers = m.groupMetadata?.participants || [];
            m.groupAdmins = m.groupMembers?.filter(p => p.admin).map(p => p.jid || p.id || p.lid || '');
            
            const senderNum = m.sender?.replace(/[^0-9]/g, '') || '';
            const botNum = decodeJid(sock.user.id)?.replace(/[^0-9]/g, '') || '';
            
            m.isAdmin = m.groupMembers.some(p => {
                if (!p.admin) return false;
                const pJid = p.jid || p.id || '';
                const pLid = p.lid || '';
                const pNum = pJid.replace(/[^0-9]/g, '');
                const pLidNum = pLid.replace(/[^0-9]/g, '');
                return pNum === senderNum || pLidNum === senderNum || 
                       pNum.includes(senderNum) || senderNum.includes(pNum);
            });
            
            m.isBotAdmin = m.groupMembers.some(p => {
                if (!p.admin) return false;
                const pJid = p.jid || p.id || '';
                const pNum = pJid.replace(/[^0-9]/g, '');
                return pNum === botNum || pNum.includes(botNum) || botNum.includes(pNum);
            });
            
            const { cacheParticipantLids } = require('./lidHelper');
            cacheParticipantLids(m.groupMembers);
            
            if (m._pendingQuotedMessage) {
                const { messageData, type, sock } = m._pendingQuotedMessage;
                m.quoted = await serializeQuotedMessage(messageData, type, sock, m.groupMembers);
                if (m.quoted) {
                    m.isQuoted = true;
                }
                delete m._pendingQuotedMessage;
            }
            
            if (isLid(m.sender) || isLidConverted(m.sender)) {
                m.sender = resolveAnyLidToJid(m.sender, m.groupMembers);
                m.senderNumber = m.sender ? m.sender.replace(/@.+/g, '') : '';
            }
            
            if (m.mentionedJid && m.mentionedJid.length > 0) {
                m.mentionedJid = convertLidArray(m.mentionedJid, m.groupMembers);
            }
            
            if (m.quoted && (isLid(m.quoted.sender) || isLidConverted(m.quoted.sender))) {
                m.quoted.sender = resolveAnyLidToJid(m.quoted.sender, m.groupMembers);
                m.quoted.senderNumber = m.quoted.sender ? m.quoted.sender.replace(/@.+/g, '') : '';
                m.quoted.key.participant = m.quoted.sender;
            }
        } catch (error) {
        }
    }
    
    if (m._pendingQuotedMessage) {
        const { messageData, type, sock } = m._pendingQuotedMessage;
        m.quoted = await serializeQuotedMessage(messageData, type, sock, []);
        if (m.quoted) {
            m.isQuoted = true;
        }
        delete m._pendingQuotedMessage;
    }
    
    m.remoteJid = m.chat;
    m.jid = m.chat;
    m.from = m.chat;
    m.to = m.chat;
    m.botNumber = decodeJid(sock.user?.id)?.replace(/@.+/g, '') || '';
    m.botJid = decodeJid(sock.user?.id) || '';
    m.botName = sock.user?.name || config.bot?.name || 'Ourin-AI';
    m.messageId = m.id;
    m.chatId = m.chat;
    m.senderId = m.sender;
    m.isPrivate = !m.isGroup && !m.isChannel;
    m.isPrivateChat = m.isPrivate;
    m.isGroupChat = m.isGroup;
    m.mediaType = m.type;
    m.hasMedia = m.isMedia;
    m.mimetype = messageData[m.type]?.mimetype || '';
    m.fileLength = messageData[m.type]?.fileLength || 0;
    m.fileName = messageData[m.type]?.fileName || '';
    m.seconds = messageData[m.type]?.seconds || 0;
    m.ptt = messageData[m.type]?.ptt || false;
    m.isAnimated = messageData[m.type]?.isAnimated || false;
    m.quotedMsg = m.quoted;
    m.quotedBody = m.quoted?.body || '';
    m.quotedSender = m.quoted?.sender || '';
    m.quotedType = m.quoted?.type || '';
    m.hasQuotedMedia = m.quoted?.isMedia || false;
    m.hasQuotedImage = m.quoted?.isImage || false;
    m.hasQuotedVideo = m.quoted?.isVideo || false;
    m.hasQuotedSticker = m.quoted?.isSticker || false;
    m.hasQuotedAudio = m.quoted?.isAudio || false;
    m.hasQuotedDocument = m.quoted?.isDocument || false;
    m.isReply = m.isQuoted;
    m.hasMentions = m.mentionedJid.length > 0;
    m.isForwarded = messageData[m.type]?.contextInfo?.isForwarded || false;
    m.forwardingScore = messageData[m.type]?.contextInfo?.forwardingScore || 0;
    m.expiration = messageData[m.type]?.contextInfo?.expiration || 0;
    m.ephemeralSettingTimestamp = msg.messageTimestamp || 0;

    m.reply = async (text, options = {}) => {
        if (!text && text !== 0) return null;
        
        const { getDatabase } = require('./database');
        const db = getDatabase();
        
        let replyVariant = 1;
        try {
            replyVariant = db?.setting?.('replyVariant') || db?.db?.data?.settings?.replyVariant || 1;
        } catch (e) {
            replyVariant = 1;
        }
        
        const contextInfo = {
            mentionedJid: options?.mentions || [m?.sender] || [],
            ...options.contextInfo
        };
        
        const defaultOptions = { contextInfo };
        let quotedMsg = options.quoted !== false ? msg : undefined;

        // SRT (Shuffle Reply Thumb) - ambil thumbnail random kalau fitur diaktifkan lewat .srt on
        const getSrtThumb = () => {
            try {
                if (!db?.setting?.('srtEnabled')) return null;
                // random dari config.assets.shuffle (+ hasil capture .srt c)
                return hsAsset.shuffle();
            } catch (e) {
                return null;
            }
        };
        const srtThumb = getSrtThumb();
        const getSrtSharpThumb = async (w, h) => {
            if (!srtThumb) return null;
            try {
                return await sharp(srtThumb).resize(w, h).jpeg({ quality: 85 }).toBuffer();
            } catch (e) {
                return null;
            }
        };
        
// ── GENERIC MEDIA DISPATCH ───────────────────────────────────────────
    // Berlaku LINTAS semua variant KECUALI v14 (v14 punya penanganan sendiri
    // lewat AIRich di bawah). Plugin cukup manggil m.reply(text, { image, video,
    // gif, document, link, table, code }) tanpa perlu tau variant mana yang aktif.
    async function sendGenericMedia() {
        let sentLink = false;
        let lastResult = null;

        if (options.image) {
            const imgs = Array.isArray(options.image) ? options.image : [options.image];
            for (let i = 0; i < imgs.length; i++) {
                const img = imgs[i];
                lastResult = await sock.sendMessage(m.chat, {
                    image: typeof img === 'string' ? { url: img } : img,
                    caption: i === 0 ? text : undefined,
                    ...(i === 0 ? defaultOptions : {})
                }, { quoted: i === 0 ? quotedMsg : undefined });
            }
            return lastResult;
        }

        if (options.video) {
            const vid = typeof options.video === 'object' && options.video.url ? { url: options.video.url } : options.video;
            return sock.sendMessage(m.chat, {
                video: typeof vid === 'string' ? { url: vid } : vid,
                caption: text,
                gifPlayback: options.gif || false,
                ...defaultOptions
            }, { quoted: quotedMsg });
        }

        // gif berdiri sendiri, tanpa video menyertai
        if (options.gif) {
            return sock.sendMessage(m.chat, {
                video: options.gif,
                caption: text,
                gifPlayback: true,
                ...defaultOptions
            }, { quoted: quotedMsg });
        }

        if (options.document) {
            return sock.sendMessage(m.chat, {
                document: options.document,
                fileName: options.fileName || 'file',
                mimetype: options.mimetype || 'application/octet-stream',
                caption: text,
                ...defaultOptions
            }, { quoted: quotedMsg });
        }

        if (options.link) {
    const links = Array.isArray(options.link) ? options.link : [options.link];
    let body = text;
    links.forEach((l) => {
        const linkUrl = typeof l === 'string' ? l : (l.url || '');
        const linkLabel = typeof l === 'string' ? '' : (l.title || '');
        body += `\n\n${linkLabel ? `🔗 *${linkLabel}*\n` : ''}${linkUrl}`;
    });
    lastResult = await sock.sendMessage(m.chat, {
        text: body,
        ...defaultOptions
    }, { quoted: quotedMsg });
    sentLink = true;
}

        if (options.table) {
            const rows = options.table.map((row) => row.join('  |  ')).join('\n');
            lastResult = await sock.sendMessage(m.chat, {
                text: sentLink ? rows : `${text}\n\n${rows}`,
                ...(sentLink ? {} : defaultOptions)
            }, { quoted: sentLink ? undefined : quotedMsg });
        }

        if (lastResult) return lastResult;

        if (options.code) {
            return sock.sendMessage(m.chat, {
                text: `${text}\n\n\`\`\`${options.codeLang || ''}\n${options.code}\n\`\`\``,
                ...defaultOptions
            }, { quoted: quotedMsg });
        }

        return null; // gak ada media generic → lanjut ke variant biasa
    }

    if (replyVariant !== 14) {
        const genericResult = await sendGenericMedia();
        if (genericResult) return genericResult;
    }

        if (replyVariant === 2) {
            // V2: image hsnai.jpg sebagai header (atau random shuffle kalau SRT aktif)
            const thumbV2 = srtThumb || getCachedThumb('images/hsnai')
            return sock.sendMessage(m.chat, {
                image: thumbV2,
                caption: text,
                ...defaultOptions,
                contextInfo: {
                    ...contextInfo,
                    isForwarded: true,
                    forwardingScore: 9,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06',
                        newsletterName: config.saluran?.name || config.bot?.name || 'Hoshino Ai',
                        serverMessageId: Math.floor(Math.random() * 1000000)
                    }
                },
                ...options
            }, { quoted: quotedMsg })
        }
        else if (replyVariant === 3) {
    const { prepareWAMessageMedia } = require('hsnai')
    const saluranLinkV3 = config.info?.website || config.saluran?.link || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    const thumbRaw = srtThumb || getCachedThumb('images/hsnai')

    const extContent = {
        text: `${saluranLinkV3}\n\n${text}`,
        matchedText: saluranLinkV3,
        previewType: 0,
        renderLargerThumbnail: true,
        title: config.bot?.name || 'Hoshino Ai',
        description: `Pengembang: ${config.bot?.developer || 'Developer'} | Versi: ${config.bot?.version || '1.0.0'}`,
        contextInfo: {
            ...contextInfo,
            isForwarded: true,
            forwardingScore: 9,
            forwardedNewsletterMessageInfo: {
                newsletterJid: config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06',
                newsletterName: config.saluran?.name || config.bot?.name || 'Hoshino Ai',
                serverMessageId: Math.floor(Math.random() * 1000000)
            }
        }
    }

    try {
        const { imageMessage } = await prepareWAMessageMedia(
            { image: thumbRaw },
            { upload: sock.waUploadToServer, mediaTypeOverride: 'thumbnail-link' }
        )
        if (imageMessage) {
            extContent.jpegThumbnail = imageMessage.jpegThumbnail
            if (imageMessage.directPath) extContent.thumbnailDirectPath = imageMessage.directPath
            if (imageMessage.mediaKey) extContent.mediaKey = imageMessage.mediaKey
            if (imageMessage.mediaKeyTimestamp) extContent.mediaKeyTimestamp = imageMessage.mediaKeyTimestamp
            if (imageMessage.fileSha256) extContent.thumbnailSha256 = imageMessage.fileSha256
            if (imageMessage.fileEncSha256) extContent.thumbnailEncSha256 = imageMessage.fileEncSha256
            if (imageMessage.width) extContent.thumbnailWidth = imageMessage.width
            if (imageMessage.height) extContent.thumbnailHeight = imageMessage.height
        }
    } catch {
        extContent.jpegThumbnail = thumbRaw
    }

    const msgV3 = generateWAMessageFromContent(m.chat, {
        extendedTextMessage: extContent
    }, { quoted: quotedMsg, userJid: sock.user?.jid || sock.user?.id })
    return sock.relayMessage(m.chat, msgV3.message, { messageId: msgV3.key.id })
}
        else if (replyVariant === 4) {
            // V4: GIF/video + fake contact quoted
            const userNumberV4 = m.sender?.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '') || '0'
            const gifBuf = (await hsAsset.tryBuffer('video/hsnai-reply-v4')) || (srtThumb || getCachedThumb('images/hsnai'))
            const contactQuotedV4 = {
                key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast' },
                message: {
                    contactMessage: {
                        displayName: m.pushName || 'User',
                        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;${m.pushName || 'User'};;;\nFN:${m.pushName || 'User'}\nTEL;type=CELL;type=VOICE;waid=${userNumberV4}:${userNumberV4}\nEND:VCARD`
                    }
                }
            }
            return sock.sendMessage(m.chat, {
                video: gifBuf,
                caption: text,
                gifPlayback: true,
                ...defaultOptions,
                contextInfo: {
                    ...contextInfo,
                    isForwarded: true,
                    forwardingScore: 9,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06',
                        newsletterName: config.saluran?.name || config.bot?.name || 'Hoshino Ai',
                        serverMessageId: Math.floor(Math.random() * 1000000)
                    }
                },
                ...options
            }, { quoted: contactQuotedV4 })
        }
        else if (replyVariant === 5) {
            // V5: fake order message quoted
            quotedMsg = {
                key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast' },
                message: {
                    orderMessage: {
                        orderId: '1337',
                        thumbnail: (await getSrtSharpThumb(300, 300)) || await getCachedSharpThumb('images/hsnai2', 300, 300),
                        itemCount: `BOT READY`,
                        status: 'INQUIRY',
                        surface: 'CATALOG',
                        message: `${config.bot?.name || 'Ourin-AI'}`,
                        orderTitle: `BOT WhatsApp Multi-Device`,
                        sellerJid: config.bot?.number ? `${config.bot.number}@s.whatsapp.net` : m.sender,
                        token: 'hsnai-menu-v8',
                        totalAmount1000: 0,
                        totalCurrencyCode: 'IDR',
                        contextInfo: {
                            isForwarded: true,
                            forwardingScore: 9999,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06',
                                newsletterName: config.saluran?.name || config.bot?.name || 'Ourin-AI',
                                serverMessageId: 127
                            }
                        }
                    }
                }
            }
            return sock.sendMessage(m.chat, {
                text,
                ...defaultOptions,
                ...options
            }, { quoted: quotedMsg })
        }
        else if (replyVariant === 6) {
            // V6: document fake image + fake contact quoted
            const fakeContactV6 = {
                key: { participant: `0@s.whatsapp.net`, remoteJid: `status@broadcast` },
                message: {
                    contactMessage: {
                        displayName: `🪸 ${config.bot?.name}`,
                        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:XL;ttname,;;;\nFN:ttname\nitem1.TEL;waid=13135550002:+1 (313) 555-0002\nitem1.X-ABLabel:Ponsel\nEND:VCARD`,
                        sendEphemeral: true
                    }
                }
            }
            return sock.sendMessage(m.chat, {
                document: fsc.readFileSync(join(process.cwd(), 'package.json')),
                mimetype: 'image/png',
                fileName: config.bot.name,
                fileLength: 99999999999999,
                jpegThumbnail: (await getSrtSharpThumb(300, 300)) || await getCachedSharpThumb('images/hsnai2', 300, 300),
                caption: text,
                ...defaultOptions,
                ...options
            }, { quoted: fakeContactV6 })
        }
        else if (replyVariant === 7) {
            // V7: document fake image + quoted ori
            return sock.sendMessage(m.chat, {
                document: fsc.readFileSync(join(process.cwd(), 'package.json')),
                mimetype: 'image/png',
                fileName: config.bot.name,
                fileLength: 99999999999999,
                jpegThumbnail: (await getSrtSharpThumb(300, 300)) || await getCachedSharpThumb('images/hsnai2', 300, 300),
                caption: text,
                ...defaultOptions,
                ...options
            }, { quoted: quotedMsg })
        }
        else if (replyVariant === 8) {
            // V8: interactiveMessage + location header
            const { generateWAMessageFromContent, proto } = require('hsnai')
            const thumbV8 = srtThumb || getCachedThumb('images/hsnai')
            const thumbV8Resized = await (async () => {
    if (!thumbV8) return undefined
    const meta = await sharp(thumbV8).metadata()
    const w = meta.width || 300
    const h = meta.height || 300
    const targetW = 300
    const targetH = Math.round((h / w) * targetW)
    return await sharp(thumbV8).resize(targetW, targetH).jpeg({ quality: 85 }).toBuffer()
})() 
            const msgV8 = generateWAMessageFromContent(m.chat, {
                viewOnceMessage: {
                    message: {
                        messageContextInfo: {},
                        interactiveMessage: {
                            header: {
                                hasMediaAttachment: true,
                                locationMessage: {
                                    degreesLatitude: 0,
                                    degreesLongitude: 0,
                                    name: config.bot?.name || 'Hoshino Ai',
                                    address: config.bot?.developer || 'WhatsApp Bot',
                                    jpegThumbnail: thumbV8Resized
                                }
                            },
                            body: { text },
                            footer: { text: config.bot?.name || 'Hoshino Ai' },
                            contextInfo: {
                                mentionedJid: options?.mentions || [m?.sender] || [],
                                isForwarded: true,
                                forwardingScore: 9,
                                ...contextInfo
                            },
                            nativeFlowMessage: { buttons: [] }
                        }
                    }
                }
            }, { quoted: quotedMsg, userJid: sock.user?.jid || sock.user?.id })
            return sock.relayMessage(m.chat, msgV8.message, { messageId: msgV8.key.id })
        }
        else if (replyVariant === 9) {
            // V9: buttonsMessage + location header + 2 tombol
            const { generateWAMessageFromContent } = require('hsnai')
            const thumbV9 = srtThumb || getCachedThumb('images/hsnai')
            const thumbV9Resized = await (async () => {
    if (!thumbV9) return undefined
    const meta = await sharp(thumbV9).metadata()
    const w = meta.width || 300
    const h = meta.height || 300
    const targetW = 300
    const targetH = Math.round((h / w) * targetW)
    return await sharp(thumbV9).resize(targetW, targetH).jpeg({ quality: 85 }).toBuffer()
})()
            const saluranLinkV9 = config.saluran?.link || config.info?.website || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
            const contentV9 = {
                buttonsMessage: {
                    buttons: [
                        {
                            buttonId: `${m.prefix || '.'}owner`,
                            buttonText: { displayText: '👑 Kontak Owner' },
                            type: 1
                        },
                        {
                            buttonId: `${m.prefix || '.'}allmenu`,
                            buttonText: { displayText: '📋 Lihat Semua Menu' },
                            type: 1
                        }
                    ],
                    locationMessage: {
                        jpegThumbnail: thumbV9Resized || undefined,
                        name: config.bot?.name || 'Hoshino Ai',
                        address: `v${config.bot?.version || '1.0.0'} | ${config.bot?.developer || 'Developer'}`
                    },
                    contentText: `Hai *${m.pushName || 'Kamu'}* 👋`,
                    footerText: `${text}\n\n${saluranLinkV9}`,
                    headerType: 6,
                    contextInfo: {
                        mentionedJid: options?.mentions || [m?.sender] || [],
                        isForwarded: true,
                        forwardingScore: 9,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06',
                            newsletterName: config.saluran?.name || config.bot?.name || 'Hoshino Ai',
                            serverMessageId: Math.floor(Math.random() * 1000000)
                        }
                    }
                }
            }
            const msgV9 = generateWAMessageFromContent(m.chat, contentV9, {
                userJid: sock.user?.jid || sock.user?.id
            })
            return sock.relayMessage(m.chat, msgV9.message, { messageId: msgV9.key.id })
        }
        else if (replyVariant === 10) {
    // V10: sendBusinessCard + fake order quoted (troli)
    const latencyV10 = Math.max(1, Date.now() - (m.messageTimestamp ? m.messageTimestamp * 1000 : Date.now()))
    let pluginNameV10 = m.command || 'bot'
    try {
        const { getPlugins } = require('./plugins')
        const allPlugins = getPlugins()
        const matched = Object.values(allPlugins).find(p =>
            p.config?.name === m.command ||
            (Array.isArray(p.config?.alias) && p.config.alias.includes(m.command))
        )
        if (matched?.config?.name) pluginNameV10 = matched.config.name
    } catch {}
    const fakeQuotedV10 = {
        key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast' },
        message: {
            orderMessage: {
                orderId: '1337',
                thumbnail: (await getSrtSharpThumb(300, 300)) || await getCachedSharpThumb('images/hsnai2', 300, 300),
                itemCount: latencyV10,
                status: 'INQUIRY',
                surface: 'CATALOG',
                message: `${pluginNameV10}.js`,
                orderTitle: 'BOT WhatsApp Multi-Device',
                sellerJid: config.bot?.number ? `${config.bot.number}@s.whatsapp.net` : m.sender,
                token: 'hsnai-menu-v8',
                totalAmount1000: 0,
                totalCurrencyCode: 'IDR',
                contextInfo: {
                    isForwarded: true,
                    forwardingScore: 9999,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06',
                        newsletterName: config.saluran?.name || config.bot?.name || 'Hoshino Ai',
                        serverMessageId: 127
                    }
                }
            }
        }
    }
    return sock.sendBusinessCard(m.chat, {
        title: config.bot?.name || 'Hoshino Ai',
        subtitle: `v${config.bot?.version || '1.0.0'} | ${config.bot?.developer || config.owner?.name || 'Developer'}`,
        body: text,
        footer: config.info?.website || config.saluran?.link || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06',
        contextInfo: {
            mentionedJid: [m.sender],
            isForwarded: true,
            forwardingScore: 9,
            forwardedNewsletterMessageInfo: {
                newsletterJid: config.saluran?.id || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06',
                newsletterName: config.saluran?.name || config.bot?.name || 'Hoshino Ai',
                serverMessageId: 127
            }
        },
        quoted: fakeQuotedV10
    })
}
        else if (replyVariant === 11) {
            // V11: TAGIHAN / PAYMENT - native WA payment request bubble
            return sock.relayMessage(m.chat, {
                requestPaymentMessage: {
                    currencyCodeIso4217: 'IDR',
                    amount1000: String((config.bot?.paymentAmount || 0) * 1000 || 75000000),
                    requestFrom: m.sender || '0@s.whatsapp.net',
                    noteMessage: {
                        extendedTextMessage: {
                            text,
                            contextInfo: {
                                mentionedJid: options?.mentions || [m?.sender] || [],
                                participant: m?.sender,
                                quotedMessage: m?.message || { conversation: m?.text || '' }
                            }
                        }
                    }
                }
            }, {})
        }
        else if (replyVariant === 12) {
            // V12: ANIMATED BOT NAME - text animasi loop via message edit
            const delayV12 = (ms) => new Promise(r => setTimeout(r, ms))
            const charsV12 = [...(config.bot?.name || 'Hoshino Ai')]
            const saluranLinkV12 = config.saluran?.link || config.info?.website || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'

            const sentMsgV12 = await sock.sendMessage(m.chat, { text: '❁ ...' }, { quoted: quotedMsg })
            const keyV12 = sentMsgV12.key
            const thumbV12 = srtThumb || getCachedThumb('images/hsnai')

            ;(async () => {
                try {
                    // Jeda dulu sebelum mulai edit pertama. Kalau edit langsung nyusul
                    // secepatnya setelah pesan awal terkirim, WA belum sempet nganggep
                    // pesan itu "settled" di device penerima -> bisa balik nampilin versi
                    // original ("❁ ...") lagi, mirip kasus hapus pesan yang kecepetan.
                    await delayV12(4000)

                    let iteration = 0
                    while (iteration < 100) {
                        let currentTitle = ''
                        for (const char of charsV12) {
                            currentTitle += char
                            await sock.sendMessage(m.chat, {
                                text: `${saluranLinkV12}\n\n${text}`,
                                edit: keyV12,
                                linkPreview: {
                                    'matched-text': saluranLinkV12,
                                    title: currentTitle,
                                    description: config.bot?.developer || 'Bot WhatsApp Multi Device',
                                    jpegThumbnail: thumbV12
                                }
                            })
                            await delayV12(2000)
                            iteration++
                            if (iteration >= 100) break
                        }
                        await delayV12(5000)
                    }
                } catch (e) {
                    console.error('V12 Animation error:', e)
                }
            })()

            return sentMsgV12
        }

        else if (replyVariant === 13) {
            // V13: FAKE CATALOG - orderMessage sebagai isi pesan utama (surface: CATALOG)
            const thumbV13 = (await getSrtSharpThumb(300, 300)) || await getCachedSharpThumb('images/hsnai2', 300, 300)
            return sock.relayMessage(m.chat, {
                orderMessage: {
                    orderId: String(Math.floor(Math.random() * 900000) + 100000),
                    thumbnail: thumbV13,
                    itemCount: 1,
                    status: 'INQUIRY',
                    surface: 'CATALOG',
                    message: text,
                    orderTitle: config.bot?.name || 'Hoshino Ai',
                    token: 'hsnai-catalog-v13',
                    sellerJid: config.bot?.number ? `${config.bot.number}@s.whatsapp.net` : m.sender,
                    totalAmount1000: '0',
                    totalCurrencyCode: 'IDR',
                    messageVersion: 1,
                    contextInfo: {
                        mentionedJid: options?.mentions || [m?.sender] || [],
                        participant: m?.sender,
                        quotedMessage: m?.message || { conversation: m?.text || '' }
                    }
                }
            }, {})
        }
        
else if (replyVariant === 14) {
    const { AIRich } = require('hsnai')

    const rich = new AIRich(sock)

    rich.addText(text)

    if (options.image) {
        const images = Array.isArray(options.image) ? options.image : [options.image]
        rich.addImage(images.length === 1 ? images[0] : images, {
            resolveUrl: options.resolveUrl ?? false
        })
    }

    if (options.video) {
        rich.addVideo(options.video, { autoFill: options.autoFill ?? true })
    }

    // Link ditaruh sebagai codeblock terpisah per item — biar tiap link
    // punya tombol "Salin kode" sendiri, gak nyampur satu sama lain
    if (options.link) {
        const links = Array.isArray(options.link) ? options.link : [options.link]
        for (const l of links) {
            const linkUrl = typeof l === 'string' ? l : (l.url || '')
            const linkLabel = typeof l === 'string' ? '' : (l.title || '')
            if (linkLabel) rich.addText(`🔗 *${linkLabel}*`)
            rich.addCode('', linkUrl)
        }
    }

    if (options.table) {
        rich.addTable(options.table)
    }

    if (options.code) {
        rich.addCode(options.codeLang || 'javascript', options.code)
    }

    rich.setFooter(config.bot?.name || 'Hoshino Ai')

    return await rich.send(m.chat, { quoted: quotedMsg })
}

        else if (replyVariant === 15) {
            // V15: LINK PREVIEW ala "Rimuru MD" — faviconMMSMetadata + previewType 1
            const { prepareWAMessageMedia } = require('hsnai')
            const crypto = require('crypto')
            const linkV15 = config.saluran?.link || config.info?.website || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
            const thumbRawV15 = srtThumb || getCachedThumb('images/hsnai')

            const extContentV15 = {
                text: `${linkV15}\n${text}`,
                matchedText: linkV15,
                title: config.bot?.name || 'Hoshino Ai',
                description: `Hello ${m.pushName || 'Kamu'}`,
                previewType: 1,
                inviteLinkGroupTypeV2: 0,
                contextInfo: {
                    ...contextInfo,
                    forwardingScore: 127,
                    isForwarded: true,
                    ...(config.saluran?.id ? {
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: config.saluran.id,
                            serverMessageId: -1,
                            newsletterName: config.saluran?.name || config.bot?.name || 'Hoshino Ai'
                        }
                    } : {}),
                    forwardOrigin: 0
                }
            }

            if (thumbRawV15) {
                try {
                    // thumbnail kecil buat preview (256x256, sama kayak contoh)
                    extContentV15.jpegThumbnail = await sharp(thumbRawV15)
                        .resize(256, 256).jpeg({ quality: 80 }).toBuffer()

                    // favicon 512x512 di-upload, hasilnya jadi faviconMMSMetadata
                    const favBuf = await sharp(thumbRawV15)
                        .resize(512, 512).jpeg({ quality: 85 }).toBuffer()
                    const { imageMessage } = await prepareWAMessageMedia(
                        { image: favBuf },
                        { upload: sock.waUploadToServer, mediaTypeOverride: 'thumbnail-link' }
                    )
                    if (imageMessage?.directPath) {
                        extContentV15.faviconMMSMetadata = {
                            thumbnailDirectPath: imageMessage.directPath,
                            thumbnailSha256: imageMessage.fileSha256,
                            thumbnailEncSha256: imageMessage.fileEncSha256,
                            mediaKey: imageMessage.mediaKey,
                            mediaKeyTimestamp: imageMessage.mediaKeyTimestamp,
                            thumbnailHeight: 512,
                            thumbnailWidth: 512
                        }
                    }
                } catch (e) {
                    console.error('[V15] thumbnail/favicon gagal:', e.message)
                }
            }

            // quoted: fake contact (port dari ourin #11)
            const botNameV15 = config.bot?.name || 'Hoshino Ai'
            const senderNumV15 = (m.sender || '').split('@')[0]
            const fakeContactV15 = {
                key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast' },
                message: {
                    contactMessage: {
                        displayName: botNameV15,
                        vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botNameV15}\nTEL;type=CELL;type=VOICE;waid=${senderNumV15}:+${senderNumV15}\nEND:VCARD`
                    }
                }
            }

            const msgV15 = generateWAMessageFromContent(m.chat, {
                extendedTextMessage: extContentV15,
                messageContextInfo: { messageSecret: crypto.randomBytes(32) }
            }, { quoted: options.quoted !== false ? fakeContactV15 : undefined, userJid: sock.user?.jid || sock.user?.id })
            return sock.relayMessage(m.chat, msgV15.message, { messageId: msgV15.key.id })
        }
        else if (replyVariant === 16) {
            // V16: product card via AIRich. Renderer kartu produk TIDAK mau gambar dari CDN WA (mmg.whatsapp.net),
            // jadi pakai URL asli dari config.assets (sumber SRT), tanpa upload ke host luar.
            const { AIRich, prepareWAMessageMedia } = require('hsnai')
            const brandV16 = config.bot?.name || 'Hoshino Ai'
            const labelV16 = options.cardLabel || `[ ${brandV16} ]`

            const isHttpV16 = (v) => typeof v === 'string' && /^https?:\/\//i.test(v)
            const assetUrlV16 = (key) => {
                const u = hsAsset.url(key)
                return isHttpV16(u) ? u : null
            }
            // URL SRT: random dari hsAsset.shuffleList() (config.assets.shuffle + hasil .srt c), hanya kalau .srt on
            const srtUrlV16 = () => {
                try {
                    if (!db?.setting?.('srtEnabled')) return null
                    const list = hsAsset.shuffleList().filter(isHttpV16)
                    return list.length ? list[Math.floor(Math.random() * list.length)] : null
                } catch { return null }
            }
            // Fallback terakhir: upload buffer ke WA (kartu bisa tampil tanpa gambar)
            const waUrlV16 = async (buf) => {
                const jpg = await sharp(buf).resize(512, 512, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer()
                const { imageMessage } = await prepareWAMessageMedia(
                    { image: jpg },
                    { upload: sock.waUploadToServer, jid: '@newsletter' }
                )
                return imageMessage?.url || null
            }

            // Prioritas: options.thumbUrl > URL SRT > config.assets images/hsnai > upload WA > config.assets.replyV16
            let imgV16 = (isHttpV16(options.thumbUrl) && options.thumbUrl)
                || srtUrlV16()
                || assetUrlV16('images/hsnai')
                || null
            let srcV16 = imgV16 ? 'url' : null
            if (!imgV16) {
                try {
                    const raw = srtThumb || hsAsset.peek('images/hsnai') || await hsAsset.tryBuffer('images/hsnai')
                    if (raw) { imgV16 = await waUrlV16(raw); srcV16 = 'upload-wa' }
                } catch (e) {
                    console.error('[V16] upload gambar gagal:', e.message)
                }
            }
            if (!imgV16) { imgV16 = config.assets?.replyV16; srcV16 = 'replyV16' }
            console.log(`[V16] gambar (${srcV16}) ->`, String(imgV16).slice(0, 120))

            try {
                const rich = new AIRich(sock)

                rich.createAlert = () => ({ messageType: 2, messageText: labelV16 })
                rich.addProduct({
                    title: options.cardTitle || 'System Notification',
                    brand: brandV16,
                    price: options.cardPrice || 'Status',
                    sale_price: options.cardSale || 'Active',
                    product_url: config.info?.website || config.saluran?.link || 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06',
                    image: imgV16,
                    icon: imgV16
                })
                delete rich.createAlert

                rich.addText(text)

                return await rich.send(m.chat, { quoted: quotedMsg })
            } catch (e) {
                console.error('[V16] gagal kirim product card:', e.message)
                return sock.sendMessage(m.chat, {
                    text,
                    ...defaultOptions
                }, { quoted: quotedMsg })
            }
        }

        // V1: default plain text
        return sock.sendMessage(m.chat, {
            text,
            ...defaultOptions,
            ...options
        }, {
            quoted: quotedMsg
        });
    };

    m.replyWithMentions = async (text) => {
        const mentions = [...text.matchAll(/@(\d+)/g)].map(match => `${match[1]}@s.whatsapp.net`);
        return m.reply(text, { mentions });
    };

    m.replyImage = async (image, caption = '', options = {}) => {
        let buffer = image;
        if (typeof image === 'string' && image.startsWith('http')) {
            const axios = require('axios');
            const response = await axios.get(image, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data);
        }
        return sock.sendMessage(m.chat, {
            image: buffer,
            caption,
            contextInfo: options.contextInfo,
            mentions: options.mentions || []
        }, {
            quoted: options.quoted !== false ? msg : undefined
        });
    };

    m.replyVideo = async (video, caption = '', options = {}) => {
        let buffer = video;
        if (typeof video === 'string' && video.startsWith('http')) {
            const axios = require('axios');
            const response = await axios.get(video, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data);
        }
        return sock.sendMessage(m.chat, {
            video: buffer,
            caption,
            gifPlayback: options.gif || false,
            contextInfo: options.contextInfo,
            mentions: options.mentions || []
        }, {
            quoted: options.quoted !== false ? msg : undefined
        });
    };

    m.replyAudio = async (audio, ptt = false, options = {}) => {
        let buffer = audio;
        if (typeof audio === 'string' && audio.startsWith('http')) {
            const axios = require('axios');
            const response = await axios.get(audio, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data);
        }
        return sock.sendMessage(m.chat, {
            audio: buffer,
            ptt,
            mimetype: 'audio/mpeg'
        }, {
            quoted: options.quoted !== false ? msg : undefined
        });
    };

    m.replySticker = async (sticker, options = {}) => {
        let buffer = sticker;
        if (typeof sticker === 'string' && sticker.startsWith('http')) {
            const axios = require('axios');
            const response = await axios.get(sticker, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data);
        }
        return sock.sendMessage(m.chat, {
            sticker: buffer
        }, {
            quoted: options.quoted !== false ? msg : undefined
        });
    };

    m.replyDocument = async (document, fileName, mimetype = 'application/octet-stream', options = {}) => {
        let buffer = document;
        if (typeof document === 'string' && document.startsWith('http')) {
            const axios = require('axios');
            const response = await axios.get(document, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data);
        }
        return sock.sendMessage(m.chat, {
            document: buffer,
            fileName,
            mimetype,
            caption: options.caption || ''
        }, {
            quoted: options.quoted !== false ? msg : undefined
        });
    };

    m.replyContact = async (number, name, options = {}) => {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;type=VOICE;waid=${cleanNumber}:+${cleanNumber}\nEND:VCARD`;
        return sock.sendMessage(m.chat, {
            contacts: {
                displayName: name,
                contacts: [{ vcard }]
            }
        }, {
            quoted: options.quoted !== false ? msg : undefined
        });
    };

    m.replyLocation = async (latitude, longitude, options = {}) => {
        return sock.sendMessage(m.chat, {
            location: {
                degreesLatitude: latitude,
                degreesLongitude: longitude,
                name: options.name || '',
                address: options.address || ''
            }
        }, {
            quoted: options.quoted !== false ? msg : undefined
        });
    };

    m.replyWithQuote = async (text, fakeJid, fakeText, options = {}) => {
        const fakeMsg = {
            key: {
                fromMe: false,
                participant: fakeJid,
                remoteJid: m.chat
            },
            message: {
                conversation: fakeText
            },
            pushName: options.pushName || 'Bot'
        };
        return sock.sendMessage(m.chat, {
            text,
            contextInfo: {
                ...createContextInfo(fakeJid, fakeText, options.title, options.body, options.thumbnail),
                mentionedJid: options.mentions || []
            }
        }, {
            quoted: fakeMsg
        });
    };

    m.replyWithPreview = async (text, preview, options = {}) => {
        return sock.sendMessage(m.chat, {
            text,
            contextInfo: {
                externalAdReply: {
                    showAdAttribution: true,
                    title: preview.title || config.bot?.name || 'Ourin-AI',
                    body: preview.body || '',
                    mediaType: 1,
                    renderLargerThumbnail: true,
                    thumbnail: preview.thumbnail,
                    sourceUrl: preview.sourceUrl || ''
                },
                mentionedJid: options.mentions || []
            }
        }, {
            quoted: options.quoted !== false ? msg : undefined
        });
    };

    m.react = async (emoji) => {
        try {
            return await sock.sendMessage(m.chat, {
                react: {
                    text: emoji,
                    key: msg.key
                }
            });
        } catch (e) {
            return null;
        }
    };

    m.download = async (filename = null) => {
        if (!m.isMedia) return null;
        const stream = await downloadContentFromMessage(
            messageData[m.type],
            m.type.replace('Message', '')
        );
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        if (filename) {
            const tempDir = join(process.cwd(), 'storage', 'temp');
            if (!existsSync(tempDir)) {
                mkdirSync(tempDir, { recursive: true });
            }
            const filepath = join(tempDir, filename);
            writeFileSync(filepath, buffer);
            return filepath;
        }
        return buffer;
    };

    m.delete = async () => {
        return sock.sendMessage(m.chat, {
            delete: msg.key
        });
    };

    m.forward = async (jid, forceForward = false) => {
        return sock.sendMessage(jid, {
            forward: msg,
            force: forceForward
        });
    };

    m.copy = async (jid, options = {}) => {
        const content = {};
        if (m.isImage) {
            content.image = await m.download();
            content.caption = m.body;
        } else if (m.isVideo) {
            content.video = await m.download();
            content.caption = m.body;
        } else if (m.isAudio) {
            content.audio = await m.download();
        } else if (m.isSticker) {
            content.sticker = await m.download();
        } else if (m.isDocument) {
            content.document = await m.download();
            content.fileName = messageData[m.type]?.fileName || 'file';
            content.mimetype = messageData[m.type]?.mimetype;
        } else {
            content.text = m.body;
        }
        return sock.sendMessage(jid, content, options);
    };

    m.timestamp = msg.messageTimestamp;
    m.raw = msg;
    return m;
}

function getNumber(jid) {
    if (!jid) return '';
    return jid.replace(/@.+/g, '');
}

function createJid(number) {
    if (!number) return '';
    const cleaned = number.replace(/[^0-9]/g, '');
    return cleaned + '@s.whatsapp.net';
}

module.exports = {
    serialize,
    decodeJid,
    getMessageType,
    getMessageBody,
    parseCommand,
    serializeQuotedMessage,
    createContextInfo,
    getNumber,
    createJid,
    getCachedThumb,
    getCachedSharpThumb
};