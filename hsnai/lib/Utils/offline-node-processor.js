"use strict";
// lib/Utils/offline-node-processor.js
// Queues offline stanza nodes (received while the socket was disconnected)
// for sequential processing, yielding to the event loop periodically so a
// large backlog doesn't block, and isolating handler errors per-node.
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeOfflineNodeProcessor = void 0;
function makeOfflineNodeProcessor(nodeProcessorMap, deps, batchSize = 10) {
    const nodes = [];
    let isProcessing = false;
    const enqueue = (type, node) => {
        nodes.push({ type, node });
        if (isProcessing) {
            return;
        }
        isProcessing = true;
        const promise = async () => {
            let processedInBatch = 0;
            while (nodes.length && deps.isWsOpen()) {
                const { type, node } = nodes.shift();
                const nodeProcessor = nodeProcessorMap.get(type);
                if (!nodeProcessor) {
                    deps.onUnexpectedError(new Error(`unknown offline node type: ${type}`), 'processing offline node');
                    continue;
                }
                await nodeProcessor(node).catch(err => deps.onUnexpectedError(err, `processing offline ${type}`));
                processedInBatch++;
                if (processedInBatch >= batchSize) {
                    processedInBatch = 0;
                    await deps.yieldToEventLoop();
                }
            }
            isProcessing = false;
        };
        promise().catch(error => deps.onUnexpectedError(error, 'processing offline nodes'));
    };
    return { enqueue };
}
exports.makeOfflineNodeProcessor = makeOfflineNodeProcessor;
