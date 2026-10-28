async function chatWithApiKey({ message, instruction, imageBuffer, audioBuffer, history }) {
    const { GoogleGenerativeAI } = require('@google/generative-ai')
    const config = require('../../config')
    const apiKeys = Array.isArray(config.geminiApiKey) ? config.geminiApiKey : [config.geminiApiKey]
    if (!apiKeys.length || !apiKeys[0]) throw new Error('No API key (config.geminiApiKey kosong)')

    // gemini-flash-latest = alias yang otomatis ikut model terbaru yang di-support Google
    // (per Mei 2026 basisnya gemini-3.5-flash). gemini-2.5-flash/-lite DIHAPUS dari chain:
    // 2.5-flash-lite udah 404 (shutdown), 2.5-flash dijadwalin mati 16 Okt 2026 — diganti
    // generasi 3 (gemini-3.5-flash eksplisit + gemini-3-flash-lite, nama persis dari pesan
    // error 404 Google sendiri) sebagai cadangan.
    const MODELS = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.5-flash-lite']

    const contents = []

    if (history.length > 0) {
        for (const h of history.slice(-10)) {
            contents.push({
                role: h.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: h.content }]
            })
        }
    }

    // Media parts (gambar/storyboard DAN/ATAU audio) ditaruh sebelum teks pesan,
    // sesuai urutan yang disarankan Gemini buat multimodal input.
    const mediaParts = []
    if (imageBuffer) {
        mediaParts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBuffer.toString('base64') } })
    }
    if (audioBuffer) {
        // VN WhatsApp (hasil m.download()) biasanya buffer OGG/Opus mentah — mimeType
        // dasar "audio/ogg" cukup, Gemini gak butuh detail codec macam "codecs=opus".
        mediaParts.push({ inlineData: { mimeType: 'audio/ogg', data: audioBuffer.toString('base64') } })
    }

    if (mediaParts.length > 0) {
        contents.push({
            role: 'user',
            parts: [...mediaParts, { text: message }]
        })
    } else {
        contents.push({
            role: 'user',
            parts: [{ text: message }]
        })
    }

    let lastError = null

    for (const apiKey of apiKeys) {
        const genAI = new GoogleGenerativeAI(apiKey)

        for (const modelName of MODELS) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName })
                const result = await model.generateContent({
                    contents,
                    systemInstruction: instruction || undefined,
                    generationConfig: { maxOutputTokens: 4096, temperature: 0.8 }
                })

                const text = result.response.text()
                return { text: text.replace(/\*\*(.+?)\*\*/g, '*$1*'), raw: text, model: modelName }
            } catch (e) {
                console.log(`[GeminiVision] Gagal (key ${apiKey.slice(0, 8)}..., model ${modelName}):`, e.message)
                lastError = e
                // Kalau errornya soal API key (bukan soal model tertentu), skip ke key berikutnya.
                // Selain itu (quota, 404 model not found, dll) tetap coba model lain dulu di key yang sama.
                const isKeyError = /api.?key.*(invalid|not valid)|permission.?denied|unauthenticated/i.test(e.message)
                if (isKeyError) break
            }
        }
    }

    throw new Error('Semua API key & model gagal: ' + (lastError?.message || 'unknown'))
}

async function chat({ message, instruction = '', imageBuffer = null, audioBuffer = null, history = [] }) {
    try {
        return await chatWithApiKey({ message, instruction, imageBuffer, audioBuffer, history })
    } catch (e) {
        console.log('[GeminiVision] Semua API key gagal:', e.message)
        throw new Error('Gemini API gagal: ' + e.message)
    }
}

module.exports = { chat }