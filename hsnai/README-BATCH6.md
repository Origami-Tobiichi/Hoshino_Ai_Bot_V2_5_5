# hsnai — NIXCODE AIRich Builder (Batch 6)

## File BARU
- lib/Modded/message_builder.js → class `AIRich`, `ORich`, `Toolkit`, `BaseBuilder`

Ini library pihak ketiga (NIXCODE, by Nixel) yang numpang di paket Ourin.
Lisensi & watermark-nya dipertahankan APA ADANYA sesuai term aslinya
(boleh dipakai/dimodif buat project personal/komersial, tapi credit-nya
gak boleh dihapus/diklaim sebagai karya sendiri) — makanya header lisensi
tetep utuh persis kayak sumbernya, watermark string ("NIXEL", disclaimer
"~ Ahmad tumbuh kembang") juga tetep di titik fungsionalnya masing-masing.

Yang DIPORT: cuma AIRich + Toolkit + BaseBuilder + ORich (sesuai yang lo
minta). Class Button/ButtonV2/Carousel/RowBuilder/CardBuilder dari file
aslinya TIDAK diikutkan — kalau lo mau itu juga, tinggal bilang.

## Cara pasang
1. Taro file ini di `lib/Modded/message_builder.js` project hsnai lo
2. Optional tapi disaranin: `npm install fluent-ffmpeg --legacy-peer-deps`
   (buat fitur `.addVideo()` bikin thumbnail preview otomatis — `sharp`
   udah ada di dependency lo, gak perlu install ulang)

## Cara pakai
```js
const { AIRich } = require('../lib/Modded/message_builder')

await new AIRich(sock)
  .addText('Nih contoh function buat hitung total:')
  .addCode('javascript', `function total(items) {\n  return items.reduce((a, b) => a + b, 0)\n}`)
  .addTable([
    ['Input', 'Output'],
    ['[1,2,3]', '6'],
    ['[10,20]', '30']
  ])
  .send(jid, { quoted: m })
```

Method yang tersedia: `.addText()`, `.addCode()`, `.addTable()`, `.addSource()`,
`.addReels()`, `.addImage()`, `.addVideo()`, `.addProduct()`, `.addPost()`,
`.addTip()`, `.addSuggest()`, `.addSubmessage()`, `.addSection()`,
`.setTitle()` / `.setFooter()`, `.build()` (compile doang), `.send(jid, opts)`
(compile + relay langsung).

Lolos `node --check`.
