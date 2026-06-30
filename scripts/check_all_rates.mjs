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
  try {
    // Query index_rates
    console.log('Querying index_rates...')
    const { data: indexRates, error: ratesError } = await supabase.from('index_rates').select('*').limit(20)
    if (ratesError) console.error('Rates error:', ratesError)
    else console.log('index_rates (first 20):', indexRates)

    // Query portfolios
    console.log('Querying portfolios...')
    const { data: portfolios, error: portError } = await supabase.from('portfolios').select('*')
    if (portError) console.error('Portfolios error:', portError)
    else console.log('portfolios:', portfolios)

    // Query asset definitions
    console.log('Querying definitions...')
    const { data: definitions, error: defError } = await supabase.from('portfolio_asset_definitions').select('*')
    if (defError) console.error('Definitions error:', defError)
    else console.log('definitions:', definitions)

    // Query transactions
    console.log('Querying transactions...')
    const { data: transactions, error: txError } = await supabase.from('portfolio_transactions').select('*')
    if (txError) console.error('Transactions error:', txError)
    else console.log('transactions:', transactions)
  } catch (err) {
    console.error('Unexpected error:', err)
  }
}

run()
