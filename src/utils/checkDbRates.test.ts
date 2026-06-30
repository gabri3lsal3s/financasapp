import { describe, it } from 'vitest'
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

describe('Database Inspector', () => {
  it('checks rates in DB', async () => {
    // Sign up temp user
    const email = `gabriel_inspector_${Math.floor(Math.random() * 100000)}@gmail.com`
    const password = 'TempPassword123!'
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })

    let result: any = {
      signUpData,
      signUpError: signUpError ? { message: signUpError.message, status: signUpError.status } : null
    }

    if (signUpData.user || signUpData.session) {
      // Query index_rates
      const { data: indexRates, error: ratesError } = await supabase.from('index_rates').select('*').limit(100)
      
      // Query vna_daily
      const { data: vnaDaily, error: vnaError } = await supabase.from('vna_daily').select('*').limit(10)

      // Query asset_price_daily
      const { data: assetPriceDaily, error: priceError } = await supabase.from('asset_price_daily').select('*').limit(10)

      // Query portfolios
      const { data: portfolios, error: portfoliosError } = await supabase.from('portfolios').select('*').limit(10)

      result = {
        ...result,
        indexRates,
        ratesError,
        vnaDaily,
        vnaError,
        assetPriceDaily,
        priceError,
        portfolios,
        portfoliosError
      }
    }

    fs.writeFileSync('tmp_inspector_results.json', JSON.stringify(result, null, 2))
  })
})

