const axios = require('axios')

class Pinterest {
    constructor() {
        this.api = {
            base: 'https://www.pinterest.com',
            endpoints: {
                pin: '/resource/PinResource/get/'
            }
        }
        this.headers = {
            accept: 'application/json, text/javascript, */*, q=0.01',
            referer: 'https://www.pinterest.com/',
            'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
            'x-app-version': 'f1222d7',
            'x-pinterest-appstate': 'active',
            'x-pinterest-pws-handler': 'www/[username]/[slug].js',
            'x-pinterest-source-url': '/search/pins/?rs=typed&q=xxx/',
            'x-requested-with': 'XMLHttpRequest'
        }
        this.client = axios.create({
            baseURL: this.api.base,
            headers: this.headers
        })
        this.cookies = ''

        this.client.interceptors.response.use(
            (response) => {
                const setCookieHeaders = response.headers['set-cookie']
                if (setCookieHeaders) {
                    const newCookies = setCookieHeaders.map((cookieString) => {
                        const cp = cookieString.split(';')
                        return cp[0].trim()
                    })
                    this.cookies = newCookies.join('; ')
                    this.client.defaults.headers.cookie = this.cookies
                }
                return response
            },
            (error) => Promise.reject(error)
        )
    }

    isUrl(str) {
        try {
            new URL(str)
            return true
        } catch (_) {
            return false
        }
    }

    isPin(url) {
        if (!url) return false
        const patterns = [
            /^https?:\/\/(?:[\w-]+\.)?pinterest\.[\w.]+\/pin\/[\w.-]+/,
            /^https?:\/\/pin\.it\/[\w.-]+/,
            /^https?:\/\/(?:[\w-]+\.)?pinterest\.[\w.]+\/pin\/[\d]+(?:\/)?/
        ]
        const clean = url.trim().toLowerCase()
        return patterns.some((pattern) => pattern.test(clean))
    }

    async followRedirects(url, maxRedirects = 2) {
        try {
            let currentUrl = url
            let redirectCount = 0
            while (redirectCount < maxRedirects) {
                const response = await axios.head(currentUrl, {
                    maxRedirects: 0,
                    validateStatus: (status) => status < 400 || (status >= 300 && status < 400),
                    timeout: 10000
                })
                if (response.status >= 300 && response.status < 400 && response.headers.location) {
                    currentUrl = response.headers.location
                    if (!currentUrl.startsWith('http')) {
                        const baseUrl = new URL(url)
                        currentUrl = new URL(currentUrl, baseUrl.origin).href
                    }
                    redirectCount++
                } else {
                    break
                }
            }
            return currentUrl
        } catch (error) {
            if (error.response && error.response.status >= 300 && error.response.status < 400) {
                return error.response.headers.location || url
            }
            return url
        }
    }

    async initCookies() {
        try {
            await this.client.get('/')
            return true
        } catch (error) {
            return false
        }
    }

    async download(pinUrl) {
        if (!pinUrl || !this.isUrl(pinUrl)) throw new Error('Invalid URL')

        try {
            const finalUrl = await this.followRedirects(pinUrl, 2)
            if (!this.isPin(finalUrl)) throw new Error('Not a valid Pinterest URL')

            const pinId = finalUrl.split('/pin/')[1]?.split('/')[0]?.split('?')[0]
            if (!pinId) throw new Error('Could not extract Pin ID')

            if (!this.cookies) await this.initCookies()

            const params = {
                source_url: `/pin/${pinId}/`,
                data: JSON.stringify({
                    options: { field_set_key: 'detailed', id: pinId },
                    context: {}
                }),
                _: Date.now()
            }

            const { data } = await this.client.get(this.api.endpoints.pin, { params })

            if (!data.resource_response.data) throw new Error('Pin not found')

            const pd = data.resource_response.data
            const mediaUrls = []

            // 1. Cek Video dulu
            if (pd.videos?.video_list) {
                const videoKeys = Object.keys(pd.videos.video_list)
                const bestVideoKey = videoKeys.find(k => k.includes('720')) || videoKeys[0]
                let videoUrl = pd.videos.video_list[bestVideoKey]?.url
                const videoDuration = pd.videos.video_list[bestVideoKey]?.duration || null
                const videoWidth = pd.videos.video_list[bestVideoKey]?.width || null
                const videoHeight = pd.videos.video_list[bestVideoKey]?.height || null

                if (videoUrl && videoUrl.includes('m3u8')) {
                    videoUrl = videoUrl.replace('/hls/', '/720p/').replace('.m3u8', '.mp4')
                }

                mediaUrls.push({
                    type: 'video',
                    url: videoUrl,
                    quality: bestVideoKey || null,
                    duration: videoDuration,
                    width: videoWidth,
                    height: videoHeight,
                    thumbnail: pd.images?.orig?.url
                })
            }
            // 2. Kalau GAK ADA video di API, coba scrape dari HTML dulu
            else if (pd.images) {
                let foundVideo = false
                try {
                    const pinPageUrl = `https://www.pinterest.com/pin/${pinId}/`
                    const { data: html } = await this.client.get(pinPageUrl, {
                        headers: {
                            ...this.headers,
                            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                        }
                    })
                    const videoMatches = html.match(/https?:\/\/v\d+\.pinimg\.com\/videos[^"'\s]+\.mp4/g)
                    if (videoMatches && videoMatches.length > 0) {
                        const uniqueUrl = [...new Set(videoMatches)][0]
                        mediaUrls.push({
                            type: 'video',
                            url: uniqueUrl,
                            quality: 'V_720P',
                            duration: null,
                            width: null,
                            height: null,
                            thumbnail: pd.images?.orig?.url
                        })
                        foundVideo = true
                    }
                } catch (e) {
                    // scrape gagal, fallback ke gambar
                }

                if (!foundVideo) {
                    const orig = pd.images.orig
                    mediaUrls.push({
                        type: 'image',
                        url: orig.url,
                        width: orig.width || null,
                        height: orig.height || null
                    })
                }
            }

            // Hitung total reactions
            const reactionCount = pd.reaction_counts
                ? Object.values(pd.reaction_counts).reduce((a, b) => a + (b || 0), 0)
                : 0

            // Format tanggal
            const createdAt = pd.created_at
                ? new Date(pd.created_at).toLocaleDateString('id-ID', {
                    day: '2-digit', month: 'long', year: 'numeric'
                })
                : null

            return {
                id: pd.id,
                title: pd.title || pd.grid_title || null,
                description: pd.description || null,
                link: pd.link || null,
                pinUrl: `https://pinterest.com/pin/${pd.id}/`,
                createdAt,
                dominantColor: pd.dominant_color || null,
                repinCount: pd.repin_count || 0,
                commentCount: pd.comment_count || 0,
                reactionCount,
                pinner: {
                    username: pd.pinner?.username || null,
                    fullName: pd.pinner?.full_name || null,
                    followers: pd.pinner?.follower_count ?? null,
                    profileUrl: pd.pinner?.username
                        ? `https://pinterest.com/${pd.pinner.username}/`
                        : null
                },
                board: {
                    name: pd.board?.name || null,
                    url: pd.board?.url
                        ? `https://pinterest.com${pd.board.url}`
                        : null
                },
                media: mediaUrls
            }

        } catch (error) {
            throw error
        }
    }
}

const pinterestInstance = new Pinterest()

async function pinterestdl(url) {
    return await pinterestInstance.download(url)
}

module.exports = { pinterestdl, Pinterest }