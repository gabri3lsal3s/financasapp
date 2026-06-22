import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://roynkajkdheoharcpiyj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJveW5rYWprZGhlb2hhcmNwaXlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NjA2NjMsImV4cCI6MjA4NTAzNjY2M30.H8GInhW-2MmNehjwE6Vh8YIGYNSErR4uBCjNPFMg7yo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Querying portfolio transactions...');
  const { data: txs, error } = await supabase
    .from('portfolio_transactions')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching transactions:', error);
    return;
  }

  console.log(`Found ${txs.length} transactions.`);
  
  // Group by ticker
  const byTicker = {};
  txs.forEach(t => {
    if (!byTicker[t.ticker]) byTicker[t.ticker] = [];
    byTicker[t.ticker].push(t);
  });

  console.log('\nTickers summary:');
  for (const ticker of Object.keys(byTicker)) {
    console.log(`- ${ticker}: ${byTicker[ticker].length} transactions`);
  }

  // Get portfolio details
  const { data: portfolios, error: pError } = await supabase
    .from('portfolios')
    .select('*');
  console.log('\nPortfolios:', portfolios);

  // Get daily shares
  const { data: shares, error: sError } = await supabase
    .from('portfolio_share_daily')
    .select('*')
    .order('rate_date', { ascending: true });
  console.log(`\nFound ${shares?.length || 0} share history rows.`);
  if (shares && shares.length > 0) {
    console.log('First share row:', shares[0]);
    console.log('Last share row:', shares[shares.length - 1]);
    
    // Find min and max gross_pl
    let minGross = shares[0];
    let maxGross = shares[0];
    shares.forEach(s => {
      if (Number(s.gross_pl) < Number(minGross.gross_pl)) minGross = s;
      if (Number(s.gross_pl) > Number(maxGross.gross_pl)) maxGross = s;
    });
    console.log('Min gross_pl row:', minGross);
    console.log('Max gross_pl row:', maxGross);
  }
}

run();
