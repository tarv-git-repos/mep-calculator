import http from 'http';

const data = JSON.stringify({
  email: "admin@tarv.ai",
  password: "admin@tarv.ai"
});

const req = http.request({
  hostname: 'localhost',
  port: 4000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let responseData = '';
  res.on('data', (chunk) => { responseData += chunk; });
  res.on('end', () => {
    console.log("Admin Login Status:", res.statusCode);
    console.log("Admin Login Response:", responseData);
  });
});

req.write(data);
req.end();
