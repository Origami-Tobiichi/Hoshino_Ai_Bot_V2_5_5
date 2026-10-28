const { getPlugin } = require('../../src/lib/plugins')

const pluginConfig = {
    name: 'testplugin',
    alias: ['dryrun', 'simulateplugin'],
    category: 'owner',
    description: 'Simulasi eksekusi command tanpa efek samping (dry run) — buat ngetes plugin baru',
    usage: '.testplugin <command> [args]',
    example: '.testplugin cekfemboy @user',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 0,
    energi: 0,
    isEnabled: true
}

const handler = async (m, { config, db }) => {
    const input = m.args.join(' ').trim()

    if (!input) {
        return m.reply(
            `🧪 *ᴅʀʏ ʀᴜɴ ᴄᴏᴍᴍᴀɴᴅ*\n\n` +
            `Masukin command yang mau ditest~ ✨\n\n` +
            `*Contoh:*\n` +
            `\`${m.prefix}testplugin cekfemboy @user\`\n` +
            `\`${m.prefix}dryrun menu\``
        )
    }

    const parts = input.split(/\s+/)
    let cmdRaw = parts[0]
    const args = parts.slice(1)

    let prefix = m.prefix
    let cmd = cmdRaw
    if (cmdRaw.startsWith(m.prefix)) {
        cmd = cmdRaw.slice(m.prefix.length)
    } else {
        const possiblePrefixes = ['.', '/', '#', '!', ',']
        const foundPrefix = possiblePrefixes.find(p => cmdRaw.startsWith(p))
        if (foundPrefix) {
            prefix = foundPrefix
            cmd = cmdRaw.slice(foundPrefix.length)
        }
    }
    cmd = cmd.toLowerCase()

    const plugin = getPlugin(cmd)

    if (!plugin) {
        return m.reply(
            `❌ *ᴄᴏᴍᴍᴀɴᴅ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ*\n\n` +
            `Eeh~ command \`${cmd}\` nggak ada di plugin store nih~ 🌸\n` +
            `Cek lagi typo-nya ya~`
        )
    }

    const pc = plugin.config

    let result = `🧪 *ᴅʀʏ ʀᴜɴ ʀᴇsᴜʟᴛ*\n\n`
    result += `📦 *Plugin:* ${pc.name}\n`
    result += `📂 *Category:* ${pc.category || '-'}\n`
    result += `📝 *Description:* ${pc.description || '-'}\n`
    result += `💡 *Usage:* ${pc.usage || '-'}\n`
    result += `🎯 *Command terdeteksi:* ${cmd}\n`
    result += `📋 *Args:* ${args.length ? args.join(' ') : '(kosong)'}\n`
    result += `🔢 *Jumlah args:* ${args.length}\n`
    result += `🏷️ *Alias:* ${pc.alias?.length ? pc.alias.join(', ') : '(tidak ada)'}\n\n`

    result += `⚙️ *ᴋᴏɴꜰɪɢ*\n`
    result += `• isEnabled: ${pc.isEnabled !== false ? '✅' : '❌'}\n`
    result += `• isOwner: ${pc.isOwner ? '✅' : '❌'}\n`
    result += `• isPremium: ${pc.isPremium ? '✅' : '❌'}\n`
    result += `• isGroup: ${pc.isGroup ? '✅' : '❌'}\n`
    result += `• isPrivate: ${pc.isPrivate ? '✅' : '❌'}\n`
    result += `• isAdmin: ${pc.isAdmin ? '✅' : '❌'}\n`
    result += `• isBotAdmin: ${pc.isBotAdmin ? '✅' : '❌'}\n`
    result += `• cooldown: ${pc.cooldown || 0}s\n`
    result += `• energi: ${pc.energi || 0}\n\n`

    result += `🔍 *ᴄᴇᴋ ᴀᴋsᴇs (kondisi kamu saat ini)*\n`

    if (pc.isEnabled === false) {
        result += `⚠️ Plugin sedang *disabled*, tidak akan jalan\n`
    }

    if (pc.isOwner && !m.isOwner) {
        result += `⛔ Butuh akses *Owner* — kamu bukan owner\n`
    } else if (pc.isOwner) {
        result += `✅ Akses Owner terpenuhi\n`
    }

    if (pc.isPremium && !m.isPremium && !m.isOwner) {
        result += `⛔ Butuh akses *Premium* — kamu bukan premium\n`
    } else if (pc.isPremium) {
        result += `✅ Akses Premium terpenuhi\n`
    }

    if (pc.isGroup && !m.isGroup) {
        result += `⛔ Command ini *hanya untuk grup*, kamu lagi di chat pribadi\n`
    }

    if (pc.isPrivate && m.isGroup) {
        result += `⛔ Command ini *hanya untuk private chat*, kamu lagi di grup\n`
    }

    if (pc.isAdmin && m.isGroup && !m.isAdmin && !m.isOwner) {
        result += `⛔ Butuh akses *Admin grup*\n`
    }

    if (pc.isBotAdmin && m.isGroup && !m.isBotAdmin) {
        result += `⛔ Bot belum jadi *Admin grup* di sini\n`
    }

    const energiEnabled = db.setting('energi') !== undefined ? db.setting('energi') : (config.energi?.enabled !== false)
    if (energiEnabled && pc.energi > 0) {
        const user = db.getUser(m.sender)
        const currentEnergi = user?.energi ?? 0
        result += `⚡ Energi dibutuhkan: ${pc.energi} | Energi kamu: ${currentEnergi}\n`
        if (currentEnergi < pc.energi && !m.isOwner && !m.isPartner) {
            result += `⛔ Energi kamu tidak cukup\n`
        }
    }

    if (pc.cooldown > 0 && !m.isOwner && !m.isPartner) {
        const cooldownRemaining = db.checkCooldown(m.sender, pc.name, pc.cooldown)
        if (cooldownRemaining) {
            result += `⏱️ Command ini masih dalam *cooldown*\n`
        } else {
            result += `✅ Tidak ada cooldown aktif\n`
        }
    }

    result += `\n💡 *Catatan:* Ini cuma simulasi, command beneran *tidak dieksekusi* dan limit *tidak terpotong* ya~ 🌸`

    return m.reply(result, { mentions: m.mentionedJid || [] })
}

module.exports = { config: pluginConfig, handler }