const https = require("https")

const API_KEY = "dac23a9006fc4039ae6aac98ae7c7b46"

async function generateCustomTTS(speakerId, text) {
  // Coba topmediai dulu
  try {
    const url = await topMediaTTS(speakerId, text)
    if (url) return url
  } catch (e) {
    console.log('[TTS] topmediai gagal:', e.message, '— fallback ke nexray...')
  }

  // Fallback ke nexray
  try {
    const res = await fetch(`https://api.nexray.web.id/ai/gemini-tts?text=${encodeURIComponent(text)}`)
    const json = await res.json()
    const url = json?.result
    if (!url) throw new Error('nexray tidak mengembalikan URL')
    return url
  } catch (e) {
    throw new Error('Semua TTS provider gagal: ' + e.message)
  }
}

function topMediaTTS(speakerId, text) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      text: text,
      speaker: speakerId || "001526de-3826-11ee-a861-00163e2ac61b",
      emotion: "Happy"
    })

    const options = {
      hostname: "api.topmediai.com",
      path: "/v1/text2speech",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "Content-Length": Buffer.byteLength(postData)
      }
    }

    const req = https.request(options, res => {
      let data = ""
      res.on("data", chunk => data += chunk)
      res.on("end", () => {
        try {
          const json = JSON.parse(data)
          console.log('[TTS] topmediai response:', JSON.stringify(json))
          const audioUrl = json?.data?.oss_url
          if (!audioUrl) return reject(new Error("No audio URL from topmediai"))
          resolve(audioUrl)
        } catch (e) {
          reject(e)
        }
      })
    })

    req.on("error", reject)
    req.write(postData)
    req.end()
  })
}

module.exports = generateCustomTTS
