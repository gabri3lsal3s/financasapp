import fs from 'fs'
import path from 'path'

const dbDir = '/home/gabrielsales/.var/app/com.google.Chrome/config/google-chrome/Default/Local Storage/leveldb'

function run() {
  const files = fs.readdirSync(dbDir)
  for (const file of files) {
    const filePath = path.join(dbDir, file)
    const stats = fs.statSync(filePath)
    if (!stats.isFile()) continue

    try {
      const content = fs.readFileSync(filePath, 'binary')
      const index = content.indexOf('sb-roynkajkdheoharcpiyj-auth-token')
      if (index !== -1) {
        console.log(`Found token reference in: ${file} at index ${index}`)
        const slice = content.substring(index, index + 4000)
        // Let's print clean characters
        let clean = ''
        for (let i = 0; i < slice.length; i++) {
          const code = slice.charCodeAt(i)
          if (code >= 32 && code <= 126) {
            clean += slice[i]
          } else {
            clean += '.'
          }
        }
        console.log('SLICE:', clean.substring(0, 1000))
      }
    } catch (err) {
      console.error(err)
    }
  }
}

run()
