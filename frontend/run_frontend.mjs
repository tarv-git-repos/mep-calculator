Object.defineProperty(process.versions, 'node', {
  value: '20.19.0',
  configurable: true,
  writable: true
});

import { createServer } from 'vite';

console.log('🚀 Starting MEP Calculator Dev Server...');
try {
  const server = await createServer();
  await server.listen();
  server.printUrls();
} catch (err) {
  console.error('❌ Vite Error:', err);
}
