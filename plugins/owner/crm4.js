/**
 * crm — CRM / Relay Inspector (port dari plugin Nixel)
 * Adaptasi untuk hsnai + CommonJS + SQLite store (sql.js)
 * 
 * Command: .crm (semua sub-command lewat argumen pertama)
 * Sub: .crm insp / adn / relay / lastchat
 */

const crypto = require('crypto');
const { proto } = require('hsnai');

const pluginConfig = {
    name: 'crm',
    alias: ['crm', 'insp', 'adn', 'relay', 'lastchat'],
    category: 'owner',
    description: 'CRM/Relay inspector — port dari plugin Nixel (v4)',
    usage: '.crm (reply pesan)',
    example: '.crm -snip',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
};

// ====== CONST ======
const ignoredTags = new Set([
    'device-identity', 'quality_control', 'enc', 'hsm', 'verified_name',
    'multicast', 'reporting', 'unavailable', 'rcat'
]);

const ignoredAttributes = new Set([
    'id', 'from', 'to', 'participant', 'recipient', 'type', 'sts',
    'verified_level', 'notify', 'addressing_mode', 'verified_name',
    'participant_pn', 't', 'count'
]);

const SECRET_CONTEXT = {
    EVENT_EDIT: 'Event Edit',
    MESSAGE_EDIT: 'Message Edit',
    POLL_EDIT: 'Poll Edit',
    POLL_ADD_OPTION: 'Poll Edit'
};

// ====== HELPERS ======
function stringify(obj) {
    return JSON.stringify(obj, (key, value) => {
        if (Buffer.isBuffer(value)) return value.toString('base64');
        if (value?.type === 'Buffer' && Array.isArray(value.data)) {
            return Buffer.from(value.data).toString('base64');
        }
        return value;
    }, 2);
}

function indentBlock(str, level = 1) {
    const pad = '  '.repeat(level);
    return str.split('\n').map((line, i) => (i === 0 ? line : pad + line)).join('\n');
}

function stringifySnippet(obj) {
    const raws = [];
    const json = JSON.stringify(obj, (key, value) => {
        if (key === 'unifiedResponse' && value && typeof value === 'object' && typeof value.data === 'string') {
            try {
                const decoded = Buffer.from(value.data, 'base64').toString('utf8');
                const parsed = JSON.parse(decoded);
                const id = raws.length;
                raws.push(`Buffer.from(JSON.stringify(${JSON.stringify(parsed, null, 2)})).toString('base64')`);
                return { data: `__RAW_${id}__` };
            } catch {}
        }
        if (key === 'buttonParamsJson' && typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                const id = raws.length;
                raws.push(`JSON.stringify(${JSON.stringify(parsed, null, 2)})`);
                return `__RAW_${id}__`;
            } catch {}
        }
        if (Buffer.isBuffer(value)) return value.toString('base64');
        if (value?.type === 'Buffer' && Array.isArray(value.data)) {
            return Buffer.from(value.data).toString('base64');
        }
        return value;
    }, 2);

    let code = json.replace(/^(\s*)"([^"]+)":/gm, (_, indent, key) => `${indent}${key}:`);
    code = code.split('\n').map((line) => {
        const match = line.match(/^(\s*).*"__RAW_(\d+)__"/);
        if (!match) return line;
        const [, indent, id] = match;
        const block = raws[Number(id)].split('\n').map((l, i) => (i === 0 ? l : indent + l)).join('\n');
        return line.replace(`"__RAW_${id}__"`, block);
    }).join('\n');
    return code;
}

function getNodeAttributes(node) {
    if (!node?.attrs || typeof node.attrs !== 'object' || Array.isArray(node.attrs)) return {};
    const attrs = { ...node.attrs };
    for (const key of ignoredAttributes) delete attrs[key];
    return attrs;
}

function getNodeContent(node) {
    if (!node || !Array.isArray(node.content)) return [];
    return node.content;
}

function filterAdditionalNodes(nodes) {
    return (nodes || []).filter((v) => !ignoredTags.has(v?.tag));
}

function getRelayOptions(node = null) {
    const additionalAttributes = getNodeAttributes(node);
    const additionalNodes = filterAdditionalNodes(getNodeContent(node));
    const options = {};
    if (Object.keys(additionalAttributes).length) options.additionalAttributes = additionalAttributes;
    if (additionalNodes.length) options.additionalNodes = additionalNodes;
    return options;
}

