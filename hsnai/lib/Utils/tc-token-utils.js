"use strict";
// lib/Utils/tc-token-utils.js
// Attaches a saved "tctoken" node (trust/consent token) to outgoing 1:1
// stanzas when we have one on file for that contact.
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTcTokenFromJid = void 0;
async function buildTcTokenFromJid({ authState, jid, baseContent = [] }) {
    try {
        const tcTokenData = await authState.keys.get('tctoken', [jid]);
        const tcTokenBuffer = tcTokenData === null || tcTokenData === void 0 ? void 0 : (tcTokenData[jid] && tcTokenData[jid].token);
        if (!tcTokenBuffer)
            return baseContent.length > 0 ? baseContent : undefined;
        baseContent.push({
            tag: 'tctoken',
            attrs: {},
            content: tcTokenBuffer
        });
        return baseContent;
    }
    catch (error) {
        return baseContent.length > 0 ? baseContent : undefined;
    }
}
exports.buildTcTokenFromJid = buildTcTokenFromJid;
