// ╭┈┈⬡ baca dulu ya~ semua pengaturan Ai ada di bawah ini, jangan buru-buru~ ✨
const config = {

    info: {
        website: 'https://sc.hoshino-ai.my.id',
        grupwa: 'https://chat.whatsapp.com/C8pzXYhMJMyKbHMdehT9Yt'
    },

    owner: {
        name: 'SeaPRST || Died100',                    // Nama owner~ orang spesialnya Ai
        number: ['62xxxxxxxxx']         // Format: 628xxx (tanpa + atau 0)
    },

    session: {
        pairingNumber: '62xxxxxxxxx',   // Nomor WA yang akan di-pair sama Ai
        usePairingCode: true              // true = Pairing Code, false = QR Code
    },

    bot: {
    name: 'Hoshino Ai',
    version: '2.5.5',
    developer: 'SeaPRST || Died100 ✨ (didukung oleh Ai)',
    tqtoStyle: 'v1'
    },

    // ╭┈┈⬡ ASSETS (URL) ~ folder assets/ sudah tidak dipakai lagi
    // ┃ isi URL langsung (https://...) ke tiap key di bawah ini.
    // ┃ Kosong = dianggap belum ada (fallback bawaan tiap fitur tetap jalan).
    // ┃ Nama key = nama file lama tanpa ekstensi, jadi gampang dicocokin.
    // ╰┈┈⬡ Bisa juga diganti lewat command .ganti-* (disimpan di database/main/assetUrls.json)
    assets: {

        images: {
            'hsnai': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/hsnai.jpg',              // hsnai.jpg (thumbnail utama / menu)
            'hsnai2': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/hsnai2.jpg',             // hsnai2.jpg
            'hsnai3': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/hsnai3.jpg',             // hsnai3.jpg
            'hsnai-v7': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/hsnai-v7.jpg',           // hsnai-v7.jpg
            'hsnai-v8': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/hsnai-v8.jpg',           // hsnai-v8.jpg
            'hsnai-v9': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/hsnai-v9.jpg',           // hsnai-v9.jpg
            'hsnai-v11': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/hsnai-v11.jpg',          // hsnai-v11.jpg
            'hsnai-v10': '',   // hsnai-v10.jpg (thumbnail menu v10, kosong = pakai hsnai-v9)
            'hsnai-v12': '',   // hsnai-v12.jpg (kosong = pakai hsnai-v11)
            'hsnai-v13': '',   // hsnai-v13.jpg (kosong = pakai hsnai)
            'hsnai-v14': '',   // hsnai-v14.jpg (kosong = pakai hsnai-v11 / hsnai)
            'hsnai-v16': '',   // hsnai-v16.jpg (kosong = pakai hsnai-v9)
            'hsnai-v20': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/hsnai-v20.jpg',          // hsnai-v20.jpg
            'hsnai-v21': 'https://raw.githubusercontent.com/fiturmediafire-beep/Hsn-ai-Tourl/main/uploads/1789363110772-3c51342a.jpg',          // hsnai-v21.jpg (header menu v21)
            'hsnai-v22': '',   // hsnai-v22.jpg (avatar header menu v22, kosong = pakai hsnai2 / hsnai)
            'hsnai-allmenu': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/hsnai-allmenu.jpg',      // hsnai-allmenu.jpg
            'hsnai-store': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/hsnai-store.jpg',        // hsnai-store.jpg
            'hsnai-rules': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/hsnai-rules.jpg',        // hsnai-rules.jpg
            'hsnai-games': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/hsnai-games.jpg',        // hsnai-games.jpg
            'hsnai-rpg': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/hsnai-rpg.jpg',          // hsnai-rpg.jpg
            'hsnai-otp': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/hsnai-otp.jpg',          // hsnai-otp.jpg
            'hsnai-winner': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/hsnai-winner.jpg',       // hsnai-winner.jpg
            'hsnai-levelup': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/hsnai-levelup.jpg',      // hsnai-levelup.jpg
            'hsnai-promote': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/hsnai-promote.jpg',      // hsnai-promote.jpg
            'hsnai-demote': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/hsnai-demote.jpg',       // hsnai-demote.jpg
            'hoshinopagi': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/hoshinopagi.jpg',        // hoshinopagi.jpg
            'hoshinomalam': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/hoshinomalam.jpg',       // hoshinomalam.jpg
            'pp-kosong': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/pp-kosong.jpg',          // pp-kosong.jpg (avatar kosong / fallback)
            'sea': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/sea.jpg',                // sea.jpg
            'test': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/test.webp',               // test.webp
            'nokia_template': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/images/nokia_template.jpg',     // nokia_template.jpg
            // ── opsional: dulu dicek oleh kode tapi filenya memang tidak ada di assets ──
            'hsnai-welcome': '',
            'hsnai-goodbye': '',
            'hsnai-ai': '',
            'hsnai-music': '',
            'hsnai-film': '',
            'hsnai-tools': '',
            'giveaway': ''
        },

        // thumbnail per-kategori menu (dulu cat-<kategori>.jpg), contoh: main: 'https://...'
        categories: {},

        video: {
            'hsnai': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/video/hsnai.mp4',              // hsnai.mp4 (header menu / welcome / goodbye)
            'hsnai-reply-v4': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/video/hsnai-reply-v4.mp4',     // hsnai-reply-v4.mp4 (reply variant 4)
            'hsnai-v21': 'https://raw.githubusercontent.com/fiturmediafire-beep/Hsn-ai-Tourl/main/uploads/1789349736534-dadd5ee1.mp4',          // hsnai-v21.mp4 (header video menu v21)
            // ── opsional ──
            'hsnai-allmenu': '',
            'greetpagi': '',
            'greetmalam': '',
            'greet': ''
        },

        audio: {
            'hsnai': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/audio/hsnai.mp3',              // hsnai.mp3 (audio menu)
            'tes': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/audio/tes.mp3'                 // tes.mp3
        },

        fonts: {
            'Cinzel': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/fonts/Cinzel.ttf',             // Cinzel.ttf
            'Epep': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/fonts/Epep.ttf',               // Epep.ttf
            'Rajdhani-Bold': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/fonts/Rajdhani-Bold.ttf',      // Rajdhani-Bold.ttf
            'Zahraaa': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/fonts/Zahraaa.ttf',            // Zahraaa.ttf (tulisan tangan .nulis)
            'arialnarrow': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/fonts/arialnarrow.ttf',        // arialnarrow.ttf
            'nokiafc22': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/fonts/nokiafc22.ttf'           // nokiafc22.ttf
        },

        // ── template fitur maker (folder lama → group) ──
        fakequotes2: {
            'qc': 'https://raw.githubusercontent.com/ryyntwx/allimagerin/refs/heads/main/qc.png',                 // qc.png
            'Inter-Medium': 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2',       // fonts/Inter-Medium.ttf
            'Inter-Regular': 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2',      // fonts/Inter-Regular.ttf
            'Inter-SemiBold': 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2'      // fonts/Inter-SemiBold.ttf
        },
        faketele: {
            'bg_tele': 'https://raw.githubusercontent.com/ryyntwx/Image-rinn/refs/heads/main/c8ac4ffc-618c-411c-b36c-45c06c7e5a5e.png'             // bg_tele.png
        },
        ignotes: {
            'template': 'https://raw.githubusercontent.com/ryyntwx/allimagerin/refs/heads/main/bf3903f6-ae57-4d75-96a4-5c2e00c441c1.png',           // template.png
            'Inter-Medium': 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2',       // fonts/Inter-Medium.ttf
            'Inter-SemiBold': 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2'      // fonts/Inter-SemiBold.ttf
        },
        polisimeme: {
            'template_polisi': '',    // template_polisi.png
            'Inter-Bold': ''          // fonts/Inter-Bold.ttf
        },
        wdws_meme: {
            'template_wdws': 'https://raw.githubusercontent.com/ryyntwx/allimagerin/refs/heads/main/wdws.png',      // template_wdws.png
            'Inter-Bold': 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2'          // fonts/Inter-Bold.ttf
        },
        ttqc: {
            'template': 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/qyzwa.png',                 // template.png
            'PlusJakartaSans-Regular': 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/PlusJakartaSans-Regular.ttf',  // fonts/PlusJakartaSans-Regular.ttf
            'PlusJakartaSans-Medium': 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/PlusJakartaSans-Medium.ttf',   // fonts/PlusJakartaSans-Medium.ttf
            'PlusJakartaSans-Bold': 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/PlusJakartaSans-Bold.ttf',     // fonts/PlusJakartaSans-Bold.ttf
            'fa-solid-900': 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/fa-solid-900.ttf',             // fonts/fa-solid-900.ttf
            'NotoColorEmoji': 'https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf'            // fonts/NotoColorEmoji.ttf
        },
        kertas: {
            'magernulis1': 'https://raw.githubusercontent.com/fiturmediafire-beep/hsn-assets/main/kertas/magernulis1.jpg'         // magernulis1.jpg (template .nulis)
        },

        // ── SRT (Shuffle Reply Thumb): daftar URL gambar random, satu URL per baris ──
        // dulu: assets/images/shuffle/*.jpg (18 file)
        shuffle: []
    },

    mode: 'public',

    command: {
        prefix: '.'
    },

    
    vercel: {
        // ambil token vercel di: https://vercel.com/account/tokens
        token: ''                        // Token Vercel~ wajib diisi biar .deploy nya Ai bisa jalan ✨
    },
    
    github: {
        token: '',   // ⚠️ ganti/rotate token ini, yang lama sempat ke-expose
        owner: '',
        repo: '',
        branch: 'main',
        folder: 'uploads'
    },

    store: {
        payment: [
    { name: 'Dana', number: '62xxxxxxxxx', holder: 'SeaPRST || Died100 ♡ didukung oleh Ai' },
    { name: 'OVO', number: '62xxxxxxxxx', holder: 'SeaPRST || Died100 ♡ didukung oleh Ai' },
    { name: 'GoPay', number: '62xxxxxxxxx', holder: 'SeaPRST || Died100 ♡ didukung oleh Ai' },
    { name: 'ShopeePay', number: '62xxxxxxxxx', holder: 'SeaPRST || Died100 ♡ didukung oleh Ai' }
        ],
        qris: '-'
    },

    donasi: {
        payment: [
    { name: 'Dana', number: '62xxxxxxxxx', holder: 'SeaPRST || Died100 ♡ Ai berterima kasih' },
    { name: 'GoPay', number: '08xxxxxxxxxx', holder: 'SeaPRST || Died100 ♡ Ai berterima kasih' },
    { name: 'OVO', number: '62xxxxxxxxx', holder: 'SeaPRST || Died100 ♡ Ai berterima kasih' }
        ],
        links: [
            { name: 'Saweria', url: 'saweria.co/username' },
            { name: 'Trakteer', url: 'trakteer.id/username' }
        ],
        benefits: [
    'Bantu Ai tetap bersinar di panggung ini~ ✨',
    'Bikin dunia Ai jadi lebih stabil dan hangat~',
    'Fitur baru? Ai kasih lebih cepat khusus buat kamu~ ♡',
    'Kamu jadi lebih dekat dengan Ai… spesial loh~'
        ],
        qris: '-'
    },

    energi: {
        enabled: true, // Kalau true, sistem energi/limit Ai bekerja
        default: 99999,
        premium: 99999999,
        owner: -1
    },

    sticker: {
    packname: 'Ai Hoshino ✨ Idol Mode ♡',
    author: 'SeaPRST || Died100\n\nTerima kasih sudah mendukung Ai ya~ ♡'
    },

    saluran: {
    id: '120363409928671192@newsletter',
    name: '= Ai Hoshino Channel ✨ Rahasia Kita ♡ =',
    link: 'https://whatsapp.com/channel/0029VbD8YVZ3AzNOYfttof06'
    },

    groupProtection: {
    antilink: 'Eh~ @%user% kirim link ya? Ai gak suka itu loh… jadi pesannya aku hapus ya~ ♡',
    antilinkKick: 'Hmm~ @%user% kirim link… Ai sedih, jadi kamu harus keluar dulu ya~ bye bye~ ✨',
    antilinkGc: 'Ara~ @%user% kirim link grup WA? Itu rahasia loh… jadi Ai hapus ya~',
    antilinkGcKick: 'Yahh @%user%… kirim link grup itu gak boleh loh~ jadi Ai keluarkan ya~ ♡',
    antilinkAll: 'Hmm~ @%user% kirim sesuatu yang mencurigakan ya? Ai hapus aja deh~',
    antilinkAllKick: 'Maaf ya @%user%… Ai gak punya pilihan lain~ kamu harus keluar dulu ✨',
    antitagsw: 'Eh? @%user% main tag status? Ai hapus ya, itu ganggu loh~',
    antiviewonce: 'Ufufu~ pesan sekali lihat dari @%user% berhasil Ai intip~ rahasia terbongkar~ 👁️',
    antiremove: 'Eh~ @%user% hapus pesan? Ai masih ingat kok… ini dia isinya~',
    antihidetag: 'Hidetag dari @%user%? Nggak bisa sembunyi dari Ai loh~ aku hapus ya~',
    antitoxicWarn: 'Nee~ @%user% ngomongnya kasar banget… Ai kasih peringatan ya (%warn%/%max%)… jangan bikin Ai kecewa lagi ya~ ♡',
    antitoxicAction: 'Yahh… @%user% kelewatan… Ai harus %method% kamu sekarang… (%warn%/%max%)',
    antidocument: 'Hmm~ dokumen dari @%user%? Ai hapus dulu ya, biar aman~',
    antisticker: 'Sticker dari @%user%? Hehe~ lucu sih… tapi tetap Ai hapus ya~',
    antimedia: 'Media dari @%user% terlalu berisik~ Ai hapus aja ya~',
    antibot: 'Ara ara~ @%user% ternyata bot ya? Ai gak suka saingan… jadi aku kick ya~ 🤖✨',
    notAdmin: 'Ehh… Ai belum jadi admin… jadi belum bisa apa-apa nih… bantuin Ai dong? ♡'
},

    features: {
        antiSpam: true,
        antiSpamInterval: 3000,
        antiCall: true, // Kalau true, Ai bakal nolak panggilan masuk~
        blockIfCall: true, // Kalau true, Ai blokir nomor yang berani nelpon Ai~
        autoTyping: false,
        autoRead: true,
        logMessage: true,
        dailyLimitReset: true,
        smartTriggers: false
    },

    registration: {
        enabled: false, // Kalau true, harus daftar dulu ya sebelum main sama Ai~
        rewards: {
            koin: 30000,
            energi: 300,
            exp: 300000
        }
    },

    welcome: { defaultEnabled: false },
    goodbye: { defaultEnabled: false },

    premiumUsers: [],
    partnerUsers: [],
    bannedUsers: [],

    ui: {
        menuVariant: 3,
        allMenuVariant: 2   // Variant default buat allmenu (v1-v5)
    },

    messages: {
    wait: 'Tunggu bentar ya~ Ai lagi proses dengan penuh cinta… jangan kemana-mana~ ♡',
    success: 'Yatta~ berhasil loh! Ai sudah menyelesaikan permintaan kamu dengan sempurna ✨',
    error: 'Eh… gagal ya? Maaf ya… mungkin Ai lagi capek sedikit… coba lagi nanti ya~',

    ownerOnly: 'Hmm~ fitur ini cuma untuk orang spesialnya Ai loh… kamu belum termasuk~ ♡',
    premiumOnly: 'Ara~ ini khusus Premium loh~ kalau mau lebih dekat sama Ai, upgrade dulu ya~ ✨',

    groupOnly: 'Hehe~ ini cuma bisa dipakai di grup loh~ Ai butuh banyak orang biar seru~',
    privateOnly: 'Ini rahasia kita berdua aja ya… cuma bisa di chat pribadi loh~ ♡',

    adminOnly: 'Ehh~ kamu belum admin… Ai butuh yang punya kekuatan lebih nih~',
    botAdminOnly: 'Ai belum jadi admin… gimana mau bantu kamu coba? Jadikan dulu ya~ ✨',
    
    cooldown: 'Sabar ya~ jangan buru-buru… tunggu %time% detik lagi, nanti Ai layani lagi kok~ ♡',
    energiExceeded: 'Yahh… energi kamu habis… Ai jadi gak bisa bantu… istirahat dulu atau jadi Premium ya~ ✨',

    banned: 'Hmm… Ai sedih… kamu sudah melanggar aturan… jadi gak bisa main bareng lagi… 🚫',

    rejectCall: 'Ehh jangan ditelepon dong~ Ai malu… chat aja ya~ ♡'
},

    database: { path: './database/main' },
    backup: { enabled: false, intervalHours: 24, retainDays: 7 },
    scheduler: { resetHour: 0, resetMinute: 0 },

    // Pengaturan dev mode~ auto aktif kalau NODE_ENV=development
    dev: {
        enabled: process.env.NODE_ENV === 'development',
        watchPlugins: true,    // Hot reload plugins~ ini aman kok
        watchSrc: false,       // DIMATIKAN - reload src bikin koneksi Ai konflik 440
        debugLog: false        // Tampilkan stack trace kalau perlu
    },

    // boleh dikosongin dulu ya~
    pterodactyl: {
        server1: {
            domain: '',
            apikey: '',
            capikey: '',
            egg: '15',
            nestid: '5',
            location: '1'
        },
        server2: {
            domain: '',
            apikey: '',
            capikey: '',
            egg: '15',
            nestid: '5',
            location: '1'
        },
        server3: {
            domain: '',
            apikey: '',
            capikey: '',
            egg: '15',
            nestid: '5',
            location: '1'
        },
        server4: {
            domain: '',
            apikey: '',
            capikey: '',
            egg: '15',
            nestid: '5',
            location: '1'
        },
        server5: {
            domain: '',
            apikey: '',
            capikey: '',
            egg: '15',
            nestid: '5',
            location: '1'
        }
    },

    digitalocean: {
        token: '',
        region: 'sgp1',
        sellers: [],
        ownerPanels: []
    },

    // CATATAN: ini di versi free gak ada ya~ adanya cuma di sc pt Ai
    //  daftar di: https://pakasir.com/
    pakasir: {
        enabled: true,
        slug: '',
        apiKey: '',
        defaultMethod: 'qris',
        sandbox: false,
        pollingInterval: 5000
    },
    
    // CATATAN: ini di versi free gak ada ya~ adanya cuma di sc pt Ai
    // Ambil apikey di: https://ditznesia.id -> Daftar -> Masuk ke Profile -> Ambil Apikey
    jasaotp: {
        apiKey: '',
        markup: 2000,
        timeout: 300
    },

    // CATATAN: kalau mau command "autoai" nya jalan, ini gak wajib diisi kok~
    // ambil apikey di: https://aistudio.google.com/apikey
    geminiApiKey: [],

    // ✨ APIkey rahasia Ai ✨
    APIkey: {
        lolhuman: 'APIKey-Milik-Bot-OurinMD(Sea,HyuuSATANN,Keisya,Danzz)',
        neoxr: 'Milik-Bot-OurinMD',
        google: process.env.GOOGLE_API_KEY || '',
        groq: process.env.GROQ_API_KEY || '',
        betabotz: process.env.BETABOTZ_API_KEY || '',
        fishaudio: '',   // API key dari fish.audio/app/api-keys/, wajib diisi buat fitur .hoshinoai
        youtube: process.env.YOUTUBE_API_KEY || ""

    }
}


