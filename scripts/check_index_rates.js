const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJveW5rYWprZGhlb2hhcmNwaXlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NjA2NjMsImV4cCI6MjA4NTAzNjY2M30.H8GInhW-2MmNehjwE6Vh8YIGYNSErR4uBCjNPFMg7yo";
const baseUrl = "https://roynkajkdheoharcpiyj.supabase.co/rest/v1";

async function run() {
  const headers = {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json'
  };

  const portfolioId = "1bb0c5bf-d8ae-4276-bee7-d3169c4fe09d";

  try {
    // 1. Buscar transações
    const txsRes = await fetch(`${baseUrl}/portfolio_transactions?portfolio_id=eq.${portfolioId}`, { headers });
    const txs = await txsRes.json();
    console.log("Transações do portfolio:", JSON.stringify(txs, null, 2));

    // 2. Buscar definições de ativos
    const defsRes = await fetch(`${baseUrl}/portfolio_asset_definitions?portfolio_id=eq.${portfolioId}`, { headers });
    const defs = await defsRes.json();
    console.log("Definições de ativos do portfolio:", JSON.stringify(defs, null, 2));

  } catch (error) {
    console.error("Erro ao executar requisições:", error);
  }
}

run();
