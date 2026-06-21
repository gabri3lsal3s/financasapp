async function testSearch() {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=BTC&quotesCount=10&newsCount=0`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const data = await res.json();
    console.log(JSON.stringify(data.quotes, null, 2));
  } catch (err) {
    console.error(err);
  }
}
testSearch();
