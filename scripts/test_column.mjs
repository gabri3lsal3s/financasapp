import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://roynkajkdheoharcpiyj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJveW5rYWprZGhlb2hhcmNwaXlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NjA2NjMsImV4cCI6MjA4NTAzNjY2M30.H8GInhW-2MmNehjwE6Vh8YIGYNSErR4uBCjNPFMg7yo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Testing column existence on portfolio_share_daily...');
  const { data, error } = await supabase
    .from('portfolio_share_daily')
    .select('cash_value, invested_cost')
    .limit(1);

  if (error) {
    console.error('Error selecting columns:', error);
  } else {
    console.log('Columns cash_value and invested_cost exist! Data:', data);
  }
}

run().catch(console.error);
