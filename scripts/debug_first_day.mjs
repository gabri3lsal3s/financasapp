import fs from 'fs';

const data = JSON.parse(fs.readFileSync('tmp_dump.json', 'utf8'));

// Recreate the priceMap and ratesMap for 2023-10-19
const asOfDate = '2023-10-19';

const priceMap = {};
data.definitions.forEach(d => {
  priceMap[d.ticker.toUpperCase()] = {};
});

// Populate priceMap
data.shares.forEach(s => {
  // Wait, we don't have the daily prices in s, we have them in data.prices and we have some daily prices in data.shares?
  // Let's check where the daily prices are in the dump.
  // Oh, wait, we didn't dump asset_price_daily. We dumped asset_prices.
  // Let's look at the prices of each asset on 2023-10-19.
});

// Let's run a calculation simulation for 2023-10-19 using the transactions on that day.
const dayTxs = data.txs.filter(t => t.date <= asOfDate);
console.log('Transactions on or before 2023-10-19:');
console.log(dayTxs.map(t => ({ ticker: t.ticker, type: t.operation_type, q: t.quantity, p: t.price })));

// Let's calculate the positions like calculateSnapshotValuation does:
const txByTicker = {};
for (const tx of dayTxs) {
  const ticker = tx.ticker.toUpperCase();
  if (!txByTicker[ticker]) txByTicker[ticker] = [];
  txByTicker[ticker].push(tx);
}

const defByTicker = {};
data.definitions.forEach(d => {
  defByTicker[d.ticker.toUpperCase()] = d;
});

const legacyCashTickers = ['SALDO_INV', 'CAIXA', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA'];
const cashTickers = new Set([
  ...legacyCashTickers,
  ...data.definitions.filter(d => d.pricing_mode === 'cash').map(d => d.ticker.toUpperCase())
]);

const tickers = new Set([
  ...Object.keys(txByTicker),
  ...Object.keys(defByTicker)
]);

console.log('\n--- Asset breakdown on 2023-10-19 ---');
let totalInvested = 0;
let totalCostBasis = 0;

for (const ticker of tickers) {
  const txs = txByTicker[ticker] || [];
  if (txs.length === 0) continue;

  const definition = defByTicker[ticker];
  let quantity = 0;
  let totalCost = 0;
  const isCash = cashTickers.has(ticker);

  for (const tx of txs) {
    const q = Number(tx.quantity);
    const p = Number(tx.price);
    
    if (tx.operation_type === 'buy' || tx.operation_type === 'subscription') {
      if (isCash) {
        totalCost += q * p;
        quantity = totalCost;
      } else {
        quantity += q;
        totalCost += q * p;
      }
    } else if (tx.operation_type === 'sell') {
      if (isCash) {
        totalCost = Math.max(0, totalCost - q * p);
        quantity = totalCost;
      } else if (quantity > 0) {
        const pm = totalCost / quantity;
        quantity = Math.max(0, quantity - q);
        totalCost = quantity * pm;
      }
    }
  }

  if (quantity <= 0 && totalCost <= 0) continue;

  const pricingMode = isCash ? 'cash' : (definition?.pricing_mode ?? 'market');
  
  let val = 0;
  let currentPrice = 0;

  if (pricingMode === 'fixed_income') {
    // For simplicity, just use cost
    val = totalCost;
  } else if (pricingMode === 'manual_value') {
    val = definition?.manual_current_value ?? totalCost;
  } else if (pricingMode === 'cash') {
    val = totalCost;
  } else {
    // Check if we have prices in data.prices
    const pObj = data.prices.find(p => p.ticker.toUpperCase() === ticker);
    currentPrice = pObj ? Number(pObj.current_price) : 0;
    val = quantity * (currentPrice > 0 ? currentPrice : (quantity > 0 ? totalCost / quantity : 0));
  }

  console.log(`- ${ticker}: Qty=${quantity}, Cost=${totalCost}, Price=${currentPrice}, Val=${val}, Mode=${pricingMode}`);
  if (pricingMode !== 'cash') {
    totalInvested += val;
    totalCostBasis += totalCost;
  }
}
console.log('Total Invested Val:', totalInvested);
console.log('Total Cost Basis:', totalCostBasis);
