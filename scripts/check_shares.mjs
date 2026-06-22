import fs from 'fs';
const data = JSON.parse(fs.readFileSync('tmp_dump.json', 'utf8'));
console.log('Txs count:', data.txs?.length);
console.log('Shares count:', data.shares?.length);
if (data.shares && data.shares.length > 0) {
  console.log('Shares sample (first 3):', data.shares.slice(0, 3));
  console.log('Shares sample (last 3):', data.shares.slice(-3));
}
