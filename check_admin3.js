async function test() {
  try {
    const res = await fetch('https://universal-mep-calculator.onrender.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@tarv.ai', password: 'admin@tarv.ai' })
    });
    const data = await res.json();
    console.log("Login success:", data.success);
    if(data.token) {
      console.log("Token received.");
      const res2 = await fetch('https://universal-mep-calculator.onrender.com/api/users/list', {
        headers: { 'Authorization': `Bearer ${data.token}` }
      });
      const data2 = await res2.json();
      console.log("Users list success:", data2.success);
      
      const res3 = await fetch('https://universal-mep-calculator.onrender.com/api/admin/update-profile', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${data.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: data2.users?.[0]?.id, updates: { features: {} } })
      });
      const data3 = await res3.json();
      console.log("Update profile:", data3);
    } else {
      console.log(data);
    }
  } catch(e) {
    console.error(e.message);
  }
}
test();
