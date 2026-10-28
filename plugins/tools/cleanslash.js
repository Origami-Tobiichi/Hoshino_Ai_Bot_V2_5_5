const pluginConfig = {
    name: 'cleanslash',
    alias: ['cleanjs', 'nocmt', 'rmcomment'],
    category: 'tools',
    description: 'Hapus komentar dari kode (Premium Only)',
    usage: '.nocmt <nama optional> (reply text / file)',
    cooldown: 5,
    energi: 1,
    isPremium: true,
    isOwner: false,
    isEnabled: true
}

function removeComments(code) {
    let result = ''
    let i = 0
    let canStartRegex = true

    const isWhitespace = char => /\s/.test(char)

    const isRegexStart = () => {
        let j = result.length - 1

        while (j >= 0 && isWhitespace(result[j])) j--

        if (j < 0) return true

        const prev = result[j]

        // Setelah karakter-karakter ini, `/.../` kemungkinan besar regex
        return /[({[=,:;!&|?+\-*%^~<>]/.test(prev) ||
            result.endsWith('return') ||
            result.endsWith('throw') ||
            result.endsWith('case') ||
            result.endsWith('delete') ||
            result.endsWith('void') ||
            result.endsWith('typeof') ||
            result.endsWith('instanceof') ||
            result.endsWith('in') ||
            result.endsWith('of') ||
            result.endsWith('yield') ||
            result.endsWith('await')
    }

    while (i < code.length) {
        const char = code[i]
        const next = code[i + 1]

        // ==========================================
        // BLOCK COMMENT
        // ==========================================
        if (char === '/' && next === '*') {
            i += 2

            while (i < code.length) {
                if (code[i] === '*' && code[i + 1] === '/') {
                    i += 2
                    break
                }

                // Pertahankan newline agar struktur kode tidak rusak
                if (code[i] === '\n') {
                    result += '\n'
                }

                i++
            }

            canStartRegex = true
            continue
        }

        // ==========================================
        // LINE COMMENT
        // ==========================================
        if (char === '/' && next === '/') {
            i += 2

            while (i < code.length && code[i] !== '\n') {
                i++
            }

            // Pertahankan newline
            if (code[i] === '\n') {
                result += '\n'
                i++
            }

            canStartRegex = true
            continue
        }

        // ==========================================
        // STRING
        // ==========================================
        if (char === '"' || char === "'") {
            const quote = char

            result += char
            i++

            while (i < code.length) {
                const current = code[i]

                // Escape sequence
                if (current === '\\') {
                    result += current
                    i++

                    if (i < code.length) {
                        result += code[i]
                        i++
                    }

                    continue
                }

                result += current
                i++

                if (current === quote) {
                    break
                }
            }

            canStartRegex = false
            continue
        }

        // ==========================================
        // TEMPLATE LITERAL
        // ==========================================
        if (char === '`') {
            result += char
            i++

            while (i < code.length) {
                const current = code[i]

                if (current === '\\') {
                    result += current
                    i++

                    if (i < code.length) {
                        result += code[i]
                        i++
                    }

                    continue
                }

                result += current
                i++

                if (current === '`') {
                    break
                }
            }

            canStartRegex = false
            continue
        }

        // ==========================================
        // REGEX LITERAL
        // ==========================================
        if (
            char === '/' &&
            next !== '/' &&
            next !== '*' &&
            canStartRegex &&
            isRegexStart()
        ) {
            result += char
            i++

            let inClass = false

            while (i < code.length) {
                const current = code[i]

                // Escape dalam regex
                if (current === '\\') {
                    result += current
                    i++

                    if (i < code.length) {
                        result += code[i]
                        i++
                    }

                    continue
                }

                // Character class [...]
                if (current === '[') {
                    inClass = true
                    result += current
                    i++
                    continue
                }

                if (current === ']') {
                    inClass = false
                    result += current
                    i++
                    continue
                }

                // Slash penutup regex
                if (current === '/' && !inClass) {
                    result += current
                    i++

                    // Regex flags: g, i, m, s, u, y, d, v
                    while (i < code.length && /[a-zA-Z]/.test(code[i])) {
                        result += code[i]
                        i++
                    }

                    break
                }

                result += current
                i++
            }

            canStartRegex = false
            continue
        }

        // ==========================================
        // NORMAL CHARACTER
        // ==========================================
        result += char

        if (!isWhitespace(char)) {
            // Karakter yang biasanya memungkinkan regex berikutnya
            if (
                char === '(' ||
                char === '{' ||
                char === '[' ||
                char === '=' ||
                char === ':' ||
                char === ',' ||
                char === ';' ||
                char === '!' ||
                char === '&' ||
                char === '|' ||
                char === '?' ||
                char === '+' ||
                char === '-' ||
                char === '*' ||
                char === '%' ||
                char === '^' ||
                char === '~' ||
                char === '<' ||
                char === '>'
            ) {
                canStartRegex = true
            } else {
                canStartRegex = false
            }
        }

        i++
    }

    return result
        .split('\n')
        .map(line => line.trimEnd())
        .filter((line, index, arr) => {
            return !(line === '' && arr[index - 1] === '')
        })
        .join('\n')
        .trim()
}

async function extractInput(m) {
    let input = ''

    if (m.args?.length) input = m.args.join(' ')

    if (!input && m.quoted?.body) input = m.quoted.body

    if (!input && m.quoted?.isDocument) {
        try {
            const buffer = await m.quoted.download()
            input = buffer.toString('utf-8')
        } catch {
            return null
        }
    }

    return input
}

function checkAccess(m, config) {
    if (config.isOwner && !m.isOwner) return false
    if (config.isPremium && !m.isPremium && !m.isOwner) return false
    return true
}

function safeName(name) {
    return (name || 'cleaned')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 30)
}

function resolveFileName(args, pluginConfigName, hasQuoted) {
    const raw = args?.join(' ')?.trim()

    if (raw && raw.length > 0) {
        return safeName(raw)
    }

    if (hasQuoted) {
        return safeName(pluginConfigName || 'cleanslash')
    }

    return 'output'
}

function extractPluginConfigName(code) {
    if (!code) return null
    const match = code.match(/name\s*:\s*['"`]([^'"`]+)['"`]/i)
    return match ? match[1] : null
}

async function handler(m, { sock }) {
    if (!checkAccess(m, pluginConfig)) {
        return m.reply('💎 fitur ini khusus premium ya~')
    }

    m.react('✨')

    const input = await extractInput(m)
    let extractedPluginName = null

    if (m.quoted) {
        const code = m.quoted.body || (await m.quoted.download?.())?.toString('utf-8')
        extractedPluginName = extractPluginConfigName(code)
    }

    if (!input) {
        return m.reply(
`💖 Hee~ kirim kode ya

📌 Bisa:
• reply file .js
• reply caption
• .nocmt <nama optional>`
        )
    }

    try {
        const cleaned = removeComments(input)

        const finalName = resolveFileName(
            m.args,
            extractedPluginName || pluginConfig.name,
            !!m.quoted
        )

        if (cleaned.length > 3000) {
            return m.replyDocument(
                Buffer.from(cleaned),
                `${finalName}.js`,
                'application/javascript',
                {
                    caption:
`💖 Hee~ Ai udah bersihin kode kamu ya~

📁 File: ${finalName}.js
✨ Jangan lupa jaga kode kamu tetap rapi ya~`
                }
            )
        }

        await sock.sendCodehsn(
            m.chat,
            cleaned,
            'javascript',
            m,
            {
                header:
`💎 Clean Result Hoshino Ai

📁 Name: ${finalName}.js`,
                footer: '✨ Jangan lupa jaga kode kamu tetap rapi ya~'
            }
        )

        m.react('💖')

    } catch (err) {
        console.error(err)
        m.react('💔')
        m.reply('gagal clean kode~')
    }
}

module.exports = {
    config: pluginConfig,
    handler
}