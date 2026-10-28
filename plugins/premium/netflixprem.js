/**
 * ✧ Name    : netflixprem
 * ✧ Category: premium
 */

const ENDPOINT = "https://token-netflix.vercel.app/api/generate"

function buildLinks(token) {
  return {
    browser: `https://www.netflix.com/login?nftoken=${token}`,
    mobile: `https://netflix.com/unsupported?nftoken=${token}`,
    tv: `https://www.netflix.com/tv?nftoken=${token}`,
    pc: `https://www.netflix.com/browse?nftoken=${token}`
  }
}

async function generateNetflix(count = 1) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count, stream: false })
  })
  return await res.json()
}

const pluginConfig = {
  name: 'netflixprem',
  alias: ['nfprem', 'netflixpremium'],
  category: 'premium',
  description: 'Netflix premium token generator',
  usage: '.netflixprem <jumlah>',
  example: '.netflixprem 1',
  isOwner: false,
  isPremium: true,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 2,
  isEnabled: true
}

async function handler(m, { sock }) {
  const args = m.text?.trim().split(/\s+/).filter(Boolean) || []
  const count = parseInt(args[0]) || 1

  if (count < 1 || count > 5) {
    return m.reply(`📦 *ɴᴇᴛꜰʟɪx ᴘʀᴇᴍ*\n\n> Contoh: ${m.prefix}netflixprem 1\n> Maksimal 5 token`)
  }

  await m.react('🕕')

  try {
    const result = await generateNetflix(count)
    const tokens = result.data || []

    if (!tokens.length) {
      await m.react('❌')
      return m.reply(`❌ Stok habis / API error\n${JSON.stringify(result).slice(0, 500)}`)
    }

    const sukses = tokens.filter(t => t.success).length

    let txt = `⚔ *NETFLIX PREMIUM*\n\n`
    txt += `┌─ *Ringkasan Hasil*\n`
    txt += `│ ◦ Status : true\n`
    txt += `│ ◦ Negara : Indonesia (ID)\n`
    txt += `│ ◦ Stok : ${sukses} tersisa\n`
    txt += `│ ◦ Total : ${sukses} / ${count}\n`
    txt += `└\n\n`
    txt += `┌─ *Daftar Token*\n`

    tokens.forEach((item, idx) => {
      if (!item.success) return
      const links = buildLinks(item.token)
      const p = item.profile || {}

      txt += `│\n`
      txt += `│ ${idx + 1}. Token:\n`
      txt += `│ ${item.token}\n`
      txt += `│\n`
      txt += `│ ◦ Country : ${p.country || 'ID'}\n`
      txt += `│ ◦ Name : ${p.countryName || 'Indonesia'}\n`
      txt += `│ ◦ Remaining : ${p.remaining ?? 0}\n`
      txt += `│ ◦ Status : ${p.status || 'Active'}\n`
      txt += `│ ◦ Email : ${p.email || 'yo***@gmail.com'}\n`
      txt += `│ ◦ Plan : ${p.plan || 'Premium'}\n`
      txt += `│ ◦ Payments : ${p.payments || '•••••' + (p.last4 || '5076')}\n`
      txt += `│ ◦ Next Billing: ${p.nextBilling || '5 November 2026'}\n`
      txt += `│ ◦ Member Since: ${p.memberSince || 'November 2023'}\n`
      txt += `│ ◦ Phone : ${p.phone || '0821-7650-****'}\n`
      txt += `│ ◦ Connection : ${p.connection || '4 devices · UHD'}\n`
      txt += `│ ◦ Profiles : ${p.profiles || 5}\n`
      txt += `│ ◦ Expires : ${item.expiry ? new Date(item.expiry).toLocaleString() : '-'}\n`
      txt += `│\n`
      txt += `│ ◦ Link Browser: ${links.browser}\n`
      txt += `│ ◦ Link Mobile : ${links.mobile}\n`
      txt += `│ ◦ Link TV : ${links.tv}\n`
    })

    txt += `└`

    await m.react('✅')
    await sock.sendMessage(m.chat, { text: txt }, { quoted: m })

  } catch (e) {
    console.error('[netflixprem] Error:', e)
    await m.react('❌')
    m.reply(`❌ Error: ${e.message}`)
  }
}

module.exports = {
  config: pluginConfig,
  handler
}