const chalk = require("chalk")
const gradient = require("gradient-string")
const figlet = require("figlet")
const timeHelper = require("./timeHelper")

const g = gradient([
  "#FF6EC7",
  "#C084FC",
  "#60A5FA"
])

const t = {
  p: chalk.hex("#FF6EC7"),
  s: chalk.hex("#C084FC"),
  a: chalk.hex("#60A5FA"),
  t: chalk.hex("#F9FAFB"),
  d: chalk.hex("#9CA3AF"),
  m: chalk.hex("#6B7280"),
  ok: chalk.hex("#34D399"),
  no: chalk.hex("#F87171"),
  wn: chalk.hex("#FBBF24"),
  in: chalk.hex("#60A5FA"),
  db: chalk.hex("#6B7280"),
  bd: chalk.hex("#4B5563"),
  tg: chalk.hex("#F472B6"),
}

function ts() {
  return t.d(`${timeHelper.formatTime("HH:mm")}`)
}

function pad(label) {
  return t.d(label.toLowerCase().padEnd(12))
}

const logger = {
  info: (label, detail = "") => {
    console.log(`  ${t.in("›")} ${pad(label)} ${t.t(detail)}`)
  },

  success: (label, detail = "") => {
    console.log(`  ${t.ok("✓")} ${pad(label)} ${t.t(detail)}`)
  },

  warn: (label, detail = "") => {
    console.log(`  ${t.wn("!")} ${pad(label)} ${t.wn(detail)}`)
  },

  error: (label, detail = "") => {
    console.log(`  ${t.no("✗")} ${pad(label)} ${t.no(detail)}`)
  },

  system: (label, detail = "") => {
    console.log(`  ${t.d("·")} ${pad(label)} ${t.d(detail)}`)
  },

  debug: (label, detail = "") => {
    console.log(`  ${t.db("·")} ${pad(label)} ${t.db(detail)}`)
  },

  tag: (label, msg, detail = "") => {
    console.log(`  ${t.in("›")} ${pad(label)} ${t.t(msg)} ${t.d(detail)}`)
  },
}

function getTypeLabel(msgType, isNewsletter) {
  if (isNewsletter) return chalk.hex('#F59E0B')('[Saluran]')
  const map = {
    imageMessage: ['[Gambar]', '#34D399'],
    videoMessage: ['[Video]', '#60A5FA'],
    audioMessage: ['[Audio]', '#C084FC'],
    stickerMessage: ['[Stiker]', '#FBBF24'],
    documentMessage: ['[Dokumen]', '#F87171'],
    contactMessage: ['[Kontak]', '#A855F7'],
    locationMessage: ['[Lokasi]', '#10B981'],
    liveLocationMessage: ['[Live Lokasi]', '#10B981'],
    viewOnceMessageV2: ['[Sekali Lihat]', '#F59E0B'],
  }
  const entry = map[msgType]
  if (entry) return chalk.hex(entry[1])(entry[0])
  return chalk.hex('#6B7280')('[Teks]')
}

function logMessage(info) {
  const {
    chatType,
    groupName,
    pushName,
    sender,
    message,
    messageType,
    isNewsletter
  } = info

  if (!message || !sender) return

  const time = timeHelper.formatTime("HH:mm:ss")
  const isGroup = chatType === "group"

  const typeTag = getTypeLabel(messageType, isNewsletter)

  console.log("")
  console.log(chalk.hex("#FF6EC7")("╭──── ✦ HOSHINO AI STAGE ✦ ────╮"))
  console.log(`│ 🌟 Fan      : ${pushName}`)
  console.log(`│ 💬 Stage    : ${isGroup ? groupName : "Private Chat"}`)
  console.log(`│ 📦 Type     : ${messageType || "text"}`)
  console.log(`│ ⏰ Time     : ${time}`)
  console.log(chalk.hex("#FF6EC7")("╰─────────────────────────────╯"))
  console.log(` ${typeTag} ${message}`)
}

function logCommand(command, user, chatType) {
  const time = timeHelper.formatTime("HH:mm:ss")

  console.log("")
  console.log(chalk.hex("#C084FC")("╭──── ✦ PERFORMANCE ✦ ────╮"))
  console.log(`│ 👤 User     : ${user}`)
  console.log(`│ 🎯 Command  : ${command}`)
  console.log(`│ 💬 Chat     : ${chatType}`)
  console.log(`│ ⏰ Time     : ${time}`)
  console.log(chalk.hex("#C084FC")("╰─────────────────────────╯"))
}

