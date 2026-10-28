
<div align="center">
  <h1>OURIN BAILEYS</h1>
  <img src="https://files.catbox.moe/4n0efj.jpg" alt="Thumbnail" width='100%' />
</div>

<br>

The latest updated Baileys WhatsApp supports following channels, and doesn't exit easily when using WhatsApp or Telegram bots. This Baileys is equipped with the latest buttons and has updated the jid to lid, suitable for those of you who have a project. Please use this Baileys. 

WhatsApp Baileys updates the jid to lid, payment/interactiveMessage/viewOnceMessage buttons and others, suitable for those of you who have a script project that you want 

Baileys is a fork from github https://github.com/Nted3xec/baileys

---

### Features improved by the owner

- Already supports custom pairing code 
- Fixing damage to Pairing 
- Supports Paymess, Interactive, and button
- Support button in WhatsApp business  
- Faster performance

## Add Function ( Simple code )

### Label Group
Tag/Label Member Grop

```javascript
await ourin.setLabelGroup(jid, string)
```
---
### Delay
Sleep code ( hehe )

```javascript
await ourin.delay(seconds) // ex. 3 ( 3 seconds )
// example
await ourin.delay(3)
```
---
### React Message
Send Reaction into the Message

```javascript
await ourin.react(m, emoji) 
// Example 
await ourin.react(m, "😚") 
```
---
### Delete React Message
Delete Reaction into the Message

```javascript
// Example 
await ourin.unreact(m) 
```
---
### Check ID Channel / Newsletter / Saluran
Get ID Channel From Url

```javascript
await ourin.cekIDSaluran(url)
```
Result JSON
```json
{
  "name": "Name Channel",
  "id": "Channel ID",
  "state": "Status Channel",
  "subscribers": "Followers",
  "verification": "UNVERIFIED",
  "creation_time": 1728547155,
  "description": "Description Channel"
  // ...etc
}
```
---
### Multiple Follow Newsletter
Just one line, not use array, just string with space " "

```javascript
await ourin.newsletterMultipleFollow(jids)
// Example
await ourin.newsletterMultipleFollow("120xxxxxxx@newsletter 120xxxxxxxxx@newsletter 120xxxxxxx@newsletter")
```
---
### Check banned number
You can see the status of blocked numbers here 

```javascript
ourin.checkBanned(jid)
```
---
### Edit Message
Edit your previously sent message
```js
await ourin.edit(m, newText)
// Example
await ourin.edit(m, "this is edited message")
```
Notes
- Only works for messages sent by yourself
- Supports private chat, group, and newsletter
---
### Delete / Revoke Message
Delete or revoke a message
```js
await ourin.del(m)
// Example
await ourin.del(m)
```

Notes
- Private chat: revoke message
- Group chat:
- - Your message -> revoke for everyone
- - Other message -> delete for me
---
### Detect Message
Detect message type from incoming message object.
```js
ourin.detect(m)
// Example
const type = ourin.detect(m)
if (type === 'image') {
    // handle image message
}
```
**Returned Type**
- text
- image
- video
- gif
- audio
- ptt
- sticker
- document
- reaction
- viewonce
- edited
- revoke
- interactive
- poll
- location
- contact
- Unknown

**Notes**
- Automatically normalizes message content
- Safe for plugins and middleware
- Avoid deep manual message checks
- Stable across Baileys updates
---
# SendMessage Documentation

### Send Status Mention
Status Mention Group & Private Message
Send Status Mention Group/Private Chat

```javascript
await ourin.sendStatusMention(content, jid);
```

### Status Group Message V2
Send Group Status With Version 2 

```javascript
await ourin.sendMessage(jid, {
     groupStatusMessage: {
          text: "Hello World"
     }
});
```

### Album Message (Multiple Images)
Send multiple images in a single album message:

```javascript
await ourin.sendMessage(jid, { 
    albumMessage: [
        { image: buffer, caption: "Foto pertama" },
        { image: { url: "URL IMAGE" }, caption: "Foto kedua" }
    ] 
}, { quoted: m });
```

### Event Message
Create and send WhatsApp event invitations:

