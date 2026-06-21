async function testSymbols() {
  const symbols = ['BTC-USD', 'BTC-BRL', 'BTCBRL=X', 'BTC'];
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };
  
  for (const sym of symbols) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`;
    try {
      const res = await fetch(url, { headers });
      console.log(`Symbol ${sym}: status ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`  Price:`, data?.chart?.result?.[0]?.meta?.regularMarketPrice);
      }
    } catch (e) {
      console.log(`Symbol ${sym} error:`, e.message);
    }
  }
}
testSymbols();
