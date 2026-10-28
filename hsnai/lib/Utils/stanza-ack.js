"use strict";
// lib/Utils/stanza-ack.js
// Builds an ACK/NACK stanza for a received node. Pure function, no I/O.
// Mirrors WhatsApp Web's ACK construction (WAWebHandleMsgSendAck.sendAck/
// sendNack, WAWebCreateNackFromStanza.createNackFromStanza).
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAckStanza = void 0;
function buildAckStanza(node, errorCode, meId) {
    const { tag, attrs } = node;
    const stanza = {
        tag: 'ack',
        attrs: {
            id: attrs.id,
            to: attrs.from,
            class: tag
        }
    };
    if (errorCode) {
        stanza.attrs.error = errorCode.toString();
    }
    if (attrs.participant) {
        stanza.attrs.participant = attrs.participant;
    }
    if (attrs.recipient) {
        stanza.attrs.recipient = attrs.recipient;
    }
    // WA Web always includes type when present: `n.type || DROP_ATTR`
    if (attrs.type) {
        stanza.attrs.type = attrs.type;
    }
    // WA Web WAWebHandleMsgSendAck.sendAck/sendNack always include `from` for message-class ACKs
    if (tag === 'message' && meId) {
        stanza.attrs.from = meId;
    }
    return stanza;
}
exports.buildAckStanza = buildAckStanza;
