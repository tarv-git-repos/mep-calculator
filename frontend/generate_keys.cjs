const { spawn } = require('child_process');

console.log("Starting Tauri signer generator...");
const child = spawn('node', ['node_modules/@tauri-apps/cli/tauri.js', 'signer', 'generate', '-w', 'updater_keys']);

let passwordSent = false;
child.stdout.on('data', data => {
  const output = data.toString();
  console.log('STDOUT:', output);
  if (output.toLowerCase().includes('password') && !passwordSent) {
    console.log("Sending empty password and confirmation...");
    passwordSent = true;
    child.stdin.write('\n\n');
  }
});

child.stderr.on('data', data => {
  console.error('STDERR:', data.toString());
});

child.on('close', code => {
  console.log(`Child process exited with code ${code}`);
});
