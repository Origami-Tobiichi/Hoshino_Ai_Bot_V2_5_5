const pluginConfig = {
name: 'q',
alias: ['quoted'],
category: 'tools',
description: 'Ambil JSON message dari pesan yang direply',
usage: '.q (reply pesan)',
isOwner: false,
cooldown: 3,
isEnabled: true
}

async function handler(m) {
if (!m.quoted) {
return m.reply('❌ Reply pesan yang ingin di-inspect')
}

try {
    const json = JSON.stringify(m.quoted, null, 2)

    if (!json) {
        return m.reply('❌ Data quoted message kosong.')
    }

    const maxLength = 10000
    const output = json.length > maxLength
        ? json.slice(0, maxLength) + '\n\n... [JSON dipotong]'
        : json

    await m.reply(output)
} catch (err) {
    await m.reply(
        `❌ Gagal mengambil quoted message\n\n${err.message}`
    )
}

}

module.exports = {
config: pluginConfig,
handler
}