function loadBestNode(crmstore, messageId, chatId, msg) {
    if (!crmstore || !messageId) return null;

    let node = null;
    try { node = crmstore.loadNode(messageId, chatId); } catch {}
    if (node) return node;

    const alternativeChats = [
        chatId, msg?.key?.remoteJid, msg?.key?.remoteJidAlt,
        msg?.key?.participant, msg?.key?.participantAlt,
        msg?.key?.senderPn, msg?.key?.senderLid
    ].filter(Boolean);

    for (const jid of [...new Set(alternativeChats)]) {
        if (jid === chatId) continue;
        try { node = crmstore.loadNode(messageId, jid); } catch {}
        if (node) return node;
    }

    try { const raw = crmstore.loadNode(messageId); if (raw) return raw; } catch {}
    return null;
}

function normalizeMessage(rmsg, crmstore, chat) {
    const normalized = proto.WebMessageInfo.toObject(proto.WebMessageInfo.fromObject(rmsg), {
        enums: Number, longs: Number, bytes: String, defaults: false
    });
    return decryptSecretEnvelope(normalized, crmstore, chat);
}

function getSenderIdentity(key) {
    if (!key) return { me: false, jids: new Set() };
    if (key.fromMe) return { me: true, jids: new Set() };
    const jids = new Set([key.participant, key.participantAlt].filter(Boolean));
    if (!jids.size && key.remoteJid) jids.add(key.remoteJid);
    return { me: false, jids };
}

function serializeSender(sender) {
    if (!sender) return '';
    if (sender.me) return 'me';
    return [...sender.jids].sort().join(',');
}

function getParentKey(key, chat) {
    if (!key?.id) return null;
    return {
        id: key.id,
        remoteJid: key.remoteJid || chat,
        fromMe: !!key.fromMe,
        participant: key.participant,
        participantAlt: key.participantAlt
    };
}

function matchesParentKey(keyObj, parentKey, chat) {
    if (!keyObj || !parentKey) return false;
    if (!keyObj.id || keyObj.id !== parentKey.id) return false;
    const keyRemoteJid = keyObj.remoteJid || keyObj.remoteJidAlt;
    const parentRemoteJid = parentKey.remoteJid || chat;
    if (keyRemoteJid && parentRemoteJid && keyRemoteJid !== parentRemoteJid) return false;
    return true;
}

function collectDeepKeys(node, depth = 0, maxDepth = 12, out = []) {
    if (!node || typeof node !== 'object' || depth > maxDepth) return out;
    if (node.protocolMessage?.key) out.push(node.protocolMessage.key);
    if (node.secretEncryptedMessage?.targetMessageKey) out.push(node.secretEncryptedMessage.targetMessageKey);
    for (const value of Object.values(node)) {
        if (value && typeof value === 'object') collectDeepKeys(value, depth + 1, maxDepth, out);
    }
    return out;
}

function collectProtocolKeys(node, depth = 0, maxDepth = 12, out = []) {
    if (!node || typeof node !== 'object' || depth > maxDepth) return out;
    if (node.protocolMessage?.key) out.push(node.protocolMessage.key);
    for (const value of Object.values(node)) {
        if (value && typeof value === 'object') collectProtocolKeys(value, depth + 1, maxDepth, out);
    }
    return out;
}

function collectSecretMessages(node, depth = 0, maxDepth = 12, out = []) {
    if (!node || typeof node !== 'object' || depth > maxDepth) return out;
    if (node.secretEncryptedMessage) out.push(node.secretEncryptedMessage);
    for (const value of Object.values(node)) {
        if (value && typeof value === 'object') collectSecretMessages(value, depth + 1, maxDepth, out);
    }
    return out;
}

function findMessageSecret(node, depth = 0, maxDepth = 12) {
    if (!node || typeof node !== 'object' || depth > maxDepth) return null;
    if (node.messageContextInfo?.messageSecret) return node.messageContextInfo.messageSecret;
    for (const value of Object.values(node)) {
        if (value && typeof value === 'object') {
            const found = findMessageSecret(value, depth + 1, maxDepth);
            if (found) return found;
        }
    }
    return null;
}

function secretEncTypeName(value) {
    if (typeof value === 'string') return value;
    try { return proto.Message.SecretEncryptedMessage.SecretEncType[value] ?? value; } catch { return value; }
}

function getSecretContext(type) {
    return SECRET_CONTEXT[type] || null;
}

