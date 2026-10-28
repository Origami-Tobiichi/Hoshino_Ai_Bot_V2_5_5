# hsnai (Hoshino Ai Bot) — Baileys Upgrade

Dikembangkan oleh Tim Pengembang HsnAi™ (Xyrann, Qynox, Sea).

Ini full package hsnai lo yang udah di-upgrade.
CJS dipertahankan penuh, style/pattern kode lama lo (sock bukan conn, dll) gak diubah.

## Cara pasang
1. Timpa folder ini ke tempat hsnai lo sekarang (atau extract terus copy `lib/`,
   `WAProto/`, `package.json` ke project lo — TIMPA, bukan gabung manual).
2. `npm install --legacy-peer-deps` (package.json udah nambahin `lru-cache` &
   `p-queue` sebagai dependency baru)
3. Restart bot, coba fitur satu-satu (terutama yang butuh opt-in, lihat di bawah).

## Yang ditambahin/di-upgrade

### Ditambahin otomatis, langsung aktif (gak perlu setting apa-apa)
- **LID (Linked ID) helper** — `isPnUser`, `isHostedLidUser`, `isHostedPnUser`,
  `isJidBot`, `isJidMetaAI`, `isJidNewsletter`, `META_AI_JID`, `getServerFromDomainType`,
  `transferDevice` (lib/WABinary/jid-utils.js)
- **`generateParticipantHashV2`, `isStringNullOrEmpty`** (lib/Utils/generics.js)
- **Rich message "airich"** — codeblock (syntax highlight), LaTeX, link-rich card,
  composer utama `generateRichMessageContent` yang gabung table+code+latex+list+link
  jadi satu response (lib/Utils/rich-messages.js)
- **Business profile** — `updateBussinesProfile`, `updateCoverPhoto`, `removeCoverPhoto`
  (lib/Socket/business.js + helper `getRawMediaUploadData` di messages-media.js)
- **Chats** — `updateMessagesPrivacy`, `updateCallPrivacy`, `updateDisableLinkPreviewsPrivacy`,
  `addOrEditContact`, `removeContact`, `addLabel`, `addOrEditQuickReply`, `removeQuickReply`,
  `fetchDisappearingDuration`, `getBotListV2`, `createCallLink` (lib/Socket/chats.js)
- **Community WA penuh** — create/leave community, link/unlink grup ke community,
  membership approval, invite code, dll — semua method `sock.community*`
  (lib/Socket/communities.js, baru, di-wiring lewat registration.js)
- **relayMessage** — pesan ke grup disappearing-message sekarang otomatis ikut
  attribute expiration; pesan ber-messageSecret otomatis nempel reporting token;
  chat 1:1 yang punya tctoken tersimpan otomatis kepasang; fungsi baru
  `sock.updateMemberLabel(jid, label)` buat ganti label/nickname member grup

### Class baru, siap dipake tapi BELUM di-wiring otomatis ke socket
(dibikin di lib/Signal/ dan lib/Utils/, tinggal di-`require` dan dipanggil manual
kalau lo mau pake — gak ada yang otomatis nyala sendiri, jadi aman)
- `LIDMappingStore` (lib/Signal/lid-mapping.js) — cache mapping LID↔PN
- `PreKeyManager` (lib/Utils/pre-key-manager.js) — queue update/delete pre-key
- `makeOfflineNodeProcessor` (lib/Utils/offline-node-processor.js)
- `buildAckStanza` (lib/Utils/stanza-ack.js)
- `processContactAction`, `emitSyncActionResults` (lib/Utils/sync-action-utils.js)
- `handleIdentityChange` (lib/Utils/identity-change-handler.js)
- `makeStickerPack` (lib/Utils/sticker-pack.js) — normalizer, opsional (native
  sendMessage stickerPack lo yang sekarang udah jalan tanpa ini)

### Opt-in (nyala kalau lo aktifin lewat config)
- **Message retry cache** — set `enableRecentMessageCache: true` pas bikin socket.
  Kalau nyala: tiap pesan sukses kekirim kesimpen di `MessageRetryManager`
  (lib/Utils/message-retry-manager.js), bisa diakses `sock.messageRetryManager`.

## Sengaja belum digarap
- **VoIP** (call signaling + WASM audio engine) — subsistem gede yang butuh
  asset native/wasm, gak portable via patch teks
- **Newsletter auto-follow** — kalau lo mau fitur auto-follow channel HsnAi/lo
  sendiri pas bot connect, kasih tau JID/link channel-nya, tinggal diracik
- **LID dual identity di dalam relayMessage** (pilih identitas LID vs PN buat encrypt),
  **isRetryResend branch**, **sender-key device filtering** — tiga ini saling
  gantung di banyak titik di jalur enkripsi inti. Sengaja ditahan karena kalau
  ada yang keliru, resikonya pesan gagal ke-decrypt di HP lawan bicara, dan itu
  cuma ketauan lewat testing manual sungguhan, bukan lewat cek syntax doang.
  Kalau mau lanjut, enaknya dikerjain bareng sambil dites di bot dev/staging dulu.

Semua file di paket ini udah lolos `node --check` (syntax valid).
