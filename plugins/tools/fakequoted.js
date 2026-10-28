const pluginConfig = {
    name: 'fakeall',
    alias: ['fakequoted', 'fakes'],
    category: 'tools',
    description: 'Demo fakequoted lengkap (working)',
    usage: '.fakeall',
    cooldown: 5
}

async function handler(m, { sock }) {
    const jid = m.chat
    const target = '0@s.whatsapp.net'

    const baseKey = {
        fromMe: false,
        participant: target,
        remoteJid: jid
    }

    // 1. TEXT
    const fakeText = {
        key: baseKey,
        message: {
            conversation: 'Fake teks'
        }
    }

    // 2. EXTENDED TEXT
    const fakeExtended = {
        key: baseKey,
        message: {
            extendedTextMessage: {
                text: 'Fake extended text',
                contextInfo: {
                    mentionedJid: [target]
                }
            }
        }
    }

    // 3. LINK PREVIEW
    const fakeExternal = {
        key: baseKey,
        message: {
            extendedTextMessage: {
                text: 'Fake link preview',
                contextInfo: {
                }
            }
        }
    }

    // 4. CONTACT
    const fakeContact = {
        key: baseKey,
        message: {
            contactMessage: {
                displayName: 'Fake Contact',
                vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN:Fake Contact\nTEL;type=CELL:123456789\nEND:VCARD'
            }
        }
    }

    // 5. LOCATION
    const fakeLocation = {
        key: baseKey,
        message: {
            locationMessage: {
                degreesLatitude: -6.2,
                degreesLongitude: 106.8
            }
        }
    }

    // 6. LIVE LOCATION
    const fakeLiveLocation = {
        key: baseKey,
        message: {
            liveLocationMessage: {
                degreesLatitude: -6.2,
                degreesLongitude: 106.8,
                caption: 'Live Location'
            }
        }
    }

    // 7. POLL
    const fakePoll = {
        key: baseKey,
        message: {
            pollCreationMessage: {
                name: 'Polling palsu',
                options: [
                    { optionName: 'Ya' },
                    { optionName: 'Tidak' }
                ],
                selectableOptionsCount: 1
            }
        }
    }

    // 8. ORDER
    const fakeOrder = {
        key: baseKey,
        message: {
            orderMessage: {
                itemCount: 1,
                status: 1,
                surface: 1,
                message: 'Order palsu',
                orderTitle: 'Fake Order'
            }
        }
    }

    // 9. BUTTON RESPONSE
    const fakeButton = {
        key: baseKey,
        message: {
            buttonsResponseMessage: {
                selectedButtonId: 'fake_id',
                selectedDisplayText: 'Klik saya',
                type: 1
            }
        }
    }

    // 10. LIST RESPONSE
    const fakeList = {
        key: baseKey,
        message: {
            listResponseMessage: {
                title: 'Menu Fake',
                singleSelectReply: {
                    selectedRowId: 'row1'
                }
            }
        }
    }

    // 11. FORWARDED
    const fakeForward = {
        key: baseKey,
        message: {
            extendedTextMessage: {
                text: 'Pesan forward',
                contextInfo: {
                    isForwarded: true,
                    forwardingScore: 999
                }
            }
        }
    }

    // 12. VIEW ONCE
    const fakeViewOnce = {
        key: baseKey,
        message: {
            viewOnceMessage: {
                message: {
                    conversation: 'Pesan sekali lihat'
                }
            }
        }
    }

    // 13. NEWSLETTER / CHANNEL
    const fakeNewsletter = {
        key: baseKey,
        message: {
            extendedTextMessage: {
                text: 'Fake channel message',
                contextInfo: {
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363xxx@newsletter',
                        serverMessageId: 1,
                        newsletterName: 'Fake Channel'
                    }
                }
            }
        }
    }

    const allFake = [
        fakeText,
        fakeExtended,
        fakeExternal,
        fakeContact,
        fakeLocation,
        fakeLiveLocation,
        fakePoll,
        fakeOrder,
        fakeButton,
        fakeList,
        fakeForward,
        fakeViewOnce,
        fakeNewsletter
    ]

    for (let fake of allFake) {
        await sock.sendMessage(jid, {
            text: 'Contoh fakequoted',
            contextInfo: {
                quotedMessage: fake.message,
                participant: fake.key.participant
            }
        })
    }
}

module.exports = {
    config: pluginConfig,
    handler
}