function loadTargetSecret(crmstore, chat, targetKey) {
    try {
        const row = crmstore.loadMessage(targetKey.id, chat);
        if (!row) return null;
        const normalized = proto.WebMessageInfo.toObject(proto.WebMessageInfo.fromObject(row), {
            enums: Number, longs: Number, bytes: String, defaults: false
        });
        const secretB64 = findMessageSecret(normalized.message);
        if (!secretB64) return null;
        const key = normalized.key || {};
        const senderJid = key.participant || targetKey.participant || key.remoteJid || targetKey.remoteJid;
        if (!senderJid) return null;
        return { messageSecret: Buffer.from(secretB64, 'base64'), senderJid };
    } catch { return null; }
}

function decryptSecretMessage(secretMsg, target, type) {
    try {
        const targetId = secretMsg?.targetMessageKey?.id;
        if (!targetId || !secretMsg?.encPayload || !secretMsg?.encIv || !target?.messageSecret) return null;
        const context = getSecretContext(type);
        if (!context) return null;
        const messageSecret = target.messageSecret;
        if (messageSecret.length !== 32) return null;
        const senderJid = target.senderJid;
        const info = Buffer.concat([
            Buffer.from(targetId, 'utf8'),
            Buffer.from(senderJid, 'utf8'),
            Buffer.from(senderJid, 'utf8'),
            Buffer.from(context, 'utf8')
        ]);
        const key = crypto.hkdfSync('sha256', messageSecret, Buffer.alloc(0), info, 32);
        const encPayload = Buffer.from(secretMsg.encPayload, 'base64');
        const encIv = Buffer.from(secretMsg.encIv, 'base64');
        if (encIv.length !== 12 || encPayload.length < 16) return null;
        const authTag = encPayload.subarray(-16);
        const ciphertext = encPayload.subarray(0, -16);
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key), encIv);
        decipher.setAuthTag(authTag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        const decoded = proto.Message.decode(plaintext);
        return proto.Message.toObject(decoded, { enums: Number, longs: Number, bytes: String, defaults: false });
    } catch { return null; }
}

async function decryptSecretEnvelope(msg, crmstore, chat) {
    const secret = msg?.message?.secretEncryptedMessage;
    if (!secret) return msg;
    const type = secretEncTypeName(secret.secretEncType);
    if (!['MESSAGE_EDIT', 'EVENT_EDIT', 'POLL_EDIT', 'POLL_ADD_OPTION'].includes(type)) return msg;
    const targetKey = secret.targetMessageKey;
    if (!targetKey?.id) return msg;
    const target = loadTargetSecret(crmstore, chat, targetKey);
    if (!target) return msg;
    const decrypted = decryptSecretMessage(secret, target, type);
    if (!decrypted) return msg;
    return { ...msg, message: decrypted };
}

function sameSecretEnvelope(a, b) {
    return a?.targetMessageKey?.id === b?.targetMessageKey?.id &&
        a?.encPayload === b?.encPayload &&
        a?.encIv === b?.encIv &&
        a?.secretEncType === b?.secretEncType;
}

function replaceSecretEnvelope(node, targetSecret, decrypted) {
    if (!node || typeof node !== 'object') return node;
    if (node.secretEncryptedMessage === targetSecret) return decrypted;
    if (node.secretEncryptedMessage && sameSecretEnvelope(node.secretEncryptedMessage, targetSecret)) return decrypted;
    if (Array.isArray(node)) return node.map((v) => replaceSecretEnvelope(v, targetSecret, decrypted));
    const out = { ...node };
    for (const [key, value] of Object.entries(out)) {
        if (value && typeof value === 'object') out[key] = replaceSecretEnvelope(value, targetSecret, decrypted);
    }
    return out;
}

async function decryptChildMessage(crmstore, chat, msgObj) {
    const secrets = collectSecretMessages(msgObj);
    if (!secrets.length) return { message: msgObj, fails: 0 };
    let current = msgObj;
    let fails = 0;
    for (const secretMsg of secrets) {
        const targetKey = secretMsg?.targetMessageKey;
        if (!targetKey?.id) { fails++; continue; }
        const target = loadTargetSecret(crmstore, chat, targetKey);
        if (!target) { fails++; continue; }
        const type = secretEncTypeName(secretMsg.secretEncType);
        const decrypted = decryptSecretMessage(secretMsg, target, type);
        if (!decrypted) { fails++; continue; }
        current = replaceSecretEnvelope(current, secretMsg, decrypted);
    }
    return { message: current, fails };
}

