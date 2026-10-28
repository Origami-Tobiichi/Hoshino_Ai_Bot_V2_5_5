const {
    Button,
    ButtonV2,
    Carousel,
    AIRich,
    Toolkit,
    VERSION
} = require('hsnai')

const pluginConfig = {
    name: 'testall',
    alias: ['testbuilder'],
    category: 'testing',
    description: '🧪 Test semua fitur MessageBuilder.js',
    usage: '.testall <mode>',
    cooldown: 3,
    isEnabled: true
}

async function handler(m, ctx) {
    const { sock } = ctx

    const raw = ctx.args ?? ctx.text ?? ctx.query ?? m.text ?? ''
    const argsArr = Array.isArray(raw)
        ? raw
        : String(raw).trim().split(/\s+/).filter(Boolean)

    const mode = (argsArr[0] || 'menu').toLowerCase()
    const jid = m.chat

    try {
        switch (mode) {

            // ===== MENU =====
            case 'menu': {
                return m.reply(
                    `╭━〔 🧪 𝗧𝗘𝗦𝗧 𝗕𝗨𝗜𝗟𝗗𝗘𝗥 𝘃${VERSION} 〕━⬣\n` +
                    `┃\n` +
                    `┃ 📌 *BUTTON (v1 — interactiveMessage)*\n` +
                    `┃ ✦ .testall bReply\n` +
                    `┃ ✦ .testall bUrl\n` +
                    `┃ ✦ .testall bCopy\n` +
                    `┃ ✦ .testall bCall\n` +
                    `┃ ✦ .testall bSelection\n` +
                    `┃ ✦ .testall bMixed\n` +
                    `┃\n` +
                    `┃ 📌 *BUTTONV2 (buttonsMessage lama)*\n` +
                    `┃ ✦ .testall bv2\n` +
                    `┃ ✦ .testall bv2img\n` +
                    `┃\n` +
                    `┃ 📌 *CAROUSEL*\n` +
                    `┃ ✦ .testall carousel\n` +
                    `┃\n` +
                    `┃ 📌 *AIRICH*\n` +
                    `┃ ✦ .testall aiText\n` +
                    `┃ ✦ .testall aiTable\n` +
                    `┃ ✦ .testall aiCode\n` +
                    `┃ ✦ .testall aiTip\n` +
                    `┃ ✦ .testall aiSuggest\n` +
                    `┃ ✦ .testall aiFoa\n` +
                    `┃ ✦ .testall aiMetadata\n` +
                    `┃ ✦ .testall aiFull\n` +
                    `┃ ✦ .testall aiDynamic\n` +
                    `┃ ✦ .testall aiImage\n` +
                    `┃ ✦ .testall aiWidget\n` +
                    `┃\n` +
                    `┃ 📌 *TOOLKIT*\n` +
                    `┃ ✦ .testall toolkit\n` +
                    `┃\n` +
                    `╰━⬣`
                )
            }

            // ===== BUTTON V1: REPLY =====
            case 'breply': {
                const btn = new Button(sock)
                    .setBody('🧪 Test Button — *Quick Reply*')
                    .setFooter('© TestBuilder')
                    .addReply('Tombol A', 'btn_a')
                    .addReply('Tombol B', 'btn_b')

                await btn.send(jid, { quoted: m.raw || m })
                break
            }

            // ===== BUTTON V1: URL =====
            case 'burl': {
                const btn = new Button(sock)
                    .setBody('🧪 Test Button — *CTA URL*')
                    .setFooter('© TestBuilder')
                    .addUrl('Buka Google', 'https://google.com')
                    .addUrl('Buka GitHub', 'https://github.com')

                await btn.send(jid, { quoted: m.raw || m })
                break
            }

            // ===== BUTTON V1: COPY =====
            case 'bcopy': {
                const btn = new Button(sock)
                    .setBody('🧪 Test Button — *CTA Copy*')
                    .setFooter('© TestBuilder')
                    .addCopy('Copy Kode', 'RAHASIA123')
                    .addCopy('Copy Link', 'https://example.com')

                await btn.send(jid, { quoted: m.raw || m })
                break
            }

            // ===== BUTTON V1: CALL =====
            case 'bcall': {
                const btn = new Button(sock)
                    .setBody('🧪 Test Button — *CTA Call*')
                    .setFooter('© TestBuilder')
                    .addCall('Telepon CS', '+6281234567890')

                await btn.send(jid, { quoted: m.raw || m })
                break
            }

            // ===== BUTTON V1: SELECTION (dropdown) =====
            case 'bselection': {
                const btn = new Button(sock)
                    .setBody('🧪 Test Button — *Single Select*')
                    .setFooter('© TestBuilder')
                    .addSelection('Pilih Menu')
                    .makeSection('Makanan')
                    .makeRow('🍕 Pizza', 'Pizza Enak', 'Topping lengkap', 'menu_pizza')
                    .makeRow('🍔 Burger', 'Burger Jumbo', 'Daging tebal', 'menu_burger')
                    .makeSection('Minuman')
                    .makeRow('🥤 Cola', 'Coca Cola', 'Dingin', 'menu_cola')
                    .makeRow('☕ Kopi', 'Kopi Susu', 'Panas', 'menu_kopi')

                await btn.send(jid, { quoted: m.raw || m })
                break
            }

            // ===== BUTTON V1: MIXED =====
            case 'bmixed': {
                const btn = new Button(sock)
                    .setBody('🧪 Test Button — *Mixed Buttons*')
                    .setFooter('© TestBuilder')
                    .addReply('Balas', 'reply_1')
                    .addUrl('Google', 'https://google.com')
                    .addCopy('Copy', 'KODE123')
                    .addCall('Call', '+6281234567890')

                await btn.send(jid, { quoted: m.raw || m })
                break
            }

            // ===== BUTTONV2 =====
            case 'bv2': {
                const btn = new ButtonV2(sock)
                    .setBody('🧪 Test ButtonV2 — 3 tombol klasik')
                    .setFooter('© TestBuilder')
                    .addButton('Tombol 1', 'btnv2_1')
                    .addButton('Tombol 2', 'btnv2_2')
                    .addButton('Tombol 3', 'btnv2_3')

                await btn.send(jid, { quoted: m.raw || m })
                break
            }

            // ===== BUTTONV2 + THUMBNAIL =====
            case 'bv2img': {
                const btn = new ButtonV2(sock)
                    .setBody('🧪 Test ButtonV2 + Thumbnail')
                    .setFooter('© TestBuilder')
                    .setThumbnail('https://picsum.photos/300')
                    .addButton('OK', 'btnv2_ok')
                    .addButton('Cancel', 'btnv2_cancel')

                await btn.send(jid, { quoted: m.raw || m })
                break
            }

            // ===== CAROUSEL =====
            case 'carousel': {
                const { prepareWAMessageMedia } = require('baileys')

                const card1 = {
                    header: {
                        title: 'Produk 1',
                        subtitle: 'Deskripsi produk 1',
                        hasMediaAttachment: true,
                        ...(await prepareWAMessageMedia(
                            { image: { url: 'https://picsum.photos/300/300?random=1' } },
                            { upload: sock.waUploadToServer }
                        ))
                    },
                    body: { text: 'Ini body card 1' },
                    footer: { text: 'Footer 1' },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: 'quick_reply',
                                buttonParamsJson: JSON.stringify({
                                    display_text: 'Beli 1',
                                    id: 'beli_1'
                                })
                            }
                        ]
                    }
                }

                const card2 = {
                    header: {
                        title: 'Produk 2',
                        subtitle: 'Deskripsi produk 2',
                        hasMediaAttachment: true,
                        ...(await prepareWAMessageMedia(
                            { image: { url: 'https://picsum.photos/300/300?random=2' } },
                            { upload: sock.waUploadToServer }
                        ))
                    },
                    body: { text: 'Ini body card 2' },
                    footer: { text: 'Footer 2' },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: 'quick_reply',
                                buttonParamsJson: JSON.stringify({
                                    display_text: 'Beli 2',
                                    id: 'beli_2'
                                })
                            }
                        ]
                    }
                }

                const carousel = new Carousel(sock)
                    .setBody('🧪 Test Carousel — 2 Card')
                    .setFooter('© TestBuilder')
                    .addCard([card1, card2])

                await carousel.send(jid, { quoted: m.raw || m })
                break
            }

            // ===== AIRICH: TEXT =====
            case 'aitext': {
                const ai = new AIRich(sock)
                    .setTitle('🧪 Test AIRich — Text')
                    .addText('Halo! Ini test *bold*, _italic_, ~strike~, dan `code`.')
                    .addText('Hyperlink: [Google](https://google.com)')
                    .addText('Citation: [](https://example.com)')

                await ai.send(jid, { quoted: m.raw || m })
                break
            }

            // ===== AIRICH: TABLE =====
            case 'aitable': {
                const ai = new AIRich(sock)
                    .setTitle('🧪 Test AIRich — Table Native')
                    .addText('Ini table native (GenATableUXPrimitive):\n')
                    .addTable([
                        ['Nama', 'EXP', 'Level'],
                        ['Budi', '1000', '5'],
                        ['Sari', '900', '4'],
                        ['Dika', '750', '3']
                    ])

                await ai.send(jid, { quoted: m.raw || m })
                break
            }

            // ===== AIRICH: CODE =====
            case 'aicode': {
                const ai = new AIRich(sock)
                    .setTitle('🧪 Test AIRich — Code')
                    .addText('Contoh syntax highlight JavaScript:')
                    .addCode('javascript', `const ai = new AIRich(sock)\n\nai.setTitle('Test')\nai.addText('Hello')\nai.addTable([\n  ['A', 'B'],\n  ['1', '2']\n])\n\nawait ai.send(jid)`)

                await ai.send(jid, { quoted: m.raw || m })
                break
            }

            // ===== AIRICH: TIP =====
            case 'aitip': {
                const ai = new AIRich(sock)
                    .setTitle('🧪 Test AIRich — Tip')
                    .addText('Ini text biasa')
                    .addTip('Ini tip — muncul dengan icon ⓘ')
                    .addTip('Tip kedua — juga muncul icon')

                await ai.send(jid, { quoted: m.raw || m })
                break
            }

            // ===== AIRICH: SUGGEST =====
            case 'aisuggest': {
                const ai = new AIRich(sock)
                    .setTitle('🧪 Test AIRich — Suggest')
                    .addText('Coba klik salah satu suggestion di bawah:')
                    .addSuggest(['Cek menu', 'Cek harga', 'Hubungi CS'])

                await ai.send(jid, { quoted: m.raw || m })
                break
            }

            // ===== AIRICH: FOA TEXT =====
            case 'aifoa': {
                const ai = new AIRich(sock)
                    .setTitle('🧪 Test AIRich — FOAText')
                    .addText('Ini text biasa (addText)')
                    .addFOAText('Ini FOAText (addFOAText) — primitive beda!')
                    .addFOAText('FOAText kedua')

                await ai.send(jid, { quoted: m.raw || m })
                break
            }

            // ===== AIRICH: METADATA =====
            case 'aimetadata': {
                const ai = new AIRich(sock)
                    .setTitle('🧪 Test AIRich — Metadata')
                    .addText('Ini text biasa')
                    .addMetadata('Ini metadata text (GenAIMetadataTextPrimitive)')

                await ai.send(jid, { quoted: m.raw || m })
                break
            }

            // ===== AIRICH: FULL =====
            case 'aifull': {
                const ai = new AIRich(sock)
                    .setTitle('🧪 Test AIRich — Full Combo')
                    .addText('Halo! Ini test *AIRich* full combo.\n')
                    .addTable([
                        ['Fitur', 'Status'],
                        ['addText', '✅'],
                        ['addTable', '✅'],
                        ['addCode', '✅'],
                        ['addTip', '✅'],
                        ['addSuggest', '✅']
                    ])
                    .addText('\n📝 *Contoh Code:*')
                    .addCode('javascript', `const ai = new AIRich(sock)\nai.addText('Hello')\nawait ai.send(jid)`)
                    .addTip('Ini tip — kalau muncul, addTip works!')
                    .addSuggest(['Test lagi', 'Menu utama'])
                    .setFooter('Footer dari setFooter()')

                await ai.send(jid, { quoted: m.raw || m, forwarded: true })
                break
            }

            // ===== AIRICH: DYNAMIC (dengan edit) =====
            case 'aidynamic': {
                const ai = new AIRich(sock, { dynamic: false })
                    .setTitle('🧪 Test AIRich — Dynamic Edit')
                    .addText('Ini pesan awal. Tunggu 3 detik, bakal di-edit...')

                const msg = await ai.send(jid, { quoted: m.raw || m })

                await new Promise(r => setTimeout(r, 3000))

                // Edit pesan yang udah dikirim
                const ai2 = new AIRich(sock, { dynamic: false })
                    .setTitle('🧪 Test AIRich — Dynamic Edit (EDITED)')
                    .addText('✅ Pesan berhasil di-edit!')
                    .addTip('Kalau ini muncul tanpa pesan baru, berarti dynamic edit works!')

                await ai2.sendEdit(jid, msg.key.id, {
                    msg: (await ai2.build(jid)).message
                })
                break
            }
            
            // ===== AIRICH: IMAGE =====
