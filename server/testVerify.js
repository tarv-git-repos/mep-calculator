import http from 'http';

const data = JSON.stringify({
  email: "testuser@example.com",
  otp: "652015"
});

const req = http.request({
  hostname: 'localhost',
  port: 4000,
  path: '/api/auth/verify-account',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let responseData = '';
  res.on('data', (chunk) => { responseData += chunk; });
  res.on('end', () => {
    console.log("Verify Response Status:", res.statusCode);
    console.log("Verify Response Body:", responseData);
  });
});

req.write(data);
req.end();
