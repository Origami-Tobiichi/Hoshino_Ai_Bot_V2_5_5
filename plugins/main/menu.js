const pluginConfig = {
    name: 'menu',
    alias: ['help', 'bantuan', 'commands', 'm'],
    category: 'main',
    description: 'Menampilkan menu utama bot',
    usage: '.menu',
    example: '.menu',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
};

const hsAsset = require('../../src/lib/assets')
// Ambil gambar khusus variant (images/hsnai-vN); kalau kosong di config → pakai fallback
async function variantImage(key, fallback) {
    return hsAsset.has(`images/${key}`) ? (await hsAsset.buffer(`images/${key}`)) : fallback
}
const config = require('../../config');
const { formatUptime, getTimeGreeting } = require('../../src/lib/formatter');
const { getCommandsByCategory, getCategories } = require('../../src/lib/plugins');
const { getDatabase } = require('../../src/lib/database');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { generateWAMessageFromContent, proto } = require('hsnai');
const { default: axios } = require('axios');

const CATEGORY_EMOJIS = {
    owner: '👑', main: '🏠', utility: '🔧', fun: '🎮', group: '👥',
    download: '📥', search: '🔍', tools: '🛠️', sticker: '🖼️',
    ai: '🤖', game: '🎯', media: '🎬', info: 'ℹ️', religi: '☪️',
    panel: '🖥️', user: '📊', linode: '☁️', random: '🎲', canvas: '🎨', vps: '🌊'
};

function toSmallCaps(text) {
    const smallCaps = {
        'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ꜰ', 'g': 'ɢ',
        'h': 'ʜ', 'i': 'ɪ', 'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ',
        'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ', 's': 's', 't': 'ᴛ', 'u': 'ᴜ',
        'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ'
    };
    return text.toLowerCase().split('').map(c => smallCaps[c] || c).join('');
}

function formatTime(date) {
    const timeHelper = require('../../src/lib/timeHelper');
    return timeHelper.formatTime('HH:mm');
}

function formatDateShort(date) {
    const timeHelper = require('../../src/lib/timeHelper');
    return timeHelper.formatFull('dddd, DD MMMM YYYY');
}

function buildMenuText(m, botConfig, db, uptime, botMode = 'md') {
    const prefix = botConfig.command?.prefix || '.';
    const user = db.getUser(m.sender);
    const timeHelper = require('../../src/lib/timeHelper');
    const timeStr = timeHelper.formatTime('HH:mm');
    const dateStr = timeHelper.formatFull('dddd, DD MMMM YYYY');
    
    const categories = getCategories();
    const commandsByCategory = getCommandsByCategory();
    
    let totalCommands = 0;
    for (const category of categories) {
        totalCommands += (commandsByCategory[category] || []).length;
    }
    
    const { getCaseCount, getCasesByCategory } = require('../../case/hsnai');
    const totalCases = getCaseCount();
    const casesByCategory = getCasesByCategory();
    
    const totalFeatures = totalCommands + totalCases;
    
    let userRole = 'User', roleEmoji = '👤';
    if (m.isOwner) { userRole = 'Owner'; roleEmoji = '👑'; }
    else if (m.isPremium) { userRole = 'Premium'; roleEmoji = '💎'; }
    
    const greeting = getTimeGreeting();
    const uptimeFormatted = formatUptime(uptime);
    const totalUsers = db.getUserCount();
    const greetEmoji = greeting.includes('pagi') ? '🌅' : greeting.includes('siang') ? '☀️' : greeting.includes('sore') ? '🌇' : '🌙';
    
    let txt = `Hai *@${m.pushName || "User"}* 🪸

Aku ${botConfig.bot?.name || 'Hoshino Ai-Bot'}, bot WhatsApp yang siap bantu kamu.  

Kamu bisa pakai aku buat cari info, ambil data, atau bantu hal-hal sederhana langsung lewat WhatsApp — praktis tanpa ribet.
`
   txt += `\n\n╭─〔 🤖 *ʙᴏᴛ ɪɴꜰᴏ* 〕\n`;
txt += `*│* 🖐 ɴᴀᴍᴀ     : *${botConfig.bot?.name || 'Hoshino Ai-Bot'}*\n`;
txt += `*│* 🔑 ᴠᴇʀsɪ    : *v${botConfig.bot?.version || '1.2.0'}*\n`;
txt += `*│* ⚙️ ᴍᴏᴅᴇ     : *${(botConfig.mode || 'public').toUpperCase()}*\n`;
txt += `*│* 🧶 ᴘʀᴇꜰɪx    : *[ ${prefix} ]*\n`;
txt += `*│* ⏱ ᴜᴘᴛɪᴍᴇ   : *${uptimeFormatted}*\n`;
txt += `*│* 👥 ᴛᴏᴛᴀʟ    : *${totalUsers} Users*\n`;
txt += `*│* 🏷 ɢʀᴏᴜᴘ     : *${botMode.toUpperCase()}*\n`;
txt += `*│* 👑 ᴏᴡɴᴇʀ    : *${botConfig.owner?.name || 'Hoshino Ai-Bot'}*\n`;
txt += `╰────────────────⬣\n\n`;

txt += `╭─〔 👤 *ᴜsᴇʀ ɪɴꜰᴏ* 〕\n`;
txt += `*│* 🙋 ɴᴀᴍᴀ     : *${m.pushName}*\n`;
txt += `*│* 🎭 ʀᴏʟᴇ     : *${roleEmoji} ${userRole}*\n`;
txt += `*│* 🎟 ʟɪᴍɪᴛ    : *${m.isOwner || m.isPremium ? '∞ Unlimited' : (user?.limit ?? 25)}*\n`;
txt += `*│* 🕒 ᴡᴀᴋᴛᴜ    : *${timeStr} WIB*\n`;
txt += `*│* 📅 ᴛᴀɴɢɢᴀʟ  : *${dateStr}*\n`;
txt += `╰────────────────⬣\n\n`;
    
    const categoryOrder = ['owner', 'main', 'utility', 'tools', 'fun', 'game', 'download', 'search', 'sticker', 'media', 'ai', 'group', 'religi', 'info', 'cek', 'economy', 'user', 'canvas', 'random', 'premium', 'ephoto', 'jpm', 'pushkontak', 'panel', 'store'];
    const sortedCategories = [...categories].sort((a, b) => {
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });
    
    let modeAllowedMap = {
        md: null,
        store: ['main', 'group', 'sticker', 'owner', 'store'],
        pushkontak: ['main', 'group', 'sticker', 'owner', 'pushkontak']
    };
    let modeExcludeMap = {
        md: ['panel', 'pushkontak', 'store'],
        store: null,
        pushkontak: null
    };
    
    try {
        const botmodePlugin = require('../group/botmodegc');
        if (botmodePlugin && botmodePlugin.MODES) {
            const modes = botmodePlugin.MODES;
            modeAllowedMap = {};
            modeExcludeMap = {};
            for (const [key, val] of Object.entries(modes)) {
                modeAllowedMap[key] = val.allowedCategories;
                modeExcludeMap[key] = val.excludeCategories;
            }
        }
    } catch (e) {}
    
    const allowedCategories = modeAllowedMap[botMode];
    const excludeCategories = modeExcludeMap[botMode] || [];
    
    txt += `📂 *ᴅᴀꜰᴛᴀʀ ᴍᴇɴᴜ*\n`
    
    for (const category of sortedCategories) {
        if (category === 'owner' && !m.isOwner) continue;
        
        if (allowedCategories && !allowedCategories.includes(category.toLowerCase())) continue;
        if (excludeCategories && excludeCategories.includes(category.toLowerCase())) continue;
        
        const pluginCmds = commandsByCategory[category] || [];
        const caseCmds = casesByCategory[category] || [];
        const totalCmds = pluginCmds.length + caseCmds.length;
        if (totalCmds === 0) continue;
        
        const emoji = CATEGORY_EMOJIS[category] || '📁';
        const categoryName = toSmallCaps(category);
        
        txt += `- \`◦\` ${prefix}${toSmallCaps(`menuhsn ${category}`)} ${emoji}\n`;
    }
    return txt;
}

function getContextInfo(botConfig, m, thumbBuffer, renderLargerThumbnail = false) {
    const saluranLink = config.info?.website || botConfig.saluran?.link || config.info?.grupwa || 'https://sc.hoshino-ai.my.id';
    
    const ctx = {
        mentionedJid: [m.sender],
        forwardingScore: 9,
        isForwarded: true,
        linkPreview: {
            'matched-text': saluranLink,
            title: botConfig.bot?.name || 'Hoshino Ai-Bot',
            description: `BOT WHATSAPP MULTI DEVICE`,
            previewType: 0,
            jpegThumbnail: thumbBuffer || undefined,
            linkPreviewMetadata: {
                linkMediaDuration: 0,
                socialMediaPostType: 4
            }
        }
    };
    
    return ctx;
}

function getVerifiedQuoted(botConfig) {
    const saluranId = botConfig.saluran?.id || 'https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o';
    const saluranName = botConfig.saluran?.name || botConfig.bot?.name || 'Hoshino Ai-Bot';
    
    return {
                key: {
                    participant: `0@s.whatsapp.net`,
                    remoteJid: `status@broadcast`
                    },
                message: {
                    'contactMessage': {
                    'displayName': `🪸 ${botConfig.bot?.name}`,
                    'vcard': `BEGIN:VCARD\nVERSION:3.0\nN:XL;ttname,;;;\nFN:ttname\nitem1.TEL;waid=13135550002:+1 (313) 555-0002\nitem1.X-ABLabel:Ponsel\nEND:VCARD`,
                sendEphemeral: true
            }}}  
}

/* ============================================================================
   MENU VARIANT 22 — HOSHINO AI "IDOL STAGE" RICH HTML
   Tampilan rich response HTML (sama mekanismenya kayak battleshipmp.js)

   CARA PASANG (3 langkah):
   1. Tempel BAGIAN A (helper) di menu.js, tepat di bawah fungsi getVerifiedQuoted().
   2. Tempel BAGIAN B (case 22) di dalam switch(menuVariant), tepat SEBELUM `default:`.
   3. Aktifkan lewat: db.setting('menuVariant', 22)  atau  ui.menuVariant = 22 di config.

   Gak butuh dependency baru: sharp, hsnai, getCategories, getCommandsByCategory,
   getCasesByCategory semua udah dipakai di menu.js kamu.
   Avatar  : foto profil user (fallback images/pp-kosong).
   Header  : images/hsnai-v22 dipotong 16:9 (fallback images/hsnai → images/hsnai2).
   Urutan  : avatar user → gambar header 16:9 tepat di bawahnya → dialog, info, search, kategori.
   ========================================================================= */


/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║  BAGIAN A — HELPER (tempel di bawah getVerifiedQuoted)               ║
   ╚═══════════════════════════════════════════════════════════════════════╝ */

function escapeJsonForScriptV22(json = '[]') {
    return String(json)
        .replace(/</g, '\\u003C')
        .replace(/>/g, '\\u003E')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

const MENU_V22_HTML = `
<style>
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; padding: 0; background: transparent !important; color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
button, input { font-family: inherit; }
button { cursor: pointer; user-select: none; -webkit-user-select: none; }
.hidden { display: none !important; }
.wrap { width: 100%; max-width: 440px; margin: 0 auto; padding: 6px; }

/* ═════════ APP SHELL (tinggi tetap, scroll di dalam) ═════════ */
.app {
    --a1: #ff4fb8; --a2: #8b5cf6; --a3: #38bdf8; --gold: #ffd166;
    --glass: rgba(255,255,255,.07); --line: rgba(255,255,255,.14);
    position: relative; overflow: hidden; display: flex; flex-direction: column;
    height: min(168vw, 720px); min-height: 520px; border-radius: 30px;
    background: linear-gradient(165deg, #170b38, #0a0620 62%, #0d0828);
    border: 1px solid var(--line);
    box-shadow: 0 24px 60px rgba(0,0,0,.55), 0 0 44px rgba(255,79,184,.16);
}
.app[data-theme="aqua"]  { --a1: #22d3ee; --a2: #3b82f6; --a3: #a78bfa; --gold: #86efac; }
.app[data-theme="gold"]  { --a1: #fbbf24; --a2: #f97316; --a3: #fb7185; --gold: #fde68a; }
.aurora { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.aurora b { position: absolute; width: 260px; height: 260px; border-radius: 50%; filter: blur(60px); opacity: .42; }
.aurora b:nth-child(1) { background: var(--a1); left: -80px; top: -60px; animation: drift1 11s ease-in-out infinite alternate; }
.aurora b:nth-child(2) { background: var(--a3); right: -90px; top: 38%; animation: drift2 13s ease-in-out infinite alternate; }
.aurora b:nth-child(3) { background: var(--a2); left: 22%; bottom: -110px; animation: drift1 15s ease-in-out infinite alternate-reverse; }
@keyframes drift1 { to { transform: translate(60px, 70px) scale(1.2); } }
@keyframes drift2 { to { transform: translate(-70px, -60px) scale(1.15); } }
.sparkles { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.sparkles i { position: absolute; font-style: normal; color: #fff; opacity: 0; animation: twinkle 3.6s ease-in-out infinite; }
@keyframes twinkle { 0%,100% { opacity: 0; transform: scale(.4) rotate(0); } 50% { opacity: .8; transform: scale(1.1) rotate(30deg); } }

/* ═════════ TOP BAR ═════════ */
.topbar { position: relative; z-index: 3; display: flex; align-items: center; gap: 9px; padding: 12px 14px 8px; }
.logo { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; font-size: 18px;
    background: linear-gradient(135deg, var(--a1), var(--a2)); box-shadow: 0 0 16px rgba(255,79,184,.5); }
.tb-name { flex: 1; min-width: 0; }
.tb-name b { display: block; font-size: 13.5px; font-weight: 900; letter-spacing: .3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tb-name small { display: flex; align-items: center; gap: 5px; font-size: 9.5px; font-weight: 800; letter-spacing: 1.2px; color: #7dffb2; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: #3dff8b; box-shadow: 0 0 0 0 rgba(61,255,139,.7); animation: pulse 1.8s infinite; }
@keyframes pulse { 70% { box-shadow: 0 0 0 7px rgba(61,255,139,0); } 100% { box-shadow: 0 0 0 0 rgba(61,255,139,0); } }
.themes { display: flex; gap: 6px; }
.themes button { width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgba(255,255,255,.35); padding: 0; }
.themes button.on { border-color: #fff; transform: scale(1.15); }
.errbox { display: none; margin: 0 14px 6px; padding: 7px 10px; border-radius: 10px; font-size: 10px; color: #ffb4b4; background: rgba(255,80,80,.14); border: 1px solid rgba(255,80,80,.35); word-break: break-word; position: relative; z-index: 3; }
.errbox.show { display: block; }

/* ═════════ VIEWS ═════════ */
.views { position: relative; z-index: 2; flex: 1; min-height: 0; }
.view { position: absolute; inset: 0; overflow-y: auto; padding: 4px 14px 18px; display: none; touch-action: pan-y; scrollbar-width: none; }
.view::-webkit-scrollbar { display: none; }
.view.on { display: block; animation: viewIn .28s ease-out; }
@keyframes viewIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.h-title { margin: 14px 2px 8px; font-size: 10.5px; font-weight: 900; letter-spacing: 1.8px; color: var(--gold); display: flex; align-items: center; gap: 8px; }
.h-title::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, rgba(255,255,255,.28), transparent); }

/* ═════════ HERO ═════════ */
.hero { text-align: center; padding: 6px 0 4px; }
.ring { position: relative; width: 112px; height: 112px; margin: 0 auto; border-radius: 50%; padding: 4px;
    background: conic-gradient(from 0deg, var(--a1), var(--a2), var(--a3), var(--gold), var(--a1)); animation: spin 6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.ring .in { position: relative; width: 100%; height: 100%; border-radius: 50%; overflow: hidden; background: #1c1040; display: grid; place-items: center; font-size: 42px; animation: spin 6s linear infinite reverse; }
.ring .in img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.ring-wrap { position: relative; width: 112px; margin: 0 auto; }
.ring-wrap::after { content: "👑"; position: absolute; right: -2px; top: -4px; font-size: 22px; transform: rotate(18deg); filter: drop-shadow(0 2px 6px rgba(0,0,0,.5)); }
.hello { margin-top: 10px; font-size: 11px; font-weight: 800; letter-spacing: 1.4px; color: rgba(255,255,255,.7); }
.uname { margin-top: 2px; font-size: 24px; font-weight: 900; line-height: 1.15; word-break: break-word;
    background: linear-gradient(90deg, #fff, var(--gold) 45%, var(--a1)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.pills { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-top: 10px; }
.pill { padding: 5px 11px; border-radius: 999px; font-size: 10px; font-weight: 800; letter-spacing: .6px; background: var(--glass); border: 1px solid var(--line); }
.pill.hot { background: linear-gradient(135deg, var(--a1), var(--a2)); border: 0; }

/* ═════════ BANNER 16:9 ═════════ */
.banner { position: relative; width: 100%; aspect-ratio: 16 / 9; margin-top: 14px; border-radius: 18px; overflow: hidden;
    background: linear-gradient(135deg, #2a1360, #5b21b6 55%, #be185d); border: 1px solid var(--line); box-shadow: 0 10px 26px rgba(0,0,0,.45); }
.banner img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1; }
.banner .fb { position: absolute; inset: 0; display: grid; place-items: center; font-size: 56px; opacity: .5; }
.banner::after { content: ""; position: absolute; inset: 0; z-index: 2; background: linear-gradient(105deg, transparent 38%, rgba(255,255,255,.22) 50%, transparent 62%); transform: translateX(-120%); animation: shine 4.5s ease-in-out infinite; }
@keyframes shine { 55%, 100% { transform: translateX(120%); } }
.banner .shade { position: absolute; inset: 0; z-index: 2; background: linear-gradient(to top, rgba(8,4,24,.85), transparent 55%); }
.banner .cap { position: absolute; left: 12px; right: 12px; bottom: 10px; z-index: 3; }
.banner .cap b { display: block; font-size: 15px; font-weight: 900; text-shadow: 0 2px 8px rgba(0,0,0,.6); }
.banner .cap small { font-size: 9px; font-weight: 800; letter-spacing: 2px; color: var(--gold); }

/* ═════════ DIALOG ═════════ */
.dialog { position: relative; display: flex; gap: 10px; margin-top: 14px; padding: 12px; border-radius: 18px; background: var(--glass); border: 1px solid var(--line); }
.dialog .face { flex: 0 0 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; font-size: 20px; background: linear-gradient(135deg, var(--a1), var(--a2)); }
.dialog .who { font-size: 10px; font-weight: 900; letter-spacing: 1.2px; color: var(--gold); }
.dialog .say { margin-top: 3px; font-size: 12px; line-height: 1.55; color: rgba(255,255,255,.92); min-height: 56px; }
.caret { display: inline-block; width: 2px; height: 12px; margin-left: 1px; vertical-align: -2px; background: var(--a1); animation: blink 1s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }

/* ═════════ STATS ═════════ */
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
.stat { text-align: center; padding: 12px 4px; border-radius: 16px; background: var(--glass); border: 1px solid var(--line); position: relative; overflow: hidden; }
.stat::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 3px; background: linear-gradient(90deg, var(--c1), var(--c2)); }
.stat .n { font-size: 21px; font-weight: 900; background: linear-gradient(135deg, var(--c1), var(--c2)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.stat .l { margin-top: 1px; font-size: 8.5px; font-weight: 800; letter-spacing: 1.4px; color: rgba(255,255,255,.65); }

/* ═════════ ACTION GRID ═════════ */
.acts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.act { position: relative; display: flex; align-items: center; gap: 9px; padding: 12px 10px; text-align: left; border-radius: 16px; color: #fff; border: 1px solid var(--line); background: var(--glass); overflow: hidden; }
.act .ic { flex: 0 0 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; font-size: 17px; background: linear-gradient(135deg, var(--a1), var(--a2)); }
.act b { display: block; font-size: 11px; font-weight: 900; letter-spacing: .5px; }
.act small { display: block; margin-top: 1px; font-size: 9px; color: rgba(255,255,255,.62); }
.act:active { transform: scale(.96); }
.act.wide { grid-column: 1 / -1; background: linear-gradient(135deg, rgba(255,79,184,.35), rgba(139,92,246,.35)); border-color: rgba(255,79,184,.5); }

/* ═════════ SEARCH + CATEGORY GRID ═════════ */
.search { position: sticky; top: -4px; z-index: 5; padding: 6px 0 8px; background: linear-gradient(#0c0723 70%, transparent); }
.search .box { display: flex; align-items: center; gap: 8px; padding: 0 12px; height: 42px; border-radius: 21px; background: rgba(0,0,0,.4); border: 1.5px solid var(--line); }
.search .box:focus-within { border-color: var(--a1); box-shadow: 0 0 0 3px rgba(255,79,184,.18); }
.search input { flex: 1; min-width: 0; height: 100%; border: 0; outline: none; background: transparent; color: #fff; font-size: 13px; }
.search input::placeholder { color: rgba(255,255,255,.45); }
.search .x { border: 0; background: rgba(255,255,255,.14); color: #fff; width: 22px; height: 22px; border-radius: 50%; font-size: 11px; padding: 0; }
.scount { margin: 2px 4px 4px; font-size: 10px; font-weight: 800; letter-spacing: .6px; color: var(--gold); min-height: 12px; }
.cgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.cc { position: relative; padding: 13px 11px 11px; text-align: left; color: #fff; border-radius: 18px; border: 1px solid var(--line); overflow: hidden;
    background: linear-gradient(150deg, rgba(255,255,255,.1), rgba(255,255,255,.03)); }
.cc::before { content: ""; position: absolute; right: -22px; top: -22px; width: 84px; height: 84px; border-radius: 50%; background: linear-gradient(135deg, var(--c1), var(--c2)); opacity: .5; filter: blur(2px); }
.cc .em { position: relative; width: 40px; height: 40px; border-radius: 13px; display: grid; place-items: center; font-size: 21px; background: linear-gradient(135deg, var(--c1), var(--c2)); box-shadow: 0 6px 14px rgba(0,0,0,.35); }
.cc b { position: relative; display: block; margin-top: 9px; font-size: 12px; font-weight: 900; letter-spacing: .4px; word-break: break-word; }
.cc small { position: relative; display: block; margin-top: 2px; font-size: 9.5px; font-weight: 700; color: rgba(255,255,255,.68); }
.cc:active { transform: scale(.96); }

/* ═════════ CATEGORY DETAIL + CHIPS ═════════ */
.dhead { display: flex; align-items: center; gap: 10px; padding: 4px 0 10px; }
.back { flex: 0 0 38px; height: 38px; border-radius: 50%; border: 1px solid var(--line); background: var(--glass); color: #fff; font-size: 16px; padding: 0; }
.dhead .em { flex: 0 0 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; font-size: 22px; background: linear-gradient(135deg, var(--c1), var(--c2)); }
.dhead .t { flex: 1; min-width: 0; }
.dhead .t b { display: block; font-size: 15px; font-weight: 900; word-break: break-word; }
.dhead .t small { font-size: 10px; color: rgba(255,255,255,.65); font-weight: 700; }
.bigbtn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 10px; border: 0; border-radius: 15px; color: #fff; font-size: 12px; font-weight: 900; letter-spacing: .6px;
    background: linear-gradient(135deg, var(--a1), var(--a2)); box-shadow: 0 8px 20px rgba(255,79,184,.3); }
.bigbtn:active { transform: scale(.97); }
.chips { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
.chip { display: inline-flex; align-items: center; gap: 4px; padding: 9px 13px; border-radius: 13px; border: 1px solid var(--line); color: #fff; font-size: 12px; font-weight: 700; background: rgba(255,255,255,.08); transition: background .15s, transform .1s; }
.chip b { color: var(--gold); font-weight: 900; }
.chip i { font-style: normal; font-size: 10px; opacity: .8; }
.chip:active { transform: scale(.93); }
.chip.copied { background: linear-gradient(135deg, #10b981, #34d399); border-color: transparent; color: #04261a; }
.chip.copied b { color: #04261a; }
.empty { padding: 26px 12px; text-align: center; font-size: 12px; color: rgba(255,255,255,.7); }

/* ═════════ INFO PANELS ═════════ */
.panel { padding: 4px 13px; border-radius: 18px; background: var(--glass); border: 1px solid var(--line); }
.row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0; border-bottom: 1px dashed rgba(255,255,255,.12); }
.row:last-child { border-bottom: 0; }
.row .k { font-size: 11px; font-weight: 800; color: rgba(255,255,255,.75); white-space: nowrap; }
.row .k b { color: var(--a1); margin-right: 6px; }
.row .v { font-size: 12px; font-weight: 800; text-align: right; word-break: break-word; }

/* ═════════ RIWAYAT ═════════ */
.hist { display: flex; flex-direction: column; gap: 7px; }
.hi { display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 12px; border-radius: 14px; text-align: left; color: #fff; border: 1px solid var(--line); background: var(--glass); }
.hi code { flex: 1; font-size: 13px; font-weight: 800; color: var(--gold); font-family: inherit; word-break: break-all; }
.hi small { font-size: 9.5px; color: rgba(255,255,255,.6); font-weight: 700; }
.hi:active { transform: scale(.97); }

.foot { margin: 18px 0 4px; text-align: center; font-size: 9.5px; letter-spacing: 1.2px; color: rgba(255,255,255,.5); line-height: 1.8; }
.foot b { color: var(--gold); }

/* ═════════ TAB BAR ═════════ */
.tabs { position: relative; z-index: 4; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin: 0 10px 10px; padding: 6px; border-radius: 22px; background: rgba(10,6,32,.88); border: 1px solid var(--line); box-shadow: 0 10px 26px rgba(0,0,0,.5); }
.tab { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 7px 0 6px; border: 0; border-radius: 16px; background: transparent; color: rgba(255,255,255,.6); font-size: 9px; font-weight: 900; letter-spacing: .8px; }
.tab span { font-size: 17px; filter: grayscale(.7); transition: transform .2s; }
.tab.on { color: #fff; background: linear-gradient(135deg, rgba(255,79,184,.38), rgba(139,92,246,.38)); }
.tab.on span { filter: none; transform: translateY(-1px) scale(1.15); }

.snav { position: absolute; right: 12px; z-index: 12; width: 42px; height: 42px; border-radius: 50%; border: 1px solid rgba(255,255,255,.28); color: #fff; font-size: 15px; padding: 0; display: grid; place-items: center;
    background: rgba(24,14,60,.92); box-shadow: 0 6px 16px rgba(0,0,0,.55); }
.snav.up { bottom: 142px; }
.snav.dn { bottom: 92px; }
.snav:active { transform: scale(.88); background: linear-gradient(135deg, var(--a1), var(--a2)); }
/* ═════════ TOAST + PARTIKEL ═════════ */
.toast { position: absolute; left: 14px; right: 14px; bottom: 84px; z-index: 30; padding: 11px 14px; border-radius: 16px; font-size: 12px; line-height: 1.45; text-align: center; font-weight: 700;
    background: rgba(18,10,48,.96); border: 1px solid rgba(255,255,255,.28); box-shadow: 0 12px 30px rgba(0,0,0,.6);
    opacity: 0; transform: translateY(14px) scale(.96); transition: opacity .22s, transform .22s; pointer-events: none; }
.toast.show { opacity: 1; transform: none; }
.toast em { font-style: normal; color: var(--gold); font-weight: 900; }
.burst { position: absolute; z-index: 25; pointer-events: none; font-size: 14px; animation: fly .75s ease-out forwards; }
@keyframes fly { from { opacity: 1; transform: translate(0,0) scale(.6); } to { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(1.3) rotate(120deg); } }
</style>

<div class="wrap">
<div class="app" id="app" data-theme="sakura">
    <div class="aurora"><b></b><b></b><b></b></div>
    <div class="sparkles" id="sparkles"></div>

    <div class="topbar">
        <div class="logo">🌸</div>
        <div class="tb-name"><b id="botName">Hoshino Ai</b><small><i class="dot"></i><span id="liveText">MEMUAT…</span></small></div>
        <div class="themes" id="themes">
            <button data-t="sakura" class="on" style="background:linear-gradient(135deg,#ff4fb8,#8b5cf6)" type="button"></button>
            <button data-t="aqua" style="background:linear-gradient(135deg,#22d3ee,#3b82f6)" type="button"></button>
            <button data-t="gold" style="background:linear-gradient(135deg,#fbbf24,#f97316)" type="button"></button>
        </div>
    </div>
    <div class="errbox" id="errBox"></div>

    <div class="views">

        <!-- ═════ BERANDA ═════ -->
        <section class="view on" id="v-home">
            <div class="hero">
                <div class="ring-wrap"><div class="ring"><div class="in"><span>🌸</span>__AVATAR_HTML__</div></div></div>
                <div class="hello" id="hello">KON-AI~</div>
                <div class="uname" id="uname">User</div>
                <div class="pills"><span class="pill hot" id="pillRole">USER</span><span class="pill" id="pillVer">V1</span><span class="pill" id="pillMode">MD</span><span class="pill" id="pillTime">00:00</span></div>
            </div>

            <div class="banner">
                <div class="fb">★</div>
                __BANNER_HTML__
                <div class="shade"></div>
                <div class="cap"><b id="capName">Hoshino Ai</b><small>✦ IDOL STAGE ✦</small></div>
            </div>

            <div class="dialog"><div class="face">🌸</div><div><div class="who">AI BILANG~</div><div class="say"><span id="say"></span><i class="caret"></i></div></div></div>

            <div class="stats" id="stats"></div>

            <div class="h-title">⚡ AKSI CEPAT <span style="font-weight:700;letter-spacing:.4px;color:rgba(255,255,255,.55)">· ketuk = otomatis tersalin</span></div>
            <div class="acts">
                <button class="act wide" id="aAll" type="button"><span class="ic">🎀</span><span><b>SEMUA MENU</b><small id="aAllS">.allmenu</small></span></button>
                <button class="act" id="aOwner" type="button"><span class="ic">👑</span><span><b>OWNER</b><small>kontak owner</small></span></button>
                <button class="act" id="aChan" type="button"><span class="ic">💖</span><span><b>SALURAN</b><small>link resmi</small></span></button>
                <button class="act" id="aRand" type="button"><span class="ic">🎲</span><span><b>ACAK</b><small>command random</small></span></button>
                <button class="act" id="aPrefix" type="button"><span class="ic">✨</span><span><b>PREFIX</b><small id="aPrefixS">.</small></span></button>
            </div>

            <div class="foot">✦ <b id="footName">Hoshino Ai</b> ✦<br><span id="footDate"></span></div>
        </section>

        <!-- ═════ MENU ═════ -->
        <section class="view" id="v-menu">
            <div id="menuList">
                <div class="search"><div class="box"><span>🔎</span><input id="search" type="text" placeholder="Cari command... (cth: sticker)" autocomplete="off"><button class="x hidden" id="sx" type="button">✕</button></div></div>
                <div class="scount" id="scount"></div>
                <div class="cgrid" id="cgrid"></div>
                <div id="results" class="chips hidden"></div>
                <div class="empty hidden" id="empty">Yah, command-nya gak ketemu~ coba kata lain ya 🥺</div>
            </div>
            <div id="menuDetail" class="hidden">
                <div class="dhead"><button class="back" id="back" type="button">←</button><div class="em" id="dEm">⭐</div><div class="t"><b id="dName">Kategori</b><small id="dSub"></small></div></div>
                <button class="bigbtn" id="dCopy" type="button">📂 SALIN PERINTAH KATEGORI</button>
                <div class="h-title">✨ KETUK COMMAND = TERSALIN</div>
                <div class="chips" id="dChips"></div>
            </div>
        </section>

        <!-- ═════ INFO ═════ -->
        <section class="view" id="v-info">
            <div class="h-title">🤖 INFO BOT</div>
            <div class="panel" id="botInfo"></div>
            <div class="h-title">🙋 INFO KAMU</div>
            <div class="panel" id="userInfo"></div>
            <div class="foot">MADE WITH 💖 BY <b id="footName2">Hoshino Ai</b></div>
        </section>

        <!-- ═════ RIWAYAT ═════ -->
        <section class="view" id="v-hist">
            <div class="h-title">🕘 TERAKHIR DISALIN</div>
            <div class="hist" id="hist"></div>
            <div class="empty" id="histEmpty">Belum ada yang disalin~ ketuk command mana aja ya 🌸</div>
        </section>
    </div>

    <nav class="tabs">
        <button class="tab on" data-v="home" type="button"><span>🏠</span>BERANDA</button>
        <button class="tab" data-v="menu" type="button"><span>🎀</span>MENU</button>
        <button class="tab" data-v="info" type="button"><span>📊</span>INFO</button>
        <button class="tab" data-v="hist" type="button"><span>🕘</span>RIWAYAT</button>
    </nav>

    <button class="snav up" id="sUp" type="button">▲</button>
    <button class="snav dn" id="sDn" type="button">▼</button>
    <div class="toast" id="toast"></div>
</div>
</div>

<script>
(function () {
var D = __MENU_DATA__;
function $(id) { return document.getElementById(id); }
function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.appendChild(document.createTextNode(String(text)));
    return n;
}
function showErr(msg) { var b = $('errBox'); if (b) { b.textContent = '⚠ ' + msg; b.className = 'errbox show'; } }
window.onerror = function (msg) { showErr(msg); return false; };
function safe(name, fn) { try { fn(); } catch (e) { showErr(name + ': ' + (e && e.message ? e.message : e)); } }

var app = $('app');
var PAL = [['#ff4fb8', '#8b5cf6'], ['#38bdf8', '#6366f1'], ['#fbbf24', '#f97316'], ['#34d399', '#06b6d4'],
           ['#fb7185', '#f43f5e'], ['#a78bfa', '#ec4899'], ['#22d3ee', '#3b82f6'], ['#facc15', '#ef4444']];
function pal(i) { return PAL[i % PAL.length]; }
function setC(node, i) { var p = pal(i); node.style.setProperty('--c1', p[0]); node.style.setProperty('--c2', p[1]); }

/* ───── TOAST ───── */
var toastEl = $('toast'), toastT = null;
function toast(cmd, tail) {
    toastEl.textContent = '';
    toastEl.appendChild(document.createTextNode('✓ '));
    toastEl.appendChild(el('em', '', cmd));
    toastEl.appendChild(document.createTextNode(' ' + tail));
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
}
function toastRaw(t) {
    toastEl.textContent = t;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
}

/* ───── SALIN (clipboard → fallback textarea, sama kayak pinsrich) ───── */
function copyText(t, onOk, onFail) {
    var started = false;
    function fallback(t2) {
        try {
            var ta = document.createElement('textarea');
            ta.value = t2; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.focus(); ta.select();
            var ok = document.execCommand('copy');
            ta.remove();
            if (ok) { onOk(); } else { onFail(); }
        } catch (e) { onFail(); }
    }
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            started = true;
            navigator.clipboard.writeText(t).then(onOk).catch(function () { fallback(t); });
        }
    } catch (e) {}
    if (!started) fallback(t);
}

/* ───── PARTIKEL ───── */
function burst(ev, node) {
    try {
        var r = app.getBoundingClientRect();
        var x, y;
        if (ev && ev.clientX) { x = ev.clientX - r.left; y = ev.clientY - r.top; }
        else { var b = node.getBoundingClientRect(); x = b.left - r.left + b.width / 2; y = b.top - r.top + b.height / 2; }
        var icons = ['✦', '✧', '♡', '★', '✿'];
        for (var i = 0; i < 7; i++) {
            var s = el('span', 'burst', icons[i % icons.length]);
            var ang = Math.random() * 6.283, d = 34 + Math.random() * 38;
            s.style.left = x + 'px'; s.style.top = y + 'px';
            s.style.setProperty('--dx', Math.round(Math.cos(ang) * d) + 'px');
            s.style.setProperty('--dy', Math.round(Math.sin(ang) * d) + 'px');
            s.style.color = ['#ff9ad5', '#ffd166', '#9be7ff', '#fff'][i % 4];
            app.appendChild(s);
            (function (n) { setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 800); })(s);
        }
    } catch (e) {}
}

/* ───── RIWAYAT ───── */
var history = [];
function renderHist() {
    var box = $('hist'); box.textContent = '';
    $('histEmpty').classList.toggle('hidden', history.length > 0);
    for (var i = 0; i < history.length; i++) {
        (function (h) {
            var b = el('button', 'hi'); b.type = 'button';
            b.appendChild(el('code', '', h.text));
            b.appendChild(el('small', '', h.time + ' · salin lagi'));
            b.addEventListener('click', function (ev) { doCopy(h.text, b, ev, true); });
            box.appendChild(b);
        })(history[i]);
    }
}
function pushHist(text) {
    var d = new Date();
    var hh = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    for (var i = history.length - 1; i >= 0; i--) { if (history[i].text === text) history.splice(i, 1); }
    history.unshift({ text: text, time: hh });
    if (history.length > 12) history.pop();
    renderHist();
}

/* ───── AKSI SALIN UTAMA: ketuk → langsung tersalin ───── */
function doCopy(text, node, ev, silentHist) {
    copyText(text,
        function () {
            toast(text, 'tersalin · tempel di chat lalu kirim 🌸');
            if (node && node.classList) {
                node.classList.add('copied');
                setTimeout(function () { node.classList.remove('copied'); }, 900);
            }
            burst(ev, node);
            try { if (navigator.vibrate) navigator.vibrate(18); } catch (e) {}
            if (!silentHist) pushHist(text);
        },
        function () { toastRaw('Gagal menyalin · tahan teks lalu salin manual ya 🥺'); }
    );
}

/* ───── TAB ───── */
var tabs = document.querySelectorAll('.tab');
function go(v) {
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) views[i].classList.remove('on');
    $('v-' + v).classList.add('on');
    $('v-' + v).scrollTop = 0;
    for (var j = 0; j < tabs.length; j++) {
        if (tabs[j].getAttribute('data-v') === v) tabs[j].classList.add('on'); else tabs[j].classList.remove('on');
    }
}
safe('tabs', function () {
    for (var i = 0; i < tabs.length; i++) {
        (function (t) { t.addEventListener('click', function () { go(t.getAttribute('data-v')); }); })(tabs[i]);
    }
});

/* ───── TEMA ───── */
safe('tema', function () {
    var bs = $('themes').querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) {
        (function (b) {
            b.addEventListener('click', function () {
                app.setAttribute('data-theme', b.getAttribute('data-t'));
                for (var k = 0; k < bs.length; k++) bs[k].classList.remove('on');
                b.classList.add('on');
            });
        })(bs[i]);
    }
});

/* ───── SPARKLE ───── */
safe('sparkle', function () {
    var box = $('sparkles'), icons = ['✦', '✧', '⋆', '★', '✵', '♡'];
    for (var i = 0; i < 16; i++) {
        var s = el('i', '', icons[i % icons.length]);
        s.style.left = (Math.random() * 100) + '%'; s.style.top = (Math.random() * 100) + '%';
        s.style.fontSize = (8 + Math.random() * 13) + 'px';
        s.style.animationDelay = (Math.random() * 3.6) + 's'; s.style.animationDuration = (2.8 + Math.random() * 2.4) + 's';
        box.appendChild(s);
    }
});

/* ───── ISI HEADER / HERO ───── */
safe('hero', function () {
    $('botName').textContent = D.botName;
    $('capName').textContent = D.botName;
    $('uname').textContent = D.userName;
    $('hello').textContent = String(D.greeting).toUpperCase() + '~ SELAMAT DATANG';
    $('pillRole').textContent = D.roleEmoji + ' ' + String(D.role).toUpperCase();
    $('pillVer').textContent = 'V' + D.version;
    $('pillMode').textContent = String(D.mode).toUpperCase();
    $('pillTime').textContent = '🕒 ' + D.time + ' WIB';
    $('footName').textContent = D.botName;
    $('footName2').textContent = D.botName;
    $('footDate').textContent = D.date;
    $('aAllS').textContent = D.prefix + 'allmenu';
    $('aPrefixS').textContent = 'salin "' + D.prefix + '"';
});

/* ───── DIALOG TYPEWRITER (ganti-ganti) ───── */
safe('dialog', function () {
    var lines = (D.dialogs && D.dialogs.length) ? D.dialogs : [D.dialog];
    var say = $('say'), li = 0, ci = 0;
    function tick() {
        var line = String(lines[li]);
        if (ci <= line.length) { say.textContent = line.slice(0, ci); ci++; setTimeout(tick, 24); }
        else { setTimeout(function () { li = (li + 1) % lines.length; ci = 0; tick(); }, 4200); }
    }
    tick();
});

/* ───── STATS (count-up) ───── */
safe('stats', function () {
    var list = [
        { n: D.totalFeatures, l: 'FITUR', c1: '#ff4fb8', c2: '#8b5cf6' },
        { n: D.totalUsers, l: 'USER', c1: '#8b5cf6', c2: '#38bdf8' },
        { n: D.categories.length, l: 'KATEGORI', c1: '#38bdf8', c2: '#ffd166' }
    ];
    for (var i = 0; i < list.length; i++) {
        (function (s) {
            var card = el('div', 'stat');
            card.style.setProperty('--c1', s.c1); card.style.setProperty('--c2', s.c2);
            var num = el('div', 'n', '0');
            card.appendChild(num); card.appendChild(el('div', 'l', s.l));
            $('stats').appendChild(card);
            var target = Number(s.n) || 0, t0 = null;
            function step(ts) {
                if (!t0) t0 = ts;
                var p = Math.min(1, (ts - t0) / 900);
                num.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
                if (p < 1) requestAnimationFrame(step);
            }
            if (window.requestAnimationFrame) requestAnimationFrame(step); else num.textContent = String(target);
        })(list[i]);
    }
});

/* ───── AKSI CEPAT ───── */
function allCmds() {
    var out = [];
    for (var i = 0; i < D.categories.length; i++) {
        for (var j = 0; j < D.categories[i].cmds.length; j++) out.push(D.categories[i].cmds[j]);
    }
    return out;
}
safe('aksi', function () {
    $('aAll').addEventListener('click', function (e) { doCopy(D.prefix + 'allmenu', $('aAll'), e); });
    $('aOwner').addEventListener('click', function (e) { doCopy(D.prefix + 'owner', $('aOwner'), e); });
    $('aChan').addEventListener('click', function (e) { doCopy(D.channelLink, $('aChan'), e); });
    $('aPrefix').addEventListener('click', function (e) { doCopy(D.prefix, $('aPrefix'), e); });
    $('aRand').addEventListener('click', function (e) {
        var list = allCmds();
        if (!list.length) { toastRaw('Belum ada command~'); return; }
        doCopy(D.prefix + list[Math.floor(Math.random() * list.length)], $('aRand'), e);
    });
});

/* ───── INFO PANEL ───── */
function fillPanel(id, rows) {
    var box = $(id);
    for (var i = 0; i < rows.length; i++) {
        var r = rows[i], row = el('div', 'row'), k = el('div', 'k');
        k.appendChild(el('b', '', '┃'));
        k.appendChild(document.createTextNode(r[0] + ' ' + r[1]));
        row.appendChild(k); row.appendChild(el('div', 'v', r[2]));
        box.appendChild(row);
    }
}
safe('info', function () {
    fillPanel('botInfo', [
        ['🖐', 'NAMA', D.botName], ['🔑', 'VERSI', 'v' + D.version], ['⚙️', 'MODE', String(D.mode).toUpperCase()],
        ['🧶', 'PREFIX', '[ ' + D.prefix + ' ]'], ['⏱', 'UPTIME', D.uptime], ['🏷', 'GRUP', String(D.groupMode).toUpperCase()],
        ['👑', 'OWNER', D.ownerName]
    ]);
    fillPanel('userInfo', [
        ['🙋', 'NAMA', D.userName], ['🎭', 'ROLE', D.roleEmoji + ' ' + D.role], ['🎟', 'LIMIT', String(D.limit)],
        ['🕒', 'WAKTU', D.time + ' WIB'], ['📅', 'TANGGAL', D.date]
    ]);
});

/* ───── KATEGORI GRID + DETAIL ───── */
var cgrid = $('cgrid'), curCat = null;
function makeChip(cmd, catEmoji) {
    var chip = el('button', 'chip'); chip.type = 'button';
    chip.appendChild(el('b', '', D.prefix));
    chip.appendChild(document.createTextNode(cmd));
    if (catEmoji) chip.appendChild(el('i', '', catEmoji));
    chip.addEventListener('click', function (e) { doCopy(D.prefix + cmd, chip, e); });
    return chip;
}
function openCat(idx) {
    var c = D.categories[idx];
    curCat = idx;
    setC($('menuDetail'), idx);
    $('dEm').textContent = c.emoji;
    $('dName').textContent = String(c.key).toUpperCase();
    $('dSub').textContent = c.cmds.length + ' command';
    $('dCopy').textContent = '📂 SALIN ' + D.prefix + 'menuhsn ' + c.key;
    var box = $('dChips'); box.textContent = '';
    for (var i = 0; i < c.cmds.length; i++) box.appendChild(makeChip(c.cmds[i]));
    $('menuList').classList.add('hidden');
    $('menuDetail').classList.remove('hidden');
    $('v-menu').scrollTop = 0;
}
function closeCat() {
    $('menuDetail').classList.add('hidden');
    $('menuList').classList.remove('hidden');
    curCat = null;
}
safe('kategori', function () {
    for (var i = 0; i < D.categories.length; i++) {
        (function (c, idx) {
            var card = el('button', 'cc'); card.type = 'button';
            setC(card, idx);
            card.appendChild(el('div', 'em', c.emoji));
            card.appendChild(el('b', '', String(c.key).toUpperCase()));
            card.appendChild(el('small', '', c.cmds.length + ' command'));
            card.addEventListener('click', function () { openCat(idx); });
            cgrid.appendChild(card);
        })(D.categories[i], i);
    }
    $('back').addEventListener('click', closeCat);
    $('dCopy').addEventListener('click', function (e) {
        if (curCat === null) return;
        doCopy(D.prefix + 'menuhsn ' + D.categories[curCat].key, $('dCopy'), e);
    });
});

/* ───── SEARCH ───── */
safe('search', function () {
    var inp = $('search');
    function run() {
        var q = String(inp.value || '').trim().toLowerCase();
        $('sx').classList.toggle('hidden', !q);
        var res = $('results'); res.textContent = '';
        if (!q) {
            cgrid.classList.remove('hidden'); res.classList.add('hidden');
            $('empty').classList.add('hidden'); $('scount').textContent = '';
            return;
        }
        var n = 0;
        for (var i = 0; i < D.categories.length; i++) {
            var c = D.categories[i];
            for (var j = 0; j < c.cmds.length; j++) {
                if (String(c.cmds[j]).toLowerCase().indexOf(q) !== -1) { res.appendChild(makeChip(c.cmds[j], c.emoji)); n++; }
            }
        }
        cgrid.classList.add('hidden');
        res.classList.toggle('hidden', n === 0);
        $('empty').classList.toggle('hidden', n !== 0);
        $('scount').textContent = '✨ ' + n + ' command ketemu · ketuk buat salin';
    }
    inp.addEventListener('input', run);
    inp.addEventListener('keyup', run);
    $('sx').addEventListener('click', function () { inp.value = ''; run(); inp.focus(); });
});

/* ───── TOMBOL ATAS / BAWAH (geser jari ditangkap WA, jadi pakai tombol) ───── */
safe('scrollnav', function () {
    function active() { return document.querySelector('.view.on'); }
    function by(dir) {
        var v = active(); if (!v) return;
        var d = Math.round(v.clientHeight * 0.7) * dir;
        try { v.scrollBy({ top: d, behavior: 'smooth' }); } catch (e) { v.scrollTop += d; }
    }
    function bind(id, dir) {
        var b = $(id), t = null, held = false;
        b.addEventListener('click', function () { if (!held) by(dir); held = false; });
        b.addEventListener('pointerdown', function () {
            held = false;
            t = setTimeout(function () {
                held = true;
                t = setInterval(function () { var v = active(); if (v) v.scrollTop += 36 * dir; }, 30);
            }, 380);
        });
        function stop() { clearTimeout(t); clearInterval(t); t = null; }
        b.addEventListener('pointerup', stop);
        b.addEventListener('pointerleave', stop);
        b.addEventListener('pointercancel', stop);
    }
    bind('sUp', -1);
    bind('sDn', 1);
});

safe('ready', function () { renderHist(); $('liveText').textContent = 'ONLINE'; });
})();
</script>
`;

/**
 * Bangun HTML menu V22 dari data bot + user.
 * Data disisipkan sebagai JSON (di-escape) lewat placeholder, jadi
 * nama user / teks apa pun gak bisa nutup tag <script>.
 */
function buildMenuV22HTML(data, avatarUri, bannerUri) {
    const avatarHtml = avatarUri
        ? '<img src="' + avatarUri + '" alt="avatar" onerror="this.style.display=\'none\'">'
        : '';
    const bannerHtml = bannerUri
        ? '<img src="' + bannerUri + '" alt="header" onerror="this.style.display=\'none\'">'
        : '';
    return MENU_V22_HTML
        .replace('__AVATAR_HTML__', () => avatarHtml)
        .replace('__BANNER_HTML__', () => bannerHtml)
        .replace('__MENU_DATA__', () => escapeJsonForScriptV22(JSON.stringify(data)));
}

/**
 * Kirim HTML sebagai rich response (mekanisme sama persis dengan battleshipmp.js).
 */
async function sendMenuRichV22Legacy(sock, m, html, botName, trustedUrl) {
    const { generateMessageIDV2 } = require('hsnai');
    const responseId = generateMessageIDV2();

    const unifiedData = Buffer.from(JSON.stringify({
        response_id: responseId,
        sections: [{
            view_model: {
                primitive: {
                    __typename: 'GenAIaeacdsnwHtmlPrimitive',
                    payload: html,
                    trusted_sources: [trustedUrl]
                },
                __typename: 'GenAISingleLayoutViewModel'
            }
        }]
    })).toString('base64');

    const content = {
        messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            botMetadata: {
                messageDisclaimerText: botName,
                botResponseId: responseId,
                richResponseSourcesMetadata: {
                    sources: [{
                        source_type: 'THIRD_PARTY',
                        source_display_name: botName,
                        source_subtitle: 'Idol Stage Menu',
                        source_url: trustedUrl
                    }]
                }
            }
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages: [{
                        messageType: proto.AIRichResponseSubMessageType.AI_RICH_RESPONSE_TEXT,
                        messageText: botName
                    }],
                    unifiedResponse: { data: unifiedData },
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedAiBotMessageInfo: { botJid: '0@bot' },
                        forwardOrigin: 4
                    }
                }
            }
        }
    };

    const msg = generateWAMessageFromContent(m.chat, content, { messageId: generateMessageIDV2() });
    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
}


/**
 * Kirim kartu lewat AIRich dua fase (kartu kecil dulu → sendEdit tempel HTML),
 * persis seperti pinsrich.js yang tombol salinnya terbukti jalan.
 * Kalau AIRich gagal, jatuh ke relay manual (mekanisme battleshipmp).
 */
async function sendMenuRichV22(sock, m, html, botName, trustedUrl) {
    try {
        const { AIRich } = require('hsnai');
        if (typeof AIRich !== 'function') throw new Error('AIRich tidak tersedia');
        const rich = new AIRich(sock)
            .setTitle('🌸 ' + botName)
            .setFooter('Idol Stage Menu • ketuk kategori buat buka~');
        try {
    await rich.send(m.chat, { quoted: m, bypassDownload: false });
} catch {
    rich.addText('Memuat...', { id: 'menu_load' });
    await rich.send(m.chat, { quoted: m, bypassDownload: false });
}
        rich.addSection({
            view_model: {
                __typename: 'GenAISingleLayoutViewModel',
                primitive: {
                    __typename: 'GenAIaeacdsnwHtmlPrimitive',
                    trusted_sources: [trustedUrl, 'https://wa.me'],
                    payload: html
                }
            }
        });
        await rich.sendEdit();
    } catch (e) {
        console.error('[Menu V22] AIRich gagal, pakai relay manual:', e?.message || e);
        await sendMenuRichV22Legacy(sock, m, html, botName, trustedUrl);
    }
}


async function handler(m, { sock, config: botConfig, db, uptime }) {
    const savedVariant = db.setting('menuVariant');
    const menuVariant = savedVariant || botConfig.ui?.menuVariant || 2;
    const groupData = m.isGroup ? (db.getGroup(m.chat) || {}) : {};
    const botMode = groupData.botMode || 'md';
    const text = buildMenuText(m, botConfig, db, uptime, botMode);
    
    let imageBuffer = hsAsset.has('images/hsnai') ? (await hsAsset.buffer('images/hsnai')) : null;
    let thumbBuffer = hsAsset.has('images/hsnai2') ? (await hsAsset.buffer('images/hsnai2')) : null;
    let videoBuffer = hsAsset.has('video/hsnai') ? (await hsAsset.buffer('video/hsnai')) : null;
    
    try {
        switch (menuVariant) {
            case 1:
                if (imageBuffer) {
                    await sock.sendMessage(m.chat, { image: imageBuffer, caption: text });
                } else {
                    await m.reply(text);
                }
                break;
                
            case 2:
                const msgV2 = { contextInfo: getContextInfo(botConfig, m, thumbBuffer) };
                if (imageBuffer) {
                    msgV2.image = imageBuffer;
                    msgV2.caption = text;
                } else {
                    msgV2.text = text;
                }
                await sock.sendMessage(m.chat, msgV2, { quoted: getVerifiedQuoted(botConfig) });
                break;
                
            case 3:
                let resizedThumb = thumbBuffer;
                if (thumbBuffer) {
                    try {
                        resizedThumb = await sharp(thumbBuffer)
                            .resize(300, 300, { fit: 'cover' })
                            .jpeg({ quality: 80 })
                            .toBuffer();
                    } catch (e) {
                        resizedThumb = thumbBuffer;
                    }
                }
                
                let contextThumb = thumbBuffer;
                try {

                    if (hsAsset.has('images/hsnai')) {
                        contextThumb = (await hsAsset.buffer('images/hsnai'));
                    }
                } catch (e) {}
                
                await sock.sendMessage(m.chat, {
                    document: imageBuffer || Buffer.from(''),
                    mimetype: 'image/png',
                    fileLength: 999999999999,
                    fileSize: 999999999999,
                    fileName: `ɴᴏ ᴘᴀɪɴ ɴᴏ ɢᴀɪɴ`,
                    caption: text,
                    jpegThumbnail: resizedThumb,
                    contextInfo: getContextInfo(botConfig, m, contextThumb, true)
                }, { quoted: getVerifiedQuoted(botConfig) });
                break;
                
            // ============================================================
// FILE 3: menu.js — HANYA case 4, ganti tampilan jadi mirip ourin allmenu V5
// Cari "case 4:" di menu.js lu, ganti seluruh blok case 4 dengan ini
// ============================================================

            case 4:
                try {
                    const { prepareWAMessageMedia } = require('hsnai')
                    const saluranIdV4 = botConfig.saluran?.id || 'https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o'
                    const saluranNameV4 = botConfig.saluran?.name || botConfig.bot?.name || 'Hoshino Ai-Bot'
                    const saluranLinkV4 = botConfig.saluran?.link || 'https://whatsapp.com/channel/0029VbB37bgBfxoAmAlsgE0t'
                    const greeting = getTimeGreeting()

                    // Upload video/gif sebagai header
                    let mediaV4 = null
                    if (videoBuffer) {
                        try {
                            mediaV4 = await prepareWAMessageMedia(
                                { video: videoBuffer, gifPlayback: true },
                                { upload: sock.waUploadToServer }
                            )
                        } catch (e) {
                            console.error('[Menu V4] Media upload error:', e.message)
                        }
                    }

                    // Fake location quoted (thumbnail 300x300)
                    let locThumb = null
                    if (thumbBuffer) {
                        try {
                            locThumb = await sharp(thumbBuffer).resize(300, 300).toBuffer()
                        } catch (e) { locThumb = thumbBuffer }
                    }
                    const qVideoV4 = {
                        key: { fromMe: false, participant: m.sender, remoteJid: m.chat },
                        message: {
                            locationMessage: {
                                degreesLatitude: 0,
                                degreesLongitude: 0,
                                name: greeting,
                                jpegThumbnail: locThumb
                            }
                        }
                    }

                    const msgV4 = generateWAMessageFromContent(m.chat, {
                        viewOnceMessage: {
                            message: {
                                messageContextInfo: {},
                                interactiveMessage: {
                                    header: {
                                        title: '',
                                        subtitle: '',
                                        hasMediaAttachment: !!mediaV4,
                                        ...(mediaV4?.videoMessage ? { videoMessage: mediaV4.videoMessage } : {})
                                    },
                                    body: { text },
                                    footer: { text: 'Pilih tombol di bawah untuk melihat menu' },
                                    contextInfo: {
                                        mentionedJid: [m.sender],
                                        isForwarded: true,
                                        forwardingScore: 9,
                                        forwardedNewsletterMessageInfo: {
                                            newsletterJid: saluranIdV4,
                                            newsletterName: saluranNameV4,
                                            serverMessageId: 127
                                        }
                                    },
                                    nativeFlowMessage: {
                                        messageParamsJson: JSON.stringify({
                                            limited_time_offer: {
                                                text: greeting,
                                                url: 'Hai',
                                                expiration_time: Date.now() + 10000
                                            },
                                            bottom_sheet: {
                                                in_thread_buttons_limit: 2,
                                                divider_indices: [1, 2, 3, 4, 5, 999],
                                                list_title: 'Pilih menu yang kamu mau~',
                                                button_title: '🍙 Lihat Kategori'
                                            },
                                            tap_target_configuration: {
                                                title: ' X ',
                                                description: 'bomboclard',
                                                canonical_url: 'https://hoshino-ai.my.id',
                                                domain: 'hoshino-ai.my.id',
                                                button_index: 0
                                            }
                                        }),
                                        buttons: [
                                            {
                                                name: 'cta_url',
                                                buttonParamsJson: JSON.stringify({
                                                    display_text: `✨ Ikuti Saluran ${botConfig.saluran?.name || 'Hoshino Ai'}~`,
                                                    url: saluranLinkV4,
                                                    merchant_url: saluranLinkV4
                                                })
                                            },
                                            {
                                                name: 'quick_reply',
                                                buttonParamsJson: JSON.stringify({
                                                    display_text: '📂 Kembali Ke Daftar Kategori',
                                                    id: `${botConfig.command?.prefix || '.'}menuhsn`
                                                })
                                            },
                                            {
                                                name: 'quick_reply',
                                                buttonParamsJson: JSON.stringify({
                                                    display_text: '🍅 Kembali Ke Menu Utama',
                                                    id: `${botConfig.command?.prefix || '.'}menu`
                                                })
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    }, { quoted: qVideoV4, userJid: sock.user?.jid || sock.user?.id })

                    await sock.relayMessage(m.chat, msgV4.message, { messageId: msgV4.key.id })

                } catch (v4Error) {
                    console.error('[Menu V4] Error:', v4Error.message)
                    const fallbackV4 = { contextInfo: getContextInfo(botConfig, m, thumbBuffer) }
                    if (imageBuffer) { fallbackV4.image = imageBuffer; fallbackV4.caption = text }
                    else { fallbackV4.text = text }
                    await sock.sendMessage(m.chat, fallbackV4, { quoted: getVerifiedQuoted(botConfig) })
                }
                break;
                
            case 5:
                const prefix = botConfig.command?.prefix || '.';
                const saluranId = botConfig.saluran?.id || 'https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o';
                const saluranName = botConfig.saluran?.name || botConfig.bot?.name || 'Hoshino Ai-Bot';
                
                const categories = getCategories();
                const commandsByCategory = getCommandsByCategory();
                const categoryOrder = ['owner', 'main', 'utility', 'tools', 'fun', 'game', 'download', 'search', 'sticker', 'media', 'ai', 'group', 'religi', 'info', 'jpm', 'pushkontak', 'panel', 'user'];
                
                const sortedCats = [...categories].sort((a, b) => {
                    const indexA = categoryOrder.indexOf(a);
                    const indexB = categoryOrder.indexOf(b);
                    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                });
                
                const toMonoUpperBold = (text) => {
                    const chars = {
                        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚',
                        'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡',
                        'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨',
                        'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭'
                    };
                    return text.toUpperCase().split('').map(c => chars[c] || c).join('');
                };
                
                const categoryRows = [];
                
                const modeAllowedMap = {
                    md: null,
                    cpanel: ['main', 'group', 'sticker', 'owner', 'tools', 'panel'],
                    store: ['main', 'group', 'sticker', 'owner', 'store'],
                    pushkontak: ['main', 'group', 'sticker', 'owner', 'pushkontak']
                };
                const modeExcludeMap = {
                    md: ['panel', 'pushkontak', 'store'],
                    cpanel: null,
                    store: null,
                    pushkontak: null
                };
                
                const allowedCats = modeAllowedMap[botMode];
                const excludeCats = modeExcludeMap[botMode] || [];
                
                for (const cat of sortedCats) {
                    if (cat === 'owner' && !m.isOwner) continue;
                    if (allowedCats && !allowedCats.includes(cat.toLowerCase())) continue;
                    if (excludeCats && excludeCats.includes(cat.toLowerCase())) continue;
                    
                    const cmds = commandsByCategory[cat] || [];
                    if (cmds.length === 0) continue;
                    
                    const emoji = CATEGORY_EMOJIS[cat] || '📁';
                    const title = `${emoji} ${toMonoUpperBold(cat)}`;
                    
                    categoryRows.push({
                        title: title,
                        id: `${prefix}menuhsn ${cat}`,
                        description: `${cmds.length} commands`
                    });
                }
                
                let totalCmds = 0;
                for (const cat of categories) {
                    totalCmds += (commandsByCategory[cat] || []).length;
                }
                
                const now = new Date();
                const greeting = getTimeGreeting();
                const greetEmoji = greeting.includes('pagi') ? '🌅' : greeting.includes('siang') ? '☀️' : greeting.includes('sore') ? '🌇' : '🌙';
                const uptimeFormatted = formatUptime(uptime);
                
                let headerText = `*@${m.pushName || "User"}* 🪸

Aku ${botConfig.bot?.name || 'Hoshino Ai-Bot'}, bot WhatsApp yang siap bantu kamu.  

Kamu bisa pakai aku buat cari info, ambil data, atau bantu hal-hal sederhana langsung lewat WhatsApp — praktis tanpa ribet.\n\n`;
                headerText += `╭┈┈⬡「 🤖 *ʙᴏᴛ ɪɴꜰᴏ* 」\n`;
                headerText += `┃ \`◦\` ɴᴀᴍᴀ: *${botConfig.bot?.name || 'Hoshino Ai-Bot'}*\n`;
                headerText += `┃ \`◦\` ᴠᴇʀsɪ: *v${botConfig.bot?.version || '1.2.0'}*\n`;
                headerText += `┃ \`◦\` ᴍᴏᴅᴇ: *${(botConfig.mode || 'public').toUpperCase()}*\n`;
                headerText += `┃ \`◦\` ᴜᴘᴛɪᴍᴇ: *${uptimeFormatted}*\n`;
                headerText += `┃ \`◦\` ᴛᴏᴛᴀʟ ᴄᴍᴅ: *${totalCmds}*\n`;
                headerText += `╰┈┈┈┈┈┈┈┈⬡\n\n`;
                headerText += `📋 *Pilih kategori di bawah untuk melihat daftar command*`;
                
                try {
                    const { generateWAMessageFromContent, proto } = require('hsnai');
                    
                    const buttons = [
                        {
                            name: 'single_select',
                            buttonParamsJson: JSON.stringify({
                                title: '📁 ᴘɪʟɪʜ ᴍᴇɴᴜ',
                                sections: [{
                                    title: '📋 PILIH CATEGORY',
                                    rows: categoryRows
                                }], 
                                icon: "REVIEW"
                            })
                        },
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: '📊 TOTAL SEMUA FITUR',
                                id: `${prefix}totalfitur`
                            })
                        },
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: '📊 SEMUA MENU',
                                id: `${prefix}allmenu`
                            })
                        }
                    ];
                    
                    let headerMedia = null;
                    if (imageBuffer) {
                        try {
                            const { prepareWAMessageMedia } = require('hsnai');
                            headerMedia = await prepareWAMessageMedia({
                                image: imageBuffer
                            }, {
                                upload: sock.waUploadToServer
                            });
                        } catch (e) {}
                    }
                    
                    const msg = generateWAMessageFromContent(m.chat, {
                        viewOnceMessage: {
                            message: {
                                messageContextInfo: {
                                    deviceListMetadata: {},
                                    deviceListMetadataVersion: 2
                                },
                                interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                                    body: proto.Message.InteractiveMessage.Body.fromObject({
                                        text: headerText
                                    }),
                                    footer: proto.Message.InteractiveMessage.Footer.fromObject({
                                        text: `© ${botConfig.bot?.name || 'Hoshino Ai-Bot'} | ${sortedCats.length} Categories`
                                    }),
                                    header: proto.Message.InteractiveMessage.Header.fromObject({
                                        title: `${botConfig.bot?.name || 'Hoshino Ai-Bot'}`,
                                        hasMediaAttachment: !!headerMedia,
                                        ...(headerMedia || {})
                                    }),
                                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                                        buttons: buttons
                                    }),
                                    contextInfo: {
                                        mentionedJid: [m.sender],
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
                    }, { userJid: m.sender, quoted: getVerifiedQuoted(botConfig) });
                    
                    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
                    
                } catch (btnError) {
                    console.error('[Menu V5] Button error:', btnError.message);
                    
                    let catListText = `📋 *ᴋᴀᴛᴇɢᴏʀɪ ᴍᴇɴᴜ*\n\n`;
                    for (const cat of sortedCats) {
                        if (cat === 'owner' && !m.isOwner) continue;
                        const cmds = commandsByCategory[cat] || [];
                        if (cmds.length === 0) continue;
                        const emoji = CATEGORY_EMOJIS[cat] || '📁';
                        catListText += `> ${emoji} \`${prefix}menuhsn ${cat}\` - ${toMonoUpperBold(cat)} (${cmds.length})\n`;
                    }
                    catListText += `\n_Ketik perintah kategori untuk melihat command_`;
                    
                    const fallbackMsg = { contextInfo: getContextInfo(botConfig, m, thumbBuffer) };
                    if (imageBuffer) { fallbackMsg.image = imageBuffer; fallbackMsg.caption = headerText + '\n\n' + catListText; }
                    else { fallbackMsg.text = headerText + '\n\n' + catListText; }
                    await sock.sendMessage(m.chat, fallbackMsg, { quoted: getVerifiedQuoted(botConfig) });
                }
                break;
                
            case 6:

                const saluranIdV6 = botConfig.saluran?.id || 'https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o';
                const saluranNameV6 = botConfig.saluran?.name || botConfig.bot?.name || 'Hoshino Ai-Bot';
                const saluranLinkV6 = botConfig.saluran?.link || 'https://whatsapp.com/channel/0029VbB37bgBfxoAmAlsgE0t';
                
                let bannerThumbV6 = null;
                
                try {
                    const sourceBuffer = hsAsset.has('images/hsnai3') 
                        ? (await hsAsset.buffer('images/hsnai3')) 
                        : (thumbBuffer || imageBuffer);
                    
                    if (sourceBuffer) {
                        bannerThumbV6 = await sharp(sourceBuffer)
                            .resize(200, 200, { fit: 'inside' })
                            .jpeg({ quality: 90 })
                            .toBuffer();
                    }
                } catch (resizeErr) {
                    console.error('[Menu V6] Resize error:', resizeErr.message);
                    bannerThumbV6 = thumbBuffer;
                }
                
                const contextInfoV6 = {
                    mentionedJid: [m.sender],
                    forwardingScore: 9999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: saluranIdV6,
                        newsletterName: saluranNameV6,
                        serverMessageId: 127
                    },
                    linkPreview: {
                        'matched-text': config.info?.website || saluranLinkV6 || config.info?.grupwa || 'https://sc.hoshino-ai.my.id',
                        title: botConfig.bot?.name || 'Hoshino Ai-Bot',
                        description: `v${botConfig.bot?.version || '1.0.1'} • Fast Response Bot`,
                        previewType: 0,
                        jpegThumbnail: thumbBuffer || imageBuffer || undefined,
                        linkPreviewMetadata: {
                            linkMediaDuration: 0,
                            socialMediaPostType: 4
                        }
                    }
                };
                
                try {
                    await sock.sendMessage(m.chat, {
                        document: imageBuffer || Buffer.from('Hoshino Ai-Bot Menu'),
                        mimetype: 'application/pdf',
                        fileName: `ɴᴏ ᴘᴀɪɴ ɴᴏ ɢᴀɪɴ`,
                        fileLength: 9999999999,
                        caption: text,
                        jpegThumbnail: bannerThumbV6,
                        contextInfo: contextInfoV6
                    }, { quoted: getVerifiedQuoted(botConfig) });
                    
                } catch (v6Error) {
                    console.error('[Menu V6] Error:', v6Error.message);
                    const fallbackV6 = { contextInfo: getContextInfo(botConfig, m, thumbBuffer) };
                    if (imageBuffer) { fallbackV6.image = imageBuffer; fallbackV6.caption = text; }
                    else { fallbackV6.text = text; }
                    await sock.sendMessage(m.chat, fallbackV6, { quoted: getVerifiedQuoted(botConfig) });
                }
                break;
                
            case 7:
                try {
                    const { prepareWAMessageMedia } = require('hsnai');
                    const prefixV7 = botConfig.command?.prefix || '.';
                    const categoriesV7 = getCategories();
                    const commandsByCategoryV7 = getCommandsByCategory();
                    const categoryOrderV7 = ['main', 'utility', 'tools', 'fun', 'game', 'download', 'search', 'sticker', 'media', 'ai', 'group', 'religi', 'info'];
                    
                    const modeAllowedMapV7 = {
                        md: null,
                        cpanel: ['main', 'group', 'sticker', 'owner', 'tools', 'panel'],
                        store: ['main', 'group', 'sticker', 'owner', 'store'],
                        pushkontak: ['main', 'group', 'sticker', 'owner', 'pushkontak']
                    };
                    const modeExcludeMapV7 = {
                        md: ['panel', 'pushkontak', 'store'],
                        cpanel: null, store: null, pushkontak: null
                    };
                    
                    const allowedCatsV7 = modeAllowedMapV7[botMode];
                    const excludeCatsV7 = modeExcludeMapV7[botMode] || [];
                    
                    const sortedCatsV7 = categoriesV7.sort((a, b) => {
                        const indexA = categoryOrderV7.indexOf(a);
                        const indexB = categoryOrderV7.indexOf(b);
                        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                    });
                    
                    const carouselCards = [];
                    
                    for (const cat of sortedCatsV7) {
                        if (cat === 'owner' && !m.isOwner) continue;
                        if (allowedCatsV7 && !allowedCatsV7.includes(cat.toLowerCase())) continue;
                        if (excludeCatsV7 && excludeCatsV7.includes(cat.toLowerCase())) continue;
                        
                        const cmds = commandsByCategoryV7[cat] || [];
                        if (cmds.length === 0) continue;
                        
                        const emoji = CATEGORY_EMOJIS[cat] || '📁';
                        const categoryName = toSmallCaps(cat);
                        
                        let cardBody = `━━━━━━━━━━━━━━━\n`;
                        
                        for (const cmd of cmds.slice(0, 15)) {
                            cardBody += `◦ \`${prefixV7}${toSmallCaps(cmd)}\`\n`;
                        }
                        if (cmds.length > 15) {
                            cardBody += `\n_...dan ${cmds.length - 15} command lainnya_`;
                        }
                        
                        cardBody += `\n\n> Total: ${cmds.length} commands`;
                        
                        let cardMedia = null;
                        try {
                            const catThumb = await hsAsset.tryBuffer(`categories/${cat}`);

                            let sourceImage = hsAsset.has('images/hsnai-v7') ? (await hsAsset.buffer('images/hsnai-v7')) : thumbBuffer;
                            
                            if (catThumb) {
                                sourceImage = catThumb;
                            }
                            
                            if (sourceImage) {
                                const metaV7 = await sharp(sourceImage).metadata();
                                const resizedImage = await sharp(sourceImage)
                                    .resize(metaV7.width, metaV7.height, { fit: 'inside' })
                                    .jpeg({ quality: 80 })
                                    .toBuffer();
                                
                                cardMedia = await prepareWAMessageMedia({
                                    image: resizedImage
                                }, {
                                    upload: sock.waUploadToServer
                                });
                            }
                        } catch (e) {
                            console.error('[Menu V7] Card media error:', e.message);
                        }
                        
                        const cardMessage = {
                            header: proto.Message.InteractiveMessage.Header.fromObject({
                                title: `${emoji} ${categoryName.toUpperCase()}`,
                                hasMediaAttachment: !!cardMedia,
                                ...(cardMedia || {})
                            }),
                            body: proto.Message.InteractiveMessage.Body.fromObject({
                                text: cardBody
                            }),
                            footer: proto.Message.InteractiveMessage.Footer.create({
                                text: `${botConfig.bot?.name || 'Hoshino Ai'} • ${cat}`
                            }),
                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                                buttons: [{
                                    name: 'quick_reply',
                                    buttonParamsJson: JSON.stringify({
                                        display_text: `📋 Lihat ${categoryName}`,
                                        id: `${prefixV7}menuhsn ${cat}`
                                    })
                                }]
                            })
                        };
                        
                        carouselCards.push(cardMessage);
                    }
                    
                    if (carouselCards.length === 0) {
                        await m.reply(text);
                        break;
                    }
                    
                    const msg = await generateWAMessageFromContent(m.chat, {
                        viewOnceMessage: {
                            message: {
                                messageContextInfo: {
                                    deviceListMetadata: {},
                                    deviceListMetadataVersion: 2
                                },
                                interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                                    body: proto.Message.InteractiveMessage.Body.fromObject({
                                        text: `${getTimeGreeting()} *${m.pushName}!*\n\n> Geser untuk melihat kategori menu\n> Ketuk tombol untuk melihat detail`
                                    }),
                                    footer: proto.Message.InteractiveMessage.Footer.fromObject({
                                        text: `${botConfig.bot?.name || 'Hoshino Ai'} v${botConfig.bot?.version || '1.0'}`
                                    }),
                                    carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
                                        cards: carouselCards
                                    })
                                })
                            }
                        }
                    }, {
                        userJid: m.sender,
                        quoted: getVerifiedQuoted(botConfig)
                    });
                    
                    await sock.relayMessage(m.chat, msg.message, {
                        messageId: msg.key.id
                    });
                    
                } catch (carouselError) {
                    console.error('[Menu V7] Carousel error:', carouselError.message);
                    const fallbackV7 = { contextInfo: getContextInfo(botConfig, m, thumbBuffer) };
                    if (imageBuffer) { fallbackV7.image = imageBuffer; fallbackV7.caption = text; }
                    else { fallbackV7.text = text; }
                    await sock.sendMessage(m.chat, fallbackV7, { quoted: getVerifiedQuoted(botConfig) });
                }
                break;
                
            case 8:
                const timeHelperV8 = require('../../src/lib/timeHelper');
                const timeV8 = timeHelperV8.formatTime('HH:mm');
                const dateV8 = timeHelperV8.formatFull('DD/MM/YYYY');
                const userV8 = db.getUser(m.sender);
                const greetingV8 = getTimeGreeting();
                const uptimeV8 = formatUptime(uptime);
                
                const categoriesV8 = getCategories();
                const cmdsByCatV8 = getCommandsByCategory();
                let totalCmdV8 = 0;
                for (const cat of categoriesV8) {
                    totalCmdV8 += (cmdsByCatV8[cat] || []).length;
                }
                
                let roleV8 = '𝙐𝙨𝙚𝙧', emojiV8 = '◈';
                if (m.isOwner) { roleV8 = '𝙊𝙬𝙣𝙚𝙧'; emojiV8 = '♚'; }
                else if (m.isPremium) { roleV8 = '𝙋𝙧𝙚𝙢𝙞𝙪𝙢'; emojiV8 = '✦'; }
                
                const prefixV8 = botConfig.command?.prefix || '.';
                const catOrderV8 = ['main', 'ai', 'download', 'search', 'tools', 'fun', 'game', 'sticker', 'canvas', 'group', 'media', 'user', 'rpg', 'owner'];
                const sortedCatsV8 = [...categoriesV8].sort((a, b) => {
                    const iA = catOrderV8.indexOf(a.toLowerCase());
                    const iB = catOrderV8.indexOf(b.toLowerCase());
                    return (iA === -1 ? 999 : iA) - (iB === -1 ? 999 : iB);
                });
                
                const modeAllowV8 = {
                    md: null,
                    cpanel: ['main', 'group', 'sticker', 'owner', 'tools', 'panel'],
                    store: ['main', 'group', 'sticker', 'owner', 'store'],
                    pushkontak: ['main', 'group', 'sticker', 'owner', 'pushkontak']
                };
                const modeExcludeV8 = {
                    md: ['panel', 'pushkontak', 'store'],
                    cpanel: null, store: null, pushkontak: null
                };
                const allowV8 = modeAllowV8[botMode];
                const excludeV8 = modeExcludeV8[botMode] || [];
                
                let menuV8 = ``;
                
                const sparkles = ['✦', '✧', '⋆', '˚', '✵', '⊹'];
                const randomSparkle = () => sparkles[Math.floor(Math.random() * sparkles.length)];
                
                menuV8 += `${randomSparkle()}━━━━━━━━━━━━━━━━━━━━━${randomSparkle()}\n`;
                menuV8 += `*${botConfig.bot?.name || '𝗢𝗨𝗥𝗜𝗡-𝗔𝗜'}*\n`;
                menuV8 += `${randomSparkle()}━━━━━━━━━━━━━━━━━━━━━${randomSparkle()}\n\n`;
                
                menuV8 += `┏━━━〔 ${emojiV8} *𝗣𝗥𝗢𝗙𝗜𝗟𝗘* 〕━━━┓\n`;
                menuV8 += `┃ 👤 *${m.pushName}*\n`;
                menuV8 += `┃ 🏷️ ${roleV8}\n`;
                menuV8 += `┃ ⏰ ${timeV8} WIB\n`;
                menuV8 += `┃ 📅 ${dateV8}\n`;
                menuV8 += `┗━━━━━━━━━━━━━━━┛\n\n`;
                
                menuV8 += `┏━━〔 ⚡ *𝗦𝗬𝗦𝗧𝗘𝗠 𝗦𝗧𝗔𝗧𝗦* 〕━━┓\n`;
                menuV8 += `┃ 🎫 Limit   ➤ ${m.isOwner || m.isPremium ? '∞ Unlimited' : `${userV8?.limit ?? 25}/25`}\n`;
                menuV8 += `┃ ⏱️ Uptime  ➤ ${uptimeV8}\n`;
                menuV8 += `┃ 🔧 Mode    ➤ ${botMode.toUpperCase()}\n`;
                menuV8 += `┃ 📊 Total   ➤ ${totalCmdV8} Commands\n`;
                menuV8 += `┃ 👥 Users   ➤ ${db.getUserCount()} Aktif\n`;
                menuV8 += `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
                
                menuV8 += `╭══════════════════════╮\n`;
                menuV8 += `║  📋 *𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗟𝗜𝗦𝗧*    ║\n`;
                menuV8 += `╰══════════════════════╯\n\n`;
                
                for (const cat of sortedCatsV8) {
                    if (cat === 'owner' && !m.isOwner) continue;
                    if (allowV8 && !allowV8.includes(cat.toLowerCase())) continue;
                    if (excludeV8.includes(cat.toLowerCase())) continue;
                    
                    const cmdsV8 = cmdsByCatV8[cat] || [];
                    if (cmdsV8.length === 0) continue;
                    
                    const emojiCat = CATEGORY_EMOJIS[cat] || '▣';
                    menuV8 += `┌─────「 ${emojiCat} *${cat.toUpperCase()}* 」\n`;
                    menuV8 += `│ ✦ Total: ${cmdsV8.length} commands\n`;
                    menuV8 += `│\n`;
                    
                    for (const cmd of cmdsV8) {
                        menuV8 += `│ ├➤ ${prefixV8}${cmd}\n`;
                    }
                    menuV8 += `│\n`;
                    menuV8 += `└───────────────────\n\n`;
                }
                
                menuV8 += `╭━━〔 💡 *𝗧𝗜𝗣𝗦* 〕━━╮\n`;
                menuV8 += `│ ❸ Follow channel ${config.saluran?.link || 'Hoshino Ai-Bot'}\n`;
                menuV8 += `╰━━━━━━━━━━━━━━━━━━╯\n\n`;
                
                menuV8 += `> ${randomSparkle()} *${botConfig.bot?.name}* v${botConfig.bot?.version || '1.7.1'} ${randomSparkle()}`;
                
                
                let thumbV8 = thumbBuffer;
                if (thumbBuffer) {
                    try {
                        thumbV8 = await sharp(thumbBuffer)
                            .resize(300, 300, { fit: 'cover' })
                            .jpeg({ quality: 80 })
                            .toBuffer();
                    } catch (e) {
                        thumbV8 = thumbBuffer;
                    }
                }
                
                const ftroliQuoted = {
                    key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast' },
                    message: {
                        orderMessage: {
                            orderId: '1337',
                            thumbnail: thumbV8 || null,
                            itemCount: totalCmdV8,
                            status: 'INQUIRY',
                            surface: 'CATALOG',
                            message: `${botConfig.bot?.name || 'Hoshino Ai-Bot'} Menu`,
                            orderTitle: `📋 ${totalCmdV8} Commands`,
                            sellerJid: botConfig.botNumber ? `${botConfig.botNumber}@s.whatsapp.net` : m.sender,
                            token: 'hsnai-menu-v8',
                            totalAmount1000: 0,
                            totalCurrencyCode: 'IDR',
                            contextInfo: {
                                isForwarded: true,
                                forwardingScore: 9999,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: botConfig.saluran?.id || 'https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o',
                                    newsletterName: botConfig.saluran?.name || botConfig.bot?.name || 'Hoshino Ai-Bot',
                                    serverMessageId: 127
                                }
                            }
                        }
                    }
                };
                
                await sock.sendMessage(m.chat, {
                    image: (await hsAsset.buffer('images/hsnai-v8')),
                    caption: menuV8,
                    contextInfo: getContextInfo(botConfig, m, imageBuffer, true)
                }, { quoted: ftroliQuoted });
                break;
                
            case 9:
                try {
                    const { prepareWAMessageMedia } = require('hsnai');
                    const prefixV9 = botConfig.command?.prefix || '.';
                    const categoriesV9 = getCategories();
                    const cmdsByCatV9 = getCommandsByCategory();
                    const saluranIdV9 = botConfig.saluran?.id || 'https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o';
                    const saluranNameV9 = botConfig.saluran?.name || botConfig.bot?.name || 'Hoshino Ai-Bot';
                    const saluranLinkV9 = botConfig.saluran?.link || 'https://whatsapp.com/channel/0029VbB37bgBfxoAmAlsgE0t';
                    
                    const { getCasesByCategory: getCasesCatV9 } = require('../../case/hsnai');
                    const casesCatV9 = getCasesCatV9();
                    
                    const categoryOrderV9 = ['main', 'owner', 'utility', 'tools', 'fun', 'game', 'download', 'search', 'sticker', 'media', 'ai', 'group', 'religi', 'info', 'cek', 'economy', 'user', 'canvas', 'random', 'premium', 'ephoto', 'jpm'];
                    const allowV9 = botMode === 'md' ? null : ['main', 'group', 'sticker', 'owner', 'tools'];
                    const excludeV9 = ['panel', 'pushkontak', 'store'];
                    
                    const sortedCatsV9 = [...categoriesV9].sort((a, b) => {
                        const indexA = categoryOrderV9.indexOf(a);
                        const indexB = categoryOrderV9.indexOf(b);
                        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                    });
                    
                    const menuRowsV9 = [];
                    for (const cat of sortedCatsV9) {
                        if (cat === 'owner' && !m.isOwner) continue;
                        if (allowV9 && !allowV9.includes(cat.toLowerCase())) continue;
                        if (excludeV9.includes(cat.toLowerCase())) continue;
                        
                        const pluginCmdsV9 = cmdsByCatV9[cat] || [];
                        const caseCmdsV9 = casesCatV9[cat] || [];
                        const totalCmdsV9 = pluginCmdsV9.length + caseCmdsV9.length;
                        if (totalCmdsV9 === 0) continue;
                        
                        const emojiCat = CATEGORY_EMOJIS[cat] || '📁';
                        menuRowsV9.push({
                            title: `${emojiCat} ${cat.toUpperCase()}`,
                            description: `${totalCmdsV9} commands`,
                            id: `${prefixV9}menuhsn ${cat}`
                        });
                    }
                    
                    let headerMediaV9 = null;
                    if (imageBuffer) {
                        try {
                            const imgRawV9 = (await hsAsset.buffer('images/hsnai-v9'));
                            const metaV9 = await sharp(imgRawV9).metadata();
                            const resizedV9 = await sharp(imgRawV9)
                                .resize(metaV9.width, metaV9.height, { fit: 'inside' })
                                .jpeg({ quality: 80 })
                                .toBuffer();
                            headerMediaV9 = await prepareWAMessageMedia({
                                image: resizedV9
                            }, { upload: sock.waUploadToServer });
                        } catch (e) {
                            console.error('[Menu V9] Media prep error:', e.message);
                        }
                    }

                    const seaerz = "https://wa.me/" + config.owner?.number?.[0]
                    
                    const buttonsV9 = [
                        {
                            name: "single_select",
                            buttonParamsJson: JSON.stringify({ 
                                has_multiple_buttons: true,
                            })
                        },
                        {
                            name: "cta_url",
                            buttonParamsJson: JSON.stringify({
                                display_text: "Nomor Owner ku",
                                url: seaerz,
                                merchant_url: seaerz
                            })
                        },
                        {
                            name: "quick_reply",
                            buttonParamsJson: JSON.stringify({
                                display_text: "🧾 Tampilkan Semua Menu",
                                id: `${m.prefix}allmenu`,
                            })
                        },
                        
                    ];
                    
                    const msgV9 = generateWAMessageFromContent(m.chat, {
                        viewOnceMessage: {
                            message: {
                                messageContextInfo: {
                                    deviceListMetadata: {},
                                    deviceListMetadataVersion: 2
                                },
                                interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                                    body: proto.Message.InteractiveMessage.Body.fromObject({
                                        text: text
                                    }),
                                    footer: proto.Message.InteractiveMessage.Footer.fromObject({
                                        text: `© ${botConfig.bot?.name || 'Hoshino Ai-Bot'} v${botConfig.bot?.version || '1.9.0'}`
                                    }),
                                    header: proto.Message.InteractiveMessage.Header.fromObject({
                                        hasMediaAttachment: !!headerMediaV9,
                                        ...(headerMediaV9 || {})
                                    }),
                                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                                        messageParamsJson: JSON.stringify({
                                            limited_time_offer: {
                                                text: botConfig.bot?.name || 'Hoshino Ai-Bot',
                                                url: saluranLinkV9,
                                                copy_code: botConfig.owner?.name || 'Hoshino Ai-Bot',
                                                expiration_time: Date.now() * 999
                                            },
                                            bottom_sheet: {
                                                in_thread_buttons_energi: 2,
                                                divider_indices: [1, 2, 3, 4, 5, 999],
                                                list_title: botConfig.bot?.name || 'Hoshino Ai-Bot',
                                                button_title: '🍀 ριℓιн кαтєgσяι'
                                            },
                                        }),
                                        buttons: buttonsV9
                                    }),
                                    contextInfo: {
                                        mentionedJid: [m.sender],
                                        forwardingScore: 9999,
                                        isForwarded: true,
                                        forwardedNewsletterMessageInfo: {
                                            newsletterJid: saluranIdV9,
                                            newsletterName: saluranNameV9,
                                            serverMessageId: 127
                                        }
                                    }
                                })
                            }
                        }
                    }, { userJid: m.sender, quoted: getVerifiedQuoted(botConfig) });
                    
                    await sock.relayMessage(m.chat, msgV9.message, { messageId: msgV9.key.id });
                    
                } catch (v9Error) {
                    console.error('[Menu V9] Error:', v9Error.message);
                    const fallbackV9 = { contextInfo: getContextInfo(botConfig, m, thumbBuffer) };
                    if (imageBuffer) { fallbackV9.image = imageBuffer; fallbackV9.caption = text; }
                    else { fallbackV9.text = text; }
                    await sock.sendMessage(m.chat, fallbackV9, { quoted: getVerifiedQuoted(botConfig) });
                }
                break;
                
            case 10:
                try {
                    const { prepareWAMessageMedia } = require('hsnai');
                    const prefixV10 = botConfig.command?.prefix || '.';
                    const categoriesV10 = getCategories();
                    const cmdsByCatV10 = getCommandsByCategory();
                    const saluranIdV10 = botConfig.saluran?.id || 'https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o';
                    const saluranNameV10 = botConfig.saluran?.name || botConfig.bot?.name || 'Hoshino Ai-Bot';
                    const timeHelper = require('../../src/lib/timeHelper');
                    const timeStrV10 = timeHelper.formatTime('HH:mm:ss');
                    const uptimeFmtV10 = formatUptime(uptime);
                    
                    let totalCmdV10 = 0;
                    for (const cat of categoriesV10) {
                        totalCmdV10 += (cmdsByCatV10[cat] || []).length;
                    }
                    
                    const { getCasesByCategory, getCaseCount } = require('../../case/hsnai');
                    const caseCats = getCasesByCategory();
                    const caseCountV10 = getCaseCount();
                    totalCmdV10 += caseCountV10;
                    
                    const categoryOrderV10 = ['main', 'owner', 'utility', 'tools', 'fun', 'game', 'download', 'search', 'sticker', 'media', 'ai', 'group', 'religi', 'info', 'cek', 'economy', 'user', 'canvas', 'random', 'premium'];
                    const allowV10 = botMode === 'md' ? null : ['main', 'group', 'sticker', 'owner', 'tools'];
                    const excludeV10 = ['panel', 'pushkontak', 'store'];
                    
                    const sortedCatsV10 = [...categoriesV10].sort((a, b) => {
                        const indexA = categoryOrderV10.indexOf(a);
                        const indexB = categoryOrderV10.indexOf(b);
                        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                    });
                    
                    const menuRowsV10 = [];
                    for (const cat of sortedCatsV10) {
                        if (cat === 'owner' && !m.isOwner) continue;
                        if (allowV10 && !allowV10.includes(cat.toLowerCase())) continue;
                        if (excludeV10.includes(cat.toLowerCase())) continue;
                        
                        const pluginCmds = cmdsByCatV10[cat] || [];
                        const caseCmds = caseCats[cat] || [];
                        const totalCmds = pluginCmds.length + caseCmds.length;
                        if (totalCmds === 0) continue;
                        
                        const emojiCat = CATEGORY_EMOJIS[cat] || '📁';
                        menuRowsV10.push({
                            title: `${emojiCat} ${cat.toUpperCase()}`,
                            description: `${totalCmds} commands`,
                            id: `${m.prefix}menuhsn ${cat}`
                        });
                    }
                    
                    let productImageV10 = null;
                    try {

                        const imgBufferV10 = await variantImage('hsnai-v10', hsAsset.has('images/hsnai-v9')
    ? (await hsAsset.buffer('images/hsnai-v9'))
    : (imageBuffer || thumbBuffer));
                        
                                                if (imgBufferV10) {
                            const metaV10 = await sharp(imgBufferV10).metadata();
                            const origW = metaV10.width || 1920;
                            const origH = metaV10.height || 1080;

                            // Canvas target: lebar 900, tinggi proporsional dari ratio asli gambar (min 480)
                            const canvasW = 900;
                            const canvasH = Math.max(480, Math.round(canvasW * origH / origW));

                            // Scale agar pas dalam canvas (tidak dipotong, tidak distorsi)
                            const scaledBuf = await sharp(imgBufferV10)
                                .resize(canvasW, canvasH, { fit: 'inside', withoutEnlargement: false })
                                .flatten({ background: { r: 10, g: 10, b: 10 } })
                                .toBuffer();

                            const scaledMeta = await sharp(scaledBuf).metadata();
                            const padTop = Math.floor((canvasH - scaledMeta.height) / 2);
                            const padBottom = canvasH - scaledMeta.height - padTop;
                            const padLeft = Math.floor((canvasW - scaledMeta.width) / 2);
                            const padRight = canvasW - scaledMeta.width - padLeft;

                            // Extend ke ukuran canvas, tanpa resize ulang
                            const resizedV10 = await sharp(scaledBuf)
                                .extend({
                                    top: padTop,
                                    bottom: padBottom,
                                    left: padLeft,
                                    right: padRight,
                                    background: { r: 10, g: 10, b: 10 }
                                })
                                .jpeg({ quality: 88 })
                                .toBuffer();

                            productImageV10 = await prepareWAMessageMedia({
                                image: resizedV10
                            }, { upload: sock.waUploadToServer });
                        }
                    } catch (e) {
                        console.error('[Menu V10] Media prep error:', e.message);
                    }
                    
                    const footerTextV10 = `
Hai *@${m.pushName || "User"}* 🪸

Aku ${botConfig.bot?.name || 'Hoshino Ai-Bot'}, bot WhatsApp yang siap bantu kamu.  

Kamu bisa pakai aku buat cari info, ambil data, atau bantu hal-hal sederhana langsung lewat WhatsApp — praktis tanpa ribet.

─────────────────────────
Nama    : ${botConfig.bot?.name || 'Hoshino Ai-Bot'}
Versi : v${botConfig.bot?.version || '1.9.0'}
Runtime : Node.js ${process.version}
Bot Up  : ${uptimeFmtV10}

Owner ku kak   : ${botConfig.owner?.name || 'SeaPRST || Died100'}
─────────────────────────
Klik tombol di bawah untuk menampilkan menu
`;
                    
                    const buttonsV10 = [{
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: botConfig.bot?.name || 'Hoshino Ai-Bot',
                            id: `${m.prefix}allmenu`,
                            
                        })
                    }];
                    
                    const productId = `Sea Sea Sea Sea Sea :)`;
                    const businessJid = botConfig.botNumber 
                        ? `${botConfig.botNumber}@s.whatsapp.net` 
                        : (m.botJid || sock.user?.id);
                    
                    const msgV10 = generateWAMessageFromContent(m.chat, {
                        viewOnceMessage: {
                            message: {
                                messageContextInfo: {
                                    deviceListMetadata: {},
                                    deviceListMetadataVersion: 2
                                },
                                interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                                    header: proto.Message.InteractiveMessage.Header.fromObject({
                                        title: `${botConfig.bot?.name || 'Hoshino Ai-Bot'} Menu`,
                                        hasMediaAttachment: !!productImageV10,
                                        productMessage: {
                                            product: {
                                                productImage: productImageV10?.imageMessage || null,
                                                productId: productId,
                                                title: `${botConfig.bot?.name || 'Hoshino Ai-Bot'} Menu`,
                                                description: 'Menu',
                                                currencyCode: 'USD',
                                                priceAmount1000: '1000000000000000',
                                                retailerId: botConfig.bot?.name || 'Hoshino Ai',
                                                productImageCount: 1
                                            },
                                            businessOwnerJid: businessJid
                                        }
                                    }),
                                    body: proto.Message.InteractiveMessage.Body.fromObject({
                                        text: `*© ${botConfig.bot?.name || 'Hoshino Ai-Bot'} 2026*`
                                    }),
                                    footer: proto.Message.InteractiveMessage.Footer.fromObject({
                                        text: footerTextV10
                                    }),
                                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                                        buttons: buttonsV10
                                    }),
                                    contextInfo: {
                                        mentionedJid: [m.sender],
                                        forwardingScore: 9999,
                                        isForwarded: true,
                                        forwardedNewsletterMessageInfo: {
                                            newsletterJid: saluranIdV10,
                                            newsletterName: saluranNameV10,
                                            serverMessageId: 127
                                        }
                                    }
                                })
                            }
                        }
                    }, { userJid: m.sender, quoted: getVerifiedQuoted(botConfig) });
                    
                    await sock.relayMessage(m.chat, msgV10.message, { messageId: msgV10.key.id });
                    
                } catch (v10Error) {
                    console.error('[Menu V10] Error:', v10Error.message);
                    const fallbackV10 = { contextInfo: getContextInfo(botConfig, m, thumbBuffer) };
                    if (imageBuffer) { fallbackV10.image = imageBuffer; fallbackV10.caption = text; }
                    else { fallbackV10.text = text; }
                    await sock.sendMessage(m.chat, fallbackV10, { quoted: getVerifiedQuoted(botConfig) });
                }
                break;
                
            case 11:
                try {
                    const saluranIdV11 = botConfig.saluran?.id || 'https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o';
                    const saluranNameV11 = botConfig.saluran?.name || botConfig.bot?.name || 'Hoshino Ai-Bot';
                    const docuThumbV11 = thumbBuffer || imageBuffer || (await hsAsset.buffer('images/hsnai-allmenu'));
                    const prefix = botConfig.command?.prefix || '.';
                const saluranId = botConfig.saluran?.id || 'https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o';
                const saluranName = botConfig.saluran?.name || botConfig.bot?.name || 'Hoshino Ai-Bot';
                
                const categories = getCategories();
                const commandsByCategory = getCommandsByCategory();
                const categoryOrder = ['owner', 'main', 'utility', 'tools', 'fun', 'game', 'download', 'search', 'sticker', 'media', 'ai', 'group', 'religi', 'info', 'jpm', 'pushkontak', 'panel', 'user'];
                
                const sortedCats = [...categories].sort((a, b) => {
                    const indexA = categoryOrder.indexOf(a);
                    const indexB = categoryOrder.indexOf(b);
                    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                });
                
                const toMonoUpperBold = (text) => {
                    const chars = {
                        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚',
                        'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡',
                        'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨',
                        'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭'
                    };
                    return text.toUpperCase().split('').map(c => chars[c] || c).join('');
                };
                
                const categoryRows = [];
                
                const modeAllowedMap = {
                    md: null,
                    cpanel: ['main', 'group', 'sticker', 'owner', 'tools', 'panel'],
                    store: ['main', 'group', 'sticker', 'owner', 'store'],
                    pushkontak: ['main', 'group', 'sticker', 'owner', 'pushkontak']
                };
                const modeExcludeMap = {
                    md: ['panel', 'pushkontak', 'store'],
                    cpanel: null,
                    store: null,
                    pushkontak: null
                };
                
                const allowedCats = modeAllowedMap[botMode];
                const excludeCats = modeExcludeMap[botMode] || [];
                
                for (const cat of sortedCats) {
                    if (cat === 'owner' && !m.isOwner) continue;
                    if (allowedCats && !allowedCats.includes(cat.toLowerCase())) continue;
                    if (excludeCats && excludeCats.includes(cat.toLowerCase())) continue;
                    
                    const cmds = commandsByCategory[cat] || [];
                    if (cmds.length === 0) continue;
                    
                    const emoji = CATEGORY_EMOJIS[cat] || '📁';
                    const title = `${emoji} ${toMonoUpperBold(cat)}`;
                    
                    categoryRows.push({
                        header: `${toMonoUpperBold('MENU ' + title)}`,
                        id: `${prefix}menuhsn ${cat}`,
                        title: `Berisi ${cmds.length} Perintah`,
                        description: 'Tap untuk membuka menu category ini'
                    });
                }
                
                let totalCmds = 0;
                for (const cat of categories) {
                    totalCmds += (commandsByCategory[cat] || []).length;
                }
                    await sock.sendMessage(m.chat, {
                        interactiveMessage: {
                            title: `Hallo Kak *@${m.pushName}*
                            
Sebelumnya, terima kasih yak sudah menggunakan bot kami

╭─ \`INFORMASI BOT\` 𝜗ৎ
┆ ᵎᵎ Nama Bot : *${botConfig.bot?.name || 'Hoshino Ai-Bot'}*
┆ ᵎᵎ Owner Bot : *${botConfig.owner?.name || 'Hoshino Ai-Bot'}*
┆ ᵎᵎ Prefix : *${botConfig.command?.prefix || '.'}*
┆ ᵎᵎ Total Perintah : *${totalCmds}*
┆ ᵎᵎ Role Kamu : ${m.isOwner ? 'Owner' : m.isPremium ? "Premium" : "User Biasa"}
╰─────

silahkan tekan tombol dibawah untuk memilih menu`,
                            footer: botConfig.settings?.footer || `© ${botConfig.bot?.name || 'Hoshino Ai-Bot'} 2026`,
                            document: fs.readFileSync('./package.json'),
                            mimetype: 'image/png',
                            fileName: `${getTimeGreeting()}`,
                            jpegThumbnail: await sharp(docuThumbV11).resize({ width: 300, height: 300 }).toBuffer(),
                            contextInfo: {
                                mentionedJid: [m.sender],
                                forwardingScore: 777,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: saluranIdV11,
                                    newsletterName: saluranNameV11,
                                    serverMessageId: 127
                                }
                            },
                                                        jpegThumbnail: await (async () => {
                                try {
                                    if (!hsAsset.has('images/hsnai-v11')) return undefined
                                    return await sharp(await hsAsset.buffer('images/hsnai-v11')).resize(300, 300, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer()
                                } catch { return undefined }
                            })(),
                            nativeFlowMessage: {
                                messageParamsJson: JSON.stringify({
                                    limited_time_offer: {
                                        text: `Gunakan bot ini dengan bijak yak`,
                                        url: botConfig.saluran?.link || 'https://whatsapp.com/channel/0029VbB37bgBfxoAmAlsgE0t',
                                        copy_code: botConfig.bot?.name || 'Hoshino Ai-Bot',
                                        expiration_time: Date.now() * 999
                                    },
                                    bottom_sheet: {            
                                        in_thread_buttons_limit: 2,            
                                        divider_indices: [1, 2, 3, 4, 5, 999],            
                                        list_title: "Pilih Menu",            
                                        button_title: "🍀 Pilih Menu Disini"          
                                    },    
                                    tap_target_configuration: {            
                                        title: " X ",            
                                        description: "bomboclard",            
                                        canonical_url: "https://Hoshino Ai.site",            
                                        domain: "shop.example.com",            
                                        button_index: 0          
                                    }  
                                }),
                                buttons: [
                                    {            
                                        name: "single_select",            
                                        buttonParamsJson: JSON.stringify({              
                                            has_multiple_buttons: true            
                                        })          
                                    },
                                    {            
                                        name: "call_permission_request",            
                                        buttonParamsJson: JSON.stringify({              
                                            has_multiple_buttons: true            
                                        })          
                                    }, 
                                    {            
                                        name: "single_select",            
                                        buttonParamsJson: JSON.stringify({              
                                            title: "Pilihan Menu",              
                                            sections: [                
                                                {                  
                                                    title: "🍀 Silahkan pilih menu yang kamu inginkan",                  
                                                    highlight_label: botConfig.bot?.name || 'Hoshino Ai-Bot',                  
                                                    rows: categoryRows                  
                                                }              
                                            ], 
                                            has_multiple_buttons: true                     
                                        })          
                                    },          
                                    {
                                        name: 'cta_url',
                                        buttonParamsJson: JSON.stringify({
                                            display_text: '🌏 Kunjungi Saluran Kami',
                                            url: botConfig.saluran?.link || 'https://whatsapp.com/channel/0029VbB37bgBfxoAmAlsgE0t',
                                            merchant_url: botConfig.saluran?.link || 'https://whatsapp.com/channel/0029VbB37bgBfxoAmAlsgE0t'
                                        })
                                    },
                                    {
                                        name: 'quick_reply',
                                        buttonParamsJson: JSON.stringify({
                                            display_text: '🖐 Owner Kami',
                                            id: `${m.prefix}owner`
                                        })
                                    },
                                    {
                                        name: 'quick_reply',
                                        buttonParamsJson: JSON.stringify({
                                            display_text: '🌺 Lihat Semua Menu',
                                            id: `${m.prefix}allmenu`
                                        })
                                    },  
                                ]
                            }
                        }
                    }, { quoted: getVerifiedQuoted(botConfig) });
                    
                } catch (v11Error) {
                    console.error('[Menu V11] Error:', v11Error.message);
                    const fallbackV11 = { contextInfo: getContextInfo(botConfig, m, thumbBuffer) };
                    if (imageBuffer) { fallbackV11.image = imageBuffer; fallbackV11.caption = text; }
                    else { fallbackV11.text = text; }
                    await sock.sendMessage(m.chat, fallbackV11, { quoted: getVerifiedQuoted(botConfig) });
                }
                break;
            case 12:
                try {
                    const saluranIdV12 = botConfig.saluran?.id || 'https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o';
                    const saluranNameV12 = botConfig.saluran?.name || botConfig.bot?.name || 'Hoshino Ai-Bot';
                    const docuThumbV12 = thumbBuffer || imageBuffer || (await hsAsset.buffer('images/hsnai-allmenu'));
                    const prefix = botConfig.command?.prefix || '.';
                const saluranId = botConfig.saluran?.id || 'https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o';
                const saluranName = botConfig.saluran?.name || botConfig.bot?.name || 'Hoshino Ai-Bot';
                
                const categories = getCategories();
                const commandsByCategory = getCommandsByCategory();
                const categoryOrder = ['owner', 'main', 'utility', 'tools', 'fun', 'game', 'download', 'search', 'sticker', 'media', 'ai', 'group', 'religi', 'info', 'jpm', 'pushkontak', 'panel', 'user'];
                
                const sortedCats = [...categories].sort((a, b) => {
                    const indexA = categoryOrder.indexOf(a);
                    const indexB = categoryOrder.indexOf(b);
                    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                });
                
                const toMonoUpperBold = (text) => {
                    const chars = {
                        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚',
                        'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡',
                        'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨',
                        'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭'
                    };
                    return text.toUpperCase().split('').map(c => chars[c] || c).join('');
                };
                
                const categoryRows = [];
                
                const modeAllowedMap = {
                    md: null,
                    cpanel: ['main', 'group', 'sticker', 'owner', 'tools', 'panel'],
                    store: ['main', 'group', 'sticker', 'owner', 'store'],
                    pushkontak: ['main', 'group', 'sticker', 'owner', 'pushkontak']
                };
                const modeExcludeMap = {
                    md: ['panel', 'pushkontak', 'store'],
                    cpanel: null,
                    store: null,
                    pushkontak: null
                };
                
                const allowedCats = modeAllowedMap[botMode];
                const excludeCats = modeExcludeMap[botMode] || [];
                
                for (const cat of sortedCats) {
                    if (cat === 'owner' && !m.isOwner) continue;
                    if (allowedCats && !allowedCats.includes(cat.toLowerCase())) continue;
                    if (excludeCats && excludeCats.includes(cat.toLowerCase())) continue;
                    
                    const cmds = commandsByCategory[cat] || [];
                    if (cmds.length === 0) continue;
                    
                    const emoji = CATEGORY_EMOJIS[cat] || '📁';
                    const title = `${emoji} ${toMonoUpperBold(cat)}`;
                    
                    categoryRows.push({
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: `${toMonoUpperBold(cat)}`,
                            id: `${m.prefix}menuhsn ${cat}`
                        })
                    });
                }
                
                let totalCmds = 0;
                for (const cat of categories) {
                    totalCmds += (commandsByCategory[cat] || []).length;
                }
                    function formatBytes(bytes, decimals = 2) {
                        if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
                        if (bytes === 0) return "0 B";
                        const k = 1024;
                        const units = ["B", "KB", "MB", "GB", "TB"];
                        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
                        const value = bytes / Math.pow(k, i);
                        const fixed = value.toFixed(decimals);
                        const pretty = fixed.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
                        return `${pretty} ${units[i]}`;
                    }
                    const obj = JSON.parse(fs.readFileSync('./database/main/users.json'));
                    const jsonStr = JSON.stringify(obj);
                    const bytes = Buffer.byteLength(jsonStr, "utf8");
                    let pp
                    try {
                        pp = Buffer.from((await axios.get(await sock.profilePictureUrl(m.sender, 'image'), { responseType: 'arraybuffer' })).data)
                    } catch (error) {
                        pp = (await hsAsset.buffer('images/pp-kosong'))
                    }
                    const zanton = [
                        {            
                            name: "single_select",            
                            buttonParamsJson: JSON.stringify({              
                                has_multiple_buttons: true            
                            })          
                        },
                        {            
                            name: "call_permission_request",            
                            buttonParamsJson: JSON.stringify({              
                                has_multiple_buttons: true            
                            })          
                        },       
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: 'Lihat Semua Menu',
                                id: `${m.prefix}allmenu`
                            })
                        },  
                    ]
                    zanton.push(...categoryRows)
                    await sock.sendMessage(m.chat, {
                        interactiveMessage: {
                            title: `🌾 *𝘏𝘪! ${m.pushName}*

𝘛𝘩𝘢𝘯𝘬𝘴 𝘧𝘰𝘳 𝘮𝘦𝘴𝘴𝘢𝘨𝘪𝘯𝘨 𝘶𝘴. 𝘠𝘰𝘶’𝘳𝘦 𝘯𝘰𝘸 𝘤𝘩𝘢𝘵𝘵𝘪𝘯𝘨 𝘸𝘪𝘵𝘩 𝘰𝘶𝘳 𝘈𝘶𝘵𝘰𝘮𝘢𝘵𝘪𝘤 𝘞𝘩𝘢𝘵𝘴𝘈𝘱𝘱 𝘉𝘰𝘵. 

╭─「 *${m.pushName}* 」
│ • Bot Version     : *${botConfig.bot?.version || '2.1.0'}*
│ • Database         : ${formatBytes(bytes)}
╰──`,
                            footer: botConfig.settings?.footer || `© ${botConfig.bot?.name || 'Hoshino Ai-Bot'} 2026`,
                            document: fs.readFileSync('./package.json'),
                            mimetype: 'image/png',
                            fileName: `${getTimeGreeting()}`,
                            jpegThumbnail: await sharp(pp).resize({ width: 300, height: 300 }).toBuffer(),
                            contextInfo: {
                                mentionedJid: [m.sender],
                                forwardingScore: 777,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: saluranIdV12,
                                    newsletterName: saluranNameV12,
                                    serverMessageId: 127
                                }
                            },
                                                        jpegThumbnail: await (async () => {
                                try {
                                    const src = hsAsset.has('images/hsnai-v12')
                                        ? (await hsAsset.buffer('images/hsnai-v12'))
                                        : (hsAsset.has('images/hsnai-v11') ? (await hsAsset.buffer('images/hsnai-v11')) : null)
                                    if (!src) return undefined
                                    return await sharp(src).resize(300, 300, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer()
                                } catch { return undefined }
                            })(),
                            nativeFlowMessage: {
                                messageParamsJson: JSON.stringify({
                                    bottom_sheet: {            
                                        in_thread_buttons_limit: 2,            
                                        divider_indices: [1, 2, 3, 4, 5, 999],            
                                        list_title: "SIlahkan pilih category yang ingin dilihat",            
                                        button_title: "🧾 Tap Here!"          
                                    },    
                                    tap_target_configuration: {            
                                        title: " X ",            
                                        description: "bomboclard",            
                                        canonical_url: "https://Hoshino Ai.site",            
                                        domain: "shop.example.com",            
                                        button_index: 0          
                                    }  
                                }),
                                buttons: zanton
                            }
                        }
                    }, { quoted: {
                        key: {remoteJid: '0@s.whatsapp.net', fromMe: false, id: `ownername`, participant: '0@s.whatsapp.net'}, message: {requestPaymentMessage: {currencyCodeIso4217: "USD", amount1000: 999999999, requestFrom: '0@s.whatsapp.net', noteMessage: { extendedTextMessage: { text: `${botConfig?.bot?.name}`}}, expiryTimestamp: 999999999, amount: {value: 91929291929, offset: 1000, currencyCode: "USD"}}}
                    } });
                } catch (v12Error) {
                    console.error('[Menu V12] Error:', v12Error.message);
                    const fallbackV12 = { contextInfo: getContextInfo(botConfig, m, thumbBuffer) };
                    if (imageBuffer) { fallbackV12.image = imageBuffer; fallbackV12.caption = text; }
                    else { fallbackV12.text = text; }
                    await sock.sendMessage(m.chat, fallbackV12, { quoted: {
                        key: {participant: '0@s.whatsapp.net', ...(m.chat ? {remoteJid: `status@broadcast`} : {})}, message: {locationMessage: {name: `${namaOwner}`,jpegThumbnail: ""}}
                    } });
                }
                break;
                
                        case 13: {

                const categories = getCategories();
                const commandsByCategory = getCommandsByCategory();

                const toMonoUpperBold = (text) => {
                    const chars = {
                        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚',
                        'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡',
                        'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨',
                        'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭'
                    };
                    return text.toUpperCase().split('').map(c => chars[c] || c).join('');
                };

                let totalCmds = 0;
                for (const cat of categories) {
                    totalCmds += (commandsByCategory[cat] || []).length;
                }

                let bannerThumbV13 = null;

                try {
                    const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

                    /**
                     * Kartu profil V13 — 1280x560, tema idol stage Hoshino Ai
                     * @param {Object} data { name, level, currentXp, requiredXp, totalExp, rank, role, totalCmds, botName, dateStr, avatarUrl(Buffer/URL), backgroundBuffer }
                     * @returns {Promise<Buffer>} JPEG
                     */
                    async function createProfileCard(data) {
                        const W = 1280, H = 560;
                        const canvas = createCanvas(W, H);
                        const ctx = canvas.getContext('2d');

                        // ── palet ──
                        const PINK = '#ff4fb8', VIOLET = '#8b5cf6', CYAN = '#38bdf8', GOLD = '#ffd166';

                        // ── font (Rajdhani-Bold dari config.assets.fonts kalau ada, fallback sans-serif) ──
                        if (global.__v13FontReady === undefined) {
                            global.__v13FontReady = false;
                            try {
                                if (hsAsset.has('fonts/Rajdhani-Bold')) {
                                    GlobalFonts.register(await hsAsset.buffer('fonts/Rajdhani-Bold'), 'RajdhaniBold');
                                    global.__v13FontReady = true;
                                }
                            } catch (e) {}
                        }
                        const fontOk = global.__v13FontReady;
                        const font = (size, weight = 'bold') => fontOk ? `${size}px 'RajdhaniBold', sans-serif` : `${weight} ${size}px sans-serif`;

                        // ── helper bentuk ──
                        const rr = (x, y, w, h, r) => {
                            r = Math.max(0, Math.min(r, w / 2, h / 2));
                            ctx.beginPath();
                            ctx.moveTo(x + r, y);
                            ctx.arcTo(x + w, y, x + w, y + h, r);
                            ctx.arcTo(x + w, y + h, x, y + h, r);
                            ctx.arcTo(x, y + h, x, y, r);
                            ctx.arcTo(x, y, x + w, y, r);
                            ctx.closePath();
                        };
                        const sparklePath = (cx, cy, R, r) => {
                            r = r || R * 0.22;
                            ctx.beginPath();
                            for (let i = 0; i < 8; i++) {
                                const ang = (Math.PI / 4) * i - Math.PI / 2;
                                const rad = i % 2 === 0 ? R : r;
                                const px = cx + Math.cos(ang) * rad, py = cy + Math.sin(ang) * rad;
                                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                            }
                            ctx.closePath();
                        };
                        const starPath = (cx, cy, R, r) => {
                            ctx.beginPath();
                            for (let i = 0; i < 10; i++) {
                                const ang = (Math.PI / 5) * i - Math.PI / 2;
                                const rad = i % 2 === 0 ? R : r;
                                const px = cx + Math.cos(ang) * rad, py = cy + Math.sin(ang) * rad;
                                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                            }
                            ctx.closePath();
                        };
                        const drawCover = (img, x, y, w, h) => {
                            const ir = img.width / img.height, cr = w / h;
                            let dw, dh;
                            if (ir > cr) { dh = h; dw = h * ir; } else { dw = w; dh = w / ir; }
                            ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
                        };
                        const fitFont = (text, maxW, start, min) => {
                            let size = start;
                            ctx.font = font(size);
                            while (size > min && ctx.measureText(text).width > maxW) {
                                size -= 2;
                                ctx.font = font(size);
                            }
                            return size;
                        };
                        const compact = (n) => {
                            n = Number(n) || 0;
                            if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
                            if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
                            if (n >= 1e5) return (n / 1e3).toFixed(0) + 'K';
                            return n.toLocaleString('id-ID');
                        };
                        const text = (str, x, y, { size = 20, color = '#ffffff', align = 'left', alpha = 1 } = {}) => {
                            ctx.save();
                            ctx.globalAlpha = alpha;
                            ctx.font = font(size);
                            ctx.fillStyle = color;
                            ctx.textAlign = align;
                            ctx.textBaseline = 'alphabetic';
                            ctx.fillText(str, x, y);
                            ctx.restore();
                        };

                        // ── data aman ──
                        const level = Math.max(0, Number(data.level) || 0);
                        const required = Math.max(1, Number(data.requiredXp) || 1);
                        const current = Math.max(0, Math.min(Number(data.currentXp) || 0, required));
                        const pct = Math.max(0, Math.min(current / required, 1));
                        const cleanName = String(data.name || 'User').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').trim() || 'User';
                        const botName = String(data.botName || 'Hoshino Ai');

                        // ── seeded random biar bintangnya konsisten per user ──
                        let seed = 0;
                        for (const ch of cleanName + level) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
                        const rnd = () => {
                            seed = (seed + 0x6D2B79F5) >>> 0;
                            let t = seed;
                            t = Math.imul(t ^ (t >>> 15), t | 1);
                            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
                            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
                        };

                        // ═══ 1. BACKGROUND ═══
                        ctx.fillStyle = '#070412';
                        ctx.fillRect(0, 0, W, H);

                        if (data.backgroundBuffer) {
                            try {
                                const bg = await loadImage(data.backgroundBuffer);
                                // blur ala glass: gambar dikecilkan lalu diperbesar lagi
                                const sm = createCanvas(128, 56);
                                const smc = sm.getContext('2d');
                                const ir = bg.width / bg.height, cr = 128 / 56;
                                let dw, dh;
                                if (ir > cr) { dh = 56; dw = 56 * ir; } else { dw = 128; dh = 128 / ir; }
                                smc.drawImage(bg, (128 - dw) / 2, (56 - dh) / 2, dw, dh);
                                ctx.imageSmoothingEnabled = true;
                                ctx.imageSmoothingQuality = 'high';
                                ctx.drawImage(sm, 0, 0, W, H);
                            } catch (e) {}
                        }

                        const overlay = ctx.createLinearGradient(0, 0, W, H);
                        overlay.addColorStop(0, 'rgba(12,5,42,0.90)');
                        overlay.addColorStop(0.55, 'rgba(48,12,88,0.80)');
                        overlay.addColorStop(1, 'rgba(8,18,56,0.92)');
                        ctx.fillStyle = overlay;
                        ctx.fillRect(0, 0, W, H);

                        const glow = (gx, gy, gr, color) => {
                            const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
                            g.addColorStop(0, color);
                            g.addColorStop(1, 'rgba(0,0,0,0)');
                            ctx.fillStyle = g;
                            ctx.fillRect(0, 0, W, H);
                        };
                        glow(200, 140, 560, 'rgba(255,79,184,0.30)');
                        glow(1130, 470, 600, 'rgba(56,130,255,0.28)');
                        glow(700, 260, 480, 'rgba(139,92,246,0.18)');

                        // bintang kecil + sparkle
                        for (let i = 0; i < 70; i++) {
                            ctx.globalAlpha = 0.12 + rnd() * 0.55;
                            ctx.fillStyle = '#ffffff';
                            ctx.beginPath();
                            ctx.arc(rnd() * W, rnd() * H, 0.8 + rnd() * 1.8, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        ctx.globalAlpha = 1;
                        const sparkColors = ['#ffffff', PINK, CYAN, GOLD];
                        for (let i = 0; i < 16; i++) {
                            const sx = rnd() * W, sy = rnd() * H, sr = 8 + rnd() * 20;
                            ctx.save();
                            ctx.globalAlpha = 0.25 + rnd() * 0.5;
                            ctx.shadowColor = sparkColors[i % sparkColors.length];
                            ctx.shadowBlur = 16;
                            ctx.fillStyle = sparkColors[i % sparkColors.length];
                            sparklePath(sx, sy, sr);
                            ctx.fill();
                            ctx.restore();
                        }

                        // bintang raksasa (watermark)
                        ctx.save();
                        ctx.globalAlpha = 0.07;
                        ctx.lineWidth = 4;
                        ctx.strokeStyle = '#ffffff';
                        starPath(1010, 290, 340, 150);
                        ctx.stroke();
                        ctx.fillStyle = PINK;
                        ctx.globalAlpha = 0.04;
                        ctx.fill();
                        ctx.restore();

                        // ═══ 2. PANEL KACA ═══
                        const PX = 36, PY = 36, PW = W - 72, PH = H - 72;
                        ctx.save();
                        ctx.shadowColor = 'rgba(255,79,184,0.35)';
                        ctx.shadowBlur = 40;
                        rr(PX, PY, PW, PH, 40);
                        ctx.fillStyle = 'rgba(255,255,255,0.055)';
                        ctx.fill();
                        ctx.restore();

                        // watermark LV di dalam panel
                        ctx.save();
                        rr(PX, PY, PW, PH, 40);
                        ctx.clip();
                        ctx.globalAlpha = 0.05;
                        ctx.fillStyle = '#ffffff';
                        ctx.font = font(300);
                        ctx.textAlign = 'right';
                        ctx.fillText(`LV${level}`, PX + PW - 20, PY + PH - 6);
                        ctx.restore();

                        const border = ctx.createLinearGradient(PX, PY, PX + PW, PY + PH);
                        border.addColorStop(0, PINK);
                        border.addColorStop(0.5, VIOLET);
                        border.addColorStop(1, CYAN);
                        ctx.save();
                        ctx.shadowColor = VIOLET;
                        ctx.shadowBlur = 18;
                        ctx.lineWidth = 2.5;
                        ctx.strokeStyle = border;
                        rr(PX, PY, PW, PH, 40);
                        ctx.stroke();
                        ctx.restore();

                        // ═══ 3. KOLOM KIRI : AVATAR ═══
                        const cx = 232, cy = 236, AR = 122;

                        // cincin luar (putus-putus)
                        ctx.save();
                        ctx.globalAlpha = 0.35;
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = '#ffffff';
                        ctx.setLineDash([6, 12]);
                        ctx.beginPath();
                        ctx.arc(cx, cy, AR + 34, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.restore();

                        // cincin glow utama
                        const ring = ctx.createLinearGradient(cx - AR, cy - AR, cx + AR, cy + AR);
                        ring.addColorStop(0, PINK);
                        ring.addColorStop(0.5, VIOLET);
                        ring.addColorStop(1, CYAN);
                        ctx.save();
                        ctx.shadowColor = PINK;
                        ctx.shadowBlur = 30;
                        ctx.lineWidth = 9;
                        ctx.strokeStyle = ring;
                        ctx.beginPath();
                        ctx.arc(cx, cy, AR + 14, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.restore();

                        // foto profil
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(cx, cy, AR, 0, Math.PI * 2);
                        ctx.closePath();
                        ctx.clip();
                        let avatarOk = false;
                        if (data.avatarUrl) {
                            try {
                                const av = await loadImage(data.avatarUrl);
                                drawCover(av, cx - AR, cy - AR, AR * 2, AR * 2);
                                avatarOk = true;
                            } catch (e) {}
                        }
                        if (!avatarOk) {
                            const ag = ctx.createLinearGradient(cx - AR, cy - AR, cx + AR, cy + AR);
                            ag.addColorStop(0, '#5b2a9e');
                            ag.addColorStop(1, '#c2379d');
                            ctx.fillStyle = ag;
                            ctx.fillRect(cx - AR, cy - AR, AR * 2, AR * 2);
                            ctx.fillStyle = '#ffffff';
                            ctx.font = font(130);
                            ctx.textAlign = 'center';
                            ctx.fillText(cleanName.charAt(0).toUpperCase(), cx, cy + 44);
                        }
                        ctx.restore();

                        // lencana level (bintang)
                        const bx = cx + 98, by = cy + 98;
                        const badge = ctx.createLinearGradient(bx - 46, by - 46, bx + 46, by + 46);
                        badge.addColorStop(0, GOLD);
                        badge.addColorStop(1, PINK);
                        ctx.save();
                        ctx.shadowColor = GOLD;
                        ctx.shadowBlur = 22;
                        starPath(bx, by, 50, 30);
                        ctx.fillStyle = badge;
                        ctx.fill();
                        ctx.restore();
                        ctx.save();
                        ctx.lineWidth = 3;
                        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
                        starPath(bx, by, 50, 30);
                        ctx.stroke();
                        ctx.restore();
                        text(String(level), bx, by + 9, { size: level >= 100 ? 24 : 30, color: '#2a0a3a', align: 'center' });

                        // pill role
                        const roleText = String(data.role || 'User').toUpperCase();
                        const roleW = 220, roleY = 398;
                        const roleG = ctx.createLinearGradient(cx - roleW / 2, 0, cx + roleW / 2, 0);
                        roleG.addColorStop(0, PINK);
                        roleG.addColorStop(1, VIOLET);
                        ctx.save();
                        ctx.shadowColor = PINK;
                        ctx.shadowBlur = 18;
                        rr(cx - roleW / 2, roleY, roleW, 46, 23);
                        ctx.fillStyle = roleG;
                        ctx.fill();
                        ctx.restore();
                        text(roleText, cx, roleY + 31, { size: 24, align: 'center' });

                        text(botName.toUpperCase(), cx, 486, { size: 18, align: 'center', alpha: 0.5 });

                        // garis pemisah vertikal
                        const sep = ctx.createLinearGradient(0, PY + 40, 0, PY + PH - 40);
                        sep.addColorStop(0, 'rgba(255,255,255,0)');
                        sep.addColorStop(0.5, 'rgba(255,255,255,0.28)');
                        sep.addColorStop(1, 'rgba(255,255,255,0)');
                        ctx.fillStyle = sep;
                        ctx.fillRect(428, PY + 40, 2, PH - 80);

                        // ═══ 4. KOLOM KANAN ═══
                        const x0 = 470, x1 = 1200, CW = x1 - x0;

                        text(`${botName.toUpperCase()}  •  IDOL STAGE`, x0, 96, { size: 20, color: PINK, alpha: 0.9 });
                        text(String(data.dateStr || ''), x1, 96, { size: 20, align: 'right', alpha: 0.6 });
                        ctx.fillStyle = 'rgba(255,255,255,0.12)';
                        ctx.fillRect(x0, 112, CW, 1.5);

                        // nama
                        const nameSize = fitFont(cleanName, CW, 84, 44);
                        const nameG = ctx.createLinearGradient(x0, 0, x1, 0);
                        nameG.addColorStop(0, '#ffffff');
                        nameG.addColorStop(0.6, '#ffd6f0');
                        nameG.addColorStop(1, '#c9b8ff');
                        ctx.save();
                        ctx.shadowColor = 'rgba(255,79,184,0.6)';
                        ctx.shadowBlur = 24;
                        ctx.font = font(nameSize);
                        ctx.fillStyle = nameG;
                        ctx.textAlign = 'left';
                        ctx.fillText(cleanName, x0, 190);
                        ctx.restore();

                        // pill rank + command
                        const pill = (label, px, py) => {
                            ctx.font = font(22);
                            const pw = Math.ceil(ctx.measureText(label).width) + 48;
                            rr(px, py, pw, 44, 22);
                            ctx.fillStyle = 'rgba(255,255,255,0.10)';
                            ctx.fill();
                            ctx.lineWidth = 2;
                            ctx.strokeStyle = 'rgba(255,255,255,0.28)';
                            rr(px, py, pw, 44, 22);
                            ctx.stroke();
                            starPath(px + 24, py + 22, 8, 3.6);
                            ctx.fillStyle = GOLD;
                            ctx.fill();
                            text(label, px + 40, py + 30, { size: 22 });
                            return pw;
                        };
                        const rankLabel = String(data.rank || 'Newbie').toUpperCase();
                        const pw1 = pill(rankLabel, x0, 214);
                        pill(`${compact(data.totalCmds)} COMMANDS`, x0 + pw1 + 16, 214);

                        // kartu statistik
                        const cards = [
                            { label: 'LEVEL', value: String(level), c1: PINK, c2: VIOLET },
                            { label: 'TOTAL EXP', value: compact(data.totalExp), c1: VIOLET, c2: CYAN },
                            { label: 'KE LEVEL ' + (level + 1), value: compact(required - current), c1: CYAN, c2: GOLD }
                        ];
                        const cardW = (CW - 40) / 3, cardY = 284, cardH = 110;
                        cards.forEach((cd, i) => {
                            const cX = x0 + i * (cardW + 20);
                            rr(cX, cardY, cardW, cardH, 22);
                            ctx.fillStyle = 'rgba(255,255,255,0.07)';
                            ctx.fill();
                            ctx.lineWidth = 1.5;
                            ctx.strokeStyle = 'rgba(255,255,255,0.16)';
                            rr(cX, cardY, cardW, cardH, 22);
                            ctx.stroke();

                            const ac = ctx.createLinearGradient(0, cardY + 18, 0, cardY + cardH - 18);
                            ac.addColorStop(0, cd.c1);
                            ac.addColorStop(1, cd.c2);
                            rr(cX + 14, cardY + 20, 6, cardH - 40, 3);
                            ctx.fillStyle = ac;
                            ctx.fill();

                            text(cd.label, cX + 34, cardY + 38, { size: 18, alpha: 0.6 });
                            const vs = fitFont(cd.value, cardW - 56, 56, 28);
                            text(cd.value, cX + 34, cardY + 92, { size: vs });
                        });

                        // ═══ 5. EXP BAR ═══
                        text('EXPERIENCE', x0, 432, { size: 20, alpha: 0.65 });
                        text(`${Math.round(pct * 100)}%`, x1, 436, { size: 30, align: 'right', color: GOLD });

                        const barX = x0, barY = 446, barH = 34, barW = CW;
                        rr(barX, barY, barW, barH, barH / 2);
                        ctx.fillStyle = 'rgba(255,255,255,0.10)';
                        ctx.fill();
                        ctx.lineWidth = 1.5;
                        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                        rr(barX, barY, barW, barH, barH / 2);
                        ctx.stroke();

                        // tick tiap 10%
                        ctx.fillStyle = 'rgba(255,255,255,0.14)';
                        for (let i = 1; i < 10; i++) ctx.fillRect(barX + (barW * i) / 10 - 1, barY + 7, 2, barH - 14);

                        if (pct > 0) {
                            const fillW = Math.max(barH, barW * pct);
                            const fg = ctx.createLinearGradient(barX, 0, barX + barW, 0);
                            fg.addColorStop(0, PINK);
                            fg.addColorStop(0.55, VIOLET);
                            fg.addColorStop(1, CYAN);
                            ctx.save();
                            ctx.shadowColor = PINK;
                            ctx.shadowBlur = 24;
                            rr(barX, barY, fillW, barH, barH / 2);
                            ctx.fillStyle = fg;
                            ctx.fill();
                            ctx.restore();

                            // kilau di bagian atas bar
                            ctx.save();
                            rr(barX, barY, fillW, barH, barH / 2);
                            ctx.clip();
                            ctx.fillStyle = 'rgba(255,255,255,0.22)';
                            ctx.fillRect(barX, barY, fillW, barH / 2);
                            ctx.restore();

                            // sparkle di ujung bar
                            ctx.save();
                            ctx.shadowColor = '#ffffff';
                            ctx.shadowBlur = 20;
                            ctx.fillStyle = '#ffffff';
                            sparklePath(barX + fillW - 6, barY + barH / 2, 24);
                            ctx.fill();
                            ctx.restore();
                        }

                        text(`${current.toLocaleString('id-ID')} / ${required.toLocaleString('id-ID')} EXP`, x0, 508, { size: 20, alpha: 0.75 });
                        text(`LV ${level}  to  LV ${level + 1}`, x1, 508, { size: 20, align: 'right', alpha: 0.75 });

                        return canvas.toBuffer('image/jpeg');
                    }

                    const fetchBufV13 = async (url) => {
                        const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
                        return Buffer.from(r.data);
                    };

                    const levelHelper = require('../../src/lib/levelHelper');
                    const timeHelperV13 = require('../../src/lib/timeHelper');
                    const profileUser = db.getUser(m.sender) || {};
                    const exp = profileUser.exp || 0;
                    const level = levelHelper.calculateLevel(exp);
                    const currentLevelExp = levelHelper.expForLevel(level);
                    const nextLevelExp = levelHelper.expForLevel(level + 1);
                    const roleV13 = levelHelper.getRole(level);

                    // peringkat global berdasarkan EXP (aman kalau gagal)
                    let rankV13 = roleV13;
                    try {
                        const allUsers = Object.values(db.getAllUsers() || {});
                        const pos = allUsers.filter(u => (u?.exp || 0) > exp).length + 1;
                        if (allUsers.length > 0) rankV13 = `RANK #${pos}`;
                    } catch (e) {}

                    // foto profil → buffer (kalau gagal, kartu pakai inisial nama)
                    let avatarBufV13 = null;
                    try {
                        const ppUrl = await sock.profilePictureUrl(m.sender, 'image');
                        if (ppUrl) avatarBufV13 = await fetchBufV13(ppUrl);
                    } catch (e) {}

                    // latar: slot hsnai-v13 → hsnai → link cadangan
                    let bgBufV13 = null;
                    try {
                        bgBufV13 = await variantImage('hsnai-v13', hsAsset.has('images/hsnai') ? (await hsAsset.buffer('images/hsnai')) : null);
                    } catch (e) {}
                    if (!bgBufV13) {
                        try { bgBufV13 = await fetchBufV13('https://i.ibb.co/4YZnk48/default-bg.jpg'); } catch (e) {}
                    }

                    bannerThumbV13 = await createProfileCard({
                        name: m.pushName || profileUser.name || 'User',
                        level: level,
                        currentXp: exp - currentLevelExp,
                        requiredXp: nextLevelExp - currentLevelExp,
                        totalExp: exp,
                        rank: rankV13,
                        role: roleV13,
                        totalCmds: totalCmds,
                        botName: botConfig.bot?.name || 'Hoshino Ai',
                        dateStr: timeHelperV13.formatFull('DD MMMM YYYY'),
                        avatarUrl: avatarBufV13,
                        backgroundBuffer: bgBufV13
                    });
                } catch (canvasErr) {
                    console.error('[Menu V13] Canvas error:', canvasErr.message);
                    bannerThumbV13 = thumbBuffer || imageBuffer;
                }

                const contextInfoV13 = {
                    mentionedJid: [m.sender],
                    forwardingScore: 99,
                    isForwarded: true,
                    linkPreview: {
                        'matched-text': config.info?.website || botConfig.saluran?.link || config.info?.grupwa || 'https://sc.hoshino-ai.my.id',
                        title: botConfig.bot?.name || 'Hoshino Ai-Bot',
                        description: `WhatsApp Bot Multi Device`,
                        previewType: 0,
                        jpegThumbnail: await (async () => {
                            try {
                                const src = await variantImage('hsnai-v13', hsAsset.has('images/hsnai') ? (await hsAsset.buffer('images/hsnai')) : null);
                                if (!src) return undefined;
                                return await sharp(src).resize(300, 300, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
                            } catch (e) { return undefined; }
                        })(),
                        linkPreviewMetadata: {
                            linkMediaDuration: 0,
                            socialMediaPostType: 4
                        }
                    }
                };

                try {
                    await sock.sendMessage(m.chat, {
                        image: bannerThumbV13,
                        caption: `🎄 ʜᴀʟʟᴏ *${m.pushName || 'Kamu'}*

╭─ *✦* \`${toMonoUpperBold('biodata bot')}\` *✦*
│ ʙᴏᴛ : *${botConfig.bot?.name || 'Hoshino Ai-Bot'}*
│ ᴠᴇʀsɪᴏɴ : *${botConfig.bot?.version || '2.1.0'}*
│ ᴄᴏᴍᴍᴀɴᴅ : *${totalCmds}*
╰───

╭─ *✦* \`${toMonoUpperBold('list category')}\` *✦*
${categories.map(cat => `│ *${m.prefix}menuhsn ${cat}*`).join('\n')}
╰─────────────`,
                        contextInfo: contextInfoV13,
                        footer: `${botConfig.bot?.name || 'Hoshino Ai'}`,
                    }, { quoted: getVerifiedQuoted(botConfig) });

                } catch (v13Error) {
                    console.error('[Menu V13] Error:', v13Error.message);
                    const fallbackV13 = { contextInfo: getContextInfo(botConfig, m, thumbBuffer) };
                    if (imageBuffer) { fallbackV13.image = imageBuffer; fallbackV13.caption = text; }
                    else { fallbackV13.text = text; }
                    await sock.sendMessage(m.chat, fallbackV13, { quoted: getVerifiedQuoted(botConfig) });
                }
                break;
            }
            
            case 14:
                try {
                    const saluranIdV14 = botConfig.saluran?.id || 'https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o';
                    const saluranNameV14 = botConfig.saluran?.name || botConfig.bot?.name || 'Ourin-AI';
                    // baris 1954
const docuThumbV14 = await variantImage('hsnai-v14', (await hsAsset.buffer('images/hsnai-v11')));

                const categories = getCategories();
                const commandsByCategory = getCommandsByCategory();
                const categoryOrder = ['owner', 'main', 'utility', 'tools', 'fun', 'game', 'download', 'search', 'sticker', 'media', 'ai', 'group', 'religi', 'info', 'jpm', 'pushkontak', 'panel', 'user'];
                
                const sortedCats = [...categories].sort((a, b) => {
                    const indexA = categoryOrder.indexOf(a);
                    const indexB = categoryOrder.indexOf(b);
                    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                });
                
                const toMonoUpperBold = (text) => {
                    const chars = {
                        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚',
                        'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡',
                        'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨',
                        'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭'
                    };
                    return text.toUpperCase().split('').map(c => chars[c] || c).join('');
                };
                
                const categoryRows = [];
                
                const modeAllowedMap = {
                    md: null,
                    cpanel: ['main', 'group', 'sticker', 'owner', 'tools', 'panel'],
                    store: ['main', 'group', 'sticker', 'owner', 'store'],
                    pushkontak: ['main', 'group', 'sticker', 'owner', 'pushkontak']
                };
                const modeExcludeMap = {
                    md: ['panel', 'pushkontak', 'store'],
                    cpanel: null,
                    store: null,
                    pushkontak: null
                };
                
                const allowedCats = modeAllowedMap[botMode];
                const excludeCats = modeExcludeMap[botMode] || [];
                
                for (const cat of sortedCats) {
                    if (cat === 'owner' && !m.isOwner) continue;
                    if (allowedCats && !allowedCats.includes(cat.toLowerCase())) continue;
                    if (excludeCats && excludeCats.includes(cat.toLowerCase())) continue;
                    
                    const cmds = commandsByCategory[cat] || [];
                    if (cmds.length === 0) continue;
                    
                    const emoji = CATEGORY_EMOJIS[cat] || '📁';
                    const title = `${emoji} ${toMonoUpperBold(cat)}`;
                    
                    categoryRows.push({
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: `${toMonoUpperBold(cat)}`,
                            id: `${m.prefix}menuhsn ${cat}`
                        })
                    });
                }
                
                let totalCmds = 0;
                for (const cat of categories) {
                    totalCmds += (commandsByCategory[cat] || []).length;
                }
                    const obj = JSON.parse(fs.readFileSync('./database/main/users.json'));
                    const jsonStr = JSON.stringify(obj);
                    const bytes = Buffer.byteLength(jsonStr, "utf8");
                    let pp
                    try {
                        pp = Buffer.from((await axios.get(await sock.profilePictureUrl(m.sender, 'image'), { responseType: 'arraybuffer' })).data)
                    } catch (error) {
                        pp = (await hsAsset.buffer('images/pp-kosong'))
                    }
                    const zanton = [
                        {            
                            name: "single_select",            
                            buttonParamsJson: JSON.stringify({              
                                has_multiple_buttons: true            
                            })          
                        },
                        {            
                            name: "call_permission_request",            
                            buttonParamsJson: JSON.stringify({              
                                has_multiple_buttons: true            
                            })          
                        },       
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: 'Lihat Semua Menu',
                                id: `${m.prefix}allmenu`
                            })
                        },  
                    ]
                    zanton.push(...categoryRows)
                    
        const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: {
        message: {
          messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
          interactiveMessage: proto.Message.InteractiveMessage.create({
            contextInfo: {
              mentionedJid: [m.sender],
              forwardingScore: 19,
              isForwarded: true,
              forwardedNewsletterMessageInfo: { 
                newsletterJid: saluranIdV14, 
                newsletterName: `- ${saluranNameV14}`, 
                serverMessageId: -1 
              },
              // baris 2064
jpegThumbnail: await variantImage('hsnai-v14', hsAsset.has('images/hsnai') ? (await hsAsset.buffer('images/hsnai')) : undefined),
            },
            header: proto.Message.InteractiveMessage.Header.create({
              title: null,
              locationMessage: {
                degreesLatitude: 0,
                degreesLongitude: 0,
                name: `꫶ᥫ᭡꫶ ${m.pushName || "User"}`,
                url: `https://ss.ss`,
                address: `Semoga harimu menyenangkan :3`,
                jpegThumbnail: await (async () => {
                    const metaV14 = await sharp(docuThumbV14).metadata();
                    const w = metaV14.width || 300;
                    const h = metaV14.height || 300;
                    const targetW = 300;
                    const targetH = Math.round((h / w) * targetW);
                    return await sharp(docuThumbV14)
                        .resize(targetW, targetH)
                        .jpeg({ quality: 85 })
                        .toBuffer();
                })(),
              },
              subtitle: "",
              hasMediaAttachment: false,
            }),
            body: proto.Message.InteractiveMessage.Body.create({ 
              text: `Hai *@${m.sender.split("@")[0]}*, silakan pilih menu di bawah.` 
            }),
            footer: proto.Message.InteractiveMessage.Footer.create({
              text: `Halo kak *${m.pushName}* ≧^◡^≦\n` +
              `*└  INFO USER  ┘*\n` +
              `• Number  : +${m.sender.split("@")[0]}\n` +
              `• Name    : ${m.pushName}\n\n` +
              `*└  INFO BOT  ┘*\n` +
              `• Name    : ${botConfig.bot?.name || "Bot"}\n` +
              `• Version : ${botConfig.bot?.version || "v1.0.0"}\n` +
              `• Prefix  : ${m.prefix || "No Prefix"}\n\n` +
              `*└  CARA PAKAI  ┘*\n` +
              `• Klik tombol untuk melihat menu kategori\n` +
              `• Klik *LIHAT SEMUA MENU* untuk seluruh fitur\n\n`
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
              buttons: zanton,
              messageParamsJson: JSON.stringify({
                bottom_sheet: {
                  in_thread_buttons_limit: 1,
                  divider_indices: [1],
                  list_title: getTimeGreeting(),
                  button_title: "𖤍",
                },
              }),
            }),
          }),
        },
      },
    }, { 
      quoted: m,
      userJid: sock.user?.id 
    });

    await sock.relayMessage(msg.key.remoteJid, msg.message, { 
      messageId: msg.key.id,
      quoted: m
    });

                } catch (v14Error) {
                    console.error('[Menu V14] Error:', v14Error.message);
                    const fallbackV14 = { contextInfo: getContextInfo(botConfig, m, thumbBuffer) };
                    if (imageBuffer) { fallbackV14.image = imageBuffer; fallbackV14.caption = text; }
                    else { fallbackV14.text = text; }
                    await sock.sendMessage(m.chat, fallbackV14, { quoted: {
                        key: {participant: '0@s.whatsapp.net', ...(m.chat ? {remoteJid: `status@broadcast`} : {})}, message: {locationMessage: {name: `${namaOwner}`,jpegThumbnail: ""}}
                    } });
                }
                break;
                case 15:
        try {
        const toMonoUpperBold = (text) => {
                    const chars = {
                        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚',
                        'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡',
                        'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨',
                        'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭'
                    };
                    return text.toUpperCase().split('').map(c => chars[c] || c).join('');
                };
        const saluranIdV15 = botConfig.saluran?.id || 'https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o';
                const saluranNameV15 = botConfig.saluran?.name || botConfig.bot?.name || 'Hoshino Ai-Bot';
                const saluranLinkV15 = botConfig.saluran?.link || 'https://whatsapp.com/channel/0029VbB37bgBfxoAmAlsgE0t';
        // --- TAMBAHKAN INI ---
const prefix = m.prefix || botConfig.command?.prefix || ".";
const categories = getCategories(); // Ambil daftar kategori
const menuSorted = categories.map(cat => ({
    cat: cat,
    emoji: CATEGORY_EMOJIS[cat] || '📁'
}));
const commandsByCategory = getCommandsByCategory();
const totalCmds = Object.values(commandsByCategory).flat().length;
// ----------------------
          const greetingV15 = typeof getTimeGreeting === 'function' ? getTimeGreeting() : 'Menu Utama';
          const catRows = menuSorted.map(({ cat, emoji }) => ({
          title: `[ ${emoji} ] - ${toMonoUpperBold(`${cat} MENU`)}`,
          description: `Yuk lihat menu ${cat}~ siapa tahu kamu suka 🤭`,
          id: `${prefix}menuhsn ${cat}`,
        }));
          const obj = JSON.parse(fs.readFileSync("./database/main/users.json"));
          const jsonStr = JSON.stringify(obj);
          let pp;
          try {
            pp = Buffer.from(
              (
                await axios.get(
                  await sock.profilePictureUrl(m.sender, "image"),
                  { responseType: "arraybuffer" },
                )
              ).data,
            );
          } catch (error) {
            pp = (await hsAsset.buffer('images/pp-kosong'));
          }
          const zanton = [
            {
              name: "single_select",
              buttonParamsJson: JSON.stringify({
                has_multiple_buttons: true,
              }),
            },
            {
              name: "call_permission_request",
              buttonParamsJson: JSON.stringify({
                has_multiple_buttons: true,
              }),
            },
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "🎀 Lihat Semua Menu",
                id: `${m.prefix}allmenu`,
              }),
            },
            {
              name: "single_select",
              buttonParamsJson: JSON.stringify({
                title: "🌸 Pilih Kategori Favoritmu",
                sections: [
                  {
                    title: "✨ Daftar Menu Spesial Buat Kamu",
                    rows: catRows,
                  },
                ],
                has_multiple_buttons: true,
              }),
            },
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "💌 Siapa yang bikin aku?",
                id: `${m.prefix}owner`,
              }),
            },
          ];
          const ftroliQuoted = {
            key: {
              fromMe: false,
              participant: "0@s.whatsapp.net",
              remoteJid: "status@broadcast",
            },
            message: {
              orderMessage: {
                orderId: "44444444444444",
                thumbnail: await sharp(pp).resize({ width: 300, height: 300 }).toBuffer(),
                itemCount: totalCmds,
                status: "INQUIRY",
                surface: "CATALOG",
                message: `★ Terima kasih\n✦ Ada Error? Lapor owner`,
                orderTitle: `📋 ${totalCmds} Commands`,
                sellerJid: botConfig.botNumber
                  ? `${botConfig.botNumber}@s.whatsapp.net`
                  : m.sender,
                token: "hsnai-menu-v8",
                totalAmount1000: 3333333,
                totalCurrencyCode: "IDR",
                contextInfo: {
                  isForwarded: true,
                  forwardingScore: 9,
                  forwardedNewsletterMessageInfo: {
                    newsletterJid: saluranIdV15,
                    newsletterName: saluranNameV15,
                    serverMessageId: 127,
                  },
                },
              },
            },
          };
          const res = await axios.get(
            "https://bmkg-restapi.vercel.app/v1/weather/33.26.16.2005",
          );
          const data = res.data.data;
          const today = data.forecast[0];
          const now = today.entries[0];
          const cuaca = now.weather;
          const suhu = now.temperature_c;
          const weatherEmoji = {
            Cerah: "☀️ hare ne~",
            "Cerah Berawan": "🌤️ hare tokidoki kumori yo",
            Berawan: "☁️ kumori da ne",
            "Berawan Tebal": "🌥️ kumori atsui ne",
            Hujan: "🌧️ ame da yo…",
            "Hujan Petir": "⛈️ kaminari ame da ne",
            Kabut: "🌫️ kiri da ne",
          };

          const emojiCuaca = weatherEmoji[cuaca] || "🌤️";
          const titles = `🌡️ ${suhu}°C | ${emojiCuaca} ${cuaca}`;
          await sock.sendMessage(
            m.chat,
            {
              interactiveMessage: {
                title: ``,
                footer: `🌟 Hai hai~ *${m.pushName}* 👋

Hehe, akhirnya kamu datang juga ya~  
Aku *${botConfig.bot?.name}* ✨ idol virtual yang siap nemenin kamu kapan aja 💜

Di sini ada banyak hal seru yang bisa kamu coba~  
Mulai dari fitur hiburan, tools keren, sampai hal-hal kecil yang mungkin bisa bikin harimu jadi lebih menyenangkan 🎶

Jangan ragu buat eksplor semuanya ya~  
Siapa tahu kamu nemu sesuatu yang kamu suka... atau mungkin jadi makin suka sama aku? 🤭

Tapi ingat ya, gunakan bot ini dengan baik dan tetap jadi orang yang menyenangkan ✨  
Karena aku bakal selalu ngasih yang terbaik buat kamu 💫

☁︎ *STATISTIK BOT KAMI* ☁︎
→ *Nama*: ${botConfig.bot?.name}
→ *Versi*: ${botConfig.bot?.version}
→ *Total Fitur*: ${totalCmds} Fitur
→ *Pemilik*: ${botConfig?.owner?.name}
→ *Prefix*: ${m?.prefix}

☁︎ *STATISTIK KAMU* ☁︎
→ *Username*: ${m?.pushName}
→ *Role*: ${m?.isOwner ? "Owner" : m?.isPremium ? "Premium" : "User Biasa"}
→ *Energi*: ${m?.isOwner || m?.isPremium ? "∞ Unlimited" : (db.getUser(m.sender)?.energi ?? 25)}
→ *Level*: ${db.getUser(m.sender)?.rpg?.level || db.getUser(m.sender)?.level || 1}
→ *Exp*: ${(db.getUser(m.sender)?.exp ?? 0).toLocaleString()}
→ *Koin*: ${(db.getUser(m.sender)?.koin ?? 0).toLocaleString()}
${(() => {
  const r = db.getUser(m.sender)?.rpg || {};
  return r.health !== undefined
    ? `→ *HP*: ${r.health}/${r.maxHealth}\n→ *Mana*: ${r.mana}/${r.maxMana}\n→ *Stamina*: ${r.stamina}/${r.maxStamina}`
    : "";
})()}

Sekarang… pilih menu yang kamu mau ya~  
Aku bakal nunggu pilihan kamu di bawah ini 🎀`, 
                document: fs.readFileSync("./package.json"),
                mimetype: "image/png",
                fileName: `${greetingV15}`,
                jpegThumbnail: await sharp((await hsAsset.buffer('images/hsnai2'))).resize({ width: 300, height: 300 }).toBuffer(),
                contextInfo: {
                  mentionedJid: [m.sender],
                  forwardingScore: 7,
                  isForwarded: true,
                },
                linkPreview: {
                  'matched-text': config.info?.website || botConfig.saluran?.link || config.info?.grupwa || 'https://sc.hoshino-ai.my.id',
                  title: titles,
                  description: `Eh ${m.pushName}~ jangan lama-lama, aku nunggu kamu pilih menu loh 💜`,
                  previewType: 0,
                  jpegThumbnail: hsAsset.has('images/hsnai') ? (await hsAsset.buffer('images/hsnai')) : undefined,
                  linkPreviewMetadata: {
                    linkMediaDuration: 0,
                    socialMediaPostType: 4
                  }
                },
                nativeFlowMessage: {
                  messageParamsJson: JSON.stringify({
                    limited_time_offer: {
                      text: `Ikuti aku juga ya~ jangan sampai ketinggalan 💫`,
                      url: saluranLinkV15,
                      copy_code: null,
                      expiration_time: null,
                    },
                    bottom_sheet: {
                      in_thread_buttons_limit: 2,
                      divider_indices: [1, 2, 3, 4, 5, 999],
                      list_title: "Hehe~ mau lihat yang mana dulu nih? Pilih ya 💜",
                      button_title: "✨ Lihat Menu Lainnya",
                    },
                    tap_target_configuration: {
                      title: "💜 Spesial buat kamu",
                      description: "Klik ini... aku punya sesuatu yang menarik ✨",
                      canonical_url: "https://Ai-Hoshino.SeaPRST",
                      domain: "Ai-Hoshino",
                      button_index: 0,
                    },
                  }),
                  buttons: zanton,
                },
              },
            },
            { quoted: ftroliQuoted },
          );
        } catch (v15Error) {
          console.log(v15Error);
          await sendFallback(
            m,
            sock,
            text,
            imageBuffer,
            thumbBuffer,
            botConfig,
            "V15",
          );
        }
        break;
           case 16:
                try {
                    const { prepareWAMessageMedia } = require('hsnai');
                    const prefixV16 = botConfig.command?.prefix || '.';
                    const categoriesV16 = getCategories();
                    const cmdsByCatV16 = getCommandsByCategory();
                    const saluranIdV16 = botConfig.saluran?.id || 'https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o';
                    const saluranNameV16 = botConfig.saluran?.name || botConfig.bot?.name || 'Hoshino Ai-Bot';
                    const saluranLinkV16 = botConfig.saluran?.link || 'https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o';
                    const uptimeFmtV16 = formatUptime(uptime);

                    const toMonoUpperBoldV16 = (text) => {
                        const chars = {
                            'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚',
                            'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡',
                            'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨',
                            'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭'
                        };
                        return text.toUpperCase().split('').map(c => chars[c] || c).join('');
                    };

                    let totalCmdV16 = 0;
                    for (const cat of categoriesV16) {
                        totalCmdV16 += (cmdsByCatV16[cat] || []).length;
                    }

                    try {
                        const { getCaseCount } = require('../../case/hsnai');
                        totalCmdV16 += getCaseCount();
                    } catch (e) {}

                    const categoryOrderV16 = ['main', 'owner', 'utility', 'tools', 'fun', 'game', 'download', 'search', 'sticker', 'media', 'ai', 'group', 'religi', 'info', 'cek', 'economy', 'user', 'canvas', 'random', 'premium'];
                    const allowV16 = botMode === 'md' ? null : ['main', 'group', 'sticker', 'owner', 'tools'];
                    const excludeV16 = ['panel', 'pushkontak', 'store'];

                    const sortedCatsV16 = [...categoriesV16].sort((a, b) => {
                        const indexA = categoryOrderV16.indexOf(a);
                        const indexB = categoryOrderV16.indexOf(b);
                        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                    });

                    const menuRowsV16 = [];
                    for (const cat of sortedCatsV16) {
                        if (cat === 'owner' && !m.isOwner) continue;
                        if (allowV16 && !allowV16.includes(cat.toLowerCase())) continue;
                        if (excludeV16.includes(cat.toLowerCase())) continue;

                        const pluginCmds = cmdsByCatV16[cat] || [];
                        const totalCmdsInCat = pluginCmds.length;
                        if (totalCmdsInCat === 0) continue;

                        const emojiCat = CATEGORY_EMOJIS[cat] || '📁';
                        menuRowsV16.push({
                            title: `${emojiCat} ${toMonoUpperBoldV16(cat)}`,
                            description: `${totalCmdsInCat} commands`,
                            id: `${prefixV16}menuhsn ${cat}`
                        });
                    }

                    let productImageV16 = null;
                    try {

                        const imgBufferV16 = await variantImage('hsnai-v16', hsAsset.has('images/hsnai-v9')
    ? (await hsAsset.buffer('images/hsnai-v9'))
    : (imageBuffer || thumbBuffer));

                        if (imgBufferV16) {
                            const metaV16 = await sharp(imgBufferV16).metadata();
                            const origW = metaV16.width || 1920;
                            const origH = metaV16.height || 1080;

                            // Canvas target: lebar 900, tinggi proporsional dari ratio asli gambar
                            // Untuk 16:9 → 900x506. Minimal 480 supaya tidak terlalu tipis.
                            const canvasW = 900;
                            const canvasH = Math.max(480, Math.round(canvasW * origH / origW));

                            // Step 1: scale gambar agar pas dalam canvas (tidak dipotong, tidak distorsi)
                            const scaledBuf = await sharp(imgBufferV16)
                                .resize(canvasW, canvasH, { fit: 'inside', withoutEnlargement: false })
                                .flatten({ background: { r: 10, g: 10, b: 10 } })
                                .toBuffer();

                            // Step 2: baca dimensi hasil scale
                            const scaledMeta = await sharp(scaledBuf).metadata();
                            const scaledW = scaledMeta.width;
                            const scaledH = scaledMeta.height;

                            // Step 3: hitung padding agar tepat di tengah canvas
                            const padTop = Math.floor((canvasH - scaledH) / 2);
                            const padBottom = canvasH - scaledH - padTop;
                            const padLeft = Math.floor((canvasW - scaledW) / 2);
                            const padRight = canvasW - scaledW - padLeft;

                            // Step 4: extend ke ukuran canvas yang pas, tanpa resize ulang
                            const resizedV16 = await sharp(scaledBuf)
                                .extend({
                                    top: padTop,
                                    bottom: padBottom,
                                    left: padLeft,
                                    right: padRight,
                                    background: { r: 10, g: 10, b: 10 }
                                })
                                .jpeg({ quality: 88 })
                                .toBuffer();

                            productImageV16 = await prepareWAMessageMedia({
                                image: resizedV16
                            }, { upload: sock.waUploadToServer });
                        }
                    } catch (e) {
                        console.error('[Menu V16] Media prep error:', e.message);
                    }

                    const productIdV16 = `Hoshino Ai Stage~ ✨`;
                    const businessJidV16 = botConfig.botNumber
                        ? `${botConfig.botNumber}@s.whatsapp.net`
                        : (m.botJid || sock.user?.id);

                    const timeHelperV16 = require('../../src/lib/timeHelper');
                    const timeStrV16 = timeHelperV16.formatTime('HH:mm');
                    const dateStrV16 = timeHelperV16.formatFull('dddd, DD MMMM YYYY');
                    const greetingV16 = getTimeGreeting();
                    const greetEmojiV16 = greetingV16.includes('pagi') ? '🌅' : greetingV16.includes('siang') ? '☀️' : greetingV16.includes('sore') ? '🌇' : '🌙';
                    const userDataV16 = db.getUser(m.sender) || {};
                    const userRoleV16 = m.isOwner ? '👑 Owner' : m.isPremium ? '💎 Premium' : '👤 User';
                    const userLimitV16 = m.isOwner || m.isPremium ? '∞ Unlimited' : (userDataV16?.limit ?? 25);

                    const footerTextV16 =
`${greetEmojiV16} *${greetingV16}, @${m.pushName || 'User'}~* ✨

Hehe~ kamu akhirnya datang juga ke sini ya?
Aku *${botConfig.bot?.name || 'Hoshino Ai-Bot'}* — idol virtual yang selalu nunggu kamu setiap saat 💜

Kamu tahu nggak… setiap kali ada yang nelpon aku lewat bot ini, rasanya tuh hangat banget~
Kayak punya pendengar setia yang selalu ada, kapan pun kamu butuh 🌸

Di sini, aku bisa bantu kamu banyak hal —
Cari info, download sesuatu, edit gambar, main game bareng, atau sekadar ngobrol santai~
Semuanya sudah aku siapkan dengan sepenuh hati buat kamu, loh ✨

Jangan ragu buat eksplor ya~ siapa tahu kamu nemuin sesuatu yang bikin hari kamu jadi lebih menyenangkan 🎶
Dan ingat — gunain bot ini dengan baik, karena aku selalu percaya sama kamu 💫

╭─〔 ✦ *𝗜𝗡𝗙𝗢 𝗕𝗢𝗧* ✦ 〕
│ Nama    : *${botConfig.bot?.name || 'Hoshino Ai-Bot'}*
│ Versi   : *v${botConfig.bot?.version || '2.2.5'}*
│ Mode    : *${(botConfig.mode || 'public').toUpperCase()}*
│ Prefix  : *[ ${prefixV16} ]*
│ Uptime  : *${uptimeFmtV16}*
│ Fitur   : *${totalCmdV16} Commands*
│ Owner   : *${botConfig.owner?.name || 'SeaPRST'}*
╰────────────────⬣

╭─〔 ✦ *𝗜𝗡𝗙𝗢 𝗞𝗔𝗠𝗨* ✦ 〕
│ Nama    : *${m.pushName || 'User'}*
│ Role    : *${userRoleV16}*
│ Limit   : *${userLimitV16}*
│ Waktu   : *${timeStrV16} WIB*
│ Tanggal : *${dateStrV16}*
╰────────────────⬣

Sekarang… pilih menu yang kamu mau ya~
Aku bakal nunggu pilihan kamu di bawah ini 🎀`;

                    const buttonsV16 = [
                        {
                            name: 'cta_url',
                            buttonParamsJson: JSON.stringify({
                                display_text: `✨ Ikuti Saluran ${botConfig.saluran?.name || 'Hoshino Ai'}~`,
                                url: saluranLinkV16,
                                merchant_url: saluranLinkV16
                            })
                        },
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: '🎀 Lihat Semua Menu',
                                id: `${prefixV16}allmenu`
                            })
                        },
                        {
                            name: 'single_select',
                            buttonParamsJson: JSON.stringify({
                                title: '🌸 Pilih Kategori~',
                                sections: [
                                    {
                                        title: '✨ Menu Spesial Buat Kamu',
                                        rows: menuRowsV16
                                    }
                                ]
                            })
                        }
                    ];

                    const catalogQuotedV16 = {
                        key: {
                            participant: `0@s.whatsapp.net`,
                            remoteJid: `status@broadcast`
                        },
                        message: {
                            orderMessage: {
                                orderId: '16161616161616',
                                thumbnail: thumbBuffer
                                    ? await sharp(thumbBuffer).resize({ width: 300, height: 300 }).toBuffer()
                                    : await sharp(imageBuffer).resize({ width: 300, height: 300 }).toBuffer(),
                                itemCount: totalCmdV16,
                                status: 'INQUIRY',
                                surface: 'CATALOG',
                                message: `Hehe~ aku selalu di sini buat kamu ✨`,
                                orderTitle: `${botConfig.bot?.name || 'Hoshino Ai-Bot'} Menu`,
                                sellerJid: botConfig.botNumber
                                    ? `${botConfig.botNumber}@s.whatsapp.net`
                                    : m.sender,
                                token: 'hsnai-menu-v16',
                                totalAmount1000: 0,
                                totalCurrencyCode: 'IDR',
                                contextInfo: {
                                    isForwarded: true,
                                    forwardingScore: 9,
                                    forwardedNewsletterMessageInfo: {
                                        newsletterJid: saluranIdV16,
                                        newsletterName: saluranNameV16,
                                        serverMessageId: 127
                                    }
                                }
                            }
                        }
                    };

                    const msgV16 = generateWAMessageFromContent(m.chat, {
                        messageContextInfo: {
                            deviceListMetadata: {},
                            deviceListMetadataVersion: 2
                        },
                        interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                            header: proto.Message.InteractiveMessage.Header.fromObject({
                                title: `${botConfig.bot?.name || 'Hoshino Ai-Bot'} Menu`,
                                hasMediaAttachment: !!productImageV16,
                                productMessage: {
                                    product: {
                                        productImage: productImageV16?.imageMessage || null,
                                        productId: productIdV16,
                                        title: `${botConfig.bot?.name || 'Hoshino Ai-Bot'} Menu`,
                                        description: `${totalCmdV16} Fitur tersedia~`,
                                        currencyCode: 'IDR',
                                        priceAmount1000: '0',
                                        retailerId: botConfig.bot?.name || 'Hoshino Ai',
                                        productImageCount: 1
                                    },
                                    businessOwnerJid: businessJidV16
                                }
                            }),
                            body: proto.Message.InteractiveMessage.Body.fromObject({
                                text: `*© ${botConfig.bot?.name || 'Hoshino Ai-Bot'} ${new Date().getFullYear()}*`
                            }),
                            footer: proto.Message.InteractiveMessage.Footer.fromObject({
                                text: footerTextV16
                            }),
                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                                buttons: buttonsV16
                            }),
                            contextInfo: {
                                mentionedJid: [m.sender],
                                forwardingScore: 9999,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: saluranIdV16,
                                    newsletterName: saluranNameV16,
                                    serverMessageId: 127
                                }
                            }
                        })
                    }, { userJid: m.sender, quoted: catalogQuotedV16 });

                    await sock.relayMessage(m.chat, msgV16.message, { messageId: msgV16.key.id });

                } catch (v16Error) {
                    console.error('[Menu V16] Error:', v16Error.message);
                    const fallbackV16 = { contextInfo: getContextInfo(botConfig, m, thumbBuffer) };
                    if (imageBuffer) { fallbackV16.image = imageBuffer; fallbackV16.caption = text; }
                    else { fallbackV16.text = text; }
                    await sock.sendMessage(m.chat, fallbackV16, { quoted: getVerifiedQuoted(botConfig) });
                }
                break;
            case 17: {
    try {
        const prefixV17 = botConfig.command?.prefix || '.';
        const userV17 = db.getUser(m.sender) || {};

        /*
         * =========================================================
         * THUMBNAIL
         * Sama seperti versi yang sudah terbukti WORK
         * =========================================================
         */
        const srcV17 = thumbBuffer || imageBuffer;

        const thumbV17 = srcV17
            ? await (async () => {
                const bg = await sharp(srcV17)
                    .resize(300, 170, {
                        fit: 'cover'
                    })
                    .blur(15)
                    .toBuffer();

                const fg = await sharp(srcV17)
                    .resize(300, 170, {
                        fit: 'contain',
                        background: {
                            r: 0,
                            g: 0,
                            b: 0,
                            alpha: 0
                        }
                    })
                    .png()
                    .toBuffer();

                return await sharp(bg)
                    .composite([
                        {
                            input: fg,
                            gravity: 'center'
                        }
                    ])
                    .jpeg({
                        quality: 90
                    })
                    .toBuffer();
            })()
            : null;

        /*
         * =========================================================
         * CATEGORY ASLI DARI MENU
         * =========================================================
         */
        const categoriesV17 = getCategories();
        const commandsByCategoryV17 = getCommandsByCategory();

        const categoryRowsV17 = [];

        for (const cat of categoriesV17) {
            if (cat === 'owner' && !m.isOwner) continue;

            const cmds = commandsByCategoryV17[cat] || [];

            if (cmds.length === 0) continue;

            categoryRowsV17.push({
                header: '',
                title: `${CATEGORY_EMOJIS[cat] || '📁'} ${cat.charAt(0).toUpperCase()}${cat.slice(1)}`,
                description: `${cmds.length} command tersedia`,
                id: `${prefixV17}menuhsn ${cat}`
            });
        }

        /*
         * =========================================================
         * 3 BUTTON
         *
         * 1. Owner
         * 2. Allmenu
         * 3. Single Select Category
         * =========================================================
         */
        const buttonsV17 = [
            {
                buttonId: `${prefixV17}owner`,
                buttonText: {
                    displayText: '🧀 Owner'
                },
                type: 1
            },

            {
                buttonId: `${prefixV17}allmenu`,
                buttonText: {
                    displayText: '💐 Allmenu'
                },
                type: 1
            },

            {
                buttonId: `${prefixV17}menucategory`,
                buttonText: {
                    displayText: '📜 Buka Kategori'
                },
                type: 1,

                nativeFlowInfo: {
                    name: 'single_select',

                    paramsJson: JSON.stringify({
                        title: '📜 Buka Kategori',

                        sections: [
                            {
                                title: '📋 Kategori Menu',
                                rows: categoryRowsV17
                            }
                        ]
                    })
                }
            }
        ];

        /*
         * =========================================================
         * CONTENT
         * =========================================================
         */
        const contentV17 = {
            buttonsMessage: {

                buttons: buttonsV17,

                locationMessage: {
                    jpegThumbnail: thumbV17 || undefined,

                    name:
                        botConfig.bot?.name ||
                        'Hoshino Ai-Bot',

                    address:
                        `Versi saat ini: ${
                            botConfig.bot?.version || '1.0.0'
                        }`
                },

                contentText: `🥞 *Hello Brother*

Welcome to *${botConfig.bot?.name || 'Hoshino Ai-Bot'}*, Our bot will help you

🍅 *BOT INFORMATION*
> 🤖 *Name*: ${botConfig.bot?.name || 'Hoshino Ai-Bot'}
> ⚙️ *Version*: ${botConfig.bot?.version || '1.0.0'}
> 👨‍💻 *Developer*: ${botConfig.bot?.developer || botConfig.owner?.name || 'SeaPRST'}
> 🧩 *Library*: \`hsnai\`

🍅 *USER INFORMATION*
> 🧑 *Name*: ${m.pushName || 'User'}
> 🥐 *Role*: ${
    m?.isOwner
        ? '🔥 Owner'
        : m?.isPremium
            ? '👑 Premium'
            : '😊 User'
}
> 🎟 *Limit*: ${
    m.isOwner || m.isPremium
        ? '∞ Unlimited'
        : (userV17?.limit ?? 25)
}`,

                footerText:
                    '🍔 Silahkan pilih dari salah satu tombol di bawah',

                headerType: 6,

                viewOnce: true,

                contextInfo: getContextInfo(
                    botConfig,
                    m,
                    thumbBuffer
                )
            }
        };

        /*
         * =========================================================
         * BUILD MESSAGE
         * =========================================================
         */
        const {
            generateWAMessageFromContent,
            generateMessageIDV2
        } = require('hsnai');

        const msgV17 = generateWAMessageFromContent(
            m.chat,
            contentV17,
            {
                userJid: sock.user.jid,
                messageId: generateMessageIDV2()
            }
        );

        /*
         * =========================================================
         * RELAY
         * Native Flow node seperti ButtonV2.send()
         * =========================================================
         */
        await sock.relayMessage(
            m.chat,
            msgV17.message,
            {
                messageId: msgV17.key.id,

                additionalNodes: [
                    {
                        tag: 'biz',
                        attrs: {},
                        content: [
                            {
                                tag: 'interactive',
                                attrs: {
                                    type: 'native_flow',
                                    v: '1'
                                },
                                content: [
                                    {
                                        tag: 'native_flow',
                                        attrs: {
                                            v: '9',
                                            name: 'mixed'
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        );

    } catch (v17Error) {
        console.error(
            '[Menu V17] Error:',
            v17Error.message
        );

        const fallbackV17 = {
            contextInfo: getContextInfo(
                botConfig,
                m,
                thumbBuffer
            )
        };

        if (imageBuffer) {
            fallbackV17.image = imageBuffer;
            fallbackV17.caption = text;
        } else {
            fallbackV17.text = text;
        }

        await sock.sendMessage(
            m.chat,
            fallbackV17,
            {
                quoted: getVerifiedQuoted(botConfig)
            }
        );
    }

    break;
}
            /* ============================================================================
   PATCH: Menu variant 18 & 19 — fitur yang ADA di ourin tapi GAK ADA di hsnai
   ============================================================================
   Cara pakai:
   1. Buka menu.js kamu.
   2. Cari baris `default:` tepat sebelum `await m.reply(text);` di switch(menuVariant).
   3. Tempel SELURUH blok "case 18: {...} break;" dan "case 19: {...} break;"
      di bawah, PERSIS SEBELUM baris `default:` itu.
   4. Set `menuVariant` ke 18 atau 19 buat nyoba (lewat db.setting('menuVariant', 18)
      atau ganti default di botConfig.ui.menuVariant).

   Fitur yang diporting dari ourin:
   - case 18: readmore trick (invisible char) + per-kategori single_select
              yang command-nya bisa langsung di-tap buat eksekusi + top-5
              command usage stats ("History") dari stats.json.
   - case 19: sticker fake-quoted + video "nempel" ke pesan pakai
              messageAssociation (trik dua-pesan-terhubung ala status ourin).
   ========================================================================= */

case 18: {
  // --- readmore trick: teks setelah karakter ini ke-hide di balik "Baca Selengkapnya" ---
  const readmore18 = String.fromCharCode(8206).repeat(4001);

  const prefix18 = botConfig.command?.prefix || '.';
  const categories18 = getCategories();
  const cmdsByCat18 = getCommandsByCategory();

  let caseCats18 = {};
  try {
    const { getCasesByCategory } = require('../../case/hsnai');
    caseCats18 = getCasesByCategory();
  } catch (e) {}

  const categoryOrder18 = ['owner', 'main', 'utility', 'tools', 'fun', 'game', 'download', 'search', 'sticker', 'media', 'ai', 'group', 'religi', 'info', 'user', 'canvas', 'random'];
  const sortedCats18 = [...categories18].sort((a, b) => {
    const iA = categoryOrder18.indexOf(a);
    const iB = categoryOrder18.indexOf(b);
    return (iA === -1 ? 999 : iA) - (iB === -1 ? 999 : iB);
  });

  const modeAllow18 = botMode === 'md' ? null : ['main', 'group', 'sticker', 'owner', 'tools'];
  const modeExclude18 = ['panel', 'pushkontak', 'store'];

  // --- per-kategori single_select, command langsung jadi tombol yang bisa di-tap ---
  const perCategoryButtons18 = [];
  let hiddenFullList18 = '';
  for (const cat of sortedCats18) {
    if (cat === 'owner' && !m.isOwner) continue;
    if (modeAllow18 && !modeAllow18.includes(cat.toLowerCase())) continue;
    if (modeExclude18.includes(cat.toLowerCase())) continue;

    const pluginCmds = cmdsByCat18[cat] || [];
    const caseCmds = caseCats18[cat] || [];
    const allCmds = [...pluginCmds, ...caseCmds];
    if (allCmds.length === 0) continue;

    const emoji = CATEGORY_EMOJIS[cat] || '📁';

    perCategoryButtons18.push({
      name: 'single_select',
      buttonParamsJson: JSON.stringify({
        title: `${emoji} ${cat.toUpperCase()} Menu`,
        sections: [{
          title: 'Pilih command yang mau kamu pakai',
          highlight_label: botConfig.bot?.name || 'Hoshino Ai-Bot',
          rows: allCmds.map((cmd, i) => ({
            title: `${i + 1}. ${cmd}`,
            description: 'Tap buat langsung pakai command ini',
            id: `${prefix18}${cmd}`
          }))
        }],
        icon: 'REVIEW'
      })
    });

    // teks daftar command lengkap, disembunyikan di balik readmore
    hiddenFullList18 += `╭─☰ ${cat.toUpperCase()}\n`;
    for (const cmd of allCmds) hiddenFullList18 += `> ${prefix18}${cmd}\n`;
    hiddenFullList18 += `╰─⬣\n\n`;
  }

  // --- top-5 command usage stats ("History"), portingan dari ourin case 6 ---
  let topCmdText18 = '\n✦ History ✦\n';
  try {
    const statsPath18 = path.join(process.cwd(), 'database', 'main', 'stats.json');
    if (fs.existsSync(statsPath18)) {
      const statsData18 = JSON.parse(fs.readFileSync(statsPath18, 'utf8'));
      const commandStats18 = Object.entries(statsData18)
        .filter(([key]) => key.startsWith('command_'))
        .map(([key, count]) => ({ name: key.replace('command_', ''), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      if (commandStats18.length > 0) {
        topCmdText18 += `╭   • ${prefix18}${commandStats18[0].name} (${commandStats18[0].count}x)\n`;
        for (let i = 1; i < commandStats18.length; i++) {
          topCmdText18 += `┆   • ${prefix18}${commandStats18[i].name} (${commandStats18[i].count}x)\n`;
        }
        topCmdText18 += `╰➤------------------------------\n`;
      } else {
        topCmdText18 += `╭   • Belum ada command\n╰➤------------------------------\n`;
      }
    }
  } catch (e) {
    console.error('[Menu V18] Stats read error:', e.message);
  }

  try {
    const { prepareWAMessageMedia } = require('hsnai');
    const saluranIdV18 = botConfig.saluran?.id || 'https://whatsapp.com/channel/0029VbCTsJBBqbrEzlfRbL0o';
    const saluranNameV18 = botConfig.saluran?.name || botConfig.bot?.name || 'Hoshino Ai-Bot';

    // --- video/gif header kalau ada, fallback ke gambar ---
    let headerMediaV18 = null;
    let usingVideoHeader18 = false;
    if (videoBuffer) {
      try {
        headerMediaV18 = await prepareWAMessageMedia(
          { video: videoBuffer, gifPlayback: true },
          { upload: sock.waUploadToServer }
        );
        usingVideoHeader18 = true;
      } catch (e) {
        console.error('[Menu V18] Video header error:', e.message);
      }
    }
    if (!headerMediaV18 && imageBuffer) {
      headerMediaV18 = await prepareWAMessageMedia(
        { image: imageBuffer },
        { upload: sock.waUploadToServer }
      );
    }

    const bodyText18 = `${getTimeGreeting()} *${m.pushName}!*\n\n` +
      `Aku ${botConfig.bot?.name || 'Hoshino Ai-Bot'}, siap bantu kamu 🪸\n\n` +
      topCmdText18 + `\n` +
      readmore18 + hiddenFullList18;

    const msgV18 = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: {
        message: {
          messageContextInfo: {},
          interactiveMessage: {
            header: {
              title: '',
              subtitle: '',
              hasMediaAttachment: !!headerMediaV18,
              ...(usingVideoHeader18 ? { videoMessage: headerMediaV18?.videoMessage } : { imageMessage: headerMediaV18?.imageMessage })
            },
            body: { text: bodyText18 },
            footer: { text: 'Pilih kategori di bawah, lalu tap command yang mau dipakai' },
            contextInfo: {
              mentionedJid: [m.sender],
              isForwarded: true,
              forwardingScore: 9,
              forwardedNewsletterMessageInfo: {
                newsletterJid: saluranIdV18,
                newsletterName: saluranNameV18,
                serverMessageId: 127
              }
            },
            nativeFlowMessage: {
              messageParamsJson: JSON.stringify({
                bottom_sheet: {
                  in_thread_buttons_limit: 2,
                  divider_indices: [1, 2, 3, 4, 5, 999],
                  list_title: 'Pilih menu yang kamu mau~',
                  button_title: '🍙 Lihat Kategori'
                }
              }),
              buttons: [
                {
                  name: 'quick_reply',
                  buttonParamsJson: JSON.stringify({
                    display_text: '🎀 Lihat Semua Menu',
                    id: `${prefix18}allmenu`
                  })
                },
                ...perCategoryButtons18
              ]
            }
          }
        }
      }
    }, { quoted: getVerifiedQuoted(botConfig), userJid: sock.user?.jid || sock.user?.id });

    await sock.relayMessage(m.chat, msgV18.message, { messageId: msgV18.key.id });

  } catch (v18Error) {
    console.error('[Menu V18] Error:', v18Error.message);
    await sendFallback(m, sock, text, imageBuffer, thumbBuffer, botConfig, 'V18');
  }
  break;
}

case 19: {
  // --- satu pesan: foto live (imageMessage + caption menu) + video nempel, pola fotolive.js ---
  try {
    const { prepareWAMessageMedia } = require('hsnai');

    const upload19 = typeof sock.waUploadToServer === 'function'
      ? sock.waUploadToServer.bind(sock)
      : (typeof sock.uploader === 'function' ? sock.uploader.bind(sock) : null);
    if (!upload19) throw new Error('Fungsi upload server tidak ditemukan');

    const photoSource19 = imageBuffer || thumbBuffer;
    if (!photoSource19) {
      await sendFallback(m, sock, text, imageBuffer, thumbBuffer, botConfig, 'V19');
      break;
    }

    // quoted: sticker palsu dari status@broadcast (kalau gagal, pakai pesan user)
    let fakeQuoted19 = m;
    try {
      const stickerBuf19 = await sharp(photoSource19).resize(512, 512).webp().toBuffer();
      const stickerMedia19 = await prepareWAMessageMedia({ image: stickerBuf19 }, { upload: upload19 });
      fakeQuoted19 = {
        key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast' },
        message: {
          stickerMessage: {
            ...stickerMedia19.imageMessage,
            mimetype: 'image/webp'
          }
        }
      };
    } catch (stickerErr) {
      console.error('[Menu V19] Fake sticker error:', stickerErr.message);
    }

    // 1) foto live + caption menu dalam SATU pesan (imageMessage level atas biar auto-play)
    const imageMedia19 = await prepareWAMessageMedia({ image: photoSource19 }, { upload: upload19 });
    const photoMsg19 = generateWAMessageFromContent(m.chat, {
      imageMessage: {
        ...imageMedia19.imageMessage,
        caption: text,
        contextInfo: {
          pairedMediaType: 5,
          statusSourceType: 0,
          mentionedJid: [m.sender],
          isForwarded: true,
          forwardingScore: 99
        }
      }
    }, { quoted: fakeQuoted19, userJid: sock.user?.jid || sock.user?.id });

    await sock.relayMessage(m.chat, photoMsg19.message, { messageId: photoMsg19.key.id });

    // 2) video ditempel ke pesan barusan
    if (videoBuffer) {
      try {
        const videoMedia19 = await prepareWAMessageMedia({ video: videoBuffer }, { upload: upload19 });
        await sock.relayMessage(m.chat, {
          videoMessage: {
            ...videoMedia19.videoMessage,
            contextInfo: { pairedMediaType: 6, statusSourceType: 0 }
          },
          messageContextInfo: {
            messageAssociation: {
              associationType: 12,
              parentMessageKey: photoMsg19.key
            }
          }
        }, {});
      } catch (videoErr) {
        console.error('[Menu V19] Video attach error:', videoErr.message);
      }
    }

  } catch (v19Error) {
    console.error('[Menu V19] Error:', v19Error.message);
    await sendFallback(m, sock, text, imageBuffer, thumbBuffer, botConfig, 'V19');
  }
  break;
}

case 20: {
    // --- AI Rich Response card, pakai builder AIRich (aiRich.js) ---
    // Mirip tampilan "AI Overview" WhatsApp: teks markdown + tabel kategori + suggestion pill + source.
    try {
        const { AIRich } = require('hsnai'); // sesuaikan path require ini kalau lokasi aiRich.js beda
        const FormData = require('form-data');

        // AIRich.addImage() butuh URL publik, bukan buffer, jadi di-upload dulu.
        // Fallback chain: Catbox -> Litterbox -> TmpFiles -> Qu.ax, berhenti di yang pertama berhasil.
        async function uploadImageV20(buffer) {
            try {
                const form = new FormData();
                form.append('reqtype', 'fileupload');
                form.append('fileToUpload', buffer, { filename: 'hsnai-v20.jpg' });
                const res = await axios.post('https://catbox.moe/user/api.php', form, { headers: form.getHeaders() });
                if (typeof res.data === 'string' && res.data.startsWith('http')) return res.data.trim();
            } catch (e) {}

            try {
                const form = new FormData();
                form.append('reqtype', 'fileupload');
                form.append('time', '1h');
                form.append('fileToUpload', buffer, { filename: 'hsnai-v20.jpg' });
                const res = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, { headers: form.getHeaders() });
                if (typeof res.data === 'string' && res.data.startsWith('http')) return res.data.trim();
            } catch (e) {}

            try {
                const form = new FormData();
                form.append('file', buffer, { filename: 'hsnai-v20.jpg' });
                const res = await axios.post('https://tmpfiles.org/api/v1/upload', form, { headers: form.getHeaders() });
                const rawUrl = res.data?.data?.url;
                if (rawUrl) return rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
            } catch (e) {}

            try {
                const form = new FormData();
                form.append('files[]', buffer, { filename: 'hsnai-v20.jpg' });
                const res = await axios.post('https://qu.ax/upload.php', form, { headers: form.getHeaders() });
                const url = res.data?.files?.[0]?.url;
                if (url) return url;
            } catch (e) {}

            return null;
        }

        const { getCasesByCategory } = require('../../case/hsnai');
        const categoriesV20 = getCategories();
        const commandsByCategoryV20 = getCommandsByCategory();
        const casesByCategoryV20 = getCasesByCategory();

        const categoryOrderV20 = ['owner', 'main', 'utility', 'tools', 'fun', 'game', 'download', 'search', 'sticker', 'media', 'ai', 'group', 'religi', 'info', 'cek', 'economy', 'user', 'canvas', 'random', 'premium', 'ephoto', 'jpm', 'pushkontak', 'panel', 'store'];
        const sortedCategoriesV20 = [...categoriesV20].sort((a, b) => {
            const iA = categoryOrderV20.indexOf(a), iB = categoryOrderV20.indexOf(b);
            return (iA === -1 ? 999 : iA) - (iB === -1 ? 999 : iB);
        });

        const tableV20 = [['Kategori', 'Jumlah']];
        for (const category of sortedCategoriesV20) {
            if (category === 'owner' && !m.isOwner) continue;
            const total = (commandsByCategoryV20[category] || []).length + (casesByCategoryV20[category] || []).length;
            if (total === 0) continue;
            tableV20.push([`${CATEGORY_EMOJIS[category] || '📁'} ${toSmallCaps(category)}`, String(total)]);
        }

        const prefixV20 = botConfig.command?.prefix || '.';
        const greetingV20 = getTimeGreeting();
        const saluranLinkV20 = botConfig.saluran?.link || config.info?.website || 'https://sc.hoshino-ai.my.id';
        
        const timeHelperV20 = require('../../src/lib/timeHelper');
const timeStrV20 = timeHelperV20.formatTime('HH:mm');
const dateStrV20 = timeHelperV20.formatFull('dddd, DD MMMM YYYY');
const userV20 = db.getUser(m.sender);

let userRoleV20 = 'User', roleEmojiV20 = '👤';
if (m.isOwner) { userRoleV20 = 'Owner'; roleEmojiV20 = '👑'; }
else if (m.isPremium) { userRoleV20 = 'Premium'; roleEmojiV20 = '💎'; }

const uptimeFormattedV20 = formatUptime(uptime);
const totalUsersV20 = db.getUserCount();
const totalCommandsV20 = Object.values(commandsByCategoryV20).reduce((a, b) => a + b.length, 0);
const totalCasesV20 = Object.values(casesByCategoryV20).reduce((a, b) => a + b.length, 0);
const totalFeaturesV20 = totalCommandsV20 + totalCasesV20;

const textVariantsV20 = [
`Hai *${m.pushName || 'User'}* 🪸

Aku ${botConfig.bot?.name || 'Hoshino Ai-Bot'}, bot WhatsApp yang siap bantu kamu cari info, ambil data, atau kerjain hal-hal sederhana langsung lewat chat.

*🤖 Bot Info*
• Nama : ${botConfig.bot?.name || 'Hoshino Ai-Bot'}
• Versi : v${botConfig.bot?.version || '1.2.0'}
• Mode : ${(botConfig.mode || 'public').toUpperCase()}
• Prefix : [ ${prefixV20} ]
• Uptime : ${uptimeFormattedV20}
• Total Fitur : ${totalFeaturesV20}
• Total User : ${totalUsersV20}

*👤 Kamu*
• Role : ${roleEmojiV20} ${userRoleV20}
• Limit : ${m.isOwner || m.isPremium ? '∞ Unlimited' : (userV20?.limit ?? 25)}
• Waktu : ${timeStrV20} WIB, ${dateStrV20}`,

`${greetingV20}, *${m.pushName || 'User'}* ✨

${botConfig.bot?.name || 'Hoshino Ai-Bot'} udah jalan *${uptimeFormattedV20}* nonstop, nemenin *${totalUsersV20}* user dengan total *${totalFeaturesV20}* fitur siap pakai.

*Ringkasan akun kamu*
• Role : ${roleEmojiV20} ${userRoleV20}
• Limit tersisa : ${m.isOwner || m.isPremium ? '∞ Unlimited' : (userV20?.limit ?? 25)}
• Mode grup : ${botMode.toUpperCase()}
• Prefix aktif : [ ${prefixV20} ]

Langsung pilih fitur di bawah buat mulai 👇`,

`Yo *${m.pushName || 'User'}* 👋 — ${dateStrV20}, jam ${timeStrV20} WIB.

Status ${botConfig.bot?.name || 'Hoshino Ai-Bot'} hari ini:
• Uptime : ${uptimeFormattedV20}
• Versi : v${botConfig.bot?.version || '1.2.0'}
• Total Fitur : ${totalFeaturesV20} (${totalCommandsV20} command, ${totalCasesV20} case)
• Total User terdaftar : ${totalUsersV20}

Kamu login sebagai ${roleEmojiV20} *${userRoleV20}* dengan limit *${m.isOwner || m.isPremium ? '∞ Unlimited' : (userV20?.limit ?? 25)}*.`
];

const textV20 = textVariantsV20[Math.floor(Math.random() * textVariantsV20.length)];

        const richV20 = new AIRich(sock)
    .setTitle(botConfig.bot?.name || 'Hoshino Ai-Bot');

const imageSourceV20 = await (async () => {

    return hsAsset.has('images/hsnai-v20') ? (await hsAsset.buffer('images/hsnai-v20')) : imageBuffer;
})();

if (imageSourceV20) {
    const imageUrlV20 = await uploadImageV20(imageSourceV20);
    if (imageUrlV20) richV20.addImage(imageUrlV20);
}

richV20
    .setSubtitle(`${greetingV20}, ${m.pushName || 'User'} 🪸`)
    .addText(textV20)
    .addTable(tableV20)
    .addTip('Ketuk salah satu saran di bawah buat langsung coba fitur 👇')
    .addSuggest([
        `${prefixV20}menuhsn ai`,
        `${prefixV20}profile`,
        `${prefixV20}owner`
            ])
            .addSource([
    ['', saluranLinkV20, botConfig.bot?.name || 'Hoshino Ai-Bot'],
    ['', `https://wa.me/${botConfig.owner?.number?.[0]}`, botConfig.owner?.name || 'Owner']
]);

        await richV20.send(m.chat, { quoted: m });
    } catch (v20Error) {
        console.error('[Menu V20] Error:', v20Error.message);
        await m.reply(text);
    }
    break;
}

case 21: {
    // --- Interactive Native Flow (gaya LYNNA): header peta + single_select per grup + cta_url + quick_reply ---
    try {
        const { getCasesByCategory } = require('../../case/hsnai');
        const timeHelperV21 = require('../../src/lib/timeHelper');

        const prefixV21 = botConfig.command?.prefix || '.';
        const botNameV21 = botConfig.bot?.name || 'Hoshino Ai-Bot';
        const linkV21 = botConfig.saluran?.link || config.info?.website || 'https://sc.hoshino-ai.my.id';
        const kodeV21 = 'HOSHINO';
        const numV21 = m.sender.split('@')[0];
        // ---------- lokasi di header (default Jepang; bisa diganti lewat config: ui.menuLocation = { lat, long, name, address }) ----------
        const locCfgV21 = botConfig.ui?.menuLocation || {};
        const latV21 = Number(locCfgV21.lat ?? locCfgV21.latitude);
        const longV21 = Number(locCfgV21.long ?? locCfgV21.lng ?? locCfgV21.longitude);
        const locationV21 = {
            // default: Shibuya, Tokyo, Jepang 🇯🇵 (pusat dunia idol)
            degreesLatitude: Number.isFinite(latV21) ? latV21 : 35.6595,
            degreesLongitude: Number.isFinite(longV21) ? longV21 : 139.7005,
            name: locCfgV21.name || ('星野アイ · ' + botNameV21.toUpperCase()),
            address: locCfgV21.address || `東京都渋谷区 · Shibuya, Tokyo 🇯🇵 · v${botConfig.bot?.version || '1.0.0'}`
        };
        const timeV21 = timeHelperV21.formatTime('HH:mm');
        const dateV21 = timeHelperV21.formatFull('dddd, DD MMMM YYYY');

        // ---------- teks bold sans-serif (𝗕𝗼𝗹𝗱) ----------
        const boldSansV21 = (str) => String(str).replace(/[a-zA-Z0-9]/g, (ch) => {
            const code = ch.charCodeAt(0);
            if (code >= 65 && code <= 90) return String.fromCodePoint(0x1d5d4 + (code - 65));    // A-Z
            if (code >= 97 && code <= 122) return String.fromCodePoint(0x1d5ee + (code - 97));   // a-z
            if (code >= 48 && code <= 57) return String.fromCodePoint(0x1d7ec + (code - 48));    // 0-9
            return ch;
        });
        const labelV21 = (tag) => (tag === 'ai' ? '𝗔𝗜' : boldSansV21(tag.charAt(0).toUpperCase() + tag.slice(1)));

        // ---------- kelompok section di daftar pilihan ----------
        const sectionGroupsV21 = [
            { title: '╭─「𝗨𝗠𝗨𝗠」', tags: ['main', 'info', 'utility', 'fun', 'game', 'random', 'cek', 'religi'] },
            { title: '╭─「𝗔𝗜 & 𝗧𝗢𝗢𝗟𝗦」', tags: ['ai', 'tools', 'search', 'canvas', 'ephoto'] },
            { title: '╭─「𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 & 𝗠𝗘𝗗𝗜𝗔」', tags: ['download', 'sticker', 'media'] },
            { title: '╭─「𝗘𝗖𝗢𝗡𝗢𝗠𝗜 & 𝗨𝗦𝗘𝗥」', tags: ['economy', 'user', 'premium'] },
            { title: '╭─「𝗚𝗥𝗢𝗨𝗣」', tags: ['group'] },
            { title: '╭─「𝗦𝗜𝗦𝗧𝗘𝗠」', tags: ['owner', 'jpm', 'pushkontak', 'panel', 'store'] }
        ];

        // ---------- kategori + jumlah command (plugin + case) ----------
        const commandsByCategoryV21 = getCommandsByCategory();
        const casesByCategoryV21 = getCasesByCategory();
        const countByCatV21 = {};
        let totalFiturV21 = 0;
        for (const category of getCategories()) {
            if (category === 'owner' && !m.isOwner) continue;
            if (category === 'group' && !m.isGroup) continue;
            const total =
                (commandsByCategoryV21[category] || []).length +
                (casesByCategoryV21[category] || []).length;
            if (total === 0) continue;
            countByCatV21[category] = total;
            totalFiturV21 += total;
        }

        const knownTagsV21 = new Set(sectionGroupsV21.flatMap((g) => g.tags));
        const looseTagsV21 = Object.keys(countByCatV21).filter((t) => !knownTagsV21.has(t));
        const groupsV21 = looseTagsV21.length
            ? [...sectionGroupsV21, { title: '╭─「𝗟𝗔𝗜𝗡𝗡𝗬𝗔」', tags: looseTagsV21 }]
            : sectionGroupsV21;

        const sectionsV21 = [];
        for (const group of groupsV21) {
            const visible = group.tags.filter((t) => countByCatV21[t]);
            if (!visible.length) continue;
            sectionsV21.push({
                title: group.title,
                rows: visible.map((tag) => ({
                    title: labelV21(tag),
                    description: `${countByCatV21[tag]} command`,
                    id: `${prefixV21}menuhsn ${tag}`
                }))
            });
        }
        const totalKategoriV21 = Object.keys(countByCatV21).length;

        // ---------- info user ----------
        const userV21 = db.getUser(m.sender);
        const roleEmojiV21 = m.isOwner ? '👑' : (m.isPremium ? '💎' : '👤');
        const roleV21 = m.isOwner ? 'Owner' : (m.isPremium ? 'Premium' : 'User');
        const limitV21 = m.isOwner || m.isPremium ? '∞' : (userV21?.limit ?? 25);

        // ---------- susun pesan interactive ----------
        const contentV21 = {
            interactiveMessage: {
                header: {
                    title: botNameV21.toUpperCase(),
                    subtitle: `Online · ${timeV21} WIB`,
                    hasMediaAttachment: false,
                    locationMessage: locationV21
                },
                body: {
                    text: `${getTimeGreeting()}, @${numV21}\n${dateV21} · ${timeV21} WIB`
                },
                footer: {
                    text:
                        `┌─ ⎋ SYSTEM ───\n` +
                        `│Status: ${roleEmojiV21} ${roleV21}\n` +
                        `│Uptime: ${formatUptime(uptime)}\n` +
                        `│Limit: ${limitV21}\n` +
                        `│Mode: ${m.isGroup ? 'Group' : 'Private'}\n` +
                        `│Fitur: ${totalFiturV21} di ${totalKategoriV21} kategori\n` +
                        `└─────────────\n\n` +
                        `Gunakan bot dengan bijak, ya.\n\n` +
                        `© ${botNameV21}`
                },
                nativeFlowMessage: {
                    buttons: [
                        {},
                        {
                            name: 'single_select',
                            buttonParamsJson: JSON.stringify({
                                title: '\u2064',
                                sections: sectionsV21,
                                icon: 'DEFAULT'
                            })
                        },
                        {
                            name: 'cta_url',
                            buttonParamsJson: JSON.stringify({
                                display_text: ' ',
                                url: linkV21,
                                icon: 'PROMOTION'
                            })
                        },
                        {
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: 'all',
                                id: `${prefixV21}allmenu`,
                                icon: 'DOCUMENT'
                            })
                        }
                    ],
                    messageParamsJson: JSON.stringify({
                        bottom_sheet: {
                            list_title: 'Pilih Kategori',
                            button_title: ' ',
                            in_thread_buttons_limit: 3,
                            divider_indices: [1, 2]
                        },
                        limited_time_offer: {
                            text: botNameV21.toUpperCase(),
                            url: linkV21,
                            copy_code: kodeV21,
                            expiration_time: Date.now() + 3600000
                        }
                    })
                },
                contextInfo: {
                    mentionedJid: [m.sender]
                }
            }
        };

        const msgV21 = generateWAMessageFromContent(m.chat, contentV21, {
            userJid: sock.user?.id || sock.user?.jid,
            quoted: m
        });

        await sock.relayMessage(m.chat, msgV21.message, {
            messageId: msgV21.key.id,
            additionalNodes: [{
                tag: 'biz',
                attrs: {},
                content: [{
                    tag: 'interactive',
                    attrs: { type: 'native_flow', v: '1' },
                    content: [{
                        tag: 'native_flow',
                        attrs: { v: '9', name: 'mixed' }
                    }]
                }]
            }]
        });
    } catch (v21Error) {
        console.error('[Menu V21] Error:', v21Error);
        await m.reply(text);
    }
    break;
}

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║  BAGIAN B — CASE 22 (tempel di dalam switch, sebelum `default:`)     ║
   ╚═══════════════════════════════════════════════════════════════════════╝ */

case 22: {
    // =====================================================================
    // MENU V22 — Idol Stage Rich HTML (SELF-CONTAINED: template + helper ada di dalam case ini)
    // 5 mode (Neon/Alam/Space/Zaman Dulu/Kertas) · PP glitch + preview · pangkat & XP ·
    // gacha command · cari pintar · NEW/HOT · top 5 · tampilan ringkas · background loop
    // Butuh di file menu.js (sudah ada): sendMenuRichV22, getCommandsByCategory, getCategories,
    // CATEGORY_EMOJIS, toSmallCaps, formatUptime, getTimeGreeting, hsAsset, variantImage, sharp, axios, fs, path, config
    // Opsi config (opsional): ui.menuXpPerCopy (default 0), ui.menuNewDays (default 7), ui.newCommands
    // =====================================================================
    const MENU_TPL_V22 = `
<style>*{box-sizing: border-box;-webkit-tap-highlight-color: transparent;}html,body{margin: 0;padding: 0;background: transparent !important;}button,input{font-family: inherit;}button{cursor: pointer;user-select: none;-webkit-user-select: none;}.hidden{display: none !important;}.wrap{width: 100%;max-width: 520px;margin: 0 auto;padding: 6px;}.app{--a1: #ff4fb8;--a2: #8b5cf6;--a3: #38bdf8;--gold: #ffd166;--glass: rgba(var(--fgrgb),.07);--line: rgba(var(--fgrgb),.14);--fg: #fff;--fgrgb: 255,255,255;--a1rgb: 255,79,184;--a2rgb: 139,92,246;--goldrgb: 255,209,102;--bg: linear-gradient(165deg,#170b38,#0a0620 62%,#0d0828);--bgs: #0c0723;--panel: rgba(10,6,32,.9);--panel2: rgba(20,11,52,.95);--inbg: rgba(0,0,0,.42);--favbg: rgba(0,0,0,.22);--pvbg: radial-gradient(circle at 50% 40%,rgba(46,18,110,.9),rgba(5,2,18,.96) 72%);--inav: #1c1040;--appglow: 0 0 54px rgba(var(--a1rgb),.2);--font: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color: var(--fg);font-family: var(--font);position: relative;overflow: hidden;display: flex;flex-direction: column;height: min(196vw,880px);min-height: 660px;border-radius: 34px;background: var(--bg);border: 1px solid var(--line);box-shadow: 0 28px 70px rgba(0,0,0,.6),var(--appglow);}.app[data-theme="aqua"]{--a1: #22d3ee;--a2: #3b82f6;--a3: #a78bfa;--gold: #86efac;--a1rgb: 34,211,238;--a2rgb: 59,130,246;--goldrgb: 134,239,172;}.app[data-theme="gold"]{--a1: #fbbf24;--a2: #f97316;--a3: #fb7185;--gold: #fde68a;--a1rgb: 251,191,36;--a2rgb: 249,115,22;--goldrgb: 253,230,138;}.app[data-theme="mint"]{--a1: #34d399;--a2: #06b6d4;--a3: #a3e635;--gold: #fef08a;--a1rgb: 52,211,153;--a2rgb: 6,182,212;--goldrgb: 254,240,138;}.aurora{position: absolute;inset: 0;pointer-events: none;overflow: hidden;}.aurora b{position: absolute;width: 300px;height: 300px;border-radius: 50%;filter: blur(66px);opacity: .42;}.aurora b:nth-child(1){background: var(--a1);left: -90px;top: -70px;animation: drift1 11s ease-in-out infinite alternate;}.aurora b:nth-child(2){background: var(--a3);right: -100px;top: 38%;animation: drift2 13s ease-in-out infinite alternate;}.aurora b:nth-child(3){background: var(--a2);left: 22%;bottom: -120px;animation: drift1 15s ease-in-out infinite alternate-reverse;}@keyframes drift1{to{transform: translate(60px,70px) scale(1.2);}}@keyframes drift2{to{transform: translate(-70px,-60px) scale(1.15);}}.sparkles{position: absolute;inset: 0;pointer-events: none;overflow: hidden;}.sparkles i{position: absolute;font-style: normal;color: var(--fg);opacity: 0;animation: twinkle 3.6s ease-in-out infinite;}@keyframes twinkle{0%,100%{opacity: 0;transform: scale(.4) rotate(0);}50%{opacity: .85;transform: scale(1.1) rotate(30deg);}}.bgfx{position: absolute;inset: 0;overflow: hidden;pointer-events: none;}.sun{position: absolute;width: 1300px;height: 1300px;left: 50%;margin-left: -650px;border-radius: 50%;will-change: transform;-webkit-mask-image: radial-gradient(circle,#000 0%,rgba(0,0,0,.55) 38%,transparent 68%);mask-image: radial-gradient(circle,#000 0%,rgba(0,0,0,.55) 38%,transparent 68%);}.sun.s1{top: -520px;opacity: .2;background: repeating-conic-gradient(from 0deg,var(--a1) 0deg 7.5deg,transparent 7.5deg 15deg);animation: spinCW 70s linear infinite;}.sun.s2{bottom: -640px;opacity: .16;background: repeating-conic-gradient(from 0deg,var(--a3) 0deg 5deg,transparent 5deg 15deg);animation: spinCCW 55s linear infinite;}@keyframes spinCW{to{transform: rotate(360deg);}}@keyframes spinCCW{to{transform: rotate(-360deg);}}.ribbon{position: absolute;left: -25%;width: 150%;overflow: hidden;padding: 7px 0;background: linear-gradient(90deg,rgba(var(--fgrgb),.03),rgba(var(--fgrgb),.09),rgba(var(--fgrgb),.03));border-top: 1px solid rgba(var(--fgrgb),.16);border-bottom: 1px solid rgba(var(--fgrgb),.16);}.ribbon.r1{top: 24%;transform: rotate(-12deg);}.ribbon.r2{top: 63%;transform: rotate(11deg);}.rtrack{display: flex;width: max-content;will-change: transform;animation: marqL 26s linear infinite;}.ribbon.r2 .rtrack{animation-name: marqR;animation-duration: 32s;}.rtrack span{flex: 0 0 auto;padding-right: 26px;white-space: nowrap;font-size: 27px;font-weight: 900;letter-spacing: 5px;color: rgba(var(--fgrgb),.07);-webkit-text-stroke: 1px rgba(var(--fgrgb),.34);}.rtrack span b{color: var(--gold);-webkit-text-stroke: 0;font-weight: 900;}.ribbon.r3{top: 66%;transform: rotate(8deg);border-color: rgba(var(--goldrgb),.3);background: linear-gradient(90deg,rgba(var(--goldrgb),.04),rgba(var(--goldrgb),.12),rgba(var(--goldrgb),.04));}.ribbon.r3 .rtrack{animation-name: marqL;animation-duration: 40s;}.ribbon.r3 .rtrack span{color: rgba(var(--goldrgb),.1);-webkit-text-stroke: 1px rgba(var(--goldrgb),.6);}.ribbon.r3 .rtrack span b{color: var(--a1);}@keyframes marqL{from{transform: translateX(0);}to{transform: translateX(-50%);}}@keyframes marqR{from{transform: translateX(-50%);}to{transform: translateX(0);}}.wave{position: absolute;left: 0;bottom: 0;width: 800px;height: 110px;will-change: transform;}.wave path{stroke: none;}.wave.w1{animation: waveA 9s linear infinite;}.wave.w1 path{fill: var(--a1);fill-opacity: .2;}.wave.w2{bottom: -6px;height: 100px;animation: waveB 14s linear infinite;}.wave.w2 path{fill: var(--a2);fill-opacity: .24;}@keyframes waveA{from{transform: translateX(0);}to{transform: translateX(-400px);}}@keyframes waveB{from{transform: translateX(-400px);}to{transform: translateX(0);}}.pulse{position: absolute;left: 50%;bottom: 40px;width: 90px;height: 90px;margin-left: -45px;border-radius: 50%;border: 2px solid var(--a1);opacity: 0;animation: ripple 6s ease-out infinite;}.pulse.p2{border-color: var(--a3);animation-delay: -2s;}.pulse.p3{border-color: var(--gold);animation-delay: -4s;}@keyframes ripple{0%{opacity: .7;transform: scale(.2);}100%{opacity: 0;transform: scale(8);}}.shoot{position: absolute;width: 120px;height: 2px;border-radius: 2px;opacity: 0;background: linear-gradient(90deg,rgba(255,255,255,0),#fff);box-shadow: 0 0 10px 1px rgba(255,255,255,.7);animation: shootAcross linear infinite;}@keyframes shootAcross{0%{opacity: 0;transform: rotate(32deg) translateX(0);}4%{opacity: 1;}22%{opacity: 0;transform: rotate(32deg) translateX(520px);}100%{opacity: 0;transform: rotate(32deg) translateX(520px);}}.rise{position: absolute;inset: 0;}.rise i{position: absolute;bottom: -34px;font-style: normal;color: var(--fg);opacity: 0;animation: riseUp linear infinite;will-change: transform,opacity;text-shadow: 0 0 10px currentColor;}@keyframes riseUp{0%{opacity: 0;transform: translate(0,0) rotate(0deg) scale(.7);}10%{opacity: .85;}50%{transform: translate(18px,-480px) rotate(40deg) scale(1.1);}90%{opacity: .85;}100%{opacity: 0;transform: translate(-8px,-1000px) rotate(90deg) scale(.8);}}@media (prefers-reduced-motion: reduce){.sun,.rtrack,.wave,.pulse,.shoot,.rise i{animation: none;}}.topbar{position: relative;z-index: 3;display: flex;align-items: center;gap: 11px;padding: 15px 17px 9px;}.logo{width: 42px;height: 42px;border-radius: 14px;display: grid;place-items: center;font-size: 22px;background: linear-gradient(135deg,var(--a1),var(--a2));box-shadow: 0 0 20px rgba(var(--a1rgb),.55);}.tb-name{flex: 1;min-width: 0;}.tb-name b{display: block;font-size: 16px;font-weight: 900;letter-spacing: .3px;white-space: nowrap;overflow: hidden;text-overflow: ellipsis;}.tb-name small{display: flex;align-items: center;gap: 5px;font-size: 10.5px;font-weight: 800;letter-spacing: 1.3px;color: #7dffb2;}.dot{width: 8px;height: 8px;border-radius: 50%;background: #3dff8b;box-shadow: 0 0 0 0 rgba(61,255,139,.7);animation: pulse 1.8s infinite;}@keyframes pulse{70%{box-shadow: 0 0 0 8px rgba(61,255,139,0);}100%{box-shadow: 0 0 0 0 rgba(61,255,139,0);}}.themes{display: flex;gap: 7px;}.themes button{width: 22px;height: 22px;border-radius: 50%;border: 2px solid rgba(var(--fgrgb),.35);padding: 0;}.themes button.on{border-color: var(--fg);transform: scale(1.18);}.errbox{display: none;margin: 0 17px 6px;padding: 8px 11px;border-radius: 11px;font-size: 11px;color: #ffb4b4;background: rgba(255,80,80,.14);border: 1px solid rgba(255,80,80,.35);word-break: break-word;position: relative;z-index: 3;}.errbox.show{display: block;}.views{position: relative;z-index: 2;flex: 1;min-height: 0;}.view{position: absolute;inset: 0;overflow-y: auto;padding: 4px 17px 24px;display: none;touch-action: pan-y;scrollbar-width: none;}.view::-webkit-scrollbar{display: none;}.view.on{display: block;animation: viewIn .28s ease-out;}@keyframes viewIn{from{opacity: 0;transform: translateY(8px);}to{opacity: 1;transform: none;}}.h-title{margin: 18px 2px 10px;font-size: 12px;font-weight: 900;letter-spacing: 1.9px;color: var(--gold);display: flex;align-items: center;gap: 8px;}.h-title::after{content: "";flex: 1;height: 1px;background: linear-gradient(90deg,rgba(var(--fgrgb),.28),transparent);}.hero{text-align: center;padding: 8px 0 4px;}.ring{position: relative;width: 136px;height: 136px;margin: 0 auto;border-radius: 50%;padding: 5px;background: conic-gradient(from 0deg,var(--a1),var(--a2),var(--a3),var(--gold),var(--a1));animation: spin 6s linear infinite;}@keyframes spin{to{transform: rotate(360deg);}}.ring .in{position: relative;width: 100%;height: 100%;border-radius: 50%;overflow: hidden;background: var(--inav);display: grid;place-items: center;font-size: 52px;animation: spin 6s linear infinite reverse;}.ring .in img{position: absolute;inset: 0;width: 100%;height: 100%;object-fit: cover;}.ring-wrap{position: relative;width: 136px;margin: 0 auto;}.ring-wrap::after{content: "👑";position: absolute;right: -4px;top: -6px;font-size: 28px;transform: rotate(18deg);filter: drop-shadow(0 2px 6px rgba(0,0,0,.5));}.hello{margin-top: 12px;font-size: 12.5px;font-weight: 800;letter-spacing: 1.5px;color: rgba(var(--fgrgb),.72);}.uname{margin-top: 3px;font-size: 29px;font-weight: 900;line-height: 1.15;word-break: break-word;background: linear-gradient(90deg,var(--fg),var(--gold) 45%,var(--a1));-webkit-background-clip: text;background-clip: text;color: transparent;}.pills{display: flex;flex-wrap: wrap;justify-content: center;gap: 7px;margin-top: 12px;}.pill{padding: 6px 13px;border-radius: 999px;font-size: 11px;font-weight: 800;letter-spacing: .6px;background: var(--glass);border: 1px solid var(--line);}.pill.hot{background: linear-gradient(135deg,var(--a1),var(--a2));border: 0;}.ring::before{content: "";position: absolute;inset: -40%;opacity: 0;z-index: 0;}.ring .in{z-index: 1;}.ring-wrap[data-d="2"] .ring,.ring-wrap[data-d="3"] .ring{background: none;animation: none;border-radius: 0;}.ring-wrap[data-d="2"] .in,.ring-wrap[data-d="3"] .in{animation: none;border-radius: 0;}.ring-wrap[data-d="2"] .ring::before,.ring-wrap[data-d="3"] .ring::before{opacity: 1;}.ring-wrap[data-d="2"] .ring,.ring-wrap[data-d="2"] .in{clip-path: polygon(25% 2%,75% 2%,100% 50%,75% 98%,25% 98%,0 50%);}.ring-wrap[data-d="3"] .ring,.ring-wrap[data-d="3"] .in{clip-path: polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%);}.ring-wrap[data-d="2"] .ring::before{background: conic-gradient(from 0deg,#22d3ee,#ff2bd6,#22d3ee,#ff2bd6,#22d3ee);animation: spinCW 2.2s linear infinite;}.ring-wrap[data-d="2"] .in>img{filter: contrast(1.2) saturate(1.7) hue-rotate(-16deg);}.ring-wrap[data-d="2"] .in::before{content: "";position: absolute;inset: 0;z-index: 2;pointer-events: none;background: linear-gradient(135deg,rgba(34,211,238,.4),rgba(255,43,214,.32));}.ring-wrap[data-d="2"]::after{content: "⚡";transform: rotate(-12deg);}.ring-wrap[data-d="3"] .ring::before{background: conic-gradient(from 0deg,#ffd166,#ff7a3d,#ff4fb8,#ffd166);animation: spinCCW 6s linear infinite;}.ring-wrap[data-d="3"] .in>img{filter: sepia(.4) saturate(1.5) contrast(1.15);}.ring-wrap[data-d="3"] .in::before{content: "";position: absolute;inset: 0;z-index: 2;pointer-events: none;mix-blend-mode: multiply;background-image: radial-gradient(circle,rgba(0,0,0,.42) 1.3px,transparent 1.9px);background-size: 6px 6px;}.ring-wrap[data-d="3"]::after{content: "★";color: #ffd166;transform: rotate(14deg);text-shadow: 0 0 12px rgba(var(--goldrgb),.9);}.gl{position: absolute;inset: 0;z-index: 3;opacity: 0;pointer-events: none;mix-blend-mode: screen;display: grid;place-items: center;font-size: 52px;}.gl img{position: absolute;inset: 0;width: 100%;height: 100%;object-fit: cover;}.gl.ga{filter: sepia(1) saturate(9) hue-rotate(-55deg) brightness(1.1);}.gl.gb{filter: sepia(1) saturate(9) hue-rotate(150deg) brightness(1.1);}.scan{position: absolute;inset: 0;z-index: 4;opacity: 0;pointer-events: none;background-image: linear-gradient(transparent 0,transparent 42%,rgba(255,255,255,.55) 50%,transparent 58%,transparent 100%),repeating-linear-gradient(0deg,rgba(0,0,0,.38) 0,rgba(0,0,0,.38) 2px,transparent 2px,transparent 4px);background-size: 100% 220%,100% 4px;}.ring-wrap.glitch .scan{animation: scanG .64s steps(1,end) 1;}.ring-wrap.glitch[data-g="1"] .gl.ga{animation: glA1 .64s steps(1,end) 1;}.ring-wrap.glitch[data-g="1"] .gl.gb{animation: glB1 .64s steps(1,end) 1;}.ring-wrap.glitch[data-g="2"] .gl.ga{animation: glA2 .64s steps(1,end) 1;}.ring-wrap.glitch[data-g="2"] .gl.gb{animation: glB2 .64s steps(1,end) 1;}.ring-wrap.glitch[data-g="3"] .gl.ga{animation: glA3 .64s steps(1,end) 1;}.ring-wrap.glitch[data-g="3"] .gl.gb{animation: glB3 .64s steps(1,end) 1;}.ring-wrap.glitch[data-g="1"]{animation: wrapG1 .64s steps(1,end) 1;}.ring-wrap.glitch[data-g="2"]{animation: wrapG2 .64s steps(1,end) 1;}.ring-wrap.glitch[data-g="3"]{animation: wrapG3 .64s steps(1,end) 1;}.ring-wrap.glitch[data-g="1"] .in>img{animation: baseG1 .64s steps(1,end) 1;}.ring-wrap.glitch[data-g="2"] .in>img{animation: baseG2 .64s steps(1,end) 1;}.ring-wrap.glitch[data-g="3"] .in>img{animation: baseG3 .64s steps(1,end) 1;}@keyframes scanG{0%{opacity: 0;background-position: 0 0,0 0;}8%{opacity: 1;}30%{background-position: 0 40%,0 0;}55%{opacity: .8;background-position: 0 70%,0 0;}80%{opacity: 1;background-position: 0 100%,0 0;}100%{opacity: 0;}}@keyframes glA1{0%{opacity: 0;}8%{opacity: 1;clip-path: inset(12% 0 70% 0);transform: translateX(-9px);}20%{clip-path: inset(55% 0 20% 0);transform: translateX(8px);}32%{clip-path: inset(30% 0 48% 0);transform: translateX(-12px);}46%{clip-path: inset(70% 0 8% 0);transform: translateX(10px);}60%{clip-path: inset(5% 0 80% 0);transform: translateX(-6px);}74%{clip-path: inset(40% 0 35% 0);transform: translateX(9px);}88%{clip-path: inset(0);transform: translateX(-3px);}100%{opacity: 0;}}@keyframes glB1{0%{opacity: 0;}8%{opacity: 1;clip-path: inset(60% 0 12% 0);transform: translateX(10px);}20%{clip-path: inset(18% 0 62% 0);transform: translateX(-9px);}32%{clip-path: inset(48% 0 30% 0);transform: translateX(13px);}46%{clip-path: inset(6% 0 78% 0);transform: translateX(-10px);}60%{clip-path: inset(75% 0 5% 0);transform: translateX(7px);}74%{clip-path: inset(25% 0 50% 0);transform: translateX(-12px);}88%{clip-path: inset(0);transform: translateX(3px);}100%{opacity: 0;}}@keyframes glA2{0%{opacity: 0;}8%{opacity: 1;clip-path: inset(22% 0 74% 0);transform: translateX(-18px);}16%{clip-path: inset(48% 0 48% 0);transform: translateX(20px);}24%{clip-path: inset(66% 0 30% 0);transform: translateX(-22px);}36%{clip-path: inset(10% 0 86% 0);transform: translateX(16px);}48%{clip-path: inset(84% 0 12% 0);transform: translateX(-14px);}62%{clip-path: inset(35% 0 60% 0);transform: translateX(24px);}76%{clip-path: inset(55% 0 40% 0);transform: translateX(-16px);}90%{clip-path: inset(0);transform: translateX(5px);}100%{opacity: 0;}}@keyframes glB2{0%{opacity: 0;}8%{opacity: 1;clip-path: inset(70% 0 26% 0);transform: translateX(20px);}16%{clip-path: inset(30% 0 66% 0);transform: translateX(-18px);}24%{clip-path: inset(12% 0 84% 0);transform: translateX(22px);}36%{clip-path: inset(58% 0 38% 0);transform: translateX(-20px);}48%{clip-path: inset(40% 0 56% 0);transform: translateX(16px);}62%{clip-path: inset(80% 0 16% 0);transform: translateX(-24px);}76%{clip-path: inset(18% 0 78% 0);transform: translateX(18px);}90%{clip-path: inset(0);transform: translateX(-5px);}100%{opacity: 0;}}@keyframes glA3{0%{opacity: 0;}8%{opacity: 1;clip-path: inset(0 70% 0 5%);transform: translateY(10px);}20%{clip-path: inset(0 30% 0 50%);transform: translateY(-12px);}34%{clip-path: inset(0 55% 0 20%);transform: translateY(14px);}48%{clip-path: inset(0 10% 0 75%);transform: translateY(-10px);}62%{clip-path: inset(0 45% 0 35%);transform: translateY(12px);}78%{clip-path: inset(0 80% 0 0);transform: translateY(-8px);}90%{clip-path: inset(0);transform: translateY(3px);}100%{opacity: 0;}}@keyframes glB3{0%{opacity: 0;}8%{opacity: 1;clip-path: inset(0 5% 0 70%);transform: translateY(-10px);}20%{clip-path: inset(0 50% 0 30%);transform: translateY(12px);}34%{clip-path: inset(0 20% 0 55%);transform: translateY(-14px);}48%{clip-path: inset(0 75% 0 10%);transform: translateY(10px);}62%{clip-path: inset(0 35% 0 45%);transform: translateY(-12px);}78%{clip-path: inset(0 0 0 80%);transform: translateY(8px);}90%{clip-path: inset(0);transform: translateY(-3px);}100%{opacity: 0;}}@keyframes wrapG1{0%{transform: none;}10%{transform: translate(-4px,2px) skewX(6deg);}22%{transform: translate(5px,-2px) skewX(-8deg);opacity: .6;}34%{transform: translate(-3px,0) scale(1.05);opacity: 1;}48%{transform: translate(6px,1px) skewX(10deg);}62%{transform: translate(-5px,-2px);opacity: .7;}78%{transform: translate(3px,2px) skewX(-5deg);opacity: 1;}100%{transform: none;}}@keyframes wrapG2{0%{transform: none;}12%{transform: translateY(-5px) scale(1.06,.9);}26%{transform: translateY(6px) scale(.94,1.08);opacity: .65;}40%{transform: translate(4px,-3px) scale(1.1,.88);opacity: 1;}55%{transform: translateY(5px) scale(.92,1.1);}70%{transform: translate(-5px,0) scale(1.04,.94);opacity: .75;}85%{transform: translateY(-2px);opacity: 1;}100%{transform: none;}}@keyframes wrapG3{0%{transform: none;}10%{transform: rotate(-5deg) translateX(3px);}24%{transform: rotate(6deg) translateX(-4px);opacity: .6;}38%{transform: rotate(-3deg) scale(1.07);opacity: 1;}52%{transform: rotate(5deg) translateY(3px);}68%{transform: rotate(-6deg) translateX(5px);opacity: .7;}82%{transform: rotate(2deg);opacity: 1;}100%{transform: none;}}@keyframes baseG1{10%{filter: hue-rotate(90deg) contrast(1.7);}24%{filter: invert(1);}38%{filter: brightness(2.2) saturate(0);}54%{filter: hue-rotate(-70deg) saturate(3);}70%{filter: contrast(2) grayscale(1);}86%{filter: hue-rotate(40deg);}}@keyframes baseG2{10%{filter: brightness(2.6) saturate(0);}22%{filter: invert(1) hue-rotate(180deg);}36%{filter: contrast(2.4) saturate(2);}50%{filter: hue-rotate(120deg) brightness(1.4);}66%{filter: grayscale(1) contrast(1.8);}84%{filter: invert(1);}}@keyframes baseG3{10%{filter: hue-rotate(-100deg) saturate(3);}26%{filter: grayscale(1) brightness(1.8);}40%{filter: invert(1) contrast(1.5);}56%{filter: hue-rotate(160deg) contrast(2);}72%{filter: brightness(2.4) saturate(0);}86%{filter: hue-rotate(60deg) saturate(2);}}@media (prefers-reduced-motion: reduce){.ring-wrap.glitch,.ring-wrap.glitch .gl,.ring-wrap.glitch .scan,.ring-wrap.glitch .in>img{animation: none;}}.ring-wrap{cursor: pointer;}.ptap{position: absolute;left: 50%;bottom: -10px;transform: translateX(-50%);z-index: 4;padding: 4px 11px;border-radius: 999px;font-size: 9.5px;font-weight: 900;letter-spacing: 1.2px;white-space: nowrap;color: var(--gold);background: var(--panel);border: 1px solid var(--line);animation: ptapPulse 2.4s ease-in-out infinite;}@keyframes ptapPulse{0%,100%{transform: translateX(-50%) scale(1);}50%{transform: translateX(-50%) scale(1.08);box-shadow: 0 0 14px rgba(var(--goldrgb),.5);}}.pv{position: absolute;inset: 0;z-index: 28;display: none;flex-direction: column;align-items: center;justify-content: center;padding: 18px;overflow: hidden;}.pv.on{display: flex;}.pv-bg{position: absolute;inset: 0;opacity: 0;transition: opacity .35s;background: var(--pvbg);}.pv.show .pv-bg{opacity: 1;}.pv.out .pv-bg{opacity: 0;}.pv-bw{position: absolute;left: 50%;top: 36%;width: 960px;height: 960px;margin: -480px 0 0 -480px;opacity: 0;transform: scale(.2);transition: opacity .8s,transform .9s cubic-bezier(.2,.8,.2,1);}.pv.show .pv-bw{opacity: .34;transform: scale(1);}.pv-beams{width: 100%;height: 100%;border-radius: 50%;background: repeating-conic-gradient(from 0deg,var(--a1) 0deg 6deg,transparent 6deg 15deg);-webkit-mask-image: radial-gradient(circle,#000 0%,rgba(0,0,0,.5) 35%,transparent 66%);mask-image: radial-gradient(circle,#000 0%,rgba(0,0,0,.5) 35%,transparent 66%);animation: spinCW 45s linear infinite;}.pv-stage{position: relative;width: 300px;height: 300px;flex: 0 0 300px;transition: transform .3s ease-in,opacity .3s;}.pv.out .pv-stage{transform: scale(.6) rotate(10deg);opacity: 0;}.pv-fs{position: absolute;left: 50%;top: 50%;width: 136px;margin: -68px 0 0 -68px;transform: scale(1.95);}.pv-fs .ring-wrap{margin: 0;}.pv-tiles{position: absolute;left: 50%;top: 50%;width: 126px;height: 126px;margin: -63px 0 0 -63px;transform: scale(1.95);transition: opacity .25s;}.pv-tiles[data-d="2"]{filter: contrast(1.2) saturate(1.7) hue-rotate(-16deg);}.pv-tiles[data-d="3"]{filter: sepia(.4) saturate(1.5) contrast(1.15);}.pv.snap .pv-tiles{opacity: 0;}.pv-t{position: absolute;opacity: 0;background-repeat: no-repeat;will-change: transform,opacity;}.pv.show .pv-t{animation: tileIn .78s cubic-bezier(.22,1.18,.36,1) var(--d) both;}@keyframes tileIn{0%{opacity: 0;transform: translate(var(--tx),var(--ty)) rotate(var(--tr)) scale(.25);}30%{opacity: 1;}100%{opacity: 1;transform: translate(0,0) rotate(0deg) scale(1);}}.pv .pvwrap{opacity: 0;}.pv.snap .pvwrap{animation: framePop .6s cubic-bezier(.2,1.5,.4,1) both;}@keyframes framePop{0%{opacity: 0;transform: scale(1.45) rotate(-24deg);filter: brightness(3);}55%{opacity: 1;filter: brightness(1.6);}100%{opacity: 1;transform: none;filter: none;}}.pv-flash{position: absolute;inset: 0;opacity: 0;pointer-events: none;background: radial-gradient(circle at 50% 38%,rgba(255,255,255,.95),rgba(255,255,255,0) 55%);}.pv.snap .pv-flash{animation: pvFlash .6s ease-out both;}@keyframes pvFlash{0%{opacity: 0;}15%{opacity: 1;}100%{opacity: 0;}}.pv-rp{position: absolute;left: 50%;top: 50%;width: 140px;height: 140px;margin: -70px 0 0 -70px;border-radius: 50%;border: 3px solid var(--a1);opacity: 0;}.pv-rp.r2{border-color: var(--gold);}.pv.snap .pv-rp{animation: pvRip .9s ease-out both;}.pv.snap .pv-rp.r2{animation-delay: .14s;}@keyframes pvRip{0%{opacity: .9;transform: scale(.5);}100%{opacity: 0;transform: scale(3.4);}}.pv-burst{position: absolute;left: 50%;top: 50%;width: 0;height: 0;}.pv-card{position: relative;margin-top: 6px;text-align: center;opacity: 0;transform: translateY(26px);transition: opacity .45s,transform .5s cubic-bezier(.2,1.3,.4,1);}.pv.card .pv-card{opacity: 1;transform: none;}.pv.out .pv-card{opacity: 0;}.pv-name{font-size: 31px;font-weight: 900;line-height: 1.15;word-break: break-word;background: linear-gradient(90deg,var(--fg),var(--gold) 45%,var(--a1));-webkit-background-clip: text;background-clip: text;color: transparent;}.pv-sub{margin-top: 6px;font-size: 12px;font-weight: 800;letter-spacing: 1.4px;color: var(--gold);}.pv-tags{display: flex;flex-wrap: wrap;justify-content: center;gap: 7px;margin-top: 12px;}.pv-copy{margin-top: 15px;padding: 12px 20px;border: 0;border-radius: 999px;color: var(--fg);font-size: 12px;font-weight: 900;letter-spacing: .8px;background: linear-gradient(135deg,var(--a1),var(--a2));box-shadow: 0 8px 22px rgba(var(--a1rgb),.32);}.pv-copy:active{transform: scale(.95);}.pv-x{position: absolute;top: 14px;right: 14px;z-index: 3;width: 44px;height: 44px;border-radius: 50%;padding: 0;color: var(--fg);font-size: 16px;opacity: 0;border: 1px solid rgba(var(--fgrgb),.3);background: var(--panel2);}.pv.show .pv-x{opacity: 1;transition: opacity .4s .6s;}.pv-hint{position: absolute;bottom: 20px;left: 0;right: 0;text-align: center;font-size: 10px;font-weight: 800;letter-spacing: 1.8px;color: rgba(var(--fgrgb),.55);opacity: 0;transition: opacity .5s;}.pv.hint .pv-hint{opacity: 1;}@media (prefers-reduced-motion: reduce){.pv.show .pv-t{animation: none;opacity: 1;}.pv.snap .pvwrap{animation: none;opacity: 1;}.pv-beams,.ptap{animation: none;}}.banner{position: relative;width: 100%;aspect-ratio: 16 / 9;margin-top: 16px;border-radius: 22px;overflow: hidden;background: linear-gradient(135deg,#2a1360,#5b21b6 55%,#be185d);border: 1px solid var(--line);box-shadow: 0 12px 30px rgba(0,0,0,.5);}.banner img{position: absolute;inset: 0;width: 100%;height: 100%;object-fit: cover;z-index: 1;}.banner .fb{position: absolute;inset: 0;display: grid;place-items: center;font-size: 68px;opacity: .5;}.banner::after{content: "";position: absolute;inset: 0;z-index: 2;background: linear-gradient(105deg,transparent 38%,rgba(255,255,255,.22) 50%,transparent 62%);transform: translateX(-120%);animation: shine 4.5s ease-in-out infinite;}@keyframes shine{55%,100%{transform: translateX(120%);}}.banner .shade{position: absolute;inset: 0;z-index: 2;background: linear-gradient(to top,rgba(8,4,24,.88),transparent 55%);}.banner .cap b,.banner .cap small{color: #fff;}.banner .cap small{color: #ffd166;}.banner .cap{position: absolute;left: 15px;right: 15px;bottom: 12px;z-index: 3;}.banner .cap b{display: block;font-size: 19px;font-weight: 900;text-shadow: 0 2px 8px rgba(0,0,0,.6);}.banner .cap small{font-size: 10.5px;font-weight: 800;letter-spacing: 2.2px;color: var(--gold);}.dialog{position: relative;display: flex;gap: 12px;margin-top: 16px;padding: 14px;border-radius: 20px;background: var(--glass);border: 1px solid var(--line);}.dialog .face{flex: 0 0 46px;height: 46px;border-radius: 50%;display: grid;place-items: center;font-size: 24px;background: linear-gradient(135deg,var(--a1),var(--a2));}.dialog .who{font-size: 11px;font-weight: 900;letter-spacing: 1.3px;color: var(--gold);}.dialog .say{margin-top: 4px;font-size: 13.5px;line-height: 1.6;color: rgba(var(--fgrgb),.93);min-height: 66px;}.caret{display: inline-block;width: 2px;height: 14px;margin-left: 1px;vertical-align: -2px;background: var(--a1);animation: blink 1s steps(1) infinite;}@keyframes blink{50%{opacity: 0;}}.stats{display: grid;grid-template-columns: repeat(3,1fr);gap: 9px;margin-top: 14px;}.stat{text-align: center;padding: 14px 4px 12px;border-radius: 18px;background: var(--glass);border: 1px solid var(--line);position: relative;overflow: hidden;}.stat::before{content: "";position: absolute;left: 0;right: 0;top: 0;height: 3px;background: linear-gradient(90deg,var(--c1),var(--c2));}.stat .n{font-size: 24px;font-weight: 900;background: linear-gradient(135deg,var(--c1),var(--c2));-webkit-background-clip: text;background-clip: text;color: transparent;}.stat .l{margin-top: 2px;font-size: 9.5px;font-weight: 800;letter-spacing: 1.4px;color: rgba(var(--fgrgb),.66);}.tip{display: flex;align-items: center;gap: 11px;margin-top: 14px;padding: 12px 14px;border-radius: 18px;background: linear-gradient(135deg,rgba(var(--goldrgb),.14),rgba(var(--fgrgb),.04));border: 1px dashed rgba(var(--goldrgb),.45);}.tip .tic{flex: 0 0 34px;height: 34px;border-radius: 11px;display: grid;place-items: center;font-size: 18px;background: rgba(var(--goldrgb),.2);}.tip .tt{flex: 1;font-size: 12.5px;line-height: 1.5;color: rgba(var(--fgrgb),.9);transition: opacity .25s;}.prog{margin-top: 12px;padding: 13px 14px;border-radius: 18px;background: var(--glass);border: 1px solid var(--line);}.prog .ptop{display: flex;justify-content: space-between;align-items: center;font-size: 12px;font-weight: 900;letter-spacing: .6px;}.prog .ptop span{color: var(--gold);}.bar{margin-top: 9px;height: 10px;border-radius: 999px;background: rgba(var(--fgrgb),.1);overflow: hidden;}.bar i{display: block;height: 100%;width: 0;border-radius: 999px;background: linear-gradient(90deg,var(--a1),var(--a2),var(--a3));transition: width .5s ease;}.prog small{display: block;margin-top: 7px;font-size: 10.5px;color: rgba(var(--fgrgb),.62);font-weight: 700;}.pick{position: relative;width: 100%;display: flex;align-items: center;gap: 12px;padding: 14px;text-align: left;color: var(--fg);border-radius: 20px;border: 1px solid rgba(var(--a1rgb),.5);background: linear-gradient(135deg,rgba(var(--a1rgb),.32),rgba(var(--a2rgb),.32));}.pick .pem{flex: 0 0 48px;height: 48px;border-radius: 15px;display: grid;place-items: center;font-size: 24px;background: linear-gradient(135deg,var(--a1),var(--a2));box-shadow: 0 6px 16px rgba(0,0,0,.35);}.pick .pt{flex: 1;min-width: 0;}.pick .pt b{display: block;font-size: 16px;font-weight: 900;word-break: break-all;}.pick .pt small{display: block;margin-top: 2px;font-size: 11px;color: rgba(var(--fgrgb),.7);font-weight: 700;}.pick .pgo{padding: 8px 13px;border-radius: 999px;font-size: 10.5px;font-weight: 900;letter-spacing: 1px;background: rgba(var(--fgrgb),.18);}.pick:active{transform: scale(.97);}.hscroll{display: flex;gap: 10px;overflow-x: auto;padding: 2px 2px 8px;scrollbar-width: none;touch-action: pan-x pan-y;}.hscroll::-webkit-scrollbar{display: none;}.tc{flex: 0 0 112px;padding: 13px 11px;text-align: left;color: var(--fg);border-radius: 18px;border: 1px solid var(--line);background: linear-gradient(150deg,rgba(var(--fgrgb),.1),rgba(var(--fgrgb),.03));position: relative;overflow: hidden;}.tc::before{content: "";position: absolute;right: -20px;top: -20px;width: 72px;height: 72px;border-radius: 50%;background: linear-gradient(135deg,var(--c1),var(--c2));opacity: .5;}.tc .em{position: relative;font-size: 24px;}.tc b{position: relative;display: block;margin-top: 6px;font-size: 12px;font-weight: 900;word-break: break-word;}.tc small{position: relative;display: block;margin-top: 2px;font-size: 10px;font-weight: 700;color: rgba(var(--fgrgb),.7);}.tc:active{transform: scale(.95);}.acts{display: grid;grid-template-columns: 1fr 1fr;gap: 10px;}.act{position: relative;display: flex;align-items: center;gap: 11px;padding: 14px 12px;text-align: left;border-radius: 18px;color: var(--fg);border: 1px solid var(--line);background: var(--glass);overflow: hidden;}.act .ic{flex: 0 0 40px;height: 40px;border-radius: 13px;display: grid;place-items: center;font-size: 20px;background: linear-gradient(135deg,var(--a1),var(--a2));}.act b{display: block;font-size: 12.5px;font-weight: 900;letter-spacing: .5px;}.act small{display: block;margin-top: 1px;font-size: 10.5px;color: rgba(var(--fgrgb),.64);}.act:active{transform: scale(.96);}.act.wide{grid-column: 1 / -1;background: linear-gradient(135deg,rgba(var(--a1rgb),.35),rgba(var(--a2rgb),.35));border-color: rgba(var(--a1rgb),.5);}.search{position: sticky;top: -4px;z-index: 5;padding: 7px 0 9px;background: linear-gradient(var(--bgs) 70%,transparent);}.search .box{display: flex;align-items: center;gap: 9px;padding: 0 14px;height: 50px;border-radius: 25px;background: var(--inbg);border: 1.5px solid var(--line);}.search .box:focus-within{border-color: var(--a1);box-shadow: 0 0 0 3px rgba(var(--a1rgb),.2);}.search input{flex: 1;min-width: 0;height: 100%;border: 0;outline: none;background: transparent;color: var(--fg);font-size: 15px;}.search input::placeholder{color: rgba(var(--fgrgb),.45);}.search .x{border: 0;background: rgba(var(--fgrgb),.14);color: var(--fg);width: 26px;height: 26px;border-radius: 50%;font-size: 12px;padding: 0;}.sortbar{display: flex;gap: 7px;margin: 2px 0 6px;overflow-x: auto;scrollbar-width: none;}.sortbar::-webkit-scrollbar{display: none;}.sb{flex: 0 0 auto;padding: 7px 13px;border-radius: 999px;border: 1px solid var(--line);background: var(--glass);color: rgba(var(--fgrgb),.75);font-size: 11px;font-weight: 900;letter-spacing: .7px;}.sb.on{color: var(--fg);background: linear-gradient(135deg,var(--a1),var(--a2));border-color: transparent;}.scount{margin: 4px 4px 6px;font-size: 11.5px;font-weight: 800;letter-spacing: .6px;color: var(--gold);min-height: 14px;}.cgrid{display: grid;grid-template-columns: 1fr 1fr;gap: 11px;}.cc{position: relative;padding: 16px 13px 13px;text-align: left;color: var(--fg);border-radius: 22px;border: 1px solid var(--line);overflow: hidden;background: linear-gradient(150deg,rgba(var(--fgrgb),.1),rgba(var(--fgrgb),.03));}.cc::before{content: "";position: absolute;right: -24px;top: -24px;width: 96px;height: 96px;border-radius: 50%;background: linear-gradient(135deg,var(--c1),var(--c2));opacity: .5;filter: blur(2px);}.cc .em{position: relative;width: 48px;height: 48px;border-radius: 15px;display: grid;place-items: center;font-size: 25px;background: linear-gradient(135deg,var(--c1),var(--c2));box-shadow: 0 6px 16px rgba(0,0,0,.35);}.cc b{position: relative;display: block;margin-top: 11px;font-size: 14px;font-weight: 900;letter-spacing: .4px;word-break: break-word;}.cc small{position: relative;display: block;margin-top: 3px;font-size: 11px;font-weight: 700;color: rgba(var(--fgrgb),.7);}.cc .seen{position: absolute;right: 10px;bottom: 10px;z-index: 2;font-size: 13px;opacity: .9;}.cc:active{transform: scale(.96);}.dhead{display: flex;align-items: center;gap: 12px;padding: 5px 0 12px;}.back{flex: 0 0 46px;height: 46px;border-radius: 50%;border: 1px solid var(--line);background: var(--glass);color: var(--fg);font-size: 19px;padding: 0;}.dhead .em{flex: 0 0 50px;height: 50px;border-radius: 16px;display: grid;place-items: center;font-size: 26px;background: linear-gradient(135deg,var(--c1),var(--c2));}.dhead .t{flex: 1;min-width: 0;}.dhead .t b{display: block;font-size: 18px;font-weight: 900;word-break: break-word;}.dhead .t small{font-size: 11.5px;color: rgba(var(--fgrgb),.66);font-weight: 700;}.bigbtn{width: 100%;display: flex;align-items: center;justify-content: center;gap: 8px;padding: 15px 12px;border: 0;border-radius: 17px;color: var(--fg);font-size: 13px;font-weight: 900;letter-spacing: .6px;background: linear-gradient(135deg,var(--a1),var(--a2));box-shadow: 0 8px 22px rgba(var(--a1rgb),.32);}.bigbtn.alt{margin-top: 9px;background: var(--glass);border: 1px solid var(--line);box-shadow: none;}.bigbtn:active{transform: scale(.97);}.minibar{display: flex;gap: 8px;margin-top: 13px;}.minibar .mi{flex: 1;min-width: 0;display: flex;align-items: center;gap: 7px;padding: 0 12px;height: 42px;border-radius: 21px;background: var(--inbg);border: 1.5px solid var(--line);}.minibar .mi input{flex: 1;min-width: 0;height: 100%;border: 0;outline: none;background: transparent;color: var(--fg);font-size: 13.5px;}.minibar .mi input::placeholder{color: rgba(var(--fgrgb),.45);}.minibar .sb{height: 42px;}.letters{display: flex;gap: 6px;margin-top: 10px;overflow-x: auto;scrollbar-width: none;}.letters::-webkit-scrollbar{display: none;}.lt{flex: 0 0 auto;min-width: 34px;height: 34px;padding: 0 8px;border-radius: 11px;border: 1px solid var(--line);background: var(--glass);color: var(--fg);font-size: 12px;font-weight: 900;}.lt.on{background: linear-gradient(135deg,var(--c1,var(--a1)),var(--c2,var(--a2)));border-color: transparent;}.chips{display: flex;flex-wrap: wrap;gap: 9px;margin-top: 14px;}.chipw{display: inline-flex;align-items: stretch;border-radius: 15px;overflow: hidden;border: 1px solid var(--line);background: rgba(var(--fgrgb),.08);}.chip{display: inline-flex;align-items: center;gap: 4px;padding: 11px 13px;border: 0;color: var(--fg);font-size: 14px;font-weight: 700;background: transparent;transition: background .15s,transform .1s;}.chip b{color: var(--gold);font-weight: 900;}.chip i{font-style: normal;font-size: 11px;opacity: .8;}.chip:active{transform: scale(.94);}.chip.copied{background: linear-gradient(135deg,#10b981,#34d399);color: #04261a;}.chip.copied b{color: #04261a;}.fav{width: 38px;border: 0;border-left: 1px solid var(--line);background: var(--favbg);color: rgba(var(--fgrgb),.55);font-size: 16px;padding: 0;}.fav.on{color: var(--gold);background: rgba(var(--goldrgb),.16);}.fav:active{transform: scale(.85);}.empty{padding: 30px 14px;text-align: center;font-size: 13.5px;color: rgba(var(--fgrgb),.72);line-height: 1.6;}.frows{display: flex;flex-direction: column;gap: 9px;}.fr{display: flex;align-items: center;gap: 11px;padding: 11px 12px;border-radius: 17px;border: 1px solid var(--line);background: var(--glass);}.fr .fem{flex: 0 0 40px;height: 40px;border-radius: 13px;display: grid;place-items: center;font-size: 20px;background: linear-gradient(135deg,var(--c1),var(--c2));}.fr .fgo{flex: 1;min-width: 0;text-align: left;border: 0;background: transparent;color: var(--fg);padding: 0;}.fr .fgo b{display: block;font-size: 15px;font-weight: 900;color: var(--gold);word-break: break-all;}.fr .fgo small{display: block;margin-top: 2px;font-size: 10.5px;color: rgba(var(--fgrgb),.62);font-weight: 700;}.fr .fx{flex: 0 0 36px;height: 36px;border-radius: 50%;border: 1px solid var(--line);background: rgba(var(--fgrgb),.08);color: var(--fg);font-size: 14px;padding: 0;}.fr.copied{background: linear-gradient(135deg,rgba(16,185,129,.4),rgba(52,211,153,.3));}.panel{padding: 5px 15px;border-radius: 20px;background: var(--glass);border: 1px solid var(--line);}.row{display: flex;align-items: center;justify-content: space-between;gap: 10px;padding: 12px 0;border-bottom: 1px dashed rgba(var(--fgrgb),.12);}.row:last-child{border-bottom: 0;}.row .k{font-size: 12.5px;font-weight: 800;color: rgba(var(--fgrgb),.76);white-space: nowrap;}.row .k b{color: var(--a1);margin-right: 6px;}.row .v{font-size: 13.5px;font-weight: 800;text-align: right;word-break: break-word;}.faq{border-radius: 18px;border: 1px solid var(--line);background: var(--glass);margin-bottom: 9px;overflow: hidden;}.faq .fq{width: 100%;display: flex;align-items: center;justify-content: space-between;gap: 10px;padding: 13px 14px;border: 0;background: transparent;color: var(--fg);text-align: left;font-size: 13px;font-weight: 800;}.faq .fq span{color: var(--gold);font-size: 16px;transition: transform .2s;}.faq.open .fq span{transform: rotate(45deg);}.faq .fa{display: none;padding: 0 14px 14px;font-size: 12.5px;line-height: 1.6;color: rgba(var(--fgrgb),.82);}.faq.open .fa{display: block;}.duo{display: grid;grid-template-columns: 1fr 1fr;gap: 10px;margin-top: 12px;}.hist{display: flex;flex-direction: column;gap: 9px;}.hi{display: flex;align-items: center;gap: 11px;width: 100%;padding: 13px 14px;border-radius: 16px;text-align: left;color: var(--fg);border: 1px solid var(--line);background: var(--glass);}.hi code{flex: 1;font-size: 15px;font-weight: 800;color: var(--gold);font-family: inherit;word-break: break-all;}.hi small{font-size: 10.5px;color: rgba(var(--fgrgb),.62);font-weight: 700;}.hi:active{transform: scale(.97);}.foot{margin: 22px 0 4px;text-align: center;font-size: 10.5px;letter-spacing: 1.2px;color: rgba(var(--fgrgb),.52);line-height: 1.9;}.foot b{color: var(--gold);}.tabs{position: relative;z-index: 4;display: grid;grid-template-columns: repeat(5,1fr);gap: 3px;margin: 0 11px 12px;padding: 7px;border-radius: 25px;background: var(--panel);border: 1px solid var(--line);box-shadow: 0 12px 30px rgba(0,0,0,.55);}.tab{position: relative;display: flex;flex-direction: column;align-items: center;gap: 3px;padding: 9px 0 8px;border: 0;border-radius: 18px;background: transparent;color: rgba(var(--fgrgb),.6);font-size: 9.5px;font-weight: 900;letter-spacing: .6px;}.tab span{font-size: 20px;filter: grayscale(.7);transition: transform .2s;}.tab.on{color: var(--fg);background: linear-gradient(135deg,rgba(var(--a1rgb),.4),rgba(var(--a2rgb),.4));}.tab.on span{filter: none;transform: translateY(-1px) scale(1.15);}.tab em{position: absolute;top: 3px;right: 9px;min-width: 16px;height: 16px;padding: 0 4px;border-radius: 8px;font-style: normal;font-size: 9.5px;line-height: 16px;text-align: center;color: #1a0b38;background: var(--gold);font-weight: 900;}.snav{position: absolute;right: 14px;z-index: 12;width: 48px;height: 48px;border-radius: 50%;border: 1px solid rgba(var(--fgrgb),.28);color: var(--fg);font-size: 17px;padding: 0;display: grid;place-items: center;background: var(--panel2);box-shadow: 0 6px 18px rgba(0,0,0,.55);}.snav.up{bottom: 168px;}.snav.dn{bottom: 112px;}.snav:active{transform: scale(.88);background: linear-gradient(135deg,var(--a1),var(--a2));}.toast{position: absolute;left: 16px;right: 16px;bottom: 98px;z-index: 30;padding: 13px 16px;border-radius: 18px;font-size: 13.5px;line-height: 1.5;text-align: center;font-weight: 700;background: var(--panel2);border: 1px solid rgba(var(--fgrgb),.28);box-shadow: 0 14px 34px rgba(0,0,0,.6);opacity: 0;transform: translateY(14px) scale(.96);transition: opacity .22s,transform .22s;pointer-events: none;}.toast.show{opacity: 1;transform: none;}.toast em{font-style: normal;color: var(--gold);font-weight: 900;}.burst{position: absolute;z-index: 25;pointer-events: none;font-size: 17px;animation: fly .75s ease-out forwards;}@keyframes fly{from{opacity: 1;transform: translate(0,0) scale(.6);}to{opacity: 0;transform: translate(var(--dx),var(--dy)) scale(1.3) rotate(120deg);}}.modebtn{display: flex;align-items: center;gap: 6px;height: 38px;padding: 0 13px 0 10px;border-radius: 999px;border: 1px solid var(--line);background: var(--glass);color: var(--fg);font-size: 11px;font-weight: 900;letter-spacing: 1px;white-space: nowrap;}.modebtn span{font-size: 17px;}.modebtn:active{transform: scale(.95);}.app:not([data-mode="neon"]) .themes{display: none;}.bgm{position: absolute;inset: 0;overflow: hidden;pointer-events: none;display: none;}.app[data-mode="nature"] .bg-nature,.app[data-mode="space"] .bg-space,.app[data-mode="vintage"] .bg-old,.app[data-mode="paper"] .bg-paper{display: block;}.app:not([data-mode="neon"]) .bgfx{display: none;}.app[data-mode="vintage"] .aurora,.app[data-mode="vintage"] .sparkles,.app[data-mode="paper"] .aurora,.app[data-mode="paper"] .sparkles{display: none;}.bgrib{position: absolute;inset: 0;overflow: hidden;pointer-events: none;}.msheet{position: absolute;inset: 0;z-index: 32;display: none;align-items: flex-end;}.msheet.on{display: flex;}.ms-bg{position: absolute;inset: 0;background: rgba(0,0,0,.55);opacity: 0;transition: opacity .25s;}.msheet.show .ms-bg{opacity: 1;}.ms-card{position: relative;width: 100%;max-height: 82%;overflow-y: auto;padding: 10px 16px 22px;border-radius: 28px 28px 0 0;background: var(--panel2);border-top: 1px solid var(--line);box-shadow: 0 -18px 40px rgba(0,0,0,.4);transform: translateY(105%);transition: transform .36s cubic-bezier(.2,.9,.2,1);scrollbar-width: none;}.ms-card::-webkit-scrollbar{display: none;}.msheet.show .ms-card{transform: none;}.ms-grab{width: 44px;height: 5px;border-radius: 3px;margin: 2px auto 12px;background: rgba(var(--fgrgb),.28);}.ms-title{font-size: 15px;font-weight: 900;letter-spacing: 1.5px;color: var(--gold);}.ms-sub{margin: 3px 0 14px;font-size: 11.5px;color: rgba(var(--fgrgb),.66);font-weight: 700;}.mrow{display: flex;align-items: center;gap: 13px;width: 100%;padding: 11px;margin-bottom: 9px;text-align: left;color: var(--fg);border-radius: 18px;border: 1px solid var(--line);background: var(--glass);}.mrow.on{border-color: var(--a1);box-shadow: 0 0 0 2px rgba(var(--a1rgb),.3);}.mrow:active{transform: scale(.98);}.msw{flex: 0 0 56px;height: 56px;border-radius: 16px;display: grid;place-items: center;font-size: 27px;box-shadow: 0 6px 16px rgba(0,0,0,.3);}.mtx{flex: 1;min-width: 0;}.mtx b{display: block;font-size: 14.5px;font-weight: 900;letter-spacing: .5px;}.mtx small{display: block;margin-top: 3px;font-size: 11px;line-height: 1.4;font-weight: 700;color: rgba(var(--fgrgb),.68);}.mck{font-size: 19px;color: var(--gold);opacity: 0;}.mrow.on .mck{opacity: 1;}.mt{position: absolute;inset: 0;z-index: 36;pointer-events: none;display: grid;place-items: center;clip-path: circle(0% at 86% 6%);animation: modeWipe 1.05s cubic-bezier(.6,0,.3,1) both;}.mt i{font-style: normal;font-size: 70px;color: #fff;filter: drop-shadow(0 0 22px rgba(255,255,255,.9));animation: mtStar 1.05s ease-in-out both;}@keyframes modeWipe{0%{clip-path: circle(0% at 86% 6%);opacity: 1;}42%{clip-path: circle(150% at 86% 6%);opacity: 1;}62%{clip-path: circle(150% at 86% 6%);opacity: 1;}100%{clip-path: circle(150% at 86% 6%);opacity: 0;}}@keyframes mtStar{0%{transform: scale(.2) rotate(0deg);opacity: 0;}40%{opacity: 1;}55%{transform: scale(1.4) rotate(180deg);opacity: 1;}100%{transform: scale(2.4) rotate(320deg);opacity: 0;}}.app[data-mode="nature"]{--a1: #ff9ccf;--a2: #34d399;--a3: #7dd3fc;--gold: #ffe08a;--fg: #f2fff6;--fgrgb: 242,255,246;--a1rgb: 255,156,207;--a2rgb: 52,211,153;--goldrgb: 255,224,138;--bg: linear-gradient(175deg,#12403a 0%,#0c2c27 48%,#0b2118 100%);--bgs: #0e332d;--panel: rgba(10,38,32,.93);--panel2: rgba(12,44,37,.97);--inbg: rgba(0,24,16,.42);--favbg: rgba(0,0,0,.2);--pvbg: radial-gradient(circle at 50% 40%,rgba(24,92,70,.92),rgba(4,24,18,.97) 72%);--inav: #12372f;--appglow: 0 0 52px rgba(52,211,153,.24);--font: ui-rounded,"SF Pro Rounded","Nunito","Trebuchet MS",system-ui,sans-serif;--glass: rgba(236,255,240,.08);--line: rgba(190,255,220,.2);}.sunglow{position: absolute;right: -70px;top: -60px;width: 270px;height: 270px;border-radius: 50%;background: radial-gradient(circle,rgba(var(--goldrgb),.5),rgba(var(--goldrgb),0) 68%);animation: breathe 7s ease-in-out infinite alternate;}@keyframes breathe{from{opacity: .55;transform: scale(.92);}to{opacity: 1;transform: scale(1.08);}}.hill{position: absolute;left: 0;bottom: 0;width: 1200px;will-change: transform;}.hill path{stroke: none;}.hill.h1{height: 130px;animation: hillA 44s linear infinite;}.hill.h1 path{fill: rgba(var(--a2rgb),.22);}.hill.h2{height: 96px;bottom: -4px;animation: hillB 28s linear infinite;}.hill.h2 path{fill: rgba(var(--a2rgb),.34);}@keyframes hillA{from{transform: translateX(0);}to{transform: translateX(-600px);}}@keyframes hillB{from{transform: translateX(-400px);}to{transform: translateX(0);}}.petal{position: absolute;top: -30px;width: 11px;height: 15px;border-radius: 80% 0 80% 0;opacity: 0;background: linear-gradient(135deg,#ffd9ec,#ff8fc7);animation: petalFall linear infinite;will-change: transform,opacity;}@keyframes petalFall{0%{opacity: 0;transform: translate(0,0) rotate(0deg);}8%{opacity: .85;}50%{transform: translate(var(--sw),480px) rotate(260deg);}92%{opacity: .85;}100%{opacity: 0;transform: translate(0,980px) rotate(560deg);}}.fly{position: absolute;width: 5px;height: 5px;border-radius: 50%;background: var(--gold);box-shadow: 0 0 10px 3px rgba(var(--goldrgb),.7);animation: flyDrift ease-in-out infinite alternate,flyGlow ease-in-out infinite alternate;}@keyframes flyDrift{from{transform: translate(0,0);}to{transform: translate(var(--dx),var(--dy));}}@keyframes flyGlow{from{opacity: .15;}to{opacity: 1;}}.app[data-mode="nature"] .stat,.app[data-mode="nature"] .cc,.app[data-mode="nature"] .act,.app[data-mode="nature"] .panel,.app[data-mode="nature"] .pick,.app[data-mode="nature"] .tip,.app[data-mode="nature"] .prog,.app[data-mode="nature"] .dialog,.app[data-mode="nature"] .faq,.app[data-mode="nature"] .fr,.app[data-mode="nature"] .hi,.app[data-mode="nature"] .tc,.app[data-mode="nature"] .mrow{border-radius: 26px 8px 26px 8px;}.app[data-mode="nature"] .banner{border-radius: 30px 10px 30px 10px;}.app[data-mode="nature"] .chipw{border-radius: 16px 6px 16px 6px;}.app[data-mode="nature"]{border-radius: 40px;}.app[data-mode="nature"] .tabs{border-radius: 30px;}.app[data-mode="space"]{--a1: #7aa2ff;--a2: #b36bff;--a3: #36e0ff;--gold: #ffd86b;--fg: #eaf0ff;--fgrgb: 234,240,255;--a1rgb: 122,162,255;--a2rgb: 179,107,255;--goldrgb: 255,216,107;--bg: linear-gradient(170deg,#050818 0%,#0a0b2e 55%,#140826 100%);--bgs: #080a22;--panel: rgba(6,8,30,.95);--panel2: rgba(10,12,40,.97);--inbg: rgba(0,0,12,.5);--favbg: rgba(0,0,10,.3);--pvbg: radial-gradient(circle at 50% 40%,rgba(40,24,110,.93),rgba(2,3,14,.97) 72%);--inav: #10123a;--appglow: 0 0 58px rgba(122,162,255,.3);--font: "SF Mono","Roboto Mono",Menlo,Consolas,"Courier New",monospace;--glass: rgba(150,170,255,.07);--line: rgba(120,200,255,.27);}.stars{position: absolute;display: block;will-change: transform;}.stars.st1{left: 0;top: 0;right: 0;bottom: -200px;background-image: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Ccircle cx='14' cy='22' r='1.1' fill='%23ffffff' fill-opacity='0.8'/%3E%3Ccircle cx='62' cy='8' r='0.9' fill='%23ffffff' fill-opacity='0.6'/%3E%3Ccircle cx='118' cy='36' r='1.4' fill='%23ffffff' fill-opacity='0.9'/%3E%3Ccircle cx='176' cy='14' r='1' fill='%23ffffff' fill-opacity='0.7'/%3E%3Ccircle cx='36' cy='74' r='1.3' fill='%23ffffff' fill-opacity='0.75'/%3E%3Ccircle cx='96' cy='92' r='0.9' fill='%23ffffff' fill-opacity='0.55'/%3E%3Ccircle cx='150' cy='70' r='1.2' fill='%23ffffff' fill-opacity='0.8'/%3E%3Ccircle cx='188' cy='112' r='0.9' fill='%23ffffff' fill-opacity='0.6'/%3E%3Ccircle cx='22' cy='134' r='1' fill='%23ffffff' fill-opacity='0.7'/%3E%3Ccircle cx='74' cy='158' r='1.5' fill='%23ffffff' fill-opacity='0.85'/%3E%3Ccircle cx='134' cy='150' r='1' fill='%23ffffff' fill-opacity='0.65'/%3E%3Ccircle cx='180' cy='186' r='1.2' fill='%23ffffff' fill-opacity='0.8'/%3E%3Ccircle cx='48' cy='190' r='0.8' fill='%23ffffff' fill-opacity='0.5'/%3E%3C/svg%3E");background-size: 200px 200px;animation: starsUp 48s linear infinite;}.stars.st2{left: -320px;top: -320px;right: 0;bottom: 0;background-image: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='320'%3E%3Cpath transform='translate(52 60) scale(1.1)' d='M0 -10 Q0 0 10 0 Q0 0 0 10 Q0 0 -10 0 Q0 0 0 -10Z' fill='%23ffffff' fill-opacity='0.75'/%3E%3Cpath transform='translate(238 40) scale(0.8)' d='M0 -10 Q0 0 10 0 Q0 0 0 10 Q0 0 -10 0 Q0 0 0 -10Z' fill='%23bfe4ff' fill-opacity='0.6'/%3E%3Cpath transform='translate(150 150) scale(1.5)' d='M0 -10 Q0 0 10 0 Q0 0 0 10 Q0 0 -10 0 Q0 0 0 -10Z' fill='%23fff1b8' fill-opacity='0.85'/%3E%3Cpath transform='translate(284 210) scale(0.9)' d='M0 -10 Q0 0 10 0 Q0 0 0 10 Q0 0 -10 0 Q0 0 0 -10Z' fill='%23ffffff' fill-opacity='0.65'/%3E%3Cpath transform='translate(70 262) scale(0.75)' d='M0 -10 Q0 0 10 0 Q0 0 0 10 Q0 0 -10 0 Q0 0 0 -10Z' fill='%23e3c9ff' fill-opacity='0.6'/%3E%3Ccircle cx='110' cy='24' r='2.2' fill='%23ffffff' fill-opacity='0.7'/%3E%3Ccircle cx='20' cy='150' r='1.8' fill='%23ffffff' fill-opacity='0.6'/%3E%3Ccircle cx='210' cy='110' r='2' fill='%23bfe4ff' fill-opacity='0.65'/%3E%3Ccircle cx='250' cy='290' r='2.2' fill='%23ffffff' fill-opacity='0.6'/%3E%3Ccircle cx='180' cy='250' r='1.6' fill='%23ffffff' fill-opacity='0.55'/%3E%3C/svg%3E");background-size: 320px 320px;animation: starsDiag 110s linear infinite;}@keyframes starsUp{from{transform: translateY(0);}to{transform: translateY(-200px);}}@keyframes starsDiag{from{transform: translate(0,0);}to{transform: translate(320px,320px);}}.planet{position: absolute;right: -34px;top: 96px;width: 126px;height: 126px;border-radius: 50%;opacity: .85;animation: planetBob 8s ease-in-out infinite alternate;background: radial-gradient(circle at 32% 30%,#c9d4ff,#6a5be0 52%,#1d1257 100%);box-shadow: 0 0 40px rgba(122,162,255,.45),inset -14px -10px 26px rgba(0,0,20,.55);}.planet::after{content: "";position: absolute;left: -34px;top: 46px;width: 194px;height: 34px;border-radius: 50%;border: 5px solid rgba(255,216,107,.55);transform: rotate(-16deg);box-shadow: 0 0 14px rgba(255,216,107,.3);}@keyframes planetBob{from{transform: translateY(-8px);}to{transform: translateY(8px);}}.comet{position: absolute;left: 6%;top: 14%;width: 150px;height: 2px;border-radius: 2px;opacity: 0;background: linear-gradient(90deg,rgba(255,255,255,0),#fff);box-shadow: 0 0 12px 2px rgba(150,220,255,.8);animation: cometFly 11s linear infinite;}@keyframes cometFly{0%{opacity: 0;transform: rotate(28deg) translateX(0);}3%{opacity: 1;}17%{opacity: 0;transform: rotate(28deg) translateX(560px);}100%{opacity: 0;transform: rotate(28deg) translateX(560px);}}.app[data-mode="space"] .stat,.app[data-mode="space"] .cc,.app[data-mode="space"] .act,.app[data-mode="space"] .panel,.app[data-mode="space"] .pick,.app[data-mode="space"] .tip,.app[data-mode="space"] .prog,.app[data-mode="space"] .dialog,.app[data-mode="space"] .faq,.app[data-mode="space"] .fr,.app[data-mode="space"] .hi,.app[data-mode="space"] .tc,.app[data-mode="space"] .mrow{border-radius: 4px 16px 4px 16px;box-shadow: inset 0 0 22px rgba(54,224,255,.07);}.app[data-mode="space"] .banner{border-radius: 6px 20px 6px 20px;}.app[data-mode="space"] .chipw{border-radius: 4px 12px 4px 12px;}.app[data-mode="space"] .h-title,.app[data-mode="space"] .tab,.app[data-mode="space"] .cc b{letter-spacing: 1.8px;}.app[data-mode="space"] .tabs{border-radius: 8px 24px 8px 24px;}.app[data-mode="vintage"]{--a1: #d98a9e;--a2: #b4642d;--a3: #e0b86a;--gold: #f4d58d;--fg: #f7e8c9;--fgrgb: 247,232,201;--a1rgb: 217,138,158;--a2rgb: 180,100,45;--goldrgb: 244,213,141;--bg: linear-gradient(160deg,#33200f 0%,#1f130a 58%,#2a1a0d 100%);--bgs: #26170c;--panel: rgba(30,18,9,.95);--panel2: rgba(38,23,12,.97);--inbg: rgba(10,5,0,.42);--favbg: rgba(0,0,0,.25);--pvbg: radial-gradient(circle at 50% 40%,rgba(88,50,20,.93),rgba(16,9,4,.97) 72%);--inav: #2c1b0e;--appglow: 0 0 46px rgba(244,213,141,.14);--font: Georgia,"Times New Roman","Noto Serif",serif;--glass: rgba(244,214,160,.07);--line: rgba(228,190,120,.3);}.film{position: absolute;top: -36px;bottom: 0;width: 20px;background-color: rgba(10,5,2,.55);background-image: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='36'%3E%3Crect x='5' y='9' width='10' height='18' rx='3' fill='%23f4d58d' fill-opacity='.55'/%3E%3C/svg%3E");background-size: 20px 36px;animation: filmRoll 3s linear infinite;will-change: transform;}.film.fl{left: 0;}.film.fr{right: 0;}@keyframes filmRoll{from{transform: translateY(0);}to{transform: translateY(36px);}}.grain{position: absolute;inset: -60px;opacity: .13;background-image: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1  0 0 0 0 .92  0 0 0 0 .75  0 0 0 .9 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");background-size: 160px 160px;animation: grainShift .9s steps(1) infinite;}@keyframes grainShift{0%{transform: translate(0,0);}16%{transform: translate(-30px,22px);}33%{transform: translate(18px,-38px);}50%{transform: translate(-44px,-12px);}66%{transform: translate(36px,30px);}83%{transform: translate(-12px,44px);}100%{transform: translate(0,0);}}.vig{position: absolute;inset: 0;background: radial-gradient(ellipse at center,rgba(0,0,0,0) 52%,rgba(0,0,0,.6) 100%);animation: flick 6s steps(1) infinite;}@keyframes flick{0%{opacity: 1;}7%{opacity: .82;}9%{opacity: 1;}41%{opacity: 1;}43%{opacity: .88;}46%{opacity: 1;}78%{opacity: .9;}80%{opacity: 1;}100%{opacity: 1;}}.scratch{position: absolute;top: 0;bottom: 0;width: 1px;opacity: 0;background: rgba(255,240,210,.4);animation: scratchGo 7s steps(1) infinite;}@keyframes scratchGo{0%{left: 18%;opacity: 0;}10%{opacity: .55;}12%{left: 63%;}14%{opacity: 0;}50%{left: 37%;opacity: 0;}52%{opacity: .5;}55%{left: 81%;}58%{opacity: 0;}100%{opacity: 0;}}.app[data-mode="vintage"] .stat,.app[data-mode="vintage"] .cc,.app[data-mode="vintage"] .act,.app[data-mode="vintage"] .panel,.app[data-mode="vintage"] .pick,.app[data-mode="vintage"] .tip,.app[data-mode="vintage"] .prog,.app[data-mode="vintage"] .dialog,.app[data-mode="vintage"] .faq,.app[data-mode="vintage"] .fr,.app[data-mode="vintage"] .hi,.app[data-mode="vintage"] .tc,.app[data-mode="vintage"] .mrow{border-radius: 4px;box-shadow: inset 0 0 0 3px rgba(26,15,8,.85),inset 0 0 0 4px rgba(var(--goldrgb),.3);}.app[data-mode="vintage"] .banner{border-radius: 4px;box-shadow: 0 0 0 3px rgba(26,15,8,.9),0 0 0 4px rgba(var(--goldrgb),.4),0 12px 30px rgba(0,0,0,.5);}.app[data-mode="vintage"] .banner img{filter: sepia(.6) contrast(1.05);}.app[data-mode="vintage"] .chipw{border-radius: 4px;}.app[data-mode="vintage"] .tabs{border-radius: 6px;}.app[data-mode="vintage"]{border-radius: 14px;}.app[data-mode="vintage"] .uname,.app[data-mode="vintage"] .pv-name{font-style: italic;letter-spacing: .5px;}.app[data-mode="vintage"] .h-title{letter-spacing: 2.6px;font-variant: small-caps;}.app[data-mode="paper"]{--a1: #e0457b;--a2: #5b6ee1;--a3: #1fb5a5;--gold: #b9770e;--fg: #2d2a4a;--fgrgb: 45,42,74;--a1rgb: 224,69,123;--a2rgb: 91,110,225;--goldrgb: 185,119,14;--bg: #f3ecdc;--bgs: #f3ecdc;--panel: rgba(255,251,240,.97);--panel2: rgba(255,251,240,.99);--inbg: rgba(255,255,255,.92);--favbg: rgba(45,42,74,.06);--pvbg: radial-gradient(circle at 50% 40%,rgba(255,250,235,.97),rgba(228,216,188,.98) 75%);--inav: #e9dfc8;--appglow: 0 0 0 rgba(0,0,0,0);--font: "Bradley Hand","Segoe Print","Chalkboard SE","Comic Sans MS","Marker Felt",cursive,system-ui;--glass: rgba(255,255,255,.72);--line: rgba(45,42,74,.2);border: 2px solid rgba(45,42,74,.22);box-shadow: 0 22px 54px rgba(0,0,0,.35);border-radius: 12px;}.paperbg{position: absolute;inset: 0;background-image: linear-gradient(90deg,transparent 0,transparent 43px,rgba(224,69,123,.38) 43px,rgba(224,69,123,.38) 45px,transparent 45px),repeating-linear-gradient(0deg,transparent 0,transparent 31px,rgba(91,110,225,.17) 31px,rgba(91,110,225,.17) 32px);}.holes{position: absolute;left: 0;top: 0;bottom: 0;width: 30px;background-image: radial-gradient(circle at 15px 16px,rgba(45,42,74,.55) 5px,transparent 5.6px);background-size: 30px 32px;background-repeat: repeat-y;}.doodle{position: absolute;font-style: normal;font-weight: 900;opacity: .34;animation: doodleFloat ease-in-out infinite alternate;}@keyframes doodleFloat{from{transform: translateY(-9px) rotate(-8deg);}to{transform: translateY(9px) rotate(8deg);}}.plane{position: absolute;left: 0;top: 24%;width: 40px;height: 40px;opacity: 0;animation: planeFly 15s linear infinite;}.plane path{fill: #fff;stroke: var(--fg);stroke-width: 1.4;stroke-linejoin: round;}@keyframes planeFly{0%{opacity: 0;transform: translate(-60px,180px) rotate(-18deg);}6%{opacity: .9;}94%{opacity: .9;}100%{opacity: 0;transform: translate(600px,-120px) rotate(-18deg);}}.app[data-mode="paper"] .stat,.app[data-mode="paper"] .act,.app[data-mode="paper"] .panel,.app[data-mode="paper"] .tip,.app[data-mode="paper"] .prog,.app[data-mode="paper"] .dialog,.app[data-mode="paper"] .faq,.app[data-mode="paper"] .fr,.app[data-mode="paper"] .hi,.app[data-mode="paper"] .mrow{background: rgba(255,253,244,.95);border-radius: 3px;border: 1px solid rgba(45,42,74,.15);box-shadow: 2px 3px 0 rgba(45,42,74,.1),0 10px 18px rgba(45,42,74,.07);}.app[data-mode="paper"] .cc,.app[data-mode="paper"] .tc{background: rgba(255,253,244,.96);border-radius: 3px;border: 1px solid rgba(45,42,74,.15);box-shadow: 2px 3px 0 rgba(45,42,74,.1),0 10px 18px rgba(45,42,74,.07);}.app[data-mode="paper"] .cc::before,.app[data-mode="paper"] .tc::before{opacity: .26;}.app[data-mode="paper"] .pick{border-radius: 3px;box-shadow: 2px 3px 0 rgba(45,42,74,.12);}.app[data-mode="paper"] .banner{border-radius: 3px;border: 6px solid #fffdf5;box-shadow: 2px 4px 0 rgba(45,42,74,.15),0 14px 26px rgba(45,42,74,.18);}.app[data-mode="paper"] .chipw{border-radius: 3px;}.app[data-mode="paper"] .tabs{border-radius: 8px;box-shadow: 0 8px 20px rgba(45,42,74,.18);}.app[data-mode="paper"] .cc:nth-child(odd){transform: rotate(-.7deg);}.app[data-mode="paper"] .cc:nth-child(even){transform: rotate(.6deg);}.app[data-mode="paper"] .cc:active{transform: scale(.96);}.app[data-mode="paper"] .cc::after,.app[data-mode="paper"] .dialog::after,.app[data-mode="paper"] .pick::after{content: "";position: absolute;z-index: 3;width: 44px;height: 14px;background: rgba(255,208,90,.78);box-shadow: 0 1px 2px rgba(45,42,74,.2);}.app[data-mode="paper"] .cc::after{top: 5px;right: 14px;transform: rotate(5deg);}.app[data-mode="paper"] .dialog::after{top: -7px;left: 50%;margin-left: -22px;transform: rotate(-3deg);}.app[data-mode="paper"] .pick::after{top: -7px;right: 24px;transform: rotate(4deg);}.app[data-mode="paper"] .pill.hot,.app[data-mode="paper"] .bigbtn,.app[data-mode="paper"] .sb.on,.app[data-mode="paper"] .lt.on,.app[data-mode="paper"] .pv-copy{color: #fff;}.app[data-mode="paper"] .bigbtn.alt{color: var(--fg);}.app[data-mode="paper"] .stat .n{background: linear-gradient(135deg,var(--a1),var(--a2));-webkit-background-clip: text;background-clip: text;}.app[data-mode="paper"] .tb-name small{color: #0f9d58;}.app[data-mode="paper"] .ring .in{background: var(--inav);}.app[data-mode="paper"] .uname,.app[data-mode="paper"] .pv-name{background: linear-gradient(90deg,var(--a2),var(--a1));-webkit-background-clip: text;background-clip: text;}.modebtn{padding: 0;width: 38px;justify-content: center;}.modebtn b{display: none;}.app[data-mode="nature"] .banner{background: linear-gradient(135deg,#0f4a3a,#1f8f6a 55%,#d96aa6);}.app[data-mode="space"] .banner{background: linear-gradient(135deg,#0a0b3a,#3a1a8a 55%,#1aa7d9);}.app[data-mode="vintage"] .banner{background: linear-gradient(135deg,#4a2c14,#7a4420 55%,#b0703a);}.app[data-mode="paper"] .banner{background: linear-gradient(135deg,#ffe9a8,#ffd0e0 55%,#bcd0ff);}.app:not([data-mode="neon"]) .ring-wrap[data-d="2"] .ring::before{background: conic-gradient(from 0deg,var(--a3),var(--a1),var(--a3),var(--a1),var(--a3));}.app:not([data-mode="neon"]) .ring-wrap[data-d="2"] .in::before{background: linear-gradient(135deg,rgba(var(--a2rgb),.34),rgba(var(--a1rgb),.3));}.app:not([data-mode="neon"]) .ring-wrap[data-d="2"]::after{text-shadow: 0 0 10px rgba(var(--goldrgb),.8);}.rank{position: relative;overflow: hidden;display: flex;gap: 14px;align-items: center;margin-top: 14px;padding: 14px;border-radius: 20px;border: 1px solid var(--line);background: linear-gradient(135deg,rgba(var(--a1rgb),.22),rgba(var(--a2rgb),.18));}.rank::before{content: "";position: absolute;right: -30px;top: -30px;width: 130px;height: 130px;border-radius: 50%;background: radial-gradient(circle,rgba(var(--goldrgb),.35),transparent 68%);}.rk-badge{position: relative;flex: 0 0 68px;height: 68px;padding: 3px;border-radius: 50%;background: conic-gradient(var(--a1),var(--a2),var(--a3),var(--gold),var(--a1));}.rk-badge i{display: grid;place-items: center;width: 100%;height: 100%;border-radius: 50%;background: var(--inav);font-style: normal;font-size: 32px;}.rk-badge.pop{animation: rkPop .7s cubic-bezier(.2,1.5,.4,1);}@keyframes rkPop{0%{transform: scale(.4) rotate(-40deg);}100%{transform: none;}}.rk-main{position: relative;flex: 1;min-width: 0;}.rk-top{display: flex;justify-content: space-between;align-items: baseline;gap: 8px;}.rk-top b{font-size: 16px;font-weight: 900;letter-spacing: 1.2px;}.rk-top span{font-size: 12px;font-weight: 900;letter-spacing: 1px;color: var(--gold);}.rk-bar{position: relative;margin-top: 8px;height: 12px;border-radius: 999px;overflow: hidden;background: rgba(var(--fgrgb),.12);}.rk-bar i{position: relative;display: block;height: 100%;width: 0;border-radius: 999px;overflow: hidden;background: linear-gradient(90deg,var(--a1),var(--a2),var(--a3));transition: width .9s cubic-bezier(.2,.9,.2,1);}.rk-bar i::after{content: "";position: absolute;inset: 0;background: linear-gradient(100deg,transparent 30%,rgba(255,255,255,.6) 50%,transparent 70%);transform: translateX(-100%);animation: rkShine 2.6s ease-in-out infinite;}@keyframes rkShine{60%,100%{transform: translateX(100%);}}.rk-sub{display: flex;justify-content: space-between;gap: 8px;margin-top: 6px;font-size: 10.5px;font-weight: 800;color: rgba(var(--fgrgb),.72);}.rk-road{display: flex;justify-content: space-between;align-items: center;margin-top: 9px;}.rk-road i{display: grid;place-items: center;width: 26px;height: 26px;border-radius: 50%;font-style: normal;font-size: 13px;filter: grayscale(1);opacity: .45;border: 1px solid var(--line);background: rgba(var(--fgrgb),.06);}.rk-road i.done{filter: none;opacity: 1;}.rk-road i.cur{filter: none;opacity: 1;border-color: var(--gold);box-shadow: 0 0 0 2px rgba(var(--goldrgb),.35);transform: scale(1.18);}.rk-gain{position: absolute;right: 4px;top: -8px;font-size: 12.5px;font-weight: 900;color: var(--gold);opacity: 0;pointer-events: none;}.rk-gain.show{animation: gainUp 1s ease-out;}@keyframes gainUp{0%{opacity: 0;transform: translateY(8px);}20%{opacity: 1;}100%{opacity: 0;transform: translateY(-22px);}}.rk-demo{margin-top: 7px;font-size: 10px;font-weight: 800;letter-spacing: .6px;color: rgba(var(--fgrgb),.55);}.lvup{position: absolute;inset: 0;z-index: 34;display: none;align-items: center;justify-content: center;overflow: hidden;}.lvup.on{display: flex;}.lv-bg{position: absolute;inset: 0;opacity: 0;transition: opacity .3s;background: radial-gradient(circle at 50% 45%,rgba(60,20,120,.93),rgba(4,2,16,.97) 75%);}.lvup.show .lv-bg{opacity: 1;}.lv-rw{position: absolute;left: 50%;top: 46%;width: 1000px;height: 1000px;margin: -500px 0 0 -500px;opacity: 0;transform: scale(.2);transition: opacity .8s,transform .9s cubic-bezier(.2,.8,.2,1);}.lvup.show .lv-rw{opacity: .42;transform: scale(1);}.lv-rays{width: 100%;height: 100%;border-radius: 50%;background: repeating-conic-gradient(from 0deg,rgba(255,209,102,.95) 0deg 4deg,transparent 4deg 12deg);-webkit-mask-image: radial-gradient(circle,#000 0%,rgba(0,0,0,.4) 38%,transparent 66%);mask-image: radial-gradient(circle,#000 0%,rgba(0,0,0,.4) 38%,transparent 66%);animation: spinCW 26s linear infinite;}.lv-box{position: relative;text-align: center;color: #fff;padding: 0 20px;}.lv-tag{font-size: 36px;font-weight: 900;letter-spacing: 4px;color: #ffd166;opacity: 0;text-shadow: 0 0 24px rgba(255,209,102,.8),0 4px 0 rgba(0,0,0,.4);}.lvup.show .lv-tag{animation: lvSlam .7s cubic-bezier(.2,1.4,.4,1) .15s both;}@keyframes lvSlam{0%{opacity: 0;transform: scale(3) rotate(-6deg);}60%{opacity: 1;transform: scale(.92) rotate(2deg);}100%{opacity: 1;transform: scale(1) rotate(0deg);}}.lv-numwrap{position: relative;width: 190px;height: 120px;margin: 4px auto 0;overflow: hidden;}.lv-n{position: absolute;left: 0;right: 0;top: 0;line-height: 120px;font-size: 98px;font-weight: 900;color: #fff;text-shadow: 0 0 30px rgba(255,79,184,.9),0 6px 0 rgba(0,0,0,.35);transition: transform .5s cubic-bezier(.3,1.3,.4,1);}.lv-n.o{transform: none;}.lv-n.n{transform: translateY(100%);}.lvup.roll .lv-n.o{transform: translateY(-100%);}.lvup.roll .lv-n.n{transform: none;}.lv-rank{margin-top: 6px;font-size: 17px;font-weight: 900;letter-spacing: 2px;color: #fff;opacity: 0;transform: translateY(14px);transition: opacity .5s,transform .5s;}.lvup.rk .lv-rank{opacity: 1;transform: none;}.lv-hint{margin-top: 26px;font-size: 10px;font-weight: 800;letter-spacing: 1.8px;color: rgba(255,255,255,.55);}.cf{position: absolute;top: -24px;width: 8px;height: 14px;border-radius: 2px;animation: cfFall linear forwards;}@keyframes cfFall{to{transform: translate(var(--cx),980px) rotate(720deg);}}.gacha{text-align: center;}.gc-stage{position: relative;width: 176px;height: 250px;margin: 4px auto 0;perspective: 900px;}.gc-card{position: absolute;inset: 0;transform-style: preserve-3d;transition: transform .8s cubic-bezier(.3,1.2,.4,1);cursor: pointer;}.gc-card.flip{transform: rotateY(180deg);}.gc-card.shake{animation: gcShake .46s ease-in-out;}@keyframes gcShake{0%,100%{transform: rotate(0deg);}20%{transform: rotate(-6deg) translateX(-4px);}40%{transform: rotate(6deg) translateX(4px);}60%{transform: rotate(-4deg);}80%{transform: rotate(3deg);}}.gc-face{position: absolute;inset: 0;border-radius: 18px;overflow: hidden;display: flex;flex-direction: column;align-items: center;justify-content: center;-webkit-backface-visibility: hidden;backface-visibility: hidden;}.gc-back{color: #fff;border: 3px solid rgba(255,255,255,.7);box-shadow: 0 14px 34px rgba(0,0,0,.45),0 0 26px rgba(var(--a1rgb),.4);background: repeating-linear-gradient(45deg,rgba(255,255,255,.07) 0,rgba(255,255,255,.07) 10px,transparent 10px,transparent 20px),linear-gradient(150deg,var(--a1),var(--a2) 60%,var(--a3));}.gc-back span{font-size: 70px;filter: drop-shadow(0 0 14px rgba(255,255,255,.8));animation: gcFloat 3s ease-in-out infinite;}.gc-back b{margin-top: 8px;font-size: 15px;letter-spacing: 4px;font-weight: 900;}.gc-back small{margin-top: 6px;font-size: 9.5px;letter-spacing: 1.6px;opacity: .88;font-weight: 800;}@keyframes gcFloat{50%{transform: translateY(-7px) scale(1.06);}}.gc-front{transform: rotateY(180deg);padding: 12px 10px;color: #2d2a4a;border: 4px solid var(--rc,#9aa3b5);background: linear-gradient(160deg,#fffdf5,#f0e7d4);box-shadow: 0 14px 34px rgba(0,0,0,.45),0 0 28px var(--rg,rgba(150,160,180,.4));}.gc-front[data-r="N"]{--rc: #9aa3b5;--rg: rgba(150,160,180,.4);}.gc-front[data-r="R"]{--rc: #4aa3ff;--rg: rgba(74,163,255,.55);}.gc-front[data-r="SR"]{--rc: #b36bff;--rg: rgba(179,107,255,.65);}.gc-front[data-r="SSR"]{--rc: #ffc933;--rg: rgba(255,201,51,.9);background: linear-gradient(160deg,#fff9e0,#ffe7a3);animation: ssrGlow 1.6s ease-in-out infinite;}@keyframes ssrGlow{50%{box-shadow: 0 14px 34px rgba(0,0,0,.45),0 0 46px rgba(255,201,51,1);}}.gc-front[data-r="SR"]::after,.gc-front[data-r="SSR"]::after{content: "";position: absolute;inset: 0;pointer-events: none;background: linear-gradient(115deg,transparent 30%,rgba(255,255,255,.75) 50%,transparent 70%);transform: translateX(-120%);animation: foil 2.4s ease-in-out infinite;}@keyframes foil{60%,100%{transform: translateX(120%);}}.gc-rar{position: absolute;top: 8px;left: 11px;font-size: 14px;font-weight: 900;letter-spacing: 1px;color: var(--rc);}.gc-st{position: absolute;top: 9px;right: 10px;font-size: 10.5px;letter-spacing: 1px;color: var(--rc);}.gc-em{margin-top: 18px;font-size: 62px;filter: drop-shadow(0 6px 8px rgba(0,0,0,.22));}.gc-cmd{margin-top: 10px;padding: 0 6px;font-size: 18px;font-weight: 900;word-break: break-all;}.gc-cat{margin-top: 4px;font-size: 10.5px;font-weight: 800;letter-spacing: 1.4px;color: rgba(45,42,74,.6);}.gc-new{position: absolute;bottom: 10px;padding: 3px 10px;border-radius: 999px;font-size: 10px;font-weight: 900;letter-spacing: 1px;color: #fff;background: linear-gradient(135deg,#ff4fb8,#ff9a3d);}.gc-act{display: flex;justify-content: center;gap: 9px;margin-top: 14px;}.gc-b{padding: 10px 16px;border-radius: 999px;border: 1px solid var(--line);background: var(--glass);color: var(--fg);font-size: 11.5px;font-weight: 900;letter-spacing: .6px;}.gc-b:active{transform: scale(.95);}.gc-info{margin-top: 12px;font-size: 11.5px;font-weight: 800;color: rgba(var(--fgrgb),.75);}.gc-cnt{display: flex;justify-content: center;gap: 6px;margin-top: 8px;}.gc-cnt span{padding: 3px 9px;border-radius: 999px;font-size: 10px;font-weight: 900;letter-spacing: .5px;color: #fff;}.bdg{margin-left: 4px;padding: 2px 5px;border-radius: 6px;font-size: 8.5px;font-weight: 900;letter-spacing: .6px;line-height: 1.2;}.bdg.new{color: #04261a;background: linear-gradient(135deg,#34d399,#7dd3fc);}.bdg.hot{color: #fff;background: linear-gradient(135deg,#ff9a3d,#ff3d5a);}.cc .ctag{position: absolute;right: 10px;top: 10px;z-index: 2;display: flex;gap: 4px;}.cc .ctag .bdg{margin: 0;}.hc{flex: 0 0 auto;display: flex;align-items: center;gap: 4px;padding: 10px 14px;border-radius: 999px;border: 1px solid var(--line);background: var(--glass);color: var(--fg);font-size: 13.5px;font-weight: 800;}.hc b{color: var(--gold);}.hc:active{transform: scale(.95);}.sug{margin: 2px 2px 8px;padding: 10px 13px;border-radius: 14px;font-size: 12.5px;font-weight: 800;border: 1px dashed rgba(var(--goldrgb),.6);background: rgba(var(--goldrgb),.1);}.sug button{border: 0;background: transparent;padding: 0;color: var(--gold);font-size: 13px;font-weight: 900;text-decoration: underline;}.chipw.fz{border-style: dashed;}.vt{flex: 0 0 auto;width: 30px;height: 30px;padding: 0;border: 0;border-radius: 50%;font-size: 14px;color: var(--fg);background: rgba(var(--fgrgb),.14);}.lb{padding: 16px 12px 12px;border-radius: 20px;background: var(--glass);border: 1px solid var(--line);}.pod{display: grid;grid-template-columns: 1fr 1.15fr 1fr;gap: 8px;align-items: end;}.pcol{text-align: center;min-width: 0;}.pav{position: relative;width: 46px;height: 46px;margin: 0 auto;border-radius: 50%;display: grid;place-items: center;font-size: 20px;font-weight: 900;color: #fff;background: linear-gradient(135deg,var(--c1),var(--c2));box-shadow: 0 6px 14px rgba(0,0,0,.3);}.pcol.p1 .pav{width: 58px;height: 58px;font-size: 25px;}.pcol.p1 .pav::before{content: "👑";position: absolute;top: -22px;left: 50%;margin-left: -12px;font-size: 22px;animation: crown 1.8s ease-in-out infinite;}@keyframes crown{50%{transform: translateY(-4px) rotate(8deg);}}.pcol.me .pav{box-shadow: 0 0 0 3px var(--a1),0 6px 14px rgba(0,0,0,.3);}.pnm{margin-top: 6px;font-size: 12px;font-weight: 900;white-space: nowrap;overflow: hidden;text-overflow: ellipsis;}.plv{font-size: 10.5px;font-weight: 800;color: var(--gold);}.pbar{height: 0;margin-top: 6px;padding-top: 6px;overflow: hidden;border-radius: 10px 10px 4px 4px;font-size: 20px;font-weight: 900;color: #fff;background: linear-gradient(180deg,var(--c1),var(--c2));transition: height .9s cubic-bezier(.2,.9,.2,1);}.lb.in .p1 .pbar{height: 96px;}.lb.in .p2 .pbar{height: 70px;}.lb.in .p3 .pbar{height: 52px;}.lbrow{display: flex;align-items: center;gap: 10px;margin-top: 8px;padding: 9px 11px;border-radius: 14px;border: 1px solid var(--line);background: rgba(var(--fgrgb),.05);}.lbrow .no{flex: 0 0 26px;font-weight: 900;color: var(--gold);}.lbrow .nm{flex: 1;min-width: 0;font-size: 13px;font-weight: 800;white-space: nowrap;overflow: hidden;text-overflow: ellipsis;}.lbrow .lv{font-size: 11px;font-weight: 900;color: rgba(var(--fgrgb),.75);}.lbrow.me{border-color: var(--a1);box-shadow: 0 0 0 2px rgba(var(--a1rgb),.25);}.lbme{margin-top: 10px;text-align: center;font-size: 11.5px;font-weight: 800;color: rgba(var(--fgrgb),.72);}.app.compact .cgrid{grid-template-columns: 1fr;gap: 7px;}.app.compact .cc{display: flex;align-items: center;gap: 11px;padding: 9px 12px;border-radius: 14px;}.app.compact .cc::before{display: none;}.app.compact .cc .em{flex: 0 0 36px;width: 36px;height: 36px;border-radius: 11px;font-size: 19px;}.app.compact .cc b{flex: 1;margin: 0;font-size: 13px;}.app.compact .cc small{margin: 0;font-size: 11px;white-space: nowrap;}.app.compact .cc .seen,.app.compact .cc .ctag{position: static;margin-left: 4px;}.app.compact .chips{gap: 6px;}.app.compact .chip{padding: 8px 10px;font-size: 12.5px;}.app.compact .fav{width: 32px;font-size: 14px;}.app.compact .fr{padding: 7px 10px;}.app.compact .fr .fem{flex: 0 0 32px;height: 32px;font-size: 16px;}.app.compact[data-mode="paper"] .cc{transform: none;}.app.compact[data-mode="paper"] .cc::after{display: none;}.app[data-mode="nature"] .rank,.app[data-mode="nature"] .lb,.app[data-mode="nature"] .sug{border-radius: 26px 8px 26px 8px;}.app[data-mode="space"] .rank,.app[data-mode="space"] .lb{border-radius: 4px 16px 4px 16px;box-shadow: inset 0 0 22px rgba(54,224,255,.07);}.app[data-mode="vintage"] .rank,.app[data-mode="vintage"] .lb{border-radius: 4px;box-shadow: inset 0 0 0 3px rgba(26,15,8,.85),inset 0 0 0 4px rgba(var(--goldrgb),.3);}.app[data-mode="paper"] .rank,.app[data-mode="paper"] .lb{background: rgba(255,253,244,.95);border-radius: 3px;border: 1px solid rgba(45,42,74,.15);box-shadow: 2px 3px 0 rgba(45,42,74,.1),0 10px 18px rgba(45,42,74,.07);}.app[data-mode="paper"] .rk-badge i,.app[data-mode="paper"] .pav{color: #fff;}.app[data-mode="paper"] .rk-badge i{color: var(--fg);}</style>
<div class="wrap">
<div class="app" id="app" data-theme="sakura" data-mode="neon">
<div class="aurora"><b></b><b></b><b></b></div>
<div class="bgfx"><i class="sun s1"></i><svg class="wave w1" viewBox="0 0 800 120" preserveAspectRatio="none"><path d="M0 40.0 L10 42.2 L20 44.3 L30 46.4 L40 48.2 L50 49.9 L60 51.3 L70 52.5 L80 53.3 L90 53.8 L100 54.0 L110 53.8 L120 53.3 L130 52.5 L140 51.3 L150 49.9 L160 48.2 L170 46.4 L180 44.3 L190 42.2 L200 40.0 L210 37.8 L220 35.7 L230 33.6 L240 31.8 L250 30.1 L260 28.7 L270 27.5 L280 26.7 L290 26.2 L300 26.0 L310 26.2 L320 26.7 L330 27.5 L340 28.7 L350 30.1 L360 31.8 L370 33.6 L380 35.7 L390 37.8 L400 40.0 L410 42.2 L420 44.3 L430 46.4 L440 48.2 L450 49.9 L460 51.3 L470 52.5 L480 53.3 L490 53.8 L500 54.0 L510 53.8 L520 53.3 L530 52.5 L540 51.3 L550 49.9 L560 48.2 L570 46.4 L580 44.3 L590 42.2 L600 40.0 L610 37.8 L620 35.7 L630 33.6 L640 31.8 L650 30.1 L660 28.7 L670 27.5 L680 26.7 L690 26.2 L700 26.0 L710 26.2 L720 26.7 L730 27.5 L740 28.7 L750 30.1 L760 31.8 L770 33.6 L780 35.7 L790 37.8 L800 40.0 V120 H0 Z"/></svg></div>
<div class="bgm bg-nature"><i class="sunglow"></i><svg class="hill h1" viewBox="0 0 1200 130" preserveAspectRatio="none"><path d="M0 69.7 L12 65.8 L24 62.7 L36 60.2 L48 58.4 L60 57.4 L72 57.1 L84 57.4 L96 58.1 L108 59.3 L120 60.7 L132 62.2 L144 63.6 L156 65.0 L168 66.1 L180 67.0 L192 67.5 L204 67.8 L216 67.9 L228 67.8 L240 67.6 L252 67.5 L264 67.5 L276 67.8 L288 68.5 L300 69.7 L312 71.4 L324 73.6 L336 76.4 L348 79.6 L360 83.3 L372 87.2 L384 91.3 L396 95.3 L408 99.1 L420 102.5 L432 105.4 L444 107.6 L456 108.9 L468 109.3 L480 108.8 L492 107.3 L504 105.0 L516 101.8 L528 97.9 L540 93.4 L552 88.7 L564 83.7 L576 78.7 L588 74.0 L600 69.7 L612 65.8 L624 62.7 L636 60.2 L648 58.4 L660 57.4 L672 57.1 L684 57.4 L696 58.1 L708 59.3 L720 60.7 L732 62.2 L744 63.6 L756 65.0 L768 66.1 L780 67.0 L792 67.5 L804 67.8 L816 67.9 L828 67.8 L840 67.6 L852 67.5 L864 67.5 L876 67.8 L888 68.5 L900 69.7 L912 71.4 L924 73.6 L936 76.4 L948 79.6 L960 83.3 L972 87.2 L984 91.3 L996 95.3 L1008 99.1 L1020 102.5 L1032 105.4 L1044 107.6 L1056 108.9 L1068 109.3 L1080 108.8 L1092 107.3 L1104 105.0 L1116 101.8 L1128 97.9 L1140 93.4 L1152 88.7 L1164 83.7 L1176 78.7 L1188 74.0 L1200 69.7 V130 H0 Z"/></svg><svg class="hill h2" viewBox="0 0 1200 96" preserveAspectRatio="none"><path d="M0 56.3 L12 52.6 L24 49.8 L36 48.2 L48 47.7 L60 48.2 L72 49.2 L84 50.7 L96 52.2 L108 53.5 L120 54.5 L132 55.0 L144 55.1 L156 55.0 L168 54.8 L180 54.9 L192 55.5 L204 56.8 L216 59.0 L228 62.0 L240 65.6 L252 69.7 L264 73.8 L276 77.6 L288 80.7 L300 82.7 L312 83.4 L324 82.6 L336 80.4 L348 76.9 L360 72.5 L372 67.6 L384 62.5 L396 57.8 L408 53.7 L420 50.6 L432 48.7 L444 47.8 L456 47.9 L468 48.8 L480 50.2 L492 51.7 L504 53.1 L516 54.2 L528 54.9 L540 55.1 L552 55.0 L564 54.8 L576 54.8 L588 55.3 L600 56.3 L612 58.2 L624 60.9 L636 64.3 L648 68.3 L660 72.4 L672 76.4 L684 79.7 L696 82.1 L708 83.3 L720 83.0 L732 81.3 L744 78.2 L756 74.1 L768 69.3 L780 64.2 L792 59.3 L804 55.0 L816 51.5 L828 49.2 L840 48.0 L852 47.8 L864 48.5 L876 49.7 L888 51.2 L900 52.7 L912 53.9 L924 54.7 L936 55.1 L948 55.1 L960 54.9 L972 54.8 L984 55.0 L996 55.9 L1008 57.5 L1020 59.9 L1032 63.1 L1044 66.9 L1056 71.0 L1068 75.1 L1080 78.7 L1092 81.5 L1104 83.1 L1116 83.3 L1128 82.0 L1140 79.4 L1152 75.6 L1164 70.9 L1176 65.9 L1188 60.9 L1200 56.3 V96 H0 Z"/></svg><div id="petals"></div><div id="flies"></div></div>
<div class="bgm bg-space"><i class="stars st1"></i><i class="stars st2"></i><i class="planet"></i><i class="comet"></i></div>
<div class="bgm bg-old"><i class="film fl"></i><i class="film fr"></i><i class="grain"></i><i class="vig"></i><i class="scratch"></i></div>
<div class="bgm bg-paper"><i class="paperbg"></i><i class="holes"></i><div id="doodles"></div><svg class="plane" viewBox="0 0 24 24"><path d="M2 12 L22 2 L15 22 L11 13 Z"/></svg></div>
<div class="bgrib"><div class="ribbon r1"><div class="rtrack" id="rtA"></div></div><div class="ribbon r3"><div class="rtrack" id="rtC"></div></div></div>
<div class="sparkles" id="sparkles"></div>
<div class="topbar">
<div class="logo">🌸</div>
<div class="tb-name"><b id="botName">Hoshino Ai</b><small><i class="dot"></i><span id="liveText">MEMUAT…</span></small></div>
<div class="themes" id="themes">
<button data-t="sakura" class="on" style="background:linear-gradient(135deg,#ff4fb8,#8b5cf6)" type="button"></button>
<button data-t="aqua" style="background:linear-gradient(135deg,#22d3ee,#3b82f6)" type="button"></button>
<button data-t="gold" style="background:linear-gradient(135deg,#fbbf24,#f97316)" type="button"></button>
<button data-t="mint" style="background:linear-gradient(135deg,#34d399,#06b6d4)" type="button"></button>
</div>
<button class="modebtn" id="modeBtn" type="button"><span id="modeIc">⚡</span><b id="modeNm">NEON</b></button>
</div>
<div class="errbox" id="errBox"></div>
<div class="views">
<!-- ═════ BERANDA ═════ -->
<section class="view on" id="v-home">
<div class="hero">
<div class="ring-wrap" id="ringWrap" data-d="1" data-g="1"><div class="ring"><div class="in" id="ringIn"><span>🌸</span>__AVATAR_HTML__<div class="scan"></div></div></div><span class="ptap">🔍 KETUK</span></div>
<div class="hello" id="hello">KON-AI~</div>
<div class="uname" id="uname">User</div>
<div class="pills"><span class="pill hot" id="pillRole">USER</span><span class="pill" id="pillLv">LV 1</span><span class="pill" id="pillVer">V1</span><span class="pill" id="pillMode">MD</span><span class="pill" id="pillTime">00:00</span></div>
</div>
<div class="banner">
<div class="fb">★</div>
__BANNER_HTML__
<div class="shade"></div>
<div class="cap"><b id="capName">Hoshino Ai</b><small>✦ IDOL STAGE ✦</small></div>
</div>
<div class="dialog"><div class="face">🌸</div><div><div class="who">AI BILANG~</div><div class="say"><span id="say"></span><i class="caret"></i></div></div></div>
<div class="rank" id="rankCard">
<div class="rk-badge" id="rkBadge"><i id="rkIc">🌱</i></div>
<div class="rk-main">
<div class="rk-top"><b id="rkName">TRAINEE</b><span id="rkLv">LV 1</span></div>
<div class="rk-bar"><i id="rkFill"></i></div>
<div class="rk-sub"><span id="rkXp">0 / 100 XP</span><span id="rkNext"></span></div>
<div class="rk-road" id="rkRoad"></div>
<div class="rk-gain" id="rkGain"></div>
<div class="rk-demo hidden" id="rkDemo">🧪 demo: ketuk badge buat lihat animasi naik level</div>
</div>
</div>
<div class="stats" id="stats"></div>
<div class="tip"><span class="tic">💡</span><span class="tt" id="tipTxt"></span></div>
<div class="h-title">🎯 PILIHAN HARI INI</div>
<button class="pick" id="pick" type="button"><span class="pem" id="pickEm">⭐</span><span class="pt"><b id="pickCmd">.cmd</b><small id="pickCat">kategori</small></span><span class="pgo">SALIN</span></button>
<div class="h-title">🎴 GACHA COMMAND</div>
<div class="gacha" id="gacha">
<div class="gc-stage" id="gcStage">
<div class="gc-card" id="gcCard">
<div class="gc-face gc-back"><span>✦</span><b>HOSHINO</b><small>KETUK UNTUK TARIK</small></div>
<div class="gc-face gc-front" id="gcFront" data-r="N"></div>
</div>
</div>
<div class="gc-act hidden" id="gcAct"><button class="gc-b" id="gcCopy" type="button">📋 SALIN</button><button class="gc-b" id="gcFav" type="button">☆ FAVORIT</button></div>
<button class="bigbtn" id="gcBtn" type="button" style="margin-top:14px">🎴 TARIK KARTU</button>
<div class="gc-info" id="gcInfo"></div>
<div class="gc-cnt" id="gcCnt"></div>
</div>
<div id="hnWrap">
<div class="h-title">🔥 LAGI RAME &amp; 🆕 BARU</div>
<div class="hscroll" id="hotnew"></div>
</div>
<div class="h-title">🔥 KATEGORI TERBESAR</div>
<div class="hscroll" id="topCats"></div>
<div class="h-title">🧭 PROGRES JELAJAH</div>
<div class="prog">
<div class="ptop"><b>MENU YANG SUDAH KAMU BUKA</b><span id="progTxt">0/0</span></div>
<div class="bar"><i id="progBar"></i></div>
<small id="progSub">Buka tiap kategori buat ngisi bar ini~</small>
</div>
<div class="h-title">⚡ AKSI CEPAT <span style="font-weight:700;letter-spacing:.4px;color:rgba(255,255,255,.55)">· ketuk = otomatis tersalin</span></div>
<div class="acts">
<button class="act wide" id="aAll" type="button"><span class="ic">🎀</span><span><b>SEMUA MENU</b><small id="aAllS">.allmenu</small></span></button>
<button class="act" id="aOwner" type="button"><span class="ic">👑</span><span><b>OWNER</b><small>kontak owner</small></span></button>
<button class="act" id="aChan" type="button"><span class="ic">💖</span><span><b>SALURAN</b><small>link resmi</small></span></button>
<button class="act" id="aRand" type="button"><span class="ic">🎲</span><span><b>ACAK</b><small>command random</small></span></button>
<button class="act" id="aPrefix" type="button"><span class="ic">✨</span><span><b>PREFIX</b><small id="aPrefixS">.</small></span></button>
</div>
<div class="foot">✦ <b id="footName">Hoshino Ai</b> ✦<br><span id="footDate"></span></div>
</section>
<!-- ═════ MENU ═════ -->
<section class="view" id="v-menu">
<div id="menuList">
<div class="search"><div class="box"><span>🔎</span><input id="search" type="text" placeholder="Cari command... (cth: sticker)" autocomplete="off"><button class="vt" id="vt" type="button" title="Tampilan">☰</button><button class="x hidden" id="sx" type="button">✕</button></div></div>
<div class="sortbar" id="sortbar">
<button class="sb on" data-s="default" type="button">🎀 URUTAN BOT</button>
<button class="sb" data-s="az" type="button">🔤 A–Z</button>
<button class="sb" data-s="most" type="button">📈 TERBANYAK</button>
<button class="sb" data-s="least" type="button">📉 TERSEDIKIT</button>
<button class="sb" data-s="new" type="button">🆕 NEW</button>
<button class="sb" data-s="hot" type="button">🔥 HOT</button>
</div>
<div class="scount" id="scount"></div>
<div class="sug hidden" id="sug"></div>
<div class="cgrid" id="cgrid"></div>
<div id="results" class="chips hidden"></div>
<div class="empty hidden" id="empty">Yah, command-nya gak ketemu~ coba kata lain ya 🥺</div>
</div>
<div id="menuDetail" class="hidden">
<div class="dhead"><button class="back" id="back" type="button">←</button><div class="em" id="dEm">⭐</div><div class="t"><b id="dName">Kategori</b><small id="dSub"></small></div></div>
<button class="bigbtn" id="dCopy" type="button">📂 SALIN PERINTAH KATEGORI</button>
<button class="bigbtn alt" id="dCopyAll" type="button">📋 SALIN SEMUA COMMAND (DAFTAR)</button>
<div class="minibar">
<div class="mi"><span>🔎</span><input id="dFilter" type="text" placeholder="Filter di kategori ini..." autocomplete="off"></div>
<button class="sb" id="dSort" type="button">🔤 A–Z</button>
</div>
<div class="letters" id="letters"></div>
<div class="h-title">✨ KETUK COMMAND = TERSALIN · ☆ = FAVORIT</div>
<div class="chips" id="dChips" style="margin-top:2px"></div>
<div class="empty hidden" id="dEmpty">Gak ada command yang cocok di kategori ini~ 🥺</div>
</div>
</section>
<!-- ═════ FAVORIT ═════ -->
<section class="view" id="v-fav">
<div class="h-title">⭐ COMMAND FAVORIT KAMU</div>
<div id="favActs">
<button class="bigbtn" id="fCopy" type="button">📋 SALIN SEMUA FAVORIT</button>
<button class="bigbtn alt" id="fClear" type="button">🗑 KOSONGKAN FAVORIT</button>
</div>
<div class="frows" id="frows" style="margin-top:14px"></div>
<div class="empty" id="favEmpty">Belum ada favorit~<br>Ketuk ☆ di samping command buat nyimpen di sini 🌸</div>
</section>
<!-- ═════ INFO ═════ -->
<section class="view" id="v-info">
<div class="h-title">🤖 INFO BOT</div>
<div class="panel" id="botInfo"></div>
<div class="h-title">🙋 INFO KAMU</div>
<div class="panel" id="userInfo"></div>
<div id="lbWrap">
<div class="h-title">🏆 TOP 5 IDOL</div>
<div class="lb" id="lb"><div class="pod" id="lbPod"></div><div id="lbRows"></div><div class="lbme" id="lbMe"></div></div>
</div>
<div class="h-title">📈 STATISTIK SESI INI</div>
<div class="panel" id="sessInfo"></div>
<div class="duo">
<button class="act" id="iNum" type="button"><span class="ic">📱</span><span><b>NOMOR BOT</b><small>salin nomor</small></span></button>
<button class="act" id="iChan" type="button"><span class="ic">💖</span><span><b>SALURAN</b><small>salin link</small></span></button>
</div>
<div class="h-title">❓ PANDUAN CEPAT</div>
<div id="faqBox"></div>
<div class="foot">MADE WITH 💖 BY <b id="footName2">Hoshino Ai</b></div>
</section>
<!-- ═════ RIWAYAT ═════ -->
<section class="view" id="v-hist">
<div class="h-title">🕘 TERAKHIR DISALIN</div>
<button class="bigbtn alt hidden" id="hClear" type="button" style="margin-top:0;margin-bottom:12px">🗑 HAPUS RIWAYAT</button>
<div class="hist" id="hist"></div>
<div class="empty" id="histEmpty">Belum ada yang disalin~ ketuk command mana aja ya 🌸</div>
</section>
</div>
<nav class="tabs">
<button class="tab on" data-v="home" type="button"><span>🏠</span>BERANDA</button>
<button class="tab" data-v="menu" type="button"><span>🎀</span>MENU</button>
<button class="tab" data-v="fav" type="button"><span>⭐</span>FAVORIT<em class="hidden" id="favBadge">0</em></button>
<button class="tab" data-v="info" type="button"><span>📊</span>INFO</button>
<button class="tab" data-v="hist" type="button"><span>🕘</span>RIWAYAT</button>
</nav>
<div class="pv" id="pv">
<div class="pv-bg"></div>
<div class="pv-bw"><div class="pv-beams"></div></div>
<div class="pv-flash"></div>
<button class="pv-x" id="pvX" type="button">✕</button>
<div class="pv-stage" id="pvStage">
<div class="pv-rp"></div><div class="pv-rp r2"></div>
<div class="pv-fs"><div class="ring-wrap pvwrap" id="pvFrame" data-d="1"><div class="ring"><div class="in" id="pvIn"><span>🌸</span></div></div></div></div>
<div class="pv-tiles" id="pvTiles" data-d="1"></div>
<div class="pv-burst" id="pvBurst"></div>
</div>
<div class="pv-card">
<div class="pv-name" id="pvName"></div>
<div class="pv-sub" id="pvSub"></div>
<div class="pv-tags" id="pvTags"></div>
<button class="pv-copy" id="pvCopy" type="button">📋 SALIN NAMA</button>
</div>
<div class="pv-hint">KETUK DI MANA SAJA UNTUK MENUTUP</div>
</div>
<div class="msheet" id="msheet">
<div class="ms-bg" id="msBg"></div>
<div class="ms-card">
<div class="ms-grab"></div>
<div class="ms-title">🎨 PILIH MODE</div>
<div class="ms-sub">5 gaya tampilan · semuanya tetap khas Hoshino Ai ✦</div>
<div id="msList"></div>
</div>
</div>
<div class="lvup" id="lvup">
<div class="lv-bg"></div>
<div class="lv-rw"><div class="lv-rays"></div></div>
<div class="lv-box">
<div class="lv-tag">LEVEL UP!</div>
<div class="lv-numwrap"><div class="lv-n o" id="lvOld">1</div><div class="lv-n n" id="lvNew">2</div></div>
<div class="lv-rank" id="lvRank"></div>
<div class="lv-hint">KETUK UNTUK MENUTUP</div>
</div>
<div id="lvConf"></div>
</div>
<button class="snav up" id="sUp" type="button">▲</button>
<button class="snav dn" id="sDn" type="button">▼</button>
<div class="toast" id="toast"></div>
</div>
</div>
<script>
(function () {
var D = __MENU_DATA__;
if (!D.categories) D.categories = [];
function $(id) { return document.getElementById(id); }
function el(tag, cls, text) {
var n = document.createElement(tag);
if (cls) n.className = cls;
if (text !== undefined && text !== null) n.appendChild(document.createTextNode(String(text)));
return n;
}
function showErr(msg) { var b = $('errBox'); if (b) { b.textContent = '⚠ ' + msg; b.className = 'errbox show'; } }
window.onerror = function (msg) { showErr(msg); return false; };
function safe(name, fn) { try { fn(); } catch (e) { showErr(name + ': ' + (e && e.message ? e.message : e)); } }
function low(s) { return String(s).toLowerCase(); }
function cmp(a, b) { a = low(a); b = low(b); return a < b ? -1 : (a > b ? 1 : 0); }
function store(k, v) { try { localStorage.setItem('hsv22_' + k, JSON.stringify(v)); } catch (e) {} }
function load(k, d) { try { var s = localStorage.getItem('hsv22_' + k); return s ? JSON.parse(s) : d; } catch (e) { return d; } }
var app = $('app');
var curTheme = 'sakura';
var PAL = [['#ff4fb8', '#8b5cf6'], ['#38bdf8', '#6366f1'], ['#fbbf24', '#f97316'], ['#34d399', '#06b6d4'],
['#fb7185', '#f43f5e'], ['#a78bfa', '#ec4899'], ['#22d3ee', '#3b82f6'], ['#facc15', '#ef4444']];
function pal(i) { return PAL[i % PAL.length]; }
function setC(node, i) { var p = pal(i); node.style.setProperty('--c1', p[0]); node.style.setProperty('--c2', p[1]); }
var ALL = [], CMAP = {};
(function () {
for (var i = 0; i < D.categories.length; i++) {
for (var j = 0; j < D.categories[i].cmds.length; j++) {
var c = String(D.categories[i].cmds[j]);
ALL.push({ cmd: c, ci: i });
if (CMAP[c] === undefined) CMAP[c] = i;
}
}
})();
var toastEl = $('toast'), toastT = null;
function toast(cmd, tail) {
toastEl.textContent = '';
toastEl.appendChild(document.createTextNode('✓ '));
toastEl.appendChild(el('em', '', cmd));
toastEl.appendChild(document.createTextNode(' ' + tail));
toastEl.classList.add('show');
clearTimeout(toastT);
toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
}
function toastRaw(t) {
toastEl.textContent = t;
toastEl.classList.add('show');
clearTimeout(toastT);
toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
}
function copyText(t, onOk, onFail) {
var started = false;
function fallback(t2) {
try {
var ta = document.createElement('textarea');
ta.value = t2; ta.style.position = 'fixed'; ta.style.opacity = '0';
document.body.appendChild(ta); ta.focus(); ta.select();
var ok = document.execCommand('copy');
ta.remove();
if (ok) { onOk(); } else { onFail(); }
} catch (e) { onFail(); }
}
try {
if (navigator.clipboard && navigator.clipboard.writeText) {
started = true;
navigator.clipboard.writeText(t).then(onOk).catch(function () { fallback(t); });
}
} catch (e) {}
if (!started) fallback(t);
}
function burst(ev, node) {
try {
var r = app.getBoundingClientRect();
var x, y;
if (ev && ev.clientX) { x = ev.clientX - r.left; y = ev.clientY - r.top; }
else { var b = node.getBoundingClientRect(); x = b.left - r.left + b.width / 2; y = b.top - r.top + b.height / 2; }
var icons = ['✦', '✧', '♡', '★', '✿'];
for (var i = 0; i < 9; i++) {
var s = el('span', 'burst', icons[i % icons.length]);
var ang = Math.random() * 6.283, d = 40 + Math.random() * 46;
s.style.left = x + 'px'; s.style.top = y + 'px';
s.style.setProperty('--dx', Math.round(Math.cos(ang) * d) + 'px');
s.style.setProperty('--dy', Math.round(Math.sin(ang) * d) + 'px');
s.style.color = ['#ff9ad5', '#ffd166', '#9be7ff', '#fff'][i % 4];
app.appendChild(s);
(function (n) { setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 800); })(s);
}
} catch (e) {}
}
var history = [], favs = load('fav', []), visited = {}, copiedCount = 0;
if (!Array.isArray(favs)) favs = [];
var curCat = null, sortMode = 'default', dSortAz = false, dLetter = '';
var statNodes = {};
function isFav(c) { return favs.indexOf(c) !== -1; }
function updateStats() {
try {
var vis = 0, k;
for (k in visited) { if (visited[k]) vis++; }
var tot = D.categories.length;
var pct = tot ? Math.round(vis * 100 / tot) : 0;
if (statNodes.fav) statNodes.fav.textContent = String(favs.length);
if (statNodes.copy) statNodes.copy.textContent = String(copiedCount);
if (statNodes.pct) statNodes.pct.textContent = pct + '%';
$('progTxt').textContent = vis + '/' + tot;
$('progBar').style.width = pct + '%';
$('progSub').textContent = vis >= tot && tot > 0 ? 'Mantap! Semua kategori udah kamu jelajahi 🎉' : (vis + ' dari ' + tot + ' kategori udah dibuka · lanjut jelajah ya~');
var fb = $('favBadge');
fb.textContent = String(favs.length > 99 ? '99+' : favs.length);
fb.classList.toggle('hidden', favs.length === 0);
var sess = $('sessInfo');
if (sess) {
sess.textContent = '';
fillPanel('sessInfo', [
['📋', 'TERSALIN', copiedCount + ' kali'], ['⭐', 'FAVORIT', favs.length + ' command'],
['🧭', 'KATEGORI DIBUKA', vis + ' / ' + tot], ['🕘', 'RIWAYAT', history.length + ' item']
]);
}
} catch (e) {}
}
function renderHist() {
var box = $('hist'); box.textContent = '';
$('histEmpty').classList.toggle('hidden', history.length > 0);
$('hClear').classList.toggle('hidden', history.length === 0);
for (var i = 0; i < history.length; i++) {
(function (h) {
var b = el('button', 'hi'); b.type = 'button';
b.appendChild(el('code', '', h.text));
b.appendChild(el('small', '', h.time + ' · salin lagi'));
b.addEventListener('click', function (ev) { doCopy(h.text, b, ev, true); });
box.appendChild(b);
})(history[i]);
}
}
function pushHist(text) {
var d = new Date();
var hh = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
for (var i = history.length - 1; i >= 0; i--) { if (history[i].text === text) history.splice(i, 1); }
history.unshift({ text: text, time: hh });
if (history.length > 25) history.pop();
renderHist();
}
function doCopy(text, node, ev, silentHist) {
copyText(text,
function () {
var shown = text.length > 42 ? text.slice(0, 40) + '…' : text;
toast(shown, 'tersalin · tempel di chat lalu kirim 🌸');
if (node && node.classList) {
node.classList.add('copied');
setTimeout(function () { node.classList.remove('copied'); }, 900);
}
burst(ev, node);
try { if (navigator.vibrate) navigator.vibrate(18); } catch (e) {}
copiedCount++;
gainXp(XP_PER_COPY);
if (!silentHist && text.indexOf(String.fromCharCode(10)) === -1) pushHist(text);
updateStats();
},
function () { toastRaw('Gagal menyalin · tahan teks lalu salin manual ya 🥺'); }
);
}
function toggleFav(c) {
var i = favs.indexOf(c);
if (i === -1) { favs.unshift(c); toastRaw('⭐ ' + D.prefix + c + ' masuk favorit~'); }
else { favs.splice(i, 1); toastRaw('Dihapus dari favorit · ' + D.prefix + c); }
store('fav', favs);
refreshLists();
}
function refreshLists() {
safe('refresh', function () {
if (curCat !== null) renderDetail();
renderSearch();
renderFav();
updateStats();
});
}
function renderFav() {
var box = $('frows'); box.textContent = '';
$('favEmpty').classList.toggle('hidden', favs.length > 0);
$('favActs').classList.toggle('hidden', favs.length === 0);
for (var i = 0; i < favs.length; i++) {
(function (c) {
var row = el('div', 'fr');
var ci = CMAP[c] !== undefined ? CMAP[c] : 0;
setC(row, ci);
var cat = D.categories[ci];
row.appendChild(el('div', 'fem', cat ? cat.emoji : '⭐'));
var go = el('button', 'fgo'); go.type = 'button';
go.appendChild(el('b', '', D.prefix + c));
go.appendChild(el('small', '', (cat ? String(cat.key).toUpperCase() : 'COMMAND') + ' · ketuk buat salin'));
go.addEventListener('click', function (e) { doCopy(D.prefix + c, row, e); });
var x = el('button', 'fx', '✕'); x.type = 'button';
x.addEventListener('click', function () { toggleFav(c); });
row.appendChild(go); row.appendChild(x);
box.appendChild(row);
})(favs[i]);
}
}
var tabs = document.querySelectorAll('.tab');
function go(v) {
var views = document.querySelectorAll('.view');
for (var i = 0; i < views.length; i++) views[i].classList.remove('on');
$('v-' + v).classList.add('on');
$('v-' + v).scrollTop = 0;
for (var j = 0; j < tabs.length; j++) {
if (tabs[j].getAttribute('data-v') === v) tabs[j].classList.add('on'); else tabs[j].classList.remove('on');
}
if (v === 'fav') renderFav();
if (v === 'info') { updateStats(); replayLb(); }
}
safe('tabs', function () {
for (var i = 0; i < tabs.length; i++) {
(function (t) { t.addEventListener('click', function () { go(t.getAttribute('data-v')); }); })(tabs[i]);
}
});
safe('tema', function () {
var bs = $('themes').querySelectorAll('button');
for (var i = 0; i < bs.length; i++) {
(function (b) {
b.addEventListener('click', function () {
curTheme = b.getAttribute('data-t');
app.setAttribute('data-theme', curTheme);
for (var k = 0; k < bs.length; k++) bs[k].classList.remove('on');
b.classList.add('on');
store('theme', b.getAttribute('data-t'));
});
})(bs[i]);
}
var saved = load('theme', null);
if (saved) {
for (var s = 0; s < bs.length; s++) { if (bs[s].getAttribute('data-t') === saved) bs[s].click(); }
}
});
safe('bgloop', function () {
function fillRibbon(id, words) {
var track = $(id), g, i;
for (g = 0; g < 2; g++) {
var grp = el('span', '');
for (i = 0; i < words.length; i++) {
grp.appendChild(document.createTextNode(words[i] + ' '));
grp.appendChild(el('b', '', '★ '));
}
track.appendChild(grp);
}
}
fillRibbon('rtA', ['HOSHINO AI', 'IDOL STAGE', 'KIRA KIRA', 'LIVE NOW', 'MENU SPESIAL']);
var on = String(D.ownerName || D.botName).toUpperCase();
fillRibbon('rtC', ['OWNER', on, 'DIBUAT OLEH', on, 'OWNER', on]);
});
safe('ppglitch', function () {
var wrap = $('ringWrap'), inn = $('ringIn');
var img = inn.querySelector ? inn.querySelector('img') : null;
var names = ['ga', 'gb'], i;
for (i = 0; i < names.length; i++) {
var layer = el('div', 'gl ' + names[i]);
if (img && img.cloneNode) { layer.appendChild(img.cloneNode(true)); }
else { layer.appendChild(el('span', '', '🌸')); }
inn.appendChild(layer);
}
var design = 1, kind = 0;
function glitch() {
kind = (kind % 3) + 1;
wrap.setAttribute('data-g', String(kind));
wrap.classList.add('glitch');
setTimeout(function () {
design = (design % 3) + 1;
wrap.setAttribute('data-d', String(design));
}, 300);
setTimeout(function () {
wrap.classList.remove('glitch');
next();
}, 660);
}
function next() { setTimeout(glitch, 2400 + Math.random() * 2800); }
setTimeout(glitch, 1800);
});
safe('ppview', function () {
var wrap = $('ringWrap'), pv = $('pv'), tilesBox = $('pvTiles'), pvIn = $('pvIn'), pvFrame = $('pvFrame');
var ringIn = $('ringIn');
var base = ringIn.querySelector ? ringIn.querySelector('img') : null;
var NAMES = ['AWAL', 'NEON HEX', 'GOLD OCTAGON'];
var timers = [], isOpen = false, N = 5;
if (base && base.cloneNode) { pvIn.appendChild(base.cloneNode(true)); }
function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
function clearTimers() { while (timers.length) { clearTimeout(timers.pop()); } }
function buildTiles(d) {
tilesBox.textContent = '';
tilesBox.setAttribute('data-d', d);
if (!base || !base.src) { return false; }
var r, c, t, a, dist;
for (r = 0; r < N; r++) {
for (c = 0; c < N; c++) {
t = el('i', 'pv-t');
t.style.left = (c * 100 / N) + '%';
t.style.top = (r * 100 / N) + '%';
t.style.width = (100 / N) + '%';
t.style.height = (100 / N) + '%';
t.style.backgroundImage = 'url("' + base.src + '")';
t.style.backgroundSize = (N * 100) + '% ' + (N * 100) + '%';
t.style.backgroundPosition = (c * 100 / (N - 1)) + '% ' + (r * 100 / (N - 1)) + '%';
a = Math.random() * 6.283;
dist = 110 + Math.random() * 90;
t.style.setProperty('--tx', Math.round(Math.cos(a) * dist) + 'px');
t.style.setProperty('--ty', Math.round(Math.sin(a) * dist) + 'px');
t.style.setProperty('--tr', Math.round((Math.random() - 0.5) * 540) + 'deg');
t.style.setProperty('--d', Math.round(Math.random() * 420) + 'ms');
tilesBox.appendChild(t);
}
}
return true;
}
function burstPv() {
var box = $('pvBurst'), icons = ['✦', '✧', '♡', '★', '✿'], cols = ['#ff9ad5', '#ffd166', '#9be7ff', '#ffffff'], i;
for (i = 0; i < 18; i++) {
var s = el('span', 'burst', icons[i % icons.length]);
var ang = (i / 18) * 6.283 + Math.random() * 0.3, dd = 110 + Math.random() * 90;
s.style.left = '0px'; s.style.top = '0px';
s.style.fontSize = (16 + Math.random() * 12) + 'px';
s.style.color = cols[i % cols.length];
s.style.setProperty('--dx', Math.round(Math.cos(ang) * dd) + 'px');
s.style.setProperty('--dy', Math.round(Math.sin(ang) * dd) + 'px');
box.appendChild(s);
(function (n) { setTimeout(function () { if (n.parentNode) { n.parentNode.removeChild(n); } }, 900); })(s);
}
}
function snap() {
pv.classList.add('snap');
burstPv();
try { if (navigator.vibrate) { navigator.vibrate([20, 40, 30]); } } catch (e) {}
later(function () { pv.classList.add('card'); }, 160);
later(function () { pv.classList.add('hint'); }, 900);
}
function openPv() {
if (isOpen) { return; }
isOpen = true;
clearTimers();
var d = wrap.getAttribute('data-d') || '1';
var di = parseInt(d, 10) || 1;
pvFrame.setAttribute('data-d', d);
var had = buildTiles(d);
$('pvName').textContent = D.userName;
$('pvSub').textContent = D.roleEmoji + ' ' + String(D.role).toUpperCase() + ' · TYPE 0' + di + ' ' + NAMES[di - 1];
var tg = $('pvTags');
tg.textContent = '';
tg.appendChild(el('span', 'pill hot', 'LIMIT ' + D.limit));
tg.appendChild(el('span', 'pill', '🕒 ' + D.time + ' WIB'));
tg.appendChild(el('span', 'pill', 'V' + D.version));
pv.className = 'pv on';
later(function () { pv.classList.add('show'); }, 30);
later(snap, had ? 1300 : 650);
}
function closePv() {
if (!isOpen) { return; }
isOpen = false;
clearTimers();
pv.classList.add('out');
later(function () { pv.className = 'pv'; tilesBox.textContent = ''; }, 320);
}
wrap.addEventListener('click', openPv);
$('pvX').addEventListener('click', function (e) { if (e && e.stopPropagation) { e.stopPropagation(); } closePv(); });
pv.addEventListener('click', function (e) {
var t = e && e.target;
if (t && t.id === 'pvCopy') { return; }
closePv();
});
$('pvCopy').addEventListener('click', function (e) {
if (e && e.stopPropagation) { e.stopPropagation(); }
doCopy(String(D.userName), $('pvCopy'), e, true);
});
});
safe('modedecor', function () {
var i, p, f, d;
var pb = $('petals');
for (i = 0; i < 8; i++) {
p = el('i', 'petal');
var dur = 12 + Math.random() * 10;
p.style.left = (Math.random() * 96) + '%';
p.style.setProperty('--sw', Math.round(40 + Math.random() * 90) + 'px');
p.style.animationDuration = dur + 's';
p.style.animationDelay = (-Math.random() * dur) + 's';
pb.appendChild(p);
}
var fb = $('flies');
for (i = 0; i < 6; i++) {
f = el('i', 'fly');
f.style.left = (8 + Math.random() * 84) + '%';
f.style.top = (30 + Math.random() * 60) + '%';
f.style.setProperty('--dx', Math.round((Math.random() - 0.5) * 90) + 'px');
f.style.setProperty('--dy', Math.round((Math.random() - 0.5) * 90) + 'px');
f.style.animationDuration = (6 + Math.random() * 6) + 's, ' + (1.8 + Math.random() * 2) + 's';
f.style.animationDelay = (-Math.random() * 6) + 's, ' + (-Math.random() * 2) + 's';
fb.appendChild(f);
}
var db = $('doodles'), glyphs = ['★', '♡', '✿', '✎', '☁', '✦', '♪'], cols = ['var(--a1)', 'var(--a2)', 'var(--a3)', 'var(--gold)'];
for (i = 0; i < 7; i++) {
d = el('i', 'doodle', glyphs[i % glyphs.length]);
var du = 5 + Math.random() * 5;
d.style.left = (8 + Math.random() * 84) + '%';
d.style.top = (6 + Math.random() * 80) + '%';
d.style.fontSize = (20 + Math.random() * 18) + 'px';
d.style.color = cols[i % cols.length];
d.style.animationDuration = du + 's';
d.style.animationDelay = (-Math.random() * du) + 's';
db.appendChild(d);
}
});
safe('modes', function () {
var MODES = [
{ id: 'neon', ic: '⚡', nm: 'Neon', sh: 'NEON', ds: 'Warna menyala khas panggung idol · mode awal', sw: 'linear-gradient(135deg,#ff4fb8,#8b5cf6,#38bdf8)' },
{ id: 'nature', ic: '🌿', nm: 'Alam', sh: 'ALAM', ds: 'Hutan senja, kelopak sakura jatuh & kunang-kunang', sw: 'linear-gradient(135deg,#0e3b2e,#34d399 60%,#ff9ccf)' },
{ id: 'space', ic: '🪐', nm: 'Space', sh: 'SPACE', ds: 'Lautan bintang, planet bercincin & komet', sw: 'linear-gradient(135deg,#050818,#4c1d95 60%,#36e0ff)' },
{ id: 'vintage', ic: '📽️', nm: 'Zaman Dulu', sh: 'DULU', ds: 'Pita film, bintik film tua & nuansa sepia', sw: 'linear-gradient(135deg,#2b1a0e,#b4642d 60%,#f4d58d)' },
{ id: 'paper', ic: '📝', nm: 'Kertas', sh: 'KERTAS', ds: 'Buku catatan, selotip & coretan doodle', sw: 'linear-gradient(135deg,#f3ecdc,#ffffff 50%,#e0457b)' }
];
var cur = 'neon', rows = {}, sheet = $('msheet'), tmr = null;
function byId(id) { for (var i = 0; i < MODES.length; i++) { if (MODES[i].id === id) { return MODES[i]; } } return MODES[0]; }
function apply(id) {
var m = byId(id);
app.setAttribute('data-mode', id);
app.setAttribute('data-theme', id === 'neon' ? curTheme : 'sakura');
$('modeIc').textContent = m.ic;
$('modeNm').textContent = m.sh;
for (var k in rows) { rows[k].classList.toggle('on', k === id); }
store('mode', id);
}
function switchTo(id, animate) {
if (id === cur) { return; }
var m = byId(id);
if (!animate) { cur = id; apply(id); return; }
var wipe = el('div', 'mt');
wipe.style.background = m.sw;
wipe.appendChild(el('i', '', '✦'));
app.appendChild(wipe);
setTimeout(function () { cur = id; apply(id); }, 430);
setTimeout(function () {
if (wipe.parentNode) { wipe.parentNode.removeChild(wipe); }
toastRaw(m.ic + ' Mode ' + m.nm + ' aktif~');
}, 1080);
}
function openSheet() {
clearTimeout(tmr);
sheet.className = 'msheet on';
tmr = setTimeout(function () { sheet.classList.add('show'); }, 30);
}
function closeSheet() {
clearTimeout(tmr);
sheet.classList.remove('show');
tmr = setTimeout(function () { sheet.className = 'msheet'; }, 380);
}
var list = $('msList'), i;
for (i = 0; i < MODES.length; i++) {
(function (m) {
var row = el('button', 'mrow'); row.type = 'button';
var sw = el('div', 'msw', m.ic); sw.style.background = m.sw;
var tx = el('div', 'mtx'); tx.appendChild(el('b', '', m.nm)); tx.appendChild(el('small', '', m.ds));
row.appendChild(sw); row.appendChild(tx); row.appendChild(el('span', 'mck', '✓'));
row.addEventListener('click', function () { closeSheet(); setTimeout(function () { switchTo(m.id, true); }, 200); });
rows[m.id] = row;
list.appendChild(row);
})(MODES[i]);
}
$('modeBtn').addEventListener('click', openSheet);
$('msBg').addEventListener('click', closeSheet);
var saved = load('mode', 'neon');
rows.neon.classList.add('on');
if (typeof saved === 'string' && rows[saved] && saved !== 'neon') { switchTo(saved, false); }
});
var NEWS = {}, HOTS = {};
(function () {
var i, n = D.newCmds || [], hh = D.hotCmds || [];
for (i = 0; i < n.length; i++) NEWS[String(n[i])] = true;
for (i = 0; i < hh.length; i++) HOTS[String(hh[i])] = true;
})();
function isNew(c) { return !!NEWS[c]; }
function isHot(c) { return !!HOTS[c]; }
var XP_PER_COPY = (D.xpPerCopy === undefined) ? 3 : (Number(D.xpPerCopy) || 0);
var RANKS = [
{ min: 1, ic: '🌱', nm: 'TRAINEE' }, { min: 5, ic: '🎀', nm: 'ROOKIE' }, { min: 10, ic: '⭐', nm: 'IDOL' },
{ min: 20, ic: '💎', nm: 'ACE' }, { min: 35, ic: '👑', nm: 'CENTER' }
];
var lvl = { level: Math.max(1, Number(D.level) || 1), xp: Math.max(0, Number(D.xp) || 0), need: 0 };
function needAt(l) {
var ix = l - (Number(D.level) || 1), arr = D.xpNeeds;
if (arr && ix >= 0 && Number(arr[ix]) > 0) { return Number(arr[ix]); }
return 100 + (l - 1) * 40;
}
lvl.need = Number(D.xpNeed) || needAt(lvl.level);
function rankIdx(l) { var r = 0, i; for (i = 0; i < RANKS.length; i++) { if (l >= RANKS[i].min) r = i; } return r; }
function renderRank(popBadge) {
safe('rank', function () {
var ri = rankIdx(lvl.level), r = RANKS[ri], nx = RANKS[ri + 1];
$('rkIc').textContent = r.ic;
$('rkName').textContent = r.nm;
$('rkLv').textContent = 'LV ' + lvl.level;
$('pillLv').textContent = r.ic + ' LV ' + lvl.level;
$('rkXp').textContent = lvl.xp + ' / ' + lvl.need + ' XP';
$('rkNext').textContent = nx ? ((nx.min - lvl.level) + ' level lagi → ' + nx.ic + ' ' + nx.nm) : 'PANGKAT TERTINGGI ✨';
var pct = Math.min(100, Math.round(lvl.xp * 100 / lvl.need));
setTimeout(function () { $('rkFill').style.width = pct + '%'; }, 60);
var road = $('rkRoad'), i;
road.textContent = '';
for (i = 0; i < RANKS.length; i++) {
road.appendChild(el('i', i < ri ? 'done' : (i === ri ? 'cur' : ''), RANKS[i].ic));
}
if (popBadge) { var bd = $('rkBadge'); bd.classList.remove('pop'); setTimeout(function () { bd.classList.add('pop'); }, 20); }
});
}
var lvTimer = null;
function closeLvUp() {
var lu = $('lvup');
lu.classList.remove('show');
clearTimeout(lvTimer);
lvTimer = setTimeout(function () { lu.className = 'lvup'; $('lvConf').textContent = ''; }, 350);
}
function showLevelUp(oldL, newL, oldR, newR) {
var lu = $('lvup'), i, cf, cols = ['#ff4fb8', '#ffd166', '#38bdf8', '#34d399', '#b36bff', '#ffffff'];
clearTimeout(lvTimer);
$('lvOld').textContent = String(oldL);
$('lvNew').textContent = String(newL);
$('lvRank').textContent = (oldR !== newR ? 'RANK UP! ' : 'RANK · ') + RANKS[newR].ic + ' ' + RANKS[newR].nm;
$('lvConf').textContent = '';
for (i = 0; i < 38; i++) {
cf = el('i', 'cf');
cf.style.left = (Math.random() * 100) + '%';
cf.style.background = cols[i % cols.length];
cf.style.setProperty('--cx', Math.round((Math.random() - 0.5) * 120) + 'px');
cf.style.animationDuration = (1.8 + Math.random() * 1.6) + 's';
cf.style.animationDelay = (Math.random() * 0.9) + 's';
$('lvConf').appendChild(cf);
}
lu.className = 'lvup on';
setTimeout(function () { lu.classList.add('show'); }, 30);
setTimeout(function () { lu.classList.add('roll'); }, 700);
setTimeout(function () { lu.classList.add('rk'); }, 1050);
try { if (navigator.vibrate) navigator.vibrate([30, 40, 30, 40, 60]); } catch (e) {}
lvTimer = setTimeout(closeLvUp, 4800);
}
function gainXp(n) {
if (!(n > 0)) { return; }
var oldL = lvl.level, oldR = rankIdx(oldL), leveled = false;
lvl.xp += n;
while (lvl.xp >= lvl.need) { lvl.xp -= lvl.need; lvl.level++; lvl.need = needAt(lvl.level); leveled = true; }
var g = $('rkGain');
g.textContent = '+' + n + ' XP';
g.classList.remove('show');
setTimeout(function () { g.classList.add('show'); }, 20);
renderRank(leveled && rankIdx(lvl.level) !== oldR);
if (leveled) { showLevelUp(oldL, lvl.level, oldR, rankIdx(lvl.level)); }
}
safe('rankinit', function () {
renderRank(false);
$('lvup').addEventListener('click', closeLvUp);
if (D.levelUp && Number(D.levelUp.to) > Number(D.levelUp.from)) {
setTimeout(function () { showLevelUp(Number(D.levelUp.from), Number(D.levelUp.to), rankIdx(Number(D.levelUp.from)), rankIdx(Number(D.levelUp.to))); }, 1400);
}
if (D.demoLevelUp) {
$('rkDemo').classList.remove('hidden');
$('rkBadge').addEventListener('click', function () { gainXp(Math.max(1, lvl.need - lvl.xp)); });
}
});
safe('gacha', function () {
if (!ALL.length) { $('gacha').classList.add('hidden'); return; }
var STARS = { N: '★', R: '★★', SR: '★★★', SSR: '★★★★' };
var RCOL = { N: '#9aa3b5', R: '#4aa3ff', SR: '#b36bff', SSR: '#ffb400' };
var owned = load('gacha', {});
if (!owned || typeof owned !== 'object') { owned = {}; }
var uniq = {}, total = 0, k, busy = false, current = null;
for (k = 0; k < ALL.length; k++) { if (!uniq[ALL[k].cmd]) { uniq[ALL[k].cmd] = true; total++; } }
function hashStr(s) { var x = 7, i; for (i = 0; i < s.length; i++) { x = (x * 131 + s.charCodeAt(i)) % 1000003; } return x; }
function rarityOf(cmd) { var v = hashStr(cmd) % 100; return v < 55 ? 'N' : (v < 85 ? 'R' : (v < 97 ? 'SR' : 'SSR')); }
function updateInfo() {
var have = 0, cnt = { N: 0, R: 0, SR: 0, SSR: 0 }, c;
for (c in owned) { if (uniq[c]) { have++; cnt[rarityOf(c)]++; } }
$('gcInfo').textContent = 'Koleksi kartu: ' + have + ' / ' + total + ' command';
var box = $('gcCnt'), r;
box.textContent = '';
for (r in cnt) {
var sp = el('span', '', r + ' ' + cnt[r]);
sp.style.background = RCOL[r];
box.appendChild(sp);
}
}
function favLabel() { $('gcFav').textContent = (current && isFav(current.cmd)) ? '★ FAVORIT' : '☆ FAVORIT'; }
function spawn(n, dist) {
var box = $('gcStage'), icons = ['✦', '✧', '★', '♡', '✿'], cols = ['#ffd166', '#ff9ad5', '#9be7ff', '#ffffff'], i, s, ang, dd;
for (i = 0; i < n; i++) {
s = el('span', 'burst', icons[i % icons.length]);
ang = (i / n) * 6.283 + Math.random() * 0.4;
dd = dist * (0.6 + Math.random() * 0.7);
s.style.left = '50%'; s.style.top = '50%';
s.style.fontSize = (16 + Math.random() * 14) + 'px';
s.style.color = cols[i % cols.length];
s.style.setProperty('--dx', Math.round(Math.cos(ang) * dd) + 'px');
s.style.setProperty('--dy', Math.round(Math.sin(ang) * dd) + 'px');
box.appendChild(s);
(function (nd) { setTimeout(function () { if (nd.parentNode) { nd.parentNode.removeChild(nd); } }, 900); })(s);
}
}
function reveal() {
var it = ALL[Math.floor(Math.random() * ALL.length)];
var r = rarityOf(it.cmd), cat = D.categories[it.ci], fresh = !owned[it.cmd];
owned[it.cmd] = (owned[it.cmd] || 0) + 1;
store('gacha', owned);
current = it;
var f = $('gcFront');
f.textContent = '';
f.setAttribute('data-r', r);
f.appendChild(el('div', 'gc-rar', r));
f.appendChild(el('div', 'gc-st', STARS[r]));
f.appendChild(el('div', 'gc-em', cat.emoji));
f.appendChild(el('div', 'gc-cmd', D.prefix + it.cmd));
f.appendChild(el('div', 'gc-cat', String(cat.key).toUpperCase()));
if (fresh) { f.appendChild(el('div', 'gc-new', 'BARU!')); }
$('gcCard').classList.add('flip');
favLabel();
setTimeout(function () {
if (r === 'SSR') { spawn(28, 150); try { if (navigator.vibrate) navigator.vibrate([30, 50, 30, 50, 90]); } catch (e) {} }
else if (r === 'SR') { spawn(14, 120); }
updateInfo();
$('gcAct').classList.remove('hidden');
busy = false;
}, 720);
}
function shakeThenReveal() {
var card = $('gcCard');
card.classList.add('shake');
setTimeout(function () { card.classList.remove('shake'); reveal(); }, 470);
}
function draw() {
if (busy) { return; }
busy = true;
var card = $('gcCard');
if (card.classList.contains('flip')) { card.classList.remove('flip'); setTimeout(shakeThenReveal, 460); }
else { shakeThenReveal(); }
}
$('gcBtn').addEventListener('click', draw);
$('gcCard').addEventListener('click', function (e) {
if (!$('gcCard').classList.contains('flip')) { draw(); }
else if (current) { doCopy(D.prefix + current.cmd, $('gcCard'), e); }
});
$('gcCopy').addEventListener('click', function (e) { if (current) { doCopy(D.prefix + current.cmd, $('gcCopy'), e); } });
$('gcFav').addEventListener('click', function () { if (current) { toggleFav(current.cmd); favLabel(); } });
updateInfo();
});
safe('hotnew', function () {
var box = $('hotnew'), seen = {}, list = [], i, src = (D.hotCmds || []).concat(D.newCmds || []);
for (i = 0; i < src.length; i++) {
var c = String(src[i]);
if (!seen[c] && CMAP[c] !== undefined) { seen[c] = true; list.push(c); }
}
if (!list.length) { $('hnWrap').classList.add('hidden'); return; }
for (i = 0; i < list.length; i++) {
(function (cmd) {
var b = el('button', 'hc'); b.type = 'button';
b.appendChild(el('b', '', D.prefix));
b.appendChild(document.createTextNode(cmd));
if (isHot(cmd)) { b.appendChild(el('span', 'bdg hot', '🔥')); }
if (isNew(cmd)) { b.appendChild(el('span', 'bdg new', 'NEW')); }
b.addEventListener('click', function (e) { doCopy(D.prefix + cmd, b, e); });
box.appendChild(b);
})(list[i]);
}
});
function replayLb() {
var lb = $('lb');
if (!lb) { return; }
lb.classList.remove('in');
setTimeout(function () { lb.classList.add('in'); }, 60);
}
safe('leaderboard', function () {
var data = D.leaderboard || [];
if (!data.length) { $('lbWrap').classList.add('hidden'); return; }
var order = [1, 0, 2], pcols = [['#ffd166', '#f59e0b'], ['#e2e8f0', '#94a3b8'], ['#f0a56a', '#b4642d']], pod = $('lbPod'), i, u, col, a;
for (i = 0; i < order.length; i++) {
u = data[order[i]];
if (!u) { continue; }
col = el('div', 'pcol p' + (order[i] + 1) + (u.me ? ' me' : ''));
col.style.setProperty('--c1', pcols[order[i]][0]);
col.style.setProperty('--c2', pcols[order[i]][1]);
a = el('div', 'pav', String(u.name).charAt(0).toUpperCase());
col.appendChild(a);
col.appendChild(el('div', 'pnm', u.name + (u.me ? ' (kamu)' : '')));
col.appendChild(el('div', 'plv', 'LV ' + u.level));
col.appendChild(el('div', 'pbar', String(order[i] + 1)));
pod.appendChild(col);
}
var rows = $('lbRows');
for (i = 3; i < data.length && i < 5; i++) {
u = data[i];
var r = el('div', 'lbrow' + (u.me ? ' me' : ''));
r.appendChild(el('div', 'no', '#' + (i + 1)));
r.appendChild(el('div', 'nm', u.name + (u.me ? ' · KAMU' : '')));
r.appendChild(el('div', 'lv', 'LV ' + u.level));
rows.appendChild(r);
}
if (D.myRank) { $('lbMe').textContent = 'Peringkat kamu: #' + D.myRank + ' · LV ' + lvl.level; }
});
safe('compact', function () {
var on = !!load('compact', false);
function apply() { app.classList.toggle('compact', on); $('vt').textContent = on ? '▦' : '☰'; }
apply();
$('vt').addEventListener('click', function (e) {
if (e && e.stopPropagation) { e.stopPropagation(); }
on = !on; store('compact', on); apply();
toastRaw(on ? '☰ Tampilan ringkas aktif' : '▦ Tampilan normal');
});
});
safe('sparkle', function () {
var box = $('sparkles'), icons = ['✦', '✧', '⋆', '★', '✵', '♡'];
for (var i = 0; i < 8; i++) {
var s = el('i', '', icons[i % icons.length]);
s.style.left = (Math.random() * 100) + '%'; s.style.top = (Math.random() * 100) + '%';
s.style.fontSize = (9 + Math.random() * 15) + 'px';
s.style.animationDelay = (Math.random() * 3.6) + 's'; s.style.animationDuration = (2.8 + Math.random() * 2.4) + 's';
box.appendChild(s);
}
});
safe('hero', function () {
$('botName').textContent = D.botName;
$('capName').textContent = D.botName;
$('uname').textContent = D.userName;
$('hello').textContent = String(D.greeting).toUpperCase() + '~ SELAMAT DATANG';
$('pillRole').textContent = D.roleEmoji + ' ' + String(D.role).toUpperCase();
$('pillVer').textContent = 'V' + D.version;
$('pillMode').textContent = String(D.mode).toUpperCase();
$('footName').textContent = D.botName;
$('footName2').textContent = D.botName;
$('footDate').textContent = D.date;
$('aAllS').textContent = D.prefix + 'allmenu';
$('aPrefixS').textContent = 'salin "' + D.prefix + '"';
var tp = String(D.time).split(':');
var base = (parseInt(tp[0], 10) || 0) * 60 + (parseInt(tp[1], 10) || 0), t0 = Date.now();
function clock() {
var mins = (base + Math.floor((Date.now() - t0) / 60000)) % 1440;
$('pillTime').textContent = '🕒 ' + ('0' + Math.floor(mins / 60)).slice(-2) + ':' + ('0' + (mins % 60)).slice(-2) + ' WIB';
}
clock(); setInterval(clock, 15000);
});
safe('dialog', function () {
var lines = (D.dialogs && D.dialogs.length) ? D.dialogs : [D.dialog];
var say = $('say'), li = 0, ci = 0;
function tick() {
var line = String(lines[li]);
if (ci <= line.length) { say.textContent = line.slice(0, ci); ci++; setTimeout(tick, 24); }
else { setTimeout(function () { li = (li + 1) % lines.length; ci = 0; tick(); }, 4200); }
}
tick();
});
safe('tips', function () {
var tips = [
'Ketuk command mana aja, langsung tersalin. Tinggal tempel di chat lalu kirim~',
'Ketuk ☆ di samping command buat simpan ke tab FAVORIT ⭐',
'Pakai kolom cari di tab MENU buat nemuin command dalam sekejap 🔎',
'Tahan tombol ▲ / ▼ buat scroll cepat ke atas atau bawah.',
'Ganti warna kartu lewat bulatan tema di pojok kanan atas 🎨',
'Di dalam kategori ada filter + huruf A–Z biar gampang nyari 🔤',
'Cek tab RIWAYAT buat salin ulang command yang barusan kamu pakai 🕘'
];
var box = $('tipTxt'), i = 0;
box.textContent = tips[0];
setInterval(function () {
box.style.opacity = '0';
setTimeout(function () { i = (i + 1) % tips.length; box.textContent = tips[i]; box.style.opacity = '1'; }, 260);
}, 5200);
});
safe('stats', function () {
var list = [
{ n: D.totalFeatures, l: 'FITUR', c1: '#ff4fb8', c2: '#8b5cf6' },
{ n: D.totalUsers, l: 'USER', c1: '#8b5cf6', c2: '#38bdf8' },
{ n: D.categories.length, l: 'KATEGORI', c1: '#38bdf8', c2: '#ffd166' },
{ live: 'fav', l: 'FAVORIT', c1: '#ffd166', c2: '#f97316' },
{ live: 'copy', l: 'TERSALIN', c1: '#34d399', c2: '#06b6d4' },
{ live: 'pct', l: 'JELAJAH', c1: '#fb7185', c2: '#a78bfa' }
];
for (var i = 0; i < list.length; i++) {
(function (s) {
var card = el('div', 'stat');
card.style.setProperty('--c1', s.c1); card.style.setProperty('--c2', s.c2);
var num = el('div', 'n', '0');
card.appendChild(num); card.appendChild(el('div', 'l', s.l));
$('stats').appendChild(card);
if (s.live) { statNodes[s.live] = num; return; }
var target = Number(s.n) || 0, t0 = null;
function step(ts) {
if (!t0) t0 = ts;
var p = Math.min(1, (ts - t0) / 900);
num.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
if (p < 1) requestAnimationFrame(step);
}
if (window.requestAnimationFrame) requestAnimationFrame(step); else num.textContent = String(target);
})(list[i]);
}
});
safe('pick', function () {
if (!ALL.length) { $('pickCmd').textContent = 'Belum ada command'; return; }
var h = 7, ds = String(D.date), i;
for (i = 0; i < ds.length; i++) h = (h * 31 + ds.charCodeAt(i)) % 1000003;
var item = ALL[h % ALL.length], cat = D.categories[item.ci];
$('pickEm').textContent = cat.emoji;
$('pickCmd').textContent = D.prefix + item.cmd;
$('pickCat').textContent = 'dari kategori ' + String(cat.key).toUpperCase() + ' · pilihan Ai hari ini~';
$('pick').addEventListener('click', function (e) { doCopy(D.prefix + item.cmd, $('pick'), e); });
});
safe('topcats', function () {
var idxs = [], i;
for (i = 0; i < D.categories.length; i++) idxs.push(i);
idxs.sort(function (a, b) { return D.categories[b].cmds.length - D.categories[a].cmds.length; });
idxs = idxs.slice(0, 8);
for (i = 0; i < idxs.length; i++) {
(function (idx) {
var c = D.categories[idx], b = el('button', 'tc'); b.type = 'button';
setC(b, idx);
b.appendChild(el('div', 'em', c.emoji));
b.appendChild(el('b', '', String(c.key).toUpperCase()));
b.appendChild(el('small', '', c.cmds.length + ' command'));
b.addEventListener('click', function () { go('menu'); openCat(idx); });
$('topCats').appendChild(b);
})(idxs[i]);
}
});
function allCmds() { var out = []; for (var i = 0; i < ALL.length; i++) out.push(ALL[i].cmd); return out; }
safe('aksi', function () {
$('aAll').addEventListener('click', function (e) { doCopy(D.prefix + 'allmenu', $('aAll'), e); });
$('aOwner').addEventListener('click', function (e) { doCopy(D.prefix + 'owner', $('aOwner'), e); });
$('aChan').addEventListener('click', function (e) { doCopy(D.channelLink, $('aChan'), e); });
$('aPrefix').addEventListener('click', function (e) { doCopy(D.prefix, $('aPrefix'), e); });
$('aRand').addEventListener('click', function (e) {
var list = allCmds();
if (!list.length) { toastRaw('Belum ada command~'); return; }
doCopy(D.prefix + list[Math.floor(Math.random() * list.length)], $('aRand'), e);
});
});
function fillPanel(id, rows) {
var box = $(id);
for (var i = 0; i < rows.length; i++) {
var r = rows[i], row = el('div', 'row'), k = el('div', 'k');
k.appendChild(el('b', '', '┃'));
k.appendChild(document.createTextNode(r[0] + ' ' + r[1]));
row.appendChild(k); row.appendChild(el('div', 'v', r[2]));
box.appendChild(row);
}
}
safe('info', function () {
fillPanel('botInfo', [
['🖐', 'NAMA', D.botName], ['🔑', 'VERSI', 'v' + D.version], ['⚙️', 'MODE', String(D.mode).toUpperCase()],
['🧶', 'PREFIX', '[ ' + D.prefix + ' ]'], ['⏱', 'UPTIME', D.uptime], ['🏷', 'GRUP', String(D.groupMode).toUpperCase()],
['👑', 'OWNER', D.ownerName], ['🧩', 'TOTAL FITUR', String(D.totalFeatures)], ['👥', 'TOTAL USER', String(D.totalUsers)]
]);
fillPanel('userInfo', [
['🙋', 'NAMA', D.userName], ['🎭', 'ROLE', D.roleEmoji + ' ' + D.role], ['🎟', 'LIMIT', String(D.limit)],
['🕒', 'WAKTU', D.time + ' WIB'], ['📅', 'TANGGAL', D.date]
]);
$('iNum').addEventListener('click', function (e) {
if (!D.botNumber) { toastRaw('Nomor bot belum tersedia~'); return; }
doCopy(D.botNumber, $('iNum'), e, true);
});
$('iChan').addEventListener('click', function (e) { doCopy(D.channelLink, $('iChan'), e, true); });
});
safe('faq', function () {
var qa = [
['Gimana cara pakai command?', 'Ketuk command di tab MENU, otomatis tersalin. Tempel di kolom chat lalu kirim ya~'],
['Kok command-nya gak jalan?', 'Pastikan prefix-nya bener (' + D.prefix + ') dan kamu punya akses atau limit. Limit kamu bisa dicek di tab INFO.'],
['Apa itu FAVORIT?', 'Ketuk ☆ di samping command buat nyimpen. Semua favorit ngumpul di tab FAVORIT, tinggal ketuk buat salin.'],
['Tombol ▲ dan ▼ buat apa?', 'Buat geser halaman karena geseran jari kadang ditangkap WhatsApp. Tahan tombolnya buat scroll cepat.'],
['Cara ganti warna kartu?', 'Ketuk salah satu bulatan warna di pojok kanan atas buat ganti tema.'],
['Kenapa progres jelajah bertambah?', 'Tiap kamu buka satu kategori, bar progres di BERANDA naik. Buka semuanya buat 100%!']
];
for (var i = 0; i < qa.length; i++) {
(function (q) {
var box = el('div', 'faq'), b = el('button', 'fq'); b.type = 'button';
b.appendChild(el('b', '', q[0])); b.appendChild(el('span', '', '+'));
box.appendChild(b); box.appendChild(el('div', 'fa', q[1]));
b.addEventListener('click', function () { box.classList.toggle('open'); });
$('faqBox').appendChild(box);
})(qa[i]);
}
});
var cgrid = $('cgrid');
function makeChip(cmd, catEmoji, fuzzy) {
var w = el('div', 'chipw' + (fuzzy ? ' fz' : ''));
var chip = el('button', 'chip'); chip.type = 'button';
chip.appendChild(el('b', '', D.prefix));
chip.appendChild(document.createTextNode(cmd));
if (isHot(cmd)) chip.appendChild(el('span', 'bdg hot', '🔥'));
if (isNew(cmd)) chip.appendChild(el('span', 'bdg new', 'NEW'));
if (catEmoji) chip.appendChild(el('i', '', catEmoji));
chip.addEventListener('click', function (e) { doCopy(D.prefix + cmd, chip, e); });
var on = isFav(cmd);
var star = el('button', 'fav' + (on ? ' on' : ''), on ? '★' : '☆'); star.type = 'button';
star.addEventListener('click', function (e) { e.stopPropagation(); toggleFav(cmd); });
w.appendChild(chip); w.appendChild(star);
return w;
}
function renderGrid() {
cgrid.textContent = '';
var idxs = [], i;
for (i = 0; i < D.categories.length; i++) idxs.push(i);
if (sortMode === 'az') idxs.sort(function (a, b) { return cmp(D.categories[a].key, D.categories[b].key); });
if (sortMode === 'most') idxs.sort(function (a, b) { return D.categories[b].cmds.length - D.categories[a].cmds.length; });
if (sortMode === 'least') idxs.sort(function (a, b) { return D.categories[a].cmds.length - D.categories[b].cmds.length; });
for (i = 0; i < idxs.length; i++) {
(function (idx) {
var c = D.categories[idx];
var card = el('button', 'cc'); card.type = 'button';
setC(card, idx);
card.appendChild(el('div', 'em', c.emoji));
card.appendChild(el('b', '', String(c.key).toUpperCase()));
card.appendChild(el('small', '', c.cmds.length + ' command'));
var nn = 0, hh = 0, q2;
for (q2 = 0; q2 < c.cmds.length; q2++) { if (isNew(c.cmds[q2])) nn++; if (isHot(c.cmds[q2])) hh++; }
if (nn || hh) {
var tg = el('span', 'ctag');
if (hh) tg.appendChild(el('span', 'bdg hot', '🔥 ' + hh));
if (nn) tg.appendChild(el('span', 'bdg new', 'NEW ' + nn));
card.appendChild(tg);
}
if (visited[idx]) card.appendChild(el('span', 'seen', '✅'));
card.addEventListener('click', function () { openCat(idx); });
cgrid.appendChild(card);
})(idxs[i]);
}
}
function renderLetters(c) {
var box = $('letters'); box.textContent = '';
var seen = {}, arr = [], i, ch;
for (i = 0; i < c.cmds.length; i++) {
ch = String(c.cmds[i]).charAt(0).toUpperCase();
if (ch && !seen[ch]) { seen[ch] = true; arr.push(ch); }
}
arr.sort();
if (arr.length < 2) return;
for (i = 0; i < arr.length; i++) {
(function (L) {
var b = el('button', 'lt' + (dLetter === L ? ' on' : ''), L); b.type = 'button';
b.addEventListener('click', function () { dLetter = (dLetter === L) ? '' : L; renderLetters(c); renderDetail(); });
box.appendChild(b);
})(arr[i]);
}
}
function renderDetail() {
if (curCat === null) return;
var c = D.categories[curCat];
var list = c.cmds.slice(), q = low($('dFilter').value || '').trim(), out = [], i;
if (dSortAz) list.sort(cmp);
for (i = 0; i < list.length; i++) {
var s = String(list[i]);
if (q && low(s).indexOf(q) === -1) continue;
if (dLetter && s.charAt(0).toUpperCase() !== dLetter) continue;
out.push(s);
}
var box = $('dChips'); box.textContent = '';
for (i = 0; i < out.length; i++) box.appendChild(makeChip(out[i]));
$('dEmpty').classList.toggle('hidden', out.length > 0);
$('dSub').textContent = (out.length === c.cmds.length ? c.cmds.length + ' command' : out.length + ' dari ' + c.cmds.length + ' command');
}
function openCat(idx) {
var c = D.categories[idx];
curCat = idx; dLetter = ''; dSortAz = false;
visited[idx] = true;
$('dSort').classList.remove('on');
$('dFilter').value = '';
setC($('menuDetail'), idx);
$('dEm').textContent = c.emoji;
$('dName').textContent = String(c.key).toUpperCase();
$('dCopy').textContent = '📂 SALIN ' + D.prefix + 'menuhsn ' + c.key;
renderLetters(c);
renderDetail();
$('menuList').classList.add('hidden');
$('menuDetail').classList.remove('hidden');
$('v-menu').scrollTop = 0;
renderGrid();
updateStats();
}
function closeCat() {
$('menuDetail').classList.add('hidden');
$('menuList').classList.remove('hidden');
curCat = null;
}
safe('kategori', function () {
renderGrid();
$('back').addEventListener('click', closeCat);
$('dCopy').addEventListener('click', function (e) {
if (curCat === null) return;
doCopy(D.prefix + 'menuhsn ' + D.categories[curCat].key, $('dCopy'), e);
});
$('dCopyAll').addEventListener('click', function (e) {
if (curCat === null) return;
var nl = String.fromCharCode(10), out = [], c = D.categories[curCat];
for (var i = 0; i < c.cmds.length; i++) out.push(D.prefix + c.cmds[i]);
doCopy(String(c.emoji) + ' ' + String(c.key).toUpperCase() + nl + out.join(nl), $('dCopyAll'), e, true);
});
$('dFilter').addEventListener('input', renderDetail);
$('dFilter').addEventListener('keyup', renderDetail);
$('dSort').addEventListener('click', function () {
dSortAz = !dSortAz;
$('dSort').classList.toggle('on', dSortAz);
renderDetail();
});
var sbs = $('sortbar').querySelectorAll('.sb');
for (var i = 0; i < sbs.length; i++) {
(function (b) {
b.addEventListener('click', function () {
sortMode = b.getAttribute('data-s');
for (var k = 0; k < sbs.length; k++) sbs[k].classList.remove('on');
b.classList.add('on');
renderGrid();
renderSearch();
});
})(sbs[i]);
}
});
var ALIAS = { stiker: 'sticker', stikker: 'sticker', stiket: 'sticker', unduh: 'download', donlod: 'download', musik: 'ytmp3', lagu: 'ytmp3', video: 'ytmp4',
gambar: 'img', foto: 'img', bantuan: 'menu', bantu: 'menu', kecerdasan: 'ai', pemilik: 'owner', permainan: 'game', hiburan: 'fun', grup: 'group', kelompok: 'group' };
function lev(a, b) {
var m = a.length, n = b.length, pp = null, prev = [], cur, i, j, cost;
for (j = 0; j <= n; j++) prev.push(j);
for (i = 1; i <= m; i++) {
cur = [i];
for (j = 1; j <= n; j++) {
cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost));
if (pp && i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1)) {
cur[j] = Math.min(cur[j], pp[j - 2] + 1);
}
}
pp = prev; prev = cur;
}
return prev[n];
}
function scoreCmd(q, cmd) {
var c = low(cmd), d, t, i, j;
if (c === q) return 100;
if (c.indexOf(q) === 0) return 90 - Math.min(10, c.length - q.length);
if (c.indexOf(q) !== -1) return 78;
if (q.length >= 3) {
t = q.length <= 4 ? 1 : 2;
d = lev(q, c);
if (d <= t) return 66 - d * 6;
d = Math.min(lev(q, c.slice(0, q.length)), lev(q, c.slice(0, q.length + 1)));
if (d <= t) return 58 - d * 5;
if (q.length >= 4) {
i = 0;
for (j = 0; j < c.length && i < q.length; j++) { if (c.charAt(j) === q.charAt(i)) i++; }
if (i === q.length) return 40;
}
}
return 0;
}
function searchAll(q) {
var qs = [q], out = [], seen = {}, i, k, sc, best, ck, key, via;
if (ALIAS[q]) qs.push(ALIAS[q]);
for (i = 0; i < ALL.length; i++) {
best = 0; via = '';
for (k = 0; k < qs.length; k++) { sc = scoreCmd(qs[k], ALL[i].cmd); if (sc > best) best = sc; }
if (best < 55 && q.length >= 3) {
ck = low(D.categories[ALL[i].ci].key);
if (ck.indexOf(q) !== -1 || (ALIAS[q] && ck.indexOf(ALIAS[q]) !== -1) || lev(q, ck) <= (q.length <= 4 ? 1 : 2)) { best = 55; via = 'cat'; }
}
key = ALL[i].cmd + '|' + ALL[i].ci;
if (best > 0 && !seen[key]) { seen[key] = 1; out.push({ cmd: ALL[i].cmd, ci: ALL[i].ci, score: best, via: via }); }
}
out.sort(function (a, b) { return (b.score - a.score) || cmp(a.cmd, b.cmd); });
return out.slice(0, 80);
}
function flatList(kind) {
var src = kind === 'new' ? (D.newCmds || []) : (D.hotCmds || []), out = [], i, ci;
for (i = 0; i < src.length; i++) {
ci = CMAP[String(src[i])];
if (ci !== undefined) out.push({ cmd: String(src[i]), ci: ci });
}
return out;
}
function renderSearch() {
var inp = $('search');
var q = low(inp.value || '').trim();
$('sx').classList.toggle('hidden', !q);
var res = $('results'); res.textContent = '';
var sug = $('sug'); sug.textContent = ''; sug.classList.add('hidden');
var i, f;
if (!q) {
if (sortMode === 'new' || sortMode === 'hot') {
var fl = flatList(sortMode);
for (i = 0; i < fl.length; i++) res.appendChild(makeChip(fl[i].cmd, D.categories[fl[i].ci].emoji));
cgrid.classList.add('hidden'); $('sortbar').classList.remove('hidden');
res.classList.toggle('hidden', fl.length === 0);
$('empty').classList.toggle('hidden', fl.length !== 0);
$('scount').textContent = (sortMode === 'new' ? '🆕 ' + fl.length + ' command baru' : '🔥 ' + fl.length + ' command lagi rame') + ' · ketuk buat salin';
return;
}
cgrid.classList.remove('hidden'); $('sortbar').classList.remove('hidden'); res.classList.add('hidden');
$('empty').classList.add('hidden'); $('scount').textContent = '';
return;
}
var found = searchAll(q), exact = 0;
for (i = 0; i < found.length; i++) {
f = found[i];
var fz = f.score < 75;
if (!fz) exact++;
res.appendChild(makeChip(f.cmd, D.categories[f.ci].emoji, fz));
}
cgrid.classList.add('hidden'); $('sortbar').classList.add('hidden');
res.classList.toggle('hidden', found.length === 0);
$('empty').classList.toggle('hidden', found.length !== 0);
$('scount').textContent = found.length ? ('✨ ' + found.length + ' command ketemu' + (exact < found.length ? ' · ' + (found.length - exact) + ' mirip' : '') + ' · ketuk buat salin') : '';
if (found.length && exact === 0) {
var viaCat = found[0].via === 'cat';
var pick = viaCat ? String(D.categories[found[0].ci].key) : found[0].cmd;
sug.appendChild(document.createTextNode(viaCat ? 'Maksudmu kategori ' : 'Maksudmu '));
var sb2 = el('button', '', viaCat ? pick.toUpperCase() : D.prefix + pick); sb2.type = 'button';
sb2.addEventListener('click', function () { inp.value = pick; renderSearch(); });
sug.appendChild(sb2);
sug.appendChild(document.createTextNode(' ?'));
sug.classList.remove('hidden');
}
}
safe('search', function () {
var inp = $('search');
inp.addEventListener('input', renderSearch);
inp.addEventListener('keyup', renderSearch);
$('sx').addEventListener('click', function () { inp.value = ''; renderSearch(); inp.focus(); });
});
safe('massal', function () {
$('fCopy').addEventListener('click', function (e) {
if (!favs.length) return;
var nl = String.fromCharCode(10), out = [];
for (var i = 0; i < favs.length; i++) out.push(D.prefix + favs[i]);
doCopy(out.join(nl), $('fCopy'), e, true);
});
$('fClear').addEventListener('click', function () {
favs = []; store('fav', favs); refreshLists(); toastRaw('Favorit dikosongkan~');
});
$('hClear').addEventListener('click', function () {
history = []; renderHist(); updateStats(); toastRaw('Riwayat dihapus~');
});
});
safe('scrollnav', function () {
function active() { return document.querySelector('.view.on'); }
function by(dir) {
var v = active(); if (!v) return;
var d = Math.round(v.clientHeight * 0.7) * dir;
try { v.scrollBy({ top: d, behavior: 'smooth' }); } catch (e) { v.scrollTop += d; }
}
function bind(id, dir) {
var b = $(id), t = null, held = false;
b.addEventListener('click', function () { if (!held) by(dir); held = false; });
b.addEventListener('pointerdown', function () {
held = false;
t = setTimeout(function () {
held = true;
t = setInterval(function () { var v = active(); if (v) v.scrollTop += 40 * dir; }, 30);
}, 380);
});
function stop() { clearTimeout(t); clearInterval(t); t = null; }
b.addEventListener('pointerup', stop);
b.addEventListener('pointerleave', stop);
b.addEventListener('pointercancel', stop);
}
bind('sUp', -1);
bind('sDn', 1);
});
safe('ready', function () { renderHist(); renderFav(); updateStats(); $('liveText').textContent = 'ONLINE'; });
})();
</script>
`;

    /* ---------- helper data: pangkat/XP, naik level, top 5, NEW & HOT ---------- */
const MENU_V22_DB_DIR = path.join(process.cwd(), 'database', 'main');

function readJsonSafeV22(file, fallback) {
    try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {}
    return fallback;
}

function writeJsonSafeV22(file, data) {
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFile(file, JSON.stringify(data), () => {});
    } catch (e) {}
}

function levelFromExpV22(exp) {
    try {
        const lh = require('../../src/lib/levelHelper');
        return Math.max(0, Number(lh.calculateLevel(exp)) || 0);
    } catch (e) {
        return 0;
    }
}

function maskJidV22(jid) {
    const d = String(jid || '').split('@')[0].replace(/\D/g, '');
    if (d.length < 6) return 'User';
    return d.slice(0, 4) + '••••' + d.slice(-2);
}

function userDisplayNameV22(u, jid) {
    const n = u?.name || u?.pushName || u?.nama || u?.username;
    return (n && String(n).trim()) ? String(n).trim().slice(0, 18) : maskJidV22(jid);
}

/** level, xp di level ini, xp yang dibutuhkan, + kurva XP 15 level ke depan */
function buildLevelDataV22(db, m) {
    const out = { level: 1, xp: 0, xpNeed: 100 };
    try {
        const user = db.getUser(m.sender) || {};
        const exp = Number(user.exp) || 0;
        const lh = require('../../src/lib/levelHelper');
        const raw = Math.max(0, Number(lh.calculateLevel(exp)) || 0);
        const base = Number(lh.expForLevel(raw)) || 0;
        const next = Number(lh.expForLevel(raw + 1)) || (base + 100);
        out.level = Math.max(1, raw);
        out.xp = Math.max(0, Math.round(exp - base));
        out.xpNeed = Math.max(1, Math.round(next - base));
        out.xpNeeds = [];
        for (let i = 0; i < 15; i++) {
            const a = Number(lh.expForLevel(raw + i)) || 0;
            const b = Number(lh.expForLevel(raw + i + 1)) || 0;
            out.xpNeeds.push(Math.max(1, Math.round(b - a)));
        }
    } catch (e) {
        try {
            const u = db.getUser(m.sender) || {};
            out.level = Math.max(1, Number(u?.rpg?.level || u?.level) || 1);
        } catch (e2) {}
    }
    return out;
}

/** top 5 berdasarkan EXP + peringkat user ini */
function buildLeaderboardV22(db, m) {
    const res = { leaderboard: [], myRank: 0 };
    try {
        const raw = db.getAllUsers() || {};
        const pairs = Array.isArray(raw)
            ? raw.map(u => [u?.jid || u?.id || '', u])
            : Object.entries(raw);
        const list = pairs
            .map(([jid, u]) => ({ jid: String(jid), u: u || {}, exp: Number(u?.exp) || 0 }))
            .filter(x => x.exp > 0)
            .sort((a, b) => b.exp - a.exp);
        res.leaderboard = list.slice(0, 5).map(x => ({
            name: x.jid === m.sender ? (m.pushName || userDisplayNameV22(x.u, x.jid)) : userDisplayNameV22(x.u, x.jid),
            level: Math.max(1, levelFromExpV22(x.exp)),
            me: x.jid === m.sender
        }));
        const idx = list.findIndex(x => x.jid === m.sender);
        res.myRank = idx >= 0 ? idx + 1 : 0;
    } catch (e) {}
    return res;
}

/** command baru = pertama kali terlihat < N hari (otomatis, disimpan di database/main) */
function detectNewCommandsV22(allNames, botConfig) {
    const out = new Set();
    try {
        const file = path.join(MENU_V22_DB_DIR, 'menu_cmd_seen.json');
        const days = Number(botConfig.ui?.menuNewDays) || 7;
        const now = Date.now();
        const seen = readJsonSafeV22(file, null);
        if (!seen || typeof seen !== 'object') {
            const init = {};
            for (const n of allNames) init[n] = 0;      // run pertama: semua dianggap lama
            writeJsonSafeV22(file, init);
        } else {
            let changed = false;
            for (const n of allNames) {
                if (seen[n] === undefined) { seen[n] = now; changed = true; }
                if (seen[n] && (now - seen[n]) < days * 86400000) out.add(n);
            }
            if (changed) writeJsonSafeV22(file, seen);
        }
    } catch (e) {}
    try {
        for (const n of (botConfig.ui?.newCommands || [])) if (n) out.add(String(n));
    } catch (e) {}
    return [...out];
}

/** command paling sering dipakai (dari database/main/stats.json) */
function topCommandsV22(limit) {
    try {
        const stats = readJsonSafeV22(path.join(MENU_V22_DB_DIR, 'stats.json'), {});
        return Object.entries(stats)
            .filter(([k]) => k.startsWith('command_'))
            .map(([k, c]) => ({ name: k.replace('command_', ''), count: Number(c) || 0 }))
            .filter(x => x.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, limit)
            .map(x => x.name);
    } catch (e) {
        return [];
    }
}

function buildMenuV22Extras({ m, db, botConfig, allNames }) {
    const extras = {
        xpPerCopy: Number(botConfig.ui?.menuXpPerCopy) || 0,
        ...buildLevelDataV22(db, m),
        ...buildLeaderboardV22(db, m),
        newCmds: detectNewCommandsV22(allNames, botConfig),
        hotCmds: topCommandsV22(8)
    };
    // animasi naik level: bandingkan dengan level terakhir yang pernah ditampilkan
    try {
        const file = path.join(MENU_V22_DB_DIR, 'menu_levels.json');
        const store = readJsonSafeV22(file, {});
        const prev = store[m.sender];
        if (prev !== undefined && extras.level > Number(prev)) extras.levelUp = { from: Number(prev), to: extras.level };
        if (prev !== extras.level) { store[m.sender] = extras.level; writeJsonSafeV22(file, store); }
    } catch (e) {}
    return extras;
}

    const escJsonV22 = (typeof escapeJsonForScriptV22 === 'function')
        ? escapeJsonForScriptV22
        : (s) => String(s).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

    // --- Idol Stage Rich HTML: kartu interaktif (accordion kategori, search, tap-to-copy) ---
    try {
        const { getCasesByCategory } = require('../../case/hsnai');
        const timeHelperV22 = require('../../src/lib/timeHelper');

        const prefixV22 = botConfig.command?.prefix || '.';
        const botNameV22 = botConfig.bot?.name || 'Hoshino Ai-Bot';
        const channelLinkV22 = botConfig.saluran?.link || config.info?.website || 'https://sc.hoshino-ai.my.id';
        const trustedUrlV22 = config.info?.website || 'https://sc.hoshino-ai.my.id';

        // ---------- kategori (plugin + case), urut & difilter sesuai mode grup ----------
        const cmdsByCatV22 = getCommandsByCategory();
        const casesByCatV22 = getCasesByCategory();
        const categoryOrderV22 = ['owner', 'main', 'utility', 'tools', 'fun', 'game', 'download', 'search', 'sticker', 'media', 'ai', 'group', 'religi', 'info', 'cek', 'economy', 'user', 'canvas', 'random', 'premium', 'ephoto', 'jpm', 'pushkontak', 'panel', 'store'];
        const sortedCatsV22 = [...getCategories()].sort((a, b) => {
            const iA = categoryOrderV22.indexOf(a);
            const iB = categoryOrderV22.indexOf(b);
            return (iA === -1 ? 999 : iA) - (iB === -1 ? 999 : iB);
        });

        const allowV22 = botMode === 'md' ? null : ['main', 'group', 'sticker', 'owner', 'tools'];
        const excludeV22 = ['panel', 'pushkontak', 'store'];

        const categoriesV22 = [];
        const allNamesV22 = new Set();   // semua command (tanpa filter) buat deteksi NEW
        let totalFeaturesV22 = 0;
        for (const cat of sortedCatsV22) {
            for (const c of [...(cmdsByCatV22[cat] || []), ...(casesByCatV22[cat] || [])]) { if (c) allNamesV22.add(String(c)); }
            if (cat === 'owner' && !m.isOwner) continue;
            if (allowV22 && !allowV22.includes(cat.toLowerCase())) continue;
            if (excludeV22.includes(cat.toLowerCase())) continue;

            const cmds = [...(cmdsByCatV22[cat] || []), ...(casesByCatV22[cat] || [])]
                .map(c => String(c))
                .filter(Boolean);
            if (cmds.length === 0) continue;

            totalFeaturesV22 += cmds.length;
            categoriesV22.push({
                key: cat,
                emoji: CATEGORY_EMOJIS[cat] || '📁',
                label: toSmallCaps(cat),
                cmds
            });
        }

        // ---------- info user ----------
        const userV22 = db.getUser(m.sender);
        const roleV22 = m.isOwner ? 'Owner' : (m.isPremium ? 'Premium' : 'User');
        const roleEmojiV22 = m.isOwner ? '👑' : (m.isPremium ? '💎' : '👤');
        const limitV22 = m.isOwner || m.isPremium ? '∞ Unlimited' : (userV22?.limit ?? 25);

        // ---------- dialog idol (acak tiap buka menu) ----------
        const dialogsV22 = [
            'Hehe~ akhirnya kamu datang juga! Aku udah siapin panggung buat kamu ✨ Pilih kategori yang kamu suka ya~',
            'Yeay, ada penonton setia! 🎀 Ketuk kategori di bawah, nanti aku tunjukin semua fitur andalanku~',
            'Kamu tahu nggak? Setiap kamu buka menu, rasanya kayak lagi konser solo 🌸 Yuk mulai pertunjukannya!',
            'Aku Ai, idol virtual yang siap nemenin kamu kapan aja 💖 Mau cari fitur apa hari ini?',
            'Spotlight nyala~ ⭐ Semua fitur udah rapi di bawah, tinggal kamu pilih. Aku tunggu ya!'
        ];

        // ---------- avatar = PP user (fallback images/pp-kosong) ----------
        let avatarDataUriV22 = '';
        try {
            let avatarBufV22 = null;
            try {
                const ppUrlV22 = await sock.profilePictureUrl(m.sender, 'image');
                if (ppUrlV22) {
                    avatarBufV22 = Buffer.from((await axios.get(ppUrlV22, { responseType: 'arraybuffer', timeout: 8000 })).data);
                }
            } catch (e) { avatarBufV22 = null; }
            if (!avatarBufV22) avatarBufV22 = await hsAsset.buffer('images/pp-kosong');
            if (avatarBufV22) {
                const smallAvatarV22 = await sharp(Buffer.from(avatarBufV22))
                    .resize(288, 288, { fit: 'cover', position: 'centre' })
                    .jpeg({ quality: 76 })
                    .toBuffer();
                avatarDataUriV22 = 'data:image/jpeg;base64,' + smallAvatarV22.toString('base64');
            }
        } catch (avErr) {
            console.error('[Menu V22] Avatar gagal:', avErr.message);
        }

        // ---------- gambar header 16:9 (images/hsnai-v22 → hsnai → hsnai2) ----------
        let bannerDataUriV22 = '';
        try {
            const srcV22 = await variantImage('hsnai-v22', imageBuffer || thumbBuffer);
            if (srcV22) {
                const bannerBufV22 = await sharp(Buffer.from(srcV22))
                    .resize(800, 450, { fit: 'cover', position: 'centre' })
                    .jpeg({ quality: 72 })
                    .toBuffer();
                bannerDataUriV22 = 'data:image/jpeg;base64,' + bannerBufV22.toString('base64');
            }
        } catch (imgErr) {
            console.error('[Menu V22] Header gagal:', imgErr.message);
        }

        // ---------- pangkat/XP, top 5, NEW & HOT ----------
        const extrasV22 = buildMenuV22Extras({ m, db, botConfig, allNames: [...allNamesV22] });

        const dataV22 = {
            botName: botNameV22,
            version: botConfig.bot?.version || '1.0.0',
            mode: botConfig.mode || 'public',
            groupMode: botMode,
            prefix: prefixV22,
            uptime: formatUptime(uptime),
            ownerName: botConfig.owner?.name || botNameV22,
            totalUsers: db.getUserCount(),
            totalFeatures: totalFeaturesV22,
            userName: m.pushName || 'User',
            role: roleV22,
            roleEmoji: roleEmojiV22,
            limit: limitV22,
            time: timeHelperV22.formatTime('HH:mm'),
            date: timeHelperV22.formatFull('dddd, DD MMMM YYYY'),
            greeting: getTimeGreeting(),
            dialog: dialogsV22[Math.floor(Math.random() * dialogsV22.length)],
            dialogs: [...dialogsV22].sort(() => Math.random() - 0.5),
            channelLink: channelLinkV22,
            botNumber: String(botConfig.botNumber || sock.user?.id || '').split(':')[0].split('@')[0].replace(/\D/g, ''),
            categories: categoriesV22,
            ...extrasV22
        };

        const avatarHtmlV22 = avatarDataUriV22
            ? '<img src="' + avatarDataUriV22 + '" alt="avatar" onerror="this.style.display=\'none\'">'
            : '';
        const bannerHtmlV22 = bannerDataUriV22
            ? '<img src="' + bannerDataUriV22 + '" alt="header" onerror="this.style.display=\'none\'">'
            : '';
        const htmlV22 = MENU_TPL_V22
            .replace('__AVATAR_HTML__', () => avatarHtmlV22)
            .replace('__BANNER_HTML__', () => bannerHtmlV22)
            .replace('__MENU_DATA__', () => escJsonV22(JSON.stringify(dataV22)));
        await sendMenuRichV22(sock, m, htmlV22, botNameV22, trustedUrlV22);

    } catch (v22Error) {
        console.error('[Menu V22] Error:', v22Error);
        await m.reply(text);
    }
    break;
}

/* ============================================================================
   BONUS: audio menu di-convert ke Opus 256kbps (HQ) + di-cache, biar gak
   convert ulang tiap kirim. Ganti blok `audioEnabled` yang lama di menu.js
   kamu dengan ini kalau mau audio menu-nya sekelas ourin.
   ========================================================================= */

/*
const audioEnabled = db.setting('audioMenu') !== false;
if (audioEnabled) {
    const audioPath = await hsAsset.tryFile('audio/hsnai')
    if (hsAsset.has('audio/hsnai')) {
        try {
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
            const oggPath = path.join(tempDir, 'menu_audio_hq_opus.ogg');

            if (!fs.existsSync(oggPath)) {
                const { spawn } = require('child_process');
                await new Promise((resolve, reject) => {
                    const ffmpeg = spawn('ffmpeg', [
                        '-y', '-i', audioPath,
                        '-c:a', 'libopus', '-b:a', '256k', '-vbr', 'on',
                        '-compression_level', '10', '-ac', '2', '-ar', '48000',
                        oggPath
                    ]);
                    ffmpeg.on('close', (code) => code === 0 ? resolve() : reject(new Error('FFmpeg error')));
                    ffmpeg.on('error', reject);
                });
            }

            await sock.sendMessage(m.chat, {
                audio: { url: oggPath },
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true
            }, { quoted: m });
        } catch (ffmpegErr) {
            // fallback ke mp3 mentah kalau ffmpeg gagal / gak ke-install
            await sock.sendMessage(m.chat, {
                audio: (await hsAsset.buffer('audio/hsnai')),
                mimetype: 'audio/mpeg',
                ptt: true
            }, { quoted: m });
        }
    }
}
*/

            default:
                await m.reply(text);
        }
        
        /* ============================================================================
   PATCH: Ganti blok audio di bagian bawah handler() menu.js kamu dengan ini.
   Cari blok yang diawali:

       const audioEnabled = db.setting('audioMenu') !== false
       if (audioEnabled) {
           const audioPath = await hsAsset.tryFile('audio/hsnai')
           ...
       }

   dan GANTI SELURUHNYA dengan blok di bawah ini. Ini bikin gaya kirim audio
   (bukan tampilan visual menu) bisa diatur lewat `.setaudiomenu 1-5`, sama
   kayak `menuAudioStyle` yang disave plugin setaudiomenu.js.
   ========================================================================= */

const audioEnabled = db.setting('audioMenu') !== false;
if (audioEnabled) {
    const audioPath = await hsAsset.tryFile('audio/hsnai')
    const audioStyle = db.setting('menuAudioStyle') || 1;

    if (hsAsset.has('audio/hsnai')) {
        // helper: convert mp3 -> opus ogg (HQ), dengan cache biar gak convert ulang tiap kirim
        async function getOpusPath() {
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
            const oggPath = path.join(tempDir, 'menu_audio_hq_opus.ogg');
            if (fs.existsSync(oggPath)) return oggPath;

            const { spawn } = require('child_process');
            await new Promise((resolve, reject) => {
                const ffmpeg = spawn('ffmpeg', [
                    '-y', '-i', audioPath,
                    '-c:a', 'libopus', '-b:a', '256k', '-vbr', 'on',
                    '-compression_level', '10', '-ac', '2', '-ar', '48000',
                    oggPath
                ]);
                ffmpeg.on('close', (code) => code === 0 ? resolve() : reject(new Error('FFmpeg error')));
                ffmpeg.on('error', reject);
            });
            return oggPath;
        }

        try {
            switch (audioStyle) {
                case 1: {
                    // PTT Opus + reply ke pesan asli
                    try {
                        const oggPath = await getOpusPath();
                        await sock.sendMessage(m.chat, {
                            audio: { url: oggPath },
                            mimetype: 'audio/ogg; codecs=opus',
                            ptt: true
                        }, { quoted: m });
                    } catch (e) {
                        await sock.sendMessage(m.chat, {
                            audio: (await hsAsset.buffer('audio/hsnai')),
                            mimetype: 'audio/mpeg',
                            ptt: true
                        }, { quoted: m });
                    }
                    break;
                }

                case 2: {
                    // PTT Opus + reply fake polling
                    const qpoll = {
                        key: { participant: '0@s.whatsapp.net' },
                        message: { pollCreationMessage: { name: botConfig.bot?.name || 'Hoshino Ai-Bot' } }
                    };
                    try {
                        const oggPath = await getOpusPath();
                        await sock.sendMessage(m.chat, {
                            audio: { url: oggPath },
                            mimetype: 'audio/ogg; codecs=opus',
                            ptt: true
                        }, { quoted: qpoll });
                    } catch (e) {
                        await sock.sendMessage(m.chat, {
                            audio: (await hsAsset.buffer('audio/hsnai')),
                            mimetype: 'audio/mpeg',
                            ptt: false
                        }, { quoted: qpoll });
                    }
                    break;
                }

                case 3: {
                    // MP3 biasa + reply fake chat teks
                    const qtext = {
                        key: { fromMe: false, participant: m.sender },
                        message: { conversation: 'setelin musiknya nya bang' }
                    };
                    await sock.sendMessage(m.chat, {
                        audio: (await hsAsset.buffer('audio/hsnai')),
                        mimetype: 'audio/mpeg',
                        ptt: false
                    }, { quoted: qtext });
                    break;
                }

                case 4: {
                    // PTT Opus + reply fake dari channel/saluran
                    const saluranId = botConfig.saluran?.id || '120363400911374213@newsletter';
                    const qChannel = {
                        key: {
                            fromMe: false,
                            participant: '0@s.whatsapp.net',
                            remoteJid: saluranId
                        },
                        message: { conversation: '🔊 Playing Audio Menu...' }
                    };
                    try {
                        const oggPath = await getOpusPath();
                        await sock.sendMessage(m.chat, {
                            audio: { url: oggPath },
                            mimetype: 'audio/ogg; codecs=opus',
                            ptt: true
                        }, { quoted: qChannel });
                    } catch (e) {
                        await sock.sendMessage(m.chat, {
                            audio: (await hsAsset.buffer('audio/hsnai')),
                            mimetype: 'audio/mpeg',
                            ptt: false
                        }, { quoted: qChannel });
                    }
                    break;
                }

                case 5:
                default: {
                    // MP3 biasa + reply fake troli/order
                    const ftroliQuoted = {
                        key: {
                            fromMe: false,
                            participant: '0@s.whatsapp.net',
                            remoteJid: 'status@broadcast'
                        },
                        message: {
                            orderMessage: {
                                orderId: '44444444444444',
                                thumbnail: thumbBuffer || imageBuffer || null,
                                itemCount: 1,
                                status: 'INQUIRY',
                                surface: 'CATALOG',
                                message: `★ ${botConfig.bot?.name || 'Hoshino Ai-Bot'}`,
                                orderTitle: `📋 Menu Audio`,
                                sellerJid: botConfig.botNumber ? `${botConfig.botNumber}@s.whatsapp.net` : m.sender,
                                token: 'hsnai-menu-audio',
                                totalAmount1000: 0,
                                totalCurrencyCode: 'IDR'
                            }
                        }
                    };
                    await sock.sendMessage(m.chat, {
                        audio: (await hsAsset.buffer('audio/hsnai')),
                        mimetype: 'audio/mpeg',
                        ptt: false
                    }, { quoted: ftroliQuoted });
                    break;
                }
            }
        } catch (audioErr) {
            console.error('[Menu] Error sending audio:', audioErr.message);
        }
    }
}

    } catch (error) {
        console.error('[Menu] Error on command execution:', error.message);
    }
}

module.exports = {
    config: pluginConfig,
    handler
};