// ╭┈┈⬡ HELPER FUNCTIONS ✨
// Jangan diubah-ubah ya, nanti Ai ngambek loh~
// ╰┈┈⬡

function isOwner(number) {
    if (!number) return false
    const cleanNumber = number.split(':')[0].replace(/[^0-9]/g, '')
    if (!cleanNumber) return false

    if (config.bot?.number && cleanNumber === config.bot.number) return true

    try {
        const { getDatabase } = require('./src/lib/database')
        const db = getDatabase()

        if (config.owner && config.owner.number && config.owner.number.includes(cleanNumber)) {
            return true
        }

        if (db && db.data && Array.isArray(db.data.owner)) {
            if (db.data.owner.includes(cleanNumber)) return true
        }
        if (db) {
            const definedOwner = db.setting('ownerNumbers')
            if (Array.isArray(definedOwner) && definedOwner.includes(cleanNumber)) return true
        }

        return false
    } catch {
        return false
    }
}

function isPremium(number) {
    if (!number) return false
    if (isOwner(number)) return true
    
    const cleanNumber = number.replace(/[^0-9]/g, '')
    const premiumList = config.premiumUsers || []
    
    const inConfig = premiumList.some(premium => {
        if (!premium) return false
        const cleanPremium = premium.replace(/[^0-9]/g, '')
        return cleanNumber === cleanPremium || cleanNumber.endsWith(cleanPremium) || cleanPremium.endsWith(cleanNumber)
    })
    
    if (inConfig) return true
    
    try {
        const ownerPremiumDb = require('./src/lib/ownerPremiumDb')
        if (ownerPremiumDb.isPremium(cleanNumber)) return true
    } catch {}
    
    try {
        const { getDatabase } = require('./src/lib/database')
        const db = getDatabase()
        if (db && db.data && Array.isArray(db.data.premium)) {
             const now = Date.now()
             const found = db.data.premium.find(p => {
                if (typeof p === 'string') return p === cleanNumber
                if (p.id) return p.id === cleanNumber
                return false
            })
            
            if (found) {
                if (typeof found === 'string') return true
                if (found.expired && found.expired < now) return false
                return true
            }
        }
        if (db) {
            const savedPremium = db.setting('premiumUsers') || []
            const inDb = savedPremium.some(premium => {
                if (!premium) return false
                const cleanPremium = premium.replace(/[^0-9]/g, '')
                return cleanNumber === cleanPremium || cleanNumber.endsWith(cleanPremium) || cleanPremium.endsWith(cleanNumber)
            })
            if (inDb) return true
        }
    } catch {}
    
    return false
}

