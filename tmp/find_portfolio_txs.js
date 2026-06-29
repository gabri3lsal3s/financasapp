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
  const { data: portfolios, error: pErr } = await supabase.from('portfolios').select('id')
  if (pErr) {
    console.error(pErr)
    return
  }

  console.log(`Checking ${portfolios.length} portfolios...`)
  for (const p of portfolios) {
    const { count, error } = await supabase
      .from('portfolio_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('portfolio_id', p.id)

    if (error) {
      console.error(error)
    } else {
      console.log(`Portfolio ${p.id}: ${count} transactions`)
    }
  }
}

run()