async function findDirectChildren(crmstore, chat, parentId, parentSender, radius = 50, useProto = true) {
    const base = crmstore.db.prepare(
        `SELECT timestamp, data FROM messages WHERE id = ? AND chat = ? LIMIT 1`
    ).get(parentId, chat);
    if (!base) return [];

    let parentMessage;
    try {
        parentMessage = proto.WebMessageInfo.toObject(proto.WebMessageInfo.decode(base.data), {
            enums: Number, longs: Number, bytes: String, defaults: false
        });
    } catch { return []; }

    const parentKey = getParentKey(parentMessage.key, chat);
    if (!parentKey) return [];

    const older = crmstore.db.prepare(
        `SELECT id, data FROM messages WHERE chat = ? AND timestamp <= ? ORDER BY timestamp DESC LIMIT ?`
    ).all(chat, base.timestamp, radius);

    const newer = crmstore.db.prepare(
        `SELECT id, data FROM messages WHERE chat = ? AND timestamp > ? ORDER BY timestamp ASC LIMIT ?`
    ).all(chat, base.timestamp, radius);

    const children = [];
    for (const row of [...older, ...newer]) {
        if (row.id === parentId) continue;
        let decoded;
        try {
            decoded = proto.WebMessageInfo.toObject(proto.WebMessageInfo.decode(row.data), {
                enums: Number, longs: Number, bytes: String, defaults: false
            });
        } catch { continue; }

        const assocKey = decoded?.message?.messageContextInfo?.messageAssociation?.parentMessageKey;
        const matchedAssoc = matchesParentKey(assocKey, parentKey, chat);
        const matchedDeep = useProto
            ? collectDeepKeys(decoded?.message).some((key) => matchesParentKey(key, parentKey, chat))
            : false;

        if (!matchedAssoc && !matchedDeep) continue;
        children.push(decoded);
    }
    return children;
}

function unwrapAssociatedChild(msg) {
    const contextInfo = msg?.message?.messageContextInfo;
    const inner = msg?.message?.associatedChildMessage?.message;
    if (!inner) return msg;
    return {
        ...msg,
        message: { ...inner, messageContextInfo: contextInfo }
    };
}

async function buildChildTree(crmstore, chat, parentId, parentSender, radius = 50, depth = 0, maxDepth = 5, visited = new Set(), useProto = true, stats = { fails: 0 }) {
    if (depth >= maxDepth) return [];
    const visitKey = `${chat}:${parentId}:${serializeSender(parentSender)}`;
    if (visited.has(visitKey)) return [];
    visited.add(visitKey);

    const rawChildren = await findDirectChildren(crmstore, chat, parentId, parentSender, radius, useProto);
    const result = [];

    for (const rawChild of rawChildren) {
        const normalized = await normalizeMessage(rawChild, crmstore, chat);
        const decrypted = await decryptChildMessage(crmstore, chat, normalized.message);
        stats.fails += decrypted.fails;
        const finalRaw = { ...normalized, message: decrypted.message };
        const msg = unwrapAssociatedChild(finalRaw);
        if (!msg?.key?.id || !msg?.message) continue;

        const childId = msg.key.id;
        const childSender = getSenderIdentity(msg.key);
        const childNode = loadBestNode(crmstore, childId, chat, msg);
        const relayOptions = getRelayOptions(childNode);
        const children = await buildChildTree(crmstore, chat, childId, childSender, radius, depth + 1, maxDepth, visited, useProto, stats);

        result.push({ raw: finalRaw, node: childNode, msg, relayOptions, children });
    }
    return result;
}

async function relayChildTree(sock, chat, nodes, parentId) {
    for (const node of nodes) {
        const message = JSON.parse(JSON.stringify(node.msg.message));
        const assoc = message?.messageContextInfo?.messageAssociation;
        if (assoc?.parentMessageKey) {
            assoc.parentMessageKey.id = parentId;
            assoc.parentMessageKey.remoteJid = chat;
            assoc.parentMessageKey.fromMe = true;
        }
        const protocolKeys = collectProtocolKeys(message);
        for (const key of protocolKeys) {
            key.id = parentId;
            key.remoteJid = chat;
            key.fromMe = true;
        }
        const options = { ...node.relayOptions };
        const newChildId = await sock.relayMessage(chat, message, options);
        await relayChildTree(sock, chat, node.children, newChildId);
    }
}

