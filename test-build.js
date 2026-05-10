import { build } from 'vite'
import fs from 'fs'

async function run() {
  try {
    await build()
    fs.writeFileSync('error.txt', 'Build successful')
  } catch (e) {
    fs.writeFileSync('error.txt', Object.getOwnPropertyNames(e).map(k => `${k}: ${e[k]}`).join('\n') + '\n\n' + e.message)
  }
}

run()
