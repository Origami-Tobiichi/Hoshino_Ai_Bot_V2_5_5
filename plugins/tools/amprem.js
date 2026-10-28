/**
 * amprem — Alight Motion Premium Generator
 * Port dari plugin ESM ke CommonJS + hsnai
 * Style: Hoshino Ai 🌸
 * 
 * Command:
 *   .amprem-send <email>                       → kirim link verifikasi ke email
 *   .amprem-verif <email> | <link>             → verifikasi + auto premium
 */

const axios = require('axios');
const crypto = require('crypto');

const pluginConfig = {
    name: 'amprem',
    alias: ['amprem-send', 'amprem-verif', 'alightprem', 'ampremium'],
    category: 'tools',
    description: 'Alight Motion Premium Generator (custom order ID)',
    usage: '.amprem-send <email>  |  .amprem-verif <email> | <link>',
    example: '.amprem-send test@gmail.com',
    isOwner: false,
    isPremium: true,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 0,
    isEnabled: true
};

// ====== CONFIG ======
const cfg = {
    key: process.env.AMPREM_API_KEY || '',
    idt: 'https://www.googleapis.com/identitytoolkit/v3/relyingparty',
    stk: 'https://securetoken.googleapis.com/v1/token',
    vfy: 'https://us-central1-alight-creative.cloudfunctions.net/verifyPurchase'
};

// ====== HELPERS ======
const dip = () => [
    crypto.randomInt(1, 255),
    crypto.randomInt(0, 255),
    crypto.randomInt(0, 255),
    crypto.randomInt(1, 255)
].join('.');

const sp = (h) => ({
    ...h,
    'x-forwarded-for': dip(),
    'x-real-ip': dip(),
    'client-ip': dip(),
    'x-client-ip': dip(),
    'x-originating-ip': dip(),
    'x-cluster-client-ip': dip()
});

const h1 = {
    'content-type': 'application/json',
    'x-android-package': 'com.alightcreative.motion',
    'x-android-cert': 'ECA6BF91B8715A6F810ED0BBFC65B6CD578F52A8',
    'user-agent': 'dalvik/2.1.0 (linux; u; android 15; 23127pn0cc build/bp1a.250505.005)'
};

const h2 = {
    'content-type': 'application/json; charset=utf-8',
    'user-agent': 'okhttp/3.12.1',
    'accept-encoding': 'gzip'
};

const bad = (e) => {
    const d = e.response?.data;
    return d ? (typeof d === 'object' ? JSON.stringify(d) : String(d)) : e.message;
};

// ====== CORE FUNCTIONS ======
async function link(email) {
    const c1 = { identifier: email, continueUri: 'http://localhost' };
    const c2 = {
        requestType: 6,
        email: email,
        androidInstallApp: true,
        canHandleCodeInApp: true,
        continueUrl: 'https://alightcreative.com?ui_sid=0366624874&ui_sd=0',
        iosBundleId: 'com.alightcreative.motion',
        androidPackageName: 'com.alightcreative.motion',
        androidMinimumVersion: '585',
        clientType: 'CLIENT_TYPE_ANDROID'
    };
    try {
        await axios.post(`${cfg.idt}/createAuthUri?key=${cfg.key}`, c1, {
            headers: sp(h1),
            timeout: 15000
        });
        const r = await axios.post(`${cfg.idt}/getOobConfirmationCode?key=${cfg.key}`, c2, {
            headers: sp(h1),
            timeout: 15000
        });
        return { ok: true, r: r.data };
    } catch (e) {
        return { ok: false, why: bad(e) };
    }
}