function logPlugin(name, category) {
  console.log(`  ${t.d("  ├─")} ${t.p(name)} ${t.d(`[${category}]`)}`)
}

function logConnection(status, info = "") {
  console.log("")

  const state =
    status === "connected"
      ? "🌟 Stage Opened"
      : status === "connecting"
      ? "🎤 Preparing Stage"
      : "💔 Stage Closed"

  console.log(chalk.hex("#FF6EC7")("╭──── ✦ HOSHINO AI NETWORK ✦ ────╮"))
  console.log(`│ ${state}`)
  if (info) console.log(`│ ${info}`)
  console.log(`│ ${timeHelper.formatTime("HH:mm:ss")}`)
  console.log(chalk.hex("#FF6EC7")("╰────────────────────────────────╯"))
}

function logErrorBox(title, message) {
  console.log("")
  console.log(chalk.red(`  ✗ ${chalk.white.bold(title)}`))
  console.log(chalk.red(`    ${chalk.gray(message)}`))
  console.log("")
}

function printBanner(mini = false) {
  console.clear()

  if (mini) {
    console.log(g("  ✦ HOSHINO AI ✦"))
    console.log("")
    return
  }

  console.log("")
  console.log(chalk.hex("#C084FC")("╔══════════════════════════════════════╗"))
  console.log(chalk.hex("#FF6EC7")("║            ✦ HOSHINO AI ✦           ║"))
  console.log(chalk.hex("#60A5FA")("║         Idol Assistant Bot          ║"))
  console.log(chalk.hex("#C084FC")("╚══════════════════════════════════════╝"))
  console.log("")
}

function printStartup(info = {}) {
  const { name, version, mode } = info

  console.log(`  🌟 Bot      : ${name}`)
  console.log(`  🎀 Version  : ${version}`)
  console.log(`  💖 Mode     : ${mode}`)
  console.log(`  🎤 Status   : Ready`)
  console.log("")
}

const CODES = {
  reset: "", bold: "", dim: "", italic: "", underline: "",
  green: "", purple: "", white: "", gray: "", phantom: "",
  lime: "", silver: "", red: "", yellow: "", blue: "",
  cyan: "", magenta: "", bgBlack: "", bgGray: "",
}

const c = {
  green: chalk.green,
  purple: chalk.hex("#9B30FF"),
  white: chalk.white,
  gray: chalk.gray,
  bold: chalk.bold,
  dim: chalk.dim,
  greenBold: (v) => chalk.green.bold(v),
  purpleBold: (v) => chalk.hex("#9B30FF").bold(v),
  whiteBold: (v) => chalk.white.bold(v),
  grayDim: (v) => chalk.gray.dim(v),
  red: chalk.red,
  yellow: chalk.yellow,
  cyan: chalk.cyan,
  blue: chalk.blue,
  magenta: chalk.magenta,
}

function divider() {
  console.log(chalk.hex("#374151")("────────────────────────────────────────────"))
}

function createBanner(lines, color = "green") {
  const maxLen = Math.max(...lines.map((l) => l.length))
  const padded = lines.map((l) => l.padEnd(maxLen))
  let res = t.bd(`╭${"─".repeat(maxLen + 2)}╮`) + "\n"
  for (const line of padded) {
    res += t.bd("│") + " " + chalk.white(line) + " " + t.bd("│") + "\n"
  }
  res += t.bd(`╰${"─".repeat(maxLen + 2)}╯`)
  return res
}

function getTimestamp() {
  return t.d(timeHelper.formatTime("HH:mm:ss"))
}

module.exports = {
  c,
  CODES,
  logger,
  logMessage,
  logCommand,
  logPlugin,
  logConnection,
  logErrorBox,
  printBanner,
  printStartup,
  createBanner,
  getTimestamp,
  divider,
  theme: {
    ...t,
    primary: t.p,
    secondary: t.s,
    accent: t.a,
    text: t.t,
    dim: t.d,
    muted: t.m,
    success: t.ok,
    error: t.no,
    warning: t.wn,
    info: t.in,
    debug: t.db,
    border: t.bd,
    tag: t.tg,
  },
  chalk,
  gradient,
}