function countTree(nodes) {
    return nodes.reduce((sum, node) => sum + 1 + countTree(node.children), 0);
}

function attachChildren(base, tree) {
    if (!tree.length) return base;
    return {
        ...base,
        __children: tree.map((node) => {
            const child = attachChildren(node.raw, node.children);
            if (node.node) return { ...child, __node: node.node };
            return child;
        })
    };
}

// --- Relay script builders ---
function findBlockEnd(str, openIndex) {
    let depth = 0;
    for (let i = openIndex; i < str.length; i++) {
        if (str[i] === '{') depth++;
        if (str[i] === '}') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

function injectKeyBlock(snippet, marker, parentIdExpr) {
    const start = snippet.indexOf(marker);
    if (start === -1) return snippet;
    const braceIndex = start + marker.length - 1;
    const end = findBlockEnd(snippet, braceIndex);
    if (end === -1) return snippet;
    const indentMatch = snippet.slice(0, start).match(/([ \t]*)$/);
    const indent = indentMatch ? indentMatch[1] : '';
    const replacement = `${marker.slice(0, -1)}{
${indent}  remoteJid: m.chat,
${indent}  fromMe: true,
${indent}  id: ${parentIdExpr}
${indent}}`;
    return snippet.slice(0, start) + replacement + snippet.slice(end + 1);
}

function injectParentKey(childSnippet, parentIdExpr = 'newParentId') {
    return injectKeyBlock(childSnippet, 'parentMessageKey: {', parentIdExpr);
}

function injectTargetKey(childSnippet, parentIdExpr = 'newParentId') {
    return injectKeyBlock(childSnippet, 'targetMessageKey: {', parentIdExpr);
}

function injectProtocolKey(childSnippet, parentIdExpr = 'newParentId') {
    const marker = 'protocolMessage: {';
    const start = childSnippet.indexOf(marker);
    if (start === -1) return childSnippet;
    const braceIndex = start + marker.length - 1;
    const blockEnd = findBlockEnd(childSnippet, braceIndex);
    if (blockEnd === -1) return childSnippet;
    const before = childSnippet.slice(0, start);
    const block = childSnippet.slice(start, blockEnd + 1);
    const after = childSnippet.slice(blockEnd + 1);
    const patchedBlock = injectKeyBlock(block, 'key: {', parentIdExpr);
    return before + patchedBlock + after;
}

function buildChildScript(nodes, parentVar, path = []) {
    const blocks = [];
    nodes.forEach((node, i) => {
        const varName = `id_${[...path, i].join('_')}`;
        const rawChildSnippet = stringifySnippet(node.msg.message);
        let childSnippet = injectParentKey(rawChildSnippet, parentVar);
        childSnippet = injectProtocolKey(childSnippet, parentVar);
        childSnippet = injectTargetKey(childSnippet, parentVar);
        const childOptions = stringifySnippet(node.relayOptions);
        blocks.push(`const ${varName} = await sock.relayMessage(
  m.chat,
  ${indentBlock(childSnippet)},
  ${indentBlock(childOptions)}
);`);
        if (node.children.length) {
            blocks.push(...buildChildScript(node.children, varName, [...path, i]));
        }
    });
    return blocks;
}

function buildRelayScript(snippetMessage, options, childTree) {
    if (!childTree.length) {
        return `await sock.relayMessage(
  m.chat,
  ${indentBlock(snippetMessage)},
  ${indentBlock(options)}
);`;
    }
    const parentBlock = `const newParentId = await sock.relayMessage(
  m.chat,
  ${indentBlock(snippetMessage)},
  ${indentBlock(options)}
);`;
    const childBlocks = buildChildScript(childTree, 'newParentId');
    return [parentBlock, ...childBlocks, 'return newParentId;'].join('\n\n');
}

// --- lastchat helpers ---
function getTimestampFromMessage(message) {
    if (!message) return 0;
    if (typeof message.messageTimestamp === 'number') return message.messageTimestamp;
    if (typeof message.messageTimestamp === 'object' && message.messageTimestamp !== null) {
        return Number(message.messageTimestamp.low ?? message.messageTimestamp);
    }
    return 0;
}

function getReferenceMessage(m, crmstore) {
    const chat = m.quoted?.chat || m.chat;
    const messageId = m.quoted?.id;
    if (messageId) {
        const row = crmstore.db.prepare(
            `SELECT timestamp FROM messages WHERE id = ? AND chat = ? LIMIT 1`
        ).get(messageId, chat);
        if (row) return { chat, timestamp: Number(row.timestamp) || 0 };
    }
    return { chat, timestamp: getTimestampFromMessage(m) || Math.floor(Date.now() / 1000) };
}

function getLastChatRows(crmstore, m, limit) {
    const reference = getReferenceMessage(m, crmstore);
    if (!reference.timestamp) return [];
    return crmstore.db.prepare(
        `SELECT rowid, id, chat, sender, timestamp, data FROM messages
         WHERE chat = ? AND timestamp <= ?
         ORDER BY timestamp DESC, rowid DESC LIMIT ?`
    ).all(reference.chat, reference.timestamp, limit).reverse();
}

function getMessageType(message) {
    if (!message) return '-';
    return Object.keys(message).find((v) => !['messageContextInfo', 'senderKeyDistributionMessage'].includes(v)) || '-';
}

function getPreviewText(message) {
    if (!message) return '-';
    if (typeof message.conversation === 'string') return message.conversation;
    if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
    if (message.imageMessage) return message.imageMessage.caption ? `📷 ${message.imageMessage.caption}` : '📷 Image';
    if (message.videoMessage) return message.videoMessage.caption ? `🎥 ${message.videoMessage.caption}` : '🎥 Video';
    if (message.audioMessage) return '🎵 Audio';
    if (message.stickerMessage) return '🎨 Sticker';
    if (message.documentMessage) return message.documentMessage.fileName || '📄 Document';
    if (message.reactionMessage) return `💬 Reaction ${message.reactionMessage.text || ''}`.trim();
    if (message.protocolMessage) {
        const type = message.protocolMessage.type;
        if (type === proto.Message.ProtocolMessage.Type.REVOKE) return '🗑️ Revoke';
        if (type === proto.Message.ProtocolMessage.Type.MESSAGE_EDIT) return '✏️ Edit';
        return `⚙️ Protocol ${type}`;
    }
    if (message.secretEncryptedMessage) return '🔐 SecretEncryptedMessage';
    return getMessageType(message);
}

function getDisplaySender(message, row) {
    const key = message?.key || {};
    if (key.fromMe) return 'Me';
    return key.participantAlt || key.participant || row?.sender || key.remoteJid || 'Unknown';
}

function formatTimestamp(timestamp) {
    if (!timestamp) return '--:--:--';
    const date = new Date(Number(timestamp) * 1000);
    if (Number.isNaN(date.getTime())) return '--:--:--';
    return new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, timeZone: 'Asia/Jakarta'
    }).format(date);
}

