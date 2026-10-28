/**
 * SQLite Store untuk Baileys — versi sql.js (WASM, no native build)
 * Nyimpen messages + nodes (XML) biar crm3 bisa capture AdditionalNodes
 */

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { proto } = require('hsnai');

const DB_DIR = path.join(process.cwd(), 'database', 'store');
const DB_PATH = path.join(DB_DIR, 'messages.db');
const SAVE_DEBOUNCE_MS = 1500; // simpan ke disk tiap 1.5 detik kalau ada perubahan

async function makeSQLiteStore(logger = console) {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

    // Init sql.js
    const SQL = await initSqlJs();

    // Load db lama kalau ada
    let db;
    if (fs.existsSync(DB_PATH)) {
        try {
            const buf = fs.readFileSync(DB_PATH);
            db = new SQL.Database(buf);
            logger.info?.(`[store] Loaded existing DB (${(buf.length / 1024).toFixed(1)} KB)`);
        } catch (e) {
            logger.error?.('[store] Gagal load DB lama, bikin baru:', e.message);
            db = new SQL.Database();
        }
    } else {
        db = new SQL.Database();
    }

    // Schema
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT NOT NULL,
            chat TEXT NOT NULL,
            sender TEXT,
            timestamp INTEGER,
            data BLOB,
            PRIMARY KEY (id, chat)
        );
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_messages_chat_ts ON messages(chat, timestamp);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_messages_id ON messages(id);`);

    db.run(`
        CREATE TABLE IF NOT EXISTS nodes (
            id TEXT NOT NULL,
            chat TEXT NOT NULL,
            tag TEXT,
            attrs TEXT,
            content BLOB,
            PRIMARY KEY (id, chat)
        );
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_nodes_id ON nodes(id);`);

    db.run(`
        CREATE TABLE IF NOT EXISTS chats (
            id TEXT PRIMARY KEY,
            data BLOB
        );
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS contacts (
            id TEXT PRIMARY KEY,
            data BLOB
        );
    `);

    // ====== PERSISTENCE ======
    let dirty = false;
    let saveTimer = null;

    function markDirty() {
        dirty = true;
        if (saveTimer) return;
        saveTimer = setTimeout(() => {
            saveTimer = null;
            if (!dirty) return;
            try {
                const data = db.export();
                fs.writeFileSync(DB_PATH, Buffer.from(data));
                dirty = false;
            } catch (e) {
                logger.error?.('[store] save error:', e.message);
            }
        }, SAVE_DEBOUNCE_MS);
    }

    function forceSave() {
        try {
            const data = db.export();
            fs.writeFileSync(DB_PATH, Buffer.from(data));
            dirty = false;
        } catch (e) {
            logger.error?.('[store] forceSave error:', e.message);
        }
    }

    // ====== HELPERS ======
    function runQuery(sql, params = []) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
    }

    function runExec(sql, params = []) {
        db.run(sql, params);
        markDirty();
    }

    // ====== IN-MEMORY CACHE ======
    const messages = {};
    const chats = {};
    const contacts = {};
    const MAX_CACHE_PER_CHAT = 200;

    function cacheMessage(chat, id, msg) {
        if (!messages[chat]) messages[chat] = {};
        messages[chat][id] = msg;
        const keys = Object.keys(messages[chat]);
        if (keys.length > MAX_CACHE_PER_CHAT) {
            const toDrop = keys.slice(0, keys.length - MAX_CACHE_PER_CHAT);
            for (const k of toDrop) delete messages[chat][k];
        }
    }

    // ====== DB API MIRIP better-sqlite3 ======
    // Bikin adapter biar crm3 bisa pakai .db.prepare(...).get()/.all()/.run()
    const dbAdapter = {
        prepare(sql) {
            return {
                get(...params) {
                    const flat = params.flat();
                    const rows = runQuery(sql, flat);
                    return rows[0] || null;
                },
                all(...params) {
                    const flat = params.flat();
                    return runQuery(sql, flat);
                },
                run(...params) {
                    const flat = params.flat();
                    runExec(sql, flat);
                    return { changes: 1 };
                }
            };
        },
        exec(sql) {
            db.run(sql);
            markDirty();
        },
        export() {
            return db.export();
        },
        close() {
            forceSave();
            db.close();
        }
    };

    // ====== STORE OBJECT ======
    const store = {
        messages,
        chats,
        contacts,
        db: dbAdapter, // ⬅️ ini yang dipakai crm3

        // ============ BIND ============
        bind(ev) {
            ev.on('messages.upsert', ({ messages: msgs }) => {
                for (const msg of msgs) {
                    try {
                        store.saveMessage(msg);
                    } catch (e) {
                        logger.error?.('[store] saveMessage error:', e.message);
                    }
                }
            });

            ev.on('messages.update', (updates) => {
                for (const { key, update } of updates) {
                    try {
                        const existing = store.loadMessage(key.id, key.remoteJid);
                        if (existing && update.message) {
                            store.saveMessage({ ...existing, ...update, key });
                        }
                    } catch (e) {}
                }
            });

            ev.on('messages.delete', (item) => {
                try {
                    const keys = item.keys || [item.key];
                    for (const key of keys) {
                        if (!key) continue;
                        dbAdapter.prepare(`DELETE FROM messages WHERE id = ? AND chat = ?`).run(key.id, key.remoteJid);
                        delete messages[key.remoteJid]?.[key.id];
                        dbAdapter.prepare(`DELETE FROM nodes WHERE id = ? AND chat = ?`).run(key.id, key.remoteJid);
                    }
                } catch (e) {}
            });

            ev.on('chats.upsert', (cs) => {
                for (const c of cs) {
                    try {
                        dbAdapter.prepare(`INSERT OR REPLACE INTO chats (id, data) VALUES (?, ?)`).run(c.id, Buffer.from(JSON.stringify(c)));
                        chats[c.id] = c;
                    } catch (e) {}
                }
            });

            ev.on('contacts.upsert', (cs) => {
                for (const c of cs) {
                    try {
                        dbAdapter.prepare(`INSERT OR REPLACE INTO contacts (id, data) VALUES (?, ?)`).run(c.id, Buffer.from(JSON.stringify(c)));
                        contacts[c.id] = c;
                    } catch (e) {}
                }
            });

            // Auto-save tiap 30 detik sebagai safety net
            setInterval(() => { if (dirty) forceSave(); }, 30000);

            // Save saat exit
            process.on('SIGINT', () => { forceSave(); process.exit(0); });
            process.on('SIGTERM', () => { forceSave(); process.exit(0); });
        },

        // ============ SAVE MESSAGE ============
        saveMessage(msg) {
            if (!msg?.key?.id) return;
            const chat = msg.key.remoteJid;
            const id = msg.key.id;
            const sender = msg.key.participant || msg.key.remoteJid || null;
            const ts = typeof msg.messageTimestamp === 'number'
                ? msg.messageTimestamp
                : Number(msg.messageTimestamp?.low ?? msg.messageTimestamp ?? Math.floor(Date.now() / 1000));

            const buf = proto.WebMessageInfo.encode(
                proto.WebMessageInfo.fromObject(msg)
            ).finish();

            dbAdapter.prepare(`
                INSERT OR REPLACE INTO messages (id, chat, sender, timestamp, data)
                VALUES (?, ?, ?, ?, ?)
            `).run(id, chat, sender, ts, Buffer.from(buf));

            cacheMessage(chat, id, msg);
        },

        // ============ SAVE NODE (XML) ============
        saveNode(node) {
            if (!node?.attrs?.id) return;
            const id = node.attrs.id;
            const chat = node.attrs.from || node.attrs.to || node.attrs.recipient || 'unknown';
            const tag = node.tag || null;
            const attrs = JSON.stringify(node.attrs || {});
            const content = Buffer.from(JSON.stringify(node.content || []));

            dbAdapter.prepare(`
                INSERT OR REPLACE INTO nodes (id, chat, tag, attrs, content)
                VALUES (?, ?, ?, ?, ?)
            `).run(id, chat, tag, attrs, content);
        },

        // ============ LOAD MESSAGE ============
        loadMessage(id, chat) {
            if (!id) return null;
            if (chat && messages[chat]?.[id]) return messages[chat][id];

            let row = null;
            if (chat) {
                row = dbAdapter.prepare(`SELECT data FROM messages WHERE id = ? AND chat = ? LIMIT 1`).get(id, chat);
            } else {
                row = dbAdapter.prepare(`SELECT data FROM messages WHERE id = ? LIMIT 1`).get(id);
            }
            if (!row) return null;

            try {
                const decoded = proto.WebMessageInfo.decode(row.data);
                const obj = proto.WebMessageInfo.toObject(decoded, {
                    enums: Number, longs: Number, bytes: String, defaults: false
                });
                if (chat) cacheMessage(chat, id, obj);
                return obj;
            } catch (e) {
                logger.error?.('[store] loadMessage decode error:', e.message);
                return null;
            }
        },

        // ============ LOAD NODE ============
        loadNode(id, chat) {
            if (!id) return null;
            let row = null;
            if (chat) {
                row = dbAdapter.prepare(`SELECT * FROM nodes WHERE id = ? AND chat = ? LIMIT 1`).get(id, chat);
            } else {
                row = dbAdapter.prepare(`SELECT * FROM nodes WHERE id = ? LIMIT 1`).get(id);
            }
            if (!row) return null;
            try {
                return {
                    tag: row.tag,
                    attrs: JSON.parse(row.attrs || '{}'),
                    content: JSON.parse(row.content?.toString() || '[]')
                };
            } catch (e) {
                return null;
            }
        },

        // ============ LOAD CHATS/CONTACTS ============
        loadChat(id) {
            if (chats[id]) return chats[id];
            const row = dbAdapter.prepare(`SELECT data FROM chats WHERE id = ? LIMIT 1`).get(id);
            if (!row) return null;
            try {
                const obj = JSON.parse(row.data.toString());
                chats[id] = obj;
                return obj;
            } catch { return null; }
        },

        loadContact(id) {
            if (contacts[id]) return contacts[id];
            const row = dbAdapter.prepare(`SELECT data FROM contacts WHERE id = ? LIMIT 1`).get(id);
            if (!row) return null;
            try {
                const obj = JSON.parse(row.data.toString());
                contacts[id] = obj;
                return obj;
            } catch { return null; }
        },

        // ============ MISC ============
        mostRecentMessage(chat) {
            const rows = dbAdapter.prepare(
                `SELECT id FROM messages WHERE chat = ? ORDER BY timestamp DESC LIMIT 1`
            ).all(chat);
            if (!rows.length) return null;
            return store.loadMessage(rows[0].id, chat);
        },

        getMessageCount(chat) {
            const row = dbAdapter.prepare(`SELECT COUNT(*) as c FROM messages WHERE chat = ?`).get(chat);
            return row?.c || 0;
        },

        forceSave,
        close() {
            forceSave();
            db.close();
        }
    };

    logger.info?.(`[store] sql.js store ready at ${DB_PATH}`);
    return store;
}

module.exports = { makeSQLiteStore };