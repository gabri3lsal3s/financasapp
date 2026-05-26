const supabaseUrl = 'https://roynkajkdheoharcpiyj.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJveW5rYWprZGhlb2hhcmNwaXlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NjA2NjMsImV4cCI6MjA4NTAzNjY2M30.H8GInhW-2MmNehjwE6Vh8YIGYNSErR4uBCjNPFMg7yo'

async function run() {
  try {
    console.log("Fetching portfolios from Supabase Rest endpoint...")
    const res = await fetch(`${supabaseUrl}/rest/v1/portfolios?select=*`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    })
    console.log("Status:", res.status)
    console.log("Status Text:", res.statusText)
    console.log("Headers:", Object.fromEntries(res.headers.entries()))
    const body = await res.text()
    console.log("Response Body:", body)
  } catch (err) {
    console.error("Network or fetch error:", err)
  }
}

run()
