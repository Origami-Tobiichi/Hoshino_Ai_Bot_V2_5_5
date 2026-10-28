const axios = require('axios');

const pluginConfig = {
    name: ['gptprompt'],
    alias: ['gpts', 'aichat'],
    category: 'ai',
    description: 'Chat dengan AI menggunakan persona custom (Style Ai Hoshino ✨)',
    usage: '.gptprompt prompt | teks',
    example: '.gptprompt Seolah kamu Ai Hoshino | Halo~',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
};

async function handler(m, context) {
    const { sock } = context;
    const prefix = m.prefix || '.';
    const command = m.command || 'gptprompt';

    let text = m.text || "";

    // 🌸 Validasi awal
    if (!text) {
        return m.reply(
`🌸 *Ai Hoshino says~* ✨

"Hmm? Kamu manggil aku tapi nggak kasih pesan? Nakal ya~"

📌 *Contoh penggunaan:*
\`${prefix + command} Seolah kamu Ai Hoshino | Halo~\``
        );
    }

    // 🌸 Split prompt & isi
    let [prompt, isi] = text.split('|').map(v => v.trim());

    if (!prompt || !isi) {
        return m.reply(
`🌸 *Eh eh~ tunggu dulu!* 💫

Formatnya masih kurang lengkap loh!

📌 *Gunakan seperti ini:*
\`${prefix + command} prompt | pesan\`

✨ *Contoh:*
\`${prefix + command} Jadi idol imut | Halo kamu lagi apa?\``
        );
    }

    try {
        m.react('🌸');

        // 🌐 API baru
        let api = `https://api-faa.my.id/faa/gpt-promt?prompt=${encodeURIComponent(prompt)}&text=${encodeURIComponent(isi)}`;
        const { data } = await axios.get(api);

        if (!data.status) {
            throw new Error('AI lagi capek... coba lagi nanti ya 😢');
        }

        const result = data.result.trim();

        // 🌸 Template pesan Ai Hoshino
        const finalText =
`╭━━━『 🌸 *Ai Hoshino Chat* 🌸 』━━━
│
│ 💬 *Kamu bilang:*
│ ${isi}
│
│ ✨ *Ai menjawab:*
│ ${result}
│
╰━━━━━━━━━━━━━━━━━━━

💖 *"Aku akan selalu bersinar hanya untukmu~"* ✨`;

        await sock.sendMessage(m.chat, {
            text: finalText,
            contextInfo: {
            }
        }, { quoted: m });

        m.react('✨');

    } catch (e) {
        console.error(e);
        m.react('❌');

        return m.reply(
`🌸 *Gomen ne...* 😭💔

Sepertinya Ai lagi kehilangan sinarnya...

📌 *Error:*
\`${e.message}\`

💡 Coba lagi ya nanti~ aku pasti kembali bersinar ✨`
        );
    }
}

module.exports = {
    config: pluginConfig,
    handler
};