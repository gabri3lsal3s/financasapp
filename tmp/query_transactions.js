import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const env = {}
for (const line of envContent.split('\n')) {
  const parts = line.split('=')
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim()
  }
}

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  const { data: txs, error } = await supabase
    .from('portfolio_transactions')
    .select('*')
    .eq('portfolio_id', '1bb0c5bf-d8ae-4276-bee7-d3169c4fe09d')
    .order('date', { ascending: true })

  if (error) {
    console.error(error)
    return
  }

  console.log(`Total transactions: ${txs.length}`)
  for (const t of txs) {
    console.log(`${t.date}: ${t.operation_type} ${t.quantity} of ${t.ticker} @ ${t.price}`)
  }
}

run()
