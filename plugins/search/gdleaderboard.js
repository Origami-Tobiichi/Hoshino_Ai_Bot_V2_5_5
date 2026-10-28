/**
‎✧ Name    : gdstars (Hoshino Ai Idol ID ver.)
‎✧ Category: search
**/

const axios = require("axios")
const config = require("../../config")

const pluginConfig = {
    name: "gdleaderboard",
    alias: [
        "gdlb",
        "gdtop",
        "gdstars",
        "gddemons",
        "gdmoons",
        "gddiamonds",
        "gdcreators",
        "gdcoins"
    ],
    category: "search",
    description: "💖 Leaderboard Geometry Dash style Hoshino Ai (ID Version)",
    usage: ".gdleaderboard [kategori] [jumlah]",
    example: ".gdleaderboard stars 10",
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const args = (m.text || "").trim().split(/\s+/)
    const category = (args[0] || "stars").toLowerCase()

    // 💖 MENU BANTUAN
    if (["help", "format", "info"].includes(category)) {
        return m.reply(
`💖✨ ɢᴇᴏᴍᴇᴛʀʏ ᴅᴀsʜ • ʜᴏsʜɪɴᴏ ᴀɪ ᴇᴅɪsɪ ɪɴᴅᴏ ✨💖

🌸 *“Aku akan bersinar seperti bintang paling terang~!”* 🌸

━━━━━━━━━━━━━━
📖 FORMAT:
.gdleaderboard [kategori] [jumlah]

📂 KATEGORI:
⭐ stars
🌙 moons
💎 diamonds
😈 demons
🪙 usercoins
🎨 creators

━━━━━━━━━━━━━━
💡 CONTOH:
• .gdleaderboard stars
• .gdleaderboard stars 10
• .gdleaderboard demons 5

━━━━━━━━━━━━━━
⚙️ LIMIT:
Minimal 3 • Maksimal 20 player

💖 Hoshino Ai selalu melihat kamu~ ✨`
        )
    }

    let limit = Number(args[1])
    if (isNaN(limit)) limit = 5
    if (limit < 3) limit = 3
    if (limit > 20) limit = 20

    await m.react("💫")

    try {
        const endpoints = {
            stars: "top-stars.json",
            moons: "top-moons.json",
            diamonds: "top-diamonds.json",
            demons: "top-demons.json",
            usercoins: "top-user-coins.json",
            creators: "top-creators.json",
            gdcoins: "top-user-coins.json"
        }

        const file = endpoints[category]

        if (!file) {
            return m.reply(
`💔 *YAHH~ KATEGORI TIDAK DIKENAL*

🌸 Yang tersedia:
⭐ stars | 🌙 moons | 💎 diamonds
😈 demons | 🪙 usercoins | 🎨 creators

💫 Coba lagi ya~`
            )
        }

        const { data } = await axios.get(
            `https://www.geometrydash.com/data/${file}`,
            { timeout: 30000 }
        )

        if (!Array.isArray(data)) {
            throw new Error("Data dari server tidak valid")
        }

        const titleMap = {
            stars: "⭐ Ranking Stars",
            moons: "🌙 Ranking Moons",
            diamonds: "💎 Ranking Diamonds",
            demons: "😈 Ranking Demons",
            usercoins: "🪙 Ranking User Coins",
            creators: "🎨 Ranking Creator Points"
        }

        const title = titleMap[category] || "Leaderboard"

        const format = v => Number(v ?? 0).toLocaleString()

        const rows = [
            ["🏅 Rank", "👤 Player", "⭐", "🌙", "💎", "😈", "🪙", "🎨"]
        ]

        for (let i = 0; i < Math.min(limit, data.length); i++) {
            const p = data[i]

            rows.push([
                `#${p.globalRank || i + 1}`,
                `💖 ${p.userName || "Tidak Diketahui"}`,
                format(p.stars),
                format(p.moons),
                format(p.diamonds),
                format(p.demons),
                format(p.userCoins),
                format(p.creatorScore)
            ])
        }

        const top = data[0]

        await m.react("💖")

        return await sock.sendTablehsn(
            m.chat,
            `💖✨ GEOMETRY DASH • LEADERBOARD HOSHINO AI ✨💖`,
            rows,
            m,
            {
                header:
`💖🌸 LEADERBOARD GLOBAL GEOMETRY DASH 🌸💖

💫 “Aku akan terus bersinar sampai semua orang melihatku~” 💫

━━━━━━━━━━━━━━
📊 Kategori : ${title}
🌍 Status   : Ranking Global Resmi
📦 Total    : ${data.length.toLocaleString()} pemain
📋 Tampil   : Top ${limit}

✨ Data langsung dari server Geometry Dash ✨
━━━━━━━━━━━━━━`,

                footer:
`👑 💖 PEMAIN TERATAS 💖 👑

🌸 Nama : ${top?.userName || "Tidak diketahui"}
⭐ Nilai: ${Number(top?.stars ?? 0).toLocaleString()}

━━━━━━━━━━━━━━
💫 “Bintang tidak pernah berhenti bersinar~” 💫
🎀 Hoshino Ai Bot`
            }
        )

    } catch (error) {
        console.error(error)

        await m.react("💔")

        return m.reply(
`💔✨ TERJADI KESALAHAN ✨💔

📛 Error: ${error.message}

🌸 Kemungkinan:
• Server lagi sibuk
• Internet lambat
• API Geometry Dash error

💫 Coba lagi nanti ya~`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}