function code(raw) {
    if (!raw) return null;
    let s = String(raw).replace(/&/g, '&');
    try { s = decodeURIComponent(s); } catch {}

    try {
        const u = new URL(s);
        let c = u.searchParams.get('oobCode');
        if (!c) {
            const n = u.searchParams.get('link') || u.searchParams.get('q') || u.searchParams.get('url');
            if (n) {
                try { c = new URL(n).searchParams.get('oobCode'); } catch {}
            }
        }
        if (c) return c.replace(/[^a-zA-Z0-9_-]/g, '');
    } catch {}

    const m = s.match(/oobCode=([a-zA-Z0-9_-]+)/i);
    if (m) return m[1];

    const t = raw.trim();
    if (/^[a-zA-Z0-9_-]{10,}$/.test(t) && !t.includes('://')) return t;
    return null;
}

async function auth(email, raw) {
    const c = code(raw);
    if (!c) return { ok: false, why: 'Code tidak ditemukan' };
    try {
        const a = await axios.post(`${cfg.idt}/emailLinkSignin?key=${cfg.key}`, {
            email: email,
            oobCode: c,
            clientType: 'CLIENT_TYPE_ANDROID'
        }, { headers: sp(h1), timeout: 15000 });

        let u = null;
        try {
            const b = await axios.post(`${cfg.idt}/getAccountInfo?key=${cfg.key}`, {
                idToken: a.data.idToken
            }, { headers: sp(h1), timeout: 15000 });
            u = b.data?.users?.[0] || null;
        } catch {}

        return {
            ok: true,
            email: email,
            id: a.data.idToken,
            ref: a.data.refreshToken,
            uid: a.data.localId,
            baru: !!a.data.isNewUser,
            user: u
        };
    } catch (e) {
        return { ok: false, why: bad(e) };
    }
}

async function pro(id) {
    const o = 'neo-' + crypto.randomBytes(6).toString('hex');
    const b = {
        data: {
            productId: 'am.full.sub.annual.19q4',
            token: 'mmgaobamlahbbeccfplmbkbb.AO-J1OzqG0or_GJJIx-ms8GrTm-jaglCRfhQSRPUZKpl2YspYS-oN7_94uv8RC5vQbvd_Ios2pPDStZ2n7F0hLE3FiOU7HS3R6Fquulv5xLXFECSv4ctElw',
            skuType: 'subs',
            orderId: o
        }
    };
    const h = {
        ...h2,
        authorization: 'Bearer ' + id,
        'firebase-instance-id-token': 'cSDnCyp3T-uwp07z3tL86T:APA91bFkmvvsHw5nnqa1SBFci-99DRsKClLiETdRrVcJjS5yBx1v_FbCb1d8WhBuea_zmwnYBktyTIzcRhN4b6uNOUur9wPc0gKXmJDoZic0LhNq5V2s0xI'
    };
    try {
        const r = await axios.post(cfg.vfy, b, {
            headers: sp(h),
            timeout: 20000
        });
        return { ok: true, order: o, r: r.data };
    } catch (e) {
        return { ok: false, why: bad(e) };
    }
}

async function re(ref) {
    try {
        const r = await axios.post(`${cfg.stk}?key=${cfg.key}`, {
            grant_type: 'refresh_token',
            refresh_token: ref
        }, { timeout: 15000 });
        return { ok: true, id: r.data.id_token, ref: r.data.refresh_token };
    } catch (e) {
        return { ok: false, why: bad(e) };
    }
}

// ====== SESSION STORE ======
const sessions = new Map();

