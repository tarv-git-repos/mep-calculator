import http from 'http';

function makeRequest(path, method, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 4000,
        path,
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
  const testEmail = `test_strict_${Date.now()}@gmail.com`;
  const testPass = 'KaifPass@123';
  const testName = 'Test User Strict';

  console.log(`\n--- TEST 1: Registering User (${testEmail}) ---`);
  const regRes = await makeRequest('/api/auth/register', 'POST', {
    name: testName,
    email: testEmail,
    password: testPass,
  });
  console.log('Register Response Status:', regRes.status);
  console.log('Register Response Body:', regRes.data);

  if (regRes.data.token) {
    console.error('❌ FAIL: Registration returned a JWT token for an unverified account!');
    process.exit(1);
  } else {
    console.log('✅ PASS: Registration did NOT return a JWT token for unverified account.');
  }

  console.log('\n--- TEST 2: Attempting Login Before OTP Verification ---');
  const loginRes = await makeRequest('/api/auth/login', 'POST', {
    email: testEmail,
    password: testPass,
  });
  console.log('Login Response:', loginRes.data);

  if (loginRes.data.success || loginRes.data.token) {
    console.error('❌ FAIL: Login succeeded before OTP verification!');
    process.exit(1);
  } else if (loginRes.data.requireVerification) {
    console.log('✅ PASS: Login correctly BLOCKED for unverified account with requireVerification: true.');
  }

  console.log('\n--- TEST 3: Verifying with Invalid OTP ---');
  const badVerifyRes = await makeRequest('/api/auth/verify-account', 'POST', {
    email: testEmail,
    otp: '000000',
  });
  console.log('Bad Verify Response:', badVerifyRes.data);
  if (badVerifyRes.data.success) {
    console.error('❌ FAIL: Invalid OTP was accepted!');
    process.exit(1);
  } else {
    console.log('✅ PASS: Invalid OTP rejected correctly.');
  }

  console.log('\n--- ALL PRE-OTP TESTS PASSED ---');
}

runTest().catch((e) => {
  console.error('Test Error:', e);
  process.exit(1);
});
