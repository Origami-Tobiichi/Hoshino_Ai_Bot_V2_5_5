const yt = require('../../src/lib/ytnotify-core.js')
const config = require('../../config.js')

const pluginConfig = {
    name: 'ytnotify',
    alias: ['yt', 'ytnotif'],
    category: 'youtube',
    description: 'Notifikasi otomatis kalau channel YouTube yang didaftarkan upload video baru',
    usage: '.ytnotify <addchannel|delchannel|list|addgrup|delgrup|addsaluran|delsaluran|start|stop|status|cek|test|interval|reset>',
    example: '.ytnotify addchannel @MrBeast',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const fullText = (m.text || '').trim()
    const parts = fullText.split(/\s+/).filter(Boolean)
    const sub = (parts[0] || '').toLowerCase()
    const rest = parts.slice(1).join(' ')
    const state = yt.loadState()

    switch (sub) {
        case 'addchannel':
        case 'addch': {
            if (!rest) {
                return m.reply(
                    `❌ Masukkan channel-nya.\n\n` +
                    `Contoh:\n` +
                    `> .ytnotify addchannel @MrBeast\n` +
                    `> .ytnotify addchannel https://youtube.com/@MrBeast\n` +
                    `> .ytnotify addchannel UCX6OQ3DkcsbYNE6H8uQQuVA`
                )
            }

            if (!config.APIkey?.youtube) {
                return m.reply(
                    `❌ API key YouTube belum diatur.\n\n` +
                    `Buat dulu di Google Cloud Console (aktifkan *YouTube Data API v3*), ` +
                    `lalu isi \`APIkey.youtube\` di config.js.`
                )
            }

            await m.reply('🔍 Mencari channel...')

            let channelId
            try {
                channelId = await yt.resolveChannelId(rest)
            } catch (e) {
                return m.reply(`❌ *Gomen ne~* ✦\n\n> ${e.message}\n\n_Ai udah coba yang terbaik tapi gagal juga... coba lagi nanti ya~ 🌸_`)
            }

            if (!channelId) {
                return m.reply(`❌ *Ehh~* Channel "${rest}" tidak ditemukan. Cek lagi handle/URL/ID-nya~ 🥺`)
            }

            if (state.channels.find(c => c.channelId === channelId)) {
                return m.reply('⚠️ *Eh eh~* Channel ini sudah terdaftar sebelumnya~ 🌸')
            }

            let info
            try {
                info = await yt.getChannelInfo(channelId)
            } catch (e) {
                return m.reply(`❌ *Gomen ne~* Gagal ambil info channel: ${e.message} 🥺`)
            }

            if (!info || !info.uploadsPlaylistId) {
                return m.reply('❌ *Gomen ne~* Channel ditemukan tapi gagal ambil daftar upload-nya~ 🥺')
            }

            state.channels.push({
                channelId: info.channelId,
                title: info.title,
                uploadsPlaylistId: info.uploadsPlaylistId,
                addedAt: Date.now()
            })
            yt.saveState(state)

            return m.reply(
                `✅ Channel ditambahkan!\n\n` +
                `📺 Nama: *${info.title}*\n` +
                `🆔 ID: ${info.channelId}\n\n` +
                `Total channel terdaftar: ${state.channels.length}`
            )
        }

        case 'delchannel':
        case 'delch': {
            if (!rest) return m.reply('❌ *Ehh~* Masukkan nama/ID channel yang mau dihapus, atau nomor urut dari .ytnotify list~ 🥺')

            const idx = parseInt(rest)
            let removed = null

            if (!isNaN(idx) && idx >= 1 && idx <= state.channels.length) {
                removed = state.channels.splice(idx - 1, 1)[0]
            } else {
                const i = state.channels.findIndex(c =>
                    c.channelId === rest ||
                    c.title.toLowerCase().includes(rest.toLowerCase())
                )
                if (i !== -1) removed = state.channels.splice(i, 1)[0]
            }

            if (!removed) return m.reply('❌ *Ehh~* Channel tidak ditemukan di daftar~ 🥺')

            yt.saveState(state)
            return m.reply(`✅ *Yatta~* Channel *${removed.title}* dihapus dari daftar~ ✨`)
        }

        case 'list': {
            if (state.channels.length === 0) {
                return m.reply('📭 Belum ada channel yang terdaftar.\n\nTambah pakai: .ytnotify addchannel <channel>')
            }
            let txt = `📺 *ᴅᴀꜰᴛᴀʀ ᴄʜᴀɴɴᴇʟ*\n\n`
            state.channels.forEach((c, i) => {
                txt += `*${i + 1}.* ${c.title}\n   🆔 ${c.channelId}\n`
            })
            txt += `\nTotal: ${state.channels.length} channel`
            return m.reply(txt)
        }

        case 'addgrup':
        case 'addgroup': {
            let grupId = rest
            if (!grupId && m.isGroup) grupId = m.chat
            if (!grupId) return m.reply('❌ *Ehh~* Masukkan ID grup, atau ketik command ini langsung di grup tujuan~ 🥺')

            if (state.groups.includes(grupId)) {
                return m.reply('⚠️ *Eh eh~* Grup ini sudah terdaftar sebagai tujuan notifikasi~ 🌸')
            }
            state.groups.push(grupId)
            yt.saveState(state)
            return m.reply(`✅ Grup ditambahkan sebagai tujuan notifikasi.\nTotal grup: ${state.groups.length}`)
        }

        case 'delgrup':
        case 'delgroup': {
            let grupId = rest
            if (!grupId && m.isGroup) grupId = m.chat
            if (!grupId) return m.reply('❌ *Ehh~* Masukkan ID grup yang mau dihapus~ 🥺')

            const idx = state.groups.indexOf(grupId)
            if (idx === -1) return m.reply('❌ *Ehh~* Grup ini tidak ada di daftar tujuan~ 🥺')

            state.groups.splice(idx, 1)
            yt.saveState(state)
            return m.reply(`✅ Grup dihapus dari daftar tujuan.\nTotal grup: ${state.groups.length}`)
        }

        case 'addsaluran': {
            let salId = rest
            if (!salId && m.isChannel) salId = m.chat
            if (!salId) {
                return m.reply(
                    `❌ Masukkan ID saluran, atau ketik command ini langsung di saluran tujuan.\n\n` +
                    `Contoh: .ytnotify addsaluran 120363409928671192@newsletter`
                )
            }

            state.salurans = state.salurans || []
            if (state.salurans.includes(salId)) {
                return m.reply('⚠️ *Eh eh~* Saluran ini sudah terdaftar sebagai tujuan notifikasi~ 🌸')
            }
            state.salurans.push(salId)
            yt.saveState(state)
            return m.reply(`✅ Saluran ditambahkan sebagai tujuan notifikasi.\nTotal saluran: ${state.salurans.length}`)
        }

        case 'delsaluran': {
            let salId = rest
            if (!salId && m.isChannel) salId = m.chat
            if (!salId) return m.reply('❌ *Ehh~* Masukkan ID saluran yang mau dihapus~ 🥺')

            state.salurans = state.salurans || []
            const idx = state.salurans.indexOf(salId)
            if (idx === -1) return m.reply('❌ *Ehh~* Saluran ini tidak ada di daftar tujuan~ 🥺')

            state.salurans.splice(idx, 1)
            yt.saveState(state)
            return m.reply(`✅ Saluran dihapus dari daftar tujuan.\nTotal saluran: ${state.salurans.length}`)
        }

        case 'interval': {
            const mins = parseInt(rest)
            if (!mins || mins < 1) return m.reply('❌ *Ehh~* Masukkan interval dalam menit, contoh: .ytnotify interval 10~ 🥺')

            state.interval = mins
            yt.saveState(state)
            if (yt.isRunning) yt.startAutoCheck(sock, mins)
            return m.reply(`✅ *Yatta~* Interval diubah ke ${mins} menit~ ✨`)
        }

        case 'start': {
            if (yt.isRunning) return m.reply('⚠️ *Eh eh~* YTNotify sudah berjalan~ 🌸')
            if (state.channels.length === 0) return m.reply('❌ *Ehh~* Belum ada channel. Tambah dulu pakai .ytnotify addchannel~ 🥺')
            const totalDest = state.groups.length + (state.salurans?.length || 0)
            if (totalDest === 0) return m.reply('❌ *Ehh~* Belum ada grup/saluran tujuan. Tambah dulu pakai .ytnotify addgrup atau .ytnotify addsaluran~ 🥺')

            state.enabled = true
            yt.saveState(state)
            yt.startAutoCheck(sock, state.interval || 10)
            return m.reply(`✅ YTNotify diaktifkan!\n⏱️ Interval: setiap ${state.interval || 10} menit\n📺 Channel: ${state.channels.length}\n👥 Grup: ${state.groups.length}\n📡 Saluran: ${state.salurans?.length || 0}`)
        }

        case 'stop': {
            if (!yt.isRunning) return m.reply('⚠️ *Eh eh~* YTNotify memang belum berjalan~ 🌸')
            yt.stopAutoCheck()
            state.enabled = false
            yt.saveState(state)
            return m.reply('🛑 YTNotify dihentikan.')
        }

        case 'status': {
            return m.reply(
                `📊 *ꜱᴛᴀᴛᴜꜱ ʏᴛɴᴏᴛɪꜰʏ*\n\n` +
                `🔄 Status: ${yt.isRunning ? '🟢 Aktif' : '🔴 Tidak aktif'}\n` +
                `⏱️ Interval: ${state.interval || 10} menit\n` +
                `📺 Channel terdaftar: ${state.channels.length}\n` +
                `👥 Grup tujuan: ${state.groups.length}\n` +
                `📡 Saluran tujuan: ${state.salurans?.length || 0}\n` +
                `🔑 API Key: ${config.APIkey?.youtube ? '✅ Sudah diatur' : '❌ Belum diatur'}`
            )
        }

        case 'cek':
        case 'check': {
            if (state.channels.length === 0) return m.reply('❌ *Ehh~* Belum ada channel terdaftar~ 🥺')
            if (!yt.isRunning) yt.startAutoCheck(sock, state.interval || 10)

            await m.reply('🔍 Mengecek video terbaru...')
            try {
                const { error, results } = await yt.runCheck()

                if (error === 'no_targets') return m.reply('⚠️ *Eh eh~* Belum ada grup/saluran target. Gunakan *.ytnotify addgrup* atau *.ytnotify addsaluran* dulu~ 🌸')
                if (error === 'no_channels') return m.reply('⚠️ *Eh eh~* Belum ada channel. Gunakan *.ytnotify addchannel* dulu~ 🌸')
                if (error === 'no_apikey') return m.reply('❌ *Ehh~* API key YouTube belum diatur di config.js (APIkey.youtube)~ 🥺')
                if (error) return m.reply(`❌ *Gomen ne~* Gagal cek: ${error} 🥺`)
                if (!results || results.length === 0) return m.reply('❌ *Ehh~* Tidak ada channel yang berhasil dicek~ 🥺')

                const statusLabel = {
                    sent: '✅ Video baru terkirim',
                    already_sent: '⏭️ Tidak ada video baru',
                    no_video: '❓ Tidak ada video ditemukan',
                    no_playlist: '📛 Playlist upload tidak ditemukan',
                    error: '⚠️ Error'
                }

                let txt = `🔍 *ʜᴀꜱɪʟ ᴘᴇɴɢᴇᴄᴇᴋᴀɴ*\n\n`
                results.forEach((r, i) => {
                    const label = statusLabel[r.status] || r.status
                    const video = r.video ? `\n   🎬 ${r.video}` : ''
                    txt += `*${i + 1}.* ${r.title}${video}\n   ${label}\n`
                })

                const sentCount = results.filter(r => r.status === 'sent').length
                txt += `\n📊 Total dicek: *${results.length}* | Video baru: *${sentCount}*`

                return m.reply(txt)
            } catch (e) {
                return m.reply(`❌ *Gomen ne~* Terjadi error saat mengecek: ${e.message} 🥺`)
            }
        }

        case 'test': {
            if (state.channels.length === 0) {
                return m.reply('❌ *Ehh~* Belum ada channel terdaftar. Tambah dulu pakai .ytnotify addchannel~ 🥺')
            }

            const totalDest = state.groups.length + (state.salurans?.length || 0)
            if (totalDest === 0) {
                return m.reply('❌ *Ehh~* Belum ada grup/saluran tujuan. Tambah dulu pakai .ytnotify addgrup atau .ytnotify addsaluran~ 🥺')
            }

            // Pilih channel: berdasar nomor urut (opsional), default channel pertama
            let target = state.channels[0]
            if (rest) {
                const idx = parseInt(rest)
                if (!isNaN(idx) && idx >= 1 && idx <= state.channels.length) {
                    target = state.channels[idx - 1]
                } else {
                    return m.reply(`❌ *Ehh~* Nomor channel tidak valid. Cek nomornya dulu pakai .ytnotify list~ 🥺`)
                }
            }

            await m.reply(
                `🧪 Testing notifikasi pakai video terbaru dari *${target.title}*...\n` +
                `📤 Tujuan: ${state.groups.length} grup, ${state.salurans?.length || 0} saluran\n\n` +
                `_(Ini cuma tes tampilan, video ini tidak akan ditandai "sudah dikirim")_`
            )

            try {
                if (!target.uploadsPlaylistId) {
                    return m.reply('❌ *Ehh~* Channel ini belum punya data playlist upload. Coba hapus dan tambah ulang channel-nya~ 🥺')
                }

                const videos = await yt.getLatestVideos(target.uploadsPlaylistId, 1)
                if (videos.length === 0) {
                    return m.reply('❌ *Ehh~* Channel ini belum punya video sama sekali~ 🥺')
                }

                await yt.notifyNewVideo(sock, state.groups, state.salurans || [], target, videos[0])
                return m.reply(`✅ *Yatta~* Test terkirim! Video: *${videos[0].title}*~ ✨`)
            } catch (e) {
                return m.reply(`❌ *Gomen ne~* Gagal test: ${e.message} 🥺`)
            }
        }

        case 'reset': {
            state.channels = []
            yt.saveState(state)
            return m.reply('✅ *Yatta~* Reset! Semua channel dihapus dari daftar~ ✨')
        }

        default: {
            return m.reply(
                `📺 *ʏᴛ ɴᴏᴛɪꜰʏ*\n\n` +
                `> 🔄 Status: ${yt.isRunning ? '🟢 Aktif' : '🔴 Tidak aktif'}\n` +
                `> ⏱️ Interval: ${state.interval || 10} menit\n` +
                `> 📺 Channel: ${state.channels.length}\n` +
                `> 👥 Grup: ${state.groups.length}\n` +
                `> 📡 Saluran: ${state.salurans?.length || 0}\n\n` +
                `*Perintah:*\n` +
                `• .ytnotify addchannel <@handle/URL/ID>\n` +
                `• .ytnotify delchannel <nomor/nama>\n` +
                `• .ytnotify list\n` +
                `• .ytnotify addgrup [id]\n` +
                `• .ytnotify delgrup [id]\n` +
                `• .ytnotify addsaluran [id]\n` +
                `• .ytnotify delsaluran [id]\n` +
                `• .ytnotify interval <menit>\n` +
                `• .ytnotify start\n` +
                `• .ytnotify stop\n` +
                `• .ytnotify status\n` +
                `• .ytnotify cek\n` +
                `• .ytnotify test [nomor channel]\n` +
                `• .ytnotify reset`
            )
        }
    }
}

module.exports = { config: pluginConfig, handler }