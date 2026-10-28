const { existsSync } = require('fs')
const { execSync } = require('child_process')

if (!existsSync('node_modules/.package-lock.json')) {
  console.log('First run: installing dependencies, tunggu sebentar...')
  try {
    execSync('npm install', { stdio: 'inherit' })
  } catch (err) {
    console.error('\n[ensure-deps] npm install GAGAL. Scroll ke atas, cari baris "npm error" pertama buat tahu paket mana yang bermasalah.')
    process.exit(1)
  }
}
