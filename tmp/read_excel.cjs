const XLSX = require('xlsx');
const fs = require('fs');

try {
  const filePath = 'movimentacao-2026-05-25-18-03-48 (1).xlsx';
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet);
  
  console.log("=== CXSE3 Row Data in Excel ===");
  const matches = rows.filter(row => {
    const values = Object.values(row).map(v => String(v).toUpperCase());
    return values.some(v => v.includes('CXSE3') || v.includes('CAIXA SEGURIDADE'));
  });
  
  console.log(JSON.stringify(matches, null, 2));
} catch (err) {
  console.error("Error reading Excel:", err);
}
