"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferDevice = exports.isJidBot = exports.jidNormalizedUser = exports.isHostedLidUser = exports.isHostedPnUser = exports.isJidNewsletter = exports.isJidNewsLetter = exports.isJidStatusBroadcast = exports.isJidGroup = exports.isJidBroadcast = exports.isLidUser = exports.isPnUser = exports.isJidMetaAI = exports.isJidUser = exports.areJidsSameUser = exports.jidDecode = exports.getServerFromDomainType = exports.WAJIDDomains = exports.jidEncode = exports.META_AI_JID = exports.STORIES_JID = exports.PSA_WID = exports.SERVER_JID = exports.OFFICIAL_BIZ_JID = exports.S_WHATSAPP_NET = void 0;
exports.S_WHATSAPP_NET = '@s.whatsapp.net';
exports.OFFICIAL_BIZ_JID = '16505361212@c.us';
exports.SERVER_JID = 'server@c.us';
exports.PSA_WID = '0@c.us';
exports.STORIES_JID = 'status@broadcast';
// Meta AI JID + LID/hosted domain-type helpers
exports.META_AI_JID = '13135550002@c.us';
var WAJIDDomains;
(function (WAJIDDomains) {
    WAJIDDomains[WAJIDDomains["WHATSAPP"] = 0] = "WHATSAPP";
    WAJIDDomains[WAJIDDomains["LID"] = 1] = "LID";
    WAJIDDomains[WAJIDDomains["HOSTED"] = 128] = "HOSTED";
    WAJIDDomains[WAJIDDomains["HOSTED_LID"] = 129] = "HOSTED_LID";
})(WAJIDDomains || (exports.WAJIDDomains = WAJIDDomains = {}));
const getServerFromDomainType = (initialServer, domainType) => {
    switch (domainType) {
        case WAJIDDomains.LID:
            return 'lid';
        case WAJIDDomains.HOSTED:
            return 'hosted';
        case WAJIDDomains.HOSTED_LID:
            return 'hosted.lid';
        case WAJIDDomains.WHATSAPP:
        default:
            return initialServer;
    }
};
exports.getServerFromDomainType = getServerFromDomainType;
const jidEncode = (user, server, device, agent) => {
    return `${user || ''}${!!agent ? `_${agent}` : ''}${!!device ? `:${device}` : ''}@${server}`;
};
exports.jidEncode = jidEncode;
const jidDecode = (jid) => {
    const sepIdx = typeof jid === 'string' ? jid.indexOf('@') : -1;
    if (sepIdx < 0) {
        return undefined;
    }
    const server = jid.slice(sepIdx + 1);
    const userCombined = jid.slice(0, sepIdx);
    const [userAgent, device] = userCombined.split(':');
    const user = userAgent.split('_')[0];
    return {
        server,
        user,
        domainType: server === 'lid' ? 1 : 0,
        device: device ? +device : undefined
    };
};
exports.jidDecode = jidDecode;
/** is the jid a user */
const areJidsSameUser = (jid1, jid2) => {
    var _a, _b;
    return (((_a = (0, exports.jidDecode)(jid1)) === null || _a === void 0 ? void 0 : _a.user) === ((_b = (0, exports.jidDecode)(jid2)) === null || _b === void 0 ? void 0 : _b.user));
};
exports.areJidsSameUser = areJidsSameUser;
/** is the jid a user */
const isJidUser = (jid) => (jid === null || jid === void 0 ? void 0 : jid.endsWith('@s.whatsapp.net'));
exports.isJidUser = isJidUser;
/** is the jid a group */
const isLidUser = (jid) => (jid === null || jid === void 0 ? void 0 : jid.endsWith('@lid'));
exports.isLidUser = isLidUser;
/** is the jid a broadcast */
const isJidBroadcast = (jid) => (jid === null || jid === void 0 ? void 0 : jid.endsWith('@broadcast'));
exports.isJidBroadcast = isJidBroadcast;
/** is the jid a group */
const isJidGroup = (jid) => (jid === null || jid === void 0 ? void 0 : jid.endsWith('@g.us'));
exports.isJidGroup = isJidGroup;
/** is the jid the status broadcast */
const isJidStatusBroadcast = (jid) => jid === 'status@broadcast';
exports.isJidStatusBroadcast = isJidStatusBroadcast;
/** is the jid the newsletter */
const isJidNewsLetter = (jid) => (jid === null || jid === void 0 ? void 0 : jid.endsWith('newsletter'));
exports.isJidNewsLetter = isJidNewsLetter;
// LID/hosted/bot/Meta-AI jid helpers
/** is the jid Meta AI */
const isJidMetaAI = (jid) => jid === null || jid === void 0 ? void 0 : jid.endsWith('@bot');
exports.isJidMetaAI = isJidMetaAI;
/** is the jid a PN (phone-number) user */
const isPnUser = (jid) => jid === null || jid === void 0 ? void 0 : jid.endsWith('@s.whatsapp.net');
exports.isPnUser = isPnUser;
/** is the jid a newsletter (correct spelling, alias of isJidNewsLetter) */
const isJidNewsletter = (jid) => jid === null || jid === void 0 ? void 0 : jid.endsWith('@newsletter');
exports.isJidNewsletter = isJidNewsletter;
/** is the jid a hosted PN */
const isHostedPnUser = (jid) => jid === null || jid === void 0 ? void 0 : jid.endsWith('@hosted');
exports.isHostedPnUser = isHostedPnUser;
/** is the jid a hosted LID */
const isHostedLidUser = (jid) => jid === null || jid === void 0 ? void 0 : jid.endsWith('@hosted.lid');
exports.isHostedLidUser = isHostedLidUser;
const botRegexp = /^1313555\d{4}$|^131655500\d{2}$/;
/** is the jid the WA bot/AI account */
const isJidBot = (jid) => jid && botRegexp.test(jid.split('@')[0]) && jid.endsWith('@c.us');
exports.isJidBot = isJidBot;
const jidNormalizedUser = (jid) => {
    const result = (0, exports.jidDecode)(jid);
    if (!result) {
        return '';
    }
    const { user, server } = result;
    return (0, exports.jidEncode)(user, server === 'c.us' ? 's.whatsapp.net' : server);
};
exports.jidNormalizedUser = jidNormalizedUser;
/** move the device id from one jid onto another jid's user/server */
const transferDevice = (fromJid, toJid) => {
    var _a;
    const fromDecoded = (0, exports.jidDecode)(fromJid);
    const deviceId = (fromDecoded === null || fromDecoded === void 0 ? void 0 : fromDecoded.device) || 0;
    const { server, user } = (0, exports.jidDecode)(toJid);
    return (0, exports.jidEncode)(user, server, deviceId);
};
exports.transferDevice = transferDevice;
