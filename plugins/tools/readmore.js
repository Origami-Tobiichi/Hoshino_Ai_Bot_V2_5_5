const pluginConfig = {
    name: 'readmore',
    alias: ['selengkapnya', 'spoiler'],
    category: 'tools',
    description: 'Membuat teks baca selengkapnya (spoiler) bertingkat',
    usage: '.readmore <teks1>|<teks2>|<teks3>|...',
    example: '.readmore Hai|Ini rahasia 1|Ini rahasia 2',
    isGroup: false,
    isBotAdmin: false,
    isAdmin: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
};

async function handler(m, { sock }) {
    const text = m.text;

    if (!text) {
        return m.reply(`⚠️ Masukan text!\nContoh: \`${m.prefix}${m.command} Halo|Rahasia 1|Rahasia 2\``);
    }

    // TIDAK di-trim, biar newline/spasi setelah '|' ikut kebawa persis
    const parts = text.split('|');

    const readmore = String.fromCharCode(8206).repeat(4001);

    const result = parts.join(readmore);

    m.reply(result);
}

module.exports = {
    config: pluginConfig,
    handler
};