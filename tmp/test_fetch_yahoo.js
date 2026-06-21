// Mock of Yahoo Finance fetch logic in supabase/functions/daily-close/index.ts

const tickers = ['BBAS3', 'VALE3', 'BTC', 'ETH'];
const startDate = '2026-05-19';
const period1 = Math.floor(new Date(startDate).getTime() / 1000);
const period2 = Math.floor(Date.now() / 1000) + 86400;

console.log(`Calculating for period1: ${period1} (${startDate}) to period2: ${period2}`);

async function testFetch() {
  const prices = {};
  for (const ticker of tickers) {
    try {
      let symbol = ticker;
      if (['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOT', 'USDT'].includes(ticker)) {
        symbol = `${ticker}-BRL`;
      } else {
        const isB3 = /^[A-Z]{4}[0-9]{1,2}$/.test(ticker);
        symbol = isB3 ? `${ticker}.SA` : ticker;
      }
      
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${period1}&period2=${period2}`;
      console.log(`\nFetching ${ticker} from URL: ${url}`);
      
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        const result = data?.chart?.result?.[0];
        if (result) {
          const currentPrice = result.meta?.regularMarketPrice;
          if (currentPrice !== undefined) {
            prices[ticker] = currentPrice;
            console.log(`Current price for ${ticker}: ${currentPrice}`);
          }
          
          const timestamps = result.timestamp || [];
          const quotes = result.indicators?.quote?.[0]?.close || [];
          const upsertData = [];
          
          for (let i = 0; i < timestamps.length; i++) {
            const ts = timestamps[i];
            if (typeof ts === 'number' && !isNaN(ts)) {
              const priceDate = new Date(ts * 1000).toISOString().slice(0, 10);
              const closePrice = quotes[i];
              if (closePrice !== null && closePrice !== undefined && closePrice > 0) {
                upsertData.push({
                  ticker,
                  price_date: priceDate,
                  close_price: closePrice,
                  source: 'yahoo'
                });
              }
            }
          }
          
          console.log(`Prepared ${upsertData.length} daily price points to upsert.`);
          if (upsertData.length > 0) {
            console.log(`First row:`, upsertData[0]);
            console.log(`Last row:`, upsertData[upsertData.length - 1]);
          }
        } else {
          console.warn(`No result found for ${ticker}`);
        }
      } else {
        console.warn(`Failed to fetch ${ticker}, status: ${res.status}`);
      }
    } catch (err) {
      console.error(`Error fetching ${ticker}:`, err);
    }
  }
}

testFetch();
