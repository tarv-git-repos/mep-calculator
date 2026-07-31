import http from 'http';

const data = JSON.stringify({
  name: "Aftaab",
  email: "aftaabm0724@gmail.com",
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
    console.log("Unverified Register Status:", res.statusCode);
    console.log("Unverified Register Response:", responseData);
  });
});

req.write(data);
req.end();