// ====== MAIN HANDLER ======
async function handler(m, { sock, config: botConfig, db, text = '', command }) {
    // ===== Ambil raw text dari multi-source =====
    let rawText = '';
    const trySources = [m?.fullArgs, text, m?.text, m?.body];
    for (const src of trySources) {
        if (typeof src === 'string' && src.trim().length > 0) {
            rawText = src.trim();
            break;
        }
    }

    const prefix = botConfig?.command?.prefix || '.';
    const cmdNames = ['amprem-send', 'amprem-verif', 'alightprem', 'ampremium', 'amprem'];
    while (rawText.startsWith(prefix)) rawText = rawText.slice(prefix.length).trim();
    const firstTok = rawText.split(/\s+/)[0]?.toLowerCase();
    if (cmdNames.includes(firstTok)) {
        rawText = rawText.slice(firstTok.length).trim();
    }

    const sender = m.sender;
    const botName = botConfig?.bot?.name || 'Hoshino Ai';

    // ===== No text — tampilkan help =====
    if (!rawText) {
        const helpText =
`🌸 *ᴀʟɪɢʜᴛ ᴍᴏᴛɪᴏɴ ᴘʀᴇᴍɪᴜᴍ* 🌸

Hai hai~ *${m.pushName || 'Kak'}* 🪸
Aku bisa bantu kamu dapetin *Alight Motion Premium* langsung dari email kamu lho~ ✨

╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」
┃ \`◦\` 1️⃣ Kirim link verifikasi ke email
┃     \`${prefix}amprem-send email@kamu.com\`
┃
┃ \`◦\` 2️⃣ Cek inbox/spam, copy link verifikasi
┃
┃ \`◦\` 3️⃣ Verifikasi & auto premium
┃     \`${prefix}amprem-verif email@kamu.com | <link>\`
╰┈┈┈┈┈┈┈┈⬡

╭┈┈⬡「 ✨ *ᴋᴇᴛᴇʀᴀɴɢᴀɴ* 」
┃ \`◦\` Order ID custom otomatis (\`neo-xxxxxx\`)
┃ \`◦\` Akun langsung aktif di app
┃ \`◦\` Support Android & iOS
┃ \`◦\` Cek folder spam kalau gak nemu email
╰┈┈┈┈┈┈┈┈⬡

> Ketik command di atas buat mulai ya~ 🌸
> ~ *${botName}* ✨`;
        return m.reply(helpText);
    }

    // ===== Format: ada "|" → verif =====
    if (rawText.includes('|')) {
        const parts = rawText.split('|').map(p => p.trim());
        const em = parts[0];
        const linkUrl = parts[1];

        if (!em || !linkUrl) {
            return m.reply(
`⚠️ *ꜰᴏʀᴍᴀᴛ ᴋᴜʀᴀɴɢ ᴛᴇᴘᴀᴛ* 🌸

Gunakan format:
\`${prefix}amprem-verif email@kamu.com | <link_verifikasi>\`

Contoh:
\`${prefix}amprem-verif test@gmail.com | https://alight-creative.firebaseapp.com/__/auth/action?oobCode=xxx\``
            );
        }

        if (!sessions.has(sender)) sessions.set(sender, {});
        const session = sessions.get(sender);
        session.email = em;

        await m.reply(
`⏳ *ᴠᴇʀɪꜰɪᴋᴀꜱɪ ᴅᴀɴ ᴘʀᴏᴍᴏᴛᴇ...* 🪸

╭┈┈⬡「 📧 *ᴇᴍᴀɪʟ* 」
┃ \`◦\` \`${em}\`
╰┈┈┈┈┈┈┈┈⬡

> Sabar sebentar ya~ aku lagi proses nih ✨`
        );

        const v = await auth(em, linkUrl);
        if (!v.ok) {
            return m.reply(
`❌ *ɢᴀɢᴀʟ ᴠᴇʀɪꜰɪᴋᴀꜱɪ* 🌸

╭┈┈⬡「 ⚠️ *ᴋᴇᴛᴇʀᴀɴɢᴀɴ* 」
┃ ${v.why}
╰┈┈┈┈┈┈┈┈⬡

> Coba cek ulang link verifikasinya ya kak~ 🪸`
            );
        }

        await m.reply(
`✅ *ʟᴏɢɪɴ ʙᴇʀʜᴀꜱɪʟ* ✨

╭┈┈⬡「 👤 *ɪɴꜰᴏ ᴀᴋᴜɴ* 」
┃ \`◦\` 📧 Email : \`${v.email}\`
┃ \`◦\` 🆕 Baru  : *${v.baru ? 'Ya' : 'Tidak'}*
╰┈┈┈┈┈┈┈┈⬡

⏳ *Mempromosikan akun...* 🌸`
        );

        const q = await pro(v.id);
        if (q.ok) {
            const sessionData = sessions.get(sender) || {};
            sessionData.email = em;
            sessionData.id = v.id;
            sessionData.ref = v.ref;
            sessionData.uid = v.uid;
            sessionData.pro = true;
            sessions.set(sender, sessionData);

            return m.reply(
`🎉 *ᴘʀᴇᴍɪᴜᴍ ꜱᴜᴄᴄᴇꜱꜱ* 🎉

╭┈┈⬡「 ✅ *ᴅᴇᴛᴀɪʟ* 」
┃ \`◦\` 📧 Email   : \`${em}\`
┃ \`◦\` 🆔 Order   : \`${q.order}\`
┃ \`◦\` 📅 Status  : *Active*
╰┈┈┈┈┈┈┈┈⬡

✨ Akun Alight Motion kamu udah premium!
> Login di app pake email di atas ya kak~ 🪸

~ *${botName}* 🌸`
            );
        } else {
            return m.reply(
`❌ *ɢᴀɢᴀʟ ᴘʀᴏᴍᴏᴛᴇ* 🌸

╭┈┈⬡「 ⚠️ *ᴋᴇᴛᴇʀᴀɴɢᴀɴ* 」
┃ ${q.why}
╰┈┈┈┈┈┈┈┈⬡

> Coba ulangi dari awal ya kak~ 🪸`
            );
        }
    }

    // ===== Deteksi email atau link =====
    const isEmail = /@/.test(rawText) && !/http/i.test(rawText);
    const isLink = /http|oobCode/i.test(rawText);

    if (isEmail || command === 'amprem-send') {
        const em = rawText.trim();

        if (!/@/.test(em)) {
            return m.reply(
`⚠️ *ᴇᴍᴀɪʟ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ* 🌸

\`${em}\` bukan email yang valid kak~
Contoh: \`${prefix}amprem-send test@gmail.com\``
            );
        }

        await m.reply(
`⏳ *ᴍᴇɴɢɪʀɪᴍ ʟɪɴᴋ ᴠᴇʀɪꜰɪᴋᴀꜱɪ...* 🪸

╭┈┈⬡「 📧 *ᴛᴜᴊᴜᴀɴ* 」
┃ \`◦\` \`${em}\`
╰┈┈┈┈┈┈┈┈⬡

> Sabar ya~ ✨`
        );

        const r = await link(em);
        if (r.ok) {
            if (!sessions.has(sender)) sessions.set(sender, {});
            const session = sessions.get(sender);
            session.email = em;

            return m.reply(
`✅ *ʟɪɴᴋ ᴛᴇʀᴋɪʀɪᴍ* ✨

╭┈┈⬡「 📬 *ɪɴꜰᴏ* 」
┃ \`◦\` 📧 Email : \`${em}\`
┃ \`◦\` 📂 Cek   : Inbox / Spam
╰┈┈┈┈┈┈┈┈⬡

*Langkah selanjutnya:*
\`◦\` 1️⃣ Buka email, cari dari *Alight Motion*
\`◦\` 2️⃣ Copy link verifikasi (bukan kode)
\`◦\` 3️⃣ Kirim ke bot:
   \`${prefix}amprem-verif ${em} | <link>\`

> Jangan sampai link-nya expired ya kak~ biasanya cuma valid beberapa menit 🪸

~ *${botName}* 🌸`
            );
        } else {
            return m.reply(
`❌ *ɢᴀɢᴀʟ ᴋɪʀɪᴍ ʟɪɴᴋ* 🌸

╭┈┈⬡「 ⚠️ *ᴋᴇᴛᴇʀᴀɴɢᴀɴ* 」
┃ ${r.why}
╰┈┈┈┈┈┈┈┈⬡

> Cek ulang emailnya ya kak~ atau coba lagi beberapa saat 🪸`
            );
        }
    }

    if (isLink) {
        const session = sessions.get(sender);
        let em = session?.email || null;

        if (!em) {
            return m.reply(
`⚠️ *ᴇᴍᴀɪʟ ʙᴇʟᴜᴍ ᴅɪsᴇᴛ* 🌸

Kamu belum kirim email ke aku nih~
Gunakan format:
\`${prefix}amprem-verif email@kamu.com | <link>\`

Atau mulai dari awal:
\`${prefix}amprem-send email@kamu.com\``
            );
        }

        await m.reply(
`⏳ *ᴠᴇʀɪꜰɪᴋᴀꜱɪ...* 🪸

╭┈┈⬡「 📧 *ᴇᴍᴀɪʟ* 」
┃ \`◦\` \`${em}\`
╰┈┈┈┈┈┈┈┈⬡`
        );

        const v = await auth(em, rawText);
        if (!v.ok) {
            return m.reply(
`❌ *ɢᴀɢᴀʟ ᴠᴇʀɪꜰɪᴋᴀꜱɪ* 🌸

╭┈┈⬡「 ⚠️ *ᴋᴇᴛᴇʀᴀɴɢᴀɴ* 」
┃ ${v.why}
╰┈┈┈┈┈┈┈┈⬡`
            );
        }

        await m.reply(
`✅ *ʟᴏɢɪɴ ʙᴇʀʜᴀꜱɪʟ* ✨

╭┈┈⬡「 👤 *ɪɴꜰᴏ* 」
┃ \`◦\` 📧 Email : \`${v.email}\`
┃ \`◦\` 🆕 Baru  : *${v.baru ? 'Ya' : 'Tidak'}*
╰┈┈┈┈┈┈┈┈⬡

⏳ *Mempromosikan akun...* 🌸`
        );

        const q = await pro(v.id);
        if (q.ok) {
            const sessionData = sessions.get(sender) || {};
            sessionData.email = em;
            sessionData.id = v.id;
            sessionData.ref = v.ref;
            sessionData.uid = v.uid;
            sessionData.pro = true;
            sessions.set(sender, sessionData);

            return m.reply(
`🎉 *ᴘʀᴇᴍɪᴜᴍ ꜱᴜᴄᴄᴇꜱꜱ* 🎉

╭┈┈⬡「 ✅ *ᴅᴇᴛᴀɪʟ* 」
┃ \`◦\` 📧 Email   : \`${em}\`
┃ \`◦\` 🆔 Order   : \`${q.order}\`
┃ \`◦\` 📅 Status  : *Active*
╰┈┈┈┈┈┈┈┈⬡

✨ Akun Alight Motion kamu udah premium!
> Login di app pake email di atas ya kak~ 🪸

~ *${botName}* 🌸`
            );
        } else {
            return m.reply(
`❌ *ɢᴀɢᴀʟ ᴘʀᴏᴍᴏᴛᴇ* 🌸

╭┈┈⬡「 ⚠️ *ᴋᴇᴛᴇʀᴀɴɢᴀɴ* 」
┃ ${q.why}
╰┈┈┈┈┈┈┈┈⬡`
            );
        }
    }

    return m.reply(
`⚠️ *ꜰᴏʀᴍᴀᴛ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ* 🌸

╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」
┃ \`◦\` 1️⃣ \`${prefix}amprem-send email@kamu.com\`
┃ \`◦\` 2️⃣ \`${prefix}amprem-verif email@kamu.com | <link>\`
╰┈┈┈┈┈┈┈┈⬡

> Ketik \`${prefix}amprem\` buat liat panduan lengkap ya~ 🪸`
    );
}

module.exports = {
    config: pluginConfig,
    handler
};