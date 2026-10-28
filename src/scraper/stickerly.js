const axios = require('axios');

class StickerLy {
    async search(query) {
        try {
            if (!query) throw new Error('Query is required.');
            
            const { data } = await axios.post('https://api.sticker.ly/v4/stickerPack/smartSearch', {
                keyword: query,
                enabledKeywordSearch: true,
                filter: {
                    extendSearchResult: false,
                    sortBy: 'RECOMMENDED',
                    languages: ['ALL'],
                    minStickerCount: 5,
                    searchBy: 'ALL',
                    stickerType: 'ALL'
                }
            }, {
                headers: {
                    'user-agent': 'androidapp.stickerly/3.17.0 (Redmi Note 4; U; Android 29; in-ID; id;)',
                    'content-type': 'application/json',
                    'accept-encoding': 'gzip'
                }
            });
            
            return data.result.stickerPacks.map(pack => ({
                name: pack.name,
                author: pack.authorName,
                stickerCount: pack.resourceFiles.length,
                viewCount: pack.viewCount,
                exportCount: pack.exportCount,
                isPaid: pack.isPaid,
                isAnimated: pack.isAnimated,
                thumbnailUrl: `${pack.resourceUrlPrefix}${pack.resourceFiles[pack.trayIndex]}`,
                url: pack.shareUrl
            }));
        } catch (error) {
            throw new Error(error.message);
        }
    }
    
    async detail(url) {
        try {
            const match = url.match(/\/s\/([^\/\?#]+)/);
            if (!match) throw new Error('Invalid URL.');
            
            const { data } = await axios.get(`https://api.sticker.ly/v4/stickerPack/${match[1]}?needRelation=true`, {
                headers: {
                    'user-agent': 'androidapp.stickerly/3.17.0 (Redmi Note 4; U; Android 29; in-ID; id;)',
                    'content-type': 'application/json',
                    'accept-encoding': 'gzip'
                }
            });
            
            return {
                name: data.result.name,
                author: data.result.user?.displayName || 'Unknown', // Kita sederhanakan untuk plugin
                stickers: data.result.stickers.map(stick => ({
                    url: `${data.result.resourceUrlPrefix}${stick.fileName}`
                })),
                stickerCount: data.result.stickers.length,
                isAnimated: data.result.isAnimated
            };
        } catch (error) {
            throw new Error(error.message);
        }
    }
}

module.exports = new StickerLy();