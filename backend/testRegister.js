import http from 'http';

const data = JSON.stringify({
  name: "Test Engineer",
  email: "testuser@example.com",
  password: "Password123!"
});

const req = http.request({
  hostname: 'localhost',
  port: 4000,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let responseData = '';
  res.on('data', (chunk) => { responseData += chunk; });
  res.on('end', () => {
    console.log("Register Response Status:", res.statusCode);
    console.log("Register Response Body:", responseData);
  });
});

req.on('error', (e) => {
  console.error("Register Error:", e.message);
});

req.write(data);
req.end();
