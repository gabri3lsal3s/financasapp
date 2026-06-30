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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY)

async function run() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
  
  if (error) {
    console.error('Error fetching profiles:', error)
  } else {
    console.log('Profiles fetched:', data)
  }
}

run()
