import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    envVars[key] = val;
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    // 1. Get transactions (we bypass RLS if we have the service role key, but let's see what we can read with the anon key)
    // Wait, the client_id RLS requires us to sign in or use the service role key.
    // Wait! Let's check if we can sign in.
    // Let's see if we can find any users or if we can read the transactions table.
    const { data: txs, error: txError } = await supabase.from('portfolio_transactions').select('*');
    if (txError) {
      console.log('Error reading transactions directly:', txError.message);
    } else {
      console.log('Transactions directly read:', txs);
    }
  } catch (err) {
    console.error(err);
  }
}

check();