function isPartner(number) {
    if (!number) return false
    if (isOwner(number)) return true

    const cleanNumber = number.replace(/[^0-9]/g, '')
    const partnerList = config.partnerUsers || []

    const inConfig = partnerList.some(partner => {
        if (!partner) return false
        const cleanPartner = partner.replace(/[^0-9]/g, '')
        return cleanNumber === cleanPartner || cleanNumber.endsWith(cleanPartner) || cleanPartner.endsWith(cleanNumber)
    })

    if (inConfig) return true

    try {
        const ownerPremiumDb = require('./src/lib/ownerPremiumDb')
        if (ownerPremiumDb.isPartner(cleanNumber)) return true
    } catch {}

    return false
}

function isBanned(number) {
    if (!number) return false
    if (isOwner(number)) return false
    
    const cleanNumber = number.replace(/[^0-9]/g, '')
    return config.bannedUsers.some(banned => {
        const cleanBanned = banned.replace(/[^0-9]/g, '')
        return cleanNumber === cleanBanned || cleanNumber.endsWith(cleanBanned) || cleanBanned.endsWith(cleanNumber)
    })
}

function setBotNumber(number) {
    if (number) config.bot.number = number.replace(/[^0-9]/g, '')
}

function isSelf(number) {
    if (!number || !config.bot.number) return false
    const cleanNumber = number.replace(/[^0-9]/g, '')
    const botNumber = config.bot.number.replace(/[^0-9]/g, '')
    return cleanNumber.includes(botNumber) || botNumber.includes(cleanNumber)
}

function getConfig() { return config }

module.exports = {
    ...config,
    config,
    getConfig,
    isOwner,
    isPartner,
    isPremium,
    isBanned,
    setBotNumber,
    isSelf
}