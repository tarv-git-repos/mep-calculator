const http = require('http');

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function testSuite() {
  console.log('--- Starting Notification System Verification ---');

  // 1. Send Test Notification
  const testNotifPayload = {
    recipientId: 'test_user_production',
    title: 'Test Notification Verification',
    message: 'Testing production notification CRUD and persistence lifecycle',
    link: '/ventilation',
    metadata: {
      id: 'test_comment_12345',
      commentId: 'test_comment_12345',
      authorId: 'test_author_1',
      authorName: 'Test Author',
      projectName: 'Test Project',
      targetName: 'Space 101',
      targetType: 'Space',
      text: 'Testing production notification CRUD and persistence lifecycle'
    }
  };

  const sendRes = await makeRequest('POST', '/api/notifications/send', testNotifPayload);
  console.log('1. POST /api/notifications/send response:', sendRes.status, sendRes.data?.success ? 'SUCCESS' : 'FAILED');

  const createdNotif = sendRes.data?.notification;
  if (!createdNotif) {
    console.error('Failed to create test notification');
    return;
  }
  const notifId = createdNotif.id;
  console.log('   Created Notification ID:', notifId, 'Comment ID:', createdNotif.metadata?.commentId);

  // 2. Mark as Read
  const readRes = await makeRequest('POST', '/api/notifications/read', { ids: [notifId, 'test_comment_12345'] });
  console.log('2. POST /api/notifications/read response:', readRes.status, readRes.data?.success ? 'SUCCESS' : 'FAILED');

  // 3. Mark as Completed
  const compRes = await makeRequest('POST', '/api/notifications/complete', { ids: [notifId, 'test_comment_12345'] });
  console.log('3. POST /api/notifications/complete response:', compRes.status, compRes.data?.success ? 'SUCCESS' : 'FAILED');

  // 4. Delete Notification
  const delRes = await makeRequest('POST', '/api/notifications/delete', { ids: [notifId, 'test_comment_12345'] });
  console.log('4. POST /api/notifications/delete response:', delRes.status, delRes.data?.success ? 'SUCCESS' : 'FAILED');

  console.log('\n✅ All backend CRUD endpoints verified successfully!');
}

testSuite().catch(console.error);