case 'aiimage': {
    const ai = new AIRich(sock)
        .setTitle('🧪 Test AIRich — Image')
        .addImage('https://picsum.photos/400/300')
        .addText('Test addImage dengan URL langsung')

    await ai.send(jid, { quoted: m.raw || m })
    break
}

// ===== AIRICH: WIDGET =====
case 'aiwidget': {
    const p = m.prefix || '.'
    const ai = new AIRich(sock)
        .setTitle('🧪 Test AIRich — Widget')
        .addText('Test addWidget')
        .addWidget({
            title: '💫 Test Widget',
            actions: [
                {
                    label: `${p}menu`,
                    id: `${p}menu`,
                    kind: 'OTHER',
                    state: 'PENDING',
                    toast: { label: 'Membuka menu~ ✨' }
                }
            ]
        })

    await ai.send(jid, { quoted: m.raw || m })
    break
}

            // ===== TOOLKIT =====
            case 'toolkit': {
                let report = `🔧 *Toolkit Test Report*\n\n`

                // Test extractIE
                try {
                    const ie = Toolkit.extractIE('Test [Google](https://google.com) dan [](https://example.com)')
                    report += `✅ extractIE: OK (${ie.ie.length} entities)\n`
                } catch (e) {
                    report += `❌ extractIE: ${e.message}\n`
                }

                // Test fetchBuffer
                try {
                    const buf = await Toolkit.fetchBuffer('https://picsum.photos/50')
                    report += `✅ fetchBuffer: OK (${buf.length} bytes)\n`
                } catch (e) {
                    report += `❌ fetchBuffer: ${e.message}\n`
                }

                // Test resize
                try {
                    const buf = await Toolkit.fetchBuffer('https://picsum.photos/100')
                    const resized = await Toolkit.resize(buf, 50, 50)
                    report += `✅ resize: OK (${resized.length} bytes)\n`
                } catch (e) {
                    report += `❌ resize: ${e.message}\n`
                }

                // Test stringifyEscaped
                try {
                    const s = Toolkit.stringifyEscaped({ test: 'emoji 🎉' })
                    report += `✅ stringifyEscaped: OK\n`
                } catch (e) {
                    report += `❌ stringifyEscaped: ${e.message}\n`
                }

                // Test getMp4Duration (dummy)
                try {
                    const dur = Toolkit.getMp4Duration(Buffer.alloc(0), { silent: true })
                    report += `✅ getMp4Duration: OK (returned ${dur})\n`
                } catch (e) {
                    report += `❌ getMp4Duration: ${e.message}\n`
                }

                await m.reply(report)
                break
            }

            default: {
                return m.reply(`❌ Mode *${mode}* tidak dikenal.\n\nKetik *.testall menu* untuk lihat daftar command.`)
            }
        }

        console.log(`[TestAll] Mode: ${mode} — OK`)

    } catch (err) {
        console.log(`[TestAll] Error (${mode}):`, err)
        return m.reply(
            `╭━〔 ❌ 𝗧𝗘𝗦𝗧 𝗚𝗔𝗚𝗔𝗟 〕━⬣\n` +
            `┃\n` +
            `┃ Mode  : ${mode}\n` +
            `┃ Error : ${err.message}\n` +
            `┃\n` +
            `╰━⬣`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}