async function test() {
  try {
    const res = await fetch('https://universal-mep-calculator.onrender.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@tarv.ai', password: 'admin123' })
    });
    const data = await res.json();
    console.log(data);
  } catch(e) {
    console.error(e.message);
  }
}
test();
