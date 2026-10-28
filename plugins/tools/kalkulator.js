const pluginConfig = {
    name: 'calc',
    alias: ['kalkulator', 'hitung'],
    category: 'tools',
    description: 'Menghitung operasi matematika (Hoshino Ai Style)',
    usage: '.calc <perhitungan>',
    example: '.calc 2+2*5',
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

// 🔒 Safe eval
function safeEval(expr) {
    if (!/^[0-9+\-*/().%\s]+$/.test(expr)) {
        throw new Error('Ekspresi tidak valid')
    }
    return Function(`"use strict"; return (${expr})`)()
}

async function handler(m) {
    // ✅ AMBIL DARI M.TEXT LANGSUNG (PALING AMAN)
    let input = m.text || ''

    // hapus prefix + command
    input = input.replace(
        new RegExp(`^\\${m.prefix}(calc|kalkulator|hitung)\\s*`, 'i'),
        ''
    ).trim()

    // fallback kalau prefix gak kebaca
    if (!input) {
        input = m.text.split(' ').slice(1).join(' ').trim()
    }

    if (!input) {
        return m.reply(`
╭━━━〔 🌸 𝑯𝑶𝑺𝑯𝑰𝑵𝑶 𝑨𝑰 𝑪𝑨𝑳𝑪 〕━━━⬣
┃ 🧮 Masukkan perhitungan ya~
┃
┃ ✨ Contoh:
┃ \`${m.prefix}calc 10+5*2\`
┃ \`${m.prefix}calc (8+2)/5\`
╰━━━━━━━━━━━━━━━━━━⬣
        `.trim())
    }

    m.react('🧮')

    try {
        const result = safeEval(input)

        await m.reply(`
╭━━━〔 🌟 𝑯𝑶𝑺𝑯𝑰𝑵𝑶 𝑨𝑰 𝑪𝑨𝑳𝑪 🌟 〕━━━⬣
┃ 🎤 𝑪𝒂𝒍𝒄𝒖𝒍𝒂𝒕𝒊𝒏𝒈…
┃
┃ 🔢 𝑬𝒙𝒑𝒓𝒆𝒔𝒔𝒊𝒐𝒏 :
┃ ${input}
┃
┃ 🧾 𝑹𝒆𝒔𝒖𝒍𝒕 :
┃ ${result}
┃
┃ 💫 「計算もアイドル級！」
┃ 🌸 Fast & accurate ~
╰━━━〔 💖 𝑩-𝑲𝑶𝑴𝑨𝑪𝑯𝑰 💖 〕━━━⬣
        `.trim())

        m.react('✨')

    } catch (err) {
        console.error('[CALC ERROR]', err)

        m.react('❌')

        m.reply(`
╭━━━〔 ❌ 𝑬𝑹𝑹𝑶𝑹 𝑪𝑨𝑳𝑪 〕━━━⬣
┃ 💔 Perhitungan gagal...
┃
┃ ⚠️ Format salah!
┃ ✔️ Contoh: 10+5*2
╰━━━━━━━━━━━━━━━━━━⬣
        `.trim())
    }
}

module.exports = {
    config: pluginConfig,
    handler
}