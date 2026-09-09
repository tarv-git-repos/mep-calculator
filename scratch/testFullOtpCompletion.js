import http from 'http';
import fs from 'fs';
import path from 'path';

function makeRequest(pathName, method, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 4000,
        path: pathName,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          ...headers,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, body });
          }
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTest() {
  const testEmail = `test_full_${Date.now()}@gmail.com`;
  const testPass = 'KaifPass@123';
  const testName = 'Test User Full';

  console.log(`\n--- 1. Registering (${testEmail}) ---`);
  const regRes = await makeRequest('/api/auth/register', 'POST', {
    name: testName,
    email: testEmail,
    password: testPass,
  });
  console.log('Reg Result:', regRes.data);

  // Read users JSON to get generated OTP
  const usersPath = path.join(process.cwd(), 'backend', 'data', 'users.json');
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  const targetUser = users.find(u => u.email === testEmail);

  if (!targetUser || !targetUser.verifyOtp) {
    console.error('❌ FAIL: User or OTP not found in users.json');
    process.exit(1);
  }

  const generatedOtp = targetUser.verifyOtp;
  console.log(`\n--- 2. Submitting Generated OTP: ${generatedOtp} ---`);
  const verifyRes = await makeRequest('/api/auth/verify-account', 'POST', {
    email: testEmail,
    otp: generatedOtp,
  });
  console.log('Verify Result:', verifyRes.data);

  if (!verifyRes.data.success || !verifyRes.data.token) {
    console.error('❌ FAIL: Verification failed to issue token!');
    process.exit(1);
  }
  console.log('✅ PASS: Account verified and token issued!');

  console.log('\n--- 3. Testing Login After OTP Verification ---');
  const loginRes = await makeRequest('/api/auth/login', 'POST', {
    email: testEmail,
    password: testPass,
  });
  console.log('Post-OTP Login Result:', loginRes.data);

  if (loginRes.data.success && loginRes.data.token) {
    console.log('✅ PASS: Login succeeded after OTP verification!');
  } else {
    console.error('❌ FAIL: Post-OTP login failed!');
    process.exit(1);
  }
}

runTest().catch((e) => {
  console.error('Test Error:', e);
  process.exit(1);
});
