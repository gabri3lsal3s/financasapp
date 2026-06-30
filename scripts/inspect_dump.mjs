import fs from 'fs'

const data = JSON.parse(fs.readFileSync('tmp_dump.json', 'utf8'))
console.log('Keys in tmp_dump.json:', Object.keys(data))

console.log('\n--- PORTFOLIOS ---')
console.log(data.portfolios)

console.log('\n--- DEFINITIONS (first 5) ---')
console.log(data.definitions?.slice(0, 5))

console.log('\n--- TRANSACTIONS (first 5) ---')
console.log(data.txs?.slice(0, 5))

console.log('\n--- SHARES (first 5) ---')
console.log(data.shares?.slice(0, 5))
