// Polyfill File for older Node.js runtimes (Node 18)
if (typeof globalThis.File === 'undefined') {
  try {
    globalThis.File = class File {};
  } catch (e) {}
}

const { spawn } = require('child_process');
const path = require('path');

console.log('\n=============================================================');
console.log('   🍿 LANDY TV — FULLSTACK WEB SERVER & TELEGRAM BOTS');
console.log('=============================================================\n');

// 1. Start Express Server
const serverProcess = spawn(process.execPath, [path.join(__dirname, 'backend', 'server.js')], {
  stdio: 'inherit',
  cwd: __dirname
});

// 2. Start Landy TV Main Bot
const botProcess = spawn(process.execPath, [path.join(__dirname, 'backend', 'bot', 'bot.js')], {
  stdio: 'inherit',
  cwd: __dirname
});

// 3. Start Harry Bot (@HrryLinkGen_Bot - 4-Channel Promotion)
const harryProcess = spawn(process.execPath, [path.join(__dirname, 'backend', 'bot', 'harry_bot.js')], {
  stdio: 'inherit',
  cwd: __dirname
});

// 4. Start Harry 1 Bot (@hrrrrrrrrry_bot - 4-Channel Promotion)
const harry1Process = spawn(process.execPath, [path.join(__dirname, 'backend', 'bot', 'harry_1_bot.js')], {
  stdio: 'inherit',
  cwd: __dirname
});

// 5. Start Automatic Channel Poster Bot
const posterProcess = spawn(process.execPath, [path.join(__dirname, 'backend', 'bot', 'channel_poster.js')], {
  stdio: 'inherit',
  cwd: __dirname
});

// 6. Start Automated 3-Hour SEO PDF Engine Daemon
const pdfProcess = spawn(process.execPath, [path.join(__dirname, 'backend', 'pdf_automation', 'auto_generator.js'), '--daemon'], {
  stdio: 'inherit',
  cwd: __dirname
});

serverProcess.on('error', (err) => {
  console.error('Failed to start server process:', err);
});

botProcess.on('error', (err) => {
  console.error('Failed to start main bot process:', err);
});

harryProcess.on('error', (err) => {
  console.error('Failed to start Harry bot process:', err);
});

harry1Process.on('error', (err) => {
  console.error('Failed to start Harry 1 bot process:', err);
});

posterProcess.on('error', (err) => {
  console.error('Failed to start channel poster process:', err);
});

pdfProcess.on('error', (err) => {
  console.error('Failed to start PDF automation process:', err);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Landy TV services...');
  serverProcess.kill();
  botProcess.kill();
  harryProcess.kill();
  harry1Process.kill();
  posterProcess.kill();
  pdfProcess.kill();
  process.exit();
});