```javascript
await ourin.sendMessage(jid, { 
    eventMessage: { 
        isCanceled: false, 
        name: "Hello World", 
        description: "zanxnpc", 
        location: { 
            degreesLatitude: 0, 
            degreesLongitude: 0, 
            name: "rowrrrr" 
        }, 
        joinLink: "https://call.whatsapp.com/video/saweitt", 
        startTime: "1763019000", 
        endTime: "1763026200", 
        extraGuestsAllowed: false 
    } 
}, { quoted: m });
```

### Poll Result Message
Display poll results with vote counts:

```javascript
await ourin.sendMessage(jid, { 
    pollResultMessage: { 
        name: "Hello World", 
        pollVotes: [
            {
                optionName: "TEST 1",
                optionVoteCount: "112233"
            },
            {
                optionName: "TEST 2",
                optionVoteCount: "1"
            }
        ] 
    } 
}, { quoted: m });
```

### Simple Interactive Message
Send basic interactive messages with copy button functionality:

```javascript
await ourin.sendMessage(jid, {
    interactiveMessage: {
        header: "Hello World",
        title: "Hello World",
        footer: "OURIN MD",
        buttons: [
            {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                    display_text: "copy code",
                    id: "123456789",              
                    copy_code: "ABC123XYZ"
                })
            }
        ]
    }
}, { quoted: m });
```

### Interactive Message with Native Flow
Send interactive messages with buttons, copy actions, and native flow features:

```javascript
await ourin.sendMessage(jid, {    
    interactiveMessage: {      
        header: "Hello World",
        title: "Hello World",      
        footer: "OURIN MD",      
        image: { url: "https://example.com/image.jpg" },      
        nativeFlowMessage: {        
            messageParamsJson: JSON.stringify({          
                limited_time_offer: {            
                    text: "idk hummmm?",            
                    url: "https://ourin.site",            
                    copy_code: "zanxnpc",            
                    expiration_time: Date.now() * 999          
                },          
                bottom_sheet: {            
                    in_thread_buttons_limit: 2,            
                    divider_indices: [1, 2, 3, 4, 5, 999],            
                    list_title: "zanxnpc",            
                    button_title: "zanxnpc"          
                },          
                tap_target_configuration: {            
                    title: " X ",            
                    description: "bomboclard",            
                    canonical_url: "https://ourin.site",            
                    domain: "shop.example.com",            
                    button_index: 0          
                }        
            }),        
            buttons: [          
                {            
                    name: "single_select",            
                    buttonParamsJson: JSON.stringify({              
                        has_multiple_buttons: true            
                    })          
                },          
                {            
                    name: "call_permission_request",            
                    buttonParamsJson: JSON.stringify({              
                        has_multiple_buttons: true            
                    })          
                },          
                {            
                    name: "single_select",            
                    buttonParamsJson: JSON.stringify({              
                        title: "Hello World",              
                        sections: [                
                            {                  
                                title: "title",                  
                                highlight_label: "label",                  
                                rows: [                    
                                    {                      
                                        title: "@saweitt",                      
                                        description: "love you",                      
                                        id: "row_2"                    
                                    }                  
                                ]                
                            }              
                        ],              
                        has_multiple_buttons: true            
                    })          
                },          
                {            
                    name: "cta_copy",            
                    buttonParamsJson: JSON.stringify({              
                        display_text: "copy code",              
                        id: "123456789",              
                        copy_code: "ABC123XYZ"            
                    })          
                }        
            ]      
        }    
    }  
}, { quoted: m });
```

### Interactive Message with Thumbnail
Send interactive messages with thumbnail image and copy button:

```javascript
await ourin.sendMessage(jid, {
    interactiveMessage: {
        header: "Hello World",
        title: "Hello World",
        footer: "OURIN MD",
        image: { url: "https://example.com/image.jpg" },
        buttons: [
            {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                    display_text: "copy code",
                    id: "123456789",
                    copy_code: "ABC123XYZ"
                })
            }
        ]
    }
}, { quoted: m });
```

### Product Message
Send product catalog messages with buttons and merchant information:

```javascript
await ourin.sendMessage(jid, {
    productMessage: {
        title: "Produk Contoh",
        description: "Ini adalah deskripsi produk",
        thumbnail: { url: "https://example.com/image.jpg" },
        productId: "PROD001",
        retailerId: "RETAIL001",
        url: "https://example.com/product",
        body: "Detail produk",
        footer: "Harga spesial",
        priceAmount1000: 50000,
        currencyCode: "USD",
        buttons: [
            {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                    display_text: "Beli Sekarang",
                    url: "https://example.com/buy"
                })
            }
        ]
    }
}, { quoted: m });
```