function formatLastChat(rows) {
    const lines = [`╭─〔 LAST CHAT • ${rows.length} PESAN 〕`, '│'];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let message;
        try {
            message = proto.WebMessageInfo.toObject(proto.WebMessageInfo.decode(row.data), {
                enums: Number, longs: Number, bytes: String, defaults: false
            });
        } catch { message = null; }
        const type = getMessageType(message?.message);
        const sender = getDisplaySender(message, row);
        const preview = getPreviewText(message?.message);
        lines.push(`│ ${String(i + 1).padStart(2, '0')}  ${formatTimestamp(row.timestamp)}  ${sender}`);
        lines.push(`│     ${type} • #${row.rowid}`);
        lines.push(`│     ${String(preview).replace(/\n/g, ' ').slice(0, 180)}`);
        if (i !== rows.length - 1) lines.push('│');
    }
    lines.push('│');
    lines.push(`╰─ ${rows[0]?.chat || '-'}`);
    return lines.join('\n');
}

// ====== MAIN HANDLER ======
async function handler(m, { sock, config: botConfig, db, text = '', command }) {
    const crmstore = sock?.store;

    if (!crmstore || !crmstore.db) {
        return m.reply(
            '❌ *crmstore tidak tersedia*\n\n' +
            'Plugin ini butuh store Baileys yang punya `.db` (SQLite) dan `.loadNode()`.\n\n' +
            'Cek log startup bot lu — pastikan `[store] SQLite store siap` muncul.'
        );
    }

    const args = String(text || '').trim().split(/\s+/).filter(Boolean);

    // ===== Sub: lastchat =====
    if (command === 'lastchat4' || args[0] === 'lastchat') {
        const parsed = Number(args[0] === 'lastchat' ? (args[1] || 10) : (args[0] || 10));
        const limit = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 10, 1), 100);
        const rows = getLastChatRows(crmstore, m, limit);
        if (!rows.length) return m.reply('Tidak ada pesan yang ditemukan.');
        return m.reply(formatLastChat(rows));
    }

    // ===== Parse rowid =====
    const rowMatch = args[0]?.match(/^#(\d+)$/);
    const rowid = rowMatch ? Number(rowMatch[1]) : null;

    let chatId, targetId, msgSource, rmsg;

    if (rowid !== null) {
        const row = crmstore.db.prepare(
            `SELECT rowid, id, chat, sender, timestamp, data FROM messages WHERE rowid = ? LIMIT 1`
        ).get(rowid);
        if (!row) return m.reply(`Message dengan rowid #${rowid} tidak ditemukan.`);
        try {
            rmsg = proto.WebMessageInfo.toObject(proto.WebMessageInfo.decode(row.data), {
                enums: Number, longs: Number, bytes: String, defaults: false
            });
        } catch (e) {
            return m.reply(`Gagal decode rowid #${rowid}:\n${e.message}`);
        }
        chatId = row.chat;
        targetId = row.id;
        msgSource = `rowid:${rowid}`;
    } else {
        if (!m.quoted) return m.reply(buildUsage(command));
        chatId = m.quoted.chat || m.chat;
        targetId = m.quoted.id;

        const sources = [
            { type: 'crmstore', data: crmstore.loadMessage(targetId, chatId) },
            { type: 'quotedObj', data: await m.getQuotedObj?.() },
            { type: 'fakeObj', data: m.quoted?.fakeObj }
        ];
        const source = sources.find((v) => v.data?.message || v.data?.key);
        msgSource = source?.type;
        rmsg = source?.data;
    }

    let msg;
    if (rmsg) msg = await normalizeMessage(rmsg, crmstore, chatId);
    if (!msg?.message) return m.reply(`⛓️‍💥 Message tidak valid (${typeof msg?.message})`);

    const messageId = msg.key?.id || targetId;
    const rawNode = loadBestNode(crmstore, messageId, chatId, msg);
    const nodeAttrs = getNodeAttributes(rawNode);
    const nodeContent = getNodeContent(rawNode);
    const type = Object.keys(msg.message).find(
        (v) => !['messageContextInfo', 'senderKeyDistributionMessage'].includes(v)
    ) || 'unknown';

    const additionalNodes = filterAdditionalNodes(nodeContent);
    const relayOptions = getRelayOptions(rawNode);
    const parentSender = getSenderIdentity(msg.key);

    const noChild = text.includes('-nochild');
    const noProto = text.includes('-noproto');
    const stats = { fails: 0 };

    const childTree = noChild
        ? []
        : await buildChildTree(crmstore, chatId, messageId, parentSender, 50, 0, 5, new Set(), !noProto, stats);

    // ===== Sub: relay =====
    if (command === 'relay4' || args[0] === 'relay') {
        const newParentId = await sock.relayMessage(m.chat, JSON.parse(JSON.stringify(msg.message)), relayOptions);
        await relayChildTree(sock, m.chat, childTree, newParentId);
        return m.reply(`✅ Relayed. New ID: \`${newParentId}\``);
    }

    const rawPayload = {
        message: msg,
        node: rawNode,
        additionalAttributes: nodeAttrs,
        additionalNodes
    };

    const raw = stringify(rawPayload);
    const message = stringify(msg.message);
    const key = stringify(msg.key);
    const options = stringifySnippet(relayOptions);
    const participant = msg.key?.remoteJid || msg.key?.participant || msg.key?.participantAlt || '-';
    const msgId = msg.key?.id || targetId || '-';
    const snippetMessage = stringifySnippet(msg.message);
    const relayCode = buildRelayScript(snippetMessage, stringifySnippet(relayOptions), childTree);

    const files = { raw, message, relay: relayCode };

    // ===== Export flags =====
    const exportType = ['raw', 'message', 'relay'].find((v) => text.includes(`-${v}`));
    if (exportType) {
        if (text.includes('-file')) {
            return sock.sendMessage(m.chat, {
                document: Buffer.from(files[exportType]),
                fileName: exportType === 'relay' ? `${type}.js` : `${exportType}.json`,
                mimetype: exportType === 'relay' ? 'application/javascript' : 'application/json'
            }, { quoted: m });
        }
        return m.reply(files[exportType]);
    }

    const isSnip = text.includes('-snip');
    const formatChat = (chat) => {
        if (!chat) return '-';
        return isSnip ? `${chat.slice(0, 7)}.....${chat.split('@')[1] || ''}` : chat;
    };
    const formatId = (id) => {
        if (!id) return '-';
        return isSnip ? `${id.slice(0, 7)}.....` : id;
    };

    const childrenCount = countTree(childTree);
    const childrenLine = stats.fails ? `${childrenCount} (${stats.fails} fail)` : `${childrenCount}`;
    const sender = msg.key?.participant || msg.key?.participantAlt || msg.key?.remoteJid || m.quoted?.sender || '-';
    const nodeChat = rawNode?.attrs?.from || rawNode?.attrs?.to || rawNode?.attrs?.recipient || '-';

    const metadata = `• Type     : ${type}
• Source   : ${msgSource || '-'}
• Chat     : ${formatChat(chatId)}
• Node Chat: ${formatChat(nodeChat)}
• ID       : ${formatId(messageId)}
• Node ID  : ${formatId(rawNode?.attrs?.id || '-')}
• Sender   : ${sender.split('@')[0]}
• Node Tag : ${rawNode?.tag || '-'}
• Attrs    : ${Object.keys(nodeAttrs).length}
• Children : ${childrenLine}`;

    // ===== Sub: insp =====
    if (command === 'insp4' || args[0] === 'insp') {
        const inspPayload = attachChildren(rawPayload, childTree);
        if (isSnip) {
            const imsg = stringify(inspPayload);
            if (imsg.length > 20000) {
                await m.react('❌');
                return m.reply('Payload terlalu besar untuk snip.');
            }
            return m.reply(`# 📥️ Raw Snippet\n\n${metadata}\n\n\`\`\`javascript\n${imsg}\n\`\`\``);
        }
        return sock.sendMessage(m.chat, {
            document: Buffer.from(stringify(inspPayload)),
            fileName: `${type}.json`,
            mimetype: 'application/json',
            caption: metadata
        }, { quoted: m });
    }

    // ===== Sub: adn =====
    const adn = text.includes('-nofilter') ? additionalNodes : filterAdditionalNodes(additionalNodes);
    if ((command === 'adn4' || args[0] === 'adn') && !adn.length) {
        return m.reply('No AdditionalNodes captured 📷');
    }
    if (command === 'adn4' || args[0] === 'adn') {
        if (isSnip) {
            return m.reply(`# 📸 AdditionalNode Captured\n\n${metadata}\n\n\`\`\`javascript\n${stringifySnippet(adn)}\n\`\`\``);
        }
        return sock.sendMessage(m.chat, {
            document: Buffer.from(stringify(adn)),
            fileName: 'additionalNodes.json',
            mimetype: 'application/json'
        }, { quoted: m });
    }

    // ===== Default: crm (kirim relay.js) =====
    if (isSnip) {
        if (relayCode.length > 20000) {
            await m.react('❌');
            return m.reply('Payload terlalu besar untuk snip.');
        }
        return m.reply(`# ⚡ Relay Snippet\n\n${metadata}\n\n\`\`\`javascript\n${relayCode}\n\`\`\``);
    }

    return sock.sendMessage(m.chat, {
        document: Buffer.from(relayCode),
        fileName: `${type}.js`,
        mimetype: 'application/javascript',
        caption: metadata
    }, { quoted: m });
}

function buildUsage(command) {
    return `📌 *.${command}* butuh pesan yang di-reply.

*Sub-command (argumen pertama):*
• .crm → Generate file relay
• .crm #rowid → Generate dari SQLite rowid
• .crm insp → Raw payload JSON
• .crm adn → Ambil AdditionalNodes
• .crm relay → Relay ulang pesan + child
• .crm lastchat [n] → Pesan terakhir

*Flag opsional:*
• -raw → Export raw JSON
• -message → Export message saja
• -relay → Export kode relay
• -file → Kirim sebagai dokumen
• -snip → Tampilkan sebagai snippet
• -nofilter → Jangan filter AdditionalNodes
• -nochild → Matikan pencarian child
• -noproto → Skip deep search protocolMessage

Contoh:
.crm
.crm #4825
.crm #4825 -snip
.crm insp -raw -file
.crm lastchat 20`;
}

module.exports = {
    config: pluginConfig,
    handler
};