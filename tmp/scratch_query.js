const symbol = 'PETR4.SA';
const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;

async function test() {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const json = await response.json();
    const meta = json.chart?.result?.[0]?.meta;
    console.log('Regular Market Price:', meta?.regularMarketPrice);
    console.log('Chart Price (meta.chartPreviousClose):', meta?.chartPreviousClose);
    console.log('Keys in meta:', Object.keys(meta || {}));
    console.log('Full JSON response:', JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
