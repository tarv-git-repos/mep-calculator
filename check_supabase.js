async function test() {
  const url = 'https://ttqgrcmesxrnujmhesnk.supabase.co/rest/v1/custom_users?select=*';
  const apikey = 'sb_publishable_wT2VLfy-bH-r5ZWi3IcWKQ_QEO0yAfI';
  
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': apikey,
        'Authorization': `Bearer ${apikey}`
      }
    });
    const data = await res.json();
    const admin = data.find(u => u.email === 'admin@tarv.ai');
    console.log("Admin details:", admin);
  } catch(e) {
    console.error(e.message);
  }
}
test();
