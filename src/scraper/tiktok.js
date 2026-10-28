const axios = require('axios');
const cheerio = require('cheerio');
const fetch = require('node-fetch');

// Helper URL TikTok (CJS port dari helper down-tiktok).
// Mendukung: tiktok.com (www/vm/vt/m/vn), /t/xxx, /@user/video|photo/id, dan tt.site/t/xxx
const URL_REGEX = /https?:\/\/(?:[\w-]+\.)*(?:tiktok\.com|tiktokv\.com|tt\.site)\/[^\s<>"'`]+/i;
const CANONICAL_REGEX = /https?:\/\/(?:www\.|m\.)?tiktok\.com\/@[\w.-]+\/(?:video|photo)\/\d+/i;
const RESOLVE_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

// Ambil URL TikTok pertama dari teks (bersihkan tanda baca di ujung)
function extractTikTokUrl(text = '') {
    const found = String(text).match(URL_REGEX)?.[0];
    return found ? found.replace(/[.,;:!?)\]}>]+$/, '') : null;
}

// True kalau sudah berupa link asli video/foto (tidak perlu di-resolve)
function isCanonicalTikTokUrl(url = '') {
    return CANONICAL_REGEX.test(url);
}

// Ikuti redirect link pendek sampai ketemu URL asli. Return null kalau gagal.
async function resolveTikTokUrl(url, timeout = 15000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
        const res = await fetch(url, {
            redirect: 'follow',
            signal: ctrl.signal,
            headers: { 'User-Agent': RESOLVE_UA, 'Accept-Language': 'en-US,en;q=0.9' }
        });

        // 1) hasil redirect HTTP sudah berupa link video/foto
        const direct = res.url?.match(CANONICAL_REGEX)?.[0];
        if (direct) return direct;

        // 2) redirect lewat HTML (meta refresh / JS) -> cari link video di body
        const html = await res.text();
        const fromBody = html.replace(/\\u002F/g, '/').replace(/\\\//g, '/').match(CANONICAL_REGEX)?.[0];
        if (fromBody) return fromBody;

        // 3) terakhir: pakai URL akhir kalau sudah domain tiktok
        if (/tiktok\.com/i.test(res.url || '') && res.url !== url) return res.url;
        return null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

async function ttdown(url) {
    try {
        // Bersihkan teks -> ambil URL-nya, lalu resolve kalau masih link pendek (tt.site, vt, vm, /t/xxx)
        url = extractTikTokUrl(url) || url;
        if (!isCanonicalTikTokUrl(url)) {
            const resolved = await resolveTikTokUrl(url);
            if (resolved) url = resolved;
        }
        if (!/tiktok\.com/i.test(url)) throw new Error('Invalid url.');

        const { data: html, headers } = await axios.get('https://musicaldown.com/en');
        const $ = cheerio.load(html);

        const payload = {};
        $('#submit-form input').each((i, elem) => {
            const name = $(elem).attr('name');
            const value = $(elem).attr('value');
            if (name) payload[name] = value || '';
        });

        const urlField = Object.keys(payload).find(key => !payload[key]);
        if (urlField) payload[urlField] = url;

        const { data } = await axios.post('https://musicaldown.com/download', new URLSearchParams(payload).toString(), {
            headers: {
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                cookie: headers['set-cookie'].join('; '),
                origin: 'https://musicaldown.com',
                referer: 'https://musicaldown.com/',
                'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
            }
        });

        const $$ = cheerio.load(data);

        const videoHeader = $$('.video-header');
        const bgImage = videoHeader.attr('style');
        const coverMatch = bgImage?.match(/url\((.*?)\)/);

        const downloads = [];
        $$('a.download').each((i, elem) => {
            const $elem = $$(elem);
            const type = $elem.data('event')?.replace('_download_click', '');
            const label = $elem.text().trim();
            downloads.push({
                type: type,
                label: label,
                url: $elem.attr('href')
            });
        });

        return {
            title: $$('.video-desc').text().trim(),
            author: {
                username: $$('.video-author b').text().trim(),
                avatar: $$('.img-area img').attr('src')
            },
            cover: coverMatch ? coverMatch[1] : null,
            downloads: downloads
        };
    } catch (error) {
        throw new Error(error.message);
    }
};

ttdown.extractTikTokUrl = extractTikTokUrl;
ttdown.resolveTikTokUrl = resolveTikTokUrl;
ttdown.isCanonicalTikTokUrl = isCanonicalTikTokUrl;

module.exports = ttdown