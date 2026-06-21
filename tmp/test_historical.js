const symbol = 'BBAS3.SA';
const startDateStr = '2026-04-03';
const period1 = Math.floor(new Date(startDateStr).getTime() / 1000);
const period2 = Math.floor(Date.now() / 1000) + 86400;

const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${period1}&period2=${period2}`;

async function test() {
  try {
    console.log('Fetching:', url);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const json = await response.json();
    const result = json.chart?.result?.[0];
    if (result) {
      console.log('Has timestamps:', Array.isArray(result.timestamp));
      console.log('Timestamp count:', result.timestamp?.length);
      console.log('First timestamp:', result.timestamp?.[0]);
      console.log('First timestamp date:', new Date(result.timestamp?.[0] * 1000).toISOString());
      console.log('Last timestamp date:', new Date(result.timestamp[result.timestamp.length - 1] * 1000).toISOString());
      
      const quotes = result.indicators?.quote?.[0];
      console.log('First close price:', quotes?.close?.[0]);
      console.log('Last close price:', quotes?.close[quotes.close.length - 1]);
      
      // Check if there are any nulls or invalid values in the close price array
      const nullCount = quotes?.close?.filter(x => x === null || x === undefined).length;
      console.log('Null price count:', nullCount);
    } else {
      console.log('No result found in chart');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