### Interactive Message with Document Buffer
Send interactive messages with document from buffer (file system) - **Note: Documents only support buffer**:

```javascript
await ourin.sendMessage(jid, {
    interactiveMessage: {
        header: "Hello World",
        title: "Hello World",
        footer: "OURIN MD",
        document: fs.readFileSync("./package.json"),
        mimetype: "application/pdf",
        fileName: "saweitt.pdf",
        jpegThumbnail: fs.readFileSync("./document.jpeg"),
        contextInfo: {
            mentionedJid: [jid],
            forwardingScore: 777,
            isForwarded: false
        },
        externalAdReply: {
            title: "OURIN MD",
            body: "Zann",
            mediaType: 3,
            thumbnailUrl: "https://example.com/image.jpg",
            mediaUrl: " X ",
            sourceUrl: "https://ourin.site",
            showAdAttribution: true,
            renderLargerThumbnail: false         
        },
        buttons: [
            {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                    display_text: "Telegram",
                    url: "https://ourin.site",
                    merchant_url: "https://ourin.site"
                })
            }
        ]
    }
}, { quoted: m });
```

### Interactive Message with Document Buffer (Simple)
Send interactive messages with document from buffer (file system) without contextInfo and externalAdReply - **Note: Documents only support buffer**:

```javascript
await ourin.sendMessage(jid, {
    interactiveMessage: {
        header: "Hello World",
        title: "Hello World",
        footer: "OURIN MD",
        document: fs.readFileSync("./package.json"),
        mimetype: "application/pdf",
        fileName: "saweitt.pdf",
        jpegThumbnail: fs.readFileSync("./document.jpeg"),
        buttons: [
            {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                    display_text: "Telegram",
                    url: "https://ourin.site",
                    merchant_url: "https://ourin.site"
                })
            }
        ]
    }
}, { quoted: m });
```

### Request Payment Message
Send payment request messages with custom background and sticker:

```javascript
let quotedType = m.quoted?.mtype || '';
let quotedContent = JSON.stringify({ [quotedType]: m.quoted }, null, 2);

await ourin.sendMessage(jid, {
    requestPaymentMessage: {
        currency: "IDR",
        amount: 10000000,
        from: m.sender,
        sticker: JSON.parse(quotedContent),
        background: {
            id: "100",
            fileLength: "0",
            width: 1000,
            height: 1000,
            mimetype: "image/webp",
            placeholderArgb: 0xFF00FFFF,
            textArgb: 0xFFFFFFFF,     
            subtextArgb: 0xFFAA00FF   
        }
    }
}, { quoted: m });
```

### Carousel Message
Send a carousel message with multiple cards:

```javascript
await ourin.sendMessage(
    jid,
    {
        text: 'Body Message',
        title: 'Title Message', 
        subtile: 'Subtitle Message', 
        footer: 'Footer Message',
        cards: [
           {
              image: { url: 'https://example.com/jdbenkksjs.jpg' }, // or buffer
              title: 'Title Cards',
              body: 'Body Cards',
              footer: 'Footer Cards',
              buttons: [
                  {
                      name: 'quick_reply',
                      buttonParamsJson: JSON.stringify({
                         display_text: 'Display Button',
                         id: 'ID'
                      })
                  },
                  {
                      name: 'cta_url',
                      buttonParamsJson: JSON.stringify({
                         display_text: 'Display Button',
                         url: 'https://www.example.com'
                      })
                  }
              ]
           },
           {
              video: { url: 'https://example.com/jdbenkksjs.mp4' }, // or buffer
              title: 'Title Cards',
              body: 'Body Cards',
              footer: 'Footer Cards',
              buttons: [
                  {
                      name: 'quick_reply',
                      buttonParamsJson: JSON.stringify({
                         display_text: 'Display Button',
                         id: 'ID'
                      })
                  },
                  {
                      name: 'cta_url',
                      buttonParamsJson: JSON.stringify({
                         display_text: 'Display Button',
                         url: 'https://www.example.com'
                      })
                  }
              ]
           }
        ]
    }
)
```

