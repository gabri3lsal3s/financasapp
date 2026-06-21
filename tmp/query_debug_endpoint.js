async function queryRoot() {
  const url = 'https://roynkajkdheoharcpiyj.supabase.co/functions/v1/daily-close';
  try {
    const res = await fetch(url);
    console.log('Root status:', res.status);
    const text = await res.text();
    console.log('Root response text:', text.slice(0, 200));
  } catch (err) {
    console.error(err);
  }
}
queryRoot();
