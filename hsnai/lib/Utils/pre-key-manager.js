"use strict";
// lib/Utils/pre-key-manager.js
// Manages pre-key updates/deletions with a per-key-type queue so concurrent
// transaction commits can't race and corrupt the auth-state pre-key store.
// Requires the "p-queue" package: npm install p-queue --legacy-peer-deps
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreKeyManager = void 0;
const p_queue_1 = require("p-queue");
class PreKeyManager {
    constructor(store, logger) {
        this.store = store;
        this.logger = logger;
        this.queues = new Map();
    }
    /** Get or create a queue for a specific key type */
    getQueue(keyType) {
        if (!this.queues.has(keyType)) {
            this.queues.set(keyType, new p_queue_1.default({ concurrency: 1 }));
        }
        return this.queues.get(keyType);
    }
    /** Process pre-key operations (updates and deletions) */
    async processOperations(data, keyType, transactionCache, mutations, isInTransaction) {
        const keyData = data[keyType];
        if (!keyData)
            return;
        return this.getQueue(keyType).add(async () => {
            transactionCache[keyType] = transactionCache[keyType] || {};
            mutations[keyType] = mutations[keyType] || {};
            const deletions = [];
            const updates = {};
            for (const keyId in keyData) {
                if (keyData[keyId] === null) {
                    deletions.push(keyId);
                }
                else {
                    updates[keyId] = keyData[keyId];
                }
            }
            if (Object.keys(updates).length > 0) {
                Object.assign(transactionCache[keyType], updates);
                Object.assign(mutations[keyType], updates);
            }
            if (deletions.length > 0) {
                await this.processDeletions(keyType, deletions, transactionCache, mutations, isInTransaction);
            }
        });
    }
    /** Process deletions with validation */
    async processDeletions(keyType, ids, transactionCache, mutations, isInTransaction) {
        var _a;
        if (isInTransaction) {
            for (const keyId of ids) {
                if ((_a = transactionCache[keyType]) === null || _a === void 0 ? void 0 : _a[keyId]) {
                    transactionCache[keyType][keyId] = null;
                    mutations[keyType][keyId] = null;
                }
                else {
                    this.logger.warn(`Skipping deletion of non-existent ${keyType} in transaction: ${keyId}`);
                }
            }
        }
        else {
            const existingKeys = await this.store.get(keyType, ids);
            for (const keyId of ids) {
                if (existingKeys[keyId]) {
                    transactionCache[keyType][keyId] = null;
                    mutations[keyType][keyId] = null;
                }
                else {
                    this.logger.warn(`Skipping deletion of non-existent ${keyType}: ${keyId}`);
                }
            }
        }
    }
    /** Validate and process pre-key deletions outside transactions */
    async validateDeletions(data, keyType) {
        const keyData = data[keyType];
        if (!keyData)
            return;
        return this.getQueue(keyType).add(async () => {
            const deletionIds = Object.keys(keyData).filter(id => keyData[id] === null);
            if (deletionIds.length === 0)
                return;
            const existingKeys = await this.store.get(keyType, deletionIds);
            for (const keyId of deletionIds) {
                if (!existingKeys[keyId]) {
                    this.logger.warn(`Skipping deletion of non-existent ${keyType}: ${keyId}`);
                    delete data[keyType][keyId];
                }
            }
        });
    }
}
exports.PreKeyManager = PreKeyManager;