### Sticker Pack Message
Send a sticker pack with multiple stickers in one message:

```javascript
await ourin.sendMessage(jid, {
    stickerPack: {
        name: "My Sticker Pack",
        publisher: "OURIN MD",
        description: "Custom sticker pack",
        cover: { url: "https://example.com/cover.png" },
        stickers: [
            { sticker: fs.readFileSync("./sticker1.webp"), emojis: ["😎"] },
            { sticker: fs.readFileSync("./sticker2.webp"), isAnimated: true },
            { sticker: { url: "https://example.com/sticker3.webp" } }
        ]
    }
}, { quoted: m });
```

**Sticker Options**
- `sticker` — Buffer or URL of the sticker (WebP format)
- `emojis` — Array of emoji associated with the sticker
- `isAnimated` — Set to `true` for animated stickers
- `isLottie` — Set to `true` for Lottie stickers
- `accessibilityLabel` — Accessibility label for the sticker

---

## Media Utilities

Lightweight media processing functions built directly into the socket. Uses `sharp` (native C) for images and `ffmpeg` pipes for video/audio — zero temp files, maximum speed.

### Resize
Fast image resize with aspect ratio preserved

```javascript
const resized = await ourin.resize(buffer, 200, 200)
```
---
### Convert
Convert media format — supports `jpeg`, `jpg`, `png`, `webp`, `mp3`, `mp4`

```javascript
const mp4 = await ourin.convert(buffer, { to: "mp4" })
const webp = await ourin.convert(buffer, { to: "webp" })
const mp3 = await ourin.convert(buffer, { to: "mp3" })
```
---
### To Sticker
Convert any image to WhatsApp sticker format (512x512 WebP with transparency)

```javascript
const sticker = await ourin.toSticker(buffer)
const sticker = await ourin.toSticker(buffer, { quality: 90 })
```
---
### Compress
Compress media with quality control — auto-detects image or video

```javascript
const compressed = await ourin.compress(buffer, { quality: 50 })
```
---
### Metadata
Extract media metadata — auto-detects image (sharp) or video/audio (ffprobe)

```javascript
const info = await ourin.metadata(buffer)
```

Result JSON
```json
{
  "size": 102400,
  "mimetype": "image/jpeg",
  "width": 1920,
  "height": 1080,
  "channels": 3,
  "hasAlpha": false
}
```

For video/audio:
```json
{
  "size": 5242880,
  "mimetype": "video/mp4",
  "width": 1280,
  "height": 720,
  "duration": 30.5
}
```

---

## Why Choose WhatsApp Baileys?

Because this library offers high stability, full features, and an actively improved pairing process. It is ideal for developers aiming to create professional and secure WhatsApp automation solutions. Support for the latest WhatsApp features ensures compatibility with platform updates.

---

For complete documentation, installation guides, and implementation examples, please visit the official repository and community forums. We continually update and improve this library to meet the needs of developers and users of modern WhatsApp automation solutions.

**Thank you for choosing WhatsApp Baileys as your WhatsApp automation solution!**


---

### 🙌 Contributors outside the Baileys code

Thanks to the following awesome contributors who help improve this project 💖

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/z4phdev">
        <img src="https://github.com/z4phdev.png" width="80px;" style="border-radius:50%;" alt="Developer"/>
        <br />
        <sub><b>z4phdev</b></sub>
      </a>
    </td>
<td align="center">
      <a href="https://github.com/kiuur">
        <img src="https://github.com/kiuur.png" width="80px;" style="border-radius:50%;" alt="Contributor"/>
        <br />
        <sub><b>KyuuRzy</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/Nted3xec">
        <img src="https://raw.githubusercontent.com/IkyyExecutive/IkyyBokep/main/uploads/1770205734777_31697_1770205733762_file_821.jpg" width="80px;" style="border-radius:50%;" alt="Contributor"/>
        <br />
        <sub><b>Nted3xec</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/LuckyArch">
        <img src="https://avatars.githubusercontent.com/u/246404367?v=4" width="80px;" style="border-radius:50%;" alt="Contributor"/>
        <br />
        <sub><b>Zann</b></sub>
      </a>
    </td>
  </tr>
</table>
