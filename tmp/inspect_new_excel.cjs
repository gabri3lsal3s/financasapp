const XLSX = require('xlsx');
const fs = require('fs');

try {
  const filePath = 'movimentacao-2026-05-27-00-50-50.xlsx';
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet);
  
  const movSamples = {};
  rows.forEach(r => {
    const movCol = Object.keys(r).find(k => k.toLowerCase().includes('movimentacao') || k.toLowerCase().includes('movimenta'));
    if (movCol) {
      const val = r[movCol];
      if (!movSamples[val]) {
        movSamples[val] = r;
      }
    }
  });
  
  console.log("=== ONE SAMPLE FOR EACH MOVEMENT TYPE ===");
  for (const [mov, sample] of Object.entries(movSamples)) {
    console.log(`\nMovement: "${mov}"`);
    console.log(JSON.stringify(sample, null, 2));
  }
} catch (err) {
  console.error("Error reading Excel:", err);
}
