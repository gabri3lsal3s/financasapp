const XLSX = require('xlsx');
const fs = require('fs');

try {
  const filePath = 'movimentacao-2026-05-27-00-50-50.xlsx';
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet);
  
  if (rows.length === 0) {
    console.log("No rows found!");
    process.exit(0);
  }
  
  console.log("=== COLUMNS ===");
  console.log(Object.keys(rows[0]));
  
  console.log("\n=== DISTINCT MOVEMENT TYPES ===");
  const movements = new Set();
  const movementDirs = {};
  rows.forEach(r => {
    // Find the movement column
    const movCol = Object.keys(r).find(k => k.toLowerCase().includes('movimentacao') || k.toLowerCase().includes('movimenta'));
    const dirCol = Object.keys(r).find(k => k.toLowerCase().includes('tipo') || k.toLowerCase().includes('entrada/saida') || k.toLowerCase().includes('sentido'));
    if (movCol) {
      const val = r[movCol];
      movements.add(val);
      if (!movementDirs[val]) movementDirs[val] = new Set();
      if (dirCol) {
        movementDirs[val].add(r[dirCol]);
      }
    }
  });
  
  for (const m of movements) {
    console.log(`- "${m}" [Directions: ${Array.from(movementDirs[m]).join(', ')}]`);
  }
  
  console.log("\n=== SAMPLE ROWS (first 10) ===");
  console.log(JSON.stringify(rows.slice(0, 10), null, 2));
} catch (err) {
  console.error("Error reading Excel:", err);
}
