process.env.PORT = '8081';
process.env.NITRO_PORT = '8081';
process.env.HOST = '0.0.0.0';
process.env.NITRO_HOST = '0.0.0.0';

console.log('Starting MEP Calculator Nitro server on http://localhost:8081 ...');
import('./dist-nitro-2/server/index.mjs').then(() => {
  console.log('MEP Calculator Nitro server is listening on http://localhost:8081');
}).catch(err => {
  console.error('Failed to start server:', err);
});
