import fs from 'fs'

try {
  const content = fs.readFileSync('/home/gabrielsales/.gemini/antigravity-browser-profile/Default/Local Storage/leveldb/000003.log')
  // Find all printable ascii strings of length >= 20
  const matches = content.toString('binary').match(/[\x20-\x7E]{20,}/g)
  if (matches) {
    for (const match of matches) {
      if (match.includes('access_token') || match.includes('refresh_token') || match.includes('roynkajkdheoharcpiyj')) {
        console.log('FOUND MATCH:')
        console.log(match)
      }
    }
  } else {
    console.log('No printable strings found.')
  }
} catch (err) {
  console.error(err)
}
